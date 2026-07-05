/**
 * Ultra-Low-Latency Web-Based Remote Game Streaming Signaling Server
 * Senior Systems Engineer Reference Architecture
 * 
 * Technology Stack: Node.js, Express, Socket.io
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with optimized settings for ultra-low-latency signaling
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust based on deployment environment
    methods: ['GET', 'POST']
  },
  // Lower latency configuration for real-time signaling
  pingTimeout: 5000,
  pingInterval: 10000
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Serve static files from '/public' directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Client Flow Route
 * Serves the frontend client page for URLs like https://domain.com/join?room=ROOM_ID
 */
app.get('/join', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Secure In-Memory Session Store
 * Maps Room ID (string) to Room Session Metadata
 * Structure:
 * {
 *   roomId: string,
 *   hostSocketId: string,
 *   passwordHash: string, // Secure SHA-256 (or similar) hash provided by the host
 *   clientSocketId: string | null,
 *   clientAuthenticated: boolean
 * }
 */
const activeRooms = new Map();

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - Stored hash
 * @param {string} b - Client provided hash
 * @returns {boolean} - True if hashes match
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    // Execute dummy comparison to consume equivalent time and mitigate timing leaks
    crypto.timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  /**
   * HOST FLOW
   * Host registers a new dynamic streaming session with a Room ID and Password Hash
   */
  socket.on('register-host', ({ roomId, passwordHash }, callback) => {
    if (!roomId || !passwordHash) {
      console.warn(`[Host Error] Registration failed due to missing credentials. Socket: ${socket.id}`);
      return callback && callback({ success: false, error: 'Room ID and Password Hash are required.' });
    }

    if (activeRooms.has(roomId)) {
      console.warn(`[Host Error] Registration rejected. Room already active: ${roomId}`);
      return callback && callback({ success: false, error: 'Room ID already in use.' });
    }

    // Store room session securely in server memory
    activeRooms.set(roomId, {
      roomId,
      hostSocketId: socket.id,
      passwordHash,
      clientSocketId: null,
      clientAuthenticated: false
    });

    // Track room details on socket context
    socket.roomId = roomId;
    socket.isHost = true;
    socket.join(roomId);

    console.log(`[Host Registered] Room: ${roomId} | Socket: ${socket.id}`);
    if (callback) callback({ success: true });
  });

  /**
   * CLIENT FLOW - STAGE 1: Join Request
   * Client requests to join a specific Room ID
   */
  socket.on('client-join-request', ({ roomId }, callback) => {
    if (!roomId) {
      return callback && callback({ success: false, error: 'Room ID is required.' });
    }

    const room = activeRooms.get(roomId);
    if (!room) {
      console.warn(`[Client Error] Join requested for non-existent room: ${roomId}`);
      return callback && callback({ success: false, error: 'Room not found.' });
    }

    if (room.clientSocketId && room.clientSocketId !== socket.id) {
      console.warn(`[Client Error] Join rejected. Room: ${roomId} is already occupied.`);
      return callback && callback({ success: false, error: 'Room session is currently full.' });
    }

    // Allocate client slot but DO NOT authenticate yet
    room.clientSocketId = socket.id;
    room.clientAuthenticated = false;

    // Track room details on socket context
    socket.roomId = roomId;
    socket.isHost = false;

    console.log(`[Client Pending] Socket: ${socket.id} requested to join Room: ${roomId}. Enforcing authentication.`);
    if (callback) callback({ success: true, requiresPassword: true });
  });

  /**
   * CLIENT FLOW - STAGE 2: Password Verification Challenge
   * Client submits password hash to gain room entry
   */
  socket.on('verify-password', ({ roomId, passwordHash }, callback) => {
    if (!roomId || !passwordHash) {
      return callback && callback({ success: false, error: 'Missing challenge parameters.' });
    }

    const room = activeRooms.get(roomId);
    if (!room) {
      return callback && callback({ success: false, error: 'Room session expired or does not exist.' });
    }

    if (room.clientSocketId !== socket.id) {
      return callback && callback({ success: false, error: 'Unauthorized socket access.' });
    }

    // Enforce constant-time verification challenge
    const isValid = safeCompare(room.passwordHash, passwordHash);

    if (isValid) {
      room.clientAuthenticated = true;
      socket.join(roomId);
      
      console.log(`[Client Authenticated] Socket: ${socket.id} joined Room: ${roomId}`);

      // Notify the Host that the client is authenticated and ready to initiate WebRTC handshake
      io.to(room.hostSocketId).emit('client-ready', { clientSocketId: socket.id });
      
      if (callback) callback({ success: true });
    } else {
      console.warn(`[Client Auth Failed] Invalid credentials for Room: ${roomId} from Socket: ${socket.id}`);
      if (callback) callback({ success: false, error: 'Invalid password.' });
    }
  });

  /**
   * WEBRTC SIGNALING MIDDLEWARE CHECK & FORWARDING
   * Prevent any signaling exchange (SDP offer/answer, ICE candidates) before authentication
   */

  // Forward WebRTC SDP Offer
  socket.on('sdp-offer', ({ offer }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (!room) return;

    // CRITICAL: Block WebRTC communication until client is verified
    if (!room.clientAuthenticated) {
      console.warn(`[Signaling Blocked] Unauthorized SDP offer in Room: ${roomId}`);
      return;
    }

    if (socket.isHost) {
      // Forward SDP offer from Host to Authenticated Client
      io.to(room.clientSocketId).emit('sdp-offer', { offer });
    } else if (socket.id === room.clientSocketId) {
      // Forward SDP offer from Client to Host
      io.to(room.hostSocketId).emit('sdp-offer', { offer });
    }
  });

  // Forward WebRTC SDP Answer
  socket.on('sdp-answer', ({ answer }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (!room) return;

    // CRITICAL: Block WebRTC communication until client is verified
    if (!room.clientAuthenticated) {
      console.warn(`[Signaling Blocked] Unauthorized SDP answer in Room: ${roomId}`);
      return;
    }

    if (socket.isHost) {
      // Forward SDP answer from Host to Authenticated Client
      io.to(room.clientSocketId).emit('sdp-answer', { answer });
    } else if (socket.id === room.clientSocketId) {
      // Forward SDP answer from Client to Host
      io.to(room.hostSocketId).emit('sdp-answer', { answer });
    }
  });

  // Forward WebRTC ICE Candidate
  socket.on('ice-candidate', ({ candidate }) => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (!room) return;

    // CRITICAL: Block WebRTC communication until client is verified
    if (!room.clientAuthenticated) {
      console.warn(`[Signaling Blocked] Unauthorized ICE candidate in Room: ${roomId}`);
      return;
    }

    if (socket.isHost) {
      // Forward ICE candidate from Host to Authenticated Client
      io.to(room.clientSocketId).emit('ice-candidate', { candidate });
    } else if (socket.id === room.clientSocketId) {
      // Forward ICE candidate from Client to Host
      io.to(room.hostSocketId).emit('ice-candidate', { candidate });
    }
  });

  /**
   * CLEAN TEARDOWN & RECOVERY
   * Handles disconnects from both Host and Client, clearing room data and resetting inputs.
   */
  socket.on('disconnect', () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const room = activeRooms.get(roomId);
    if (!room) return;

    if (socket.isHost) {
      console.log(`[Host Dropped] Room: ${roomId} | Host Socket: ${socket.id}. Cleaning up room...`);
      
      if (room.clientSocketId) {
        // 1. Notify client to drop connection
        // 2. Instruct client to immediately clear/neutralize active input states (preventing sticky commands)
        io.to(room.clientSocketId).emit('host-disconnected', {
          message: 'Host disconnected. Stream ended.',
          clearInputs: true
        });
      }

      // 3. Completely delete room data from memory
      activeRooms.delete(roomId);

    } else if (socket.id === room.clientSocketId) {
      console.log(`[Client Dropped] Room: ${roomId} | Client Socket: ${socket.id}`);

      // 1. Notify Host of client disconnect so the host can immediately halt video capture
      //    and release all virtual controller keys/inputs to prevent stuck commands.
      io.to(room.hostSocketId).emit('client-disconnected');

      // 2. Clear client slot and revert authentication status
      room.clientSocketId = null;
      room.clientAuthenticated = false;
    }
  });
});

// Start the Signaling Server
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  SIGNALING SERVER RUNNING ON PORT: ${PORT}`);
  console.log(`  Serving static frontend files from: /public`);
  console.log(`==================================================`);
});
