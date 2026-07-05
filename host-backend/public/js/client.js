/**
 * Remote Play WebRTC Stream Client Engine with Controller Layout Designer
 * Fully optimized for mobile widescreen viewport constraints, fullscreen,
 * burger drawer navigation menus, and concurrent multi-touch gameplay.
 */

// --- UI SECTION REFERENCES ---
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const streamSection = document.getElementById('streamSection');
const connectionInfo = document.getElementById('connectionInfo');

// --- OVERLAY WINDOWS ---
const orientationGuard = document.getElementById('orientationGuard');
const fullscreenPrompt = document.getElementById('fullscreenPrompt');
const btnLaunchFullscreen = document.getElementById('btnLaunchFullscreen');

// --- APP LAYOUT SECTIONS ---
const appContainer = document.getElementById('appContainer');
const homeSection = document.getElementById('homeSection');
const workspaceSection = document.getElementById('workspaceSection');

// --- HOME SCREEN LINKS ---
const btnHomeConnect = document.getElementById('btnHomeConnect');
const btnHomeEdit = document.getElementById('btnHomeEdit');
const btnHomeExit = document.getElementById('btnHomeExit');
const homeRoomInfo = document.getElementById('homeRoomInfo');

// --- UI CONTROLS REFERENCES ---
const passwordInput = document.getElementById('passwordInput');
const authBtn = document.getElementById('authBtn');
const btnCancelAuth = document.getElementById('btnCancelAuth');
const authError = document.getElementById('authError');
const remoteVideo = document.getElementById('remoteVideo');
const disconnectBtn = document.getElementById('disconnectBtn');
const generalNotification = document.getElementById('generalNotification');
const generalNotificationText = document.getElementById('generalNotificationText');

// --- TELEMETRY REFERENCES ---
const statPing = document.getElementById('statPing');
const statFps = document.getElementById('statFps');
const statBitrate = document.getElementById('statBitrate');

// --- DESIGNER PANEL REFERENCES ---
const editCanvasGrid = document.getElementById('editCanvasGrid');
const mockStreamBackground = document.getElementById('mockStreamBackground');
const designerCanvas = document.getElementById('designerCanvas');
const canvasInstructions = document.getElementById('canvasInstructions');
const canvasContainer = document.getElementById('canvasContainer');

// --- BURGER MENU & DRAWER SIDEBAR ---
const btnBurgerMenu = document.getElementById('btnBurgerMenu');
const btnPlayControls = document.getElementById('btnPlayControls');
const editorDrawer = document.getElementById('editorDrawer');
const btnBurgerClose = document.getElementById('btnBurgerClose');
const tabAdd = document.getElementById('tabAdd');
const tabProps = document.getElementById('tabProps');
const tabContentAdd = document.getElementById('tabContentAdd');
const tabContentProps = document.getElementById('tabContentProps');
const btnDrawerPlayMode = document.getElementById('btnDrawerPlayMode');
const btnDrawerHome = document.getElementById('btnDrawerHome');

// --- PROPERTIES PANELS REFERENCES ---
const propertyFormContainer = document.getElementById('propertyFormContainer');
const propertyFormEmpty = document.getElementById('propertyFormEmpty');
const propId = document.getElementById('propId');
const propLabel = document.getElementById('propLabel');
const propMapping = document.getElementById('propMapping');
const propSize = document.getElementById('propSize');
const propSizeVal = document.getElementById('propSizeVal');
const propOpacity = document.getElementById('propOpacity');
const propOpacityVal = document.getElementById('propOpacityVal');
const btnDeleteComponent = document.getElementById('btnDeleteComponent');

// --- LOGGING REFERENCES ---
const inputLogsContainer = document.getElementById('inputLogsContainer');
const btnClearLogs = document.getElementById('btnClearLogs');

// --- SHARING REFERENCES ---
const btnCopyShare = document.getElementById('btnCopyShare');
const btnImportShare = document.getElementById('btnImportShare');
const importShareModal = document.getElementById('importShareModal');
const importShareInput = document.getElementById('importShareInput');
const btnConfirmImport = document.getElementById('btnConfirmImport');
const btnCancelImport = document.getElementById('btnCancelImport');
const importError = document.getElementById('importError');

// --- STATE MANAGEMENT ---
let socket = null;
let peerConnection = null;
let inputDataChannel = null;
let roomId = null;
const activeKeys = new Set();
const mouseButtons = new Set();

// Layout Designer state variables
let components = [];
let selectedComponentId = null;
let isEditMode = true;

// Dragging and resizing tracking (Edit Mode)
let activeAction = null; // 'dragging', 'resizing', or null
let actionTargetId = null;
let initialPointerX = 0;
let initialPointerY = 0;
let initialCompX = 0;
let initialCompY = 0;
let initialCompSize = 10;

// PLAY MODE: Registry for isolated touch point pointer tracking
const activePointers = {};

// Color palettes mapping for designer elements
const componentColors = {
  accent: {
    bg: 'bg-game-accent/20',
    border: 'border-game-accent',
    text: 'text-game-accent',
    glow: 'shadow-[0_0_15px_rgba(124,77,255,0.4)]',
    btnColor: '#7c4dff'
  },
  green: {
    bg: 'bg-[#00e676]/20',
    border: 'border-[#00e676]',
    text: 'text-[#00e676]',
    glow: 'shadow-[0_0_15px_rgba(0,230,118,0.4)]',
    btnColor: '#00e676'
  },
  red: {
    bg: 'bg-[#ff1744]/20',
    border: 'border-[#ff1744]',
    text: 'text-[#ff1744]',
    glow: 'shadow-[0_0_15px_rgba(255,23,68,0.4)]',
    btnColor: '#ff1744'
  },
  blue: {
    bg: 'bg-[#29b6f6]/20',
    border: 'border-[#29b6f6]',
    text: 'text-[#29b6f6]',
    glow: 'shadow-[0_0_15px_rgba(41,182,246,0.4)]',
    btnColor: '#29b6f6'
  },
  yellow: {
    bg: 'bg-[#ffee58]/20',
    border: 'border-[#ffee58]',
    text: 'text-[#ffee58]',
    glow: 'shadow-[0_0_15px_rgba(255,238,88,0.4)]',
    btnColor: '#ffee58'
  }
};

// URL Query Param Parsing
const urlParams = new URLSearchParams(window.location.search);
roomId = urlParams.get('room');
const urlPass = urlParams.get('pass');
if (urlPass) {
  const fillPassword = () => {
    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
      passwordInput.value = urlPass;
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillPassword);
  } else {
    fillPassword();
  }
}

// Standard STUN servers for WebRTC
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// SHA-256 Hashing
async function sha256(string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(bytes => bytes.toString(16).padStart(2, '0')).join('');
}

// Room Check Bootstrap
if (!roomId) {
  homeRoomInfo.textContent = 'Room Error: No ID Provided';
  btnHomeConnect.disabled = true;
  btnHomeConnect.classList.add('opacity-40', 'cursor-not-allowed');
} else {
  homeRoomInfo.textContent = `Target Room ID: ${roomId}`;
}

