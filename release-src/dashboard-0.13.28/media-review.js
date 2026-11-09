export const MEDIA_DECISIONS = ["pending", "use", "recording", "activity", "supplementary", "not_video"];
export const DEFINITIVE_MEDIA_FAILURES = new Set(["access_denied", "login_required", "link_unavailable", "empty_media", "no_video", "link_error", "reviewer_confirmed_unreadable"]);
export function updateNoVideoProbe(state = {}, observation = {}) {
  const signature = String(observation.pageSignature || "");
  const clean = observation.pageFullyLoaded === true
    && Number(observation.pageContentLength || 0) >= 20
    && Number(observation.loadingIndicatorCount || 0) === 0
    && Number(observation.playerContainerCount || 0) === 0
    && observation.networkIssue !== true
    && observation.mediaDetected !== true
    && !observation.durationSeconds;
  if (!clean || !signature) return {signature:"",consecutive:0,confirmed:false};
  const consecutive = state.signature === signature ? Number(state.consecutive || 0) + 1 : 1;
  return {signature,consecutive,confirmed:consecutive >= 3};
}
export function isDefinitiveMediaFailure(item) {
  return DEFINITIVE_MEDIA_FAILURES.has(item?.mediaStatus);
}
export function requiresMediaReview(item) {
  // A confirmed access wall or broken destination is already a final result.
  // It must never also appear as an ambiguous clip awaiting a reviewer.
  if (item?.mediaReviewDecision && item.mediaReviewDecision !== "pending") return false;
  return item.kind === "video" && !isDefinitiveMediaFailure(item) && (item.mediaReviewRequired || item.mediaCandidateProbe || item.classification?.contextConflict || !item.durationSeconds);
}
export function videoStatusWithFailures(items, computedStatus) {
  // Broken or access-restricted extras must not erase duration already proven
  // by valid clips. They remain visible as issues, but the time row passes
  // once usable media reaches the rubric threshold.
  if (computedStatus === "pass" || computedStatus === "pass_tolerance") return computedStatus;
  return items.some(isDefinitiveMediaFailure) ? "fail" : computedStatus;
}
function stableMediaTarget(value = "") {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|fbclid|gclid|si$|feature$|t$)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return String(value || "").trim();
  }
}
export function mediaReviewFingerprint(item = {}) {
  return JSON.stringify({
    target:stableMediaTarget(item.externalUrl || item.href || ""),
    kind:"video"
  });
}

