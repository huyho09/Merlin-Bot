let chatId = '';

document.getElementById('new-chat').addEventListener('click', async () => {
    const response = await fetch('http://localhost:5000/new-chat', { method: 'POST' });
    const data = await response.json();
    chatId = data.chatId;
    document.getElementById('chat-box').innerHTML = '';
});

document.getElementById('send').addEventListener('click', async () => {
    const userInput = document.getElementById('user-input').value;
    if (!userInput || !chatId) return;

    document.getElementById('chat-box').innerHTML += `<div class="message user-message">${userInput}</div>`;
    document.getElementById('user-input').value = '';

    const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: userInput }),
    });

    const data = await response.json();
    document.getElementById('chat-box').innerHTML += `<div class="message bot-message">${data.reply}</div>`;
});
