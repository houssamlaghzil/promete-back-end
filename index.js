/******************************************************************/
/*                       backend / index.js                       */
/******************************************************************/

import express      from 'express';
import cors         from 'cors';
import bodyParser   from 'body-parser';
import dotenv       from 'dotenv';

// Contrôleurs existants
import chatbotController            from './controllers/chatbotController.js';
import emailController              from './controllers/emailController.js';
import chatbotControllerToulouse    from './controllers/chatbotControllerToulouse.js';
import Orth                         from './game/logic/Orth.js';

// Nouveaux contrôleurs
import paymentController            from './controllers/paymentController.js';
import signupController             from './controllers/signupController.js';
import imageGeneratorController     from './controllers/imageGeneratorController.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

/* -------------------------------------------------------------------------- */
/*                               MIDDLEWARES                                  */
/* -------------------------------------------------------------------------- */
/* ↑↑↑ Seule modification : on monte la limite à 50 Mo */
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

/* Configuration CORS (inchangée) */
const allowedOrigins = [
    'http://localhost:3000',
    'https://www.xn--mon-projet-numrique-ozb.fr',
    'https://toulouse-adventure.promete-it.fr',
    'https://api.promete-it.fr',
    'https://testnull-edcb5.web.app',
    'https://www.testnull-edcb5.web.app',
    'https://cinoji.web.app',
];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);               // Postman & co.
        if (allowedOrigins.indexOf(origin) === -1) {
            return cb(new Error('CORS policy: Origin not allowed'), false);
        }
        return cb(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

/* -------------------------------------------------------------------------- */
/*                                   ROUTES                                   */
/* -------------------------------------------------------------------------- */
app.post('/chatbot',               chatbotController);
app.post('/toulouse',              chatbotControllerToulouse);
app.post('/email',                 emailController);
app.post('/orth',                  Orth);

app.post('/create-payment-intent', paymentController);
app.post('/signup',                signupController);

/* Route de génération d’image */
app.post('/generate-image',        imageGeneratorController);

/* Health-check */
app.get('/', (req, res) => {
    res.send('Serveur Express en cours d’exécution.');
});

/* -------------------------------------------------------------------------- */
/*                               LANCEMENT                                    */
/* -------------------------------------------------------------------------- */
app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
