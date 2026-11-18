import { CRITERIA_12569_MODE, CRITERIA_12569_SCORE_MODEL, CRITERIA_12569_SEMESTER, criteria12569Scorecard } from "./criteria-12569.js";

export const DASHBOARD_SCHEMA_VERSION = 2;
export const DASHBOARD_SCORE_MODEL = "weekly_criterion_v2";

export const INTERNAL_STATUS = Object.freeze({
  PASS: "pass",
  NEEDS_REVIEW: "needs_review",
  HAS_CONTENT: "has_content",
  NO_CONTENT: "no_content",
  AUDIT_FAILED: "audit_failed"
});

export const PUBLIC_STATUS = Object.freeze({
  PASS: "pass",
  HAS_CONTENT: "has_content",
  NO_CONTENT: "no_content"
});

const publicStatuses = new Set(Object.values(PUBLIC_STATUS));
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function courseIdentity(report = {}) {
  let courseId = "";
  try { courseId = new URL(String(report.courseUrl || "")).searchParams.get("id") || ""; }
  catch (_) {}
  const title = String(report.courseTitle || "");
  const profile = (title.match(/\b\d{3}(?:GN|GR|GS)-[^\s|]+/i) || [""])[0];
  const code = (title.match(/\b[A-Z]{2,}\s*\d{3,}[A-Z0-9-]*\b/i) || [""])[0].replace(/\s+/g, "").toUpperCase();
  return { courseId, courseCode:code, courseProfile:profile };
}

export function clearlyEmpty(report = {}) {
  const coverage = report.coverage || {};
  const sectionCount = number(coverage.courseSectionCount ?? coverage.sectionBoxes?.length, 0);
  const activityCount = number(coverage.nonForumActivityCount, -1);
  return coverage.reachedEnd === true && sectionCount > 1 && activityCount === 0;
}

export function hasMeaningfulContent(report = {}) {
  if (clearlyEmpty(report)) return false;
  if (number(report.score?.automatic ?? report.score?.totalCurrent, 0) > 0) return true;
  if ((report.weeks || []).some((week) => (week.checklist || []).some((item) => ["pass", "pass_tolerance"].includes(item.status)))) return true;
  return (report.activities || []).some((item) =>
    !item.outOfRange && !item.titleAlternativeOf && !["forum", "url", "supplementary"].includes(item.kind)
  );
}

export function dashboardDecision(report = {}, previousPublicStatus = "") {
  const score = report.score || {};
  const threshold = number(report.passScore, report.courseType === "GN" ? 0 : 80);
  const confirmedScore = number(score.automatic ?? score.totalCurrent, 0);
  const manualPoints = number(score.manualMax, report.courseType === "GN" ? 0 : 5);
  // One checklist criterion can add at most one point for its session. Raw
  // evidence counts are diagnostic counts: ten pending videos in the same
  // week still affect only that week's single video criterion.
  const reviewableCriteria = (report.weeks || []).flatMap((week, weekIndex) =>
    (week.checklist || []).map((item, criterionIndex) => ({
      item,
      session:weekIndex + 1,
      criterion:criterionIndex + 1
    }))
  ).filter(({ item }) => item.status === "needs_review")
    .map(({ session, criterion, item }) => ({ session, criterion, detail:String(item.detail || "") }));
  const totalMax = number(score.totalMax, 110);
  const reviewablePoints = Math.min(Math.max(0, totalMax - confirmedScore), manualPoints + reviewableCriteria.length);
  const possibleScore = Math.min(totalMax, confirmedScore + reviewablePoints);
  const coverage = report.coverage || {};
  const scanComplete = coverage.reachedEnd !== false && coverage.structurallyComplete !== false;
  const mandatoryGatePassed = report.courseType === "GN" || !report.mandatoryCoverage || report.mandatoryCoverage.status === "pass";

  let internalStatus;
  let reason;
  if (report.finalResult?.status === "pass" || threshold > 0 && confirmedScore >= threshold && mandatoryGatePassed) {
    internalStatus = INTERNAL_STATUS.PASS;
    reason = "confirmed_score_and_mandatory_components_reached_threshold";
  } else if (report.finalResult?.status === "fail") {
    internalStatus = hasMeaningfulContent(report) ? INTERNAL_STATUS.HAS_CONTENT : INTERNAL_STATUS.NO_CONTENT;
    reason = internalStatus === INTERNAL_STATUS.HAS_CONTENT ? "review_confirmed_below_threshold" : "review_confirmed_empty";
  } else if (!scanComplete) {
    internalStatus = INTERNAL_STATUS.AUDIT_FAILED;
    reason = "scan_incomplete";
  } else if (report.courseType === "GN") {
    internalStatus = INTERNAL_STATUS.NEEDS_REVIEW;
    reason = "gn_requires_reviewer_summary";
  } else if (possibleScore >= threshold) {
    internalStatus = INTERNAL_STATUS.NEEDS_REVIEW;
    reason = "review_can_change_outcome";
  } else if (hasMeaningfulContent(report)) {
    internalStatus = INTERNAL_STATUS.HAS_CONTENT;
    reason = "content_exists_but_cannot_reach_threshold";
  } else {
    internalStatus = INTERNAL_STATUS.NO_CONTENT;
    reason = "successful_scan_found_no_course_content";
  }

  const publicStatus = publicStatuses.has(internalStatus)
    ? internalStatus
    : publicStatuses.has(previousPublicStatus) ? previousPublicStatus : "";

  return { internalStatus, publicStatus, confirmedScore, reviewablePoints, possibleScore, threshold, reason, scoreModel:DASHBOARD_SCORE_MODEL, reviewableCriteria };
}

