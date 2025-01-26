function ScoreOrth(value, orth) {
    // Nettoyage des caractères spéciaux mais conservation des espaces
    value = value.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();
    orth = orth.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();

    // --- Vérification mot par mot ---
    const valueWords = value.split(/\s+/);
    const orthWords = orth.split(/\s+/);

    // Vérifie si chaque mot de orth est présent dans value
    const allWordsExist = orthWords.every(word => valueWords.includes(word));

    if (allWordsExist) {
        console.log('Tous les mots de orth sont présents dans value. Score: 100');
        return 100; // Retourne directement 100 si tous les mots sont présents
    }

    // --- Calcul du score positionnel (lengthScore) ---
    let lengthScore = 0;
    if (value === orth) {
        lengthScore = 100; // Identiques => 100%
    } else {
        // On compare en ignorant les positions des espaces
        const valueNoSpaces = value.replace(/\s+/g, '');
        const orthNoSpaces = orth.replace(/\s+/g, '');

        if (valueNoSpaces === orthNoSpaces) {
            lengthScore = 100; // Les chaînes sont identiques si on ignore les espaces
        } else if (valueNoSpaces.length === orthNoSpaces.length) {
            // Comparaison caractère par caractère
            let matches = 0;
            for (let i = 0; i < valueNoSpaces.length; i++) {
                if (valueNoSpaces[i] === orthNoSpaces[i]) {
                    matches++;
                }
            }
            lengthScore = (matches / valueNoSpaces.length) * 100;
        } else {
            lengthScore = 0; // Longueurs différentes => score 0
        }
    }

    // --- Calcul du score de similitude globale (similarityScore) ---
    // On compare les caractères peu importe leur position
    let totalMatches = 0;
    const valueChars = [...value.replace(/\s+/g, '')];
    const orthChars = [...orth.replace(/\s+/g, '')];

    for (let char of valueChars) {
        if (orthChars.includes(char)) {
            totalMatches++;
        }
    }
    let similarityScore = (totalMatches / valueChars.length) * 100;

    // --- Combinaison des deux scores ---
    let finalScore = (lengthScore * similarityScore) / 100;

    console.log(
        'Score positionnel:', lengthScore,
        '| Score similarité:', similarityScore,
        '| Score final:', finalScore
    );

    return finalScore;
}

export default ScoreOrth;
