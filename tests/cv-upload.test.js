"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {setTimeout:sleep}=require("node:timers/promises");
const {Pool}=require("pg");

test("CV is optional, can be uploaded later, replaced, downloaded and removed privately", {skip:!process.env.TEST_DATABASE_URL}, async()=>{
 const port=43000+Math.floor(Math.random()*9000);
 const base="http://127.0.0.1:"+port+"/api";
 const child=spawn(process.execPath,["server.js"],{cwd:require("node:path").join(__dirname,".."),env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,NODE_ENV:"test",PORT:String(port)},stdio:["ignore","pipe","pipe"]});
 let logs="";child.stdout.on("data",d=>logs+=String(d));child.stderr.on("data",d=>logs+=String(d));
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL});
 const stamp=Date.now()+"-"+Math.floor(Math.random()*100000);
 const email="cv-demo-"+stamp+"@example.test",otherEmail="cv-other-"+stamp+"@example.test";
 const pdf=Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
 const secondPdf=Buffer.from("%PDF-1.7\n2 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
 async function call(url,method="GET",cookie,body,headers={}){
  const r=await fetch(base+url,{method,headers:{...headers,...(cookie?{Cookie:cookie}:{})},body});
  let result; const type=r.headers.get("content-type")||"";
  if(type.includes("application/json"))result=await r.json();
  else result=Buffer.from(await r.arrayBuffer());
  return {status:r.status,data:result,headers:r.headers,cookie:r.headers.get("set-cookie")?.split(";")[0]};
 }
 try{
  let started=false;
  for(let i=0;i<40;i++){if(child.exitCode!==null)throw Error("Server exited: "+logs);try{if((await fetch(base+"/health")).ok){started=true;break}}catch{}await sleep(250)}
  assert.ok(started,logs);
  const ownerReg=await call("/auth/register","POST",null,JSON.stringify({name:"CV Demo",email,password:"LongSamplePassword123!"}),{"Content-Type":"application/json"});
  assert.equal(ownerReg.status,201);
  const owner=ownerReg.cookie;
  assert.ok(owner);
  assert.equal((await call("/cv","GET",owner)).data.cv,null);
  assert.equal((await call("/cv/download","GET",owner)).status,404);
  assert.equal((await call("/cv","GET")).status,401);
  assert.equal((await call("/cv","PUT",null,pdf,{"Content-Type":"application/octet-stream","X-File-Name":"resume.pdf"})).status,401);
  const bad=await call("/cv","PUT",owner,Buffer.from("not-a-pdf-content"),{"Content-Type":"application/octet-stream","X-File-Name":"resume.pdf"});
  assert.equal(bad.status,400);
  const upload=await call("/cv","PUT",owner,pdf,{"Content-Type":"application/octet-stream","X-File-Name":"resume.pdf","Origin":"http://127.0.0.1:"+port});
  assert.equal(upload.status,200,JSON.stringify(upload.data));
  assert.equal(upload.data.cv.file_name,"resume.pdf");
  assert.ok(!("file_data" in upload.data.cv));
  const status=await call("/cv","GET",owner);
  assert.equal(status.data.cv.file_name,"resume.pdf");
  assert.ok(!("file_data" in status.data.cv));
  const downloaded=await call("/cv/download","GET",owner);
  assert.equal(downloaded.status,200);
  assert.ok(downloaded.data.equals(pdf));
  assert.match(downloaded.headers.get("content-disposition"),/attachment/);
  const nonOwner=await call("/auth/register","POST",null,JSON.stringify({name:"Other Person",email:otherEmail,password:"LongSamplePassword123!"}),{"Content-Type":"application/json"});
  const second=nonOwner.cookie;
  assert.equal((await call("/cv","GET",second)).data.cv,null);
  assert.equal((await call("/cv/download","GET",second)).status,404);
  assert.equal((await call("/cv","DELETE",second)).status,404);
  const forged=await call("/cv","PUT",owner,pdf,{"Content-Type":"application/octet-stream","X-File-Name":"resume.pdf","Origin":"https://other-site.example"});
  assert.equal(forged.status,403);
  const replaced=await call("/cv","PUT",owner,secondPdf,{"Content-Type":"application/octet-stream","X-File-Name":"updated%20cv.pdf"});
  assert.equal(replaced.status,200);
  assert.equal(replaced.data.cv.file_name,"updated cv.pdf");
  assert.ok((await call("/cv/download","GET",owner)).data.equals(secondPdf));
  assert.equal((await call("/cv","DELETE",owner)).status,200);
  assert.equal((await call("/cv","GET",owner)).data.cv,null);
  assert.equal((await call("/cv","DELETE",owner)).status,404);
 }finally{
  child.kill();
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)",[email,otherEmail]).catch(()=>{});
  await pool.end();
 }
});
