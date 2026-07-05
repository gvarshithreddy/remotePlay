# Remote Play Platform & Electron GUI Dashboard

A low-latency, competitive-grade remote play streaming system that lets you stream your PC screen and loopback audio to web clients, receiving virtual Xbox 360 controller inputs with zero-latency.

## 🚀 Live GitHub Repository & Releases
- **Source Code**: [gvarshithreddy/remotePlay](https://github.com/gvarshithreddy/remotePlay)
- **Pre-Compiled Build Release**: [v1.0.0 Releases](https://github.com/gvarshithreddy/remotePlay/releases/tag/v1.0.0)
- **Direct Download (Windows x64 Portable ZIP)**: [RemotePlayHost-Portable.zip](https://github.com/gvarshithreddy/remotePlay/releases/download/v1.0.0/RemotePlayHost-Portable.zip)

---

## 🛠️ Requirements & Installation

### 1. Windows Gamepad Emulation Driver (ViGEmBus)
To simulate genuine Xbox 360 controller hardware on the Windows host, the **ViGEmBus** kernel driver must be installed:
- **Automatic Setup (Recommended)**: Launch the Electron app dashboard. It will automatically detect if ViGEmBus is missing and present a **1-Click installation wizard** that downloads and quietly installs it.
- **Manual Setup**: If you prefer to install it yourself, download and run the setup MSI from the [ViGEmBus Releases page](https://github.com/nefarius/ViGEmBus/releases).

### 2. Desktop Capture Encoder (FFmpeg)
The host relies on **FFmpeg** to capture the desktop screen at 60 FPS and stream it to WebRTC:
1. Download a pre-compiled Windows build (e.g., from [gyan.dev FFmpeg Builds](https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z) or [BTR](https://www.ffmpeg.org/download.html)).
2. Extract the archive into a folder on your system (e.g., `C:\ffmpeg`).
3. Add the `bin` directory (`C:\ffmpeg\bin`) to your Windows **System Environment variables (PATH)**:
   - Search for **"Edit the system environment variables"** in the Windows Start menu.
   - Click **Environment Variables...**
   - Under *System variables*, select **Path** and click **Edit...**
   - Click **New** and paste the path to your FFmpeg bin folder (e.g., `C:\ffmpeg\bin`).
   - Click **OK** to save all screens.

---

## 💻 Running the Application

### Option A: Using the Compiled Desktop Application (Recommended)
1. Download the [RemotePlayHost-Portable.zip](https://github.com/gvarshithreddy/remotePlay/releases/download/v1.0.0/RemotePlayHost-Portable.zip) archive.
2. Extract the folder anywhere on your computer.
3. Double-click **`RemotePlayHost.exe`** to boot the high-tech neon dashboard.
4. Make sure your signaling server is running, and click **"Launch Streaming Hub"** on the top bar!

---

### Option B: Running / Building from Source Code

#### 1. Launch the Signaling Server
The WebRTC peer handshake coordinates via the local Socket.io signaling server:
```powershell
# Navigate to the signaling server directory
cd signaling-server

# Install package dependencies
npm install

# Build/transpile Tailwind utilities (optional)
npm run build

# Start the server on port 3000
npm start
```
*The signaling server dashboard will now be online at `http://localhost:3000`.*

#### 2. Run the Electron Host GUI from Source
```powershell
# Navigate to the host backend directory
cd host-backend

# Install package dependencies
npm install

# Launch the Electron application in hot-development mode
npm start
```
