// extractTextFromPDF.js

import fs from 'fs';
import pdf from 'pdf-parse';

/**
 * Extrait le texte d'un fichier PDF.
 * @param {string} pdfPath - Chemin vers le fichier PDF.
 * @returns {Promise<string>} - Texte extrait du PDF.
 */
const extractTextFromPDF = async (pdfPath) => {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    return data.text;
};

// Exemple d'utilisation
const pdfPath = '../data-ia/GO toulouse.pdf';
extractTextFromPDF(pdfPath)
    .then(text => {
        console.log('Texte extrait du PDF :', text);
    })
    .catch(err => {
        console.error('Erreur lors de l\'extraction du texte :', err);
    });

export default extractTextFromPDF;
