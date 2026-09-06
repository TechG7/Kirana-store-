import { db } from "./firebase/firebase-config.js";
import { collection,onSnapshot,query,where,limit } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const SHOP={name:"जय माता किराना दुकान",whatsapp:"919876543210",address:"आपका दुकान का पूरा पता",deliveryMessage:"नमस्ते जय माता किराना दुकान! 👋\nमुझे होम डिलीवरी के बारे में जानकारी चाहिए।"};
const $=s=>document.querySelector(s);
const money=v=>`₹${Number(v||0).toLocaleString("en-IN")}`;
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

let cart=[];
try{cart=JSON.parse(localStorage.getItem("jaiMataCart"))||[]}catch{cart=[]}
let products=[];
let selectedCategory="All";

function saveCart(){localStorage.setItem("jaiMataCart",JSON.stringify(cart));renderCart()}
function cartTotal(){return cart.reduce((t,i)=>t+Number(i.price||0)*Number(i.quantity||0),0)}
function cartCount(){return cart.reduce((t,i)=>t+Number(i.quantity||0),0)}

function toast(msg){
  const el=$("#toast");if(!el)return;
  el.textContent=msg;el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}

function normalizeProduct(s){
  const d=s.data()||{};
  return{
    id:s.id,
    name:String(d.name||"बिना नाम"),
    category:String(d.category||"Other"),
    price:Number(d.price||0),
    mrp:Number(d.mrp||0),
    unit:String(d.unit||""),
    stock:Number.isFinite(Number(d.stock))?Number(d.stock):0,
    emoji:String(d.emoji||"🛒"),
    imageUrl:String(d.imageUrl||""),
    offer:d.offer===true,
    active:d.active===true
  };
}

function loadProducts(){
  const grid=$("#productGrid");if(!grid)return;
  grid.innerHTML=`<div class="loading-products"><div>🛒</div><p>Products load हो रहे हैं...</p></div>`;
  const q=query(collection(db,"products"),where("active","==",true),limit(300));
  onSnapshot(q,snap=>{
    products=snap.docs.map(normalizeProduct);
    syncCart();
    syncFilters();
    renderProducts();
  },err=>{
    console.error("Products error:",err);
    products=[];
    grid.innerHTML=`<div class="product-error"><div style="font-size:40px">⚠️</div><h3>Products load नहीं हो पाए</h3><p>कृपया page refresh करें।</p></div>`;
    if($("#noResults"))$("#noResults").style.display="none";
  });
}

function syncFilters(){
  const wrap=document.querySelector(".filter-wrap");if(!wrap)return;
  const existing=new Set([...wrap.querySelectorAll(".filter-btn")].map(b=>b.dataset.filter));
  [...new Set(products.map(p=>p.category.trim()).filter(Boolean))].forEach(cat=>{
    if(existing.has(cat))return;
    const b=document.createElement("button");
    b.className="filter-btn";b.dataset.filter=cat;b.textContent=cat;
    wrap.appendChild(b);
  });
}

function renderProducts(){
  const grid=$("#productGrid");const no=$("#noResults");if(!grid)return;
  const search=($("#searchInput")?.value||"").trim().toLowerCase();
  const list=products.filter(p=>{
    const cat=selectedCategory==="All"||p.category.toLowerCase()===selectedCategory.toLowerCase();
    const text=!search||p.name.toLowerCase().includes(search)||p.category.toLowerCase().includes(search)||p.unit.toLowerCase().includes(search);
    return cat&&text;
  });
  if(!list.length){
    grid.innerHTML="";
    if(no)no.style.display="block";
    return;
  }
  if(no)no.style.display="none";
  grid.innerHTML=list.map(p=>{
    const sold=p.stock<=0||p.price<=0;
    const image=p.imageUrl
      ?`<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:contain;display:block">`
      :`<span style="font-size:64px">${escapeHtml(p.emoji)}</span>`;
    const mrp=p.mrp>p.price?`<del style="margin-left:6px;opacity:.55;font-size:.85em">${money(p.mrp)}</del>`:"";
    const offer=p.offer?`<span class="product-offer" style="position:absolute;top:10px;left:10px;z-index:2;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:700">OFFER</span>`:"";
    const stock=sold?`<span style="display:block;margin-top:5px;color:#d32f2f;font-size:12px;font-weight:600">Out of Stock</span>`:`<span style="display:block;margin-top:5px;opacity:.65;font-size:12px">${p.stock} available</span>`;
    return `<article class="product-card" data-category="${escapeHtml(p.category)}" data-name="${escapeHtml(p.name)}" data-id="${escapeHtml(p.id)}"><div class="product-image" style="position:relative">${offer}${image}</div><div class="product-info"><span class="product-category">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.name)}</h3><p class="weight">${escapeHtml(p.unit)}</p><div class="price-row"><div><strong>${money(p.price)}</strong>${mrp}${stock}</div><button class="add-btn" data-product-id="${escapeHtml(p.id)}" ${sold?"disabled":""}>${sold?"×":"+"}</button></div></div></article>`;
  }).join("");
}

function syncCart(){
  cart=cart.map(item=>{
    if(!item.id)return item;
    const p=products.find(x=>x.id===item.id);
    if(!p)return item;
    return{...item,name:p.name,price:p.price,unit:p.unit,emoji:p.emoji,imageUrl:p.imageUrl,quantity:p.stock>0?Math.min(Number(item.quantity||1),p.stock):Number(item.quantity||1)};
  });
  localStorage.setItem("jaiMataCart",JSON.stringify(cart));
}

