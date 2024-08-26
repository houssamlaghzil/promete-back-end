import axios from 'axios';
import admin from '../config/firebase-config.js';  // Importez Firebase admin initialisé

const logToFirebase = async (message) => {
    try {
        const db = admin.database();
        const ref = db.ref('logs');
        await ref.push({
            message: message,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        console.log('Log enregistré dans Firebase:', message);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du log dans Firebase:', error.message);
    }
};

const estimateTokens = async (message) => {
    try {
        await logToFirebase(`Estimation des tokens pour le message: ${message}`);
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: process.env.SYSTEM_ROLE_ESTIMATE || 'system',
                        content: process.env.SYSTEM_CONTENT_ESTIMATE || 'Please estimate the number of tokens.'
                    },
                    { role: 'user', content: message },
                ],
                max_tokens: 50,
                temperature: 0.0,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        const estimatedTokens = parseInt(response.data.choices[0].message.content.trim(), 10);
        logToFirebase(`Tokens estimés: ${estimatedTokens}`);
        return Math.min(Math.max(estimatedTokens, 30), 300);
    } catch (error) {
        logToFirebase(`Erreur lors de l'estimation des tokens: ${error.message}`);
        return 150;
    }
};

const handleChatbotMessage = async (req, res) => {
    const { message, previousMessages } = req.body;

    try {
        const estimatedTokens = await estimateTokens(message);
        logToFirebase(`Nombre de tokens estimé à utiliser: ${estimatedTokens}`);

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    ...previousMessages,
                    { role: 'user', content: message }
                ],
                max_tokens: estimatedTokens,
                temperature: 0.7,
                top_p: 0.9,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const botMessage = {
            role: 'assistant',
            content: response.data.choices[0].message.content,
        };

        res.status(200).json({ messages: [...previousMessages, botMessage] });
        logToFirebase(`Réponse envoyée au client: ${botMessage.content}`);
    } catch (error) {
        logToFirebase(`Erreur lors de la communication avec OpenAI: ${error.message}`);
        res.status(500).json({ error: 'Une erreur est survenue lors de la communication avec OpenAI.' });
    }
};

export default handleChatbotMessage;
