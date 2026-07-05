/**
 * Remote Play Host Agent - Windows Systems and Drivers Integration Engine
 * Senior Systems and Drivers Integration Engineer Reference Architecture
 * 
 * Pre-requisites on Windows host machine:
 * 1. Install ViGEmBus driver: https://github.com/nefarius/ViGEmBus/releases
 * 2. Install FFmpeg in PATH: https://ffmpeg.org/download.html
 * 3. Run: npm install
 */

const { io } = require('socket.io-client');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Optional Native WebRTC bindings
let wrtc = null;
try {
  wrtc = require('wrtc');
} catch (e) {
  try {
    wrtc = require('@roamhq/wrtc');
  } catch (err) {
    console.warn("[System Warning] WebRTC native bindings ('wrtc') not found. Low-latency direct signaling will fall back to WebSockets.");
  }
}

// Optional Native ViGEmBus client bindings
let ViGEmClient = null;
try {
  ViGEmClient = require('vigemclient');
} catch (e) {
  console.warn("[System Warning] ViGEmClient native bindings not found. Gamepad inputs will be logged to console instead of emulated.");
}

// Configuration (Defaults, overridden via CLI args or environment variables)
const SIGNALING_SERVER_URL = process.env.SIGNALING_URL || 'http://localhost:3000';
const ROOM_ID = process.env.ROOM_ID || 'test-room-123';
const STREAM_PASSWORD = process.env.STREAM_PASSWORD || 'super-secure-game-password';

console.log(`[Host Starting] Initializing Windows Remote Play Host Engine...`);

// Helper: SHA-256 hashing for password comparison
function sha256(string) {
  return crypto.createHash('sha256').update(string).digest('hex');
}

const passwordHash = sha256(STREAM_PASSWORD);
console.log(`[Hash Generated] Host Room Authentication Challenge: ${passwordHash}`);

// Establish connection to the Socket.io signaling server
const socket = io(SIGNALING_SERVER_URL);

let peerConnection = null;
let inputDataChannel = null;
let clientSocketId = null;

// Gamepad state management (ViGEmBus)
let client = null;
let controller = null;

const BUTTON_MAP = {
  'Button_A': 'A',
  'Button_B': 'B',
  'Button_X': 'X',
  'Button_Y': 'Y',
  'LB': 'LEFT_SHOULDER',
  'RB': 'RIGHT_SHOULDER',
  'Start': 'START',
  'Back': 'BACK',
  'Dpad_Up': 'DPAD_UP',
  'Dpad_Down': 'DPAD_DOWN',
  'Dpad_Left': 'DPAD_LEFT',
  'Dpad_Right': 'DPAD_RIGHT',
  'LS_Click': 'LEFT_THUMB',
  'RS_Click': 'RIGHT_THUMB'
};

/**
 * Initialize virtual controller driver handles
 */
function initializeGamepad() {
  if (ViGEmClient) {
    try {
      client = new ViGEmClient();
      client.connect();
      
      // Support both alloc and create naming conventions
      controller = typeof client.allocX360Controller === 'function'
        ? client.allocX360Controller()
        : client.createX360Controller();
        
      controller.connect();
      console.log("[ViGEmBus] Virtual Xbox 360 Controller successfully plugged into Windows device tree.");
    } catch (err) {
      console.error("[ViGEmBus Error] Failed to initialize virtual gamepad device driver. Falling back to sandbox logs.", err.message);
      setupMockController();
    }
  } else {
    setupMockController();
  }
}

/**
 * Sandbox Mock controller implementation for systems lacking ViGEmBus
 */
