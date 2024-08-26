import admin from "firebase-admin";
import serviceAccount from '../serviceAccountKey.json' assert { type: 'json' }; // Ajout de l'assertion JSON

// Initialisation de Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://promete-it-default-rtdb.europe-west1.firebasedatabase.app',
    });
}

export default admin;
