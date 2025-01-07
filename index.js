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
import coursUploader from "./controllers/coursUploader.js";

dotenv.config();

const app = express();
const PORT = 443;

// For ES modules: Get __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure your allowed origins
const allowedOrigins = [
    'http://localhost:3000',
    'https://promete-it.fr',
    'https://www.promete-it.fr',
    'https://www.xn--mon-projet-numrique-ozb.fr',
    'https://xn--mon-projet-numrique-ozb.fr',
    'https://mon-projet-numérique.fr'
];

// Middleware pour logger l’origin AVANT tout
app.use((req, res, next) => {
    // origin peut se trouver dans req.headers.origin
    const origin = req.headers.origin || 'Origin inconnu';
    console.log(`Origine de la requête : ${origin}`);
    next();
});

// Configure CORS
app.use(cors({
    origin: function (origin, callback) {
        // Si origin est undefined (ex.: requêtes depuis postman)
        // ou si on veut autoriser en local
        if (!origin) {
            console.log('Aucune origin détectée : requête possible depuis Postman ou script serveur.');
            return callback(null, true);
        }

        // Vérifier si l'origin est dans la liste
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = `Cette origine CORS n’est pas autorisée: ${origin}`;
            console.error(msg);
            return callback(new Error(msg), false);
        }

        console.log(`CORS check passed for origin: ${origin}`);
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

// Autres middlewares comme body-parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/test', (req, res) => {
    res.send('Test route is working!');
});

// API endpoints
app.post('/chatbot', chatbotController);
app.post('/api/upload/cours', coursUploader);

// Serve static files from the "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Supported image MIME types
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Configure Multer for file upload
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        if (SUPPORTED_FORMATS.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Le format de fichier n\'est pas supporté. Veuillez télécharger des images au format JPEG, PNG, GIF ou WebP.'));
        }
    }
});

// Function to delete files
const deleteFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`Erreur lors de la suppression du fichier ${filePath}:`, err.message);
        } else {
            console.log(`Fichier supprimé: ${filePath}`);
        }
    });
};

// Clean up old files if the total number exceeds 40
const cleanupOldFiles = () => {
    const directory = path.join(__dirname, 'uploads');
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error('Erreur lors de la lecture du dossier uploads:', err.message);
            return;
        }

        if (files.length > 40) {
            const fileDetails = files.map(file => {
                const filePath = path.join(directory, file);
                const stats = fs.statSync(filePath);
                return { filePath, mtime: stats.mtime.getTime() };
            });

            fileDetails.sort((a, b) => a.mtime - b.mtime);

            const filesToDelete = fileDetails.slice(0, files.length - 40);
            const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

            filesToDelete.forEach(file => {
                if (file.mtime < fifteenMinutesAgo) {
                    deleteFile(file.filePath);
                }
            });
        }
    });
};

// File type detection endpoint
app.post('/extfile', upload.single('file'), async (req, res) => {
    console.log('Received request to /extfile');
    try {
        const file = req.file;

        if (!file) {
            const errorMsg = 'No file uploaded.';
            console.error(errorMsg);
            return res.status(400).json({ error: errorMsg });
        }

        setTimeout(() => deleteFile(file.path), 15 * 60 * 1000);

        const result = await fileTypeDetection(file);
        if (result.error) {
            console.error('Error in fileTypeDetection:', result.error);
            return res.status(400).json(result);
        }

        cleanupOldFiles();

        res.json(result);
    } catch (error) {
        console.error('Error processing /extfile:', error.message);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
});

// File conversion endpoint
app.post('/convfile', upload.single('file'), async (req, res) => {
    console.log('Received request to /convfile');
    try {
        const file = req.file;

        if (!file) {
            const errorMsg = 'No file uploaded.';
            console.error(errorMsg);
            return res.status(400).json({ error: errorMsg });
        }

        setTimeout(() => deleteFile(file.path), 15 * 60 * 1000);

        const conversionResult = await fileConversion(file);
        if (conversionResult.error) {
            console.error('Error in fileConversion:', conversionResult.error);
            return res.status(400).json(conversionResult);
        }

        conversionResult.convertedFiles.forEach(convertedFile => {
            setTimeout(() => deleteFile(convertedFile.path), 15 * 60 * 1000);
        });

        cleanupOldFiles();

        // Adapte le path pour qu'il soit accessible en statique via /uploads
        conversionResult.convertedFiles = conversionResult.convertedFiles.map(file => ({
            ...file,
            path: `/uploads/${path.basename(file.path)}`
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