// --- PORTRAIT/LANDSCAPE DETECTION & FULLSCREEN HANDLERS ---

function checkOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  
  if (isPortrait) {
    orientationGuard.classList.remove('hidden');
    orientationGuard.classList.add('flex');
    fullscreenPrompt.classList.remove('flex');
    fullscreenPrompt.classList.add('hidden');
  } else {
    orientationGuard.classList.remove('flex');
    orientationGuard.classList.add('hidden');
    checkFullscreenPrompt();
  }
}

function checkFullscreenPrompt() {
  const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFullscreen) {
    fullscreenPrompt.classList.remove('hidden');
    fullscreenPrompt.classList.add('flex');
  } else {
    fullscreenPrompt.classList.remove('flex');
    fullscreenPrompt.classList.add('hidden');
  }
}

// Bind orientation listeners
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);
document.addEventListener('fullscreenchange', checkOrientation);
document.addEventListener('webkitfullscreenchange', checkOrientation);

// Request Fullscreen launch trigger
btnLaunchFullscreen.addEventListener('click', async () => {
  try {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      await docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      await docEl.webkitRequestFullscreen();
    }
    
    // Attempt mobile orientation lock
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (err) {
    console.warn("Fullscreen activation rejected by device policies:", err);
  }
  checkOrientation();
});


// --- APP NAVIGATION AND SECTIONS ---

function showScreenSection(sectionId) {
  if (sectionId === 'home') {
    homeSection.classList.remove('hidden');
    workspaceSection.classList.add('hidden');
  } else if (sectionId === 'workspace') {
    homeSection.classList.add('hidden');
    workspaceSection.classList.remove('hidden');
  }
}

// Home screen triggers
btnHomeConnect.addEventListener('click', () => {
  authError.classList.add('hidden');
  showScreenSection('workspace');
  setMode(false); // Connect launches straight to stream (Play Mode)
  
  if (urlPass) {
    passwordInput.value = urlPass;
    authSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    
    sha256(urlPass).then(passwordHash => {
      initializeSocketAndConnect(passwordHash);
    }).catch(err => {
      console.error(err);
      authSection.classList.remove('hidden');
      loadingSection.classList.add('hidden');
    });
  } else {
    passwordInput.value = '';
    authSection.classList.remove('hidden');
  }
});

btnHomeEdit.addEventListener('click', () => {
  showScreenSection('workspace');
  setMode(true); // Open in Edit Mode
  toggleDrawer(true); // Auto-reveal sidebar menu drawer
});

btnHomeExit.addEventListener('click', () => {
  cleanupSession('Console application terminated.');
  showScreenSection('home');
  // Attempt to exit fullscreen
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen().catch(() => {});
  }
});

btnCancelAuth.addEventListener('click', () => {
  authSection.classList.add('hidden');
  showScreenSection('home');
});

// Authentication Button Handler
authBtn.addEventListener('click', async () => {
  const password = passwordInput.value;
  if (!password) {
    showError('Password is required.');
    return;
  }
  authError.classList.add('hidden');
  
  // Show verifying status modal
  authSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');

  try {
    const passwordHash = await sha256(password);
    initializeSocketAndConnect(passwordHash);
  } catch (err) {
    console.error('Crypto error:', err);
    showError('Client cryptography failure.');
    loadingSection.classList.add('hidden');
    authSection.classList.remove('hidden');
  }
});


// --- DRAWER BAR DRAWER SIDEBAR NAVIGATION ---

function toggleDrawer(open) {
  if (open) {
    editorDrawer.classList.remove('-translate-x-[305px]');
  } else {
    editorDrawer.classList.add('-translate-x-[305px]');
  }
}

btnBurgerMenu.addEventListener('click', () => toggleDrawer(true));
btnBurgerClose.addEventListener('click', () => toggleDrawer(false));

// Tabs Selector Logic
function selectTab(tabId) {
  if (tabId === 'add') {
    tabAdd.className = 'flex-1 py-1.5 rounded-md text-center bg-game-accent/20 border border-game-accent/25 text-white transition-all uppercase';
    tabProps.className = 'flex-1 py-1.5 rounded-md text-center text-neutral-400 hover:text-white transition-all uppercase';
    tabContentAdd.classList.remove('hidden');
    tabContentProps.classList.add('hidden');
  } else if (tabId === 'props') {
    tabProps.className = 'flex-1 py-1.5 rounded-md text-center bg-game-accent/20 border border-game-accent/25 text-white transition-all uppercase';
    tabAdd.className = 'flex-1 py-1.5 rounded-md text-center text-neutral-400 hover:text-white transition-all uppercase';
    tabContentProps.classList.remove('hidden');
    tabContentAdd.classList.add('hidden');
  }
}

tabAdd.addEventListener('click', () => selectTab('add'));
tabProps.addEventListener('click', () => selectTab('props'));

btnDrawerPlayMode.addEventListener('click', () => {
  toggleDrawer(false);
  setMode(false);
});

btnDrawerHome.addEventListener('click', () => {
  toggleDrawer(false);
  cleanupSession();
  showScreenSection('home');
});


// --- INITIAL WEBRTC SOCKET CHANNELS ---

function showSection(sectionId) {
  // Compatibility shim for original JS calls mapping to overlays
  if (sectionId === 'authSection') {
    loadingSection.classList.add('hidden');
    authSection.classList.remove('hidden');
  } else if (sectionId === 'loadingSection') {
    authSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
  } else if (sectionId === 'streamSection') {
    authSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
  }
}

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function showNotification(msg) {
  generalNotificationText.textContent = msg;
  generalNotification.classList.remove('hidden');
  setTimeout(() => {
    generalNotification.classList.add('hidden');
  }, 4000);
}

function initializeSocketAndConnect(passwordHash) {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected to signaling server. Submitting join request...');
    socket.emit('client-join-request', { roomId }, (response) => {
      if (!response.success) {
        showError(response.error || 'Failed to join room.');
        showSection('authSection');
        socket.disconnect();
        return;
      }

      if (response.requiresPassword) {
        socket.emit('verify-password', { roomId, passwordHash }, (authResponse) => {
          if (!authResponse.success) {
            showError(authResponse.error || 'Authentication challenge failed.');
            showSection('authSection');
            socket.disconnect();
            return;
          }

          console.log('Password verified successfully. Initializing Peer Connection.');
          setupWebRTCPeerConnection();
        });
      }
    });
  });

  socket.on('sdp-offer', async ({ offer }) => {
    try {
      console.log('Received remote SDP offer from host.');
      // Optimize remote H.264 profile description settings
      const optimizedOfferSdp = optimizeSDP(offer.sdp);
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: offer.type, sdp: optimizedOfferSdp }));
      
      const answer = await peerConnection.createAnswer();
      
      // Optimize local H.264 profile constraints on generated answer
      const optimizedAnswerSdp = optimizeSDP(answer.sdp);
      await peerConnection.setLocalDescription(new RTCSessionDescription({ type: answer.type, sdp: optimizedAnswerSdp }));
      
      socket.emit('sdp-answer', { answer: { type: 'answer', sdp: optimizedAnswerSdp } });
      console.log('Sent optimized local SDP answer to host.');
    } catch (e) {
      console.error('Failed to handle SDP offer:', e);
      cleanupSession('WebRTC Handshake failed.');
    }
  });

  socket.on('ice-candidate', async ({ candidate }) => {
    try {
      if (peerConnection && candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.error('Error adding remote ICE candidate:', e);
    }
  });

  socket.on('host-disconnected', (data) => {
    console.warn('Host dropped connection.');
    if (data.clearInputs) {
      clearAllInputStates();
    }
    cleanupSession(data.message || 'Stream ended by host.');
  });

  socket.on('disconnect', () => {
    console.warn('Disconnected from signaling server.');
  });
}

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

