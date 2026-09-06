import { auth, db, storage } from "../firebase/firebase-config.js";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";


/* =========================
   HELPERS
========================= */

const $ = (s) => document.querySelector(s);

const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN")}`;

let products = [];
let orders = [];

let settings = {
  name: "जय माता किराना दुकान",
  whatsapp: "",
  upiId: "",
  address: "",
  mapUrl: "",
  openingTime: "सुबह 8:00",
  closingTime: "रात 9:00",
  deliveryFee: 0,
  freeDeliveryAbove: 500,
  minOrder: 0
};


function esc(v = "") {
  return String(v).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}


function toast(message) {
  const t = $("#toast");

  if (!t) {
    alert(message);
    return;
  }

  t.textContent = message;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2500);
}


/* =========================
   FIREBASE ERROR HANDLER
========================= */

function firebaseError(e) {

  console.error("========== FIREBASE ERROR ==========");
  console.error(e);
  console.error("CODE:", e?.code);
  console.error("MESSAGE:", e?.message);
  console.error("====================================");

  const code = e?.code || "";

  const errors = {

    "auth/invalid-credential":
      "❌ Email या Password गलत है।",

    "auth/invalid-login-credentials":
      "❌ Email या Password गलत है।",

    "auth/wrong-password":
      "❌ Password गलत है।",

    "auth/user-not-found":
      "❌ इस Email का Firebase user नहीं मिला।",

    "auth/invalid-email":
      "❌ Email address सही नहीं है।",

    "auth/user-disabled":
      "❌ यह Firebase user disabled है।",

    "auth/too-many-requests":
      "⚠️ बहुत ज्यादा login attempts हुए हैं। थोड़ी देर बाद फिर कोशिश करें।",

    "auth/network-request-failed":
      "🌐 Firebase network connection fail हुआ। Internet/network check करें।",

    "auth/operation-not-allowed":
      "⚠️ Firebase में Email/Password Login enabled नहीं है।",

    "auth/unauthorized-domain":
      "⚠️ यह domain Firebase Authorized Domains में नहीं है।",

    "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      "❌ Firebase API Key invalid है।",

    "auth/internal-error":
      "❌ Firebase internal error आया है।",

    "permission-denied":
      "❌ Firestore permission denied है।",

    "failed-precondition":
      "❌ Firebase configuration/precondition error है।"
  };

  if (errors[code]) {
    return `${errors[code]}\n\nError Code: ${code}`;
  }

  return `❌ Firebase Error\n\n${e?.message || "Unknown error"}\n\nCode: ${code || "unknown"}`;
}


/* =========================
   TIMEOUT
========================= */

function withTimeout(promise, milliseconds = 15000) {

  let timer;

  const timeoutPromise = new Promise((_, reject) => {

    timer = setTimeout(() => {

      reject(
        new Error(
          "Firebase login 15 seconds से response नहीं दे रहा।\n\nPossible causes:\n• Network problem\n• Firebase Auth connection\n• Browser blocking request\n• Firebase configuration"
        )
      );

    }, milliseconds);

  });

  return Promise
    .race([promise, timeoutPromise])
    .finally(() => clearTimeout(timer));
}


/* =========================
   GLOBAL ERROR DETECTION
========================= */

window.addEventListener("error", (event) => {

  console.error("PAGE ERROR:", event.error || event.message);

  const msg = $("#loginMsg");

  if (msg && msg.textContent.includes("Logging")) {

    msg.textContent =
      `❌ Page Error: ${event.message || "Unknown JavaScript error"}`;

  }

});


window.addEventListener("unhandledrejection", (event) => {

  console.error("UNHANDLED PROMISE:", event.reason);

  const msg = $("#loginMsg");

  if (msg) {

    msg.textContent =
      `❌ Firebase Error: ${
        event.reason?.message ||
        event.reason ||
        "Unknown error"
      }`;

  }

});


/* =========================
   LOGIN
========================= */

const loginForm = $("#loginForm");

if (loginForm) {

  loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = $("#email")?.value.trim();
    const password = $("#password")?.value;
    const message = $("#loginMsg");
    const button = $("#loginForm button");

    if (!email || !password) {

      message.textContent =
        "⚠️ Email और Password दोनों भरें।";

      return;
    }


    message.textContent =
      "🔄 Firebase से login connect हो रहा है...";


    if (button) {

      button.disabled = true;
      button.textContent = "Checking...";

    }


    try {

      console.log("LOGIN START");
      console.log("EMAIL:", email);
      console.log("Firebase project:", auth.app.options.projectId);
      console.log("Auth domain:", auth.app.options.authDomain);


      const result = await withTimeout(
        signInWithEmailAndPassword(
          auth,
          email,
          password
        ),
        15000
      );


      console.log("LOGIN SUCCESS:", result.user.uid);

      message.textContent =
        "✅ Login successful! Admin verification हो रही है...";


    } catch (error) {

      console.error("LOGIN FAILED:", error);

      message.textContent =
        firebaseError(error);

    } finally {

      if (button) {

        button.disabled = false;
        button.textContent = "Login →";

      }

    }

  });

}


