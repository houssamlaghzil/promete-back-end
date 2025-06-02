/******************************************************************/
/*                  FICHIER imageGeneratorController.js           */
/******************************************************************/

// Import des dépendances
import axios   from 'axios';
import dotenv  from 'dotenv';
import admin   from '../config/firebase.js';

dotenv.config();

/******************************************************************/
/*                        SECTION : LOGGING                       */
/******************************************************************/
const logToFirebase = async (message) => {
    try {
        const db  = admin.database();
        const ref = db.ref('logs');
        await ref.push({
            message,
            timestamp: admin.database.ServerValue.TIMESTAMP,
        });
        console.log('Log Firebase:', message);
    } catch (e) {
        console.error('Erreur log Firebase:', e.message);
    }
};

/******************************************************************/
/*                  CONFIGURATION DES MODÈLES FLUX                */
/******************************************************************/
const FLUX_MODELS = {
    'flux-schnell'     : { endpoint: 'https://api.us1.bfl.ai/v1/flux-dev',             tokenCost: 40  },
    'flux-dev'         : { endpoint: 'https://api.us1.bfl.ai/v1/flux-dev',             tokenCost: 80  },
    'flux-pro-1.1'     : { endpoint: 'https://api.us1.bfl.ai/v1/flux-pro-1.1',         tokenCost: 120 },
    'flux-ultra'       : { endpoint: 'https://api.us1.bfl.ai/v1/flux-pro-1.1-ultra',   tokenCost: 200 },
    'flux-raw'         : { endpoint: 'https://api.us1.bfl.ai/v1/flux-pro-1.1-ultra',   tokenCost: 180 },
    'flux-pro-lite'    : { endpoint: 'https://api.us1.bfl.ai/v1/flux-pro-1.1',         tokenCost: 60  },
    'flux-kontext-pro' : { endpoint: 'https://api.us1.bfl.ai/v1/flux-kontext-pro',     tokenCost: 100 },
    'flux-kontext-max' : { endpoint: 'https://api.us1.bfl.ai/v1/flux-kontext-max',     tokenCost: 200 },
};

const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL        = 'gpt-3.5-turbo';

const DEFAULT_IMAGE_SIZE   = { width: 640, height: 480 };
const DEFAULT_NEGATIVE     = 'older, fat, wrinkles, different person, distorted face';

/******************************************************************/
/*              SECTION : OPTIMISATION DU PROMPT                  */
/******************************************************************/
const optimizeImagePrompt = async (inputPrompt) => {
    try {
        await logToFirebase(`Optimisation prompt : ${inputPrompt}`);
        const payload = {
            model: OPENAI_MODEL,
            messages: [
                { role: 'system',
                    content: 'Tu es un expert en génération d’image FLUX. Condense le prompt ; ajoute style, composition et éclairage.' },
                { role: 'user', content: `Optimise :\n${inputPrompt}` },
            ],
            temperature: 0.7,
            max_tokens: 150,
        };
        const { data } = await axios.post(OPENAI_API_ENDPOINT, payload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            timeout: 10000,
        });
        const optimized = data?.choices?.[0]?.message?.content?.trim();
        if (!optimized) throw new Error('Prompt vide');
        await logToFirebase(`Prompt optimisé : ${optimized}`);
        return optimized;
    } catch (e) {
        await logToFirebase(`Opti prompt ERROR: ${e.message}`);
        return inputPrompt;                               // fallback : renvoyer le prompt brut
    }
};

/******************************************************************/
/*                SECTION : POLLING DU RÉSULTAT                   */
/******************************************************************/
const pollForImage = async (pollingUrl) => {
    while (true) {
        try {
            const { data } = await axios.get(pollingUrl, {
                headers: { accept: 'application/json', 'x-key': process.env.FLUX_API_KEY },
                timeout: 10000,
            });
            if (['Ready', 'succeeded'].includes(data.status)) return data.result;
        } catch (e) {
            await logToFirebase(`Polling error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 600));
    }
};

/******************************************************************/
/*             SECTION : TÉLÉCHARGER L’IMAGE GÉNÉRÉE             */
/******************************************************************/
const fetchImageAsBase64 = async (url) => {
    const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(data, 'binary').toString('base64');
};

/******************************************************************/
/*               CONTROLLER PRINCIPAL  /generate-image            */
/******************************************************************/
const imageGeneratorController = async (req, res) => {
    const {
        prompt,
        aspectRatio,
        outputFormat,
        fluxModel,
        inputImage,
        maskImage,
        negativePrompt,
        promptUpsampling,
        safetyTolerance,
        guidanceScale,
        strength,
        seed,
    } = req.body;

    /* ---- Validation minimale ---- */
    if (!prompt || typeof prompt !== 'string')
        return res.status(400).json({ error: 'Le champ "prompt" est requis.' });

    const chosenModelKey = FLUX_MODELS[fluxModel] ? fluxModel : 'flux-pro-1.1';
    const chosenModel    = FLUX_MODELS[chosenModelKey];

    /* Masque obligatoire pour Kontext si on édite */
    if (chosenModelKey.startsWith('flux-kontext') && !maskImage)
        return res.status(400).json({ error: 'maskImage est obligatoire pour les modèles Kontext.' });

    /* ---- Clamp des valeurs recommandées ---- */
    const safeStrength  = Math.min(Math.max(strength ?? 0.2, 0.05), 0.4);
    const safeGuidance  = Math.min(Math.max(guidanceScale ?? 8, 7), 9);
    const safeNegPrompt = negativePrompt?.trim() || DEFAULT_NEGATIVE;

    /* ---- Construction du payload ---- */
    const payload = {
        prompt          : await optimizeImagePrompt(prompt),
        negative_prompt : safeNegPrompt,
        strength        : safeStrength,
        guidance_scale  : safeGuidance,
        prompt_upsampling: promptUpsampling ?? false,
        safety_tolerance: safetyTolerance ?? 2,
        ...(seed       && { seed }),
        ...(inputImage && { input_image: inputImage }),
        ...(maskImage  && { mask_image: maskImage }),
    };

    if (chosenModelKey.startsWith('flux-kontext')) {
        payload.aspect_ratio  = aspectRatio || '1:1';
        payload.output_format = outputFormat || 'jpeg';
        payload.context_alpha = 0.8;                  // fixe pour préserver le visage
    } else {
        payload.image_size    = DEFAULT_IMAGE_SIZE;
        payload.output_format = outputFormat || 'jpeg';
    }
    payload.num_images = 1;

    /* ---- Appel à l’API FLUX ---- */
    try {
        await logToFirebase(`=> Flux ${chosenModelKey} | prompt "${payload.prompt}"`);
        const { data: firstResp } = await axios.post(chosenModel.endpoint, payload, {
            headers: {
                'Content-Type': 'application/json',
                accept: 'application/json',
                'x-key': process.env.FLUX_API_KEY,
            },
            timeout: 10000,
        });
        if (!firstResp.polling_url) throw new Error('polling_url manquant');
        const result = await pollForImage(firstResp.polling_url);
        if (!result.sample) throw new Error('sample manquant');
        const base64Image = await fetchImageAsBase64(result.sample);

        await logToFirebase(`<= Image ok (${chosenModelKey})`);
        return res.status(200).json({ image: base64Image, fluxModel: chosenModelKey });
    } catch (e) {
        await logToFirebase(`Flux ERROR: ${e.message}`);
        const msg = e.response?.data?.error || e.message || 'Erreur FLUX';
        return res.status(500).json({ error: msg });
    }
};

export default imageGeneratorController;