function savedMediaReview(reviews, item) {
  const direct = reviews[item.href];
  if (direct) return direct;
  const target = stableMediaTarget(item.externalUrl || item.href || "");
  return Object.values(reviews || {}).find((review) => stableMediaTarget(review?.targetUrl || "") === target) || {};
}
export function parseMediaReviewDuration(value) {
  const parts=String(value || "").trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part)=>!/^\d{1,3}$/.test(part))) return null;
  const numbers=parts.map(Number);
  if (parts.length === 2 && numbers[1] < 60) return numbers[0] * 60 + numbers[1];
  if (parts.length === 3 && numbers[1] < 60 && numbers[2] < 60) return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
  return null;
}
export function applyMediaReviews(items, reviews = {}) {
  for (const item of items) {
    if (item.kind === "video") {
      if (!("systemDurationSeconds" in item)) item.systemDurationSeconds = item.source === "reviewer-confirmed-video-time" ? null : (item.durationSeconds || null);
      if (!("systemDurationSource" in item)) item.systemDurationSource = item.source === "reviewer-confirmed-video-time" ? null : (item.source || null);
      if (!("systemMediaStatus" in item)) item.systemMediaStatus = item.mediaStatus || null;
      if (!("systemAccessNote" in item)) item.systemAccessNote = item.accessNote || null;
      item.durationSeconds = item.systemDurationSeconds || null;
      if (item.systemDurationSource) item.source = item.systemDurationSource;
      if (item.systemMediaStatus) item.mediaStatus = item.systemMediaStatus;
      if (item.systemAccessNote) item.accessNote = item.systemAccessNote;
      item.reviewerDurationSeconds = null;
      item.reviewerDurationConfirmed = false;
    }
    if (item.kind === "video" && isDefinitiveMediaFailure(item)) {
      item.mediaReviewRequired = false;
      item.mediaReviewDecision = null;
      item.reviewExcluded = false;
      continue;
    }
    const savedReview = savedMediaReview(reviews,item);
    const fingerprint = mediaReviewFingerprint(item);
    const reviewMatches = !savedReview.fingerprint || savedReview.fingerprint === fingerprint;
    if (savedReview.fingerprint && !reviewMatches) {
      item.previousMediaReviewInvalidated = true;
      item.mediaReviewDecision = "pending";
      item.mediaReviewRequired = true;
      item.reviewExcluded = false;
    }
    if (savedReview.decision && !savedReview.fingerprint) {
      savedReview.fingerprint = fingerprint;
      savedReview.migratedAt = new Date().toISOString();
    }
    const savedDecision = reviewMatches ? (savedReview.decision || item.mediaReviewDecision || "pending") : "pending";
    if (savedDecision !== "pending") {
      item.mediaReviewRequired = false;
      item.mediaReviewDecision = savedDecision;
      item.reviewReused = Boolean(savedReview.updatedAt || savedReview.confirmedAt);
      item.reviewerConfirmedAt = savedReview.updatedAt || savedReview.confirmedAt || null;
      item.reviewExcluded = ["recording","activity","supplementary","not_video"].includes(savedDecision);
      if (item.reviewExcluded) item.countingEligible = false;
      else if (!item.duplicateOf) {
        item.countingEligible = true;
        const reviewerSeconds = Number(savedReview.seconds || 0);
        if (savedDecision === "use" && reviewerSeconds > 0) {
          item.durationSeconds = Math.round(reviewerSeconds);
          item.reviewerDurationSeconds = Math.round(reviewerSeconds);
          item.reviewerDurationConfirmed = true;
          item.source = "reviewer-confirmed-video-time";
          item.mediaStatus = "reviewer_confirmed_time";
          item.accessNote = "ผู้ตรวจยืนยันประเภทและเวลาวิดีโอรายการนี้";
        }
      }
      continue;
    }
    if (!requiresMediaReview(item)) continue;
    item.mediaReviewRequired = true;
    item.mediaReviewDecision = "pending";
    item.reviewExcluded = ["recording","activity","supplementary","not_video"].includes(item.mediaReviewDecision);
    if (item.reviewExcluded) item.countingEligible = false;
    else if (!item.duplicateOf) item.countingEligible = true;
  }
}
export function parsePodcastParts(minutes, seconds) {
  if (!/^\d{1,2}$/.test(minutes) || !/^\d{1,2}$/.test(seconds)) return null;
  if (Number(seconds) > 59) return null;
  const value = Number(minutes) * 60 + Number(seconds);
  return value > 0 ? value : null;
}
export function finalReviewBlockerDetails(report) {
  const c = report.coverage || {};
  const details = [];
  if (c.reachedEnd === false) details.push("ระบบยังอ่านหน้าเรียนไม่ถึงท้ายหน้า");
  if (c.structurallyComplete === false) details.push("โครงสร้างครั้งเรียนยังไม่ครบ");
  if (c.topologyReviewRequired === true || !c.topologyManuallyConfirmed && (c.topologyConfidence === "low" || (c.topologyDiagnostics || []).some(x => !x.excluded && /ขัด|เกิน/.test(x.reason || "")))) details.push("โครงสร้าง Section ยังขัดแย้งหรือยังไม่ได้รับการยืนยัน");
  if (Number(c.unmappedNonForumActivityCount || 0) > 0) details.push(`ยังจับคู่ครั้งเรียนไม่ได้ ${c.unmappedNonForumActivityCount} รายการ`);
  const typeItems = (report.activities || []).filter(item => !item.titleAlternativeOf && (item.kind === "video_candidate" || item.kind === "assignment_image_candidate" || item.classification?.contextConflict && (!item.mediaReviewRequired || item.mediaReviewDecision === "pending")));
  if (Number(c.unresolvedClassificationCount || 0) > 0) details.push(typeItems.length ? `ยังไม่ยืนยันประเภท: ${typeItems.slice(0,3).map(item => item.title || "ไม่ระบุชื่อ").join(", ")}` : `ยังไม่ยืนยันประเภทรายการ ${c.unresolvedClassificationCount} รายการ`);
  if (Number(c.unresolvedScoringEvidenceCount || 0) > 0) {
    const scoringItems = (report.activities || []).filter(item => !item.outOfRange && item.auditSession && ["video","podcast"].includes(item.kind) && item.countingEligible !== false && (item.mediaReviewRequired && item.mediaReviewDecision !== "use" || !item.durationSeconds) && !isDefinitiveMediaFailure(item));
    details.push(scoringItems.length ? `ยังมีหลักฐานที่มีผลต่อคะแนนค้าง: ${scoringItems.slice(0,3).map(item => item.title || "ไม่ระบุชื่อ").join(", ")}` : `ยังมีหลักฐานที่มีผลต่อคะแนนค้าง ${c.unresolvedScoringEvidenceCount} รายการ`);
  }
  for (const week of report.weeks || []) {
    const count = (week.checklist || []).filter(item => item.status === "needs_review").length;
    if (count) details.push(`${week.section || "ไม่ระบุครั้ง"} ยังต้องตรวจทาน ${count} หัวข้อ`);
  }
  return [...new Set(details)];
}
export function finalReviewBlockers(report) {
  return finalReviewBlockerDetails(report).length > 0;
}