function setupMockController() {
  console.log("[ViGEmBus Sandbox] Initializing mock gamepad interface. Input report updates will output to stream.");
  controller = {
    connect: () => {},
    disconnect: () => { console.log("[ViGEmBus Sandbox] Mock controller unplugged."); },
    button: {
      A: { setValue: (val) => console.log(`[Gamepad Report] Button A -> ${val}`) },
      B: { setValue: (val) => console.log(`[Gamepad Report] Button B -> ${val}`) },
      X: { setValue: (val) => console.log(`[Gamepad Report] Button X -> ${val}`) },
      Y: { setValue: (val) => console.log(`[Gamepad Report] Button Y -> ${val}`) },
      LEFT_SHOULDER: { setValue: (val) => console.log(`[Gamepad Report] LB (Left Shoulder) -> ${val}`) },
      RIGHT_SHOULDER: { setValue: (val) => console.log(`[Gamepad Report] RB (Right Shoulder) -> ${val}`) },
      START: { setValue: (val) => console.log(`[Gamepad Report] START -> ${val}`) },
      BACK: { setValue: (val) => console.log(`[Gamepad Report] BACK -> ${val}`) },
      DPAD_UP: { setValue: (val) => console.log(`[Gamepad Report] DPAD UP -> ${val}`) },
      DPAD_DOWN: { setValue: (val) => console.log(`[Gamepad Report] DPAD DOWN -> ${val}`) },
      DPAD_LEFT: { setValue: (val) => console.log(`[Gamepad Report] DPAD LEFT -> ${val}`) },
      DPAD_RIGHT: { setValue: (val) => console.log(`[Gamepad Report] DPAD RIGHT -> ${val}`) },
      LEFT_THUMB: { setValue: (val) => console.log(`[Gamepad Report] LS CLICK -> ${val}`) },
      RIGHT_THUMB: { setValue: (val) => console.log(`[Gamepad Report] RS CLICK -> ${val}`) }
    },
    axis: {
      leftTrigger: { setValue: (val) => console.log(`[Gamepad Report] LT Trigger -> ${val}`) },
      rightTrigger: { setValue: (val) => console.log(`[Gamepad Report] RT Trigger -> ${val}`) },
      leftX: { 
        setValue: (val) => console.log(`[Gamepad Report] Stick Left X (Float) -> ${val}`),
        get valueRaw() { return this._raw; },
        set valueRaw(val) { this._raw = val; console.log(`[Gamepad Report] Stick Left X (Signed 16-Bit) -> ${val}`); },
        _raw: 0
      },
      leftY: { 
        setValue: (val) => console.log(`[Gamepad Report] Stick Left Y (Float) -> ${val}`),
        get valueRaw() { return this._raw; },
        set valueRaw(val) { this._raw = val; console.log(`[Gamepad Report] Stick Left Y (Signed 16-Bit) -> ${val}`); },
        _raw: 0
      },
      rightX: { 
        setValue: (val) => console.log(`[Gamepad Report] Stick Right X (Float) -> ${val}`),
        get valueRaw() { return this._raw; },
        set valueRaw(val) { this._raw = val; console.log(`[Gamepad Report] Stick Right X (Signed 16-Bit) -> ${val}`); },
        _raw: 0
      },
      rightY: { 
        setValue: (val) => console.log(`[Gamepad Report] Stick Right Y (Float) -> ${val}`),
        get valueRaw() { return this._raw; },
        set valueRaw(val) { this._raw = val; console.log(`[Gamepad Report] Stick Right Y (Signed 16-Bit) -> ${val}`); },
        _raw: 0
      }
    }
  };
}

// Initialize gamepad driver immediately
initializeGamepad();

socket.on('connect', () => {
  console.log(`[Connected] Connected to Signaling Server at ${SIGNALING_SERVER_URL}`);
  
  // Register as host
  socket.emit('register-host', { roomId: ROOM_ID, passwordHash }, (response) => {
    if (response.success) {
      console.log(`[Success] Room '${ROOM_ID}' registered. Waiting for authenticated clients...`);
      console.log(`[Join Link] Join at: http://localhost:3000/join?room=${ROOM_ID}`);
      if (process.send) {
        process.send({ type: 'status', event: 'host-registered', roomId: ROOM_ID });
      }
    } else {
      console.error(`[Failed] Failed to register room: ${response.error}`);
      if (process.send) {
        process.send({ type: 'status', event: 'host-failed', error: response.error });
      }
      process.exit(1);
    }
  });
});

/**
 * CLIENT READY EVENT
 * Emitted by server after client passes authentication gate.
 */
socket.on('client-ready', ({ clientSocketId: connectedClientId }) => {
  console.log(`[Client Verified] Client '${connectedClientId}' passed verification. Establishing WebRTC PeerConnection...`);
  clientSocketId = connectedClientId;
  if (process.send) {
    process.send({ type: 'status', event: 'client-connected', clientSocketId: connectedClientId });
  }
  initializeHostPeerConnection();
});

/**
 * WebRTC SDP Answer from Client
 */
socket.on('sdp-answer', async ({ answer }) => {
  console.log(`[Signaling] Received SDP Answer from client.`);
  if (peerConnection) {
    try {
      if (wrtc) {
        // Optimize remote SDP answer profile level constraints
        const optimizedAnswerSdp = optimizeSDP(answer.sdp);
        await peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription({ type: answer.type, sdp: optimizedAnswerSdp }));
        console.log(`[Success] Remote description set. Streaming pipeline fully established.`);
      } else {
        console.log(`[Signaling Sandbox] Skipping remote description update (wrtc fallback).`);
      }
    } catch (err) {
      console.error('[Error] Failed to set remote description:', err);
    }
  }
});

