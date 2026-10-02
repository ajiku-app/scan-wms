var PROD={};
var $=function(i){return document.getElementById(i)},STG="GR-STAGING",S;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var ymd=function(){return new Date(Date.now()+7*36e5).toISOString().slice(0,10)}; /* WIB, sama dengan wms_today() di server */
function blank(){return{stock:[],log:[],pic:"",ins:[],dos:[],n:{in:0,out:0},q:[]}}
try{S=JSON.parse(localStorage.getItem("mws3"))}catch(e){}if(!S||!S.stock)S=blank();
function save(){try{localStorage.setItem("mws3",JSON.stringify(S))}catch(e){}}
/* ===== API WMS ===== */
var CFG={base:((window.WMS_CONFIG||{}).SUPABASE_URL||"").replace(/\/+$/,"")};
function live(){return!!CFG.base}
function KEY(){return(window.WMS_CONFIG||{}).SUPABASE_ANON_KEY}
function H(){return{"Content-Type":"application/json",apikey:KEY(),Authorization:"Bearer "+(SES&&SES.token?SES.token:KEY())}}
function U(p){return CFG.base.replace(/\/+$/,"")+p}
function Q(m,p,b){if(!live())return;S.q=S.q||[];S.q.push({id:Date.now()+"-"+Math.random().toString(36).slice(2,8),m:m,p:p,b:b,u:SES&&SES.user?SES.user.id:null});save();flush()}
var busy=false;
var RT={ws:null,ok:false,ref:1,hb:null,tok:null,retry:0,rt:null,tm:null,pend:false,last:0,want:false};
function T(j){var m,b=j.b||{},k=j.id,d=function(x){return decodeURIComponent(x)};
if(m=/^\/inbound\/([^/]+)\/receive$/.exec(j.p))return["wms_inbound_receive_line",{p_doc:d(m[1]),p_sku:b.sku,p_batch:b.batch,p_qty:b.qty,p_rack:b.rack,p_scanned_at:b.scanned_at,p_key:k}];
if(m=/^\/inbound\/([^/]+)\/complete$/.exec(j.p))return["wms_inbound_complete",{p_doc:d(m[1])}];
if(m=/^\/outbound\/([^/]+)\/pick$/.exec(j.p))return["wms_pick",{p_doc:d(m[1]),p_sku:b.sku,p_batch:b.batch,p_rack:b.rack,p_qty:b.qty,p_scanned_at:b.scanned_at,p_key:k}];
if(m=/^\/outbound\/([^/]+)\/complete$/.exec(j.p))return["wms_outbound_complete",{p_doc:d(m[1])}];
if(j.p==="/stock/move")return["wms_move",{p_sku:b.sku,p_batch:b.batch,p_from:b.from_rack,p_to:b.to_rack,p_qty:b.qty,p_scanned_at:b.scanned_at,p_key:k}];
return null}
async function refresh(){if(!SES||!SES.refresh)return false;try{var r=await fetch(U("/auth/v1/token?grant_type=refresh_token"),{method:"POST",headers:{"Content-Type":"application/json",apikey:KEY()},body:JSON.stringify({refresh_token:SES.refresh})});if(!r.ok)return false;var j=await r.json();SES.token=j.access_token;SES.refresh=j.refresh_token;SES.exp=new Date(Date.now()+j.expires_in*1000).toISOString();saveSes();return true}catch(e){return false}}
async function ensure(){if(SES&&SES.exp&&Date.parse(SES.exp)-Date.now()<60000)await refresh()}
async function flush(){if(busy||!live())return;S.q=S.q||[];busy=true;var retried=false,rej=false;
try{while(S.q.length){var j=S.q[0],r;if(!authed()||(j.u&&SES.user&&j.u!==SES.user.id))break;
await ensure();var t=T(j);if(!t){S.q.shift();continue}
try{r=await fetch(U("/rest/v1/rpc/"+t[0]),{method:"POST",headers:H(),body:JSON.stringify(t[1])})}catch(e){break}
if(r.status===401){if(!retried&&await refresh()){retried=true;continue}expire();break}
retried=false;
if(r.ok||(r.status>=400&&r.status<500&&r.status!==408&&r.status!==429)){
if(!r.ok){var m="";try{m=(await r.json()).message||""}catch(e){}toast("WMS menolak: "+(m||r.status),1);rej=true}
S.q.shift();save()}else break}}finally{busy=false;qb();if(rej&&!S.q.length&&authed())sync2(true)}}
function EMPTY(){return'<div class="mu em">'+(live()?"Tidak ada dokumen yang terbuka. Tekan Sync sekarang di Beranda untuk memuat ulang.":"Belum login.")+"</div>"}
function qb(){var n=$("net");if(n)n.textContent=live()?(navigator.onLine?"Online":"Offline")+(RT.ok?" · live":"")+" · antrian "+(S.q||[]).length:"Belum terhubung";var dt=$("net-dot");if(dt)dt.className=live()&&navigator.onLine?"":"off";var s2=$("net-s");if(s2){s2.textContent=navigator.onLine?"Online":"Offline";$("net-d2").className="nd"+(navigator.onLine?"":" off")};var e=$("api-st");if(e)e.textContent=live()?"Database aktif · antrian kirim : "+(S.q||[]).length:"Belum terhubung ke WMS."}
async function G(p){await ensure();var r=await fetch(U(p),{headers:H()});if(r.status===401){if(await refresh())return G(p);expire();throw new Error("Sesi berakhir")}if(!r.ok){var m="";try{m=(await r.json()).message}catch(e){}throw new Error(m||"HTTP "+r.status)}return r.json()}
async function GA(p){var out=[],o=0;for(;;){var b=await G(p+"&limit=1000&offset="+o);if(!b.length)break;out=out.concat(b);o+=b.length;if(o>500000)break}return out}
async function sync(){if(!live()||!authed())return;var sb=$("api-sync");sb.textContent="Menyinkronkan…";try{await flush();return await sync2()}finally{sb.textContent="Sync sekarang"}}
async function sync2(q){if((S.q||[]).length)return toast(S.q.length+" transaksi belum terkirim",1);
try{var a=await Promise.all([can("in")?G("/rest/v1/inbound_docs?status=eq.open&order=doc_date,no&select=no,packing_list,supplier,date:doc_date,inbound_lines(sku,batch,expiry,qty_pl,qty_received,rack:rack_code,products(name),profiles(name))"):[],can("out")?G("/rest/v1/outbound_docs?status=eq.open&order=doc_date,no&select=no,date:doc_date,customer_name,customer_phone,customer_address,outbound_picks(seq,sku,batch,expiry,rack:rack_code,qty,picked)"):[],GA("/rest/v1/stock?qty=gt.0&order=sku,expiry,id&select=sku,batch,expiry,rack:rack_code,qty"),GA("/rest/v1/racks?active=eq.true&order=code&select=code"),G("/rest/v1/stock_holds?status=eq.active&select=sku,batch,rack_code,qty&limit=1000").catch(function(){return[]})]);
S.ins=a[0].map(function(d){return{no:d.no,pl:d.packing_list,sup:d.supplier,tgl:d.date,done:0,lines:(d.inbound_lines||[]).map(function(l){if(l.products&&l.products.name)PROD[l.sku]=l.products.name;return{sku:l.sku,batch:l.batch,ed:l.expiry,pl:l.qty_pl,rcv:l.qty_received||0,rak:l.rack||"",pic:l.profiles?l.profiles.name:""}})}});
S.dos=a[1].map(function(d){return{no:d.no,tgl:d.date,cust:d.customer_name,tel:d.customer_phone,addr:d.customer_address,done:0,picks:(d.outbound_picks||[]).sort(function(x,y){return x.seq-y.seq}).map(function(p){return{sku:p.sku,batch:p.batch,ed:p.expiry,loc:p.rack,qty:p.qty,got:p.picked||0}})}});
S.racks=a[3].map(function(x){return x.code});S.holds=(a[4]||[]).map(function(h){return{sku:h.sku,batch:h.batch,loc:h.rack_code,qty:h.qty}});S.stock=a[2].map(function(x){return{sku:x.sku,batch:x.batch,ed:x.expiry,loc:x.rack,qty:x.qty}});
save();render();if(!q)toast("Sinkron dengan WMS")}catch(e){toast("Gagal sinkron: "+e.message,1)}}
var AC;function beep(er){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=er?200:1100;o.connect(g);g.connect(AC.destination);g.gain.value=.15;o.start();o.stop(AC.currentTime+(er?.35:.12))}catch(x){}}
function toast(m,t){var e=$("toast");e.textContent=m;e.style.background=t?"#B42318":"#14532D";e.style.display="block";clearTimeout(toast.h);toast.h=setTimeout(function(){e.style.display="none"},t&&String(m).length>40?Math.min(14000,Math.max(7000,String(m).length*70)):2600);try{navigator.vibrate&&navigator.vibrate(t?[80,40,80]:40)}catch(x){}beep(t);}
function knownB(b){return S.stock.some(function(x){return x.batch===b})||S.ins.some(function(d){return d.lines.some(function(l){return l.batch===b})})||S.dos.some(function(d){return d.picks.some(function(p){return p.batch===b})})}
function parse(t){var a=t.trim().split("|");if(!(a.length>1&&a[0]&&a[1]))return null;var b=a[1].trim().toUpperCase();if(!knownB(b)){var m=/^.+\.(\d{8}\.\d{3})$/.exec(b);if(m)b=m[1]}return{sku:a[0].trim().toUpperCase(),batch:b}}
function isRack(t){t=t.trim().toUpperCase();return/^[A-Z]{1,3}-\d{1,3}-\d{1,3}$/.test(t)||t===STG||t==="NON-RACK"}
function held(s,b,l){return(S.holds||[]).filter(function(h){return h.sku===s&&h.batch===b&&h.loc===l}).reduce(function(a,h){return a+h.qty},0)}
function freeQ(s,b,l){var r=find(s,b,l);return r?Math.max(0,r.qty-held(s,b,l)):0}
function find(s,b,l){return S.stock.filter(function(x){return x.sku===s&&x.batch===b&&x.loc===l})[0]}
function add(s,b,ed,l,q){var r=find(s,b,l);if(r){r.qty+=q;if(ed)r.ed=ed}else S.stock.push({sku:s,batch:b,ed:ed,loc:l,qty:q})}
function sub(s,b,l,q){var r=find(s,b,l);r.qty-=q;S.stock=S.stock.filter(function(x){return x.qty>0})}
function lg(t,d,s,b,l,q){S.log.unshift({t:new Date().toLocaleString("id-ID"),type:t,doc:d,sku:s,batch:b,loc:l,qty:q,pic:S.pic});S.log=S.log.slice(0,200)}
function days(ed){return Math.round((new Date(ed)-new Date(ymd()))/864e5)}
function bind(id,fn){$(id).addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();var v=this.value;this.value="";if(!authed())return showLogin("Sesi berakhir. Silakan login kembali.");if(v.trim())fn(v.trim())}})}
function tbl(id,h,rows,cls){$(id).innerHTML="<tr>"+h.map(function(x){return"<th"+(x[1]?' class="n"':"")+">"+x[0]+"</th>"}).join("")+"</tr>"+rows.map(function(r,i){return"<tr"+(cls&&cls(i)?' class="'+cls(i)+'"':"")+">"+r.map(function(c,j){return"<td"+(h[j][1]?' class="n"':"")+">"+esc(c)+"</td>"}).join("")+"</tr>"}).join("")}
function kv(a){return'<div class="kv">'+a.map(function(x){return"<span>"+x[0]+"</span><b>"+esc(x[1])+"</b>"}).join("")+"</div>"}
function badge(d){return'<span class="bd'+(d?"":" p")+'" style="float:right">'+(d?"Selesai":"Proses")+"</span>"}

