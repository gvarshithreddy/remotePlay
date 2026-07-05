const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { exec, execSync, fork } = require('child_process');

// 1. EMBEDDED EXPRESS & SOCKET.IO SIGNALING SERVER
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const serverApp = express();
const server = http.createServer(serverApp);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve client-side static pages from the public folder
serverApp.use(express.static(path.join(__dirname, 'public')));

// Room management structure
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[Embedded Server] Client socket connected: ${socket.id}`);
  
  socket.on('register-host', ({ roomId, passwordHash }, callback) => {
    rooms.set(roomId, {
      hostSocketId: socket.id,
      passwordHash: passwordHash,
      clientSocketId: null
    });
    socket.join(roomId);
    console.log(`[Embedded Server] Host registered room ID: ${roomId}`);
    if (typeof callback === 'function') callback({ success: true });
  });
  
  socket.on('register-client', ({ roomId, passwordHash }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      if (typeof callback === 'function') callback({ success: false, error: 'Room does not exist.' });
      return;
    }
    if (room.passwordHash !== passwordHash) {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid room password.' });
      return;
    }
    
    room.clientSocketId = socket.id;
    socket.join(roomId);
    console.log(`[Embedded Server] Mobile client authenticated and joined room: ${roomId}`);
    
    // Notify room host
    io.to(room.hostSocketId).emit('client-ready', { clientSocketId: socket.id });
    if (typeof callback === 'function') callback({ success: true });
  });
  
  socket.on('sdp-offer', ({ offer }) => {
    const roomId = getSocketRoom(socket);
    if (roomId) socket.to(roomId).emit('sdp-offer', { offer });
  });
  
  socket.on('sdp-answer', ({ answer }) => {
    const roomId = getSocketRoom(socket);
    if (roomId) socket.to(roomId).emit('sdp-answer', { answer });
  });
  
  socket.on('ice-candidate', ({ candidate }) => {
    const roomId = getSocketRoom(socket);
    if (roomId) socket.to(roomId).emit('ice-candidate', { candidate });
  });
  
  socket.on('client-controller-input', (data) => {
    const roomId = getSocketRoom(socket);
    if (roomId) socket.to(roomId).emit('client-controller-input', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`[Embedded Server] Socket disconnected: ${socket.id}`);
    
    // Cleanup room state on disconnects
    for (const [roomId, room] of rooms.entries()) {
      if (room.hostSocketId === socket.id) {
        io.to(roomId).emit('host-disconnected', { message: 'Stream ended: Host left.', clearInputs: true });
        rooms.delete(roomId);
        console.log(`[Embedded Server] Host left. Room ${roomId} terminated.`);
        break;
      }
      if (room.clientSocketId === socket.id) {
        io.to(room.hostSocketId).emit('client-disconnected');
        room.clientSocketId = null;
        console.log(`[Embedded Server] Player client disconnected from Room ${roomId}.`);
        break;
      }
    }
  });
});

function getSocketRoom(socket) {
  const roomsJoined = Array.from(socket.rooms);
  return roomsJoined.find(r => r !== socket.id);
}

// Start HTTP/Socket Server locally
const SERVER_PORT = 3000;
server.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log(`[Embedded Server] Local network signaling server online on port ${SERVER_PORT}`);
});

// 2. ELECTRON LIFE-CYCLE CONTROLLER
let mainWindow = null;
let hostProcess = null;
let isDownloadingDriver = false;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Prioritize standard IPv4 non-internal interface cards
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 720,
    title: "Remote Play Host Dashboard",
    frame: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('renderer.html');

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupSubprocess();
  });
}

function cleanupSubprocess() {
  if (hostProcess) {
    console.log("[Electron Main] Terminating host process...");
    hostProcess.kill();
    hostProcess = null;
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  cleanupSubprocess();
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler: Fetch LAN IP
ipcMain.handle('get-local-ip', () => {
  return getLocalIpAddress();
});

// IPC Handler: Check ViGEmBus Installation
ipcMain.handle('check-drivers', () => {
  const driverExists = fs.existsSync('C:\\Windows\\System32\\drivers\\ViGEmBus.sys');
  if (driverExists) return true;

  try {
    execSync('reg query HKEY_LOCAL_MACHINE\\System\\CurrentControlSet\\Services\\ViGEmBus', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
});

// IPC Handler: Install ViGEmBus
ipcMain.handle('install-drivers', async () => {
  if (isDownloadingDriver) return { success: false, error: "Download already in progress." };
  isDownloadingDriver = true;

  const downloadUrl = 'https://github.com/nefarius/ViGEmBus/releases/download/v1.17.333/ViGEmBusSetup_x64.msi';
  const tempMsiPath = path.join(app.getPath('temp'), 'ViGEmBusSetup_x64.msi');

  try {
    mainWindow.webContents.send('driver-status', { state: 'downloading', progress: 0 });

    await downloadFile(downloadUrl, tempMsiPath, (progress) => {
      mainWindow.webContents.send('driver-status', { state: 'downloading', progress });
    });

    mainWindow.webContents.send('driver-status', { state: 'installing' });

    const installCommand = `msiexec /i "${tempMsiPath}" /passive /qn /norestart`;
    exec(installCommand, (err) => {
      isDownloadingDriver = false;
      if (err) {
        console.error("Installation failed:", err);
        mainWindow.webContents.send('driver-status', { state: 'failed', error: err.message });
      } else {
        console.log("ViGEmBus drivers successfully installed.");
        mainWindow.webContents.send('driver-status', { state: 'completed' });
      }
    });

    return { success: true };
  } catch (err) {
    isDownloadingDriver = false;
    console.error("Download failed:", err);
    mainWindow.webContents.send('driver-status', { state: 'failed', error: err.message });
    return { success: false, error: err.message };
  }
});

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download (HTTP status code: ${response.statusCode})`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);
        
        if (totalSize) {
          const progress = Math.round((downloadedSize / totalSize) * 100);
          onProgress(progress);
        }
      });

      response.on('end', () => {
        file.end();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// IPC Handler: Steam Library Scanner
ipcMain.handle('scan-library', () => {
  let steamPaths = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam'
  ];

  try {
    const regQuery = execSync('reg query HKCU\\Software\\Valve\\Steam /v SteamPath', { encoding: 'utf8' });
    const match = regQuery.match(/SteamPath\s+REG_SZ\s+(.+)/);
    if (match && match[1]) {
      const foundPath = match[1].trim().replace(/\//g, '\\');
      if (!steamPaths.includes(foundPath)) {
        steamPaths.push(foundPath);
      }
    }
  } catch (e) {}

  const games = [];

  steamPaths.forEach(steamPath => {
    const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdfPath)) return;

    try {
      const vdfContent = fs.readFileSync(vdfPath, 'utf8');
      const pathMatches = [...vdfContent.matchAll(/"path"\s+"([^"]+)"/g)].map(m => m[1]);
      const libraryPaths = [steamPath, ...pathMatches];

      libraryPaths.forEach(libPath => {
        const appsDir = path.join(libPath, 'steamapps');
        if (!fs.existsSync(appsDir)) return;

        const files = fs.readdirSync(appsDir);
        files.forEach(file => {
          if (file.startsWith('appmanifest_') && file.endsWith('.acf')) {
            try {
              const acfContent = fs.readFileSync(path.join(appsDir, file), 'utf8');
              const appidMatch = acfContent.match(/"appid"\s+"(\d+)"/);
              const nameMatch = acfContent.match(/"name"\s+"([^"]+)"/);

              if (appidMatch && nameMatch) {
                const appid = appidMatch[1];
                if (appid !== '250820' && appid !== '228980') {
                  games.push({
                    appid,
                    name: nameMatch[1],
                    coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`
                  });
                }
              }
            } catch (err) {}
          }
        });
      });
    } catch (err) {}
  });

  const uniqueGames = [];
  const seen = new Set();
  games.forEach(g => {
    if (!seen.has(g.appid)) {
      seen.add(g.appid);
      uniqueGames.push(g);
    }
  });

  return uniqueGames;
});

// IPC Handler: Launch Steam Game
ipcMain.handle('launch-game', (event, appid) => {
  const launchCmd = `start steam://rungameid/${appid}`;
  exec(launchCmd, (err) => {
    if (err) console.error(`Failed to launch appid ${appid}:`, err);
  });
  return true;
});

// IPC Handler: Start session child process wrapper
ipcMain.handle('start-session', (event, config) => {
  if (hostProcess) {
    hostProcess.kill();
    hostProcess = null;
  }

  // Resolve precompiled FFmpeg binary path from ffmpeg-static automatically
  let ffmpegStaticPath = null;
  try {
    ffmpegStaticPath = require('ffmpeg-static');
    console.log(`[Electron Main] Bundled FFmpeg static path resolved: ${ffmpegStaticPath}`);
  } catch (err) {
    console.warn("[Electron Main] Could not load bundled ffmpeg-static. Falling back to system environment path.");
  }

  const hostJsPath = path.join(__dirname, 'host.js');
  console.log(`[Electron Main] Forking host process: ${hostJsPath}`);

  try {
    hostProcess = fork(hostJsPath, [], {
      env: {
        ...process.env,
        SIGNALING_URL: `http://localhost:${SERVER_PORT}`, // Connect locally to the embedded server
        ROOM_ID: config.roomId,
        STREAM_PASSWORD: config.password,
        FFMPEG_PATH: ffmpegStaticPath || 'ffmpeg' // Pass bundled FFmpeg binary path
      },
      silent: true
    });

    hostProcess.stdout.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('session-log', data.toString());
      }
    });

    hostProcess.stderr.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('session-log', `[Error] ${data.toString()}`);
      }
    });

    hostProcess.on('message', (message) => {
      if (!mainWindow) return;
      if (message.type === 'status') {
        mainWindow.webContents.send('session-status', message);
      } else if (message.type === 'input') {
        mainWindow.webContents.send('gamepad-input', message.data);
      }
    });

    hostProcess.on('exit', (code) => {
      console.log(`[Electron Main] Host process exited with code ${code}`);
      if (mainWindow) {
        mainWindow.webContents.send('session-status', { type: 'status', event: 'host-exited', code });
      }
      hostProcess = null;
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to fork host process:", err);
    return { success: false, error: err.message };
  }
});

// IPC Handler: Kill session process
ipcMain.handle('kill-session', () => {
  cleanupSubprocess();
  return true;
});
