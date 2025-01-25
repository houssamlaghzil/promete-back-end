//Ici il y a une fonction qui définit un score en fonction des similarités entre 2 mots ces 2 mots se trouvent dans 2 variables différentes et une comparation sémantique Doit lui attribuer à un pourcentage de similarité et le retourner sous forme de la variable scoreoth

function ScoreOrth(value, orth) {
    let scoreoth;

    //Les 2 variables doivent être traitées avant d'être comparés tous les caractères spéciaux sont retirés et tous les espaces aussi
    value = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    orth = orth.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();


    //Si les 2 variables sont identiques alors le score est de 100%
    let scoreothlength = 0;
    if (value === orth) {
        scoreothlength = 100;
    } else if (value !== orth && value.length === orth.length) {
        let score = 0;
        for (let i = 0; i < value.length; i++) {
            if (value[i] === orth[i]) {
                score += 1;
            }
        }
        scoreothlength = (score / value.length) * 100;
        console.log('scoreothlength ' + scoreothlength);
    }

    //Maintenant on doit vérifier la quantité de lettre similaire de ces 2 variables Et retourner une valeur en pourcentage
    let scoreothsimilarity = 0;
    for (let i = 0; i < value.length; i++) {
        if (orth.includes(value[i])) {
            scoreothsimilarity += 1;
        }else {
            scoreothsimilarity += 0;
        }
        scoreothsimilarity = (scoreothsimilarity / value.length) * 100;
        console.log('scoreothsimilarity ' + scoreothsimilarity);
    }
    return scoreoth = scoreothlength * scoreothsimilarity;
}

export default ScoreOrth;
