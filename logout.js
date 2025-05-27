import { firebaseAuth } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(firebaseAuth);
    localStorage.clear();
    window.location.href = "login.html"; // Login page pe redirect karna
  } catch (error) {
    console.error("Error during logout: ", error);
  }
});
