//Use for PROD 
const API_BASE = 'https://chatbot-clone-1.onrender.com'; 

// Local Test
//const API_BASE = 'http://localhost:3000'; 

class ChatApp {
    constructor() {
        this.chats = new Map();
        this.currentChatId = null;
        this.initializeElements();
        this.bindEvents();
        this.loadChats();
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
            } else {
                await this.createNewChat();
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
            
            // Clear the displayed uploaded PDFs for the new chat
            this.uploadedPdfsDiv.innerHTML = ''; // Reset the UI display
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

        const maxSize = 10 * 1024 * 1024; // 10 MB, matches MAX_PDF_SIZE in main.py
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
        const userInput = this.userInput.value.trim();
        if (userInput === '' || !this.currentChatId) return;

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
                // Remove the uploadedPdfs div after successful send
                if (this.uploadedPdfsDiv) {
                    this.uploadedPdfsDiv.remove();
                    this.uploadedPdfsDiv = null; // Prevent further references
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
        this.chats.forEach((_, chatId) => {
            const item = document.createElement('div');
            item.className = `list-group-item ${chatId === this.currentChatId ? 'active-chat' : ''}`;
            item.textContent = `Chat ${chatId.slice(-4)}`;
            item.addEventListener('click', () => {
                this.currentChatId = chatId;
                this.renderChatHistory();
                this.renderMessages();
                this.renderUploadedPdfs();
                if (window.innerWidth < 768) this.sidebar.classList.remove('active');
            });
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
        if (!this.uploadedPdfsDiv) return; // Skip if div has been removed
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
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});