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
    apiKey: "AIzaSyDpLsFlJEk6oA94wrkHlEn8DuOzg67xNxw",
    authDomain: "promete-it.firebaseapp.com",
    databaseURL: "https://promete-it-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "promete-it",
    storageBucket: "promete-it.appspot.com",
    messagingSenderId: "87937879588",
    appId: "1:87937879588:web:6cb4fd345332b14e76d2b1",
    measurementId: "G-2FZ8GSY02W"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);  // Initialise Firebase Storage
const db = getDatabase(app);      // Initialise Firebase Realtime Database

export { storage, db };
export default admin;