/**
 * Electron Renderer Dashboard Orchestrator
 */

// DOM Elements - Session
const btnToggleSession = document.getElementById('btnToggleSession');
const headerStatusText = document.getElementById('headerStatusText');
const sessionCredsBar = document.getElementById('sessionCredsBar');
const sessionRoomId = document.getElementById('sessionRoomId');
const sessionPassword = document.getElementById('sessionPassword');
const sessionLinkText = document.getElementById('sessionLinkText');

// DOM Elements - Steam & Logs
const gamesGrid = document.getElementById('gamesGrid');
const steamCount = document.getElementById('steamCount');
const logOutput = document.getElementById('logOutput');
const btnClearLogs = document.getElementById('btnClearLogs');

// DOM Elements - Players & Controllers
const usersList = document.getElementById('usersList');
const virtualControllerBadge = document.getElementById('virtualControllerBadge');
const virtualControllerRow = document.getElementById('virtualControllerRow');

// DOM Elements - Pre-flight modal
const preflightModal = document.getElementById('preflightModal');
const btnInstallDrivers = document.getElementById('btnInstallDrivers');
const btnSkipDrivers = document.getElementById('btnSkipDrivers');
const modalActionContainer = document.getElementById('modalActionContainer');
const modalProgressContainer = document.getElementById('modalProgressContainer');
const installStatusText = document.getElementById('installStatusText');
const installPercentText = document.getElementById('installPercentText');
const installProgressBar = document.getElementById('installProgressBar');

// State variables
let isSessionActive = false;
let currentRoomId = null;

// 1. Dependency Pre-flight Wizard Checking
async function initPreflightCheck() {
  logSystem('Initiating pre-flight driver validation...');
  try {
    const isInstalled = await window.electronAPI.checkDrivers();
    if (!isInstalled) {
      logSystem('[Warning] ViGEmBus driver not found. Displaying setup wizard.', 'warn');
      preflightModal.classList.remove('hidden');
    } else {
      logSystem('[Success] ViGEmBus device driver framework verified.');
      updateDriverBadge(true);
    }
  } catch (err) {
    console.error("Preflight check failed:", err);
    logSystem('[Error] Failed to execute driver checks: ' + err.message, 'error');
  }
}

// Update driver badges in device tree
function updateDriverBadge(installed) {
  const badge = document.getElementById('virtualControllerRow');
  if (badge) {
    if (installed) {
      virtualControllerRow.className = "flex items-center justify-between p-2 bg-[#050508] border border-cyan-500/10 rounded-lg text-gray-300";
      virtualControllerBadge.className = "text-[8px] bg-cyan-950/20 text-game-accent border border-cyan-500/20 px-2 py-0.5 rounded font-orbitron font-bold uppercase";
      virtualControllerBadge.textContent = "Standby";
    } else {
      virtualControllerRow.className = "flex items-center justify-between p-2 bg-[#050508] border border-white/5 rounded-lg text-gray-500";
      virtualControllerBadge.className = "text-[8px] bg-neutral-900 text-neutral-500 px-2 py-0.5 rounded font-orbitron font-bold uppercase";
      virtualControllerBadge.textContent = "Unplugged";
    }
  }
}

// 1-Click driver installer flow
btnInstallDrivers.addEventListener('click', async () => {
  modalActionContainer.classList.add('hidden');
  modalProgressContainer.classList.remove('hidden');
  
  logSystem('Downloading driver installer from repository...');
  await window.electronAPI.installDrivers();
});

btnSkipDrivers.addEventListener('click', () => {
  preflightModal.classList.add('hidden');
  logSystem('[Sandbox Mode] Bypassing driver checks. Gamepad simulation disabled.');
});

// Driver status IPC hooks
window.electronAPI.onDriverStatus((status) => {
  if (status.state === 'downloading') {
    installStatusText.textContent = "Downloading Driver Package...";
    installPercentText.textContent = `${status.progress}%`;
    installProgressBar.style.width = `${status.progress}%`;
  } else if (status.state === 'installing') {
    installStatusText.textContent = "Installing Driver Services...";
    installPercentText.textContent = "90%";
    installProgressBar.style.width = "90%";
    logSystem('Executing quiet MSI installation loop...');
  } else if (status.state === 'completed') {
    installStatusText.textContent = "Installation Completed!";
    installPercentText.textContent = "100%";
    installProgressBar.style.width = "100%";
    logSystem('[Success] ViGEmBus drivers successfully installed.');
    updateDriverBadge(true);
    
    // Hide modal after a brief success period
    setTimeout(() => {
      preflightModal.classList.add('hidden');
    }, 1500);
  } else if (status.state === 'failed') {
    logSystem('[Error] Installation failed: ' + status.error, 'error');
    installStatusText.textContent = "Setup Failed.";
    installStatusText.className = "text-red-500 font-bold";
    // Show actions back
    setTimeout(() => {
      modalProgressContainer.classList.add('hidden');
      modalActionContainer.classList.remove('hidden');
    }, 2000);
  }
});


