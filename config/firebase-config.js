import admin from 'firebase-admin';
import serviceAccount from '../serviceAccountKey.json' assert { type: "json" };

// Initialisation de Firebase Admin SDK pour éviter la duplication
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

// Vous pouvez maintenant exporter Firebase Admin
export default admin;