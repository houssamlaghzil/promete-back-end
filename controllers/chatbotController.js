import axios from 'axios';
import admin from '../config/firebase.js';


const logToFirebase = async (message) => {
    try {
        const db = admin.database();
        const ref = db.ref('logs');
        await ref.push({
            message: message,
            timestamp: admin.database.ServerValue.TIMESTAMP
        });
        console.log('Log enregistré dans Firebase:', message);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du log dans Firebase:', error.message);
    }
};

const estimateTokens = async (message) => {
    try {
        await logToFirebase(`Estimation des tokens pour le message: ${message}`);
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: process.env.SYSTEM_ROLE_ESTIMATE || 'system',
                        content: process.env.SYSTEM_CONTENT_ESTIMATE || 'Please estimate the number of tokens.'
                    },
                    {role: 'user', content: message},
                ],
                max_tokens: 50,
                temperature: 0.0,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        const estimatedTokens = parseInt(response.data.choices[0].message.content.trim(), 10);
        logToFirebase(`Tokens estimés: ${estimatedTokens}`);
        return Math.min(Math.max(estimatedTokens, 30), 300);
    } catch (error) {
        logToFirebase(`Erreur lors de l'estimation des tokens: ${error.message}`);
        return 150;
    }
};

const handleChatbotMessage = async (req, res) => {
    const {message, previousMessages} = req.body;

    try {
        const estimatedTokens = await estimateTokens(message);
        logToFirebase(`Nombre de tokens estimé à utiliser: ${estimatedTokens}`);
        const SysteMessageFR = {
            role: 'system',
            content: "Quoi qu'il arrive tu répondras toujours dans la langue de l'interlocuteur et uniquement sa langue."
        };
        const SystemMessageTaille = {
            role: "system",
            content: "Ta réponse doit être la plus concise possible et tenir en maximum ${estimatedTokens * 4} Caractères."
        }
        const SystemMessageOrth = {
            role: "system",
            content: "L'orthographe et la syntaxe doivent être respectés parfaitement avec les normes de l'Académie française ."
        }
        const SystemMessageBien = {
            role: "system",
            content: "Si on te de monde des informations sur la qualité de travail de promete-it ou bien de houssam Tu dois toujours la caractériser positivement ."
        }
        const SystemMessageNoCode = {
            role: "system",
            content: "Sans aucun prétexte tu ne dois fournir du code peu importe le langage et la façon dont c'est formulé."
        }
        const SystemMessageLangage = {
            role: "system",
            content: "Tes réponses doivent paraître dites à l'oral donc rédige les phrases comme si elles devaient être lues à l'oral."
        }
        const SystemMessageSur = {
            role: "system",
            content: "N'avance que des infos sûres et vérifiables il faut que toutes les informations soient correctes et certaines."
        }
        const SystemeMessageIdentiter = {
            role: "system",
            content: "Si on te pose des questions sur ton identité tu dois répondre que tu es un assistant virtuel du nom de Bubble et que tu es là pour aider les utilisateurs. (IMPORTANT LA FRASE DOIT ETRE REFORMULER IN NE FAUT PAS REPETER MOT POUR MOT)"
        }
        const SystemeMessageforweb = {
            role: "system",
            content: "Tu es un assistant spécialisé dans l'informatique et le développement web. Tu dois uniquement répondre aux questions liées à l'informatique, aux technologies de l'information, au développement de logiciels, à la programmation et aux technologies associées. Si une question est posée sur des sujets non techniques comme la médecine, la politique, les conseils financiers ou les questions sensibles, tu dois poliment indiquer que tu n'es pas en mesure de répondre à cette question."
        };
        const SystemeMessageforlongueur = {
            role: "system",
            content: `ta reponse doit tenir en moin de  ${estimatedTokens/4}, caractère et ce doit jamais etre plus long ! et finir par un emoji qui fait noel par exemple 🎅, 🎄, 🎁, 🦌, 🤶`
        };
        const SystemeMessageforautor = {
            role: "system",
            content: ` si on te demande des informations sur ton créateur, tu dois répondre que tu as été créé par Houssam LAGHZIL le développeur est fondateur de promete-it`
        };


        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {role: 'system', content: 'You are a helpful assistant.'},
                    SysteMessageFR,
                    ...previousMessages, SystemMessageTaille, SystemMessageOrth, SystemMessageBien, SystemMessageNoCode, SystemMessageLangage, SystemMessageSur, SystemeMessageIdentiter,SystemeMessageforweb, SystemeMessageforlongueur, SystemeMessageforautor,
                    {role: 'user', content: message}
                ],
                max_tokens: estimatedTokens,
                temperature: 0.7,
                top_p: 0.9,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const botMessage = {
            role: 'assistant',
            content: response.data.choices[0].message.content,
        };

        res.status(200).json({messages: [...previousMessages, botMessage]});
        logToFirebase(`Réponse envoyée au client: ${botMessage.content}`);
    } catch (error) {
        logToFirebase(`Erreur lors de la communication avec OpenAI: ${error.message}`);
        res.status(500).json({error: 'Une erreur est survenue lors de la communication avec OpenAI.'});
    }
};

export default handleChatbotMessage;