/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth, async (user) => {

  console.log(
    "AUTH STATE:",
    user ? user.uid : "NOT LOGGED IN"
  );


  if (!user) {

    $("#loginScreen")?.classList.remove("hidden");
    $("#app")?.classList.add("hidden");

    return;
  }


  try {

    $("#loginMsg").textContent =
      "✅ Login successful! Admin permission check हो रही है...";


    console.log(
      "Checking admin document:",
      user.uid
    );


    const adminDoc = await getDoc(
      doc(db, "admins", user.uid)
    );


    if (!adminDoc.exists()) {

      await signOut(auth);

      throw new Error(
        `❌ Admin permission नहीं मिली।

Firestore में यह document बनाएं:

admins/${user.uid}

और उसमें रखें:

role: "admin"`
      );

    }


    const adminData = adminDoc.data();


    if (adminData.role !== "admin") {

      await signOut(auth);

      throw new Error(
        `❌ Admin role गलत है।

Current role:
${adminData.role || "Not found"}

Required:
admin`
      );

    }


    console.log("ADMIN VERIFIED ✓");


    $("#loginScreen")?.classList.add("hidden");
    $("#app")?.classList.remove("hidden");


    await loadAll();


  } catch (error) {

    console.error(
      "ADMIN VERIFICATION ERROR:",
      error
    );


    $("#loginScreen")?.classList.remove("hidden");
    $("#app")?.classList.add("hidden");


    $("#loginMsg").textContent =
      error?.message ||
      "Admin verification failed.";

  }

});


/* =========================
   LOGOUT
========================= */

$("#logoutBtn")?.addEventListener(
  "click",
  () => signOut(auth)
);

$("#mobileLogout")?.addEventListener(
  "click",
  () => signOut(auth)
);


/* =========================
   NAVIGATION
========================= */

document
  .querySelectorAll(".side-link[data-view]")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => showView(button.dataset.view)
    );

  });


document
  .querySelectorAll("[data-go]")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => showView(button.dataset.go)
    );

  });


function showView(view) {

  document
    .querySelectorAll(".view")
    .forEach((element) => {

      element.classList.add("hidden");

    });


  $(`#view-${view}`)?.classList.remove("hidden");


  document
    .querySelectorAll(".side-link[data-view]")
    .forEach((element) => {

      element.classList.toggle(
        "active",
        element.dataset.view === view
      );

    });

}


/* =========================
   LOAD ALL DATA
========================= */

async function loadAll() {

  console.log("Loading admin data...");

  await Promise.all([
    loadProducts(),
    loadOrders(),
    loadSettings()
  ]);

  renderDashboard();
  renderProducts();
  renderOrders();
  fillSettings();

}


/* =========================
   PRODUCTS
========================= */

async function loadProducts() {

  const snapshot = await getDocs(
    query(
      collection(db, "products"),
      limit(300)
    )
  );

  products = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

}


async function deleteProduct(id) {

  if (!confirm("Product delete करें?")) return;

  try {

    await deleteDoc(
      doc(db, "products", id)
    );

    await loadProducts();

    renderProducts();
    renderDashboard();

    toast("Product deleted ✓");

  } catch (error) {

    toast("Delete failed: " + error.message);

  }

}


/* =========================
   ORDERS
========================= */

async function loadOrders() {

  const snapshot = await getDocs(
    query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(200)
    )
  );

  orders = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

}


function orderRows(list) {

  if (!list.length) {

    return `
      <div class="empty">
        अभी कोई order नहीं है।
      </div>
    `;

  }


  return `
    <table class="table">

      <thead>

        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Total</th>
          <th>Status</th>
          <th>Action</th>
        </tr>

      </thead>

      <tbody>

        ${list.map((order) => `

          <tr>

            <td>
              #${esc(
                order.id
                  .slice(0, 8)
                  .toUpperCase()
              )}
            </td>

            <td>
              ${esc(order.customer?.name)}
              <br>
              ${esc(order.customer?.phone)}
            </td>

            <td>
              ${money(order.total)}
            </td>

            <td>
              <span class="status">
                ${esc(order.status)}
              </span>
            </td>

            <td>

              <select
                class="statusSelect"
                data-id="${order.id}"
              >

                ${
                  [
                    "Pending",
                    "Confirmed",
                    "Preparing",
                    "Out for Delivery",
                    "Delivered",
                    "Cancelled"
                  ]
                  .map(
                    (status) =>
                      `<option ${
                        order.status === status
                          ? "selected"
                          : ""
                      }>${status}</option>`
                  )
                  .join("")
                }

              </select>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;

}


