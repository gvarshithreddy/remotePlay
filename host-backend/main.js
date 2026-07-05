const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { exec, execSync, fork } = require('child_process');

let mainWindow = null;
let hostProcess = null;
let isDownloadingDriver = false;

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

  // Open external links in default OS browser
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
    console.log("[Electron Main] Terminating host subprocess...");
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

// IPC Handler: Check ViGEmBus Installation
ipcMain.handle('check-drivers', () => {
  // Check typical driver file location
  const driverExists = fs.existsSync('C:\\Windows\\System32\\drivers\\ViGEmBus.sys');
  if (driverExists) return true;

  // Query registry
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

    // Execute MSI setup quietly
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

// Helper: Download file with progress report callback
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
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
                // Filter helper/runtime packages
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

  // Deduplicate apps list
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

  const hostJsPath = path.join(__dirname, 'host.js');
  console.log(`[Electron Main] Forking host process: ${hostJsPath}`);

  try {
    hostProcess = fork(hostJsPath, [], {
      env: {
        ...process.env,
        SIGNALING_URL: config.signalingUrl,
        ROOM_ID: config.roomId,
        STREAM_PASSWORD: config.password
      },
      silent: true // capture stdout/stderr streams
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
