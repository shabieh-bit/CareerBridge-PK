"use strict";
const cvFile=document.getElementById("cv-file");
const cvUpload=document.getElementById("cv-upload-btn");
const cvRemove=document.getElementById("cv-remove-btn");
const cvDownload=document.getElementById("cv-download-link");
const cvCurrent=document.getElementById("cv-current");
const cvFeedback=document.getElementById("cv-feedback");
const MAX_CV_BYTES=3*1024*1024;

function cvFeedbackMessage(value){cvFeedback.textContent=value;}
function cvBusy(state){cvUpload.disabled=state;cvRemove.disabled=state;if(state)cvFeedbackMessage("Please wait…");}
function updateCV(meta){
 if(meta){
  const kb=Math.ceil(meta.size_bytes/1024);
  cvCurrent.textContent="Uploaded: "+meta.file_name+" ("+kb+" KB). Uploaded on "+new Date(meta.uploaded_at).toLocaleDateString()+".";
  cvDownload.hidden=false;
  cvRemove.hidden=false;
  cvUpload.textContent="Replace my CV";
 }else{
  cvCurrent.textContent="No CV uploaded yet. You can add it now or whenever you return to this page.";
  cvDownload.hidden=true;
  cvRemove.hidden=true;
  cvUpload.textContent="Upload my CV";
 }
}
async function cvRequest(path,options={}){
 const response=await fetch("/api"+path,{credentials:"same-origin",cache:"no-store",...options});
 if(!response.ok){
  const data=await response.json().catch(()=>({}));
  const error=new Error(data.error||"The CV request could not be completed.");
  error.status=response.status;throw error;
 }
 return response.json();
}
async function loadCV(){
 try{
  const data=await cvRequest("/cv");
  updateCV(data.cv);
 }catch(error){
  if(error.status===401){cvCurrent.textContent="Please sign in to manage your CV.";return}
  cvCurrent.textContent="Unable to load your CV status right now. Please refresh.";
 }
}
cvUpload.addEventListener("click",async()=>{
 const file=cvFile.files?.[0];
 if(!file){cvFeedbackMessage("Please choose a PDF or DOCX file first.");return}
 const filename=file.name;
 if(!/\.(pdf|docx)$/i.test(filename)){cvFeedbackMessage("Only PDF and DOCX CV files are accepted.");return}
 if(file.size===0||file.size>MAX_CV_BYTES){cvFeedbackMessage("CV must be smaller than or equal to 3 MB.");return}
 cvBusy(true);
 try{
  const result=await cvRequest("/cv",{method:"PUT",headers:{"Content-Type":"application/octet-stream","X-File-Name":encodeURIComponent(filename)},body:file});
  updateCV(result.cv);cvFile.value="";
  cvFeedbackMessage("CV saved successfully. You can download, replace or remove it whenever you return.");
 }catch(error){cvFeedbackMessage(error.message)}
 finally{cvBusy(false)}
});
cvRemove.addEventListener("click",async()=>{
 if(!window.confirm("Permanently remove the CV from your CareerBridge account? This cannot be undone."))return;
 cvBusy(true);
 try{
  await cvRequest("/cv",{method:"DELETE"});
  cvFile.value="";updateCV(null);
  cvFeedbackMessage("Your CV has been removed from CareerBridge.");
 }catch(error){cvFeedbackMessage(error.message)}
 finally{cvBusy(false)}
});
loadCV();
