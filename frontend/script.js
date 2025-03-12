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
    }

    bindEvents() {
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    createNewChat() {
        const chatId = Date.now().toString();
        this.chats.set(chatId, []);
        this.currentChatId = chatId;
        this.updateChatHistory();
        this.renderMessages();
        this.userInput.focus();
    }

    loadChats() {
        if (!this.currentChatId && this.chats.size === 0) {
            this.createNewChat();
        }
        this.updateChatHistory();
        this.renderMessages();
    }

    updateChatHistory() {
        this.chatHistory.innerHTML = '';
        this.chats.forEach((messages, id) => {
            const item = document.createElement('div');
            item.className = `list-group-item ${id === this.currentChatId ? 'active-chat' : ''}`;
            item.textContent = `Chat ${id.slice(-4)}`;
            item.addEventListener('click', () => {
                this.currentChatId = id;
                this.updateChatHistory();
                this.renderMessages();
            });
            this.chatHistory.appendChild(item);
        });
    }

    renderMessages() {
        this.chatMessages.innerHTML = '';
        const messages = this.chats.get(this.currentChatId) || [];
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
            div.textContent = msg.content;
            this.chatMessages.appendChild(div);
        });
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message || !this.currentChatId) return;

        // Add user message
        const userMsg = { role: 'user', content: message };
        this.chats.get(this.currentChatId).push(userMsg);
        this.renderMessages();
        this.userInput.value = '';

        // Get AI response from backend
        try {
            const chatHistory = this.chats.get(this.currentChatId).slice(0, -1); // Exclude current message
            const response = await this.getAIResponse(message, chatHistory);
            const aiMsg = { role: 'assistant', content: response };
            this.chats.get(this.currentChatId).push(aiMsg);
            this.renderMessages();
        } catch (error) {
            console.error('Error:', error);
            const errorMsg = { role: 'assistant', content: 'Sorry, an error occurred.' };
            this.chats.get(this.currentChatId).push(errorMsg);
            this.renderMessages();
        }
    }

    // ... (rest of the code remains the same until getAIResponse)

    async getAIResponse(message, chatHistory) {
        const response = await fetch('http://localhost:2138/api/chat', {  // Changed to explicit port
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                chatHistory
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'API request failed');
        return data.response;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});