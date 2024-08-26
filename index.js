import express from 'express';
import cors from 'cors';
import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';
import chatbotController from './controllers/chatbotController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 443;

// Configurez CORS pour autoriser votre front-end local
const allowedOrigins = ['http://localhost:3000', 'https://promete-it.fr'];

app.use(cors({
    origin: function (origin, callback) {
        // autoriser les requêtes sans origine comme celles de Postman
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'Cette origine CORS n’est pas autorisée.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    }
}));

// Autres configurations de votre serveur
app.use(express.json());

app.post('/chatbot', chatbotController);

// Démarrer le serveur HTTPS
const httpsOptions = {
    key: fs.readFileSync('./certificates/privkey.pem'),
    cert: fs.readFileSync('./certificates/fullchain.pem')
};

https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Serveur HTTPS démarré sur le port ${PORT}`);
});
