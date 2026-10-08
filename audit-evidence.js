(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const date=value=>value?new Date(value).toLocaleString("th-TH",{dateStyle:"long",timeStyle:"short"}):"—";
  const score=value=>value!==null&&value!==""&&Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";
  const criterionStatus=value=>({pass:"ผ่าน",pass_tolerance:"ผ่านตามค่าผ่อนปรน",needs_review:"รอตรวจ",fail:"ไม่ผ่าน",not_applicable:"ไม่มีข้อบังคับ/ไม่มี"}[value]||value||"—");
  const MANUAL_REVIEW_ITEMS=[
    ["student_meetings","การจัดให้มีการพบนักศึกษา","กำหนดตารางพบนักศึกษารวม 3 ครั้ง"],
    ["video_quality","คุณภาพวิดีโอบันทึกการสอน","ระดับ B+ ขึ้นไป (รายวิชานอกแผน ระดับ B ขึ้นไป)"],
    ["media_placement","การวางสื่อใน d-Learning","วิดีโอและ Podcast เป็นลิงก์ ไม่อัปโหลดไฟล์โดยตรง"],
    ["submission_policy","การส่งงานของนักศึกษา","ไม่กำหนดให้นำส่งงานภายใน d-Learning"],
    ["backup","การสำรองเนื้อหา","จัดเก็บเนื้อหาและวิดีโอตามช่วงเวลาที่มหาวิทยาลัยกำหนด"]
  ];
  const reviewCandidates=run=>{
    const snapshot=run.evidenceSnapshot||{},weeks=Array.isArray(snapshot.weeks)?snapshot.weeks:[];
    const fromSource=Array.isArray(run.reviewableCriteria)?run.reviewableCriteria:[];
    const criteria=(fromSource.length?fromSource:weeks.flatMap((week,weekIndex)=>(week.criteria||[]).filter(item=>item.status==="needs_review").map(item=>({session:week.session||weekIndex+1,criterion:item.criterion,detail:item.detail||""}))))
      .map(item=>({key:`criterion:${item.session}:${item.criterion}`,label:`ครั้งที่ ${item.session} · หัวข้อที่ ${item.criterion}`,detail:item.detail||"",kind:"criterion"}));
    const manual=String(run.group||"").toUpperCase()==="GN"?[]:MANUAL_REVIEW_ITEMS.map(([key,label,detail])=>({key:`manual:${key}`,label,detail,kind:"manual"}));
    const count=Math.max(0,Math.round(Number(run.possibleScore||0)-Number(run.confirmedScore||0)));
    return [...criteria,...manual].slice(0,count);
  };
  const statusExplanation=(status,run)=>{
    const confirmed=Number(run.confirmedScore)||0,possible=Number(run.possibleScore)||0,threshold=Number(run.threshold)||80;
    if(status==="pass")return {title:"ผ่านเกณฑ์แล้ว",text:`คะแนนยืนยัน ${score(confirmed)} ถึงเกณฑ์ ${score(threshold)} คะแนน จากคะแนนเต็ม 110 คะแนน`,actions:[]};
    if(status==="needs_review")return {title:"รอตรวจโดยทีมตรวจ",text:`คะแนนยืนยัน ${score(confirmed)} ยังไม่ถึงเกณฑ์ แต่คะแนนที่อาจได้ ${score(possible)} อาจถึง ${score(threshold)} คะแนน จึงต้องให้ทีมตรวจยืนยันหลักฐานก่อน`,actions:["ผู้สอนไม่ต้องส่งคำยืนยันในหน้านี้ แต่ควรเตรียมหลักฐานของหัวข้อที่ระบุว่า “รอตรวจ” ไว้ให้ทีมตรวจ"]};
    if(status==="has_content")return {title:"มีเนื้อหา แต่ยังไม่ถึงเกณฑ์",text:`คะแนนที่อาจได้สูงสุด ${score(possible)} ยังต่ำกว่าเกณฑ์ ${score(threshold)} คะแนน จากคะแนนเต็ม 110 คะแนน`,actions:["แก้ไขหรือเพิ่มเฉพาะหัวข้อที่แสดงว่า “ไม่ผ่าน” ด้านล่าง แล้วตรวจใหม่เพื่อยืนยันคะแนน"]};
    if(status==="no_content")return {title:"ยังไม่พบองค์ประกอบรายวิชา",text:"ระบบตรวจสำเร็จแล้ว แต่ไม่พบองค์ประกอบที่ใช้คำนวณคะแนน",actions:["เพิ่มองค์ประกอบการสอนและหลักฐานในรายวิชา แล้วตรวจใหม่"]};
    return {title:"ตรวจไม่สำเร็จ",text:"ระบบเข้าถึงหรืออ่านข้อมูลได้ไม่ครบ จึงยังสรุปผลรายวิชาไม่ได้",actions:["ตรวจสอบสิทธิ์เข้าถึงรายวิชาและลิงก์ภายนอก แล้วรันการตรวจใหม่"]};
  };
  const qualityMessage=run=>{
    const failures=run.qualityGate?.failures;
    if(!Array.isArray(failures)||!failures.length)return"";
    const labels={schema_outdated:"รูปแบบผลตรวจเป็นรุ่นเก่า",score_model_outdated:"โมเดลคะแนนเป็นรุ่นเก่า",auditor_version_outdated:"Extension เป็นรุ่นเก่า",scan_incomplete:"การอ่านข้อมูลยังไม่ครบ"};
    return `ข้อควรระวังคุณภาพข้อมูล: ${failures.map(value=>labels[value]||value).join(" · ")} — สถานะรายวิชายังคงอิงคะแนนและหลักฐานที่แสดงด้านล่าง`;
  };
  const reviewPanel=(run,index,admin)=>{
    if(!admin||index!==0||run.internalStatus!=="needs_review"||!run.runId)return"";
    const confirmed=Number(run.confirmedScore)||0,possible=Math.min(Number(run.maxScore)||110,Number(run.possibleScore)||confirmed),threshold=Number(run.threshold)||80,candidates=reviewCandidates(run);
    return `<section class="review-decision" data-review-run="${esc(run.runId)}" data-review-base="${esc(confirmed)}" data-review-count="${esc(candidates.length)}" data-review-threshold="${esc(threshold)}"><h3>ยืนยันองค์ประกอบที่รอตรวจ</h3><p>เลือก “ให้คะแนน” หรือ “ไม่ให้คะแนน” ที่หัวข้อสีส้มด้านล่าง ระบบจะคำนวณผลรวมให้อัตโนมัติตามเกณฑ์เดียวกับ Extension</p><div class="review-score"><span>คะแนนหลังยืนยัน</span><strong data-review-total>${score(confirmed)} / 110</strong><span data-review-result>เลือกผลให้ครบ ${candidates.length.toLocaleString("th-TH")} หัวข้อ</span></div><div class="review-decision-grid"><label>บันทึกเหตุผลการยืนยัน (ถ้ามี)<textarea data-review-note placeholder="เช่น ตรวจหน้า Course profile แล้วพบข้อมูลผู้สอนครบ"></textarea></label><div class="review-actions"><button type="button" class="primary" data-review-save disabled>ยืนยันผลที่ระบบคำนวณ</button></div></div><div class="review-error" data-review-error></div></section>`;
  };

  function render(selected,history,admin=false){
    $("course").textContent=[selected.courseCode,selected.courseProfile,selected.courseTitle].filter(Boolean).join(" · ")||selected.courseId;
    if(selected.courseUrl)$("courseLink").innerHTML=`<a href="${esc(selected.courseUrl)}" target="_blank" rel="noopener">เปิดรายวิชา ↗</a>`;
    $("runs").innerHTML=history.map((run,index)=>{
      const snapshot=run.evidenceSnapshot||{};
      const activities=Array.isArray(snapshot.activities)?snapshot.activities:[];
      const weeks=Array.isArray(snapshot.weeks)?snapshot.weeks:[];
      const activityRows=activities.slice(0,200).map(item=>{
        const href=AuditBridge.safeUrl(item.externalUrl||item.href);
        const destination=href?` <a href="${esc(href)}" target="_blank" rel="noopener">เปิดหลักฐาน ↗</a>`:"";
        return `<li><strong>${esc(item.section||"ไม่ระบุครั้ง")} — ${esc(item.title||item.kind||"หลักฐาน")}</strong>${destination}<div class="muted">${esc(item.accessNote||item.linkStatus||"")}</div></li>`;
      }).join("");
      const reviewKeys=new Set(reviewCandidates(run).filter(item=>item.kind==="criterion").map(item=>item.key));
      const reviewChoice=(key,label,eligible=reviewKeys.has(key))=>admin&&index===0&&eligible?`<div class="review-choice" data-review-control><span>ยืนยันผลรายการนี้</span><div class="review-buttons" role="group" aria-label="ยืนยัน ${esc(label)}"><button type="button" class="review-pass" data-review-pick="pass" data-review-key="${esc(key)}">ผ่าน</button><button type="button" class="review-fail" data-review-pick="fail" data-review-key="${esc(key)}">ไม่ผ่าน</button></div><label class="review-edit">แก้ไขผล<select data-review-item data-review-key="${esc(key)}" aria-label="แก้ไขผล ${esc(label)}"><option value="">ยังไม่ตัดสิน</option><option value="pass">ผ่าน</option><option value="fail">ไม่ผ่าน</option></select></label></div>`:"";
      const weekRows=weeks.map((week,weekIndex)=>{
        const criteria=Array.isArray(week.criteria)?week.criteria:[];
        const items=criteria.map((item,criterionIndex)=>{const label=item.label||`หัวข้อที่ ${item.criterion||"—"}`,key=`criterion:${week.session||weekIndex+1}:${item.criterion||criterionIndex+1}`;return `<li class="criterion ${esc(item.status||"")}"><strong>${esc(label)}</strong><span class="criterion-badge">${esc(criterionStatus(item.status))}</span><div class="muted">${esc(item.detail||"")}</div>${reviewChoice(key,label)}</li>`;}).join("");
        return `<section class="week-evidence"><h4>${esc(week.section||`ครั้งที่ ${week.session||"—"}`)}</h4><ol>${items}</ol></section>`;
      }).join("");
      const manualCandidates=reviewCandidates(run).filter(item=>item.kind==="manual");
      const manualRows=admin&&index===0&&manualCandidates.length?`<section class="manual-review"><h3>ข้อกำหนดภาพรวมที่ผู้ตรวจยืนยัน</h3><p class="muted">ข้อละ 1 คะแนน และระบบจะรวมคะแนนจากตัวเลือกนี้ทันที</p><ol>${manualCandidates.map(item=>`<li><strong>${esc(item.label)}</strong><div class="muted">${esc(item.detail)}</div>${reviewChoice(item.key,item.label,true)}</li>`).join("")}</ol></section>`:"";
      const status=run.publicStatus||run.internalStatus;
      const maximum=Number.isFinite(Number(run.maxScore))?Number(run.maxScore):110;
      const possible=Number.isFinite(Number(run.possibleScore))?Math.min(maximum,Number(run.possibleScore)):null;
      const explanation=statusExplanation(status,run),quality=qualityMessage(run);
      const actions=explanation.actions.length?`<ul class="action-list">${explanation.actions.map(action=>`<li>${esc(action)}</li>`).join("")}</ul>`:"";
      return `<section class="panel run"><div class="run-head"><div><h2>${index===0?"ผลตรวจล่าสุด":`ผลย้อนหลังครั้งที่ ${index}`}</h2><p class="muted">${date(run.auditedAt)} · Auditor ${esc(run.auditorVersion||"—")}</p></div><span class="status ${AuditBridge.COLORS[status]}">${esc(AuditBridge.LABELS[status])}</span></div><section class="result-summary ${esc(status||"")}"><h3>${esc(explanation.title)}</h3><p>${esc(explanation.text)}</p>${actions}</section>${reviewPanel(run,index,admin)}<div class="facts"><div class="fact"><span>คะแนนยืนยัน</span><strong>${score(run.confirmedScore)} / ${score(maximum)}</strong></div><div class="fact"><span>คะแนนที่อาจได้</span><strong>${score(possible)} / ${score(maximum)}</strong></div><div class="fact"><span>เกณฑ์ผ่าน</span><strong>${score(run.threshold)} / ${score(maximum)}</strong></div><div class="fact"><span>จำนวนหลักฐาน</span><strong>${activities.length.toLocaleString("th-TH")}</strong></div></div>${quality?`<div class="quality-note">${esc(quality)}</div>`:""}${weekRows?`<h3>ผลตรวจตามครั้ง/สัปดาห์</h3><div class="week-evidence-grid">${weekRows}</div>`:'<div class="empty-note">ผลตรวจเดิมยังไม่มีรายละเอียดหัวข้อรายครั้ง กรุณาตรวจใหม่ด้วย Extension รุ่น 0.13.10</div>'}${manualRows}${activityRows?`<h3>หลักฐานที่ตรวจพบ</h3><ol class="evidence-list">${activityRows}</ol>`:'<div class="empty-note">ผลตรวจรุ่นนี้ยังไม่มีรายละเอียดหลักฐานแนบมา</div>'}</section>`;
    }).join("");
  }

  async function load(){
    try{
      const params=new URLSearchParams(location.search),courseId=params.get("courseId")||"",key=params.get("key")||"",admin=params.get("admin")==="1";
      if(AuditApi.enabled()){
        if(!courseId)throw new Error("ไม่พบรหัสรายวิชา");
        const result=admin?await AuditApi.adminCourseHistory(courseId):await AuditApi.courseHistory(courseId);
        const history=await Promise.all((result.runs||[]).map(async run=>({...run,evidenceSnapshot:await (admin?AuditApi.adminEvidence(courseId,run.runId):AuditApi.evidence(courseId,run.runId))})));
        render(result,history,admin);return;
      }
      const selected=AuditBridge.loadRecords().find(record=>(courseId&&String(record.courseId)===courseId)||AuditBridge.recordKey(record)===key);
      if(!selected)throw new Error("ไม่พบหลักฐานของรายวิชานี้");
      render(selected,AuditBridge.historyForCourse(selected),false);
    }catch(error){
      $("course").textContent=error.message||"โหลดหลักฐานไม่สำเร็จ";
      $("runs").innerHTML='<section class="panel empty-note">ผลตรวจอาจถูกย้าย ยังไม่ได้เผยแพร่ หรือบัญชีนี้ไม่มีสิทธิ์เข้าถึง</section>';
    }
  }
  const updateReviewTotal=panel=>{
    if(!panel)return;
    const picks=[...$("runs").querySelectorAll("select[data-review-item]")],base=Number(panel.dataset.reviewBase||0),threshold=Number(panel.dataset.reviewThreshold||80),done=picks.filter(select=>select.value).length,earned=picks.filter(select=>select.value==="pass").length,total=base+earned;
    const totalNode=panel.querySelector("[data-review-total]"),result=panel.querySelector("[data-review-result]"),button=panel.querySelector("[data-review-save]");
    if(totalNode)totalNode.textContent=`${score(total)} / 110`;
    if(result)result.textContent=done===picks.length?(total>=threshold?"ระบบคำนวณผล: ผ่าน":"ระบบคำนวณผล: มีเนื้อหา แต่ยังไม่ถึงเกณฑ์"):`เลือกแล้ว ${done.toLocaleString("th-TH")} / ${picks.length.toLocaleString("th-TH")} หัวข้อ`;
    if(button)button.disabled=done!==picks.length;
  };
  const setReviewChoice=(control,value)=>{
    const select=control?.querySelector("select[data-review-item]");if(!select)return;
    select.value=value;control.classList.toggle("is-selected",Boolean(value));control.dataset.reviewValue=value;
    control.querySelectorAll("button[data-review-pick]").forEach(button=>button.classList.toggle("selected",button.dataset.reviewPick===value));
    updateReviewTotal($("runs").querySelector("[data-review-run]"));
  };
  $("runs").addEventListener("change",event=>{if(!event.target.matches("select[data-review-item]"))return;setReviewChoice(event.target.closest("[data-review-control]"),event.target.value);});
  $("runs").addEventListener("click",async event=>{
    const pick=event.target.closest("button[data-review-pick]");if(pick){setReviewChoice(pick.closest("[data-review-control]"),pick.dataset.reviewPick);return;}
    const button=event.target.closest("button[data-review-save]");if(!button)return;
    const panel=button.closest("[data-review-run]"),error=panel?.querySelector("[data-review-error]");
    const note=panel?.querySelector("[data-review-note]")?.value||"";
    const runId=panel?.dataset.reviewRun||"";
    if(!runId)return;
    if(error)error.textContent="";
    const reviewDecisions=[...$("runs").querySelectorAll("select[data-review-item]")].map(select=>({key:select.dataset.reviewKey,accepted:select.value==="pass"}));
    if(reviewDecisions.some(item=>!item.key)||reviewDecisions.length!==Number(panel.dataset.reviewCount)){if(error)error.textContent="กรุณาเลือกผลยืนยันทุกหัวข้อก่อนบันทึก";return;}
    button.disabled=true;
    try{await AuditApi.decideResult(runId,reviewDecisions,note);await load();}
    catch(err){if(error)error.textContent=err.message||"บันทึกผลไม่สำเร็จ";button.disabled=false;}
  });
  load();
})();