function setupWebRTCPeerConnection() {
  peerConnection = new RTCPeerConnection(rtcConfig);

  // Requirement 3: Construct high-speed WebRTC Data Channel optimized for speed
  try {
    inputDataChannel = peerConnection.createDataChannel("input-channel", {
      ordered: false,
      maxRetransmits: 0
    });
    setupDataChannelListeners(inputDataChannel);
  } catch (e) {
    console.warn("Client could not create data channel directly:", e);
  }

  // Handle incoming data channels negotiated by host
  peerConnection.ondatachannel = (event) => {
    console.log("Received data channel from host:", event.channel.label);
    if (event.channel.label === 'input-channel') {
      inputDataChannel = event.channel;
      setupDataChannelListeners(inputDataChannel);
    }
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && socket) {
      socket.emit('ice-candidate', { candidate: event.candidate });
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log(`Connection State Change: ${peerConnection.connectionState}`);
    if (peerConnection.connectionState === 'connected') {
      showSection('streamSection');
      document.getElementById('statusDot').className = 'w-2.5 h-2.5 rounded-full bg-game-success animate-pulse-glow';
      document.getElementById('streamRoomStatus').textContent = `Streaming Room: ${roomId} (Live)`;
      mockStreamBackground.classList.add('opacity-0');
      setTimeout(() => mockStreamBackground.classList.add('hidden'), 300);
      startTelemetrySimulation();
      setupInteractiveInputListeners();
    } else if (
      peerConnection.connectionState === 'failed' || 
      peerConnection.connectionState === 'disconnected'
    ) {
      cleanupSession('WebRTC connection lost.');
    }
  };

  peerConnection.ontrack = (event) => {
    console.log('Received track:', event.streams ? event.streams[0] : null);
    if (event.streams && event.streams[0]) {
      if (remoteVideo.srcObject !== event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      }
    } else if (event.track) {
      const stream = new MediaStream([event.track]);
      remoteVideo.srcObject = stream;
    }
  };
}

function setupDataChannelListeners(channel) {
  channel.onopen = () => {
    console.log("Data channel 'input-channel' is now OPEN");
    addInputLog("DataChannel: Connected for low latency");
  };
  channel.onclose = () => {
    console.log("Data channel 'input-channel' is now CLOSED");
    addInputLog("DataChannel: Closed");
  };
  channel.onerror = (err) => {
    console.error("Data channel error:", err);
  };
}

function setupInteractiveInputListeners() {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  remoteVideo.addEventListener('contextmenu', e => e.preventDefault());
}

function handleKeyDown(e) {
  if (activeKeys.has(e.code)) return;
  activeKeys.add(e.code);
  console.log(`Input Down: ${e.code}`);
  addInputLog(`Keyboard: ${e.code} pressed`);
}

function handleKeyUp(e) {
  activeKeys.delete(e.code);
  console.log(`Input Up: ${e.code}`);
  addInputLog(`Keyboard: ${e.code} released`);
}

function clearAllInputStates() {
  activeKeys.clear();
  mouseButtons.clear();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
}

function cleanupSession(message) {
  clearAllInputStates();
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (remoteVideo.srcObject) {
    const tracks = remoteVideo.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    remoteVideo.srcObject = null;
  }
  stopTelemetrySimulation();
  
  // Restore backgrounds
  mockStreamBackground.classList.remove('hidden');
  mockStreamBackground.classList.remove('opacity-0');
  
  // Restore HUD statuses
  document.getElementById('statusDot').className = 'w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse-glow';
  document.getElementById('streamRoomStatus').textContent = 'Offline Sandbox';
  
  // Hide overlays
  authSection.classList.add('hidden');
  loadingSection.classList.add('hidden');
  
  if (message) {
    showNotification(message);
  }
}

// Telemetry & Network Diagnostic HUD Pollers
let statsInterval = null;
let lastPacketsLost = 0;
let lastFramesDecoded = 0;
let lastFpsTimestamp = 0;
let lastBytesReceived = 0;
let lastBytesTimestamp = 0;

function startTelemetrySimulation() {
  if (statsInterval) clearInterval(statsInterval);
  
  lastPacketsLost = 0;
  lastFramesDecoded = 0;
  lastFpsTimestamp = performance.now();
  lastBytesReceived = 0;
  lastBytesTimestamp = performance.now();
  
  statsInterval = setInterval(async () => {
    let ping = null;
    let fps = 0;
    let bitrate = 0;
    let packetsLost = 0;
    
    if (peerConnection) {
      try {
        const stats = await peerConnection.getStats();
        stats.forEach(report => {
          // 1. Get active candidate pair RTT (Ping)
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime !== undefined) {
            ping = Math.round(report.currentRoundTripTime * 1000);
          }
          
          // 2. Get Inbound Video statistics (FPS, Bitrate, Packets Lost)
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            packetsLost = report.packetsLost || 0;
            
            if (report.framesDecoded !== undefined) {
              const now = report.timestamp;
              if (lastFramesDecoded && lastFpsTimestamp) {
                const deltaFrames = report.framesDecoded - lastFramesDecoded;
                const deltaTime = (now - lastFpsTimestamp) / 1000;
                if (deltaTime > 0) {
                  fps = Math.round(deltaFrames / deltaTime);
                }
              }
              lastFramesDecoded = report.framesDecoded;
              lastFpsTimestamp = now;
            }
            
            if (report.bytesReceived !== undefined) {
              const now = report.timestamp;
              if (lastBytesReceived && lastBytesTimestamp) {
                const deltaBytes = report.bytesReceived - lastBytesReceived;
                const deltaTime = (now - lastBytesTimestamp) / 1000;
                if (deltaTime > 0) {
                  bitrate = ((deltaBytes * 8) / (1000 * 1000 * deltaTime)).toFixed(1);
                }
              }
              lastBytesReceived = report.bytesReceived;
              lastBytesTimestamp = now;
            }
          }
        });
      } catch (e) {
        console.warn("Failed to get WebRTC stats:", e);
      }
    }
    
    // Sandbox simulation fallback for display testing
    if (ping === null) {
      if (!isEditMode) {
        ping = Math.floor(Math.random() * 4) + 12; // 12-16ms simulated ping
        fps = Math.floor(Math.random() * 3) + 59; // 59-61 fps
        bitrate = (Math.random() * 5 + 45).toFixed(1); // 45-50 Mbps
      }
    }
    
    // Update HUD elements
    if (statPing) {
      statPing.textContent = ping !== null ? `${ping} ms` : '-- ms';
    }
    
    const statPacketDrops = document.getElementById('statPacketDrops');
    if (statPacketDrops) {
      statPacketDrops.textContent = packetsLost;
      if (packetsLost > lastPacketsLost) {
        statPacketDrops.className = 'text-red-400 font-bold animate-pulse';
      } else {
        statPacketDrops.className = 'text-neutral-400 font-bold';
      }
      lastPacketsLost = packetsLost;
    }
    
    if (statFps && fps > 0) {
      statFps.textContent = `${fps} fps`;
    }
    if (statBitrate && parseFloat(bitrate) > 0) {
      statBitrate.textContent = `${bitrate} Mbps`;
    }
  }, 1000);
}

