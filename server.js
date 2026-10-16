"use strict";
const express = require("express");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const {parseCVText,skillsFromCsv,skillGap,learningFor}=require("./career-engine");
const {retrieveJobs,recommendJobs,safeUrl}=require("./jobs-provider");
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({limit:"32kb"}));
const pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:true}:undefined});
const SESSION_AGE=1000*60*60*24*7;
const apiLimit=rateLimit({windowMs:15*60*1000,limit:150,standardHeaders:"draft-7",legacyHeaders:false});
const authLimit=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:"draft-7",legacyHeaders:false});
app.use("/api",apiLimit);
const handle=(fn)=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const valid=(x,min=1,max=150)=>typeof x==="string"&&x.trim().length>=min&&x.trim().length<=max;
const tokenHash=(s)=>crypto.createHash("sha256").update(s).digest("hex");
const cookie=(req,res,t)=>res.cookie("cb_session",t,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:SESSION_AGE,path:"/"});
const clearCookie=(res)=>res.clearCookie("cb_session",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/"});
const cookies=(req)=>Object.fromEntries((req.headers.cookie||"").split(";").map(v=>{const i=v.indexOf("=");return i<0?["",""]:[v.slice(0,i).trim(),v.slice(i+1).trim()]}));
async function requireUser(req,res,next){
 try{
  const token=cookies(req).cb_session;
  if(!token)return res.status(401).json({error:"Please sign in."});
  const {rows}=await pool.query("SELECT u.id,u.name,u.email,u.is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",[tokenHash(token)]);
  if(!rows.length)return res.status(401).json({error:"Session expired. Sign in again."});
  req.user=rows[0];next();
 }catch(e){next(e)}
}
const publicUser=({id,name,email,is_admin})=>({id,name,email,isAdmin:is_admin===true});
function requireAdmin(req,res,next){if(req.user?.is_admin!==true)return res.status(403).json({error:"Administrator access required."});next();}

async function newSession(req,res,user){
 const token=crypto.randomBytes(32).toString("hex");
 await pool.query("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')",[user.id,tokenHash(token)]);
 cookie(req,res,token);
}
app.get("/api/health",handle(async(req,res)=>{await pool.query("SELECT 1");res.json({status:"ok"})}));
app.post("/api/auth/register",authLimit,handle(async(req,res)=>{
 const name=String(req.body.name||"").trim(),email=String(req.body.email||"").trim().toLowerCase(),password=req.body.password;
 if(!valid(name,2,100)||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!valid(password,10,128))return res.status(400).json({error:"Enter a name, valid email and password of at least 10 characters."});
 const hash=await bcrypt.hash(password,12);
 try{const {rows}=await pool.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,is_admin",[name,email,hash]);await newSession(req,res,rows[0]);res.status(201).json({user:publicUser(rows[0])});}
 catch(e){if(e.code==="23505")return res.status(409).json({error:"Email already registered."});throw e}
}));
app.post("/api/auth/login",authLimit,handle(async(req,res)=>{
 const email=String(req.body.email||"").trim().toLowerCase(),password=req.body.password;
 if(typeof password!=="string"||email.length>254)return res.status(400).json({error:"Invalid login details."});
 const {rows}=await pool.query("SELECT * FROM users WHERE email=$1",[email]);
 if(!rows.length||!(await bcrypt.compare(password,rows[0].password_hash)))return res.status(401).json({error:"Invalid email or password."});
 await newSession(req,res,rows[0]);res.json({user:publicUser(rows[0])});
}));
app.post("/api/auth/logout",handle(async(req,res)=>{
 const t=cookies(req).cb_session;if(t)await pool.query("DELETE FROM sessions WHERE token_hash=$1",[tokenHash(t)]);
 clearCookie(res);res.json({ok:true});
}));
app.get("/api/auth/me",requireUser,(req,res)=>res.json({user:publicUser(req.user)}));
app.get("/api/profile",requireUser,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT degree,semester,city,interest,skills FROM profiles WHERE user_id=$1",[req.user.id]);
 res.json({profile:rows[0]||null});
}));
app.put("/api/profile",requireUser,handle(async(req,res)=>{
 const {degree,semester,city,interest,skills}=req.body;
 if(![degree,semester,city,interest,skills].every(v=>valid(v,1,300)))return res.status(400).json({error:"Complete all profile fields (max 300 characters each)."});
 const {rows}=await pool.query(`INSERT INTO profiles(user_id,degree,semester,city,interest,skills) VALUES($1,$2,$3,$4,$5,$6)
 ON CONFLICT(user_id) DO UPDATE SET degree=EXCLUDED.degree,semester=EXCLUDED.semester,city=EXCLUDED.city,interest=EXCLUDED.interest,skills=EXCLUDED.skills,updated_at=NOW()
 RETURNING degree,semester,city,interest,skills`,[req.user.id,...[degree,semester,city,interest,skills].map(x=>x.trim())]);
 res.json({profile:rows[0]});
}));
const skills=(x)=>String(x||"").split(",").map(s=>s.trim()).filter(Boolean).slice(0,50);
function computeMatch(profileSkills,requirements){
 const have=new Set(skills(profileSkills).map(s=>s.toLowerCase()));
 const needed=[...new Map(skills(requirements).map(s=>[s.toLowerCase(),s])).values()];
 return {matched:needed.filter(s=>have.has(s.toLowerCase())),missing:needed.filter(s=>!have.has(s.toLowerCase())),total:needed.length,percentage:needed.length?Math.round(100*needed.filter(s=>have.has(s.toLowerCase())).length/needed.length):0};
}
app.post("/api/matches",requireUser,handle(async(req,res)=>{
 const {jobLink,jobTitle,jobLocation,requirements}=req.body;
 let url;try{url=new URL(jobLink)}catch{}
 if(!url||!["http:","https:"].includes(url.protocol)||![jobTitle,jobLocation,requirements].every(v=>valid(v,1,600))||jobLink.length>1500)return res.status(400).json({error:"Enter a valid HTTP(S) vacancy URL, title, location and required skills."});
 const p=await pool.query("SELECT skills FROM profiles WHERE user_id=$1",[req.user.id]);
 if(!p.rows.length)return res.status(400).json({error:"Save a student profile first."});
 const match=computeMatch(p.rows[0].skills,requirements);
 if(!match.total)return res.status(400).json({error:"Enter at least one required skill."});
 const job={link:url.toString(),title:jobTitle.trim(),location:jobLocation.trim(),requirements:skills(requirements)};
 const {rows}=await pool.query("INSERT INTO matches(user_id,job,match) VALUES($1,$2,$3) RETURNING id,job,match,created_at",[req.user.id,job,match]);
 res.status(201).json({result:rows[0]});
}));
app.get("/api/matches/latest",requireUser,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT id,job,match,created_at FROM matches WHERE user_id=$1 ORDER BY id DESC LIMIT 1",[req.user.id]);res.json({result:rows[0]||null});
}));
app.get("/api/saved-jobs",requireUser,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT id,job,created_at FROM saved_jobs WHERE user_id=$1 ORDER BY id DESC",[req.user.id]);res.json({jobs:rows});
}));
app.post("/api/saved-jobs",requireUser,handle(async(req,res)=>{
 const {matchId}=req.body;if(!Number.isInteger(matchId))return res.status(400).json({error:"Invalid match ID."});
 const found=await pool.query("SELECT job,match FROM matches WHERE id=$1 AND user_id=$2",[matchId,req.user.id]);
 if(!found.rows.length)return res.status(404).json({error:"Match not found."});
 const {rows}=await pool.query("INSERT INTO saved_jobs(user_id,job_link,job) VALUES($1,$2,$3) ON CONFLICT(user_id,job_link) DO UPDATE SET job=EXCLUDED.job RETURNING id,job,created_at",[req.user.id,found.rows[0].job.link,{...found.rows[0].job,match:found.rows[0].match.percentage}]);
 res.status(201).json({saved:rows[0]});
}));
// Ownership is checked in SQL; knowing a record ID never grants deletion rights.
const parseRecordId=(raw)=>/^[1-9][0-9]{0,17}$/.test(raw||"")?raw:null;
app.delete("/api/saved-jobs/:id",requireUser,handle(async(req,res)=>{
 const id=parseRecordId(req.params.id);
 if(!id)return res.status(400).json({error:"Invalid saved job ID."});
 const {rows}=await pool.query("DELETE FROM saved_jobs WHERE id=$1 AND user_id=$2 RETURNING id",[id,req.user.id]);
 if(!rows.length)return res.status(404).json({error:"Saved job not found."});
 res.set("Cache-Control","no-store").json({deleted:true,id:rows[0].id});
}));
app.delete("/api/applications/:id",requireUser,handle(async(req,res)=>{
 const id=parseRecordId(req.params.id);
 if(!id)return res.status(400).json({error:"Invalid application ID."});
 const {rows}=await pool.query("DELETE FROM applications WHERE id=$1 AND user_id=$2 RETURNING id",[id,req.user.id]);
 if(!rows.length)return res.status(404).json({error:"Tracked application not found."});
 res.set("Cache-Control","no-store").json({deleted:true,id:rows[0].id});
}));
app.get("/api/applications",requireUser,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT id,job,status,updated_at FROM applications WHERE user_id=$1 ORDER BY updated_at DESC",[req.user.id]);res.json({applications:rows});
}));
app.post("/api/applications",requireUser,handle(async(req,res)=>{
 const {matchId}=req.body;if(!Number.isInteger(matchId))return res.status(400).json({error:"Invalid match ID."});
 const found=await pool.query("SELECT job FROM matches WHERE id=$1 AND user_id=$2",[matchId,req.user.id]);
 if(!found.rows.length)return res.status(404).json({error:"Match not found."});
 const job=found.rows[0].job;
 const {rows}=await pool.query("INSERT INTO applications(user_id,job_link,job,status) VALUES($1,$2,$3,'Application tracked') ON CONFLICT(user_id,job_link) DO UPDATE SET job=EXCLUDED.job,status='Application tracked',updated_at=NOW() RETURNING id,job,status,updated_at",[req.user.id,job.link,job]);
 res.status(201).json({application:rows[0]});
}));
// CVs belong to the signed-in user only. No public file URL is exposed.
const CV_LIMIT=3*1024*1024;
const cvMime={".pdf":"application/pdf",".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"};
function cvName(header){
 if(typeof header!=="string"||header.length>500)return null;
 let name;try{name=decodeURIComponent(header)}catch{return null}
 if(!name||name.length>100||name.includes("/")||name.includes("\\"))return null;
 if(!/^[a-zA-Z0-9 _().-]+$/.test(name))return null;
 return name;
}
function cvValid(data,extension){
 if(!Buffer.isBuffer(data)||data.length<15||data.length>CV_LIMIT)return false;
 if(extension===".pdf")return data.subarray(0,5).toString("ascii")==="%PDF-"&&data.subarray(-1024).includes(Buffer.from("%%EOF"));
 if(extension===".docx")return data.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))
  &&data.includes(Buffer.from("[Content_Types].xml"))&&data.includes(Buffer.from("word/document.xml"))
  &&!data.includes(Buffer.from("vbaProject.bin"));
 return false;
}
function cvOrigin(req,res,next){
 const origin=req.get("origin");
 if(origin&&origin!==req.protocol+"://"+req.get("host"))return res.status(403).json({error:"Request origin not allowed."});
 next();
}
app.get("/api/cv",requireUser,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT file_name,size_bytes,uploaded_at FROM cv_files WHERE user_id=$1",[req.user.id]);
 res.set("Cache-Control","no-store").json({cv:rows[0]||null});
}));
app.put("/api/cv",requireUser,cvOrigin,express.raw({type:"application/octet-stream",limit:CV_LIMIT}),handle(async(req,res)=>{
 const name=cvName(req.get("x-file-name"));
 const ext=name?path.extname(name).toLowerCase():"";
 if(!name||!cvMime[ext])return res.status(400).json({error:"Upload a PDF or DOCX file with a simple filename."});
 if(!cvValid(req.body,ext))return res.status(400).json({error:"Invalid PDF/DOCX content or file larger than 3 MB."});
 const {rows}=await pool.query(`INSERT INTO cv_files(user_id,file_name,mime_type,size_bytes,file_data)
 VALUES($1,$2,$3,$4,$5)
 ON CONFLICT(user_id) DO UPDATE SET file_name=EXCLUDED.file_name,mime_type=EXCLUDED.mime_type,size_bytes=EXCLUDED.size_bytes,file_data=EXCLUDED.file_data,uploaded_at=NOW()
 RETURNING file_name,size_bytes,uploaded_at`,[req.user.id,name,cvMime[ext],req.body.length,req.body]);
 await pool.query("DELETE FROM cv_analysis WHERE user_id=$1",[req.user.id]);
 res.set("Cache-Control","no-store").json({cv:rows[0]});
}));
app.get("/api/cv/download",requireUser,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT file_name,mime_type,file_data FROM cv_files WHERE user_id=$1",[req.user.id]);
 if(!rows.length)return res.status(404).json({error:"You have not uploaded a CV."});
 const cv=rows[0];
 const safe=cv.file_name.replace(/[^a-zA-Z0-9 _().-]/g,"_").replace(/["\\]/g,"_");
 res.set("Content-Type",cv.mime_type);
 res.set("Content-Disposition",'attachment; filename="'+safe+'"');
 res.set("Cache-Control","private, no-store");
 res.set("X-Content-Type-Options","nosniff");
 res.send(cv.file_data);
}));
app.delete("/api/cv",requireUser,cvOrigin,handle(async(req,res)=>{
 const {rows}=await pool.query("DELETE FROM cv_files WHERE user_id=$1 RETURNING user_id",[req.user.id]);
 if(!rows.length)return res.status(404).json({error:"No CV found for this account."});
 await pool.query("DELETE FROM cv_analysis WHERE user_id=$1",[req.user.id]);
 res.set("Cache-Control","no-store").json({deleted:true});
}));
// User consent required: reading the uploaded CV is an explicit request.
const cvAnalyzeLimit=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:"draft-7",legacyHeaders:false});
async function extractCVContents(file){
 if(file.mime_type==="application/pdf"){
  const parser=require("pdf-parse");
  const result=await parser(file.file_data,{max:25});
  return String(result.text||"");
 }
 if(file.mime_type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"){
  const mammoth=require("mammoth");
  const parsed=await mammoth.extractRawText({buffer:file.file_data});
  return String(parsed.value||"");
 }
 throw new Error("Unsupported CV type");
}
app.get("/api/cv/analysis",requireUser,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT a.result,a.analyzed_at FROM cv_analysis a JOIN cv_files f ON f.user_id=a.user_id AND f.uploaded_at=a.cv_uploaded_at WHERE a.user_id=$1",[req.user.id]);
 res.set("Cache-Control","no-store").json({analysis:rows[0]?.result||null,analyzedAt:rows[0]?.analyzed_at||null});
}));
app.post("/api/cv/analyze",requireUser,cvOrigin,cvAnalyzeLimit,handle(async(req,res)=>{
 const {rows}=await pool.query("SELECT file_data,mime_type,uploaded_at FROM cv_files WHERE user_id=$1",[req.user.id]);
 if(!rows.length)return res.status(404).json({error:"Upload a CV in Student Profile first."});
 let parsedText;
 try{parsedText=await extractCVContents(rows[0])}catch(err){
  console.error("CV parsing error:",err.name);
  return res.status(422).json({error:"Could not read this CV. Use a text-based PDF or DOCX (scanned images are not supported)."});
 }
 const analysis=parseCVText(parsedText);
 if(analysis.extractedCharacters<30)return res.status(422).json({error:"The CV has insufficient extractable text. Try a text-based PDF or DOCX."});
 const {rows:stored}=await pool.query(`INSERT INTO cv_analysis(user_id,cv_uploaded_at,result)
 VALUES($1,$2,$3::jsonb) ON CONFLICT(user_id) DO UPDATE
 SET cv_uploaded_at=EXCLUDED.cv_uploaded_at,result=EXCLUDED.result,analyzed_at=NOW()
 RETURNING result`,[req.user.id,rows[0].uploaded_at,JSON.stringify(analysis)]);
 res.set("Cache-Control","no-store").json({analysis:stored[0].result});
}));
app.get("/api/jobs/recommendations",requireUser,handle(async(req,res)=>{
 const mode=String(req.query.mode||"city");
 if(!["city","pakistan","remote"].includes(mode))return res.status(400).json({error:"Select My City, Anywhere in Pakistan or Worldwide Remote."});
 const city=String(req.query.city||"").trim().slice(0,90);
 if(mode==="city"&&!/^[a-zA-Z .'-]{2,90}$/.test(city))return res.status(400).json({error:"Enter your city in Pakistan."});
 const roleInput=String(req.query.role||"").trim();
 if(roleInput.length>85)return res.status(400).json({error:"Role search is too long."});
 const [{rows:p},{rows:a}]=await Promise.all([
  pool.query("SELECT interest,skills,city FROM profiles WHERE user_id=$1",[req.user.id]),
  pool.query("SELECT a.result FROM cv_analysis a JOIN cv_files f ON f.user_id=a.user_id AND f.uploaded_at=a.cv_uploaded_at WHERE a.user_id=$1",[req.user.id])
 ]);
 const role=roleInput||String(p[0]?.interest||"").trim();
 if(role.length<3)return res.status(400).json({error:"Add a career interest to your student profile or type a job title."});
 const skills=[...new Set([...skillsFromCsv(p[0]?.skills),...(Array.isArray(a[0]?.result?.skills)?a[0].result.skills:[])])];
 try{
  const raw=await retrieveJobs({role,mode,city});
  res.set("Cache-Control","private, no-store").json({jobs:recommendJobs(raw.jobs,{skills,role}),providerAvailable:raw.available,notice:raw.notice,search:{role,mode,city:mode==="city"?city:null},profileSource:a.length?"Saved profile + analyzed CV":"Saved profile (CV not analyzed)"});
 }catch(e){
  console.error("Job search provider issue:",e.message);
  res.status(502).json({error:"Live job provider temporarily unavailable. Please try again later.",jobs:[]});
 }
}));
app.get("/api/learning-resources",requireUser,handle(async(req,res)=>{
 const requested=String(req.query.skills||"").slice(0,300);
 const selected=skillsFromCsv(requested).slice(0,8);
 res.set("Cache-Control","no-store").json({learning:selected.map(learningFor)});
}));
app.get("/api/action-plans",requireUser,handle(async(req,res)=>{
 const [stored,profiles]=await Promise.all([
 pool.query("SELECT id,job,required_skills,completed_skills,created_at,updated_at FROM action_plans WHERE user_id=$1 ORDER BY id DESC LIMIT 25",[req.user.id]),
 pool.query("SELECT skills FROM profiles WHERE user_id=$1",[req.user.id])
 ]);
 const skills=profiles.rows[0]?.skills||"";
 res.set("Cache-Control","no-store").json({plans:stored.rows.map(x=>({
  ...x,currentGap:skillGap(skills,x.required_skills.join(",")),
  learning:x.required_skills.slice(0,20).map(learningFor)
 }))});
}));
app.post("/api/action-plans",requireUser,cvOrigin,handle(async(req,res)=>{
 const {job,requiredSkills}=req.body||{};
 if(!job||typeof job!=="object"||!safeUrl(job.link)||!valid(job.title,2,180)||!valid(job.location||"Pakistan",1,140))
   return res.status(400).json({error:"Choose a valid job listing."});
 if(!Array.isArray(requiredSkills))return res.status(400).json({error:"Skill requirements must be an array."});
 const needed=skillsFromCsv(requiredSkills.join(",")).slice(0,20);
 if(needed.some(x=>x.length>80))return res.status(400).json({error:"Invalid skill entry."});
 if(!needed.length)return res.status(400).json({error:"No skills were detectable from this listing. Enter requirements manually in the existing eligibility checker."});
 const payload={title:job.title.trim(),link:safeUrl(job.link),location:job.location||"Pakistan",company:String(job.company||"").slice(0,120),source:String(job.source||"").slice(0,60)};
 const {rows}=await pool.query("INSERT INTO action_plans(user_id,job,required_skills) VALUES($1,$2::jsonb,$3::jsonb) RETURNING id,job,required_skills,completed_skills,created_at",[req.user.id,JSON.stringify(payload),JSON.stringify(needed)]);
 res.status(201).json({plan:rows[0],learning:needed.map(learningFor)});
}));
app.put("/api/action-plans/:id/progress",requireUser,cvOrigin,handle(async(req,res)=>{
 const id=parseRecordId(req.params.id),completed=req.body?.completedSkills;
 if(!id||!Array.isArray(completed))return res.status(400).json({error:"Invalid progress update."});
 const {rows:existing}=await pool.query("SELECT required_skills FROM action_plans WHERE id=$1 AND user_id=$2",[id,req.user.id]);
 if(!existing.length)return res.status(404).json({error:"Action plan not found."});
 const allowed=new Set(existing[0].required_skills.map(x=>x.toLowerCase()));
 const checked=skillsFromCsv(completed.join(",")).filter(x=>allowed.has(x.toLowerCase())).slice(0,20);
 const {rows}=await pool.query("UPDATE action_plans SET completed_skills=$1::jsonb,updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING id,completed_skills",[JSON.stringify(checked),id,req.user.id]);
 res.json({progress:rows[0]});
}));
app.post("/api/action-plans/:id/recheck",requireUser,cvOrigin,handle(async(req,res)=>{
 const id=parseRecordId(req.params.id);
 if(!id)return res.status(400).json({error:"Invalid action plan."});
 const [{rows:plans},{rows:profiles}]=await Promise.all([
  pool.query("SELECT job,required_skills FROM action_plans WHERE id=$1 AND user_id=$2",[id,req.user.id]),
  pool.query("SELECT skills FROM profiles WHERE user_id=$1",[req.user.id])
 ]);
 if(!plans.length)return res.status(404).json({error:"Action plan not found."});
 if(!profiles.length)return res.status(400).json({error:"Update your student profile skills first."});
 const plan=plans[0];
 const match=skillGap(profiles[0].skills,plan.required_skills.join(","));
 const {rows}=await pool.query("INSERT INTO matches(user_id,job,match) VALUES($1,$2::jsonb,$3::jsonb) RETURNING id,job,match,created_at",[req.user.id,JSON.stringify({...plan.job,requirements:plan.required_skills}),JSON.stringify(match)]);
 res.set("Cache-Control","no-store").json({result:rows[0],learning:match.missing.map(learningFor)});
}));
app.get("/api/admin/overview",requireUser,requireAdmin,handle(async(req,res)=>{
 const [counts,users,profiles,matches,saved,applications]=await Promise.all([
 pool.query("SELECT (SELECT count(*) FROM users)::int AS users,(SELECT count(*) FROM profiles)::int AS profiles,(SELECT count(*) FROM matches)::int AS matches,(SELECT count(*) FROM saved_jobs)::int AS saved_jobs,(SELECT count(*) FROM applications)::int AS applications"),
 pool.query("SELECT id,name,email,created_at FROM users ORDER BY id DESC LIMIT 50"),
 pool.query("SELECT p.user_id,u.name,p.degree,p.semester,p.city,p.interest,p.skills,p.updated_at FROM profiles p JOIN users u ON p.user_id=u.id ORDER BY p.updated_at DESC LIMIT 50"),
 pool.query("SELECT m.id,u.name,m.job,m.match,m.created_at FROM matches m JOIN users u ON m.user_id=u.id ORDER BY m.id DESC LIMIT 50"),
 pool.query("SELECT s.id,u.name,s.job,s.created_at FROM saved_jobs s JOIN users u ON s.user_id=u.id ORDER BY s.id DESC LIMIT 50"),
 pool.query("SELECT a.id,u.name,a.job,a.status,a.updated_at FROM applications a JOIN users u ON a.user_id=u.id ORDER BY a.updated_at DESC LIMIT 50")
 ]);
 res.set("Cache-Control","no-store");
 res.json({counts:counts.rows[0],users:users.rows,profiles:profiles.rows,matches:matches.rows,savedJobs:saved.rows,applications:applications.rows,limit:50});
}));
app.use("/api",(req,res)=>res.status(404).json({error:"API endpoint not found."}));
app.use((req,res,next)=>{const basename=path.posix.basename(req.path);if(/\.(?:js|json|sql|ya?ml|md|env|lock)$/i.test(req.path)&&!["app.js","admin.js","dashboard.js","cv.js","career.js","learning.js"].includes(basename))return res.status(404).send("Not found");next()});
app.use(express.static(path.join(__dirname),{index:"index.html",extensions:["html"],dotfiles:"deny",setHeaders(res,p){if(p.endsWith(".html"))res.setHeader("Cache-Control","no-store")}}));
app.use((err,req,res,next)=>{if(err.type==="entity.too.large")return res.status(413).json({error:"File is too large. Maximum 3 MB."});console.error(err);res.status(500).json({error:"Server error. Please try again."})});
const port=Number(process.env.PORT)||3000;
if(require.main===module){if(!process.env.DATABASE_URL){console.error("DATABASE_URL is required");process.exit(1)}app.listen(port,"0.0.0.0",()=>console.log("CareerBridge running on "+port))}
module.exports={app,computeMatch};
