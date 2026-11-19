export const CRITERIA_12569_MODE = "legacy_12569";
export const CRITERIA_12569_SEMESTER = "1/2569";
export const CRITERIA_12569_SCORE_MODEL = "legacy_course_type_v1";

const PASS = new Set(["pass", "pass_tolerance"]);
const pass = status => PASS.has(status) ? 1 : 0;
const possible = status => PASS.has(status) || status === "needs_review" ? 1 : 0;
const half = value => Math.round((Number(value) || 0) * 2) / 2;
const proportional = (rows, weight, value = pass) => rows.length ? half(rows.reduce((sum, status) => sum + value(status), 0) / rows.length * weight) : 0;
const session = (week, index) => Number(String(week?.section || "").match(/\d+/)?.[0]) || index + 1;

export function normalize12569Track(value) {
  return value === "practical" ? "practical" : "theory";
}

// Dashboard checklists contain Podcast and AI Tutor columns.  The 1/2569
// reduced rubric deliberately ignores both, and treats the first-session
// teaching plan as the same evidence as its teaching material.
export function criteria12569Weeks(weeks = []) {
  return (weeks || []).map((week, index) => {
    const items = week?.checklist || [];
    const first = session(week, index) === 1;
    return {
      ...week,
      checklist:first
        ? [items[0], items[1], items[2], items[2], items[3], items[5]]
        : [items[0], items[1], items[2], items[4], items[5], items[6]]
    };
  });
}

function structurePending(coverage = {}) {
  return coverage.reachedEnd === false
    || coverage.structurallyComplete === false
    || (coverage.topologyReviewRequired === true && coverage.legacyTopologyWarningOnly !== true)
    || (Number(coverage.unmappedNonForumActivityCount || 0) > 0 && coverage.legacyUnmappedWarningOnly !== true)
    || (coverage.legacyReviewScoped !== true && (Number(coverage.unresolvedClassificationCount || 0) > 0 || Number(coverage.unresolvedScoringEvidenceCount || 0) > 0));
}

function videoCoverage(weeks, track) {
  const requiredSessions = track === "practical" ? 7 : 15;
  const rows = Array.from({length:15}, (_, index) => {
    const item = weeks.find((week, weekIndex) => session(week, weekIndex) === index + 1);
    return item?.checklist?.[index === 0 ? 4 : 2]?.status || "fail";
  });
  const completeSessions = rows.reduce((sum, status) => sum + pass(status), 0);
  const reviewSessions = rows.filter(status => status === "needs_review").length;
  return {requiredSessions, completeSessions, reviewSessions};
}

function theoryScore(weeks, coverage) {
  const first = weeks.find((week, index) => session(week, index) === 1)?.checklist || [];
  const weekly = Array.from({length:14}, (_, index) => weeks.find((week, weekIndex) => session(week, weekIndex) === index + 2)?.checklist || []);
  const plan = [first[2]?.status, ...weekly.map(items => items[0]?.status)];
  const materials = [first[3]?.status, ...weekly.map(items => items[1]?.status)];
  const pre = weekly.map(items => items[3]?.status);
  const post = weekly.map(items => items[4]?.status);
  const activities = [first[5]?.status, ...weekly.map(items => items[5]?.status)];
  const video = videoCoverage(weeks, "theory");
  const instructor = Number.isFinite(Number(first[1]?.scoreValue)) ? Math.max(0, Math.min(5, Number(first[1].scoreValue))) : pass(first[1]?.status) * 5;
  const parts = {
    courseInformation:half(pass(first[0]?.status) * 5 + instructor),
    teachingPlan:half(plan.reduce((sum, status) => sum + pass(status), 0)),
    teachingMaterials:proportional(materials, 15),
    video:half(Math.min(1, video.completeSessions / 15) * 30),
    preTest:proportional(pre, 7.5),
    postTest:proportional(post, 7.5),
    assignment:half(activities.reduce((sum, status) => sum + pass(status), 0))
  };
  const totalRaw = half(Object.values(parts).reduce((sum, value) => sum + value, 0));
  const total = totalRaw === 79.5 ? 80 : totalRaw;
  const potentialInstructor = first[1]?.status === "needs_review" ? 5 : instructor;
  const potential = half(
    (possible(first[0]?.status) ? 5 : 0) + potentialInstructor
    + plan.reduce((sum, status) => sum + possible(status), 0)
    + proportional(materials, 15, possible)
    + Math.min(1, (video.completeSessions + video.reviewSessions) / 15) * 30
    + proportional(pre, 7.5, possible)
    + proportional(post, 7.5, possible)
    + activities.reduce((sum, status) => sum + possible(status), 0)
  );
  const pending = structurePending(coverage) || [first[0]?.status, first[1]?.status, ...plan, ...materials, ...pre, ...post, ...activities].includes("needs_review") || video.reviewSessions > 0;
  return {...parts, total, totalMax:100, passScore:80, potentialTotal:Math.max(total,potential===79.5?80:potential), pending};
}

