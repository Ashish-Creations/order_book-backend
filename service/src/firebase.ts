import admin from "firebase-admin";
import { config } from "dotenv";

config();

// Load Firebase credentials from the JSON file
import path from "path";
const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

console.log(
  "Firebase credentials loaded successfully from serviceAccountKey.json"
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
export { db };
