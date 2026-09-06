/* =========================================================
   JAI MATA KIRANA DUKAN
   MAIN JAVASCRIPT
========================================================= */


/* =========================================================
   SHOP SETTINGS
   सबसे पहले इन चीजों को अपनी दुकान के अनुसार बदलें।
========================================================= */

const SHOP = {

    name: "जय माता किराना दुकान",

    /*
      अपना WhatsApp नंबर डालें।
      Country code के साथ डालें।
      Example:
      919876543210

      + या spaces मत डालें।
    */

    whatsapp: "919876543210",

    address: "आपका दुकान का पूरा पता",

    deliveryMessage:
        "नमस्ते जय माता किराना दुकान! मुझे होम डिलीवरी के बारे में जानकारी चाहिए।"

};


/* =========================================================
   ELEMENTS
========================================================= */

const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");

const openCartBtn = document.getElementById("openCart");
const closeCartBtn = document.getElementById("closeCart");

const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");

const checkoutBtn = document.getElementById("checkoutBtn");
const clearCartBtn = document.getElementById("clearCart");

const toast = document.getElementById("toast");

const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");

const searchToggle = document.querySelector(".search-toggle");
const searchArea = document.getElementById("searchArea");
const searchInput = document.getElementById("searchInput");
const closeSearch = document.getElementById("closeSearch");

const productGrid = document.getElementById("productGrid");
const noResults = document.getElementById("noResults");

const year = document.getElementById("year");


/* =========================================================
   CART
========================================================= */

let cart = JSON.parse(localStorage.getItem("jaiMataCart")) || [];


/* =========================================================
   SAVE CART
========================================================= */

function saveCart() {

    localStorage.setItem(
        "jaiMataCart",
        JSON.stringify(cart)
    );

}


/* =========================================================
   OPEN CART
========================================================= */

function openCart() {

    cartDrawer.classList.add("active");
    overlay.classList.add("active");

    document.body.style.overflow = "hidden";

}


/* =========================================================
   CLOSE CART
========================================================= */

function closeCart() {

    cartDrawer.classList.remove("active");
    overlay.classList.remove("active");

    document.body.style.overflow = "";

}


/* =========================================================
   ADD PRODUCT
========================================================= */

function addToCart(name, price) {

    price = Number(price);

    const existing = cart.find(
        item => item.name === name
    );

    if (existing) {

        existing.quantity += 1;

    } else {

        cart.push({
            name: name,
            price: price,
            quantity: 1
        });

    }

    saveCart();

    updateCart();

    showToast(`${name} cart में जोड़ दिया गया।`);

}


/* =========================================================
   CHANGE QUANTITY
========================================================= */

function changeQuantity(index, amount) {

    if (!cart[index]) return;

    cart[index].quantity += amount;

    if (cart[index].quantity <= 0) {

        cart.splice(index, 1);

    }

    saveCart();

    updateCart();

}


/* =========================================================
   UPDATE CART
========================================================= */

function updateCart() {

    cartItems.innerHTML = "";

    if (cart.length === 0) {

        cartItems.innerHTML = `
            <div class="empty-cart">
                <span>🛒</span>
                <h3>Cart खाली है</h3>
                <p>अपने पसंदीदा सामान को cart में जोड़ें।</p>
            </div>
        `;

        cartCount.textContent = "0";
        cartTotal.textContent = "0";

        return;
    }


    let total = 0;
    let count = 0;


    cart.forEach((item, index) => {

        total += item.price * item.quantity;

        count += item.quantity;


        const div = document.createElement("div");

        div.className = "cart-item";


        div.innerHTML = `

            <div class="cart-item-icon">
                🛍️
            </div>

            <div>

                <h4>${item.name}</h4>

                <p>
                    ₹${item.price}
                </p>

                <div class="quantity">

                    <button
                        onclick="changeQuantity(${index}, -1)">
                        −
                    </button>

                    <span>
                        ${item.quantity}
                    </span>

                    <button
                        onclick="changeQuantity(${index}, 1)">
                        +
                    </button>

                </div>

            </div>

            <strong>
                ₹${item.price * item.quantity}
            </strong>
        `;


        cartItems.appendChild(div);

    });


    cartCount.textContent = count;

    cartTotal.textContent = total;

}


/* =========================================================
   CLEAR CART
========================================================= */

function clearCart() {

    if (cart.length === 0) return;

    cart = [];

    saveCart();

    updateCart();

    showToast("Cart खाली कर दिया गया।");

}


/* =========================================================
   WHATSAPP ORDER
========================================================= */

