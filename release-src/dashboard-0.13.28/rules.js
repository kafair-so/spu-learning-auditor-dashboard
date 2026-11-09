// One source of truth for the rubric. The scanner, evaluator and report all
// retain these values in the finished audit so a later UI change cannot drift
// away from the rule that produced the result.
export const RULES = Object.freeze({
  GN: Object.freeze({
    label: "GN",
    expectedSessions: 15,
    firstSessionMinutesPerCredit: 15,
    minutesPerCredit: 15,
    podcastMinutes: 10,
    videoGrade: "B",
    toleranceMinutes: 9,
    scoringMode: "gn_checklist",
    coverage: Object.freeze({ theory: 15, practical: 7 })
  }),
  GR: Object.freeze({
    label: "GR",
    expectedSessions: 15,
    firstSessionMinutesPerCredit: 15,
    minutesPerCredit: 30,
    podcastMinutes: 10,
    videoGrade: "B+",
    toleranceMinutes: 9,
    scoringMode: "grgs_110",
    automaticMax: 105,
    manualMax: 5,
    passScore: 80
  }),
  GS: Object.freeze({
    label: "GS",
    expectedSessions: 15,
    firstSessionMinutesPerCredit: 15,
    minutesPerCredit: 30,
    podcastMinutes: 10,
    videoGrade: "B+",
    toleranceMinutes: 9,
    scoringMode: "grgs_110",
    automaticMax: 105,
    manualMax: 5,
    passScore: 80
  })
});

export function normalizeGnTrack(value) {
  return value === "practical" ? "practical" : "theory";
}

export function gnRequiredMediaSessions(value) {
  return RULES.GN.coverage[normalizeGnTrack(value)];
}

export const DEFINITIVE_MEDIA_FAILURES = Object.freeze(new Set(["access_denied", "login_required", "link_unavailable", "link_error", "reviewer_confirmed_unreadable"]));

export function countedVideoSeconds(items) {
  return items.filter((item) => item.countingEligible !== false
    && !DEFINITIVE_MEDIA_FAILURES.has(item.mediaStatus)
    && (!item.mediaReviewRequired || item.mediaReviewDecision === "use"))
    .reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
}

export function mediaTimeResult(items, knownSeconds, requiredSeconds, toleranceMinutes) {
  // Once verified, eligible clips meet the time requirement, a broken or
  // inaccessible extra link remains an issue to report but cannot veto them.
  const verifiedStatus = timeStatus(countedVideoSeconds(items), requiredSeconds, toleranceMinutes);
  if (verifiedStatus === "pass" || verifiedStatus === "pass_tolerance") return verifiedStatus;
  if (items.some((item) => item.mediaReviewRequired && item.mediaReviewDecision !== "use")) return "needs_review";
  if (items.some((item) => DEFINITIVE_MEDIA_FAILURES.has(item.mediaStatus) && !item.durationSeconds)) return "needs_review";
  if (items.some((item) => !item.durationSeconds)) return "needs_review";
  return timeStatus(knownSeconds, requiredSeconds, toleranceMinutes);
}

export function podcastTimeResult(items, knownSeconds, requiredSeconds) {
  if (!items.length) return "fail";
  if (items.some((item) => DEFINITIVE_MEDIA_FAILURES.has(item.mediaStatus))) return "fail";
  if (items.some((item) => !item.durationSeconds)) return "needs_review";
  return knownSeconds >= requiredSeconds ? "pass" : "fail";
}

export function podcastComplianceResult(items, requiredSeconds) {
  if (!items.length) return "fail";
  // Only confirmed audio contributes to Podcast time. A video (or a broken
  // alternative) remains visible as evidence but must not veto valid audio in
  // the same session or make one logical criterion look like two failures.
  const confirmedAudioSeconds = items
    .filter((item) => item.mediaType === "audio" && item.durationSeconds && item.reviewerDurationConfirmed)
    .reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
  if (confirmedAudioSeconds >= requiredSeconds) return "pass";
  const unresolvedEvidence = items.some((item) =>
    item.mediaType === "audio"
      ? !item.durationSeconds || !item.reviewerDurationConfirmed
      : item.mediaType !== "video" && !DEFINITIVE_MEDIA_FAILURES.has(item.mediaStatus)
  );
  return unresolvedEvidence ? "needs_review" : "fail";
}

