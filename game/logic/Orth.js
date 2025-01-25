import dotenv from 'dotenv';
import ScoreOrth from "./ScoreOrth.js";

dotenv.config();
const handleOrth = async (req, res) => {
    console.log(req.body);

    // recupperer la value de l'utilisateur et le compar avec la valeur orth {value: "valueorth", orth: "valueorth"}
    const { value, orth } = req.body;
    if (value === orth) {
        res.status(200).json({ message: "Bravo vous avez trouvé la bonne orthographe" });
    }
    // si la valeur de l'utilisateur est differente de la valeur orth mais proche
    else if (value !== orth) {
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
