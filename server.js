const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const os = require('os');

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
        // Store in history
        messageHistory.push({ type: 'text', msg });
        // Broadcast the message to all other connected clients
        socket.broadcast.emit('chat_message', msg);
    });

    socket.on('file_shared', (fileInfo) => {
        // Store in history
        messageHistory.push({ type: 'file', fileInfo });
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

// PC File Navigation endpoint
app.get('/api/files', (req, res) => {
    let targetDir = req.query.dir || os.homedir();
    
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
        
        // Sort: directories first, then alphabetically
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
    
    console.log('\nLocal Share is running\n');
    console.log(`Local: ${localUrl}`);
    console.log(`LAN:   ${lanUrl}`);
    console.log('\nPress Ctrl+C to stop.\n');
});
