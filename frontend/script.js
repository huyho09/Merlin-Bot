const API_BASE = 'https://chatbot-clone-1.onrender.com';

class ChatApp {
    constructor() {
        this.chats = new Map();
        this.currentChatId = null;
        this.initializeElements();
        this.bindEvents();
        this.loadChats();
        this.sendMessage = this.sendMessage.bind(this); // Ensure binding
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.newChatBtn = document.getElementById('newChat');
        this.chatHistory = document.getElementById('chatHistory');
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
            console.log('Chats data:', chatsData);
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
                this.chats.set(chatIds[i].toString(), histories[i]);
            }
            if (this.chats.size > 0) {
                this.currentChatId = Array.from(this.chats.keys())[0];
            } else {
                await this.createNewChat();
            }
            this.renderChatHistory();
            this.renderMessages();
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
            const chatId = data.id.toString();
            this.chats.set(chatId, []);
            this.currentChatId = chatId;
            this.renderChatHistory();
            this.renderMessages();
            this.userInput.focus();
        } catch (error) {
            console.error('Error creating new chat:', error);
        }
    }

    async sendMessage() {
        const userInput = this.userInput.value.trim();
        if (userInput === '' || !this.currentChatId) return;

        const userMessage = { role: 'user', content: userInput };
        this.chats.get(this.currentChatId).push(userMessage);
        this.renderMessages();
        this.userInput.value = '';

        // Add thinking message
        const thinkingMessage = { role: 'assistant', content: '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>', isThinking: true };
        this.chats.get(this.currentChatId).push(thinkingMessage);
        this.renderMessages();

        try {
            const response = await fetch(`${API_BASE}/api/chats/${this.currentChatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userInput })
            });
            console.log('Send message response status:', response.status);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${text}`);
            }
            const data = await response.json();
            // Remove thinking message
            const chat = this.chats.get(this.currentChatId);
            const thinkingIndex = chat.findIndex(msg => msg.isThinking);
            if (thinkingIndex !== -1) chat.splice(thinkingIndex, 1);
            
            if (data.error) {
                this.chats.get(this.currentChatId).push({ role: 'assistant', content: 'Sorry, an error occurred.' });
            } else {
                const aiResponse = { role: 'assistant', content: data.response };
                this.chats.get(this.currentChatId).push(aiResponse);
            }
            this.renderMessages();
        } catch (error) {
            console.error('Error sending message:', error);
            // Remove thinking message
            const chat = this.chats.get(this.currentChatId);
            const thinkingIndex = chat.findIndex(msg => msg.isThinking);
            if (thinkingIndex !== -1) chat.splice(thinkingIndex, 1);
            this.chats.get(this.currentChatId).push({ role: 'assistant', content: 'Sorry, an error occurred.' });
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
            });
            this.chatHistory.appendChild(item);
        });
    }

    renderMessages() {
        this.chatMessages.innerHTML = '';
        const messages = this.chats.get(this.currentChatId) || [];
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
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});