var SCR=["home","scan","st"],cur="home",stab="in",man=false,rs=false,camOn=false,rk={z:"",b:0,l:0},askFn=null,HINT={in:"Arahkan ke barcode label (SKU|Batch)",out:"Scan rak, lalu label (SKU|Batch)",mv:"Scan label pallet, lalu kode rak tujuan"};
function go(n,np){var tb=null;if(n==="in"||n==="out"||n==="mv"){tb=n;n="scan"}cur=n;document.body.dataset.scr=n;SCR.forEach(function(k){$("s-"+k).hidden=k!==n});$("nav").hidden=!(n==="home"||n==="st");[].forEach.call(document.querySelectorAll("#nav [data-go]"),function(b){b.classList.toggle("on",b.dataset.go===n)});$("menu").hidden=true;shut();window.scrollTo(0,0);rs=false;if(tb)setTab(tb);render();
if(!np&&n!=="home")try{history.pushState(n,"")}catch(e){}}
function setTab(t){stab=t;man=false;rs=false;[].forEach.call($("seg").children,function(b){b.classList.toggle("on",b.dataset.tab===t)});["in","out","mv"].forEach(function(k){$("p-"+k).hidden=k!==t;var d=$("d-"+k);if(d)d.hidden=k!==t});$("prog").hidden=t!=="mv";if(t==="mv"&&(S.racks||[]).length)setTimeout(rkOpen,0)}
function nav(n){if(n==="home"&&history.state)history.back();else go(n)}
window.addEventListener("popstate",function(){if(!$("sh").hidden){shut();try{history.pushState(cur,"")}catch(e){}}else go("home",1)});
var RL={inbound:"Operator Inbound",picker:"Operator Picker",admin:"Admin",supervisor:"Supervisor"};
function rHome(){var a=[];S.ins.forEach(function(d){if(!d.done)a.push(["in",d.no,"Inbound · Packing List"])});S.dos.forEach(function(d){if(!d.done)a.push(["out",d.no,"Outbound · Picking List"])});
$("h-docs").innerHTML=a.length?a.map(function(x){return'<button class="dc" data-doc="'+x[0]+"|"+esc(x[1])+'"><span><b>'+esc(x[1])+"</b><small>"+x[2]+'</small></span><span class="bd p">Proses</span></button>'}).join(""):'<div class="mu em">'+(live()?"Tidak ada dokumen yang terbuka.":"Belum login.")+"</div>"}
function pg(){var di=din(),dd=dout();$("in-pg").textContent=di?"Progres dokumen: "+di.lines.filter(function(l){return l.rcv>=l.pl}).length+" dari "+di.lines.length+" item diterima":"Daftar item";$("out-pg").textContent=dd?"Picking: "+dd.picks.filter(function(p){return p.got>=p.qty}).length+" dari "+dd.picks.length+" baris diambil":"Picking list"}
/* status panel kamera + form */
function cs(){var f=$(stab+"-f"),sc=!!f&&!f.hidden;["in","out","mv"].forEach(function(k){$(k+"-e").hidden=!$(k+"-f").hidden});
$("cam-man").hidden=!man;$("cam-live").hidden=man||(sc&&!rs);$("cam-ok").hidden=man||!sc||rs;$("cam-k").classList.toggle("on",man);
$("mv-dsp").textContent=$("mv-dst").value||"Pilih rak";
var want=cur==="scan"&&!man&&(!sc||rs);if(want&&(!camOn||camId!==stab+"-scan"))openCam(stab+"-scan");if(!want&&camOn)closeCam()}
function manGo(){var v=$("man").value.trim();if(!v)return;var i=$(stab+"-scan");i.value=v;i.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));$("man").value="";if(!$(stab+"-f").hidden)man=false;cs()}
$("man-go").onclick=manGo;$("man").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();manGo()}});
/* bottom sheet: konfirmasi + pemilih rak */
function sheet(h){$("sh-body").innerHTML=h;$("sh").hidden=false}
function shut(){$("sh").hidden=true}
function ask(t,rows,fn){askFn=fn;sheet('<div><div class="sh-t">'+t+'</div><div class="mu">Periksa kembali data berikut sebelum disimpan.</div></div><div>'+rows.map(function(r){return'<div class="rw"><span>'+r[0]+"</span><b>"+esc(r[1])+"</b></div>"}).join("")+'</div><div class="warn">Data dikirim ke WMS. Jika sedang offline, data tersimpan dan dikirim otomatis saat sinyal kembali.</div><button class="b" data-sub="1">Submit</button><button class="b g" data-x="1">Periksa lagi</button>')}
var ST3={full:["Penuh","#D62839","#fff","#D62839"],part:["Tersisa","#FBB92E","#14201A","#FBB92E"],empty:["Kosong","#E3E8E4","#14201A","#B7C6BC"]};
function occ(c){return S.stock.some(function(x){return x.loc===c})}
function sk(a){var o=a.map(occ);return o.every(Boolean)?"full":o.some(Boolean)?"part":"empty"}
function p2(n){return n<10?"0"+n:""+n}
function rkT(){var z={};(S.racks||[]).forEach(function(c){var m=/^([A-Z]{1,3})-(\d{1,3})-(\d{1,3})$/i.exec(c);if(!m)return;var a=m[1].toUpperCase(),b=+m[2];z[a]=z[a]||{};z[a][b]=z[a][b]||{};z[a][b][+m[3]]=c});return z}
function bl(Z,b){return Object.keys(Z[b]).map(function(l){return Z[b][l]})}
function zc(a){var Z=rkT()[a]||{},r=[];Object.keys(Z).forEach(function(b){r=r.concat(bl(Z,b))});return r}
function rkb(at,k,m,sub,sel){var q=ST3[k];return'<button class="rb'+(sel?" sel":"")+'" '+at+' style="background:'+q[1]+";color:"+q[2]+";border-color:"+q[3]+'"><b>'+m+"</b>"+(sub?"<small>"+q[0]+"</small>":"")+"</button>"}
function lgd(){return'<div class="lgd"><span><i style="background:#D62839"></i>Penuh</span><span><i style="background:#FBB92E"></i>Masih tersisa</span><span><i style="background:#E3E8E4;border:1px solid #B7C6BC"></i>Kosong</span></div>'}
function xb(){return'<button class="ib" data-x="1" aria-label="Tutup"><svg class="ic"><use href="#i-x"/></svg></button>'}
function rkOpen(){var m=/^([A-Z]{1,3})-(\d+)-(\d+)$/i.exec($("mv-dst").value),T=rkT();rk=m&&T[m[1].toUpperCase()]?{z:m[1].toUpperCase(),b:+m[2],l:+m[3]}:{z:"",b:0,l:0};if(rk.z&&!(T[rk.z][rk.b]&&T[rk.z][rk.b][rk.l]))rk={z:rk.z,b:0,l:0};rkDraw()}
function rkDraw(){var T=rkT(),zs=Object.keys(T).sort(),h;
if(!zs.length)return sheet('<div class="sh-t">Pilih rak tujuan</div><div class="mu">Daftar rak belum termuat. Tekan Sync sekarang di Beranda, atau scan kode rak tujuan.</div><button class="b g" data-x="1">Tutup</button>');
if(!rk.z){var n={full:0,part:0,empty:0};h=zs.map(function(a){var k=sk(zc(a));n[k]++;return rkb('data-z="'+a+'" aria-label="Rak '+a+", "+ST3[k][0]+'"',k,a,1)}).join("");
return sheet('<div class="sh-h"><div><div class="sh-t">Pilih rak tujuan</div><div class="mu">'+n.full+" penuh · "+n.part+" masih tersisa · "+n.empty+' kosong</div></div>'+xb()+'</div><div class="gr4">'+h+"</div>"+lgd()+'<div class="mu" style="text-align:center">Ketuk rak yang tersedia untuk memilih bin loc dan level.</div>')}
var Z=T[rk.z],bs=Object.keys(Z).map(Number).sort(function(a,b){return a-b}),lh;
var bh=bs.map(function(b){return rkb('data-b="'+b+'" aria-label="Bin loc '+p2(b)+'"',sk(bl(Z,b)),p2(b),0,rk.b===b)}).join("");
if(rk.b){var ls=Object.keys(Z[rk.b]).map(Number).sort(function(a,b){return a-b});lh='<div class="gr4" style="grid-template-columns:repeat('+Math.min(ls.length,6)+',minmax(0,1fr))">'+ls.map(function(l){return rkb('data-l="'+l+'"',occ(Z[rk.b][l])?"full":"empty",l,1,rk.l===l)}).join("")+"</div>"}else lh='<div class="empty" style="min-height:56px;flex:none;border-radius:14px;background:var(--bg)">Pilih bin loc dulu</div>';
var cd=rk.b&&rk.l?Z[rk.b][rk.l]:"";
sheet('<div class="sh-h"><button class="ib" data-bk="1" aria-label="Kembali"><svg class="ic"><use href="#i-back"/></svg></button><div style="flex:1;margin-left:6px"><div class="sh-t">Rak '+rk.z+'</div><div class="mu">'+bs.length+" bin loc</div></div>"+xb()+'</div><b>Bin loc</b><div class="gr6">'+bh+"</div><b>Level</b>"+lh+lgd()+'<button class="b'+(cd?"":" g")+'" data-use="1">'+(cd?"Pakai "+cd.toUpperCase():"Pilih bin loc dan level")+"</button>")}

