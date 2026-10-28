/* motor dels manuals: fulls A4 apaïsats a 2 columnes, índex, cercador i paraules clau */
(()=>{
/* paraules clau: nom a l'índex alfabètic → element destí */
const CFGM=JSON.parse(document.getElementById("mcfg").textContent);const KW=CFGM.kw;
const EXTRA=CFGM.extra;
const $=s=>document.querySelector(s);const src=$("#src"),book=$("#book"),meas=$("#measure");
const TITLE=CFGM.title;
/* enllaços de paraules clau */
src.querySelectorAll("a.kw[data-k]").forEach(a=>{const k=KW[a.dataset.k];if(k)a.href="#"+k[1];});
/* sumari */
const secs=[...src.querySelectorAll("section[data-t]")];
$("#tocl").innerHTML=secs.map(s=>{const subs=[...s.querySelectorAll("h3[id]")];return `<li><a href="#${s.id}">${s.dataset.t}</a><span class="dots"></span><span class="pg" data-pg="${s.id}"></span></li>`+subs.map(h=>`<li class="l3"><a href="#${h.id}">${h.textContent}</a><span class="dots"></span><span class="pg" data-pg="${h.id}"></span></li>`).join("");}).join("");
const IDX=[...Object.values(KW),...EXTRA].sort((a,b)=>a[0].localeCompare(b[0],"ca"));
$("#idxl").innerHTML=IDX.map(([n,id])=>`<li><a href="#${id}">${n}</a><span class="pgs"><a href="#${id}" data-pg="${id}"></a></span></li>`).join("");
/* paginació en fulls A4 apaïsats, a 2 columnes */
function newPage(cls){const p=document.createElement("div");p.className="page"+(cls?" "+cls:"");p.innerHTML=`<div class="phead"><span>${TITLE}</span><span class="psec"></span></div><div class="pcols"><div class="pbody"></div><div class="pbody"></div></div><div class="pfoot"><span>${CFGM.foot}</span><b class="pno"></b></div>`;return p;}
function paginate(){book.innerHTML="";meas.innerHTML="";const pages=[];
 const mp=newPage();meas.appendChild(mp);const mb=mp.querySelector(".pbody");const H=()=>mb.clientHeight;
 let cur=null,curSec="",col=0;
 const open=(cls,sec)=>{cur=newPage(cls);cur.querySelector(".psec").textContent=sec||"";pages.push(cur);col=0;mb.innerHTML="";};
 const colEl=()=>cur.querySelectorAll(".pbody")[col];
 const secTag=sec=>{if(!sec||sec==="Índex")return;const ps=cur.querySelector(".psec");const L=ps.textContent?ps.textContent.split(" · "):[];if(!L.includes(sec)){L.push(sec);ps.textContent=L.join(" · ");}};
 const next=sec=>{if(col===0&&!cur.classList.contains("cover")){col=1;mb.innerHTML="";secTag(sec);}else open("",sec);};
 const fits=el=>{mb.appendChild(el);const mt=parseFloat(getComputedStyle(el).marginBottom)||0;const ok=mb.scrollHeight<=H()+1&&(el.getBoundingClientRect().bottom+mt-mb.getBoundingClientRect().top)<=H()-3;mb.removeChild(el);return ok;};
 const put=el=>{mb.appendChild(el.cloneNode(true));colEl().appendChild(el);};
 for(const s of src.children){
  if(s.hasAttribute("data-cover")){open("cover");[...s.children].forEach(c=>cur.querySelector(".pbody").appendChild(c.cloneNode(true)));continue;}
  curSec=s.dataset.t||"";if(!cur||cur.classList.contains("cover"))open("",curSec==="Índex"?"":curSec);else if(mb.children.length)next(curSec);else secTag(curSec);
  const blocks=[...s.children].map(c=>c.cloneNode(true));if(s.id&&blocks[0]&&!blocks[0].id)blocks[0].id=s.id;
  for(let i=0;i<blocks.length;i++){let b=blocks[i];
   const keepNext=/^H[23]$/.test(b.tagName)&&blocks[i+1];
   if(keepNext){const w=document.createElement("div");w.appendChild(b.cloneNode(true));const nx=blocks[i+1].cloneNode(true);
    if(nx.tagName==="UL"||nx.tagName==="OL"||nx.tagName==="TABLE"){const f=nx.tagName==="TABLE"?nx.querySelector("tr"):nx.firstElementChild;const t=nx.cloneNode(false);if(f)t.appendChild(f.cloneNode(true));w.appendChild(t);}else w.appendChild(nx);
    if(!fits(w)&&mb.children.length)next(curSec);}
   if(fits(b)){put(b);continue;}
   /* llistes i taules: es parteixen per elements */
   if((b.tagName==="UL"||b.tagName==="OL"||b.tagName==="TABLE")&&b.children.length){
    const isT=b.tagName==="TABLE";const rows=[...(isT?b.querySelectorAll("tr"):b.children)];const head=isT&&rows[0].querySelector("th")?rows.shift():null;
    let part=b.cloneNode(false);if(head)part.appendChild(head.cloneNode(true));let start=b.tagName==="OL"?1:0;
    for(const r of rows){part.appendChild(r.cloneNode(true));if(!fits(part)){part.removeChild(part.lastChild);if(part.children.length>(head?1:0)){put(part);}next(curSec);part=b.cloneNode(false);if(head)part.appendChild(head.cloneNode(true));part.appendChild(r.cloneNode(true));if(b.classList.contains("steps")){part.style.counterReset="s "+start;}}
     else{}start++;}
    if(part.children.length)put(part);continue;}
   if(mb.children.length){next(curSec);}put(b);}
 }
 pages.forEach((p,i)=>{p.querySelector(".pno").textContent=i?String(i+1):"";book.appendChild(p);});meas.innerHTML="";
 /* números de pàgina a l'índex i als enllaços */
 const pgOf=id=>{const el=book.querySelector("#"+CSS.escape(id));const p=el&&el.closest(".page");return p?[...book.children].indexOf(p)+1:"";};
 book.querySelectorAll("[data-pg]").forEach(x=>x.textContent=pgOf(x.dataset.pg));
 book.querySelectorAll("a.kw[data-k]").forEach(a=>{const k=KW[a.dataset.k];if(!k)return;const p=pgOf(k[1]);const own=[...book.children].indexOf(a.closest(".page"))+1;if(p&&p!==own)a.dataset.p=p;else delete a.dataset.p;});
 fitZoom();}
function fitZoom(){const w=Math.min(window.innerWidth,document.documentElement.clientWidth)-16;const px=297*96/25.4;document.documentElement.style.setProperty("--z",Math.min(1,w/px).toFixed(4));
 document.documentElement.style.setProperty("--barh",$("#bar").offsetHeight+"px");}
addEventListener("resize",fitZoom);
/* cerca */
const q=$("#q"),res=$("#res");let hits=[],hi=-1;
function clearMarks(){book.querySelectorAll("mark").forEach(m=>{m.replaceWith(document.createTextNode(m.textContent));});book.normalize();}
const norm=t=>t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
function search(){clearMarks();hits=[];hi=-1;const v=norm(q.value.trim());if(v.length<2){res.classList.remove("on");res.innerHTML="";return;}
 const tw=document.createTreeWalker(book,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest(".phead,.pfoot,.toc,.idx")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});const nodes=[];while(tw.nextNode())nodes.push(tw.currentNode);
 for(const n of nodes){const t=n.textContent,nt=norm(t);let i=nt.indexOf(v);if(i<0)continue;const frag=document.createDocumentFragment();let last=0;
  while(i>=0){frag.appendChild(document.createTextNode(t.slice(last,i)));const m=document.createElement("mark");m.textContent=t.slice(i,i+v.length);frag.appendChild(m);hits.push(m);last=i+v.length;i=nt.indexOf(v,last);}
  frag.appendChild(document.createTextNode(t.slice(last)));n.replaceWith(frag);}
 const pages=[...book.children];
 res.innerHTML=hits.length?`<p>${hits.length} ${hits.length===1?"resultat":"resultats"}</p>`+hits.slice(0,60).map((m,k)=>{const p=m.closest(".page");const pg=pages.indexOf(p)+1;const sec=(p.querySelector(".psec")||{}).textContent||"";const ctx=((m.closest("p,li,td,th,h2,h3")||m.parentElement).textContent||"").replace(/\s+/g," ").trim();const at=norm(ctx).indexOf(v);const snip=(at>40?"…":"")+ctx.slice(Math.max(0,at-40),at+60)+"…";return `<a href="#" data-h="${k}"><span>${snip.replace(/[<>&]/g,"")}<br><small style="color:#6b675d">${sec}</small></span><b>p. ${pg}</b></a>`;}).join(""):`<p>Cap resultat per «${q.value.replace(/[<>&]/g,"")}».</p>`;res.classList.add("on");}
function goHit(k){if(!hits[k])return;hits.forEach(m=>m.classList.remove("cur"));hi=k;hits[k].classList.add("cur");hits[k].scrollIntoView({behavior:"smooth",block:"center"});}
let tmr;q.addEventListener("input",()=>{clearTimeout(tmr);tmr=setTimeout(search,200);});
q.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();if(hits.length){res.classList.remove("on");goHit((hi+1)%hits.length);}}if(e.key==="Escape"){q.value="";search();}});
res.addEventListener("click",e=>{const a=e.target.closest("[data-h]");if(!a)return;e.preventDefault();res.classList.remove("on");goHit(+a.dataset.h);});
q.addEventListener("focus",()=>{if(hits.length||q.value.trim().length>1)res.classList.add("on");});
/* enllaços interns: desplaçament suau tenint en compte la barra */
document.addEventListener("click",e=>{const a=e.target.closest('a[href^="#"]');if(!a||a.dataset.h!==undefined)return;const id=a.getAttribute("href").slice(1);const el=id&&book.querySelector("#"+CSS.escape(id));if(!el)return;e.preventDefault();res.classList.remove("on");
 const y=el.getBoundingClientRect().top+scrollY-($("#bar").offsetHeight+12);scrollTo({top:y,behavior:"smooth"});history.replaceState(null,"","#"+id);});
$("#prt").addEventListener("click",()=>{clearMarks();res.classList.remove("on");print();});
const go=()=>{paginate();if(location.hash){const el=book.querySelector(location.hash);if(el)setTimeout(()=>el.scrollIntoView(),50);}};
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(go);
})();
