import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8R7oHIw9HvviqprAnfPgDmHtkUDy3vzI",
  authDomain: "vocara-ca2b7.firebaseapp.com",
  projectId: "vocara-ca2b7",
  storageBucket: "vocara-ca2b7.firebasestorage.app",
  messagingSenderId: "609285831853",
  appId: "1:609285831853:web:dbd5a9d06ce5663ecfda24"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
