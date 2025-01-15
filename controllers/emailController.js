import nodemailer from 'nodemailer';

const emailController = async (req, res) => {
    try {
        // Récupérer les champs depuis le corps de la requête
        const { to, subject, text, html } = req.body;

        // Configurer le transport pour Microsoft 365 (Office 365)
        const transporter = nodemailer.createTransport({
            host: 'smtp.office365.com',
            port: 587,         // Port STARTTLS
            secure: false,     // false pour 587 (STARTTLS)
            auth: {
                user: 'conact@promete-it.fr',    // Votre adresse email pro
                pass: 'VOTRE_MOT_DE_PASSE',      // Votre mot de passe ou mot de passe d'application
            },
            tls: {
                ciphers: 'SSLv3',
            },
        });

        // --- TEST DE CONNEXION (transporter.verify) ---
        // Cela va vérifier que vos identifiants et la config SMTP sont corrects.
        await transporter.verify();
        console.log('Connexion SMTP réussie !');

        // -- Envoyer l'email --
        const mailOptions = {
            from: 'conact@promete-it.fr', // L'adresse e-mail d'envoi
            to,                           // Destinataire(s)
            subject,                      // Sujet
            text,                         // Contenu en texte brut
            html,                         // Contenu HTML (si fourni)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email envoyé avec succès:', info.messageId);

        return res.status(200).json({
            message: 'Email envoyé avec succès.',
            connection: 'Connexion SMTP réussie !',
            emailInfo: info.messageId
        });
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);

        // Séparer l’erreur de connexion de l’erreur d’envoi
        if (error && error.message && error.message.includes('Invalid login')) {
            return res.status(401).json({
                message: 'Échec de la connexion SMTP. Vérifiez vos identifiants.',
                error: error.message,
            });
        }

        return res.status(500).json({
            message: 'Une erreur est survenue lors de l\'envoi de l\'email.',
            error: error.message,
        });
    }
};

export default emailController;
