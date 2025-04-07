import admin from "firebase-admin";
import { config } from "dotenv";

config();
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIALS!))
});

const db = admin.firestore();
export { db };
