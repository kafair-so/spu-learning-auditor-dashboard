from pathlib import Path
import json

build = Path("build/dashboard-0.13.38")
def replace_once(text, old, new, label):
    assert text.count(old)==1, f"{label}: expected one anchor, found {text.count(old)}"
    return text.replace(old,new,1)
p=build/"background.js"
s=p.read_text(encoding="utf-8")
s=replace_once(s,'async function auditCourse(payload) {','async function auditCourse(payload) {\n  const legacyEvidenceRetry = payload.courseType === "GR" && payload.criteriaMode === "legacy_12569" && payload.semesterCode === "1/2569";','GR scope')
s=replace_once(s,'if (mediaInFlight.has(key)) return mediaInFlight.get(key);\n    const providerKey = microsoftProviderKey(targetUrl);','if (mediaInFlight.has(key)) return mediaInFlight.get(key);\n    // File-specific permissions; no tenant-wide negative reuse for GR video.\n    const providerKey = legacyEvidenceRetry ? null : microsoftProviderKey(targetUrl);','provider isolation')
s=replace_once(s,'const attemptWindowMs = cloudVideoProvider ? 150000 : 90000;\n      const recoveryState = {refreshes:0};','const attemptWindowMs = cloudVideoProvider ? 150000 : 90000;\n      const recoveryState = {refreshes:0,legacyEvidenceRetry};','retry scope')
s=replace_once(s,'const conclusive = () => result.durationSeconds || ["access_denied", "login_required", "link_unavailable", "play_required", "cloud_folder", "link_error"].includes(result.mediaStatus);','const conclusive = () => result.durationSeconds || (result.mediaStatus === "play_required" && !legacyEvidenceRetry) || ["access_denied", "login_required", "link_unavailable", "cloud_folder", "link_error"].includes(result.mediaStatus);','retry play_required')
s=replace_once(s,'if (tabIsOneDrive && !last.durationSeconds && Date.now() < deadline) {','if (tabIsOneDrive && recoveryState.legacyEvidenceRetry && last.durationSeconds && !["sharepoint-player-clock","sharepoint-accessible-duration","onedrive-metadata"].includes(last.source)) {\n        last = {...last,unconfirmedDurationSeconds:last.durationSeconds,durationSeconds:null};\n      }\n      if (tabIsOneDrive && !last.durationSeconds && Date.now() < deadline) {','provisional duration')
s=replace_once(s,'for (let poll = 0; poll < 18 && Date.now() < deadline; poll += 1) {','for (let poll = 0; poll < (recoveryState.legacyEvidenceRetry ? 24 : 18) && Date.now() < deadline; poll += 1) {','bounded foreground retries')
s=replace_once(s,'if (!latest?.durationSeconds) latest = await probeMedia(tabId, poll > 1);\n      if (latest.adShowing)','if (!latest?.durationSeconds) latest = await probeMedia(tabId, poll > 1).catch(() => null);\n      latest ||= {};\n      if (latest.adShowing)','foreground transient probe')
s=replace_once(s,'const instructor = scan.emptyCourse ? {evidence:scan.instructorEvidence || null,status:"not_needed",elapsedMs:0} : await scanDeferredInstructorEvidence(tab.id, courseUrl, runId, scan.instructorEvidence, course.instructors || "");','const grContext = course.courseType === "GR" && course.criteriaMode === "legacy_12569" && course.semesterCode === "1/2569";\n    const instructor = scan.emptyCourse ? {evidence:scan.instructorEvidence || null,status:"not_needed",elapsedMs:0} : grContext ? await scanGrInstructorContext(tab.id, courseUrl, runId, scan.instructorEvidence, course.instructors || "") : await scanDeferredInstructorEvidence(tab.id, courseUrl, runId, scan.instructorEvidence, course.instructors || "");','instructor scanner selection')
s=replace_once(s,'ocrEvidenceStatus:ocr.status,','instructorEvidenceStatus:instructor.status,\n        ocrEvidenceStatus:ocr.status,','instructor read status')
s=replace_once(s,'async function scanDeferredInstructorEvidence(tabId, courseUrl, runId, baseEvidence, expectedInstructor = "") {','''async function scanGrInstructorContext(tabId, courseUrl, runId, baseEvidence, expectedInstructor = "") {
  const startedAt=Date.now();
  await throwIfCancelled(runId);
  await chrome.storage.local.set({auditProgress:{current:0,total:0,label:"ตรวจหลักฐานผู้สอนเฉพาะบริบท: "+courseUrl,updatedAt:Date.now()}});
  const response=await Promise.race([chrome.tabs.sendMessage(tabId,{type:"SCAN_GR_INSTRUCTOR_CONTEXT",expectedInstructor}).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve(null),38000))]);
  if(response?.ok&&response.instructorEvidence){
    return {evidence:response.instructorEvidence,status:response.instructorEvidence.targetedOcrStatus==="timeout"?"context_ocr_timeout":"context_complete",elapsedMs:Date.now()-startedAt};
  }
  // A missing response is a technical uncertainty, not verified absence.
  // Keep genuine source candidates for the reviewer but never auto-credit a
  // registrar name or weak old DOM evidence by itself.
  const e={...(baseEvidence||{}),names:baseEvidence?.names||[],contactChannels:baseEvidence?.contactChannels||[],identityComplete:false,contactComplete:false,hasInstructorPhoto:false,reviewStatus:"uncertain_evidence",scanMode:"context_unavailable",provenance:baseEvidence?.provenance||{uncertain:[{decisionReason:"context_scan_unavailable"}]}};
  return {evidence:e,status:"context_unavailable",elapsedMs:Date.now()-startedAt};
}

async function scanDeferredInstructorEvidence(tabId, courseUrl, runId, baseEvidence, expectedInstructor = "") {''','GR instructor entry')
# Keep no-evidence results distinct from reviewable contextual candidates. Legacy
# backend computes whether a genuine candidate could change the outcome.
s=replace_once(s,'const instructorResult = result(instructorEvidence?.identityComplete && instructorEvidence?.contactComplete ? "pass" : "needs_review", instructorDetail);','const grContextScan = courseType === "GR" && /^(?:dom_context|targeted_intro_ocr|context_unavailable)$/.test(instructorEvidence?.scanMode || "");\n  const instructorStatus = instructorEvidence?.identityComplete && instructorEvidence?.contactComplete ? "pass" : grContextScan && instructorEvidence?.reviewStatus === "incomplete_evidence" ? "fail" : "needs_review";\n  const instructorResult = result(instructorStatus, instructorDetail + (grContextScan && instructorEvidence?.reviewStatus === "uncertain_evidence" ? " · โปรดตรวจยืนยันรูป ชื่อ และช่องทางติดต่อจากส่วนแนะนำรายวิชาจริง" : ""));','instructor outcome')
p.write_text(s,encoding="utf-8")
p=build/"central-worker-contract.js"; s=p.read_text(encoding="utf-8")
s=replace_once(s,'courseProfile:profile,\n    claimedAt:', 'courseProfile:profile,\n    ...(courseType === "GR" && criteriaMode === "legacy_12569" && semesterCode === "1/2569" ? {instructors:[raw.instructors,raw.instructor_names,course.instructors,course.instructor_names].map(value=>Array.isArray(value)?value.map(text).filter(Boolean).join(", "):text(value)).find(Boolean)||""} : {}),\n    claimedAt:','expected instructor transport')
p.write_text(s,encoding="utf-8")
p=build/"dashboard-export.js";s=p.read_text(encoding="utf-8")
s=replace_once(s,'contactChannelCount:Number(report.instructorEvidence?.contactChannels?.length || 0)}','contactChannelCount:Number(report.instructorEvidence?.contactChannels?.length || 0),...(criteriaMode === "legacy_12569" && semesterCode === "1/2569" && report.courseType === "GR" ? {reviewStatus:report.instructorEvidence?.reviewStatus||"",scanMode:report.instructorEvidence?.scanMode||"",targetedOcrStatus:report.instructorEvidence?.targetedOcrStatus||"",provenance:report.instructorEvidence?.provenance||{}} : {})}','instructor provenance')
p.write_text(s,encoding="utf-8")
p=build/"manifest.json";d=json.loads(p.read_text(encoding="utf-8"));assert d["version"]=="0.13.37";d["version"]="0.13.38"
scripts=[x for x in d["content_scripts"] if "content.js" in x["js"]];assert len(scripts)==1
scripts[0]["js"].append("gr-instructor-context.js")
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