/* INBOUND */
var cin=null;
function din(){return S.ins.filter(function(d){return d.no===$("in-sel").value})[0]}
function rIn(){var v=$("in-sel").value;$("in-sel").innerHTML=S.ins.map(function(d){return'<option>'+esc(d.no)+'</option>'}).join("");if(v)$("in-sel").value=v;var d=din();if(!d){$("in-h").innerHTML=EMPTY();$("in-t").innerHTML="";return}
$("in-h").innerHTML=badge(d.done)+kv([["Warehouse","Gudang FG"],["Packing List",d.pl],["Pemasok",d.sup],["Tanggal",d.tgl]]);
$("in-t").innerHTML=d.lines.length?d.lines.map(function(l){var c=cin&&cin.sku===l.sku&&cin.batch===l.batch?" cur":l.rcv>=l.pl?" dn":"";return'<div class="cd'+c+'"><div><b>'+esc(l.sku)+'</b> · '+esc(l.batch)+'<div class="mu">ED '+esc(l.ed)+' · Rak '+esc(l.rak||"—")+'</div></div><div class="qt">'+l.rcv+'<small>/'+l.pl+'</small></div></div>'}).join(""):'<div class="mu">Belum ada item. Scan label untuk menambah.</div>'}
$("in-sel").onchange=function(){cin=null;$("in-f").hidden=true;render()};
bind("in-scan",function(v){var d=din();if(!d||d.done)return toast("Pilih dokumen yang masih proses","e");
if(isRack(v)){$("in-rak").value=v.toUpperCase();return toast("Rak "+v.toUpperCase())}
var p=parse(v);if(!p)return toast("Format harus SKU|Batch","e");
var l=d.lines.filter(function(x){return x.sku===p.sku&&x.batch===p.batch})[0];
if(!l)return toast("SKU|Batch ini tidak ada di Packing List dokumen ini","e");
cin=p;$("in-f").hidden=false;$("in-i").textContent=p.sku+" · "+p.batch;
$("in-n").textContent=(PROD[p.sku]||l.sku)+" — ED "+l.ed+" · PL "+l.pl+" · sudah diterima "+l.rcv;
$("in-q").value=Math.max(1,l.pl-l.rcv);$("in-rak").value=l.rak||"";render();$("in-q").focus()});
function doIn(){var d=din(),q=+$("in-q").value,rk=$("in-rak").value.trim().toUpperCase();
if(!d||!cin)return;if(!(q>0))return toast("Isi jumlah","e");if(rk&&!isRack(rk))return toast("Kode rak tidak valid","e");
var l=d.lines.filter(function(x){return x.sku===cin.sku&&x.batch===cin.batch})[0];if(!l)return toast("Baris tidak ditemukan di Packing List","e");
if(l.rcv+q>l.pl)return toast("Melebihi Jumlah PL (sisa "+Math.max(0,l.pl-l.rcv)+" ctn)","e");
var loc=rk||l.rak||STG;l.rcv+=q;l.rak=loc;l.pic=S.pic;add(cin.sku,cin.batch,l.ed,loc,q);lg("GR",d.no,cin.sku,cin.batch,loc,q);
Q("POST","/inbound/"+encodeURIComponent(d.no)+"/receive",{sku:cin.sku,batch:cin.batch,qty:q,rack:rk||null,scanned_at:new Date().toISOString()});save();
toast("Diterima "+q+" ctn → "+loc);cin=null;$("in-f").hidden=true;render();$("in-scan").focus()};
$("in-done").onclick=function(){var d=din();if(!d)return;if(d.lines.some(function(l){return l.rcv<l.pl})&&!confirm("Ada item belum lengkap. Tetap selesaikan?"))return;d.done=1;Q("POST","/inbound/"+encodeURIComponent(d.no)+"/complete",{pic:S.pic});save();render()};

