import { firebaseAuth as auth, db } from "./firebaseConfig.js";
import {
  collection, getDocs, updateDoc, doc, getDoc,
  query, where, orderBy, arrayUnion, arrayRemove,
  Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const DEBUG_MODE = true;
const BORROW_RATE_PER_DAY = 10; // ₹10 per day
let currentUser = null;
let currentBookId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (DEBUG_MODE) console.log("Dashboard initializing...");

  // Event Listeners
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("bookSearch").addEventListener("input", handleBookSearch);
  
  // Modal Event Listeners
  document.getElementById('borrowDays').addEventListener('input', updateEstimatedCost);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBorrow').addEventListener('click', closeModal);
  document.getElementById('confirmBorrow').addEventListener('click', confirmBorrow);

  // Tab Switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", function() {
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

  // Auth State Observer
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

// Modal Functions
function updateEstimatedCost() {
  const days = parseInt(document.getElementById('borrowDays').value) || 0;
  const totalCost = days * BORROW_RATE_PER_DAY;
  document.getElementById('totalCost').value = `₹${totalCost}`;
}

function openModal(bookId) {
  if (!bookId || typeof bookId !== 'string' || bookId.trim() === '') {
    showToast("Invalid book selection", "error");
    return false;
  }
  
  // Store the book ID in the modal's dataset
  const modal = document.getElementById('borrowModal');
  modal.dataset.bookId = bookId;
  
  document.getElementById('borrowModal').classList.add('active');
  document.getElementById('borrowDays').value = '14';
  updateEstimatedCost();
  return true;
}

function closeModal() {
  const modal = document.getElementById('borrowModal');
  delete modal.dataset.bookId;
  modal.classList.remove('active');
}

// async function confirmBorrow() {
//   if (!currentBookId) {
//     showToast("No book selected for borrowing", "error");
//     return;
//   }
 
//   try {
//     const daysInput = document.getElementById('borrowDays').value;
//     const days = parseInt(daysInput);
    
//     if (isNaN(days) ){
//       throw new Error("Please enter a valid number of days");
//     }

//     if (days < 1) {
//       throw new Error("Borrow duration must be at least 1 day");
//     }

//     closeModal();
//     await borrowBook(currentBookId, days);
//   } catch (error) {
//     console.error("Confirm borrow error:", error);
//     showToast(error.message, "error");
//   }
// }
async function confirmBorrow() {
  const modal = document.getElementById('borrowModal');
  const bookId = modal.dataset.bookId;
  
  if (!bookId) {
    showToast("No book selected for borrowing", "error");
    return;
  }

  try {
    const daysInput = document.getElementById('borrowDays').value;
    const days = parseInt(daysInput);
    
    if (isNaN(days)) {
      throw new Error("Please enter a valid number of days");
    }

    if (days < 1) {
      throw new Error("Borrow duration must be at least 1 day");
    }

    closeModal();
    await borrowBook(bookId, days);
  } catch (error) {
    console.error("Confirm borrow error:", error);
    showToast(error.message, "error");
  }
}

// Book Loading Functions
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
    if (!currentUser?.uid) return;
    
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
          title: book.title || data.title || "Unknown Book",
          author: data.author || "Unknown Author",
          price: data.price || 0,
          status: "borrowed",
          borrowedDate: book.borrowedDate,
          dueDate: book.dueDate,
          borrowDays: book.borrowDays,
          totalCost: book.totalCost,
          paid: book.paid
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
    if (!currentUser?.uid) return;
    
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
          title: data.title || "Unknown Book",
          author: data.author || "Unknown Author",
          price: data.price || 0,
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

// Book Operations
async function borrowBook(bookId, days) {
  try {
    // Enhanced validation
    if (!bookId || typeof bookId !== 'string' || bookId.trim() === '') {
      throw new Error("Invalid book ID");
    }
    
    if (!days || isNaN(days) || days < 1) {
      throw new Error("Borrow duration must be at least 1 day");
    }

    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + parseInt(days));
    const totalCost = parseInt(days) * BORROW_RATE_PER_DAY;

    // Get book reference and data
    const bookRef = doc(db, "books", bookId);
    const bookSnap = await getDoc(bookRef);

    if (!bookSnap.exists()) {
      throw new Error("Book not found in database");
    }

    const bookData = bookSnap.data();
    const bookTitle = bookData.title || "Unknown Book";

    // Check if book is actually available
    if (bookData.status !== "available") {
      throw new Error("This book is not available for borrowing");
    }

    // Prepare update data
    const bookUpdate = {
      status: "borrowed",
      borrowedBy: currentUser.uid,
      dueDate: Timestamp.fromDate(dueDate)
    };

    const userUpdate = {
      borrowedBooks: arrayUnion({
        bookId,
        title: bookTitle,
        borrowedDate: Timestamp.now(),
        dueDate: Timestamp.fromDate(dueDate),
        borrowDays: parseInt(days),
        totalCost: totalCost,
        paid: false
      })
    };

    

    // Execute updates in a batch
    const batch = writeBatch(db);
    batch.update(bookRef, bookUpdate);
    batch.update(doc(db, "users", currentUser.uid), userUpdate);
    await batch.commit();

    showToast(`Book borrowed successfully for ${days} days! Total cost: ₹${totalCost}`);
    await Promise.all([loadAvailableBooks(), loadBorrowedBooks()]);
    updateStats();
  } catch (error) {
    console.error("Borrow error:", error);
    showToast(`Error: ${error.message}`, "error");
    throw error;
  }
}

