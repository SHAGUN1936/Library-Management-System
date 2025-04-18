import { firebaseAuth } from "../firebaseConfig.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const db = getFirestore();
let currentUser = null;

const addBookModal = document.getElementById("addBookModal");
const bookDetailsModal = document.getElementById("bookDetailsModal");
const addBookForm = document.getElementById("addBookForm");
const logoutBtn = document.getElementById("logoutBtn");

document.addEventListener("DOMContentLoaded", () => {
  logoutBtn.addEventListener("click", handleLogout);
  document.getElementById("bookSearch").addEventListener("input", handleBookSearch);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");

      if (btn.dataset.tab === "all-books") loadAllBooks();
      if (btn.dataset.tab === "borrowed-books") loadBorrowedBooks();
      if (btn.dataset.tab === "reserved-books") loadReservedBooks();
    });
  });

  document.getElementById("addBookBtn").addEventListener("click", () => {
    addBookModal.classList.add("active");
  });

  document.querySelectorAll(".close-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      addBookModal.classList.remove("active");
      bookDetailsModal.classList.remove("active");
    });
  });

  onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      currentUser = user;
      document.getElementById("userEmail").textContent = user.email;
      loadAllBooks();
    } else {
      window.location.href = "login.html";
    }
  });
});

addBookForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("bookTitle").value;
  const author = document.getElementById("bookAuthor").value;
  const price = parseFloat(document.getElementById("bookPrice").value);
  const quantity = parseInt(document.getElementById("bookQuantity").value);

  try {
    const booksRef = collection(db, "books");
    for (let i = 0; i < quantity; i++) {
      await addDoc(booksRef, {
        title,
        author,
        price,
        status: "available",
        addedDate: Timestamp.now(),
        borrowedBy: null,
        reservedBy: [],
        dueDate: null
      });
    }

    showToast(`Added ${quantity} copy/copies of "${title}"`);
    addBookForm.reset();
    addBookModal.classList.remove("active");
    loadAllBooks();
  } catch (error) {
    console.error("Error adding book:", error);
    showToast("Error adding book: " + error.message, "error");
  }
});

async function loadAllBooks() {
  try {
    const q = query(collection(db, "books"), orderBy("title"));
    const snapshot = await getDocs(q);
    const booksList = document.getElementById("allBooksList");
    booksList.innerHTML = "";

    if (snapshot.empty) {
      booksList.innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i><h3>No Books Found</h3><p>There are currently no books in the library.</p></div>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const book = { id: docSnap.id, ...docSnap.data() };
      renderBookCard(book, "allBooksList");
    });
  } catch (error) {
    console.error("Error loading books:", error);
    showToast("Error loading books: " + error.message, "error");
  }
}

async function loadBorrowedBooks() {
  try {
    const q = query(collection(db, "books"), where("status", "==", "borrowed"));
    const snapshot = await getDocs(q);
    const booksList = document.getElementById("borrowedBooksList");
    booksList.innerHTML = "";

    if (snapshot.empty) {
      booksList.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard-list"></i><h3>No Borrowed Books</h3><p>There are currently no borrowed books.</p></div>`;
      return;
    }

    for (const docSnap of snapshot.docs) {
      const book = { id: docSnap.id, ...docSnap.data() };
      let borrowerInfo = "Unknown user";
      if (book.borrowedBy) {
        const userSnap = await getDoc(doc(db, "users", book.borrowedBy));
        if (userSnap.exists()) {
          borrowerInfo = userSnap.data().email || book.borrowedBy;
        }
      }
      renderBookCard(book, "borrowedBooksList", borrowerInfo);
    }
  } catch (error) {
    console.error("Error loading borrowed books:", error);
    showToast("Error loading borrowed books: " + error.message, "error");
  }
}

