"use strict";
const express = require("express");
const path = require("node:path");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
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
  const {rows}=await pool.query("SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()",[tokenHash(token)]);
  if(!rows.length)return res.status(401).json({error:"Session expired. Sign in again."});
  req.user=rows[0];next();
 }catch(e){next(e)}
}
const publicUser=({id,name,email})=>({id,name,email});
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
 try{const {rows}=await pool.query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email",[name,email,hash]);await newSession(req,res,rows[0]);res.status(201).json({user:publicUser(rows[0])});}
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
app.use("/api",(req,res)=>res.status(404).json({error:"API endpoint not found."}));
app.use(express.static(path.join(__dirname),{index:"index.html",extensions:["html"],dotfiles:"deny",setHeaders(res,p){if(p.endsWith(".html"))res.setHeader("Cache-Control","no-store")}}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:"Server error. Please try again."})});
const port=Number(process.env.PORT)||3000;
if(require.main===module){if(!process.env.DATABASE_URL){console.error("DATABASE_URL is required");process.exit(1)}app.listen(port,"0.0.0.0",()=>console.log("CareerBridge running on "+port))}
module.exports={app,computeMatch};
