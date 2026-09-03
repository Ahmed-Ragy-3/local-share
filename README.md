# Local Share

A lightweight local network file and message sharing application designed for simplicity and speed. Transfer files and send text messages directly between your laptop and phone without the cloud or internet.

## Features
- **Real-time Messaging**: Instantly send and receive text messages between devices.
- **Fast File Transfer**: Directly transfer files via HTTP streaming (no base64 encoding).
- **Progress Indicator**: View upload progress for larger files.
- **No Internet Required**: Works entirely on your Local Area Network (LAN).
- **Zero Configuration**: No accounts, databases, or complex setup needed.

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed.
2. Clone or download this project.
3. Open a terminal in the project directory and run:
   ```bash
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```
2. The terminal will output two URLs:
   - **Local URL** (e.g., `http://localhost:3000`): Use this on the computer running the server.
   - **LAN URL** (e.g., `http://192.168.1.5:3000`): Use this on your phone or other devices connected to the same Wi-Fi network.
3. Open the LAN URL in your phone's web browser.
4. Start chatting and sharing files!

## Troubleshooting

- **Cannot access from phone**: Ensure both devices are connected to the exact same Wi-Fi network. Check if your laptop's firewall is blocking incoming connections on port `3000`. You may need to allow Node.js through the firewall.
- **Port already in use**: If port 3000 is occupied, you can change it via environment variables:
  - Windows: `set PORT=8080 && npm start`
  - Linux/Mac: `PORT=8080 npm start`

## Technologies Used
- Backend: Node.js, Express, Socket.io, Multer
- Frontend: HTML5, Vanilla JavaScript, CSS3
