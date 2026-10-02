const C="fgscan-v18",A=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./icon-180.png","./style.css","./app.js","./config.js","./login-bg.jpg","./plus-jakarta-latin.woff2"];
const CDN="https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js";
self.addEventListener("install",e=>{e.waitUntil(
  caches.open(C).then(c=>c.addAll(A)).then(()=>caches.open(C)).then(c=>fetch(CDN,{mode:"cors"}).then(r=>r.ok&&c.put(CDN,r)).catch(()=>{})).then(()=>caches.open(C)).then(c=>fetch("./vendor/zxing.min.js").then(r=>r.ok&&c.put("./vendor/zxing.min.js",r)).catch(()=>{})).then(()=>self.skipWaiting())
)});
self.addEventListener("activate",e=>e.waitUntil(clients.claim()));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
if(e.request.method!=="GET"||u.pathname.includes("/api/"))return;
if(u.href===CDN){e.respondWith(caches.match(CDN).then(r=>r||fetch(e.request)));return}
if(u.origin!==location.origin)return;
e.respondWith(fetch(e.request).then(r=>{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html"))))});
