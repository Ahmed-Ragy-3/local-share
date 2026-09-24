// Token handling from URL query or LocalStorage
const urlParams = new URLSearchParams(window.location.search);
let authToken = urlParams.get('token');

if (authToken) {
    localStorage.setItem('local_share_token', authToken);
    // Remove token from address bar for cleanliness
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
} else {
    authToken = localStorage.getItem('local_share_token');
}

// Initialize Socket.io with Auth Token
const socket = io({
    auth: { token: authToken },
    query: { token: authToken }
});

const chatContainer = document.getElementById('chat-container');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const browsePcBtn = document.getElementById('browse-pc-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const pasteBtn = document.getElementById('paste-btn');

// PC Browser UI Elements
const pcBrowserModal = document.getElementById('pc-browser-modal');
const closeBrowserBtn = document.getElementById('close-browser-btn');
const upDirBtn = document.getElementById('up-dir-btn');
const currentPathEl = document.getElementById('current-path');
const fileListEl = document.getElementById('file-list');
const pcBrowserSearch = document.getElementById('pc-browser-search');
const modalFooter = document.getElementById('modal-footer');
const selectedCountEl = document.getElementById('selected-count');
const sendSelectedBtn = document.getElementById('send-selected-btn');
let currentBrowserPath = '';
let currentDirectoryItems = [];
let selectedFiles = new Set();

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

socket.on('connect_error', (err) => {
    statusDot.classList.remove('connected');
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Auth Error';
    if (err.message && err.message.includes('Authentication required')) {
        // Clear invalid token and prompt re-auth if needed
        localStorage.removeItem('local_share_token');
        window.location.reload();
    }
});

socket.on('user_count', (count) => {
    statusText.textContent = `Connected (${count})`;
});

socket.on('message_history', (history) => {
    const systemMsg = messagesContainer.querySelector('.system-message');
    messagesContainer.innerHTML = '';
    if (systemMsg) messagesContainer.appendChild(systemMsg);
    
    history.forEach(item => {
        if (item.type === 'text') {
            appendMessage(item.msg, 'received');
        } else if (item.type === 'file') {
            appendFileMessage(item.fileInfo, 'received');
        }
    });
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

browsePcBtn.addEventListener('click', () => {
    pcBrowserModal.classList.remove('hidden');
    loadDirectory('');
});

closeBrowserBtn.addEventListener('click', () => {
    pcBrowserModal.classList.add('hidden');
});

upDirBtn.addEventListener('click', () => {
    if (currentBrowserPath) {
        const queryDir = encodeURIComponent(currentBrowserPath);
        const queryToken = authToken ? `&token=${encodeURIComponent(authToken)}` : '';
        fetch(`/api/files?dir=${queryDir}${queryToken}`, {
            headers: authToken ? { 'Authorization': `Bearer ${authToken}`, 'ngrok-skip-browser-warning': 'true' } : { 'ngrok-skip-browser-warning': 'true' }
        })
            .then(res => res.json())
            .then(data => {
                if (data.parentDir) loadDirectory(data.parentDir);
            });
    }
});

if (pcBrowserSearch) {
    pcBrowserSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredItems = currentDirectoryItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm)
        );
        renderFileList(filteredItems);
    });
}

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

if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                messageInput.value += text;
                messageInput.style.height = 'auto';
                messageInput.style.height = (messageInput.scrollHeight) + 'px';
                messageInput.focus();
            } else {
                alert('Your browser does not support clipboard reading directly. Please tap the input field and use your device\'s native paste option.');
            }
        } catch (err) {
            console.error('Failed to read clipboard text: ', err);
            alert('Could not paste. Please tap the input field and use your device\'s paste option.');
        }
    });
}

messageInput.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            const file = new File([blob], `image-${Date.now()}.png`, { type: blob.type });
            uploadFile(file);
        }
    }
});

if (sendSelectedBtn) {
    sendSelectedBtn.addEventListener('click', () => {
        selectedFiles.forEach(file => {
            sharePcFile(file.path, file.name);
        });
        selectedFiles.clear();
        updateModalFooter();
        pcBrowserModal.classList.add('hidden');
    });
}

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

function linkifyAndSanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    let html = div.innerHTML;
    // Preserve newlines and tabs before linkifying
    html = html.replace(/\n/g, '<br>').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    return html.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

