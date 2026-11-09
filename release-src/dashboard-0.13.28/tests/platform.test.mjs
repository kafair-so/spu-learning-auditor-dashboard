import assert from "node:assert/strict";
import fs from "node:fs";
import { LMS_HOSTS, isLmsHost, isCourseUrl, learningPlatformName, isClearlyEmptyCourseCoverage } from "../platform.js";
import { usableExternalTarget } from "../external-target.js";
import { classifyActivity, isTeachingPlanFile } from "../classifier.js";

assert.deepEqual(LMS_HOSTS, ["dlearning.spu.ac.th", "ilearning.spu.ac.th"]);
assert.equal(isLmsHost("https://dlearning.spu.ac.th/course/view.php?id=1"), true);
assert.equal(isLmsHost("https://ilearning.spu.ac.th/course/view.php?id=825"), true);
assert.equal(isLmsHost("https://example.com/course/view.php?id=825"), false);
assert.equal(isCourseUrl("https://ilearning.spu.ac.th/course/view.php?id=825"), true);
assert.equal(isCourseUrl("https://ilearning.spu.ac.th/course/search.php?search=BSC11667"), false);
assert.equal(learningPlatformName("https://ilearning.spu.ac.th/course/view.php?id=825"), "i-Learning");
assert.equal(learningPlatformName("https://dlearning.spu.ac.th/course/view.php?id=19192"), "d-Learning");
assert.equal(isClearlyEmptyCourseCoverage({reachedEnd:true,courseSectionCount:16,nonForumActivityCount:0}), true);
assert.equal(isClearlyEmptyCourseCoverage({reachedEnd:true,courseSectionCount:1,declaredAuditableSectionCount:4,nonForumActivityCount:0}), true, "nested empty Section cards must still be recognized as an empty course");
assert.equal(isClearlyEmptyCourseCoverage({reachedEnd:false,courseSectionCount:16,nonForumActivityCount:0}), false, "an unfinished scroll is not an empty course");
assert.equal(isClearlyEmptyCourseCoverage({reachedEnd:true,courseSectionCount:1,nonForumActivityCount:0}), false, "a lone loading shell is not an empty course");
assert.equal(isClearlyEmptyCourseCoverage({reachedEnd:true,courseSectionCount:16,nonForumActivityCount:1}), false, "one real activity makes the course non-empty");
assert.equal(isClearlyEmptyCourseCoverage({reachedEnd:true,courseSectionCount:16,nonForumActivityCount:1,auditableActivityCount:0}), true, "a hidden or technical non-forum link must not make an empty course receive a score");
assert.equal(isClearlyEmptyCourseCoverage({reachedEnd:true,courseSectionCount:16,nonForumActivityCount:2,auditableActivityCount:1}), false, "one rubric-relevant activity makes the course non-empty even alongside technical links");
assert.equal(usableExternalTarget("https://ilearning.spu.ac.th/mod/url/view.php?id=77"), null);

const lecture = "Lecture 1";
assert.equal(classifyActivity({title:"PODcast 1", groupContext:"", section:lecture, href:"https://ilearning.spu.ac.th/mod/url/view.php?id=1"}), "podcast");
assert.equal(classifyActivity({title:"HR Planning", groupContext:"วิดีโอการสอนล่วงหน้า.png", section:lecture, href:"https://ilearning.spu.ac.th/mod/url/view.php?id=2"}), "video");
const plan = {title:"Lesson Plan Lecture 1", groupContext:"แผนการสอน.png", section:lecture, href:"https://ilearning.spu.ac.th/mod/resource/view.php?id=3", fileTypeHint:"pdf"};
assert.equal(classifyActivity(plan), "file");
assert.equal(isTeachingPlanFile(plan), true);
assert.equal(classifyActivity({title:"Lecture 1", groupContext:"เอกสารประกอบการสอน.png", section:lecture, href:"https://ilearning.spu.ac.th/mod/resource/view.php?id=4", fileTypeHint:"pdf"}), "file");
assert.equal(classifyActivity({title:"Activity/ Assignment Task Time 60 Minutes", groupContext:"กิจกรรมท้ายบทเรียน.png", section:lecture, href:"https://ilearning.spu.ac.th/mod/resource/view.php?id=5", fileTypeHint:"pdf"}), "assignment");

const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.version, "0.13.28");
assert.ok(manifest.optional_host_permissions.includes("https://*.heygen.com/*"));
assert.ok(manifest.host_permissions.includes("https://ilearning.spu.ac.th/*"));
assert.ok(manifest.content_scripts.some((entry) => entry.matches.includes("https://ilearning.spu.ac.th/course/view.php*")));
assert.ok(manifest.content_scripts.some((entry) => entry.matches.includes("https://ilearning.spu.ac.th/mod/h5pactivity/view.php*")));

const content = fs.readFileSync(new URL("../content.js", import.meta.url), "utf8");
assert.match(content, /section\|lecture\)\\s\*\\d\+/i);
assert.match(content, /(?:dlearning\|ilearning)/);
const background = fs.readFileSync(new URL("../background.js", import.meta.url), "utf8");
assert.match(background, /consecutiveEmptyScans\s*>=\s*2/, "an empty course must be confirmed twice");
assert.match(background, /!clearlyEmpty\s*&&\s*scan\.coverage\?\.structurallyComplete/, "a structurally complete empty page must still receive its second confirmation scan");
assert.match(background, /job\.status\s*=\s*"empty"/, "an empty course must finish with a distinct queue result");
const queue = fs.readFileSync(new URL("../queue.js", import.meta.url), "utf8");
assert.match(queue, /empty:"ไม่พบเนื้อหารายวิชา"/, "the queue must explain an empty-course result in Thai");

console.log("platform.test.mjs passed");


