(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const badge=status=>status?`<span class="status ${AuditBridge.COLORS[status]}">${AuditBridge.LABELS[status]}</span>`:"—";
  const score=value=>value!==null&&value!==""&&Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";
  const maxScore=record=>Number.isFinite(Number(record.maxScore))?Number(record.maxScore):110;
  const auditTime=value=>{const time=new Date(value||"");return Number.isNaN(time.valueOf())?"—":time.toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"});};
  const errorDetail=record=>{
    const source=record||{};
    const detail=source.errorReport||source.errorDetails||source.errorMessage||source.error||source.failureReason||source.reason||source.internalNote||"";
    if(typeof detail==="string"&&detail.trim())return detail.trim();
    if(detail&&typeof detail==="object")return JSON.stringify(detail,null,2);
    const quality=source.qualityGate?.failures;
    return Array.isArray(quality)&&quality.length?quality.join(" · "):"ระบบไม่ได้บันทึกรายละเอียดสาเหตุไว้ กรุณาตรวจสอบการเชื่อมต่อและสั่งตรวจใหม่";
  };
  const csvCell=value=>`"${String(value??"").replace(/"/g,'""')}"`;
  document.head.insertAdjacentHTML("beforeend",`<style>
    [hidden]{display:none!important}.theme-toggle{display:inline-flex;align-items:center;gap:8px;padding:8px 11px!important;border:1px solid rgba(255,255,255,.28)!important;background:rgba(255,255,255,.12)!important;color:#fff!important}.theme-knob{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#fff;color:#174e9b;font-size:13px}.extension-check{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;border:1px solid rgba(255,255,255,.35)!important;background:rgba(255,255,255,.12)!important;color:#fff!important}.extension-check.ok{background:#e5f7ee!important;border-color:#9cdeba!important;color:#08704a!important}.extension-check.error{background:#fff1f2!important;border-color:#f3b7be!important;color:#a61b2b!important}.theme-dark{--bg:#101928;--ink:#e5edf7;--muted:#9fb3c8;--line:#30445e;--navy:#e5edf7}.theme-dark .panel,.theme-dark .admin-drawer,.theme-dark .auth-chip{background:#182437;border-color:#30445e;box-shadow:0 10px 28px rgba(0,0,0,.22)}.theme-dark .audit-command-center{background:linear-gradient(135deg,#19283d,#15243a 64%,#123456)!important;border-color:#31527a!important}.theme-dark .command-title h2,.theme-dark .edition-card h3,.theme-dark .install-card h3,.theme-dark .table-head h2{color:#f4f8ff}.theme-dark .worker-console,.theme-dark .worker-progress,.theme-dark .queue-feedback{background:#132033;border-color:#345574;color:#cbdcf2}.theme-dark .progress-track{background:#2a405d}.theme-dark .drawer-link{background:#182437;color:#e5edf7}.theme-dark .drawer-link:hover,.theme-dark .drawer-link.active{background:#213955;color:#fff}.theme-dark .extension-compare .panel,.theme-dark .install-card,.theme-dark .update-note{background:#182437}.theme-dark .edition-card p,.theme-dark .install-card p,.theme-dark .update-note p{color:#b7c9df}
  </style>`);
  document.head.insertAdjacentHTML("beforeend",`<style>
    /* A complete dark palette: every interactive surface keeps visible text and a clear action state. */
    body.theme-dark{--bg:#0b1322;--ink:#edf5ff;--muted:#aec0d5;--line:#2b4059;--navy:#edf5ff;background:radial-gradient(circle at 78% -15%,#173861 0,transparent 31%),#0b1322;color:var(--ink)}
    .theme-dark .topbar{background:linear-gradient(110deg,#0b1d35,#143c67)}
    .theme-dark .topbar p,.theme-dark .admin-brand .eyebrow{color:#c7ddf5}
    .theme-dark .panel,.theme-dark .admin-drawer,.theme-dark .auth-chip{background:#121f31!important;border-color:#2b4059!important;color:#edf5ff;box-shadow:0 12px 32px rgba(0,0,0,.32)!important}
    .theme-dark .notice,.theme-dark .admin-intro,.theme-dark .result-summary,.theme-dark .manual-review,.theme-dark .update-note{background:#14243a!important;border-color:#31506f!important;color:#edf5ff}
    .theme-dark .admin-intro p,.theme-dark .section-head p,.theme-dark .table-head p,.theme-dark .muted,.theme-dark .field label,.theme-dark .kpi span,.theme-dark .drawer-link small,.theme-dark .install-card p,.theme-dark .edition-card p,.theme-dark .update-note p,.theme-dark .review-hint{color:#aec0d5!important}
    .theme-dark h1,.theme-dark h2,.theme-dark h3,.theme-dark strong,.theme-dark .kpi strong,.theme-dark .table-head h2,.theme-dark .command-title h2,.theme-dark .edition-card h3,.theme-dark .install-card h3{color:#f7fbff!important}
    .theme-dark button:not(.primary):not(.action-button):not(.review-pass):not(.review-fail),.theme-dark .button:not(.primary),.theme-dark .nav a:not(.active){background:#253a53!important;border:1px solid #3e5d7e!important;color:#eef6ff!important}
    .theme-dark button:not(:disabled):hover,.theme-dark .button:hover,.theme-dark .nav a:hover{background:#314c6b!important;border-color:#6f9fd0!important}
    .theme-dark .primary,.theme-dark .action-button,.theme-dark button.primary{background:linear-gradient(135deg,#2d7ce6,#1754b5)!important;border-color:#64a6ff!important;color:#fff!important;box-shadow:0 8px 20px rgba(23,84,181,.28)}
    .theme-dark .danger{background:#4b2631!important;border-color:#a95969!important;color:#ffe6ea!important}
    .theme-dark input,.theme-dark select,.theme-dark textarea,.theme-dark .file-input,.theme-dark .review-edit select{background:#0e1928!important;border-color:#3b5875!important;color:#edf5ff!important}
    .theme-dark input::placeholder,.theme-dark textarea::placeholder{color:#86a0bd!important}
    .theme-dark option{background:#0e1928;color:#edf5ff}
    .theme-dark .audit-command-center{background:linear-gradient(135deg,#162b45,#10253d 65%,#153c67)!important;border-color:#35618f!important}
    .theme-dark .worker-console,.theme-dark .worker-progress,.theme-dark .queue-feedback{background:#0e1b2c!important;border-color:#315372!important;color:#dcecff!important}
    .theme-dark .worker-chip{background:#263d57!important;color:#dcecff!important}.theme-dark .worker-chip.running{background:#123d35!important;color:#8df0c8!important}
    .theme-dark .progress-track{background:#263d57!important}.theme-dark .progress-fill{background:linear-gradient(90deg,#3c8cff,#75bbff)!important}
    .theme-dark .drawer-link{background:transparent!important;border-color:transparent!important;color:#edf5ff!important}.theme-dark .drawer-link:hover,.theme-dark .drawer-link.active{background:#213d5d!important;border-color:#5b8fc4!important;color:#fff!important}.theme-dark .drawer-link .menu-icon{background:#2a4563!important;color:#dcecff!important}
    .theme-dark .section-icon,.theme-dark .edition-icon{background:#203b5b!important;color:#9dcbff!important}.theme-dark .edition-icon.local{background:#163f37!important;color:#91e5c6!important}
    .theme-dark .extension-hero{background:linear-gradient(135deg,#0d2848,#1d5aa8)!important}.theme-dark .extension-compare .panel,.theme-dark .install-card{background:#121f31!important;border-color:#2b4059!important}
    .theme-dark th{background:#1d324a!important;color:#dcecff!important;border-color:#36516d!important}.theme-dark td{border-color:#273d55!important}.theme-dark tbody tr:hover{background:#172b41!important}
    .theme-dark .status.yellow{color:#2d2400!important}.theme-dark .review-buttons button{background:#17283b!important;color:#d7e9ff!important}.theme-dark .review-buttons .review-pass{border-color:#4bb989!important;color:#9af0c9!important}.theme-dark .review-buttons .review-fail{border-color:#e07a8b!important;color:#ffc3cc!important}
    .theme-dark .auth-chip button{background:#2f6fbd!important;color:#fff!important;border-color:#6faaf2!important}
  </style>`);

  function setMessage(text,type="ok"){$("message").textContent=text;$("message").className=`message ${type}`;}
  function setQueueMessage(text,type="ok"){$("queueMessage").textContent=text;$("queueMessage").className=`message ${type}`;}
  function setWorkerMessage(text,type="ok"){$("workerMessage").textContent=text;$("workerMessage").className=`message ${type}`;}
  function setAccessMessage(text,type="ok"){$("accessMessage").textContent=text;$("accessMessage").className=`message ${type}`;}
  function setQueueBusy(busy,text="กำลังเตรียมคิวตรวจ…"){
    $("queueFeedback").hidden=!busy;$("queueFeedbackText").textContent=text;
    ["queueMissing","refreshAll","queueScope"].forEach(id=>{const element=$(id);if(element)element.disabled=busy;});
  }
  function setWorkerProgress(percent,label="กำลังเตรียมเครื่องตรวจ",visible=true){
    const safe=Math.max(0,Math.min(100,Number(percent)||0));
    $("workerProgress").hidden=!visible;$("workerProgressLabel").textContent=label;
    $("workerProgressValue").textContent=`${Math.round(safe)}%`;$("workerProgressBar").style.width=`${Math.max(safe,visible?8:0)}%`;
    $("workerChip").textContent=visible?"กำลังทำงาน":"พร้อมเชื่อมต่อ";
    $("workerChip").classList.toggle("running",visible);
  }
  let workerRunning=false,workerStopRequested=false,workerTimer=null,processedThisSession=0,records=[];

  function showAdminView(view){
    document.querySelectorAll("[data-admin-panel]").forEach(panel=>panel.hidden=panel.dataset.adminPanel!==view);
    document.querySelectorAll("[data-admin-view]").forEach(button=>button.classList.toggle("active",button.dataset.adminView===view));
    closeMenu();
  }
  function openMenu(){
    $("adminDrawer").classList.add("open");$("adminScrim").hidden=false;$("menuToggle").setAttribute("aria-expanded","true");
  }
  function closeMenu(){
    $("adminDrawer").classList.remove("open");$("adminScrim").hidden=true;$("menuToggle").setAttribute("aria-expanded","false");
  }

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
    document.querySelectorAll("[data-super-admin-only]").forEach(item=>item.hidden=false);
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
        const value=Number.isFinite(Number(state.progress?.percent))?Number(state.progress.percent):45;
        setWorkerProgress(value,`กำลังตรวจ ${state.job?.courseCode||state.job?.courseId||"รายวิชา"}${progress}`);
        setWorkerMessage(`กำลังตรวจ ${state.job?.courseCode||state.job?.courseId||"รายวิชา"}${progress} · ปิดหน้า Dashboard ได้ แต่ต้องเปิด Chrome ไว้`);
        scheduleWorker();return;
      }
      if(state?.status==="result_ready"){
        if(!state.job?.jobId||!state.result)throw new Error("ผลจาก Extension ไม่มีรหัสงานหรือข้อมูลผลตรวจ");
        await AuditApi.submitResult(state.job.jobId,state.result);
        await AuditWorker.acknowledge(state.job.jobId);
        processedThisSession++;await loadResults();
        setWorkerProgress(92,`ส่งผล ${state.job.courseCode||state.job.courseId} เข้าระบบกลางแล้ว`);
        setWorkerMessage(`ส่งผล ${state.job.courseCode||state.job.courseId} เข้าระบบกลางแล้ว · รอบนี้เสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);
        if(workerStopRequested){stopWorker("หยุดแล้วหลังส่งผลวิชาปัจจุบัน");return;}
      }
      if(workerStopRequested){stopWorker("หยุดแล้ว");return;}
      const claimed=await AuditApi.claimJob();
      if(!claimed.job){stopWorker(`คิวว่าง · รอบนี้ตรวจเสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);return;}
      await AuditWorker.start(claimed.job);
      setWorkerProgress(12,`รับงาน ${claimed.job.course?.course_code||claimed.job.course_id} แล้ว`);
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
    $("workerStart").disabled=false;$("workerStop").disabled=true;setWorkerProgress(100,message,false);setWorkerMessage(message);
  }
  async function startWorker(){
    if(workerRunning)return;
    try{
      const ping=await AuditWorker.ping();
      const enabled=await AuditWorker.enable();
      if(enabled?.granted===false)throw new Error("ยังไม่ได้อนุญาตให้ Extension เปิดผู้ให้บริการสื่อที่ต้องตรวจ");
      workerRunning=true;workerStopRequested=false;processedThisSession=0;
      $("workerStart").disabled=true;$("workerStop").disabled=false;
      setWorkerProgress(5,"กำลังตรวจสอบ Extension และอ่านคิวกลาง");
      $("workerStatus").textContent=`Extension ${ping.version||""} พร้อมใช้งาน`;
      setWorkerMessage("เปิดเครื่องตรวจแล้ว · กำลังอ่านคิวกลาง");
      await runWorkerStep();
    }catch(error){stopWorker(error.message||String(error));$("workerMessage").className="message error";}
  }

  function setupExperience(){
    const commandActions=document.querySelector(".command-actions");
    if(commandActions&&!document.getElementById("queueScope")){
      commandActions.insertAdjacentHTML("beforebegin",`<div class="queue-picker"><div><span class="queue-picker-label">เลือกชุดรายวิชาที่ต้องการตรวจ</span><small>สร้างคิวเฉพาะรายการที่เลือก โดยไม่กระทบรายวิชาอื่น</small></div><select id="queueScope" aria-label="ชุดรายวิชาที่ต้องการตรวจ"><option value="missing">รายวิชาที่ยังไม่มีผลตรวจ</option><option value="gr">เฉพาะรายวิชา GR</option><option value="gs">เฉพาะรายวิชา GS</option><option value="failed">เฉพาะรายวิชาที่ตรวจไม่สำเร็จ</option><option value="retry">เฉพาะรายวิชาที่ต้องตรวจใหม่</option></select></div>`);
      const queueButton=$("queueMissing"),queueScope=$("queueScope");
      const labels={missing:"ตรวจวิชาที่ยังไม่มีผล",gr:"ตรวจเฉพาะรายวิชา GR",gs:"ตรวจเฉพาะรายวิชา GS",failed:"ตรวจวิชาที่ตรวจไม่สำเร็จ",retry:"ตรวจวิชาที่ต้องตรวจใหม่"};
      queueScope.addEventListener("change",()=>{queueButton.innerHTML=`<span>⌕</span> ${labels[queueScope.value]}`;});
    }
    const nav=document.querySelector(".topbar .nav");
    const theme=document.createElement("button");theme.type="button";theme.className="theme-toggle";
    const saved=localStorage.getItem("ooe-auditor-theme");
    const applyTheme=dark=>{document.body.classList.toggle("theme-dark",dark);theme.innerHTML=`<span class="theme-knob">${dark?"☀":"☾"}</span>${dark?"โหมดสว่าง":"โหมดมืด"}`;};
    applyTheme(saved==="dark");theme.addEventListener("click",()=>{const dark=!document.body.classList.contains("theme-dark");localStorage.setItem("ooe-auditor-theme",dark?"dark":"light");applyTheme(dark);});nav.prepend(theme);
    document.querySelector('[data-admin-view="audit"] .menu-icon').textContent="⌕";
    document.querySelector('[data-admin-view="reports"] .menu-icon').textContent="▤";
    document.querySelector('[data-admin-view="extension"] .menu-icon').textContent="⇩";
    const hero=document.querySelector(".extension-hero");
    if(hero){
      const copy=hero.querySelector("p");if(copy)copy.textContent="เครื่องมือตรวจรายวิชาออนไลน์ ช่วยรวบรวมผลตรวจและหลักฐานให้ทีมงานนำไปติดตามต่อได้อย่างเป็นระบบ";
      const downloads=hero.querySelector(".extension-downloads");if(downloads){const links=downloads.querySelectorAll("a");if(links[0])links[0].innerHTML="⇩ ดาวน์โหลดสำหรับระบบกลาง";if(links[1])links[1].innerHTML="⇩ ดาวน์โหลดไว้ใช้บนเครื่อง";}
      const note=hero.querySelector(".small");if(note)note.textContent="เลือกดาวน์โหลดตามรูปแบบการทำงานของคุณ แล้วติดตั้งตามคู่มือด้านล่าง";
      const check=document.createElement("button");check.type="button";check.className="extension-check";check.innerHTML="⌕ ตรวจหา Extension บน Chrome เครื่องนี้";hero.querySelector(".extension-status").append(check);
      check.addEventListener("click",async()=>{check.disabled=true;check.innerHTML='<span class="spinner"></span> กำลังตรวจสอบ…';try{const ping=await AuditWorker.ping();check.className="extension-check ok";check.textContent=`✓ พบ Extension เวอร์ชัน ${ping.version||"พร้อมใช้งาน"}`;}catch(error){check.className="extension-check error";check.textContent="ไม่พบ Extension · ติดตั้งแล้วกดตรวจอีกครั้ง";}finally{check.disabled=false;}});
    }
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
      return `<tr><td><strong>${esc(record.courseCode||record.courseId||"—")}</strong><div class="muted">${esc(record.courseProfile||record.courseTitle||record.courseUrl||"")}</div></td><td class="audit-time">${esc(auditTime(record.auditedAt))}</td><td>${score(record.confirmedScore)} / ${score(maxScore(record))}</td><td>${record.scoreNeedsRefresh?'ตรวจใหม่':`${score(possible)} / ${score(maxScore(record))}`}</td><td>${score(record.threshold)}</td><td>${badge(record.internalStatus)}</td><td>${badge(record.publicStatus)}</td><td>${esc(reason)}</td><td>${evidence}</td><td>${decisions}</td></tr>`;
    }).join(""):'<tr><td colspan="10" class="empty">ยังไม่มีผลตรวจที่นำเข้า</td></tr>';
    if(!$("errorReport").hidden)renderErrorReport();
  }

  function failedRecords(){
    return records.filter(record=>record.internalStatus==="audit_failed").sort((left,right)=>String(right.auditedAt||"").localeCompare(String(left.auditedAt||"")));
  }
  function renderErrorReport(){
    const failed=failedRecords();
    $("errorReportList").innerHTML=failed.length?failed.map(record=>`<article class="error-log-item"><div class="error-log-meta">${badge("audit_failed")}<strong>${esc(record.courseCode||record.courseId||"ไม่ทราบรายวิชา")}</strong><span class="error-log-time">ตรวจเมื่อ ${esc(auditTime(record.auditedAt))}</span></div><p class="error-log-detail">${esc(errorDetail(record))}</p><div class="muted">รหัสงาน: ${esc(record.runId||"—")} · Extension: ${esc(record.auditorVersion||"—")}</div></article>`).join(""):'<div class="empty">ยังไม่มีรายวิชาที่ตรวจไม่สำเร็จ</div>';
  }
  function downloadErrorReport(){
    const header=["วันเวลาตรวจ","รหัสวิชา","กลุ่มรายวิชา","Course ID","สถานะ","รายละเอียดข้อผิดพลาด","รหัสงาน","เวอร์ชัน Extension"];
    const csv=[header,...failedRecords().map(record=>[record.auditedAt||"",record.courseCode||"",record.group||"",record.courseId||"",AuditBridge.LABELS[record.internalStatus]||record.internalStatus||"",errorDetail(record),record.runId||"",record.auditorVersion||""])]
      .map(row=>row.map(csvCell).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`OOE-Auditor-Error-Report-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
    setMessage(`ดาวน์โหลดรายงานข้อผิดพลาด ${failedRecords().length.toLocaleString("th-TH")} รายการแล้ว`);
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
  $("openErrorReport").addEventListener("click",()=>{$("errorReport").hidden=false;renderErrorReport();$("errorReport").scrollIntoView({behavior:"smooth",block:"start"});});
  $("closeErrorReport").addEventListener("click",()=>{$("errorReport").hidden=true;});
  $("downloadErrorReport").addEventListener("click",downloadErrorReport);
  $("queueMissing").addEventListener("click",async()=>{
    try{const scope=$("queueScope")?.value||"missing";const labels={missing:"รายวิชาที่ยังไม่มีผลตรวจ",gr:"รายวิชา GR",gs:"รายวิชา GS",failed:"รายวิชาที่ตรวจไม่สำเร็จ",retry:"รายวิชาที่ต้องตรวจใหม่"};setQueueBusy(true,`กำลังอ่านข้อมูลล่าสุดและสร้างคิว ${labels[scope]}…`);if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.queueSelected(scope);setQueueMessage(`สร้างคิว${labels[scope]} ${Number(result.queued||0).toLocaleString("th-TH")} วิชา จากข้อมูลล่าสุด ${Number(result.catalogCount||0).toLocaleString("th-TH")} วิชา`);if(workerRunning)scheduleWorker(0);}
    catch(error){setQueueMessage(error.message||String(error),"error");}finally{setQueueBusy(false);}
  });
  $("refreshAll").addEventListener("click",async()=>{
    try{setQueueBusy(true,"กำลังสร้างคิวอัปเดตผลตรวจทั้งหมด…");if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.refreshAll();setQueueMessage(`สร้างชุดอัปเดต ${Number(result.total||0).toLocaleString("th-TH")} วิชา · รหัสชุด ${result.batchId}`);if(workerRunning)scheduleWorker(0);}
    catch(error){setQueueMessage(error.message||String(error),"error");}finally{setQueueBusy(false);}
  });
  $("workerStart").addEventListener("click",startWorker);
  $("workerStop").addEventListener("click",()=>{workerStopRequested=true;$("workerStop").disabled=true;setWorkerMessage("รับคำสั่งแล้ว · จะหยุดหลังวิชาปัจจุบันเสร็จ");});
  $("accessForm").addEventListener("submit",async event=>{
    event.preventDefault();
    try{
      const email=$("adminEmail").value.trim().toLowerCase();
      const displayName=$("adminName").value.trim(),role=$("adminRole").value;
      await AuditApi.saveAccessUser(email,displayName,role);
      $("accessForm").reset();
      await loadAccessUsers();
      setAccessMessage(`เพิ่มสิทธิ์ ${role==="super_admin"?"Super Admin":"Admin"} ให้ ${email} แล้ว`);
    }catch(error){setAccessMessage(error.message||String(error),"error");}
  });
  $("accessList").addEventListener("click",async event=>{
    const button=event.target.closest("button[data-access-email]");if(!button)return;
    const email=button.dataset.accessEmail,active=button.dataset.accessActive==="true";
    try{button.disabled=true;await AuditApi.setAccessUserStatus(email,active);await loadAccessUsers();setAccessMessage(`${active?"เปิด":"ปิด"}สิทธิ์ ${email} แล้ว`);}
    catch(error){button.disabled=false;setAccessMessage(error.message||String(error),"error");}
  });
  $("menuToggle").addEventListener("click",openMenu);$("menuClose").addEventListener("click",closeMenu);$("adminScrim").addEventListener("click",closeMenu);
  document.querySelectorAll("[data-admin-view]").forEach(button=>button.addEventListener("click",()=>showAdminView(button.dataset.adminView)));
  setupExperience();
  refreshWorkerStatus().catch(()=>{});
  setupAccessManagement();
  loadResults().catch(error=>setMessage(`โหลดผลจากระบบกลางไม่สำเร็จ: ${error.message||error}`,"error"));
})();
