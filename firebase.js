import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"; // Add this line

const firebaseConfig = {
  apiKey: "AIzaSyDixIM-z6461DWHE2npR86wTPKSjlaSSbs",
  authDomain: "library-management-syste-d724e.firebaseapp.com",
  projectId: "library-management-syste-d724e",
  storageBucket: "library-management-syste-d724e.appspot.com",
  messagingSenderId: "262821550797",
  appId: "1:262821550797:web:c7e074bcb069b3cbb16784",
  measurementId: "G-8GHN79XSRS"
};

const app = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(app);
const db = getFirestore(app);  

export { firebaseAuth, db };
