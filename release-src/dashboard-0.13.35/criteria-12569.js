export const CRITERIA_12569_MODE = "legacy_12569";
export const CRITERIA_12569_SEMESTER = "1/2569";
export const CRITERIA_12569_SCORE_MODEL = "legacy_course_type_v1";

const PASS = new Set(["pass", "pass_tolerance"]);
const pass = status => PASS.has(status) ? 1 : 0;
const possible = status => PASS.has(status) || status === "needs_review" ? 1 : 0;
const half = value => Math.round((Number(value) || 0) * 2) / 2;
const proportional = (rows, weight, value = pass) => rows.length ? half(rows.reduce((sum, status) => sum + value(status), 0) / rows.length * weight) : 0;
const session = (week, index) => Number(String(week?.section || "").match(/\d+/)?.[0]) || index + 1;

export function normalize12569Track(value) {
  return value === "practical" ? "practical" : "theory";
}

// Dashboard checklists contain Podcast and AI Tutor columns.  The 1/2569
// reduced rubric deliberately ignores both, and treats the first-session
// teaching plan as the same evidence as its teaching material.
export function criteria12569Weeks(weeks = []) {
  return (weeks || []).map((week, index) => {
    const items = week?.checklist || [];
    const first = session(week, index) === 1;
    return {
      ...week,
      checklist:first
        ? [items[0], items[1], items[2], items[2], items[3], items[5]]
        : [items[0], items[1], items[2], items[4], items[5], items[6]]
    };
  });
}

function structurePending(coverage = {}) {
  return coverage.reachedEnd === false
    || coverage.structurallyComplete === false
    || coverage.topologyReviewRequired === true
    || Number(coverage.unmappedNonForumActivityCount || 0) > 0
    || Number(coverage.unresolvedClassificationCount || 0) > 0
    || Number(coverage.unresolvedScoringEvidenceCount || 0) > 0;
}

function videoCoverage(weeks, track) {
  const requiredSessions = track === "practical" ? 7 : 15;
  const rows = Array.from({length:15}, (_, index) => {
    const item = weeks.find((week, weekIndex) => session(week, weekIndex) === index + 1);
    return item?.checklist?.[index === 0 ? 4 : 2]?.status || "fail";
  });
  const completeSessions = rows.reduce((sum, status) => sum + pass(status), 0);
  const reviewSessions = rows.filter(status => status === "needs_review").length;
  return {requiredSessions, completeSessions, reviewSessions};
}

function theoryScore(weeks, coverage) {
  const first = weeks.find((week, index) => session(week, index) === 1)?.checklist || [];
  const weekly = Array.from({length:14}, (_, index) => weeks.find((week, weekIndex) => session(week, weekIndex) === index + 2)?.checklist || []);
  const plan = [first[2]?.status, ...weekly.map(items => items[0]?.status)];
  const materials = [first[3]?.status, ...weekly.map(items => items[1]?.status)];
  const pre = weekly.map(items => items[3]?.status);
  const post = weekly.map(items => items[4]?.status);
  const activities = [first[5]?.status, ...weekly.map(items => items[5]?.status)];
  const video = videoCoverage(weeks, "theory");
  const instructor = Number.isFinite(Number(first[1]?.scoreValue)) ? Math.max(0, Math.min(5, Number(first[1].scoreValue))) : pass(first[1]?.status) * 5;
  const parts = {
    courseInformation:half(pass(first[0]?.status) * 5 + instructor),
    teachingPlan:half(plan.reduce((sum, status) => sum + pass(status), 0)),
    teachingMaterials:proportional(materials, 15),
    video:half(Math.min(1, video.completeSessions / 15) * 30),
    preTest:proportional(pre, 7.5),
    postTest:proportional(post, 7.5),
    assignment:half(activities.reduce((sum, status) => sum + pass(status), 0))
  };
  const totalRaw = half(Object.values(parts).reduce((sum, value) => sum + value, 0));
  const total = totalRaw === 79.5 ? 80 : totalRaw;
  const potentialInstructor = first[1]?.status === "needs_review" ? 5 : instructor;
  const potential = half(
    (possible(first[0]?.status) ? 5 : 0) + potentialInstructor
    + plan.reduce((sum, status) => sum + possible(status), 0)
    + proportional(materials, 15, possible)
    + Math.min(1, (video.completeSessions + video.reviewSessions) / 15) * 30
    + proportional(pre, 7.5, possible)
    + proportional(post, 7.5, possible)
    + activities.reduce((sum, status) => sum + possible(status), 0)
  );
  const pending = structurePending(coverage) || [...plan, ...materials, ...pre, ...post, ...activities].includes("needs_review") || video.reviewSessions > 0;
  return {...parts, total, totalMax:100, passScore:80, potentialTotal:structurePending(coverage) ? 100 : potential, pending};
}

