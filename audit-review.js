(() => {
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const badge=status=>status?`<span class="status ${AuditBridge.COLORS[status]}">${AuditBridge.LABELS[status]}</span>`:"—";
  const score=value=>Number.isFinite(Number(value))?Number(value).toLocaleString("th-TH"):"—";

  function setMessage(text,type="ok"){$("message").textContent=text;$("message").className=`message ${type}`;}
  function setQueueMessage(text,type="ok"){$("queueMessage").textContent=text;$("queueMessage").className=`message ${type}`;}

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
    try{if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.queueMissing("current");setQueueMessage(`สร้างคิวรายวิชาที่ยังไม่มีผล ${Number(result.queued||0).toLocaleString("th-TH")} วิชา จากข้อมูลล่าสุด ${Number(result.catalogCount||0).toLocaleString("th-TH")} วิชา`);}
    catch(error){setQueueMessage(error.message||String(error),"error");}
  });
  $("refreshAll").addEventListener("click",async()=>{
    try{if(!AuditApi.enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");const result=await AuditApi.refreshAll();setQueueMessage(`สร้างชุดอัปเดต ${Number(result.total||0).toLocaleString("th-TH")} วิชา · รหัสชุด ${result.batchId}`);}
    catch(error){setQueueMessage(error.message||String(error),"error");}
  });
})();