async function loadReservedBooks() {
  try {
    const q = query(collection(db, "books"));
    const snapshot = await getDocs(q);
    const booksList = document.getElementById("reservedBooksList");
    booksList.innerHTML = "";

    const reservedBooks = snapshot.docs.filter(docSnap => {
      const data = docSnap.data();
      return Array.isArray(data.reservedBy) && data.reservedBy.length > 0;
    });

    if (reservedBooks.length === 0) {
      booksList.innerHTML = `<div class="empty-state"><i class="fas fa-clock"></i><h3>No Reserved Books</h3><p>There are currently no reserved books.</p></div>`;
      return;
    }

    for (const docSnap of reservedBooks) {
      const book = { id: docSnap.id, ...docSnap.data() };
      const reservers = [];
      for (const userId of book.reservedBy) {
        const userSnap = await getDoc(doc(db, "users", userId));
        reservers.push(userSnap.exists() ? userSnap.data().email : userId);
      }
      renderBookCard(book, "reservedBooksList", reservers.join(", "));
    }
  } catch (error) {
    console.error("Error loading reserved books:", error);
    showToast("Error loading reserved books: " + error.message, "error");
  }
}

function renderBookCard(book, targetList, additionalInfo = null) {
  const booksList = document.getElementById(targetList);
  const bookCard = document.createElement("div");
  bookCard.className = "book-card";

  let statusBadge = "";
  if (book.status === "available") statusBadge = `<span class="book-status status-available">Available</span>`;
  else if (book.status === "borrowed") statusBadge = `<span class="book-status status-borrowed">Borrowed</span>`;
  else if (book.status === "reserved") statusBadge = `<span class="book-status status-reserved">Reserved</span>`;

  let dueDateInfo = "";
  if (book.dueDate && book.status === "borrowed") {
    const dueDate = book.dueDate.toDate();
    const today = new Date();
    const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    dueDateInfo = `
      <div class="meta-item"><span class="meta-label">Due Date</span><span class="meta-value due-date">${dueDate.toLocaleDateString()}</span></div>
      <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value ${daysLeft <= 0 ? 'overdue' : ''}">${daysLeft <= 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}</span></div>
    `;
  }

  let additionalInfoHtml = "";
  if (additionalInfo) {
    additionalInfoHtml = `
      <div class="meta-item"><span class="meta-label">${book.status === "borrowed" ? "Borrowed By" : "Reserved By"}</span><span class="meta-value">${additionalInfo}</span></div>
    `;
  }

  bookCard.innerHTML = `
    <div class="book-header">
      <h3 class="book-title">${book.title}</h3>
      <span class="book-price">₹${book.price.toFixed(2)}</span>
    </div>
    <p class="book-author">By ${book.author}</p>
    ${statusBadge}
    <div class="book-meta">
      ${dueDateInfo}
      ${additionalInfoHtml}
      <div class="meta-item"><span class="meta-label">Added On</span><span class="meta-value">${book.addedDate.toDate().toLocaleDateString()}</span></div>
    </div>
    <div class="book-actions">
      <button class="btn btn-primary" data-book-id="${book.id}" data-action="details"><i class="fas fa-info-circle"></i> Details</button>
      ${book.status === "borrowed" ? `<button class="btn btn-success" data-book-id="${book.id}" data-action="return"><i class="fas fa-undo"></i> Mark Returned</button>` : ''}
      ${(book.status === "available" || book.status === "reserved") ? `<button class="btn btn-danger" data-book-id="${book.id}" data-action="delete"><i class="fas fa-trash"></i> Delete</button>` : ''}
    </div>
  `;

  booksList.appendChild(bookCard);

  bookCard.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.getAttribute("data-action");
      const bookId = btn.getAttribute("data-book-id");

      if (action === "details") showBookDetails(bookId);
      else if (action === "return") markBookReturned(bookId);
      else if (action === "delete") deleteBook(bookId);
    });
  });
}

