// handleChatbotMessage.js

import axios from 'axios';
import admin from '../config/firebase.js';
import dotenv from 'dotenv';
import extractTextFromPDF from './extractTextFromPDF.js';
import splitTextIntoChunks from './splitTextIntoChunks.js';
import { createIndex, searchIndex } from './indexAndSearch.js';
dotenv.config();

/******************************************************************/
/*                        SECTION CONFIGURATION                   */
/******************************************************************/
// Endpoint de l'API OpenAI
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Modèle de langage à utiliser
const OPENAI_MODEL = 'gpt-4'; // Utilisez le modèle approprié

// Chemin relatif vers le fichier PDF (par rapport à extractTextFromPDF.js)
const PDF_RELATIVE_PATH = './test/data/05-versions-space.pdf';

/******************************************************************/
/*                        SECTION : LOGGING                       */
/******************************************************************/
/**
 * Fonction pour loguer un message dans Firebase Realtime Database.
 * @param {string} message
 */
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

/******************************************************************/
/*                 SECTION : INITIALISATION DU PDF                */
/******************************************************************/
// Extraction, segmentation et indexation du PDF au démarrage
let index = [];

const initializePDFIndex = async () => {
    try {
        console.log(`Répertoire courant : ${__dirname}`); // Log ajouté
        const text = await extractTextFromPDF(PDF_RELATIVE_PATH);
        const chunks = splitTextIntoChunks(text);
        index = createIndex(chunks);
        console.log(`Index créé avec ${index.length} chunks.`);
        await logToFirebase(`Index créé avec ${index.length} chunks.`);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'index du PDF :', error.message);
        await logToFirebase(`Erreur lors de l'initialisation de l'index du PDF : ${error.message}`);
    }
};

// Initialiser l'index au démarrage
initializePDFIndex();

/******************************************************************/
/*               SECTION : CONSTRUCTION DES MESSAGES SYSTEM       */
/******************************************************************/
/**
 * Construit le message système incluant les informations pertinentes du PDF.
 * @param {string} relevantInfo - Informations pertinentes extraites du PDF.
 * @returns {Object} - Message système structuré.
 */
const buildSystemMessage = (relevantInfo) => {
    return {
        role: 'system',
        content: `
            Vous êtes un assistant intelligent spécialisé dans les informations contenues dans le document PDF fourni.
            Utilisez les informations suivantes pour répondre de manière précise et contextuelle à l'utilisateur :

            ${relevantInfo}

            Si les informations ne sont pas suffisantes pour répondre à la question, indiquez-le poliment.
        `
    };
};

/******************************************************************/
/*        SECTION : FONCTION PRINCIPALE handleChatbotMessage      */
/******************************************************************/
const handleChatbotMessage = async (req, res) => {
    const { message, previousMessages } = req.body;

    // Validation des entrées
    if (!message || typeof message !== 'string') {
        return res.status(400).json({
            error: 'Le champ "message" est requis et doit être une chaîne de caractères.'
        });
    }
    if (!Array.isArray(previousMessages)) {
        return res.status(400).json({
            error: 'Le champ "previousMessages" est requis et doit être un tableau.'
        });
    }

    try {
        await logToFirebase(`Message reçu du client: ${message}`);

        // Rechercher les informations pertinentes dans l'index
        const relevantInfo = searchIndex(message, index);
        await logToFirebase(`Informations pertinentes trouvées: ${relevantInfo ? 'Oui' : 'Non'}`);

        // Construire le message système avec les informations pertinentes
        const systemMessage = buildSystemMessage(relevantInfo);

        // Construire les messages à envoyer à l'API OpenAI
        const messagesToSend = [
            systemMessage,
            ...previousMessages,
            { role: 'user', content: message }
        ];

        // Appel à l'API OpenAI pour obtenir la réponse
        const responseOpenAI = await axios.post(
            OPENAI_API_ENDPOINT,
            {
                model: OPENAI_MODEL,
                messages: messagesToSend,
                max_tokens: 500, // Ajustez selon vos besoins et les limites de l'API
                temperature: 0.7,
                top_p: 0.9,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000, // 10 secondes
            }
        );

        const botMessageContent = responseOpenAI.data.choices[0].message.content;

        if (responseOpenAI.data.usage) {
            const usage = responseOpenAI.data.usage;
            await logToFirebase(
                `Tokens utilisés: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`
            );
        }

        const botMessage = {
            role: 'assistant',
            content: botMessageContent,
        };

        res.status(200).json({ messages: [...previousMessages, botMessage] });
        await logToFirebase(`Réponse envoyée au client: ${botMessage.content}`);

    } catch (error) {
        if (error.response) {
            // Erreur liée à la réponse de l'API OpenAI
            await logToFirebase(`Erreur API OpenAI (status: ${error.response.status}): ${error.response.data?.error?.message || error.response.statusText}`);
            return res.status(500).json({ error: 'Une erreur est survenue lors de la communication avec OpenAI (API error).' });
        } else if (error.request) {
            // Erreur liée à la requête
            await logToFirebase(`Erreur réseau lors de l'appel à OpenAI: ${error.message}`);
            return res.status(502).json({ error: 'Une erreur réseau est survenue lors de la communication avec OpenAI.' });
        } else {
            // Autres erreurs
            await logToFirebase(`Erreur inattendue: ${error.message}`);
            return res.status(500).json({ error: 'Une erreur inattendue est survenue.' });
        }
    }
};

export default handleChatbotMessage;