export function gnCoverageResult(weeks, track) {
  const requiredSessions = gnRequiredMediaSessions(track);
  const evaluated = Array.from({ length: RULES.GN.expectedSessions }, (_, index) => {
    const session = index + 1;
    const week = weeks.find((item) => Number(String(item.section || "").match(/\d+/)?.[0]) === session);
    const videoStatus = week?.checklist?.[session === 1 ? 2 : 2]?.status || "fail";
    const podcastStatus = week?.checklist?.[session === 1 ? 3 : 3]?.status || "fail";
    const videoPass = videoStatus === "pass" || videoStatus === "pass_tolerance";
    const podcastPass = podcastStatus === "pass" || podcastStatus === "pass_tolerance";
    return { session, videoStatus, podcastStatus, videoPass, podcastPass, complete:videoPass && podcastPass };
  });
  const videoSessions = evaluated.filter((item) => item.videoPass).length;
  const podcastSessions = evaluated.filter((item) => item.podcastPass).length;
  const completeSessions = evaluated.filter((item) => item.complete).length;
  const reviewSessions = evaluated.filter((item) => item.videoStatus === "needs_review" || item.podcastStatus === "needs_review").map((item) => item.session);
  const status = completeSessions >= requiredSessions ? "pass" : reviewSessions.length && completeSessions + reviewSessions.length >= requiredSessions ? "needs_review" : "fail";
  return { track:normalizeGnTrack(track), expectedSessions:RULES.GN.expectedSessions, requiredSessions, videoSessions, podcastSessions, completeSessions, reviewSessions, status };
}

export function canonicalMediaTarget(value) {
  try {
    const url = new URL(String(value || ""));
    const rawHost = url.hostname.toLowerCase().replace(/^www\./, "");
    // Google has used both hostnames for NotebookLM shares. They identify the
    // same service and must not create a second evidence row after redirect.
    const host = /^(?:notebook|notebooklm)\.google\.com$/.test(rawHost) ? "notebooklm.google.com" : rawHost;
    const path = url.pathname.replace(/\/+$/, "");
    const driveId = path.match(/\/file\/d\/([^/]+)/i)?.[1] || (host === "drive.google.com" ? url.searchParams.get("id") : null);
    if (driveId) return `drive:${driveId}`;
    const youtubeId = host === "youtu.be" ? path.slice(1) : /youtube(?:-nocookie)?\.com$/.test(host) ? (url.searchParams.get("v") || path.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1]) : null;
    if (youtubeId) return `youtube:${youtubeId}`;
    // These parameters describe the viewer/account/locale, not the resource.
    // Keep all unknown parameters so two genuinely different course artifacts
    // are never merged merely because they share a provider.
    const ignored = /^(?:utm_.+|fbclid|gclid|si|feature|usp|authuser|pli|hl|locale|sw|bypassreason|web|download|action|mobileredirect|ct|or|ga|e)$/i;
    const query = [...url.searchParams.entries()].filter(([key]) => !ignored.test(key)).sort(([a],[b]) => a.localeCompare(b));
    const search = query.length ? `?${new URLSearchParams(query)}` : "";
    return `${url.protocol}//${host}${path}${search}`;
  } catch {
    return String(value || "").trim();
  }
}

// Title duration is classification evidence only. Scoring continues to use
// duration read from the actual player so an incorrect label cannot add time.
export function durationHintFromTitle(value) {
  const text = String(value || "");
  const clockMatch = text.match(/\(\s*(\d{1,3})\s*[:.]\s*([0-5]\d)\s*(?:นาที|min(?:ute)?s?|分钟|分鐘|分)?\s*\)/i);
  if (clockMatch) return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:ชั่วโมง|hours?|hrs?|小时|小時|時間)/i);
  const minutes = text.match(/(\d+(?:\.\d+)?)\s*(?:นาที|minutes?|mins?|分钟|分鐘|分)/i);
  if (hours || minutes) return Math.round((Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)) * 60);
  return null;
}

