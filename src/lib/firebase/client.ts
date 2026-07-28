"use client";

/**
 * Firebase Web SDK — client-side identity provider.
 *
 * The browser signs users in here (email/password) and hands the resulting
 * Firebase ID token to our API routes. The server verifies that token with the
 * Admin SDK (see ./admin.ts) and then mints the app's own `sm_session` JWT, so
 * the rest of the app's auth (middleware, requireUser) is unchanged.
 *
 * Config values fall back to the project literals so the app works out of the
 * box, but every field can be overridden via NEXT_PUBLIC_FIREBASE_* env vars.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAkmTDYux0T9bO2mToXQKmEVUX2CwHOnjM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "wowdev.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "wowdev",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "wowdev.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "355642288534",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:355642288534:web:ae7d1c129262a39dd815b7",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CKEHH3STSQ",
};

// Guard against re-initialising during Fast Refresh / multiple imports.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