// 2. Steam Library grid catalog populate
async function initSteamLibrary() {
  logSystem('Scanning Windows Registry paths for Steam libraries...');
  try {
    const games = await window.electronAPI.scanLibrary();
    steamCount.textContent = `${games.length} Games Detected`;
    
    if (games.length === 0) {
      gamesGrid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center p-8 text-center text-gray-500">
          <i class="fa-solid fa-folder-open text-2xl mb-2 text-neutral-800"></i>
          <p class="text-xs">No Steam games found in default directories.</p>
        </div>`;
      return;
    }
    
    gamesGrid.innerHTML = '';
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = "neon-border-cyan bg-[#0a0a14] rounded-xl overflow-hidden cursor-pointer flex flex-col group transition-all duration-300 transform hover:-translate-y-1";
      card.innerHTML = `
        <div class="aspect-[16/9] w-full bg-neutral-900 overflow-hidden relative border-b border-white/5">
          <img src="${game.coverUrl}" alt="${game.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.src='https://via.placeholder.com/460x215/090717/06b6d4?text=${encodeURIComponent(game.name)}'">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div class="w-9 h-9 rounded-full bg-game-accent flex items-center justify-center shadow-lg shadow-cyan-950/40">
              <i class="fa-solid fa-play text-white text-xs ml-0.5"></i>
            </div>
          </div>
        </div>
        <div class="p-3 flex-1 flex flex-col justify-between">
          <span class="font-orbitron font-extrabold text-[9px] uppercase tracking-wider truncate text-gray-300 group-hover:text-game-accent transition-colors">${game.name}</span>
          <span class="text-[8px] font-mono text-gray-500 mt-1">AppID: ${game.appid}</span>
        </div>
      `;
      
      card.addEventListener('click', () => {
        logSystem(`Launching Steam Game: ${game.name} [ID: ${game.appid}]`);
        window.electronAPI.launchGame(game.appid);
      });
      gamesGrid.appendChild(card);
    });
    
    logSystem(`[Success] Loaded ${games.length} Steam library entries.`);
  } catch (err) {
    console.error("Steam library scan failed:", err);
    logSystem('[Error] Failed scanning library manifests: ' + err.message, 'error');
  }
}


// 3. Room Session Lifecycle orchestration
btnToggleSession.addEventListener('click', () => {
  if (isSessionActive) {
    killSession();
  } else {
    launchSession();
  }
});

function launchSession() {
  btnToggleSession.disabled = true;
  // Generate random credentials
  const roomId = 'room-' + Math.floor(Math.random() * 9000 + 1000);
  const password = 'pass-' + Math.floor(Math.random() * 900000 + 100000);
  currentRoomId = roomId;

  logSystem(`Spawning background session socket helper on RoomID: ${roomId}...`);
  headerStatusText.className = "text-yellow-500 font-bold flex items-center gap-1";
  headerStatusText.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> Initializing...`;

  window.electronAPI.startSession({
    signalingUrl: 'http://localhost:3000',
    roomId,
    password
  }).then(response => {
    btnToggleSession.disabled = false;
    if (response.success) {
      isSessionActive = true;
      
      // Update toggle button
      btnToggleSession.className = "px-5 py-2.5 bg-gradient-to-r from-red-800 to-red-650 hover:from-red-600 hover:to-red-700 text-white font-orbitron font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-300 shadow-lg shadow-red-950/20 active:scale-95 flex items-center gap-2";
      btnToggleSession.innerHTML = `<i class="fa-solid fa-power-off"></i> Kill Host Session`;
      
      // Display credentials
      sessionRoomId.textContent = roomId;
      sessionPassword.textContent = password;
      
      Promise.all([
        window.electronAPI.getLocalIp().catch(() => 'localhost'),
        window.electronAPI.getServerPort().catch(() => 58330)
      ]).then(([localIp, port]) => {
        const joinUrl = `http://${localIp}:${port}/join?room=${roomId}&pass=${password}`;
        sessionLinkText.textContent = joinUrl;
      });
      
      sessionCredsBar.classList.remove('hidden');
    } else {
      logSystem(`[Error] Fork initialization failed: ${response.error}`, 'error');
      resetSessionUI();
    }
  });
}

function killSession() {
  logSystem('Terminating host backend subprocess...');
  window.electronAPI.killSession().then(() => {
    isSessionActive = false;
    resetSessionUI();
    logSystem('Streaming session cleanly shut down.');
  });
}

function resetSessionUI() {
  btnToggleSession.className = "px-5 py-2.5 bg-gradient-to-r from-game-accent to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-orbitron font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-300 shadow-lg shadow-cyan-950/20 active:scale-95 flex items-center gap-2";
  btnToggleSession.innerHTML = `<i class="fa-solid fa-play"></i> Launch Streaming Hub`;
  
  sessionCredsBar.classList.add('hidden');
  headerStatusText.className = "text-yellow-500 font-bold flex items-center gap-1";
  headerStatusText.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> Offline`;
  
  usersList.innerHTML = `
    <div class="text-center py-6 text-gray-600 text-[10px]">
      <i class="fa-solid fa-circle text-[6px] text-neutral-800 mb-2"></i>
      <p>Room offline. Click Launch to start.</p>
    </div>`;
  
  // Set standbys
  const virtualController = document.getElementById('virtualControllerBadge');
  if (virtualController && virtualController.textContent !== 'Unplugged') {
    virtualController.className = "text-[8px] bg-cyan-950/20 text-game-accent border border-cyan-500/20 px-2 py-0.5 rounded font-orbitron font-bold uppercase";
    virtualController.textContent = "Standby";
  }
}


// 4. Session status IPC callbacks
window.electronAPI.onSessionStatus((status) => {
  if (status.event === 'host-registered') {
    headerStatusText.className = "text-game-success font-bold flex items-center gap-1 neon-text-success";
    headerStatusText.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-game-success animate-ping"></span> Live Broadcast`;
    logSystem(`[Signaling] Registered host room: '${status.roomId}'`);
  } else if (status.event === 'client-connected') {
    logSystem(`[WebRTC] Client session verified successfully: ${status.clientSocketId}`);
    usersList.innerHTML = `
      <div class="flex items-center justify-between p-3 bg-[#0a0a14] border border-cyan-500/20 rounded-xl">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-game-success"></div>
          <span class="font-mono text-[9px] text-gray-300 font-bold">${status.clientSocketId.slice(0, 10)}...</span>
        </div>
        <span class="text-[8px] bg-cyan-950/20 text-game-accent border border-cyan-500/10 px-2 py-0.5 rounded uppercase tracking-wider font-orbitron">Player 2</span>
      </div>`;
    
    // Set gamepad to plug in visual
    virtualControllerBadge.className = "text-[8px] bg-game-success/20 text-game-success border border-game-success/20 px-2 py-0.5 rounded font-orbitron font-bold uppercase";
    virtualControllerBadge.textContent = "Active";
  } else if (status.event === 'client-disconnected') {
    logSystem(`[WebRTC] Client left. Unplugging virtual controller...`);
    usersList.innerHTML = `
      <div class="text-center py-6 text-gray-600 text-[10px]">
        <i class="fa-solid fa-circle-notch animate-spin text-base mb-2 text-neutral-800"></i>
        <p>Waiting for room host connection...</p>
      </div>`;
    
    // Set Standby
    virtualControllerBadge.className = "text-[8px] bg-cyan-950/20 text-game-accent border border-cyan-500/20 px-2 py-0.5 rounded font-orbitron font-bold uppercase";
    virtualControllerBadge.textContent = "Standby";
  } else if (status.event === 'host-exited') {
    logSystem('[System] Subprocess closed.');
    isSessionActive = false;
    resetSessionUI();
  } else if (status.event === 'host-failed') {
    logSystem('[Error] Subprocess runtime error: ' + status.error, 'error');
    isSessionActive = false;
    resetSessionUI();
  }
});


