function ScoreOrth(value, orth) {
    // Retrait des caractères non alphanumériques, mise en minuscule
    value = value.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();
    orth = orth.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();

    // --- Vérification mot par mot ---
    // On divise les chaînes en mots
    const valueWords = value.split(/\s+/);
    const orthWords = orth.split(/\s+/);

    // Vérifie si chaque mot de orth est présent dans value
    const allWordsExist = orthWords.every(word => valueWords.includes(word));

    if (allWordsExist) {
        console.log('Tous les mots de orth sont présents dans value. Score: 100');
        return 100; // Si tous les mots sont présents, on retourne directement 100
    }

    // --- Calcul du score positionnel (lengthScore) ---
    let lengthScore = 0;
    if (value === orth) {
        // Identiques => 100%
        lengthScore = 100;
    } else if (value.length === orth.length) {
        // Même longueur => on compte les caractères identiques aux mêmes positions
        let matches = 0;
        for (let i = 0; i < value.length; i++) {
            if (value[i] === orth[i]) {
                matches++;
            }
        }
        lengthScore = (matches / value.length) * 100;
    } else {
        // Longueurs différentes => on peut considérer 0, ou un autre calcul
        lengthScore = 0;
    }

    // --- Calcul du score de similitude globale (similarityScore) ---
    // Combien de caractères de value sont présents, peu importe la position, dans orth
    let totalMatches = 0;
    for (let i = 0; i < value.length; i++) {
        if (orth.includes(value[i])) {
            totalMatches++;
        }
    }
    let similarityScore = (totalMatches / value.length) * 100;

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
