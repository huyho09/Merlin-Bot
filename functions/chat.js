require('dotenv').config({ path: __dirname + '/.env' });
const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

exports.handler = async (event) => {
    try {
        const { messages } = JSON.parse(event.body);
        const response = await openai.createChatCompletion({
            model: 'gpt-4o',
            messages,
        });
        const assistantMessage = response.data.choices[0].message.content;
        return {
            statusCode: 200,
            body: JSON.stringify({ message: assistantMessage }),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        };
    }
};