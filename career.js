"use strict";
const $=id=>document.getElementById(id);
const menu=document.querySelector(".menu-toggle"),nav=document.querySelector(".nav-links");
if(menu&&nav)menu.addEventListener("click",()=>menu.setAttribute("aria-expanded",String(nav.classList.toggle("open"))));
const state={profile:null,analysis:null,plans:[]};
const text=(id,value)=>{const e=$(id);if(e)e.textContent=value??""};
async function api(path,method="GET",body){
 const res=await fetch("/api"+path,{method,credentials:"same-origin",cache:"no-store",headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Object.assign(new Error(data.error||"Request unsuccessful"),{status:res.status});
 return data;
}
function elt(tag,content,cls){const e=document.createElement(tag);if(content!==undefined)e.textContent=content;if(cls)e.className=cls;return e}
function externalLink(url,label){
 try{const u=new URL(url,location.href);if(!["http:","https:"].includes(u.protocol))return elt("span","No verified link");const a=elt("a",label,"text-link");a.href=u.href;a.target="_blank";a.rel="noopener noreferrer";return a}
 catch{return elt("span","Link unavailable")}
}
function chipList(target,items){target.replaceChildren();if(!items?.length){target.append(elt("p","No recognized skills found."));return}items.forEach(s=>target.append(elt("span",s,"skill-chip")))}
function updateAnalysis(a){
 state.analysis=a;
 const panel=$("cv-analysis-data");panel.hidden=!a;
 if(a){chipList($("cv-extracted-skills"),a.skills);text("cv-education",a.education.length?"Education mentioned: "+a.education.join(" · "):"Education could not be reliably extracted.");const suggestions=$("cv-suggested-roles");suggestions.replaceChildren();for(const role of a.suggestedRoles||[]){
   const btn=elt("button",role,"filter-btn");btn.type="button";btn.addEventListener("click",()=>{$("career-role").value=role;$("career-role").focus()});suggestions.append(btn);
  }
  if(!(a.suggestedRoles||[]).length)suggestions.append(elt("span","No confident title suggestions; type your preferred field below."));text("cv-analysis-status","Text extracted. Review the skills before updating your profile.");}
 else text("cv-analysis-status","No analyzed CV yet. You can analyze it now, or use your manually entered profile skills to search.");
}
async function loadProfile(){
 try{
  const me=await api("/auth/me");if(!me.user){location.assign("auth.html?next=career.html");return}
  const [p,a,cv]=await Promise.all([api("/profile"),api("/cv/analysis"),api("/cv")]);
  state.profile=p.profile;
  $("career-city").value=p.profile?.city||"";
  $("career-role").value=p.profile?.interest||"";
  updateAnalysis(a.analysis);
  if(!a.analysis&&cv.cv)text("cv-analysis-status","Your CV is uploaded. Click Analyze my CV to extract skills.");
  if(!cv.cv)text("cv-analysis-status","No CV uploaded. Add one anytime, or search using your saved profile.");
 }catch(e){if(e.status===401){location.assign("auth.html?next=career.html");return}text("cv-analysis-status",e.message)}
}
$("analyze-cv").addEventListener("click",async()=>{
 const btn=$("analyze-cv");btn.disabled=true;text("cv-analysis-status","Reading your CV… This may take a few seconds.");
 try{const result=await api("/cv/analyze","POST",{});updateAnalysis(result.analysis)}
 catch(e){text("cv-analysis-status",e.message)}finally{btn.disabled=false}
});
$("use-cv-skills").addEventListener("click",async()=>{
 const p=state.profile,a=state.analysis;
 if(!p||!a?.skills?.length){text("cv-analysis-status","Complete your profile and analyze a CV first.");return}
 const skills=[...new Map([...String(p.skills||"").split(","),...a.skills].map(x=>x.trim()).filter(Boolean).map(x=>[x.toLowerCase(),x])).values()].join(", ");
 if(skills.length>300){text("cv-analysis-status","Too many skills for the profile. Edit your skills manually to fit the profile field.");return}
 if(!window.confirm("Add the CV-extracted skills to your profile? Please ensure they accurately reflect your experience."))return;
 try{const result=await api("/profile","PUT",{degree:p.degree,semester:p.semester,city:p.city,interest:p.interest,skills});
  state.profile=result.profile;text("cv-analysis-status","Skills added to your student profile. You can now re-check a job.");
 }catch(e){text("cv-analysis-status",e.message)}
});
document.querySelectorAll('input[name="mode"]').forEach(r=>r.addEventListener("change",()=>{
 const citySelected=document.querySelector('input[name="mode"]:checked').value==="city";
 $("career-city").hidden=!citySelected;$("career-city-label").hidden=!citySelected;$("career-city").required=citySelected;
}));
const info=(parent,label,value)=>{const p=elt("p");p.append(elt("strong",label+" "));p.append(document.createTextNode(value||"—"));parent.append(p)};
function displayJobs(jobs){
 const host=$("jobs-cards");host.replaceChildren();
 if(!jobs.length)return;
 jobs.forEach(job=>{
  const article=elt("article",undefined,"career-job-card");
  article.append(elt("span",job.source,"tag"),elt("h3",job.title));
  info(article,"Employer:",job.company||"Not provided");
  info(article,"Location:",job.location||"Not provided");
  if(job.posted){const dt=new Date(job.posted);if(!isNaN(dt.getTime()))info(article,"Published:",dt.toLocaleDateString())}
  if(job.requirementsDetected?.length){
   article.append(elt("p",job.match.percentage+"% detected skill overlap (not formal job eligibility)","dashboard-disclaimer"));
   const wrap=elt("div",undefined,"chip-list");chipList(wrap,job.requirementsDetected);article.append(wrap);
   if(job.match.missing.length)article.append(elt("p","Skills to work on: "+job.match.missing.join(", "),"career-missing"));
  }else article.append(elt("p","Not enough skill detail in the provider excerpt to calculate a reliable percentage.","dashboard-disclaimer"));
  article.append(elt("p",(job.description||"No preview available. View the original listing for complete requirements.").slice(0,240)+"…","career-excerpt"));
  const actions=elt("div",undefined,"career-actions");
  actions.append(externalLink(job.link,"View original listing ↗"));
  const plan=elt("button","Create action plan","btn btn-outline");plan.type="button";
  plan.disabled=!job.requirementsDetected?.length;
  plan.title=plan.disabled?"No required skills detected; use the manual eligibility checker": "Save learning plan for this job";
  plan.addEventListener("click",async()=>{
   plan.disabled=true;
   try{await api("/action-plans","POST",{job,requiredSkills:job.requirementsDetected});text("jobs-message","Action plan saved for "+job.title+". Scroll down to view it.");await loadPlans()}
   catch(e){text("jobs-message",e.message)}
   finally{plan.disabled=false}
  });
  actions.append(plan);article.append(actions);host.append(article);
 });
}
$("jobs-search-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const btn=$("search-jobs");btn.disabled=true;text("jobs-message","Searching the job provider. Only returned listings will appear.");$("jobs-cards").replaceChildren();
 const form=new FormData(e.currentTarget),mode=String(form.get("mode")),role=String(form.get("role")||"").trim(),city=String(form.get("city")||"").trim();
 const query=new URLSearchParams({mode,role,city});
 try{const r=await api("/jobs/recommendations?"+query.toString());
  text("jobs-message",r.notice+" | Profile input: "+r.profileSource+" | "+r.jobs.length+" results returned.");
  if(!r.providerAvailable&&mode!=="remote"){
   $("jobs-message").append(document.createTextNode(" "));
   $("jobs-message").append(externalLink("https://pk.jooble.org/","Search Pakistan jobs directly on Jooble ↗"));
  }
  displayJobs(r.jobs)
 }catch(err){text("jobs-message",err.message)}
 finally{btn.disabled=false}
});
function learningResource(li,resource){
 li.append(externalLink(resource.url,resource.label));
 if(resource.kind==="video-search")li.append(document.createTextNode(" (video search, not a verified course)"));
}
function displayPlans(plans){
 const host=$("plans-cards");host.replaceChildren();
 if(!plans.length){text("plans-message","No saved action plans yet. Search for a job above and create one.");return}
 text("plans-message",plans.length+" saved action plan(s).");
 plans.forEach(plan=>{
  const article=elt("article",undefined,"career-job-card");article.append(elt("h3",plan.job.title));
  info(article,"Location:",plan.job.location);
  const gap=plan.currentGap;
  if(gap?.total)article.append(elt("p",gap.percentage+"% of detected skills are currently listed in your student profile.","dashboard-disclaimer"));
  if(!gap?.missing?.length){article.append(elt("p","No missing skills detected. Still review the original employer requirements."));}
  else{
   article.append(elt("h4","Learn these missing skills"));
   gap.missing.forEach(skill=>{
    const wrap=elt("div",undefined,"career-learning");
    wrap.append(elt("h4",skill));
    const resources=plan.learning?.find(l=>l.skill.toLowerCase()===skill.toLowerCase())?.resources||[];
    const ul=elt("ul");resources.forEach(resource=>{const li=elt("li");learningResource(li,resource);ul.append(li)});
    wrap.append(ul);article.append(wrap);
   });
  }
  const p=elt("p","Mark learning progress below (this does not update your professional skills automatically).","dashboard-muted");article.append(p);
  plan.required_skills.forEach(skill=>{
   const label=elt("label",undefined,"career-check");
   const box=document.createElement("input");box.type="checkbox";box.checked=plan.completed_skills.some(x=>x.toLowerCase()===skill.toLowerCase());
   label.append(box,document.createTextNode("Practiced / studied "+skill));article.append(label);
   box.addEventListener("change",async()=>{
    const checked=[...article.querySelectorAll(".career-check")].filter(l=>l.querySelector("input").checked).map(l=>l.textContent.replace(/^Practiced \/ studied /,""));
    try{await api("/action-plans/"+encodeURIComponent(plan.id)+"/progress","PUT",{completedSkills:checked});plan.completed_skills=checked}
    catch(e){box.checked=!box.checked;text("plans-message",e.message)}
   });
  });
  const actions=elt("div",undefined,"career-actions");
  actions.append(externalLink(plan.job.link,"View vacancy ↗"),externalLink("student-profile.html","Update my skills"));
  const recheck=elt("button","Recheck match","btn");recheck.type="button";
  recheck.addEventListener("click",async()=>{
   recheck.disabled=true;
   try{await api("/action-plans/"+encodeURIComponent(plan.id)+"/recheck","POST",{});location.assign("match-result.html")}
   catch(e){text("plans-message",e.message);recheck.disabled=false}
  });
  actions.append(recheck);article.append(actions);host.append(article);
 });
}
async function loadPlans(){try{const r=await api("/action-plans");state.plans=r.plans;displayPlans(state.plans)}catch(e){text("plans-message",e.message)}}
Promise.all([loadProfile(),loadPlans()]).catch(err=>console.error(err));
