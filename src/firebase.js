import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDbsPiyIWinQerxON937oiz8Vi-LxI4boQ",
  authDomain: "katara-bridgelab.firebaseapp.com",
  projectId: "katara-bridgelab",
  storageBucket: "katara-bridgelab.firebasestorage.app",
  messagingSenderId: "830826638028",
  appId: "1:830826638028:web:f9e49e6ce99dcebe09b069"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
