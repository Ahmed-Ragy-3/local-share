const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ip = require('ip');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100 MB max message size for websockets if needed, though we use HTTP for files
});

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer configuration for file uploads (streaming directly to disk)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Sanitize filename to prevent directory traversal
        const sanitizedName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `${Date.now()}-${sanitizedName}`);
    }
});
const upload = multer({ 
    storage,
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB limit
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Serve uploaded files statically for downloading
app.use('/download', express.static(UPLOAD_DIR));

let connectedUsers = 0;

io.on('connection', (socket) => {
    connectedUsers++;
    io.emit('user_count', connectedUsers);

    socket.on('disconnect', () => {
        connectedUsers--;
        io.emit('user_count', connectedUsers);
    });

    socket.on('chat_message', (msg) => {
        // Broadcast the message to all other connected clients
        socket.broadcast.emit('chat_message', msg);
    });

    socket.on('file_shared', (fileInfo) => {
        // Broadcast file info to other clients
        socket.broadcast.emit('file_shared', fileInfo);
    });
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    
    const fileInfo = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        downloadUrl: `/download/${req.file.filename}`
    };
    
    res.json(fileInfo);
});

server.listen(PORT, '0.0.0.0', () => {
    const localUrl = `http://localhost:${PORT}`;
    const lanUrl = `http://${ip.address()}:${PORT}`;
    
    console.log('\nLocal Share is running\n');
    console.log(`Local: ${localUrl}`);
    console.log(`LAN:   ${lanUrl}`);
    console.log('\nPress Ctrl+C to stop.\n');
});
