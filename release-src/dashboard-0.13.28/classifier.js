import { RECORDING_PATTERN, VIDEO_PATTERN, PRE_RECORDED_VIDEO_PATTERN, SUPPLEMENTARY_PATTERN, PODCAST_PATTERN, AI_TUTOR_PATTERN, ACTIVITY_PATTERN, PRE_PATTERN, POST_PATTERN, FILE_GROUP_PATTERN, PLAN_GROUP_PATTERN, declaredDurationFromTitle, durationHintFromTitle, isPodcastLike, isAiTutorLike, isEndActivityTitle, assessmentTitleKind } from "./rules.js";

// These are course tools, not teaching videos. This safeguard lets a real
// teaching group contain links titled "แนะนำบทเรียน" while preventing a
// leaked visual group label from turning NotebookLM/Gemini/App Store links
// into videos.
const NON_VIDEO_TOOL_PATTERN = /notebooklm|gemini|ai[\s_-]*co(?:a|ia)ch|prompt\s*hub|app\s*store|google\s*play|download|เครื่องมือ|tool/i;
const EXPLICIT_LIVE_RECORD_PATTERN = /live\s*record(?:ing)?|record(?:ed)?\s*live|(^|[\s_\-–—])(rec|record(?:ing)?|zoom|live)(?=$|[\s_\-–—])|สอนสด|ย้อนหลัง/i;
const EPISODE_MEDIA_PATTERN = /^\s*EP\s*\.?\s*\d+(?:\s*[._-]\s*\d+)+(?:\s*\(?(?:copy|สำเนา)\)?)?\s*(?:URL)?\s*$/i;
const assessmentContext = (value) => String(value || "").replace(/(?:วิดีโอ|วีดีโอ)\s*ก่อน\s*เรียน/gi, "วิดีโอ");

function contextCategories(context) {
  const assessment = assessmentContext(context);
  return [
    SUPPLEMENTARY_PATTERN.test(context), PRE_RECORDED_VIDEO_PATTERN.test(context),
    RECORDING_PATTERN.test(context) && !PRE_RECORDED_VIDEO_PATTERN.test(context),
    PRE_PATTERN.test(assessment) || POST_PATTERN.test(assessment), isAiTutorLike(context),
    isPodcastLike(context), FILE_GROUP_PATTERN.test(context), ACTIVITY_PATTERN.test(context)
  ].filter(Boolean).length;
}

