const TRACKING_PARAMS = /^(?:utm_.*|fbclid|gclid|si|feature|t|nav|ga|referrer|referrerscenario|usp)$/i;

export function canonicalReviewTarget(value = "") {
  try {
    const url = new URL(String(value || ""));
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return String(value || "").trim(); }
}

const firstSessionKinds = [[], [], ["file", "file_link"], ["video", "video_candidate"], ["podcast"], ["assignment"], ["ai_tutor"]];
const weeklyKinds = [["plan"], ["file", "file_link"], ["video", "video_candidate"], ["podcast"], ["pre_quiz"], ["post_quiz"], ["assignment"]];

function parseCriterionKey(key = "") {
  const match = String(key).match(/^criterion:(\d+):(\d+)$/);
  return match ? { session:Number(match[1]), criterion:Number(match[2]) } : null;
}

function criterionKinds(key = "") {
  const parsed = parseCriterionKey(key);
  if (!parsed) return [];
  return (parsed.session === 1 ? firstSessionKinds : weeklyKinds)[parsed.criterion - 1] || [];
}

function criterionCategory(key = "") {
  const parsed = parseCriterionKey(key);
  const kinds = criterionKinds(key);
  if (!parsed || !kinds.length) return "";
  return `${parsed.session === 1 ? "first" : "weekly"}:${kinds.join("+")}`;
}

function evidenceTargetsForCriterion(payload, key) {
  const parsed = parseCriterionKey(key);
  const kinds = new Set(criterionKinds(key));
  if (!parsed || !kinds.size) return [];
  const activities = Array.isArray(payload?.evidenceSnapshot?.activities) ? payload.evidenceSnapshot.activities : [];
  return [...new Set(activities
    .filter((item) => Number(item?.auditSession) === parsed.session && kinds.has(String(item?.kind || "")))
    .map((item) => canonicalReviewTarget(item?.externalUrl || item?.href || ""))
    .filter(Boolean))].sort();
}

function sameTargets(left = [], right = []) {
  return left.length > 0 && left.length === right.length && left.every((value, index) => value === right[index]);
}

function allEvidenceTargets(payload) {
  const activities = Array.isArray(payload?.evidenceSnapshot?.activities) ? payload.evidenceSnapshot.activities : [];
  return [...new Set(activities.map((item) => canonicalReviewTarget(item?.externalUrl || item?.href || "")).filter(Boolean))].sort();
}

function currentReviewKeys(payload) {
  const reviewable = Array.isArray(payload?.reviewableCriteria) ? payload.reviewableCriteria : [];
  const criterionKeys = reviewable.map((item) => `criterion:${item.session}:${item.criterion}`);
  const manualKeys = String(payload?.group || "").toUpperCase() === "GN" ? [] : [
    "manual:student_meetings", "manual:video_quality", "manual:media_placement", "manual:submission_policy", "manual:backup"
  ];
  const confirmed = Math.max(0, Number(payload?.confirmedScore ?? payload?.score ?? 0));
  const possible = Math.max(confirmed, Number(payload?.possibleScore ?? confirmed));
  const count = Math.max(0, Math.round(possible - confirmed));
  const criterionLimit = manualKeys.length ? Math.max(0, count - manualKeys.length) : count;
  return [...criterionKeys.slice(0, criterionLimit), ...manualKeys].slice(0, count);
}

