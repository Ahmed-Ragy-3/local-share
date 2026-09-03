const socket = io();

const chatContainer = document.getElementById('chat-container');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Socket Events
socket.on('connect', () => {
    statusDot.classList.add('connected');
    statusDot.classList.remove('disconnected');
    statusText.textContent = 'Connected';
});

socket.on('disconnect', () => {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
});

socket.on('user_count', (count) => {
    statusText.textContent = `Connected (${count})`;
});

socket.on('chat_message', (msg) => {
    appendMessage(msg, 'received');
});

socket.on('file_shared', (fileInfo) => {
    appendFileMessage(fileInfo, 'received');
});

// UI Events
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

fileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            uploadFile(files[i]);
        }
        fileInput.value = ''; // Reset
    }
});

// Drag and drop
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});
document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
            uploadFile(e.dataTransfer.files[i]);
        }
    }
});

// Functions
function sendMessage() {
    const text = messageInput.value.trim();
    if (text) {
        socket.emit('chat_message', text);
        appendMessage(text, 'sent');
        messageInput.value = '';
        messageInput.style.height = 'auto';
    }
}

function appendMessage(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    // Basic sanitization by using textContent
    msgDiv.textContent = text;
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIcon(mimetype) {
    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype.startsWith('video/')) return '🎥';
    if (mimetype.startsWith('audio/')) return '🎵';
    if (mimetype.includes('pdf')) return '📄';
    return '📎';
}

function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'sent', 'file-message');
    
    msgDiv.innerHTML = `
        <div class="file-info">
            <span class="file-icon">${getFileIcon(file.type || '')}</span>
            <div class="file-details">
                <span class="file-name" title="${file.name}">${file.name}</span>
                <span class="file-size">${formatBytes(file.size)}</span>
            </div>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: 0%"></div>
        </div>
        <span class="status-text" style="font-size: 0.75rem; margin-top: 4px; opacity: 0.8;">Uploading...</span>
    `;
    
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();

    const progressBar = msgDiv.querySelector('.progress-bar');
    const statusTextEl = msgDiv.querySelector('.status-text');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressBar.style.width = percentComplete + '%';
            statusTextEl.textContent = `Uploading... ${Math.round(percentComplete)}%`;
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            const fileInfo = JSON.parse(xhr.responseText);
            progressBar.parentElement.style.display = 'none';
            statusTextEl.innerHTML = '✓ Sent';
            
            // Notify others
            socket.emit('file_shared', fileInfo);
        } else {
            statusTextEl.textContent = '✗ Upload failed';
            statusTextEl.style.color = '#ffb3b3';
        }
    };

    xhr.onerror = function() {
        statusTextEl.textContent = '✗ Network Error';
        statusTextEl.style.color = '#ffb3b3';
    };

    xhr.send(formData);
}

function appendFileMessage(fileInfo, type) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type, 'file-message');
    
    msgDiv.innerHTML = `
        <div class="file-info">
            <span class="file-icon">${getFileIcon(fileInfo.mimetype || '')}</span>
            <div class="file-details">
                <span class="file-name" title="${fileInfo.originalName}">${fileInfo.originalName}</span>
                <span class="file-size">${formatBytes(fileInfo.size)}</span>
            </div>
        </div>
        <a href="${fileInfo.downloadUrl}" class="download-link" download="${fileInfo.originalName}" target="_blank">Download</a>
    `;
    
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}
