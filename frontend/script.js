// Use for PROD
const API_BASE = 'https://chatbot-clone-1.onrender.com';

// VPS
//const API_BASE = 'https://14.225.254.107:5001';

// Local Test. Normally it will be port 5000 as default but I do not remember what app is using my port 5000. I tried to kill it but it is not working
// You can try port 5000 on your end
//const API_BASE = 'https://localhost:5001';

class ChatApp {
    constructor() {
        this.currentChatId = null;
        this.isFirstLoad = !sessionStorage.getItem('hasLoaded'); // Still track first load for session management
        this.initializeElements();
        this.bindEvents();
        this.checkLoginStatus();
    }

    initializeElements() {
        this.loadingDiv = document.getElementById('loading');
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.newChatBtn = document.getElementById('newChat');
        this.chatHistory = document.getElementById('chatHistory');
        this.sidebar = document.getElementById('sidebar');
        this.showSidebarBtn = document.getElementById('showSidebar');
        this.toggleSidebarBtn = document.getElementById('toggleSidebar');
        this.uploadPdfBtn = document.getElementById('uploadPdfBtn');
        this.pdfInput = document.getElementById('pdfInput');
        this.uploadedPdfsDiv = document.getElementById('uploadedPdfs');
        this.loginForm = document.getElementById('loginFormElement');
        this.chatAppDiv = document.getElementById('chatApp');
        this.loginDiv = document.getElementById('loginForm');
        this.quoteDiv = document.getElementById('quote');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.shareLocationBtn = document.getElementById('shareLocationBtn'); // New element
    }

