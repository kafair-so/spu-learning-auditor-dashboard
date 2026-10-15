import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const api = read("supabase/functions/api/index.ts");
const migration = read("supabase/migrations/202610020001_admin_roles.sql");
const scoreMigration = read("supabase/migrations/202610020002_audit_score_max_110.sql");
const page = read("audit-review.html");
const review = read("audit-review.js");
const auth = read("auth.js");
const dashboard = read("index.html");

test("system owner is bootstrapped as the only protected role", () => {
  assert.match(migration, /siraprah\.so@spu\.ac\.th/);
  assert.match(migration, /'super_admin'/);
  assert.match(api, /user\.role !== "super_admin"/);
  assert.match(api, /super_admin_record_protected/);
});

test("admin management routes require a super admin", () => {
  assert.match(api, /await superAdmin\(request\)/);
  assert.match(api, /v1\/admin\/access-users/);
  assert.match(api, /cannot_change_own_access/);
  assert.match(api, /\["admin", "super_admin"\]\.includes/);
});

test("super admin page exposes self-service access management", () => {
  assert.match(page, /id="accessPanel"/);
  assert.match(page, /id="adminEmail"/);
  assert.match(review, /role!=="super_admin"/);
  assert.match(review, /AuditApi\.saveAccessUser/);
  assert.match(review, /AuditApi\.setAccessUserStatus/);
});

test("review results are loaded and decided through the central API", () => {
  assert.match(api, /listAdminResults/);
  assert.match(api, /decideAdminResult/);
  assert.match(review, /AuditApi\.adminResults/);
  assert.match(review, /AuditApi\.decideResult/);
  assert.doesNotMatch(review, /AuditBridge\.loadRecords\(\)/);
});

test("only super admins can inspect pending evidence and possible scores", () => {
  const evidence = read("audit-evidence.js");
  assert.match(api, /const AUDIT_MAX_SCORE = 110/);
  assert.match(api, /Math\.min\(AUDIT_MAX_SCORE, score \+ reviewable\)/);
  assert.match(api, /hasConfirmedScore \? confirmedScore : null/);
  assert.match(api, /scoreModel !== "weekly_criterion_v2"/);
  assert.match(review, /ตรวจใหม่ด้วย Extension 0\.13\.10 ก่อนตัดสิน/);
  assert.match(scoreMigration, /score between 0 and 110/);
  assert.match(api, /adminHistory/);
  assert.match(api, /adminEvidence/);
  assert.match(api, /user\.role !== "super_admin"/);
  assert.match(review, /audit-evidence\.html\?admin=1/);
  assert.match(evidence, /AuditApi\.adminCourseHistory/);
  assert.match(evidence, /\(await AuditApi\.session\(\)\)\.role==="super_admin"/);
  assert.match(evidence, /Math\.min\(maximum,Number\(run\.possibleScore\)\)/);
  assert.match(evidence, /ผลตรวจตามครั้ง\/สัปดาห์/);
  assert.match(evidence, /Extension รุ่น 0\.13\.11/);
});

test("non-super-admin report payloads redact pending status and possible scores", () => {
  const evidence = read("audit-evidence.js");
  assert.match(api, /limitedAdminResultRecord/);
  assert.match(api, /if \(!canSeeInternalReview && !row\.public_status\) continue/);
  assert.match(api, /publicHistoryRunRecord/);
  assert.match(api, /status: item\.status === "needs_review" \? "fail" : item\.status/);
  assert.match(api, /snapshot:publicEvidenceSnapshot/);
  assert.match(review, /const isSuperAdmin=/);
  assert.match(review, /คะแนนที่ระบบยืนยัน/);
  assert.match(review, /คะแนนเกณฑ์ผ่าน/);
  assert.match(evidence, /const possibleFact=superAdmin/);
});

test("a super admin confirms each pending criterion and the server calculates the final score", () => {
  const evidence = read("audit-evidence.js");
  const auditApi = read("audit-api.js");
  assert.match(evidence, /ยืนยันองค์ประกอบที่รอตรวจ/);
  assert.match(evidence, /data-review-save/);
  assert.match(evidence, /ยืนยันผลที่ระบบคำนวณ/);
  assert.match(evidence, /data-review-item/);
  assert.match(evidence, /AuditApi\.decideResult\(runId,reviewDecisions,note\)/);
  assert.match(auditApi, /decideResult:\(runId,reviewDecisions,note=""\)/);
  assert.match(api, /review_decisions_incomplete/);
  assert.match(api, /const actor = await superAdmin\(request\)/);
  assert.match(api, /reviewConfirmation/);
  assert.match(api, /reviewable_points:0/);
});

test("login persists between pages and admin navigation stays role scoped", () => {
  assert.match(auth, /localStorage\.setItem\(key, token\)/);
  assert.match(auth, /location\.search \|\| ""/);
  assert.match(auth, /revealReviewerLinks/);
  assert.match(dashboard, /data-reviewer-only hidden href="audit-review\.html"/);
});

test("the worker renews a session before expiry and pauses safely when Google requires sign-in", () => {
  const auditApi = read("audit-api.js");
  assert.match(auth, /function scheduleCredentialRenewal/);
  assert.match(auth, /function refreshCredential/);
  assert.match(auth, /function ensureFreshCredential/);
  assert.match(auth, /function isSessionError/);
  assert.match(auditApi, /(?:window\.)?OOEAuth\?*\.ensureFreshCredential/);
  assert.match(review, /OOEAuth\.refreshCredential\(\{interactive:true\}\)/);
  assert.match(review, /กลับไปทำคิวเดิม/);
});

