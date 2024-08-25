/*
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { handleChatbotMessage } = require('./controllers/chatbotController');
require('dotenv').config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Définir l'endpoint pour le chatbot
app.post('/chatbot/message', handleChatbotMessage);

// Spécifier la région 'europe-west9' pour le déploiement en France (Paris)
exports.api = functions.region('europe-west1').https.onRequest(app);
*/
