import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const firebaseConfig = useEmulators ? {
  apiKey: "demo-major-mvp-key", authDomain: "localhost", projectId: "demo-major-mvp", appId: "demo-major-mvp",
} : {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (only once)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

if (useEmulators && !globalThis.__majorMvpEmulatorsConnected) {
  connectFirestoreEmulator(db, "127.0.0.1", 8088);
  connectAuthEmulator(auth, "http://127.0.0.1:9098", { disableWarnings: true });
  globalThis.__majorMvpEmulatorsConnected = true;
}

export { app, db, auth };
