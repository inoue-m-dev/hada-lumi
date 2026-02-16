import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const hasFirebaseConfig =
  !!firebaseConfig.apiKey &&
  !!firebaseConfig.authDomain &&
  !!firebaseConfig.projectId;

let authInstance: Auth | null = null;

export const getFirebaseAuth = (): Auth | null => {
  if (authInstance) return authInstance;
  if (typeof window === "undefined") return null;
  if (!hasFirebaseConfig) return null;

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  authInstance = getAuth(app);
  return authInstance;
};
