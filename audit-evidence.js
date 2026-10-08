(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const date=value=>value?new Date(value).toLocaleString("th-TH",{dateStyle:"long",timeStyle:"short"}):"—";
  const score=value=>value!==null&&value!==""&&Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";
  const criterionStatus=value=>({pass:"ผ่าน",pass_tolerance:"ผ่านตามค่าผ่อนปรน",needs_review:"รอตรวจ",fail:"ไม่ผ่าน",not_applicable:"ไม่มีข้อบังคับ/ไม่มี"}[value]||value||"—");
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
    const confirmed=Number(run.confirmedScore)||0,possible=Math.min(Number(run.maxScore)||110,Number(run.possibleScore)||confirmed),threshold=Number(run.threshold)||80;
    return `<section class="review-decision" data-review-run="${esc(run.runId)}" data-review-min="${esc(confirmed)}" data-review-max="${esc(possible)}" data-review-threshold="${esc(threshold)}"><h3>ยืนยันผลโดยทีมตรวจ</h3><p>ตรวจหลักฐานและหัวข้อ “รอตรวจ” ในหน้านี้หรือเปิดรายวิชา แล้วบันทึกผลสุดท้ายได้ทันที</p><div class="review-decision-grid"><label>ผลยืนยัน<select data-review-decision><option value="pass">ผ่าน</option><option value="has_content">มีเนื้อหา</option><option value="no_content">ไม่มีเนื้อหา</option></select></label><label>คะแนนยืนยันหลังตรวจ<input type="number" data-review-score min="${esc(confirmed)}" max="${esc(possible)}" step="1" value="${esc(possible)}"><span class="review-hint">กรอกได้ ${score(confirmed)}–${score(possible)} คะแนน · เกณฑ์ผ่าน ${score(threshold)}</span></label><label>บันทึกเหตุผลการยืนยัน (ถ้ามี)<textarea data-review-note placeholder="เช่น ยืนยันข้อมูลผู้สอนจากหน้า Course profile"></textarea></label><div class="review-actions"><button type="button" class="primary" data-review-save>ยืนยันและเผยแพร่ผล</button></div></div><div class="review-error" data-review-error></div></section>`;
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
      const weekRows=weeks.map(week=>{
        const criteria=Array.isArray(week.criteria)?week.criteria:[];
        const items=criteria.map(item=>`<li class="criterion ${esc(item.status||"")}"><strong>${esc(item.label||`หัวข้อที่ ${item.criterion||"—"}`)}</strong><span class="criterion-badge">${esc(criterionStatus(item.status))}</span><div class="muted">${esc(item.detail||"")}</div></li>`).join("");
        return `<section class="week-evidence"><h4>${esc(week.section||`ครั้งที่ ${week.session||"—"}`)}</h4><ol>${items}</ol></section>`;
      }).join("");
      const status=run.publicStatus||run.internalStatus;
      const maximum=Number.isFinite(Number(run.maxScore))?Number(run.maxScore):110;
      const possible=Number.isFinite(Number(run.possibleScore))?Math.min(maximum,Number(run.possibleScore)):null;
      const explanation=statusExplanation(status,run),quality=qualityMessage(run);
      const actions=explanation.actions.length?`<ul class="action-list">${explanation.actions.map(action=>`<li>${esc(action)}</li>`).join("")}</ul>`:"";
      return `<section class="panel run"><div class="run-head"><div><h2>${index===0?"ผลตรวจล่าสุด":`ผลย้อนหลังครั้งที่ ${index}`}</h2><p class="muted">${date(run.auditedAt)} · Auditor ${esc(run.auditorVersion||"—")}</p></div><span class="status ${AuditBridge.COLORS[status]}">${esc(AuditBridge.LABELS[status])}</span></div><section class="result-summary ${esc(status||"")}"><h3>${esc(explanation.title)}</h3><p>${esc(explanation.text)}</p>${actions}</section>${reviewPanel(run,index,admin)}<div class="facts"><div class="fact"><span>คะแนนยืนยัน</span><strong>${score(run.confirmedScore)} / ${score(maximum)}</strong></div><div class="fact"><span>คะแนนที่อาจได้</span><strong>${score(possible)} / ${score(maximum)}</strong></div><div class="fact"><span>เกณฑ์ผ่าน</span><strong>${score(run.threshold)} / ${score(maximum)}</strong></div><div class="fact"><span>จำนวนหลักฐาน</span><strong>${activities.length.toLocaleString("th-TH")}</strong></div></div>${quality?`<div class="quality-note">${esc(quality)}</div>`:""}${weekRows?`<h3>ผลตรวจตามครั้ง/สัปดาห์</h3><div class="week-evidence-grid">${weekRows}</div>`:'<div class="empty-note">ผลตรวจเดิมยังไม่มีรายละเอียดหัวข้อรายครั้ง กรุณาตรวจใหม่ด้วย Extension รุ่น 0.13.10</div>'}${activityRows?`<h3>หลักฐานที่ตรวจพบ</h3><ol class="evidence-list">${activityRows}</ol>`:'<div class="empty-note">ผลตรวจรุ่นนี้ยังไม่มีรายละเอียดหลักฐานแนบมา</div>'}</section>`;
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
  $("runs").addEventListener("change",event=>{
    const select=event.target.closest("select[data-review-decision]");if(!select)return;
    const panel=select.closest("[data-review-run]"),input=panel?.querySelector("[data-review-score]");if(!input)return;
    const noContent=select.value==="no_content";
    input.min=noContent?"0":panel.dataset.reviewMin||"0";
    input.max=noContent?"0":panel.dataset.reviewMax||"110";
    input.value=noContent?"0":panel.dataset.reviewMax||"";
  });
  $("runs").addEventListener("click",async event=>{
    const button=event.target.closest("button[data-review-save]");if(!button)return;
    const panel=button.closest("[data-review-run]"),error=panel?.querySelector("[data-review-error]");
    const decision=panel?.querySelector("[data-review-decision]")?.value||"";
    const confirmedScore=Number(panel?.querySelector("[data-review-score]")?.value);
    const note=panel?.querySelector("[data-review-note]")?.value||"";
    const runId=panel?.dataset.reviewRun||"";
    if(!runId)return;
    if(error)error.textContent="";
    const minimum=Number(panel.dataset.reviewMin),maximum=Number(panel.dataset.reviewMax),threshold=Number(panel.dataset.reviewThreshold);
    if(decision==="no_content"&&confirmedScore!==0){if(error)error.textContent="ผล “ไม่มีเนื้อหา” ต้องยืนยันคะแนนเป็น 0";return;}
    if(decision!=="no_content"&&(confirmedScore<minimum||confirmedScore>maximum)){if(error)error.textContent=`คะแนนยืนยันต้องอยู่ระหว่าง ${score(minimum)}–${score(maximum)} คะแนน`;return;}
    if(decision==="pass"&&confirmedScore<threshold){if(error)error.textContent=`ผล “ผ่าน” ต้องมีคะแนนอย่างน้อย ${score(threshold)} คะแนน`;return;}
    if(decision!=="pass"&&confirmedScore>=threshold){if(error)error.textContent=`ผลที่ไม่ผ่านต้องมีคะแนนต่ำกว่า ${score(threshold)} คะแนน`;return;}
    button.disabled=true;
    try{await AuditApi.decideResult(runId,decision,confirmedScore,note);await load();}
    catch(err){if(error)error.textContent=err.message||"บันทึกผลไม่สำเร็จ";button.disabled=false;}
  });
  load();
})();
