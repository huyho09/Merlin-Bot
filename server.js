const path = require('path');
require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const { default: OpenAI } = require('openai');

const app = express();

const openai = new OpenAI({
    apiKey: "OPENAI_API_KEY"
});


app.use(express.json());
app.use(express.static(__dirname));

app.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        const response = await openai.createChatCompletion({
            model: 'gpt-4o',
            messages,
        });
        const assistantMessage = response.data.choices[0].message.content;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(200).json({ message: assistantMessage });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});