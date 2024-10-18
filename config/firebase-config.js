import admin from "firebase-admin";

// Initialisation de Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync('../serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://promete-it-default-rtdb.europe-west1.firebasedatabase.app',
    });
}

export default admin;
