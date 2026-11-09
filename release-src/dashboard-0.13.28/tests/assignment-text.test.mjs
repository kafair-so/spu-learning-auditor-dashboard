import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {classifyActivity} from "../classifier.js";

const context={};vm.runInNewContext(fs.readFileSync(new URL("../assignment-text.js",import.meta.url),"utf8"),context);
const evidence=context.DLearningAssignmentText.assignmentTextEvidence;
const taskEvidence=context.DLearningAssignmentText.assessmentTaskEvidence;
const assessment=context.DLearningAssignmentText.assessmentTextKind;
const segments=context.DLearningAssignmentText.assessmentTextSegments;
const inferPairs=context.DLearningAssignmentText.inferAssessmentPairs;
const brief="ให้เข้า Facebook วิทยาลัยโลจิสติกส์และซัพพลายเชน ชมวิดีโอย้อนหลัง Sripatum Supply Chain Roundtable#36 แล้วแสดงความคิดเห็น พร้อมกด Like กด Share ครับ";
assert.equal(evidence(brief,"กิจกรรม ท้ายบทเรียน"),true);
assert.equal(evidence("กิจกรรม ท้ายบทเรียน","กิจกรรม ท้ายบทเรียน"),false,"the category pill alone is not a task");
assert.equal(evidence("ให้นักศึกษาเตรียมพร้อมพริ้นท์หรือสแกนเอกสาร WORKSHEET ที่ให้เพื่อใช้ในการเรียนแต่ละครั้ง และศึกษารายละเอียดเนื้อหาวิชา เพื่อใช้ในการเรียนครั้งต่อไป","กิจกรรม ท้ายบทเรียน"),true,"a concrete print/scan worksheet instruction must count as the end activity");
assert.equal(evidence("เอกสาร WORKSHEET สำหรับประกอบการเรียนครั้งต่อไป","กิจกรรม ท้ายบทเรียน"),false,"a worksheet mention without an instruction must not count");
assert.equal(evidence("ให้เข้า Facebook ชมวิดีโอย้อนหลัง แล้วแสดงความคิดเห็น พร้อมกด Like กด Share","เนื้อหาบทเรียน"),false,"an instruction outside the activity group must not be promoted");
assert.equal(evidence("ให้ทำ Quiz ก่อนเรียนและตอบแบบทดสอบให้ครบทุกข้อ","กิจกรรม ท้ายบทเรียน"),false,"a Moodle Quiz instruction must not become an Assignment");
const igd342AfterClass="AFTER CLASS ACTIVITY นักศึกษาสมัครการใช้งาน TikTok และลงทะเบียนสมัครการใช้งานโปรแกรม Effect House เพื่อเตรียมการเรียนรู้ในสัปดาห์ถัดไปให้เรียบร้อย";
assert.equal(evidence(igd342AfterClass,"AFTER CLASS ACTIVITY"),true,"course 19723 signup/register instruction must count as an after-class activity");
const afterClassImageInstruction="AFTER CLASS ACTIVITY ให้นักศึกษาสมัครการใช้งาน TikTok และลงทะเบียน สมัครการใช้งานโปรแกรม Effect House เพื่อเตรียมการเรียนรู้ในสัปดาห์ถัดไป ให้เรียบร้อย";
assert.equal(evidence(afterClassImageInstruction,"AFTER CLASS ACTIVITY"),true,"an image-only AFTER CLASS ACTIVITY heading plus its adjacent instruction must count as an after-class activity");
assert.equal(evidence("AFTER CLASS ACTIVITY","AFTER CLASS ACTIVITY"),false,"an English after-class heading alone must not count");
assert.equal(evidence("นักศึกษาอ่านข้อมูลเกี่ยวกับ Effect House เพื่อเตรียมเรียนสัปดาห์ถัดไป","AFTER CLASS ACTIVITY"),false,"preparation text without a concrete learner action must not count");
assert.equal(evidence("Questions and Answers","AFTER CLASS ACTIVITY"),false,"a Q&A label alone must not create a duplicate activity");
const item={title:"คำสั่งกิจกรรมท้ายบทใน Moodle",text:brief,groupContext:"กิจกรรม ท้ายบทเรียน",href:"https://dlearning.spu.ac.th/course/view.php?id=1#module-42",evidenceType:"assignment_text"};
assert.equal(classifyActivity(item),"assignment");
const preBrief="แบบฝึกหัดก่อนเรียน ให้แสดงวิธีทำในการหาคำตอบ คำนวณค่าความส่องสว่าง แล้ว SAVE FILE แปลงไฟล์เป็น PDF ส่งใน Link https://drive.google.com/drive/folders/example";
const postBrief="แบบฝึกหัดหลังเรียน ให้แสดงวิธีทำในการหาคำตอบ คำนวณค่าความส่องสว่าง แล้ว SAVE FILE แปลงไฟล์เป็น PDF ส่งใน Link https://drive.google.com/drive/folders/example";
assert.equal(assessment(preBrief,"แบบฝึกหัดก่อนเรียน"),"pre_quiz","a complete text task under the Pre label must count as Pre-test");
assert.equal(assessment(postBrief,"แบบฝึกหัดหลังเรียน"),"post_quiz","a complete text task under the Post label must count as Post-test");
assert.equal(assessment("แบบฝึกหัดก่อนเรียน","แบบฝึกหัดก่อนเรียน"),"","a heading alone must not count as an assessment");
assert.equal(assessment("ให้อ่านเอกสารประกอบการสอน","แบบฝึกหัดก่อนเรียน"),"","reading material without a learner response must not count as an assessment");
const noLinkBrief="แบบฝึกหัดก่อนเรียน ให้แสดงวิธีทำและจงอธิบายว่าทำไมจึงมองเห็นวัตถุ (1 คะแนน)";
assert.equal(taskEvidence(noLinkBrief),true,"a real scored question does not require a Drive or submission link");
assert.equal(assessment(noLinkBrief,"แบบฝึกหัดก่อนเรียน"),"pre_quiz","an explicit text Pre-test without a link must still count");
assert.equal(classifyActivity({title:"แบบทดสอบก่อนเรียนแบบข้อความใน Moodle",text:preBrief,assessmentKind:"pre_quiz",evidenceType:"assessment_text",href:"https://dlearning.spu.ac.th/course/view.php?id=1#section-2"}),"pre_quiz");
assert.equal(classifyActivity({title:"แบบทดสอบหลังเรียนแบบข้อความใน Moodle",text:postBrief,assessmentKind:"post_quiz",evidenceType:"assessment_text",href:"https://dlearning.spu.ac.th/course/view.php?id=1#section-2"}),"post_quiz");
assert.equal(assessment("Pre-test นักศึกษาทำกิจกรรม Pretest โดยการตอบคำถามเพื่อฝึกคิดในกิจกรรม Link ที่วางไว้ ถ้าเกิดข้อสงสัยให้สอบถามได้ใน line","Pre-test"),"pre_quiz","PHY212 session 13 text instruction must count as Pre-test");
assert.equal(assessment("Pre-test นักศึกษาทำกิจกรรมตอบคำถามเพื่อทบทวนความรู้ตามความเหมาะสม","Pre-test"),"pre_quiz","an explicit learner action counts without forcing a link, score or separate question file");
const combinedSection=`แบบฝึกหัดก่อนเรียน
ให้แสดงวิธีทำในโจทย์ที่ให้มา SAVE FILE พิมพ์เฉพาะส่วน XXX และให้แปลงไฟล์เป็น PDF ส่งใน Link https://drive.google.com/drive/folders/example
จงอธิบายว่าทำไมจึงทำให้มองเห็นวัตถุ
แบบฝึกหัดหลังเรียน
ให้แสดงวิธีทำในโจทย์ที่ให้มา SAVE FILE พิมพ์เฉพาะส่วน XXX และให้แปลงไฟล์เป็น PDF ส่งใน Link https://drive.google.com/drive/folders/example
จงอธิบายปัจจัยภายนอกที่มีผลต่อการมองเห็น`;
assert.deepEqual(Array.from(segments(combinedSection),item=>item.kind),["pre_quiz","post_quiz"],"one Moodle section containing both text assessments must produce two distinct items");
const imageOnlyCandidates=[
  {id:"module-101",sectionKey:"section-2",order:5,nextId:"module-102",imageFingerprint:"banner-a",text:preBrief},
  {id:"module-102",sectionKey:"section-2",order:6,nextId:"",imageFingerprint:"banner-b",text:postBrief},
  {id:"module-201",sectionKey:"section-3",order:8,nextId:"module-202",imageFingerprint:"banner-a",text:preBrief},
  {id:"module-202",sectionKey:"section-3",order:9,nextId:"",imageFingerprint:"banner-b",text:postBrief},
  {id:"module-301",sectionKey:"section-4",order:9,nextId:"module-302",imageFingerprint:"banner-a",text:"ให้แสดงวิธีทำ จงหาคำตอบ (1 คะแนน)"},
  {id:"module-302",sectionKey:"section-4",order:10,nextId:"",imageFingerprint:"banner-b",text:"ให้แสดงวิธีทำ จงหาคำตอบ (2 คะแนน)"}
];
assert.deepEqual(Array.from(inferPairs(imageOnlyCandidates),item=>`${item.candidate.id}:${item.kind}`),[
  "module-101:pre_quiz","module-102:post_quiz","module-201:pre_quiz","module-202:post_quiz","module-301:pre_quiz","module-302:post_quiz"
],"repeated adjacent image-only Label pairs must be classified consistently across Sections");
assert.equal(inferPairs(imageOnlyCandidates.slice(0,2)).length,0,"one image pair is not enough to guess Pre/Post");
const reversed=[...imageOnlyCandidates.slice(0,4),
  {id:"module-401",sectionKey:"section-4",order:1,nextId:"module-402",imageFingerprint:"banner-b",text:postBrief},
  {id:"module-402",sectionKey:"section-4",order:2,nextId:"",imageFingerprint:"banner-a",text:preBrief},
  {id:"module-501",sectionKey:"section-5",order:1,nextId:"module-502",imageFingerprint:"banner-b",text:postBrief},
  {id:"module-502",sectionKey:"section-5",order:2,nextId:"",imageFingerprint:"banner-a",text:preBrief}
];
assert.equal(inferPairs(reversed).length,0,"equally common reverse image order must stay unclassified");
const contentSource=fs.readFileSync(new URL("../content.js",import.meta.url),"utf8");
assert.match(contentSource,/collectAssignmentTextEvidence\(\)/);
assert.match(contentSource,/for \(const section of physicalBoxes\(\)\)/,"section summaries outside li.activity must be inspected");
assert.match(contentSource,/const sectionSummary = section\.cloneNode\(true\)/,"section-level text assessment recovery must work from an isolated copy");
assert.match(contentSource,/sectionSummary\.querySelectorAll\("li\.activity, li\[id\^='module-'\], \[id\^='module-'\], \.activity"\).*node\.remove/,"Moodle Quiz and Assignment rows must be removed before section text inference");
assert.match(contentSource,/assessmentTextSegments\(summaryText\)/,"only remaining section-summary text may be split at Pre\/Post headings");
assert.match(contentSource,/after\[ -\]\?class/,"the collector must recognise AFTER CLASS ACTIVITY as a local group heading");
assert.match(contentSource,/tiktok\[\\s\\S\]\{0,500\}effect\\s\*house/i,"the image-only IGD342 activity must still be recovered when heading OCR fails");
const collector=contentSource.slice(contentSource.indexOf("const collectAssignmentTextEvidence"),contentSource.indexOf("const collectEmbeddedPodcastEvidence"));
assert.ok(collector.indexOf("localAssessmentGroup || localGroup || bannerText") >= 0,"explicit AFTER CLASS text must take priority over a decorative course banner");
assert.ok(collector.indexOf("assessmentTaskEvidence(instructionText)") < collector.indexOf("if (primaryAnchor(container)) continue"),"a linked Moodle Label must be evaluated before the generic link guard");
assert.match(collector,/moodle_label_image_pair/,"image-only assessment pairs must retain an auditable collection source");
assert.match(collector,/moodle_section_assignment_text/,"AFTER CLASS instructions written directly in a Section must become assignment evidence");
assert.match(collector,/fullSectionText\.match\(\/กิจกรรม/,"Section-level assignment recovery must search the complete visible Section text");
const igd342Section=`AFTER CLASS ACTIVITY นักศึกษาสมัครการใช้งาน TikTok และลงทะเบียน สมัครการใช้งานโปรแกรม Effect House เพื่อเตรียมการเรียนรู้ในสัปดาห์ถัดไปให้เรียบร้อย [3] TikTok : Introduction Questions and Answers ถามตอบ หัวข้อเรียนครั้งนี้`;
assert.equal(evidence(igd342Section.split("Questions and Answers")[0],"AFTER CLASS ACTIVITY"),true,"the exact IGD342 Section instruction must count before the following Q&A block");
console.log("assignment text tests passed");

