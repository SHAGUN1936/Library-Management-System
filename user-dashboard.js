import { firebaseAuth as auth, db } from "./firebaseConfig.js";
import {
  collection, getDocs, updateDoc, doc, getDoc,
  query, where, orderBy, arrayUnion, arrayRemove,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const DEBUG_MODE = true;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  if (DEBUG_MODE) console.log("Dashboard initializing...");

  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("bookSearch").addEventListener("input", handleBookSearch);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", function () {
      const tabId = this.getAttribute("data-tab");

      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      this.classList.add("active");
      document.getElementById(tabId).classList.add("active");

      if (tabId === "available-books") loadAvailableBooks();
      else if (tabId === "borrowed-books") loadBorrowedBooks();
      else if (tabId === "reserved-books") loadReservedBooks();
    });
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      document.getElementById("userEmail").textContent = user.email;

      try {
        await Promise.all([
          loadAvailableBooks(),
          loadBorrowedBooks(),
          loadReservedBooks()
        ]);
        updateStats();
      } catch (error) {
        console.error("Initial load error:", error);
        showToast("Error loading data. Please refresh.", "error");
      }
    } else {
      window.location.href = "login.html";
    }
  });
});

async function loadAvailableBooks() {
  try {
    const q = query(collection(db, "books"), where("status", "==", "available"), orderBy("title"));
    const snapshot = await getDocs(q);
    const booksList = document.getElementById("availableBooksList");
    booksList.innerHTML = "";

    if (snapshot.empty) {
      booksList.innerHTML = `<div class="empty-state">
        <i class="fas fa-book-open"></i>
        <h3>No Books Available</h3>
        <p>All books are currently checked out.</p>
      </div>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const bookData = docSnap.data();
      renderBookCard({
        id: docSnap.id,
        title: bookData.title || "Untitled",
        author: bookData.author || "Unknown",
        price: bookData.price || 0,
        status: "available"
      }, "availableBooksList");
    });

  } catch (error) {
    console.error("Available books error:", error);
    showToast("Error loading available books", "error");
  }
}

async function loadBorrowedBooks() {
  try {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const borrowedBooks = userSnap.data()?.borrowedBooks || [];
    const booksList = document.getElementById("borrowedBooksList");
    booksList.innerHTML = "";

    if (borrowedBooks.length === 0) {
      booksList.innerHTML = `<div class="empty-state">
        <i class="fas fa-clipboard-list"></i>
        <h3>No Borrowed Books</h3>
        <p>You haven't borrowed any books yet.</p>
      </div>`;
      return;
    }

    for (const book of borrowedBooks) {
      const bookRef = doc(db, "books", book.bookId);
      const bookSnap = await getDoc(bookRef);
      if (bookSnap.exists()) {
        const data = bookSnap.data();
        renderBookCard({
          id: book.bookId,
          title: data.title,
          author: data.author,
          price: data.price,
          status: "borrowed",
          borrowedDate: book.borrowedDate,
          dueDate: book.dueDate
        }, "borrowedBooksList");
      }
    }

  } catch (error) {
    console.error("Borrowed books error:", error);
    showToast("Error loading borrowed books", "error");
  }
}

async function loadReservedBooks() {
  try {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const reservedBooks = userSnap.data()?.reservedBooks || [];
    const booksList = document.getElementById("reservedBooksList");
    booksList.innerHTML = "";

    if (reservedBooks.length === 0) {
      booksList.innerHTML = `<div class="empty-state">
        <i class="fas fa-clock"></i>
        <h3>No Reserved Books</h3>
        <p>You haven't reserved any books yet.</p>
      </div>`;
      return;
    }

    for (const book of reservedBooks) {
      const bookRef = doc(db, "books", book.bookId);
      const bookSnap = await getDoc(bookRef);
      if (bookSnap.exists()) {
        const data = bookSnap.data();
        renderBookCard({
          id: book.bookId,
          title: data.title,
          author: data.author,
          price: data.price,
          status: "reserved",
          reservedDate: book.reservedDate
        }, "reservedBooksList");
      }
    }

  } catch (error) {
    console.error("Reserved books error:", error);
    showToast("Error loading reserved books", "error");
  }
}

function renderBookCard(book, targetList) {
  const booksList = document.getElementById(targetList);
  if (!booksList) return;

  const card = document.createElement("div");
  card.className = "book-card";

  if (book.status === "available") {
    card.innerHTML = `
      <div class="book-cover"><i class="fas fa-book"></i></div>
      <div class="book-details">
        <h3>${book.title}</h3>
        <p>By ${book.author}</p>
        <p class="price">₹${book.price.toFixed(2)}</p>
        <span class="status available">Available</span>
        <div class="actions">
          <button class="btn borrow" data-id="${book.id}"><i class="fas fa-hand-holding"></i> Borrow</button>
          <button class="btn reserve" data-id="${book.id}"><i class="fas fa-clock"></i> Reserve</button>
        </div>
      </div>
    `;
  } else if (book.status === "borrowed") {
    const dueDate = book.dueDate?.toDate?.() || new Date();
    const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
    card.innerHTML = `
      <div class="book-cover"><i class="fas fa-book"></i></div>
      <div class="book-details">
        <h3>${book.title}</h3>
        <p>By ${book.author}</p>
        <p class="price">₹${book.price.toFixed(2)}</p>
        <span class="status borrowed">Borrowed</span>
        <div class="meta">
          <p><strong>Due:</strong> <span class="${daysLeft <= 0 ? 'overdue' : ''}">
            ${dueDate.toLocaleDateString()} (${daysLeft <= 0 ? Math.abs(daysLeft) + ' days overdue' : daysLeft + ' days left'})
          </span></p>
        </div>
        <button class="btn return" data-id="${book.id}"><i class="fas fa-undo"></i> Return</button>
      </div>
    `;
  } else if (book.status === "reserved") {
    const reservedDate = book.reservedDate?.toDate?.() || new Date();
    card.innerHTML = `
      <div class="book-cover"><i class="fas fa-book"></i></div>
      <div class="book-details">
        <h3>${book.title}</h3>
        <p>By ${book.author}</p>
        <p class="price">₹${book.price.toFixed(2)}</p>
        <span class="status reserved">Reserved</span>
        <div class="meta">
          <p><strong>Reserved on:</strong> ${reservedDate.toLocaleDateString()}</p>
        </div>
        <button class="btn cancel-reservation" data-id="${book.id}">
          <i class="fas fa-times-circle"></i> Cancel
        </button>
      </div>
    `;
  }

  booksList.appendChild(card);

  card.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const bookId = e.currentTarget.getAttribute("data-id");
      const action = e.currentTarget.classList.contains("borrow") ? "borrow" :
        e.currentTarget.classList.contains("reserve") ? "reserve" :
        e.currentTarget.classList.contains("return") ? "return" :
        e.currentTarget.classList.contains("cancel-reservation") ? "cancel" : null;

      try {
        if (action === "borrow") await borrowBook(bookId);
        else if (action === "reserve") await reserveBook(bookId);
        else if (action === "return") await returnBook(bookId);
        else if (action === "cancel") await cancelReservation(bookId);
      } catch (err) {
        console.error(`${action} error:`, err);
        showToast(`Error: ${err.message}`, "error");
      }
    });
  });
}

async function borrowBook(bookId) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  await updateDoc(doc(db, "books", bookId), {
    status: "borrowed",
    borrowedBy: currentUser.uid,
    dueDate: Timestamp.fromDate(dueDate)
  });

  await updateDoc(doc(db, "users", currentUser.uid), {
    borrowedBooks: arrayUnion({
      bookId,
      borrowedDate: Timestamp.now(),
      dueDate: Timestamp.fromDate(dueDate)
    })
  });

  showToast("Book borrowed successfully!");
  await Promise.all([loadAvailableBooks(), loadBorrowedBooks()]);
  updateStats();
}

async function reserveBook(bookId) {
  await updateDoc(doc(db, "books", bookId), {
    status: "reserved",
    reservedBy: currentUser.uid
  });

  await updateDoc(doc(db, "users", currentUser.uid), {
    reservedBooks: arrayUnion({
      bookId,
      reservedDate: Timestamp.now()
    })
  });

  showToast("Book reserved successfully!");
  await Promise.all([loadAvailableBooks(), loadReservedBooks()]);
  updateStats();
}

async function returnBook(bookId) {
  await updateDoc(doc(db, "books", bookId), {
    status: "available",
    borrowedBy: null,
    dueDate: null
  });

  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
  const updated = userSnap.data()?.borrowedBooks?.filter(b => b.bookId !== bookId) || [];

  await updateDoc(userRef, { borrowedBooks: updated });

  showToast("Book returned successfully!");
  await Promise.all([loadAvailableBooks(), loadBorrowedBooks()]);
  updateStats();
}

async function cancelReservation(bookId) {
  await updateDoc(doc(db, "books", bookId), {
    status: "available",
    reservedBy: null
  });

  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
  const updated = userSnap.data()?.reservedBooks?.filter(b => b.bookId !== bookId) || [];

  await updateDoc(userRef, { reservedBooks: updated });

  showToast("Reservation cancelled!");
  await Promise.all([loadAvailableBooks(), loadReservedBooks()]);
  updateStats();
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function handleBookSearch(e) {
  const term = e.target.value.toLowerCase();
  const activeTab = document.querySelector(".tab-content.active").id;
  const cards = document.querySelectorAll(`#${activeTab} .book-card`);

  cards.forEach(card => {
    const title = card.querySelector("h3").textContent.toLowerCase();
    const author = card.querySelector("p").textContent.toLowerCase();
    card.style.display = (title.includes(term) || author.includes(term)) ? "block" : "none";
  });
}

async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    showToast("Logout failed", "error");
  }
}

async function updateStats() {
  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);
  const borrowedBooks = userSnap.data()?.borrowedBooks || [];

  document.getElementById("borrowedCount").textContent = borrowedBooks.length;

  const today = new Date();
  let dueSoon = 0;
  let fines = 0;

  borrowedBooks.forEach(book => {
    const due = book.dueDate?.toDate?.() || new Date();
    const daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3 && daysLeft >= 0) dueSoon++;
    if (daysLeft < 0) fines += Math.abs(daysLeft) * 10;
  });

  document.getElementById("dueCount").textContent = dueSoon;
  document.getElementById("fineAmount").textContent = `₹${fines}`;
}
