// backend/controllers/signupController.js
import Stripe from 'stripe';
import admin from '../admin.js';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-08-16',
});

const signupController = async (req, res) => {
    const { email, password, promoCode, paymentIntentId } = req.body;
    console.log('[BACK] -> /signup body:', req.body);

    if (!email || !password || !paymentIntentId) {
        console.log('[BACK] -> /signup : Champs manquants.');
        return res.status(400).json({ error: 'Email, mot de passe et paymentIntentId sont requis.' });
    }

    try {
        console.log('[BACK] -> Récupération du Payment Intent:', paymentIntentId);
        // Récupérer le Payment Intent depuis Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log('[BACK] -> paymentIntent status:', paymentIntent.status);

        if (paymentIntent.status !== 'succeeded') {
            console.log('[BACK] -> Paiement non réussi.');
            return res.status(400).json({ error: 'Le paiement n\'a pas été effectué avec succès.' });
        }

        // Si un code promo est fourni, validez-le
        if (promoCode) {
            console.log('[BACK] -> Code promo fourni:', promoCode);
            if (promoCode !== 'cacaboudin') {
                console.log('[BACK] -> Code promo invalide.');
                return res.status(400).json({ error: 'Code promo invalide.' });
            }
            console.log('[BACK] -> Code promo valide.');
            // Vous pouvez ajouter ici une logique supplémentaire pour gérer les avantages du code promo
        } else {
            console.log('[BACK] -> Aucun code promo fourni.');
        }

        // Créer l'utilisateur dans Firebase Authentication
        console.log('[BACK] -> Création de l\'utilisateur Firebase pour:', email);
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: false,
        });
        console.log('[BACK] -> Utilisateur Firebase créé:', userRecord.uid);

        // Ajouter des claims personnalisés
        console.log('[BACK] -> Ajout des claims personnalisés pour:', userRecord.uid);
        await admin.auth().setCustomUserClaims(userRecord.uid, { paid: true });

        res.status(201).json({ message: 'Utilisateur créé avec succès.' });
        console.log('[BACK] -> Inscription réussie pour:', email);
    } catch (error) {
        console.error('[BACK] -> Erreur lors de l\'inscription:', error);
        // Gérer les erreurs spécifiques de Firebase
        if (error.code === 'auth/email-already-exists') {
            console.log('[BACK] -> Email déjà utilisé.');
            return res.status(400).json({ error: 'L\'email est déjà utilisé.' });
        }
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

export default signupController;