function addToCart(p){
  if(!p||!p.active||p.stock<=0){toast("यह product अभी उपलब्ध नहीं है");return}
  const item=cart.find(x=>x.id===p.id);
  if(item){
    if(Number(item.quantity)>=p.stock){toast("इतना stock उपलब्ध नहीं है");return}
    item.quantity++;
  }else{
    cart.push({id:p.id,name:p.name,price:p.price,unit:p.unit,quantity:1,emoji:p.emoji,imageUrl:p.imageUrl});
  }
  saveCart();toast(`${p.name} cart में add हो गया ✓`);
}

function renderCart(){
  const box=$("#cartItems");if(!box)return;
  if(!cart.length){
    box.innerHTML=`<div class="empty-cart"><div style="font-size:48px">🛒</div><p>आपका cart खाली है</p></div>`;
  }else{
    box.innerHTML=cart.map((item,i)=>{
      const image=item.imageUrl?`<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" style="width:52px;height:52px;object-fit:contain">`:`<span style="font-size:35px">${escapeHtml(item.emoji||"🛒")}</span>`;
      return `<div class="cart-item" data-cart-index="${i}"><div class="cart-item-image">${image}</div><div class="cart-item-info"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.unit||"")}</small><div>${money(item.price)}</div><div class="cart-quantity"><button data-cart-action="decrease" data-index="${i}">−</button><span>${item.quantity}</span><button data-cart-action="increase" data-index="${i}">+</button></div></div></div>`;
    }).join("");
  }
  if($("#cartTotal"))$("#cartTotal").textContent=Number(cartTotal()).toLocaleString("en-IN");
  updateBadge();
}

function updateBadge(){
  const n=cartCount();
  document.querySelectorAll("#cartCount,#cartBadge,.cart-count").forEach(el=>{
    el.textContent=n;el.style.display=n>0?"":"none";
  });
}

function changeQty(i,amount){
  const item=cart[i];if(!item)return;
  if(amount>0&&item.id){
    const p=products.find(x=>x.id===item.id);
    if(p&&Number(item.quantity)>=Number(p.stock)){toast("इतना stock उपलब्ध नहीं है");return}
  }
  item.quantity+=amount;
  if(item.quantity<=0)cart.splice(i,1);
  saveCart();
}

function openCart(){
  $("#cartDrawer")?.classList.add("open");
  $("#overlay")?.classList.add("show");
}
function closeCart(){
  $("#cartDrawer")?.classList.remove("open");
  $("#overlay")?.classList.remove("show");
}

function whatsapp(message){
  window.open(`https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(message)}`,"_blank");
}

function checkout(){
  if(!cart.length){toast("पहले cart में products add करें");return}
  let msg=`🛒 *${SHOP.name}*\n\nमुझे ये सामान चाहिए:\n\n`;
  cart.forEach((i,n)=>msg+=`${n+1}. ${i.name}${i.unit?` (${i.unit})`:""} × ${i.quantity} = ${money(Number(i.price)*Number(i.quantity))}\n`);
  msg+=`\n💰 *Total: ${money(cartTotal())}*\n\n📍 ${SHOP.address}`;
  whatsapp(msg);
}

$("#productGrid")?.addEventListener("click",e=>{
  const b=e.target.closest(".add-btn");if(!b||b.disabled)return;
  const p=products.find(x=>x.id===b.dataset.productId);
  if(p)addToCart(p);
});

$("#cartItems")?.addEventListener("click",e=>{
  const b=e.target.closest("[data-cart-action]");if(!b)return;
  changeQty(Number(b.dataset.index),b.dataset.cartAction==="increase"?1:-1);
});

document.querySelector(".filter-wrap")?.addEventListener("click",e=>{
  const b=e.target.closest(".filter-btn");if(!b)return;
  selectedCategory=b.dataset.filter||"All";
  document.querySelectorAll(".filter-btn").forEach(x=>x.classList.remove("active"));
  b.classList.add("active");
  renderProducts();
});

$("#searchInput")?.addEventListener("input",renderProducts);

document.querySelectorAll("#cartButton,.cart-button,[data-open-cart]").forEach(b=>b.addEventListener("click",openCart));
$("#closeCart")?.addEventListener("click",closeCart);
$("#overlay")?.addEventListener("click",closeCart);

$("#clearCart")?.addEventListener("click",()=>{
  if(!cart.length)return;
  cart=[];saveCart();toast("Cart clear कर दिया गया");
});

$("#checkoutBtn")?.addEventListener("click",checkout);

["#heroWhatsApp","#offerWhatsApp","#deliveryWhatsApp","#floatingWhatsApp"].forEach(s=>{
  $(s)?.addEventListener("click",()=>whatsapp(SHOP.deliveryMessage));
});

document.addEventListener("click",e=>{
  const card=e.target.closest(".category-card");if(!card)return;
  const cat=card.dataset.category;if(!cat)return;
  const match=products.find(p=>p.category.toLowerCase()===cat.toLowerCase());
  selectedCategory=match?match.category:cat;
  const b=[...document.querySelectorAll(".filter-btn")].find(x=>x.dataset.filter.toLowerCase()===selectedCategory.toLowerCase());
  document.querySelectorAll(".filter-btn").forEach(x=>x.classList.remove("active"));
  b?.classList.add("active");
  renderProducts();
  $("#products")?.scrollIntoView({behavior:"smooth"});
});

const menu=document.querySelector(".menu-toggle"),nav=document.querySelector(".nav-menu");
menu?.addEventListener("click",()=>nav?.classList.toggle("open"));
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCart()});
if($("#year"))$("#year").textContent=new Date().getFullYear();

renderCart();
loadProducts();
