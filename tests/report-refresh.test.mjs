import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const review = fs.readFileSync(new URL("../audit-review.js", import.meta.url), "utf8");

test("report view can refresh results without reloading the page", () => {
  assert.match(review, /setupReportRefresh/);
  assert.match(review, /button\.id="refreshReport"/);
  assert.match(review, /await loadResults\(\)/);
  assert.match(review, /กำลังอัปเดต/);
  assert.match(review, /อัปเดตแล้ว/);
});

test("report refresh prevents duplicate requests while loading", () => {
  assert.match(review, /button\.disabled=true/);
  assert.match(review, /reload\.disabled=true/);
  assert.match(review, /button\.disabled=false/);
});

