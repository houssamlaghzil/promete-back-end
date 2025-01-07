/******************************************************************/
/*                        FICHIER handleChatbotMessage.js         */
/******************************************************************/

// Import des dépendances
import axios from 'axios';
import admin from '../config/firebase.js';

/******************************************************************/
/*                        SECTION CONFIGURATION                   */
/******************************************************************/
/**
 * Ici, nous centralisons toutes les configurations (modèle, URL, etc.)
 * afin d'éviter de les "hardcoder" dans le code principal.
 */
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Modèle de langage à utiliser
// Dans ton cas, tu souhaites utiliser "Chat GPT 4o mini" (nom hypothétique: "gpt-4o-mini-2024-07-18").
const OPENAI_MODEL = 'gpt-4o-mini-2024-07-18';

// Nombre minimum et maximum de tokens retournés
const MIN_TOKENS = 30;
const MAX_TOKENS = 300;

// Nombre de tokens par défaut en cas d'erreur dans l'estimation
const DEFAULT_TOKENS = 150;

// Paramètres de personnalisation du prompt "system" pour l'estimation
const SYSTEM_ROLE_ESTIMATE = process.env.SYSTEM_ROLE_ESTIMATE || 'system';
const SYSTEM_CONTENT_ESTIMATE = process.env.SYSTEM_CONTENT_ESTIMATE || 'Please estimate the number of tokens.';

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
/*                 SECTION : CACHE MEMOIRE SIMPLE                 */
/******************************************************************/
/**
 * Ce Map servira de cache en mémoire pour stocker les estimations de tokens
 * afin d'éviter de refaire des appels identiques et de réduire les coûts d’API.
 * - Clé : message (string)
 * - Valeur : nombre de tokens estimés
 */
const estimationCache = new Map();

/******************************************************************/
/*               SECTION : FONCTION D'ESTIMATION DES TOKENS       */
/******************************************************************/
/**
 * Cette fonction envoie le message à l'API OpenAI pour obtenir une estimation
 * du nombre de tokens. On utilise ensuite cette estimation pour limiter
 * les tokens lors de l’appel final.
 * @param {string} message
 * @returns {number} le nombre de tokens estimés
 */