function practicalScore(weeks, coverage) {
  const first = weeks.find((week, index) => session(week, index) === 1)?.checklist || [];
  const weekly = Array.from({length:14}, (_, index) => weeks.find((week, weekIndex) => session(week, weekIndex) === index + 2)?.checklist || []);
  const plan = [first[2]?.status, ...weekly.map(items => items[0]?.status)];
  const materials = [first[3]?.status, ...weekly.map(items => items[1]?.status)];
  const pre = weekly.map(items => items[3]?.status);
  const post = weekly.map(items => items[4]?.status);
  const activities = [first[5]?.status, ...weekly.map(items => items[5]?.status)];
  const video = videoCoverage(weeks, "practical");
  const rowsPass = rows => rows.reduce((sum, status) => sum + pass(status), 0);
  const rowsPossible = rows => rows.reduce((sum, status) => sum + possible(status), 0);
  const parts = {
    courseInformation:half(pass(first[0]?.status) * 2.5 + pass(first[1]?.status) * 2.5),
    teachingPlan:proportional(plan, 7.5),
    teachingMaterials:proportional(materials, 7.5),
    video:half(Math.min(1, video.completeSessions / 7) * 7.5),
    preTest:proportional(pre, 5),
    postTest:proportional(post, 5),
    assignment:proportional(activities, 12.5)
  };
  const total = half(Object.values(parts).reduce((sum, value) => sum + value, 0));
  const potentialTotal = half(
    (possible(first[0]?.status) + possible(first[1]?.status)) * 2.5
    + proportional(plan, 7.5, possible) + proportional(materials, 7.5, possible)
    + Math.min(1, (video.completeSessions + video.reviewSessions) / 7) * 7.5
    + proportional(pre, 5, possible) + proportional(post, 5, possible)
    + proportional(activities, 12.5, possible)
  );
  const gates = {video:video.completeSessions >= 7, preTest:rowsPass(pre) >= 7, postTest:rowsPass(post) >= 7, firstSessionActivity:PASS.has(first[5]?.status)};
  const potentialGates = {video:video.completeSessions + video.reviewSessions >= 7, preTest:rowsPossible(pre) >= 7, postTest:rowsPossible(post) >= 7, firstSessionActivity:possible(first[5]?.status) === 1};
  const pending = structurePending(coverage) || [first[0]?.status, first[1]?.status, ...plan, ...materials, ...pre, ...post, ...activities].includes("needs_review") || video.reviewSessions > 0;
  return {...parts, total, totalMax:50, passScore:40, potentialTotal, pending, gates, potentialGates};
}

export function criteria12569Scorecard(report = {}) {
  const track = normalize12569Track(report.gnTrack || report.courseTrack || report.mandatoryCoverage?.track);
  const weeks = criteria12569Weeks(report.weeks || []);
  const score = track === "practical" ? practicalScore(weeks, report.coverage || {}) : theoryScore(weeks, report.coverage || {});
  const gatesPass = !score.gates || Object.values(score.gates).every(Boolean);
  const potentialGatesPass = !score.potentialGates || Object.values(score.potentialGates).every(Boolean);
  const status = score.total >= score.passScore && gatesPass
    ? "pass"
    : score.pending && score.potentialTotal >= score.passScore && potentialGatesPass ? "needs_review" : "fail";
  return {...score, track, status, scoringMode:CRITERIA_12569_SCORE_MODEL};
}



