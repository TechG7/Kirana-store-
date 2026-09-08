import{auth,db}from"./firebase/firebase-config.js";
import{GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import{collection,getDocs,getDoc,doc,addDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const $=s=>document.querySelector(s);
const money=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;

let products=[];
let settings={
name:"जय माता दी",
whatsapp:"",
address:"Dummy Address, Bihar, India",
openingTime:"सुबह 8:00",
closingTime:"रात 9:00",
deliveryFee:0,
freeDeliveryAbove:500,
minOrder:0
};
let cart=JSON.parse(localStorage.getItem("jmd_cart")||"[]");
let user=null;
let lastOrder=null;
let installPrompt=null;
let activeCategory="सभी";

const cats=[
["🌾","आटा & अनाज"],
["🍚","चावल"],
["🥣","दाल"],
["🫗","तेल"],
["🍪","बिस्कुट"],
["🧂","मसाले"],
["🥛","डेयरी"],
["🧴","अन्य"]
];

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

function toast(m){
const t=$("#toast");
if(!t)return;
t.textContent=m;
t.classList.add("active");
clearTimeout(toast.t);
toast.t=setTimeout(()=>t.classList.remove("active"),2200);
}

function wa(text){
const n=String(settings.whatsapp||"").replace(/\D/g,"");
return n?`https://wa.me/${n}?text=${encodeURIComponent(text)}`:"#";
}

function saveCart(){
localStorage.setItem("jmd_cart",JSON.stringify(cart));
renderCart();
}

function product(id){
return products.find(p=>p.id===id);
}

function add(id){
const p=product(id);
if(!p)return;
const x=cart.find(i=>i.id===id);
if(x)x.qty++;
else cart.push({id,qty:1});
saveCart();
toast(`${p.name} cart में जोड़ दिया गया ✓`);
}

function change(id,d){
const x=cart.find(i=>i.id===id);
if(!x)return;
x.qty+=d;
if(x.qty<=0)cart=cart.filter(i=>i.id!==id);
saveCart();
}

function totals(){
let sub=0;
let saved=0;
cart.forEach(i=>{
const p=product(i.id);
if(p){
sub+=Number(p.price||0)*i.qty;
saved+=Math.max(0,Number(p.mrp||p.price||0)-Number(p.price||0))*i.qty;
}
});
const delivery=sub===0?0:(settings.freeDeliveryAbove&&sub>=Number(settings.freeDeliveryAbove)?0:Number(settings.deliveryFee||0));
return{sub,saved,delivery,total:sub+delivery};
}

function renderCategories(){
const g=$("#categoryGrid");
if(!g)return;
g.innerHTML=cats.map(c=>`<button class="category-card" data-cat="${esc(c[1])}"><span>${c[0]}</span><b>${esc(c[1])}</b><small>देखें →</small></button>`).join("");
g.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{
activeCategory=b.dataset.cat;
renderFilters();
renderProducts();
location.hash="products";
});
}

function categories(){
return[...new Set(products.map(p=>p.category).filter(Boolean))];
}

function renderFilters(){
const wrap=$("#filterWrap");
if(!wrap)return;
const list=["सभी",...categories()];
if(!list.includes(activeCategory))activeCategory="सभी";
wrap.innerHTML=list.map(c=>`<button class="filter-btn ${c===activeCategory?"active":""}" data-filter="${esc(c)}">${esc(c)}</button>`).join("");
wrap.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{
activeCategory=b.dataset.filter;
renderFilters();
renderProducts();
});
}

function renderProducts(){
const grid=$("#productGrid");
const meta=$("#productMeta");
const empty=$("#emptyProducts");
if(!grid)return;

const q=($("#searchInput")?.value||"").trim().toLowerCase();
let list=products.filter(p=>p.active!==false);

if(activeCategory!=="सभी"){
list=list.filter(p=>String(p.category||"").toLowerCase()===activeCategory.toLowerCase());
}

if(q){
list=list.filter(p=>`${p.name||""} ${p.category||""} ${p.unit||""}`.toLowerCase().includes(q));
}

if(meta)meta.textContent=`${list.length} प्रोडक्ट`;
if(empty)empty.classList.toggle("hidden",!!list.length);

grid.innerHTML=list.map(p=>{
const img=p.imageData||p.imageUrl;
const price=Number(p.price||0);
const mrp=Number(p.mrp||0);
const off=Boolean(p.offer)||mrp>price;
const save=Math.max(0,mrp-price);

return`<article class="product-card"><div class="product-image">${off?`<span class="offer-chip">OFFER</span>`:""}${img?`<img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">`:`<span class="product-placeholder">${esc(p.emoji||"🛍️")}</span>`}</div><div class="product-info"><span class="product-category">${esc(p.category||"किराना")}</span><h3 title="${esc(p.name)}">${esc(p.name)}</h3><div class="weight">${esc(p.unit||"")}</div><div class="price-row"><div><b>${money(price)}</b>${mrp>price?`<span class="mrp">${money(mrp)}</span>`:""}</div><button class="add-btn" data-add="${esc(p.id)}" type="button">+</button></div>${save>0?`<small style="color:#16834d;font-size:9px">आप बचाएं ${money(save)}</small>`:""}</div></article>`;
}).join("");

grid.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>add(b.dataset.add));
}

