const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("phase 1 dashboard references real API and its script",()=>{
 const html=read("dashboard.html"),js=read("dashboard.js");
 assert.match(html,/src="dashboard.js"/);
 assert.match(html,/id="dashboard-content"/);
 assert.match(js,/\/api/);
 for(const route of ["/profile","/matches/latest","/saved-jobs","/applications"])assert.ok(js.includes(route));
});
test("match result clearly labels a skills comparison",()=>{
 const page=read("match-result.html");
 assert.match(page,/skill match/i);
 assert.match(page,/not a formal employment eligibility decision/i);
 assert.doesNotMatch(page,/% eligible/);
});
test("public server serves dashboard asset and protects private code",()=>{
 const code=read("server.js");
 assert.ok(code.includes('"dashboard.js"'));
 assert.ok(code.includes('requireAdmin'));
 assert.ok(code.includes('/api/admin/overview'));
});
test("homepage and auth include a working student entry path",()=>{
 assert.match(read("index.html"),/href="student-profile.html"/);
 assert.match(read("auth.html"),/id="auth-form"/);
 assert.match(read("style.css"),/dashboard-metrics/);
});
