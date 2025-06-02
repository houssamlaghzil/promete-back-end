/******************************************************************
 *           Contrôleur de génération d'image FLUX                *
 * - Optimisation du prompt via OpenAI                             *
 *   - GPT-3.5 Turbo pour modèles classiques                       *
 *   - GPT-4o (image+texte) pour modèles Kontext                   *
 * - Gestion complète des erreurs                                  *
 * - Toutes les options avancées FLUX                              *
 ******************************************************************/

import axios  from 'axios';
import dotenv from 'dotenv';
import admin  from '../config/firebase.js';

dotenv.config();

/** Liste des modèles FLUX pris en charge **/
const FLUX_MODELS = {
    'flux-pro-1.1':     { endpoint: 'https://api.us1.bfl.ai/v1/flux-pro-1.1',      token: 120 },
    'flux-kontext-pro': { endpoint: 'https://api.us1.bfl.ai/v1/flux-kontext-pro',  token: 100 },
    'flux-kontext-max': { endpoint: 'https://api.us1.bfl.ai/v1/flux-kontext-max',  token: 200 },
    // ... (autres modèles si besoin)
};

/** Valeurs par défaut/limites **/
const DEFAULT_NEGATIVE = 'older, fat, wrinkles, different person, distorted face';
const DEFAULT_IMAGE_SIZE = { width: 640, height: 480 };
const CLAMP = (x, min, max) => Math.max(min, Math.min(max, x));

/** Helper : log Firebase (silencieux si erreur) **/
const log = async (msg) => {
    try {
        await admin.database().ref('logs').push({ msg, ts: admin.database.ServerValue.TIMESTAMP });
    } catch { /* silent */ }
    console.log(msg);
};

/**
 * OPTIMISATION DE PROMPT
 * - Pour les modèles Kontext, utilise GPT-4o multimodal (texte + image)
 * - Pour les autres, GPT-3.5 turbo (texte seul)
 */
async function optimizePrompt({ prompt, mode, inputImage }) {
    try {
        if (mode.startsWith('flux-kontext')) {
            // GPT-4o multimodal (texte + image en base64)
            const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
            const sys = "Tu es un assistant expert en génération d'images d’édition locale (inpainting, retouche de zone)."
                + " Ton but : reformuler, condenser et contextualiser la demande pour Flux Kontext. "
                + "Indique précisément ce qu’il faut changer dans la zone dessinée (fournie en image) et ce qu’il faut préserver. "
                + "Ne rajoute rien d’irréaliste. Utilise une seule phrase claire et descriptive.";
            const messages = [
                { role: 'system', content: sys },
                { role: 'user', content: [
                        { type: "text", text: `Voici la demande utilisateur : "${prompt}".` },
                        ...(inputImage ? [{ type: "image_url", image_url: { url: inputImage, detail: "low" } }] : [])
                    ]
                }
            ];
            const { data } = await axios.post(OPENAI_API, {
                model: "gpt-4o",
                messages,
                max_tokens: 180,
                temperature: 0.6
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` }
            });
            const optimized = data?.choices?.[0]?.message?.content?.trim();
            if (!optimized) throw new Error('Prompt optimisé vide');
            await log(`[GPT-4o] Prompt Kontext optimisé: ${optimized}`);
            return optimized;
        } else {
            // GPT-3.5 Turbo (texte seul)
            const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
            const sys = "Tu es un expert en prompt engineering pour IA générative d’image. "
                + "Réécris le prompt pour que la description soit concise, visuelle, évite toute hallucination sur le visage, et précise la zone si possible.";
            const messages = [
                { role: 'system', content: sys },
                { role: 'user', content: prompt }
            ];
            const { data } = await axios.post(OPENAI_API, {
                model: "gpt-3.5-turbo",
                messages,
                max_tokens: 120,
                temperature: 0.7
            }, {
                headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` }
            });
            const optimized = data?.choices?.[0]?.message?.content?.trim();
            if (!optimized) throw new Error('Prompt optimisé vide');
            await log(`[GPT-3.5] Prompt standard optimisé: ${optimized}`);
            return optimized;
        }
    } catch (e) {
        await log(`[GPT-OPTIM ERROR] (${mode}) ${e.message}`);
        return prompt; // fallback : renvoyer prompt brut si souci
    }
}

/**
 * POLLING FLUX : attend que l’image soit prête et retourne le résultat
 */
async function pollForImage(pollingUrl) {
    try {
        let attempt = 0;
        while (true) {
            attempt++;
            try {
                const { data } = await axios.get(pollingUrl, {
                    headers: { accept: 'application/json', 'x-key': process.env.FLUX_API_KEY },
                    timeout: 10000
                });
                if (['Ready', 'succeeded'].includes(data.status)) return data.result;
                if (['failed', 'error'].includes(data.status))
                    throw new Error(`Status FLUX: ${data.status}`);
            } catch (err) {
                await log(`[FLUX polling] Erreur tentative #${attempt}: ${err.message}`);
                if (attempt > 10) throw err;
            }
            await new Promise(r => setTimeout(r, 700));
        }
    } catch (e) {
        await log(`[FLUX POLLING ERROR] ${e.message}`);
        throw e;
    }
}