/* OUTBOUND */
var cr=null,pend=null;
function dout(){return S.dos.filter(function(d){return d.no===$("out-sel").value})[0]}
function rOut(){var v=$("out-sel").value;$("out-sel").innerHTML=S.dos.map(function(d){return"<option>"+esc(d.no)+"</option>"}).join("");if(v)$("out-sel").value=v;var d=dout();if(!d){$("out-h").innerHTML=EMPTY();$("out-t").innerHTML="";return}
$("out-h").innerHTML=badge(d.done)+kv([["Kode",d.no],["Tanggal",d.tgl],["Pelanggan",d.cust],["No. Telepon",d.tel],["Alamat",d.addr]]);
$("out-rk").textContent=cr?"Rak aktif: "+cr:"";
$("out-t").innerHTML=d.picks.map(function(p,i){var c=p.got>=p.qty?" dn":pend===p?" cur":"",sd=days(p.ed);return'<div class="cd'+c+'"><div><div class="rk">'+esc(p.loc)+'</div><b>'+esc(p.sku)+'</b> · '+esc(p.batch)+'<div class="mu">#'+(i+1)+' · ED '+esc(p.ed)+' · <span class="'+(sd<90?"w2":"")+'">'+sd+' hari</span></div></div><div class="qt">'+p.got+'<small>/'+p.qty+'</small></div></div>'}).join("")}
$("out-sel").onchange=function(){pend=null;cr=null;$("out-f").hidden=true;render()};
bind("out-scan",function(v){var d=dout();if(!d||d.done)return toast("Pilih DO yang masih proses","e");
if(isRack(v)){cr=v.toUpperCase();render();return toast("Rak "+cr+" — scan label")}
var p=parse(v);if(!p)return toast("Format harus SKU|Batch","e");
var open=d.picks.filter(function(x){return x.got<x.qty});var m=open.filter(function(x){return x.sku===p.sku&&x.batch===p.batch&&(!cr||x.loc===cr)})[0];
if(!m){var f=open.filter(function(x){return x.sku===p.sku})[0];
if(!f)return toast("SKU "+p.sku+" tidak ada di picking list","e");
var same=open.filter(function(x){return x.sku===p.sku&&x.batch===p.batch})[0];
return toast(same?"Salah rak. Ambil di "+same.loc:"FEFO: ambil batch "+f.batch+" di rak "+f.loc,"e")}
pend=m;$("out-f").hidden=false;$("out-i").textContent=m.sku+" · "+m.batch;$("out-n").textContent="FEFO · ED "+m.ed;$("out-rak").value=m.loc;$("out-q").value=m.qty-m.got;render();$("out-q").focus()});
function doOut(){var d=dout();if(!d||!pend)return;var q=+$("out-q").value;if(!(q>0)||q>pend.qty-pend.got)return toast("Jumlah maks "+(pend.qty-pend.got),"e");
var r=find(pend.sku,pend.batch,pend.loc);if(!r||r.qty<q)return toast("Stok rak tidak cukup","e");
sub(pend.sku,pend.batch,pend.loc,q);pend.got+=q;lg("GI",d.no,pend.sku,pend.batch,pend.loc,q);
Q("POST","/outbound/"+encodeURIComponent(d.no)+"/pick",{sku:pend.sku,batch:pend.batch,rack:pend.loc,qty:q,pic:S.pic,scanned_at:new Date().toISOString()});
if(d.picks.every(function(x){return x.got>=x.qty})){d.done=1;Q("POST","/outbound/"+encodeURIComponent(d.no)+"/complete",{pic:S.pic});toast("DO selesai ✔")}else toast("Diambil "+q+" ctn");
pend=null;$("out-f").hidden=true;save();render();$("out-scan").focus()};