async function reserveBook(bookId) {
  try {
    if (!bookId || typeof bookId !== 'string' || bookId.trim() === '') {
      throw new Error("Invalid book ID");
    }

    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    // Get book reference and data
    const bookRef = doc(db, "books", bookId);
    const bookSnap = await getDoc(bookRef);

    if (!bookSnap.exists()) {
      throw new Error("Book not found in database");
    }

    const bookData = bookSnap.data();
    const bookTitle = bookData.title || "Unknown Book";

    // Check if book is actually available
    if (bookData.status !== "available") {
      throw new Error("This book is not available for reservation");
    }

    // Prepare updates
    const bookUpdate = {
      status: "reserved",
      reservedBy: currentUser.uid
    };

    const userUpdate = {
      reservedBooks: arrayUnion({
        bookId,
        title: bookTitle,
        reservedDate: Timestamp.now()
      })
    };

    // Execute updates in a batch
    const batch = writeBatch(db);
    batch.update(bookRef, bookUpdate);
    batch.update(doc(db, "users", currentUser.uid), userUpdate);
    await batch.commit();

    showToast("Book reserved successfully!");
    await Promise.all([loadAvailableBooks(), loadReservedBooks()]);
    updateStats();
  } catch (error) {
    console.error("Reserve error:", error);
    showToast(`Error: ${error.message}`, "error");
  }
}

