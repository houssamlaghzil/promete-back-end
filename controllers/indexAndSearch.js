// indexAndSearch.js

/**
 * Crée un index simple basé sur les mots-clés pour chaque chunk.
 * @param {string[]} chunks - Tableau de chunks de texte.
 * @returns {Object[]} - Tableau d'objets contenant l'id et le chunk de texte.
 */
const createIndex = (chunks) => {
    return chunks.map((chunk, index) => ({
        id: `chunk-${index}`,
        text: chunk,
    }));
};

/**
 * Recherche les chunks les plus pertinents en fonction des mots-clés de la requête.
 * @param {string} query - La question de l'utilisateur.
 * @param {Object[]} index - L'index des chunks.
 * @param {number} topK - Nombre de résultats à retourner.
 * @returns {string} - Texte des chunks les plus pertinents.
 */
const searchIndex = (query, index, topK = 3) => {
    const queryWords = query.toLowerCase().split(/\s+/);
    const scoredChunks = index.map(chunk => {
        const chunkWords = chunk.text.toLowerCase().split(/\s+/);
        const commonWords = queryWords.filter(word => chunkWords.includes(word));
        return {
            id: chunk.id,
            score: commonWords.length,
            text: chunk.text
        };
    });

    // Trier par score décroissant
    scoredChunks.sort((a, b) => b.score - a.score);

    // Sélectionner les topK chunks
    const topChunks = scoredChunks.slice(0, topK).map(chunk => chunk.text);

    return topChunks.join('\n\n');
};

// Exemple d'utilisation
const chunks = [
    "Chunk 1 text...",
    "Chunk 2 text...",
    // ... autres chunks
];
const index = createIndex(chunks);
const query = "Votre question utilisateur ici";
const relevantInfo = searchIndex(query, index);
console.log('Informations pertinentes :', relevantInfo);

export { createIndex, searchIndex };