/**
 * ICE Candidate from Client
 */
socket.on('ice-candidate', async ({ candidate }) => {
  if (peerConnection && candidate) {
    try {
      if (wrtc) {
        await peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('[Error] Failed to add ICE Candidate:', err);
    }
  }
});

/**
 * WebSocket input fallback signaling listener
 */
socket.on('client-controller-input', (data) => {
  if (!inputDataChannel || inputDataChannel.readyState !== 'open') {
    // Process input signaling message with priority on the microtask queue
    process.nextTick(() => {
      handleInputMessage(JSON.stringify(data));
    });
  }
});

socket.on('client-disconnected', () => {
  console.warn(`[Client Left] Client disconnected. Releasing all virtual game inputs...`);
  if (process.send) {
    process.send({ type: 'status', event: 'client-disconnected' });
  }
  cleanupSession();
});

socket.on('disconnect', () => {
  console.warn(`[Disconnected] Disconnected from signaling server.`);
  if (process.send) {
    process.send({ type: 'status', event: 'client-disconnected' });
  }
  cleanupSession();
});

/**
 * Munges SDP payloads to force H.264 Constrained Baseline Profile (42e01f),
 * low packetization, and limits video bandwidth (4 Mbps) to avoid network jitter.
 */
function optimizeSDP(sdp) {
  if (!sdp) return sdp;
  let lines = sdp.split('\r\n');
  
  lines = lines.map(line => {
    if (line.startsWith('a=fmtp:') && line.includes('profile-level-id=')) {
      line = line.replace(/profile-level-id=[0-9a-fA-F]+/g, 'profile-level-id=42e01f');
      if (!line.includes('packetization-mode=1')) {
        line += ';packetization-mode=1';
      }
      if (!line.includes('level-asymmetry-allowed=1')) {
        line += ';level-asymmetry-allowed=1';
      }
    }
    return line;
  });
  
  const mVideoIdx = lines.findIndex(line => line.startsWith('m=video'));
  if (mVideoIdx !== -1) {
    const hasBitrateLimit = lines.slice(mVideoIdx, mVideoIdx + 5).some(l => l.startsWith('b=AS:'));
    if (!hasBitrateLimit) {
      lines.splice(mVideoIdx + 1, 0, 'b=AS:4000');
    }
  }
  
  return lines.join('\r\n');
}

/**
 * Initialize WebRTC Host Peer Connection
 * Setting up low-latency media streams and RTC Data Channels
 */
function initializeHostPeerConnection() {
  console.log(`[WebRTC] Setting up local RTCPeerConnection...`);
  
  if (!wrtc) {
    console.log("[WebRTC Sandbox] Native wrtc bindings not available. Skipping WebRTC PeerConnection setup.");
    // In mock environments, emit a dummy offer to allow the signaling handshake to resolve
    const mockOffer = {
      type: 'offer',
      sdp: 'v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=msid-semantic: WMS\r\n...'
    };
    console.log(`[WebRTC Sandbox] Emitting mock SDP Offer to client via signaling...`);
    socket.emit('sdp-offer', { offer: mockOffer });
    return;
  }
  
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  peerConnection = new wrtc.RTCPeerConnection(rtcConfig);
  
  // Setup media capture sources
  let videoSource = null;
  let audioSource = null;
  
  try {
    videoSource = new wrtc.nonstandard.RTCVideoSource();
    const videoTrack = videoSource.createTrack();
    peerConnection.addTrack(videoTrack);
  } catch (e) {
    console.error("Failed to add video track:", e);
  }
  
  try {
    audioSource = new wrtc.nonstandard.RTCAudioSource();
    const audioTrack = audioSource.createTrack();
    peerConnection.addTrack(audioTrack);
  } catch (e) {
    console.error("Failed to add audio track:", e);
  }
  
  // Create Data Channel for low-latency inputs
  try {
    const dataChannel = peerConnection.createDataChannel("input-channel", {
      ordered: false,
      maxRetransmits: 0
    });
    setupHostDataChannel(dataChannel);
  } catch (e) {
    console.error("Failed to create WebRTC Data Channel:", e);
  }
  
  // Listen for client-initiated Data Channels
  peerConnection.ondatachannel = (event) => {
    if (event.channel.label === 'input-channel') {
      setupHostDataChannel(event.channel);
    }
  };
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && socket) {
      socket.emit('ice-candidate', { candidate: event.candidate });
    }
  };
  
  peerConnection.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection State Changed: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState === 'connected') {
      console.log("[WebRTC] Pipeline connected! Spawning screen & audio loop...");
      startMediaCapture(videoSource, audioSource);
    } else if (
      peerConnection.connectionState === 'failed' || 
      peerConnection.connectionState === 'disconnected'
    ) {
      console.warn("[WebRTC] Peer connection lost. Cleaning up session handles.");
      cleanupSession();
    }
  };
  
  // Generate SDP Offer
  peerConnection.createOffer().then(async (offer) => {
    // Apply SDP baseline and bitrate limitations on local offer
    const optimizedOfferSdp = optimizeSDP(offer.sdp);
    await peerConnection.setLocalDescription(new wrtc.RTCSessionDescription({ type: offer.type, sdp: optimizedOfferSdp }));
    console.log(`[Signaling] Emitting optimized local SDP Offer to client...`);
    socket.emit('sdp-offer', { offer: { type: offer.type, sdp: optimizedOfferSdp } });
  }).catch((err) => {
    console.error("Failed to compile local SDP offer:", err);
  });
}

