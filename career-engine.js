"use strict";
const dictionary={
 "Python":["python"],"SQL":["sql","postgresql","mysql","sql server"],
 "Excel":["excel","spreadsheets","microsoft excel"],"Power BI":["power bi","powerbi"],
 "Tableau":["tableau"],"JavaScript":["javascript","node.js","react.js"],
 "TypeScript":["typescript"],"React":["react","reactjs"],"Node.js":["node.js","nodejs"],
 "HTML":["html"],"CSS":["css"],"Java":["java"],"C++":["c++"],"C#":["c#"],
 "PHP":["php"],"Django":["django"],"Flask":["flask"],"Git":["git","github"],
 "Docker":["docker"],"AWS":["aws","amazon web services"],"Azure":["azure"],
 "Machine Learning":["machine learning","ml models"],"Data Analysis":["data analysis","data analytics"],
 "Pandas":["pandas"],"NumPy":["numpy"],"Statistics":["statistics","statistical analysis"],
 "R":["r programming","r language","rstudio"],"TensorFlow":["tensorflow"],"PyTorch":["pytorch"],
 "Data Visualization":["data visualization","data visualisation"],"ETL":["etl","data pipelines"],
 "Communication":["communication skills","professional communication"],
 "Project Management":["project management"],"Agile":["agile","scrum"],
 "Digital Marketing":["digital marketing"],"SEO":["seo","search engine optimization"],
 "Google Analytics":["google analytics","ga4"],"Meta Ads":["meta ads","facebook ads"],
 "Content Writing":["content writing","copywriting"],"Figma":["figma"],
 "UI/UX":["ui/ux","user experience","user interface design"],
 "Photoshop":["photoshop"],"Illustrator":["illustrator"],
 "Accounting":["accounting"],"QuickBooks":["quickbooks"],"Financial Analysis":["financial analysis"],
 "Customer Service":["customer service","customer support"],
 "Sales":["sales experience","sales operations","b2b sales"],
 "HACCP":["haccp"],"Food Safety":["food safety"],"Quality Assurance":["quality assurance"],
 "AutoCAD":["autocad"],"MATLAB":["matlab"],"SolidWorks":["solidworks"],
 "BIM":["bim","revit"],"Research":["research methodology","scientific research"],
 "Report Writing":["report writing"],"Teaching":["teaching experience","instructional design"]
};
const normalized=s=>String(s||"").toLowerCase().replace(/\.(?![a-z0-9])/g," ").replace(/[^a-z0-9+#.\/]+/g," ").trim();
function contains(text,phrase){
 const p=normalized(phrase);
 if(!p)return false;
 const t=" "+normalized(text)+" ";
 const needle=" "+p+" ";
 return t.includes(needle)||t.includes(needle.replace(/\s/g," "));
}
function extractSkills(text){
 const out=[];
 for(const [skill,aliases] of Object.entries(dictionary))
  if(aliases.some(x=>contains(text,x)))out.push(skill);
 return out;
}
function skillsFromCsv(raw){
 const source=String(raw||"").split(/[,;\n]/).map(x=>x.trim()).filter(Boolean).slice(0,100);
 return [...new Map(source.map(x=>[x.toLowerCase(),x])).values()];
}
function suggestRoles(skills){
 const have=new Set((skills||[]).map(s=>s.toLowerCase()));
 const groups=[
  {role:"Data Analyst",skills:["Python","SQL","Excel","Statistics","Data Analysis","Pandas"]},
  {role:"Business Intelligence Analyst",skills:["Power BI","Tableau","Excel","SQL"]},
  {role:"Frontend Developer",skills:["JavaScript","HTML","CSS","React","TypeScript"]},
  {role:"Backend Developer",skills:["Node.js","Python","Java","SQL","Django"]},
  {role:"Digital Marketing Executive",skills:["Digital Marketing","SEO","Google Analytics","Meta Ads","Content Writing"]},
  {role:"Food Safety & Quality Officer",skills:["HACCP","Food Safety","Quality Assurance"]},
  {role:"Junior Finance Analyst",skills:["Accounting","Excel","Financial Analysis","QuickBooks"]},
  {role:"UI/UX Designer",skills:["UI/UX","Figma","Photoshop","Illustrator"]},
  {role:"Engineering Analyst",skills:["MATLAB","AutoCAD","SolidWorks","BIM"]},
  {role:"Project Coordinator",skills:["Project Management","Agile","Communication"]}
 ];
 return groups.map(g=>({...g,score:g.skills.filter(s=>have.has(s.toLowerCase())).length}))
  .filter(g=>g.score>=2).sort((a,b)=>b.score-a.score).slice(0,5).map(g=>g.role);
}
function parseCVText(text){
 const clean=String(text||"").slice(0,50000).replace(/[\x00-\x08\x0b-\x1f]/g," ");
 const skills=extractSkills(clean);
 const education=(clean.match(/\b(?:BS|BSc|Bachelor(?:'s)?|BE|MSc|MS|MBA|BBA|PhD|Master(?:'s)?)\b[^\n]{0,70}/ig)||[])
  .map(x=>x.trim().slice(0,85)).slice(0,5);
 // No invented experience or degree details. User checks all extracted fields.
 return {skills,education,suggestedRoles:suggestRoles(skills),extractedCharacters:clean.length,needsReview:true,
   note:"Automated keyword extraction may miss skills, experience or scanned text. Please review your results."};
}
function skillGap(profileSkills,requiredSkills){
 const have=new Set(skillsFromCsv(profileSkills).map(x=>x.toLowerCase()));
 const needed=skillsFromCsv(requiredSkills);
 const matched=needed.filter(x=>have.has(x.toLowerCase()));
 const missing=needed.filter(x=>!have.has(x.toLowerCase()));
 return {matched,missing,total:needed.length,percentage:needed.length?Math.round(100*matched.length/needed.length):null};
}
const freeSources={
 "Python":[["Python learning modules","https://learn.microsoft.com/en-us/training/browse/?terms=python"]],
 "SQL":[["Learn SQL","https://learn.microsoft.com/en-us/training/browse/?terms=sql"]],
 "Excel":[["Excel tutorials","https://support.microsoft.com/en-us/excel"]],
 "Power BI":[["Microsoft Power BI learning","https://learn.microsoft.com/en-us/training/powerplatform/power-bi"]],
 "Data Analysis":[["Data analysis learning paths","https://learn.microsoft.com/en-us/training/browse/?terms=data%20analysis"]],
 "Machine Learning":[["Microsoft ML learning paths","https://learn.microsoft.com/en-us/training/browse/?terms=machine%20learning"]],
 "Digital Marketing":[["Google Skillshop","https://skillshop.withgoogle.com/"]],
 "Google Analytics":[["Google Skillshop","https://skillshop.withgoogle.com/"]],
 "SEO":[["Google Search Central","https://developers.google.com/search/docs/fundamentals/seo-starter-guide"]],
 "JavaScript":[["MDN JavaScript guide","https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"]],
 "HTML":[["MDN Learn web development","https://developer.mozilla.org/en-US/docs/Learn_web_development"]],
 "CSS":[["MDN CSS guide","https://developer.mozilla.org/en-US/docs/Web/CSS"]],
 "Git":[["GitHub Skills","https://skills.github.com/"]],
 "Project Management":[["Microsoft Learn project management","https://learn.microsoft.com/en-us/training/browse/?terms=project%20management"]]
};
function learningFor(skill){
 const key=Object.keys(freeSources).find(s=>s.toLowerCase()===String(skill).toLowerCase());
 const resources=(key?freeSources[key]:[["Microsoft Learn search","https://learn.microsoft.com/en-us/training/browse/?terms="+encodeURIComponent(skill)]])
  .map(([label,url])=>({label,url,kind:"learning"}));
 resources.push({label:"Explore recognized certification pathways",url:"https://learn.microsoft.com/en-us/credentials/certifications/",kind:"certification-directory"});
 resources.push({label:"Find tutorial videos on YouTube",url:"https://www.youtube.com/results?search_query="+encodeURIComponent(skill+" beginner tutorial"),kind:"video-search"});
 return {skill,resources,certificateNote:"Some platforms offer paid exams/certificates. Check the provider before enrolling."};
}
module.exports={extractSkills,parseCVText,skillGap,skillsFromCsv,learningFor,suggestRoles};
