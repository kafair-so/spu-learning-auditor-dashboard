import assert from "node:assert/strict";
import { classifyActivity } from "../classifier.js";
import { accessGateFromEvidence } from "../providers.js";
import { updateNoVideoProbe } from "../media-review.js";
import { automaticInstructorDecision } from "../instructor-review.js";
import { creditBasedVideoToleranceMinutes, timeStatus } from "../rules.js";

const url = (title, groupContext = "", groupContextSource = "local_label") => ({
  title, groupContext, groupContextSource, href:"https://dlearning.spu.ac.th/mod/url/view.php?id=1"
});

assert.equal(classifyActivity(url("แบบทดสอบการดูดซึมความชื้น")), "assignment");
assert.equal(classifyActivity(url("แบบทดสอบครั้งที่ 1", "Post-test")), "post_quiz");
assert.equal(classifyActivity(url("แบบทดสอบครั้งที่ 1", "แบบทดสอบหลังการเรียน")), "post_quiz");

const emptyAlbum = accessGateFromEvidence({url:"https://photos.google.com/share/example", bodyText:"Album is empty"});
assert.equal(emptyAlbum?.status, "empty_media");
assert.equal(accessGateFromEvidence({url:"https://example.com", bodyText:"Album is empty"}), null);

const clean = {pageFullyLoaded:true,pageContentLength:120,pageSignature:"stable",loadingIndicatorCount:0,playerContainerCount:0,networkIssue:false,mediaDetected:false,durationSeconds:null};
let probe = updateNoVideoProbe({}, clean);
probe = updateNoVideoProbe(probe, clean);
assert.equal(probe.confirmed, false);
probe = updateNoVideoProbe(probe, clean);
assert.equal(probe.confirmed, true);
assert.equal(updateNoVideoProbe(probe, {...clean,loadingIndicatorCount:1}).confirmed, false);
assert.equal(updateNoVideoProbe(probe, {...clean,networkIssue:true}).confirmed, false);
assert.equal(updateNoVideoProbe(probe, {...clean,playerContainerCount:1}).confirmed, false);

assert.equal(automaticInstructorDecision({instructorEvidence:{identityComplete:true,contactComplete:true,hasInstructorPhoto:true,names:["Teacher"]}}), "complete");
assert.equal(automaticInstructorDecision({instructorEvidence:{scanMode:"ocr_and_dom",reviewStatus:"incomplete_evidence"}}), "missing");
assert.equal(automaticInstructorDecision({instructorEvidence:{scanMode:"dom_only",reviewStatus:"incomplete_evidence"}}), "pending");

assert.equal(creditBasedVideoToleranceMinutes(1), 5);
assert.equal(creditBasedVideoToleranceMinutes(2), 10);
assert.equal(creditBasedVideoToleranceMinutes(3), 20);
assert.equal(timeStatus(0, 900, 20), "fail");
console.log("shared inspection regression tests passed");