function sendWhatsApp(message) {

    const url =
        `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");

}


/* =========================================================
   CART → WHATSAPP
========================================================= */

function checkoutWhatsApp() {

    if (cart.length === 0) {

        showToast("पहले सामान cart में जोड़ें।");

        return;
    }


    let message =
        `नमस्ते ${SHOP.name}! 👋\n\n`;

    message +=
        `मुझे ये सामान ऑर्डर करना है:\n\n`;


    let total = 0;


    cart.forEach((item, index) => {

        const itemTotal =
            item.price * item.quantity;

        total += itemTotal;


        message +=
            `${index + 1}. ${item.name} × ${item.quantity} = ₹${itemTotal}\n`;

    });


    message +=
        `\n━━━━━━━━━━━━━━\n`;

    message +=
        `कुल राशि: ₹${total}\n`;

    message +=
        `━━━━━━━━━━━━━━\n\n`;

    message +=
        `कृपया ऑर्डर की पुष्टि करें।`;

    sendWhatsApp(message);

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer;

function showToast(message) {

    const text = toast.querySelector("p");

    text.textContent = message;

    toast.classList.add("active");


    clearTimeout(toastTimer);


    toastTimer = setTimeout(() => {

        toast.classList.remove("active");

    }, 2500);

}


/* =========================================================
   PRODUCT BUTTONS
========================================================= */

document.querySelectorAll(".add-btn")
    .forEach(button => {

        button.addEventListener("click", () => {

            const name =
                button.dataset.name;

            const price =
                button.dataset.price;

            addToCart(name, price);

        });

    });


/* =========================================================
   CART EVENTS
========================================================= */

openCartBtn.addEventListener(
    "click",
    openCart
);

closeCartBtn.addEventListener(
    "click",
    closeCart
);

overlay.addEventListener(
    "click",
    closeCart
);

clearCartBtn.addEventListener(
    "click",
    clearCart
);

checkoutBtn.addEventListener(
    "click",
    checkoutWhatsApp
);


/* =========================================================
   MOBILE MENU
========================================================= */

menuBtn.addEventListener("click", () => {

    mobileMenu.classList.toggle("active");

});


document.querySelectorAll(".mobile-menu a")
    .forEach(link => {

        link.addEventListener("click", () => {

            mobileMenu.classList.remove("active");

        });

    });


/* =========================================================
   SEARCH
========================================================= */

searchToggle.addEventListener("click", () => {

    searchArea.classList.add("active");

    setTimeout(() => {

        searchInput.focus();

    }, 100);

});


closeSearch.addEventListener("click", () => {

    searchArea.classList.remove("active");

    searchInput.value = "";

    filterProducts();

});


searchInput.addEventListener(
    "input",
    filterProducts
);


function filterProducts() {

    const search =
        searchInput.value
        .trim()
        .toLowerCase();


    let visible = 0;


    document.querySelectorAll(".product-card")
        .forEach(card => {

            const name =
                card.dataset.name.toLowerCase();

            const text =
                card.innerText.toLowerCase();


            const match =
                !search ||
                name.includes(search) ||
                text.includes(search);


            if (match) {

                card.style.display = "";

                visible++;

            } else {

                card.style.display = "none";

            }

        });


    noResults.style.display =
        visible === 0
            ? "block"
            : "none";

}


/* =========================================================
   CATEGORY FILTER
========================================================= */

document.querySelectorAll(".filter-btn")
    .forEach(button => {

        button.addEventListener("click", () => {

            document.querySelectorAll(".filter-btn")
                .forEach(btn => {

                    btn.classList.remove("active");

                });


            button.classList.add("active");


            const filter =
                button.dataset.filter;


            filterProductCategory(filter);

        });

    });


function filterProductCategory(category) {

    let visible = 0;


    document.querySelectorAll(".product-card")
        .forEach(card => {

            if (
                category === "All" ||
                card.dataset.category === category
            ) {

                card.style.display = "";

                visible++;

            } else {

                card.style.display = "none";

            }

        });


    noResults.style.display =
        visible === 0
            ? "block"
            : "none";

}


/* =========================================================
   CATEGORY CARDS
========================================================= */

document.querySelectorAll(".category-card")
    .forEach(card => {

        card.addEventListener("click", () => {

            const category =
                card.dataset.category;


            document.querySelectorAll(".filter-btn")
                .forEach(btn => {

                    btn.classList.remove("active");

                });


            const matching =
                document.querySelector(
                    `.filter-btn[data-filter="${category}"]`
                );


            if (matching) {

                matching.classList.add("active");

            }


            filterProductCategory(category);


            document.getElementById("products")
                .scrollIntoView({
                    behavior: "smooth"
                });

        });

    });


/* =========================================================
   WHATSAPP BUTTONS
========================================================= */

document.getElementById("heroWhatsApp")
    .addEventListener("click", () => {

        sendWhatsApp(
            `नमस्ते ${SHOP.name}! 👋\nमुझे किराना सामान का ऑर्डर करना है।`
        );

    });


document.getElementById("offerWhatsApp")
    .addEventListener("click", () => {

        sendWhatsApp(
            `नमस्ते ${SHOP.name}! 👋\nमैं महीने भर की किराना लिस्ट WhatsApp पर भेजना चाहता/चाहती हूँ।`
        );

    });


document.getElementById("deliveryWhatsApp")
    .addEventListener("click", () => {

        sendWhatsApp(
            SHOP.deliveryMessage
        );

    });


document.getElementById("floatingWhatsApp")
    .addEventListener("click", () => {

        sendWhatsApp(
            `नमस्ते ${SHOP.name}! 👋`
        );

    });


/* =========================================================
   YEAR
========================================================= */

year.textContent =
    new Date().getFullYear();


/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {

        closeCart();

        searchArea.classList.remove("active");

    }

});


/* =========================================================
   INITIALIZE
========================================================= */

updateCart();
