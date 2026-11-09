export const INSTRUCTOR_DECISIONS = ["pending", "complete", "missing"];

export function normalizeInstructorDecision(state = {}) {
  if (INSTRUCTOR_DECISIONS.includes(state.instructor_information_status)) return state.instructor_information_status;
  return state.instructor_information === true ? "complete" : "pending";
}

export function automaticInstructorDecision(report = {}) {
  const evidence=report?.instructorEvidence||{};
  const complete=Boolean(evidence.identityComplete&&evidence.contactComplete&&evidence.hasInstructorPhoto&&evidence.names?.length);
  if(complete)return "complete";
  return evidence.scanMode==="ocr_and_dom"&&evidence.reviewStatus==="incomplete_evidence"?"missing":"pending";
}

export function resolveInstructorDecision(state = {}, report = {}) {
  const manual=normalizeInstructorDecision(state);
  return manual==="pending"?automaticInstructorDecision(report):manual;
}

export function applyInstructorDecision(report, decision) {
  if (!report?.weeks?.[0]?.checklist || !INSTRUCTOR_DECISIONS.includes(decision) || decision === "pending") return null;
  const index = report.courseType === "GN" ? 0 : 1;
  const row = report.weeks[0].checklist[index];
  if (!row) return null;
  if (decision === "complete") {
    row.status = "pass";
    row.detail = "ยืนยันข้อมูลผู้สอนครบ ได้แก่ รูป ชื่อ และช่องทางติดต่อ";
  } else {
    row.status = "fail";
    row.detail = "ตรวจพบข้อมูลผู้สอนไม่ครบ — ต้องเพิ่มรูป ชื่อ และช่องทางติดต่อ";
  }
  return row;
}