// The review UI uses original checklist positions, not weighted points.
export function legacyReviewKeys(payload = {}) {
  const snap = payload.evidenceSnapshot || {};
  if (payload.coverageComplete !== true || structurePending(snap.coverage || {}) || payload.criteriaScorecard?.status !== "needs_review") return [];
  const weeks = Array.isArray(snap.weeks) ? snap.weeks : [];
  return weeks.flatMap((week, index) => {
    const sessionNumber = Number(week.session || index + 1);
    const allowed = sessionNumber === 1 ? [1,2,3,4,6] : [1,2,3,5,6,7];
    return (week.criteria || []).filter(item => item.status === "needs_review" && allowed.includes(Number(item.criterion)))
      .map(item => ({session:sessionNumber, criterion:Number(item.criterion), label:item.label || "", detail:item.detail || ""}));
  });
}

export function score12569Snapshot(payload = {}, decisions = {}) {
  const snap = payload.evidenceSnapshot || {};
  const track = (payload.criteriaScorecard || snap.criteriaScorecard || {}).track;
  if (!["theory","practical"].includes(track) || !Array.isArray(snap.weeks) || !snap.weeks.length) {
    throw new Error("legacy_score_snapshot_missing");
  }
  const weeks = snap.weeks.map((week, index) => ({
    section:week.section || `ครั้งที่ ${index + 1}`,
    checklist:Array.from({length:7}, (_, i) => {
      const item = (week.criteria || []).find(criterion => Number(criterion.criterion) === i + 1) || {};
      const key = `criterion:${week.session || index + 1}:${i + 1}`;
      const resolved = Object.prototype.hasOwnProperty.call(decisions, key);
      const value = {...item, status:resolved ? (decisions[key] ? "pass" : "fail") : item.status};
      if (resolved) delete value.scoreValue;
      return value;
    })
  }));
  return criteria12569Scorecard({gnTrack:track, weeks, coverage:snap.coverage || {}});
}

