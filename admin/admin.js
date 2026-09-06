import { auth, db, storage } from "../firebase/firebase-config.js";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc,
  orderBy, query, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

const $=s=>document.querySelector(s), money=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;
let products=[], orders=[], settings={name:"जय माता किराना दुकान",whatsapp:"",upiId:"",address:"",mapUrl:"",openingTime:"सुबह 8:00",closingTime:"रात 9:00",deliveryFee:0,freeDeliveryAbove:500,minOrder:0};

function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

onAuthStateChanged(auth, async user=>{
  if(!user){$("#loginScreen").classList.remove("hidden");$("#app").classList.add("hidden");return}
  try{
    const a=await getDoc(doc(db,"admins",user.uid));
    if(!a.exists()||a.data().role!=="admin"){await signOut(auth);throw new Error("Admin access नहीं मिला। पहले admins collection में UID add करें।")}
    $("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");await loadAll();
  }catch(e){$("#loginMsg").textContent=e.message;$("#loginScreen").classList.remove("hidden");$("#app").classList.add("hidden")}
});
$("#loginForm").onsubmit=async e=>{e.preventDefault();$("#loginMsg").textContent="Logging in...";try{await signInWithEmailAndPassword(auth,$("#email").value,$("#password").value)}catch(e){$("#loginMsg").textContent=e.message}};
$("#logoutBtn").onclick=()=>signOut(auth);$("#mobileLogout").onclick=()=>signOut(auth);

