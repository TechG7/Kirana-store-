import {auth,db,storage} from "../firebase/firebase-config.js";
import{signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import{collection,getDocs,getDoc,setDoc,updateDoc,deleteDoc,doc,orderBy,query,limit,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import{ref,uploadBytes,getDownloadURL}from"https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

const $=s=>document.querySelector(s),money=n=>`₹${Number(n||0).toLocaleString("en-IN")}`;
let products=[],orders=[],settings={name:"जय माता किराना दुकान",whatsapp:"",upiId:"",address:"",mapUrl:"",openingTime:"सुबह 8:00",closingTime:"रात 9:00",deliveryFee:0,freeDeliveryAbove:500,minOrder:0};

function toast(m){const t=$("#toast");if(!t)return;t.textContent=m;t.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove("show"),3000)}
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function showError(e){console.error(e);toast(e?.message||String(e))}

onAuthStateChanged(auth,async user=>{
 if(!user){$("#loginScreen")?.classList.remove("hidden");$("#app")?.classList.add("hidden");return}
 try{
  const a=await getDoc(doc(db,"admins",user.uid));
  if(!a.exists()||a.data().role!=="admin"){await signOut(auth);throw new Error("Admin access नहीं मिला। admins collection में इस user का UID और role='admin' होना चाहिए।")}
  $("#loginScreen")?.classList.add("hidden");$("#app")?.classList.remove("hidden");await loadAll();
 }catch(e){console.error(e);$("#loginMsg").textContent=e.message||"Admin verification failed";$("#loginScreen")?.classList.remove("hidden");$("#app")?.classList.add("hidden")}
});

$("#loginForm").onsubmit=async e=>{
 e.preventDefault();$("#loginMsg").textContent="Logging in...";
 try{await signInWithEmailAndPassword(auth,$("#email").value.trim(),$("#password").value)}catch(e){console.error(e);$("#loginMsg").textContent=e.message}
};
$("#logoutBtn").onclick=()=>signOut(auth);
$("#mobileLogout").onclick=()=>signOut(auth);

document.querySelectorAll(".side-link[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
function showView(v){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));const el=$("#view-"+v);if(el)el.classList.remove("hidden");document.querySelectorAll(".side-link[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===v))}

async function loadAll(){
 try{await Promise.all([loadProducts(),loadOrders(),loadSettings()]);renderDashboard();renderProducts();renderOrders();fillSettings()}
 catch(e){console.error(e);toast("Data load failed: "+e.message)}
}

async function loadProducts(){
 const s=await getDocs(query(collection(db,"products"),limit(300)));
 products=s.docs.map(d=>({id:d.id,...d.data()}));
}

async function loadOrders(){
 try{
  const s=await getDocs(query(collection(db,"orders"),orderBy("createdAt","desc"),limit(200)));
  orders=s.docs.map(d=>({id:d.id,...d.data()}));
 }catch(e){
  console.error(e);orders=[];
  if(e.code==="failed-precondition")toast("Orders के लिए Firestore index चाहिए।");
 }
}

async function loadSettings(){
 const s=await getDoc(doc(db,"settings","shop"));
 if(s.exists())settings={...settings,...s.data()};
}

function renderDashboard(){
 if($("#statProducts"))$("#statProducts").textContent=products.length;
 if($("#statOrders"))$("#statOrders").textContent=orders.length;
 if($("#statPending"))$("#statPending").textContent=orders.filter(o=>["Pending","Confirmed","Preparing","Out for Delivery"].includes(o.status)).length;
 if($("#statSales"))$("#statSales").textContent=money(orders.filter(o=>o.status==="Delivered").reduce((a,o)=>a+Number(o.total||0),0));
 if($("#recentOrders"))$("#recentOrders").innerHTML=orderRows(orders.slice(0,8));
}

function orderRows(list){
 if(!list.length)return`<div class="empty">अभी कोई order नहीं है।</div>`;
 return`<table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>${list.map(o=>`<tr><td>#${esc(o.id.slice(0,8).toUpperCase())}</td><td>${esc(o.customer?.name)}<br>${esc(o.customer?.phone)}</td><td>${money(o.total)}</td><td><span class="status">${esc(o.status||"Pending")}</span></td><td><select class="statusSelect" data-id="${esc(o.id)}">${["Pending","Confirmed","Preparing","Out for Delivery","Delivered","Cancelled"].map(s=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>`;
}

function renderOrders(){$("#orderTable").innerHTML=orderRows(orders);bindOrderStatus()}
function bindOrderStatus(){
 document.querySelectorAll(".statusSelect").forEach(s=>s.onchange=async()=>{
  try{await updateDoc(doc(db,"orders",s.dataset.id),{status:s.value,updatedAt:serverTimestamp()});const o=orders.find(x=>x.id===s.dataset.id);if(o)o.status=s.value;renderDashboard();toast("Order status updated")}
  catch(e){showError(e)}
 });
}

function renderProducts(){
 const box=$("#productTable");
 if(!box)return;
 box.innerHTML=products.length?`<table class="table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Offer</th><th>Actions</th></tr></thead><tbody>${products.map(p=>`<tr><td>${p.imageUrl?`<img src="${esc(p.imageUrl)}" style="width:40px;height:40px;object-fit:cover;border-radius:8px">`:"🛍️"} ${esc(p.name)}</td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${Number(p.stock||0)}</td><td>${p.offer?"Yes":"—"}</td><td class="actions"><button class="tiny" data-edit="${esc(p.id)}">Edit</button><button class="tiny danger" data-del="${esc(p.id)}">Delete</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">अभी product नहीं है।</div>`;
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openProduct(b.dataset.edit));
 document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.del));
}