// A duration can be used as scoring evidence only when the course author put
// an exact, parenthesised value in the activity title. Loose mentions such as
// "ประมาณ 10 นาที" remain classification hints and are never counted.
export function declaredDurationFromTitle(value) {
  const text = String(value || "");
  for (const match of text.matchAll(/\(([^()]*)\)/g)) {
    const part = String(match[1] || "").trim();
    if (!part || /ประมาณ|ราว|อย่างน้อย|มากกว่า|น้อยกว่า|approx|about|大约|約|およそ|約|~|±/i.test(part)) continue;
    const clockMatch = part.match(/^(\d{1,3})\s*[:.]\s*([0-5]\d)\s*(?:นาที|min(?:ute)?s?|分钟|分鐘|分)?$/i);
    if (clockMatch) return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);
    // A recurring Moodle authoring typo is m:0ss (for example 8:017).
    // Accept only the redundant leading zero form; arbitrary 3-digit seconds
    // remain invalid and must be resolved from provider metadata/player.
    const paddedClockMatch = part.match(/^(\d{1,3})\s*[:.]\s*0([0-5]\d)\s*(?:นาที|min(?:ute)?s?)?$/i);
    if (paddedClockMatch) return Number(paddedClockMatch[1]) * 60 + Number(paddedClockMatch[2]);
    const minutesOnly = part.match(/^(\d+(?:\.\d+)?)\s*(?:นาที|minutes?|mins?|分钟|分鐘|分)$/i);
    if (minutesOnly) return Math.round(Number(minutesOnly[1]) * 60);
    const hoursMinutes = part.match(/^(\d+(?:\.\d+)?)\s*(?:ชั่วโมง|hours?|hrs?)(?:\s*(\d+(?:\.\d+)?)\s*(?:นาที|minutes?|mins?)?)?$/i);
    if (hoursMinutes) return Math.round((Number(hoursMinutes[1]) * 60 + Number(hoursMinutes[2] || 0)) * 60);
  }
  return null;
}

export function markDuplicateMediaItems(items) {
  const counted = new Map();
  let duplicateCount = 0;
  for (const item of items.filter((entry) => entry.auditSession && ["video", "podcast"].includes(entry.kind) && entry.externalUrl && !entry.titleAlternativeOf)) {
    const fingerprint = `${item.auditSession}:${item.kind}:${canonicalMediaTarget(item.externalUrl)}`;
    const original = counted.get(fingerprint);
    if (!original) {
      counted.set(fingerprint, item);
      item.countingEligible = true;
      continue;
    }
    duplicateCount += 1;
    item.countingEligible = false;
    item.duplicateOf = original.href;
    item.accessNote = `${item.accessNote ? item.accessNote + " · " : ""}ปลายทางซ้ำกับ ${original.title || "รายการก่อนหน้า"} ในครั้งเดียวกัน — แสดงหลักฐานแต่ไม่นับเวลาซ้ำ`;
  }
  return duplicateCount;
}

export function normalizeAlternativeMediaTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\(\s*(?:copy|สำเนา)(?:\s*\d+)?\s*\)/ig, " ")
    .replace(/(?:[-_\s]+)(?:copy|สำเนา)(?:\s*\d+)?\s*$/ig, " ")
    .replace(/\s+(?:URL|Link)\s*$/i, "")
    .replace(/[\s_:;,.\-–—]+/g, " ")
    .trim()
    .toLowerCase();
}