// 5. Pipe logs to terminal window
window.electronAPI.onSessionLog((data) => {
  const line = document.createElement('div');
  
  if (data.includes('[Success]')) {
    line.className = "text-game-success";
  } else if (data.includes('[Error]') || data.includes('failed') || data.includes('Error')) {
    line.className = "text-red-500";
  } else if (data.includes('[Signaling]') || data.includes('[WebRTC]')) {
    line.className = "text-game-accent";
  } else if (data.includes('[Gamepad Report]')) {
    // Suppress spammy visualizer logs to keep console clean, but can let them slide
    line.className = "text-purple-400 opacity-60";
  } else {
    line.className = "text-gray-400";
  }
  
  line.textContent = data.trim();
  logOutput.appendChild(line);
  
  // Auto Scroll
  logOutput.scrollTop = logOutput.scrollHeight;
});

// Logs control buttons
btnClearLogs.addEventListener('click', () => {
  logOutput.innerHTML = '<div class="text-cyan-500">[System] Terminal console cleared. Pipes running in background...</div>';
});

function logSystem(msg, type = 'info') {
  const line = document.createElement('div');
  if (type === 'error') {
    line.className = "text-red-500 font-bold";
  } else if (type === 'warn') {
    line.className = "text-yellow-500 font-semibold";
  } else {
    line.className = "text-cyan-500";
  }
  line.textContent = `[System] ${msg}`;
  logOutput.appendChild(line);
  logOutput.scrollTop = logOutput.scrollHeight;
}


