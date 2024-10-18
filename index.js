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
app.post('/api/upload/cours',coursUploader)


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

// Fonction pour supprimer un fichier
const deleteFile = (filePath) => {
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`Erreur lors de la suppression du fichier ${filePath}:`, err.message);
        } else {
            console.log(`Fichier supprimé: ${filePath}`);
        }
    });
};

// Fonction pour supprimer les fichiers les plus anciens si le nombre total dépasse 40
const cleanupOldFiles = () => {
    const directory = path.join(__dirname, 'uploads');
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error('Erreur lors de la lecture du dossier uploads:', err.message);
            return;
        }

        if (files.length > 40) {
            // Récupérer les détails des fichiers (nom + temps de modification)
            const fileDetails = files.map(file => {
                const filePath = path.join(directory, file);
                const stats = fs.statSync(filePath);
                return { filePath, mtime: stats.mtime.getTime() };
            });

            // Trier les fichiers par temps de modification (le plus ancien en premier)
            fileDetails.sort((a, b) => a.mtime - b.mtime);

            // Supprimer les fichiers les plus anciens jusqu'à ce que le total soit <= 40
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

        // Planifier la suppression du fichier après 15 minutes
        setTimeout(() => deleteFile(file.path), 15 * 60 * 1000);

        const result = await fileTypeDetection(file);
        if (result.error) {
            console.error('Error in fileTypeDetection:', result.error);
            return res.status(400).json(result);
        }

        // Vérifier et nettoyer les fichiers anciens si nécessaire
        cleanupOldFiles();

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

        // Planifier la suppression du fichier après 15 minutes
        setTimeout(() => deleteFile(file.path), 15 * 60 * 1000);

        const conversionResult = await fileConversion(file);
        if (conversionResult.error) {
            console.error('Error in fileConversion:', conversionResult.error);
            return res.status(400).json(conversionResult);
        }

        // Planifier la suppression des fichiers convertis après 15 minutes
        conversionResult.convertedFiles.forEach(convertedFile => {
            setTimeout(() => deleteFile(convertedFile.path), 15 * 60 * 1000);
        });

        // Vérifier et nettoyer les fichiers anciens si nécessaire
        cleanupOldFiles();

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
