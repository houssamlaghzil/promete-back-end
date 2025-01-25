import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import ScoreOrth from "./ScoreOrth.js";

// Gestion de l'ESM pour __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const handleOrth = async (req, res) => {
    // recupperer la value de l'utilisateur et le compar avec la valeur orth {value: "valueorth", orth: "valueorth"}
    const { value, orth } = req.body;
    if (value === orth) {
        res.status(200).json({ message: "Bravo vous avez trouvé la bonne orthographe" });
    }
    // si la valeur de l'utilisateur est differente de la valeur orth mais proche
    else if (value !== orth && value.length === orth.length) {
        // verifier avec la fonction ScoreOrth
        let score = ScoreOrth(value, orth);
        console.log("score " + score);
        switch (score) {
            case score >= 70:
                res.status(200).json({ message: "Vous avez trouvé une orthographe proche" });
                break;
            case score < 70:
                res.status(200).json({ message: "Vous avez trouvé une orthographe pas assez proche" });
                break;
            default:
                res.status(200).json({ message: "Vous avez trouvé une orthographe pas proche" });
        }
    }
}

export default handleOrth;
