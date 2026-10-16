"use strict";
const el=(id)=>document.getElementById(id);
const set=(id,value)=>{const node=el(id);if(node)node.textContent=value??""};
const menu=document.querySelector(".menu-toggle");
const nav=document.querySelector(".nav-links");
if(menu&&nav){menu.addEventListener("click",()=>menu.setAttribute("aria-expanded",String(nav.classList.toggle("open"))));nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu.setAttribute("aria-expanded","false")}))}
async function request(url,method="GET"){const res=await fetch("/api"+url,{method,credentials:"same-origin",cache:"no-store"});const data=await res.json().catch(()=>({}));if(!res.ok)throw Object.assign(new Error(data.error||"Server request failed"),{status:res.status});return data}
function linkFor(url){try{const parsed=new URL(url);return ["http:","https:"].includes(parsed.protocol)?parsed.href:null}catch{return null}}
function fillRecords(id,items,emptyMessage,isApplication){const parent=el(id);parent.replaceChildren();if(!items.length){const p=document.createElement("p");p.className="dashboard-muted";p.textContent=emptyMessage;parent.append(p);return}items.slice(0,5).forEach(item=>{const card=document.createElement("div");card.className="dashboard-record";const title=document.createElement("strong");title.textContent=item.job?.title||"Opportunity";card.append(title);const meta=document.createElement("p");meta.textContent=isApplication?(item.status||"Tracked inside CareerBridge"):(item.job?.location||"Saved opportunity");card.append(meta);const href=linkFor(item.job?.link);if(href){const a=document.createElement("a");a.href=href;a.target="_blank";a.rel="noopener noreferrer";a.className="text-link";a.textContent="Open vacancy ↗";card.append(a)}parent.append(card)})}
function skillTags(skills){const wrap=el("dashboard-skills");wrap.replaceChildren();String(skills||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,20).forEach(skill=>{const tag=document.createElement("span");tag.className="skill-chip";tag.textContent=skill;wrap.append(tag)})}
async function init(){try{
 const user=(await request("/auth/me")).user;
 const [profileData,matchData,jobsData,appsData]=await Promise.all([request("/profile"),request("/matches/latest"),request("/saved-jobs"),request("/applications")]);
 const p=profileData.profile,m=matchData.result,saved=jobsData.jobs||[],apps=appsData.applications||[];
 set("welcome-name",user.name||"student");const completed=p?["degree","semester","city","interest","skills"].filter(k=>String(p[k]||"").trim()).length:0;
 const percent=Math.round(completed/5*100);set("metric-profile",percent+"%");el("metric-profile-fill").style.width=percent+"%";set("metric-match",m?m.match.percentage+"%":"—");set("metric-saved",String(saved.length));set("metric-actions",String(apps.length));
 set("dashboard-profile",p? [p.degree,p.semester,p.city,p.interest].filter(Boolean).join(" · "):"You haven't created a student profile yet. Start with your degree, location and skills.");
 skillTags(p?.skills);
 set("dashboard-match-title",m?.job?.title||"No checks yet");set("dashboard-match-detail",m?m.match.matched.length+" of "+m.match.total+" entered skills matched.":"Once you check a role, your latest comparison will appear here.");
 fillRecords("dashboard-saved",saved,"No saved opportunities yet. Save one from your match results.",false);
 fillRecords("dashboard-applications",apps,"No tracked actions yet. Use your action plan to start tracking.",true);
 el("admin-dashboard-link").hidden=user.isAdmin!==true;
 el("dashboard-content").hidden=false;set("dashboard-status","");
 }catch(e){if(e.status===401){location.replace("auth.html?next=dashboard.html");return}set("dashboard-status","We couldn't load your dashboard. Please refresh and try again.")}}
el("logout-btn").addEventListener("click",async()=>{try{await request("/auth/logout","POST");location.assign("index.html")}catch{set("dashboard-status","Sign-out failed. Please try again.")}});
init();
