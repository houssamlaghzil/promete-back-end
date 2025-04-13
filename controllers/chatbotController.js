/******************************************************************/
/*                        FICHIER handleChatbotMessage.js         */
/******************************************************************/

import axios from 'axios';
import http from 'http';
import https from 'https';
import admin from '../config/firebase.js';
import dotenv from 'dotenv';
import Together from "together-ai"; // Pour la génération d'images via Together
dotenv.config(); // Chargement des variables d'environnement

/******************************************************************/
/*                        SECTION CONFIGURATION                   */
/******************************************************************/

// Endpoint chat d'OpenRouter pour Llama 4 Scout (free)
const LLAMA_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const LLAMA_MODEL = 'meta-llama/llama-4-scout';

const MIN_TOKENS = 30;
const MAX_TOKENS = 300;
const DEFAULT_TOKENS = 150;

const SYSTEM_ROLE_ESTIMATE = process.env.SYSTEM_ROLE_ESTIMATE || 'system';
const SYSTEM_CONTENT_ESTIMATE = process.env.SYSTEM_CONTENT_ESTIMATE || 'Please estimate the number of tokens.';

/******************************************************************/
/*      FONCTION POUR ÉCHAPPER LES CARACTÈRES SPÉCIAUX             */
/******************************************************************/

const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/******************************************************************/
/*           LISTE DES MOTS-CLÉS POUR RÉPONSE LONGUE              */
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
/*                SECTION : CACHE MÉMOIRE SIMPLE                  */
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
/*  SECTION : FILTRAGE DES PREVIOUS MESSAGES (pour alléger le payload)  */
/******************************************************************/

const filterPreviousMessages = (messages) => {
    return messages.map(msg => {
        if (msg.content && (msg.content.startsWith("/9j/") || msg.content.startsWith("iVBOR"))) {
            return { role: msg.role, content: "[Image générée]" };
        }
        return msg;
    });
};

/******************************************************************/
/*        SECTION : CONFIGURATION DE LA CONNEXION PERSISTANTE       */
/******************************************************************/

const httpsAgent = new https.Agent({ keepAlive: true });
const persistentAxios = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: httpsAgent,
    timeout: 10000
});

/******************************************************************/
/*   SECTION : FONCTION DE CLASSIFICATION DU PROMPT (IA)           */
/******************************************************************/

const classifyPrompt = async (prompt) => {
    try {
        const classificationPayload = {
            model: LLAMA_MODEL,
            messages: [
                {
                    role: "system",
                    content: "Classifie le prompt suivant par 'image' si la demande concerne la génération d'une image à partir du texte, sinon par 'texte'. Répond uniquement par 'image' ou 'texte'."
                },
                { role: "user", content: prompt }
            ],
            max_tokens: 5,
            temperature: 0,
            stream: false,
        };

        const resClassif = await persistentAxios.post(
            LLAMA_API_ENDPOINT,
            classificationPayload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Bubble/1.0'
                }
            }
        );

        const choices = resClassif?.data?.choices;
        if (!choices || !Array.isArray(choices) || choices.length === 0) {
            console.error("Réponse de classification invalide.");
            return "texte";
        }
        const rawClassification = choices[0].message?.content || "";
        const result = rawClassification.trim().toLowerCase();
        console.log("Classification du prompt :", result);
        return result === "image" ? "image" : "texte";
    } catch (err) {
        console.error("Erreur lors de la classification du prompt:", err.message);
        return "texte";
    }
};

/******************************************************************/
/*  SECTION : AMÉLIORATION DU PROMPT POUR LA GÉNÉRATION D'IMAGES     */
/******************************************************************/

const improveImagePrompt = async (originalPrompt, previousMessages) => {
    try {
        const context = previousMessages.map(m => m.content).join(" ");
        const improvementPayload = {
            model: LLAMA_MODEL,
            messages: [
                {
                    role: "system",
                    content: "Améliore le prompt suivant pour maximiser le potentiel de génération d'image. Prends en compte le contexte fourni et reformule le prompt de manière plus descriptive, détaillée et optimisée. Répond uniquement par le nouveau prompt, sans explication."
                },
                { role: "assistant", content: context },
                { role: "user", content: `Prompt original : ${originalPrompt}` }
            ],
            max_tokens: 100,
            temperature: 0.7,
            stream: false,
        };

        const resImproved = await persistentAxios.post(
            LLAMA_API_ENDPOINT,
            improvementPayload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Bubble/1.0'
                }
            }
        );
        const improvedChoices = resImproved.data?.choices;
        if (!improvedChoices || !Array.isArray(improvedChoices) || improvedChoices.length === 0) {
            console.error("Réponse d'amélioration du prompt invalide.");
            return originalPrompt;
        }
        const refinedPrompt = improvedChoices[0].message?.content?.trim();
        if (!refinedPrompt) {
            console.error("Prompt amélioré vide ou non trouvé, on utilise le prompt original.");
            return originalPrompt;
        }
        console.log("Prompt amélioré :", refinedPrompt);
        return refinedPrompt;
    } catch (error) {
        console.error("Erreur lors de l'amélioration du prompt:", error.message);
        return originalPrompt;
    }
};

