"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { setTimeout: sleep } = require("node:timers/promises");
const { Pool } = require("pg");
test("account, profile, matching, saved job, and session persistence", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = process.env.TEST_DATABASE_URL;
  const port = 40000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}/api`;
  const child = spawn(process.execPath, ["server.js"], { cwd: require("node:path").join(__dirname,".."), env: {...process.env,DATABASE_URL:url,NODE_ENV:"test",PORT:String(port)}, stdio:["ignore","pipe","pipe"] });
  let logs = "";
  for (const stream of [child.stdout,child.stderr]) stream.on("data",d=>{logs+=String(d)});
  const pool = new Pool({ connectionString:url });
  let cookie = "";
  async function call(endpoint,method="GET",data,customCookie=cookie) {
    const response=await fetch(base+endpoint,{method,headers:{ "Content-Type":"application/json", ...(customCookie?{Cookie:customCookie}:{})},body:data===undefined?undefined:JSON.stringify(data)});
    const json=await response.json();
    return {status:response.status,json,cookie:response.headers.get("set-cookie")?.split(";")[0]};
  }
  try {
    let live=false;
    for(let i=0;i<40;i++) {
      if(child.exitCode!==null)throw Error("Server exited: "+logs);
      try {const r=await fetch(base+"/health");if(r.ok){live=true;break}}catch{}
      await sleep(250);
    }
    assert.ok(live,"Server did not start: "+logs);
    const unique=Date.now()+"-"+Math.floor(Math.random()*100000);
    const email="ci-"+unique+"@example.test";
    const registered=await call("/auth/register","POST",{name:"Test Student",email,password:"MySecurePassword123!"});
    assert.equal(registered.status,201,JSON.stringify(registered.json));
    assert.ok(registered.cookie,"Missing authentication cookie");
    cookie=registered.cookie;
    const profile=await call("/profile","PUT",{degree:"BSc",semester:"4",city:"Lahore",interest:"Data Analytics",skills:"Python, Excel"});
    assert.equal(profile.status,200);
    const match=await call("/matches","POST",{jobLink:"https://example.org/internship",jobTitle:"Data Internship",jobLocation:"Lahore",requirements:"Python, Excel, SQL"});
    assert.equal(match.status,201);
    assert.equal(match.json.result.match.percentage,67);
    const matchId=Number(match.json.result.id);
    assert.ok(Number.isInteger(matchId));
    assert.equal((await call("/saved-jobs","POST",{matchId})).status,201);
    assert.equal((await call("/applications","POST",{matchId})).status,201);
    assert.equal((await call("/auth/logout","POST")).status,200);
    assert.equal((await call("/profile","GET",undefined,cookie)).status,401);
    const login=await call("/auth/login","POST",{email,password:"MySecurePassword123!"});
    assert.equal(login.status,200);
    cookie=login.cookie;
    assert.ok(cookie);
    const stored=await call("/profile");
    assert.equal(stored.json.profile.degree,"BSc");
    assert.equal((await call("/saved-jobs")).json.jobs.length,1);
    assert.equal((await call("/applications")).json.applications.length,1);
    const second=await call("/auth/register","POST",{name:"Other Student",email:"ci-other-"+unique+"@example.test",password:"MySecurePassword123!"});
    assert.equal(second.status,201);
    const otherProfile=await call("/profile","GET",undefined,second.cookie);
    assert.equal(otherProfile.json.profile,null,"Users should not see each other's profiles");
    const inaccessible=await call("/saved-jobs","POST",{matchId},second.cookie);
    assert.equal(inaccessible.status,404,"Users cannot save another user's matched job");
  } finally {
    child.kill();
    await pool.query("DELETE FROM users WHERE email LIKE $1",["ci-%@example.test"]).catch(()=>{});
    await pool.end();
  }
});