function stopTelemetrySimulation() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  if (statPing) statPing.textContent = '-- ms';
  if (statFps) statFps.textContent = '-- fps';
  if (statBitrate) statBitrate.textContent = '-- Mbps';
  const statPacketDrops = document.getElementById('statPacketDrops');
  if (statPacketDrops) statPacketDrops.textContent = '0';
}


// --- DYNAMIC CONTROLLER DESIGNER & MULTI-TOUCH SIMULATION ENGINE ---

// Default standard gamepad positions
const DEFAULT_LAYOUT = [
  { id: 'comp-1', type: 'stick', mapping: 'Left_Stick', label: 'L', x: 10, y: 50, size: 16, opacity: 75, color: 'accent' },
  { id: 'comp-2', type: 'stick', mapping: 'Right_Stick', label: 'R', x: 74, y: 50, size: 16, opacity: 75, color: 'blue' },
  { id: 'comp-3', type: 'dpad', mapping: 'D_Pad', label: 'D-PAD', x: 10, y: 15, size: 16, opacity: 75, color: 'accent' },
  { id: 'comp-4', type: 'button', mapping: 'Button_A', label: 'A', x: 82, y: 28, size: 8, opacity: 80, color: 'green' },
  { id: 'comp-5', type: 'button', mapping: 'Button_B', label: 'B', x: 89, y: 16, size: 8, opacity: 80, color: 'red' },
  { id: 'comp-6', type: 'button', mapping: 'Button_X', label: 'X', x: 75, y: 16, size: 8, opacity: 80, color: 'blue' },
  { id: 'comp-7', type: 'button', mapping: 'Button_Y', label: 'Y', x: 82, y: 4, size: 8, opacity: 80, color: 'yellow' },
  { id: 'comp-8', type: 'button', mapping: 'LB', label: 'LB', x: 30, y: 4, size: 8, opacity: 70, color: 'accent' },
  { id: 'comp-9', type: 'button', mapping: 'RB', label: 'RB', x: 62, y: 4, size: 8, opacity: 70, color: 'accent' },
  { id: 'comp-10', type: 'button', mapping: 'LT', label: 'LT', x: 30, y: 16, size: 8, opacity: 70, color: 'accent' },
  { id: 'comp-11', type: 'button', mapping: 'RT', label: 'RT', x: 62, y: 16, size: 8, opacity: 70, color: 'accent' },
  { id: 'comp-12', type: 'button', mapping: 'Start', label: '☰', x: 44, y: 4, size: 5, opacity: 70, color: 'accent' },
  { id: 'comp-13', type: 'button', mapping: 'Back', label: '⧉', x: 51, y: 4, size: 5, opacity: 70, color: 'accent' }
];

function loadLayout() {
  const saved = localStorage.getItem('controller_layout_design');
  if (saved) {
    try {
      components = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved layout', e);
      components = [...DEFAULT_LAYOUT];
    }
  } else {
    components = [...DEFAULT_LAYOUT];
  }
}

function saveLayout() {
  localStorage.setItem('controller_layout_design', JSON.stringify(components));
}

// Render dynamic DOM controller nodes inside workspace canvas
function renderCanvas() {
  designerCanvas.innerHTML = '';
  
  components.forEach(comp => {
    const compEl = document.createElement('div');
    compEl.id = comp.id;
    compEl.className = `absolute select-none cursor-pointer flex items-center justify-center transition-shadow duration-300 comp-node touch-none`;
    
    // Relative scaling dimensions
    compEl.style.left = `${comp.x}%`;
    compEl.style.top = `${comp.y}%`;
    compEl.style.width = `${comp.size}%`;
    compEl.style.aspectRatio = '1/1';
    compEl.style.opacity = comp.opacity / 100;
    
    const colors = componentColors[comp.color] || componentColors.accent;
    
    // Select specific layout HTML node templates
    if (comp.type === 'button') {
      compEl.innerHTML = `
        <div class="w-full h-full rounded-full border-2 ${colors.border} ${colors.bg} ${colors.text} flex items-center justify-center font-bold text-xs shadow-md pointer-events-none active:scale-95 transition-transform">
          ${comp.label}
        </div>
      `;
    } else if (comp.type === 'stick') {
      compEl.innerHTML = `
        <div class="w-full h-full rounded-full border-2 ${colors.border} ${colors.bg} relative flex items-center justify-center shadow-lg pointer-events-none">
          <div class="absolute w-2/3 h-2/3 rounded-full border border-dashed ${colors.border} opacity-40"></div>
          <!-- Centered thumb knob with absolute left-1/4 top-1/4 -->
          <div class="thumb-knob absolute left-1/4 top-1/4 w-1/2 h-1/2 rounded-full ${colors.border} border bg-neutral-800/95 shadow-md flex flex-col items-center justify-center text-[8px] font-bold ${colors.text} pointer-events-none">
            <div class="w-3/4 h-3/4 rounded-full border border-white/5 bg-neutral-900 flex items-center justify-center pointer-events-none">
              <span class="opacity-75 pointer-events-none">${comp.label}</span>
            </div>
          </div>
        </div>
      `;
    } else if (comp.type === 'dpad') {
      compEl.innerHTML = `
        <div class="w-full h-full relative border-2 ${colors.border} ${colors.bg} rounded-xl shadow-lg flex items-center justify-center pointer-events-none">
          <div class="absolute inset-y-0 w-1/3 bg-neutral-900 border-x ${colors.border}"></div>
          <div class="absolute inset-x-0 h-1/3 bg-neutral-900 border-y ${colors.border}"></div>
          <div class="relative z-10 w-full h-full flex flex-col justify-between p-1 font-black text-[8px] ${colors.text}">
            <div class="text-center font-bold text-[9px] dpad-dir-up"><i class="fa-solid fa-caret-up"></i></div>
            <div class="flex justify-between px-1.5 font-bold text-[9px]">
              <span class="dpad-dir-left"><i class="fa-solid fa-caret-left"></i></span>
              <span class="dpad-dir-right"><i class="fa-solid fa-caret-right"></i></span>
            </div>
            <div class="text-center font-bold text-[9px] dpad-dir-down"><i class="fa-solid fa-caret-down"></i></div>
          </div>
          <!-- Centered Dpad center circle using top/left coordinates -->
          <div class="absolute left-[37.5%] top-[37.5%] w-1/4 h-1/4 bg-neutral-850 border border-neutral-750 rounded-full z-20"></div>
        </div>
      `;
    }

    // Modification visual highlight ring & resizing handles (Edit Mode)
    if (isEditMode) {
      if (comp.id === selectedComponentId) {
        compEl.classList.add('ring-2', 'ring-game-accent', 'ring-offset-2', 'ring-offset-black', colors.glow);
        
        // Bottom-Right Corner Scale Handle with icon
        const handle = document.createElement('div');
        handle.className = 'absolute bottom-0 right-0 w-5 h-5 bg-game-accent border border-white rounded-full cursor-se-resize z-30 translate-x-1.5 translate-y-1.5 shadow-lg flex items-center justify-center text-[7.5px] text-white pointer-events-auto hover:scale-110 active:scale-95 transition-transform';
        handle.dataset.action = 'resize';
        handle.innerHTML = `<i class="fa-solid fa-arrows-up-down-left-right pointer-events-none"></i>`;
        compEl.appendChild(handle);

        // Top-Right Corner Remove Button with icon
        const delBtn = document.createElement('div');
        delBtn.className = 'absolute top-0 right-0 w-5 h-5 bg-red-500 border border-white rounded-full cursor-pointer z-30 translate-x-1.5 -translate-y-1.5 shadow-lg flex items-center justify-center text-[8px] text-white pointer-events-auto hover:scale-110 active:scale-95 transition-transform';
        delBtn.dataset.action = 'delete';
        delBtn.innerHTML = `<i class="fa-regular fa-trash-can pointer-events-none"></i>`;
        compEl.appendChild(delBtn);
      }
    }

    designerCanvas.appendChild(compEl);
  });
}

