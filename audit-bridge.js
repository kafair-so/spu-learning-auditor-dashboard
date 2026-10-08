(() => {
  const STORAGE_KEY = "ooe_auditor_results_v1";
  const MAX_HISTORY = 3;
  const PUBLIC = new Set(["pass", "has_content", "no_content"]);
  const INTERNAL = new Set(["pass", "needs_review", "has_content", "no_content", "audit_failed"]);
  const LABELS = Object.freeze({
    pass:"ผ่าน",
    needs_review:"รอตรวจ",
    has_content:"มีเนื้อหา",
    no_content:"ไม่มีเนื้อหา",
    audit_failed:"ตรวจไม่สำเร็จ"
  });
  const COLORS = Object.freeze({pass:"green",needs_review:"orange",has_content:"yellow",no_content:"red",audit_failed:"gray"});

  const clean = value => String(value ?? "").trim();
  const normalized = value => clean(value).toLowerCase().replace(/\s+/g, "");
  const safeUrl = value => {
    try { const url = new URL(clean(value)); return /^https?:$/.test(url.protocol) ? url.href : ""; }
    catch (_) { return ""; }
  };
  const courseId = value => {
    try { return new URL(clean(value)).searchParams.get("id") || ""; }
    catch (_) { return ""; }
  };

  function parseCSV(text) {
    const rows=[]; let row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(ch==='"'&&quoted&&next==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=!quoted;
      else if(ch===','&&!quoted){row.push(cell);cell="";}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";}
      else cell+=ch;
    }
    if(cell||row.length){row.push(cell);rows.push(row);}
    if(!rows.length)return[];
    const headers=rows[0].map(clean);
    return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));
  }

  function normalizeLegacyRow(row) {
    return {
      group:clean(row.group).toUpperCase(), faculty:clean(row.faculty), courseCode:clean(row.courseCode).toUpperCase(),
      credits:clean(row.credits), courseProfile:clean(row.courseProfile), courseName:clean(row.courseName),
      instructors:clean(row.instructors), progress:clean(row.progress), reviewStatus:clean(row.reviewStatus),
      courseLink:safeUrl(row.courseLink), evidence:safeUrl(row.evidence)
    };
  }

  function identityKeys(value) {
    const keys=[];
    const id=clean(value.courseId)||courseId(value.courseUrl||value.courseLink);
    if(id)keys.push(`id:${id}`);
    if(clean(value.courseProfile))keys.push(`profile:${normalized(value.courseProfile)}`);
    if(clean(value.courseCode))keys.push(`code:${clean(value.group).toUpperCase()}:${normalized(value.courseCode)}`);
    return keys;
  }

  function recordKey(record) {
    return identityKeys(record)[0] || `audit:${clean(record.auditId)||clean(record.runId)||Date.now()}`;
  }

  function sameCourse(left, right) {
    const keys=new Set(identityKeys(left));
    return identityKeys(right).some(key=>keys.has(key));
  }

  function runKey(record) {
    return clean(record.auditId)||clean(record.runId)||`${recordKey(record)}:${clean(record.auditedAt)}`;
  }

  function loadRecords() {
    try { const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); return Array.isArray(data)?data:[]; }
    catch (_) { return []; }
  }

  function saveRecords(records) {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(records));
    return records;
  }

  function validateRecord(record) {
    if(!record||typeof record!=="object")throw new Error("รูปแบบผลตรวจไม่ถูกต้อง");
    if(record.recordType!=="spu_learning_audit_result"||Number(record.schemaVersion)<1)throw new Error("ไฟล์นี้ไม่ใช่ผลจาก SPU Learning Auditor รุ่นที่รองรับ");
    if(!INTERNAL.has(record.internalStatus))throw new Error("สถานะผลตรวจไม่ถูกต้อง");
    if(!identityKeys(record).length)throw new Error("ผลตรวจไม่มี Course ID, Course Profile หรือรหัสวิชาสำหรับจับคู่");
  }

  function mergeRecord(current, incoming) {
    validateRecord(incoming);
    const previousPublic = PUBLIC.has(current?.publicStatus) ? current.publicStatus : "";
    const incomingPublic = PUBLIC.has(incoming.publicStatus) ? incoming.publicStatus : "";
    const stablePublic = PUBLIC.has(incoming.internalStatus) ? incoming.internalStatus : incomingPublic || previousPublic;
    return {...current,...incoming,publicStatus:stablePublic,importedAt:new Date().toISOString()};
  }

  function importPayload(payload) {
    const incoming=Array.isArray(payload)?payload:[payload];
    let records=loadRecords();
    for(const item of incoming){
      validateRecord(item);
      const history=records.filter(existing=>sameCourse(existing,item)).sort((a,b)=>clean(b.auditedAt).localeCompare(clean(a.auditedAt)));
      const previous=history[0]||null;
      const merged=mergeRecord(previous,item);
      const duplicateIndex=records.findIndex(existing=>sameCourse(existing,item)&&runKey(existing)===runKey(item));
      if(duplicateIndex>=0)records[duplicateIndex]=merged;
      else records.push(merged);
      const retained=new Set(records.filter(existing=>sameCourse(existing,item)).sort((a,b)=>clean(b.auditedAt).localeCompare(clean(a.auditedAt))).slice(0,MAX_HISTORY));
      records=records.filter(existing=>!sameCourse(existing,item)||retained.has(existing));
    }
    saveRecords(records);
    return {count:incoming.length,total:records.length};
  }

  function latestRecords(records=loadRecords()) {
    const latest=[];
    for(const record of records.sort((a,b)=>clean(b.auditedAt).localeCompare(clean(a.auditedAt)))){
      if(!latest.some(existing=>sameCourse(existing,record)))latest.push(record);
    }
    return latest;
  }

  function historyForCourse(course, records=loadRecords()) {
    return records.filter(record=>sameCourse(record,course)).sort((a,b)=>clean(b.auditedAt).localeCompare(clean(a.auditedAt))).slice(0,MAX_HISTORY);
  }

  function matchRecord(course, records=loadRecords()) {
    const keys=new Set(identityKeys(course));
    return records
      .filter(record=>identityKeys(record).some(key=>keys.has(key)))
      .sort((a,b)=>clean(b.auditedAt).localeCompare(clean(a.auditedAt)))[0]||null;
  }

  function legacyPublicStatus(course) {
    if(/ผ่าน/.test(course.reviewStatus)&&!/ไม่ผ่าน/.test(course.reviewStatus))return"pass";
    if(/ไม่มีเนื้อหา/.test(course.progress))return"no_content";
    return"has_content";
  }

  function publicStatus(course, record) {
    return record&&PUBLIC.has(record.publicStatus)?record.publicStatus:legacyPublicStatus(course);
  }

  function publishableRecord(record) {
    if(!record||!PUBLIC.has(record.publicStatus))return null;
    return {
      group:clean(record.group),courseCode:clean(record.courseCode),courseProfile:clean(record.courseProfile),
      courseId:clean(record.courseId),courseUrl:safeUrl(record.courseUrl),publicStatus:record.publicStatus,
      publicStatusLabel:LABELS[record.publicStatus],auditedAt:clean(record.auditedAt),auditorVersion:clean(record.auditorVersion)
    };
  }

  function toCSV(rows) {
    const headers=["group","courseCode","courseProfile","courseId","courseUrl","publicStatus","publicStatusLabel","auditedAt","auditorVersion"];
    const quote=value=>`"${clean(value).replaceAll('"','""')}"`;
    return [headers,...rows.map(row=>headers.map(header=>row[header]??""))].map(row=>row.map(quote).join(",")).join("\r\n");
  }

  window.AuditBridge={STORAGE_KEY,MAX_HISTORY,PUBLIC,INTERNAL,LABELS,COLORS,parseCSV,normalizeLegacyRow,identityKeys,recordKey,runKey,sameCourse,loadRecords,saveRecords,importPayload,latestRecords,historyForCourse,matchRecord,legacyPublicStatus,publicStatus,publishableRecord,toCSV,safeUrl};
})();
