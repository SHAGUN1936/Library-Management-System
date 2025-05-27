import { firebaseAuth } from "./firebase.js";

import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Firestore instance
const db = getFirestore();

// Get the login form element
const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Get user input values
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = localStorage.getItem("role");  // Retrieve the role from local storage

  if (!role) {
    alert("Role is not set in localStorage. Please select the role before login.");
    return;
  }

  try {
    // Sign in the user
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const user = userCredential.user;

    // Fetch the user document from Firestore
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = docSnap.data();

      // Check if the role matches
      if (userData.role === role) {
        alert("Login successful!");
        window.location.href = `${role}-dashboard.html`;  // Redirect to role-based dashboard
      } else {
        alert("Role mismatch. Please log in with the correct role.");
      }
    } else {
      alert("No user document found in Firestore.");
    }
  } catch (error) {
    alert("Login failed: " + error.message);
  }
});