// Toggle Workspace Modes
function setMode(editMode) {
  isEditMode = editMode;
  
  if (isEditMode) {
    btnBurgerMenu.classList.remove('hidden');
    btnPlayControls.classList.add('hidden');
    editCanvasGrid.classList.remove('opacity-0');
    canvasInstructions.classList.remove('opacity-0');
    
    updatePropertiesPanel();
  } else {
    btnBurgerMenu.classList.add('hidden');
    btnPlayControls.classList.remove('hidden');
    editCanvasGrid.classList.add('opacity-0');
    canvasInstructions.classList.add('opacity-0');
    
    // Auto collapse drawers in Play Mode
    toggleDrawer(false);
    selectedComponentId = null;
  }
  
  renderCanvas();
}

btnPlayControls.addEventListener('click', () => {
  setMode(true);
  toggleDrawer(true); // Open edit drawer settings on exit play mode
});

// --- PALETTE SPAWN TRIGGERS ---
document.querySelectorAll('.btn-add-comp').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!isEditMode) return;
    
    const type = btn.dataset.type;
    const mapping = btn.dataset.mapping;
    const label = btn.dataset.label;
    
    const newComp = {
      id: `comp-${Date.now()}`,
      type,
      mapping,
      label,
      x: 45, // Center canvas position coords
      y: 40,
      size: type === 'button' ? 8 : 16,
      opacity: 75,
      color: 'accent'
    };
    
    components.push(newComp);
    selectedComponentId = newComp.id;
    
    saveLayout();
    renderCanvas();
    
    // Switch to properties tab inside sidebar menu drawer automatically
    selectTab('props');
    updatePropertiesPanel();
    
    showNotification(`Spawned ${type} item.`);
  });
});


// --- INTERACTION CONTROLS: EDITING & ROBUST PLAY MULTI-TOUCH ---

designerCanvas.addEventListener('pointerdown', e => {
  const compEl = e.target.closest('.comp-node');
  if (!compEl) {
    if (isEditMode) {
      selectedComponentId = null;
      renderCanvas();
      updatePropertiesPanel();
    }
    return;
  }
  
  const comp = components.find(c => c.id === compEl.id);
  if (!comp) return;
  
  if (isEditMode) {
    const actionEl = e.target.closest('[data-action]');
    const action = actionEl ? actionEl.dataset.action : null;
    
    // Check if delete button clicked
    if (action === 'delete') {
      components = components.filter(c => c.id !== comp.id);
      selectedComponentId = null;
      saveLayout();
      renderCanvas();
      updatePropertiesPanel();
      showNotification('Element deleted.');
      e.stopPropagation();
      return;
    }

    selectedComponentId = comp.id;
    selectTab('props');
    updatePropertiesPanel();
    renderCanvas();
    
    // Set scale resize action or translation dragging action
    if (action === 'resize') {
      activeAction = 'resizing';
    } else {
      activeAction = 'dragging';
    }
    
    actionTargetId = comp.id;
    initialPointerX = e.clientX;
    initialPointerY = e.clientY;
    initialCompX = comp.x;
    initialCompY = comp.y;
    initialCompSize = comp.size;
    
    compEl.setPointerCapture(e.pointerId);
    e.stopPropagation();
  } else {
    // --- PLAY MODE: ISOLATED CONCURRENT TOUCH CONTROLLER CAPTURE ---
    e.preventDefault(); // Lock browser scrolling/drag defaults
    compEl.classList.add('comp-node-pressed'); // apply scale pressed styling
    compEl.setPointerCapture(e.pointerId);
    e.stopPropagation();
    
    if (comp.type === 'button') {
      // Highlight button visual press states
      const inner = compEl.querySelector('.rounded-full');
      if (inner) {
        inner.classList.add('scale-90', 'brightness-125', 'bg-white/20');
        inner.classList.add(componentColors[comp.color].glow);
      }
      
      activePointers[e.pointerId] = {
        type: 'button',
        component: comp,
        element: compEl
      };
      
      sendVirtualControllerInput(comp.mapping, 'pressed', 1.0);
      
    } else if (comp.type === 'stick') {
      const stickRect = compEl.getBoundingClientRect();
      const centerX = stickRect.left + stickRect.width / 2;
      const centerY = stickRect.top + stickRect.height / 2;
      const maxRadius = stickRect.width / 2;
      
      activePointers[e.pointerId] = {
        type: 'stick',
        component: comp,
        element: compEl,
        centerX,
        centerY,
        maxRadius
      };
      
      handleStickMove(e.pointerId, e.clientX, e.clientY);
      
    } else if (comp.type === 'dpad') {
      const stickRect = compEl.getBoundingClientRect();
      const centerX = stickRect.left + stickRect.width / 2;
      const centerY = stickRect.top + stickRect.height / 2;
      
      activePointers[e.pointerId] = {
        type: 'dpad',
        component: comp,
        element: compEl,
        centerX,
        centerY,
        lastDirection: null
      };
      
      handleDpadPress(e.pointerId, e.clientX, e.clientY);
    }
  }
});

