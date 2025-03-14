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
const logToFirebase = async (message) => {
    try {
        const db = admin.database();
        const ref = db.ref('logs');
        await ref.push({
            message: message,
            timestamp: admin.database.ServerValue.TIMESTAMP,
        });
        console.log('Log enregistré dans Firebase:', message);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du log dans Firebase:', error.message);
    }
};

/******************************************************************/
/*         SECTION : CONFIGURATION DES MODÈLES FLUX                */
/******************************************************************/
const FLUX_MODELS = {
    "flux-schnell": {
        endpoint: "https://api.us1.bfl.ai/v1/flux-dev",
        tokenCost: 40,
    },
    "flux-dev": {
        endpoint: "https://api.us1.bfl.ai/v1/flux-dev",
        tokenCost: 80,
    },
    "flux-pro-1.1": {
        endpoint: "https://api.us1.bfl.ai/v1/flux-pro-1.1",
        tokenCost: 120,
    },
    "flux-ultra": {
        endpoint: "https://api.us1.bfl.ai/v1/flux-pro-1.1-ultra",
        tokenCost: 200,
    },
    "flux-raw": {
        endpoint: "https://api.us1.bfl.ai/v1/flux-pro-1.1-ultra",
        tokenCost: 180,
    },
    "flux-pro-lite": {
        endpoint: "https://api.us1.bfl.ai/v1/flux-pro-1.1",
        tokenCost: 60,
    }
};

const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-3.5-turbo';
const DEFAULT_IMAGE_SIZE = { width: 640, height: 480 };

/******************************************************************/
/*          SECTION : OPTIMISATION DU PROMPT POUR FLUX              */
/******************************************************************/
const optimizeImagePrompt = async (inputPrompt) => {
    try {
        await logToFirebase(`Optimisation du prompt d'image: ${inputPrompt}`);
        const payload = {
            model: OPENAI_MODEL,
            messages: [
                {
                    role: 'system',
                    content:
                        "Tu es un expert en génération d'image par IA. Optimise ce prompt pour obtenir un rendu optimal avec FLUX. Sois synthétique, précis et mentionne le style, la composition, l'éclairage et les détails nécessaires.",
                },
                {
                    role: 'user',
                    content: `Optimise ce prompt pour FLUX :\n\n${inputPrompt}`,
                },
            ],
            temperature: 0.7,
            max_tokens: 150,
        };

        const response = await axios.post(OPENAI_API_ENDPOINT, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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
/*              SECTION : POLLING POUR RÉCUPÉRATION D'IMAGE         */
/******************************************************************/
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
/*           SECTION : CONTROLEUR PRINCIPAL imageGeneratorController  */
/******************************************************************/
const imageGeneratorController = async (req, res) => {
    const { prompt, imageSize, seed, fluxModel } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Le champ "prompt" est requis et doit être une chaîne de caractères.' });
    }
    const size = imageSize || DEFAULT_IMAGE_SIZE;

    // Sélectionne le modèle Flux à utiliser
    const chosenModelKey = fluxModel && FLUX_MODELS[fluxModel] ? fluxModel : "flux-pro-1.1";
    const chosenModel = FLUX_MODELS[chosenModelKey];

    try {
        const optimizedPrompt = await optimizeImagePrompt(prompt);

        // Prépare le payload pour Flux
        const payload = {
            prompt: optimizedPrompt,
            image_size: size,
            sync_mode: true,
            num_images: 1,
            enable_safety_checker: true,
            safety_tolerance: "2",
            output_format: "jpeg",
        };
        if (seed) {
            payload.seed = seed;
        }

        await logToFirebase(`Envoi de la requête à Flux (${chosenModelKey}) avec le prompt optimisé: ${optimizedPrompt}`);

        // Envoie la requête à l'API Flux via l'endpoint du modèle choisi
        const fluxResponse = await axios.post(chosenModel.endpoint, payload, {
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

        const result = await pollForImage(fluxResponse.data.polling_url);
        if (!result.sample) {
            throw new Error("Aucune image générée par Flux.");
        }

        const base64Image = await fetchImageAsBase64(result.sample);
        await logToFirebase(`Image générée avec succès par Flux (${chosenModelKey}). Coût estimé: ${chosenModel.tokenCost} tokens.`);
        return res.status(200).json({ image: base64Image, seed: result.seed || null, fluxModel: chosenModelKey, tokenCost: chosenModel.tokenCost });
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
