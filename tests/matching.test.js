const {test}=require("node:test");
const assert=require("node:assert/strict");
const {computeMatch}=require("../server");
test("skill matching ignores case and spaces",()=>{
 const m=computeMatch("Python, Excel","python, SQL, excel");
 assert.deepEqual(m.matched,["python","excel"]);
 assert.deepEqual(m.missing,["SQL"]);
 assert.equal(m.percentage,67);
});
test("zero requirements never divide by zero",()=>{
 assert.equal(computeMatch("Python","").percentage,0);
});