// 6. Holographic Controller visualizer nodes mapping
window.electronAPI.onGamepadInput((data) => {
  // Suppress log spam, render visually
  const t = data.t || data.type;
  const k = data.k || data.action;
  const id = data.id || data.action;
  const x = data.hasOwnProperty('x') ? data.x : 0;
  const y = data.hasOwnProperty('y') ? data.y : 0;
  
  // 1. Face buttons, bumpers and menus mapping
  if (t === 'kd' || t === 'pressed' || t === 'ku' || t === 'released') {
    const isPressed = (t === 'kd' || t === 'pressed');
    
    // Check triggers
    if (k === 'LT') {
      const trigger = document.getElementById('part_LT');
      if (trigger) {
        if (isPressed) {
          trigger.classList.add('active-trigger');
        } else {
          trigger.classList.remove('active-trigger');
        }
      }
    } else if (k === 'RT') {
      const trigger = document.getElementById('part_RT');
      if (trigger) {
        if (isPressed) {
          trigger.classList.add('active-trigger');
        } else {
          trigger.classList.remove('active-trigger');
        }
      }
    } 
    // Bumpers, face buttons, menu maps
    else {
      const svgId = `part_${k}`;
      const elem = document.getElementById(svgId);
      if (elem) {
        if (isPressed) {
          elem.classList.add(k.startsWith('Dpad') ? 'active-dpad' : 'active-button');
        } else {
          elem.classList.remove(k.startsWith('Dpad') ? 'active-dpad' : 'active-button');
        }
      }
    }
  } 
  
  // 2. Analog Joysticks deflection mapping
  else if (t === 'joy' || t === 'axis') {
    let stickX = x;
    let stickY = y;
    
    if (t === 'axis' && data.value) {
      stickX = data.value.x || 0;
      stickY = data.value.y || 0;
    }
    
    const targetStick = id.toLowerCase();
    
    if (targetStick === 'left_stick') {
      const thumbCircle = document.getElementById('part_left_stick');
      if (thumbCircle) {
        const transX = Math.round(stickX * 12);
        const transY = Math.round(stickY * 12);
        
        // Translate visual thumbstick circle
        thumbCircle.setAttribute('transform', `translate(${transX}, ${transY})`);
        
        // Glow if deflected
        if (Math.abs(stickX) > 0.15 || Math.abs(stickY) > 0.15) {
          thumbCircle.classList.add('active-button');
        } else {
          thumbCircle.classList.remove('active-button');
        }
      }
    } else if (targetStick === 'right_stick') {
      const thumbCircle = document.getElementById('part_right_stick');
      if (thumbCircle) {
        const transX = Math.round(stickX * 12);
        const transY = Math.round(stickY * 12);
        
        // Translate visual thumbstick circle
        thumbCircle.setAttribute('transform', `translate(${transX}, ${transY})`);
        
        // Glow if deflected
        if (Math.abs(stickX) > 0.15 || Math.abs(stickY) > 0.15) {
          thumbCircle.classList.add('active-button');
        } else {
          thumbCircle.classList.remove('active-button');
        }
      }
    }
  }
});


// Bootstrapping initialization
initPreflightCheck();
initSteamLibrary();
