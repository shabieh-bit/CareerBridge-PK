"use strict";
const $=s=>document.querySelector(s);
const menuToggle=$(".menu-toggle"),navLinks=$(".nav-links");
if(menuToggle&&navLinks){menuToggle.addEventListener("click",()=>{const open=navLinks.classList.toggle("open");menuToggle.setAttribute("aria-expanded",String(open))});navLinks.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>navLinks.classList.remove("open")))}
async function api(url,method="GET",body){
 const response=await fetch("/api"+url,{method,headers:{"Content-Type":"application/json"},credentials:"same-origin",body:body===undefined?undefined:JSON.stringify(body)});
 let data;try{data=await response.json()}catch{throw Error("Service unavailable. Try again.")}
 if(!response.ok)throw Error(data.error||"Request failed");
 return data;
}
function message(selector,text){const el=$(selector);if(el){el.textContent=text;el.classList.add("show")}}
function safeText(selector,text){const el=$(selector);if(el)el.textContent=text||""}
function chipList(selector,arr,missing=false){const el=$(selector);if(!el)return;el.replaceChildren();if(!arr.length){el.textContent="None identified.";return}for(const skill of arr){const span=document.createElement("span");span.className="skill-chip"+(missing?" missing":"");span.textContent=skill;el.append(span)}}
const needAuth=()=>{window.location.href="auth.html?next="+encodeURIComponent(location.pathname.split("/").pop()||"student-profile.html")};
let currentUser=null,currentResult=null;
async function authStatus(){
 try{currentUser=(await api("/auth/me")).user}catch{}
 const nav=$(".nav-links");if(nav){const item=document.createElement("a");item.href=currentUser?"dashboard.html":"auth.html";item.textContent=currentUser?"My dashboard":"Sign in";nav.append(item)}
}
function requireLogin(){if(!currentUser){needAuth();return false}return true}
async function init(){
 await authStatus();
 const interestForm=$("#interest-form");
 if(interestForm)interestForm.addEventListener("submit",e=>{e.preventDefault();const data=new FormData(interestForm);const suggestions={guidance:"List three target roles and compare their required skills.",skills:"Select one useful skill and schedule three practice sessions.",internship:"Shortlist five internships and tailor your CV."};message("#form-result",String(data.get("name"))+", suggested next step: "+(suggestions[data.get("goal")]||"Explore opportunities."))});
 const filterButtons=document.querySelectorAll(".filter-btn");
 filterButtons.forEach(b=>b.addEventListener("click",()=>{filterButtons.forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".opportunity-card").forEach(card=>card.hidden=b.dataset.filter!=="all"&&card.dataset.category!==b.dataset.filter)}));
 const authForm=$("#auth-form");
 if(authForm){const mode=$("#auth-mode"),nameWrap=$("#auth-name-wrap"),submit=$("#auth-submit");
 const update=()=>{const register=mode.value==="register";nameWrap.hidden=!register;submit.textContent=register?"Create account":"Sign in"};mode.addEventListener("change",update);update();
 authForm.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(authForm),register=mode.value==="register";try{await api("/auth/"+(register?"register":"login"),"POST",{name:fd.get("name"),email:fd.get("email"),password:fd.get("password")});const next=new URLSearchParams(location.search).get("next");location.href=/^(student-profile|eligibility-check|match-result|action-confirmation|dashboard)\.html$/.test(next||"")?next:"dashboard.html"}catch(e){message("#auth-result",e.message)}})}
 const profileForm=$("#student-profile-form");
 if(profileForm){if(!requireLogin())return;try{const {profile}=await api("/profile");if(profile)for(const [k,v]of Object.entries(profile)){const el=profileForm.elements.namedItem(k);if(el&&el.type!=="file")el.value=v}}catch(e){message("#profile-result",e.message)}
 profileForm.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(profileForm);try{await api("/profile","PUT",Object.fromEntries(["degree","semester","city","interest","skills"].map(k=>[k,String(f.get(k)||"")])));message("#profile-result","Profile saved to your account.");location.href="eligibility-check.html"}catch(e){message("#profile-result",e.message)}})}
 const eligibilityForm=$("#eligibility-form");
 if(eligibilityForm){if(!requireLogin())return;try{const {profile}=await api("/profile");const summary=$("#profile-summary");if(summary)summary.textContent=profile?profile.degree+" · "+profile.city+" · "+profile.interest+" · Skills: "+profile.skills:"No profile saved yet. Create your profile first."}catch(e){message("#eligibility-result",e.message)}
 eligibilityForm.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(eligibilityForm);try{await api("/matches","POST",Object.fromEntries(["jobLink","jobTitle","jobLocation","requirements"].map(k=>[k,String(f.get(k)||"")])));location.href="match-result.html"}catch(e){message("#eligibility-result",e.message)}})}
 if($("#match-percent")||$("#recommendation-title")){if(!requireLogin())return;try{currentResult=(await api("/matches/latest")).result;if(!currentResult){message("#save-result","Run an eligibility check first.");return}const {match,job}=currentResult;
 if($("#match-percent")){safeText("#match-percent",String(match.percentage));safeText("#match-count",match.matched.length+" of "+match.total+" requirements matched");safeText("#match-badge",match.percentage>=80?"High match":match.percentage>=60?"Good match":"Needs preparation");safeText("#score-circle",match.percentage+"%");const fill=$("#progress-fill");if(fill)fill.style.width=match.percentage+"%";chipList("#matched-skills",match.matched);chipList("#missing-skills",match.missing,true);safeText("#result-job-title",job.title);safeText("#result-job-meta",job.location);const link=$("#result-job-link");if(link)link.href=job.link}
 if($("#recommendation-title")){const missing=match.missing[0];safeText("#recommendation-title",match.percentage>=70?"Apply now":"Build missing skills first");safeText("#recommendation-copy",missing?"Improve "+missing+" and consider your other missing requirements.":"Your listed skills match all provided requirements.");safeText("#skill-to-improve",missing||"No missing skill identified");safeText("#learning-time",missing?"Suggested starter learning block: 6 focused hours.":"No gaps identified in entered requirements.");const {applications}=await api("/applications");const application=applications.find(a=>a.job.link===job.link);safeText("#application-status",application?application.status:"Not started")}
 }catch(e){message("#save-result",e.message)}}
 const save=$("#save-job-btn");if(save)save.addEventListener("click",async()=>{try{if(!currentResult)throw Error("No match to save.");await api("/saved-jobs","POST",{matchId:Number(currentResult.id)});message("#save-result","Job saved to your account.")}catch(e){message("#save-result",e.message)}});
 const track=$("#apply-track-btn");if(track)track.addEventListener("click",async()=>{try{if(!currentResult)throw Error("Run eligibility check first.");await api("/applications","POST",{matchId:Number(currentResult.id)});safeText("#application-status","Application tracked");const panel=$("#confirmation-panel");if(panel){panel.hidden=false;panel.querySelector("p").textContent="Saved to your CareerBridge tracker. This does not submit an application to the employer."}}catch(e){alert(e.message)}});
 const dashboard=$("#dashboard-data");if(dashboard){if(!requireLogin())return;safeText("#welcome-name",currentUser.name);try{const [p,j,a]=await Promise.all([api("/profile"),api("/saved-jobs"),api("/applications")]);dashboard.replaceChildren();const intro=document.createElement("p");intro.textContent=p.profile?"Profile: "+p.profile.degree+" in "+p.profile.city:"Create your student profile to begin.";dashboard.append(intro);for(const [label,records]of [["Saved jobs",j.jobs],["Tracked applications",a.applications]]){const h=document.createElement("h2");h.textContent=label+" ("+records.length+")";dashboard.append(h);for(const record of records){const row=document.createElement("p");row.textContent=record.job.title+" — "+(record.status||"Saved");dashboard.append(row)}}}catch(e){dashboard.textContent=e.message}}
 const logout=$("#logout-btn");if(logout)logout.addEventListener("click",async()=>{await api("/auth/logout","POST");location.href="index.html"});
}
init().catch(e=>console.error(e));