$("#addProductBtn").onclick=()=>openProduct();
$("#closeProduct").onclick=()=>$("#productModal").classList.add("hidden");

function openProduct(id=""){
 const p=products.find(x=>x.id===id);
 $("#productModalTitle").textContent=p?"Edit Product":"Add Product";
 $("#pId").value=p?.id||"";
 $("#pName").value=p?.name||"";
 $("#pCategory").value=p?.category||"";
 $("#pPrice").value=p?.price??"";
 $("#pMrp").value=p?.mrp??"";
 $("#pUnit").value=p?.unit||"";
 $("#pStock").value=p?.stock??0;
 $("#pEmoji").value=p?.emoji||"🛍️";
 $("#pOffer").checked=!!p?.offer;
 $("#pActive").checked=p?p.active!==false:true;
 $("#pImage").value="";
 $("#productModal").classList.remove("hidden");
}

async function deleteProduct(id){
 if(!confirm("Product delete करें?"))return;
 try{
  await deleteDoc(doc(db,"products",id));
  products=products.filter(p=>p.id!==id);
  renderProducts();renderDashboard();toast("Product deleted");
 }catch(e){showError(e)}
}

$("#productForm").onsubmit=async e=>{
 e.preventDefault();
 const btn=$("#saveProduct"),id=$("#pId").value.trim(),old=products.find(x=>x.id===id);
 const name=$("#pName").value.trim(),category=$("#pCategory").value.trim();
 const price=Number($("#pPrice").value),mrp=Number($("#pMrp").value||0),stock=Number($("#pStock").value);
 if(!name)return toast("Product name डालें");
 if(!category)return toast("Category डालें");
 if(!Number.isFinite(price)||price<0)return toast("Valid price डालें");
 if(!Number.isFinite(stock)||stock<0)return toast("Valid stock डालें");
 if(!Number.isFinite(mrp)||mrp<0)return toast("Valid MRP डालें");
 const file=$("#pImage").files?.[0];
 if(file&&!file.type.startsWith("image/"))return toast("सिर्फ image file upload करें");
 if(file&&file.size>5*1024*1024)return toast("Image 5 MB से छोटी होनी चाहिए");
 const oldText=btn.textContent;
 const wait=(p,ms=15000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error("Firebase response नहीं आया। Internet/Firebase Rules check करें।")),ms))]);
 btn.disabled=true;btn.textContent="Saving...";
 try{
  const data={name,category,price,mrp,unit:$("#pUnit").value.trim(),stock,emoji:$("#pEmoji").value.trim()||"🛍️",offer:$("#pOffer").checked,active:$("#pActive").checked,updatedAt:serverTimestamp()};
  let productRef;
  if(id){
   productRef=doc(db,"products",id);
   await wait(updateDoc(productRef,data));
  }else{
   productRef=doc(collection(db,"products"));
   await wait(setDoc(productRef,{...data,createdAt:serverTimestamp()}));
  }
  if(file){
   btn.textContent="Uploading image...";
   const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   const storageRef=ref(storage,`products/${Date.now()}-${safe}`);
   await wait(uploadBytes(storageRef,file,{contentType:file.type}));
   const imageUrl=await wait(getDownloadURL(storageRef));
   await wait(updateDoc(productRef,{imageUrl,updatedAt:serverTimestamp()}));
  }
  $("#productModal").classList.add("hidden");
  await loadProducts();
  renderProducts();
  renderDashboard();
  toast("✅ Product saved successfully");
 }catch(err){
  console.error("PRODUCT SAVE ERROR:",err);
  toast("❌ "+(err.message||"Product save failed"));
 }finally{
  btn.disabled=false;
  btn.textContent=oldText;
 }
};

function fillSettings(){
 $("#sName").value=settings.name||"";
 $("#sWhatsapp").value=settings.whatsapp||"";
 $("#sUpi").value=settings.upiId||"";
 $("#sMap").value=settings.mapUrl||"";
 $("#sAddress").value=settings.address||"";
 $("#sOpen").value=settings.openingTime||"";
 $("#sClose").value=settings.closingTime||"";
 $("#sDelivery").value=settings.deliveryFee??0;
 $("#sFree").value=settings.freeDeliveryAbove??500;
 $("#sMin").value=settings.minOrder??0;
}

$("#saveSettings").onclick=async()=>{
 try{
  settings={...settings,name:$("#sName").value.trim(),whatsapp:$("#sWhatsapp").value.trim(),upiId:$("#sUpi").value.trim(),mapUrl:$("#sMap").value.trim(),address:$("#sAddress").value.trim(),openingTime:$("#sOpen").value.trim(),closingTime:$("#sClose").value.trim(),deliveryFee:Number($("#sDelivery").value||0),freeDeliveryAbove:Number($("#sFree").value||0),minOrder:Number($("#sMin").value||0),updatedAt:serverTimestamp()};
  await setDoc(doc(db,"settings","shop"),settings,{merge:true});toast("Settings saved");
 }catch(e){showError(e)}
};

$("#refreshOrders").onclick=async()=>{
 try{await loadOrders();renderOrders();renderDashboard();toast("Orders refreshed")}catch(e){showError(e)}
};            
