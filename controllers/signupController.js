// backend/controllers/signupController.js
import Stripe from 'stripe';
import admin from './../admin.js';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-08-16', // Assurez-vous d'utiliser la version actuelle de l'API Stripe
});

const signupController = async (req, res) => {
    const { email, password, promoCode, paymentIntentId } = req.body;
    console.log('signupController -> req.body', req.body);

    if (!email || !password || !promoCode || !paymentIntentId) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    // Valider le code promo
    if (promoCode !== 'cacaboudin') {
        return res.status(400).json({ error: 'Code promo invalide.' });
    }

    try {
        // Récupérer le Payment Intent depuis Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Le paiement n\'a pas été effectué avec succès.' });
        }

        // Optionnel : Vérifier que le montant correspond
        // const expectedAmount = 1000; // 10.00 EUR en cents
        // if (paymentIntent.amount !== expectedAmount) {
        //     return res.status(400).json({ error: 'Montant du paiement incorrect.' });
        // }

        // Créer l'utilisateur dans Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: false,
        });

        // Ajouter des claims personnalisés
        await admin.auth().setCustomUserClaims(userRecord.uid, { paid: true });

        res.status(201).json({ message: 'Utilisateur créé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        // Gérer les erreurs spécifiques de Firebase
        if (error.code === 'auth/email-already-exists') {
            return res.status(400).json({ error: 'L\'email est déjà utilisé.' });
        }
        console.error('Erreur lors de l\'inscription:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

export default signupController;
