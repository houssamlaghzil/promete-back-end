import admin from "firebase-admin";
const serviceAccount = require('/serviceAccountKey.json');

export default {
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://promete-it-default-rtdb.europe-west1.firebasedatabase.app',
};
