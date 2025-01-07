import express from 'express';
import chatbotController from './controllers/chatbotController.js';
import cors from 'cors';


const app = express();
const PORT = 3000;

// Middleware pour analyser le JSON
app.use(express.json());

// Configurer les origines autorisées
const allowedOrigins = [
    'http://localhost:3000',
    'https://www.xn--mon-projet-numrique-ozb.fr',
    'https://api.promete-it.fr',
];

// Activer CORS
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // Autorise les requêtes sans origine (ex: Postman)
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy: Origin not allowed'), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // Si vous utilisez des cookies ou des headers d'autorisation
}));


// Définissez vos routes ici
app.post('/chatbot', chatbotController);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
