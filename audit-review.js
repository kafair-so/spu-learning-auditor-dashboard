(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const badge=status=>status?`<span class="status ${AuditBridge.COLORS[status]}">${AuditBridge.LABELS[status]}</span>`:"—";
  const score=value=>value!==null&&value!==""&&Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";
  const CATALOG_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vSrdzF0uLqoeVFjT2Dovsl3l82J7PdBgnTk2g_0VZTSMsZyceTrOgUn4l-JLixxY34FVqxzhMhqUQNP/pub?gid=131857057&single=true&output=csv";
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
    .queue-overview{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(0,1.5fr);gap:18px;margin:22px 0 0;position:relative;z-index:1}.queue-orbit{display:grid;place-items:center;min-height:190px;border:1px solid #d7e5f6;border-radius:18px;background:linear-gradient(145deg,#fff,#eef6ff)}.queue-orbit-ring{display:grid;place-items:center;width:126px;height:126px;border:10px solid #dceafb;border-top-color:#2d70ce;border-right-color:#5c9bea;border-radius:50%;text-align:center;box-shadow:inset 0 0 0 1px #c7d9ef}.queue-orbit-ring strong{display:block;color:#113b6a;font-size:28px;line-height:1}.queue-orbit-ring span{font-size:11px;color:#557493}.queue-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.queue-stat{padding:14px;border:1px solid #d9e6f5;border-radius:14px;background:#fff}.queue-stat span{display:block;color:#67809b;font-size:12px;font-weight:700}.queue-stat strong{display:block;margin-top:5px;color:#163d69;font-size:25px}.queue-stat.queue-stat-running{border-color:#b7d9ca;background:#edfaf4}.queue-stat.queue-stat-failed{border-color:#f1ccd0;background:#fff6f7}.queue-now{grid-column:1/-1;display:flex;gap:12px;align-items:center;padding:13px 15px;border-left:4px solid #2a67c7;border-radius:12px;background:#f1f6fd;color:#214e80}.queue-now .pulse-dot{width:10px;height:10px;border-radius:50%;background:#2db47d;box-shadow:0 0 0 5px rgba(45,180,125,.12)}.queue-now small{display:block;margin-top:2px;color:#63809c}.monitor-board{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(300px,.9fr);gap:18px}.monitor-feed{display:grid;gap:10px}.monitor-event{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:13px;border:1px solid #dbe7f5;border-radius:12px;background:#fff}.monitor-event .event-dot{width:10px;height:10px;margin-top:5px;border-radius:50%;background:#7d93aa}.monitor-event.completed .event-dot{background:#2aaf77}.monitor-event.running .event-dot{background:#347bd6}.monitor-event.failed .event-dot{background:#df5d70}.monitor-event small{color:#6d849d}.monitor-note{margin:0;padding:16px;border-radius:14px;background:#f5f9ff;border:1px solid #d5e4f7;color:#244d78;line-height:1.6}.preflight-card{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;margin:20px 0;padding:18px;border:1px solid #bcd8f4;border-radius:16px;background:linear-gradient(135deg,#edf6ff,#fbfdff);color:#143d69}.preflight-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#d7e9ff;color:#1d5eb4;font-size:21px}.preflight-card h3{margin:0 0 5px}.preflight-card p{margin:0;color:#506e8d;line-height:1.55}.preflight-list{grid-column:1/-1;display:grid;gap:8px;margin:2px 0 0;padding:0;list-style:none}.preflight-list li{display:flex;gap:9px;align-items:flex-start;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.8)}.preflight-list input{margin-top:3px;accent-color:#2265c7}.preflight-state{font-size:12px;font-weight:800;color:#8a6218}.preflight-list input:checked+span .preflight-state{color:#087650}.preflight-list label{cursor:pointer}.theme-dark .queue-orbit,.theme-dark .queue-stat,.theme-dark .monitor-event{background:#122238;border-color:#304c6a}.theme-dark .queue-orbit-ring{border-color:#315275;border-top-color:#61a6ff;border-right-color:#4187dc}.theme-dark .queue-orbit-ring strong,.theme-dark .queue-stat strong{color:#edf6ff}.theme-dark .queue-now,.theme-dark .monitor-note{background:#10243b;border-color:#315675;color:#d5e9ff}.theme-dark .preflight-card{background:linear-gradient(135deg,#102944,#142238);border-color:#315978;color:#edf6ff}.theme-dark .preflight-card p{color:#b6cce4}.theme-dark .preflight-list li{background:#0d1b2d}
    @media(max-width:850px){.queue-overview,.monitor-board{grid-template-columns:1fr}.queue-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.queue-summary-grid{grid-template-columns:1fr 1fr}.queue-now{align-items:flex-start}}
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
  function setWorkerProgress(percent,label="กำลังเตรียมเครื่องตรวจ",visible=true,detail="",determinate=true){
    const safe=Math.max(0,Math.min(100,Number(percent)||0));
    $("workerProgress").hidden=!visible;$("workerProgressLabel").textContent=label;
    $("workerProgressValue").textContent=detail||`${Math.round(safe)}%`;
    $("workerProgressBar").classList.toggle("indeterminate",visible&&!determinate);
    $("workerProgressBar").style.width=determinate?`${safe}%`:"100%";
    $("workerChip").textContent=visible?"กำลังทำงาน":"พร้อมเชื่อมต่อ";
    $("workerChip").classList.toggle("running",visible);
  }
  let workerRunning=false,workerStopRequested=false,workerTimer=null,processedThisSession=0,records=[];
  let resultsState="loading",hasLoadedResults=false;
  document.head.insertAdjacentHTML("beforeend",`<style>
    @keyframes ooeShimmer{from{background-position:200% 0}to{background-position:-200% 0}}
    @keyframes ooeEnter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ooeSpin{to{transform:rotate(360deg)}}
    .ooe-skeleton{display:inline-block!important;width:65px;height:31px;border-radius:9px;background:linear-gradient(95deg,#dce7f5 20%,#f3f8ff 45%,#dce7f5 70%);background-size:220% 100%;animation:ooeShimmer 1.45s linear infinite;color:transparent!important}
    .ooe-load-state{display:flex;align-items:center;gap:10px;margin:10px 0 14px;padding:12px 15px;background:#edf5ff;border:1px solid #bad5f5;border-radius:12px;color:#244e80;font-weight:700}
    .ooe-load-state.is-error{background:#fff3f2;border-color:#ebaeaa;color:#a33636}
    .ooe-loader{width:17px;height:17px;border:2px solid #b6d3f5;border-top-color:#2464c6;border-radius:50%;animation:ooeSpin .85s linear infinite;flex:none}
    .ooe-load-state.is-error .ooe-loader{display:none}
    .ooe-report-skeleton td{padding:17px!important}
    .ooe-report-skeleton span{display:block;height:13px;width:75%;border-radius:6px;background:linear-gradient(95deg,#dce7f5,#f3f8ff,#dce7f5);background-size:220% 100%;animation:ooeShimmer 1.45s linear infinite}
    .kpi,.table-panel,.audit-command-center,.admin-intro{animation:ooeEnter .5s ease-out both}
    .kpi{transition:transform .22s ease,box-shadow .22s ease}
    .kpi:hover{transform:translateY(-3px);box-shadow:0 12px 24px rgba(25,57,101,.13)}
    button:not(:disabled){transition:transform .18s ease,box-shadow .18s ease}
    button:not(:disabled):active{transform:scale(.975)}
    .theme-dark .ooe-load-state{background:#152e4b;border-color:#35608b;color:#d4eaff}
    .theme-dark .ooe-load-state.is-error{background:#411f2b;border-color:#935364;color:#ffe0e0}
    @media(prefers-reduced-motion:reduce){.ooe-skeleton,.ooe-report-skeleton span,.ooe-loader,.kpi,.table-panel,.audit-command-center,.admin-intro{animation:none!important}.kpi,button{transition:none!important}.kpi:hover{transform:none}}
  </style>`);
  function showResultState(state,detail=""){
    resultsState=state;
    let banner=$("ooeResultsState");
    if(!banner){banner=document.createElement("div");banner.id="ooeResultsState";banner.className="ooe-load-state";banner.setAttribute("role","status");banner.setAttribute("aria-live","polite");document.querySelector('[data-admin-panel="reports"] .kpis')?.before(banner);}
    banner.hidden=state==="ready";
    banner.classList.toggle("is-error",state==="error");
    banner.innerHTML='<span class="ooe-loader" aria-hidden="true"></span><span>'+esc(detail||(state==="loading"?"กำลังโหลดผลตรวจจากระบบกลาง…":state==="error"?"ไม่สามารถโหลดผลตรวจได้ กรุณาลองอีกครั้ง":""))+'</span>';
    if(state==="loading"&&!hasLoadedResults){
      for(const id of ["pass","review","content","none","failed"]){const element=$(id);if(element){element.textContent="";element.classList.add("ooe-skeleton");}}
      $("count").textContent="กำลังโหลดข้อมูล…";
      $("rows").innerHTML=Array.from({length:4},()=>'<tr class="ooe-report-skeleton"><td colspan="10"><span></span></td></tr>').join("");
    }else if(state==="error"&&!hasLoadedResults){
      for(const id of ["pass","review","content","none","failed"]){$(id).classList.remove("ooe-skeleton");$(id).textContent="—";}
      $("count").textContent="ไม่สามารถโหลดข้อมูล";
      $("rows").innerHTML='<tr><td colspan="10" class="empty">โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่</td></tr>';
    }
  }

  function showAdminView(view){
    document.querySelectorAll("[data-admin-panel]").forEach(panel=>panel.hidden=panel.dataset.adminPanel!==view);
    document.querySelectorAll("[data-admin-view]").forEach(button=>button.classList.toggle("active",button.dataset.adminView===view));
    if(view==="audit"||view==="monitor")loadQueueOverview().catch(error=>{if(view==="monitor"&&$("monitorFeed"))$("monitorFeed").innerHTML=`<div class="empty">โหลดสถานะระบบไม่สำเร็จ: ${esc(error.message||error)}</div>`;});
    closeMenu();
  }
  function openMenu(){
    $("adminDrawer").classList.add("open");$("adminScrim").hidden=false;$("menuToggle").setAttribute("aria-expanded","true");
  }
  function closeMenu(){
    $("adminDrawer").classList.remove("open");$("adminScrim").hidden=true;$("menuToggle").setAttribute("aria-expanded","false");
  }

  async function loadResults(message=""){
    showResultState("loading",hasLoadedResults?"กำลังอัปเดตผลตรวจล่าสุด…":"กำลังโหลดผลตรวจจากระบบกลาง…");
    const [result,catalogResult]=await Promise.allSettled([AuditApi.adminResults(),loadCourseCatalog()]);
    if(result.status==="rejected"){
      showResultState("error",hasLoadedResults?"อัปเดตไม่สำเร็จ กำลังแสดงข้อมูลที่โหลดไว้ก่อนหน้า":"โหลดผลตรวจไม่สำเร็จ: "+String(result.reason?.message||result.reason));
      throw result.reason;
    }
    records=result.value.records||[];
    hasLoadedResults=true;
    if(catalogResult.status==="rejected"){
      courseCatalog=[];
      setMessage("โหลดผลตรวจได้ แต่ยังโหลดบัญชีรายวิชากลางไม่ได้ จึงยังไม่ยืนยันจำนวน 160 รายวิชา","error");
    }
    render();
    showResultState("ready");
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
        const completed=Number(state.progress?.current??state.progress?.completed??state.progress?.completedItems);
        const total=Number(state.progress?.total??state.progress?.totalItems??state.progress?.elementTotal);
        const hasElementProgress=Number.isFinite(completed)&&Number.isFinite(total)&&total>0;
        const value=hasElementProgress?(completed/total)*100:0;
        const detail=hasElementProgress?`ตรวจแล้ว ${Math.min(completed,total).toLocaleString("th-TH")} / ${total.toLocaleString("th-TH")} องค์ประกอบ`:"กำลังเตรียมข้อมูล";
        setWorkerProgress(value,`กำลังตรวจ ${state.job?.courseCode||state.job?.courseId||"รายวิชา"}${progress}`,true,detail,hasElementProgress);
        setWorkerMessage(`กำลังตรวจ ${state.job?.courseCode||state.job?.courseId||"รายวิชา"}${progress} · ปิดหน้า Dashboard ได้ แต่ต้องเปิด Chrome ไว้`);
        scheduleWorker();return;
      }
      if(state?.status==="result_ready"){
        if(!state.job?.jobId||!state.result)throw new Error("ผลจาก Extension ไม่มีรหัสงานหรือข้อมูลผลตรวจ");
        await AuditApi.submitResult(state.job.jobId,state.result);
        await AuditWorker.acknowledge(state.job.jobId);
        processedThisSession++;await loadResults();await loadQueueOverview();
        setWorkerProgress(100,`ส่งผล ${state.job.courseCode||state.job.courseId} เข้าระบบกลางแล้ว`,true,"ตรวจครบทุกองค์ประกอบแล้ว");
        setWorkerMessage(`ส่งผล ${state.job.courseCode||state.job.courseId} เข้าระบบกลางแล้ว · รอบนี้เสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);
        if(workerStopRequested){stopWorker("หยุดแล้วหลังส่งผลวิชาปัจจุบัน");return;}
      }
      if(workerStopRequested){stopWorker("หยุดแล้ว");return;}
      const claimed=await AuditApi.claimJob();
      if(!claimed.job){stopWorker(`คิวว่าง · รอบนี้ตรวจเสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);return;}
      await AuditWorker.start(claimed.job);await loadQueueOverview();
      setWorkerProgress(0,`รับงาน ${claimed.job.course?.course_code||claimed.job.course_id} แล้ว`,true,"กำลังเปิดรายวิชาและอ่านองค์ประกอบ…",false);
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
      setWorkerProgress(0,"กำลังตรวจสอบ Extension และอ่านคิวกลาง",true,"กำลังเตรียมเครื่องตรวจ…",false);
      $("workerStatus").textContent=`Extension ${ping.version||""} พร้อมใช้งาน`;
      setWorkerMessage("เปิดเครื่องตรวจแล้ว · กำลังอ่านคิวกลาง");
      await runWorkerStep();
    }catch(error){stopWorker(error.message||String(error));$("workerMessage").className="message error";}
  }

  let queueOverviewData=null,courseCatalog=[];
  // Course Profile is the stable cross-system identity used by the Sheet and
  // by the audit payload. Prefer it over an incidental Moodle URL/id.
  const catalogKey=value=>AuditBridge.identityKeys(value).find(key=>key.startsWith("profile:"))||AuditBridge.identityKeys(value)[0]||"";
  const catalogCourseId=url=>{try{return new URL(String(url||"")).searchParams.get("id")||"";}catch(_){return "";}};
  const courseFromCatalogRow=row=>({
    group:String(row.group||"").trim().toUpperCase(),courseCode:String(row.courseCode||"").trim().toUpperCase(),
    courseProfile:String(row.courseProfile||"").trim(),courseId:catalogCourseId(row.courseLink),courseUrl:String(row.courseLink||"").trim()
  });
  async function loadCourseCatalog(){
    const url=CATALOG_URL+(CATALOG_URL.includes("?")?"&":"?")+"_="+Date.now();
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)throw new Error(`โหลดบัญชีรายวิชาไม่สำเร็จ (HTTP ${response.status})`);
    const rows=AuditBridge.parseCSV(await response.text()).map(courseFromCatalogRow)
      .filter(course=>course.group==="GR"||course.group==="GS");
    const unique=new Map();
    rows.forEach(course=>{const key=catalogKey(course);if(key)unique.set(key,course);});
    courseCatalog=[...unique.values()];
  }
  // The backend /v1/admin/results already limits records to active courses.
  // Avoid hiding valid results through a second Google Sheets identity match.
  function currentCatalogRecords(){
    return records;
  }
  const jobLabel=kind=>({missing:"คิวรายวิชาที่ยังไม่มีผล",refresh:"คิวอัปเดตผล",retry:"คิวตรวจใหม่"}[kind]||"คิวตรวจ");
  const jobStatusLabel=status=>({queued:"รอเริ่มตรวจ",running:"กำลังตรวจ",completed:"ตรวจเสร็จ",failed:"ตรวจไม่สำเร็จ",cancelled:"ยกเลิก"}[status]||status||"ไม่ทราบสถานะ");
  function operationalTime(value){return auditTime(value);}
  function ensureOperationalViews(){
    const auditPanel=document.querySelector('[data-admin-panel="audit"]');
    const reportPanel=document.querySelector('[data-admin-panel="reports"]');
    const reportMenu=document.querySelector('[data-admin-view="reports"]');
    if(auditPanel&&!$("queueOverview")){
      const host=$("queueMessage");
      host.insertAdjacentHTML("afterend",`<section class="queue-overview" id="queueOverview" aria-live="polite"><div class="queue-orbit"><div class="queue-orbit-ring"><div><strong id="queueOutstanding">—</strong><span>งานคงเหลือ</span></div></div></div><div class="queue-summary-grid"><article class="queue-stat"><span>รอเริ่มตรวจ</span><strong id="queueQueued">—</strong></article><article class="queue-stat queue-stat-running"><span>กำลังตรวจ</span><strong id="queueRunning">—</strong></article><article class="queue-stat"><span>ตรวจเสร็จ</span><strong id="queueCompleted">—</strong></article><article class="queue-stat queue-stat-failed"><span>ตรวจไม่สำเร็จ</span><strong id="queueFailed">—</strong></article><div class="queue-now" id="queueNow"><span class="pulse-dot"></span><div><strong>กำลังอ่านสถานะคิวจากระบบกลาง…</strong><small>ข้อมูลนี้อัปเดตอัตโนมัติขณะเปิดหน้า</small></div></div></div></section>`);
    }
    if(reportMenu&&!document.querySelector('[data-admin-view="monitor"]')){
      reportMenu.insertAdjacentHTML("afterend",`<button class="drawer-link" type="button" data-admin-view="monitor"><span class="menu-icon">◉</span><span>ติดตามระบบ</span><small>คิว ข้อผิดพลาด และประวัติ</small></button>`);
    }
    if(reportPanel&&!document.querySelector('[data-admin-panel="monitor"]')){
      reportPanel.insertAdjacentHTML("afterend",`<section data-admin-panel="monitor" hidden><section class="admin-intro"><span class="section-icon indigo">◉</span><div><h2>ติดตามระบบ</h2><p>ดูงานที่กำลังทำ คิวคงเหลือ และเหตุขัดข้องล่าสุดจากระบบตรวจ</p></div></section><section class="monitor-board"><section class="panel"><div class="table-head"><div><h2>กิจกรรมล่าสุด</h2><p>แสดงคิวล่าสุดและสถานะที่เกิดขึ้นจริงจาก Supabase</p></div><button id="refreshMonitor" type="button">↻ อัปเดตสถานะ</button></div><div class="monitor-feed" id="monitorFeed"><div class="empty">กำลังโหลดสถานะระบบ…</div></div></section><aside class="panel"><h3>แนวทางเมื่อพบปัญหา</h3><p class="monitor-note">หากพบ “ตรวจไม่สำเร็จ” ให้เปิดรายงานข้อผิดพลาด ตรวจสาเหตุ แล้วเลือกสร้างคิว “ตรวจใหม่” เฉพาะรายวิชานั้น เพื่อลดการตรวจซ้ำที่ไม่จำเป็น</p></aside></section></section>`);
    }
    const extension=document.querySelector('[data-admin-panel="extension"]');
    const hero=document.querySelector(".extension-hero");
    if(extension&&hero&&!$("preflightCard")){
      hero.insertAdjacentHTML("afterend",`<section class="preflight-card" id="preflightCard"><span class="preflight-icon">✓</span><div><h3>ก่อนเริ่มตรวจ ต้องเข้าสู่ระบบให้พร้อม</h3><p>Extension จะอ่านข้อมูลได้ตามสิทธิ์ของบัญชีที่ล็อกอินในแต่ละระบบเท่านั้น หากยังไม่เข้าสู่ระบบ การตรวจอาจหยุดหรือบันทึกเป็น “ตรวจไม่สำเร็จ”</p></div><ul class="preflight-list"><li><label><input type="checkbox" data-preflight="d-learning"> <span><b>เข้าสู่ระบบ d-Learning แล้ว</b><br><small>เปิดรายวิชาที่ต้องตรวจได้ด้วยบัญชีปัจจุบัน · <em class="preflight-state">รอการยืนยัน</em></small></span></label></li><li><label><input type="checkbox" data-preflight="i-learning"> <span><b>เข้าสู่ระบบ i-Learning แล้ว</b><br><small>เปิดเนื้อหา/ทรัพยากร i-Learning ที่เกี่ยวข้องได้ · <em class="preflight-state">รอการยืนยัน</em></small></span></label></li><li><label><input type="checkbox" data-preflight="extension"> <span><b>ติดตั้ง Extension และตรวจพบใน Chrome แล้ว</b><br><small>กดปุ่ม “ตรวจหา Extension” ด้านบนเพื่อทดสอบ · <em class="preflight-state">รอการยืนยัน</em></small></span></label></li></ul></section>`);
      const saved=JSON.parse(localStorage.getItem("ooe-auditor-preflight")||"{}");
      document.querySelectorAll("[data-preflight]").forEach(input=>{input.checked=Boolean(saved[input.dataset.preflight]);input.addEventListener("change",()=>{const next=JSON.parse(localStorage.getItem("ooe-auditor-preflight")||"{}");next[input.dataset.preflight]=input.checked;localStorage.setItem("ooe-auditor-preflight",JSON.stringify(next));renderPreflight();});});
      renderPreflight();
    }
    document.querySelector('[data-admin-view="monitor"]')?.addEventListener("click",()=>showAdminView("monitor"));
    $("refreshMonitor")?.addEventListener("click",()=>loadQueueOverview().catch(error=>{$("monitorFeed").innerHTML=`<div class="empty">โหลดสถานะระบบไม่สำเร็จ: ${esc(error.message||error)}</div>`;}));
  }
  function renderPreflight(){
    document.querySelectorAll("[data-preflight]").forEach(input=>{const label=input.parentElement.querySelector(".preflight-state");if(label)label.textContent=input.checked?"ยืนยันแล้ว":"รอการยืนยัน";});
  }
  function renderQueueOverview(){
    if(!queueOverviewData||!$("queueOverview"))return;
    const overview=queueOverviewData;
    $("queueOutstanding").textContent=Number(overview.outstanding||0).toLocaleString("th-TH");
    $("queueQueued").textContent=Number(overview.queued||0).toLocaleString("th-TH");
    $("queueRunning").textContent=Number(overview.running||0).toLocaleString("th-TH");
    $("queueCompleted").textContent=Number(overview.completed||0).toLocaleString("th-TH");
    $("queueFailed").textContent=Number(overview.failed||0).toLocaleString("th-TH");
    const current=overview.current;
    $("queueNow").innerHTML=current?`<span class="pulse-dot"></span><div><strong>กำลังตรวจ ${esc(current.courseCode||current.courseId)}</strong><small>${esc(current.courseTitle||jobLabel(current.kind))} · เริ่มเมื่อ ${esc(operationalTime(current.startedAt||current.createdAt))}</small></div>`:`<span class="pulse-dot" style="background:#94a7ba;box-shadow:none"></span><div><strong>${Number(overview.outstanding||0)?"มีงานรอเครื่องตรวจ":"ไม่มีงานรอในคิว"}</strong><small>อัปเดตล่าสุด ${esc(operationalTime(overview.generatedAt))}</small></div>`;
    if($("monitorFeed")){
      const recent=overview.recent||[];
      $("monitorFeed").innerHTML=recent.length?recent.map(job=>`<article class="monitor-event ${esc(job.status)}"><span class="event-dot"></span><div><strong>${esc(job.courseCode||job.courseId)}</strong><div class="muted">${esc(job.courseTitle||jobLabel(job.kind))}${job.error?` · ${esc(job.error)}`:""}</div></div><small>${esc(jobStatusLabel(job.status))}<br>${esc(operationalTime(job.finishedAt||job.startedAt||job.createdAt))}</small></article>`).join(""):'<div class="empty">ยังไม่มีประวัติคิวตรวจ</div>';
    }
  }
  async function loadQueueOverview(){
    if(!AuditApi.enabled())return;
    queueOverviewData=await AuditApi.queueOverview();
    renderQueueOverview();
  }

  function setupExperience(){
    ensureOperationalViews();
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
    const reportLink=document.querySelector('[data-admin-view="reports"]');
    if(reportLink){const labels=reportLink.querySelectorAll("span");if(labels[1])labels[1].textContent="ผลตรวจรายวิชา";const hint=reportLink.querySelector("small");if(hint)hint.textContent="คะแนน หลักฐาน และสิ่งที่ต้องแก้";}
    const hero=document.querySelector(".extension-hero");
    if(hero){
      const copy=hero.querySelector("p");if(copy)copy.textContent="เครื่องมือตรวจรายวิชาออนไลน์ ช่วยรวบรวมผลตรวจและหลักฐานให้ทีมงานนำไปติดตามต่อได้อย่างเป็นระบบ";
      const downloads=hero.querySelector(".extension-downloads");if(downloads){const links=downloads.querySelectorAll("a");if(links[0])links[0].innerHTML="⇩ ดาวน์โหลดสำหรับระบบกลาง";if(links[1])links[1].innerHTML="⇩ ดาวน์โหลดไว้ใช้บนเครื่อง";}
      const note=hero.querySelector(".small");if(note)note.textContent="เลือกดาวน์โหลดตามรูปแบบการทำงานของคุณ แล้วติดตั้งตามคู่มือด้านล่าง";
      const check=document.createElement("button");check.type="button";check.className="extension-check";check.innerHTML="⌕ ตรวจหา Extension บน Chrome เครื่องนี้";hero.querySelector(".extension-status").append(check);
      check.addEventListener("click",async()=>{check.disabled=true;check.innerHTML='<span class="spinner"></span> กำลังตรวจสอบ…';try{const ping=await AuditWorker.ping();check.className="extension-check ok";check.textContent=`✓ พบ Extension เวอร์ชัน ${ping.version||"พร้อมใช้งาน"}`;const input=document.querySelector('[data-preflight="extension"]');if(input){input.checked=true;input.dispatchEvent(new Event("change"));}}catch(error){check.className="extension-check error";check.textContent="ไม่พบ Extension · ติดตั้งแล้วกดตรวจอีกครั้ง";}finally{check.disabled=false;}});
    }
  }

  function render(){
    if(!hasLoadedResults){showResultState(resultsState);return;}
    for(const id of ["pass","review","content","none","failed"])$(id).classList.remove("ooe-skeleton");
    const query=$("search").value.trim().toLowerCase(),filter=$("filter").value,group=$("filterGroup")?.value||"";
    const catalogRecords=currentCatalogRecords();
    const scoped=catalogRecords.filter(record=>!group||String(record.group||"").toUpperCase()===group);
    for(const status of AuditBridge.INTERNAL)$(status==="needs_review"?"review":status==="has_content"?"content":status==="no_content"?"none":status==="audit_failed"?"failed":"pass").textContent=scoped.filter(record=>record.internalStatus===status).length.toLocaleString("th-TH");
    const rows=scoped.filter(record=>(!filter||record.internalStatus===filter)&&(!query||[record.courseCode,record.courseProfile,record.courseTitle,record.courseId].join(" ").toLowerCase().includes(query))).sort((a,b)=>String(b.auditedAt||"").localeCompare(String(a.auditedAt||"")));
    const scopeLabel=group?` · ${group}`:"";
    $("count").textContent=courseCatalog.length?`${rows.length.toLocaleString("th-TH")} ผลตรวจ จาก ${courseCatalog.length.toLocaleString("th-TH")} รายวิชา${scopeLabel}`:`${rows.length.toLocaleString("th-TH")} รายการ${scopeLabel}`;
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
    return currentCatalogRecords().filter(record=>record.internalStatus==="audit_failed").sort((left,right)=>String(right.auditedAt||"").localeCompare(String(left.auditedAt||"")));
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
  $("filter").addEventListener("change",render);$("filterGroup")?.addEventListener("change",render);$("search").addEventListener("input",render);render();
  $("openErrorReport").addEventListener("click",()=>{$("errorReport").hidden=false;renderErrorReport();$("errorReport").scrollIntoView({behavior:"smooth",block:"start"});});
  $("closeErrorReport").addEventListener("click",()=>{$("errorReport").hidden=true;});
  $("downloadErrorReport").addEventListener("click",downloadErrorReport);
  $("queueMissing").addEventListener("click",async()=>{
    try{const scope=$("queueScope")?.value||"missing";const labels={missing:"รายวิชาที่ยังไม่มีผลตรวจ",gr:"รายวิชา GR",gs:"รายวิชา GS",failed:"รายวิชาที่ตรวจไม่สำเร็จ",retry:"รายวิชาที่ต้องตรวจใหม่"};setQueueBusy(true,`กำลังอ่านข้อมูลล่าสุดและสร้างคิว ${labels[scope]}…`);if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.queueSelected(scope);setQueueMessage(`สร้างคิว${labels[scope]} ${Number(result.queued||0).toLocaleString("th-TH")} วิชา จากข้อมูลล่าสุด ${Number(result.catalogCount||0).toLocaleString("th-TH")} วิชา`);await loadQueueOverview();if(workerRunning)scheduleWorker(0);}
    catch(error){setQueueMessage(error.message||String(error),"error");}finally{setQueueBusy(false);}
  });
  $("refreshAll").addEventListener("click",async()=>{
    try{setQueueBusy(true,"กำลังสร้างคิวอัปเดตผลตรวจทั้งหมด…");if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.refreshAll();setQueueMessage(`สร้างชุดอัปเดต ${Number(result.total||0).toLocaleString("th-TH")} วิชา · รหัสชุด ${result.batchId}`);await loadQueueOverview();if(workerRunning)scheduleWorker(0);}
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
  loadQueueOverview().catch(()=>{});
  setInterval(()=>loadQueueOverview().catch(()=>{}),15000);
})();