async function showBookDetails(bookId) {
  try {
    const bookRef = doc(db, "books", bookId);
    const bookSnap = await getDoc(bookRef);
    if (!bookSnap.exists()) return showToast("Book not found", "error");

    const book = bookSnap.data();
    const detailsContent = document.getElementById("bookDetailsContent");
    detailsContent.innerHTML = "";
    document.getElementById("modalBookTitle").textContent = book.title;

    const basicInfo = document.createElement("div");
    basicInfo.className = "book-details-section";
    basicInfo.innerHTML = `
      <h3>Book Information</h3>
      <p><strong>Author:</strong> ${book.author}</p>
      <p><strong>Price:</strong> ₹${book.price.toFixed(2)}</p>
      <p><strong>Status:</strong> <span class="book-status ${book.status === "available" ? 'status-available' : book.status === "borrowed" ? 'status-borrowed' : 'status-reserved'}">${book.status}</span></p>
      <p><strong>Added Date:</strong> ${book.addedDate.toDate().toLocaleDateString()}</p>
    `;
    detailsContent.appendChild(basicInfo);

    if (book.status === "borrowed" && book.borrowedBy) {
      const userSnap = await getDoc(doc(db, "users", book.borrowedBy));
      const userEmail = userSnap.exists() ? userSnap.data().email : book.borrowedBy;
      const dueDate = book.dueDate.toDate();
      const today = new Date();
      const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      const borrowInfo = document.createElement("div");
      borrowInfo.className = "book-details-section";
      borrowInfo.innerHTML = `
        <h3>Borrowing Information</h3>
        <p><strong>Borrowed By:</strong> ${userEmail}</p>
        <p><strong>Due Date:</strong> <span class="${daysLeft <= 0 ? 'overdue' : 'due-date'}">${dueDate.toLocaleDateString()}</span></p>
        <p><strong>Status:</strong> ${daysLeft <= 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`}</p>
      `;
      detailsContent.appendChild(borrowInfo);
    }

    if (book.reservedBy && book.reservedBy.length > 0) {
      const reservationInfo = document.createElement("div");
      reservationInfo.className = "book-details-section";
      reservationInfo.innerHTML = `<h3>Reserved By</h3>`;
      const userChips = document.createElement("div");

      const chip = document.createElement("span");
      chip.className = "user-chip";
      chip.innerHTML = `<i class="fas fa-user"></i> ${book.reservedBy}`;
      userChips.appendChild(chip);

    

      reservationInfo.appendChild(userChips);
      detailsContent.appendChild(reservationInfo);
    }

    bookDetailsModal.classList.add("active");
  } catch (error) {
    console.error("Error showing book details:", error);
    showToast("Error loading book details", "error");
  }
}

async function markBookReturned(bookId) {
  try {
    const bookRef = doc(db, "books", bookId);
    await updateDoc(bookRef, {
      status: "available",
      borrowedBy: null,
      dueDate: null
    });

    showToast("Book marked as returned");
    loadBorrowedBooks();
    loadAllBooks();
  } catch (error) {
    console.error("Error returning book:", error);
    showToast("Error returning book", "error");
  }
}

async function deleteBook(bookId) {
  try {
    const bookRef = doc(db, "books", bookId);
    await deleteDoc(bookRef);
    showToast("Book deleted successfully", "success");
    loadAllBooks();
    loadReservedBooks();
  } catch (error) {
    console.error("Error deleting book:", error);
    showToast("Error deleting book", "error");
  }
}

function handleBookSearch(e) {
  const searchTerm = e.target.value.toLowerCase();
  const activeTab = document.querySelector(".tab-content.active").id;
  const bookCards = document.querySelectorAll(`#${activeTab} .book-card`);

  bookCards.forEach(card => {
    const title = card.querySelector(".book-title").textContent.toLowerCase();
    const author = card.querySelector(".book-author").textContent.toLowerCase();
    card.style.display = title.includes(searchTerm) || author.includes(searchTerm) ? "block" : "none";
  });
}

async function handleLogout() {
  try {
    await signOut(firebaseAuth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error signing out:", error);
    showToast("Error signing out", "error");
  }
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 1000);
}
