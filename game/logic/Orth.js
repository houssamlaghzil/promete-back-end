import dotenv from 'dotenv';
import ScoreOrth from "./ScoreOrth.js";

dotenv.config();

const handleOrth = async (req, res) => {
    console.log("[handleOrth] Corps de la requête :", req.body);

    const { value, orth } = req.body;

    // Vérification basique des champs
    if (!value || !orth) {
        return res.status(400).json({
            message: "Requête invalide. Les champs 'value' et 'orth' sont requis."
        });
    }

    // Cas 1 : Les deux valeurs sont identiques
    if (value === orth) {
        return res.status(200).json({
            message: "Bravo vous avez trouvé la bonne orthographe"
        });
    }

    // Cas 2 : On calcule le score avec ScoreOrth
    const score = ScoreOrth(value, orth);
    console.log("[handleOrth] Score obtenu :", score);

    // Utilisation d'un switch pour des conditions booléennes
    switch (true) {
        case (score >= 50):
            return res.status(200).json({
                message: "Vous avez trouvé une orthographe proche"
            });
        case (score >= 20):
            return res.status(200).json({
                message: "Vous avez trouvé une orthographe pas assez proche"
            });
        default:
            // score < 20
            return res.status(200).json({
                message: "Vous avez trouvé une orthographe pas proche"
            });
    }
};

export default handleOrth;
