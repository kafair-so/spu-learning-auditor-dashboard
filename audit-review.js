(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const badge=status=>status?`<span class="status ${AuditBridge.COLORS[status]}">${AuditBridge.LABELS[status]}</span>`:"—";
  const score=value=>Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";

  function setMessage(text,type="ok"){$("message").textContent=text;$("message").className=`message ${type}`;}
  function setQueueMessage(text,type="ok"){$("queueMessage").textContent=text;$("queueMessage").className=`message ${type}`;}
  function setWorkerMessage(text,type="ok"){$("workerMessage").textContent=text;$("workerMessage").className=`message ${type}`;}
  let workerRunning=false,workerStopRequested=false,workerTimer=null,processedThisSession=0;

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
        AuditBridge.importPayload([state.result]);
        await AuditWorker.acknowledge(state.job.jobId);
        processedThisSession++;render();
        setWorkerMessage(`ส่งผล ${state.job.courseCode||state.job.courseId} เข้าระบบกลางแล้ว · รอบนี้เสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);
        if(workerStopRequested){stopWorker("หยุดแล้วหลังส่งผลวิชาปัจจุบัน");return;}
      }
      if(workerStopRequested){stopWorker("หยุดแล้ว");return;}
      const claimed=await AuditApi.claimJob();
      if(!claimed.job){stopWorker(`คิวว่าง · รอบนี้ตรวจเสร็จ ${processedThisSession.toLocaleString("th-TH")} วิชา`);return;}
      await AuditWorker.start(claimed.job);
      setWorkerMessage(`รับงาน ${claimed.job.course?.course_code||claimed.job.course_id} แล้ว · เริ่มตรวจอัตโนมัติ`);
      scheduleWorker();
    }catch(error){setWorkerMessage(error.message||String(error),"error");scheduleWorker(5000);}
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
    const records=AuditBridge.latestRecords();
    for(const status of AuditBridge.INTERNAL)$(status==="needs_review"?"review":status==="has_content"?"content":status==="no_content"?"none":status==="audit_failed"?"failed":"pass").textContent=records.filter(record=>record.internalStatus===status).length.toLocaleString("th-TH");
    const query=$("search").value.trim().toLowerCase(),filter=$("filter").value;
    const rows=records.filter(record=>(!filter||record.internalStatus===filter)&&(!query||[record.courseCode,record.courseProfile,record.courseTitle,record.courseId].join(" ").toLowerCase().includes(query))).sort((a,b)=>String(b.auditedAt||"").localeCompare(String(a.auditedAt||"")));
    $("count").textContent=`${rows.length.toLocaleString("th-TH")} รายการ`;
    $("rows").innerHTML=rows.length?rows.map(record=>{
      const key=encodeURIComponent(AuditBridge.runKey(record));
      const decisions=record.internalStatus==="needs_review"?`<div class="actions"><button data-key="${key}" data-decision="pass">ผ่าน</button><button data-key="${key}" data-decision="has_content">มีเนื้อหา</button><button data-key="${key}" data-decision="no_content">ไม่มีเนื้อหา</button></div>`:record.internalStatus==="audit_failed"?'<span class="muted">รอตรวจระบบหรือรันใหม่</span>':'<span class="muted">ตัดสินอัตโนมัติแล้ว</span>';
      return `<tr><td><strong>${esc(record.courseCode||record.courseId||"—")}</strong><div class="muted">${esc(record.courseProfile||record.courseTitle||record.courseUrl||"")}</div></td><td>${score(record.confirmedScore)} / ${score(record.threshold)}</td><td>${score(record.possibleScore)} / ${score(record.threshold)}</td><td>${badge(record.internalStatus)}</td><td>${badge(record.publicStatus)}</td><td>${esc(record.reason||"—")}</td><td>${decisions}</td></tr>`;
    }).join(""):'<tr><td colspan="7" class="empty">ยังไม่มีผลตรวจที่นำเข้า</td></tr>';
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
      const result=AuditBridge.importPayload(payloads);
      let remoteText="";
      if(AuditApi.enabled()&&OOEAuth.getCredential()){
        let uploaded=0;
        for(const payload of payloads){await AuditApi.uploadResult(payload);uploaded++;}
        remoteText=` · บันทึกฐานข้อมูลกลาง ${uploaded.toLocaleString("th-TH")} รายการ`;
      }else if(AuditApi.enabled()){
        remoteText=" · เก็บในเครื่องเท่านั้น กรุณาเข้าสู่ระบบจริงก่อนส่งฐานข้อมูลกลาง";
      }
      setMessage(`นำเข้า ${result.count.toLocaleString("th-TH")} รายการแล้ว · มีผลตรวจทั้งหมด ${result.total.toLocaleString("th-TH")} รายการ${remoteText}`);
      $("files").value="";render();
    }catch(error){setMessage(error.message||String(error),"error");}
  });

  $("rows").addEventListener("click",event=>{
    const button=event.target.closest("button[data-decision]");if(!button)return;
    const key=decodeURIComponent(button.dataset.key),decision=button.dataset.decision;
    const records=AuditBridge.loadRecords();
    const index=records.findIndex(record=>AuditBridge.runKey(record)===key);if(index<0)return;
    records[index]={...records[index],internalStatus:decision,publicStatus:decision,reviewedAt:new Date().toISOString(),reason:"reviewer_decision"};
    AuditBridge.saveRecords(records);setMessage(`บันทึกผล “${AuditBridge.LABELS[decision]}” แล้ว`);render();
  });

  $("export").addEventListener("click",()=>{
    const rows=AuditBridge.latestRecords().map(AuditBridge.publishableRecord).filter(Boolean);
    const url=URL.createObjectURL(new Blob(["\uFEFF"+AuditBridge.toCSV(rows)],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`OOE-Auditor-Public-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
    setMessage(`ส่งออกข้อมูลสาธารณะ ${rows.length.toLocaleString("th-TH")} รายการแล้ว โดยไม่มีสถานะสีส้มและสีเทา`);
  });

  $("clear").addEventListener("click",()=>{
    if(!confirm("ล้างผลตรวจที่นำเข้าในเบราว์เซอร์นี้ทั้งหมดหรือไม่"))return;
    AuditBridge.saveRecords([]);setMessage("ล้างข้อมูลทดลองแล้ว");render();
  });
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
  refreshWorkerStatus().catch(()=>{});
})();