function renderOrders() {

  const table = $("#orderTable");

  if (!table) return;

  table.innerHTML =
    orderRows(orders);

  bindOrderStatus();

}


function bindOrderStatus() {

  document
    .querySelectorAll(".statusSelect")
    .forEach((select) => {

      select.addEventListener(
        "change",
        async () => {

          try {

            await updateDoc(
              doc(
                db,
                "orders",
                select.dataset.id
              ),
              {
                status: select.value
              }
            );


            const order =
              orders.find(
                (item) =>
                  item.id ===
                  select.dataset.id
              );


            if (order) {

              order.status =
                select.value;

            }


            renderDashboard();

            toast(
              "Order status updated ✓"
            );


          } catch (error) {

            toast(
              "Update failed: " +
              error.message
            );

          }

        }
      );

    });

}


/* =========================
   DASHBOARD
========================= */

function renderDashboard() {

  $("#statProducts") &&
    ($("#statProducts").textContent =
      products.length);


  $("#statOrders") &&
    ($("#statOrders").textContent =
      orders.length);


  $("#statPending") &&
    ($("#statPending").textContent =
      orders.filter((order) =>
        [
          "Pending",
          "Confirmed",
          "Preparing",
          "Out for Delivery"
        ].includes(order.status)
      ).length);


  $("#statSales") &&
    ($("#statSales").textContent =
      money(
        orders
          .filter(
            (order) =>
              order.status === "Delivered"
          )
          .reduce(
            (total, order) =>
              total +
              Number(order.total || 0),
            0
          )
      );


  if ($("#recentOrders")) {

    $("#recentOrders").innerHTML =
      orderRows(
        orders.slice(0, 8)
      );

  }

}


/* =========================
   PRODUCT TABLE
========================= */

function renderProducts() {

  const table = $("#productTable");

  if (!table) return;


  if (!products.length) {

    table.innerHTML = `
      <div class="empty">
        अभी product नहीं है।
      </div>
    `;

    return;

  }


  table.innerHTML = `

    <table class="table">

      <thead>

        <tr>
          <th>Product</th>
          <th>Category</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Offer</th>
          <th>Actions</th>
        </tr>

      </thead>

      <tbody>

        ${products.map((product) => `

          <tr>

            <td>

              ${
                product.imageUrl
                  ? `
                    <img
                      src="${esc(product.imageUrl)}"
                      style="
                        width:40px;
                        height:40px;
                        object-fit:cover;
                        border-radius:8px;
                      "
                    >
                  `
                  : "🛍️"
              }

              ${esc(product.name)}

            </td>

            <td>
              ${esc(product.category)}
            </td>

            <td>
              ${money(product.price)}
            </td>

            <td>
              ${product.stock ?? 0}
            </td>

            <td>
              ${product.offer ? "Yes" : "—"}
            </td>

            <td class="actions">

              <button
                class="tiny"
                data-edit="${product.id}"
              >
                Edit
              </button>

              <button
                class="tiny danger"
                data-del="${product.id}"
              >
                Delete
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;


  document
    .querySelectorAll("[data-edit]")
    .forEach((button) => {

      button.onclick = () =>
        openProduct(
          button.dataset.edit
        );

    });


  document
    .querySelectorAll("[data-del]")
    .forEach((button) => {

      button.onclick = () =>
        deleteProduct(
          button.dataset.del
        );

    });

}


/* =========================
   PRODUCT MODAL
========================= */

$("#addProductBtn")?.addEventListener(
  "click",
  () => openProduct()
);


$("#closeProduct")?.addEventListener(
  "click",
  () =>
    $("#productModal")?.classList.add(
      "hidden"
    )
);


function openProduct(id) {

  const product =
    products.find(
      (item) => item.id === id
    );


  $("#productModalTitle").textContent =
    product
      ? "Edit Product"
      : "Add Product";


  $("#pId").value =
    product?.id || "";

  $("#pName").value =
    product?.name || "";

  $("#pCategory").value =
    product?.category || "";

  $("#pPrice").value =
    product?.price ?? "";

  $("#pMrp").value =
    product?.mrp ?? "";

  $("#pUnit").value =
    product?.unit || "";

  $("#pStock").value =
    product?.stock ?? 0;

  $("#pEmoji").value =
    product?.emoji || "🛍️";

  $("#pOffer").checked =
    !!product?.offer;

  $("#pActive").checked =
    product
      ? product.active !== false
      : true;

  $("#pImage").value = "";


  $("#productModal")?.classList.remove(
    "hidden"
  );

}


/* =========================
   SAVE PRODUCT
========================= */

$("#productForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const id =
      $("#pId").value;


    const data = {

      name:
        $("#pName").value.trim(),

      category:
        $("#pCategory").value.trim(),

      price:
        Number($("#pPrice").value),

      mrp:
        Number($("#pMrp").value || 0),

      unit:
        $("#pUnit").value.trim(),

      stock:
        Number($("#pStock").value),

      emoji:
        $("#pEmoji").value.trim() ||
        "🛍️",

      offer:
        $("#pOffer").checked,

      active:
        $("#pActive").checked,

      updatedAt:
        serverTimestamp()

    };


    try {

      const file =
        $("#pImage").files[0];


      if (file) {

        const safeName =
          file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            ""
          );


        const storageRef =
          ref(
            storage,
            `products/${crypto.randomUUID()}-${safeName}`
          );


        await uploadBytes(
          storageRef,
          file
        );


        data.imageUrl =
          await getDownloadURL(
            storageRef
          );

      }


      if (id) {

        await updateDoc(
          doc(db, "products", id),
          data
        );

      } else {

        await setDoc(
          doc(
            collection(db, "products")
          ),
          {
            ...data,
            createdAt:
              serverTimestamp()
          }
        );

      }


      $("#productModal")?.classList.add(
        "hidden"
      );


      await loadProducts();

      renderProducts();
      renderDashboard();

      toast(
        "Product saved successfully ✓"
      );


    } catch (error) {

      console.error(error);

      toast(
        "Save failed: " +
        error.message
      );

    }

  }
);


