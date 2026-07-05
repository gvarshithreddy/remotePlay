const { createWindowsInstaller } = require('electron-winstaller');
const path = require('path');

async function build() {
  console.log("[Installer Builder] Compiling single-click Setup.exe installer...");
  
  const appDirectory = path.join(__dirname, 'dist', 'RemotePlayHost-win32-x64');
  const outputDirectory = path.join(__dirname, 'dist', 'installer');
  
  await createWindowsInstaller({
    appDirectory,
    outputDirectory,
    authors: 'Google DeepMind Pair Programmer',
    exe: 'RemotePlayHost.exe',
    setupExe: 'RemotePlayHost-Setup.exe',
    noMsi: true,
    description: 'Windows low-latency remote play host controller dashboard.'
  });
  
  console.log("[Success] Windows Installer compiled successfully! Saved to: dist/installer/RemotePlayHost-Setup.exe");
}

build().catch(err => {
  console.error("Failed to generate installer:", err);
  process.exit(1);
});
