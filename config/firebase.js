import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import admin from 'firebase-admin';
import serviceAccount from '../serviceAccountKey.json'; // chemin vers votre serviceAccountKey.json

// Initialisation de Firebase Admin SDK pour l'accès aux services Firestore et Realtime Database
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET // Assurez-vous d'ajouter cette variable dans votre .env
});

// Initialisation du SDK Firebase Client
const firebaseConfig = {
    apiKey: process.env.REACT_APP_APIKEY,
    authDomain: process.env.REACT_APP_AUTHDOMAINE,
    projectId: process.env.REACT_APP_PROJECTID,
    storageBucket: process.env.REACT_APP_STORAGEBUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGINGSENDERID,
    appId: process.env.REACT_APP_APPID,
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);  // Initialise Firebase Storage
const db = getDatabase(app);      // Initialise Firebase Realtime Database

export { storage, db };