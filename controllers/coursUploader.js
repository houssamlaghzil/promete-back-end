import { storage, db } from '../config/firebase.js';  // Chemin vers firebase.js
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ref as dbRef, set } from 'firebase/database';
import multer from 'multer';
import path from 'path';

// Configure Multer to handle file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }, // Limite de 500 MB
});

// Fonction pour nettoyer le nom du fichier
const sanitizeFileName = (fileName) => {
    return fileName.replace(/[.#$[\]]/g, '_'); // Remplacer les caractères interdits
};

// Upload handler function
const coursUploader = async (req, res) => {
    try {
        // Multer middleware to parse the file from the request
        upload.single('file')(req, res, async (err) => {
            if (err) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File upload error', details: 'File too large. Maximum size is 500 MB.' });
                }
                return res.status(400).json({ error: 'File upload error', details: err.message });
            }

            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: 'No file provided' });
            }

            const { classesAllowed, methods } = req.body; // Metadata from request

            // Nettoyer le nom du fichier avant de l'utiliser dans Firebase Database
            const sanitizedFileName = sanitizeFileName(file.originalname);

            // Define the file path in Firebase Storage
            const storageRef = ref(storage, `courses/${sanitizedFileName}`);

            // Upload the file to Firebase Storage
            const snapshot = await uploadBytes(storageRef, file.buffer, {
                contentType: file.mimetype,
            });

            // Get the download URL for the uploaded file
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Store metadata in Firebase Realtime Database
            const courseData = {
                fileName: sanitizedFileName,
                downloadURL: downloadURL,
                methods: methods || 'Not specified',
                classesAllowed: classesAllowed ? classesAllowed.split(',') : [],
                uploadedAt: new Date().toISOString(),
            };

            // Save course metadata in Firebase Database under 'courses'
            const courseKey = path.basename(sanitizedFileName, path.extname(sanitizedFileName));
            await set(dbRef(db, `courses/${courseKey}`), courseData);

            // Respond with success and file details
            res.status(200).json({
                message: 'Course uploaded successfully',
                courseData,
            });
        });
    } catch (error) {
        console.error('Error uploading course:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

export default coursUploader;