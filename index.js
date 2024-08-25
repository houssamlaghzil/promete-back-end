require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { handleChatbotMessage } = require('./controllers/chatbotController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser les JSON dans les requêtes HTTP
app.use(bodyParser.json());

// Route pour gérer les messages du chatbot
app.post('/chatbot', handleChatbotMessage);

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
