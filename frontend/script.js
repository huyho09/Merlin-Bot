// Use for PROD
const API_BASE = 'https://chatbot-clone-1.onrender.com';

// Local Test
//const API_BASE = 'http://localhost:5001';

class ChatApp {
    constructor() {
        this.currentChatId = null;
        this.isFirstLoad = !sessionStorage.getItem('hasLoaded');
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
        this.logoutBtn = document.getElementById('logoutBtn');
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
    }

    async checkLoginStatus() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.loadingDiv.style.display = 'none';
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/check-login`, {
                method: 'GET',
                headers: { 'Authorization': token }
            });
            const data = await response.json();
            if (data.logged_in) {
                this.loadingDiv.style.display = 'none';
                this.loginDiv.style.display = 'none';
                this.chatAppDiv.style.display = 'block';
                if (this.isFirstLoad) {
                    await this.createNewChat();
                    sessionStorage.setItem('hasLoaded', 'true');
                } else {
                    await this.loadChats();
                }
            } else {
                localStorage.removeItem('token');
                this.loadingDiv.style.display = 'none';
                this.loginDiv.style.display = 'block';
                this.chatAppDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            localStorage.removeItem('token');
            this.loadingDiv.style.display = 'none';
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
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                this.loginDiv.style.display = 'none';
                this.chatAppDiv.style.display = 'block';
                if (this.isFirstLoad) {
                    await this.createNewChat();
                    sessionStorage.setItem('hasLoaded', 'true');
                } else {
                    await this.loadChats();
                }
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
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'GET',
                headers: { 'Authorization': token }
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const chatsData = await response.json();
            if (chatsData.length > 0) {
                this.currentChatId = chatsData[0].id; // Set the first chat as active
                this.renderChatHistory(chatsData);
                this.renderMessages();
                this.renderUploadedPdfs();
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    async createNewChat() {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in to create a new chat.');
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/chats`, {
                method: 'POST',
                headers: { 'Authorization': token }
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
            // Fetch current chat data to append user message
            const chatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token }
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
                body: formData
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();

            // Fetch updated chat data after sending message
            const updatedChatResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token }
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
                headers: { 'Authorization': token }
            });
            if (!response.ok) return;
            chats = await response.json();
        }

        this.chatHistory.innerHTML = '';
        chats.forEach(chat => {
            const item = document.createElement('div');
            item.className = `list-group-item d-flex justify-content-between align-items-center ${chat.id === this.currentChatId ? 'active-chat' : ''}`;
            
            const chatNameSpan = document.createElement('span');
            chatNameSpan.className = 'chat-name flex-grow-1';
            chatNameSpan.textContent = chat.name || `Chat ${chat.id.slice(-4)}`;
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
                    headers: { 'Authorization': token }
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
                div.innerHTML = marked.parse(msg.content);
            } else {
                div.innerHTML = msg.content;
            }
            this.chatMessages.appendChild(div);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async renderUploadedPdfs() {
        if (!this.currentChatId || !this.uploadedPdfsDiv) return;

        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token }
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
                headers: { 'Authorization': token }
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
                headers: { 'Authorization': token }
            });
            if (!response.ok) throw new Error('Failed to fetch chat');
            const chatData = await response.json();
            if (confirm(`Are you sure you want to delete chat ${chatData.name || 'Chat ' + chatId.slice(-4)}?`)) {
                const deleteResponse = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token }
                });
                if (!deleteResponse.ok) throw new Error('Failed to delete chat');
                if (this.currentChatId === chatId) {
                    const chatsResponse = await fetch(`${API_BASE}/api/chats`, {
                        method: 'GET',
                        headers: { 'Authorization': token }
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
            this.loginDiv.style.display = 'block';
            this.chatAppDiv.style.display = 'none';
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/logout`, {
                method: 'POST',
                headers: { 'Authorization': token }
            });
            if (response.ok) {
                localStorage.removeItem('token');
                this.currentChatId = null;
                this.renderChatHistory();
                this.renderMessages();
                this.renderUploadedPdfs();
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

    // Helper method to display error messages
    async renderMessagesWithError(errorMessage) {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}`, {
                method: 'GET',
                headers: { 'Authorization': token }
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