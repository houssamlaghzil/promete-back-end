// splitTextIntoChunks.js

/**
 * Divise le texte en chunks de taille spécifiée.
 * @param {string} text - Texte à diviser.
 * @param {number} chunkSize - Taille maximale de chaque chunk (en nombre de mots).
 * @param {number} overlap - Nombre de mots en chevauchement entre les chunks.
 * @returns {string[]} - Tableau de chunks de texte.
 */
const splitTextIntoChunks = (text, chunkSize = 500, overlap = 50) => {
    const words = text.split(/\s+/);
    const chunks = [];
    let start = 0;

    while (start < words.length) {
        const end = Math.min(start + chunkSize, words.length);
        const chunk = words.slice(start, end).join(' ');
        chunks.push(chunk);
        start += chunkSize - overlap;
    }

    return chunks;
};

// Exemple d'utilisation (peut être commenté dans le module final)
const sampleText = "Votre texte extrait du PDF...";
const chunks = splitTextIntoChunks(sampleText);
console.log(`Nombre de chunks créés : ${chunks.length}`);

export default splitTextIntoChunks;
