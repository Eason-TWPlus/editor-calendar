import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBvQJaeKLJj7mLAO4cJUy_HjoT0cfxRB0k",
  authDomain: "editflow-calendar.firebaseapp.com",
  projectId: "editflow-calendar",
  storageBucket: "editflow-calendar.firebasestorage.app",
  messagingSenderId: "145259527920",
  appId: "1:145259527920:web:000cc0fefaa5ed398b4c35",
  measurementId: "G-GKG70XW7FB"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);