# Ultra-Low-Latency Remote Play Streaming Ecosystem

This workspace represents a self-hosted, ultra-low-latency web-based remote game streaming system. It includes a signaling server, a frontend client, and a host backend application structure.

## Folder Structure

```text
remote-play/
├── signaling-server/
│   ├── package.json
│   ├── server.js (Signaling Server & Static File Server)
│   └── public/   (Frontend Client Public Directory)
│       ├── index.html
│       ├── js/
│       │   └── client.js
│       └── css/
│           └── style.css
├── host-backend/
│   ├── package.json
│   └── host.js (Host Agent for capturing & streaming video/input)
└── README.md
```

## Architecture & Security Highlights

1. **Ultra-Low Latency Configuration**: Socket.io connection properties are configured with low `pingInterval` (10s) and `pingTimeout` (5s) for instant disconnect detection.
2. **Timing-Safe Password Validation**: Protects against side-channel analysis and timing attacks using Node's cryptographic helper `crypto.timingSafeEqual` in a constant-time comparison helper.
3. **WebRTC Signaling Gate**: The signaling server acts as a firewall, intercepting all WebRTC signaling messages (`sdp-offer`, `sdp-answer`, `ice-candidate`). No packets are exchanged unless the client session matches the room ID and successfully answers the password-verification challenge.
4. **Stuck-Input Neutralization**: When a client or host disconnects, the system triggers `clearAllInputStates` and `releaseVirtualInputs` events, ensuring no keys, mouse controls, or controller triggers remain locked in an active state on either client or host OS side.
5. **Express Serve Router Integration**: Incorporates a clean GET `/join` router to support link sharing via standard formats (e.g. `https://domain.com/join?room=ROOM_ID`).

## Getting Started

### 1. Signaling Server Setup
Navigate to the `signaling-server` directory, install the required packages, and run the server:
```bash
cd signaling-server
npm install
npm start
```

### 2. Client Access
Open your browser to:
`http://localhost:3000/join?room=test-room-123`

### 3. Host Simulator
Navigate to the `host-backend` directory, install packages, and launch:
```bash
cd host-backend
npm install
node host.js
```
