import { auth, db, storage } from "../firebase/firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, orderBy, query, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

/* ========================= HELPERS ========================= */
const $ = (s) => document.querySelector(s);
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
let products = [], orders = [];
let settings = { name: "जय माता किराना दुकान", whatsapp: "", upiId: "", address: "", mapUrl: "", openingTime: "सुबह 8:00", closingTime: "रात 9:00", deliveryFee: 0, freeDeliveryAbove: 500, minOrder: 0 };

function esc(v = "") {
  return String(v).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

function toast(message) {
  const t = $("#toast");
  if (!t) return alert(message);
  t.textContent = message;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

/* ========================= ERROR HANDLER & TIMEOUT ========================= */
function firebaseError(e) {
  console.error("FIREBASE ERROR:", e);
  const code = e?.code || "";
  const errors = {
    "auth/invalid-credential": "❌ Email या Password गलत है।",
    "auth/invalid-login-credentials": "❌ Email या Password गलत है।",
    "auth/wrong-password": "❌ Password गलत है।",
    "auth/user-not-found": "❌ User नहीं मिला।",
    "auth/too-many-requests": "⚠️ बहुत ज्यादा प्रयास हुए हैं। बाद में कोशिश करें।",
    "auth/network-request-failed": "🌐 Internet/network check करें।",
    "permission-denied": "❌ Firestore permission denied है।"
  };
  return errors[code] ? `${errors[code]}\n\nCode: ${code}` : `❌ Error: ${e?.message || "Unknown error"}`;
}

function withTimeout(promise, ms = 15000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Firebase response नहीं दे रहा। Network check करें।")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

window.addEventListener("error", (e) => $("#loginMsg") && ($("#loginMsg").textContent = `❌ Page Error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => $("#loginMsg") && ($("#loginMsg").textContent = `❌ Firebase Error: ${e.reason?.message || e.reason}`));

/* ========================= LOGIN ========================= */
const loginForm = $("#loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#email")?.value.trim();
    const password = $("#password")?.value;
    const message = $("#loginMsg");
    const button = $("#loginForm button");

    if (!email || !password) return (message.textContent = "⚠️ Email और Password दोनों भरें।");
    message.textContent = "🔄 Connect हो रहा है...";
    if (button) { button.disabled = true; button.textContent = "Checking..."; }

    try {
      await withTimeout(signInWithEmailAndPassword(auth, email, password), 15000);
      message.textContent = "✅ Login successful! Verification...";
    } catch (error) {
      message.textContent = firebaseError(error);
    } finally {
      if (button) { button.disabled = false; button.textContent = "Login →"; }
    }
  });
}

/* ========================= AUTH STATE ========================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("#loginScreen")?.classList.remove("hidden");
    $("#app")?.classList.add("hidden");
    return;
  }

  // 1. स्क्रीन को तुरंत बदलें ताकि Verification पर न अटके
  $("#loginScreen")?.classList.add("hidden");
  $("#app")?.classList.remove("hidden");

  // 2. बैकग्राउंड में रोल चेक और डेटा लोड करें
  try {
    const adminDoc = await getDoc(doc(db, "admins", user.uid));
    if (!adminDoc.exists() || adminDoc.data()?.role !== "admin") {
      await signOut(auth);
      alert("❌ Permission Denied: आपके पास Admin Role नहीं है।");
      return;
    }
    await loadAll();
  } catch (error) {
    console.error("Auth Error:", error);
    if (typeof toast === "function") toast("Error: " + error.message);
  }
});

/* ========================= LOGOUT & NAV ========================= */
$("#logoutBtn")?.addEventListener("click", () => signOut(auth));
$("#mobileLogout")?.addEventListener("click", () => signOut(auth));

document.querySelectorAll(".side-link[data-view]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));
document.querySelectorAll("[data-go]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.go)));

function showView(view) {
  document.querySelectorAll(".view").forEach((el) => el.classList.add("hidden"));
  $(`#view-${view}`)?.classList.remove("hidden");
  document.querySelectorAll(".side-link[data-view]").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
}

/* ========================= DATA LOADERS ========================= */
async function loadAll() {
  await Promise.all([loadProducts(), loadOrders(), loadSettings()]);
  renderDashboard();
  renderProducts();
  renderOrders();
  fillSettings();
}

async function loadProducts() {
  const snapshot = await getDocs(query(collection(db, "products"), limit(300)));
  products = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

async function deleteProduct(id) {
  if (!confirm("Product delete करें?")) return;
  try {
    await deleteDoc(doc(db, "products", id));
    await loadProducts();
    renderProducts();
    renderDashboard();
    toast("Product deleted ✓");
  } catch (e) { toast("Delete failed: " + e.message); }
}

async function loadOrders() {
  const snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200)));
  orders = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

/* ========================= RENDERING ========================= */
function orderRows(list) {
  if (!list.length) return `<div class="empty">अभी कोई order नहीं है।</div>`;
  const statuses = ["Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
  
  return `
    <table class="table">
      <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>
        ${list.map((o) => `
          <tr>
            <td>#${esc(o.id.slice(0, 8).toUpperCase())}</td>
            <td>${esc(o.customer?.name)}<br>${esc(o.customer?.phone)}</td>
            <td>${money(o.total)}</td>
            <td><span class="status">${esc(o.status)}</span></td>
            <td>
              <select class="statusSelect" data-id="${o.id}">
                ${statuses.map((s) => `<option ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function renderOrders() {
  const table = $("#orderTable");
  if (table) { table.innerHTML = orderRows(orders); bindOrderStatus(); }
}

function bindOrderStatus() {
  document.querySelectorAll(".statusSelect").forEach((select) => {
    select.addEventListener("change", async () => {
      try {
        await updateDoc(doc(db, "orders", select.dataset.id), { status: select.value });
        const o = orders.find((i) => i.id === select.dataset.id);
        if (o) o.status = select.value;
        renderDashboard();
        toast("Status updated ✓");
      } catch (e) { toast("Update failed: " + e.message); }
    });
  });
}

function renderDashboard() {
  if ($("#statProducts")) $("#statProducts").textContent = products.length;
  if ($("#statOrders")) $("#statOrders").textContent = orders.length;
  if ($("#statPending")) $("#statPending").textContent = orders.filter((o) => ["Pending", "Confirmed", "Preparing", "Out for Delivery"].includes(o.status)).length;
  if ($("#statSales")) $("#statSales").textContent = money(orders.filter((o) => o.status === "Delivered").reduce((t, o) => t + Number(o.total || 0), 0));
  if ($("#recentOrders")) $("#recentOrders").innerHTML = orderRows(orders.slice(0, 8));
}

function renderProducts() {
  const table = $("#productTable");
  if (!table) return;
  if (!products.length) return (table.innerHTML = `<div class="empty">अभी product नहीं है।</div>`);

  table.innerHTML = `
    <table class="table">
      <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Offer</th><th>Actions</th></tr></thead>
      <tbody>
        ${products.map((p) => `
          <tr>
            <td>
              ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;">` : "🛍️"}
              ${esc(p.name)}
            </td>
            <td>${esc(p.category)}</td>
            <td>${money(p.price)}</td>
            <td>${p.stock ?? 0}</td>
            <td>${p.offer ? "Yes" : "—"}</td>
            <td class="actions">
              <button class="tiny" data-edit="${p.id}">Edit</button>
              <button class="tiny danger" data-del="${p.id}">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;

  document.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => openProduct(b.dataset.edit)));
  document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => deleteProduct(b.dataset.del)));
}

/* ========================= MODAL & PRODUCT SAVE ========================= */
$("#addProductBtn")?.addEventListener("click", () => openProduct());
$("#closeProduct")?.addEventListener("click", () => $("#productModal")?.classList.add("hidden"));

function openProduct(id) {
  const p = products.find((item) => item.id === id);
  $("#productModalTitle").textContent = p ? "Edit Product" : "Add Product";
  $("#pId").value = p?.id || "";
  $("#pName").value = p?.name || "";
  $("#pCategory").value = p?.category || "";
  $("#pPrice").value = p?.price ?? "";
  $("#pMrp").value = p?.mrp ?? "";
  $("#pUnit").value = p?.unit || "";
  $("#pStock").value = p?.stock ?? 0;
  $("#pEmoji").value = p?.emoji || "🛍️";
  $("#pOffer").checked = !!p?.offer;
  $("#pActive").checked = p ? p.active !== false : true;
  $("#pImage").value = "";
  $("#productModal")?.classList.remove("hidden");
}

$("#productForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#pId").value;
  const data = {
    name: $("#pName").value.trim(),
    category: $("#pCategory").value.trim(),
    price: Number($("#pPrice").value),
    mrp: Number($("#pMrp").value || 0),
    unit: $("#pUnit").value.trim(),
    stock: Number($("#pStock").value),
    emoji: $("#pEmoji").value.trim() || "🛍️",
    offer: $("#pOffer").checked,
    active: $("#pActive").checked,
    updatedAt: serverTimestamp()
  };

  try {
    const file = $("#pImage").files[0];
    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "");
      const uniqueId = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Date.now();
      const storageRef = ref(storage, `products/${uniqueId}-${safeName}`);
      await uploadBytes(storageRef, file);
      data.imageUrl = await getDownloadURL(storageRef);
    }

    if (id) {
      await updateDoc(doc(db, "products", id), data);
    } else {
      await setDoc(doc(collection(db, "products")), { ...data, createdAt: serverTimestamp() });
    }

    $("#productModal")?.classList.add("hidden");
    await loadProducts();
    renderProducts();
    renderDashboard();
    toast("Product saved ✓");
  } catch (error) { toast("Save failed: " + error.message); }
});