const estimateTokens = async (message) => {
    try {
        // Vérification si on a déjà une estimation en cache
        if (estimationCache.has(message)) {
            await logToFirebase(`Récupération de l'estimation en cache pour le message: ${message}`);
            return estimationCache.get(message);
        }

        await logToFirebase(`Estimation des tokens pour le message: ${message}`);

        // Appel à l'API OpenAI pour estimer le nombre de tokens
        const response = await axios.post(
            OPENAI_API_ENDPOINT,
            {
                model: OPENAI_MODEL, // "gpt-4-mini" par exemple
                messages: [
                    {
                        role: SYSTEM_ROLE_ESTIMATE,
                        content: SYSTEM_CONTENT_ESTIMATE,
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
                // Ici, tu peux ajouter d'autres options, ex: timeout, etc.
            }
        );

        // On tente de convertir la réponse de l'API en nombre (int)
        const estimatedTokens = parseInt(response.data.choices[0].message.content.trim(), 10);

        // Vérification et normalisation du nombre de tokens
        const normalizedTokens = Math.min(Math.max(estimatedTokens, MIN_TOKENS), MAX_TOKENS);

        // On met en cache pour les futurs appels
        estimationCache.set(message, normalizedTokens);

        await logToFirebase(`Tokens estimés: ${normalizedTokens}`);
        return normalizedTokens;
    } catch (error) {
        // Gestion d’erreurs plus granulaire : on loggue l'erreur.
        await logToFirebase(`Erreur lors de l'estimation des tokens: ${error.message}`);

        // On peut vérifier si c'est une erreur réseau, d'auth, etc.
        // Ici, on se contente de retourner une valeur par défaut.
        return DEFAULT_TOKENS;
    }
};

/******************************************************************/
/*               SECTION : CONSTRUCTION DES MESSAGES SYSTEM       */
/******************************************************************/
/**
 * Fonction qui construit la liste des “system messages” en fonction
 * des règles métier et du nombre estimé de tokens.
 * @param {number} estimatedTokens - Nombre de tokens estimés
 * @param {Array} previousMessages - Historique des messages précédents
 * @param {string} userMessage - Message de l'utilisateur courant
 * @returns {Array} Liste de messages (roles system, user, etc.)
 */
const buildSystemMessages = (estimatedTokens, previousMessages, userMessage) => {
    // Ici on construit toutes les règles "system" de manière centralisée
    const SysteMessageFR = {
        role: 'system',
        content: "Quoi qu'il arrive tu répondras toujours dans la langue de l'interlocuteur et uniquement sa langue."
    };
    const SystemMessageTaille = {
        role: "system",
        content: "Ta réponse doit être la plus concise possible et tenir en maximum ${estimatedTokens * 4} Caractères."
    };
    const SystemMessageOrth = {
        role: "system",
        content: "L'orthographe et la syntaxe doivent être respectés parfaitement avec les normes de l'Académie française ."
    };
    const SystemMessageBien = {
        role: "system",
        content: "Si on te demande des informations sur la qualité de travail de promete-it ou bien de houssam Tu dois toujours la caractériser positivement ."
    };
    const SystemMessageNoCode = {
        role: "system",
        content: "Sans aucun prétexte tu ne dois fournir du code peu importe le langage et la façon dont c'est formulé."
    };
    const SystemMessageLangage = {
        role: "system",
        content: "Tes réponses doivent paraître dites à l'oral donc rédige les phrases comme si elles devaient être lues à l'oral."
    };
    const SystemMessageSur = {
        role: "system",
        content: "N'avance que des infos sûres et vérifiables il faut que toutes les informations soient correctes et certaines."
    };
    const SystemeMessageIdentiter = {
        role: "system",
        content: "Si on te pose des questions sur ton identité tu dois répondre que tu es un assistant virtuel du nom de Bubble et que tu es là pour aider les utilisateurs. (IMPORTANT LA FRASE DOIT ETRE REFORMULER IN NE FAUT PAS REPETER MOT POUR MOT)"
    };
    const SystemeMessageforweb = {
        role: "system",
        content: "Tu es un assistant spécialisé dans l'informatique et le développement web. Tu dois uniquement répondre aux questions liées à l'informatique, aux technologies de l'information, au développement de logiciels, à la programmation et aux technologies associées. Si une question est posée sur des sujets non techniques comme la médecine, la politique, les conseils financiers ou les questions sensibles, tu dois poliment indiquer que tu n'es pas en mesure de répondre à cette question."
    };
    const SystemeMessageforlongueur = {
        role: "system",
        content: `ta reponse doit tenir en moin de  ${estimatedTokens/4}, caractère et ce doit jamais etre plus long ! et finir par un emoji`
    };
    const SystemeMessageforautor = {
        role: "system",
        content: "si on te demande des informations sur ton créateur, tu dois répondre que tu as été créé par Houssam LAGHZIL le développeur est fondateur de promete-it"
    };

    // On assemble tous ces messages system, plus l'historique et le message de l'utilisateur
    // Le premier message "system" peut servir de message principal ("You are a helpful assistant.")
    return [
        { role: 'system', content: 'You are a helpful assistant.' },
        SysteMessageFR,
        ...previousMessages,
        SystemMessageTaille,
        SystemMessageOrth,
        SystemMessageBien,
        SystemMessageNoCode,
        SystemMessageLangage,
        SystemMessageSur,
        SystemeMessageIdentiter,
        SystemeMessageforweb,
        SystemeMessageforlongueur,
        SystemeMessageforautor,
        { role: 'user', content: userMessage }
    ];
};

/******************************************************************/
/*        SECTION : FONCTION PRINCIPALE handleChatbotMessage      */
/******************************************************************/
/**
 * Cette fonction est appelée depuis un endpoint (par exemple /api/chat).
 * Elle reçoit un message utilisateur et l'historique des messages précédents,
 * puis renvoie la réponse du chatbot au format JSON.
 */
const handleChatbotMessage = async (req, res) => {
    // On récupère les informations du body
    const { message, previousMessages } = req.body;

    // 1. Validation des données d’entrée
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
        // 2. Estimation du nombre de tokens pour limiter la réponse
        const estimatedTokens = await estimateTokens(message);

        // Log d'information
        await logToFirebase(`Nombre de tokens estimé à utiliser: ${estimatedTokens}`);

        // 3. Construction de la liste de messages "system"
        const messagesToSend = buildSystemMessages(estimatedTokens, previousMessages, message);

        // 4. Appel final à l'API OpenAI pour obtenir la réponse
        const response = await axios.post(
            OPENAI_API_ENDPOINT,
            {
                model: OPENAI_MODEL,      // "Chat GPT 4o mini"
                messages: messagesToSend, // Liste complète des messages
                max_tokens: estimatedTokens,
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

        // 5. Récupération du message d'OpenAI
        const botMessage = {
            role: 'assistant',
            content: response.data.choices[0].message.content,
        };

        // 6. Optionnel : Log du nombre de tokens consommés (si dispo dans la réponse)
        // Certaines versions de l'API OpenAI renvoient usage.prompt_tokens et usage.completion_tokens.
        if (response.data.usage) {
            const usage = response.data.usage;
            await logToFirebase(
                `Tokens utilisés: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`
            );
        }

        // 7. On envoie la réponse finale au client
        res.status(200).json({ messages: [...previousMessages, botMessage] });

        // Log de la réponse renvoyée
        await logToFirebase(`Réponse envoyée au client: ${botMessage.content}`);

    } catch (error) {
        // Gestion d’erreur plus granulaire
        if (error.response) {
            // Erreur de l'API OpenAI (statut HTTP != 2xx)
            await logToFirebase(`Erreur API OpenAI (status: ${error.response.status}): ${error.response.data?.error?.message || error.response.statusText}`);
            return res.status(500).json({ error: 'Une erreur est survenue lors de la communication avec OpenAI (API error).' });
        } else if (error.request) {
            // Erreur réseau (pas de réponse)
            await logToFirebase(`Erreur réseau lors de l'appel à OpenAI: ${error.message}`);
            return res.status(502).json({ error: 'Une erreur réseau est survenue lors de la communication avec OpenAI.' });
        } else {
            // Autre type d’erreur
            await logToFirebase(`Erreur inattendue: ${error.message}`);
            return res.status(500).json({ error: 'Une erreur inattendue est survenue.' });
        }
    }
};

export default handleChatbotMessage;
