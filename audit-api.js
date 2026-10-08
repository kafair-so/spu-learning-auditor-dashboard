(() => {
  const cfg=window.OOE_AUTH_CONFIG||{};
  const base=String(cfg.backendApiUrl||"").replace(/\/$/,"");
  const enabled=()=>Boolean(base);
  const first=(value,...fallbacks)=>[value,...fallbacks].find(item=>item!==undefined&&item!==null);
  function normalizeRecord(record={}){
    return {
      ...record,
      courseId:first(record.courseId,record.course_id,""),
      courseCode:first(record.courseCode,record.course_code,""),
      courseTitle:first(record.courseTitle,record.course_title,""),
      courseProfile:first(record.courseProfile,record.course_profile,""),
      courseUrl:first(record.courseUrl,record.course_url,""),
      group:first(record.group,record.courseGroup,record.course_group,""),
      faculty:first(record.faculty,""),
      instructors:first(record.instructors,record.instructorNames,record.instructor_names,[]),
      publicStatus:first(record.publicStatus,record.public_status,record.status,""),
      internalStatus:first(record.internalStatus,record.internal_status,""),
      confirmedScore:first(record.confirmedScore,record.score,null),
      possibleScore:first(record.possibleScore,record.possible_score,null),
      maxScore:first(record.maxScore,record.max_score,110),
      threshold:first(record.threshold,record.passingScore,record.passing_score,null),
      auditedAt:first(record.auditedAt,record.audited_at,""),
      publishedAt:first(record.publishedAt,record.published_at,""),
      runId:first(record.runId,record.run_id,record.publishedRunId,record.published_run_id,""),
      auditorVersion:first(record.auditorVersion,record.auditor_version,""),
      evidenceAvailable:Boolean(first(record.evidenceAvailable,record.evidence_available,false))
    };
  }
  async function request(path,options={}){
    if(!enabled())throw new Error("ยังไม่ได้ตั้งค่า Backend API");
    if(options.auth!==false){
      const renewed=await OOEAuth.ensureFreshCredential({interactive:false});
      if(!renewed)throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อให้เครื่องตรวจทำงานต่อ");
    }
    const token=OOEAuth.getCredential();
    if(options.auth!==false&&!token)throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อให้เครื่องตรวจทำงานต่อ");
    const {auth,...fetchOptions}=options;
    const response=await fetch(base+"/api"+path,{...fetchOptions,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),apikey:cfg.supabasePublishableKey||"",...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
    if(!response.ok){let detail={};try{detail=await response.json();}catch{}const message=detail.error||`HTTP ${response.status}`;if(response.status===401||OOEAuth.isSessionError(message))throw new Error("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อให้เครื่องตรวจทำงานต่อ");throw new Error(message);}
    return response.json();
  }
  async function publicResults(){
    const payload=await request("/v1/public/results",{auth:false});
    return {...payload,courses:(payload.courses||[]).map(normalizeRecord)};
  }
  async function courseHistory(courseId){
    const payload=await request(`/v1/public/courses/${encodeURIComponent(courseId)}/history`);
    return {...normalizeRecord(payload),runs:(payload.runs||[]).map(normalizeRecord)};
  }
  async function evidence(courseId,runId){
    const payload=await request(`/v1/evidence/${encodeURIComponent(courseId)}/${encodeURIComponent(runId)}`);
    const signedUrl=payload.signedUrl||payload.signedURL||payload.signed_url;
    if(!signedUrl)throw new Error("ไม่พบไฟล์หลักฐาน");
    const response=await fetch(signedUrl,{cache:"no-store"});
    if(!response.ok)throw new Error(`เปิดไฟล์หลักฐานไม่สำเร็จ (HTTP ${response.status})`);
    return response.json();
  }
  async function adminEvidence(courseId,runId){
    const payload=await request(`/v1/admin/evidence/${encodeURIComponent(courseId)}/${encodeURIComponent(runId)}`);
    const signedUrl=payload.signedUrl||payload.signedURL||payload.signed_url;
    if(!signedUrl)throw new Error("ไม่พบไฟล์หลักฐาน");
    const response=await fetch(signedUrl,{cache:"no-store"});
    if(!response.ok)throw new Error(`เปิดไฟล์หลักฐานไม่สำเร็จ (HTTP ${response.status})`);
    return response.json();
  }
  window.AuditApi={
    enabled,
    normalizeRecord,
    publicResults,
    courseHistory,
    evidence,
    session:()=>request("/v1/admin/session"),
    adminResults:()=>request("/v1/admin/results"),
    adminCourseHistory:courseId=>request(`/v1/admin/courses/${encodeURIComponent(courseId)}/history`),
    adminEvidence,
    decideResult:(runId,reviewDecisions,note="")=>request(`/v1/admin/results/${encodeURIComponent(runId)}/decision`,{method:"POST",body:JSON.stringify({reviewDecisions,note})}),
    accessUsers:()=>request("/v1/admin/access-users"),
    saveAccessUser:(email,displayName="",role="admin")=>request("/v1/admin/access-users",{method:"POST",body:JSON.stringify({email,displayName,role})}),
    setAccessUserStatus:(email,active)=>request(`/v1/admin/access-users/${encodeURIComponent(email)}/status`,{method:"POST",body:JSON.stringify({active})}),
    queueMissing:catalogVersion=>request("/v1/admin/jobs/missing",{method:"POST",body:JSON.stringify({catalogVersion})}),
    refreshAll:()=>request("/v1/admin/jobs/refresh",{method:"POST",body:"{}"}),
    uploadResult:result=>request("/v1/admin/results",{method:"POST",body:JSON.stringify(result)}),
    claimJob:()=>request("/v1/worker/jobs/claim",{method:"POST",body:"{}"}),
    submitResult:(jobId,result)=>request(`/v1/worker/jobs/${encodeURIComponent(jobId)}/result`,{method:"POST",body:JSON.stringify(result)})
  };
})();
