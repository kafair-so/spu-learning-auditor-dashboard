import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyActivity } from "../classifier.js";
import { weekOrder } from "../section-mapping.js";
import { declaredDurationFromTitle, durationHintFromTitle, isPodcastLike, isAiTutorLike } from "../rules.js";
import { usableExternalTarget } from "../external-target.js";
import { browserLanguage, translateThai } from "../i18n.js";

const activity = (title, href = "https://ilearning.spu.ac.th/mod/url/view.php?id=1", groupContext = "") => ({title, href, groupContext});

assert.equal(classifyActivity(activity("第2回 事前テスト", "https://ilearning.spu.ac.th/mod/quiz/view.php?id=1")), "pre_quiz");
assert.equal(classifyActivity(activity("第2周 课后测验", "https://ilearning.spu.ac.th/mod/quiz/view.php?id=2")), "post_quiz");
assert.equal(classifyActivity(activity("授業動画：観光地を紹介する作文")), "video");
assert.equal(classifyActivity(activity("教学视频：课程介绍")), "video");
assert.equal(classifyActivity(activity("課題：作文を提出してください", "https://ilearning.spu.ac.th/mod/assign/view.php?id=3")), "assignment");
assert.equal(isPodcastLike("第3講 ポッドキャスト"), true);
assert.equal(isPodcastLike("第3周 播客"), true);
assert.equal(isAiTutorLike("AI チューター"), true);
assert.equal(isAiTutorLike("AI 助教"), true);
assert.equal(isAiTutorLike("SPU Ai ChatBot SDM241 การออกแบบตัวละครเบื้องต้น"), true);
assert.equal(classifyActivity(activity("SPU Ai ChatBot SDM241 การออกแบบตัวละครเบื้องต้น")), "ai_tutor");
assert.equal(isAiTutorLike("AI SPU AI Platform CPE122"), true);
assert.equal(classifyActivity(activity("AI SPU AI Platform CPE122")), "ai_tutor");
assert.equal(weekOrder("第十五回 日本語作文"), 15);
assert.equal(weekOrder("第12周 中文阅读"), 12);
assert.equal(weekOrder("第３講 観光"), 3);
assert.equal(declaredDurationFromTitle("講義動画 (12分)"), 720);
assert.equal(durationHintFromTitle("教学视频（2小时 5分钟）"), 7500);

const destination = "https://line.me/R/ti/g/example";
assert.equal(usableExternalTarget(`https://l.facebook.com/l.php?u=${encodeURIComponent(destination)}&h=tracking`), destination);
assert.equal(usableExternalTarget("https://www.facebook.com/example"), null);

assert.equal(browserLanguage("zh-TW"), "zh-CN");
assert.equal(browserLanguage("ja-JP"), "ja");
assert.equal(translateThai("เปิดคิวตรวจรายวิชา", "zh-CN"), "打开课程审核队列");
assert.equal(translateThai("เปิดคิวตรวจรายวิชา", "ja"), "コース監査キューを開く");
assert.equal(translateThai("เพิ่มลิงก์ภายนอกสำหรับ AI Tutor ต้องแก้ไข: ครั้งที่ 1–15", "en"), "Add an external AI Tutor link. Fix required: Session 1–15");
assert.equal(translateThai("เพิ่มลิงก์ภายนอกสำหรับ AI Tutor ต้องแก้ไข: ครั้งที่ 1–15", "zh-CN"), "添加 AI Tutor 外部链接。需要修改：第1–15次");
assert.equal(translateThai("เพิ่มลิงก์ภายนอกสำหรับ AI Tutor ต้องแก้ไข: ครั้งที่ 1–15", "ja"), "AI Tutor の外部リンクを追加してください。要修正：第1–15回");
assert.equal(translateThai("SDM241 การออกแบบตัวละครเบื้องต้น", "en"), "SDM241 การออกแบบตัวละครเบื้องต้น", "course-authored evidence must remain in its original language");

const manifest = JSON.parse(fs.readFileSync(new URL("../manifest.json", import.meta.url)));
assert.equal(manifest.version, "0.13.28");
for (const language of ["tha", "eng", "jpn", "chi_sim", "chi_tra"]) {
  assert.ok(manifest.web_accessible_resources[0].resources.includes(`vendor/lang/${language}.traineddata`));
  assert.ok(fs.statSync(new URL(`../vendor/lang/${language}.traineddata`, import.meta.url)).size > 100_000);
}
const externalTargets = fs.readFileSync(new URL("../external-target.js", import.meta.url), "utf8");
assert.match(externalTargets, /\["l\.facebook\.com", "lm\.facebook\.com"\]/);
assert.match(externalTargets, /parsed\.pathname === "\/l\.php"/);
const content = fs.readFileSync(new URL("../content.js", import.meta.url), "utf8");
assert.match(content, /collectEmbeddedPodcastEvidence/);
assert.match(content, /podcast_internal_media/);
const i18nSource = fs.readFileSync(new URL("../i18n.js", import.meta.url), "utf8");
assert.match(i18nSource, /class="language-icon" aria-hidden="true">🌐</);
assert.doesNotMatch(i18nSource, /aria-hidden="true">文</);

console.log("multilingual and Facebook redirect tests passed");


