import admin from "firebase-admin";
import { config } from "dotenv";

config();

// Load Firebase credentials from environment variables
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID!,
  privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID!,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")!,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
  clientId: process.env.FIREBASE_CLIENT_ID!,
  authUri: "https://accounts.google.com/o/oauth2/auth",
  tokenUri: "https://oauth2.googleapis.com/token",
  authProviderX509CertUrl: "https://www.googleapis.com/oauth2/v1/certs",
  clientX509CertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL!,
  universeDomain: "googleapis.com",
};

console.log(
  "Firebase credentials loaded successfully from environment variables"
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
export { db };
