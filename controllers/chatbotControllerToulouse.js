// handleChatbotMessage.js

import axios from 'axios';
import admin from '../config/firebase.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Gestion de l'ESM pour __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/******************************************************************/
/*                        SECTION CONFIGURATION                   */
/******************************************************************/
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4'; // ou "gpt-3.5-turbo", etc.

// -- Charge le JSON (en évitant l'import ESM pour le JSON) --
const dataToulousePath = path.join(__dirname, '../data-ia/dataToulouse.json');
let dataToulouse = {};
try {
    dataToulouse = JSON.parse(fs.readFileSync(dataToulousePath, 'utf-8'));
} catch (error) {
    console.error('Impossible de lire le fichier dataToulouse.json:', error.message);
}

/******************************************************************/
/*                        SECTION : LOGGING                       */
/******************************************************************/
const logToFirebase = async (message) => {
    try {
        const db = admin.database();
        const ref = db.ref('logs');
        await ref.push({
            message,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        console.log('Log enregistré dans Firebase:', message);
    } catch (error) {
        console.error(
            "Erreur lors de l'enregistrement du log dans Firebase:",
            error.message
        );
    }
};

/******************************************************************/
/*            SECTION : CONSTRUCTION DU MESSAGE SYSTEM            */
/******************************************************************/
const buildSystemMessage = () => {
    // On injecte la totalité du JSON dans le message système
    return {
        role: 'system',
        content: `
      Vous êtes un assistant intelligent spécialisé dans les informations contenues dans le fichier dataToulouse.json.
      Voici les données disponibles :

      ${JSON.stringify(dataToulouse, null, 2)}

      Utilisez ces informations pour répondre aux questions de l'utilisateur. 
      Si vous n'avez pas assez d'informations, indiquez-le poliment.
    `
    };
};

/******************************************************************/
/*             SECTION : FONCTION PRINCIPALE DU CHATBOT           */
/******************************************************************/
const handleChatbotMessage = async (req, res) => {
    const { message, previousMessages } = req.body;

    if (!message || typeof message !== 'string') {
        return res.status(400).json({
            error: 'Le champ "message" est requis et doit être une chaîne.'
        });
    }
    if (!Array.isArray(previousMessages)) {
        return res.status(400).json({
            error: 'Le champ "previousMessages" est requis et doit être un tableau.'
        });
    }

    try {
        await logToFirebase(`Message reçu du client: ${message}`);

        // On construit le système + l'historique des messages
        const systemMessage = buildSystemMessage();
        const messagesToSend = [
            systemMessage,
            ...previousMessages,
            { role: 'user', content: message }
        ];

        // Appel à OpenAI
        const responseOpenAI = await axios.post(
            OPENAI_API_ENDPOINT,
            {
                model: OPENAI_MODEL,
                messages: messagesToSend,
                max_tokens: 500,
                temperature: 0.7,
                top_p: 0.9
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        const botMessageContent = responseOpenAI.data.choices[0].message.content;

        // Log tokens si dispo
        if (responseOpenAI.data.usage) {
            const usage = responseOpenAI.data.usage;
            await logToFirebase(
                `Tokens utilisés: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`
            );
        }

        const botMessage = { role: 'assistant', content: botMessageContent };
        res.status(200).json({ messages: [...previousMessages, botMessage] });
        await logToFirebase(`Réponse envoyée au client: ${botMessage.content}`);
    } catch (error) {
        if (error.response) {
            await logToFirebase(
                `Erreur API OpenAI (status: ${error.response.status}): ${
                    error.response.data?.error?.message || error.response.statusText
                }`
            );
            return res
                .status(500)
                .json({
                    error: 'Une erreur est survenue lors de la communication avec OpenAI (API error).'
                });
        } else if (error.request) {
            await logToFirebase(
                `Erreur réseau lors de l'appel à OpenAI: ${error.message}`
            );
            return res
                .status(502)
                .json({
                    error: 'Une erreur réseau est survenue lors de la communication avec OpenAI.'
                });
        } else {
            await logToFirebase(`Erreur inattendue: ${error.message}`);
            return res.status(500).json({ error: 'Une erreur inattendue est survenue.' });
        }
    }
};

export default handleChatbotMessage;
