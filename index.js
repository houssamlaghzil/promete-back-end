import express from 'express';
import cors from 'cors';
import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fileTypeDetection from './controllers/fileTypeDetectionController.js';
import fileConversion from './controllers/fileConversionController.js';
import chatbotController from "./controllers/chatbotController.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 443;

// For ES modules: Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure CORS
const allowedOrigins = ['http://localhost:3000', 'https://promete-it.fr'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'Cette origine CORS n’est pas autorisée.';
            console.error(msg);
            return callback(new Error(msg), false);
        }
        console.log(`CORS check passed for origin: ${origin}`);
        return callback(null, true);
    }
}));

app.use(express.json());
app.post('/chatbot', chatbotController);

// Serveur de fichiers statiques dans le dossier uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Types MIME d'images supportés
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Configuration de Multer pour gérer la taille et le type de fichier
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // Limite de taille à 5 Mo
    fileFilter: (req, file, cb) => {
        if (SUPPORTED_FORMATS.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Le format de fichier n\'est pas supporté. Veuillez télécharger des images au format JPEG, PNG, GIF ou WebP.'));
        }
    }
});

// Endpoint to detect file type and compatible extensions
app.post('/extfile', upload.single('file'), async (req, res) => {
    console.log('Received request to /extfile');
    try {
        const file = req.file;

        if (!file) {
            const errorMsg = 'No file uploaded.';
            console.error(errorMsg);
            return res.status(400).json({ error: errorMsg });
        }

        const result = await fileTypeDetection(file);
        if (result.error) {
            console.error('Error in fileTypeDetection:', result.error);
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error processing /extfile:', error.message);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
});

// Endpoint to convert file to all compatible formats
app.post('/convfile', upload.single('file'), async (req, res) => {
    console.log('Received request to /convfile');
    try {
        const file = req.file;

        if (!file) {
            const errorMsg = 'No file uploaded.';
            console.error(errorMsg);
            return res.status(400).json({ error: errorMsg });
        }

        const conversionResult = await fileConversion(file);
        if (conversionResult.error) {
            console.error('Error in fileConversion:', conversionResult.error);
            return res.status(400).json(conversionResult);
        }

        // Generate relative URLs for the converted files
        conversionResult.convertedFiles = conversionResult.convertedFiles.map(file => ({
            ...file,
            path: `/uploads/${path.basename(file.path)}`  // Use relative path
        }));

        res.json(conversionResult);
    } catch (error) {
        console.error('Error processing /convfile:', error.message);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
});

// Start the HTTPS server
const httpsOptions = {
    key: fs.readFileSync('./certificates/privkey.pem'),
    cert: fs.readFileSync('./certificates/fullchain.pem')
};

https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`HTTPS server started on port ${PORT}`);
});
