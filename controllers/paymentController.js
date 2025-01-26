// backend/controllers/paymentController.js
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-08-16', // Assurez-vous d'utiliser la version actuelle de l'API Stripe
});

const createPaymentIntent = async (req, res) => {
    const { email, amount } = req.body;

    if (!email || !amount) {
        return res.status(400).json({ error: 'Email et montant sont requis.' });
    }

    try {
        // Créer un Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // Montant en cents (ex. 1000 = 10.00 EUR)
            currency: 'eur',
            receipt_email: email,
            metadata: { integration_check: 'accept_a_payment' },
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Erreur lors de la création du Payment Intent:', error);
        res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
};

export default createPaymentIntent;