// A common Moodle editing pattern keeps one module hidden and publishes a
// “(copy)” of the same clip. This runs only after every link has been inspected:
// visibility is a tie-breaker, never a reason to skip a hidden item. Prefer a
// playable item with readable duration, then detected video, then a reachable
// destination. Retain every row as evidence but count the logical clip once.
export function markHiddenTitleAlternatives(items) {
  const mediaKinds = new Set(["video", "video_candidate", "recording"]);
  const groups = new Map();
  for (const item of items || []) {
    if (!mediaKinds.has(item.kind)) continue;
    const title = normalizeAlternativeMediaTitle(item.title);
    if (title.length < 5) continue;
    const sectionKey = item.sectionId || (Number.isInteger(item.sectionIndex) ? `index:${item.sectionIndex}` : `title:${item.section || ""}`);
    const family = item.kind === "recording" ? "recording" : "teaching-video";
    const key = `${sectionKey}:${family}:${title}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  let excluded = 0;
  for (const group of groups.values()) {
    if (!group.some(item => item.hiddenFromStudents) || !group.some(item => !item.hiddenFromStudents)) continue;
    const evidenceRank = (item) => {
      if (item.durationSeconds && (item.mediaDetected || item.kind === "video")) return 400;
      if (item.mediaDetected || item.kind === "video" && item.mediaStatus && !["access_denied","link_unavailable","link_error"].includes(item.mediaStatus)) return 300;
      if (item.linkStatus === "external" && item.accessible !== false && item.externalUrl) return 200;
      if (item.externalUrl) return 100;
      return 0;
    };
    const winner = [...group].sort((a,b) => evidenceRank(b) - evidenceRank(a) || Number(a.hiddenFromStudents) - Number(b.hiddenFromStudents))[0];
    for (const item of group) {
      if (item === winner) continue;
      item.titleAlternativeOf = winner.href;
      item.countingEligible = false;
      item.duplicateOf = winner.href;
      item.accessNote = `${item.accessNote ? item.accessNote + " · " : ""}ชื่อซ้ำใน Section เดียวกันกับ ${winner.title || "รายการที่เลือกใช้"} — ตรวจหลักฐานแล้วและไม่นับเวลาซ้ำ`;
      excluded += 1;
    }
  }
  return excluded;
}

// Defensive second layer for themes that expose a provider link from inside a
// Moodle module in an unusual wrapper that the page scanner cannot recognise.
// Remove only the synthetic embedded-link copy when an inspected Moodle module
// in the same session reaches the identical destination. The two copies can be
// classified differently (for example a named supplementary Moodle activity
// and its generic "YouTube" target), so destination identity is deliberately
// stronger than kind here. Distinct Moodle activities are always preserved.
export function collapseDuplicateDestinationItems(items) {
  const targetOf = (item) => item.externalUrl || item.resource?.target
    || (item.collectionSource === "embedded_external_link" ? item.href : null);
  const fingerprint = (item) => {
    const target = targetOf(item);
    if (!item.auditSession || !target) return null;
    return `${item.auditSession}:${canonicalMediaTarget(target)}`;
  };
  const moduleTargets = new Set();
  for (const item of items || []) {
    const key = fingerprint(item);
    if (key && item.collectionSource === "moodle_module") moduleTargets.add(key);
  }
  let removed = 0;
  const filtered = (items || []).filter((item) => {
    const key = fingerprint(item);
    if (key && item.collectionSource === "embedded_external_link" && moduleTargets.has(key)) {
      removed += 1;
      return false;
    }
    return true;
  });
  return { items:filtered, removed };
}

export function verifiedVideoCandidate(media) {
  return Boolean(media?.mediaDetected || media?.durationSeconds);
}

export const RECORDING_PATTERN = /live\s*record(?:ing)?|record(?:ed)?\s*live|(^|[\s_\-–—])(rec|record(?:ing)?|zoom|live)(?=$|[\s_\-–—])|บันทึก(?:การ)?สอน|สอนสด|ย้อนหลัง|直播(?:录像|录制|錄影|錄製)?|课堂录制|課堂錄製|授業録画|ライブ録画/i;
export const VIDEO_PATTERN = /video|v\.?\s*d\.?\s*o\.?|วิดีโอ|วีดีโอ|clip|คลิป|视频|影片|視訊|ビデオ|動画/i;
// Only these explicit labels are counted as pre-recorded teaching video.
// Generic "Video" links remain visible as candidates but are not opened/countable.
export const PRE_RECORDED_VIDEO_PATTERN = /วิดีโอ(?:บันทึก)?การสอน(?:ล่วงหน้า)?|วีดีโอ(?:บันทึก)?การสอน(?:ล่วงหน้า)?|(?:วิดีโอ|วีดีโอ)ก่อนเรียน|(?:v\.?\s*d\.?\s*o\.?|video)\s*(?:แนะนำ)?(?:การเรียน|การสอน)?\s*ล่วงหน้า|แนะนำการเรียน(?:การสอน)?ล่วงหน้า|การสอนล่วงหน้า|มาดูคลิปสอนกัน|คลิปสอน|pre[\s-]?(?:recorded|teaching)|预录(?:教学)?视频|預錄(?:教學)?影片|教学视频|教學影片|事前収録(?:授業)?動画|講義動画|授業動画/i;
// Supplementary media is useful course content but is not evidence of the
// required pre-recorded teaching video. A group label is required before it
// can be skipped without opening the target.
export const SUPPLEMENTARY_PATTERN = /ข้อมูลเพิ่มเติม|ความรู้เพิ่มเติม|สื่อ(?:อ่าน)?เพิ่มเติม|วิดีโอเสริม(?:การ)?สอน|วีดีโอเสริม(?:การ)?สอน|สื่อเสริม(?:การ)?สอน|คลิปเสริม(?:การ)?สอน|additional\s*(?:resource|resources|material|materials|reference|references)|supplementary\s*(?:resource|resources|material|materials|reference|references)|补充(?:资料|材料|资源)|補充(?:資料|教材|資源)|扩展阅读|延伸閱讀|補足(?:資料|教材)|参考資料|追加資料/i;
export const PODCAST_PATTERN = /podcast|พอดแคสต์|คลิปเสียง|播客|ポッドキャスト|音声(?:教材|ファイル)/i;
// Named tutors are intentionally included: their link titles do not always
// say "AI" or "Tutor", but they are still part of the course's AI Tutors.
export const AI_TUTOR_PATTERN = /ai[\s_-]*(?:tutors?|co(?:a|ia)ch(?:es)?|chat[\s_-]*bots?|bots?|assistants?)|(?:spu[\s_-]*ai|ai\s+(?:student\s+)?platform)\b|chat[\s_-]*gpt|gpt[\s_-]*chat|แช[ทต][\s_-]*บอท(?:\s*ai)?|ผู้ช่วย.*ai|ระบบ.*ai|ติวเตอร์|พี่จ้อบ|\btutors?\b|ai\s*(?:导师|導師|助教|辅导|輔導|チューター|コーチ|チャットボット)|智能助教|智能聊天机器人|智能聊天機器人/i;

function boundedDamerauLevenshtein(left, right, limit) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  const rows = Array.from({length:left.length + 1}, () => Array(right.length + 1).fill(0));
  for (let index = 0; index <= left.length; index += 1) rows[index][0] = index;
  for (let index = 0; index <= right.length; index += 1) rows[0][index] = index;
  for (let row = 1; row <= left.length; row += 1) {
    let best = limit + 1;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, rows[row - 1][column - 1] + cost);
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        rows[row][column] = Math.min(rows[row][column], rows[row - 2][column - 2] + 1);
      }
      best = Math.min(best, rows[row][column]);
    }
    if (best > limit) return limit + 1;
  }
  return rows[left.length][right.length];
}

const englishTokens = (value) => String(value || "").normalize("NFKC").toLowerCase().match(/[a-z]+/g) || [];

export function isPodcastLike(value) {
  if (PODCAST_PATTERN.test(String(value || ""))) return true;
  const words = englishTokens(value);
  const candidates = [...words, ...words.slice(0, -1).map((word, index) => word + words[index + 1])];
  return candidates.some((word) => word.startsWith("p") && word.length >= 5 && word.length <= 9
    && boundedDamerauLevenshtein(word, "podcast", 2) <= 2);
}

export function isAiTutorLike(value) {
  if (AI_TUTOR_PATTERN.test(String(value || ""))) return true;
  const words = englishTokens(value);
  const roleLike = (word) => ["tutor", "coach", "chatbot", "assistant"].some((role) => boundedDamerauLevenshtein(word, role, role.length >= 7 ? 2 : 1) <= (role.length >= 7 ? 2 : 1));
  const aiLike = (word) => word === "ai" || boundedDamerauLevenshtein(word, "ai", 1) <= 1;
  const spuAiLike = (word) => word.length >= 4 && word.length <= 6 && boundedDamerauLevenshtein(word, "spuai", 1) <= 1;
  const chatGptLike = (word) => word.length >= 5 && word.length <= 8 && boundedDamerauLevenshtein(word, "chatgpt", 2) <= 2;
  const gptLike = (word) => word.length === 3 && boundedDamerauLevenshtein(word, "gpt", 1) <= 1;
  return words.some(spuAiLike)
    || words.some(chatGptLike)
    || words.some((word, index) => /^(?:chat|chatt)$/.test(word) && words.slice(index + 1, index + 3).some(gptLike))
    || words.some((word, index) => aiLike(word) && words.slice(index + 1, index + 4).some(roleLike))
    || words.some((word) => word.startsWith("ai") && roleLike(word.slice(2)));
}
export const ACTIVITY_PATTERN = /กิจกรรม(?:\s*ท้าย\s*บท(?:\s*เรียน)?)?|assignment|แบบฝึกหัด|exercises?|\bpractice(?:\s+quiz)?\b|quest|poster|แนะนำ\s*ตัว|say\s*hi|ทักกันก่อน|introduce\s*yourself|introduction\s*activity|作业|作業|练习|練習|活动|活動|課題|宿題|演習|アクティビティ/i;
// Item-level names used for a task brief or worksheet. This is intentionally
// narrower than ACTIVITY_PATTERN: words such as "practice" in a lesson title
// must not turn ordinary teaching material into an end activity.
export const END_ACTIVITY_TITLE_PATTERN = /\b(?:assignment|homework|worksheet|work\s*sheet)\b|^\s*(?:(?:after[ -]?class|post[ -]?class)\s*activity|activity|exercise|task)\b|^\s*(?:ใบงาน(?:กิจกรรม)?|การบ้าน|กิจกรรม(?:ท้าย\s*บท(?:เรียน)?|ประจำ\s*(?:สัปดาห์|บท)))/i;
export const isEndActivityTitle = (value) => END_ACTIVITY_TITLE_PATTERN.test(String(value || ""));
// Moodle can use Assignment to collect the actual pre/post answers. Only an
// explicit PRE/POST-ASSIGNMENT name receives this treatment; ordinary
// assignments remain end-of-chapter activities.
export const PRE_PATTERN = /pre[\s-]?(?:test|assessment|assignment)|ก่อน\s*(?:การ\s*)?เรียน|课前(?:测验|测试|評量|测试)|課前(?:測驗|測試|評量)|事前(?:テスト|試験|評価)|プレテスト/i;
export const POST_PATTERN = /post[\s-]?(?:test|assessment|assignment)|หลัง\s*(?:การ\s*)?เรียน|课后(?:测验|测试|評量)|課後(?:測驗|測試|評量)|事後(?:テスト|試験|評価)|ポストテスト/i;

export function assessmentTitleKind(value) {
  const source=String(value||"").normalize("NFKC");
  if(POST_PATTERN.test(source))return "post_quiz";
  if(PRE_PATTERN.test(source))return "pre_quiz";
  return "";
}
// A PDF may be uploaded as a Moodle Resource or linked through a URL activity.
// The surrounding document label gives us a verifiable inspection target; the
// actual file type is still confirmed before it is counted as a PDF.
export const FILE_GROUP_PATTERN = /แผน(?:การ)?(?:เรียน)?การสอน|เอกสารประกอบ(?:การ)?(?:สอน|เรียน)|เอกสารการ(?:สอน|บรรยาย)|สไลด์(?:ประกอบ)?การ(?:สอน|บรรยาย)|teaching\s*plan|lesson\s*plan|learning\s*material|supporting\s*material|lecture\s*(?:material|notes?|slides?)|教学(?:计划|大纲|资料|材料)|教學(?:計畫|大綱|資料|教材)|课程资料|課程資料|授業計画|シラバス|講義資料|教材|配布資料/i;
export const PLAN_GROUP_PATTERN = /แผน(?:การ)?(?:เรียน)?การสอน|แผนการจัดการเรียนรู้|teaching\s*plan|lesson\s*plan|weekly\s*plan|course\s*(?:plan|outline)|教学(?:计划|大纲)|教學(?:計畫|大綱)|课程大纲|課程大綱|授業計画|シラバス|講義計画/i;

export function secondsFromClock(value) {
  const parts = String(value).trim().split(":").map(Number);
  if (!parts.every(Number.isFinite) || parts.length < 2 || parts.length > 3) return null;
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export function clock(seconds) {
  seconds = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function timeStatus(actual, required, toleranceMinutes) {
  if (actual === null || actual === undefined) return "needs_review";
  if (Number(required) > 0 && Number(actual) <= 0) return "fail";
  const shortfall = Math.max(0, required - actual);
  if (!shortfall) return "pass";
  return shortfall <= toleranceMinutes * 60 ? "pass_tolerance" : "fail";
}

export function creditBasedVideoToleranceMinutes(credits) {
  const value=Number(credits);
  if(!Number.isFinite(value)||value<=1)return 5;
  if(value<=2)return 10;
  return 20;
}

