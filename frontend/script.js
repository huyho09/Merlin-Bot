//Use for PROD 
const API_BASE = 'https://chatbot-clone-1.onrender.com'; 

// Local Test
// Default port is usually port 5000
//const API_BASE = 'http://localhost:3000'; 

class ChatApp {
    constructor() {
        this.chats = new Map();
        this.currentChatId = null;
        this.isFirstLoad = !sessionStorage.getItem('hasLoaded'); // Check if it's the first load
        this.initializeElements();
        this.bindEvents();
        this.initializeFirstChat(); // Handle first chat creation
    }

    initializeElements() {
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
    }

    async initializeFirstChat() {
        if (this.isFirstLoad) {
            await this.createNewChat(); // Create a new chat on first load
            sessionStorage.setItem('hasLoaded', 'true'); // Mark as loaded
        } else {
            await this.loadChats(); // Load existing chats for subsequent loads
        }
    }

    async loadChats() {
        try {
            const response = await fetch(`${API_BASE}/api/chats`);
            console.log('Load chats response status:', response.status);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
            }
            const chatsData = await response.json();
            const chatIds = chatsData.map(chat => chat.id);
            const histories = await Promise.all(
                chatIds.map(id => fetch(`${API_BASE}/api/chats/${id}`).then(res => {
                    if (!res.ok) {
                        throw new Error(`Failed to fetch chat ${id}: ${res.status}`);
                    }
                    return res.json();
                }))
            );
            for (let i = 0; i < chatIds.length; i++) {
                this.chats.set(chatIds[i], histories[i]);
            }
            if (this.chats.size > 0) {
                this.currentChatId = chatIds[0];
                this.renderChatHistory();
                this.renderMessages();
                this.renderUploadedPdfs();
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    async createNewChat() {
        try {
            const response = await fetch(`${API_BASE}/api/chats`, { method: 'POST' });
            console.log('Create chat response status:', response.status);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
            }
            const data = await response.json();
            const chatId = data.id;
            const chatResponse = await fetch(`${API_BASE}/api/chats/${chatId}`);
            if (!chatResponse.ok) {
                throw new Error(`Failed to fetch new chat ${chatId}: ${chatResponse.status}`);
            }
            const chatData = await chatResponse.json();
            this.chats.set(chatId, chatData);
            this.currentChatId = chatId;
            if (this.uploadedPdfsDiv) this.uploadedPdfsDiv.innerHTML = ''; // Reset the UI display
            this.renderChatHistory();
            this.renderMessages();
            this.renderUploadedPdfs();
            this.userInput.focus();
        } catch (error) {
            console.error('Error creating new chat:', error);
        }
    }

    async uploadPdfs() {
        const files = this.pdfInput.files;
        if (files.length === 0 || !this.currentChatId) return;

        const maxSize = 10 * 1024 * 1024; // 10 MB
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > maxSize) {
                alert(`File ${files[i].name} exceeds 10 MB limit. Please upload smaller files.`);
                return;
            }
        }

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('pdfs', files[i]);
        }

        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/upload-pdfs`, {
                method: 'POST',
                body: formData
            });
            console.log('Upload PDFs response status:', response.status);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || `HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            const currentChat = this.chats.get(this.currentChatId);
            if (currentChat) {
                currentChat.uploaded_pdfs = data.uploaded_pdfs;
            }
            this.renderUploadedPdfs();
        } catch (error) {
            console.error('Error uploading PDFs:', error);
            this.chats.get(this.currentChatId).messages.push({ role: 'assistant', content: `Error uploading PDFs: ${error.message}` });
            this.renderMessages();
        }
        this.pdfInput.value = ''; // Reset file input
    }

    async sendMessage() {
        if (!this.currentChatId) {
            alert('No chat available. Please create a new chat first by clicking "New Chat" in the sidebar.');
            return;
        }

        const userInput = this.userInput.value.trim();
        if (userInput === '') return;

        const userMessage = { role: 'user', content: userInput };
        this.chats.get(this.currentChatId).messages.push(userMessage);
        this.renderMessages();
        this.userInput.value = '';

        const thinkingMessage = { role: 'assistant', content: '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>', isThinking: true };
        this.chats.get(this.currentChatId).messages.push(thinkingMessage);
        this.renderMessages();

        const formData = new FormData();
        formData.append('message', userInput);
        const currentChat = this.chats.get(this.currentChatId);
        if (currentChat && currentChat.uploaded_pdfs && currentChat.uploaded_pdfs.length > 0) {
            const pdfResponse = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/get-pdfs`);
            if (!pdfResponse.ok) {
                throw new Error(`Failed to fetch PDFs: ${pdfResponse.status}`);
            }
            const pdfData = await pdfResponse.json();
            formData.append('pdf_text', pdfData.pdf_text);
        }

        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                body: formData
            });
            console.log('Send message response status:', response.status);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
            }
            const data = await response.json();
            const chat = this.chats.get(this.currentChatId);
            const thinkingIndex = chat.messages.findIndex(msg => msg.isThinking);
            if (thinkingIndex !== -1) chat.messages.splice(thinkingIndex, 1);

            if (data.error) {
                chat.messages.push({ role: 'assistant', content: `Sorry, an error occurred: ${data.error}` });
            } else {
                const aiResponse = { role: 'assistant', content: data.response };
                chat.messages.push(aiResponse);
                if (this.uploadedPdfsDiv) {
                    this.uploadedPdfsDiv.remove();
                    this.uploadedPdfsDiv = null;
                }
            }
            this.renderMessages();
        } catch (error) {
            console.error('Error sending message:', error);
            const chat = this.chats.get(this.currentChatId);
            const thinkingIndex = chat.messages.findIndex(msg => msg.isThinking);
            if (thinkingIndex !== -1) chat.messages.splice(thinkingIndex, 1);
            chat.messages.push({ role: 'assistant', content: `Sorry, an error occurred: ${error.message}` });
            this.renderMessages();
        }
    }

    renderChatHistory() {
        this.chatHistory.innerHTML = '';
        this.chats.forEach((chat, chatId) => {
            const item = document.createElement('div');
            item.className = `list-group-item d-flex justify-content-between align-items-center ${chatId === this.currentChatId ? 'active-chat' : ''}`;
            
            const chatNameSpan = document.createElement('span');
            chatNameSpan.className = 'chat-name flex-grow-1';
            chatNameSpan.textContent = chat.name || `Chat ${chatId.slice(-4)}`;
            chatNameSpan.addEventListener('click', () => {
                this.currentChatId = chatId;
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
            renameLink.setAttribute('data-chat-id', chatId);
            renameLink.textContent = 'Rename';
            renameItem.appendChild(renameLink);
            
            const deleteItem = document.createElement('li');
            const deleteLink = document.createElement('a');
            deleteLink.className = 'dropdown-item';
            deleteLink.href = '#';
            deleteLink.setAttribute('data-action', 'delete');
            deleteLink.setAttribute('data-chat-id', chatId);
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

    renderMessages() {
        this.chatMessages.innerHTML = '';
        const messages = this.chats.get(this.currentChatId)?.messages || [];
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

    renderUploadedPdfs() {
        if (!this.uploadedPdfsDiv) return;
        this.uploadedPdfsDiv.innerHTML = '';
        const currentChat = this.chats.get(this.currentChatId);
        if (currentChat && currentChat.uploaded_pdfs) {
            currentChat.uploaded_pdfs.forEach(pdf => {
                const p = document.createElement('p');
                p.textContent = pdf;
                this.uploadedPdfsDiv.appendChild(p);
            });
        }
    }

    async renameChat(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat) return;
        const currentName = chat.name || `Chat ${chatId.slice(-4)}`;
        const newName = prompt('Enter new name for the chat:', currentName);
        if (newName) {
            try {
                const response = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to rename chat');
                }
                chat.name = newName;
                this.renderChatHistory();
            } catch (error) {
                console.error('Error renaming chat:', error);
                alert('Failed to rename chat: ' + error.message);
            }
        }
    }

    async deleteChat(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat) return;
        if (confirm(`Are you sure you want to delete chat ${chat.name || 'Chat ' + chatId.slice(-4)}?`)) {
            try {
                const response = await fetch(`${API_BASE}/api/chats/${chatId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to delete chat');
                }
                this.chats.delete(chatId);
                if (this.currentChatId === chatId) {
                    this.currentChatId = null;
                    if (this.chats.size > 0) {
                        this.currentChatId = Array.from(this.chats.keys())[0];
                    }
                }
                this.renderChatHistory();
                this.renderMessages();
            } catch (error) {
                console.error('Error deleting chat:', error);
                alert('Failed to delete chat: ' + error.message);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});