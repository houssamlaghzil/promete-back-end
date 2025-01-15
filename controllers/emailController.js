import nodemailer from 'nodemailer';

const emailController = async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;

        const transporter = nodemailer.createTransport({
            host: 'smtp.office365.com',
            port: 587,
            secure: false, // true pour le port 465
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
            tls: {
                ciphers: 'SSLv3',
            },
        });

        // Test de connexion SMTP
        await transporter.verify();
        console.log('Connexion SMTP réussie !');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html,
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
