import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const evidence = read("audit-evidence.js");
const api = read("supabase/functions/api/index.ts");
const auditApi = read("audit-api.js");

test("video and Podcast review is itemized with links, duration and use decisions", () => {
  assert.match(evidence,/data-evidence-item/);
  assert.match(evidence,/ชื่อป้าย/);
  assert.match(evidence,/data-evidence-decision/);
  assert.match(evidence,/data-evidence-seconds/);
  assert.match(evidence,/เปิดหลักฐาน/);
  assert.match(evidence,/ใช้ผลยืนยันเดิม/);
  assert.match(auditApi,/evidenceDecisions/);
  assert.match(api,/reviewConfirmation.*evidenceDecisions/);
});

test("unchanged canonical destinations reuse central confirmation but broken links do not", () => {
  assert.match(api,/function canonicalEvidenceTarget/);
  assert.match(api,/referrerscenario/);
  assert.match(api,/attachPriorEvidenceDecisions/);
  assert.match(api,/item\.reviewReused = true/);
  assert.match(api,/failures\.has\(item\.mediaStatus\)/);
});

test("completed legacy review is reused when score envelope and evidence destinations are unchanged", () => {
  assert.match(api,/function preservesConfirmedEvidenceTargets/);
  assert.match(api,/function sameReviewScoreEnvelope/);
  assert.match(api,/reusedFromRunId:previous\.run_id/);
  assert.match(api,/reuseBasis:"same_score_envelope_and_prior_evidence_preserved"/);
  assert.match(api,/previousPayload\?\.reviewReuseEnvelope/);
  assert.match(api,/payload\.possibleScore = confirmedScore/);
  assert.ok(api.indexOf("attachPriorEvidenceDecisions\(course, submittedPayload\)") < api.indexOf("applyAutomaticPublicationGate\(submittedPayload\)"));
});

test("complete instructor evidence closes the criterion before result ingestion", () => {
  assert.match(api,/function resolveAutomaticInstructorCriterion/);
  assert.match(api,/summary\.identityComplete === true && summary\.contactComplete === true/);
  assert.match(api,/summary\.reviewStatus === "evidence_found"/);
  assert.match(api,/criterion\.status = "pass"/);
  assert.match(api,/payload\.reviewableCriteria = reviewable\.filter/);
  assert.ok(api.indexOf("resolveAutomaticInstructorCriterion\(submittedPayload\)") < api.indexOf("attachPriorEvidenceDecisions\(course, submittedPayload\)"));
});

test("cloud audio extensions override generic SharePoint video shells before ingestion", () => {
  assert.match(api,/function normalizeCloudAudioEvidence/);
  assert.match(api,/m4a\|mp3\|wav/);
  assert.match(api,/item\.mediaType = "audio"/);
  assert.ok(api.indexOf("normalizeCloudAudioEvidence\(submittedPayload\)") < api.indexOf("resolveAutomaticInstructorCriterion\(submittedPayload\)"));
});

test("table 3 keeps all five manual items and remains confirmable below threshold", () => {
  assert.match(evidence,/const criterionCount=Math\.max\(0,count-manual\.length\)/);
  assert.match(evidence,/return \[\.\.\.criteria\.slice\(0,criterionCount\),\.\.\.manual\]/);
  assert.match(evidence,/ตารางที่ 3 — ข้อกำหนดภาพรวมที่ผู้ตรวจยืนยัน/);
  assert.match(evidence,/มีครบ 5 ข้อ/);
  assert.match(evidence,/\["needs_review","has_content"\]\.includes\(run\.internalStatus\)/);
  assert.match(api,/\["needs_review", "has_content"\]\.includes\(currentRun\.internal_status\)/);
  assert.match(api,/const criterionLimit = manualReviewKeys\.length \? Math\.max\(0, reviewCount - manualReviewKeys\.length\)/);
  for (const key of ["student_meetings","video_quality","media_placement","submission_policy","backup"]) assert.match(evidence,new RegExp(key));
});

test("numeric scores are absent from public and ordinary-admin payloads", () => {
  const publicRun = api.slice(api.indexOf("function publicHistoryRunRecord"),api.indexOf("function limitedAdminResultRecord"));
  const limited = api.slice(api.indexOf("function limitedAdminResultRecord"),api.indexOf("// Only the current"));
  assert.doesNotMatch(publicRun,/confirmedScore|maxScore|threshold/);
  assert.doesNotMatch(limited,/confirmedScore|maxScore|threshold/);
  assert.match(api,/map\(\(\{ score, \.\.\.record \}\) => record\)/);
  assert.match(evidence,/const scoreFacts=superAdmin\?/);
});

