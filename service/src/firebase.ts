import admin from "firebase-admin";
import { config } from "dotenv";

config();

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS!);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
export { db };
