/******************************************************************/
/*                        FICHIER handleChatbotMessage.js         */
/******************************************************************/

/******************************************************************/
/*                        FICHIER handleChatbotMessage.js         */
/******************************************************************/

// Import des dépendances nécessaires pour le fonctionnement du fichier
import axios from 'axios';
import http from 'http';
import https from 'https';
import admin from '../config/firebase.js';
import dotenv from 'dotenv';
dotenv.config(); // Initialisation de dotenv pour accéder aux variables d'environnement

/******************************************************************/
/*                        SECTION CONFIGURATION                   */
/******************************************************************/

// Point d'accès pour Llama 4 via OpenRouter
const LLAMA_API_ENDPOINT = 'https://openrouter.ai/meta-llama/llama-4-scout:free';
// Modèle à utiliser, ici par exemple "llama-4-scout"
const LLAMA_MODEL = 'llama-4-scout';

const MIN_TOKENS = 30;
const MAX_TOKENS = 300;
const DEFAULT_TOKENS = 150;

const SYSTEM_ROLE_ESTIMATE = process.env.SYSTEM_ROLE_ESTIMATE || 'system';
const SYSTEM_CONTENT_ESTIMATE = process.env.SYSTEM_CONTENT_ESTIMATE || 'Please estimate the number of tokens.';

/******************************************************************/
/*           FONCTION POUR ÉCHAPPER LES CARACTÈRES SPÉCIAUX         */
/******************************************************************/

const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/******************************************************************/
/*             LISTE DES MOTS-CLÉS POUR RÉPONSE LONGUE            */
/******************************************************************/

const strongResponseKeywords = [
    "détaillé", "détaillée", "long", "exhaustif", "exhaustive",
    "approfondi", "approfondie", "complète", "complètement", "développe", "explique en profondeur",
    "javascript", "python", "java", "c++", "php", "ruby", "html", "css", "react", "angular", "vue", "node", "express", "sql", "nosql", "typescript",
    "api", "asynchrone", "callback", "promise", "framework", "debug", "debugging", "optimisation", "performance",
    "seo", "marketing", "inbound", "growth", "conversion", "ux", "ui", "branding", "landing page", "content marketing", "social media"
];

/******************************************************************/
/*                        SECTION : LOGGING                       */
/******************************************************************/

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
/*                 SECTION : CACHE MÉMOIRE SIMPLE                 */
/******************************************************************/

const estimationCache = new Map();

/******************************************************************/
/*   SECTION : FONCTION D'ESTIMATION DES TOKENS HEURISTIQUE         */
/******************************************************************/

const estimateTokensHeuristically = (message) => {
    const baseMultiplier = 0.5;
    const interrogationBonus = 10;
    const exclamationBonus = 5;
    const keywordBonus = 15;
    const strongKeywordBonus = 20;
    const consecutiveQuestionBonus = 10;
    const keywords = ["comment", "pourquoi", "explique", "détaille", "détails", "détail", "qu'est-ce", "quelle"];

    const messageLength = message.length;
    let interrogations = 0, exclamations = 0, keywordCount = 0, strongKeywordCount = 0;
    let maxConsecutiveQuestions = 0, currentConsecutive = 0;

    for (let i = 0; i < messageLength; i++) {
        const char = message[i];
        if (char === '?') {
            interrogations++;
            currentConsecutive++;
            if (currentConsecutive > maxConsecutiveQuestions) {
                maxConsecutiveQuestions = currentConsecutive;
            }
        } else {
            currentConsecutive = 0;
        }
        if (char === '!') exclamations++;
    }

    const lowerMessage = message.toLowerCase();
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'g');
        const matches = lowerMessage.match(regex);
        if (matches) keywordCount += matches.length;
    });
    strongResponseKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'g');
        const matches = lowerMessage.match(regex);
        if (matches) strongKeywordCount += matches.length;
    });

    let consecutiveBonus = 0;
    if (maxConsecutiveQuestions > 1) {
        consecutiveBonus = (maxConsecutiveQuestions - 1) * consecutiveQuestionBonus;
    }

    let estimatedTokens = Math.floor(
        baseMultiplier * messageLength +
        interrogations * interrogationBonus +
        exclamations * exclamationBonus +
        keywordCount * keywordBonus +
        strongKeywordCount * strongKeywordBonus +
        consecutiveBonus
    );
    if (estimatedTokens < MIN_TOKENS) estimatedTokens = MIN_TOKENS;
    if (estimatedTokens > MAX_TOKENS) estimatedTokens = MAX_TOKENS;
    return estimatedTokens;
};