/* PINDAH RAK */
var mc=null;
bind("mv-scan",function(v){if(isRack(v)){$("mv-dst").value=v.toUpperCase();return toast("Ke rak "+v.toUpperCase())}
var p=parse(v);if(!p)return toast("Format harus SKU|Batch","e");var rows=S.stock.filter(function(x){return x.sku===p.sku&&x.batch===p.batch});
if(!rows.length)return toast("Stok tidak ditemukan","e");rows=rows.filter(function(r){return freeQ(r.sku,r.batch,r.loc)>0});if(!rows.length)return toast("Seluruh stok item ini sedang di-hold","e");mc=p;$("mv-f").hidden=false;$("mv-i").textContent=p.sku+" · "+p.batch;
$("mv-src").innerHTML=rows.map(function(r){return'<option value="'+esc(r.loc)+'">'+esc(r.loc)+" — "+freeQ(r.sku,r.batch,r.loc)+" ctn"+(held(r.sku,r.batch,r.loc)?" (+"+held(r.sku,r.batch,r.loc)+" hold)":"")+"</option>"}).join("");$("mv-q").value=freeQ(rows[0].sku,rows[0].batch,rows[0].loc);$("mv-src").onchange=function(){$("mv-q").value=freeQ(mc.sku,mc.batch,this.value)}});
function doMv(){if(!mc)return;var s=$("mv-src").value,dst=$("mv-dst").value.trim().toUpperCase(),q=+$("mv-q").value,r=find(mc.sku,mc.batch,s);
if(!isRack(dst))return toast("Scan / isi rak tujuan","e");if(dst===s)return toast("Rak sama","e");if(dst===STG)return toast("Tujuan putaway tidak boleh GR-STAGING","e");var fq=freeQ(mc.sku,mc.batch,s);if(!(q>0)||q>fq)return toast("Jumlah maks "+fq+" ctn (stok yang di-hold tidak bisa dipindah)","e");
add(mc.sku,mc.batch,r.ed,dst,q);sub(mc.sku,mc.batch,s,q);lg("PINDAH","-",mc.sku,mc.batch,s+" → "+dst,q);
Q("POST","/stock/move",{sku:mc.sku,batch:mc.batch,from_rack:s,to_rack:dst,qty:q,pic:S.pic,scanned_at:new Date().toISOString()});save();toast(q+" ctn → "+dst);
mc=null;$("mv-f").hidden=true;$("mv-i").textContent="";$("mv-dst").value="";render();$("mv-scan").focus()};

$("in-ok").onclick=function(){var d=din(),q=+$("in-q").value;if(!d||!cin)return;if(!(q>0))return toast("Isi jumlah","e");var l0=d.lines.filter(function(x){return x.sku===cin.sku&&x.batch===cin.batch})[0];if(l0&&l0.rcv+q>l0.pl)return toast("Melebihi Jumlah PL (sisa "+Math.max(0,l0.pl-l0.rcv)+" ctn)","e");ask("Konfirmasi penerimaan barang",[["Dokumen",d.no],["Barang",cin.sku+" · "+cin.batch],["Jumlah",q+" ctn"],["Rak tujuan",$("in-rak").value.trim().toUpperCase()||"GR-STAGING (staging)"]],doIn)};
$("out-ok").onclick=function(){var d=dout();if(!d||!pend)return;ask("Konfirmasi pengambilan barang",[["Dokumen",d.no],["Barang",pend.sku+" · "+pend.batch],["Jumlah",$("out-q").value+" ctn"],["Diambil dari rak",pend.loc]],doOut)};
$("mv-ok").onclick=function(){if(!mc)return;var dst=$("mv-dst").value.trim().toUpperCase();if(!isRack(dst))return toast("Pilih atau scan rak tujuan","e");ask("Konfirmasi putaway",[["Barang",mc.sku+" · "+mc.batch],["Jumlah",$("mv-q").value+" ctn"],["Dari",$("mv-src").value],["Ke rak",dst]],doMv)};
/* STOK + render */
function render(){rIn();rOut();rHome();pg();var q=$("st-q").value.toLowerCase();
var all=S.stock.filter(function(x){return(x.sku+x.batch+x.loc).toLowerCase().indexOf(q)>-1}).sort(function(a,b){return a.sku+a.ed<b.sku+b.ed?-1:1}),st=all.slice(0,300);
$("st-t").innerHTML=st.length?st.map(function(x){var d=days(x.ed);return'<div class="cd"><div><div class="rk">'+esc(x.loc)+"</div><b>"+esc(x.sku)+"</b> · "+esc(x.batch)+'<div class="mu">ED '+esc(x.ed)+' · <span class="'+(d<90?"w2":"")+'">'+d+' hari</span></div></div><div class="qt">'+x.qty+"<small> ctn"+(held(x.sku,x.batch,x.loc)?" · hold "+held(x.sku,x.batch,x.loc):"")+"</small></div></div>"}).join("")+(all.length>300?'<div class="mu em">Menampilkan 300 dari '+all.length+" — persempit pencarian.</div>":""):'<div class="mu em">Stok tidak ditemukan.</div>';
$("lg-t").innerHTML=S.log.length?S.log.slice(0,50).map(function(x){return'<div class="cd"><div><span class="bd'+(x.type==="GI"?" p":"")+'">'+esc(x.type)+"</span> <b>"+esc(x.sku)+"</b> · "+esc(x.batch)+'<div class="mu">'+esc(x.doc)+" · "+esc(x.loc)+" · "+esc(x.t)+'</div></div><div class="qt">'+x.qty+"</div></div>"}).join(""):'<div class="mu em">Belum ada riwayat.</div>';cs()}
$("st-q").oninput=render;