designerCanvas.addEventListener('pointermove', e => {
  if (isEditMode) {
    if (!activeAction || !actionTargetId) return;
    
    const comp = components.find(c => c.id === actionTargetId);
    const compEl = document.getElementById(actionTargetId);
    if (!comp || !compEl) return;
    
    const canvasRect = designerCanvas.getBoundingClientRect();
    const deltaX = e.clientX - initialPointerX;
    const deltaY = e.clientY - initialPointerY;
    
    const deltaXPercent = (deltaX / canvasRect.width) * 100;
    const deltaYPercent = (deltaY / canvasRect.height) * 100;
    
    if (activeAction === 'dragging') {
      let newX = initialCompX + deltaXPercent;
      let newY = initialCompY + deltaYPercent;
      
      // Keep within bounds
      newX = Math.max(0, Math.min(100 - comp.size, newX));
      newY = Math.max(0, Math.min(100 - comp.size * (canvasRect.width / canvasRect.height), newY));
      
      comp.x = Math.round(newX);
      comp.y = Math.round(newY);
      
      compEl.style.left = `${comp.x}%`;
      compEl.style.top = `${comp.y}%`;
    } else if (activeAction === 'resizing') {
      let newSize = initialCompSize + deltaXPercent;
      newSize = Math.max(5, Math.min(30, newSize));
      
      comp.size = Math.round(newSize);
      compEl.style.width = `${comp.size}%`;
      
      propSize.value = comp.size;
      propSizeVal.textContent = `${comp.size}%`;
    }
  } else {
    // --- PLAY MODE: INTERACTIVE MOVEMENT UPDATE CONCURRENTLY ---
    const tracking = activePointers[e.pointerId];
    if (!tracking) return;
    
    if (tracking.type === 'button') {
      // Requirement 4: Instant release when finger slides outside element boundaries
      const rect = tracking.element.getBoundingClientRect();
      const margin = 10; // Allow 10px margin
      const isInside = (
        e.clientX >= rect.left - margin &&
        e.clientX <= rect.right + margin &&
        e.clientY >= rect.top - margin &&
        e.clientY <= rect.bottom + margin
      );
      if (!isInside) {
        handlePlayRelease(e.pointerId);
      }
    } else if (tracking.type === 'stick') {
      handleStickMove(e.pointerId, e.clientX, e.clientY);
    } else if (tracking.type === 'dpad') {
      handleDpadPress(e.pointerId, e.clientX, e.clientY);
    }
  }
});

designerCanvas.addEventListener('pointerup', e => {
  if (isEditMode) {
    if (activeAction && actionTargetId) {
      const compEl = document.getElementById(actionTargetId);
      if (compEl) {
        compEl.releasePointerCapture(e.pointerId);
      }
      activeAction = null;
      actionTargetId = null;
      saveLayout();
      renderCanvas();
    }
  } else {
    // --- PLAY MODE: ISOLATED CONCURRENT RELEASES ---
    handlePlayRelease(e.pointerId);
  }
});

designerCanvas.addEventListener('pointercancel', e => {
  if (isEditMode) {
    if (activeAction && actionTargetId) {
      activeAction = null;
      actionTargetId = null;
      renderCanvas();
    }
  } else {
    handlePlayRelease(e.pointerId);
  }
});

// Play Mode touch point release cleaner
function handlePlayRelease(pointerId) {
  const tracking = activePointers[pointerId];
  if (!tracking) return;
  
  const comp = tracking.component;
  const compEl = tracking.element;
  
  // Requirement 3: Reset visual pressed scale/opacity feedback
  compEl.classList.remove('comp-node-pressed');
  
  if (tracking.type === 'button') {
    const inner = compEl.querySelector('.rounded-full');
    if (inner) {
      inner.className = `w-full h-full rounded-full border-2 ${componentColors[comp.color].border} ${componentColors[comp.color].bg} ${componentColors[comp.color].text} flex items-center justify-center font-bold text-xs shadow-md pointer-events-none active:scale-95 transition-transform`;
    }
    sendVirtualControllerInput(comp.mapping, 'released', 0.0);
    
  } else if (tracking.type === 'stick') {
    // Reset joystick visual knob position to center
    const knob = compEl.querySelector('.thumb-knob');
    if (knob) {
      knob.style.transform = 'translate(0px, 0px)';
    }
    sendVirtualControllerInput(comp.mapping, 'axis', { x: 0.0, y: 0.0 });
    
  } else if (tracking.type === 'dpad') {
    // Reset caret highlights
    if (tracking.lastDirection) {
      sendVirtualControllerInput(tracking.lastDirection, 'released', 0.0);
    }
  }
  
  // Safely release input pointer capture references
  try {
    compEl.releasePointerCapture(pointerId);
  } catch (err) {}
  
  delete activePointers[pointerId];
}

// Stick vector drag processor
function handleStickMove(pointerId, clientX, clientY) {
  const tracking = activePointers[pointerId];
  if (!tracking) return;
  
  const comp = tracking.component;
  const compEl = tracking.element;
  
  const dx = clientX - tracking.centerX;
  const dy = clientY - tracking.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Clamp joystick movement radius bounds (max displacement 70% stick diameter)
  const maxDisplacement = tracking.maxRadius * 0.7;
  let moveX = dx;
  let moveY = dy;
  
  if (distance > maxDisplacement) {
    moveX = (dx / distance) * maxDisplacement;
    moveY = (dy / distance) * maxDisplacement;
  }
  
  // Style displacement transforms on joystick thumb knob
  const knob = compEl.querySelector('.thumb-knob');
  if (knob) {
    knob.style.transform = `translate(${moveX}px, ${moveY}px)`;
  }
  
  // Calculate relative gamepad axis inputs (-1.0 to 1.0)
  const axisX = parseFloat((moveX / maxDisplacement).toFixed(3));
  const axisY = parseFloat((-(moveY / maxDisplacement)).toFixed(3)); // Invert standard axis coordinate Y
  
  sendVirtualControllerInput(comp.mapping, 'axis', { x: axisX, y: axisY });
}

