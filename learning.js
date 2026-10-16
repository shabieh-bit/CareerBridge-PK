"use strict";
const holder=document.getElementById("skill-learning-resources");
const status=document.getElementById("learning-resources-status");
if(holder&&status){
(async()=>{
 try{
  const r=await fetch("/api/matches/latest",{credentials:"same-origin",cache:"no-store"});
  if(!r.ok)throw Error("Sign in to view learning resources");
  const {result}=await r.json();
  const missing=Array.isArray(result?.match?.missing)?result.match.missing:[];
  if(!missing.length){status.textContent="No missing skills detected from the manually entered requirements.";return}
  const q=new URLSearchParams({skills:missing.slice(0,8).join(",")});
  const source=await fetch("/api/learning-resources?"+q,{credentials:"same-origin",cache:"no-store"});
  if(!source.ok)throw Error("Learning resource service unavailable");
  const data=await source.json();status.textContent="These are learning starting points for your missing skills. Videos are searches, not vetted certificates.";
  for(const item of data.learning){
    const card=document.createElement("section");card.className="career-learning";
    const h=document.createElement("h4");h.textContent=item.skill;card.append(h);
    const list=document.createElement("ul");
    for(const resource of item.resources){
     let u;try{u=new URL(resource.url)}catch{continue}
     if(!["https:","http:"].includes(u.protocol))continue;
     const li=document.createElement("li"),a=document.createElement("a");
     a.href=u.href;a.target="_blank";a.rel="noopener noreferrer";a.className="text-link";
     a.textContent=resource.label;li.append(a);
     if(resource.kind==="video-search")li.append(document.createTextNode(" (YouTube search)"));
     list.append(li);
    }
    card.append(list);holder.append(card);
  }
 }catch(e){status.textContent=e.message}
})();
}