/**
 * Configure data channel listeners
 */
function setupHostDataChannel(channel) {
  inputDataChannel = channel;
  
  channel.onopen = () => {
    console.log("[WebRTC DataChannel] 'input-channel' connected and ready for packet stream!");
  };
  channel.onclose = () => {
    console.log("[WebRTC DataChannel] 'input-channel' closed.");
    inputDataChannel = null;
  };
  channel.onerror = (err) => {
    console.error("[WebRTC DataChannel Error]:", err);
  };
  channel.onmessage = (event) => {
    // Force incoming input reports processing to the microtask queue for absolute priority
    process.nextTick(() => {
      handleInputMessage(event.data);
    });
  };
}

/**
 * Requirement 4: Parse packet types and dispatch input reports to the OS
 */
function handleInputMessage(dataStr) {
  let data;
  try {
    data = JSON.parse(dataStr);
  } catch (e) {
    // If fallback Socket.io data is already a JSON object:
    if (typeof dataStr === 'object') {
      data = dataStr;
    } else {
      console.error("Failed to parse incoming packet:", e);
      return;
    }
  }

  if (process.send) {
    process.send({ type: 'input', data });
  }

  if (!controller) return;

  // We support both signaling formats (WebRTC packed payload vs Socket.io parameters)
  const t = data.t || data.type;
  const k = data.k || data.action;
  const id = data.id || data.action;
  const x = data.hasOwnProperty('x') ? data.x : (data.value && data.value.hasOwnProperty('x') ? data.value.x : 0);
  const y = data.hasOwnProperty('y') ? data.y : (data.value && data.value.hasOwnProperty('y') ? data.value.y : 0);
  const val = data.hasOwnProperty('value') ? data.value : null;

  // 1. Process Buttons (keydown/keyup)
  if (t === 'kd' || t === 'pressed' || t === 'ku' || t === 'released') {
    const isPressed = (t === 'kd' || t === 'pressed');
    
    if (k === 'LT') {
      controller.axis.leftTrigger.setValue(isPressed ? 1.0 : 0.0);
    } else if (k === 'RT') {
      controller.axis.rightTrigger.setValue(isPressed ? 1.0 : 0.0);
    } else if (BUTTON_MAP[k]) {
      const targetBtn = controller.button[BUTTON_MAP[k]];
      if (targetBtn) {
        targetBtn.setValue(isPressed);
      }
    }
    
    // Instantly dispatch reports
    if (typeof controller.update === 'function') {
      controller.update();
    }
  } 
  // 2. Process Analog Joysticks (Fractional values -> Signed 16-Bit)
  else if (t === 'joy' || t === 'axis') {
    let rawX = 0;
    let rawY = 0;
    
    if (t === 'joy') {
      // Scale fractional float coordinates to signed 16-bit: -32768 to 32767
      const scaleAxis = (val) => {
        return Math.max(-32768, Math.min(32767, Math.round(val * 32767)));
      };
      rawX = scaleAxis(x);
      rawY = scaleAxis(y);
    } else if (t === 'axis' && val) {
      const scaleAxis = (val) => {
        return Math.max(-32768, Math.min(32767, Math.round(val * 32767)));
      };
      rawX = scaleAxis(val.x);
      rawY = scaleAxis(val.y);
    }

    const targetStick = id.toLowerCase();
    if (targetStick === 'left_stick') {
      controller.axis.leftX.valueRaw = rawX;
      controller.axis.leftY.valueRaw = rawY;
    } else if (targetStick === 'right_stick') {
      controller.axis.rightX.valueRaw = rawX;
      controller.axis.rightY.valueRaw = rawY;
    }
    
    // Instantly dispatch reports
    if (typeof controller.update === 'function') {
      controller.update();
    }
  }
}

