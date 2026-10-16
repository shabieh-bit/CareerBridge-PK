"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {extractSkills,parseCVText,skillGap,learningFor}=require("../career-engine");
const {recommendJobs,stripHtml,safeUrl,retrieveJobs}=require("../jobs-provider");
test("CV identifies skills across technologies without fabricating employment eligibility",()=>{
 const cv="BSc Computer Science\nSkills: Python, SQL, Excel, data analysis and Power BI\nProjects: statistics reporting";
 const r=parseCVText(cv);
 for(const skill of ["Python","SQL","Excel","Power BI","Data Analysis","Statistics"])assert.ok(r.skills.includes(skill),skill);
 assert.equal(r.needsReview,true);
 assert.ok(r.education.length>0);
 assert.ok(!Object.hasOwn(r,"email"));
});
test("a job missing an extractable skill list has no percentage",()=>{
 assert.deepEqual(skillGap("Python",""),{matched:[],missing:[],total:0,percentage:null});
 const v=skillGap("Python, Excel","SQL, Excel, Python");
 assert.equal(v.percentage,67);
 assert.deepEqual(v.missing,["SQL"]);
});
test("recommender shows explicit missing skills and only provider-supplied links",()=>{
 const list=recommendJobs([{title:"Junior Data Analyst",description:"You must know SQL, Excel and Python.",link:"https://jobs.example.org/job1",company:"Example Company",location:"Lahore"}],{role:"Data Analyst",skills:["Excel","Python"]});
 assert.equal(list.length,1);
 assert.equal(list[0].match.percentage,67);
 assert.deepEqual(list[0].match.missing,["SQL"]);
 assert.equal(safeUrl("javascript:alert(1)"),null);
 assert.equal(stripHtml("<p>SQL <b>required</b></p>"),"SQL required");
});
test("learning resources are transparently labelled as links and video searches",()=>{
 const r=learningFor("SQL");
 assert.equal(r.skill,"SQL");
 assert.ok(r.resources.some(x=>x.kind==="video-search"));
 assert.ok(r.resources.some(x=>x.kind==="certification-directory"));
 assert.ok(r.certificateNote.includes("paid"));
});
test("without a Pakistan-specific API key, there are no invented live local jobs",async()=>{
 const saved=process.env.JOOBLE_PK_API_KEY;
 delete process.env.JOOBLE_PK_API_KEY;
 try{
 const r=await retrieveJobs({role:"data analyst",mode:"city",city:"Lahore"});
 assert.equal(r.available,false);
 assert.deepEqual(r.jobs,[]);
 assert.match(r.notice,/API key/i);
 }finally{if(saved!==undefined)process.env.JOOBLE_PK_API_KEY=saved}
});