/**
 * Télécharge une image (URL publique) et la retourne en base64
 */
async function fetchImageAsBase64(url) {
    try {
        const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
        return Buffer.from(data, 'binary').toString('base64');
    } catch (e) {
        await log(`[Base64 download error] ${e.message}`);
        throw e;
    }
}

/**
 * MAIN CONTROLLER: /generate-image
 */
const imageGeneratorController = async (req, res) => {
    try {
        // Extraction/validation des champs reçus
        const {
            prompt,
            negativePrompt,
            fluxModel,
            aspectRatio,
            outputFormat,
            inputImage,
            maskImage,
            strength,
            guidanceScale,
            contextAlpha,
            refinerSteps,
            promptUpsampling,
            safetyTolerance,
            seed
        } = req.body;

        // Sélection du modèle
        const model = FLUX_MODELS[fluxModel] || FLUX_MODELS['flux-pro-1.1'];
        const isKontext = fluxModel?.startsWith('flux-kontext');

        if (!prompt) return res.status(400).json({ error: 'prompt requis' });
        if (isKontext && (!inputImage || !maskImage))
            return res.status(400).json({ error: 'inputImage et maskImage requis pour Kontext' });

        // Clamp des paramètres numériques
        const safeStrength    = CLAMP(strength ?? 0.2, 0.05, 0.4);
        const safeGuidance    = CLAMP(guidanceScale ?? 8, 7, 9);
        const safeAlpha       = CLAMP(contextAlpha ?? 0.8, 0.7, 0.9);
        const safeSteps       = CLAMP(refinerSteps ?? 50, 40, 60);
        const neg             = negativePrompt || DEFAULT_NEGATIVE;
        const safeOutput      = outputFormat || 'jpeg';

        // OPTIMISE PROMPT selon le mode
        let optimizedPrompt;
        try {
            optimizedPrompt = await optimizePrompt({
                prompt,
                mode: fluxModel,
                inputImage: isKontext ? inputImage : undefined
            });
        } catch (e) {
            await log(`[Prompt fallback] ${e.message}`);
            optimizedPrompt = prompt; // fallback
        }

        // Préparation du payload pour FLUX
        let payload = {
            prompt: optimizedPrompt,
            negative_prompt: neg,
            strength: safeStrength,
            guidance_scale: safeGuidance,
            prompt_upsampling: !!promptUpsampling,
            safety_tolerance: safetyTolerance ?? 2,
            ...(seed && { seed }),
            ...(inputImage && { input_image: inputImage }),
            ...(maskImage   && { mask_image: maskImage })
        };

        if (isKontext) {
            payload.aspect_ratio   = aspectRatio || '1:1';
            payload.output_format  = safeOutput;
            payload.context_alpha  = safeAlpha;
            payload.refiner_steps  = safeSteps;
        } else {
            payload.image_size     = DEFAULT_IMAGE_SIZE;
            payload.output_format  = safeOutput;
        }

        payload.num_images = 1;

        // Appel à l'API FLUX
        let pollingUrl;
        try {
            await log(`[FLUX CALL] ${fluxModel} | prompt "${optimizedPrompt.slice(0,80)}..."`);
            const { data } = await axios.post(model.endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    accept: 'application/json',
                    'x-key': process.env.FLUX_API_KEY
                },
                timeout: 15000
            });
            pollingUrl = data.polling_url;
            if (!pollingUrl) throw new Error('polling_url manquant dans la réponse FLUX');
        } catch (e) {
            await log(`[FLUX API ERROR] ${e.message}`);
            return res.status(500).json({ error: 'Erreur lors de l’appel à l’API FLUX' });
        }

        // Polling jusqu'à résultat
        let result;
        try {
            result = await pollForImage(pollingUrl);
        } catch (e) {
            await log(`[FLUX POLLING ERROR] ${e.message}`);
            return res.status(500).json({ error: 'Erreur lors de la génération FLUX' });
        }

        // Téléchargement image finale
        let base64Image;
        try {
            if (!result.sample) throw new Error('Lien image manquant dans résultat FLUX');
            base64Image = await fetchImageAsBase64(result.sample);
        } catch (e) {
            await log(`[IMAGE FETCH ERROR] ${e.message}`);
            return res.status(500).json({ error: 'Erreur lors du téléchargement de l’image' });
        }

        // Tout OK : on renvoie l’image
        await log(`[SUCCESS] Image générée modèle ${fluxModel}`);
        return res.status(200).json({ image: base64Image, fluxModel });
    } catch (err) {
        await log(`[GENERIC ERROR] ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
};

export default imageGeneratorController;
