import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Contrôleurs
import chatbotController from './controllers/chatbotController.js';
import emailController from './controllers/emailController.js';

const app = express();
const PORT = 3000;

// Middleware pour parser le corps en JSON
app.use(bodyParser.json());

// Configuration des origines autorisées
const allowedOrigins = [
    'http://localhost:3000',
    'https://www.xn--mon-projet-numrique-ozb.fr',
    'https://api.promete-it.fr',
];

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

// Routes
app.post('/chatbot', chatbotController);
app.post('/email', emailController);

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
