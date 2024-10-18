import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import admin from 'firebase-admin';
import serviceAccount from '../serviceAccountKey.json' assert { type: "json" };

// Initialisation de Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGEBUCKET,
        databaseURL: process.env.FIREBASE_DATABASEURL // Ajoutez la bonne URL ici
    });
}

// Initialisation du SDK Firebase Client
const firebaseConfig = {
    apiKey: process.env.REACT_APP_APIKEY,
    authDomain: process.env.REACT_APP_AUTHDOMAINE,
    projectId: process.env.REACT_APP_PROJECTID,
    storageBucket: process.env.REACT_APP_STORAGEBUCKET,
    messagingSenderId: process.env.REACT_APP_MESSAGINGSENDERID,
    appId: process.env.REACT_APP_APPID,
    databaseURL: process.env.REACT_APP_DATABASEURL // Ajoutez cette ligne pour le SDK Client
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);  // Initialise Firebase Storage
const db = getDatabase(app);      // Initialise Firebase Realtime Database

export { storage, db };
export default admin;