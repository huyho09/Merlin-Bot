const chatMessagesDiv = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const chatForm = document.getElementById('chat-form');
const newChatButton = document.getElementById('new-chat-button');

let history = [];

let API_URL;
if (window.location.host === 'localhost:3000') {
    API_URL = '/chat';
} else {
    API_URL = '/.netlify/functions/chat';
}

function displayMessage(message, role) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role.toLowerCase());
    messageDiv.innerHTML = `<strong>${role}:</strong> ${message}`;
    chatMessagesDiv.appendChild(messageDiv);
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value;
    if (!message) return;
    history.push({ role: 'user', content: message });
    displayMessage(message, 'User');
    userInput.value = '';
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: history }),
        });
        const data = await response.json();
        if (response.ok) {
            const assistantMessage = data.message;
            history.push({ role: 'assistant', content: assistantMessage });
            displayMessage(assistantMessage, 'Assistant');
        } else {
            console.error('Error:', data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

newChatButton.addEventListener('click', () => {
    history = [];
    chatMessagesDiv.innerHTML = '';
});