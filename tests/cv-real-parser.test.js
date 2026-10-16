"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {spawn}=require("node:child_process"),{setTimeout:sleep}=require("node:timers/promises");
const {PDFDocument}=require("pdf-lib");
const JSZip=require("jszip");
const {Pool}=require("pg");
async function pdfFixture(){
 const pdf=await PDFDocument.create(),page=pdf.addPage();
 page.drawText("Bachelor of Science Computer Science", {x:40,y:740,size:14});
 page.drawText("SKILLS: Python, SQL, Excel and Power BI", {x:40,y:700,size:14});
 page.drawText("EXPERIENCE: Data Analysis internship", {x:40,y:660,size:14});
 return Buffer.from(await pdf.save());
}
async function docxFixture(){
 const zip=new JSZip();
 zip.file("[Content_Types].xml",'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file("_rels/.rels",'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file("word/document.xml",'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Skills: Python, Excel, SQL and Tableau. Bachelor of Science.</w:t></w:r></w:p></w:body></w:document>');
 return zip.generateAsync({type:"nodebuffer"});
}
test("real text-based PDF and DOCX can be uploaded and analyzed without exposing CV text", {skip:!process.env.TEST_DATABASE_URL},async()=>{
 const port=43000+Math.floor(Math.random()*9000);
 const base="http://127.0.0.1:"+port+"/api";
 const child=spawn(process.execPath,["server.js"],{cwd:require("node:path").join(__dirname,".."),env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,NODE_ENV:"test",PORT:String(port)},stdio:["ignore","pipe","pipe"]});
 let logs="";child.stdout.on("data",d=>logs+=String(d));child.stderr.on("data",d=>logs+=String(d));
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL}),email="ci-cv-real-"+Date.now()+"@example.test";
 async function api(url,method="GET",body,cookie,headers={}){
  const res=await fetch(base+url,{method,headers:{...headers,...cookie?{Cookie:cookie}:{}},body});
  return {status:res.status,data:await res.json(),cookie:res.headers.get("set-cookie")?.split(";")[0]};
 }
 try{
  let ready=false;for(let i=0;i<40;i++){try{if((await fetch(base+"/health")).ok){ready=true;break}}catch{}await sleep(250)}
  assert.ok(ready,"Backend failed "+logs);
  const registration=await api("/auth/register","POST",JSON.stringify({name:"CV Parse Test",email,password:"StrongTestPass1234"}),null,{"Content-Type":"application/json"});
  assert.equal(registration.status,201);const cookie=registration.cookie;
  for(const [name,blob,expectSkill]of [["skills.pdf",await pdfFixture(),"Power BI"],["skills.docx",await docxFixture(),"Tableau"]]){
   const up=await api("/cv","PUT",blob,cookie,{"Content-Type":"application/octet-stream","X-File-Name":name});
   assert.equal(up.status,200,JSON.stringify(up.data));
   const analyze=await api("/cv/analyze","POST",JSON.stringify({}),cookie,{"Content-Type":"application/json"});
   assert.equal(analyze.status,200,JSON.stringify(analyze.data));
   assert.ok(analyze.data.analysis.skills.includes(expectSkill),JSON.stringify(analyze.data.analysis));
   const stored=await api("/cv/analysis","GET",undefined,cookie);
   assert.equal(stored.status,200);
   assert.deepEqual(stored.data.analysis.skills,analyze.data.analysis.skills);
   assert.ok(!Object.hasOwn(stored.data.analysis,"rawText"));
  }
  const noLocalKey=await api("/jobs/recommendations?mode=city&city=Lahore&role=Data%20Analyst","GET",undefined,cookie);
  assert.equal(noLocalKey.status,200,JSON.stringify(noLocalKey.data));
  assert.equal(noLocalKey.data.providerAvailable,false);
  assert.deepEqual(noLocalKey.data.jobs,[]);
  const add=await api("/action-plans","POST",JSON.stringify({job:{title:"Data Analyst",link:"https://example.org/job123",location:"Lahore",company:"Example"},requiredSkills:["SQL","Excel","Python","Power BI"]}),cookie,{"Content-Type":"application/json"});
  assert.equal(add.status,201,JSON.stringify(add.data));
  const id=add.data.plan.id;
  const plans=await api("/action-plans","GET",undefined,cookie);
  assert.equal(plans.status,200);
  assert.ok(plans.data.plans.some(p=>String(p.id)===String(id)));
  assert.equal(plans.data.plans[0].currentGap.total,4);
  const profile=await api("/profile","PUT",JSON.stringify({degree:"BS",semester:"8",city:"Lahore",interest:"Data Analyst",skills:"SQL, Excel, Python"}),cookie,{"Content-Type":"application/json"});
  assert.equal(profile.status,200);
  const recheck=await api("/action-plans/"+id+"/recheck","POST",JSON.stringify({}),cookie,{"Content-Type":"application/json"});
  assert.equal(recheck.status,200,JSON.stringify(recheck.data));
  assert.equal(recheck.data.result.match.percentage,75);
 }finally{child.kill();await pool.query("DELETE FROM users WHERE email=$1",[email]).catch(()=>{});await pool.end()}
});
