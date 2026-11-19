(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const date=value=>value?new Date(value).toLocaleString(localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH",{dateStyle:"long",timeStyle:"short"}):"—";
  const compactAuditDate=value=>{if(!value)return"—";const d=new Date(value),locale=localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH";return `${d.toLocaleDateString(locale,{day:"numeric",month:"short",year:"numeric"})} เวลา ${d.toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit"})}`;};
  const score=value=>value!==null&&value!==""&&Number.isFinite(Number(value))?Number(value).toLocaleString(localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH"):"—";
  const mediaTime=value=>{const seconds=Math.max(0,Math.round(Number(value)||0));if(!seconds)return"อ่านเวลาไม่ได้";const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;};
  const durationInput=value=>{const seconds=Math.max(0,Math.round(Number(value)||0));if(!seconds)return"";const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;};
  const parseDurationInput=value=>{const parts=String(value||"").trim().split(":");if(![2,3].includes(parts.length)||parts.some(part=>!/^(?:\d+)$/.test(part)))return 0;const numbers=parts.map(Number),seconds=numbers.at(-1),minutes=numbers.at(-2);if(seconds>59||parts.length===3&&minutes>59)return 0;return parts.length===3?numbers[0]*3600+minutes*60+seconds:minutes*60+seconds;};
  const validDurationInput=value=>{const text=String(value||"").trim(),parts=text.split(":");if(![2,3].includes(parts.length)||parts.some(part=>!/^(?:\d+)$/.test(part)))return false;const numbers=parts.map(Number);return numbers.at(-1)<60&&(parts.length!==3||numbers.at(-2)<60);};
  const usableDuration=value=>validDurationInput(value)&&parseDurationInput(value)>0&&parseDurationInput(value)<=43200;
  const continuousVideoTime=value=>{const digits=String(value||"").replace(/\D/g,"").replace(/^0+(?=\d)/,"").slice(0,6);if(!digits)return"";const padded=digits.padStart(3,"0"),sec=padded.slice(-2),min=padded.slice(0,-2);return min.length>2?Number(min.slice(0,-2))+":"+min.slice(-2)+":"+sec:Number(min)+":"+sec;};
  const continuousPodcastTime=value=>{const digits=String(value||"").replace(/\D/g,"").slice(-6);if(!digits)return"";const seconds=digits.slice(-2).padStart(2,"0"),minutes=digits.slice(0,-2);return `${minutes?Number(minutes):0}:${seconds}`;};
  const reviewNotice=(message,type="")=>{const node=$("reviewActionNotice");if(!node)return;node.hidden=!message;node.className=`review-action-notice ${type}`.trim();node.textContent=message||"";};
  const criterionStatus=value=>({pass:"ผ่าน",pass_tolerance:"ผ่านตามค่าผ่อนปรน",needs_review:"รอตรวจ",fail:"ไม่ผ่าน",not_applicable:"ไม่มีข้อบังคับ/ไม่มี"}[value]||value||"—");
  const MANUAL_REVIEW_ITEMS=[
    ["student_meetings","การจัดให้มีการพบนักศึกษา","กำหนดตารางพบนักศึกษารวม 3 ครั้ง"],
    ["video_quality","คุณภาพวิดีโอบันทึกการสอน","ระดับ B+ ขึ้นไป (รายวิชานอกแผน ระดับ B ขึ้นไป)"],
    ["media_placement","การวางสื่อใน d-Learning","วิดีโอและ Podcast เป็นลิงก์ ไม่อัปโหลดไฟล์โดยตรง"],
    ["submission_policy","การส่งงานของนักศึกษา","ไม่กำหนดให้นำส่งงานภายใน d-Learning"],
    ["backup","การสำรองเนื้อหา","จัดเก็บเนื้อหาและวิดีโอตามช่วงเวลาที่มหาวิทยาลัยกำหนด"]
  ];
  const isLegacy=run=>run.criteriaMode==="legacy_12569";
  const resultTone=run=>{
    const status=run?.publicStatus||run?.internalStatus||"audit_failed";
    if(status==="pass")return"pass";
    if(status==="needs_review")return"review";
    if(status==="has_content")return run?.publicStatus==="has_content"?"fail":"review";
    if(status==="no_content")return"fail";
    return"neutral";
  };
  const toneColor=tone=>tone==="pass"?"green":tone==="review"?"orange":tone==="fail"?"red":"gray";
  const reviewerSummaryCard=run=>String(run?.reviewerSummary||"").trim()?`<section class="reviewer-summary"><span class="evidence-eyebrow">สรุปจากผู้ตรวจ</span><h3>ข้อเสนอแนะเพื่อปรับปรุงรายวิชา</h3><p>${esc(String(run.reviewerSummary).trim())}</p></section>`:"";
  const legacyExcluded=(session,criterion)=>Number(session)===1?[5,7].includes(Number(criterion)):Number(criterion)===4;
  const resultWeeks=run=>{const weeks=Array.isArray(run.evidenceSnapshot?.weeks)?run.evidenceSnapshot.weeks:[];return isLegacy(run)?weeks.map(week=>({...week,criteria:(week.criteria||[]).filter(item=>!legacyExcluded(week.session,item.criterion)).map(item=>Number(week.session)>1&&Number(item.criterion)===7?{...item,status:item.status==="fail"?"not_applicable":item.status,label:`${item.label||"กิจกรรมท้ายบท"} (ไม่บังคับ)`}:item)})):weeks;};
  const reviewCandidates=run=>{
    const snapshot=run.evidenceSnapshot||{},weeks=Array.isArray(snapshot.weeks)?snapshot.weeks:[];
    const fromSource=Array.isArray(run.reviewableCriteria)?run.reviewableCriteria:[];
    const criteria=(fromSource.length?fromSource:weeks.flatMap((week,weekIndex)=>(week.criteria||[]).filter(item=>item.status==="needs_review").map(item=>({session:week.session||weekIndex+1,criterion:item.criterion,detail:item.detail||""}))))
      .map(item=>({key:`criterion:${item.session}:${item.criterion}`,label:`ครั้งที่ ${item.session} · หัวข้อที่ ${item.criterion}`,detail:item.detail||"",kind:"criterion"}));
    if(isLegacy(run))return fromSource.map(item=>({key:`criterion:${item.session}:${item.criterion}`,label:`ครั้งที่ ${item.session} · หัวข้อที่ ${item.criterion}`,detail:item.detail||"",kind:"criterion"}));
    const manual=String(run.group||"").toUpperCase()==="GN"?[]:MANUAL_REVIEW_ITEMS.map(([key,label,detail])=>({key:`manual:${key}`,label,detail,kind:"manual"}));
    const count=Math.max(0,Math.round(Number(run.possibleScore||0)-Number(run.confirmedScore||0)));
    if(!manual.length)return criteria.slice(0,count);
    const criterionCount=Math.max(0,count-manual.length);
    return [...criteria.slice(0,criterionCount),...manual];
  };
  const statusExplanation=(status,run,superAdmin=false)=>{
    const confirmed=Number(run.confirmedScore)||0,possible=Number(run.possibleScore)||0,threshold=Number(run.threshold)||80,maximum=Number(run.maxScore)||110;
    if(status==="pass")return {title:"ผ่านเกณฑ์แล้ว",text:superAdmin?`คะแนนยืนยัน ${score(confirmed)} ถึงเกณฑ์ ${score(threshold)} คะแนน จากคะแนนเต็ม ${score(maximum)} คะแนน`:"รายวิชาผ่านเกณฑ์การประเมินแล้ว",actions:[]};
    if(superAdmin&&isLegacy(run)&&run.legacyReviewBlocked)return {title:"ต้องตรวจสอบการอ่านข้อมูล",text:`คะแนนจากข้อมูลที่อ่านได้ ${score(confirmed)} / ${score(maximum)} · ไม่สามารถสรุปผลที่น่าเชื่อถือจากโครงสร้างนี้ กรุณาตรวจใหม่ ไม่ใช่รายการรอยืนยันคะแนน`,actions:[]};
    if(status==="needs_review"&&superAdmin&&isLegacy(run)&&!reviewCandidates(run).length){
      const label=run.legacyRecommendedStatus==="pass"?"ผ่าน":run.legacyRecommendedStatus==="has_content"?"ไม่ผ่าน":"ยังสรุปไม่ได้";
      return {title:"พร้อมบันทึกผลตามคะแนน",text:`คะแนนยืนยัน ${score(confirmed)} / ${score(maximum)} · เกณฑ์ผ่าน ${score(threshold)} · ผลที่ระบบคำนวณ: ${label} · ไม่ต้องยืนยันหลักฐานเพิ่มเติม`,actions:[]};
    }
    if(status==="needs_review"&&superAdmin){
      const observed=run.legacyObservedPotentialScore==null?null:Number(run.legacyObservedPotentialScore);
      const actions=["ตรวจรายการที่ต้องดำเนินการด้านล่าง แล้วกดยืนยันผลที่ระบบคำนวณ"];
      if(Number.isFinite(observed)&&observed<possible)actions.unshift(`หากใช้เวลาวิดีโอที่เครื่องอ่านได้ และรายการรอยืนยันอื่นผ่านทั้งหมด: ${score(observed)} คะแนน · จะได้เพิ่มกว่านี้ต่อเมื่อพบและยืนยันเวลาจริงเพิ่มเติมเท่านั้น`);
      return {title:"รอยืนยันหลักฐานที่มีผลต่อการตัดสิน",text:`คะแนนยืนยัน ${score(confirmed)} / ${score(maximum)} · เกณฑ์ผ่าน ${score(threshold)} · เพดานเมื่อหลักฐานที่รอยืนยันผ่านทุกข้อ ${score(possible)} คะแนน`,actions};
    }
    if(status==="has_content"&&run.publicStatus==="has_content")return {title:"ไม่ผ่านเกณฑ์",text:superAdmin?`ยืนยันผลแล้วที่ ${score(confirmed)} / ${score(maximum)} คะแนน · ${confirmed>=threshold?"คะแนนถึงเกณฑ์ แต่ยังไม่ผ่านเงื่อนไขบังคับ":"ยังไม่ถึงเกณฑ์ "+score(threshold)+" คะแนน"}`:"ผลตรวจล่าสุดไม่ผ่านเกณฑ์ โปรดแก้ไขตามรายการสรุปด้านล่างก่อนตรวจครั้งถัดไป",actions:[]};
    if(status==="has_content"||status==="needs_review")return {title:"ไม่ปรากฏ / ไม่ครบ",text:superAdmin?`คะแนนที่ระบบยืนยัน ${score(confirmed)} ยังไม่ถึงเกณฑ์ ${score(threshold)} คะแนน จากคะแนนเต็ม ${score(maximum)} คะแนน`:"ยังพบองค์ประกอบที่ไม่ครบหรือยังยืนยันไม่ได้",actions:["แก้ไขหรือเพิ่มเฉพาะหัวข้อที่แสดงว่า “ไม่ผ่าน” ด้านล่าง แล้วตรวจใหม่"]};
    if(status==="no_content")return {title:"ยังไม่พบองค์ประกอบรายวิชา",text:"ระบบตรวจสำเร็จแล้ว แต่ไม่พบองค์ประกอบที่ใช้คำนวณคะแนน",actions:["เพิ่มองค์ประกอบการสอนและหลักฐานในรายวิชา แล้วตรวจใหม่"]};
    return {title:"ตรวจไม่สำเร็จ",text:"ระบบเข้าถึงหรืออ่านข้อมูลได้ไม่ครบ จึงยังสรุปผลรายวิชาไม่ได้",actions:["ตรวจสอบสิทธิ์เข้าถึงรายวิชาและลิงก์ภายนอก แล้วรันการตรวจใหม่"]};
  };
  const qualityMessage=run=>{
    const failures=run.qualityGate?.failures;
    const warnings=Array.isArray(run.legacyStructureWarnings)?run.legacyStructureWarnings:[];
    if(!Array.isArray(failures)||!failures.length)return warnings.length?"หมายเหตุโครงสร้าง: "+warnings.join(" · "):"";
    const labels={schema_outdated:"รูปแบบผลตรวจเป็นรุ่นเก่า",score_model_outdated:"โมเดลคะแนนเป็นรุ่นเก่า",auditor_version_outdated:"Extension เป็นรุ่นเก่า",scan_incomplete:"การอ่านข้อมูลยังไม่ครบ"};
    return `ข้อควรระวังคุณภาพข้อมูล: ${failures.map(value=>labels[value]||value).join(" · ")} — สถานะรายวิชายังคงอิงคะแนนและหลักฐานที่แสดงด้านล่าง`;
  };
  const sessionLabel=values=>{
    const numeric=[...new Set(values.map(Number).filter(Number.isFinite))].sort((a,b)=>a-b),ranges=[];
    for(let index=0;index<numeric.length;){let end=index;while(end+1<numeric.length&&numeric[end+1]===numeric[end]+1)end++;ranges.push(index===end?String(numeric[index]):`${numeric[index]}–${numeric[end]}`);index=end+1;}
    const other=[...new Set(values.map(String).filter(value=>value&&!Number.isFinite(Number(value))))];
    return [...ranges,...other].join(", ");
  };
  const actionableIssues=item=>{
    const text=`${item.label||""} ${item.detail||""}`.toLowerCase(),issues=[];
    const add=(key,label,action)=>issues.push({key,label,action,session:item.session});
    const access=/ลิงก์เสีย|link[_ -]?error|ติดสิทธิ์|ไม่มีสิทธิ์|เข้าถึงไม่ได้|เปิดไม่ได้|ไม่สามารถเข้าถึง|ขอสิทธิ์|เปิดปลายทางไม่ได้|ไม่พบปลายทาง/.test(text);
    const duration=/เวลา|นาที|ชั่วโมง|\d+\s*:\s*\d+/.test(text);
    if(/ข้อมูลผู้สอน|การติดต่อ/.test(text)&&!item.reviewerConfirmedMissing&&!item.confirmedByReviewer)return issues;
    if(/แบบทดสอบก่อนเรียน|แบบทดสอบหลังเรียน|pre[ -]?test|post[ -]?test/.test(text)){add("quiz-name","แบบทดสอบก่อนและหลังเรียน","เปลี่ยนชื่อ Quiz ให้ระบุชัดเจนว่าเป็น Pre/Post-test หรือแบบทดสอบก่อน/หลังเรียน");return issues;}
    if(/วิดีโอ|video|record/.test(text)){
      if(access){
        add("video-access","เปิดปลายทางไม่ได้","แก้ไขลิงก์หรือสิทธิ์การเข้าถึง เพื่อให้ผู้ตรวจเปิดปลายทางของวิดีโอได้");
        return issues;
      }
      add("video-duration","เวลารวมของวิดีโอไม่ครบตามเกณฑ์","เพิ่มลิงก์คลิปการสอน หรือเพิ่ม/ปรับวิดีโอที่เปิดได้ให้มีเวลารวมครบตามเกณฑ์ของสัปดาห์นั้น");
      return issues;
    }
    if(/podcast|คลิปเสียง/.test(text)){
      if(access)add("podcast-access","สิทธิ์เข้าถึง Podcast","แก้สิทธิ์ของลิงก์ Podcast ให้เปิดฟังได้");
      if(/ไม่ใช่.*คลิปเสียง|อัปโหลดไฟล์|ไฟล์โดยตรง|ลิงก์ภายนอก/.test(text))add("podcast-format","รูปแบบ Podcast","เปลี่ยน Podcast ให้เป็นคลิปเสียงและวางเป็นลิงก์จากผู้ให้บริการภายนอก");
      if(!issues.length)add("podcast-content","Podcast","เพิ่มหรือแก้ไข Podcast ให้เป็นคลิปเสียงที่เปิดฟังได้");
      return issues;
    }
    if(/ai\s*tutor/.test(text)){add("ai-tutor","AI Tutor",access?"แก้ไขลิงก์ AI Tutor ที่เปิดไม่ได้":"เพิ่ม AI Tutor");return issues;}
    if(/กิจกรรมท้ายบท|assignment/.test(text)){add("final-activity","กิจกรรมท้ายบท","เพิ่มกิจกรรมท้ายบทหรือ Assignment ให้ชัดเจนตามเกณฑ์");return issues;}
    const label=item.label||`หัวข้อที่ ${item.criterion||"—"}`;
    add(`general:${label}:${item.detail||""}`,label,item.detail||"เพิ่มหรือแก้ไของค์ประกอบให้ครบตามเกณฑ์");
    return issues;
  };
  const fixSummary=(status,weeks)=>{
    if(status==="pass")return"";
    const issues=weeks.flatMap(week=>(week.criteria||[]).filter(item=>item.status==="fail").flatMap(item=>actionableIssues({...item,session:week.session})));
    const grouped=new Map();
    issues.forEach(issue=>{const current=grouped.get(issue.key)||{...issue,sessions:[]};current.sessions.push(issue.session);grouped.set(issue.key,current);});
    const rows=[...grouped.values()].map(issue=>{const sessions=sessionLabel(issue.sessions);return `<li class="fix-item"><div class="fix-item-head"><strong>${esc(issue.label)}</strong>${sessions?`<span class="fix-session">ครั้งที่ ${esc(sessions)}</span>`:""}</div><div class="fix-action">${esc(issue.action)}</div></li>`;}).join("");
    if(!rows)return"";
    return `<section class="fix-summary ${esc(status)}"><h3>สรุปการแก้ไขสำหรับผู้สอน</h3><p>ระบบรวมหัวข้อที่ไม่ผ่านจากผลตรวจล่าสุดไว้ในรายการเดียว เพื่อใช้ปรับปรุงรายวิชาก่อนตรวจครั้งถัดไป</p><ol>${rows}</ol></section>`;
  };
  const activitySession=item=>Number(item?.auditSession)||Number(String(item?.section||"").match(/\d+/)?.[0])||0;
  const durationSecondsFromDetail=(detail,fallback)=>{
    const values=[...String(detail||"").matchAll(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g)].map(match=>match[3]===undefined?Number(match[1])*60+Number(match[2]):Number(match[1])*3600+Number(match[2])*60+Number(match[3]));
    return values.length?values.at(-1):fallback;
  };
  const criterionEvidenceSpec=(label,detail)=>{
    const text=`${label||""} ${detail||""}`.toLowerCase();
    if(/ai\s*tutor/.test(text))return {kinds:["ai_tutor"],openLabel:"เปิด AI Tutor",fallback:"AI Tutor"};
    if(/podcast|คลิปเสียง/.test(text))return {kinds:["podcast"],openLabel:"เปิด Podcast",fallback:"Podcast"};
    if(/วิดีโอ|video|record|บันทึกการสอน/.test(text))return {kinds:["video","video_candidate","recording"],openLabel:"เปิดวิดีโอ",fallback:"วิดีโอ"};
    if(/แบบทดสอบก่อนเรียน|pre[ -]?test/.test(text))return {kinds:["pre_quiz"],openLabel:"เปิด Pre-test",fallback:"Pre-test"};
    if(/แบบทดสอบหลังเรียน|post[ -]?test/.test(text))return {kinds:["post_quiz"],openLabel:"เปิด Post-test",fallback:"Post-test"};
    if(/กิจกรรมท้ายบท|assignment/.test(text))return {kinds:["assignment","assignment_image_candidate","quiz","forum"],openLabel:"เปิดกิจกรรม",fallback:"กิจกรรมท้ายบท"};
    if(/แผนการสอน/.test(text))return {kinds:["file","file_link"],openLabel:"เปิดแผนการสอน",fallback:"แผนการสอน",titlePattern:/แผนการสอน/i};
    if(/เอกสารประกอบ/.test(text))return {kinds:["file","file_link"],openLabel:"เปิดเอกสาร",fallback:"เอกสารประกอบ"};
    if(/ข้อมูลผู้สอน|การติดต่อ/.test(text))return {kinds:["url","forum"],openLabel:"เปิดช่องทางติดต่อ",fallback:"ข้อมูลผู้สอนและการติดต่อ",titlePattern:/ผู้สอน|อาจารย์|ติดต่อ|line|facebook|messenger|zoom|qr/i};
    if(/ข้อมูลและแนะนำรายวิชา|แนะนำรายวิชา/.test(text))return {kinds:["file","file_link","url"],openLabel:"เปิดหลักฐาน",fallback:"ข้อมูลแนะนำรายวิชา",titlePattern:/แนะนำรายวิชา|course\s*outline|คำอธิบายรายวิชา/i};
    return null;
  };
  const criterionEvidenceLinks=(activities,session,label,detail,criterionKey,legacy=false,readOnly=false,creditCount=null)=>{
    const spec=criterionEvidenceSpec(label,detail);
    if(!spec)return"";
    if(legacy&&spec.kinds.includes("video"))spec.kinds=["video","video_candidate"];
    const itemized=!readOnly&&spec.kinds.some(kind=>["video","video_candidate","recording","podcast"].includes(kind));
    const fallbackRequired=spec.kinds.includes("podcast")?600:(Number(session)===1?2700:5400);
    const first=Number(session)===1,c=Number(creditCount);
    const legacyVideo=legacy&&spec.kinds.includes("video")&&Number.isInteger(c)&&c>0;
    const nominal=legacyVideo?c*(first?900:1800):durationSecondsFromDetail(detail,fallbackRequired);
    const required=legacyVideo?nominal-(first?(c===1?3:c===2?5:10):(c===1?5:c===2?10:20))*60:nominal;
    const seen=new Set(),items=(activities||[]).map((item,activityIndex)=>({item,activityIndex})).filter(({item})=>{
      const mappedSession=legacy&&item&&Object.prototype.hasOwnProperty.call(item,"auditSession")?Number(item.auditSession)||0:activitySession(item);
      if(!spec.kinds.includes(item?.kind)||mappedSession!==Number(session))return false;
      if(legacy&&!readOnly&&spec.kinds.includes("video")&&(item.reviewExcluded||item.countingEligible===false))return false;
      return !spec.titlePattern||spec.titlePattern.test(`${item.title||""} ${item.groupContext||""}`);
    }).map(({item,activityIndex})=>{
      const href=AuditBridge.safeUrl(item.externalUrl||item.href||item.imageUrl);
      const evidenceKey=legacy?String(item.externalUrl||item.href||"").trim():href;
      if(!href||seen.has(evidenceKey))return"";
      seen.add(evidenceKey);
      const title=item.title||spec.fallback,group=item.groupContext||"ไม่พบชื่อป้าย",seconds=Number(item.reviewerDurationSeconds||item.systemDurationSeconds||item.durationSeconds||0),time=seconds?` · เวลา: ${mediaTime(seconds)}`:"",note=item.accessNote?` · ${item.accessNote}`:"";
      const priorDecision=item.priorEvidenceDecision||"",podcastTimeOnly=item.kind==="podcast";
      const control=itemized?`<div class="evidence-item-review" data-evidence-item data-criterion-key="${esc(criterionKey)}" data-required="${required}"${podcastTimeOnly?' data-podcast-time-only="1"':""}>${podcastTimeOnly?`<label>เวลา Podcast (นาที:วินาที)<input type="text" inputmode="numeric" autocomplete="off" data-evidence-time data-podcast-time data-evidence-key="${esc(evidenceKey||`item:${activityIndex}`)}" value="${esc(durationInput(seconds))}" placeholder="__:__"></label><span class="muted">พิมพ์ตัวเลขต่อเนื่องได้ เช่น 1319 จะแสดงเป็น 13:19 · ตั้งแต่ ${esc(mediaTime(required))} ขึ้นไปผ่าน ต่ำกว่านี้ไม่ผ่าน</span>`:`<label>นำรายการนี้มานับหรือไม่<select data-evidence-decision data-evidence-key="${esc(evidenceKey||`item:${activityIndex}`)}"><option value=""${!priorDecision?" selected":""}>ยังไม่ตัดสิน</option><option value="use"${priorDecision==="use"?" selected":""}>ใช้รายการนี้</option><option value="not_use"${priorDecision==="not_use"?" selected":""}>ไม่ใช้รายการนี้</option></select></label><label>เวลาที่ใช้คำนวณ<input type="text" inputmode="numeric" data-evidence-time value="${esc(durationInput(seconds))}" placeholder="นาที:วินาที เช่น 13:19"></label><span class="muted">กรอกแบบ นาที:วินาที หรือ ชั่วโมง:นาที:วินาที · ต้องรวมอย่างน้อย ${esc(mediaTime(required))}</span>`}</div>`:"";
      if(legacy){
        const isVideo=spec.kinds.includes("video"),found=Number(item.legacyFoundSeconds??item.systemDurationSeconds??item.durationSeconds??0)||0;
        const mode=item.legacyVideoMode||(found<=0||item.mediaStatus==="link_error"||item.reviewExcluded?"excluded":item.mediaReviewRequired||item.kind==="video_candidate"?"manual":"fixed");
        const compactNote=item.mediaStatus==="link_error"?"เปิดปลายทางไม่ได้":mode==="excluded"&&isVideo?"ไม่พบเวลาที่นำมานับได้":String(item.accessNote||"").replace(/https?:\/\/\S+/gi,"[ลิงก์ปลายทาง]").slice(0,180);
        const linkState=item.mediaStatus==="link_error"?"เปิดไม่ได้":item.linkStatus==="broken"?"ลิงก์เสีย":found>0?"พบเวลา":"ยังไม่ยืนยันการเข้าถึง";
        const mediaControl=isVideo&&itemized?mode==="manual"?`<div class="evidence-item-review compact-review" data-evidence-item data-criterion-key="${esc(criterionKey)}" data-required="${required}"><label>นำคลิปนี้มานับหรือไม่<select data-evidence-decision data-evidence-key="${esc(evidenceKey)}"><option value="">ยังไม่ตัดสิน</option><option value="use">นำมานับ</option><option value="not_use">ไม่นำมานับ</option></select></label><label>เวลาที่ตรวจพบ<input data-evidence-time data-video-time inputmode="numeric" autocomplete="off" type="text" value="${esc(durationInput(found))}" placeholder="1319 → 13:19"></label><span class="muted">พิมพ์ตัวเลขต่อเนื่อง เช่น 1319 → 13:19 หรือ 13000 → 1:30:00</span></div>`:`<div data-evidence-item data-criterion-key="${esc(criterionKey)}" data-required="${required}" data-locked-video="1"><select hidden disabled data-evidence-decision data-evidence-key="${esc(evidenceKey)}"><option value="${mode==="fixed"?"use":"not_use"}">${mode}</option></select><input type="hidden" data-evidence-time value="${mode==="fixed"?esc(durationInput(found)):""}"></div>`:"";
        const previewable=item.mediaStatus!=="link_error"&&(/\.(mp4|webm|ogg|mp3|m4a|wav)(?:[?#]|$)/i.test(href)||/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(href));
        return `<li class="mock-evidence-card">${previewable?'<div class="evidence-preview"><button type="button" data-media-preview data-media-url="'+esc(href)+'" data-media-kind="'+(item.kind==="podcast"?"audio":"video")+'">▶ เปิดตัวอย่างสื่อ</button></div>':""}<div class="media-title"><strong>${esc(title)}</strong><span class="media-tag">${esc(isVideo?"หลักฐานวิดีโอ":item.kind==="podcast"?"หลักฐานเสียง":"หลักฐาน")}</span></div><p>ป้ายบนรายวิชา: ${esc(group)}</p><div class="media-meta"><div><small>ปลายทาง</small><b>${esc(item.provider|| (isVideo?"ลิงก์วิดีโอ":"หลักฐานรายวิชา"))}</b></div><div><small>สถานะลิงก์</small><b>${esc(linkState)}</b></div><div><small>${isVideo?(legacyVideo?"ขั้นต่ำหลังผ่อนปรน":"เกณฑ์"):"ประเภท"}</small><b>${esc(isVideo?mediaTime(required):item.kind||"—")}</b></div></div>${isVideo?`<div class="media-note ${mode==="excluded"?"excluded":""}">${mode==="excluded"?(found>0?"รายการนี้ไม่ถูกนำมาคิดคะแนน":"ไม่พบเวลาที่นับได้ · ไม่นับคะแนน"):mode==="manual"?"พบเวลา "+mediaTime(found)+" · รอยืนยันประเภท":"เวลาที่ระบบนับ "+mediaTime(found)}</div>`:""}${compactNote?`<p class="media-note">${esc(compactNote)}</p>`:""}<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">เปิดหลักฐานในแท็บใหม่ ↗</a>${mediaControl}</li>`;
      }
            return `<li><a href="${esc(href)}" target="_blank" rel="noopener">${esc(spec.openLabel)}: ${esc(title)} ↗</a><span>ป้าย: ${esc(group)} · ประเภท: ${esc(item.kind||"—")}${esc(time)}${esc(note)}</span>${control}</li>`;
    }).filter(Boolean).join("");
    return items?`<div class="criterion-evidence-links"><strong>หลักฐานที่เกี่ยวข้องกับรายการนี้</strong><ul>${items}</ul></div>`:"";
  };
  const reviewPanel=(run,index,admin)=>{
    if(!admin||index!==0||!["needs_review","has_content"].includes(run.internalStatus)||!run.runId)return"";
    if(isLegacy(run)&&run.legacyReviewBlocked)return '<div class="quality-note">ตรวจสอบการอ่านหรือการจับคู่โครงสร้างรายวิชา แล้วกดตรวจซ้ำจาก Dashboard</div>';
    if(isLegacy(run)&&!reviewCandidates(run).length&&run.internalStatus!=="needs_review")return "";
    if(!isLegacy(run)&&Number(run.possibleScore||0)<=Number(run.confirmedScore||0))return"";
    const confirmed=Number(run.confirmedScore)||0,maximum=Number(run.maxScore)||110,possible=Math.min(maximum,Number(run.possibleScore)||confirmed),threshold=Number(run.threshold)||80,candidates=reviewCandidates(run);
    return `<section class="review-decision" data-review-run="${esc(run.runId)}" data-review-base="${esc(confirmed)}" data-review-count="${esc(candidates.length)}" data-review-threshold="${esc(threshold)}" data-review-max="${esc(maximum)}" data-review-mode="${isLegacy(run)?"weighted":"standard"}"><h3>${isLegacy(run)&&!candidates.length?"พร้อมยืนยันผลตรวจ":"ยืนยันองค์ประกอบที่รอตรวจ"}</h3><p>${isLegacy(run)&&!candidates.length?"ไม่เหลือรายการที่ต้องกรอกหรือยืนยันประเภทเพิ่มเติม ตรวจหลักฐานได้จากรายการด้านบน แล้วกดยืนยันผลเพื่อบันทึกตามคะแนนจริง":isLegacy(run)?"ตรวจแต่ละรายการจากปุ่มด้านบน หากลิงก์เสียจริงให้เลือกไม่นำมานับ ระบบจะคำนวณคะแนนจากรายการที่ยืนยันเท่านั้น":"หัวข้อทั่วไปเลือกผ่าน/ไม่ผ่าน ส่วนวิดีโอและ Podcast ให้เลือกใช้/ไม่ใช้รายลิงก์ ระบบจะคำนวณผลให้อัตโนมัติ"}</p><div class="review-score"><span>คะแนนหลังยืนยัน</span><strong data-review-total>${score(confirmed)} / ${score(maximum)}</strong><span data-review-result>เลือกผลให้ครบ ${candidates.length.toLocaleString(localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH")} หัวข้อ</span><span data-evidence-progress></span></div><div class="review-decision-grid"><label>บันทึกเหตุผลการยืนยัน (ถ้ามี)<textarea data-review-note placeholder="เช่น ตรวจหน้า Course profile แล้วพบข้อมูลผู้สอนครบ"></textarea></label><div class="review-actions"><button type="button" class="primary" data-review-save disabled>ยืนยันผลที่ระบบคำนวณ</button></div></div><div class="review-error" data-review-error></div></section>`;
  };

  const weekTone=week=>{
    const statuses=(week?.criteria||[]).map(item=>item.status);
    if(statuses.includes("fail"))return"fail";
    if(statuses.includes("needs_review"))return"review";
    return statuses.length&&statuses.every(value=>["pass","pass_tolerance","not_applicable"].includes(value))?"pass":"fail";
  };
  const sessionOverview=(weeks,interactive=false)=>{
    const bySession=new Map(weeks.map((week,index)=>[Number(week.session)||index+1,week]));
    const chips=Array.from({length:15},(_,index)=>{const session=index+1,tone=weekTone(bySession.get(session));return interactive?`<button type="button" class="session-chip ${tone}" data-session-select="${session}" aria-pressed="${session===1}"><span>ครั้งที่</span><strong>${session}</strong><i></i></button>`:`<span class="session-chip ${tone}"><span>ครั้งที่</span><strong>${session}</strong></span>`;}).join("");
    return `<section class="session-overview"><div class="session-overview-head"><div><span class="evidence-eyebrow">ภาพรวมรายครั้ง</span><h3>เห็นจุดที่ขาดได้โดยไม่ต้องเปิดทุกกล่อง</h3></div><div class="session-legend"><span><i class="pass"></i>ผ่าน</span><span><i class="review"></i>รอตรวจ</span><span><i class="fail"></i>ไม่ผ่าน</span></div></div><div class="session-strip">${chips}</div></section>`;
  };

  const setCourseOutcome=(run,superAdmin)=>{
    const node=$("courseOutcome");if(!node||!run)return;
    const status=run.publicStatus||run.internalStatus||"audit_failed",tone=resultTone(run),label=superAdmin&&isLegacy(run)&&status==="needs_review"?(run.legacyReviewBlocked?"ต้องตรวจสอบการอ่านข้อมูล":reviewCandidates(run).length?`รอยืนยัน ${reviewCandidates(run).length} รายการ`:"พร้อมบันทึกผลตามคะแนน"):AuditBridge.LABELS[status]||status;
    node.hidden=false;node.className=`course-outcome ${tone}`;
    node.innerHTML=`<span>ผลการตรวจล่าสุด</span><strong>${esc(label)}</strong><small>${superAdmin?"มุมมองผู้ตรวจ · มีรายละเอียดและหลักฐานครบถ้วน":"มุมมองผู้สอน · แสดงเฉพาะผลที่เผยแพร่และสิ่งที่ต้องแก้ไข"}</small>`;
  };

  function render(selected,history,superAdmin=false){
    const courseCode=String(selected.courseCode||"").trim();
    const rawCourseTitle=String(selected.courseTitle||selected.courseProfile||"").trim();
    const rawCourseProfile=String(selected.courseProfile||"").trim();
    const profileMatch=rawCourseTitle.match(/\[([^\[\]]+)\]\s*$/)||rawCourseProfile.match(/\[([^\[\]]+)\]\s*$/);
    const courseProfile=profileMatch?profileMatch[1].trim():rawCourseProfile.replace(/^\[\s*/,"").replace(/\s*\]$/,"");
    const courseTitle=rawCourseTitle.replace(/\s*\[[^\[\]]+\]\s*$/,"").trim();
    const courseName=[...new Set([courseCode,courseTitle].filter(Boolean))].join(" · ")||String(selected.courseId||"");
    const latest=history[0]||{},group=String(selected.group||latest.group||"").trim(),semester=String(selected.semesterCode||latest.semesterCode||"").trim(),faculty=String(selected.faculty||latest.faculty||"").trim();
    const creditValue=selected.credits||selected.creditUnits||latest.credits||latest.creditUnits||"";
    const details=[courseProfile?courseProfile:"",creditValue?`${creditValue} หน่วยกิต`:"",faculty].filter(Boolean);
    $("course").textContent=courseName;
    $("viewModeLabel").className="evidence-course-meta";
    $("viewModeLabel").innerHTML=`${group?`<span class="course-type-chip">${esc(group)}</span>`:""}${semester?`<span>ภาค ${esc(semester)}</span><i>·</i>`:""}<span>ตรวจล่าสุด ${esc(compactAuditDate(latest.auditedAt))}</span>`;
    $("courseLink").innerHTML=`${details.length?`<div class="course-detail-line">${details.map(item=>`<span>${esc(item)}</span>`).join("<i>·</i>")}</div>`:""}${selected.courseUrl?`<a class="course-open-link" href="${esc(selected.courseUrl)}" target="_blank" rel="noopener">เปิดรายวิชา ↗</a>`:""}`;
    if(!history.length){$("runs").innerHTML='<section class="panel empty-note">รายวิชานี้ยังไม่มีผลการตรวจในระบบ</section>';return;}
    document.body.classList.toggle("evidence-admin",superAdmin);document.body.classList.toggle("evidence-user",!superAdmin);document.body.classList.toggle("gr-legacy-review",superAdmin&&isLegacy(history[0])&&history[0].group==="GR");
    setCourseOutcome(history[0],superAdmin);
    if(!superAdmin){
      const latest=history[0],status=latest.publicStatus||latest.internalStatus||"audit_failed",tone=resultTone(latest),explanation=statusExplanation(status,latest,false),weeks=resultWeeks(latest);
      $("runs").innerHTML=`<div class="teacher-report"><section class="teacher-summary-grid"><article class="teacher-status ${tone}"><span class="teacher-summary-icon">✓</span><div><strong>${esc(AuditBridge.LABELS[status]||status)}</strong><span>สถานะผลตรวจ</span></div></article><article><span class="teacher-summary-icon">◷</span><div><strong>${esc(date(latest.auditedAt))}</strong><span>อัปเดตผลล่าสุด</span></div></article><article><span class="teacher-summary-icon">↻</span><div><strong>${esc(latest.auditorVersion||"—")}</strong><span>เวอร์ชันการตรวจ</span></div></article></section><section class="panel run"><section class="result-summary ${tone}"><h3>${esc(explanation.title)}</h3><p>${esc(explanation.text)}</p></section>${reviewerSummaryCard(latest)}${fixSummary(status,weeks)||'<div class="empty-note">ไม่พบรายการที่ต้องดำเนินการเพิ่มเติมจากผลที่เผยแพร่ล่าสุด</div>'}</section><section class="panel teacher-history"><h3>ประวัติผลตรวจที่เผยแพร่</h3><div class="teacher-history-list">${history.slice(0,3).map((run,index)=>{const itemStatus=run.publicStatus||run.internalStatus||"audit_failed",itemTone=resultTone(run);return `<article class="teacher-history-item"><div><strong>${index===0?"ผลตรวจล่าสุด":`ผลตรวจย้อนหลังครั้งที่ ${index}`}</strong><span>อัปเดต ${esc(date(run.auditedAt))} · Auditor ${esc(run.auditorVersion||"—")}</span></div><span class="status ${toneColor(itemTone)}">${esc(AuditBridge.LABELS[itemStatus]||itemStatus)}</span></article>`;}).join("")}</div><p class="teacher-privacy-note">หน้านี้แสดงเฉพาะผลที่เผยแพร่และสรุปสิ่งที่ต้องแก้ไข รายละเอียดหลักฐาน คะแนน และข้อมูลการยืนยันภายในจะแสดงเฉพาะผู้ตรวจที่มีสิทธิ์</p></section></div>`;
      window.OOEI18n?.translate(document);return;
    }
    $("runs").innerHTML=history.map((run,index)=>{
      const snapshot=run.evidenceSnapshot||{};
      const activities=Array.isArray(snapshot.activities)?snapshot.activities:[];
      const weeks=Array.isArray(snapshot.weeks)?snapshot.weeks:[];
      const reviewKeys=new Set(reviewCandidates(run).filter(item=>item.kind==="criterion").map(item=>item.key));
      const activityRows=activities.map((item,activityIndex)=>{
        const href=AuditBridge.safeUrl(item.externalUrl||item.href);
        const destination=href?` <a href="${esc(href)}" target="_blank" rel="noopener">เปิดหลักฐาน ↗</a>`:"";
        const session=Number(item.auditSession)||Number(String(item.section||"").match(/\d+/)?.[0])||0;
        const seconds=Number(item.reviewerDurationSeconds||item.systemDurationSeconds||item.durationSeconds||0);
        const prior=item.reviewReused?`<div class="reuse-note">ใช้ผลยืนยันเดิม${item.reviewerConfirmedAt?` · ${esc(date(item.reviewerConfirmedAt))}`:""}</div>`:"";
        return `<li><strong>${esc(item.section||`ครั้งที่ ${session||"—"}`)} — ${esc(item.title||item.kind||"หลักฐาน")}</strong>${destination}<div class="muted">ป้าย: ${esc(item.groupContext||"ไม่พบชื่อป้าย")} · ประเภท: ${esc(item.kind||"—")} · เวลา: ${esc(mediaTime(seconds))}</div><div class="muted">${esc(item.accessNote||item.linkStatus||"")}</div>${prior}</li>`;
      }).join("");
      const canReviewResult=["needs_review","has_content"].includes(run.internalStatus)&&(isLegacy(run)?reviewKeys.size>0:Number(run.possibleScore||0)>Number(run.confirmedScore||0));
      const reviewChoice=(key,label,eligible=reviewKeys.has(key))=>superAdmin&&index===0&&canReviewResult&&eligible?`<div class="review-choice" data-review-control><span>ยืนยันผลรายการนี้</span><div class="review-buttons" role="group" aria-label="ยืนยัน ${esc(label)}"><button type="button" class="review-pass" data-review-pick="pass" data-review-key="${esc(key)}">ผ่าน</button><button type="button" class="review-fail" data-review-pick="fail" data-review-key="${esc(key)}">ไม่ผ่าน</button></div><label class="review-edit">แก้ไขผล<select data-review-item data-review-key="${esc(key)}" aria-label="แก้ไขผล ${esc(label)}"><option value="">ยังไม่ตัดสิน</option><option value="pass">ผ่าน</option><option value="fail">ไม่ผ่าน</option></select></label></div>`:"";
      const itemizedReviewChoice=(key,label)=>superAdmin&&index===0&&canReviewResult&&reviewKeys.has(key)?`<div class="review-choice itemized-review" data-review-control><span data-itemized-result>กรอกเวลา Podcast หรือเลือกการใช้หลักฐานวิดีโอด้านบนให้ครบ ระบบจะสรุปหัวข้อนี้อัตโนมัติ</span><select data-review-item data-review-key="${esc(key)}" aria-label="ผลอัตโนมัติ ${esc(label)}" hidden><option value="">ยังไม่ตัดสิน</option><option value="pass">ผ่าน</option><option value="fail">ไม่ผ่าน</option></select></div>`:"";
      const legacyAdmin=isLegacy(run)&&run.group==="GR"&&superAdmin&&index===0;
      const priorityCards=[],detailDrawers=[];
      const weekRows=weeks.map((week,weekIndex)=>{
        const criteria=Array.isArray(week.criteria)?week.criteria:[];
        const items=criteria.map((item,criterionIndex)=>{
          const session=week.session||weekIndex+1,criterion=item.criterion||criterionIndex+1,excluded=isLegacy(run)&&legacyExcluded(session,criterion),optional=isLegacy(run)&&Number(session)>1&&Number(criterion)===7;
          const visibleStatus=excluded?"not_applicable":optional&&item.status==="fail"?"not_applicable":item.status;
          const label=(item.label||`หัวข้อที่ ${criterion}`)+(excluded?" (ไม่นับคะแนน)":optional?" (ไม่บังคับ)":"");
          const key=`criterion:${session}:${criterion}`,pending=reviewKeys.has(key)&&canReviewResult;
          const priority=legacyAdmin&&!excluded&&pending;
          const links=legacyAdmin?criterionEvidenceLinks(activities,session,label,item.originalDetail||item.detail,key,true,!pending,run.courseCredits):superAdmin&&index===0&&item.status==="needs_review"&&(!isLegacy(run)||reviewKeys.has(key))?criterionEvidenceLinks(activities,session,label,item.detail,key,isLegacy(run),false,run.courseCredits):"";
          const control=links.includes("data-evidence-item")?itemizedReviewChoice(key,label):reviewChoice(key,label);
          if(legacyAdmin){
            const dlgId=`review-${session}-${criterion}`;
            const count=(links.match(/data-evidence-item /g)||[]).length;
            const drawer=`<dialog class="review-drawer" id="${dlgId}"><div class="drawer-head"><div><span class="evidence-eyebrow">หลักฐานที่เกี่ยวข้อง</span><h3>${esc(label)} · ครั้งที่ ${esc(session)}</h3></div><button type="button" data-drawer-close aria-label="ปิด">×</button></div>${links||'<p class="muted">ไม่พบลิงก์หลักฐานที่ระบุได้ เปิดรายวิชาเพื่อตรวจสอบเพิ่มเติม</p>'}${pending&&count?'<button type="button" data-reject-session class="secondary">ไม่นำคลิปที่รอยืนยันในครั้งนี้มานับ</button>':""}${control}<div class="drawer-footer"><button type="button" class="primary" data-confirm-item="${esc(key)}">${pending?"ยืนยันรายการนี้":"ปิดหน้าต่าง"}</button><p class="muted" data-drawer-message></p></div></dialog>`;
            detailDrawers.push(drawer);
            if(priority)priorityCards.push(`<article class="priority-card pending"><span class="priority-number">${priorityCards.length+1}</span><div class="priority-copy"><strong>${esc(label)} · ครั้งที่ ${esc(session)}</strong><span class="priority-state" data-priority-state="${esc(key)}">รอยืนยัน</span><p>${esc(item.detail||"")}</p></div><button type="button" class="primary" data-open-evidence="${dlgId}">ตรวจและยืนยัน</button></article>`);
          }
          if(legacyAdmin)return `<article class="component-tile ${esc(visibleStatus||"")} ${Number(criterion)===(Number(session)===1?4:3)?"wide":""}"><span class="component-icon">${Number(criterion)===(Number(session)===1?4:3)?"▶":/แบบทดสอบ/.test(label)?"Q":/เอกสาร|แผน/.test(label)?"PDF":"✓"}</span><div><strong>${esc(label)}</strong><p>${esc(item.detail||"")}</p></div><button type="button" class="component-link" data-open-evidence="review-${session}-${criterion}">${pending?"ตรวจและยืนยัน":"เปิดหลักฐาน ↗"}</button></article>`;
          return `<li class="criterion ${esc(visibleStatus||"")}" id="detail-${index}-${session}-${criterion}"><strong>${esc(label)}</strong><span class="criterion-badge">${esc(criterionStatus(visibleStatus))}</span><div class="muted">${esc(item.detail||"")}</div>${priority?`<button type="button" data-open-evidence="review-${session}-${criterion}">${pending?"ตรวจและยืนยัน":"ดูหลักฐาน"}</button>`:links+control}</li>`;
        }).join("");
        if(legacyAdmin){const n=week.session||weekIndex+1,tone=weekTone(resultWeeks(run).find(w=>Number(w.session)===Number(n)));return `<section class="mock-week" data-session-detail="${n}"${Number(n)!==1?" hidden":""}><div class="week-head"><div><h3>ครั้งที่ ${n}</h3><p>${tone==="pass"?"องค์ประกอบที่นับคะแนนผ่านครบ":tone==="review"?"พบรายการรอยืนยัน":"พบองค์ประกอบที่ไม่ผ่านตามผลตรวจ"}</p></div><span class="media-tag ${tone}">${tone==="pass"?"ผ่านครบ":tone==="review"?"รอยืนยัน":"ไม่ผ่าน"}</span></div><div class="component-grid">${items}</div></section>`;}
        return `<section class="week-evidence"><h4>${esc(week.section||`ครั้งที่ ${week.session||"—"}`)}</h4><ol>${items}</ol></section>`;
      }).join("");
      const overviewRows=legacyAdmin?(()=>{const labels=new Map();for(const week of resultWeeks(run)){for(const item of week.criteria||[]){if(item.status==="not_applicable")continue;const label=String(item.label||"หัวข้อ"),row=labels.get(label)||{pass:0,review:0,fail:0,reviewSessions:[],failSessions:[]};if(["pass","pass_tolerance"].includes(item.status))row.pass++;else if(item.status==="needs_review"){row.review++;row.reviewSessions.push(week.session);}else{row.fail++;row.failSessions.push(week.session);}labels.set(label,row);}}return `<div class="component-summary"><table><thead><tr><th>องค์ประกอบ</th><th>ความครบถ้วน</th><th>สถานะ</th><th>คำอธิบาย</th></tr></thead><tbody>${[...labels].map(([label,row])=>{const total=row.pass+row.review+row.fail,tone=row.fail?"fail":row.review?"review":"pass";return `<tr class="${tone}"><td>${esc(label)}</td><td><div class="coverage-bar"><b>${row.pass} / ${total}</b><span><i style="width:${total?row.pass/total*100:0}%"></i></span></div></td><td><span class="media-tag ${tone}">${row.fail?"ไม่ผ่าน":row.review?"รอยืนยัน":"ผ่าน"}</span></td><td>${(row.fail||row.review)?[row.failSessions.length?(row.fail===total?"ไม่ผ่านทุกครั้ง · ":"ไม่ผ่าน · ")+"ครั้งที่ "+esc(sessionLabel(row.failSessions)):"",row.reviewSessions.length?"รอยืนยัน · ครั้งที่ "+esc(sessionLabel(row.reviewSessions)):""].filter(Boolean).join(" · "):"ครบตามเกณฑ์"}</td></tr>`;}).join("")}</tbody></table></div>`;})():"";
      const historyRows=legacyAdmin?`<div class="teacher-history-list">${history.map((item,i)=>`<article class="teacher-history-item"><div><strong>${i===0?"ผลตรวจล่าสุด":`ย้อนหลังครั้งที่ ${i}`}</strong><span>${esc(date(item.auditedAt))} · ${esc(AuditBridge.LABELS[item.internalStatus]||item.internalStatus)} · ${score(item.confirmedScore)} คะแนน</span></div>${i?`<button type="button" data-show-history="${i}">ดูรายละเอียด</button>`:""}</article>`).join("")}</div>`:"";
      const prioritySection=legacyAdmin&&priorityCards.length?`<section class="priority-panel"><div class="priority-head"><div><span class="evidence-eyebrow">ควรดูเป็นอันดับแรก</span><h2>รายการที่ต้องดำเนินการ</h2></div><span class="priority-count">${priorityCards.length} รายการ</span></div><div class="priority-grid">${priorityCards.join("")}</div>${detailDrawers.some(d=>d.includes("data-video-time"))?`<button type="button" class="secondary" data-reject-all-videos>ไม่นำลิงก์วิดีโอที่รอยืนยันทั้งหมดมานับ</button><p class="muted">ใช้เฉพาะเมื่อได้ตรวจสอบแล้วว่าลิงก์เหล่านี้ไม่สามารถนำมาคิดคะแนนได้จริง การเลือกนี้ยังไม่บันทึกผล</p>`:""}</section>`:"";
      const manualCandidates=reviewCandidates(run).filter(item=>item.kind==="manual");
      const manualRows=superAdmin&&index===0&&manualCandidates.length?`<section class="manual-review"><h3>ตารางที่ 3 — ข้อกำหนดภาพรวมที่ผู้ตรวจยืนยัน</h3><p class="muted">มีครบ 5 ข้อ ข้อละ 1 คะแนน และระบบจะรวมคะแนนจากตัวเลือกนี้ทันที</p><ol>${manualCandidates.map(item=>`<li><strong>${esc(item.label)}</strong><div class="muted">${esc(item.detail)}</div>${reviewChoice(item.key,item.label,true)}</li>`).join("")}</ol></section>`:"";
      const status=run.publicStatus||run.internalStatus,tone=resultTone(run);
      const maximum=Number.isFinite(Number(run.maxScore))?Number(run.maxScore):110;
      const possible=Number.isFinite(Number(run.possibleScore))?Math.min(maximum,Number(run.possibleScore)):null;
      const explanation=statusExplanation(status,run,superAdmin),quality=qualityMessage(run);
      const actions=explanation.actions.length?`<ul class="action-list">${explanation.actions.map(action=>`<li>${esc(action)}</li>`).join("")}</ul>`:"";
      const scoreFacts=superAdmin?`<div class="fact"><span>คะแนนที่ระบบยืนยัน</span><strong>${score(run.confirmedScore)} / ${score(maximum)}</strong></div><div class="fact"><span>คะแนนที่อาจได้</span><strong>${score(possible)} / ${score(maximum)}</strong></div><div class="fact"><span>คะแนนเกณฑ์ผ่าน</span><strong>${score(run.threshold)} / ${score(maximum)}</strong></div>`:"";
      const mockFacts=legacyAdmin?`<div class="facts mock-facts"><div class="fact"><strong>${resultWeeks(run).filter(w=>weekTone(w)==="pass").length} / 15</strong><span>ครั้งที่ผ่านครบ</span></div><div class="fact"><strong>${priorityCards.length}</strong><span>ประเด็นที่ต้องตรวจดู</span></div><div class="fact"><strong>${activities.length}</strong><span>หลักฐานที่พบ</span></div><div class="fact"><strong>${esc(run.auditorVersion||"—")}</strong><span>เวอร์ชันตัวตรวจ</span></div></div><div class="mock-score-note">คะแนนยืนยัน ${score(run.confirmedScore)} / ${maximum} · คะแนนที่อาจได้ ${score(possible)} · เกณฑ์ผ่าน ${score(run.threshold)}</div>`:"";
      const received=run.receivedAt?` · รับเข้าระบบ ${date(run.receivedAt)}`:"";
      return `<section class="panel run${legacyAdmin?" gr-mock-run":""}" data-run-index="${index}"${isLegacy(history[0])&&history[0].group==="GR"&&index>0?" hidden":""}><div class="run-head"><div><h2>${index===0?"ผลตรวจล่าสุด":`ผลย้อนหลังครั้งที่ ${index}`}</h2><p class="muted">ตรวจเมื่อ ${date(run.auditedAt)}${received} · Auditor ${esc(run.auditorVersion||"—")}</p></div><span class="status ${toneColor(tone)}">${esc(legacyAdmin&&status==="needs_review"&&!run.legacyReviewBlocked&&!reviewKeys.size?"พร้อมยืนยันผล":AuditBridge.LABELS[status])}</span></div>${mockFacts}<section class="result-summary ${tone}"><h3>${esc(explanation.title)}</h3><p>${esc(explanation.text)}</p>${actions}</section>${reviewerSummaryCard(run)}${prioritySection}${reviewPanel(run,index,superAdmin)}${legacyAdmin&&status==="needs_review"?"":fixSummary(status,resultWeeks(run))}${legacyAdmin?"":`<div class="facts">${scoreFacts}<div class="fact"><span>จำนวนหลักฐาน</span><strong>${activities.length}</strong></div></div>`}${quality?`<div class="quality-note">${esc(quality)}</div>`:""}${sessionOverview(isLegacy(run)?resultWeeks(run):weeks,legacyAdmin)}<div class="evidence-tabs" role="tablist">${legacyAdmin?'<button type="button" class="evidence-tab active" data-evidence-tab="overview">ภาพรวมองค์ประกอบ</button>':""}<button type="button" class="evidence-tab ${legacyAdmin?"":"active"}" data-evidence-tab="detail">รายละเอียดรายครั้ง</button><button type="button" class="evidence-tab" data-evidence-tab="all">หลักฐานทั้งหมด (${activities.length})</button>${legacyAdmin?'<button type="button" class="evidence-tab" data-evidence-tab="history">ประวัติการตรวจ</button>':""}</div>${legacyAdmin?`<div class="evidence-tab-panel" data-evidence-panel="overview">${overviewRows}</div><div class="evidence-tab-panel" data-evidence-panel="history" hidden>${historyRows}</div>`:""}<div class="evidence-tab-panel" data-evidence-panel="detail"${legacyAdmin?" hidden":""}>${weekRows?`<div class="${legacyAdmin?"mock-week-list":"week-evidence-grid"}">${weekRows}</div>`:'<div class="empty-note">ผลตรวจเดิมยังไม่มีรายละเอียดหัวข้อรายครั้ง กรุณาตรวจใหม่ด้วย Extension รุ่นปัจจุบัน</div>'}${manualRows}</div><div class="evidence-tab-panel" data-evidence-panel="all" hidden>${activityRows?`<ol class="evidence-list">${activityRows}</ol>`:'<div class="empty-note">ผลตรวจรุ่นนี้ยังไม่มีรายละเอียดหลักฐานแนบมา</div>'}</div>${detailDrawers.join("")}</section>`;
    }).join("");
    $("runs").querySelectorAll("[data-evidence-decision],[data-podcast-time]").forEach(control=>{if(control.value)control.dispatchEvent(new Event("change",{bubbles:true}));});
    updateReviewTotal($("runs").querySelector("[data-review-run]"));
    window.OOEI18n?.translate(document);
  }

  async function load(){
    try{
      const params=new URLSearchParams(location.search),courseId=params.get("courseId")||"",key=params.get("key")||"",admin=params.get("admin")==="1";
      if(AuditApi.enabled()){
        if(!courseId)throw new Error("ไม่พบรหัสรายวิชา");
        let superAdmin=false;
        if(admin){try{superAdmin=["owner","super_admin"].includes((await AuditApi.session()).role);}catch{superAdmin=false;}}
        const result=superAdmin?await AuditApi.adminCourseHistory(courseId):await AuditApi.courseHistory(courseId);
        const history=await Promise.all((result.runs||[]).map(async run=>({...run,evidenceSnapshot:await (superAdmin?AuditApi.adminEvidence(courseId,run.runId):AuditApi.evidence(courseId,run.runId))})));
        render(result,history,superAdmin);return;
      }
      const selected=AuditBridge.loadRecords().find(record=>(courseId&&String(record.courseId)===courseId)||AuditBridge.recordKey(record)===key);
      if(!selected)throw new Error("ไม่พบหลักฐานของรายวิชานี้");
      render(selected,AuditBridge.historyForCourse(selected),false);
    }catch(error){
      const code=String(error?.message||"");
      $("course").textContent=code==="course_not_found"
        ?"ไม่พบรายวิชานี้ในรายการภาคเรียนปัจจุบัน"
        :(code||"โหลดหลักฐานไม่สำเร็จ");
      $("runs").innerHTML=`<section class="panel empty-note">${code==="course_not_found"
        ?"ลิงก์นี้อาจเป็นของรายวิชาที่ถูกนำออกจากรายการตรวจ หรือรายการรายวิชายังไม่ได้ซิงก์เข้าระบบ"
        :"ผลตรวจอาจถูกย้าย ยังไม่ได้เผยแพร่ หรือบัญชีนี้ไม่มีสิทธิ์เข้าถึง"}</section>`;
    }
  }
  const updateReviewTotal=panel=>{
    if(!panel)return;
    const picks=[...$("runs").querySelectorAll("select[data-review-item]")],base=Number(panel.dataset.reviewBase||0),threshold=Number(panel.dataset.reviewThreshold||80),maximum=Number(panel.dataset.reviewMax||110),done=picks.filter(select=>select.value).length,earned=picks.filter(select=>select.value==="pass").length,total=Math.min(maximum,base+earned);
    const evidenceRows=[...$("runs").querySelectorAll("[data-evidence-item]")],evidenceDone=evidenceRows.filter(row=>{const time=row.querySelector("[data-evidence-time]")?.value||"";if(row.dataset.podcastTimeOnly==="1")return validDurationInput(time);const decision=row.querySelector("[data-evidence-decision]")?.value||"";return Boolean(decision)&&!(decision==="use"&&!usableDuration(time));}).length;
    const totalNode=panel.querySelector("[data-review-total]"),result=panel.querySelector("[data-review-result]"),progress=panel.querySelector("[data-evidence-progress]"),button=panel.querySelector("[data-review-save]");
    const weighted=panel.dataset.reviewMode==="weighted";
    if(totalNode)totalNode.textContent=weighted?`${score(base)} / ${score(maximum)} (ก่อนยืนยัน)`:`${score(total)} / ${score(maximum)}`;
    if(result)result.textContent=done===picks.length?(weighted?"ระบบจะคำนวณคะแนนถ่วงน้ำหนักและเงื่อนไขผ่านเมื่อยืนยัน":(total>=threshold?"ระบบคำนวณผล: ผ่าน":"ระบบคำนวณผล: ไม่ผ่านเกณฑ์")):`เลือกแล้ว ${done.toLocaleString(localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH")} / ${picks.length.toLocaleString(localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH")} หัวข้อ`;
    if(progress)progress.textContent=evidenceRows.length?`หลักฐานรายลิงก์ครบ ${evidenceDone.toLocaleString(localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH")} / ${evidenceRows.length.toLocaleString(localStorage.getItem("ooe-auditor-language")==="en"?"en-US":"th-TH")} รายการ`:"";
    if(button&&!button.dataset.submitting)button.disabled=weighted&&(done!==picks.length||evidenceDone!==evidenceRows.length);
  };
  const setReviewChoice=(control,value)=>{
    const select=control?.querySelector("select[data-review-item]");if(!select)return;
    select.value=value;control.classList.toggle("is-selected",Boolean(value));control.dataset.reviewValue=value;
    control.querySelectorAll("button[data-review-pick]").forEach(button=>button.classList.toggle("selected",button.dataset.reviewPick===value));
    const state=$("runs").querySelector(`[data-priority-state="${CSS.escape(select.dataset.reviewKey||"")}"]`);if(state)state.textContent=value==="pass"?"เลือกแล้ว · ผ่าน":value==="fail"?"เลือกแล้ว · ไม่ผ่าน":"รอยืนยัน";
    const itemizedResult=control.querySelector("[data-itemized-result]");if(itemizedResult)itemizedResult.textContent=value==="pass"?"ผลจากหลักฐานรายลิงก์: ผ่าน":value==="fail"?"ผลจากหลักฐานรายลิงก์: ไม่ผ่าน":"กรอกเวลา Podcast หรือเลือกการใช้หลักฐานวิดีโอด้านบนให้ครบ ระบบจะสรุปหัวข้อนี้อัตโนมัติ";
    updateReviewTotal($("runs").querySelector("[data-review-run]"));
  };
  $("runs").addEventListener("input",event=>{
    if(!event.target.matches("[data-podcast-time],[data-video-time]"))return;
    const formatted=event.target.matches("[data-video-time]")?continuousVideoTime(event.target.value):continuousPodcastTime(event.target.value);
    if(event.target.value!==formatted)event.target.value=formatted;
    event.target.setSelectionRange?.(event.target.value.length,event.target.value.length);
    event.target.dispatchEvent(new Event("change",{bubbles:true}));
  });
  $("runs").addEventListener("change",event=>{
    if(event.target.matches("select[data-review-item]")){setReviewChoice(event.target.closest("[data-review-control]"),event.target.value);return;}
    if(!event.target.matches("[data-evidence-decision],[data-evidence-time]"))return;
    const row=event.target.closest("[data-evidence-item]"),key=row?.dataset.criterionKey;if(!key)return;
    const manualTime=row.querySelector("[data-video-time]");if(manualTime)manualTime.disabled=row.querySelector("[data-evidence-decision]")?.value==="not_use";
    const rows=[...$("runs").querySelectorAll(`[data-evidence-item][data-criterion-key="${CSS.escape(key)}"]`)];
    const complete=rows.every(item=>{const time=item.querySelector("[data-evidence-time]")?.value||"";if(item.dataset.podcastTimeOnly==="1")return validDurationInput(time);const decision=item.querySelector("[data-evidence-decision]")?.value||"";return Boolean(decision)&&!(decision==="use"&&!usableDuration(time));});
    const select=$("runs").querySelector(`select[data-review-key="${CSS.escape(key)}"]`);
    if(!complete){if(select)setReviewChoice(select.closest("[data-review-control]"),"");else updateReviewTotal($("runs").querySelector("[data-review-run]"));return;}
    const seconds=rows.filter(item=>item.dataset.podcastTimeOnly==="1"||item.querySelector("[data-evidence-decision]")?.value==="use").reduce((sum,item)=>sum+parseDurationInput(item.querySelector("[data-evidence-time]")?.value),0);
    const required=Math.max(...rows.map(item=>Number(item.dataset.required||0)));
    if(select)setReviewChoice(select.closest("[data-review-control]"),seconds>=required?"pass":"fail");
  });
  $("runs").addEventListener("click",async event=>{
    const sessionButton=event.target.closest("[data-session-select]");if(sessionButton){const run=sessionButton.closest(".run"),n=sessionButton.dataset.sessionSelect;run.querySelectorAll("[data-session-select]").forEach(b=>b.setAttribute("aria-pressed",String(b===sessionButton)));run.querySelectorAll("[data-session-detail]").forEach(p=>p.hidden=p.dataset.sessionDetail!==n);run.querySelector('[data-evidence-tab="detail"]')?.click();return;}
    const preview=event.target.closest("[data-media-preview]");if(preview){const href=preview.dataset.mediaUrl,wrap=preview.parentElement;let frame;try{const url=new URL(href),id=url.hostname==="youtu.be"?url.pathname.slice(1):url.searchParams.get("v");if(["youtube.com","www.youtube.com","youtu.be"].includes(url.hostname)&&/^[\w-]{11}$/.test(id||"")){frame=document.createElement("iframe");frame.src="https://www.youtube-nocookie.com/embed/"+id;frame.title="ตัวอย่างวิดีโอ";frame.allowFullscreen=true;}else if(/\.(mp4|webm|ogg|mp3|m4a|wav)(?:[?#]|$)/i.test(href)){frame=document.createElement(preview.dataset.mediaKind==="audio"?"audio":"video");frame.controls=true;frame.preload="none";frame.src=href;}}catch{}if(frame){wrap.replaceChildren(frame);}else {preview.textContent="ไม่รองรับตัวอย่างในหน้าเว็บ กรุณาเปิดหลักฐานในแท็บใหม่";preview.disabled=true;}return;}
    const historyButton=event.target.closest("[data-show-history]");if(historyButton){const target=$("runs").querySelector(`[data-run-index="${CSS.escape(historyButton.dataset.showHistory)}"]`);if(target){target.hidden=false;target.scrollIntoView({behavior:"smooth",block:"start"});}return;}
    const tab=event.target.closest("[data-evidence-tab]");if(tab){const run=tab.closest(".run"),name=tab.dataset.evidenceTab;run?.querySelectorAll("[data-evidence-tab]").forEach(node=>node.classList.toggle("active",node===tab));run?.querySelectorAll("[data-evidence-panel]").forEach(panel=>panel.hidden=panel.dataset.evidencePanel!==name);return;}
    const open=event.target.closest("[data-open-evidence]");if(open){const dialog=$(open.dataset.openEvidence);if(dialog&&!dialog.open)dialog.showModal();return;}
    const close=event.target.closest("[data-drawer-close]");if(close){close.closest("dialog")?.close();return;}
    const reject=event.target.closest("[data-reject-session],[data-reject-all-videos]");if(reject){const all=reject.hasAttribute("data-reject-all-videos");if(!confirm(all?"ยืนยันว่าตรวจสอบแล้วและไม่นำวิดีโอทั้งหมดที่รอยืนยันมานับ?":"ยืนยันว่าไม่นำวิดีโอทุกลิงก์ในครั้งนี้มานับ?"))return;const scope=all?$("runs"):reject.closest("dialog");scope?.querySelectorAll("select[data-evidence-decision]:not(:disabled)").forEach(select=>{select.value="not_use";select.dispatchEvent(new Event("change",{bubbles:true}));});return;}
    const confirmItem=event.target.closest("[data-confirm-item]");if(confirmItem){const dialog=confirmItem.closest("dialog"),select=dialog?.querySelector("select[data-review-item]"),msg=dialog?.querySelector("[data-drawer-message]");if(select&&!select.value){if(msg)msg.textContent="กรุณาเลือกและกรอกข้อมูลหลักฐานให้ครบก่อน";return;}if(select){const state=$("runs").querySelector(`[data-priority-state="${CSS.escape(confirmItem.dataset.confirmItem)}"]`);if(state)state.textContent=select.value==="pass"?"ยืนยันแล้ว · ผ่าน":"ยืนยันแล้ว · ไม่ผ่าน";}dialog?.close();return;}
    const pick=event.target.closest("button[data-review-pick]");if(pick){setReviewChoice(pick.closest("[data-review-control]"),pick.dataset.reviewPick);return;}
    const button=event.target.closest("button[data-review-save]");if(!button)return;
    const panel=button.closest("[data-review-run]"),error=panel?.querySelector("[data-review-error]");
    const note=panel?.querySelector("[data-review-note]")?.value||"";
    const runId=panel?.dataset.reviewRun||"";
    if(!runId)return;
    if(error)error.textContent="";
    const reviewControls=[...$("runs").querySelectorAll("select[data-review-item]")],reviewDecisions=reviewControls.map(select=>({key:select.dataset.reviewKey,accepted:select.value==="pass"}));
    const evidenceDecisions=[...$("runs").querySelectorAll("[data-evidence-item]")].map(row=>({key:row.querySelector("[data-evidence-key]")?.dataset.evidenceKey||"",criterionKey:row.dataset.criterionKey||"",decision:row.dataset.podcastTimeOnly==="1"?"use":row.querySelector("[data-evidence-decision]")?.value||"",seconds:parseDurationInput(row.querySelector("[data-evidence-time]")?.value),timeValid:row.dataset.podcastTimeOnly==="1"?validDurationInput(row.querySelector("[data-evidence-time]")?.value):usableDuration(row.querySelector("[data-evidence-time]")?.value)}));
    const missingReview=reviewControls.filter(select=>!select.dataset.reviewKey||!select.value),missingEvidence=evidenceDecisions.filter(item=>!item.decision||item.decision==="use"&&!item.timeValid);
    if(missingReview.length||reviewDecisions.length!==Number(panel.dataset.reviewCount)){const remaining=Math.max(missingReview.length,Number(panel.dataset.reviewCount)-reviewDecisions.length,1),message=`ยังไม่ได้ส่งคำสั่ง: กรุณายืนยันผลอีก ${remaining} หัวข้อ`;missingReview.forEach(select=>select.closest("[data-review-control]")?.classList.add("review-missing"));if(error)error.textContent=message;reviewNotice(message,"error");missingReview[0]?.closest("[data-review-control]")?.scrollIntoView?.({behavior:"smooth",block:"center"});return;}
    if(missingEvidence.length){const message=`ยังไม่ได้ส่งคำสั่ง: กรุณากรอกหรือยืนยันหลักฐานอีก ${missingEvidence.length} รายการ`;if(error)error.textContent=message;reviewNotice(message,"error");return;}
    button.dataset.submitting="1";button.disabled=true;button.setAttribute("aria-busy","true");button.textContent="กำลังบันทึกผล…";reviewNotice("รับคำสั่งยืนยันผลแล้ว กำลังบันทึกและคำนวณผลใหม่…","loading");
    try{const saved=await AuditApi.decideResult(runId,reviewDecisions,note,evidenceDecisions);if(saved?.sheetSync?.ok===false||saved?.sheetSync?.configured===false){await load();reviewNotice(saved?.sheetSync?.durable?"บันทึกผลแล้ว · ระบบเก็บคิวรอซิงก์ Main Data ไว้":"บันทึกผลในฐานข้อมูลแล้ว แต่การซิงก์ Main Data ยังไม่ได้รับการยืนยัน","error");return;}button.textContent="บันทึกแล้ว กำลังโหลดผลใหม่…";reviewNotice("บันทึกผลสำเร็จ กำลังโหลดสถานะล่าสุด…","loading");await load();reviewNotice("อัปเดตผลยืนยันเรียบร้อยแล้ว","success");}
    catch(err){const message=err.message||"บันทึกผลไม่สำเร็จ";if(error)error.textContent=message;reviewNotice(`บันทึกผลไม่สำเร็จ: ${message}`,"error");button.dataset.submitting="";button.removeAttribute("aria-busy");button.textContent="ลองยืนยันผลอีกครั้ง";button.disabled=false;}
  });
  document.addEventListener("close",event=>{if(event.target.matches?.("dialog.review-drawer")){event.target.querySelectorAll("video,audio").forEach(m=>m.pause());event.target.querySelectorAll("iframe").forEach(f=>f.remove());}},true);
  load();
})();



