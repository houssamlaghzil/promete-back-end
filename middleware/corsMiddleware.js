import cors from 'cors';

const allowedOrigins = [
    'http://localhost:3000',
    'https://www.xn--mon-projet-numrique-ozb.fr',
    'https://toulouse-adventure.promete-it.fr',
    'https://api.promete-it.fr',
    'https://testnull-edcb5.web.app',
    'https://www.testnull-edcb5.web.app',
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
