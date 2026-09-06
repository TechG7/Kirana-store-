import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAoxZ4E_9cPSGQAJ9LoWWfpNMMwz3jI12g",
  authDomain: "kirana-store-7266a.firebaseapp.com",
  projectId: "kirana-store-7266a",
  storageBucket: "kirana-store-7266a.firebasestorage.app",
  messagingSenderId: "884573456752",
  appId: "1:884573456752:web:ca15e3ce1d3f30c255a7b5",
  measurementId: "G-1LF9BCQT7R"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