/* ========================= SETTINGS & REFRESH ========================= */
async function loadSettings() {
  const snapshot = await getDoc(doc(db, "settings", "shop"));
  if (snapshot.exists()) settings = { ...settings, ...snapshot.data() };
}

function fillSettings() {
  if ($("#sName")) $("#sName").value = settings.name || "";
  if ($("#sWhatsapp")) $("#sWhatsapp").value = settings.whatsapp || "";
  if ($("#sUpi")) $("#sUpi").value = settings.upiId || "";
  if ($("#sMap")) $("#sMap").value = settings.mapUrl || "";
  if ($("#sAddress")) $("#sAddress").value = settings.address || "";
  if ($("#sOpen")) $("#sOpen").value = settings.openingTime || "";
  if ($("#sClose")) $("#sClose").value = settings.closingTime || "";
  if ($("#sDelivery")) $("#sDelivery").value = settings.deliveryFee ?? 0;
  if ($("#sFree")) $("#sFree").value = settings.freeDeliveryAbove ?? 500;
  if ($("#sMin")) $("#sMin").value = settings.minOrder ?? 0;
}

$("#saveSettings")?.addEventListener("click", async () => {
  try {
    settings = {
      ...settings,
      name: $("#sName").value.trim(),
      whatsapp: $("#sWhatsapp").value.trim(),
      upiId: $("#sUpi").value.trim(),
      mapUrl: $("#sMap").value.trim(),
      address: $("#sAddress").value.trim(),
      openingTime: $("#sOpen").value.trim(),
      closingTime: $("#sClose").value.trim(),
      deliveryFee: Number($("#sDelivery").value || 0),
      freeDeliveryAbove: Number($("#sFree").value || 0),
      minOrder: Number($("#sMin").value || 0)
    };
    await setDoc(doc(db, "settings", "shop"), settings, { merge: true });
    toast("Settings saved ✓");
  } catch (e) { toast("Settings failed: " + e.message); }
});

$("#refreshOrders")?.addEventListener("click", async () => {
  try {
    await loadOrders();
    renderOrders();
    renderDashboard();
    toast("Orders refreshed ✓");
  } catch (e) { toast("Refresh failed: " + e.message); }
});
                
