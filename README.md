# Local Share

A lightweight local network file and message sharing application with secure public remote access via Ngrok and GitHub Pages. Transfer files, browse PC files, and send text messages directly between devices over LAN or remotely.

---

## 🌟 Features
- **Real-time Messaging**: Instantly send and receive text messages between connected devices.
- **Fast File Transfer**: Directly upload & stream files (supports files up to 1GB).
- **PC File Navigation**: Browse and download files directly from host PC folders.
- **LAN Access**: Bypasses authentication automatically for devices on the same local Wi-Fi.
- **Secure Remote Access (Ngrok & GitHub Pages)**: Access your local share page from anywhere using Ngrok, protected with Bcrypt password hashing & JWT tokens.

---

## 🚀 Installation & Setup

1. **Install Dependencies**:
   ```bash
   cmd /c npm install
   ```

2. **Generate Password Hash for Remote Access**:
   Run the hash generator script with your desired secret password:
   ```bash
   node generate-hash.js your_secret_password
   ```
   *This automatically creates/updates your `.env` file (which is ignored by Git in `.gitignore`).*

3. **Start the Local Share Server**:
   ```bash
   npm start
   ```

---

## 🌐 Setting Up Public Access via Ngrok & GitHub Pages

### Step 1: Start Ngrok Tunnel on your PC
Make sure [Ngrok](https://ngrok.com/) is installed, then run:
```bash
ngrok http 3000
```
Copy your public Ngrok URL (e.g., `https://xxxx-xx-xx.ngrok-free.app`).

### Step 2: Deploy Password Portal to GitHub Pages
1. Upload the `index.html` file inside the `github-pages/` directory to a new public repository on GitHub (e.g., `local-share-portal`).
2. Enable GitHub Pages in your repo settings (**Settings > Pages > Source: main branch**).
3. Open your GitHub Pages link on any phone or remote device outside your local network.

### Step 3: Connect!
1. Open your GitHub Pages portal.
2. Enter your **Ngrok URL** and your **Password**.
3. Upon successful password validation, you will be redirected straight to your Local Share app on your home PC!

---

## 🔒 Security
- **Bcrypt Hashing**: Password hash is stored securely in `.env` and excluded from source control (`.gitignore`).
- **JWT Authorization**: Session tokens are cryptographically signed.
- **LAN Bypass**: Local devices on Wi-Fi do not require entering password every time.

---

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, Socket.IO, Multer, BcryptJS, JSONWebToken, Dotenv
- **Frontend**: HTML5, Vanilla JavaScript, Vanilla CSS