export function criteria12569Decision(report = {}, previousPublicStatus = "") {
  const scorecard = criteria12569Scorecard(report);
  const confirmedScore = scorecard.total;
  const possibleScore = Math.max(confirmedScore, scorecard.potentialTotal);
  const reviewablePoints = Math.max(0, possibleScore - confirmedScore);
  const hasContent = hasMeaningfulContent(report);
  const scanComplete = report.coverage?.reachedEnd !== false && report.coverage?.structurallyComplete !== false;
  let internalStatus;
  let reason;
  if (!scanComplete) {
    internalStatus = INTERNAL_STATUS.AUDIT_FAILED;
    reason = "scan_incomplete";
  } else if (scorecard.status === "pass") {
    internalStatus = INTERNAL_STATUS.PASS;
    reason = "legacy_12569_score_and_gates_passed";
  } else if (scorecard.status === "needs_review") {
    internalStatus = INTERNAL_STATUS.NEEDS_REVIEW;
    reason = "legacy_12569_review_can_change_outcome";
  } else {
    internalStatus = hasContent ? INTERNAL_STATUS.HAS_CONTENT : INTERNAL_STATUS.NO_CONTENT;
    reason = hasContent ? "legacy_12569_below_threshold_or_gate_failed" : "successful_scan_found_no_course_content";
  }
  const publicStatus = publicStatuses.has(internalStatus)
    ? internalStatus
    : publicStatuses.has(previousPublicStatus) ? previousPublicStatus : "";
  return {
    internalStatus, publicStatus, confirmedScore, reviewablePoints, possibleScore,
    threshold:scorecard.passScore, reason, scoreModel:CRITERIA_12569_SCORE_MODEL,
    reviewableCriteria:[], criteriaScorecard:scorecard
  };
}