function renderCart(){
const count=$("#cartCount");
const sub=$("#cartSub");
const box=$("#cartItems");
if(!count||!sub||!box)return;

const n=cart.reduce((a,x)=>a+x.qty,0);
const t=totals();

count.textContent=n;
sub.textContent=`${n} items`;

if(!cart.length){
box.innerHTML=`<div class="empty">🛒<br>Cart अभी खाली है।<br><a href="#products" onclick="closeCart()">Products देखें</a></div>`;
}else{
box.innerHTML=cart.map(i=>{
const p=product(i.id);
if(!p)return"";
const img=p.imageData||p.imageUrl;
return`<div class="cart-item"><div class="cart-item-img">${img?`<img src="${esc(img)}" alt="">`:esc(p.emoji||"🛍️")}</div><div><h4>${esc(p.name)}</h4><small>${money(p.price)} × ${i.qty}</small><div class="qty"><button data-minus="${esc(p.id)}" type="button">−</button><b>${i.qty}</b><button data-plus="${esc(p.id)}" type="button">+</button></div></div><div class="cart-price">${money(Number(p.price||0)*i.qty)}</div></div>`;
}).join("");
}

box.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>change(b.dataset.minus,-1));
box.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>change(b.dataset.plus,1));

const offer=$("#cartOffer");
if(offer){
offer.classList.toggle("hidden",t.saved<=0);
offer.textContent=t.saved>0?`🏷️ Offer का फायदा! आपने ${money(t.saved)} बचाए हैं।`:"";
}

$("#cartSubtotal").textContent=money(t.sub);
$("#cartSaved").textContent=money(t.saved);
$("#cartDelivery").textContent=t.delivery?money(t.delivery):"FREE";
$("#cartTotal").textContent=money(t.total);
$("#checkoutBtn").disabled=!cart.length||t.total<Number(settings.minOrder||0);
}

function openCart(){
$("#cartDrawer").classList.add("active");
$("#drawerOverlay").classList.remove("hidden");
renderCart();
}

function closeCart(){
$("#cartDrawer").classList.remove("active");
$("#drawerOverlay").classList.add("hidden");
}

window.closeCart=closeCart;

function cartText(){
const lines=cart.map(i=>{
const p=product(i.id);
return p?`• ${p.name} (${p.unit||""}) × ${i.qty} = ${money(Number(p.price||0)*i.qty)}`:"";
}).filter(Boolean);

const t=totals();

return`नमस्ते, जय माता दी से order करना है।

${lines.join("\n")}

Subtotal: ${money(t.sub)}
बचत: ${money(t.saved)}
Delivery: ${t.delivery?money(t.delivery):"FREE"}
Total: ${money(t.total)}`;
}

async function checkout(e){
e.preventDefault();

if(!user){
closeModal("checkoutModal");
openModal("authModal");
toast("पहले Google से login करें");
return;
}

const t=totals();

if(t.total<Number(settings.minOrder||0)){
toast(`Minimum order ${money(settings.minOrder)} है`);
return;
}

const data={
customer:{
uid:user.uid,
name:$("#customerName").value.trim(),
phone:$("#customerPhone").value.trim(),
email:user.email||""
},
address:$("#customerAddress").value.trim(),
note:$("#orderNote").value.trim(),
items:cart.map(i=>{
const p=product(i.id);
return{
id:i.id,
name:p?.name||"",
price:Number(p?.price||0),
unit:p?.unit||"",
qty:i.qty
};
}),
subtotal:t.sub,
saved:t.saved,
delivery:t.delivery,
total:t.total,
status:"Pending",
createdAt:serverTimestamp()
};

try{
const ref=await addDoc(collection(db,"orders"),data);
lastOrder={...data,id:ref.id};
cart=[];
saveCart();
closeModal("checkoutModal");
$("#successText").textContent=`Order #${ref.id.slice(0,8).toUpperCase()} सफलतापूर्वक भेज दिया गया है।`;
openModal("successModal");
}catch(err){
console.error("ORDER ERROR:",err);
toast("Order save नहीं हुआ: "+err.message);
}
}

function openModal(id){
const m=$("#"+id);
if(m)m.classList.remove("hidden");
}

function closeModal(id){
const m=$("#"+id);
if(m)m.classList.add("hidden");
}