const videoKinds=new Set(["video","video_candidate"]);
const sessionOf=i=>Object.prototype.hasOwnProperty.call(i,"auditSession")?Number(i.auditSession)||0:Number(String(i.section||"").match(/\d+/)?.[0])||0;
const linkOf=i=>String(i.externalUrl||i.href||"").trim();
const foundVideoSeconds=i=>Math.max(0,Math.min(43200,Math.round(Number(i.systemDurationSeconds||i.durationSeconds||0)||0)));
const uncertain=i=>i.kind==="video_candidate"||i.mediaReviewRequired===true||i.mediaReviewDecision==="pending";
export function legacyVideoMode(i){
 if(!foundVideoSeconds(i)||i.mediaStatus==="link_error"||i.mediaStatus==="cloud_folder"||i.reviewExcluded||i.countingEligible===false)return "excluded";
 return uncertain(i)?"manual":"fixed";
}
export function legacyVideoLinks(payload,session){
 const seen=new Set();
 return (payload.evidenceSnapshot?.activities||[]).filter(i=>videoKinds.has(i.kind)&&sessionOf(i)===Number(session)&&!i.reviewExcluded&&i.countingEligible!==false&&/^https?:\/\//i.test(linkOf(i))).filter(i=>{const k=linkOf(i);if(seen.has(k))return false;seen.add(k);return true;});
}
const clockSeconds=value=>String(value||"").split(":").reduce((sum,part)=>sum*60+Number(part),0);
export function legacyVideoNominalFromDetail(item){
 const m=String(item.originalDetail||item.detail||"").match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
 return m?clockSeconds(m[2]):null;
}
export function legacyVideoThreshold(credits,session){
 const c=Number(credits),first=Number(session)===1;
 if(!Number.isInteger(c)||c<1||c>30)throw Error("legacy_course_credits_not_verified");
 const nominal=c*(first?900:1800);
 // Historical policy: 3+ credits has a capped 20-min normal-session
 // allowance. First-session 3/5/10 min; larger courses retain the cap.
 const tolerance=(first?(c===1?3:c===2?5:10):(c===1?5:c===2?10:20))*60;
 return {nominal,required:nominal-tolerance,tolerance};
}
export function legacyVideoRequired(item,session,credits){
 // Old non-current snapshots may lack catalog credits. Infer ONLY from
 // explicit nominal duration, never fall back silently to 3 credits.
 const nominal=legacyVideoNominalFromDetail(item);
 const c=credits??(nominal==null?null:nominal/(Number(session)===1?900:1800));
 return legacyVideoThreshold(c,session).required;
}
const durationText=sec=>Math.floor(sec/3600)+":"+String(Math.floor(sec%3600/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
// Never use a blanket full-score potential for a structural anomaly. Only
// downgrade a narrow, evidence-supported case to a warning. Recompute flags
// server-side rather than trusting flags supplied by the Extension.
function assessLegacyStructure(payload, weighted){
 const snap=payload.evidenceSnapshot||{},coverage=snap.coverage||{};
 coverage.legacyTopologyWarningOnly=false;coverage.legacyUnmappedWarningOnly=false;
 const warnings=[],rows=Array.isArray(coverage.topologyMappingRows)?coverage.topologyMappingRows:[],activities=snap.activities||[];
 const allMapped=Array.from({length:15},(_,i)=>i+1).every(n=>rows.some(row=>!row.ignored&&!row.outOfRange&&Number(row.chosenSession)===n));
 if(payload.coverageComplete!==true||coverage.reachedEnd!==true||coverage.structurallyComplete!==true||coverage.topologyConfidence!=="high"||!allMapped)return warnings;
 const unmapped=Number(coverage.unmappedNonForumActivityCount||0);
 if(unmapped>0){
   const other=activities.filter(a=>!Number(a.auditSession)&&a.kind!=="forum"&&a.kind!=="supplementary"&&!rows.some(row=>row.section===a.section&&row.outOfRange));
   const auxiliary=other.filter(a=>a.kind==="url"&&a.linkStatus==="skipped_unclassified"&&rows.some(row=>row.section===a.section&&row.ignored));
   if(auxiliary.length===unmapped&&other.length===unmapped){
     coverage.legacyUnmappedWarningOnly=true;
     warnings.push("พบลิงก์ทั่วไปในกล่องที่ไม่นับคะแนน "+unmapped+" รายการ");
   }
 }
 if(coverage.topologyReviewRequired===true&&(!unmapped||coverage.legacyUnmappedWarningOnly)){
   const issues=Array.isArray(coverage.topologySafetyIssues)?coverage.topologySafetyIssues:[];
   const first=rows.findIndex(row=>!row.ignored&&!row.outOfRange&&Number(row.declaredSession)===1&&Number(row.chosenSession)===1);
   const affected=first>0?rows.slice(0,first).filter(row=>!row.ignored&&!row.outOfRange&&Number(row.chosenSession)>1):[];
   const later=first>=0?rows.slice(first).filter(row=>!row.ignored&&!row.outOfRange):[];
   const monotonic=later.every((row,i)=>!i||Number(row.chosenSession)>=Number(later[i-1].chosenSession));
   const onlyIntro=first>0&&affected.length>0&&affected.every(row=>(row.declaredSession==null||Number(row.declaredSession)===0)&&Number(row.chosenSession)===2)
     &&issues.length===1&&String(issues[0])==="ลำดับครั้งเรียนย้อนกลับที่ "+String(rows[first].section)&&monotonic;
   if(onlyIntro){
     const mapSections=new Set(affected.map(row=>row.section));
     const affectedActivities=activities.filter(a=>mapSections.has(a.section));
     const onlyUnscored=affectedActivities.length>0&&affectedActivities.every(a=>["url","forum","supplementary","ai_tutor","podcast"].includes(a.kind));
     const removed={};for(const row of affected)for(let k=1;k<=7;k++)removed["criterion:"+row.chosenSession+":"+k]=false;
     const conservative=score12569Snapshot(payload,removed);
     if(onlyUnscored||(weighted.status==="pass"&&conservative.status==="pass")){
       coverage.legacyTopologyWarningOnly=true;
       warnings.push("พบลำดับกล่องแนะนำก่อน Week 1 ย้อนกลับ"+(onlyUnscored?" (ไม่พบองค์ประกอบที่คิดคะแนนในกล่องดังกล่าว)":" (แม้ไม่นับคะแนนครั้งที่คลาดเคลื่อน ผลยังผ่านเกณฑ์)"));
     }
   }
 }
 return warnings;
}
export function prepareLegacyReview(payload={}){
 if(payload.group!=="GR"||payload.criteriaMode!=="legacy_12569"||payload.semesterCode!=="1/2569"||payload.reviewConfirmation?.confirmedAt||payload.internalStatus==="audit_failed")return payload;
 const snap=payload.evidenceSnapshot||{},coverage=snap.coverage||{};
 if(!Array.isArray(snap.weeks)||!Array.isArray(snap.activities)||!snap.weeks.length)return payload;
 // Legacy uses scored checklist statuses, not global counters that include omitted media.
 coverage.legacyReviewScoped=true;coverage.legacyTopologyWarningOnly=false;coverage.legacyUnmappedWarningOnly=false;snap.coverage=coverage;
 for(const week of snap.weeks){
  const session=Number(week.session),item=(week.criteria||[]).find(i=>Number(i.criterion)===(session===1?4:3));
  if(!item||!["pass","pass_tolerance","fail","needs_review"].includes(item.status)||item.confirmedByReviewer||item.reviewerConfirmedMissing)continue;
  const credits=Number(payload.courseCredits),actualCredits=Number.isInteger(credits)&&credits>0;
  const nominal=legacyVideoNominalFromDetail(item);
  const expectedNominal=actualCredits?legacyVideoThreshold(credits,session).nominal:nominal;
  // Untouched automatic passes with matching nominal duration retain the
  // Extension's original classification. Repair incorrect nominal targets
  // and server-derived classifications using explicit mapped evidence.
  const reconcilePass=actualCredits&&((nominal!==null&&nominal!==expectedNominal)||Boolean(item.legacyVideoReview));
  if(PASS.has(item.status)&&!reconcilePass)continue;
  const links=legacyVideoLinks(payload,session),manual=links.filter(i=>legacyVideoMode(i)==="manual"),fixed=links.filter(i=>legacyVideoMode(i)==="fixed");
  const observed=fixed.reduce((sum,i)=>sum+foundVideoSeconds(i),0),required=legacyVideoRequired(item,session,payload.courseCredits);
  item.originalStatus=item.originalStatus||item.status;item.originalDetail=item.originalDetail||item.detail;
  item.status=observed>0&&observed>=required?(expectedNominal!==null&&observed<expectedNominal?"pass_tolerance":"pass"):manual.length?"needs_review":"fail";
  if(item.status!==item.originalStatus)delete item.scoreValue;
  item.detail="เวลาวิดีโอที่นับได้ "+durationText(observed)+" / ขั้นต่ำหลังผ่อนปรน "+durationText(required)+(manual.length?" · รอยืนยันประเภท "+manual.length+" คลิป":"");
  item.legacyVideoReview={required,nominal:expectedNominal,observed,manualCount:manual.length,excludedCount:links.filter(i=>legacyVideoMode(i)==="excluded").length};
 }
 for(const item of snap.activities){if(videoKinds.has(item.kind)){item.legacyVideoMode=legacyVideoMode(item);item.legacyFoundSeconds=foundVideoSeconds(item);}}
 const initial=score12569Snapshot(payload);
 payload.legacyStructureWarnings=assessLegacyStructure(payload,initial);
 const weighted=score12569Snapshot(payload);
 payload.criteriaScorecard=weighted;snap.criteriaScorecard=weighted;
 payload.confirmedScore=weighted.total;payload.possibleScore=Math.max(weighted.total,weighted.potentialTotal);
 payload.legacyReviewBlocked=payload.coverageComplete!==true||structurePending(coverage);
 payload.reviewableCriteria=payload.legacyReviewBlocked?[]:legacyReviewKeys(payload);
 payload.legacyRecommendedStatus=payload.legacyReviewBlocked?"audit_failed":weighted.status==="pass"?"pass":weighted.status==="needs_review"&&payload.reviewableCriteria.length?"needs_review":weighted.status==="fail"?"has_content":"audit_failed";
 // Diagnostic, not a publication decision: show the maximum using the times
 // already read, while leaving legitimate manual duration corrections allowed.
 delete payload.legacyObservedPotentialScore;
 if(payload.legacyRecommendedStatus==="needs_review"){
   const decisions={};let hasVideo=false;
   for(const key of payload.reviewableCriteria){
     const session=Number(key.session),criterion=Number(key.criterion),id="criterion:"+session+":"+criterion;
     if(criterion===(session===1?4:3)){
       hasVideo=true;
       const item=snap.weeks.find(w=>Number(w.session)===session)?.criteria.find(i=>Number(i.criterion)===criterion);
       const total=legacyVideoLinks(payload,session).filter(i=>legacyVideoMode(i)!=="excluded").reduce((sum,i)=>sum+foundVideoSeconds(i),0);
       decisions[id]=Boolean(item)&&total>0&&total>=legacyVideoRequired(item,session,payload.courseCredits);
     }else decisions[id]=true;
   }
   if(hasVideo)payload.legacyObservedPotentialScore=score12569Snapshot(payload,decisions).total;
 }
 return payload;
}
export function validateLegacyVideoDecisions(source,keys,submitted,decisions){
 const seen=new Set();
 for(const k of keys){
  const [,session,criterion]=k.split(":");
  if(Number(criterion)!==(Number(session)===1?4:3))continue;
  const item=source.evidenceSnapshot.weeks.find(w=>Number(w.session)===Number(session))?.criteria.find(i=>Number(i.criterion)===Number(criterion));
  const links=legacyVideoLinks(source,session);
  if(!links.length)continue;
  const expected=new Set(links.map(linkOf)),supplied=submitted.filter(i=>i.criterionKey===k);
  if(supplied.length!==expected.size||new Set(supplied.map(i=>i.key)).size!==expected.size)throw Error("legacy_video_evidence_incomplete");
  let total=0;
  for(const entry of supplied){
   if(!expected.has(entry.key)||!["use","not_use"].includes(entry.decision)||!Number.isInteger(entry.seconds)||entry.seconds<0||entry.seconds>43200||(entry.decision==="use"&&entry.seconds<=0))throw Error("legacy_video_evidence_invalid");
   const item=links.find(i=>linkOf(i)===entry.key),mode=legacyVideoMode(item);
   if(mode==="excluded"&&(entry.decision!=="not_use"||entry.seconds!==0))throw Error("legacy_video_duration_not_found");
   if(mode==="fixed"&&(entry.decision!=="use"||entry.seconds!==foundVideoSeconds(item)))throw Error("legacy_video_fixed_duration_mismatch");
   if(entry.decision==="use")total+=entry.seconds;
   seen.add(k+"\u0000"+entry.key);
  }
  if(decisions.get(k)!==(total>0&&total>=legacyVideoRequired(item,session,source.courseCredits)))throw Error("legacy_video_duration_mismatch");
 }
 if(submitted.some(i=>!seen.has(i.criterionKey+"\u0000"+i.key)))throw Error("legacy_unexpected_evidence");
}


// Course Profile is authoritative; the FIRST parenthesis describes the overall
// course, the LAST one describes the specific class (e.g. TL)-(L), TL)-(TT)).
export function parseLegacyCourseProfile(value){
 const matches=[...String(value||"").matchAll(/\b(691GR-[A-Z0-9_-]+\([TL]+\)-\((T|TT|L|LL)\))/gi)];
 const profiles=[...new Set(matches.map(m=>m[1].toUpperCase()))];
 if(profiles.length!==1)return null;
 const profile=profiles[0],suffix=profile.match(/\((T|TT|L|LL)\)$/)[1];
 return {profile,track:suffix.startsWith("L")?"practical":"theory",threshold:suffix.startsWith("L")?40:80};
}
const legacyError=(message,status=422)=>Object.assign(new Error(message),{status});

// Recalculate from a complete, uniquely indexed 15-session checklist.
// Never use the client's claimed total as a source of points. Preserve the
// original numbers for investigation, but reject identity/track/schema errors.
export function reconcileLegacyResult(payload,expected){
 if(!expected||payload.group!=="GR"||payload.criteriaMode!=="legacy_12569"||payload.semesterCode!=="1/2569")throw legacyError("legacy_course_type_not_verified",409);
 const snap=payload.evidenceSnapshot,card=payload.criteriaScorecard,sc=snap?.criteriaScorecard;
 if(!card||card.track!==expected.track||sc?.track!==expected.track||Number(payload.threshold)!==expected.threshold)throw legacyError("legacy_course_track_mismatch",409);
 for(const value of [payload.courseProfile,payload.courseTitle]){
  const parsed=parseLegacyCourseProfile(value);
  if(parsed&&parsed.profile!==expected.profile)throw legacyError("legacy_course_profile_mismatch",409);
  if(String(value||"").includes("691GR-")&&!parsed)throw legacyError("legacy_course_profile_invalid",409);
 }
 const statuses=new Set(["pass","pass_tolerance","fail","needs_review","not_applicable"]);
 if(payload.coverageComplete!==true||!Array.isArray(snap?.weeks)||snap.weeks.length!==15||!Array.isArray(snap.activities)||!snap.coverage||typeof snap.coverage!=="object")throw legacyError("legacy_score_snapshot_missing");
 if(payload.reviewConfirmation?.confirmedAt)throw legacyError("legacy_unexpected_review_confirmation");
 const seen=new Set();
 for(const week of snap.weeks){
  const n=Number(week.session);
  if(!Number.isInteger(n)||n<1||n>15||seen.has(n)||!Array.isArray(week.criteria))throw legacyError("legacy_score_snapshot_invalid");
  const parsed=Number(String(week.section||"").match(/\d+/)?.[0]||n);
  if(parsed!==n)throw legacyError("legacy_score_snapshot_session_mismatch");
  seen.add(n);
  const counted=n===1?[1,2,3,4,6]:[1,2,3,5,6,7];
  const byIndex=new Map();
  for(const item of week.criteria){
   const k=Number(item.criterion);
   if(!Number.isInteger(k)||k<1||k>7||byIndex.has(k))throw legacyError("legacy_score_snapshot_invalid");
   byIndex.set(k,item);
  }
  for(const k of counted){
   const item=byIndex.get(k);
   if(!item||!statuses.has(item.status))throw legacyError("legacy_score_snapshot_invalid");
   if(k===2&&n===1&&Object.prototype.hasOwnProperty.call(item,"scoreValue")&&(!Number.isFinite(item.scoreValue)||item.scoreValue<0||item.scoreValue>5))throw legacyError("legacy_score_snapshot_invalid");
  }
 }
 if(typeof payload.hasContent!=="boolean"||typeof payload.confirmedScore!=="number"||!Number.isFinite(payload.confirmedScore)||payload.confirmedScore<0||payload.confirmedScore>(expected.track==="practical"?50:100)||!["pass","needs_review","has_content","no_content"].includes(payload.internalStatus))throw legacyError("legacy_result_invalid");
 const received={confirmedScore:payload.confirmedScore,possibleScore:payload.possibleScore,internalStatus:payload.internalStatus,threshold:payload.threshold,track:card.track};
 snap.coverage.legacyTopologyWarningOnly=false;snap.coverage.legacyUnmappedWarningOnly=false;
 const baseline=score12569Snapshot(payload);
 if(baseline.passScore!==expected.threshold||!Number.isFinite(baseline.total))throw legacyError("legacy_score_snapshot_invalid");
 if(!payload.hasContent&&(baseline.total!==0||snap.weeks.some(w=>(w.criteria||[]).some(i=>PASS.has(i.status)))||snap.activities.some(i=>!["forum","url","supplementary"].includes(i.kind))))throw legacyError("legacy_no_content_mismatch");
 if(payload.internalStatus==="no_content"&&payload.hasContent)throw legacyError("legacy_no_content_mismatch");
 payload.courseProfile=expected.profile;
 if(!Number.isInteger(Number(expected.credits))||Number(expected.credits)<1)throw legacyError("legacy_course_credits_not_verified",409);
 payload.courseCredits=Number(expected.credits);
 // An empty Moodle shell has section boxes but no auditable activities.
 // A completed empty scan is not an incomplete scan of populated sections.
 const cov=snap.coverage;
 const originalStatus=payload.legacyScoreReconciliation?.received?.internalStatus||received.internalStatus;
 const verifiedEmpty=originalStatus==="no_content"&&payload.hasContent===false&&received.confirmedScore===0&&baseline.total===0
   &&cov.reachedEnd===true&&snap.activities.length===0
   &&cov.nonForumActivityCount===0&&cov.auditableActivityCount===0
   &&String(snap.emptyReason||"").trim()==="ไม่พบเนื้อหารายวิชา"
   &&cov.topologyReviewRequired!==true&&Number(cov.unmappedNonForumActivityCount||0)===0
   &&Number(cov.unresolvedClassificationCount||0)===0&&Number(cov.unresolvedScoringEvidenceCount||0)===0
   &&snap.weeks.every(w=>w.criteria.every(i=>i.status==="fail"||i.status==="not_applicable"));
 if(verifiedEmpty){
   const final={...baseline,track:expected.track,total:0,totalMax:expected.track==="practical"?50:100,passScore:expected.threshold,potentialTotal:0,status:"fail"};
   payload.criteriaScorecard=final;snap.criteriaScorecard=final;payload.confirmedScore=0;payload.possibleScore=0;payload.reviewablePoints=0;payload.reviewableCriteria=[];
   payload.legacyReviewBlocked=false;payload.internalStatus="no_content";payload.publicStatus="no_content";
   payload.publicResult={...(payload.publicResult||{}),status:"no_content",score:null};
   payload.reason="successful_scan_found_no_course_content";
   payload.legacyScoreReconciliation={received,baselineScore:baseline.total,baselineStatus:baseline.status,serverScore:0,serverStatus:"no_content",track:expected.track,changed:received.internalStatus!=="no_content",verifiedEmpty:true};
   return payload;
 }
 prepareLegacyReview(payload);
 const final=payload.criteriaScorecard;
 if(final.track!==expected.track||final.passScore!==expected.threshold||!Number.isFinite(final.total)||final.total<0||final.total>final.totalMax)throw legacyError("legacy_score_snapshot_invalid");
 payload.threshold=expected.threshold;
 payload.confirmedScore=final.total;
 payload.possibleScore=Math.min(final.totalMax,Math.max(final.total,final.potentialTotal));
 payload.reviewablePoints=payload.possibleScore-final.total;
 payload.internalStatus=payload.legacyReviewBlocked||!payload.hasContent?"audit_failed":payload.legacyRecommendedStatus;
 payload.publicStatus=["needs_review","audit_failed"].includes(payload.internalStatus)?null:payload.internalStatus;
 payload.publicResult={...(payload.publicResult||{}),status:payload.publicStatus,score:null};
 payload.reason=payload.legacyReviewBlocked||!payload.hasContent||payload.internalStatus==="audit_failed"?"legacy_structure_review_required":payload.internalStatus==="needs_review"?"legacy_review_can_change_outcome":payload.internalStatus==="no_content"?"successful_scan_found_no_course_content":payload.internalStatus==="pass"?"legacy_12569_score_and_gates_passed":"legacy_12569_below_threshold_or_gate_failed";
 payload.legacyScoreReconciliation={received,baselineScore:baseline.total,baselineStatus:baseline.status,serverScore:final.total,serverStatus:payload.internalStatus,track:expected.track,changed:received.confirmedScore!==final.total||received.internalStatus!==payload.internalStatus};
 return payload;
}