export function matchingPriorReviewDecisions(currentPayload, previousPayload) {
  const prior = previousPayload?.reviewConfirmation?.decisions;
  if (!prior || typeof prior !== "object") return {};
  const priorCriterionKeys = Object.keys(prior).filter((key) => parseCriterionKey(key));
  const currentKeys = currentReviewKeys(currentPayload);
  const matches = {};
  for (const currentKey of currentKeys.filter((key) => parseCriterionKey(key))) {
    const currentTargets = evidenceTargetsForCriterion(currentPayload, currentKey);
    if (!currentTargets.length) continue;
    const exact = Object.prototype.hasOwnProperty.call(prior, currentKey)
      && sameTargets(currentTargets, evidenceTargetsForCriterion(previousPayload, currentKey)) ? currentKey : "";
    const shifted = exact || priorCriterionKeys.find((priorKey) => criterionCategory(priorKey) === criterionCategory(currentKey)
      && sameTargets(currentTargets, evidenceTargetsForCriterion(previousPayload, priorKey)));
    if (shifted) matches[currentKey] = Boolean(prior[shifted]);
  }
  if (sameTargets(allEvidenceTargets(currentPayload), allEvidenceTargets(previousPayload))) {
    for (const key of currentKeys.filter((value) => value.startsWith("manual:"))) {
      if (Object.prototype.hasOwnProperty.call(prior, key)) matches[key] = Boolean(prior[key]);
    }
  }
  return matches;
}

export function applyReviewDecisionStatuses(source, decisions = {}, outcome = {}) {
  const snapshot = source?.evidenceSnapshot || {};
  for (const week of Array.isArray(snapshot.weeks) ? snapshot.weeks : []) {
    for (const item of Array.isArray(week?.criteria) ? week.criteria : []) {
      const key = `criterion:${week.session}:${item.criterion}`;
      if (!Object.prototype.hasOwnProperty.call(decisions, key)) continue;
      item.status = decisions[key] ? "pass" : "fail";
      item.confirmedByReviewer = decisions[key] === true;
      item.reviewerConfirmedMissing = decisions[key] !== true;
    }
  }
  if (Array.isArray(source?.reviewableCriteria)) {
    source.reviewableCriteria = source.reviewableCriteria.filter((item) => !Object.prototype.hasOwnProperty.call(decisions, `criterion:${item.session}:${item.criterion}`));
  }
  source.manualReviewDecisions = { ...(source.manualReviewDecisions || {}), ...Object.fromEntries(Object.entries(decisions).filter(([key]) => key.startsWith("manual:"))) };
  if (Number.isFinite(Number(outcome.confirmedScore))) source.confirmedScore = Number(outcome.confirmedScore);
  if (Number.isFinite(Number(outcome.possibleScore))) source.possibleScore = Number(outcome.possibleScore);
  if (outcome.internalStatus) source.internalStatus = outcome.internalStatus;
  if (outcome.publicStatus) source.publicStatus = outcome.publicStatus;
  return source;
}

export function reusePriorReviewDecisions(currentPayload, previousPayload, previousRunId = "") {
  const decisions = matchingPriorReviewDecisions(currentPayload, previousPayload);
  const entries = Object.entries(decisions);
  if (!entries.length) return { payload:currentPayload, decisions:{}, reused:0 };
  const accepted = entries.filter(([, value]) => value).length;
  const rejected = entries.length - accepted;
  const confirmedScore = Math.max(0, Number(currentPayload.confirmedScore ?? currentPayload.score ?? 0)) + accepted;
  const oldPossible = Math.max(confirmedScore, Number(currentPayload.possibleScore ?? confirmedScore));
  const possibleScore = Math.max(confirmedScore, oldPossible - rejected);
  const threshold = Number(currentPayload.threshold ?? 80);
  const internalStatus = confirmedScore >= threshold ? "pass" : possibleScore >= threshold ? "needs_review" : "has_content";
  applyReviewDecisionStatuses(currentPayload, decisions, { confirmedScore, possibleScore, internalStatus, publicStatus:internalStatus === "pass" ? "pass" : currentPayload.publicStatus });
  currentPayload.priorCriterionDecisions = entries.map(([key, accepted]) => ({ key, accepted, reusedFromRunId:previousRunId }));
  currentPayload.priorReviewReuse = { runId:previousRunId, reusedAt:new Date().toISOString(), basis:"same_criterion_and_canonical_destinations", reusedItems:entries.length };
  currentPayload.reviewConfirmation = {
    ...(previousPayload.reviewConfirmation || {}),
    decisions,
    reusedFromRunId:previousRunId,
    reusedAt:new Date().toISOString(),
    reuseBasis:"same_criterion_and_canonical_destinations"
  };
  return { payload:currentPayload, decisions, reused:entries.length };
}

