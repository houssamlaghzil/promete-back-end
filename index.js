// Importer les modules nécessaires
const express = require('express');
const bodyParser = require('body-parser');
const { handleChatbotMessage } = require('./path/to/your/controller/file'); // Remplacez par le chemin correct de votre contrôleur

// Initialiser l'application Express
const app = express();

// Middleware pour parser le corps des requêtes JSON
app.use(bodyParser.json());

// Définir le port d'écoute. Azure fournit généralement un port via la variable d'environnement PORT.
const PORT = process.env.PORT || 3000;

// Définir la route pour votre API qui utilise le contrôleur handleChatbotMessage
app.post('/api/chatbot', handleChatbotMessage);

// Route de base pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
    res.send('Le serveur API Node.js fonctionne!');
});

// Démarrer le serveur et écouter sur le port défini
app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
