const express = require('express');
const { Configuration, OpenAIApi } = require('openai');

const app = express();

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

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