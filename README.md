# Library-Management-System

1. Introduction
The Library Management System is a web-based application designed to automate library operations such as book tracking, borrowing, and user management. It uses Firebase for authentication and real-time database management, with a frontend built using HTML, CSS, and JavaScript.

Key Features
Role-Based Access:

Librarian: Add, delete, and manage books.

User: Borrow, reserve, and return books.

Real-Time Updates: Firebase ensures instant data sync.
Responsive UI: Works on desktop and mobile.
Book Status Tracking: Available, Borrowed, or Reserved.


######################################################################################################################


2. System Architecture
Frontend (Client-Side)
HTML5 → Structure

CSS3 → Styling

JavaScript (ES6+) → Dynamic functionality

Firebase SDK → Authentication & Database

Backend (Firebase Services)
Firebase Authentication → User login/signup

Firestore Database → Stores books, users

Security Rules → Role-based data access

########################################################################################################################


3. Functional Requirements
Librarian Functions
Feature	Description
Add Book	Add new books with title, author, price, and quantity.
Delete Book	Remove books if they are available or reserved.
View All Books	Filter by status (Available/Borrowed/Reserved).
Mark as Returned	Update book status when returned by a user.
User Functions
Feature	Description
Borrow Book	Check out available books.
Reserve Book	Place a hold if the book is borrowed.
Return Book	Submit borrowed books before the due date.
Track Reservations	See due dates and overdue alerts.

########################################################################################################################


4. Database Structure (Firestore Collections)
   
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
const db = getFirestore(app);  // Initialize Firestore

export { firebaseAuth, db }; // Export both auth and db


########################################################################################################################


5. Setup & Installation
Prerequisites
Firebase Project (Enable Authentication & Firestore)

Web Hosting (Vercel, Firebase Hosting, or GitHub Pages)

Steps to Run
Clone the Repository

bash
git clone https://github.com/shagunagrawal2804/Library-Management-System
cd library-management-system
Configure Firebase

Replace Firebase config in firebaseConfig.js.

Set Firestore Security Rules (sample below).

Deploy

Host on Vercel/Firebase or run locally using Live Server.

########################################################################################################################


6. Demo

Login Page (Role selection)

Librarian Dashboard (Add/Delete books)

User Dashboard (Borrow/Return flow)

########################################################################################################################



7. Future Enhancements
Late Fee Calculator → Automatic penalty for overdue books.

Email Notifications → Alerts for due dates.

Multi-Library Support → Scale for multiple branches.

########################################################################################################################



8. Conclusion
This system replaces manual library workflows with a secure, scalable, and user-friendly digital solution. It reduces human errors and improves efficiency for both librarians and users.