export function buildDashboardRecord(report = {}, previousPublicStatus = "", options = {}) {
  const identity = courseIdentity(report);
  const criteriaMode = String(options.criteriaMode || options.criteria_mode || "current");
  const semesterCode = String(options.semesterCode || options.semester_code || "");
  const decision = criteriaMode === CRITERIA_12569_MODE
    ? criteria12569Decision(report, previousPublicStatus)
    : dashboardDecision(report, previousPublicStatus);
  const firstSessionLabels = ["ข้อมูลและแนะนำรายวิชา", "ข้อมูลผู้สอนและการติดต่อ", "เอกสารประกอบ", "วิดีโอบันทึกการสอนล่วงหน้า", "Podcast", "กิจกรรมท้ายบท", "AI Tutor"];
  const weeklyLabels = ["แผนการสอน", "เอกสารประกอบ", "วิดีโอบันทึกการสอนล่วงหน้า", "Podcast", "แบบทดสอบก่อนเรียน", "แบบทดสอบหลังเรียน", "กิจกรรมท้ายบท"];
  return {
    schemaVersion:DASHBOARD_SCHEMA_VERSION,
    recordType:"spu_learning_audit_result",
    auditId:report.id || "",
    runId:report.runId || "",
    auditedAt:report.createdAt || new Date().toISOString(),
    auditorVersion:report.extensionVersion || "",
    group:String(report.courseType || "").toUpperCase(),
    courseTitle:report.courseTitle || "",
    courseUrl:report.courseUrl || "",
    ...identity,
    ...decision,
    criteriaMode,
    semesterCode:criteriaMode === CRITERIA_12569_MODE ? (semesterCode || CRITERIA_12569_SEMESTER) : semesterCode,
    visibility:{score:"internal_only",instructorReport:"status_and_actions_only"},
    publicResult:{status:decision.publicStatus || (decision.internalStatus === INTERNAL_STATUS.PASS ? PUBLIC_STATUS.PASS : PUBLIC_STATUS.HAS_CONTENT),score:null},
    coverageComplete:report.coverage?.reachedEnd !== false && report.coverage?.structurallyComplete !== false,
    evidenceSnapshot:{
      instructorSummary:{identityComplete:Boolean(report.instructorEvidence?.identityComplete),contactComplete:Boolean(report.instructorEvidence?.contactComplete),hasInstructorPhoto:Boolean(report.instructorEvidence?.hasInstructorPhoto),matchedExpectedInstructor:Boolean(report.instructorEvidence?.expectedInstructorMatches?.length),contactChannelCount:Number(report.instructorEvidence?.contactChannels?.length || 0)},
      summary:report.summary || {},
      coverage:report.coverage || {},
      mandatoryCoverage:report.mandatoryCoverage || null,
      criteriaScorecard:decision.criteriaScorecard || null,
      weeks:(report.weeks || []).map((week, weekIndex) => ({
        session:weekIndex + 1,
        section:week.section || `ครั้งที่ ${weekIndex + 1}`,
        criteria:(week.checklist || []).map((item, criterionIndex) => ({
          criterion:criterionIndex + 1,
          label:(weekIndex === 0 ? firstSessionLabels : weeklyLabels)[criterionIndex] || `หัวข้อที่ ${criterionIndex + 1}`,
          status:item.status || "",
          detail:item.detail || ""
        }))
      })),
      activities:(report.activities || []).map((item) => ({
        section:item.section || "",
        auditSession:item.auditSession ?? null,
        title:item.title || "",
        groupContext:item.groupContext || "",
        kind:item.kind || "",
        href:item.href || "",
        externalUrl:item.externalUrl || "",
        durationSeconds:number(item.durationSeconds,0),
        systemDurationSeconds:number(item.systemDurationSeconds,0),
        reviewerDurationSeconds:number(item.reviewerDurationSeconds,0),
        reviewerDurationConfirmed:Boolean(item.reviewerDurationConfirmed),
        reviewerConfirmedAt:item.reviewerConfirmedAt || null,
        reviewReused:Boolean(item.reviewReused),
        mediaType:item.mediaType || "",
        mediaStatus:item.mediaStatus || "",
        provider:item.provider || "",
        podcastDelivery:item.podcastDelivery || "",
        mediaReviewRequired:Boolean(item.mediaReviewRequired),
        mediaReviewDecision:item.mediaReviewDecision || "",
        reviewExcluded:Boolean(item.reviewExcluded),
        linkStatus:item.linkStatus || "",
        accessNote:item.accessNote || "",
        countingEligible:item.countingEligible !== false
      }))
    }
  };
}

export function downloadDashboardRecord(record, filename = "spu-audit-dashboard.json") {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], {type:"application/json;charset=utf-8"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

