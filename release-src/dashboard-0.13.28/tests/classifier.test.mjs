import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyActivity, classifyActivityWithEvidence, isTeachingPlanFile, promoteSectionLessonCandidates } from "../classifier.js";
import { MEDIA_PROVIDER_ORIGINS, providerOriginsForUrl, accessGateFromEvidence } from "../providers.js";
import { sectionWeekMapping, sectionTopology, groupedByWeek, canonicalWeek } from "../section-mapping.js";
import { applyMoodleFileTypeHint, resolveMoodleResourceEvidence } from "../resource-evidence.js";
import { RULES, gnRequiredMediaSessions, gnCoverageResult, mediaTimeResult, podcastTimeResult, podcastComplianceResult, canonicalMediaTarget, declaredDurationFromTitle, durationHintFromTitle, markDuplicateMediaItems, markHiddenTitleAlternatives, normalizeAlternativeMediaTitle, collapseDuplicateDestinationItems, verifiedVideoCandidate, isPodcastLike, isAiTutorLike } from "../rules.js";
import { durationFromProviderMarkup, isFastMetadataHost, mediaTypeFromProviderEvidence, unavailableMediaFromProviderMarkup, selectProviderDurationEvidence } from "../media-metadata.js";
import { usableExternalTarget, rankExternalTargets } from "../external-target.js";
await import("../file-evidence.js");
const { detectMoodleFileTypeEvidence } = globalThis.DLearningFileEvidence;

const url = (title, groupContext = "") => ({ title, groupContext, href: "https://dlearning.spu.ac.th/mod/url/view.php?id=1" });
const quiz = (title) => ({ title, href: "https://dlearning.spu.ac.th/mod/quiz/view.php?id=2" });
const file = (title) => ({ title, href: "https://dlearning.spu.ac.th/mod/resource/view.php?id=3" });
const h5p = (title, groupContext = "") => ({ title, groupContext, href: "https://dlearning.spu.ac.th/mod/h5pactivity/view.php?id=4" });
const writtenAssignment = (title, groupContext = "") => ({ title, groupContext, href: "https://dlearning.spu.ac.th/mod/assign/view.php?id=5" });
assert.equal(classifyActivity(writtenAssignment("คำถามก่อนเรียน", "Pre-test")), "pre_quiz", "a free-text question assignment under Pre-test must count");
assert.equal(classifyActivity(writtenAssignment("คำถามหลังเรียน", "Post-test")), "post_quiz", "a free-text question assignment under Post-test must count");
assert.equal(classifyActivity(writtenAssignment("ข้อเขียน", "แบบทดสอบก่อนเรียน")), "pre_quiz", "an essay question under a verified Pre-test label must count");
assert.equal(classifyActivity(writtenAssignment("Essay questions", "Post-test")), "post_quiz", "English essay questions under Post-test must count");
assert.equal(classifyActivity(writtenAssignment("PRE-ASSIGNMENT : PART 7")), "pre_quiz", "an explicitly named Pre-Assignment must count as Pre-test");
assert.equal(classifyActivity(writtenAssignment("POST-ASSIGNMENT : PART 7")), "post_quiz", "an explicitly named Post-Assignment must count as Post-test");
assert.equal(classifyActivity(writtenAssignment("ส่งงานปลายบท", "แบบทดสอบก่อนเรียน")), "assignment", "an ordinary assignment must not become a Pre-test from placement alone");
assert.equal(classifyActivity(writtenAssignment("Podcast Week 1")), "podcast", "a real Podcast embedded in a Moodle Assignment must be inspected as media");
assert.equal(classifyActivity(writtenAssignment("Poadcast 12 นิสิต")), "podcast", "a small Podcast typo in an Assignment title must still reach its audio player");
assert.equal(isPodcastLike("Poadcast Week 12"), true);
assert.equal(isPodcastLike("Podcats Week 12"), true);
assert.equal(isPodcastLike("Broadcast Week 12"), false, "fuzzy Podcast matching must not swallow an unrelated broadcast title");
assert.equal(isAiTutorLike("AI Tuter"), true);
assert.equal(isAiTutorLike("AI Tuotr"), true);
assert.equal(isAiTutorLike("AI Tuitor"), true);
assert.equal(isAiTutorLike("SPUAl Chat"), true);
assert.equal(isAiTutorLike("Chat GTP สำหรับรายวิชา"), true);
assert.equal(isAiTutorLike("AI content lesson"), false, "AI alone must not become AI Tutor");
const scannerSource = fs.readFileSync(new URL("../content.js", import.meta.url), "utf8");
assert.match(scannerSource,/เนื้อหา\(\?:บทเรียน\|การเรียน\)/,"the lesson-content label must stop a preceding Pre-test group");
assert.equal(classifyActivity(url("LogisticsStandard URL", "เนื้อหาบทเรียน")), "url", "a lesson-content article is not a Quiz");
assert.equal(classifyActivity(url("LogisticsStandard URL", "แบบทดสอบก่อนเรียน")), "url", "even a stale Pre-test label cannot make a generic article link a Quiz");
assert.equal(classifyActivity(url("Quiz LSM487 Pre-Test 15", "แบบทดสอบก่อนเรียน")), "pre_quiz", "the actual named Pre-test still counts");

assert.equal(classifyActivity(url("เอกสารประกอบการสอน Week 3-1", "Pre-test")), "file_link", "an explicit document title must survive a misplaced Pre-test label");
assert.equal(classifyActivity(url("เอกสารการบรรยายAI Student Smart Card", "")), "file_link", "an explicitly named online lecture document must count as teaching material even without PDF wording");
assert.equal(classifyActivity(url("Pre-Test Week 3", "Pre-test")), "pre_quiz", "the real Pre-test beside misplaced documents must remain Pre-test");
assert.equal(classifyActivity({...file("Pre-Test Questions Lecture 2"),fileTypeHint:"pdf"}), "pre_quiz", "an explicitly named Pre-Test PDF resource must satisfy the Pre-Test category");
assert.equal(classifyActivity({...file("Post-Test Questions Lecture 2"),fileTypeHint:"pdf"}), "post_quiz", "an explicitly named Post-Test PDF resource must satisfy the Post-Test category");

