/******************************************************************/
/*                  FICHIER imageGeneratorController.js           */
/******************************************************************/

// Import des dépendances
import axios from 'axios';
import dotenv from 'dotenv';
import admin from '../config/firebase.js';

dotenv.config();

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
/*                        SECTION : CONFIGURATION                   */
/******************************************************************/
const FLUX_API_ENDPOINT = 'https://api.us1.bfl.ai/v1/flux-pro-1.1';
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini-2024-07-18'; // Vous pouvez adapter si besoin
const DEFAULT_IMAGE_SIZE = { width: 640, height: 480 }; // Taille par défaut

/******************************************************************/
/*        SECTION : FONCTION D'OPTIMISATION DU PROMPT                */
/******************************************************************/
/**
 * Optimise le prompt pour la génération d'image avec Flux.
 * @param {string} inputPrompt - Le prompt original
 * @returns {string} Le prompt optimisé
 */
const optimizeImagePrompt = async (inputPrompt) => {
    try {
        await logToFirebase(`Optimisation du prompt d'image: ${inputPrompt}`);
        const payload = {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: "Tu es un expert en génération d'image par IA. Optimise ce prompt pour obtenir un rendu optimal avec FLUX 1.1 [pro]. Sois synthétique, précis et mentionne le style, la composition, l'éclairage et les détails nécessaires."
                },
                {
                    role: 'user',
                    content: `Optimise ce prompt pour FLUX 1.1 [pro] :\n\n${inputPrompt}`
                }
            ],
            temperature: 0.7,
            max_tokens: 150
        };

        const response = await axios.post(OPENAI_API_ENDPOINT, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            timeout: 10000,
        });

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const optimized = response.data.choices[0].message.content.trim();
            await logToFirebase(`Prompt optimisé: ${optimized}`);
            return optimized;
        } else {
            throw new Error("Aucune réponse de l'API OpenAI pour l'optimisation du prompt.");
        }
    } catch (error) {
        await logToFirebase(`Erreur lors de l'optimisation du prompt: ${error.message}`);
        throw error;
    }
};

/******************************************************************/
/*              SECTION : FONCTION DE POLLING POUR FLUX             */
/******************************************************************/
/**
 * Effectue un polling sur l'URL fournie jusqu'à ce que le résultat soit prêt.
 * @param {string} pollingUrl
 * @returns {Object} Le résultat contenant l'URL de l'image et le seed
 */
const pollForImage = async (pollingUrl) => {
    while (true) {
        try {
            const response = await axios.get(pollingUrl, {
                headers: {
                    'accept': 'application/json',
                    'x-key': process.env.FLUX_API_KEY,
                },
                timeout: 10000,
            });
            if (response.data.status === 'Ready') {
                return response.data.result;
            }
        } catch (error) {
            await logToFirebase(`Erreur lors du polling: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
};

/******************************************************************/
/*         SECTION : CONVERSION DE L'IMAGE EN BASE64                */
/******************************************************************/
/**
 * Télécharge l'image depuis l'URL fournie et la convertit en base64.
 * @param {string} imageUrl
 * @returns {string} L'image encodée en base64
 */
const fetchImageAsBase64 = async (imageUrl) => {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        return base64;
    } catch (error) {
        await logToFirebase(`Erreur lors de la conversion de l'image: ${error.message}`);
        throw error;
    }
};

/******************************************************************/
/*         SECTION : FONCTION PRINCIPALE imageGeneratorController   */
/******************************************************************/
/**
 * Contrôleur pour générer une image via Flux après optimisation du prompt.
 * @param {Object} req - La requête HTTP (attend { prompt, imageSize? } dans le body)
 * @param {Object} res - La réponse HTTP
 */
const imageGeneratorController = async (req, res) => {
    const { prompt, imageSize } = req.body;

    // Validation du prompt
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Le champ "prompt" est requis et doit être une chaîne de caractères.' });
    }

    // Définir la taille de l'image (ou utiliser la taille par défaut)
    const size = imageSize || DEFAULT_IMAGE_SIZE;

    try {
        // Optimisation du prompt avant l'envoi à Flux
        const optimizedPrompt = await optimizeImagePrompt(prompt);

        // Préparation du payload pour Flux
        const payload = {
            prompt: optimizedPrompt,
            image_size: size, // Exemple : { width: 640, height: 480 }
            sync_mode: true,
            num_images: 1,
            enable_safety_checker: true,
            safety_tolerance: "2",
            output_format: "jpeg"
        };

        await logToFirebase(`Envoi de la requête à Flux avec le prompt optimisé: ${optimizedPrompt}`);

        // Envoi de la requête à l'API Flux
        const fluxResponse = await axios.post(FLUX_API_ENDPOINT, payload, {
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'x-key': process.env.FLUX_API_KEY,
            },
            timeout: 10000,
        });

        if (!fluxResponse.data.polling_url) {
            throw new Error("URL de polling introuvable dans la réponse de Flux.");
        }

        // Polling pour récupérer le résultat
        const result = await pollForImage(fluxResponse.data.polling_url);

        if (!result.sample) {
            throw new Error("Aucune image générée par Flux.");
        }

        // Conversion de l'image en base64
        const base64Image = await fetchImageAsBase64(result.sample);

        await logToFirebase("Image générée avec succès par Flux.");

        // Réponse finale au client
        return res.status(200).json({ image: base64Image, seed: result.seed || null });
    } catch (error) {
        await logToFirebase(`Erreur lors de la génération d'image: ${error.message}`);
        if (error.response) {
            return res.status(500).json({ error: `Erreur Flux API: ${error.response.data?.error || error.response.statusText}` });
        } else {
            return res.status(500).json({ error: 'Erreur lors de la génération de l\'image.' });
        }
    }
};

export default imageGeneratorController;
