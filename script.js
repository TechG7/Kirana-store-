import{db}from"./firebase/firebase-config.js";
import{collection,getDocs,query,where,limit,doc,getDoc,addDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
const $=s=>document.querySelector(s),money=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;
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
let products=[],settings={name:"जय माता किराना दुकान",whatsapp:"",upiId:"",address:"पता जल्द अपडेट होगा।",mapUrl:"",openingTime:"सुबह 8:00",closingTime:"रात 9:00",deliveryFee:0,freeDeliveryAbove:500,minOrder:0};
let cart=JSON.parse(localStorage.getItem("jaiMataCart")||"{}"),activeCategory="सभी",searchTerm="";
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function saveCart(){localStorage.setItem("jaiMataCart",JSON.stringify(cart))}
function cartItems(){return Object.values(cart)}
function cartCount(){return cartItems().reduce((a,i)=>a+i.qty,0)}
function cartSubtotal(){return cartItems().reduce((a,i)=>a+i.price*i.qty,0)}
function deliveryFee(){const sub=cartSubtotal();if(!sub)return 0;if(settings.freeDeliveryAbove&&sub>=Number(settings.freeDeliveryAbove))return 0;return Number(settings.deliveryFee||0)}
function whatsappUrl(text){return`https://wa.me/${String(settings.whatsapp||"").replace(/\D/g,"")}?text=${encodeURIComponent(text)}`}
function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(v=""){return escapeHtml(v)}
async function loadData(){
try{
const[ps,ss]=await Promise.all([getDocs(query(collection(db,"products"),where("active","==",true),limit(200))),getDoc(doc(db,"settings","shop"))]);
products=ps.docs.map(d=>({id:d.id,...d.data()}));
if(ss.exists())settings={...settings,...ss.data()};
if(!products.length)products=fallbackProducts;
}catch(e){console.warn(e);products=fallbackProducts;toast("Firebase अभी setup नहीं हुआ — demo products दिख रहे हैं।")}
renderShop();renderAll();renderCart()
}
function renderShop(){
$("#shopName").textContent=settings.name;
$("#shopAddress").textContent=settings.address;
$("#shopHours").textContent=`${settings.openingTime||""} – ${settings.closingTime||""}`;
$("#deliveryText").textContent=`₹${Number(settings.deliveryFee||0)} delivery • ₹${Number(settings.freeDeliveryAbove||0)}+ पर free delivery`;
const phone=String(settings.whatsapp||"").replace(/\D/g,"");
$("#heroWhatsapp").href=phone?whatsappUrl("नमस्ते! मुझे जय माता किराना दुकान से खरीदारी करनी है।"):"#";
$("#contactWhatsapp").href=phone?whatsappUrl("नमस्ते जय माता किराना दुकान! मुझे जानकारी चाहिए।"):"#";
$("#callBtn").href=phone?`tel:+${phone}`:"#";
$("#mapBtn").href=settings.mapUrl||"#"
}
function renderCategories(){
const cats=["सभी",...new Set(products.map(p=>p.category).filter(Boolean))];
$("#categoryList").innerHTML=cats.map(c=>`<button class="chip ${activeCategory===c?"active":""}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
document.querySelectorAll(".chip").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;renderAll()})
}
function filtered(){
return products.filter(p=>{const cat=activeCategory==="सभी"||p.category===activeCategory,q=!searchTerm||`${p.name} ${p.category} ${p.unit}`.toLowerCase().includes(searchTerm.toLowerCase());return cat&&q&&p.stock!==0})
}
function productImage(p){
const src=p.imageData||p.imageUrl;
return src?`<img src="${escapeAttr(src)}" alt="${escapeAttr(p.name)}" loading="lazy">`:`<span>${escapeHtml(p.emoji||"🛍️")}</span>`
}
function card(p){
return`<article class="product">${p.offer?`<span class="badge">OFFER</span>`:""}<div class="product-img">${productImage(p)}</div><h3>${escapeHtml(p.name)}</h3><div class="unit">${escapeHtml(p.unit||"")}</div><div class="price-row"><div><span class="price">${money(p.price)}</span>${p.mrp?`<span class="mrp">${money(p.mrp)}</span>`:""}</div><button class="add" data-add="${p.id}" aria-label="Add">+</button></div></article>`
}
function renderAll(){
renderCategories();
const list=filtered();
$("#productCount").textContent=`${list.length} items`;
$("#productGrid").innerHTML=list.map(card).join("");
$("#offerGrid").innerHTML=products.filter(p=>p.offer&&p.stock!==0).slice(0,4).map(card).join("")||`<div class="empty">अभी कोई offer नहीं है।</div>`;
$("#emptyState").classList.toggle("hidden",list.length!==0);
document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addToCart(b.dataset.add))
}
function addToCart(id){
const p=products.find(x=>x.id===id);if(!p)return;
if(!cart[id])cart[id]={id:p.id,name:p.name,price:Number(p.price),unit:p.unit||"",imageData:p.imageData||"",imageUrl:p.imageUrl||"",emoji:p.emoji||"🛍️",qty:0};
if(p.stock&&cart[id].qty>=p.stock){toast("इतना stock उपलब्ध नहीं है।");return}
cart[id].qty++;saveCart();renderCart();toast(`${p.name} cart में add हो गया`)
}
function changeQty(id,d){
if(!cart[id])return;
cart[id].qty+=d;
if(cart[id].qty<=0)delete cart[id];
saveCart();renderCart()
}
function renderCart(){
$("#cartCount").textContent=cartCount();
const items=cartItems();
$("#cartItems").innerHTML=items.length?items.map(i=>`<div class="cart-line"><div class="cart-thumb">${i.imageData||i.imageUrl?`<img src="${escapeAttr(i.imageData||i.imageUrl)}" alt="">`:escapeHtml(i.emoji)}</div><div><h4>${escapeHtml(i.name)}</h4><small>${money(i.price)} • ${escapeHtml(i.unit)}</small><div class="qty"><button data-q="${i.id}" data-d="-1">−</button><b>${i.qty}</b><button data-q="${i.id}" data-d="1">+</button></div></div><b>${money(i.price*i.qty)}</b></div>`).join(""):`<div class="empty">🛒<br>आपकी cart अभी खाली है।</div>`;
const sub=cartSubtotal(),fee=deliveryFee();
$("#cartSubtotal").textContent=money(sub);
$("#cartDelivery").textContent=fee?money(fee):"Free";
$("#cartTotal").textContent=money(sub+fee);
$("#checkoutTotal").textContent=money(sub+fee);
document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>changeQty(b.dataset.q,Number(b.dataset.d)))
}
function openCart(){$("#cartDrawer").classList.remove("hidden");renderCart()}
function closeCart(){$("#cartDrawer").classList.add("hidden")}
function orderText(){
const lines=cartItems().map(i=>`• ${i.name} × ${i.qty} = ${money(i.price*i.qty)}`).join("\n");
return`नमस्ते ${settings.name}!\nमेरा किराना ऑर्डर:\n${lines}\n\nSubtotal: ${money(cartSubtotal())}\nDelivery: ${deliveryFee()?money(deliveryFee()):"Free"}\nTotal: ${money(cartSubtotal()+deliveryFee())}`
}
$("#cartBtn").onclick=openCart;
$("#closeCart").onclick=closeCart;
$("#checkoutBtn").onclick=()=>{if(!cartItems().length)return toast("पहले cart में सामान जोड़ें।");$("#cartDrawer").classList.add("hidden");$("#checkoutModal").classList.remove("hidden")};
$("#closeCheckout").onclick=()=>$("#checkoutModal").classList.add("hidden");
$("#closeSuccess").onclick=()=>$("#successModal").classList.add("hidden");
$("#whatsappCartBtn").onclick=()=>{if(!settings.whatsapp)return toast("WhatsApp number admin settings में जोड़ें।");if(!cartItems().length)return toast("Cart खाली है।");window.open(whatsappUrl(orderText()),"_blank")};
$("#searchInput").oninput=e=>{searchTerm=e.target.value;renderAll()};
$("#clearSearch").onclick=()=>{$("#searchInput").value="";searchTerm="";renderAll()};
$("#checkoutForm [name=payment]").onchange=e=>$("#upiBox").classList.toggle("hidden",e.target.value!=="UPI");
$("#checkoutForm").onsubmit=async e=>{
e.preventDefault();
if(!cartItems().length)return;
const f=new FormData(e.target),sub=cartSubtotal(),fee=deliveryFee(),total=sub+fee;
const order={customer:{name:String(f.get("name")).trim(),phone:String(f.get("phone")).trim()},items:cartItems().map(i=>({id:i.id,name:i.name,price:i.price,qty:i.qty,unit:i.unit})),subtotal:sub,deliveryFee:fee,total,paymentMethod:String(f.get("payment")),deliverySlot:String(f.get("slot")),address:String(f.get("address")).trim(),status:"Pending",createdAt:serverTimestamp()};
try{
const ref=await addDoc(collection(db,"orders"),order);
cart={};saveCart();renderCart();
$("#checkoutModal").classList.add("hidden");
$("#successModal").classList.remove("hidden");
$("#orderSuccessText").textContent=`Order ID: ${ref.id.slice(0,8).toUpperCase()} • Total ${money(total)}`;
$("#successWhatsapp").href=settings.whatsapp?whatsappUrl(`Order ID: ${ref.id}\n${orderText()}\n\nनाम: ${order.customer.name}\nफोन: ${order.customer.phone}\nपता: ${order.address}\nPayment: ${order.paymentMethod}`):"#";
if(order.paymentMethod==="UPI"&&settings.upiId){
const upi=`upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.name)}&am=${total.toFixed(2)}&cu=INR`;
try{
const qr=await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm");
await qr.toCanvas($("#upiCanvas"),upi,{width:190});
$("#upiCanvas").classList.remove("hidden")
}catch(err){console.warn("QR error",err)}
}
}catch(err){console.error(err);toast("Order save नहीं हुआ। Firebase rules/settings check करें।")}
};
$("#year").textContent=new Date().getFullYear();
loadData();