// D-pad quadrant dragging selector
function handleDpadPress(pointerId, clientX, clientY) {
  const tracking = activePointers[pointerId];
  if (!tracking) return;
  
  const comp = tracking.component;
  const compEl = tracking.element;
  
  const dx = clientX - tracking.centerX;
  const dy = clientY - tracking.centerY;
  
  let targetDirection = null;
  const deadZone = 12; // Deadzone threshold near absolute center
  
  if (Math.sqrt(dx * dx + dy * dy) > deadZone) {
    if (Math.abs(dx) > Math.abs(dy)) {
      targetDirection = dx > 0 ? 'Dpad_Right' : 'Dpad_Left';
    } else {
      targetDirection = dy > 0 ? 'Dpad_Down' : 'Dpad_Up';
    }
  }
  
  if (targetDirection !== tracking.lastDirection) {
    // Release previous direction
    if (tracking.lastDirection) {
      sendVirtualControllerInput(tracking.lastDirection, 'released', 0.0);
      
      // Remove visual highlights
      const clsMap = { 'Dpad_Up': '.dpad-dir-up', 'Dpad_Down': '.dpad-dir-down', 'Dpad_Left': '.dpad-dir-left', 'Dpad_Right': '.dpad-dir-right' };
      const lastSelector = clsMap[tracking.lastDirection];
      const caret = compEl.querySelector(lastSelector);
      if (caret) caret.classList.remove('brightness-200', 'scale-110');
    }
    
    // Press new direction
    if (targetDirection) {
      sendVirtualControllerInput(targetDirection, 'pressed', 1.0);
      
      // Add visual highlights
      const clsMap = { 'Dpad_Up': '.dpad-dir-up', 'Dpad_Down': '.dpad-dir-down', 'Dpad_Left': '.dpad-dir-left', 'Dpad_Right': '.dpad-dir-right' };
      const nextSelector = clsMap[targetDirection];
      const caret = compEl.querySelector(nextSelector);
      if (caret) caret.classList.add('brightness-200', 'scale-110');
    }
    
    tracking.lastDirection = targetDirection;
  }
}

function sendVirtualControllerInput(action, type, value) {
  const displayVal = (typeof value === 'object') ? `[X:${value.x}, Y:${value.y}]` : value;
  console.log(`Input Broadcast: ${action} | type: ${type} | value:`, value);
  
  addInputLog(`Signal: ${action} -> ${type} (${displayVal})`);
  
  // Requirement 4: Pack optimized payload for WebRTC Data Channel
  let payload = null;
  if (type === 'pressed') {
    payload = { t: 'kd', k: action };
  } else if (type === 'released') {
    payload = { t: 'ku', k: action };
  } else if (type === 'axis') {
    const joyId = action.toLowerCase(); // 'left_stick' or 'right_stick'
    payload = {
      t: 'joy',
      id: joyId,
      x: value.x,
      y: value.y
    };
  }

  // If Data Channel is active, send the low-latency payload
  if (inputDataChannel && inputDataChannel.readyState === 'open') {
    try {
      inputDataChannel.send(JSON.stringify(payload));
      return; // Skip fallback WebSocket signaling
    } catch (err) {
      console.warn("Failed to send over WebRTC Data Channel, falling back to socket:", err);
    }
  }
  
  if (socket && socket.connected) {
    socket.emit('client-controller-input', {
      roomId,
      action,
      type,
      value
    });
  }
}


// --- PROPERTIES CONFIGURATOR HANDLERS ---

function updatePropertiesPanel() {
  if (!selectedComponentId) {
    propertyFormContainer.classList.add('hidden');
    propertyFormEmpty.classList.remove('hidden');
    return;
  }
  
  const comp = components.find(c => c.id === selectedComponentId);
  if (!comp) return;
  
  propertyFormContainer.classList.remove('hidden');
  propertyFormEmpty.classList.add('hidden');
  
  propId.value = comp.id;
  propLabel.value = comp.label;
  propMapping.value = comp.mapping;
  
  propSize.value = comp.size;
  propSizeVal.textContent = `${comp.size}%`;
  
  propOpacity.value = comp.opacity;
  propOpacityVal.textContent = `${comp.opacity}%`;
  
  const propLabelGroup = document.getElementById('propLabelGroup');
  if (comp.type === 'button') {
    propLabelGroup.classList.remove('hidden');
  } else {
    propLabelGroup.classList.add('hidden');
  }
  
  // Dot selection highlights
  document.querySelectorAll('.color-dot').forEach(dot => {
    if (dot.dataset.color === comp.color) {
      dot.className = 'color-dot w-5 h-5 rounded-full ring-2 ring-game-accent ring-offset-2 ring-offset-black';
      dot.style.borderColor = 'white';
    } else {
      const clsMap = { accent: 'bg-[#7c4dff]', green: 'bg-[#00e676]', red: 'bg-[#ff1744]', blue: 'bg-[#29b6f6]', yellow: 'bg-[#ffee58]' };
      dot.className = `color-dot w-5 h-5 rounded-full ${clsMap[dot.dataset.color]} border border-transparent`;
      dot.style.borderColor = 'transparent';
    }
  });
}

propLabel.addEventListener('input', () => {
  if (!selectedComponentId) return;
  const comp = components.find(c => c.id === selectedComponentId);
  if (comp) {
    comp.label = propLabel.value;
    saveLayout();
    renderCanvas();
  }
});

propMapping.addEventListener('change', () => {
  if (!selectedComponentId) return;
  const comp = components.find(c => c.id === selectedComponentId);
  if (comp) {
    comp.mapping = propMapping.value;
    saveLayout();
    renderCanvas();
  }
});

propSize.addEventListener('input', () => {
  if (!selectedComponentId) return;
  const comp = components.find(c => c.id === selectedComponentId);
  if (comp) {
    comp.size = parseInt(propSize.value);
    propSizeVal.textContent = `${comp.size}%`;
    
    const compEl = document.getElementById(comp.id);
    if (compEl) {
      compEl.style.width = `${comp.size}%`;
    }
  }
});

propSize.addEventListener('change', () => {
  saveLayout();
  renderCanvas();
});

propOpacity.addEventListener('input', () => {
  if (!selectedComponentId) return;
  const comp = components.find(c => c.id === selectedComponentId);
  if (comp) {
    comp.opacity = parseInt(propOpacity.value);
    propOpacityVal.textContent = `${comp.opacity}%`;
    
    const compEl = document.getElementById(comp.id);
    if (compEl) {
      compEl.style.opacity = comp.opacity / 100;
    }
  }
});

propOpacity.addEventListener('change', () => {
  saveLayout();
  renderCanvas();
});

document.querySelectorAll('.color-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    if (!selectedComponentId) return;
    const comp = components.find(c => c.id === selectedComponentId);
    if (comp) {
      comp.color = dot.dataset.color;
      saveLayout();
      renderCanvas();
      updatePropertiesPanel();
    }
  });
});

btnDeleteComponent.addEventListener('click', () => {
  if (!selectedComponentId) return;
  components = components.filter(c => c.id !== selectedComponentId);
  selectedComponentId = null;
  saveLayout();
  renderCanvas();
  updatePropertiesPanel();
  showNotification('Element deleted.');
});


// --- SIGNALING LOGS CONSOLE DISPLAY ---

function addInputLog(msg) {
  const logEl = document.createElement('div');
  logEl.className = 'truncate border-l border-game-accent/50 pl-1 py-0.5';
  
  const time = new Date().toLocaleTimeString().split(' ')[0];
  logEl.innerHTML = `<span class="text-neutral-600 mr-1">${time}</span> ${msg}`;
  
  const placeholder = inputLogsContainer.querySelector('.italic');
  if (placeholder) {
    placeholder.remove();
  }
  
  inputLogsContainer.appendChild(logEl);
  inputLogsContainer.scrollTop = inputLogsContainer.scrollHeight;
  
  while (inputLogsContainer.children.length > 20) {
    inputLogsContainer.children[0].remove();
  }
}