/* KAMERA — jalur native (Chrome/Android via BarcodeDetector) + jalur cadangan (Safari/iOS via ZXing) */
var stream,camT,camId,last="",lastT=0,tor=false,face="environment",det,zreader;
try{face=localStorage.getItem("camface")||"environment"}catch(e){}
var IOSSA=(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1))&&navigator.standalone===true,gestureOK=false,pendingCam=false;
function hasNative(){return "BarcodeDetector" in window}
function hasZXing(){return !!window.ZXing}
document.addEventListener("click",function(e){var el=e.target.closest?e.target.closest("[data-go],[data-doc],[data-scan],[data-tab],[data-man],[data-re],[data-rk],[data-z],[data-b],[data-l],[data-use],[data-bk],[data-x],[data-sub],[data-pw],#acct"):null,m=$("menu");
if(!el){if(!m.hidden&&!e.target.closest("#menu"))m.hidden=true;return}
var t=el.dataset,h=function(k){return el.hasAttribute("data-"+k)};
if(el.id==="acct"){m.hidden=!m.hidden;return}
if(t.go)nav(t.go);
if(t.scan){var f=["in","out","mv"].filter(function(k){return can(k)})[0];if(f)go(f)}
if(t.doc){var a=t.doc.split("|"),sl=$(a[0]+"-sel");sl.value=a.slice(1).join("|");sl.onchange();go(a[0])}
if(t.tab){setTab(t.tab);render()}
if(h("man")){man=!man;cs();if(man)$("man").focus()}
if(h("re")){rs=true;cs()}
if(h("rk"))rkOpen();
if(t.z){if(sk(zc(t.z))==="full")return toast("Rak "+t.z+" penuh, pilih rak lain",1);rk={z:t.z,b:0,l:0};rkDraw()}
if(t.b){var Z=rkT()[rk.z],b=+t.b;if(sk(bl(Z,b))==="full")return toast("Bin loc "+p2(b)+" penuh di semua level",1);rk.b=b;rk.l=0;rkDraw()}
if(t.l){var cc=rkT()[rk.z][rk.b][+t.l];if(occ(cc))return toast(cc+" penuh, pilih level lain",1);rk.l=+t.l;rkDraw()}
if(h("use")){var c2=rk.b&&rk.l?rkT()[rk.z][rk.b][rk.l]:"";if(!c2)return toast("Pilih bin loc dan level dulu",1);$("mv-dst").value=c2.toUpperCase();shut();cs()}
if(h("bk")){rk={z:"",b:0,l:0};rkDraw()}
if(h("x"))shut();
if(h("sub")){shut();var fn=askFn;askFn=null;if(fn)fn()}
if(h("pw")){var p=$("lg-p");p.type=p.type==="password"?"text":"password";el.textContent=p.type==="password"?"Lihat":"Sembunyi"}});
function stopStream(){stream&&stream.getTracks().forEach(function(t){t.stop()});stream=null;tor=false}
async function startCam(){stopStream();var v=$("vid"),g=function(f){return navigator.mediaDevices.getUserMedia({video:f})},sz={width:{ideal:1280},height:{ideal:720}};
try{stream=await g({facingMode:{ideal:face},width:sz.width,height:sz.height})}
catch(e){if(e&&(e.name==="NotAllowedError"||e.name==="SecurityError"))throw e;stream=await g(true)}
v.setAttribute("playsinline","");v.setAttribute("webkit-playsinline","");v.muted=true;v.srcObject=stream;await v.play();var tr=stream.getVideoTracks()[0],st=tr.getSettings?tr.getSettings():{};
if(st.facingMode)face=st.facingMode==="user"?"user":"environment";
v.style.transform=face==="user"?"scaleX(-1)":"none";$("cam-sl").textContent=face==="user"?"Depan":"Belakang";
var cp=tr.getCapabilities?tr.getCapabilities():{};$("cam-t").hidden=face==="user"||(cp&&"torch" in cp?!cp.torch:false)}
function onDetected(val){var n=Date.now();if(val===last&&n-lastT<2000){lastT=n;return}last=val;lastT=n;$("cam-m").textContent="✔ "+val;
var i=$(camId);i.value=val;i.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
rs=false;cs()}
async function openCam(id){camId=id;camOn=true;
if(!hasNative()&&!hasZXing()){camOn=false;man=true;cs();return toast("Kamera scan tidak didukung browser ini. Pakai Ketik untuk input manual.",1)};
if(IOSSA&&!gestureOK){pendingCam=true;$("cam-m").textContent="Ketuk area kamera untuk mengaktifkan";return}
try{await startCam();var v=$("vid");$("cam-m").textContent=HINT[camId.slice(0,-5)];
clearInterval(camT);camT=null;if(zreader){try{zreader.reset()}catch(e){}zreader=null}
if(hasNative()){
det=new BarcodeDetector({formats:["code_128","qr_code","code_39"]});
camT=setInterval(async function(){try{var r=await det.detect(v);if(r.length)onDetected(r[0].rawValue)}catch(e){}},250);
}else{
zreader=new ZXing.BrowserMultiFormatReader();
zreader.decodeFromVideoElement(v,function(result){if(result)onDetected(result.getText())});
}}catch(e){camOn=false;man=true;gestureOK=false;cs();toast(camErr(e),1)}}
function closeCam(){pendingCam=false;clearInterval(camT);camT=null;if(zreader){try{zreader.reset()}catch(e){}zreader=null}stopStream();camOn=false}
$("cam-s").onclick=async function(){face=face==="user"?"environment":"user";try{localStorage.setItem("camface",face)}catch(e){}try{await startCam();if(zreader){zreader.reset();zreader=new ZXing.BrowserMultiFormatReader();zreader.decodeFromVideoElement($("vid"),function(result){if(result)onDetected(result.getText())})}}catch(e){toast("Kamera tidak tersedia",1)}};
$("cam-t").onclick=function(){try{tor=!tor;stream.getVideoTracks()[0].applyConstraints({advanced:[{torch:tor}]});$("cam-t").classList.toggle("on",tor)}catch(e){toast("Senter tidak didukung di perangkat/browser ini",1)}};
function camErr(e){var n=e&&e.name||"";
if(n==="NotAllowedError"||n==="SecurityError")return IOSSA?"Kamera diblokir. iPhone: Pengaturan > Apps > Safari > Kamera > pilih Tanya/Izinkan. Lalu hapus app dari Layar Utama, tambahkan lagi, dan pilih Izinkan. Sementara itu pakai tombol Foto atau Ketik.":"Akses kamera ditolak. Izinkan kamera di pengaturan browser/app, atau pakai Foto/Ketik.";
if(n==="NotFoundError"||n==="OverconstrainedError")return"Kamera tidak ditemukan di perangkat ini.";
if(n==="NotReadableError")return"Kamera sedang dipakai app lain. Tutup app lain lalu coba lagi.";
return"Kamera tidak bisa diakses ("+(n||"error")+"). Pakai Foto atau Ketik."}
$("cam").addEventListener("click",function(e){if(pendingCam&&!(e.target.closest&&e.target.closest("button,input,label"))){pendingCam=false;gestureOK=true;openCam(camId||stab+"-scan")}});
$("cam-p").onclick=function(){$("cam-f").click()};
$("cam-f").onchange=async function(){var f=this.files&&this.files[0];this.value="";if(!f)return;
if(!hasZXing())return toast("Pembaca barcode belum siap, coba lagi sebentar",1);
if(!camId)camId=stab+"-scan";var u=URL.createObjectURL(f);
try{var r=await new ZXing.BrowserMultiFormatReader().decodeFromImageUrl(u);onDetected(r.getText())}
catch(e){toast("Barcode tidak terbaca di foto. Dekatkan, pastikan fokus, lalu ulangi.",1)}
finally{URL.revokeObjectURL(u)}};
/* ===== LOGIN & OTORISASI (Supabase Auth) ===== */
var PERM={inbound:["in","mv"],picker:["out"],admin:["in","out","mv"],supervisor:["in","out","mv"]};
var SES=null,IDLE=30*60*1000,lt=0;S.q=S.q||[];
try{SES=JSON.parse(localStorage.getItem("mwsses"))}catch(e){}
function authed(){return!!(SES&&SES.token&&Date.now()-(SES.last||0)<IDLE)}
function can(f){var r=SES&&SES.user&&String(SES.user.role||"").toLowerCase();return(PERM[r]||[]).indexOf(f)>-1}
function saveSes(){try{localStorage.setItem("mwsses",JSON.stringify(SES))}catch(e){}}
function touch(){var n=Date.now();if(SES&&n-lt>15000){lt=n;SES.last=n;saveSes()}}
function expire(){rtStop();SES=null;try{localStorage.removeItem("mwsses")}catch(e){}showLogin("Sesi berakhir. Silakan login kembali.")}
function showLogin(m){closeCam();$("login").style.display="flex";$("lg-e").textContent=m||"";$("menu").hidden=true;$("lg-u").focus()}
function applyRole(){$("login").style.display="none";$("un").textContent=SES.user.name;$("rl").textContent=RL[SES.user.role]||SES.user.role;$("em").textContent=SES.user.email||SES.user.name;S.pic=SES.user.name;save();
var fl=["in","out","mv"],f=fl.filter(function(k){return can(k)})[0];fl.forEach(function(k){$("h-"+k).hidden=!can(k);$("h-"+k).classList.toggle("pri",k===f)});$("fab").hidden=!f;fl.forEach(function(k){$("seg").querySelector('[data-tab="'+k+'"]').hidden=!can(k)});go("home",1);qb();sync();rtStart()}
$("lg-p").addEventListener("keydown",function(e){if(e.key==="Enter")$("lg-go").click()});
$("lg-go").onclick=async function(){var u=$("lg-u").value.trim().toLowerCase(),p=$("lg-p").value;
var em=!u?"Email wajib diisi":"",pm=!p?"Kata sandi wajib diisi":p.length<6?"Minimal 6 karakter":"";$("lg-um").textContent=em;$("lg-pm").textContent=pm;$("lg-u").classList.toggle("er",!!em);$("lg-pw").classList.toggle("er",!!pm);if(em||pm)return;
var email=u.indexOf("@")>-1?u:u+"@"+((window.WMS_CONFIG||{}).EMAIL_DOMAIN||"wms.example.com");
$("lg-go").disabled=true;$("lg-e").textContent="";
try{var r=await fetch(U("/auth/v1/token?grant_type=password"),{method:"POST",headers:{"Content-Type":"application/json",apikey:KEY()},body:JSON.stringify({email:email,password:p})});
var j={};try{j=await r.json()}catch(e){}
if(!r.ok)throw new Error(r.status===400||r.status===401?"Email atau kata sandi salah.":(j.msg||j.message||"Login gagal ("+r.status+")"));
var uid=j.user.id,pr=await fetch(U("/rest/v1/profiles?id=eq."+uid+"&active=eq.true&select=id,name,role"),{headers:{apikey:KEY(),Authorization:"Bearer "+j.access_token}});
var pf=pr.ok?(await pr.json())[0]:null;if(!pf||!pf.role)throw new Error("Akun belum diberi role. Hubungi admin.");
var role=String(pf.role).toLowerCase();if(!PERM[role])throw new Error("Role '"+pf.role+"' tidak diizinkan memakai aplikasi ini.");
if(S.q.some(function(x){return x.u&&x.u!==uid}))throw new Error(S.q.length+" transaksi belum terkirim milik operator lain. Minta operator tersebut login dulu agar terkirim.");
SES={token:j.access_token,refresh:j.refresh_token,exp:new Date(Date.now()+j.expires_in*1000).toISOString(),user:{id:uid,name:pf.name||u,role:role,email:email},last:Date.now()};saveSes();$("lg-p").value="";applyRole()}
catch(e){$("lg-e").textContent=e.message==="Failed to fetch"?"Tidak bisa menghubungi server.":e.message}
$("lg-go").disabled=false};
$("lo").onclick=function(){var n=S.q.length;if(n&&!confirm(n+" transaksi belum terkirim akan tersimpan dan dikirim saat Anda login lagi. Keluar?"))return;
if(SES&&live()){try{fetch(U("/auth/v1/logout"),{method:"POST",headers:H()}).catch(function(){})}catch(e){}}
SES=null;S.pic="";save();try{localStorage.removeItem("mwsses")}catch(e){}location.reload()};
["click","keydown","touchstart"].forEach(function(ev){document.addEventListener(ev,touch,{passive:true})});
setInterval(function(){if(SES&&!authed())expire()},30000);
setInterval(function(){if(authed()&&navigator.onLine&&!document.hidden&&cur==="home"&&!busy&&!(S.q||[]).length&&$("sh").hidden)sync2(true)},90000);
/* ===== Realtime: perubahan di WMS langsung masuk (Supabase Realtime via WebSocket, tanpa library) =====
   Hak baca mengikuti RLS login. Polling 90 dtk tetap jadi cadangan bila koneksi live putus. */
