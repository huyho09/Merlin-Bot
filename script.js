let chatHistory = [];
const messageInput = document.getElementById('message-input');
const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = messageInput.value;
  if (!message) return;
  chatHistory.push({ sender: 'user', content: message });
  displayMessage('user', message);
  messageInput.value = '';
  try {
    const response = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: chatHistory }),
    });
    const data = await response.json();
    const assistantMessage = data.message;
    chatHistory.push({ sender: 'assistant', content: assistantMessage });
    displayMessage('assistant', assistantMessage);
  } catch (error) {
    console.error(error);
  }
});

function displayMessage(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', sender);
  messageElement.innerHTML = `<p>${message}</p>`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

const newChatButton = document.getElementById('new-chat-button');
newChatButton.addEventListener('click', () => {
  chatHistory = [];
  chatMessages.innerHTML = '';
});