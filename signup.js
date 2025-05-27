import { firebaseAuth } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const db = getFirestore();

const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = localStorage.getItem("role");

  try {
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      role: role
    });
    alert("Sign up successful!");
    window.location.href = "login.html";
  } catch (error) {
    alert("Sign up failed: " + error.message);
  }
});
