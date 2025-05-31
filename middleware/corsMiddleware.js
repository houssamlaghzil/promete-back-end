import cors from 'cors';

const allowedOrigins = [
    'https://www.xn--mon-projet-numrique-ozb.fr', // Nouvelle URL
    'https://xn--mon-projet-numrique-ozb.fr', // Nouvelle URL
    'https://mon-projet-numérique.fr', // Nouvelle URL
    'https://promete-it.fr', // Ancienne URL (si nécessaire)
    'https://cinoji.web.app',
];

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Si vous utilisez des cookies/sessions
};

app.use(cors(corsOptions));