async function login(){
const msg=$("#authMsg");
if(msg)msg.textContent="Google login हो रहा है...";

try{
const provider=new GoogleAuthProvider();
await signInWithPopup(auth,provider);
closeModal("authModal");
}catch(e){
console.error("LOGIN ERROR:",e);
if(msg)msg.textContent="Login failed: "+e.message;
}
}

function updateUser(){
const b=$("#loginBtn");
if(!b)return;

if(user){
b.textContent=user.displayName?user.displayName.split(" ")[0]:"Account";
b.onclick=()=>{
if(confirm("Logout करना है?"))signOut(auth);
};
}else{
b.textContent="Login";
b.onclick=()=>openModal("authModal");
}
}

async function load(){
const meta=$("#productMeta");

if(meta)meta.textContent="Products loading...";

try{
const[ps,s]=await Promise.all([
getDocs(collection(db,"products")),
getDoc(doc(db,"settings","shop"))
]);

products=ps.docs.map(d=>({id:d.id,...d.data()}));

if(s.exists()){
settings={...settings,...s.data()};
}

renderCategories();
renderFilters();
renderProducts();
renderCart();

if($("#shopAddress"))$("#shopAddress").textContent=settings.address||"Dummy Address, Bihar, India";

if($("#shopWhatsapp")){
$("#shopWhatsapp").textContent=settings.whatsapp?`+${String(settings.whatsapp).replace(/\D/g,"")}`:"+91 90000 00000";
}

if($("#shopHours")){
$("#shopHours").textContent=`${settings.openingTime||"सुबह 8:00"} — ${settings.closingTime||"रात 9:00"}`;
}

document.title=`${settings.name||"जय माता दी"} • किराना स्टोर`;

}catch(e){
console.error("PRODUCT LOAD ERROR:",e);
if(meta)meta.textContent="Products load नहीं हुए";
toast("Products load नहीं हुए: "+e.message);
}
}

function setup(){
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));

$("#cartBtn").onclick=openCart;
$("#closeCart").onclick=closeCart;
$("#drawerOverlay").onclick=closeCart;

$("#clearCart").onclick=()=>{
cart=[];
saveCart();
toast("Cart खाली कर दिया");
};

$("#checkoutBtn").onclick=()=>{
if(!user){
openModal("authModal");
return;
}
openModal("checkoutModal");
};

$("#checkoutForm").onsubmit=checkout;
$("#googleLogin").onclick=login;

$("#heroWhatsapp").onclick=()=>location.href=wa("नमस्ते, जय माता दी से किराना order करना है।");

$("#offerWhatsapp").onclick=()=>location.href=wa("नमस्ते, आज के offers के बारे में बताइए।");

$("#cartWhatsapp").onclick=()=>{
if(cart.length)location.href=wa(cartText());
else toast("पहले cart में सामान जोड़ें");
};

$("#successWhatsapp").onclick=()=>{
if(!lastOrder)return;

const lines=lastOrder.items.map(i=>`• ${i.name} (${i.unit||""}) × ${i.qty} = ${money(i.price*i.qty)}`);

const text=`नमस्ते, जय माता दी से order किया है।

Order ID: ${lastOrder.id}

${lines.join("\n")}

Subtotal: ${money(lastOrder.subtotal)}
बचत: ${money(lastOrder.saved)}
Delivery: ${lastOrder.delivery?money(lastOrder.delivery):"FREE"}
Total: ${money(lastOrder.total)}`;

location.href=wa(text);
};

$("#searchToggle").onclick=()=>{
$("#searchBar").classList.toggle("hidden");
if(!$("#searchBar").classList.contains("hidden"))$("#searchInput").focus();
};

$("#clearSearch").onclick=()=>{
$("#searchInput").value="";
renderProducts();
};

$("#searchInput").oninput=renderProducts;

$("#menuBtn").onclick=()=>$("#mobileMenu").classList.toggle("active");

document.querySelectorAll("#mobileMenu a").forEach(a=>a.onclick=()=>$("#mobileMenu").classList.remove("active"));

$("#year").textContent=new Date().getFullYear();
}

window.addEventListener("beforeinstallprompt",e=>{
e.preventDefault();
installPrompt=e;
$("#installAppBtn").classList.remove("hidden");
});

$("#installAppBtn").onclick=async()=>{
if(!installPrompt)return;
installPrompt.prompt();
await installPrompt.userChoice;
installPrompt=null;
$("#installAppBtn").classList.add("hidden");
};

window.addEventListener("appinstalled",()=>{
$("#installAppBtn").classList.add("hidden");
});

if("serviceWorker"in navigator){
window.addEventListener("load",()=>{
navigator.serviceWorker.register("./sw.js").catch(console.warn);
});
}

setup();
onAuthStateChanged(auth,u=>{
user=u;
updateUser();
});
load();
