(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const badge=status=>status?`<span class="status ${AuditBridge.COLORS[status]}">${AuditBridge.LABELS[status]}</span>`:"—";
  const score=value=>value!==null&&value!==""&&Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";
  const maxScore=record=>Number.isFinite(Number(record.maxScore))?Number(record.maxScore):110;

  function setMessage(text,type="ok"){$("message").textContent=text;$("message").className=`message ${type}`;}
  function setQueueMessage(text,type="ok"){$("queueMessage").textContent=text;$("queueMessage").className=`message ${type}`;}
  function setWorkerMessage(text,type="ok"){$("workerMessage").textContent=text;$("workerMessage").className=`message ${type}`;}
  function setAccessMessage(text,type="ok"){$("accessMessage").textContent=text;$("accessMessage").className=`message ${type}`;}
  let workerRunning=false,workerStopRequested=false,workerTimer=null,processedThisSession=0,records=[];

  async function loadResults(message=""){
    const result=await AuditApi.adminResults();
    records=result.records||[];
    render();
    if(message)setMessage(message);
  }

  async function loadAccessUsers(){
    const result=await AuditApi.accessUsers();
    const users=result.users||[];
    $("accessList").innerHTML=users.length?users.map(user=>{
      const protectedRow=user.role==="super_admin";
      const action=protectedRow?'<span class="muted">บัญชีหลักของระบบ</span>':`<button type="button" data-access-email="${esc(user.email)}" data-access-active="${user.active?"false":"true"}">${user.active?"ปิดสิทธิ์":"เปิดสิทธิ์"}</button>`;
      return `<div class="access-item"><div><strong>${esc(user.display_name||user.email)}</strong><div class="muted">${esc(user.email)}</div></div><span class="role-badge ${protectedRow?"":"admin"}">${protectedRow?"SUPER ADMIN":"ADMIN"}</span><span class="access-state ${user.active?"active":"inactive"}">${user.active?"ใช้งาน":"ปิดสิทธิ์"}</span><div>${action}</div></div>`;
    }).join(""):'<div class="empty">ยังไม่มีรายชื่อผู้ดูแล</div>';
  }

  async function setupAccessManagement(){
    if(window.OOEReviewer?.role!=="super_admin")return;
    $("accessPanel").hidden=false;
    try{await loadAccessUsers();}catch(error){setAccessMessage(error.message||String(error),"error");}
  }

  const workerStateLabel=state=>state?.status==="running"?`กำลังตรวจ ${state.job?.courseCode||state.job?.courseId||"รายวิชา"}`:state?.status==="result_ready"?"มีผลตรวจรอส่งเข้าฐานข้อมูล":state?.status==="idle"?"พร้อมรับงาน":"กำลังเริ่มเครื่องตรวจ";
  function scheduleWorker(ms=2500){clearTimeout(workerTimer);if(workerRunning)workerTimer=setTimeout(runWorkerStep,ms);}
  async function refreshWorkerStatus(){
    try{const response=await AuditWorker.status();$("workerStatus").textContent=`Extension พร้อมใช้งาน · ${workerStateLabel(response.state)}`;return response.state;}
    catch(error){$("workerStatus").textContent="ยังไม่พบ Extension รุ่น Worker";throw error;}
  }
  async function runWorkerStep(){
    if(!workerRunning)return;
    try{
      const state=await refreshWorkerStatus();
      if(state?.status==="running"||state?.status==="starting"){
        const progress=state.progress?.label?` · ${state.progress.label}`:"";
        setWorkerMessage(`กำลังตรวจ ${state.job?.courseCode||state.job?.courseId||"รายวิชา"}${progress} · ปิดหน้า Dashboard ได้ แต่ต้องเปิด Chrome ไว้`);
        scheduleWorker();return;
      }
      if(state?.status==="result_ready"){
        if(!state.job?.jobId||!state.result)throw new Error("ผลจาก Extension ไม่มีรหัสงานหรือข้อมูลผลตรวจ");
        await AuditApi.submitResult(state.job.jobId,state.result);
        await AuditWorker.acknowledge(state.job.jobId);
        processedThisSession++;await loadResults();
        setWorkerMessage(`ส่งผล ${state.job.courseCode||state.job.courseId} เข้าระบบกลางแล้ว · รอบนี้เสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);
        if(workerStopRequested){stopWorker("หยุดแล้วหลังส่งผลวิชาปัจจุบัน");return;}
      }
      if(workerStopRequested){stopWorker("หยุดแล้ว");return;}
      const claimed=await AuditApi.claimJob();
      if(!claimed.job){stopWorker(`คิวว่าง · รอบนี้ตรวจเสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);return;}
      await AuditWorker.start(claimed.job);
      setWorkerMessage(`รับงาน ${claimed.job.course?.course_code||claimed.job.course_id} แล้ว · เริ่มตรวจอัตโนมัติ`);
      scheduleWorker();
    }catch(error){
      if(OOEAuth.isSessionError(error)){
        workerRunning=false;clearTimeout(workerTimer);workerTimer=null;
        $("workerStart").disabled=true;$("workerStop").disabled=true;
        setWorkerMessage("เซสชันหมดอายุ · กำลังขอสิทธิ์ใหม่จาก Google เพื่อทำคิวเดิมต่อ", "error");
        const renewed=await OOEAuth.refreshCredential({interactive:true});
        if(renewed){setWorkerMessage("ต่ออายุเซสชันแล้ว · กลับมาทำคิวเดิมต่อ");await startWorker();return;}
        $("workerStart").disabled=false;
        setWorkerMessage("เซสชันหมดอายุ · กรุณาเข้าสู่ระบบใหม่ แล้วกด “เปิดเครื่องตรวจ” ระบบจะกลับไปทำคิวเดิมโดยไม่ต้องสร้างคิวซ้ำ", "error");
        return;
      }
      setWorkerMessage(error.message||String(error),"error");scheduleWorker(5000);
    }
  }
  function stopWorker(message="หยุดรับงานใหม่แล้ว"){
    workerRunning=false;workerStopRequested=false;clearTimeout(workerTimer);workerTimer=null;
    $("workerStart").disabled=false;$("workerStop").disabled=true;setWorkerMessage(message);
  }
  async function startWorker(){
    if(workerRunning)return;
    try{
      const ping=await AuditWorker.ping();
      const enabled=await AuditWorker.enable();
      if(enabled?.granted===false)throw new Error("ยังไม่ได้อนุญาตให้ Extension เปิดผู้ให้บริการสื่อที่ต้องตรวจ");
      workerRunning=true;workerStopRequested=false;processedThisSession=0;
      $("workerStart").disabled=true;$("workerStop").disabled=false;
      $("workerStatus").textContent=`Extension ${ping.version||""} พร้อมใช้งาน`;
      setWorkerMessage("เปิดเครื่องตรวจแล้ว · กำลังอ่านคิวกลาง");
      await runWorkerStep();
    }catch(error){stopWorker(error.message||String(error));$("workerMessage").className="message error";}
  }

  function render(){
    for(const status of AuditBridge.INTERNAL)$(status==="needs_review"?"review":status==="has_content"?"content":status==="no_content"?"none":status==="audit_failed"?"failed":"pass").textContent=records.filter(record=>record.internalStatus===status).length.toLocaleString("th-TH");
    const query=$("search").value.trim().toLowerCase(),filter=$("filter").value;
    const rows=records.filter(record=>(!filter||record.internalStatus===filter)&&(!query||[record.courseCode,record.courseProfile,record.courseTitle,record.courseId].join(" ").toLowerCase().includes(query))).sort((a,b)=>String(b.auditedAt||"").localeCompare(String(a.auditedAt||"")));
    $("count").textContent=`${rows.length.toLocaleString("th-TH")} รายการ`;
    $("rows").innerHTML=rows.length?rows.map(record=>{
      const runId=esc(record.runId||"");
      const courseId=encodeURIComponent(record.courseId||"");
      const evidence=record.runId&&record.courseId?`<a href="audit-evidence.html?admin=1&amp;courseId=${courseId}" target="_blank" rel="noopener">ดูผลตรวจ ↗</a>`:'<span class="muted">—</span>';
      const decisions=record.scoreNeedsRefresh?'<span class="muted">ตรวจใหม่ด้วย Extension 0.13.10 ก่อนตัดสิน</span>':record.internalStatus==="needs_review"?`<div class="actions"><button data-run-id="${runId}" data-decision="pass">ผ่าน</button><button data-run-id="${runId}" data-decision="has_content">มีเนื้อหา</button><button data-run-id="${runId}" data-decision="no_content">ไม่มีเนื้อหา</button></div>`:record.internalStatus==="audit_failed"?'<span class="muted">ตรวจสอบระบบหรือรันใหม่</span>':'<span class="muted">ตัดสินอัตโนมัติแล้ว</span>';
      const possible=Number.isFinite(Number(record.possibleScore))?Math.min(maxScore(record),Number(record.possibleScore)):null;
      const qualityWarning=record.qualityGate?.failures?.length?`ข้อควรระวังคุณภาพข้อมูล: ${record.qualityGate.failures.join(", ")}`:"";
      const reason=record.scoreNeedsRefresh?"ผลรุ่นเดิมนับจำนวนหลักฐานเป็นคะแนน ต้องตรวจใหม่":record.reason||qualityWarning||"—";
      return `<tr><td><strong>${esc(record.courseCode||record.courseId||"—")}</strong><div class="muted">${esc(record.courseProfile||record.courseTitle||record.courseUrl||"")}</div></td><td>${score(record.confirmedScore)} / ${score(maxScore(record))}</td><td>${record.scoreNeedsRefresh?'ตรวจใหม่':`${score(possible)} / ${score(maxScore(record))}`}</td><td>${score(record.threshold)}</td><td>${badge(record.internalStatus)}</td><td>${badge(record.publicStatus)}</td><td>${esc(reason)}</td><td>${evidence}</td><td>${decisions}</td></tr>`;
    }).join(""):'<tr><td colspan="9" class="empty">ยังไม่มีผลตรวจที่นำเข้า</td></tr>';
  }

  async function readFiles(files){
    const payloads=[];
    for(const file of files){
      const parsed=JSON.parse(await file.text());
      if(Array.isArray(parsed))payloads.push(...parsed);else payloads.push(parsed);
    }
    return payloads;
  }

  $("import").addEventListener("click",async()=>{
    try{
      const files=[...$("files").files];
      if(!files.length)throw new Error("กรุณาเลือกไฟล์ JSON จาก SPU Learning Auditor");
      const payloads=await readFiles(files);
      let uploaded=0;
      for(const payload of payloads){await AuditApi.uploadResult(payload);uploaded++;}
      $("files").value="";
      await loadResults(`นำเข้าและบันทึกฐานข้อมูลกลาง ${uploaded.toLocaleString("th-TH")} รายการแล้ว`);
    }catch(error){setMessage(error.message||String(error),"error");}
  });

  $("rows").addEventListener("click",async event=>{
    const button=event.target.closest("button[data-decision]");if(!button)return;
    const runId=button.dataset.runId,decision=button.dataset.decision;
    try{button.disabled=true;await AuditApi.decideResult(runId,decision);await loadResults(`บันทึกผล “${AuditBridge.LABELS[decision]}” ลงระบบกลางแล้ว`);}
    catch(error){button.disabled=false;setMessage(error.message||String(error),"error");}
  });

  $("export").addEventListener("click",()=>{
    const rows=records.map(AuditBridge.publishableRecord).filter(Boolean);
    const url=URL.createObjectURL(new Blob(["\uFEFF"+AuditBridge.toCSV(rows)],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`OOE-Auditor-Public-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
    setMessage(`ส่งออกข้อมูลสาธารณะ ${rows.length.toLocaleString("th-TH")} รายการแล้ว โดยไม่มีสถานะสีส้มและสีเทา`);
  });

  $("reloadResults").addEventListener("click",()=>loadResults("โหลดผลล่าสุดจากระบบกลางแล้ว").catch(error=>setMessage(error.message||String(error),"error")));
  $("filter").addEventListener("change",render);$("search").addEventListener("input",render);render();
  $("queueMissing").addEventListener("click",async()=>{
    try{if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.queueMissing("current");setQueueMessage(`สร้างคิวรายวิชาที่ยังไม่มีผล ${Number(result.queued||0).toLocaleString("th-TH")} วิชา จากข้อมูลล่าสุด ${Number(result.catalogCount||0).toLocaleString("th-TH")} วิชา`);if(workerRunning)scheduleWorker(0);}
    catch(error){setQueueMessage(error.message||String(error),"error");}
  });
  $("refreshAll").addEventListener("click",async()=>{
    try{if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.refreshAll();setQueueMessage(`สร้างชุดอัปเดต ${Number(result.total||0).toLocaleString("th-TH")} วิชา · รหัสชุด ${result.batchId}`);if(workerRunning)scheduleWorker(0);}
    catch(error){setQueueMessage(error.message||String(error),"error");}
  });
  $("workerStart").addEventListener("click",startWorker);
  $("workerStop").addEventListener("click",()=>{workerStopRequested=true;$("workerStop").disabled=true;setWorkerMessage("รับคำสั่งแล้ว · จะหยุดหลังวิชาปัจจุบันเสร็จ");});
  $("accessForm").addEventListener("submit",async event=>{
    event.preventDefault();
    try{
      const email=$("adminEmail").value.trim().toLowerCase();
      const displayName=$("adminName").value.trim();
      await AuditApi.saveAccessUser(email,displayName);
      $("accessForm").reset();
      await loadAccessUsers();
      setAccessMessage(`เพิ่มสิทธิ์ Admin ให้ ${email} แล้ว`);
    }catch(error){setAccessMessage(error.message||String(error),"error");}
  });
  $("accessList").addEventListener("click",async event=>{
    const button=event.target.closest("button[data-access-email]");if(!button)return;
    const email=button.dataset.accessEmail,active=button.dataset.accessActive==="true";
    try{button.disabled=true;await AuditApi.setAccessUserStatus(email,active);await loadAccessUsers();setAccessMessage(`${active?"เปิด":"ปิด"}สิทธิ์ ${email} แล้ว`);}
    catch(error){button.disabled=false;setAccessMessage(error.message||String(error),"error");}
  });
  refreshWorkerStatus().catch(()=>{});
  setupAccessManagement();
  loadResults().catch(error=>setMessage(`โหลดผลจากระบบกลางไม่สำเร็จ: ${error.message||error}`,"error"));
})();
