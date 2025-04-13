// backend/index.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

// Importer les contrôleurs existants
import chatbotController from './controllers/chatbotController.js';
import emailController from './controllers/emailController.js';
import chatbotControllerToulouse from "./controllers/chatbotControllerToulouse.js";
import Orth from "./game/logic/Orth.js";

// Importer les nouveaux contrôleurs
import paymentController from './controllers/paymentController.js';
import signupController from './controllers/signupController.js';

// Nouveau contrôleur pour la génération d'images
import imageGeneratorController from './controllers/imageGeneratorController.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser le corps en JSON
app.use(bodyParser.json());

// Configuration des origines autorisées
const allowedOrigins = [
    'http://localhost:3000',
    'https://www.xn--mon-projet-numrique-ozb.fr',
    'https://toulouse-adventure.promete-it.fr',
    'https://api.promete-it.fr',
    'https://testnull-edcb5.web.app',
    'https://www.testnull-edcb5.web.app',
    'https://cinoji.web.app',
];

// Configurer CORS
app.use(cors({
    origin: function (origin, callback) {
        // Autorise les requêtes sans origine (ex: Postman)
        if (!origin) return callback(null, true);

        // Vérifie que l'origine fait partie de la liste autorisée
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy: Origin not allowed'), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Si vous utilisez des cookies ou des headers d'autorisation
}));

// Routes existantes
app.post('/chatbot', chatbotController);
app.post('/toulouse', chatbotControllerToulouse);
app.post('/email', emailController);
app.post('/orth', Orth);

// Nouvelles routes pour l'inscription
app.post('/create-payment-intent', paymentController);
app.post('/signup', signupController);

// Nouvelle route pour la génération d'images
app.post('/generate-image', imageGeneratorController);

// Route de santé pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
    res.send('Serveur Express en cours d\'exécution.');
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
