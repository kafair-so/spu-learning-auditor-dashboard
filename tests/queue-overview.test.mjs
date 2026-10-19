import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const api = read("supabase/functions/api/index.ts");
const review = read("audit-review.js");
const i18n = read("ui-i18n.js");
const page = read("audit-review.html");

test("queue overview returns every active queued or running course", () => {
  assert.match(api, /const pending = activeJobs/);
  assert.match(api, /\.map\(queueJobRecord\)/);
  assert.match(api, /current: current \? pending\.find/);
  assert.match(api, /pending,/);
  assert.match(api, /courseCode: job\.courses\?\.course_code/);
  assert.match(api, /courseTitle: job\.courses\?\.course_title/);
});

test("audit control center renders the current queue course list", () => {
  assert.match(review, /id="queueCourseList"/);
  assert.match(review, /Array\.isArray\(overview\.pending\)/);
  assert.match(review, /queue-course-item/);
  assert.match(review, /jobStatusLabel\(job\.status\)/);
  assert.match(review, /ไม่มีรายวิชาในคิวปัจจุบัน/);
});

test("queue course list supports dark mode, mobile layout and English", () => {
  assert.match(review, /\.theme-dark \.queue-courses/);
  assert.match(review, /@media\(max-width:650px\)/);
  assert.match(i18n, /"รายวิชาในคิวปัจจุบัน":"Courses currently in queue"/);
  assert.match(i18n, /"ไม่มีรายวิชาในคิวปัจจุบัน":"No courses are currently queued\."/);
  assert.match(page, /ui-i18n\.js\?v=20261019a/);
  assert.match(page, /audit-review\.js\?v=20261019a/);
});
