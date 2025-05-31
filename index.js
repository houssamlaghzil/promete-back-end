/******************************************************************
 *                     backend / index.js                         *
 ******************************************************************/

import express       from 'express';
import bodyParser    from 'body-parser';
import dotenv        from 'dotenv';

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
/**
 *  On augmente la taille maximale à 50 Mo pour accepter
 *  les images/masques encodés en Base64.
 */
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// NB : Les en-têtes CORS sont désormais injectés par NGINX.
//       Aucune configuration cors() n’est nécessaire ici.

/* -------------------------------------------------------------------------- */
/*                                   ROUTES                                   */
/* -------------------------------------------------------------------------- */
// Routes historiques
app.post('/chatbot',   chatbotController);
app.post('/toulouse',  chatbotControllerToulouse);
app.post('/email',     emailController);
app.post('/orth',      Orth);

// Nouvelles routes
app.post('/create-payment-intent', paymentController);
app.post('/signup',                signupController);
app.post('/generate-image',        imageGeneratorController);

// Health-check
app.get('/', (req, res) => {
    res.send('Serveur Express en cours d’exécution.');
});

/* -------------------------------------------------------------------------- */
/*                               LANCEMENT                                    */
/* -------------------------------------------------------------------------- */
app.listen(PORT, () => {
    console.log(`✅  Serveur lancé sur le port ${PORT}`);
});