    bindEvents() {
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.showSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.add('active');
        });
        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.remove('active');
        });
        this.uploadPdfBtn.addEventListener('click', () => this.pdfInput.click());
        this.pdfInput.addEventListener('change', () => this.uploadPdfs());
        this.chatHistory.addEventListener('click', (e) => {
            if (e.target.matches('.dropdown-item')) {
                e.preventDefault();
                const action = e.target.getAttribute('data-action');
                const chatId = e.target.getAttribute('data-chat-id');
                if (action === 'rename') {
                    this.renameChat(chatId);
                } else if (action === 'delete') {
                    this.deleteChat(chatId);
                }
            }
        });
        this.uploadedPdfsDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-pdf')) {
                const pdfName = e.target.getAttribute('data-pdf');
                this.removePdf(pdfName);
            }
        });
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.shareLocationBtn.addEventListener('click', () => this.shareLocation()); // New event
    }

    // New method to handle location sharing
    async shareLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    const token = localStorage.getItem('token');
                    try {
                        const response = await fetch(`${API_BASE}/api/users/location`, {
                            method: 'PUT',
                            headers: {
                                'Authorization': token,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ latitude, longitude })
                        });
                        if (!response.ok) throw new Error('Failed to update location');
                        alert('Location shared successfully!');
                    } catch (error) {
                        console.error('Error sharing location:', error);
                        alert('Failed to share location: ' + error.message);
                    }
                },
                (error) => {
                    console.error('Error getting location:', error);
                    alert('Unable to get location: ' + error.message);
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    }

    async checkLoginStatus() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.loadingDiv.style.display = 'none';
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/check-login`, {
                method: 'GET',
                headers: { 'Authorization': token },

            });
            const data = await response.json();
            if (data.logged_in) {
                this.loadingDiv.style.display = 'none';
                this.quoteDiv.style.display = 'none';
                this.loginDiv.style.display = 'none';
                this.chatAppDiv.style.display = 'block';
                // Load existing chats instead of creating a new one
                await this.loadChats();
                // Mark the session as loaded, but don't auto-create a chat
                sessionStorage.setItem('hasLoaded', 'true');
            } else {
                localStorage.removeItem('token');
                this.loadingDiv.style.display = 'none';
                this.quoteDiv.style.display = 'block';
                this.loginDiv.style.display = 'block';
                this.chatAppDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            localStorage.removeItem('token');
            this.loadingDiv.style.display = 'none';
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                this.quoteDiv.style.display = 'none';
                this.loginDiv.style.display = 'none';
                this.chatAppDiv.style.display = 'block';
                // Load existing chats instead of creating a new one
                await this.loadChats();
                // Mark the session as loaded
                sessionStorage.setItem('hasLoaded', 'true');
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login error occurred');
        }
    }

    async loadChats() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'GET',
                headers: { 'Authorization': token },
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const chatsData = await response.json();
            this.renderChatHistory(chatsData);
            // Only set currentChatId and render messages if there are existing chats
            if (chatsData.length > 0) {
                this.currentChatId = chatsData[0].id;
                this.renderMessages();
                this.renderUploadedPdfs();
            } else {
                // Clear chat area if no chats exist
                this.currentChatId = null;
                this.chatMessages.innerHTML = '';
                if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
            }
        } catch (error) {
            console.error('Error loading chats:', error);
            this.chatMessages.innerHTML = '<p>Error loading chats. Please try again.</p>';
        }
    }

    async createNewChat() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to create a new chat.');
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            this.currentChatId = data.id;
            if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
            this.renderChatHistory();
            this.renderMessages();
            this.renderUploadedPdfs();
            this.userInput.focus();
        } catch (error) {
            console.error('Error creating new chat:', error);
            alert('Failed to create chat: ' + error.message);
        }
    }

    async uploadPdfs() {
        const files = this.pdfInput.files;
        if (files.length === 0 || !this.currentChatId) return;

        const maxSize = 10 * 1024 * 1024;
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxSize) {
                alert(`File ${files[i].name} exceeds 10 MB limit.`);
                return;
            }
        }

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('pdfs', files[i]);
        }

        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/upload-pdfs`, {
                method: 'POST',
                headers: { 'Authorization': token },
                body: formData
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            await response.json();
            this.renderUploadedPdfs();
        } catch (error) {
            console.error('Error uploading PDFs:', error);
            this.renderMessagesWithError(`Error uploading PDFs: ${error.message}`);
        }
        this.pdfInput.value = '';
    }

    async removePdf(pdfName) {
        if (!this.currentChatId) return;

        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/remove-pdf`, {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pdf_name: pdfName })
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            this.renderUploadedPdfs();
        } catch (error) {
            console.error('Error removing PDF:', error);
            this.renderMessagesWithError(`Error removing PDF: ${error.message}`);
        }
    }

    async sendMessage() {
        if (!this.currentChatId) {
            alert('No chat available. Please create a new chat.');
            return;
        }

        const userInput = this.userInput.value.trim();
        if (userInput === '') return;

        const token = localStorage.getItem('token');
        try {
            const chatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token },
            });
            if (!chatResponse.ok) throw new Error('Failed to fetch chat');
            const chatData = await chatResponse.json();
            const messages = chatData.messages;

            messages.push({ role: 'user', content: userInput });
            this.renderMessages(messages);
            this.userInput.value = '';

            messages.push({ role: 'assistant', content: '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>', isThinking: true });
            this.renderMessages(messages);

            const formData = new FormData();
            formData.append('message', userInput);
            if (chatData.uploaded_pdfs.length > 0) {
                formData.append('pdf_text', chatData.pdf_text);
            }

            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                headers: { 'Authorization': token },
                body: formData,
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();

            const updatedChatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token },
            });
            const updatedChat = await updatedChatResponse.json();
            this.renderMessages(updatedChat.messages);
            if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = '';
            this.renderUploadedPdfs();
        } catch (error) {
            console.error('Error sending message:', error);
            this.renderMessagesWithError(`Error: ${error.message}`);
        }
    }

    async renderChatHistory(chatsData = null) {
        const token = localStorage.getItem('token');
        if (!token) return;

        let chats;
        if (chatsData) {
            chats = chatsData;
        } else {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'GET',
                headers: { 'Authorization': token },
            });
            if (!response.ok) return;
            chats = await response.json();
        }

        this.chatHistory.innerHTML = '';
        const maxLength = 20; // Set maximum length for chat name display
        chats.forEach(chat => {
            const item = document.createElement('div');
            item.className = `list-group-item d-flex justify-content-between align-items-center ${chat.id === this.currentChatId ? 'active-chat' : ''}`;
            
            const chatNameSpan = document.createElement('span');
            chatNameSpan.className = 'chat-name flex-grow-1';
            const fullName = chat.name || `Chat ${chat.id.slice(-4)}`;
            // Truncate name if longer than maxLength
            chatNameSpan.textContent = fullName.length > maxLength ? fullName.substring(0, maxLength - 3) + '...' : fullName;
            chatNameSpan.setAttribute('title', fullName); // Full name on hover/tap
            chatNameSpan.addEventListener('click', () => {
                this.currentChatId = chat.id;
                this.renderChatHistory();
                this.renderMessages();
                this.renderUploadedPdfs();
                if (window.innerWidth < 768) this.sidebar.classList.remove('active');
            });
            item.appendChild(chatNameSpan);
            
            const dropdownDiv = document.createElement('div');
            dropdownDiv.className = 'dropdown';
            
            const dropdownButton = document.createElement('button');
            dropdownButton.className = 'btn btn-sm btn-outline-secondary';
            dropdownButton.type = 'button';
            dropdownButton.setAttribute('data-bs-toggle', 'dropdown');
            dropdownButton.setAttribute('aria-expanded', 'false');
            dropdownButton.textContent = '...';
            
            const dropdownMenu = document.createElement('ul');
            dropdownMenu.className = 'dropdown-menu';
            
            const renameItem = document.createElement('li');
            const renameLink = document.createElement('a');
            renameLink.className = 'dropdown-item';
            renameLink.href = '#';
            renameLink.setAttribute('data-action', 'rename');
            renameLink.setAttribute('data-chat-id', chat.id);
            renameLink.textContent = 'Rename';
            renameItem.appendChild(renameLink);
            
            const deleteItem = document.createElement('li');
            const deleteLink = document.createElement('a');
            deleteLink.className = 'dropdown-item';
            deleteLink.href = '#';
            deleteLink.setAttribute('data-action', 'delete');
            deleteLink.setAttribute('data-chat-id', chat.id);
            deleteLink.textContent = 'Delete';
            deleteItem.appendChild(deleteLink);
            
            dropdownMenu.appendChild(renameItem);
            dropdownMenu.appendChild(deleteItem);
            
            dropdownDiv.appendChild(dropdownButton);
            dropdownDiv.appendChild(dropdownMenu);
            
            item.appendChild(dropdownDiv);
            this.chatHistory.appendChild(item);
        });
    }

    async renderMessages(messages = null) {
        if (!this.currentChatId) return;

        const token = localStorage.getItem('token');
        if (!messages) {
            try {
                const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                    method: 'GET',
                    headers: { 'Authorization': token },
                });
                if (!response.ok) throw new Error('Failed to fetch messages');
                const chatData = await response.json();
                messages = chatData.messages;
            } catch (error) {
                console.error('Error fetching messages:', error);
                return;
            }
        }

        this.chatMessages.innerHTML = '';
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message ${msg.role === 'user' ? 'user-message' : (msg.isThinking ? 'thinking-message' : 'ai-message')}`;
            
            if (msg.role === 'assistant' && !msg.isThinking) {
                // Check if the message content is likely HTML (contains <, >, and src=)
                if (msg.content.startsWith('<') && msg.content.endsWith('>') && msg.content.includes(' src=')) {
                    div.innerHTML = msg.content;
                } else {
                    const htmlContent = marked.parse(msg.content, { sanitize: false });
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlContent;

                    // Process code blocks with Prism.js
                    const codeBlocks = tempDiv.querySelectorAll('pre code');
                    codeBlocks.forEach((code, index) => {
                        const pre = code.parentElement;
                        let language = code.className ? code.className.replace('language-', '') : 'plaintext';
                        if (language === 'vue') {
                            language = 'markup';
                        }
                        code.className = `language-${language}`;
                        const snippetDiv = document.createElement('div');
                        snippetDiv.className = 'code-snippet';
                        snippetDiv.innerHTML = `<pre><code class="language-${language}">${code.textContent}</code></pre>`;

                        const copyBtn = document.createElement('button');
                        copyBtn.className = 'copy-btn';
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                        copyBtn.addEventListener('click', () => this.copyToClipboard(code.textContent, copyBtn));
                        snippetDiv.appendChild(copyBtn);

                        pre.parentNode.replaceChild(snippetDiv, pre);
                    });

                    div.appendChild(tempDiv);
                    Prism.highlightAllUnder(div);

                    // Ensure iframes are styled and functional
                    const iframes = div.querySelectorAll('iframe');
                    iframes.forEach(iframe => {
                        iframe.style.width = '100%';
                        iframe.style.height = '300px';
                        iframe.style.border = '0';
                        iframe.setAttribute('allowfullscreen', '');
                    });
                }
            } else {
                div.innerHTML = msg.content;
            }
            this.chatMessages.appendChild(div);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    copyToClipboard(codeText, button) {
        navigator.clipboard.writeText(codeText).then(() => {
            button.classList.add('copied');
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                button.classList.remove('copied');
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }

    async renderUploadedPdfs() {
        if (!this.currentChatId || !this.uploadedPdfsDiv) return;

        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token },
            });
            if (!response.ok) throw new Error('Failed to fetch chat');
            const chatData = await response.json();
            const uploadedPdfs = chatData.uploaded_pdfs;

            this.uploadedPdfsDiv.innerHTML = '';
            if (uploadedPdfs && uploadedPdfs.length > 0) {
                uploadedPdfs.forEach(pdf => {
                    const div = document.createElement('div');
                    div.className = 'pdf-item';
                    const p = document.createElement('p');
                    p.textContent = pdf;
                    const removeBtn = document.createElement('span');
                    removeBtn.className = 'remove-pdf';
                    removeBtn.textContent = '×';
                    removeBtn.setAttribute('data-pdf', pdf);
                    div.appendChild(p);
                    div.appendChild(removeBtn);
                    this.uploadedPdfsDiv.appendChild(div);
                });
            }
        } catch (error) {
            console.error('Error fetching uploaded PDFs:', error);
        }
    }

    async renameChat(chatId) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                method: 'GET',
                headers: { 'Authorization': token },
            });
            if (!response.ok) throw new Error('Failed to fetch chat');
            const chatData = await response.json();
            const currentName = chatData.name || `Chat ${chatId.slice(-4)}`;
            const newName = prompt('Enter new name for the chat:', currentName);
            if (newName) {
                const updateResponse = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name: newName })
                });
                if (!updateResponse.ok) throw new Error('Failed to rename chat');
                this.renderChatHistory();
            }
        } catch (error) {
            console.error('Error renaming chat:', error);
            alert('Failed to rename chat');
        }
    }

    async deleteChat(chatId) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                method: 'GET',
                headers: { 'Authorization': token },
            });
            if (!response.ok) throw new Error('Failed to fetch chat');
            const chatData = await response.json();
            if (confirm(`Are you sure you want to delete chat ${chatData.name || 'Chat ' + chatId.slice(-4)}?`)) {
                const deleteResponse = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token },
                });
                if (!deleteResponse.ok) throw new Error('Failed to delete chat');
                if (this.currentChatId === chatId) {
                    const chatsResponse = await fetch(`${API_BASE}/api/chats`, {
                        method: 'GET',
                        headers: { 'Authorization': token },
                    });
                    const chats = await chatsResponse.json();
                    this.currentChatId = chats.length > 0 ? chats[0].id : null;
                }
                this.renderChatHistory();
                this.renderMessages();
                this.renderUploadedPdfs();
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat');
        }
    }

    async handleLogout() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.quoteDiv.style.display = 'block';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/logout`, {
                method: 'POST',
                headers: { 'Authorization': token },
                credentials: 'include'
            });
            if (response.ok) {
                localStorage.removeItem('token');
                this.currentChatId = null;
                this.renderChatHistory();
                this.renderMessages();
                this.renderUploadedPdfs();
                this.quoteDiv.style.display = 'block';
                this.loginDiv.style.display = 'block';
                this.chatAppDiv.style.display = 'none';
            } else {
                alert('Logout failed');
            }
        } catch (error) {
            console.error('Logout error:', error);
            alert('Logout error occurred');
        }
    }

    async renderMessagesWithError(errorMessage) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token },
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to fetch chat');
            const chatData = await response.json();
            const messages = chatData.messages;
            const thinkingIndex = messages.findIndex(msg => msg.isThinking);
            if (thinkingIndex !== -1) messages.splice(thinkingIndex, 1);
            messages.push({ role: 'assistant', content: errorMessage });
            this.renderMessages(messages);
        } catch (error) {
            console.error('Error rendering error message:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});