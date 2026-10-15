import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const api = read("supabase/functions/api/index.ts");
const script = read("google-apps-script/Code.gs");
const page = read("audit-review.html");
const review = read("audit-review.js");
const evidence = read("audit-evidence.js");

test("sheet status mapping follows the requested three values", () => {
  assert.match(api, /if \(status === "pass"\) return "ผ่าน"/);
  assert.match(api, /if \(status === "no_content"\) return "ไม่มีเนื้อหา"/);
  assert.match(api, /return "ไม่ผ่าน"/);
  assert.match(api, /syncSheetStatusSafely\(course, payload\.internalStatus\)/);
  assert.match(api, /syncSheetStatusSafely\(run\.course_id, decision\)/);
});

test("sheet writer is locked to the approved spreadsheet, tab and column W", () => {
  assert.match(script, /1q8Dfe2f79ehjk7NsefGGYP6UduajKJDV7E79w1_fKMg/);
  assert.match(script, /STATUS_SHEET_NAME = '69\/1-GR'/);
  assert.match(script, /STATUS_COLUMN = 23/);
  assert.match(script, /SHEET_STATUS_WEBHOOK_SECRET/);
  assert.match(script, /\['ผ่าน', 'ไม่ผ่าน', 'ไม่มีเนื้อหา'\]/);
});

test("the auditor reset preserves central queue and results", () => {
  assert.match(page, /id="workerReset"/);
  assert.match(page, /ไม่ลบคิวหรือผลตรวจ/);
  assert.match(review, /async function resetWorkerPanel/);
  assert.match(review, /Promise\.all\(\[loadResults\(\),loadQueueOverview\(\)\]\)/);
});

test("an active course without a published result opens as not yet audited", () => {
  assert.match(api, /if \(!publicRow\) return \{/);
  assert.match(api, /courseId: activeCourse\.course_id/);
  assert.match(api, /runs: \[\]/);
});

test("a retired or unsynced course shows a useful Thai message", () => {
  assert.match(evidence, /ไม่พบรายวิชานี้ในรายการภาคเรียนปัจจุบัน/);
  assert.match(evidence, /รายการรายวิชายังไม่ได้ซิงก์เข้าระบบ/);
});

test("single-course recheck queues directly and reports the result on its button", () => {
  assert.doesNotMatch(api, /db\.rpc\("enqueue_course_audit"/);
  assert.match(api, /job_key:`manual:\$\{courseId\}:\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(api, /\.in\("status", \["queued", "running"\]\)/);
  assert.match(review, /requeue\.textContent=result\.queued\?"✓ เพิ่มเข้าคิวแล้ว":reason/);
  assert.match(review, /course_is_running:"กำลังตรวจอยู่"/);
});