function practicalScore(weeks, coverage) {
  const first = weeks.find((week, index) => session(week, index) === 1)?.checklist || [];
  const weekly = Array.from({length:14}, (_, index) => weeks.find((week, weekIndex) => session(week, weekIndex) === index + 2)?.checklist || []);
  const plan = [first[2]?.status, ...weekly.map(items => items[0]?.status)];
  const materials = [first[3]?.status, ...weekly.map(items => items[1]?.status)];
  const pre = weekly.map(items => items[3]?.status);
  const post = weekly.map(items => items[4]?.status);
  const activities = [first[5]?.status, ...weekly.map(items => items[5]?.status)];
  const video = videoCoverage(weeks, "practical");
  const rowsPass = rows => rows.reduce((sum, status) => sum + pass(status), 0);
  const rowsPossible = rows => rows.reduce((sum, status) => sum + possible(status), 0);
  const parts = {
    courseInformation:half(pass(first[0]?.status) * 2.5 + pass(first[1]?.status) * 2.5),
    teachingPlan:proportional(plan, 7.5),
    teachingMaterials:proportional(materials, 7.5),
    video:half(Math.min(1, video.completeSessions / 7) * 7.5),
    preTest:proportional(pre, 5),
    postTest:proportional(post, 5),
    assignment:proportional(activities, 12.5)
  };
  const total = half(Object.values(parts).reduce((sum, value) => sum + value, 0));
  const potentialTotal = half(
    (possible(first[0]?.status) + possible(first[1]?.status)) * 2.5
    + proportional(plan, 7.5, possible) + proportional(materials, 7.5, possible)
    + Math.min(1, (video.completeSessions + video.reviewSessions) / 7) * 7.5
    + proportional(pre, 5, possible) + proportional(post, 5, possible)
    + proportional(activities, 12.5, possible)
  );
  const gates = {video:video.completeSessions >= 7, preTest:rowsPass(pre) >= 7, postTest:rowsPass(post) >= 7, firstSessionActivity:PASS.has(first[5]?.status)};
  const potentialGates = {video:video.completeSessions + video.reviewSessions >= 7, preTest:rowsPossible(pre) >= 7, postTest:rowsPossible(post) >= 7, firstSessionActivity:possible(first[5]?.status) === 1};
  const pending = structurePending(coverage) || [...plan, ...materials, ...pre, ...post, ...activities].includes("needs_review") || video.reviewSessions > 0;
  return {...parts, total, totalMax:50, passScore:40, potentialTotal, pending, gates, potentialGates};
}

export function criteria12569Scorecard(report = {}) {
  const track = normalize12569Track(report.gnTrack || report.courseTrack || report.mandatoryCoverage?.track);
  const weeks = criteria12569Weeks(report.weeks || []);
  const score = track === "practical" ? practicalScore(weeks, report.coverage || {}) : theoryScore(weeks, report.coverage || {});
  const gatesPass = !score.gates || Object.values(score.gates).every(Boolean);
  const potentialGatesPass = !score.potentialGates || Object.values(score.potentialGates).every(Boolean);
  const status = score.total >= score.passScore && gatesPass
    ? "pass"
    : score.pending && score.potentialTotal >= score.passScore && potentialGatesPass ? "needs_review" : "fail";
  return {...score, track, status, scoringMode:CRITERIA_12569_SCORE_MODEL};
}