/* =========================
   SETTINGS
========================= */

async function loadSettings() {

  const snapshot =
    await getDoc(
      doc(db, "settings", "shop")
    );


  if (snapshot.exists()) {

    settings = {
      ...settings,
      ...snapshot.data()
    };

  }

}


function fillSettings() {

  if ($("#sName"))
    $("#sName").value =
      settings.name || "";

  if ($("#sWhatsapp"))
    $("#sWhatsapp").value =
      settings.whatsapp || "";

  if ($("#sUpi"))
    $("#sUpi").value =
      settings.upiId || "";

  if ($("#sMap"))
    $("#sMap").value =
      settings.mapUrl || "";

  if ($("#sAddress"))
    $("#sAddress").value =
      settings.address || "";

  if ($("#sOpen"))
    $("#sOpen").value =
      settings.openingTime || "";

  if ($("#sClose"))
    $("#sClose").value =
      settings.closingTime || "";

  if ($("#sDelivery"))
    $("#sDelivery").value =
      settings.deliveryFee ?? 0;

  if ($("#sFree"))
    $("#sFree").value =
      settings.freeDeliveryAbove ?? 500;

  if ($("#sMin"))
    $("#sMin").value =
      settings.minOrder ?? 0;

}
$("#saveSettings")?.addEventListener(
  "click",
  async () => {

    try {

      settings = {

        ...settings,

        name:
          $("#sName").value.trim(),

        whatsapp:
          $("#sWhatsapp").value.trim(),

        upiId:
          $("#sUpi").value.trim(),

        mapUrl:
          $("#sMap").value.trim(),

        address:
          $("#sAddress").value.trim(),

        openingTime:
          $("#sOpen").value.trim(),

        closingTime:
          $("#sClose").value.trim(),

        deliveryFee:
          Number(
            $("#sDelivery").value || 0
          ),

        freeDeliveryAbove:
          Number(
            $("#sFree").value || 0
          ),

        minOrder:
          Number(
            $("#sMin").value || 0
          )

      };


      await setDoc(
        doc(db, "settings", "shop"),
        settings,
        { merge: true }
      );


      toast(
        "Settings saved ✓"
      );


    } catch (error) {

      toast(
        "Settings failed: " +
        error.message
      );

    }

  }
);


/* =========================
   REFRESH ORDERS
========================= */

$("#refreshOrders")?.addEventListener(
  "click",
  async () => {

    try {

      await loadOrders();

      renderOrders();
      renderDashboard();

      toast(
        "Orders refreshed ✓"
      );

    } catch (error) {

      toast(
        "Refresh failed: " +
        error.message
      );

    }

  }
);

