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
  assert.match(api,/attachPriorEvidenceDecisions/);
  assert.match(api,/item\.reviewReused = true/);
  assert.match(api,/failures\.has\(item\.mediaStatus\)/);
});

test("numeric scores are absent from public and ordinary-admin payloads", () => {
  const publicRun = api.slice(api.indexOf("function publicHistoryRunRecord"),api.indexOf("function limitedAdminResultRecord"));
  const limited = api.slice(api.indexOf("function limitedAdminResultRecord"),api.indexOf("// Only the current"));
  assert.doesNotMatch(publicRun,/confirmedScore|maxScore|threshold/);
  assert.doesNotMatch(limited,/confirmedScore|maxScore|threshold/);
  assert.match(api,/map\(\(\{ score, \.\.\.record \}\) => record\)/);
  assert.match(evidence,/const scoreFacts=superAdmin\?/);
});

