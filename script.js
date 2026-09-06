import{db}from"./firebase/firebase-config.js";
import{collection,getDocs,doc,getDoc,addDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const $=s=>document.querySelector(s);
const money=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;

const fallbackProducts=[
{id:"demo1",name:"आटा",category:"आटा • चावल • दाल",price:55,mrp:65,unit:"1 kg",emoji:"🌾",stock:50,active:true,offer:true},
{id:"demo2",name:"बासमती चावल",category:"आटा • चावल • दाल",price:95,mrp:110,unit:"1 kg",emoji:"🍚",stock:50,active:true,offer:true},
{id:"demo3",name:"सरसों तेल",category:"तेल • मसाले",price:145,mrp:165,unit:"1 L",emoji:"🫗",stock:30,active:true,offer:true},
{id:"demo4",name:"चीनी",category:"आटा • चावल • दाल",price:48,mrp:55,unit:"1 kg",emoji:"🧂",stock:40,active:true},
{id:"demo5",name:"दूध",category:"डेयरी",price:30,mrp:32,unit:"500 ml",emoji:"🥛",stock:40,active:true},
{id:"demo6",name:"बिस्कुट",category:"स्नैक्स",price:25,mrp:30,unit:"Pack",emoji:"🍪",stock:35,active:true},
{id:"demo7",name:"नमकीन",category:"स्नैक्स",price:45,mrp:50,unit:"200 g",emoji:"🥨",stock:25,active:true},
{id:"demo8",name:"हल्दी पाउडर",category:"तेल • मसाले",price:42,mrp:50,unit:"100 g",emoji:"🟡",stock:25,active:true}
];

let products=[];
let settings={
name:"जय माता किराना दुकान",
whatsapp:"",
upiId:"",
address:"पता जल्द अपडेट होगा।",
mapUrl:"",
openingTime:"सुबह 8:00",
closingTime:"रात 9:00",
deliveryFee:0,
freeDeliveryAbove:500,
minOrder:0
};

let cart=JSON.parse(localStorage.getItem("jaiMataCart")||"{}");
let activeCategory="सभी";
let searchTerm="";

function toast(msg){
const t=$("#toast");
if(!t)return;
t.textContent=msg;
t.classList.add("show");
setTimeout(()=>t.classList.remove("show"),2200)
}

function saveCart(){
localStorage.setItem("jaiMataCart",JSON.stringify(cart))
}

function cartItems(){
return Object.values(cart)
}

function cartCount(){
return cartItems().reduce((a,i)=>a+Number(i.qty||0),0)
}

function cartSubtotal(){
return cartItems().reduce((a,i)=>a+Number(i.price||0)*Number(i.qty||0),0)
}

function deliveryFee(){
const sub=cartSubtotal();
if(!sub)return 0;
if(settings.freeDeliveryAbove&&sub>=Number(settings.freeDeliveryAbove))return 0;
return Number(settings.deliveryFee||0)
}

function whatsappUrl(text){
const phone=String(settings.whatsapp||"").replace(/\D/g,"");
return phone?`https://wa.me/${phone}?text=${encodeURIComponent(text)}`:"#"
}

async function loadData(){
try{
const productSnap=await getDocs(collection(db,"products"));
const settingSnap=await getDoc(doc(db,"settings","shop"));

const loaded=productSnap.docs.map(d=>({id:d.id,...d.data()}));

products=loaded.filter(p=>p.active!==false);

if(settingSnap.exists()){
settings={...settings,...settingSnap.data()}
}

if(!products.length){
products=fallbackProducts;
}

}catch(e){
console.error("Firebase load error:",e);
products=fallbackProducts;
toast("Products load नहीं हुए, demo products दिख रहे हैं।")
}

renderShop();
renderAll();
renderCart()
}

function renderShop(){
const name=$("#shopName");
const address=$("#shopAddress");
const hours=$("#shopHours");
const delivery=$("#deliveryText");

if(name)name.textContent=settings.name;
if(address)address.textContent=settings.address;
if(hours)hours.textContent=`${settings.openingTime||""} – ${settings.closingTime||""}`;

if(delivery){
const fee=Number(settings.deliveryFee||0);
const free=Number(settings.freeDeliveryAbove||0);
delivery.textContent=free?`₹${fee} delivery • ₹${free}+ पर free delivery`:`₹${fee} delivery`;
}

const phone=String(settings.whatsapp||"").replace(/\D/g,"");

const hero=$("#heroWhatsapp");
if(hero)hero.href=phone?whatsappUrl("नमस्ते! मुझे जय माता किराना दुकान से खरीदारी करनी है।"):"#";

const contact=$("#contactWhatsapp");
if(contact)contact.href=phone?whatsappUrl("नमस्ते जय माता किराना दुकान! मुझे जानकारी चाहिए।"):"#";

const call=$("#callBtn");
if(call)call.href=phone?`tel:+${phone}`:"#";

const map=$("#mapBtn");
if(map)map.href=settings.mapUrl||"#"
}

function renderCategories(){
const categoryBox=$("#categoryList");
if(!categoryBox)return;

const cats=["सभी",...new Set(products.map(p=>p.category).filter(Boolean))];

categoryBox.innerHTML=cats.map(c=>`
<button class="chip ${activeCategory===c?"active":""}" data-cat="${escapeAttr(c)}">${escapeHtml(c)}</button>
`).join("");

document.querySelectorAll("[data-cat]").forEach(b=>{
b.onclick=()=>{
activeCategory=b.dataset.cat;
renderAll()
}
})
}

function filtered(){
return products.filter(p=>{
const categoryOK=activeCategory==="सभी"||p.category===activeCategory;
const text=`${p.name||""} ${p.category||""} ${p.unit||""}`.toLowerCase();
const searchOK=!searchTerm||text.includes(searchTerm.toLowerCase());
const stockOK=p.stock===undefined||Number(p.stock)>0;
return categoryOK&&searchOK&&stockOK
})
}

function card(p){
const src=p.imageData||p.imageUrl||"";

const img=src
?`<img src="${escapeAttr(src)}" alt="${escapeAttr(p.name||"Product")}" loading="lazy">`
:`<span>${p.emoji||"🛍️"}</span>`;

return`
<article class="product">
${p.offer?`<span class="badge">OFFER</span>`:""}
<div class="product-img">${img}</div>
<h3>${escapeHtml(p.name||"Product")}</h3>
<div class="unit">${escapeHtml(p.unit||"")}</div>
<div class="price-row">
<div>
<span class="price">${money(p.price)}</span>
${p.mrp?`<span class="mrp">${money(p.mrp)}</span>`:""}
</div>
<button class="add" data-add="${escapeAttr(p.id)}" aria-label="Add">+</button>
</div>
</article>`
}

function renderAll(){
renderCategories();

const list=filtered();

const count=$("#productCount");
if(count)count.textContent=`${list.length} items`;

const grid=$("#productGrid");
if(grid){
grid.innerHTML=list.length
?list.map(card).join("")
:`<div class="empty">कोई product नहीं मिला।</div>`
}

const offers=$("#offerGrid");
if(offers){
const offerProducts=products.filter(p=>p.offer&&(p.stock===undefined||Number(p.stock)>0)).slice(0,4);
offers.innerHTML=offerProducts.length
?offerProducts.map(card).join("")
:`<div class="empty">अभी कोई offer नहीं है।</div>`
}

const empty=$("#emptyState");
if(empty)empty.classList.toggle("hidden",list.length!==0);

document.querySelectorAll("[data-add]").forEach(b=>{
b.onclick=()=>addToCart(b.dataset.add)
})
}

function addToCart(id){
const p=products.find(x=>x.id===id);
if(!p)return;

if(!cart[id]){
cart[id]={
id:p.id,
name:p.name,
price:Number(p.price||0),
unit:p.unit||"",
imageData:p.imageData||"",
imageUrl:p.imageUrl||"",
emoji:p.emoji||"🛍️",
qty:0
}
}

if(p.stock!==undefined&&Number(p.stock)>0&&cart[id].qty>=Number(p.stock)){
toast("इतना stock उपलब्ध नहीं है।");
return
}

cart[id].qty++;
saveCart();
renderCart();
toast(`${p.name} cart में add हो गया`)
}

function changeQty(id,d){
if(!cart[id])return;

cart[id].qty+=d;

if(cart[id].qty<=0){
delete cart[id]
}

saveCart();
renderCart()
}

function renderCart(){
const count=$("#cartCount");
if(count)count.textContent=cartCount();

const box=$("#cartItems");
const items=cartItems();

if(box){
box.innerHTML=items.length
?items.map(i=>{
const img=i.imageData||i.imageUrl||"";
return`
<div class="cart-line">
<div class="cart-thumb">
${img?`<img src="${escapeAttr(img)}" alt="">`:i.emoji}
</div>
<div>
<h4>${escapeHtml(i.name)}</h4>
<small>${money(i.price)} • ${escapeHtml(i.unit||"")}</small>
<div class="qty">
<button data-q="${escapeAttr(i.id)}" data-d="-1">−</button>
<b>${i.qty}</b>
<button data-q="${escapeAttr(i.id)}" data-d="1">+</button>
</div>
</div>
<b>${money(i.price*i.qty)}</b>
</div>`
}).join("")
:`<div class="empty">🛒<br>आपकी cart अभी खाली है।</div>`
}

const sub=cartSubtotal();
const fee=deliveryFee();
const total=sub+fee;

const subtotalEl=$("#cartSubtotal");
const deliveryEl=$("#cartDelivery");
const totalEl=$("#cartTotal");
const checkoutTotal=$("#checkoutTotal");

if(subtotalEl)subtotalEl.textContent=money(sub);
if(deliveryEl)deliveryEl.textContent=fee?money(fee):"Free";
if(totalEl)totalEl.textContent=money(total);
if(checkoutTotal)checkoutTotal.textContent=money(total);

document.querySelectorAll("[data-q]").forEach(b=>{
b.onclick=()=>changeQty(b.dataset.q,Number(b.dataset.d))
})
}

function openCart(){
const drawer=$("#cartDrawer");
if(drawer)drawer.classList.remove("hidden");
renderCart()
}

function closeCart(){
const drawer=$("#cartDrawer");
if(drawer)drawer.classList.add("hidden")
}

function orderText(){
const lines=cartItems().map(i=>`• ${i.name} × ${i.qty} = ${money(i.price*i.qty)}`).join("\n");

return`नमस्ते ${settings.name}!
मेरा किराना ऑर्डर:

${lines}

Subtotal: ${money(cartSubtotal())}
Delivery: ${deliveryFee()?money(deliveryFee()):"Free"}
Total: ${money(cartSubtotal()+deliveryFee())}`
}

function setupEvents(){

const cartBtn=$("#cartBtn");
if(cartBtn)cartBtn.onclick=openCart;

const closeCartBtn=$("#closeCart");
if(closeCartBtn)closeCartBtn.onclick=closeCart;

const checkoutBtn=$("#checkoutBtn");
if(checkoutBtn){
checkoutBtn.onclick=()=>{
if(!cartItems().length){
toast("पहले cart में सामान जोड़ें।");
return
}

if(settings.minOrder&&cartSubtotal()<Number(settings.minOrder)){
toast(`Minimum order ₹${settings.minOrder} है।`);
return
}

const drawer=$("#cartDrawer");
const modal=$("#checkoutModal");

if(drawer)drawer.classList.add("hidden");
if(modal)modal.classList.remove("hidden")
}
}

const closeCheckout=$("#closeCheckout");
if(closeCheckout){
closeCheckout.onclick=()=>{
const modal=$("#checkoutModal");
if(modal)modal.classList.add("hidden")
}
}

const closeSuccess=$("#closeSuccess");
if(closeSuccess){
closeSuccess.onclick=()=>{
const modal=$("#successModal");
if(modal)modal.classList.add("hidden")
}
}

const whatsappCart=$("#whatsappCartBtn");
if(whatsappCart){
whatsappCart.onclick=()=>{
if(!settings.whatsapp){
toast("WhatsApp number admin settings में जोड़ें।");
return
}

if(!cartItems().length){
toast("Cart खाली है।");
return
}

window.open(whatsappUrl(orderText()),"_blank")
}
}

const search=$("#searchInput");
if(search){
search.oninput=e=>{
searchTerm=e.target.value.trim();
renderAll()
}
}

const clear=$("#clearSearch");
if(clear){
clear.onclick=()=>{
if(search)search.value="";
searchTerm="";
renderAll()
}
}

const payment=$("#checkoutForm [name=payment]");
if(payment){
payment.onchange=e=>{
const upi=$("#upiBox");
if(upi)upi.classList.toggle("hidden",e.target.value!=="UPI")
}
}

const form=$("#checkoutForm");
if(form)form.onsubmit=submitOrder
}

async function submitOrder(e){
e.preventDefault();

if(!cartItems().length){
toast("Cart खाली है।");
return
}

const f=new FormData(e.target);

const customerName=String(f.get("name")||"").trim();
const customerPhone=String(f.get("phone")||"").trim();
const address=String(f.get("address")||"").trim();
const paymentMethod=String(f.get("payment")||"");
const deliverySlot=String(f.get("slot")||"");

if(!customerName||!customerPhone||!address){
toast("कृपया सभी जरूरी जानकारी भरें।");
return
}

const sub=cartSubtotal();
const fee=deliveryFee();
const total=sub+fee;

const order={
customer:{
name:customerName,
phone:customerPhone
},
items:cartItems().map(i=>({
id:i.id,
name:i.name,
price:Number(i.price||0),
qty:Number(i.qty||0),
unit:i.unit||""
})),
subtotal:sub,
deliveryFee:fee,
total:total,
paymentMethod:paymentMethod,
deliverySlot:deliverySlot,
address:address,
status:"Pending",
createdAt:serverTimestamp()
};

try{

const ref=await addDoc(collection(db,"orders"),order);

cart={};
saveCart();
renderCart();

const checkout=$("#checkoutModal");
const success=$("#successModal");

if(checkout)checkout.classList.add("hidden");
if(success)success.classList.remove("hidden");

const successText=$("#orderSuccessText");
if(successText){
successText.textContent=`Order ID: ${ref.id.slice(0,8).toUpperCase()} • Total ${money(total)}`
}

const successWhatsapp=$("#successWhatsapp");

if(successWhatsapp){
successWhatsapp.href=settings.whatsapp
?whatsappUrl(
`Order ID: ${ref.id}

${orderText()}

नाम: ${order.customer.name}
फोन: ${order.customer.phone}
पता: ${order.address}
Payment: ${order.paymentMethod}`
)
:"#"
}

if(paymentMethod==="UPI"&&settings.upiId){
await generateUPIQR(total)
}

e.target.reset();

const upiBox=$("#upiBox");
if(upiBox)upiBox.classList.add("hidden");

}catch(err){
console.error("Order error:",err);
toast("Order save नहीं हुआ। Firebase rules check करें।")
}
}

async function generateUPIQR(total){
if(!settings.upiId)return;

const canvas=$("#upiCanvas");
if(!canvas)return;

const upi=`upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.name)}&am=${Number(total).toFixed(2)}&cu=INR`;

try{
const qr=await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm");

await qr.toCanvas(canvas,upi,{
width:190,
margin:2
});

canvas.classList.remove("hidden")
}catch(err){
console.warn("UPI QR error:",err)
}
}

function setupPWA(){
let deferredPrompt=null;

const installBtn=
$("#installAppBtn")||
$("#installBtn")||
document.querySelector("[data-install-app]");

function hideInstallButton(){
if(installBtn){
installBtn.style.display="none";
installBtn.classList.add("hidden")
}
}

function showInstallButton(){
if(installBtn){
installBtn.style.display="";
installBtn.classList.remove("hidden")
}
}

if(window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true){
hideInstallButton()
}else{
showInstallButton()
}

window.addEventListener("beforeinstallprompt",e=>{
e.preventDefault();
deferredPrompt=e;
showInstallButton()
});

if(installBtn){
installBtn.addEventListener("click",async()=>{
if(!deferredPrompt){
toast("Install option अभी browser में उपलब्ध नहीं है।");
return
}

deferredPrompt.prompt();

try{
const choice=await deferredPrompt.userChoice;

if(choice.outcome==="accepted"){
hideInstallButton()
}
}catch(err){
console.warn(err)
}

deferredPrompt=null
})
}

window.addEventListener("appinstalled",()=>{
deferredPrompt=null;
hideInstallButton();
toast("App successfully install हो गया ✓")
});

if("serviceWorker"in navigator){
window.addEventListener("load",()=>{
navigator.serviceWorker.register("./sw.js")
.then(()=>console.log("PWA Service Worker registered"))
.catch(err=>console.warn("Service Worker error:",err))
})
}
}

function escapeHtml(v=""){
return String(v).replace(/[&<>"']/g,m=>({
"&":"&amp;",
"<":"&lt;",
">":"&gt;",
'"':"&quot;",
"'":"&#039;"
}[m]))
}

function escapeAttr(v=""){
return escapeHtml(v)
}

function start(){
setupEvents();
setupPWA();

const year=$("#year");
if(year)year.textContent=new Date().getFullYear();

loadData()
}

if(document.readyState==="loading"){
document.addEventListener("DOMContentLoaded",start)
}else{
start()
  }