function classifyCore(activity, override) {
  const shortContext = String(activity.groupContext || "").slice(0, 220);
  const shortAssessmentContext = assessmentContext(shortContext);
  const title = String(activity.title || "");
  const itemText = String(activity.text || "").slice(0, 600);
  const haystack = `${title} ${shortContext}`;
  const ambiguousContext = contextCategories(shortContext) > 1;
  // Scans made by current versions identify whether the group label is local
  // to this activity or merely inherited from an earlier row. Old stored
  // reports/tests have no source field and keep their previous behaviour.
  const assessmentContextIsLocal = !activity.groupContextSource
    || ["local_label", "own_visual", "adjacent_label", "visual_label", "visual_assessment_label", "paired_assessment_label"].includes(activity.groupContextSource);
  const titleAssessmentKind = assessmentTitleKind(title);
  const contextAssessmentKind = assessmentTitleKind(shortAssessmentContext);
  const explicitThaiPreContext = /(?:แบบ\s*(?:ทดสอบ|ประเมิน).{0,60}ก่อน\s*(?:การ\s*)?เรียน|ก่อน\s*(?:การ\s*)?เรียน.{0,60}แบบ\s*(?:ทดสอบ|ประเมิน))/i.test(shortAssessmentContext);
  const explicitThaiPostContext = /(?:แบบ\s*(?:ทดสอบ|ประเมิน).{0,60}หลัง\s*(?:การ\s*)?เรียน|หลัง\s*(?:การ\s*)?เรียน.{0,60}แบบ\s*(?:ทดสอบ|ประเมิน))/i.test(shortAssessmentContext);
  const verifiedAssessmentSource = ["local_label", "own_visual", "adjacent_label", "visual_label", "visual_assessment_label", "paired_assessment_label"].includes(activity.groupContextSource);
  const explicitLocalAssessmentKind = verifiedAssessmentSource && explicitThaiPreContext !== explicitThaiPostContext ? (explicitThaiPostContext ? "post_quiz" : "pre_quiz") : "";
  const explicitPdf = String(activity.fileTypeHint || "").toLowerCase() === "pdf"
    || /(?:^|[\s_()\-])[^\s]*\.pdf(?:$|[\s?&#)])/i.test(title)
    || /\.pdf(?:$|[?&#])/i.test(String(activity.externalUrl || ""));
  const isUrlActivity = /\/mod\/url\/view\.php/.test(activity.href) || (/^https?:\/\//.test(activity.href) && !/dlearning\.spu\.ac\.th/.test(activity.href));
  const internalVideoModule = /(?:video|media)/i.test(String(activity.moduleTypeHint || ""))
    || String(activity.fileTypeHint || "").toLowerCase() === "video";
  if (activity.evidenceType === "podcast_internal_media") return "podcast";
  if (activity.evidenceType === "assessment_text" && ["pre_quiz", "post_quiz"].includes(activity.assessmentKind)) return activity.assessmentKind;
  if (override === "pre_recorded") return "video";
  if (override === "recording") return "recording";
  if (override === "supplementary") return "supplementary";
  if (override === "assignment") return "assignment";
  if (activity.evidenceType === "assignment_text") return "assignment";
  if (activity.evidenceType === "assignment_image") {
    return activity.ocrStatus === "confirmed" ? "assignment" : "assignment_image_candidate";
  }
  if (/\/mod\//.test(String(activity.href || "")) && internalVideoModule) {
    if (!ambiguousContext && SUPPLEMENTARY_PATTERN.test(shortContext)) return "supplementary";
    if (EXPLICIT_LIVE_RECORD_PATTERN.test(haystack)) return "recording";
    return "video";
  }
  // Some teachers put the complete question in a Chat/Page activity title,
  // for example "Pre-test ...อย่างไร?". The explicit Pre/Post label plus an
  // actual question is assessment evidence even when Moodle's module is not
  // Quiz or Assignment.
  const questionInTitle = /[?？]|(?:อย่างไร|อะไร|เพราะเหตุใด|ทำไม|ข้อใด|เท่าไร)(?:\s|$|[?.])/i.test(title);
  if (questionInTitle && titleAssessmentKind) return titleAssessmentKind;
  if (questionInTitle && assessmentContextIsLocal && !ambiguousContext && contextAssessmentKind) return contextAssessmentKind;
  if (titleAssessmentKind && contextAssessmentKind && titleAssessmentKind !== contextAssessmentKind && assessmentContextIsLocal && !ambiguousContext) return contextAssessmentKind;
  const resourceDocumentOverride = /\/mod\/resource\/view\.php/.test(activity.href)
    && (FILE_GROUP_PATTERN.test(title) || /เฉลย|แนวทาง\s*ตอบ|คำตอบ(?:แบบทดสอบ|ข้อสอบ)|answer\s*key|solutions?/i.test(title));
  if (titleAssessmentKind && !resourceDocumentOverride) return titleAssessmentKind;
  // A real Moodle Quiz is classified from its own title and surrounding
  // label. URL activities need stronger item-level checks first: a stale or
  // misplaced Pre/Post label must never turn a clearly named media item into
  // a quiz.
  if (/\/mod\/quiz\/view\.php/.test(activity.href)) {
    if (titleAssessmentKind) return titleAssessmentKind;
    if (explicitLocalAssessmentKind) return explicitLocalAssessmentKind;
    // “แบบฝึกหัด / Exercise” is an ordinary practice Quiz. Its own title is
    // stronger than an inherited Pre/Post artwork label, which can remain
    // stale when Moodle nests several category rows in one Section. Explicit
    // titles such as “แบบฝึกหัดก่อนเรียน” were already accepted above.
    if (ACTIVITY_PATTERN.test(title)) return "quiz";
    if (assessmentContextIsLocal && !ambiguousContext && contextAssessmentKind) return contextAssessmentKind;
    return "quiz";
  }
  // Moodle Resources are not all documents. A resource explicitly named or
  // labelled Podcast remains a Podcast; its internal upload source is checked
  // later against the rubric instead of being mixed into PDF evidence.
  if (/\/mod\/resource\/view\.php/.test(activity.href)) {
    // The item's own MIME hint/name is stronger than a copied or misplaced
    // visual label.  A PDF placed below Podcast must remain PDF evidence.
    if (isPodcastLike(title) || (String(activity.fileTypeHint || "").toLowerCase() === "audio" && !ambiguousContext && isPodcastLike(shortContext))) return "podcast";
    // Pre/Post can legitimately be supplied as a downloadable question file.
    // Its item-level name is stronger than the PDF MIME/icon and satisfies the
    // presence requirement without pretending it is a Moodle Quiz activity.
    const answerKeyResource = /เฉลย|แนวทาง\s*ตอบ|คำตอบ(?:แบบทดสอบ|ข้อสอบ)|answer\s*key|solutions?/i.test(title);
    const namedDocumentResource = FILE_GROUP_PATTERN.test(title);
    const namedAssessmentResource = /แบบ\s*(?:ทดสอบ|ประเมิน)|ข้อสอบ|\b(?:pre|post)[\s-]?(?:test|assessment)\b|\b(?:quiz|test|assessment|questions?)\b/i.test(title);
    if (POST_PATTERN.test(title) && namedAssessmentResource && !answerKeyResource && !namedDocumentResource) return "post_quiz";
    if (PRE_PATTERN.test(title) && namedAssessmentResource && !answerKeyResource && !namedDocumentResource) return "pre_quiz";
    if (answerKeyResource || namedDocumentResource) return "file";
    if (assessmentContextIsLocal && !ambiguousContext && contextAssessmentKind && namedAssessmentResource) return contextAssessmentKind;
    // i-Learning commonly publishes the end-of-lecture brief as a PDF named
    // "Activity/Assignment ...". Its explicit item name is stronger than the
    // PDF MIME type; ordinary lesson PDFs remain supporting documents.
    if (isEndActivityTitle(title)) return "assignment";
    if (explicitPdf || FILE_GROUP_PATTERN.test(title)) return "file";
    // Moodle File activities often use only the lesson title. Their own
    // icon/MIME evidence still proves that the uploaded file is a video.
    // Surface it as internal video evidence so it cannot be mistaken for a
    // document or counted as the required external video link.
    if (String(activity.fileTypeHint || "").toLowerCase() === "video") {
      if (!ambiguousContext && SUPPLEMENTARY_PATTERN.test(shortContext)) return "supplementary";
      if (EXPLICIT_LIVE_RECORD_PATTERN.test(haystack) || (!ambiguousContext && EXPLICIT_LIVE_RECORD_PATTERN.test(shortContext))) return "recording";
      return "video";
    }
  }
  if (/\/mod\/(h5pactivity|hvp)\/view\.php/.test(activity.href)) {
    // H5P has many non-video content types. Count it only where its own title
    // says Video or a readable pre-recorded-video label establishes the group.
    if (VIDEO_PATTERN.test(title) || PRE_RECORDED_VIDEO_PATTERN.test(shortContext)) {
      if (RECORDING_PATTERN.test(haystack) && !PRE_RECORDED_VIDEO_PATTERN.test(haystack)) return "recording";
      return "video";
    }
    return "h5p";
  }
  if (isUrlActivity) {
    // A clear media name belongs to the item itself, not to its surrounding
    // artwork. This prevents “Video on demand” placed below an AI Tutor pill
    // from silently turning into an AI Tutor.
    const explicitOnDemand = /video\s*on\s*demand|\bvod\b/i.test(title);
    // “VDO ep…” is the course author's direct video naming convention.  It
    // is eligible unless the same title explicitly says it is a Live/Record
    // item; a generic English “Video” still remains conservative.
    const explicitVdo = /\bv\.?\s*d\.?\s*o\.?\b/i.test(title);
    // In the audited courses, "Video-<topic>" is an intentional naming
    // convention. Keep "Video : <topic>" conservative for older courses
    // where that generic text was also used for supplementary media.
    const explicitVideoPrefix = /^video\s*[-_]\s*\S/i.test(title);
    // Many courses use "Video <course code> <topic>" with an ordinary space.
    // A leading media word is item-level evidence as long as it is followed by
    // real title text. A colon-only label remains a candidate for destination
    // verification, preserving the conservative handling of generic labels.
    const explicitLeadingVideo = /^\s*(?:video|วิดีโอ|วีดีโอ)\s+(?!:)(?=\S)/i.test(title);
    // Some courses use "Video <topic> (8:49 นาที)" without a category pill.
    // A leading media word plus an explicit clock is item-level evidence and
    // is more specific than a generic "Video : topic" link. Live/Record still
    // wins below, and an explicit supplementary group still excludes it.
    const explicitTimedVideo = /^\s*(?:video|v\.?\s*d\.?\s*o\.?|วิดีโอ|วีดีโอ)(?=\s|[-_:])/i.test(title)
      && /\(\s*\d{1,3}\s*[:.]\s*[0-5]\d\s*(?:นาที|min(?:ute)?s?)?\s*\)/i.test(title);
    const episodeMediaCandidate = EPISODE_MEDIA_PATTERN.test(title);
    const explicitLiveRecord = EXPLICIT_LIVE_RECORD_PATTERN.test(title) || (RECORDING_PATTERN.test(title) && !PRE_RECORDED_VIDEO_PATTERN.test(title));
    // A video embedded in an activity is reference material for answering the
    // activity, not the required pre-recorded lesson.  Require both structural
    // activity context and item-level media/instruction evidence: a broad or
    // stale "กิจกรรม" label alone must not hide a real teaching video.
    const activityVideoInstruction = /(?:ดู|ชม|watch).{0,80}(?:วิดีโอ|วีดีโอ|video|v\.?\s*d\.?\s*o\.?|คลิป)/i.test(`${title} ${shortContext} ${itemText}`)
      || /(?:วิดีโอ|วีดีโอ|video|v\.?\s*d\.?\s*o\.?|คลิป).{0,120}(?:ประกอบกิจกรรม|ตอบคำถาม|ทำกิจกรรม|แบบทดสอบ|quiz)/i.test(`${title} ${itemText}`);
    const activityVideoContext = !ambiguousContext && ACTIVITY_PATTERN.test(shortContext)
      && activityVideoInstruction;
    const titlePreTest = PRE_PATTERN.test(title);
    const titlePostTest = POST_PATTERN.test(title);
    const contextPreTest = PRE_PATTERN.test(shortAssessmentContext);
    const contextPostTest = POST_PATTERN.test(shortAssessmentContext);
    // A visual Pre/Post label alone cannot turn a generic URL (for example a
    // magazine article beneath a later "เนื้อหาบทเรียน" label) into a quiz.
    const ownAssessmentSignal = /\b(?:quiz|test|assessment|questions?|exercise)\b|แบบ(?:ทดสอบ|ประเมิน)|ข้อสอบ|คำถาม|สอบ/i.test(title);
    if (titlePostTest && !contextPreTest) return "post_quiz";
    if (titlePreTest && !contextPostTest) return "pre_quiz";
    // A destination/name that explicitly identifies a PDF belongs to the
    // item itself even when the author placed it below another label, except
    // for explicitly named Pre/Post question files handled above.
    if (explicitPdf) return "file_link";
    // An item-level document title is also stronger than a misplaced visual
    // Pre/Post label. The real Pre-test link beside it still stays a quiz.
    if (FILE_GROUP_PATTERN.test(title)) return "file_link";
    // Explicit supplementary wording in the item name remains authoritative.
    // This is different from a normal item merely placed below the wrong pill.
    if (SUPPLEMENTARY_PATTERN.test(title)) return "supplementary";
    // Course authors may move clearly named PRE TEST / POST TEST links below
    // a supplementary-resources artwork. The item name is stronger evidence
    // than that placement. Preserve an explicit opposite Pre/Post group,
    // however, because it can intentionally correct a copied item title.
    // Strong item-level names always win over a misplaced category artwork.
    if (explicitLiveRecord) return "recording";
    // A Podcast name belongs to the activity itself. Course authors sometimes
    // place it below a Live/recording artwork, but that inherited label must
    // not suppress destination inspection or Podcast duration reading.
    if (isPodcastLike(title)) return "podcast";
    if (isAiTutorLike(title)) return "ai_tutor";
    if (explicitOnDemand) return "video";
    if (explicitVdo) return "video";
    if (explicitVideoPrefix) return "video";
    if (explicitLeadingVideo) return "video";
    if (explicitTimedVideo) return "video";
    // A clear Video/VDO prefix is item-level evidence. Check it before broad
    // activity wording so a lesson titled "Best Practices" cannot be
    // swallowed by the English word "practice".
    if (ACTIVITY_PATTERN.test(title)) return "assignment";
    // EP1.11 / EP3.2.3 is a common lesson naming convention. The title alone
    // does not prove media, so open its destination as a candidate and promote
    // it only when the provider/player confirms video evidence.
    if (episodeMediaCandidate) return "video_candidate";
    if (activityVideoContext) return "activity_video";
    // If a course mixes labels in one container, the item's own media name
    // must reach destination verification before any inherited Pre/Post,
    // document or AI label can swallow it.
    if (VIDEO_PATTERN.test(title)) {
      if (!ambiguousContext && (EXPLICIT_LIVE_RECORD_PATTERN.test(shortContext) || (RECORDING_PATTERN.test(shortContext) && !PRE_RECORDED_VIDEO_PATTERN.test(shortContext)))) return "recording";
      return PRE_RECORDED_VIDEO_PATTERN.test(title) || (!ambiguousContext && PRE_RECORDED_VIDEO_PATTERN.test(shortContext)) ? "video" : "video_candidate";
    }
    // Only a generic or ambiguous item name falls back to placement. Labels
    // still help classify unnamed links without rewriting a clearly named one.
    if (SUPPLEMENTARY_PATTERN.test(shortContext) && !ambiguousContext) return "supplementary";
    if (!ambiguousContext && (EXPLICIT_LIVE_RECORD_PATTERN.test(shortContext) || (RECORDING_PATTERN.test(shortContext) && !PRE_RECORDED_VIDEO_PATTERN.test(shortContext)))) return "recording";
    // A recognised visual group is authoritative only after the item's own
    // strong media signals have been checked. This preserves Post-test over a
    // copied Pre-test title, while preventing the failure where Live Record
    // and Video-LSM487 rows were all classified as pre_quiz.
    if (assessmentContextIsLocal && !ambiguousContext && ownAssessmentSignal && POST_PATTERN.test(shortAssessmentContext)) return "post_quiz";
    if (assessmentContextIsLocal && !ambiguousContext && ownAssessmentSignal && PRE_PATTERN.test(shortAssessmentContext)) return "pre_quiz";
    if (PRE_PATTERN.test(title)) return "pre_quiz";
    if (POST_PATTERN.test(title)) return "post_quiz";
    // A generic "แบบทดสอบ..." link is an end-of-lesson activity. It becomes
    // Pre/Post only when its own name or a verified nearby label says so.
    if (/แบบ\s*(?:ทดสอบ|ประเมิน)|ข้อสอบ|\b(?:quiz|test|assessment)\b/i.test(title)) return "assignment";
    if (!ambiguousContext && isAiTutorLike(shortContext)) return "ai_tutor";
    if (!ambiguousContext && isPodcastLike(shortContext)) return "podcast";
    // A linked destination inside a text activity can mention a video to
    // watch. The learner's required comment/response is the activity; the
    // word “ย้อนหลัง” in that instruction does not turn a generic Facebook
    // task link into a teaching recording.
    if (ACTIVITY_PATTERN.test(shortContext) && !VIDEO_PATTERN.test(title)
      && /แสดง\s*ความ\s*คิดเห็น|คอมเมนต์|comment|ส่ง\s*(?:งาน|คำตอบ)|กด\s*(?:like|share|ไลก์|แชร์)/i.test(`${itemText} ${shortContext}`)) return "assignment";
    // A live-record URL is evidence, but never a pre-recorded teaching video.
    // Recognise it even where the author omitted the word Video/VDO.
    if (RECORDING_PATTERN.test(haystack) && !PRE_RECORDED_VIDEO_PATTERN.test(haystack)) return "recording";
    if (ACTIVITY_PATTERN.test(title) || (!ambiguousContext && ACTIVITY_PATTERN.test(shortContext))) return "assignment";
    if (!ambiguousContext && FILE_GROUP_PATTERN.test(shortContext)) return "file_link";
    // Course authors often title their first-session clips "แนะนำรายวิชา"
    // or "แนะนำบทเรียน". A pre-recorded-teaching group is sufficient for
    // those real clips, but never for recognizable product/tool links.
    const inTeachingVideoGroup = !ambiguousContext && PRE_RECORDED_VIDEO_PATTERN.test(shortContext);
    if (VIDEO_PATTERN.test(title) || (inTeachingVideoGroup && !NON_VIDEO_TOOL_PATTERN.test(title))) {
      const isPreRecorded = PRE_RECORDED_VIDEO_PATTERN.test(haystack);
      // "วิดีโอบันทึกการสอนล่วงหน้า" is explicitly eligible. A real live
      // record still wins only when it says Rec/Zoom/Live/สอนสด/ย้อนหลัง.
      const explicitLiveRecord = EXPLICIT_LIVE_RECORD_PATTERN.test(haystack);
      if (explicitLiveRecord || (RECORDING_PATTERN.test(haystack) && !isPreRecorded)) return "recording";
      return isPreRecorded ? "video" : "video_candidate";
    }
    return "url";
  }
  if (/\/mod\/assign\/view\.php/.test(activity.href)) {
    // Moodle Assignment is also used to collect free-text/essay answers for
    // Pre/Post tests. Count the assessment purpose, not the module icon.
    if (isPodcastLike(title)) return "podcast";
    if (POST_PATTERN.test(title)) return "post_quiz";
    if (PRE_PATTERN.test(title)) return "pre_quiz";
    const writtenQuestions = /คำถาม|ข้อเขียน|อัตนัย|ถามตอบ|แบบ(?:ทดสอบ|ประเมิน)|essay|short[\s-]?answer|written\s*questions?|reflection/i.test(title);
    if (writtenQuestions && assessmentContextIsLocal && !ambiguousContext && POST_PATTERN.test(shortAssessmentContext)) return "post_quiz";
    if (writtenQuestions && assessmentContextIsLocal && !ambiguousContext && PRE_PATTERN.test(shortAssessmentContext)) return "pre_quiz";
    return "assignment";
  }
  // A worksheet or explicitly named Assignment can be distributed as a File,
  // Page or another Moodle activity. It still proves that an end activity
  // exists; retain the module URL so the report can state how it was supplied.
  if (isEndActivityTitle(title)) return "assignment";
  if (/\/mod\/(?:forum|chat)\/view\.php/.test(activity.href)) return "forum";
  if (/\/mod\/folder\/view\.php/.test(activity.href)) return "folder";
  if (/\/mod\/resource\/view\.php/.test(activity.href)) return "file";
  return "other";
}

export function classifyActivityWithEvidence(activity, override) {
  const title = String(activity.title || "");
  const context = String(activity.groupContext || "");
  const assessmentGroup = assessmentContext(context);
  const ambiguousContext = contextCategories(context) > 1;
  const kind = classifyCore(activity, override);
  const titleSignals = {
    episodeMedia: EPISODE_MEDIA_PATTERN.test(title),
    videoOnDemand: /video\s*on\s*demand|\bvod\b/i.test(title),
    videoPrefix: /^video\s*[-_]\s*\S/i.test(title),
    leadingVideo: /^\s*(?:video|วิดีโอ|วีดีโอ)\s+(?!:)(?=\S)/i.test(title),
    timedVideo: /^\s*(?:video|v\.?\s*d\.?\s*o\.?|วิดีโอ|วีดีโอ)(?=\s|[-_:])/i.test(title) && /\(\s*\d{1,3}\s*[:.]\s*[0-5]\d\s*(?:นาที|min(?:ute)?s?)?\s*\)/i.test(title),
    recording: EXPLICIT_LIVE_RECORD_PATTERN.test(title) || (RECORDING_PATTERN.test(title) && !PRE_RECORDED_VIDEO_PATTERN.test(title)),
    podcast: isPodcastLike(title),
    aiTutor: isAiTutorLike(title),
    video: VIDEO_PATTERN.test(title),
    durationHintSeconds: durationHintFromTitle(title),
    declaredDurationSeconds: declaredDurationFromTitle(title)
  };
  const contextSignals = {
    aiTutor: isAiTutorLike(context),
    teachingVideo: PRE_RECORDED_VIDEO_PATTERN.test(context),
    activity: ACTIVITY_PATTERN.test(context),
    document: FILE_GROUP_PATTERN.test(context),
    supplementary: SUPPLEMENTARY_PATTERN.test(context)
  };
  const recordingContext = RECORDING_PATTERN.test(context);
  const evidence = [];
  if (override) evidence.push({ source:"ผู้ตรวจ", value:override === "pre_recorded" ? "ยืนยันเป็นวิดีโอสอนล่วงหน้า" : override === "recording" ? "ยืนยันเป็นบันทึกการสอน" : override === "confirm_current" ? "ยืนยันประเภทตามชื่อรายการ" : override === "supplementary" ? "ยืนยันว่าไม่นับรายการนี้" : "ยืนยันเป็นกิจกรรมท้ายบท", strength:"confirmed" });
  if (activity.evidenceType === "assignment_image") {
    evidence.push({ source:"ภาพคำสั่ง", value:activity.ocrStatus === "confirmed" ? "อ่านข้อความและวิธีส่งงานได้" : activity.ocrReason || "ยังยืนยันจากภาพไม่ได้", strength:activity.ocrStatus === "confirmed" ? "confirmed" : "tentative" });
  }
  if (activity.evidenceType === "assignment_text") evidence.push({source:"ข้อความคำสั่งใน Moodle",value:"พบคำสั่งและการตอบสนองที่ผู้เรียนต้องทำ",strength:"confirmed"});
  if (titleSignals.videoOnDemand) evidence.push({ source:"ชื่อรายการ", value:"Video on demand / VOD", strength:"high" });
  if (titleSignals.episodeMedia) evidence.push({ source:"ชื่อรายการ", value:"รูปแบบตอน EPx.xx — เปิดปลายทางเพื่อตรวจว่าเป็นวิดีโอ", strength:"supporting" });
  if (titleSignals.videoPrefix) evidence.push({ source:"ชื่อรายการ", value:"Video-ชื่อเรื่อง", strength:"high" });
  if (titleSignals.leadingVideo) evidence.push({ source:"ชื่อรายการ", value:"ขึ้นต้นด้วย Video/วิดีโอ และตามด้วยชื่อเรื่อง", strength:"high" });
  if (titleSignals.declaredDurationSeconds) evidence.push({ source:"ชื่อรายการ", value:`ระบุเวลาแบบเจาะจง ${Math.floor(titleSignals.declaredDurationSeconds / 60)}:${String(titleSignals.declaredDurationSeconds % 60).padStart(2, "0")} นาที (ใช้เป็นหลักฐานสำรองหลังยืนยันลิงก์)`, strength:"supporting" });
  else if (titleSignals.durationHintSeconds) evidence.push({ source:"ชื่อรายการ", value:`ระบุเวลาไว้ประมาณ ${Math.round(titleSignals.durationHintSeconds / 60)} นาที (ใช้ช่วยจัดประเภทเท่านั้น)`, strength:"supporting" });
  if (titleSignals.timedVideo) evidence.push({ source:"ชื่อรายการ", value:"ขึ้นต้นด้วย Video/VDO และระบุเวลาในชื่อ", strength:"high" });
  if (titleSignals.recording) evidence.push({ source:"ชื่อรายการ", value:"Live/Record/Zoom", strength:"high" });
  if (titleSignals.podcast) evidence.push({ source:"ชื่อรายการ", value:"Podcast", strength:"high" });
  if (titleSignals.aiTutor) evidence.push({ source:"ชื่อรายการ", value:"AI Tutor", strength:"high" });
  if (contextSignals.aiTutor) evidence.push({ source:"ป้ายกลุ่ม", value:"AI Tutor", strength:"context" });
  if (contextSignals.teachingVideo) evidence.push({ source:"ป้ายกลุ่ม", value:"วิดีโอการสอนล่วงหน้า", strength:"context" });
  if (contextSignals.activity) evidence.push({ source:"ป้ายกลุ่ม", value:"กิจกรรม", strength:"context" });
  if (contextSignals.document) evidence.push({ source:"ป้ายกลุ่ม", value:"เอกสาร", strength:"context" });
  if (contextSignals.supplementary) evidence.push({ source:"ป้ายกลุ่ม", value:"ข้อมูลเพิ่มเติม — ไม่นับเป็นวิดีโอสอนล่วงหน้า", strength:"confirmed" });
  if (kind === "activity_video") evidence.push({ source:"บริบทกิจกรรม", value:"วิดีโอใช้ประกอบกิจกรรม/ตอบคำถาม — ไม่นับเป็นวิดีโอการสอนล่วงหน้า", strength:"confirmed" });
  if (ambiguousContext) evidence.push({ source:"การจัดวาง", value:"พบป้ายหลายประเภทปะปนกัน — ใช้ชื่อรายการและปลายทางเป็นหลัก", strength:"ignored_context" });
  const quizContext = PRE_PATTERN.test(assessmentGroup) || POST_PATTERN.test(assessmentGroup);
  const strongNamedMedia = titleSignals.videoOnDemand || titleSignals.videoPrefix || titleSignals.leadingVideo || titleSignals.timedVideo || titleSignals.recording || titleSignals.podcast;
  if (quizContext && strongNamedMedia && (kind === "video" || kind === "recording" || kind === "podcast")) {
    evidence.push({ source:"ป้ายกลุ่ม", value:"พบป้ายแบบทดสอบที่ไม่สอดคล้อง — ใช้ชื่อสื่อที่ระบุประเภทชัดเจน", strength:"ignored_context" });
  }
  // A stale Pre/Post label is common in the affected Moodle layout. Strong
  // item-level names already settle those rows, so they must not block timing,
  // scoring, or create a manual-review appendix. Retain conflicts only where
  // the competing label could genuinely change the media type.
  const contextConflict = !override && !ambiguousContext && ((contextSignals.aiTutor && (kind === "video" || kind === "recording" || kind === "podcast")) || (kind === "recording" && contextSignals.teachingVideo && !recordingContext));
  const unresolved = kind === "video_candidate" || kind === "assignment_image_candidate" || kind === "url" || kind === "other";
  const confidence = override ? "confirmed" : (titleSignals.videoOnDemand || titleSignals.videoPrefix || titleSignals.leadingVideo || titleSignals.timedVideo || titleSignals.recording || titleSignals.podcast || titleSignals.aiTutor) ? "high" : unresolved ? "unknown" : "medium";
  const recordingFastPath = kind === "recording" && titleSignals.recording && !titleSignals.videoOnDemand && (!contextSignals.teachingVideo || recordingContext) && !contextSignals.aiTutor;
  const supplementaryFastPath = (kind === "supplementary" && contextSignals.supplementary) || kind === "activity_video";
  if (recordingFastPath) evidence.push({ source:"กฎความเร็ว", value:"Live Record ชัดเจน — ไม่นับเวลาและไม่เปิดลิงก์", strength:"confirmed" });
  return { kind, confidence, evidence, contextConflict, requiresReview: unresolved, recordingFastPath, supplementaryFastPath };
}

export function classifyActivity(activity, override) {
  return classifyActivityWithEvidence(activity, override).kind;
}

// Some Moodle courses use a bare topic title for the main lesson URL, while
// the neighbouring document and Podcast retain their category names. Promote
// only the single otherwise-unclassified URL in that very specific weekly
// template. The destination still has to prove it is playable media and the
// reviewer can keep or exclude its time; arbitrary URLs remain unopened.
export function promoteSectionLessonCandidates(activities) {
  const groups = new Map();
  for (const item of activities) {
    const key = item.sectionId || (Number.isInteger(item.sectionIndex) ? `index:${item.sectionIndex}` : `title:${item.section || ""}`);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const genericOrTool = /^(?:url|link|ลิงก์)\b|notebooklm|gemini|google\s*(?:drive|docs?|form)|youtube|tiktok|facebook|canva|gamma|ai\s*tutor|แบบทดสอบ|pre\s*-?test|post\s*-?test|กิจกรรม|assignment|live|record|podcast|แผนการสอน|เอกสาร|แหล่งข้อมูล|ข้อมูลเพิ่มเติม|พูดคุย|ติดต่อ/i;
  for (const peers of groups.values()) {
    if (!peers.some((item) => ["file", "file_link"].includes(item.kind))) continue;
    if (!peers.some((item) => item.kind === "podcast")) continue;
    if (peers.some((item) => ["video", "video_candidate"].includes(item.kind))) continue;
    const candidates = peers.filter((item) => {
      if (item.kind !== "url" || !/\/mod\/url\/view\.php/i.test(item.href || "")) return false;
      const title = String(item.title || "").replace(/\s+URL\s*$/i, "").trim();
      return title.length >= 8 && !genericOrTool.test(title);
    });
    if (candidates.length !== 1) continue;
    const item = candidates[0];
    item.kind = "video_candidate";
    delete item.linkStatus;
    delete item.accessNote;
    item.classification = {
      ...(item.classification || {}),
      kind:"video_candidate",
      confidence:"tentative",
      requiresReview:true,
      sectionLessonCandidate:true,
      evidence:[...(item.classification?.evidence || []), {source:"โครงสร้าง Section", value:"เป็น URL หัวข้อบทเรียนเพียงรายการเดียวที่อยู่ร่วมกับเอกสารและ Podcast", strength:"supporting"}]
    };
  }
  return activities;
}

export function isTeachingPlanFile(activity) {
  // The category pill is authoritative when it explicitly says "teaching
  // plan". Do not join a generic file title to its group label and run a
  // wildcard such as /แผน.*สอน/: a supporting document titled "วางแผน…"
  // would then be misread as a plan merely because its label ends in
  // "การสอน". This was the direct cause of the Week 8 and 15 false failures.
  const group = String(activity.groupContext || "");
  if (PLAN_GROUP_PATTERN.test(group)) return true;
  const title = String(activity.title || "");
  const text = String(activity.text || "");
  return PLAN_GROUP_PATTERN.test(title) || PLAN_GROUP_PATTERN.test(text);
}