async function returnBook(bookId) {
  try {
    if (!bookId || typeof bookId !== 'string' || bookId.trim() === '') {
      throw new Error("Invalid book ID");
    }

    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const borrowedBook = userSnap.data()?.borrowedBooks?.find(b => b.bookId === bookId);
    
    if (!borrowedBook) {
      throw new Error("Book not found in your borrowed list");
    }

    const borrowedDate = borrowedBook.borrowedDate?.toDate?.() || new Date();
    const dueDate = borrowedBook.dueDate?.toDate?.() || new Date();
    const actualReturnDate = new Date();
    const plannedDays = borrowedBook.borrowDays || 14;
    
    const actualDays = Math.ceil((actualReturnDate - borrowedDate) / (1000 * 60 * 60 * 24));
    const daysDifference = actualDays - plannedDays;
    const additionalCost = daysDifference > 0 ? daysDifference * BORROW_RATE_PER_DAY : 0;
    const totalCost = (borrowedBook.totalCost || plannedDays * BORROW_RATE_PER_DAY) + additionalCost;

    // Get book reference
    const bookRef = doc(db, "books", bookId);

    // Prepare updates
    const bookUpdate = {
      status: "available",
      borrowedBy: null,
      dueDate: null
    };

    const updatedBorrowed = userSnap.data()?.borrowedBooks?.filter(b => b.bookId !== bookId) || [];

    const paymentRecord = {
      bookId,
      title: borrowedBook.title || "Unknown Book",
      borrowedDate: borrowedBook.borrowedDate,
      returnedDate: Timestamp.now(),
      plannedDays: plannedDays,
      actualDays: actualDays,
      totalCost: totalCost,
      paid: true,
      paymentDate: Timestamp.now()
    };

    // Execute updates in a batch
    const batch = writeBatch(db);
    batch.update(bookRef, bookUpdate);
    batch.update(userRef, { 
      borrowedBooks: updatedBorrowed,
      paymentHistory: arrayUnion(paymentRecord)
    });
    await batch.commit();

    let returnMessage = `Book returned successfully! Total charges: ₹${totalCost}`;
    if (daysDifference > 0) {
      returnMessage += ` (₹${additionalCost} late fee for ${daysDifference} extra days)`;
    } else if (daysDifference < 0) {
      returnMessage += ` (₹${Math.abs(daysDifference) * BORROW_RATE_PER_DAY} saved for returning early)`;
    }

    showToast(returnMessage);
    await Promise.all([loadAvailableBooks(), loadBorrowedBooks()]);
    updateStats();
  } catch (error) {
    console.error("Return error:", error);
    showToast(`Error: ${error.message}`, "error");
  }
}

async function cancelReservation(bookId) {
  try {
    if (!bookId || typeof bookId !== 'string' || bookId.trim() === '') {
      throw new Error("Invalid book ID");
    }

    if (!currentUser?.uid) {
      throw new Error("User not authenticated");
    }

    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const reservedBook = userSnap.data()?.reservedBooks?.find(b => b.bookId === bookId);
    
    if (!reservedBook) {
      throw new Error("Book not found in your reservations");
    }

    // Get book reference
    const bookRef = doc(db, "books", bookId);

    // Prepare updates
    const bookUpdate = {
      status: "available",
      reservedBy: null
    };

    const updatedReserved = userSnap.data()?.reservedBooks?.filter(b => b.bookId !== bookId) || [];

    // Execute updates in a batch
    const batch = writeBatch(db);
    batch.update(bookRef, bookUpdate);
    batch.update(userRef, { reservedBooks: updatedReserved });
    await batch.commit();

    showToast("Reservation cancelled!");
    await Promise.all([loadAvailableBooks(), loadReservedBooks()]);
    updateStats();
  } catch (error) {
    console.error("Cancel reservation error:", error);
    showToast(`Error: ${error.message}`, "error");
  }
}

// UI Rendering
function renderBookCard(book, targetList) {
  const booksList = document.getElementById(targetList);
  if (!booksList) return;

  const card = document.createElement("div");
  card.className = "book-card";
  card.dataset.bookId = book.id;

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
    const paidStatus = book.paid ? 'Paid' : 'Pending';
    
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
          <p><strong>Borrow Period:</strong> ${book.borrowDays} days</p>
          <p><strong>Total Cost:</strong> ₹${book.totalCost || (book.borrowDays * BORROW_RATE_PER_DAY)}</p>
          <p><strong>Payment:</strong> <span class="${book.paid ? 'paid' : 'pending'}">${paidStatus}</span></p>
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
        if (action === "borrow") {
          if (!openModal(bookId)) {
            showToast("Could not initiate borrow process", "error");
          }
        }
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

// Utility Functions
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

async function updateStats() {
  try {
    if (!currentUser?.uid) return;

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
      if (daysLeft < 0) fines += Math.abs(daysLeft) * BORROW_RATE_PER_DAY;
    });

    document.getElementById("dueCount").textContent = dueSoon;
    document.getElementById("fineAmount").textContent = `₹${fines}`;
  } catch (error) {
    console.error("Update stats error:", error);
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    showToast("Logout failed", "error");
  }
}