var RTT=["inbound_docs","inbound_lines","outbound_docs","outbound_picks","stock","stock_holds","racks"],RTP="realtime:wms-scan";
function rtBeat(){var w=RT.ws;if(!w||w.readyState!==1)return;
ensure().then(function(){if(RT.ws!==w||w.readyState!==1)return;
if(SES&&SES.token&&SES.token!==RT.tok){RT.tok=SES.token;w.send(JSON.stringify({topic:RTP,event:"access_token",payload:{access_token:RT.tok},ref:String(++RT.ref),join_ref:"1"}))}
w.send(JSON.stringify({topic:"phoenix",event:"heartbeat",payload:{},ref:String(++RT.ref)}))}).catch(function(){})}
function rtLater(){clearTimeout(RT.rt);RT.retry=Math.min(RT.retry+1,6);RT.rt=setTimeout(rtStart,Math.min(60000,2000*Math.pow(2,RT.retry-1)))}
function rtPend(){RT.pend=true;clearTimeout(RT.tm);RT.tm=setTimeout(rtApply,1500)}
/* Terapkan perubahan bila aman: tidak ada antrian kirim, tidak sedang mengetik/membuka lembar, minimal 8 dtk antar-sync. */
function rtApply(){if(!RT.pend)return;if(document.hidden)return;
if(!authed()||!navigator.onLine||busy||(S.q||[]).length||!$("sh").hidden||(cur==="scan"&&document.activeElement&&/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))){clearTimeout(RT.tm);RT.tm=setTimeout(rtApply,4000);return}
var w=RT.last+8000-Date.now();if(w>0){clearTimeout(RT.tm);RT.tm=setTimeout(rtApply,w);return}
RT.pend=false;RT.last=Date.now();sync2(true)}
async function rtStart(){RT.want=true;if(!live()||!authed()||!navigator.onLine||typeof WebSocket==="undefined")return;
if(RT.ws&&RT.ws.readyState<2)return;clearTimeout(RT.rt);
try{await ensure()}catch(e){}if(!authed()||(RT.ws&&RT.ws.readyState<2))return;
var ws;try{ws=new WebSocket(CFG.base.replace(/^http/,"ws")+"/realtime/v1/websocket?apikey="+encodeURIComponent(KEY())+"&vsn=1.0.0")}catch(e){return rtLater()}
RT.ws=ws;RT.ok=false;
ws.onopen=function(){RT.tok=SES.token;RT.ref=1;
ws.send(JSON.stringify({topic:RTP,event:"phx_join",payload:{config:{broadcast:{ack:false,self:false},presence:{key:""},postgres_changes:RTT.map(function(t){return{event:"*",schema:"public",table:t}}),private:false},access_token:RT.tok},ref:"1",join_ref:"1"}));
clearInterval(RT.hb);RT.hb=setInterval(rtBeat,25000)};
ws.onmessage=function(e){var m;try{m=JSON.parse(e.data)}catch(x){return}
if(m.event==="phx_reply"&&m.topic===RTP&&m.ref==="1"){RT.ok=!!(m.payload&&m.payload.status==="ok");qb();
if(RT.ok){RT.retry=0;rtPend()}else try{ws.close()}catch(x){}}
else if(m.event==="postgres_changes")rtPend();
else if(m.topic===RTP&&(m.event==="phx_close"||m.event==="phx_error"))try{ws.close()}catch(x){}};
ws.onclose=function(){if(RT.ws!==ws)return;RT.ws=null;RT.ok=false;clearInterval(RT.hb);qb();if(RT.want&&authed())rtLater()};
ws.onerror=function(){try{ws.close()}catch(x){}}}
function rtStop(){RT.want=false;RT.pend=false;clearTimeout(RT.rt);clearTimeout(RT.tm);clearInterval(RT.hb);var w=RT.ws;RT.ws=null;RT.ok=false;if(w)try{w.close()}catch(e){}try{qb()}catch(e){}}
$("api-sync").onclick=sync;window.addEventListener("online",function(){flush();qb()});window.addEventListener("offline",qb);
render();qb();
if(authed())applyRole();else if(SES)showLogin("Sesi berakhir. Silakan login kembali.");else $("welcome").style.display="flex";
$("wl-go").onclick=function(){$("welcome").style.display="none";showLogin("")};
$("lg-bk").onclick=function(){$("login").style.display="none";$("welcome").style.display="flex"};
function wl(){try{navigator.wakeLock&&navigator.wakeLock.request("screen")}catch(e){}}wl();
function onResume(){wl();if(camOn){camOn=false;cs()}if(authed()){flush();sync();rtStart()}}
document.addEventListener("visibilitychange",function(){if(!document.hidden)onResume()});
window.addEventListener("focus",onResume);
window.addEventListener("pageshow",function(e){if(e.persisted)onResume()});
var NATIVE=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
if(!NATIVE&&"serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){});

/* ===== Pasang ke layar utama: Android (prompt otomatis) & iOS (panduan manual) ===== */
var deferredInstall=null;
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredInstall=e;showInstallBanner("android")});
window.addEventListener("appinstalled",function(){hideInstallBanner();deferredInstall=null});
function isStandalone(){return NATIVE||window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)}
function showInstallBanner(kind){if(isStandalone())return;try{if(localStorage.getItem("installDismissed")==="1")return}catch(e){}
var b=$("install-banner");if(!b)return;b.hidden=false;
$("install-text").textContent=kind==="ios"?"Pasang aplikasi ini: ketuk tombol Bagikan lalu \"Tambah ke Layar Utama\".":"Pasang aplikasi ini ke layar utama untuk akses lebih cepat.";
$("install-go").hidden=kind!=="android"}
function hideInstallBanner(){var b=$("install-banner");if(b)b.hidden=true}
$("install-go")&&($("install-go").onclick=async function(){if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;hideInstallBanner()});
$("install-x")&&($("install-x").onclick=function(){try{localStorage.setItem("installDismissed","1")}catch(e){}hideInstallBanner()});
if(isIOS()&&!isStandalone())setTimeout(function(){showInstallBanner("ios")},1500);