document.querySelectorAll(".side-link[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
function showView(v){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));$("#view-"+v).classList.remove("hidden");document.querySelectorAll(".side-link[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===v))}

async function loadAll(){await Promise.all([loadProducts(),loadOrders(),loadSettings()]);renderDashboard();renderProducts();renderOrders();fillSettings()}
async function loadProducts(){const s=await getDocs(query(collection(db,"products"),limit(300)));products=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadOrders(){const s=await getDocs(query(collection(db,"orders"),orderBy("createdAt","desc"),limit(200)));orders=s.docs.map(d=>({id:d.id,...d.data()}))}
async function loadSettings(){const s=await getDoc(doc(db,"settings","shop"));if(s.exists())settings={...settings,...s.data()}}

function renderDashboard(){
 $("#statProducts").textContent=products.length;$("#statOrders").textContent=orders.length;
 $("#statPending").textContent=orders.filter(o=>["Pending","Confirmed","Preparing","Out for Delivery"].includes(o.status)).length;
 $("#statSales").textContent=money(orders.filter(o=>o.status==="Delivered").reduce((a,o)=>a+Number(o.total||0),0));
 $("#recentOrders").innerHTML=orderRows(orders.slice(0,8));
}
function orderRows(list){
 if(!list.length)return `<div class="empty">अभी कोई order नहीं है।</div>`;
 return `<table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>${list.map(o=>`<tr>
 <td>#${esc(o.id.slice(0,8).toUpperCase())}</td><td>${esc(o.customer?.name)}<br>${esc(o.customer?.phone)}</td><td>${money(o.total)}</td>
 <td><span class="status">${esc(o.status)}</span></td><td><select class="statusSelect" data-id="${o.id}">${["Pending","Confirmed","Preparing","Out for Delivery","Delivered","Cancelled"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>`;
}
function renderOrders(){$("#orderTable").innerHTML=orderRows(orders);bindOrderStatus()}
function bindOrderStatus(){document.querySelectorAll(".statusSelect").forEach(s=>s.onchange=async()=>{await updateDoc(doc(db,"orders",s.dataset.id),{status:s.value});const o=orders.find(x=>x.id===s.dataset.id);if(o)o.status=s.value;renderDashboard();toast("Order status updated")})}
function renderProducts(){
 $("#productTable").innerHTML=products.length?`<table class="table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Offer</th><th>Actions</th></tr></thead><tbody>${products.map(p=>`<tr><td>${p.imageUrl?`<img src="${esc(p.imageUrl)}" style="width:40px;height:40px;object-fit:cover;border-radius:8px">`:"🛍️"} ${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock??0}</td><td>${p.offer?"Yes":"—"}</td><td class="actions"><button class="tiny" data-edit="${p.id}">Edit</button><button class="tiny danger" data-del="${p.id}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">अभी product नहीं है।</div>`;
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openProduct(b.dataset.edit));
 document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.del));
}
$("#addProductBtn").onclick=()=>openProduct();
$("#closeProduct").onclick=()=>$("#productModal").classList.add("hidden");

function openProduct(id){
 const p=products.find(x=>x.id===id);
 $("#productModalTitle").textContent=p?"Edit Product":"Add Product";
 $("#pId").value=p?.id||"";$("#pName").value=p?.name||"";$("#pCategory").value=p?.category||"";$("#pPrice").value=p?.price??"";$("#pMrp").value=p?.mrp??"";
 $("#pUnit").value=p?.unit||"";$("#pStock").value=p?.stock??0;$("#pEmoji").value=p?.emoji||"🛍️";$("#pOffer").checked=!!p?.offer;$("#pActive").checked=p?p.active!==false:true;$("#pImage").value="";
 $("#productModal").classList.remove("hidden");
}
async function deleteProduct(id){if(!confirm("Product delete करें?"))return;await deleteDoc(doc(db,"products",id));await loadProducts();renderProducts();renderDashboard();toast("Product deleted")}
$("#productForm").onsubmit=async e=>{
 e.preventDefault();const id=$("#pId").value;const old=products.find(x=>x.id===id);
 const data={name:$("#pName").value.trim(),category:$("#pCategory").value.trim(),price:Number($("#pPrice").value),mrp:Number($("#pMrp").value||0),unit:$("#pUnit").value.trim(),stock:Number($("#pStock").value),emoji:$("#pEmoji").value.trim()||"🛍️",offer:$("#pOffer").checked,active:$("#pActive").checked,updatedAt:serverTimestamp()};
 try{
  const file=$("#pImage").files[0];
  if(file){const r=ref(storage,`products/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"")}`);await uploadBytes(r,file);data.imageUrl=await getDownloadURL(r)}
  if(id) await updateDoc(doc(db,"products",id),data); else await setDoc(doc(collection(db,"products")), {...data,createdAt:serverTimestamp()});
  $("#productModal").classList.add("hidden");await loadProducts();renderProducts();renderDashboard();toast("Product saved");
 }catch(err){console.error(err);toast("Save failed: "+err.message)}
};

function fillSettings(){
 $("#sName").value=settings.name||"";$("#sWhatsapp").value=settings.whatsapp||"";$("#sUpi").value=settings.upiId||"";$("#sMap").value=settings.mapUrl||"";
 $("#sAddress").value=settings.address||"";$("#sOpen").value=settings.openingTime||"";$("#sClose").value=settings.closingTime||"";
 $("#sDelivery").value=settings.deliveryFee??0;$("#sFree").value=settings.freeDeliveryAbove??500;$("#sMin").value=settings.minOrder??0;
}
$("#saveSettings").onclick=async()=>{
 settings={...settings,name:$("#sName").value.trim(),whatsapp:$("#sWhatsapp").value.trim(),upiId:$("#sUpi").value.trim(),mapUrl:$("#sMap").value.trim(),address:$("#sAddress").value.trim(),openingTime:$("#sOpen").value.trim(),closingTime:$("#sClose").value.trim(),deliveryFee:Number($("#sDelivery").value||0),freeDeliveryAbove:Number($("#sFree").value||0),minOrder:Number($("#sMin").value||0)};
 await setDoc(doc(db,"settings","shop"),settings,{merge:true});toast("Settings saved");
}
$("#refreshOrders").onclick=async()=>{await loadOrders();renderOrders();renderDashboard();toast("Orders refreshed")};
Gautam 
