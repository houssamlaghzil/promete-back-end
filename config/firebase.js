import admin from 'firebase-admin';
import path from 'path';  // Importer path
import { fileURLToPath } from 'url';

// Si vous devez utiliser __dirname dans un module ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utiliser __dirname pour construire le chemin vers le fichier JSON
import serviceAccount from '../serviceAccountKey.json' assert { type: "json" };

// Initialisation de Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGEBUCKET,
        databaseURL: "https://promete-it-default-rtdb.europe-west1.firebasedatabase.app"
    });
}

// Initialisation du SDK Firebase Client
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_APIKEY,
    authDomain: process.env.REACT_APP_AUTHDOMAINE,
    databaseURL: "https://promete-it-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: process.env.REACT_APP_PROJECTID,
    storageBucket: process.env.REACT_APP_STORAGEBUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGINGSENDERID,
    appId: process.env.REACT_APP_APPID,
    measurementId: process.env.REACT_APP_MEASURMENTID
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);  // Initialise Firebase Storage
const db = getDatabase(app);      // Initialise Firebase Realtime Database

export { storage, db };
export default admin;