/* ===== Capacitor (Android/iOS native): tombol Back Android, status bar ===== */
(function(){
if(!NATIVE)return;
var P=window.Capacitor.Plugins||{};
try{document.body.classList.add("native")}catch(e){}
try{if(P.SystemBars&&P.SystemBars.setStyle)P.SystemBars.setStyle({style:"LIGHT"})}catch(e){}
if(P.App&&P.App.addListener){
P.App.addListener("backButton",function(){
  if(!$("sh").hidden||cur!=="home"){try{history.back()}catch(e){go("home",1)}}
  else{try{P.App.exitApp()}catch(e){}}
});
P.App.addListener("appStateChange",function(st){if(st&&st.isActive)onResume()});
}
})();

/* ===== Kunci gestur: tanpa pinch-zoom, double-tap zoom, atau geser halaman ===== */
(function(){
["gesturestart","gesturechange","gestureend"].forEach(function(t){document.addEventListener(t,function(e){e.preventDefault()},{passive:false})});
document.addEventListener("touchmove",function(e){
  if(e.touches&&e.touches.length>1){e.preventDefault();return}
  // izinkan hanya jika sentuhan berada di dalam elemen yang memang bisa scroll vertikal
  var el=e.target;
  while(el&&el!==document.body&&el!==document.documentElement){
    if(el.scrollHeight>el.clientHeight+1){var oy=getComputedStyle(el).overflowY;if(oy==="auto"||oy==="scroll")return}
    el=el.parentElement;
  }
  e.preventDefault();
},{passive:false});
document.addEventListener("wheel",function(e){if(e.ctrlKey)e.preventDefault()},{passive:false});
})();

/* ===== Pastikan layar terkunci tidak pernah bergeser (mis. akibat fokus input / keyboard) ===== */
(function(){
function reset(){
  try{window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0}catch(e){}
  [].forEach.call(document.querySelectorAll(".scr"),function(el){if(el.scrollTop||el.scrollLeft){el.scrollTop=0;el.scrollLeft=0}});
}
document.addEventListener("scroll",function(e){var t=e.target;if(t===document||t===document.body||t===document.documentElement||(t.classList&&t.classList.contains("scr")))reset()},true);
window.addEventListener("resize",reset);
document.addEventListener("focusout",function(){setTimeout(reset,60)});
if(window.visualViewport)window.visualViewport.addEventListener("scroll",reset);
})();

