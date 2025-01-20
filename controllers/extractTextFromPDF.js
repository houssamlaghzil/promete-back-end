// extractTextFromPDF.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

// Pour obtenir __dirname dans les modules ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extrait le texte d'un fichier PDF.
 * @param {string} pdfPath - Chemin vers le fichier PDF.
 * @returns {Promise<string>} - Texte extrait du PDF.
 */
const extractTextFromPDF = async (pdfPath) => {
    try {
        // Construire le chemin absolu
        const absolutePath = path.resolve(__dirname, pdfPath);
        console.log(`Tentative de lecture du fichier PDF à : ${absolutePath}`); // Log ajouté

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Le fichier PDF n'existe pas à l'emplacement spécifié : ${absolutePath}`);
        }

        const dataBuffer = fs.readFileSync(absolutePath);
        const data = await pdf(dataBuffer);
        return data.text;
    } catch (error) {
        console.error('Erreur lors de l\'extraction du texte du PDF :', error.message);
        throw error;
    }
};

// Exemple d'utilisation (peut être commenté dans le module final)
const pdfRelativePath = './test/data/05-versions-space.pdf';
extractTextFromPDF(pdfRelativePath)
    .then(text => {
        console.log('Texte extrait du PDF :', text);
    })
    .catch(err => {
        console.error('Erreur lors de l\'extraction du texte :', err);
    });

export default extractTextFromPDF;
