"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const {setTimeout:sleep}=require("node:timers/promises");
test("owners can delete saved jobs and tracked applications; other users cannot",{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const port=42000+Math.floor(Math.random()*10000);
 const child=spawn(process.execPath,["server.js"],{cwd:require("node:path").join(__dirname,".."),env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,NODE_ENV:"test",PORT:String(port)},stdio:["ignore","pipe","pipe"]});
 let logs="";child.stdout.on("data",d=>logs+=String(d));child.stderr.on("data",d=>logs+=String(d));
 const base="http://127.0.0.1:"+port+"/api";
 async function request(path,method="GET",body,cookie){
  const r=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,json:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]};
 }
 try{
  let ready=false;for(let i=0;i<40;i++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(base+"/health")).ok){ready=true;break}}catch{}await sleep(250)}
  assert.ok(ready,"Backend did not become healthy: "+logs);
  const unique=Date.now()+"-"+Math.floor(Math.random()*1e7);
  const account=await request("/auth/register","POST",{name:"Owner Test",email:"remove-owner-"+unique+"@example.test",password:"ExamplePassword-Long123!"});
  assert.equal(account.status,201);
  const owner=account.cookie;
  assert.ok(owner);
  assert.equal((await request("/profile","PUT",{degree:"BSc",semester:"4",city:"Lahore",interest:"Software",skills:"JavaScript, SQL"},owner)).status,200);
  const match=await request("/matches","POST",{jobLink:"https://example.org/jobs/demo",jobTitle:"Demo Internship",jobLocation:"Lahore",requirements:"SQL, Excel"},owner);
  assert.equal(match.status,201);
  const matchId=Number(match.json.result.id);
  const saved=await request("/saved-jobs","POST",{matchId},owner);
  const tracked=await request("/applications","POST",{matchId},owner);
  assert.equal(saved.status,201);
  assert.equal(tracked.status,201);
  const sid=String(saved.json.saved.id),aid=String(tracked.json.application.id);
  const other=await request("/auth/register","POST",{name:"Other Student",email:"remove-other-"+unique+"@example.test",password:"ExamplePassword-Long123!"});
  assert.equal(other.status,201);
  const second=other.cookie;
  assert.equal((await request("/saved-jobs/"+sid,"DELETE",undefined,second)).status,404);
  assert.equal((await request("/applications/"+aid,"DELETE",undefined,second)).status,404);
  assert.equal((await request("/saved-jobs/"+sid,"DELETE")).status,401);
  assert.equal((await request("/saved-jobs/bad-id","DELETE",undefined,owner)).status,400);
  assert.equal((await request("/saved-jobs", "GET",undefined,owner)).json.jobs.length,1);
  assert.equal((await request("/applications","GET",undefined,owner)).json.applications.length,1);
  assert.equal((await request("/saved-jobs/"+sid,"DELETE",undefined,owner)).status,200);
  assert.equal((await request("/applications/"+aid,"DELETE",undefined,owner)).status,200);
  assert.equal((await request("/saved-jobs/"+sid,"DELETE",undefined,owner)).status,404);
  assert.equal((await request("/applications/"+aid,"DELETE",undefined,owner)).status,404);
  assert.equal((await request("/saved-jobs","GET",undefined,owner)).json.jobs.length,0);
  assert.equal((await request("/applications","GET",undefined,owner)).json.applications.length,0);
  assert.equal((await request("/profile","GET",undefined,owner)).json.profile.degree,"BSc");
  assert.ok((await request("/matches/latest","GET",undefined,owner)).json.result);
 }finally{child.kill()}
});