assert.equal(isTeachingPlanFile(file("แผนการเรียนการสอน ครั้งที่ 2")), true, "weekly plan must be a teaching-plan PDF");
assert.equal(isTeachingPlanFile(file("เอกสารประกอบการเรียน ครั้งที่ 2 Entity Relationship Fundamentals")), false, "supporting material must not be a teaching-plan PDF");
assert.equal(isTeachingPlanFile({title:"บทที่ 7 โปรแกรมสำเร็จรูปประเภทวางแผนทรัพยากรองค์กร File", text:"บทที่ 7 โปรแกรมสำเร็จรูปประเภทวางแผนทรัพยากรองค์กร File", groupContext:"เอกสารประกอบการสอน.png"}), false, "Week 8 supporting document must not become a plan from วางแผน + การสอน");
assert.equal(isTeachingPlanFile({title:"แผนทางเดินเอกสาร File", text:"แผนทางเดินเอกสาร File", groupContext:"เอกสารประกอบการสอน.png"}), false, "Week 15 supporting document must not become a teaching plan");
assert.equal(isTeachingPlanFile({title:"ไฟล์สัปดาห์ที่ 8", text:"", groupContext:"แผนการสอน.png"}), true, "explicit teaching-plan group must remain a plan");
assert.equal(classifyActivity(url("Video : Writing Basic SQL Statements 1", "วิดีโอบันทึกการสอนล่วงหน้า")), "video", "video below a pre-recorded label must count");
assert.equal(classifyActivity(url("ลิงก์ YouTube", "วิดีโอเสริมการสอน")), "supplementary", "a generic provider link below the real CPE supplementary-video label must stay supplementary");
assert.equal(classifyActivity(url("แหล่งข้อมูลเพิ่มเติม_Week 15 URL")), "supplementary", "the named CPE supplementary Moodle activity must resolve as supplementary evidence");
assert.equal(classifyActivity(url("PRE TEST บทที่ 5", "แหล่งข้อมูลเพิ่มเติม")), "pre_quiz", "an explicitly named PRE TEST must survive placement below supplementary resources");
assert.equal(classifyActivity(url("Post TEST บทที่ 6", "แหล่งข้อมูลเพิ่มเติม")), "post_quiz", "an explicitly named POST TEST must survive placement below supplementary resources");
assert.equal(classifyActivity(url("เว็บไซต์อ่านเพิ่มเติม", "แหล่งข้อมูลเพิ่มเติม")), "supplementary", "ordinary links below supplementary resources must remain excluded");
assert.equal(classifyActivity(url("VDO แนะนำการเรียนการสอนล่วงหน้า")), "video", "explicit VDO title must count without a category label");
assert.equal(classifyActivity(url("VDO ep01_02_07 URL")), "video", "a clearly named VDO episode must count without requiring a category label");
assert.equal(classifyActivity(url("EP1.11 URL")), "video_candidate", "a bare numbered EP title must be opened so its destination can prove video media");
assert.equal(classifyActivity(url("EP3.2.3 (copy) URL")), "video_candidate", "nested EP numbers and copied labels must still reach destination verification");
assert.equal(classifyActivityWithEvidence(url("EP1.12 URL")).evidence.some((entry) => /EPx\.xx/.test(entry.value)), true, "EP candidates must explain why the destination is inspected");
assert.equal(classifyActivity(url("VDO LIVE RECORD ep01_02_07 URL")), "recording", "a VDO explicitly marked Live Record must remain excluded");
assert.equal(classifyActivity(url("Podcast Chapter 7", "วิดีโอ บันทึกการสอนสดออนไลน์")), "podcast", "an explicitly named Podcast below a live-record label must still be inspected as Podcast");
assert.equal(classifyActivity(url("Live Record ICT310 #7", "วิดีโอ บันทึกการสอนสดออนไลน์")), "recording", "a real Live Record below the same label must remain a recording");
assert.equal(classifyActivity(url("ลิงก์บันทึกครั้งที่ 7", "วิดีโอ บันทึกการสอนสดออนไลน์")), "recording", "a generic link may still inherit the live-record group");
assert.equal(classifyActivity(url("Podcast Chapter 7", "สื่อเสริมการสอน")), "podcast", "an explicitly named Podcast must survive a misplaced supplementary label");
assert.equal(classifyActivity(url("Video-พิธีการศุลกากรนำเข้าทางบก URL")), "video", "the Video-topic convention must be opened and counted as video");
const ict15167Titles = [
  "Video ICT15167 Introduction to Course Outline AEC and USR (25 นาที) URL",
  "Video ICT15167 Ethics of IT Workers and IT Users (2 ชั่วโมง 20 นาที) URL",
  "Video ICT15167 Freedom of Express (1 ชั่วโมง 41) URL",
  "Video ICT15167_Case Study Ch2 and Ch5_New_1 URL",
  "Video (09) Week 8 ICT15167 Video Summary Explain Ch1-5 (1 ชั่วโมง 44 นาที) URL",
  "Video (09).ICT15167 Ch6 Intellectual Property (1 ชั่วโมง 31 นาที) URL",
  "Video (10).ICT15167 Ch6 and 7 Software Development (1 ชั่วโมง 34 นาที) URL",
  "Video (13).Ch9 Social Networking (1 ชั่วโมง 30 นาที) URL",
  "Video (14).Ch10 Ethics of IT Organization (1 ชั่วโมง 16 นาที) URL",
  "Video (15).Ch11 Security and Ethical Challenge (1 ชั่วโมง 39 นาที) URL",
  "Video Summary Explain Ch11-12 (1 ชั่วโมง 14 นาที) URL"
];
for (const title of ict15167Titles) assert.equal(classifyActivity(url(title)), "video", `space-separated video title must be recognised: ${title}`);
assert.equal(durationHintFromTitle(ict15167Titles[0]), 25 * 60, "minutes-only title duration must be retained as classification evidence");
assert.equal(durationHintFromTitle(ict15167Titles[1]), (2 * 60 + 20) * 60, "Thai hours and minutes must be retained as classification evidence");
assert.equal(durationHintFromTitle("video-LSM487_EP1.1 (4.57 นาที) URL"), 4 * 60 + 57, "clock-like title duration must remain supported");
assert.equal(declaredDurationFromTitle("Video Introduction Part 1/6 (3:28 นาที) URL"), 3 * 60 + 28, "an exact parenthesised clock may be used after link verification");
assert.equal(declaredDurationFromTitle("Video Lecture (25 นาที) URL"), 25 * 60, "exact parenthesised minutes must be supported");
assert.equal(declaredDurationFromTitle("Video Lecture (1 ชั่วโมง 44 นาที) URL"), (60 + 44) * 60, "exact parenthesised hours and minutes must be supported");
assert.equal(declaredDurationFromTitle("Video Lecture ประมาณ 25 นาที URL"), null, "loose or approximate title durations must never become scoring evidence");
assert.equal(declaredDurationFromTitle("Video Lecture (ประมาณ 25 นาที) URL"), null, "approximation inside parentheses must be rejected");
assert.equal(declaredDurationFromTitle("Video Production Part8 (8:017 นาที) URL"), 497, "a redundant zero before two valid seconds digits should be normalized");
assert.equal(declaredDurationFromTitle("Video Production (8:117 นาที) URL"), null, "arbitrary three-digit seconds must remain invalid");
assert.equal(canonicalMediaTarget("https://drive.google.com/file/d/ABC123/view?usp=sharing"), canonicalMediaTarget("https://drive.google.com/file/d/ABC123/view?utm_source=x"), "Drive variants for the same file must share one fingerprint");
assert.equal(canonicalMediaTarget("https://notebooklm.google.com/notebook/N12/artifact/PRE12?utm_source=nlm_web_share"), canonicalMediaTarget("https://notebook.google.com/notebook/N12/artifact/PRE12?authuser=0&pli=1&hl=th"), "NotebookLM hostname and viewer-state variants for the same artifact must share one fingerprint");
assert.notEqual(canonicalMediaTarget("https://notebooklm.google.com/notebook/N12/artifact/PRE12"), canonicalMediaTarget("https://notebooklm.google.com/notebook/N12/artifact/POST12"), "different NotebookLM artifacts in one notebook must remain distinct");
assert.equal(canonicalMediaTarget("https://tenant.sharepoint.com/_layouts/15/stream.aspx?id=%2Fvideo.mp4&sw=bypass&bypassReason=abandoned"),canonicalMediaTarget("https://tenant.sharepoint.com/_layouts/15/stream.aspx?id=%2Fvideo.mp4&sw=bypass"),"SharePoint viewer-only parameters must not open the same protected file repeatedly");
assert.equal(usableExternalTarget("https://docs.moodle.org/38/en/mod/url/view"), null, "Moodle documentation must never become a course activity destination");
assert.equal(rankExternalTargets([
  "https://docs.moodle.org/38/en/mod/url/view",
  "https://notebooklm.google.com/notebook/N5/artifact/PRE5?utm_source=x",
  "https://example.org/help"
])[0].target, "https://notebooklm.google.com/notebook/N5/artifact/PRE5?utm_source=x", "NotebookLM course content must outrank help links on a Moodle redirect page");
assert.equal(rankExternalTargets([
  "https://docs.moodle.org/38/en/mod/url/view",
  "https://drive.google.com/file/d/TASK5/view?usp=sharing"
])[0].target, "https://drive.google.com/file/d/TASK5/view?usp=sharing", "a Drive activity target must survive alongside Moodle help links");
const duplicateMedia = [
  {auditSession:8,kind:"video",href:"moodle:1",title:"Case Study original",externalUrl:"https://drive.google.com/file/d/ABC123/view?usp=sharing",durationSeconds:300},
  {auditSession:8,kind:"video",href:"moodle:2",title:"Case Study duplicate",externalUrl:"https://drive.google.com/file/d/ABC123/view?utm_source=x",durationSeconds:300},
  {auditSession:9,kind:"video",href:"moodle:3",title:"Same video in another session",externalUrl:"https://drive.google.com/file/d/ABC123/view",durationSeconds:300}
];
assert.equal(markDuplicateMediaItems(duplicateMedia), 1, "only a repeated target within the same session must be excluded");
assert.equal(duplicateMedia[0].countingEligible, true, "the first media target must count");
assert.equal(duplicateMedia[1].countingEligible, false, "the repeated media target in the same session must not add duration");
assert.equal(duplicateMedia[2].countingEligible, true, "a target repeated in another session must remain visible and independently auditable");
assert.equal(normalizeAlternativeMediaTitle("EP4.3 interview with Mr.boss : playing games (copy) URL"),normalizeAlternativeMediaTitle("EP4.3 interview with Mr.boss : playing games URL"),"copy suffixes must normalize to the original clip title");
const hiddenAlternatives=[
  {sectionId:"section-6",kind:"video",href:"hidden-43",title:"EP4.3 interview with Mr.boss : playing games Geistes blitz 1",hiddenFromStudents:true,linkStatus:"external",externalUrl:"https://example.com/hidden43",mediaDetected:true,durationSeconds:300},
  {sectionId:"section-6",kind:"video",href:"visible-43",title:"EP4.3 interview with Mr.boss : playing games Geistes blitz 1 (copy)",hiddenFromStudents:false,linkStatus:"external",externalUrl:"https://example.com/visible43",mediaDetected:true,durationSeconds:300},
  {sectionId:"section-6",kind:"video_candidate",href:"hidden-44",title:"EP4.4 interview with Mr.boss : playing games Geistes blitz 2",hiddenFromStudents:true},
  {sectionId:"section-7",kind:"video_candidate",href:"visible-other-week",title:"EP4.4 interview with Mr.boss : playing games Geistes blitz 2 (copy)",hiddenFromStudents:false},
  {sectionId:"section-6",kind:"video",href:"hidden-45",title:"EP4.5 interview finale",hiddenFromStudents:true,linkStatus:"external",externalUrl:"https://example.com/hidden45",mediaDetected:true,durationSeconds:420},
  {sectionId:"section-6",kind:"video",href:"visible-45",title:"EP4.5 interview finale (copy)",hiddenFromStudents:false,linkStatus:"external",externalUrl:"https://example.com/visible45",mediaStatus:"access_denied",durationSeconds:null}
];
assert.equal(markHiddenTitleAlternatives(hiddenAlternatives),2,"each exact hidden/visible title pair in one section must become one logical clip");
assert.equal(hiddenAlternatives[0].countingEligible,false);assert.equal(hiddenAlternatives[0].titleAlternativeOf,"visible-43","visibility breaks a tie only after both links have equal verified evidence");
assert.equal(hiddenAlternatives[1].titleAlternativeOf,undefined,"the visible copy with equal evidence remains the representative");
assert.equal(hiddenAlternatives[2].titleAlternativeOf,undefined,"a similar clip without a twin in the same section must not be suppressed");
assert.equal(hiddenAlternatives[4].titleAlternativeOf,undefined,"a hidden clip with stronger playable evidence must remain countable");
assert.equal(hiddenAlternatives[5].titleAlternativeOf,"hidden-45","a visible but inaccessible copy must lose to the playable hidden alternative");
const embeddedCopies = [
  {auditSession:15,kind:"podcast",collectionSource:"moodle_module",href:"https://dlearning.spu.ac.th/mod/url/view.php?id=15",externalUrl:"https://drive.google.com/file/d/POD15/view?usp=sharing",title:"Podcast Week 15 URL"},
  {auditSession:15,kind:"podcast",collectionSource:"embedded_external_link",href:"https://drive.google.com/file/d/POD15/view?utm_source=x",externalUrl:"https://drive.google.com/file/d/POD15/view?utm_source=x",title:"Google Drive"},
  {auditSession:15,kind:"assignment",collectionSource:"moodle_module",href:"https://dlearning.spu.ac.th/mod/url/view.php?id=16",externalUrl:"https://drive.google.com/file/d/TASK15/view?usp=sharing",title:"กิจกรรมท้ายบทเรียน Week 15 URL"},
  {auditSession:15,kind:"assignment",collectionSource:"embedded_external_link",href:"https://drive.google.com/file/d/TASK15/view",externalUrl:"https://drive.google.com/file/d/TASK15/view",title:"Google Drive"},
  {auditSession:15,kind:"post_quiz",collectionSource:"moodle_module",href:"https://dlearning.spu.ac.th/mod/url/view.php?id=17",externalUrl:"https://notebooklm.google.com/notebook/N15/artifact/Q15?utm_source=x",title:"Post-test Week 15 URL"},
  {auditSession:15,kind:"post_quiz",collectionSource:"embedded_external_link",href:"https://notebooklm.google.com/notebook/N15/artifact/Q15?utm_medium=y",externalUrl:"https://notebooklm.google.com/notebook/N15/artifact/Q15?utm_medium=y",title:"NotebookLM"},
  {auditSession:15,kind:"supplementary",collectionSource:"moodle_module",href:"https://dlearning.spu.ac.th/mod/url/view.php?id=18",externalUrl:"https://www.youtube.com/watch?v=IK9OVbj_Ir0",title:"แหล่งข้อมูลเพิ่มเติม Week 15 URL"},
  {auditSession:15,kind:"url",collectionSource:"embedded_external_link",href:"https://youtu.be/IK9OVbj_Ir0",externalUrl:"https://youtu.be/IK9OVbj_Ir0",title:"YouTube"},
  {auditSession:15,kind:"supplementary",collectionSource:"moodle_module",href:"https://dlearning.spu.ac.th/mod/url/view.php?id=19",externalUrl:"https://www.youtube.com/watch?v=IK9OVbj_Ir0",title:"แหล่งข้อมูลเพิ่มเติมสำรอง Week 15 URL"},
  {auditSession:15,kind:"assignment",collectionSource:"embedded_external_link",href:"https://forms.gle/standalone",externalUrl:"https://forms.gle/standalone",title:"ส่งงานโดยตรง"},
  {auditSession:14,kind:"podcast",collectionSource:"embedded_external_link",href:"https://drive.google.com/file/d/POD15/view",externalUrl:"https://drive.google.com/file/d/POD15/view",title:"ใช้ซ้ำต่างสัปดาห์"}
];
const collapsedCopies = collapseDuplicateDestinationItems(embeddedCopies);
assert.equal(collapsedCopies.removed, 4, "Podcast, Assignment, Quiz and cross-kind supplementary provider copies must each be removed once");
assert.deepEqual(collapsedCopies.items.map((item) => item.title), ["Podcast Week 15 URL", "กิจกรรมท้ายบทเรียน Week 15 URL", "Post-test Week 15 URL", "แหล่งข้อมูลเพิ่มเติม Week 15 URL", "แหล่งข้อมูลเพิ่มเติมสำรอง Week 15 URL", "ส่งงานโดยตรง", "ใช้ซ้ำต่างสัปดาห์"], "all descriptive Moodle activities must remain, while only their synthetic provider copies are removed");
assert.equal(verifiedVideoCandidate({mediaDetected:true,durationSeconds:null}), true, "a detected player must promote a video candidate");
assert.equal(verifiedVideoCandidate({durationSeconds:120}), true, "a readable duration must promote a video candidate");
assert.equal(verifiedVideoCandidate({mediaDetected:false,durationSeconds:null}), false, "an unverified destination must remain a candidate");
assert.equal(isFastMetadataHost("https://www.youtube.com/watch?v=abcdefghijk"), true, "YouTube must use the metadata-first path");
assert.equal(isFastMetadataHost("https://photos.app.goo.gl/Xz2xMsNUEAqtNZfS6"), true, "Google Photos must use the metadata-first path");
assert.deepEqual(durationFromProviderMarkup('{"videoDetails":{"videoId":"abcdefghijk","lengthSeconds":"3725"}}', "https://www.youtube.com/watch?v=abcdefghijk"), {durationSeconds:3725,source:"youtube-metadata"}, "YouTube main-video metadata must provide duration without reading an ad player");
assert.equal(durationFromProviderMarkup('{"playerAds":[{"duration":30}]}', "https://www.youtube.com/watch?v=abcdefghijk"), null, "generic YouTube/ad durations must never be accepted");
assert.deepEqual(durationFromProviderMarkup('{"durationMillis":"90500"}', "https://photos.google.com/share/example"), {durationSeconds:91,source:"google-photos-metadata"}, "Google Photos millisecond metadata must be converted safely");
assert.deepEqual(durationFromProviderMarkup('<meta itemprop="duration" content="PT1H2M3S">', "https://player.vimeo.com/video/1"), {durationSeconds:3723,source:"provider-meta-tag"}, "standard duration metadata must be supported");
assert.deepEqual(durationFromProviderMarkup('<script type="application/ld+json">{"duration":"PT15M34S"}</script>', "https://app.heygen.com/videos/example"), {durationSeconds:934,source:"provider-jsonld"}, "HeyGen JSON-LD duration must be read before opening its player");
assert.deepEqual(durationFromProviderMarkup('self.__next_f.push([1,"\\\"duration\\\",933.773"])', "https://app.heygen.com/videos/example"), {durationSeconds:934,source:"provider-metadata"}, "HeyGen bootstrap duration must remain a fallback when JSON-LD is absent");
for (const [provider, target, markup, seconds, source] of [
  ["Google Drive", "https://drive.google.com/file/d/example/view", '{"durationMillis":"125000"}', 125, "drive-metadata"],
  ["OneDrive", "https://onedrive.live.com/?id=example", '{"durationMs":125000}', 125, "onedrive-metadata"],
  ["SharePoint", "https://tenant.sharepoint.com/:v:/example", '{"durationMillis":"125000"}', 125, "onedrive-metadata"],
  ["Loom", "https://www.loom.com/share/example", '{"duration":125.4}', 125, "provider-metadata"],
  ["Vidyard", "https://share.vidyard.com/watch/example", '{"durationSeconds":"125"}', 125, "provider-metadata"],
  ["Vimeo", "https://player.vimeo.com/video/1", '{"videoDuration":125}', 125, "provider-metadata"],
  ["Wistia", "https://fast.wistia.net/embed/iframe/example", '{"duration":125}', 125, "provider-metadata"],
  ["Kaltura", "https://cdnapisec.kaltura.com/p/1/sp/1/embedIframeJs/uiconf_id/1/partner_id/1", '{"lengthSeconds":125}', 125, "provider-metadata"]
]) {
  assert.deepEqual(durationFromProviderMarkup(markup, target), {durationSeconds:seconds,source}, `${provider} metadata must provide a verified duration before player fallback`);
}
assert.equal(durationFromProviderMarkup('{"durationMillis":"999999999"}', "https://photos.google.com/share/example"), null, "implausible durations must be rejected");
assert.equal(mediaTypeFromProviderEvidence({contentType:"video/mp4", targetUrl:"https://files.example/media"}), "video", "actual video MIME must override a missing or misleading filename");
assert.equal(mediaTypeFromProviderEvidence({contentType:"audio/mpeg", targetUrl:"https://files.example/media.bin"}), "audio", "actual audio MIME must be accepted regardless of filename");
assert.equal(mediaTypeFromProviderEvidence({markup:'<video src="stream"></video>', targetUrl:"https://drive.google.com/file/d/example/view"}), "video", "a Drive video player must identify a video Podcast");
assert.equal(mediaTypeFromProviderEvidence({markup:'<audio src="stream"></audio>', targetUrl:"https://drive.google.com/file/d/example/view"}), "audio", "a Drive audio player must identify an audio Podcast");
assert.equal(mediaTypeFromProviderEvidence({targetUrl:"https://www.youtube.com/watch?v=abcdefghijk"}), "video", "YouTube is video evidence even without a filename extension");
assert.equal(mediaTypeFromProviderEvidence({targetUrl:"https://vt.tiktok.com/ZSExample/"}), "video", "a TikTok Podcast destination is definitively video, not an unverified audio clip");
assert.equal(podcastComplianceResult([{mediaType:"audio",durationSeconds:600,reviewerDurationConfirmed:true,mediaStatus:"podcast_time_confirmed"}], 600), "pass", "ten minutes of reviewer-confirmed audio must pass Podcast");
assert.equal(podcastComplianceResult([{mediaType:"audio",durationSeconds:600,mediaStatus:"duration_read"}], 600), "needs_review", "automatically read Podcast time must not replace reviewer confirmation");
assert.equal(podcastComplianceResult([{mediaType:"video",durationSeconds:3600,mediaStatus:"duration_read"}], 600), "fail", "a long video must never pass Podcast");
assert.equal(podcastComplianceResult([{mediaType:null,durationSeconds:600,mediaStatus:"duration_read"}], 600), "needs_review", "duration alone must not pass until audio type is verified");
assert.equal(podcastComplianceResult([{mediaType:"audio",durationSeconds:868,reviewerDurationConfirmed:true},{mediaType:"video",durationSeconds:3600}], 600), "pass", "a video alternative must not veto enough confirmed audio");
assert.equal(podcastComplianceResult([{mediaType:"audio",durationSeconds:300,reviewerDurationConfirmed:true},{mediaType:"audio",durationSeconds:360,reviewerDurationConfirmed:true}], 600), "pass", "confirmed durations from multiple audio Podcasts must be summed");
assert.equal(podcastComplianceResult([{mediaType:"audio",durationSeconds:300,reviewerDurationConfirmed:true},{mediaType:"video",durationSeconds:3600}], 600), "fail", "video time must not fill an audio shortfall");
assert.equal(podcastComplianceResult([{mediaType:"audio",durationSeconds:300,reviewerDurationConfirmed:true},{mediaType:null,mediaStatus:"unresolved"}], 600), "needs_review", "unresolved evidence can still supply the missing audio time");
assert.equal(classifyActivity(url("video-LSM487_EP1.1 (4.57 นาที) URL", "แบบทดสอบก่อนเรียน แบบทดสอบก่อนเรียน")), "video", "an explicit Video-topic item must override a stale Pre-test group label");
assert.equal(classifyActivity(url("Live Record-ขนส่งต่อเนื่องหลายรูปแบบ-12/09/66 เช้า URL", "แบบทดสอบก่อนเรียน แบบทดสอบก่อนเรียน")), "recording", "an explicit Live Record must override a stale Pre-test group label");
const misgroupedVideo = classifyActivityWithEvidence(url("video-LSM487_EP1.1 (4.57 นาที) URL", "แบบทดสอบก่อนเรียน แบบทดสอบก่อนเรียน"));
assert.equal(misgroupedVideo.requiresReview, false, "a strongly named video under a stale Pre-test label must not require manual classification");
assert.equal(misgroupedVideo.contextConflict, false, "a stale Pre-test label must not block a strongly named video from timing and scoring");
const misgroupedRecording = classifyActivityWithEvidence(url("Live Record-LSM487_sec002-12-01-67 URL", "แบบทดสอบก่อนเรียน แบบทดสอบก่อนเรียน"));
assert.equal(misgroupedRecording.requiresReview, false, "a strongly named recording under a stale Pre-test label must not require manual classification");
assert.equal(misgroupedRecording.recordingFastPath, true, "a strongly named recording must be excluded without opening its link");
assert.equal(classifyActivity(url("แบบประเมินความรู้", "แบบทดสอบก่อนเรียน")), "pre_quiz", "a generic external assessment must still inherit its verified Pre-test group");
assert.equal(accessGateFromEvidence({ heading:"You need access", actions:"Request access" }).status, "access_denied", "a clear Drive access wall must close quickly");
assert.equal(accessGateFromEvidence({ heading:"ต้องติดต่อเจ้าของไฟล์", actions:"ขอสิทธิ์เข้าถึง" }).status, "access_denied", "a Thai access wall must be provider-neutral");
assert.equal(accessGateFromEvidence({ heading:"ขออภัย มีบางอย่างผิดปกติ", actions:"กลับไปยังไซต์", bodyText:"ขออภัย คุณเข้าถึงเอกสารนี้ไม่ได้ โปรดติดต่อบุคคลที่ให้คุณแชร์เอกสารนี้" }).status, "access_denied", "the Thai SharePoint access page must fail immediately without waiting for the player timeout");
assert.equal(accessGateFromEvidence({ url:"https://spulive-my.sharepoint.com/personal/logistics_spulive_net/_layouts/15/AccessDenied.aspx?Source=x", heading:"คุณต้องมีการเข้าถึง", actions:"ขอการเข้าถึง", bodyText:"คุณไม่มีสิทธิ์เข้าถึง รายการ นี้" }).status, "access_denied", "the current Thai spulive SharePoint AccessDenied page must be detected despite separated Thai words");
assert.equal(accessGateFromEvidence({ url:"https://tenant.sharepoint.com/sites/course/_layouts/15/AccessDenied.aspx?Source=x" }).status, "access_denied", "the canonical SharePoint AccessDenied endpoint alone is definitive permission evidence");
assert.equal(accessGateFromEvidence({ url:"https://notebook.google.com/accessrequest/25ecbc92-2124-4d22-a98a-ef1be276dcf5?ref=course" }).status, "access_denied", "Notebook's delayed access-request redirect must be definitive even if scripting is blocked");
assert.equal(accessGateFromEvidence({ heading:"Gemini Notebook", actions:"Request access", bodyText:"You do not have access to view this notebook." }).status, "access_denied", "Notebook's visible denial must not be reported as an unknown Podcast type");
assert.equal(accessGateFromEvidence({ url:"https://notebooklm.google.com/notebook/example", heading:"Gemini Notebook", actions:"Play audio" }), null, "an ordinary Notebook page must not be mistaken for an access wall");
assert.equal(accessGateFromEvidence({ url:"https://tenant.sharepoint.com/:v:/s/course/file", heading:"Lecture video", actions:"Play Download" }), null, "an ordinary SharePoint file page must not be mistaken for an access wall");
assert.equal(accessGateFromEvidence({ url:"https://accounts.google.com/signin", heading:"Sign in", actions:"Sign in" }).status, "login_required", "a sign-in screen must not become a permission denial");
assert.equal(accessGateFromEvidence({ heading:"Loading preview", actions:"" }), null, "a loading preview must never be mistaken for an access failure");
assert.equal(accessGateFromEvidence({ heading:"404 Not Found", bodyText:"This video is unavailable" }).status, "missing_file", "a provider-neutral missing-video page must enter the bounded retry path");
assert.equal(accessGateFromEvidence({
  url:"https://www.loom.com/share/deleted",
  heading:"This Loom isn’t available",
  bodyText:"The video may have been deleted or archived by its creator."
}).status, "missing_file", "a deleted or archived Loom must enter the confirmed unavailable-link path");
assert.equal(accessGateFromEvidence({
  url:"https://www.youtube.com/watch?v=removed123",
  bodyText:"This video isn't available anymore GO TO HOME"
}).status, "missing_file", "YouTube's visible removed-video screen must enter the bounded retry path");
assert.equal(unavailableMediaFromProviderMarkup(
  'ytInitialPlayerResponse = {"playabilityStatus":{"status":"ERROR","reason":"This video isn\'t available anymore"}};',
  "https://www.youtube.com/watch?v=removed123"
)?.mediaStatus, "link_unavailable", "YouTube playability metadata must close a removed video before the visible page finishes rendering");
assert.equal(unavailableMediaFromProviderMarkup(
  '{"playabilityStatus":{"status":"OK"},"videoDetails":{"lengthSeconds":"600"},"messages":{"simpleText":"This video is unavailable"}}',
  "https://www.youtube.com/watch?v=playable123"
), null, "generic translated YouTube error templates must not fail a playable video");
const notebookVideoEvidence = selectProviderDurationEvidence([{
  isNotebook:true,
  seconds:null,
  notebookDurationSeconds:470,
  durationText:"07:50"
}]);
assert.equal(notebookVideoEvidence.durationSeconds, 470, "NotebookLM must use the visible total 07:50 once its player has loaded");
assert.equal(selectProviderDurationEvidence([{seconds:600, durationText:"01:00"}]).durationSeconds, 600, "ordinary providers must continue preferring real media-element metadata");
assert.equal(accessGateFromEvidence({
  url:"https://drive.google.com/file/d/missing/view",
  bodyText:"Sorry, the file you have requested does not exist. Make sure that you have the correct URL and the file exists."
}).status, "missing_file", "a missing Drive file must enter the one-refresh fast failure path");
assert.equal(accessGateFromEvidence({
  url:"https://drive.google.com/file/d/missing/view",
  bodyText:"ขออภัย ไม่พบไฟล์ที่คุณร้องขอ"
}).status, "missing_file", "a Thai missing-file page must enter the same fast failure path");
assert.ok(providerOriginsForUrl("https://drive.google.com/file/d/example/view").includes("https://youtube.googleapis.com/*"), "Drive permission must include its embedded video-player origin");
assert.deepEqual(providerOriginsForUrl("https://app.heygen.com/videos/example"), ["https://*.heygen.com/*"], "HeyGen links must request the provider permission needed for player inspection");
assert.equal(mediaTypeFromProviderEvidence({targetUrl:"https://app.heygen.com/videos/example"}), "video", "HeyGen must be recognised as a video provider before its player finishes loading");
assert.deepEqual(providerOriginsForUrl("https://youtube.googleapis.com/embed/"), ["https://youtube.googleapis.com/*"], "embedded Drive player origin must be recognised directly");
const googlePhotosOrigins=["https://photos.app.goo.gl/*", "https://photos.google.com/*", "https://*.googleusercontent.com/*", "https://photos.fife.usercontent.google.com/*", "https://youtube.googleapis.com/*"];
assert.deepEqual(providerOriginsForUrl("https://photos.app.goo.gl/Xz2xMsNUEAqtNZfS6"), googlePhotosOrigins, "Google Photos short links must request the full redirect and player chain");
assert.deepEqual(providerOriginsForUrl("https://photos.google.com/share/example"), googlePhotosOrigins, "Google Photos destination links must retain player permission");
assert.deepEqual(providerOriginsForUrl("https://photos.fife.usercontent.google.com/example"), googlePhotosOrigins, "the exact Google Photos delivery host observed in the real sample must retain permission");
assert.equal(classifyActivity(url("VDO ep01_02_07 URL", "ข้อมูลเพิ่มเติม")), "video", "an explicitly named VDO must survive a misplaced supplementary label");
assert.equal(classifyActivity(url("บรรยายสรุปครั้งที่ 8 URL")), "url", "an unlabeled summary URL must remain unclassified and uncounted");
assert.equal(classifyActivity(url("Live Record Sec001 ครั้งที่ 7")), "recording", "Live Record must remain excluded from pre-recorded teaching video");
assert.equal(classifyActivityWithEvidence(url("LIVE RECORD_DES111_EP02_SEC_001", "วิดีโอบันทึกการสอนสดออนไลน์")).recordingFastPath, true, "clear Live Record names must bypass destination opening");
assert.equal(classifyActivity(url("หัวข้อบทเรียน URL"),"supplementary"),"supplementary","a reviewer exclusion must survive the next audit");
assert.equal(classifyActivityWithEvidence(url("LIVE RECORD_DES111_EP02_SEC_001", "วิดีโอการสอนล่วงหน้า")).recordingFastPath, false, "a recording under a pre-recorded group must remain on the safe review path");
assert.equal(classifyActivity(url("Video : Introduction 1", "วิดีโอบันทึกการสอนล่วงหน้า")), "video", "generic introduction video below label must count");
assert.equal(classifyActivity(url("แนะนำรายวิชา URL", "วิดีโอก่อนเรียน Students can manually mark this item complete: Label")), "video", "a generic course-introduction link under the abbreviated Thai video label must count as video");
assert.equal(classifyActivity(url("VIDEO : แนะนำคอร์ส AI Literacy and Safety Modules ความรู้รอบด้าน AI และความปลอดภัย (2:02)", "มาดูคลิปสอนกัน")), "video", "video below the visual teaching label must count");
assert.equal(classifyActivity(url("VIDEO : แนะนำการเรียน แนะนำการเรียน โมดูลถอดรหัสลับแฮกเกอร์สมรภูมิความปลอดภัย[ONSITE] (3:07)", "วิดีโอบันทึกการสอนล่วงหน้า")), "video", "image-only teaching pill must make its following video count");
assert.equal(classifyActivity(url("ลิงก์ NotebookLM", "วิดีโอบันทึกการสอนล่วงหน้า")), "url", "a learning tool below a video pill must not become a video");
assert.equal(classifyActivity(url("แนะนำบทเรียน บทที่ 1", "วิดีโอบันทึกการสอนล่วงหน้า")), "video", "a teaching link under the pre-recorded label must count even without the word Video");
assert.equal(classifyActivity(url("Lesson overview", "pre-recorded teaching video")), "video", "English teaching labels must classify generic lesson links");
assert.equal(classifyActivity(url("Google Gemini for students", "pre-recorded teaching video")), "url", "recognisable product tool must not become a video from a leaked group");
assert.equal(classifyActivity(url("Podcast : ครั้งที่ 2 ออกแบบพิมพ์เขียว")), "podcast", "podcast must remain podcast");
assert.equal(classifyActivity(quiz("แบบทดสอบก่อนเรียน ครั้งที่ 2")), "pre_quiz", "pre-test must remain pre-quiz");
assert.equal(classifyActivity(quiz("แบบทดสอบหลังเรียน ครั้งที่ 2")), "post_quiz", "post-test must remain post-quiz");
assert.equal(classifyActivity(url("แบบทดสอบ ก่อน เรียน", "Pre-test")), "pre_quiz", "spaced Thai pre-test label must count");
assert.equal(classifyActivity(url("แบบทดสอบ หลัง เรียน", "Post-test")), "post_quiz", "spaced Thai post-test label must count");
assert.equal(classifyActivity(url("แบบทดสอบ ก่อน เรียน (copy)", "Post-test")), "post_quiz", "verified Post-test group must win over a copied pre-test title");
assert.equal(classifyActivity(url("แบบประเมิน", "Pre-assessment")), "pre_quiz", "a generic external form under Pre-assessment must count");
assert.equal(classifyActivity(url("บทเรียนเทคนิคที่ใช้บันทึกกระบวนการทางธุรกิจ", "เอกสารประกอบการสอน")), "file_link", "a PDF link beneath supporting-material label must enter PDF verification");
assert.equal(classifyActivity(url("แผนรายสัปดาห์", "แผนการเรียนการสอน")), "file_link", "a plan link beneath plan label must enter PDF verification");
assert.equal(classifyActivity(url("Video : การวางระบบ Pump - S001 2568", "บันทึกการสอนสด")), "recording", "live-recording context must not count");
assert.equal(classifyActivity(url("Video : ระบบอาคาร")), "video_candidate", "unlabelled video must require confirmation");
const timedVideoTitles = [
  "Video การจัดการการไหลทางกายภาพ ข้อมูล และการเงิน (8:49 นาที) URL",
  "Video การจัดซื้อและจัดหา Part 1/2 (7:07 นาที) URL",
  "Video การจัดซื้อและจัดหา Part 2/2 (7:19 นาที) URL",
  "Video การจัดการสินค้าคงคลังและคลังสินค้า Part 1/2 (7:09 นาที) URL",
  "Video การจัดการสินค้าคงคลังและคลังสินค้า Part 2/2 (6:23 นาที) URL",
  "Video กระบวนการผลิต การบรรจุ และบรรจุภัณฑ์ Part 1/2 (7:31 นาที) URL",
  "Video กระบวนการผลิต การบรรจุ และบรรจุภัณฑ์ Part 2/2 (8:17 นาที) URL",
  "Video การขนส่ง (7:07 นาที) URL",
  "Video เทคโนโลยีและนวัตกรรม เพื่อการจัดการโลจิสติกส์และโซ่อุปทาน EP1 (6:05 นาที) URL",
  "Video เทคโนโลยีและนวัตกรรม เพื่อการจัดการโลจิสติกส์และโซ่อุปทาน EP2 (6:37 นาที) URL",
  "Video หลักการและแนวคิดการจัดการโซ่อุปทานแบบลีน Part 1/2 (8:04 นาที) URL",
  "Video หลักการและแนวคิดการจัดการโซ่อุปทานแบบลีน Part 2/2 (6:14 นาที) URL",
  "Video การจัดการโลจิสติกส์เพื่อสิ่งแวดล้อม Part 1/2 (12:39 นาที) URL",
  "Video การจัดการโลจิสติกส์เพื่อสิ่งแวดล้อม Part 2/2 (6:56 นาที) URL",
  "Video การจัดการโซ่ความเย็น Part 1/2 (8:02 นาที) URL",
  "Video การจัดการโซ่ความเย็น Part 2/2 (8:45 นาที) URL",
  "Video การจัดการความร่วมมือในโซ่อุปทาน Part 1/2 (6:51 นาที) URL",
  "Video การจัดการความร่วมมือในโซ่อุปทาน Part 2/2 (8:44 นาที) URL"
];
for (const title of timedVideoTitles) {
  const classified = classifyActivityWithEvidence(url(title));
  assert.equal(classified.kind, "video", `${title} must be a verified teaching video`);
  assert.equal(classified.confidence, "high", `${title} must carry high-confidence title evidence`);
  assert.equal(classified.requiresReview, false, `${title} must not appear in the classification-review appendix`);
  assert.ok(classified.evidence.some((entry) => /ระบุเวลา/.test(entry.value)), `${title} must explain its timing evidence in the report`);
}
const liveLsm487TimedTitles = [
  "video-LSM487_EP1.1 (4.57 นาที) URL", "video-LSM487_EP1.2 (3.37 นาที) URL",
  "video-LSM487_EP1.3 (3.33 นาที) URL", "video-LSM487_EP1.4 (3.54 นาที) URL",
  "video-LSM487_EP1.5 (5.06 นาที) URL", "video-LSM487_EP1.6 (3.42 นาที) URL",
  "video-LSM487_EP1.7 (3.22 นาที) URL", "video-LSM487_EP1.8 (7.50 นาที) URL",
  "video-LSM487_EP1.9 (5.14 นาที) URL", "video-LSM487_EP1.10 (3.28 นาที) URL",
  "video-LSM487_EP1.11 (3.11 นาที) URL", "video-LSM487_EP1.12 (3.38 นาที) URL",
  "video-LSM487_EP1.13 (4,04 นาที) URL", "video-LSM487_EP1.14 (4,12 นาที) URL"
];
for (const title of liveLsm487TimedTitles) {
  const classified = classifyActivityWithEvidence(url(title, "แบบทดสอบก่อนเรียน แบบทดสอบก่อนเรียน"));
  assert.equal(classified.kind, "video", `${title} from the live LSM487 page must be timed as video`);
  assert.equal(classified.requiresReview, false, `${title} from the live LSM487 page must enter scoring without manual classification`);
}
assert.equal(classifyActivity(url("Video : Live Record ระบบคลังสินค้า (8:49 นาที) URL")), "recording", "a timed Live Record must remain excluded from pre-recorded video");
assert.equal(classifyActivity(url("Video สื่ออ่านเพิ่มเติม (8:49 นาที) URL", "ข้อมูลเพิ่มเติม")), "supplementary", "an explicitly supplementary timed video must remain excluded");
assert.equal(classifyActivity(url("Video : ครั้งที่ 1 ระบบฐานข้อมูล จากแฟ้มผู้สถาปัตยกรรม")), "video_candidate", "a session number is not proof of pre-recorded teaching video");
assert.equal(classifyActivity(h5p("VIDEO : EP.1 ปลดล็อกสกิล: ให้ AI ช่วยปั้นไอเดียตอนสมองตัน (4:15)", "วิดีโอบันทึกการสอนล่วงหน้า")), "video", "H5P video must count as teaching video");
assert.equal(classifyActivity(h5p("บทเรียนแบบโต้ตอบ", "วิดีโอบันทึกการสอนล่วงหน้า")), "video", "H5P under a verified teaching-video label must count");
assert.equal(classifyActivity(url("ฟีฟ้า ติวเตอร์ส่วนตัว สำหรับ Dek SPU ทุกความแตกต่าง")), "ai_tutor", "Thai tutor link must count as AI Tutor");
assert.equal(classifyActivity(url("AI Coach ธุรกิจผู้ให้บริการโลจิสติกส์ (POE.com)")), "ai_tutor", "an explicitly named AI Coach counts toward the AI Tutor criterion");
assert.equal(classifyActivity(url("AI Coiach ธุรกิจผู้ให้บริการโลจิสติกส์ (POE.com)")), "ai_tutor", "the instructor's AI Coiach spelling is also recognized");
assert.equal(classifyActivity(url("AI Coach ธุรกิจผู้ให้บริการโลจิสติกส์ (POE.com)","วิดีโอบันทึกการสอนล่วงหน้า")), "ai_tutor", "an AI Coach link must not turn into a teaching video under a misplaced label");
assert.equal(classifyActivity(url("พี่จ้อบ พา Dek SPU ไปได้ลงานจริง", "AI Tutors")), "ai_tutor", "links under AI Tutors must not be classified as video");
assert.equal(classifyActivity(url("พี่จ้อบ พา Dek SPU ไปได้ลงานจริง", "วิดีโอบันทึกการสอนล่วงหน้า")), "ai_tutor", "named AI Tutor must win even when a previous video pill leaked");
const vodUnderTutor = classifyActivityWithEvidence(url("Video on demand 1", "AI Tutor"));
assert.equal(vodUnderTutor.kind, "video", "explicit Video on demand must override an unrelated AI Tutor placement");
assert.equal(vodUnderTutor.confidence, "high", "explicit Video on demand title must carry high confidence");
assert.equal(vodUnderTutor.contextConflict, true, "report must retain the AI Tutor placement as a visible conflict");
assert.equal(classifyActivity(url("Live record ครั้งที่ 1 Sec 001", "AI Tutor")), "recording", "Live record under AI Tutor must remain excluded recording");
assert.equal(classifyActivity(url("Quest-1 : Poster กลุ่ม", "กิจกรรม")), "assignment", "activity label with an external quest must count as an assignment");
assert.equal(classifyActivity({title:"Facebook วิทยาลัยโลจิสติกส์",text:"ให้เข้า Facebook ชมวิดีโอย้อนหลัง แล้วแสดงความคิดเห็น พร้อมกด Like กด Share",groupContext:"กิจกรรม ท้ายบทเรียน ให้เข้า Facebook ชมวิดีโอย้อนหลัง แล้วแสดงความคิดเห็น",href:"https://facebook.com/example"}),"assignment","an activity link asking for comments must not become a recording because its brief mentions a replay video");
assert.equal(classifyActivity(url("แนะนำตัว Say Hi กันก่อน")), "assignment", "introductory Say Hi activity must count as activity");
assert.equal(classifyActivity(url("Introduce yourself")), "assignment", "English introductory activity must count");
assert.equal(classifyActivity({title:"ส่งงานปลายบท", groupContext:"กิจกรรมท้ายบทเรียน", href:"https://forms.gle/example"}), "assignment", "direct Form under an activity label must count as an assignment");
assert.equal(classifyActivity({title:"ภาพคำสั่งกิจกรรมท้ายบท", groupContext:"กิจกรรมท้ายบทเรียน", href:"https://dlearning.spu.ac.th/pluginfile.php/assignment.png", evidenceType:"assignment_image", ocrStatus:"confirmed", ocrText:"ASSIGNMENT ให้นักศึกษาส่งงาน Google Form"}), "assignment", "an OCR-confirmed instruction image must count as an optional assignment");
assert.equal(classifyActivity({title:"ภาพคำสั่งกิจกรรมท้ายบท", groupContext:"กิจกรรมท้ายบทเรียน", href:"https://dlearning.spu.ac.th/pluginfile.php/assignment.png", evidenceType:"assignment_image", ocrStatus:"unclear"}), "assignment_image_candidate", "an unreadable instruction image must remain a reviewer decision, not an automatic assignment");
assert.equal(classifyActivity({title:"คำถามจากวิดีโอโลจิสติกส์", groupContext:"กิจกรรมประจำสัปดาห์", href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=38507"}), "quiz", "a Moodle Quiz under an activity label must remain Quiz and never become Assignment");
assert.equal(classifyActivity({title:"กรณีศึกษาโลจิสติกส์ไทยสู่ E-logistics", text:"ให้นักศึกษาดูวิดีโอ แล้วตอบคำถาม", groupContext:"กิจกรรมประจำสัปดาห์", href:"https://dlearning.spu.ac.th/mod/url/view.php?id=38506"}), "activity_video", "a video used to answer an activity must be found but excluded from teaching-video time");
assert.equal(classifyActivity({title:"case-LSM487_3_Panama1", text:"case-LSM487_3_Panama1", groupContext:"ให้ดูคลิป VDO ตามลิงค์นี้ กิจกรรมประจำสัปดาห์", href:"https://dlearning.spu.ac.th/mod/url/view.php?id=38508"}), "activity_video", "an activity instruction to watch linked clips must exclude generically named case-study clips");
assert.equal(classifyActivity(url("Video กรณีศึกษา Supply Chain", "กิจกรรมท้ายบท")), "video", "a clearly named video must survive a misplaced activity label");
assert.equal(classifyActivity(url("VDO บทเรียนที่ 3", "กิจกรรมท้ายบท วิดีโอการสอนล่วงหน้า")), "video", "mixed activity and teaching-video labels must stay conservative and must not hide a possible lesson video");
assert.equal(classifyActivity({title:"Announcements", href:"https://dlearning.spu.ac.th/mod/forum/view.php?id=1"}), "forum", "Forum must be distinguishable from an Assignment");
assert.equal(classifyActivity({title:"แบบฝึกหัด สัปดาห์ที่ 2", groupContext:"แบบทดสอบก่อนเรียน", href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=2"}), "quiz", "an ordinary practice Quiz must not become a Pre-test from a stale inherited label");
assert.equal(classifyActivity({title:"แบบประเมินความรู้", groupContext:"แบบทดสอบก่อนเรียน", groupContextSource:"inherited_label", href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=20"}), "quiz", "a generic Moodle assessment must not become a Pre-test from an inherited label");
assert.equal(classifyActivity({title:"แบบประเมินความรู้", groupContext:"แบบทดสอบก่อนเรียน", groupContextSource:"adjacent_label", href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=21"}), "pre_quiz", "a generic Moodle assessment immediately under its local Pre-test label remains valid Pre-test evidence");
for (const title of ["Practice Quiz Week 2", "第2周 练习", "第2回 練習"]) assert.equal(classifyActivity({title, groupContext:"Pre-test", href:"https://ilearning.spu.ac.th/mod/quiz/view.php?id=22"}), "quiz", `${title} must remain an ordinary practice Quiz despite a stale Pre-test label`);
assert.equal(classifyActivity({title:"แบบฝึกหัด สัปดาห์ที่ 2", groupContext:"กิจกรรมท้ายบทเรียน", href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=2"}), "quiz", "a practice Quiz under the end-activity artwork remains an ordinary Quiz and never an Assignment");
assert.equal(classifyActivity({title:"แบบฝึกหัดก่อนเรียน สัปดาห์ที่ 2", groupContext:"กิจกรรมท้ายบทเรียน", href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=3"}), "pre_quiz", "an explicitly named pre-learning exercise must still count as Pre-test evidence");
assert.equal(classifyActivity({title:"แบบฝึกหัดหลังเรียน สัปดาห์ที่ 2", groupContext:"กิจกรรมท้ายบทเรียน", href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=4"}), "post_quiz", "an explicitly named post-learning exercise must still count as Post-test evidence");
assert.equal(classifyActivity({title:"เอกสารบทเรียน", groupContext:"เอกสารประกอบการสอน", href:"https://files.example.edu/week-3.pdf"}), "file_link", "direct PDF under document label must enter PDF verification");
assert.equal(classifyActivity({title:"Podcast Esports Services File", groupContext:"Podcast", href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=9"}), "podcast", "uploaded Podcast Resource must remain Podcast rather than a document");
assert.equal(detectMoodleFileTypeEvidence("https://dlearning.spu.ac.th/theme/image.php/boost/core/1/f/pdf"), "pdf", "Moodle's MIME icon URL must confirm PDF");
assert.equal(detectMoodleFileTypeEvidence('activityicon src="https://dlearning.spu.ac.th/theme/image.php/boost/core/1/f/pdf" alt="File"'), "pdf", "an icon URL embedded among DOM attributes must confirm PDF");
assert.equal(detectMoodleFileTypeEvidence("icon fa fa-file-pdf-o"), "pdf", "a Moodle PDF icon class must confirm PDF");
assert.equal(detectMoodleFileTypeEvidence("https://dlearning.spu.ac.th/theme/image.php/boost/core/1/f/audio"), "audio", "Moodle's MIME icon URL must confirm audio");
assert.equal(detectMoodleFileTypeEvidence("https://dlearning.spu.ac.th/theme/image.php/boost/core/1/f/video"), "video", "Moodle's MIME icon URL must identify a video Podcast regardless of filename");
assert.equal(detectMoodleFileTypeEvidence("activityicon File"), "", "a generic file icon must remain unresolved");
const iconConfirmedPdf = applyMoodleFileTypeHint({target:"https://dlearning.spu.ac.th/mod/resource/view.php?id=1", isPdf:false, fileVerification:"unresolved"}, {href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=1", title:"LSM487 Lesson Plan 2 File", fileTypeHint:"pdf"});
assert.equal(iconConfirmedPdf.fileVerification, "pdf", "an unresolved view.php resource must become a confirmed PDF from its MIME icon");
assert.equal(iconConfirmedPdf.isPdf, true, "the PDF icon fallback must feed the checklist's isPdf result");
assert.equal(iconConfirmedPdf.sourceType, "moodle_activity_icon", "the PDF result must retain its evidence source for display");
const iconConfirmedVideo = applyMoodleFileTypeHint({target:"https://dlearning.spu.ac.th/mod/resource/view.php?id=9", isPdf:false, fileVerification:"unresolved"}, {href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=9", title:"Podcast ประจำสัปดาห์", fileTypeHint:"video"});
assert.equal(iconConfirmedVideo.isVideo, true, "a Moodle video MIME icon must expose a video Podcast to scoring rules");
assert.equal(iconConfirmedVideo.isAudio, false, "a video Podcast must never be accepted as audio");
assert.equal(applyMoodleFileTypeHint({isPdf:false, fileVerification:"not_pdf", sourceType:"response_header"}, {fileTypeHint:"pdf"}).fileVerification, "not_pdf", "a PDF icon must not override a confirmed non-PDF response");
let pdfInspectorCalls = 0;
const resolvedIconPdf = await resolveMoodleResourceEvidence({href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=3030926",title:"LSM487 Lesson Plan 2 File",fileTypeHint:"pdf"}, async () => {
  pdfInspectorCalls += 1;
  return {isPdf:false,fileVerification:"unresolved"};
});
assert.equal(pdfInspectorCalls, 0, "a server-issued /f/pdf MIME icon must resolve before opening the ambiguous view.php wrapper");
assert.equal(resolvedIconPdf.isPdf, true, "the resolved Moodle resource must reach checklist scoring as PDF");
const linkedIconPdf = applyMoodleFileTypeHint({target:"https://example.edu/preview",isPdf:false,fileVerification:"unresolved"},{href:"https://dlearning.spu.ac.th/mod/url/view.php?id=8",title:"เอกสารนำแนะรายวิชาสอน",fileTypeHint:"pdf"});
assert.equal(linkedIconPdf.fileVerification,"pdf","a PDF icon must also confirm a Moodle URL/label document when its external preview is inconclusive");
assert.equal(sectionWeekMapping([{section:"第2課 文法", title:"VDO URL"}]).get("第2課 文法"), undefined, "lesson number alone must not be inferred by the section-vote mapper");
assert.equal(groupedByWeek([{section:"Lesson 1", title:"Lesson 1 File"}], new Map())["ครั้งที่ 1"], undefined, "Lesson must remain content evidence, not an inferred session");
assert.equal(groupedByWeek([{section:"Unit 02", title:"Unit 02 File"}], new Map())["ครั้งที่ 2"], undefined, "Unit must remain content evidence, not an inferred session");
assert.equal(groupedByWeek([{section:"Module #3", title:"Module 3 File"}], new Map())["ครั้งที่ 3"], undefined, "Module must remain content evidence, not an inferred session");
const defaultSectionCourse = [1,2,3,4,5].flatMap((number) => [{section:`Section ${number}`, title:`EP.${number} File`}, {section:`Section ${number}`, title:`EP.${number} URL`}]);
const defaultSectionMapping = sectionWeekMapping(defaultSectionCourse);
assert.equal(groupedByWeek(defaultSectionCourse, defaultSectionMapping)["ครั้งที่ 4"].length, 2, "a consecutive Moodle Section N sequence must map without requiring a course-specific title");
assert.equal(sectionWeekMapping([{section:"Section 2", title:"EP.2 URL"}]).size, 0, "a lone Section N remains too ambiguous to infer as a teaching week");
const zeroBased = Array.from({length:15}, (_, index) => ({section:`Section ${index}`, title:index === 0 ? "ข้อมูลรายวิชา ครั้งที่ 1 Podcast AI Tutor" : `เนื้อหา EP.${index}`}));
const zeroTopology = sectionTopology(zeroBased);
assert.equal(zeroTopology.mode, "zero_based_first_session", "Section 0 with explicit first-session evidence must start the 15-session schedule");
assert.equal(zeroTopology.mapping.get("Section 0"), 1, "Section 0 must become session 1 in a zero-based course");
assert.equal(zeroTopology.mapping.get("Section 14"), 15, "Section 14 must become session 15 in a zero-based course");
assert.equal(zeroTopology.mapping.get("Section 15"), undefined, "the topology must never fabricate session 16");
const beyondRubric = sectionTopology([{section:"ครั้งที่ 16 พระราชบัญญัติไทย",title:"Video Summary Explain Ch11-12 URL"}], 15);
assert.equal(beyondRubric.mapping.has("ครั้งที่ 16 พระราชบัญญัติไทย"), false, "session 16 must remain outside the 15-session rubric");
assert.match(beyondRubric.diagnostics[0].reason, /เกินกรอบเกณฑ์ 15 ครั้ง/, "session 16 must carry an explicit outside-rubric reason");
const zeroIntro = [{section:"Section 0", title:"Course information"}, ...Array.from({length:15}, (_, index) => ({section:`Section ${index + 1}`, title:`EP.${index + 1}`}))];
const introTopology = sectionTopology(zeroIntro);
assert.equal(introTopology.mode, "section_zero_intro", "an unproven Section 0 must remain a prelude rather than shifting all sessions");
assert.equal(introTopology.mapping.get("Section 1"), 1, "Section 1 must remain session 1 when Section 0 is only an intro");
assert.equal(introTopology.mapping.get("Section 0"), 1, "meaningful Section 0 intro evidence may support, but not shift, session 1");
assert.equal(groupedByWeek([{section:"Chapter 4", title:"Chapter 4 File"}], new Map())["ครั้งที่ 4"], undefined, "Chapter must remain unmapped because it is not reliably a teaching-week number");
const topicBoxes = Array.from({length:16}, (_, index) => ({section:`หัวข้อเนื้อหา ${index + 1}`, title:`VDO TOPIC_${index + 1} URL`, kind:"video"}));
const orderedBoxTopology = sectionTopology(topicBoxes, 15);
assert.equal(orderedBoxTopology.mode, "ordered_section_boxes", "unnumbered Moodle section cards must use their visual DOM order");
assert.equal(orderedBoxTopology.mapping.get("หัวข้อเนื้อหา 1"), 1, "the first unnumbered section card must become session 1");
assert.equal(orderedBoxTopology.mapping.get("หัวข้อเนื้อหา 15"), 15, "the fifteenth unnumbered section card must become session 15");
assert.equal(orderedBoxTopology.mapping.has("หัวข้อเนื้อหา 16"), false, "an extra unnumbered section card must remain outside the rubric");
assert.match(orderedBoxTopology.diagnostics.at(-1).reason, /กล่อง Section ลำดับที่ 16 เกินกรอบเกณฑ์ 15 ครั้ง/, "an extra ordered card must explain why it is excluded");
const topicBoxesWithForum = [{section:"Announcements",title:"ประกาศ",kind:"forum"}, ...topicBoxes.slice(0,15)];
const forumBoxTopology = sectionTopology(topicBoxesWithForum, 15);
assert.equal(forumBoxTopology.mapping.has("Announcements"), false, "a standalone announcement card must not consume session 1");
assert.equal(forumBoxTopology.mapping.get("หัวข้อเนื้อหา 1"), 1, "the first teaching card after Announcements must become session 1");
assert.equal(forumBoxTopology.mapping.get("หัวข้อเนื้อหา 15"), 15, "all fifteen teaching cards must remain mapped after ignoring Announcements");
const generalAndSectionOne = [
  {sectionId:"section-0",sectionIndex:0,section:"General",title:"ข้อมูลรายวิชาและการประเมินผล",kind:"file"},
  {sectionId:"section-0",sectionIndex:0,section:"General",title:"ช่องทางติดต่ออาจารย์",kind:"forum"},
  {sectionId:"section-1",sectionIndex:1,section:"Section 1",title:"AI Tutor SOC119",kind:"ai_tutor"},
  {sectionId:"section-1",sectionIndex:1,section:"Section 1",title:"Podcast แนะนำรายวิชา",kind:"podcast"},
  {sectionId:"section-2",sectionIndex:2,section:"Section 2",title:"บทเรียนครั้งถัดไป",kind:"video"}
];
const generalAndSectionOneTopology = sectionTopology(generalAndSectionOne,15);
assert.equal(canonicalWeek(generalAndSectionOne[2],generalAndSectionOneTopology.mapping),1,"Section 1 must remain session 1 after a rich General course-information box");
assert.equal(canonicalWeek(generalAndSectionOne[3],generalAndSectionOneTopology.mapping),1,"Podcast in Section 1 must remain in the first checklist session");
assert.equal(canonicalWeek(generalAndSectionOne[4],generalAndSectionOneTopology.mapping),2,"Section 2 must remain session 2 after merging General with Section 1");
assert.equal(groupedByWeek([{section:"คร้ังที่ 14 ตัวอย่าง", title:"Podcast File"}], new Map())["ครั้งที่ 14"].length, 1, "Thai week markers with reordered combining marks must map to the same week");
const thaiWeeklyCourse = [
  {section:"General", title:"Announcements"},
  {section:"แนะนำบทเรียน", title:"ข้อมูลรายวิชา"},
  ...Array.from({length:15}, (_, index) => ({section:`หัวข้อการสอนประจำสัปดาห์ที่ ${index + 1}`, title:`video-LSM487_${index + 1} URL`}))
];
const thaiWeeklyTopology = sectionTopology(thaiWeeklyCourse);
assert.equal(thaiWeeklyTopology.mode, "explicit_session_headings", "explicit Thai weekly headings must choose a decisive topology");
assert.equal(thaiWeeklyTopology.confidence, "high", "all 15 explicit Thai weekly headings must be high-confidence evidence");
assert.equal(thaiWeeklyTopology.mapping.get("หัวข้อการสอนประจำสัปดาห์ที่ 15"), 15, "ประจำสัปดาห์ที่ 15 must map to session 15");
assert.equal(canonicalWeek({section:"แนะนำบทเรียน"}, thaiWeeklyTopology.mapping), 1, "แนะนำบทเรียน must join session 1");
assert.equal(canonicalWeek({section:"สัปดาห์ 6"}, sectionTopology([{section:"สัปดาห์ 6",title:"บทเรียน"}]).mapping), 6, "a Thai week heading without ที่ must still map safely");
assert.equal(thaiWeeklyCourse.filter((item) => !canonicalWeek(item, thaiWeeklyTopology.mapping)).length, 0, "the LSM36767 heading pattern must leave no activities unmapped");
const courseTitleIntroduction = [
  {section:"LSM202 การจัดการโซ่อุปทานแบบลีน",title:"แผนการสอน มคอ3 LSM202 File"},
  {section:"LSM202 การจัดการโซ่อุปทานแบบลีน",title:"Video แนะนำการเรียนรายวิชา LSM202 URL"},
  {section:"LSM202 การจัดการโซ่อุปทานแบบลีน",title:"AI Tutor LEAN SUPPLY CHAIN URL"},
  {section:"LSM202 การจัดการโซ่อุปทานแบบลีน",title:"แบบทดสอบก่อนเรียน Quiz"},
  ...Array.from({length:15}, (_, index) => ({section:`สัปดาห์ที่ ${index + 1}`,title:`Video ${index + 1} URL`}))
];
const courseTitleIntroTopology = sectionTopology(courseTitleIntroduction, 15);
assert.equal(courseTitleIntroTopology.mapping.get("LSM202 การจัดการโซ่อุปทานแบบลีน"), 1, "a course-title Section 0 with a complete introduction bundle must merge into session 1");
assert.equal(courseTitleIntroTopology.mapping.get("สัปดาห์ที่ 1"), 1, "the explicit first teaching section must remain in session 1 alongside the introduction card");
const ordinaryTopicBundle = [
  {section:"การขนส่งทางถนน",title:"Video บทเรียน URL"},
  {section:"การขนส่งทางถนน",title:"Podcast บทเรียน URL"},
  {section:"การขนส่งทางถนน",title:"แบบทดสอบก่อนเรียน"},
  ...Array.from({length:3}, (_, index) => ({section:`สัปดาห์ที่ ${index + 1}`,title:"เนื้อหา"}))
];
assert.equal(sectionTopology(ordinaryTopicBundle, 15).mapping.has("การขนส่งทางถนน"), false, "an ordinary content section without a course-overview signal must not be merged into session 1");
const auditPipeline = fs.readFileSync(new URL("../background.js", import.meta.url), "utf8");
assert.match(auditPipeline, /isNotebook\s*=.*notebook[\s\S]*?slowProvider\s*=.*isNotebook/, "NotebookLM must receive the slow-provider loading window before duration is declared unavailable");
assert.match(auditPipeline, /readNotebookInForeground/, "NotebookLM must have a bounded foreground fallback when its background player stays suspended");
assert.match(auditPipeline, /const roots = \[document\]/, "media inspection must include players mounted in open shadow roots");
const popupFlow = fs.readFileSync(new URL("../popup.js", import.meta.url), "utf8");
assert.match(auditPipeline, /"pre_quiz", "post_quiz"/, "external Pre/Post links must enter the target-resolution pipeline");
assert.match(auditPipeline, /meta\[http-equiv='refresh'/, "link resolver must inspect meta redirects");
assert.match(auditPipeline, /trackingHost/, "redirect resolver must exclude tracking hosts");
assert.match(auditPipeline, /trackingHost\(host\)/, "Google Tag Manager must never become an external media target");
assert.match(auditPipeline, /data-vocabulary\\\.org/, "legacy breadcrumb vocabulary links must never become an external target");
assert.match(auditPipeline, /metadataTarget/, "a metadata URL reached by redirect must be rejected as well");
assert.match(auditPipeline, /isTabGoneError/, "a vanished temporary tab must be recognised explicitly");
assert.match(auditPipeline, /แท็บปลายทางปิดก่อนอ่าน/, "a vanished tab must remain a per-link review outcome");
assert.match(auditPipeline, /onedrive-metadata/, "OneDrive duration metadata must be recognised");
assert.match(auditPipeline, /withTemporaryForeground/, "OneDrive may temporarily use a foreground audit tab and restore the previous tab");
assert.match(auditPipeline, /readOneDriveInForeground/, "OneDrive must have a bounded foreground recovery path");
assert.match(auditPipeline, /waitForTabSettled/, "OneDrive reload must wait for navigation rather than a fixed delay");
assert.match(auditPipeline, /mediaProviderEvidence/, "generic Moodle URLs must be promoted only after a verified media destination is found");
assert.match(auditPipeline, /mediaProbeCandidateEvidence/, "ambiguous OneDrive links must be probed rather than silently discarded");
assert.match(auditPipeline, /ปลายทาง Google Photos — ต้องยืนยันว่าเป็นวิดีโอจากหน้าเล่น/, "a generic Google Photos share must be probed rather than assumed to be a video");
assert.match(auditPipeline, /google-photos-metadata/, "Google Photos metadata must be reported as its own evidence source");
assert.match(auditPipeline, /mediaDetected/, "a generic OneDrive link must become a scored video only after player evidence is found");
assert.match(auditPipeline, /skipped_recording/, "high-confidence recordings must skip external link inspection");
assert.match(auditPipeline, /recordingFastPath/, "only classifier-confirmed recordings may take the fast path");
assert.match(auditPipeline, /chrome\.tabs\.reload\(tabId\)/, "OneDrive transient player errors must be retried by reloading");
assert.match(auditPipeline, /player_not_ready/, "a transient OneDrive player failure must not be reported as a broken link");
assert.match(auditPipeline, /play_required/, "a user-gesture playback requirement must be reported distinctly");
assert.match(auditPipeline, /provider_unsupported/, "providers which expose no duration must be reported distinctly");
assert.match(auditPipeline, /access_denied:"ติดสิทธิ์ผู้ให้บริการ"/, "media summaries must distinguish a confirmed access wall from a broken link");
assert.match(auditPipeline, /drive-metadata/, "Drive metadata must be distinguished from a generic page probe");
assert.equal(RULES.GS.automaticMax, 105, "automatic checklist score must preserve the 105-point system maximum");
assert.equal(RULES.GS.manualMax, 5, "Table 3 must remain a five-point manual score");
assert.equal(RULES.GN.expectedSessions, 15, "every GN course must be scanned against 15 teaching sessions");
assert.equal(gnRequiredMediaSessions("theory"), 15, "GN theory must require all 15 media sessions");
assert.equal(gnRequiredMediaSessions("practical"), 7, "GN practical must require at least seven media sessions");
assert.equal(mediaTimeResult([{durationSeconds:null,mediaStatus:"link_unavailable"}], 0, 2700, 9), "needs_review", "approved policy: inaccessible video remains for reviewer decision");
assert.equal(podcastTimeResult([{durationSeconds:null,mediaStatus:"link_unavailable"}], 0, 600), "fail", "a twice-confirmed unavailable Podcast must fail rather than need review");
assert.equal(mediaTimeResult([{durationSeconds:null,mediaStatus:"player_not_ready"}], 0, 2700, 9), "needs_review", "a temporary player state must remain reviewable rather than become a broken link");
const gnPassingWeeks = Array.from({length:7}, (_, index) => ({section:`ครั้งที่ ${index + 1}`,checklist:[{}, {}, {status:"pass"}, {status:"pass"}]}));
assert.equal(gnCoverageResult(gnPassingWeeks, "practical").status, "pass", "seven complete media sessions must pass GN practical coverage");
assert.equal(gnCoverageResult(gnPassingWeeks, "theory").status, "fail", "the same seven sessions must fail GN theory coverage");
assert.match(auditPipeline, /unresolvedClassificationCount/, "unclassified activities must prevent a final automatic score");
assert.match(auditPipeline, /podcastDelivery = "internal_upload"/, "uploaded Podcast must retain its internal-hosting compliance result");
assert.match(auditPipeline, /activity\.kind === "podcast" && isLmsHost\(activity\.href\)[\s\S]*?podcastDelivery = "internal_upload"/, "Podcast audio in a Moodle module must be inspected but remain a non-countable internal upload");
assert.match(fs.readFileSync(new URL("../report.js",import.meta.url),"utf8"), /item\.linkStatus === "external" && item\.podcastDelivery !== "internal_upload"/, "internal Podcast uploads must never render manual time controls");
assert.match(auditPipeline, /activity\.kind === "podcast" && isLmsHost\(activity\.href\)/, "internal Podcast pages must use their own Moodle URL as the media inspection target");
assert.match(auditPipeline, /courseType === "GN"/, "GN must not receive the GR/GS 110-point score");
assert.match(auditPipeline, /scoringMode:"grgs_110"/, "GR/GS must retain the documented 110-point scoring mode");
assert.match(auditPipeline, /RUN_AUDIT_QUEUE/, "queue runner must process courses serially in the background");
assert.match(auditPipeline, /sendResponse\(\{ ok:true, started:true \}\)/, "queue start must acknowledge immediately rather than holding a message channel open");
assert.match(auditPipeline, /QUEUE_CONTROL/, "queue runner must accept pause, stop, and resume commands");
assert.match(auditPipeline, /อ่านโครงสร้างเกินเวลา 90 วินาที/, "background structure scans must have a bounded timeout");
assert.match(auditPipeline, /google_editor/, "Google Docs links must be identified as non-PDF documents");
assert.match(auditPipeline, /fileVerification: isPdf \? "pdf" : hasKnownNonPdfExtension \|\| googleEditor \|\| onlineDocument \? "not_pdf" : "unresolved"/, "a generic /view route must remain unresolved while a known online-document route may be identified as non-PDF");
assert.match(auditPipeline, /gamma\\\.app\\\/docs/, "Gamma /docs routes must be identified as online teaching documents");
assert.match(auditPipeline, /decorativeAsset/, "document inspection must reject page decorations such as tracking GIFs");
assert.match(auditPipeline, /netcheck/, "netcheck.gif must never be used as document evidence");
assert.match(auditPipeline, /metadataPdf/, "Google Drive document metadata must be inspected before deciding PDF status");
assert.match(auditPipeline, /contentType\.startsWith\("image\/"\)/, "an image response behind a /view URL must be classified as non-PDF");
assert.match(auditPipeline, /sourceType:googleEditor \? "google_editor" : isImage \? "image"/, "reports must retain an explicit image evidence type");
assert.match(auditPipeline, /const external = presentExternal\(eligibleItems, label\)/, "Pre/Post must exclude Moodle Quiz before evaluating a remaining external link");
assert.match(auditPipeline, /textAssessments\.length/, "verified written Pre/Post questions must remain valid evidence");
assert.match(auditPipeline, /queueElapsedMs/, "queue reports must retain the total elapsed time for each course");
assert.match(auditPipeline, /extensionVersion:\s*chrome\.runtime\.getManifest\(\)\.version/, "reports must identify the extension version that produced them");
assert.match(auditPipeline, /ยืนยันว่าเป็น PDF ไม่ได้/, "unconfirmed document targets must fail rather than remain a normal unresolved result");
assert.match(auditPipeline, /inspectFileResponse/, "PDF inspection must try response metadata and a small in-memory signature before opening a preview");
assert.match(auditPipeline, /Range:"bytes=0-8191"/, "PDF inspection must not download complete files merely to identify their type");
assert.match(auditPipeline, /content-disposition/, "PDF inspection must accept a PDF filename supplied by response headers");
assert.match(auditPipeline, /resolveMoodleResourceEvidence/, "Moodle resource inspection must preserve course-page MIME evidence");
assert.match(auditPipeline, /moodle_activity_icon/, "reports must distinguish PDF confirmation from a Moodle MIME icon");
const linkKindsDeclaration = auditPipeline.match(/const linkKinds = new Set\(\[[^\]]+\]\)/)?.[0] || "";
assert.match(linkKindsDeclaration, /"assignment"/, "classified external assignments must enter destination resolution");
assert.match(linkKindsDeclaration, /"supplementary"/, "named supplementary URL activities must resolve their destination for duplicate matching");
assert.doesNotMatch(linkKindsDeclaration, /"url"/, "generic URL activities must not enter the link-opening queue");
assert.match(auditPipeline, /"video", "video_candidate", "recording"/, "ambiguous video candidates must enter destination verification");
assert.match(auditPipeline, /markDuplicateMediaItems\(activities\)/, "duplicate media must be fingerprinted after destination resolution");
assert.match(auditPipeline, /markHiddenTitleAlternatives\(activities\)/, "same-title hidden/visible alternatives must be paired after evidence collection");
assert.ok(auditPipeline.indexOf("const destinationDuplicates") < auditPipeline.lastIndexOf("markHiddenTitleAlternatives(activities)"),"same-title alternatives may be reduced only after all destinations were inspected");
assert.match(auditPipeline, /poll > 0/, "media inspection must try metadata before attempting playback");
assert.match(auditPipeline, /mediaResultCache/, "a verified duration must be reused for an identical link within one course run");
assert.match(auditPipeline, /readExternalTargetViaFetch/, "Moodle redirects must use a no-tab fast path first");
assert.match(auditPipeline, /readFastMediaMetadata/, "media must use verified metadata before opening Preview");
assert.match(auditPipeline, /mediaInFlight/, "simultaneous duplicate links must share one inspection");
assert.match(auditPipeline, /runBounded\(linkedActivities, processLinkedActivity,[\s\S]*?concurrency:6/, "fast link and metadata inspection must use six bounded workers");
assert.match(auditPipeline, /const auditTabLimiter = createLimiter\(2\)/, "slow browser-player inspection must remain capped at two tabs");
assert.match(auditPipeline, /const mediaReadLimiter = createLimiter\(2\)/, "media deadlines must start only after one of two real reader slots is acquired");
assert.match(auditPipeline, /mediaReadLimiter\.run\(async \(\) =>/, "queued clips must not consume their inspection window before Preview opens");
assert.match(auditPipeline, /const foregroundProviderLimiter = createLimiter\(1\)/, "only foreground focus, not all SharePoint metadata work, must remain serialized");
assert.match(auditPipeline, /attemptWindowMs = cloudVideoProvider \? 150000 : 90000/, "slow cloud previews must receive a fresh provider-specific inspection window");
assert.match(auditPipeline, /result = await readMedia\(targetUrl[\s\S]*?if \(!conclusive\(\)\)[\s\S]*?result = await readMedia\(targetUrl/, "reachable players without duration must be reopened once in a fresh recovery pass");
assert.match(auditPipeline, /mediaStatus:"cloud_folder"/, "a SharePoint folder must be reported as a container instead of a timed-out video");
assert.match(auditPipeline, /item\.mediaStatus !== "cloud_folder"/, "cloud folders must not block or inflate video scoring when direct file links exist");
assert.match(auditPipeline, /item\.currentSemesterQuiz\?\.eligible && item\.currentSemesterQuiz\.role === "assignment"/, "an explicitly labelled Moodle Quiz may count as an end activity only under the current-term tolerance");
assert.match(auditPipeline, /inspectPodcastTypeShared/, "Podcast inspection must use the type-only path instead of automatic timing");
assert.match(auditPipeline, /notebookAudio/, "NotebookLM Studio Audio Overview must be recognised as audio evidence");
assert.match(auditPipeline, /SET_PODCAST_REVIEW/, "reviewer Podcast time must trigger score recalculation without rescanning the course");
assert.match(auditPipeline, /redirect:"manual"/, "redirect discovery must avoid cross-origin fetch chains that create CORS errors");
assert.match(auditPipeline, /interleaveByKey\([\s\S]*?item\.section/, "linked evidence must be interleaved across sections so an oversized early week cannot starve later weeks");
assert.match(auditPipeline, /totalCourseTargetMs = 28 \* 60 \* 1000/, "a course must reserve time to finish its report inside the 20–30 minute target");
assert.match(auditPipeline, /deadline:Number\.POSITIVE_INFINITY/, "the 28-minute performance target must not discard clips that are still waiting to start");
assert.match(auditPipeline, /requestKeepAwake\("system"\)/, "the computer must stay awake while an audit is actually running");
assert.match(auditPipeline, /releaseKeepAwake\(\)/, "the keep-awake request must be released when all audits finish");
assert.match(auditPipeline, /unresolvedScoringEvidenceCount/, "unread scoring evidence must keep the course result provisional");
assert.match(auditPipeline, /activity\.fileVerification = activity\.resource\.fileVerification/, "PDF verification must be copied from nested evidence into the report activity");
assert.match(auditPipeline, /activity\.resource = applyMoodleFileTypeHint\(activity\.resource, activity\)/, "external document links must retain Moodle PDF icon evidence");
assert.match(auditPipeline, /Document existence is sufficient under the approved tolerance/, "document type must remain evidence without blocking the approved existence-based criterion");
assert.match(auditPipeline, /responseTextWithin\(response, 512000\)/, "Moodle redirect parsing must not read an unbounded response body");
assert.match(auditPipeline, /summarizeInspectionTiming\(activities\)/, "the audit must calculate phase totals and bottlenecks without changing evidence order");
assert.match(auditPipeline, /hasUnresolvedEvidence \? "ยังยืนยันหลักฐานบางรายการไม่ได้"/, "a course must never be reported as confirmed while scoring evidence is unresolved");
assert.match(auditPipeline, /source:"title-declared-duration"/, "a strict title duration must be available after link verification when provider metadata is absent");
assert.match(auditPipeline, /\["link_unavailable", "empty_media", "login_required", "access_denied"\]/, "declared title duration must never override empty, missing, login, or access-denied evidence");
assert.match(auditPipeline, /attemptWindowMs = cloudVideoProvider \? 150000 : 90000/, "each slow media attempt must remain bounded while allowing congested cloud Preview pages to finish");
assert.match(auditPipeline, /isGooglePhotos \? 250/, "a loaded Google Photos page must be probed immediately instead of paying the generic slow-provider delay");
assert.match(fs.readFileSync(new URL("../media-metadata.js", import.meta.url), "utf8"), /const evidenceScore = \(item\)/, "multi-frame probing must rank visible/provider duration evidence instead of trusting frame order");
assert.match(auditPipeline, /probeAccessGate/, "a provider-neutral access gate must inspect a visible access wall before player waiting");
assert.match(auditPipeline, /controlDurationSeconds/, "a paused cloud player must use duration already exposed by its controls");
assert.match(auditPipeline, /drive-player-control/, "Drive control duration must be reported as direct player-control evidence");
assert.match(auditPipeline, /sawLoading/, "the missing-file retry must avoid reading the stale pre-reload DOM as a second attempt");
assert.match(auditPipeline, /accessFailureCache/, "a denied link must not repeatedly open in the same audit");
assert.match(auditPipeline, /providerAccessFailureCache/, "a SharePoint or OneDrive access wall must stop later tabs in the same audit");
assert.match(auditPipeline, /providerProbeInFlight/, "concurrent Microsoft-provider links must share the first permission probe");
assert.match(auditPipeline, /access_denied/, "access-denied media must remain distinct from a broken link");
assert.match(auditPipeline, /createInactiveTab\(targetUrl, runId, \(isH5P \|\| isYouTube\) \? 3500 : 2800\)/, "media access gates must avoid the old long initial page wait");
assert.match(auditPipeline, /documentResult\(planFiles, planItems/, "teaching-plan evidence must be separated from supporting-material evidence");
assert.doesNotMatch(popupFlow, /^\s*window\.close\(\)/m, "Popup must not be closed after awaited work because Chrome treats it as an invalid gesture");
const popupMarkup = fs.readFileSync(new URL("../popup.html", import.meta.url), "utf8");
assert.match(popupFlow, /chrome\.runtime\.getURL\("queue\.html"\)/, "the popup's primary action must open the queue workspace");
assert.match(popupFlow, /chrome\.runtime\.getURL\("history\.html"\)/, "the popup must provide direct report-history access");
assert.match(popupFlow, /type:"SCAN_COURSE"/, "the popup must retain read-only structure diagnostics for the current course");
assert.match(popupFlow, /const compactScan/, "raw HTML must be removed before an audit job is stored");
assert.match(popupFlow, /map\(\(\{html, \.\.\.activity\}\) => activity\)/, "compacting a scan must retain fileTypeHint while removing only raw HTML");
assert.doesNotMatch(popupMarkup, /h5pInspect|ตรวจ H5P|YouTube ต้นทาง/, "H5P and YouTube inspection must stay in the background queue rather than appear as a popup action");
assert.doesNotMatch(popupMarkup, /courseType|gnTrack|จำนวนหน่วยกิต|เริ่มตรวจรายวิชานี้/, "queue-owned audit settings must not be duplicated in the popup");
const queuePage = fs.readFileSync(new URL("../queue.js", import.meta.url), "utf8");
assert.match(queuePage, /isCourseUrl\(parsed\.href\)/, "queue must reject URLs that are not course pages on a supported LMS");
assert.match(queuePage, /RUN_AUDIT_QUEUE/, "queue must start the serial audit runner");
assert.ok(queuePage.indexOf("chrome.permissions.request") < queuePage.indexOf('chrome.runtime.sendMessage({type:"RUN_AUDIT_QUEUE"'), "provider permissions must be granted from the queue before its background runner starts");
assert.match(queuePage, /auditProgress/, "queue must display live audit progress");
assert.match(queuePage, /data-retry/, "queue must offer retry for paused or failed courses");
assert.match(queuePage, /กำลังตรวจมาแล้ว/, "queue must show a live elapsed duration for the active course");
assert.match(queuePage, /ใช้เวลาตรวจ/, "completed queue entries must retain their elapsed duration");
assert.match(queuePage, /attemptElapsedMs/, "queue display must use the current audit attempt rather than stale accumulated time");
assert.match(queuePage, /estimateRemaining/, "queue must show a live ETA once enough items have completed");
assert.match(queuePage, /เป้าหมายไม่เกิน 28:00/, "queue must disclose the course completion target");
const reportPage = fs.readFileSync(new URL("../report.js", import.meta.url), "utf8");
assert.match(reportPage, /คำนวณคะแนนชั่วคราวแล้ว/, "partially mapped courses must still show their confirmed provisional score");
assert.match(reportPage, /ลิงก์\/ไฟล์เอกสาร PDF/, "the simplified PDF group must be visible in the evidence type column");
assert.match(reportPage, /ยืนยันว่าเป็น PDF จากไอคอนชนิดไฟล์ของ Moodle/, "the report must show the source of PDF confirmation");
assert.match(reportPage, /สรุปผลการตรวจสอบรายวิชา_ประเภท/, "exports must use the requested course-summary filename");
assert.match(reportPage, /queueElapsedMs/, "report must display the elapsed duration recorded for the audit attempt");
assert.match(reportPage, /ระยะเวลารอบตรวจล่าสุด/, "report duration must be labeled as the current audit attempt");
assert.match(reportPage, /inspectionGoalStatus\(data\.timing, score\)/, "the report must evaluate timing and score confirmation together");
assert.match(reportPage, /แกะปลายทางลิงก์ \(งานสะสม\)/, "the report must split cumulative work by inspection phase");
assert.match(reportPage, /รายการที่ใช้เวลานานที่สุด/, "the report must expose the actual bottleneck items for the next live tuning pass");
assert.match(reportPage, /ไฟล์ใน Moodle/, "confirmed internal Moodle files must not be shown as unresolved destinations");
assert.match(reportPage, /ข้ามเปิดลิงก์/, "reports must disclose how many recordings were fast-skipped");
assert.match(reportPage, /ภาพคำสั่งกิจกรรม|กิจกรรมท้ายบท \/ Assignment/, "reports must retain image-assignment evidence and its OCR result");
assert.match(reportPage, /ตารางที่ 4 — ความครอบคลุมสื่อตลอด 15 ครั้ง/, "GN reports must display the 15-session theory/practical coverage result");
assert.match(reportPage, /instructor-decision/, "the reviewer must be able to make a final instructor-evidence decision");
assert.match(reportPage, /ไม่มีหรือไม่ครบ — ไม่ผ่าน/, "missing instructor information must be a final failure rather than pending review");
assert.match(reportPage, /รายการที่ยังจับคู่ครั้งเรียนไม่ได้/, "unmapped activities must remain visible in the report");
assert.match(reportPage, /ตรวจสอบการแบ่งครั้งเรียน/, "reports must show the complete source-box to session mapping before final scoring");
assert.match(reportPage, /SAVE_SESSION_MAPPING/, "reviewers must be able to correct all session mappings and recalculate the report");
assert.match(reportPage, /ระงับการสรุปคะแนน/, "ambiguous topology must hide the numeric score until the mapping is confirmed");
assert.match(reportPage, /ซ้ำ \(ไม่นับเวลา\)/, "duplicate media must be disclosed in the evidence table");
assert.match(reportPage, /item\.mappingIssue/, "out-of-range sessions must show their precise mapping reason");
assert.match(reportPage, /URL ไม่มีป้าย/, "reports must disclose generic URLs that were intentionally not opened or counted");
assert.match(reportPage, /ข้อมูลเพิ่มเติม \(ไม่นับ\)/, "reports must disclose supplementary media that were intentionally not opened or counted");
const themePage = fs.readFileSync(new URL("../theme.js", import.meta.url), "utf8");
assert.match(themePage, /auditTheme/, "theme preference must persist in extension storage");
assert.match(themePage, /prefers-color-scheme/, "system theme must be supported");
const contentScanner = fs.readFileSync(new URL("../content.js", import.meta.url), "utf8");
assert.match(contentScanner, /!closest\.sectionHasActivities/, "only a label-only sibling Section may provide cross-wrapper context; a real earlier teaching Section must never leak its category");
assert.match(contentScanner, /groupContextSource/, "scanner must retain whether an assessment label is local or inherited so stale labels cannot award Pre/Post points");
assert.match(contentScanner, /auditableActivityCount/, "empty-course detection must count rubric-relevant activities instead of technical links");
assert.match(contentScanner, /isAuditableSection/, "scanner must reject navigation outside teaching sections");
assert.match(contentScanner, /administrativeAnchor/, "Moodle editing controls must be excluded from the audit");
assert.doesNotMatch(contentScanner, /\.editing, \[data-action\]/, "ordinary Moodle activities with data-action must not be discarded as admin controls");
assert.match(contentScanner, /Never fall back to document\.body/, "scanner must not scan Moodle navigation as course content");
assert.match(contentScanner, /section\|lecture\)\\s\*\\d\+/, "SECTION and Lecture containers must remain eligible even when their heading has no Week number");
assert.match(contentScanner, /collectEntireCourse/, "scanner must traverse the whole course instead of inspecting one viewport");
assert.match(contentScanner, /moodleFileTypeEvidence/, "scanner must capture Moodle resource MIME icon evidence");
assert.match(contentScanner, /DLearningFileEvidence/, "scanner must use the tested MIME icon detector");
assert.match(contentScanner, /closest\("li\[id\^='module-'\]/, "nested activity titles must normalize to the outer Moodle module row that contains the MIME icon");
assert.match(auditPipeline, /sectionTopology/, "audits must choose a course topology before scoring weekly checklist items");
assert.match(auditPipeline, /expectedSessions:topology.expectedSessions/, "coverage must retain the fixed 15-session rubric boundary");
const topologySource = fs.readFileSync(new URL("../section-mapping.js", import.meta.url), "utf8");
assert.match(topologySource, /zero_based_first_session/, "Section 0 may be the complete first checklist session");
assert.match(topologySource, /section_zero_intro/, "Section 0 may instead be an introductory container attached to session 1");
assert.match(topologySource, /ไม่นับเป็นครั้งที่ 16/, "excess Moodle containers must not create a fabricated week 16");
assert.match(contentScanner, /reachedEnd/, "scanner must report whether it really reached the bottom");
assert.match(contentScanner, /structurallyComplete/, "scanner must distinguish reaching the page bottom from seeing usable course structure");
assert.match(contentScanner, /sectionSelector/, "scanner must read generic Moodle section containers, including non-Thai headings");
assert.match(contentScanner, /destination\.pathname === location\.pathname/, "scanner must ignore accordion anchors within the current course page");
assert.match(contentScanner, /scanMode:"dom_first"/, "scanner must prefer the already-materialized DOM before scrolling");
assert.match(contentScanner, /A Label may contain both its category text and the external links/, "links embedded in a text Label must retain its local category");
assert.match(contentScanner, /owningModule && primaryAnchor\(owningModule\)/, "provider links nested inside an existing Moodle module must not become duplicate activities");
assert.match(auditPipeline, /collapseDuplicateDestinationItems\(activities\)/, "all resolved same-session destination copies must have a defensive deduplication pass");
assert.match(auditPipeline, /"post_quiz", "assignment", "supplementary", "h5p"/, "assignment and supplementary URL activities must be resolved so their duplicate destinations can be identified");
assert.match(contentScanner, /collectAssignmentImageEvidence/, "only activity-labelled instruction images may enter the OCR path");
assert.match(contentScanner, /collectInstructorEvidence/, "the report must receive compact instructor evidence for manual confirmation");
assert.match(auditPipeline, /Array\.from\(\{length:rule\.expectedSessions\}/, "the evaluator must emit all 15 rubric sessions even when a course week is empty");
const productionFixture = JSON.parse(fs.readFileSync(new URL("./fixtures/lsm36767-structure.json", import.meta.url), "utf8"));
const productionActivities = productionFixture.activities.map((item) => ({...item, kind:classifyActivity(item)}));
const productionTopology = sectionTopology(productionActivities, RULES.GS.expectedSessions);
assert.equal(productionFixture.activities.length, 266, "the retained real-course fixture must stay complete");
assert.equal(productionTopology.mode, "explicit_session_headings", "the real 15-week course must use its explicit Thai week headings");
assert.equal(productionTopology.confidence, "high", "the real course's 15 explicit teaching headings must remain high confidence");
assert.equal(productionActivities.filter((item) => item.kind !== "forum" && !canonicalWeek(item, productionTopology.mapping)).length, 0, "every auditable item in the real course fixture must map to a session");
assert.equal(productionActivities.filter((item) => item.kind === "video_candidate").length, 0, "strongly named real-course videos must not be lost as ambiguous candidates");
assert.equal(productionActivities.filter((item) => item.kind === "video").length, 111, "a clearly named lesson video must survive a misplaced activity label");
assert.equal(productionActivities.filter((item) => item.kind === "activity_video").length, 5, "case-study links with explicit watch-and-answer instructions must remain excluded");
assert.equal(productionActivities.filter((item) => item.kind === "recording").length, 11, "the real fixture's Live Records must remain excluded");
assert.equal(productionActivities.filter((item) => ["file","file_link"].includes(item.kind) && item.fileTypeHint === "pdf").length, 38, "Moodle PDF icon evidence must survive the real scan pipeline");

const coldChainWeek = [
  {sectionId:"week-5", title:"เอกสารประกอบการสอน File", href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=1"},
  {sectionId:"week-5", title:"การขนส่งและการกระจายสินค้าแบบควบคุมอุณหภูมิ URL", href:"https://dlearning.spu.ac.th/mod/url/view.php?id=2"},
  {sectionId:"week-5", title:"Live Record Guest Speaker Farm Manager URL", href:"https://dlearning.spu.ac.th/mod/url/view.php?id=3"},
  {sectionId:"week-5", title:"Podcast-สัปดาห์ที่ 5 การจัดการ Cold chain URL", href:"https://dlearning.spu.ac.th/mod/url/view.php?id=4"}
].map((item) => {
  const classification = classifyActivityWithEvidence(item);
  return {...item, kind:classification.kind, classification};
});
promoteSectionLessonCandidates(coldChainWeek);
assert.equal(coldChainWeek.find((item) => /การขนส่งและการกระจาย/.test(item.title)).kind,"video_candidate","the sole topic URL beside a document and Podcast must enter media inspection");
assert.equal(coldChainWeek.find((item) => /Live Record/.test(item.title)).kind,"recording","a Live Record remains excluded when the topic URL is promoted");
const supportWeek = [
  {sectionId:"support", title:"เอกสารประกอบการสอน File", href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=5"},
  {sectionId:"support", title:"แหล่งข้อมูลเพิ่มเติม URL", href:"https://dlearning.spu.ac.th/mod/url/view.php?id=6"},
  {sectionId:"support", title:"Podcast Week 2 URL", href:"https://dlearning.spu.ac.th/mod/url/view.php?id=7"}
].map((item) => { const classification=classifyActivityWithEvidence(item); return {...item,kind:classification.kind,classification}; });
promoteSectionLessonCandidates(supportWeek);
assert.equal(supportWeek.find((item) => /แหล่งข้อมูล/.test(item.title)).kind,"supplementary","a generic supplementary URL must not be promoted as teaching media");
for (let session = 1; session <= RULES.GS.expectedSessions; session += 1) {
  const items = productionActivities.filter((item) => canonicalWeek(item, productionTopology.mapping) === session);
  const planPdfs = items.filter((item) => ["file","file_link"].includes(item.kind) && item.fileTypeHint === "pdf" && isTeachingPlanFile(item));
  const materialPdfs = items.filter((item) => ["file","file_link"].includes(item.kind) && item.fileTypeHint === "pdf" && !isTeachingPlanFile(item));
  assert.ok(planPdfs.length >= 1, `real session ${session} must expose at least one confirmed plan PDF to scoring`);
  assert.ok(materialPdfs.length >= 1, `real session ${session} must expose at least one confirmed supporting PDF to scoring`);
}
const drawingFixture = "C:/Users/Administrator/Downloads/dlearning-structure-scan (2).json";
if (fs.existsSync(drawingFixture)) {
  const drawingScan = JSON.parse(fs.readFileSync(drawingFixture, "utf8"));
  const drawingMapping = sectionWeekMapping(drawingScan.activities);
  const drawingWeeks = groupedByWeek(drawingScan.activities, drawingMapping);
  assert.equal(drawingWeeks["ครั้งที่ 1"].filter((item) => /\/mod\/assign\//.test(item.href)).length, 1, "Week 1 must not absorb Assignments from later sections with a subtopic ครั้งที่ 1");
  assert.equal(drawingWeeks["ครั้งที่ 7"].filter((item) => /\/mod\/assign\//.test(item.href)).length, 2, "Section 8 assignments must remain in Week 7");
  assert.equal(drawingWeeks["ครั้งที่ 8"].filter((item) => /\/mod\/assign\//.test(item.href)).length, 2, "Section 9 assignments must remain in Week 8");
}
const esportsFixture = "C:/Users/Administrator/Downloads/dlearning-structure-scan (4).json";
if (fs.existsSync(esportsFixture)) {
  const esportsScan = JSON.parse(fs.readFileSync(esportsFixture, "utf8"));
  const esportsActivities = esportsScan.activities.map((item) => ({ ...item, kind: classifyActivity(item) }));
  const esportsWeeks = groupedByWeek(esportsActivities, sectionWeekMapping(esportsActivities));
  assert.equal(esportsWeeks["ครั้งที่ 14"].length, 8, "a reordered Thai week marker must not make Week 14 disappear");
  assert.equal(esportsActivities.filter((item) => item.kind === "podcast" && /\/mod\/resource\/view\.php/.test(item.href)).length, 14, "uploaded Podcasts must stay distinguishable from PDF resources");
}
const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
assert.ok(manifest.permissions.includes("power"), "system sleep prevention requires the narrowly scoped Chrome power permission");
for (const origin of MEDIA_PROVIDER_ORIGINS) assert.ok(manifest.optional_host_permissions.includes(origin), `manifest must declare ${origin}`);
assert.ok(manifest.content_scripts[0].js.includes("ocr-content.js"), "the local OCR reader must load with the Moodle scanner");
assert.ok(manifest.content_scripts[0].js.indexOf("file-evidence.js") < manifest.content_scripts[0].js.indexOf("content.js"), "Moodle MIME icon detection must load before the course scanner");
assert.ok(manifest.web_accessible_resources[0].resources.includes("vendor/lang/tha.traineddata"), "the Thai OCR model must be packaged locally");
assert.deepEqual(providerOriginsForUrl("https://docs.google.com/forms/d/e/example/viewform"), ["https://docs.google.com/*"], "Google Forms permission must route to its actual host");
assert.deepEqual(providerOriginsForUrl("https://spulive-my.sharepoint.com/:v:/g/example"), ["https://spulive-my.sharepoint.com/*"], "SharePoint permission must route to its actual host");
assert.deepEqual(providerOriginsForUrl("https://1drv.ms/v/s/example"), ["https://1drv.ms/*", "https://onedrive.live.com/*", "https://*.sharepoint.com/*"], "OneDrive short links must request their redirect destinations");
assert.deepEqual(providerOriginsForUrl("https://tenant.sharepoint.com/:v:/s/example"), ["https://*.sharepoint.com/*"], "tenant SharePoint links must be supported");
assert.deepEqual(providerOriginsForUrl("https://vt.tiktok.com/ZSExample/"), ["https://www.tiktok.com/*", "https://m.tiktok.com/*", "https://vm.tiktok.com/*", "https://vt.tiktok.com/*"], "TikTok short links must request their possible redirect hosts");
assert.deepEqual(providerOriginsForUrl("https://canva.link/example"), ["https://canva.link/*", "https://canva.com/*", "https://www.canva.com/*"], "Canva short links must request both redirector and editor destinations");
assert.deepEqual(providerOriginsForUrl("https://gamma.app/docs/example"), ["https://gamma.app/*", "https://*.gamma.app/*"], "Gamma presentation links must be supported");
assert.equal(classifyActivity({title:"แบบทดสอบทบทวนการประมวลความรู้กลางภาค",groupContext:"Post-test.png",groupContextSource:"visual_assessment_label",href:"https://dlearning.spu.ac.th/mod/quiz/view.php?id=220"}),"post_quiz","an explicit Post-test image must override a generic adjacent text label");
assert.equal(classifyActivity({title:"แบบทดสอบอัตนัยครั้งที่ 8 งานครั้งที่ 7 ฟาราเดย์ File",groupContext:"Post-test.png",groupContextSource:"visual_assessment_label",fileTypeHint:"pdf",href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=221"}),"post_quiz","a question PDF below an explicit Post-test label must count as Post-test");
assert.equal(classifyActivity({title:"เอกสารประกอบการสอนครั้งที่ 2 : ทบทวนพื้นฐานก่อนเรียนฟิสิกส์ 2 File",groupContext:"Pre-test",groupContextSource:"adjacent_label",fileTypeHint:"pdf",href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=222"}),"file","a teaching document must not become Pre-test from nearby instruction text");
assert.equal(classifyActivity({title:"เอกสารประกอบการสอนครั้งที่ 2 (2): เฉลยแนวทางตอบแบบทดสอบครั้งที่ 1 อัตนัย File",groupContext:"Pre-test",groupContextSource:"adjacent_label",fileTypeHint:"pdf",href:"https://dlearning.spu.ac.th/mod/resource/view.php?id=223"}),"file","an answer key must never count as the learner Pre-test");
console.log("classifier tests passed");