function appendMessage(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    const copyBtnHtml = `
        <button class="message-copy-btn" title="Copy message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        </button>
    `;
    
    msgDiv.innerHTML = copyBtnHtml + `<span style="white-space: pre-wrap; word-break: break-word;">${linkifyAndSanitize(text)}</span>`;
    
    const copyBtn = msgDiv.querySelector('.message-copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.style.opacity = '1';
                    setTimeout(() => copyBtn.style.opacity = '', 1000);
                }).catch(err => {
                    console.error('Failed to copy', err);
                    alert('Failed to copy message');
                });
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    copyBtn.style.opacity = '1';
                    setTimeout(() => copyBtn.style.opacity = '', 1000);
                } catch (err) {
                    console.error('Fallback copy failed', err);
                    alert('Failed to copy message');
                }
                document.body.removeChild(textArea);
            }
        });
    }

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
    if (mimetype && mimetype.startsWith('image/')) return '🖼️';
    if (mimetype && mimetype.startsWith('video/')) return '🎥';
    if (mimetype && mimetype.startsWith('audio/')) return '🎵';
    if (mimetype && mimetype.includes('pdf')) return '📄';
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
    const uploadUrl = authToken ? `/upload?token=${encodeURIComponent(authToken)}` : '/upload';
    xhr.open('POST', uploadUrl, true);
    
    if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    }
    xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

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
    
    let downloadUrl = fileInfo.downloadUrl;
    if (authToken && !downloadUrl.includes('token=')) {
        const joinChar = downloadUrl.includes('?') ? '&' : '?';
        downloadUrl += `${joinChar}token=${encodeURIComponent(authToken)}`;
    }

    msgDiv.innerHTML = `
        <div class="file-info">
            <span class="file-icon">${getFileIcon(fileInfo.mimetype || '')}</span>
            <div class="file-details">
                <span class="file-name" title="${fileInfo.originalName}">${fileInfo.originalName}</span>
                <span class="file-size">${formatBytes(fileInfo.size)}</span>
            </div>
        </div>
        <a href="${downloadUrl}" class="download-link" download="${fileInfo.originalName}" target="_blank">Download</a>
    `;
    
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function loadDirectory(dirPath) {
    let url = `/api/files?dir=${encodeURIComponent(dirPath)}`;
    if (authToken) {
        url += `&token=${encodeURIComponent(authToken)}`;
    }

    fetch(url, {
        headers: authToken ? { 'Authorization': `Bearer ${authToken}`, 'ngrok-skip-browser-warning': 'true' } : { 'ngrok-skip-browser-warning': 'true' }
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }
            currentBrowserPath = data.currentDir;
            currentPathEl.textContent = data.currentDir;
            currentDirectoryItems = data.items;
            if (pcBrowserSearch) pcBrowserSearch.value = '';
            renderFileList(currentDirectoryItems);
        })
        .catch(err => console.error(err));
}

function updateModalFooter() {
    if (!modalFooter) return;
    if (selectedFiles.size > 0) {
        modalFooter.classList.remove('hidden');
        selectedCountEl.textContent = `${selectedFiles.size} file(s) selected`;
    } else {
        modalFooter.classList.add('hidden');
    }
}

function renderFileList(items) {
    fileListEl.innerHTML = '';
    selectedFiles.clear();
    updateModalFooter();
    
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'file-item';
        
        let checkboxHtml = '';
        if (!item.isDirectory) {
            checkboxHtml = `<input type="checkbox" class="file-checkbox" value="${item.path}">`;
        }
        
        itemDiv.innerHTML = `
            ${checkboxHtml}
            <div class="file-item-icon">${item.isDirectory ? '📁' : '📄'}</div>
            <div class="file-item-name" title="${item.name}">${item.name}</div>
        `;
        
        const checkbox = itemDiv.querySelector('.file-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (e.target.checked) {
                    selectedFiles.add({ path: item.path, name: item.name });
                } else {
                    for (let f of selectedFiles) {
                        if (f.path === item.path) {
                            selectedFiles.delete(f);
                            break;
                        }
                    }
                }
                updateModalFooter();
            });
        }
        
        itemDiv.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') return;
            
            if (item.isDirectory) {
                loadDirectory(item.path);
            } else {
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            }
        });
        
        fileListEl.appendChild(itemDiv);
    });
}

function sharePcFile(filePath, fileName) {
    let downloadUrl = `/api/download-pc-file?path=${encodeURIComponent(filePath)}`;
    if (authToken) {
        downloadUrl += `&token=${encodeURIComponent(authToken)}`;
    }

    const fileInfo = {
        originalName: fileName,
        filename: fileName,
        size: 0,
        mimetype: '',
        downloadUrl: downloadUrl
    };
    
    appendFileMessage(fileInfo, 'sent');
    socket.emit('file_shared', fileInfo);
}
