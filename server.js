require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const os = require('os');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// Secret for signing authentication tokens
const JWT_SECRET = process.env.JWT_SECRET || 'local-share-default-secret-key-2026';

// Ngrok tunnel URL (e.g. https://xxxx.ngrok-free.app) — set in .env to NGROK_URL
const NGROK_URL = process.env.NGROK_URL ? process.env.NGROK_URL.replace(/\/+$/, '').toLowerCase() : null;

// Enable CORS for all routes (needed for GitHub Pages to talk to Ngrok)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'x-auth-token']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Helper: Check if request originates from a local IP / local loopback
function isLocalAddress(ipAddress, hostHeader) {
    if (!ipAddress) return false;

    // If a NGROK_URL is configured, treat any request whose host matches it as remote
    if (NGROK_URL && hostHeader) {
        const host = hostHeader.split(':')[0].toLowerCase(); // strip port if present
        const ngrokHost = NGROK_URL.replace(/^https?:\/\//, '');
        if (host === ngrokHost) return false;
    }

    // Fallback: treat any known reverse-proxy domain pattern as remote
    if (hostHeader && (hostHeader.includes('ngrok') || hostHeader.includes('loca.lt') || hostHeader.includes('trycloudflare.com'))) {
        return false;
    }

    const cleanIp = ipAddress.replace(/^.*:/, ''); // Handle IPv6 mapped IPv4

    if (cleanIp === '127.0.0.1' || cleanIp === 'localhost' || ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
        return true;
    }

    const localLanIp = ip.address();
    if (cleanIp === localLanIp) {
        return true;
    }

    // Standard private IPv4 ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^192\.168\./.test(cleanIp) || /^10\./.test(cleanIp) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)) {
        return true;
    }

    return false;
}

// Helper: Verify JWT auth token
function verifyAuthToken(token) {
    if (!token) return false;
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded && decoded.authenticated === true;
    } catch (err) {
        return false;
    }
}

// Helper: Extract token from request
function extractToken(req) {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (req.headers['x-auth-token']) {
        token = req.headers['x-auth-token'];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }
    return token;
}

// Authentication middleware for Express
app.use((req, res, next) => {
    // Allow public API endpoints and static assets
    const publicPaths = ['/api/verify-password', '/api/health', '/api/config', '/app.js', '/style.css'];
    if (publicPaths.includes(req.path) || req.path.startsWith('/socket.io/')) {
        return next();
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || '';

    // If local LAN/localhost, bypass authentication as requested
    if (isLocalAddress(clientIp, hostHeader)) {
        return next();
    }

    // Remote (Ngrok) connection requires valid auth token
    const token = extractToken(req);
    if (verifyAuthToken(token)) {
        return next();
    }

    // If unauthenticated remote request for HTML page load, serve login fallback page
    if (req.accepts('html') && req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/download')) {
        return res.sendFile(path.join(__dirname, 'public', 'login-fallback.html'));
    }

    return res.status(401).json({ error: 'Unauthorized: Remote access requires password authentication.' });
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Serve uploaded files statically for downloading
app.use('/download', express.static(UPLOAD_DIR));

// Setup Socket.IO with CORS
const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Socket.IO Auth Middleware
io.use((socket, next) => {
    const req = socket.request;
    const clientIp = req.headers['x-forwarded-for'] || socket.handshake.address;
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || '';

    if (isLocalAddress(clientIp, hostHeader)) {
        return next();
    }

    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (verifyAuthToken(token)) {
        return next();
    }

    return next(new Error('Authentication required for remote access.'));
});

// API Endpoint to verify password from GitHub Pages / Ngrok client
app.post('/api/verify-password', (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    const passwordHash = process.env.PASSWORD_HASH;

    if (!passwordHash) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server error: PASSWORD_HASH is not set in .env. Run node generate-hash.js <password>' 
        });
    }

    const isValid = bcrypt.compareSync(password, passwordHash);

    if (isValid) {
        // Issue token valid for 7 days
        const token = jwt.sign({ authenticated: true, timestamp: Date.now() }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ success: true, token });
    } else {
        return res.status(401).json({ success: false, error: 'Incorrect password.' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', server: 'Local Share' });
});

// Public config endpoint — exposes non-sensitive info (ngrok URL) to GitHub Pages login
app.get('/api/config', (req, res) => {
    res.json({ ngrokUrl: NGROK_URL || null });
});

let connectedUsers = 0;
const messageHistory = [];

io.on('connection', (socket) => {
    connectedUsers++;
    io.emit('user_count', connectedUsers);
    
    // Send message history to the newly connected client
    socket.emit('message_history', messageHistory);

    socket.on('disconnect', () => {
        connectedUsers--;
        io.emit('user_count', connectedUsers);
    });

    socket.on('chat_message', (msg) => {
        messageHistory.push({ type: 'text', msg });
        socket.broadcast.emit('chat_message', msg);
    });

    socket.on('file_shared', (fileInfo) => {
        messageHistory.push({ type: 'file', fileInfo });
        socket.broadcast.emit('file_shared', fileInfo);
    });
});

// Multer configuration for file uploads (streaming directly to disk)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `${Date.now()}-${sanitizedName}`);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    
    const token = extractToken(req);
    const downloadQuery = token ? `?token=${encodeURIComponent(token)}` : '';

    const fileInfo = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        downloadUrl: `/download/${req.file.filename}${downloadQuery}`
    };
    
    res.json(fileInfo);
});

// PC File Navigation endpoint
app.get('/api/files', (req, res) => {
    let targetDir = req.query.dir || 'C:\\COLLEGE\\Term_9';
    
    try {
        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Directory not found' });
        }
        
        const items = fs.readdirSync(targetDir, { withFileTypes: true });
        const result = [];
        
        for (const item of items) {
            try {
                result.push({
                    name: item.name,
                    isDirectory: item.isDirectory(),
                    path: path.join(targetDir, item.name)
                });
            } catch (e) {
                // Ignore items we can't access
            }
        }
        
        result.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        
        res.json({
            currentDir: targetDir,
            parentDir: path.dirname(targetDir),
            items: result
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read directory' });
    }
});

// PC File Download endpoint
app.get('/api/download-pc-file', (req, res) => {
    const filePath = req.query.path;
    
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
    }
    
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        return res.status(400).send('Cannot download a directory');
    }
    
    res.download(filePath);
});

server.listen(PORT, '0.0.0.0', () => {
    const localUrl = `http://localhost:${PORT}`;
    const lanUrl = `http://${ip.address()}:${PORT}`;
    
    console.log('\n Local Share is running!\n');
    console.log(` Local: ${localUrl}`);
    console.log(` LAN:   ${lanUrl}`);
    if (process.env.PASSWORD_HASH) {
        console.log(' Remote Auth: Enabled (Password hash configured in .env)');
    } else {
        console.log(' Remote Auth: ⚠️  PASSWORD_HASH not set in .env.');
        console.log(' Run: node generate-hash.js <password> to enable Remote Auth.');
    }
    if (NGROK_URL) {
        console.log(` Ngrok URL:  ${NGROK_URL}`);
    } else {
        console.log(' Ngrok URL:  ⚠️  NGROK_URL not set in .env (using pattern-matching fallback).');
    }
});
