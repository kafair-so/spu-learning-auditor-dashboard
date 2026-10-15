import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("owners and super admins can open pending course evidence", () => {
  const evidence = read("audit-evidence.js");
  assert.match(evidence, /\["owner","super_admin"\]\.includes\(\(await AuditApi\.session\(\)\)\.role\)/);
  assert.match(evidence, /superAdmin\?await AuditApi\.adminCourseHistory\(courseId\):await AuditApi\.courseHistory\(courseId\)/);
});

