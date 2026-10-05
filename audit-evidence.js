(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const date=value=>value?new Date(value).toLocaleString("th-TH",{dateStyle:"long",timeStyle:"short"}):"—";
  const score=value=>value!==null&&value!==""&&Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";
  const criterionStatus=value=>({pass:"ผ่าน",pass_tolerance:"ผ่านตามค่าผ่อนปรน",needs_review:"รอตรวจ",fail:"ไม่ผ่าน",not_applicable:"ไม่มีข้อบังคับ/ไม่มี"}[value]||value||"—");

  function render(selected,history){
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
        const items=criteria.map(item=>`<li><strong>${esc(item.label||`หัวข้อที่ ${item.criterion||"—"}`)}</strong> — ${esc(criterionStatus(item.status))}<div class="muted">${esc(item.detail||"")}</div></li>`).join("");
        return `<section class="week-evidence"><h4>${esc(week.section||`ครั้งที่ ${week.session||"—"}`)}</h4><ol>${items}</ol></section>`;
      }).join("");
      const status=run.publicStatus||run.internalStatus;
      const maximum=Number.isFinite(Number(run.maxScore))?Number(run.maxScore):110;
      const possible=Number.isFinite(Number(run.possibleScore))?Math.min(maximum,Number(run.possibleScore)):null;
      return `<section class="panel run"><div class="run-head"><div><h2>${index===0?"ผลตรวจล่าสุด":`ผลย้อนหลังครั้งที่ ${index}`}</h2><p class="muted">${date(run.auditedAt)} · Auditor ${esc(run.auditorVersion||"—")}</p></div><span class="status ${AuditBridge.COLORS[status]}">${esc(AuditBridge.LABELS[status])}</span></div><div class="facts"><div class="fact"><span>คะแนนยืนยัน</span><strong>${score(run.confirmedScore)} / ${score(maximum)}</strong></div><div class="fact"><span>คะแนนที่อาจได้</span><strong>${score(possible)} / ${score(maximum)}</strong></div><div class="fact"><span>เกณฑ์ผ่าน</span><strong>${score(run.threshold)}</strong></div><div class="fact"><span>จำนวนหลักฐาน</span><strong>${activities.length.toLocaleString("th-TH")}</strong></div></div>${weekRows?`<h3>ผลตรวจตามครั้ง/สัปดาห์</h3><div class="week-evidence-grid">${weekRows}</div>`:'<div class="empty-note">ผลตรวจเดิมยังไม่มีรายละเอียดหัวข้อรายครั้ง กรุณาตรวจใหม่ด้วย Extension รุ่น 0.13.2</div>'}${activityRows?`<h3>หลักฐานที่ตรวจพบ</h3><ol class="evidence-list">${activityRows}</ol>`:'<div class="empty-note">ผลตรวจรุ่นนี้ยังไม่มีรายละเอียดหลักฐานแนบมา</div>'}</section>`;
    }).join("");
  }

  async function load(){
    try{
      const params=new URLSearchParams(location.search),courseId=params.get("courseId")||"",key=params.get("key")||"",admin=params.get("admin")==="1";
      if(AuditApi.enabled()){
        if(!courseId)throw new Error("ไม่พบรหัสรายวิชา");
        const result=admin?await AuditApi.adminCourseHistory(courseId):await AuditApi.courseHistory(courseId);
        const history=await Promise.all((result.runs||[]).map(async run=>({...run,evidenceSnapshot:await (admin?AuditApi.adminEvidence(courseId,run.runId):AuditApi.evidence(courseId,run.runId))})));
        render(result,history);return;
      }
      const selected=AuditBridge.loadRecords().find(record=>(courseId&&String(record.courseId)===courseId)||AuditBridge.recordKey(record)===key);
      if(!selected)throw new Error("ไม่พบหลักฐานของรายวิชานี้");
      render(selected,AuditBridge.historyForCourse(selected));
    }catch(error){
      $("course").textContent=error.message||"โหลดหลักฐานไม่สำเร็จ";
      $("runs").innerHTML='<section class="panel empty-note">ผลตรวจอาจถูกย้าย ยังไม่ได้เผยแพร่ หรือบัญชีนี้ไม่มีสิทธิ์เข้าถึง</section>';
    }
  }
  load();
})();
