import admin from "firebase-admin";
import serviceAccount from '../serviceAccountKey.json';  // Assurez-vous que le chemin est correct

// Initialisation de Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://promete-it-default-rtdb.europe-west1.firebasedatabase.app',
    });
}

export default admin;
