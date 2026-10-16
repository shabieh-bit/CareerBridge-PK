"use strict";
const {extractSkills,skillGap,skillsFromCsv}=require("./career-engine");
const CACHE_MS=15*60*1000;
const cache=new Map();
function safeUrl(value){
 try{const u=new URL(value);return ["https:","http:"].includes(u.protocol)?u.href:null}catch{return null}
}
function stripHtml(str){return String(str||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,3000)}
async function jsonFetch(url,options={}){
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw new Error("Job provider HTTP "+r.status);
 return r.json();
}
async function joobleSearch(role,city){
 const key=process.env.JOOBLE_PK_API_KEY;
 if(!key)return {jobs:[],available:false,notice:"Pakistan job feed is not connected. Add the Pakistan-specific Jooble API key to Render to enable live vacancies."};
 const body={keywords:role,location:city||"",page:"1",ResultOnPage:"30"};
 const raw=await jsonFetch("https://pk.jooble.org/api/"+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 const rows=Array.isArray(raw.jobs)?raw.jobs:[];
 return {available:true,notice:"Live listings supplied by Jooble Pakistan. Confirm location, employer requirements, and whether vacancies remain open before applying.",
 jobs:rows.map(j=>({
  id:String(j.id||j.link||"").slice(0,140),source:"Jooble Pakistan",title:String(j.title||"").slice(0,180),
  company:String(j.company||"").slice(0,120),location:String(j.location||city||"Pakistan").slice(0,140),
  description:stripHtml(j.snippet||j.description),link:safeUrl(j.link),posted:j.updated||j.date||null
 })).filter(x=>x.link&&x.title)};
}
async function jobicyAnywhere(role){
 const url=new URL("https://jobicy.com/api/v2/remote-jobs");
 url.searchParams.set("count","80");url.searchParams.set("geo","anywhere");
 if(role.length>=3)url.searchParams.set("tag",role.slice(0,50));
 const raw=await jsonFetch(url.href);
 const rows=Array.isArray(raw.jobs)?raw.jobs:[];
 const jobs=rows.filter(j=>/anywhere|worldwide|global/i.test(String(j.jobGeo||""))).map(j=>({
  id:String(j.id||"").slice(0,140),source:"Jobicy",title:String(j.jobTitle||"").slice(0,180),
  company:String(j.companyName||"").slice(0,120),location:"Remote — worldwide",
  description:stripHtml(j.jobExcerpt||j.jobDescription),link:safeUrl(j.url),posted:j.pubDate||null
 })).filter(x=>x.link&&x.title);
 return {available:true,jobs,notice:"Remote listings are advertised as worldwide. Confirm that the employer accepts applicants based in Pakistan."};
}
async function retrieveJobs({role,mode,city}){
 const key=JSON.stringify({role,mode,city,keyExists:!!process.env.JOOBLE_PK_API_KEY});
 const hit=cache.get(key);if(hit&&Date.now()-hit.time<CACHE_MS)return hit.value;
 let value;
 if(mode==="remote")value=await jobicyAnywhere(role);
 else value=await joobleSearch(role,mode==="city"?city:"");
 cache.set(key,{time:Date.now(),value});
 if(cache.size>100)cache.delete(cache.keys().next().value);
 return value;
}
function recommendJobs(rawJobs,{skills,role}){
 const profile=skillsFromCsv(skills),roleWords=String(role||"").toLowerCase().split(/\W+/).filter(w=>w.length>3);
 return rawJobs.map(job=>{
  const detected=extractSkills(job.title+" "+job.description);
  const match=skillGap(profile,detected);
  const overlap=(match.matched||[]).length;
  const roleScore=roleWords.filter(w=>(job.title+" "+job.description).toLowerCase().includes(w)).length;
  // A ranking signal, not a probability of employment or eligibility.
  const rankingScore=roleScore*10+overlap*3-(match.missing?.length||0);
  return {...job,requirementsDetected:detected,match,rankingScore};
 }).sort((a,b)=>b.rankingScore-a.rankingScore).slice(0,30);
}
module.exports={retrieveJobs,recommendJobs,stripHtml,safeUrl};