btnClearLogs.addEventListener('click', () => {
  inputLogsContainer.innerHTML = `<div class="text-neutral-500 italic">Logs cleared. Play Mode active to capture controller signals...</div>`;
});


// --- LAYOUT SERIALIZATION AND CONFIGURATION SHARING ENGINE ---

/**
 * LZString base64 compressor helper wrapper with safe fallback
 */
const compressor = {
  compress(str) {
    if (typeof LZString !== 'undefined') {
      return LZString.compressToEncodedURIComponent(str);
    }
    console.warn("LZString is not available. Falling back to plain base64.");
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decompress(str) {
    if (typeof LZString !== 'undefined') {
      const dec = LZString.decompressFromEncodedURIComponent(str);
      if (dec) return dec;
    }
    try {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      return atob(base64);
    } catch (e) {
      return null;
    }
  }
};

/**
 * Strips unnecessary whitespace, stringifies the JSON layout state,
 * compresses it, and encodes it into a single URL-safe Base64 text string.
 */
function exportLayoutToString() {
  const layoutState = {
    layoutName: "Custom Xbox Layout",
    components: components.map(c => ({
      id: c.id,
      type: c.type === 'stick' ? 'joystick' : c.type,
      x: c.x,
      y: c.y,
      size: c.size,
      mapsTo: c.mapping,
      label: c.label,
      opacity: c.opacity,
      color: c.color
    }))
  };
  return compressor.compress(JSON.stringify(layoutState));
}

/**
 * Helper to generate default display labels based on component type and mapping target
 */
function getDefaultLabel(type, mapsTo) {
  if (type === 'joystick' || type === 'stick') {
    return (mapsTo && mapsTo.toLowerCase().includes('left')) ? 'L' : 'R';
  }
  if (type === 'dpad') {
    return 'D-PAD';
  }
  if (mapsTo && mapsTo.startsWith('Button_')) {
    return mapsTo.substring('Button_'.length);
  }
  return mapsTo || '';
}

/**
 * Validates the structural JSON schema of an imported layout state
 */
function validateLayoutSchema(state) {
  if (!state || typeof state !== 'object') return false;
  if (!Array.isArray(state.components)) return false;
  
  for (const comp of state.components) {
    if (!comp || typeof comp !== 'object') return false;
    if (typeof comp.id !== 'string') return false;
    if (typeof comp.type !== 'string' || !['button', 'joystick', 'stick', 'dpad'].includes(comp.type)) return false;
    if (typeof comp.x !== 'number' || isNaN(comp.x)) return false;
    if (typeof comp.y !== 'number' || isNaN(comp.y)) return false;
    if (typeof comp.size !== 'number' || isNaN(comp.size)) return false;
    if (typeof comp.mapsTo !== 'string' && typeof comp.mapping !== 'string') return false;
  }
  return true;
}

/**
 * Decodes base64 string, validates the structural array schema,
 * and cleanly updates the UI canvas layout on-screen instantly.
 */
function importLayoutFromString(shareString) {
  if (!shareString) {
    throw new Error("Share string is empty.");
  }
  
  const decompressed = compressor.decompress(shareString);
  if (!decompressed) {
    throw new Error("Failed to decompress or decode share string.");
  }
  
  let state;
  try {
    state = JSON.parse(decompressed);
  } catch (e) {
    throw new Error("Share string is not a valid JSON structure.");
  }
  
  if (!validateLayoutSchema(state)) {
    throw new Error("Layout schema validation failed. Check structure.");
  }
  
  // Map schema attributes back to internal app states
  const newComponents = state.components.map(comp => {
    const type = comp.type === 'joystick' ? 'stick' : comp.type;
    const mapping = comp.mapsTo || comp.mapping;
    return {
      id: comp.id,
      type: type,
      mapping: mapping,
      label: comp.label || getDefaultLabel(type, mapping),
      x: comp.x,
      y: comp.y,
      size: comp.size,
      opacity: comp.opacity !== undefined ? comp.opacity : 75,
      color: comp.color || 'accent'
    };
  });
  
  // Set app state, save to local storage, and re-render
  components = newComponents;
  saveLayout();
  
  selectedComponentId = null;
  renderCanvas();
  updatePropertiesPanel();
  
  return true;
}

// --- SHARING EVENT LISTENERS AND CLI LOG INTEGRATION ---

btnCopyShare.addEventListener('click', async () => {
  try {
    const shareStr = exportLayoutToString();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareStr);
      showNotification("Layout share string copied to clipboard!");
    } else {
      // Robust fallback execution for non-secure contexts
      const tempTextArea = document.createElement('textarea');
      tempTextArea.value = shareStr;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      document.execCommand('copy');
      document.body.removeChild(tempTextArea);
      showNotification("Layout share string copied (fallback)!");
    }
    addInputLog("Share: Layout exported successfully");
  } catch (err) {
    console.error("Failed to export/copy layout:", err);
    showNotification("Failed to copy share string.");
  }
});

btnImportShare.addEventListener('click', () => {
  importShareInput.value = '';
  importError.classList.add('hidden');
  importShareModal.classList.remove('hidden');
  importShareInput.focus();
});

btnCancelImport.addEventListener('click', () => {
  importShareModal.classList.add('hidden');
});

btnConfirmImport.addEventListener('click', () => {
  const shareStr = importShareInput.value.trim();
  try {
    if (importLayoutFromString(shareStr)) {
      importShareModal.classList.add('hidden');
      showNotification("Layout imported successfully!");
      addInputLog("Share: Layout imported successfully");
    }
  } catch (err) {
    console.error("Layout import failed:", err);
    importError.textContent = err.message || "Invalid share string.";
    importError.classList.remove('hidden');
  }
});

// --- MOBILE BROWSER COMPATIBILITY LOCKS AND TOUCH RESETS ---

// Block multi-finger scaling, swipe gestures, context menu, and pull-to-refresh
document.addEventListener('touchstart', (e) => {
  if (!isEditMode) {
    if (e.touches.length > 1) {
      e.preventDefault(); // Block multi-finger pinch-to-zoom in play mode
    }
  }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (!isEditMode) {
    e.preventDefault(); // Block pull-to-refresh and scrolling in play mode
  }
}, { passive: false });

document.addEventListener('gesturestart', (e) => {
  if (!isEditMode) {
    e.preventDefault(); // Block zoom gestures on Safari iOS
  }
});

// Disable desktop right click and long-press selection overlays
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Diagnostic HUD interactive toggle
const diagnosticHud = document.getElementById('diagnosticHud');
if (diagnosticHud) {
  diagnosticHud.addEventListener('click', () => {
    document.querySelectorAll('.hud-details').forEach(el => {
      el.classList.toggle('hidden');
    });
  });
}

// --- SYSTEM INITIALIZATION ---
loadLayout();
showScreenSection('home'); // Show home screen first
checkOrientation(); // Determine mobile device orientation
console.log('Mobile Controller Layout Designer Engine successfully bootstrap loaded.');