/******************************************************************/
/*    SECTION : VÉRIFICATION DE LA CONNEXION AVEC OPENROUTER         */
/******************************************************************/

const checkConnection = async () => {
    try {
        const testPayload = {
            model: LLAMA_MODEL,
            messages: [{ role: 'system', content: 'ping' }],
            max_tokens: 1,
            stream: false,
        };
        const response = await persistentAxios.post(
            LLAMA_API_ENDPOINT,
            testPayload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Bubble/1.0'
                }
            }
        );
        if (response.status === 200) {
            console.log("Connexion vérifiée avec OpenRouter.");
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
/*    SECTION : FONCTION PRINCIPALE handleChatbotMessage            */
/******************************************************************/

const handleChatbotMessage = async (req, res) => {
    const startTime = Date.now();
    let responseSent = false;
    const originalEnd = res.end;
    res.end = function (...args) {
        if (!responseSent) {
            responseSent = true;
            const processingTime = Date.now() - startTime;
            console.log(`La requête a été traitée en ${processingTime} ms`);
            return originalEnd.apply(this, args);
        }
    };

    const { message, previousMessages } = req.body;
    if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Le champ "message" est requis et doit être une chaîne de caractères.' });
        return;
    }
    if (!Array.isArray(previousMessages)) {
        res.status(400).json({ error: 'Le champ "previousMessages" est requis et doit être un tableau.' });
        return;
    }

    // Étape 1 : Classification du prompt pour déterminer s'il s'agit d'une demande d'image ou de texte
    const promptType = await classifyPrompt(message);
    console.log("Type de prompt détecté:", promptType);

    if (promptType === "image") {
        // Pour les demandes d'image, on améliore d'abord le prompt en utilisant le contexte.
        const filteredMessages = filterPreviousMessages(previousMessages);
        const improvedPrompt = await improveImagePrompt(message, filteredMessages);
        console.log("Prompt utilisé pour la génération d'image :", improvedPrompt);

        // Vérifier la clé Together
        const togetherApiKey = process.env.TOGETHER_API_KEY;
        if (!togetherApiKey) {
            console.error("La variable TOGETHER_API_KEY est absente ou vide.");
            res.status(500).json({ error: "Configuration error: missing Together API key" });
            return;
        }
        const together = new Together({ apiKey: togetherApiKey });
        const width = req.body.imageParams?.width || 1024;
        const height = req.body.imageParams?.height || 768;
        const steps = req.body.imageParams?.steps ? Math.min(req.body.imageParams.steps, 4) : 4;
        const n = req.body.imageParams?.n || 1;
        const response_format = req.body.imageParams?.response_format || "b64_json";
        const stop = req.body.imageParams?.stop || [];
        try {
            const imageResponse = await together.images.create({
                model: req.body.imageParams?.model || "black-forest-labs/FLUX.1-schnell-Free",
                prompt: improvedPrompt,
                width,
                height,
                steps,
                n,
                response_format,
                stop,
            });
            const imageData = imageResponse.data[0].b64_json;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.write(imageData);
            res.end();
            return;
        } catch (error) {
            console.error("Erreur lors de la génération d'image via Together:", error);
            res.status(500).json({ error: "Erreur lors de la génération de l'image via Together." });
            return;
        }
    }

    // Pour les demandes textuelles (ou autres)
    const filteredPreviousMessages = filterPreviousMessages(previousMessages);
    try {
        await checkConnection();

        const estimatedTokens = await estimateTokens(message);
        await logToFirebase(`Nombre de tokens estimé à utiliser: ${estimatedTokens}`);
        const messagesToSend = buildSystemMessages(estimatedTokens, filteredPreviousMessages, message);
        console.log('Envoi de la requête à OpenRouter (Llama 4 Scout) :', estimatedTokens, "previousMessages :", filteredPreviousMessages, "message :", message);

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        if (res.flushHeaders) res.flushHeaders();

        const response = await persistentAxios.post(
            LLAMA_API_ENDPOINT,
            {
                model: LLAMA_MODEL,
                messages: messagesToSend,
                max_tokens: estimatedTokens,
                temperature: 0.7,
                top_p: 0.9,
                stream: false,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'User-Agent': 'Bubble/1.0'
                }
            }
        );

        const contentType = response.headers['content-type'];
        if (contentType && contentType.includes('text/html')) {
            console.error("Réponse HTML inattendue :", contentType);
            console.error("Extrait de la réponse :", response.data.substring(0, 200));
            res.write("Désolé, une erreur est survenue lors de la communication avec OpenRouter.");
            res.end();
            return;
        }

        const jsonResponse = response.data;
        let content = "";
        if (jsonResponse && jsonResponse.choices && jsonResponse.choices.length > 0) {
            content = jsonResponse.choices[0].message?.content || jsonResponse.choices[0].delta?.content || "";
        }
        if (!content) {
            content = "Désolé, je n'ai pas de réponse à t'apporter pour le moment. 🤔";
        }
        res.write(content);
        res.end();

    } catch (error) {
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
};

export default handleChatbotMessage;