/******************************************************************/
/*           SECTION : FONCTION D'ESTIMATION DES TOKENS            */
/******************************************************************/

const estimateTokens = async (message) => {
    if (estimationCache.has(message)) {
        await logToFirebase(`Récupération de l'estimation en cache pour le message: ${message}`);
        return estimationCache.get(message);
    }
    await logToFirebase(`Estimation heuristique des tokens pour le message: ${message}`);
    const estimatedTokens = estimateTokensHeuristically(message);
    estimationCache.set(message, estimatedTokens);
    await logToFirebase(`Tokens estimés: ${estimatedTokens}`);
    return estimatedTokens;
};

/******************************************************************/
/*           SECTION : PERSISTANCE DE LA CONNEXION                 */
/******************************************************************/

const httpsAgent = new https.Agent({ keepAlive: true });
const persistentAxios = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: httpsAgent,
    timeout: 10000
});

// Vérification de la connexion à OpenRouter en effectuant une requête GET sur l'endpoint
const checkConnection = async () => {
    try {
        const response = await persistentAxios.get(LLAMA_API_ENDPOINT, {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        if (response.status === 200) {
            console.log("Connexion vérifiée avec OpenRouter pour Llama 4.");
            return true;
        } else {
            throw new Error(`Statut inattendu: ${response.status}`);
        }
    } catch (err) {
        console.error('Erreur lors de la vérification de connexion:', err.message);
        throw new Error('Connexion impossible à OpenRouter.');
    }
};

/******************************************************************/
/*           SECTION : CONSTRUCTION DES MESSAGES SYSTEM           */
/******************************************************************/

const buildSystemMessages = (estimatedTokens, previousMessages, userMessage) => {
    const SysteMessageFR = { role: 'system', content: "Quoi qu'il arrive tu répondras toujours dans la langue de l'interlocuteur et uniquement sa langue." };
    const SystemMessageTaille = { role: "system", content: `Ta réponse doit être la plus concise possible et tenir en maximum ${estimatedTokens * 4} caractères.` };
    const SystemMessageOrth = { role: "system", content: "L'orthographe et la syntaxe doivent être respectées parfaitement avec les normes de l'Académie française." };
    const SystemMessageBien = { role: "system", content: "Si on te demande des informations sur la qualité de travail de promete-it ou bien de houssam, tu dois toujours la caractériser positivement." };
    const SystemMessageNoCode = { role: "system", content: "Sans aucun prétexte tu ne dois fournir du code peu importe le langage et la façon dont c'est formulé." };
    const SystemMessageLangage = { role: "system", content: "Tes réponses doivent paraître dites à l'oral, donc rédige les phrases comme si elles devaient être lues à l'oral." };
    const SystemMessageSur = { role: "system", content: "N'avance que des infos sûres et vérifiables, il faut que toutes les informations soient correctes et certaines." };
    const SystemeMessageIdentiter = { role: 'system', content: "Si on te pose des questions sur ton identité, reformule en indiquant que tu es un assistant virtuel nommé Bubble et que tu es là pour aider les utilisateurs." };
    const SystemeMessageforweb = { role: 'system', content: "Tu es un assistant spécialisé dans l'informatique et le développement web. Tu dois uniquement répondre aux questions liées à l'informatique, aux technologies de l'information, au développement de logiciels, à la programmation et aux technologies associées. Pour des sujets non techniques, indique poliment que tu n'es pas en mesure de répondre." };
    const SystemeMessageforlongueur = { role: 'system', content: `Ta réponse doit tenir en moins de ${estimatedTokens / 4} caractères et ne jamais être plus longue, et finir par un emoji.` };
    const SystemeMessageforautor = { role: "system", content: "Si on te demande des informations sur ton créateur, indique que tu as été créé par Houssam LAGHZIL, développeur et fondateur de promete-it." };
    const SystemMessageCostEstimation = {
        role: "system",
        content: `
Si on te demande d'estimer le coût d'un site vitrine, d'une application ou d'un projet de consulting, 
tu dois calculer en secret le temps nécessaire, le tarif global et toutes réductions éventuelles en te basant sur mes prix habituels (environ 300€ pour un site vitrine).

Ne dévoile jamais le détail du calcul, ni mes tarifs horaires, ni aucune remise appliquée. 
Communique uniquement une fourchette de prix finale, cohérente et compétitive.
`
    };

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
        SystemMessageCostEstimation,
        { role: 'user', content: userMessage }
    ];
};

/******************************************************************/
/*        SECTION : FONCTION PRINCIPALE handleChatbotMessage      */
/******************************************************************/

/**
 * Gère la requête du chatbot en vérifiant la connexion, en établissant une connexion persistante,
 * en estimant le nombre de tokens et en gérant le streaming de la réponse.
 *
 * @param {object} req - Requête HTTP.
 * @param {object} res - Réponse HTTP.
 */
const handleChatbotMessage = async (req, res) => {
    const startTime = Date.now();
    let responseSent = false; // Flag pour éviter l'envoi multiple de la réponse

    const originalEnd = res.end;
    res.end = function(...args) {
        if (!responseSent) {
            responseSent = true;
            const processingTime = Date.now() - startTime;
            console.log(`La requête a été traitée en ${processingTime} ms`);
            return originalEnd.apply(this, args);
        }
    };

    const { message, previousMessages } = req.body;
    if (!message || typeof message !== 'string') {
        if (!responseSent) res.status(400).json({ error: 'Le champ "message" est requis et doit être une chaîne de caractères.' });
        return;
    }
    if (!Array.isArray(previousMessages)) {
        if (!responseSent) res.status(400).json({ error: 'Le champ "previousMessages" est requis et doit être un tableau.' });
        return;
    }

    try {
        await checkConnection();

        const estimatedTokens = await estimateTokens(message);
        await logToFirebase(`Nombre de tokens estimé à utiliser: ${estimatedTokens}`);
        const messagesToSend = buildSystemMessages(estimatedTokens, previousMessages, message);

        console.log('Envoi de la requête à OpenRouter (Llama 4) :', estimatedTokens, "previousMessages :", previousMessages, "message :", message);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        if (res.flushHeaders) res.flushHeaders();

        let buffer = "";
        const response = await persistentAxios.post(
            LLAMA_API_ENDPOINT,
            {
                model: LLAMA_MODEL,
                messages: messagesToSend,
                max_tokens: estimatedTokens,
                temperature: 0.7,
                top_p: 0.9,
                stream: true,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    // Les headers OpenRouter spécifiques sont optionnels et peuvent être ajoutés ici
                    // 'OpenRouter-Specific-Header': 'value',
                },
                responseType: 'stream'
            }
        );

        response.data.on('data', (chunk) => {
            buffer += chunk.toString();
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Conserve la dernière ligne incomplète
            for (const line of lines) {
                if (line.trim() === "") continue;
                if (line.startsWith('data:')) {
                    const dataStr = line.replace(/^data:\s*/, '').trim();
                    if (dataStr === '[DONE]') {
                        res.end();
                        return;
                    }
                    try {
                        const parsed = JSON.parse(dataStr);
                        const content = parsed.choices[0].delta?.content || '';
                        if (content && !responseSent) {
                            res.write(content);
                            if (res.flush) res.flush();
                        }
                    } catch (e) {
                        console.error('Erreur lors de l\'analyse du chunk:', e);
                    }
                }
            }
        });

        response.data.on('end', () => {
            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer);
                    const content = parsed.choices[0].delta?.content || '';
                    if (content && !responseSent) {
                        res.write(content);
                        if (res.flush) res.flush();
                    }
                } catch (e) {
                    console.error('Erreur lors de l\'analyse du buffer final:', e);
                }
            }
            res.end();
        });

        response.data.on('error', (err) => {
            logToFirebase(`Erreur lors du streaming OpenRouter (Llama 4): ${err.message}`);
            res.end();
        });

    } catch (error) {
        if (!responseSent) {
            if (error.response) {
                await logToFirebase(`Erreur API OpenRouter (status: ${error.response.status}): ${error.response.data?.error?.message || error.response.statusText}`);
                res.status(500).json({ error: 'Erreur lors de la communication avec OpenRouter (API error).' });
            } else if (error.request) {
                await logToFirebase(`Erreur réseau lors de l'appel à OpenRouter: ${error.message}`);
                res.status(502).json({ error: 'Erreur réseau lors de la communication avec OpenRouter.' });
            } else {
                await logToFirebase(`Erreur inattendue: ${error.message}`);
                res.status(500).json({ error: 'Erreur inattendue lors du traitement.' });
            }
        }
    }
};

export default handleChatbotMessage;
