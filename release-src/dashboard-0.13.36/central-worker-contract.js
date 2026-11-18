export const CENTRAL_WORKER_STATE_KEY = "centralWorkerState";

const text = (value) => String(value ?? "").trim();
const criteriaModes = new Set(["current", "legacy_12569"]);

export function normalizeCentralJob(payload = {}) {
  const raw = payload.job || payload;
  const course = raw.course || {};
  const courseId = text(raw.courseId || raw.course_id || course.courseId || course.course_id);
  const courseUrl = text(raw.courseUrl || raw.course_url || course.courseUrl || course.course_url)
    || (courseId ? `https://dlearning.spu.ac.th/course/view.php?id=${encodeURIComponent(courseId)}` : "");
  const profile = text(raw.courseProfile || raw.course_profile || course.courseProfile || course.course_profile);
  const inferredGroup = (profile.match(/\d{3}(GN|GR|GS)-/i) || [])[1] || "";
  const courseType = text(raw.courseType || raw.course_type || raw.courseGroup || raw.course_group || course.courseType || course.course_type || course.courseGroup || course.course_group || inferredGroup).toUpperCase();
  const jobId = text(raw.jobId || raw.job_id);
  const credits = Number(raw.credits || course.credits || 3);
  const criteriaMode = text(raw.criteriaMode || raw.criteria_mode || course.criteriaMode || course.criteria_mode || "current");
  const semesterCode = text(raw.semesterCode || raw.semester_code || course.semesterCode || course.semester_code || (criteriaMode === "legacy_12569" ? "1/2569" : ""));
  if (!jobId || !courseId || !courseUrl || !["GN", "GR", "GS"].includes(courseType) || !criteriaModes.has(criteriaMode)) {
    throw new Error("ข้อมูลคิวกลางไม่ครบ: ต้องมีรหัสงาน รหัสรายวิชา ลิงก์ และกลุ่ม GN/GR/GS");
  }
  return {
    jobId,
    courseId,
    courseUrl,
    courseType,
    credits:Number.isFinite(credits) && credits > 0 ? credits : 3,
    gnTrack:text(raw.gnTrack || raw.gn_track || raw.courseTrack || raw.course_track || course.gnTrack || course.gn_track || course.courseTrack || course.course_track || "theory"),
    courseCode:text(raw.courseCode || raw.course_code || course.courseCode || course.course_code),
    courseTitle:text(raw.courseTitle || raw.course_title || course.courseTitle || course.course_title),
    courseProfile:profile,
    // Keep the registrar's expected instructor names for matching only.
    // They are not evidence that the course has an instructor introduction.
    instructors:[raw.instructors,raw.instructor_names,course.instructors,course.instructor_names].map(value=>Array.isArray(value)?value.map(text).filter(Boolean).join(", "):text(value)).find(Boolean)||"",
    claimedAt:text(raw.claimedAt || raw.claimed_at),
    kind:text(raw.kind || "missing")
    ,criteriaMode
    ,semesterCode
  };
}

export function failedCentralResult(job, error, {runId = "", version = ""} = {}) {
  const message = text(error?.message || error || "งานตรวจไม่สำเร็จ");
  const legacyPractical = job.criteriaMode === "legacy_12569" && job.gnTrack === "practical";
  return {
    schemaVersion:2,
    recordType:"spu_learning_audit_result",
    auditId:`central-failed-${job.jobId}-${Date.now()}`,
    runId,
    auditedAt:new Date().toISOString(),
    auditorVersion:version,
    group:job.courseType,
    courseTitle:job.courseTitle,
    courseUrl:job.courseUrl,
    courseId:job.courseId,
    courseCode:job.courseCode,
    courseProfile:job.courseProfile,
    internalStatus:"audit_failed",
    publicStatus:"",
    confirmedScore:0,
    reviewablePoints:0,
    possibleScore:0,
    threshold:legacyPractical ? 40 : job.courseType === "GN" ? 0 : 80,
    reason:"worker_error",
    scoreModel:job.criteriaMode === "legacy_12569" ? "legacy_course_type_v1" : "weekly_criterion_v2",
    criteriaMode:job.criteriaMode,
    semesterCode:job.semesterCode,
    coverageComplete:false,
    evidenceSnapshot:{workerError:message}
  };
}

export function emptyCentralResult(job, scan = {}, {runId = "", version = ""} = {}) {
  const legacy = job.criteriaMode === "legacy_12569";
  const practical = job.gnTrack === "practical";
  const emptyWeeks = Array.from({length:15},(_,i)=>({session:i+1,section:`ครั้งที่ ${i+1}`,criteria:Array.from({length:7},(_,j)=>({criterion:j+1,status:"fail"}))}));
  const card = {track:practical?"practical":"theory",total:0,totalMax:practical?50:100,passScore:practical?40:80,potentialTotal:0,status:"fail",scoringMode:"legacy_course_type_v1"};
  return {
    schemaVersion:2,
    recordType:"spu_learning_audit_result",
    auditId:`central-empty-${job.jobId}-${Date.now()}`,
    runId,
    auditedAt:new Date().toISOString(),
    auditorVersion:version,
    group:job.courseType,
    courseTitle:scan.courseTitle || job.courseTitle,
    courseUrl:job.courseUrl,
    courseId:job.courseId,
    courseCode:job.courseCode,
    courseProfile:job.courseProfile,
    internalStatus:"no_content",
    publicStatus:"no_content",
    confirmedScore:0,
    reviewablePoints:0,
    possibleScore:0,
    threshold:legacy&&practical ? 40 : job.courseType === "GN" ? 0 : 80,
    hasContent:false,
    ...(legacy?{criteriaScorecard:card}:{}),
    reason:"successful_scan_found_no_course_content",
    scoreModel:job.criteriaMode === "legacy_12569" ? "legacy_course_type_v1" : "weekly_criterion_v2",
    criteriaMode:job.criteriaMode,
    semesterCode:job.semesterCode,
    coverageComplete:true,
    evidenceSnapshot:{
      ...(legacy?{criteriaScorecard:card,weeks:emptyWeeks}:{}),
      emptyReason:scan.emptyReason || "ไม่พบเนื้อหารายวิชา",
      coverage:scan.coverage || {},
      activities:[]
    }
  };
}