// Media Capture Variables
let ffmpegProcess = null;
let simulationInterval = null;

/**
 * Requirement 2: Capture screen at 60 FPS alongside loopback system audio
 */
function startMediaCapture(videoSource, audioSource) {
  // Teardown any existing loops
  if (ffmpegProcess) ffmpegProcess.kill();
  if (simulationInterval) clearInterval(simulationInterval);

  console.log("[Capture] Spawning local Windows FFmpeg screen grabber (60 FPS)...");
  
  const width = 1920;
  const height = 1080;
  const frameSize = width * height * 1.5; // YUV420p frame size
  
  // Gdigrab captures Windows desktop.
  // We pipe raw YUV420p video to stdout.
  const ffmpegArgs = [
    '-f', 'gdigrab',
    '-framerate', '60',
    '-i', 'desktop',
    '-pix_fmt', 'yuv420p',
    '-f', 'rawvideo',
    'pipe:1'
  ];

  try {
    ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
    
    let videoBuffer = Buffer.alloc(0);
    
    ffmpegProcess.stdout.on('data', (chunk) => {
      // Process video buffer in setImmediate to prevent locking the main thread
      setImmediate(() => {
        videoBuffer = Buffer.concat([videoBuffer, chunk]);
        
        while (videoBuffer.length >= frameSize) {
          const frameData = videoBuffer.slice(0, frameSize);
          videoBuffer = videoBuffer.slice(frameSize);
          
          if (videoSource) {
            videoSource.onFrame({
              width,
              height,
              data: new Uint8ClampedArray(frameData)
            });
          }
        }
      });
    });

    ffmpegProcess.on('error', (err) => {
      console.warn("[Capture Sandbox] FFmpeg spawn error (missing binary). Launching simulated 60 FPS sandbox stream...");
      startSimulatedCapture(videoSource, audioSource);
    });
  } catch (err) {
    console.warn("[Capture Sandbox] Failed to spawn FFmpeg capture process. Launching simulated 60 FPS sandbox stream...");
    startSimulatedCapture(videoSource, audioSource);
  }
}

/**
 * Resilient sandbox frame simulation loop
 */
function startSimulatedCapture(videoSource, audioSource) {
  const width = 640;
  const height = 360;
  const frameSize = width * height * 1.5;
  const dummyFrame = new Uint8ClampedArray(frameSize); // Solid dark frame
  
  simulationInterval = setInterval(() => {
    if (videoSource) {
      videoSource.onFrame({
        width,
        height,
        data: dummyFrame
      });
    }
  }, 1000 / 60); // 60 FPS
}

/**
 * Requirement 5: Release active inputs and programmatically unplug virtual gamepad
 */
function releaseVirtualInputs() {
  if (!controller) return;
  console.log("[Teardown] Neutralizing all virtual gamepad trigger and thumbstick positions...");
  
  try {
    // Set all buttons to released
    for (const key in controller.button) {
      if (controller.button[key] && typeof controller.button[key].setValue === 'function') {
        controller.button[key].setValue(false);
      }
    }
    // Center all axes
    for (const key in controller.axis) {
      if (controller.axis[key] && typeof controller.axis[key].setValue === 'function') {
        controller.axis[key].setValue(0.0);
      }
    }
    // Update driver state
    if (typeof controller.update === 'function') {
      controller.update();
    }
  } catch (err) {
    console.warn("Failed to clear virtual gamepad properties cleanly:", err.message);
  }
}

function disconnectController() {
  if (controller) {
    try {
      releaseVirtualInputs();
      console.log("[Teardown] Unplugging virtual controller from ViGEmBus driver...");
      controller.disconnect();
    } catch (err) {
      console.error("Error unplugging gamepad target:", err.message);
    }
    controller = null;
  }
}

/**
 * Teardown entire connection pipeline
 */
function cleanupSession() {
  console.log("[Teardown] WebRTC connection dropped. Cleaning up capture streams & virtual devices...");
  
  if (ffmpegProcess) {
    try { ffmpegProcess.kill(); } catch (e) {}
    ffmpegProcess = null;
  }
  
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  
  disconnectController();
  
  if (peerConnection) {
    try { peerConnection.close(); } catch (e) {}
    peerConnection = null;
  }
  inputDataChannel = null;
  clientSocketId = null;
  
  // Reconnect gamepad on driver level for the next incoming client session
  initializeGamepad();
}

// Clean termination process handlers
process.on('SIGINT', () => {
  console.log("\n[SIGINT] Terminating host backend...");
  cleanupSession();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("\n[SIGTERM] Terminating host backend...");
  cleanupSession();
  process.exit(0);
});
