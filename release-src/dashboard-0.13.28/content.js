(() => {
  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  const cleanContextLabel = (value) => normalize(value)
    .replace(/Students can manually mark this item complete:\s*Label(?:\s*\(copy\))?/gi, " ")
    .replace(/Students can manually mark this item complete:\s*/gi, " ")
    .replace(/ผู้เรียนสามารถทำเครื่องหมายกิจกรรมนี้ว่าเสร็จสมบูรณ์[^|]*/gi, " ")
    .replace(/\s+/g, " ").trim();
  const cleanInstructorText = (value) => cleanContextLabel(value)
    .replace(/Students can manually mark this item complete(?::\s*[^|·]{0,160})?/gi, " ")
    .replace(/The system marks this item complete[^|·]{0,160}/gi, " ")
    .replace(/Assignment Due|Activity completion|Mark (?:this )?item complete|Completion status/gi, " ")
    .replace(/ผู้เรียนสามารถทำเครื่องหมายกิจกรรมนี้ว่าเสร็จสมบูรณ์[^|·]{0,160}/gi, " ")
    .replace(/ทำเครื่องหมายว่าเสร็จสมบูรณ์|สถานะการทำกิจกรรม/gi, " ")
    .replace(/\s+/g, " ").trim();
  const invalidInstructorName = /assignment|activity|students?|manually|complete|completion|due|checkbox|quiz|file|url|label|section|mark\s+(?:this\s+)?item|แบบทดสอบ|กิจกรรม|ไฟล์|สัปดาห์|ครั้งที่/i;
  const validInstructorName = (value) => {
    const candidate = cleanInstructorText(value).replace(/^(?:อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|ดร\.|ผู้สอน|instructor|lecturer)\s*[:：]?\s*/i, "").trim();
    if (!candidate || invalidInstructorName.test(candidate)) return false;
    const words = candidate.split(/\s+/).filter(Boolean);
    return /[ก-๙\u3040-\u30ff\u3400-\u9fff]/.test(candidate) ? candidate.length >= 3 : words.length >= 2 && words.every((word) => /^[A-Za-z][A-Za-z.'-]*$/.test(word));
  };
  // Chat and Page can contain a complete Pre/Post question or worksheet title.
  // They must reach classification even though they are not Quiz/Assignment.
  // Accept every real Moodle activity module on the course page. Several SPU
  // courses use video modules supplied by plugins (for example videofile or
  // videotime), which were previously skipped by the fixed allow-list.
  const modulePattern = /\/mod\/([a-z][a-z0-9_]*)\/view\.php/i;
  const isCourseModuleHref = (value) => {
    try {
      const url = new URL(String(value || ""), location.href);
      return url.origin === location.origin && modulePattern.test(url.pathname);
    } catch { return false; }
  };
  const ignoredExternalHref = (value) => {
    try {
      const host = new URL(String(value || ""), location.href).hostname.toLowerCase();
      return /(?:^|\.)(?:docs\.moodle\.org|googletagmanager\.com|google-analytics\.com|doubleclick\.net|analytics\.google\.com|facebook\.com|connect\.facebook\.net|clarity\.ms|gstatic\.com|googleapis\.com)$/i.test(host);
    } catch { return true; }
  };
  // Course category artwork is the primary structural signal. Include every
  // supported group here so a new label reliably ends the previous group.
  const contextPattern = /วิดีโอ|video|vdo|คลิป|视频|影片|視訊|ビデオ|動画|podcast|พอดแคสต์|播客|ポッドキャスト|音声教材|rec(?:ord(?:ing)?)?|zoom|live|สอนสด|ย้อนหลัง|直播|授業録画|กิจกรรม|activity|作业|作業|练习|練習|活动|活動|課題|宿題|演習|ติวเตอร์|tutor|ai[\s_-]*(?:co(?:a|ia)ch|chat[\s_-]*bot|bot)|(?:spu\s+)?ai\s+(?:student\s+)?platform\b|ปรึกษา|导师|導師|助教|チューター|チャットボット|智能聊天机器人|智能聊天機器人|pre[\s-]?test|post[\s-]?test|แบบทดสอบ|课前测验|課前測驗|课后测验|課後測驗|事前テスト|事後テスト|เนื้อหา(?:บทเรียน|การเรียน)|lesson\s*content|learning\s*content|课程内容|課程內容|授業内容|แผน(?:การ)?(?:เรียน)?การสอน|เอกสารประกอบ(?:การ)?(?:สอน|เรียน)|เอกสารการสอน|teaching\s*plan|lesson\s*plan|learning\s*material|supporting\s*material|教学计划|教學計畫|课程大纲|課程大綱|授業計画|シラバス|講義資料/i;

  const accessibleText = (element) => {
    if (!element) return "";
    const attributes = [element.getAttribute?.("aria-label"), element.getAttribute?.("title"), element.getAttribute?.("data-activityname")];
    const images = [...element.querySelectorAll?.("img") || []].flatMap((img) => [img.alt, img.title, img.getAttribute("aria-label")]);
    return normalize([element.textContent, ...attributes, ...images].filter(Boolean).join(" "));
  };

  const sectionSelector = ".course-section, li.section, [data-sectionid], [id^='section-']";
  const getSectionElement = (element) => element?.closest?.(sectionSelector) || null;
  const physicalBoxes = () => [...document.querySelectorAll(sectionSelector)].filter((node) => !node.parentElement?.closest(sectionSelector));
  const sectionEvidence = (element) => {
    const section = getSectionElement(element);
    const boxes = physicalBoxes();
    return { sectionId:section?.id || section?.getAttribute("data-sectionid") || "",
      sectionIndex:section ? boxes.indexOf(section) : -1,
      hiddenFromStudents:/hidden from students|ซ่อนจากนักเรียน|ซ่อนจากผู้เรียน/i.test(accessibleText(element)) };
  };

  const getSectionName = (element) => {
    const section = getSectionElement(element);
    if (!section) return "";
    // Prefer Moodle's section title over a course-wide H1 nested in a theme
    // wrapper. The latter made every Japanese course activity appear to belong
    // to the single course-title section.
    const selectors = [".sectionname", "[data-for='section_title']", "h2,h3,h4", "h1"];
    for (const selector of selectors) {
      const heading = [...section.querySelectorAll(selector)].find((node) => getSectionElement(node) === section);
      if (normalize(heading?.textContent)) return normalize(heading.textContent);
    }
    return normalize(section.getAttribute("aria-label") || section.getAttribute("data-sectionid") || section.id);
  };

  // The Moodle page also contains navigation, teacher tools, course-category
  // menus and profile links. They are not course activities and must never
  // become an "ไม่ระบุ Week" audit card simply because a visual label happens
  // to be nearby in the page layout.
  // Some courses name their containers SECTION 9 / SECTION 11 while their
  // actual teaching-week number appears only in the activities within it.
  // Keep those containers; section-mapping.js resolves their week from the
  // repeated item titles rather than assuming SECTION number equals Week.
  const isAuditableSection = (section) => /(?:ครั้ง(?:ที่)?|(?:ประจำ)?สัปดาห์(?:ที่)?|week|session|section|lecture)\s*\d+\b|(?:week|session|section|lecture)\s*[０-９]+|第\s*[0-9０-９〇零一二三四五六七八九十百]+\s*(?:回|週|周|講|课|課|节|節)|แนะนำ(?:รายวิชา|บทเรียน)|course\s*(?:introduction|overview)|课程(?:介绍|简介|概述)|課程(?:介紹|簡介|概述)|コース(?:紹介|概要)|授業概要|^general$/i.test(section || "");

  const declaredAuditableSectionCount = () => {
    const sections = new Set();
    for (const node of document.querySelectorAll(sectionSelector)) {
      const name = getSectionName(node);
      if (isAuditableSection(name)) sections.add(`${node.id || node.getAttribute("data-sectionid") || ""}::${name}`);
    }
    return sections.size;
  };

  const primaryAnchor = (container) => {
    const candidates = [...container.querySelectorAll("a[href]")].filter((anchor) => isCourseModuleHref(anchor.href));
    return candidates.find((anchor) => anchor.matches(".aalink, .activityname") || anchor.querySelector(".instancename")) || candidates[0] || null;
  };
  const administrativeAnchor = (anchor) => {
    const title = normalize([anchor?.textContent, anchor?.getAttribute?.("aria-label"), anchor?.getAttribute?.("title")].filter(Boolean).join(" "));
    // Do not treat every element with data-action as an editing control:
    // Moodle themes commonly use that attribute on the normal activity row.
    // Restrict this to the actual action-menu wrappers, then use the exact
    // command names below as the second guard.
    const control = anchor?.closest?.(".action-menu, .dropdown-menu, .activity-actions, [data-region='action-menu']");
    return Boolean(control) || /^(?:edit settings|move (?:right|left)|hide|show|duplicate|assign roles|delete|แก้ไขการตั้งค่า|ซ่อน|ลบ)$/i.test(title);
  };

  const moodleFileTypeEvidence = (container) => {
    // Moodle's resource URL often remains /mod/resource/view.php even when the
    // visible activity icon already carries the server's MIME type (/f/pdf).
    // Keep this strong, local evidence so a PDF is not lost when Chrome cannot
    // script a forced download or its built-in PDF viewer.
    const nodes = [...container.querySelectorAll("img, svg, use, i, .activityicon, .activity-icon, .activityiconcontainer *, [class*='icon'], [data-icon]")];
    const evidence = normalize([
      container.className, container.id, container.getAttribute?.("data-modtype"),
      container.getAttribute?.("data-activitytype"),
      ...nodes.flatMap((node) => [
      node.currentSrc, node.src, node.getAttribute?.("src"), node.getAttribute?.("class"),
      node.getAttribute?.("data-icon"), node.getAttribute?.("data-filetype"),
      node.getAttribute?.("href"), node.getAttribute?.("xlink:href"),
      node.getAttribute?.("alt"), node.getAttribute?.("title"), node.getAttribute?.("aria-label"),
      getComputedStyle(node).backgroundImage, getComputedStyle(node).maskImage, node.outerHTML?.slice(0, 500)
    ])].filter(Boolean).join(" ")).slice(0, 2400);
    const fileTypeHint = globalThis.DLearningFileEvidence?.detectMoodleFileTypeEvidence(evidence) || "";
    return { fileTypeHint, fileTypeEvidence:evidence };
  };

  const activity = (container, anchor, groupContext, groupContextSource = "", sectionOverride = "") => {
    const fullTitle = container.querySelector(".instancename, .activityname, [data-activityname]")?.textContent || container.getAttribute("data-activityname") || anchor.textContent;
    const moduleTypeHint = (() => {
      try { return new URL(anchor.href, location.href).pathname.match(/\/mod\/([a-z][a-z0-9_]*)\/view\.php/i)?.[1]?.toLowerCase() || ""; }
      catch { return ""; }
    })();
    return {
      text: accessibleText(container),
      title: normalize(fullTitle),
      href: anchor.href,
      collectionSource: "moodle_module",
      section: sectionOverride || getSectionName(container),
      ...sectionEvidence(container),
      groupContext:cleanContextLabel(groupContext),
      groupContextSource,
      moduleTypeHint,
      ...moodleFileTypeEvidence(container),
      html: container.outerHTML.slice(0, 2500)
    };
  };

  const directActivity = (container, href, title, groupContext, groupContextSource = "") => ({
    text: accessibleText(container),
    title: normalize(title) || "ลิงก์ในเนื้อหารายวิชา",
    href,
    collectionSource: "embedded_external_link",
    section: getSectionName(container),
    ...sectionEvidence(container),
    groupContext:cleanContextLabel(groupContext),
    groupContextSource,
    ...moodleFileTypeEvidence(container),
    html: container.outerHTML.slice(0, 2500)
  });

  const isContextLabel = (container, anchor) => {
    const text = accessibleText(container);
    if (!text || !contextPattern.test(text)) return false;
    // A label is short. A long string means this is a section wrapper and must
    // never be inherited by every activity beneath it.
    if (text.length > 220) return false;
    // Moodle labels normally have no module link. Do not require a particular
    // CSS class because this theme renders image labels without modtype_label.
    return !anchor;
  };

  // Some d-Learning themes place an image/label in a sibling that is not a
  // Moodle activity item. Look only at nearby *non-activity* siblings so a
  // Podcast, Quiz or earlier Video can never become the next item's context.
  const precedingContextLabel = (container) => {
    const inspect = (node) => {
      if (!node || primaryAnchor(node)) return "";
      const text = accessibleText(node);
      return text.length <= 220 && contextPattern.test(text) ? text : "";
    };
    let sibling = container.previousElementSibling;
    for (let index = 0; sibling && index < 8; index += 1, sibling = sibling.previousElementSibling) {
      const found = inspect(sibling);
      if (found) return found;
    }
    // Themes may wrap the activity list in a nested div. Check its immediate
    // preceding siblings too, still excluding actual Moodle modules.
    const parent = container.parentElement;
    sibling = parent?.previousElementSibling;
    for (let index = 0; sibling && index < 4; index += 1, sibling = sibling.previousElementSibling) {
      const found = inspect(sibling);
      if (found) return found;
    }
    return "";
  };

  const visualLabelContext = (image) => {
    let sourceName = image.src.split("/").pop();
    try { sourceName = new URL(image.src).pathname.split("/").pop() || sourceName; } catch { /* retain source segment */ }
    let decodedName = sourceName;
    try { decodedName = decodeURIComponent(sourceName); } catch { /* keep original URL segment */ }
    const text = normalize([image.alt, image.title, image.getAttribute("aria-label"), decodedName].filter(Boolean).join(" "));
    if (contextPattern.test(text)) return text;
    // Do not infer a category from artwork colour. Different courses reuse the
    // same blue/pink templates for Video, AI Tutor and other sections; colour
    // made identical pages classify differently while images loaded. An image
    // with no readable label remains a boundary, never guessed as Video.
    return "";
  };

  const imageLabels = () => [...document.images].map((image) => {
    const rect = image.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 24) return null;
    const context = visualLabelContext(image);
    // An unreadable category pill is still a boundary. Treating it as no
    // label caused a preceding Video group to leak into tools, AI Tutors and
    // later activities. Its empty context deliberately clears the old group.
    const sectionElement = getSectionElement(image);
    const evidence = sectionEvidence(image);
    const sectionHasActivities = Boolean(sectionElement?.querySelector("li[id^='module-'], li.activity, [id^='module-']"));
    return {context:cleanContextLabel(context), top:rect.top + window.scrollY, section:getSectionName(image), sectionElement, sectionId:evidence.sectionId, sectionIndex:evidence.sectionIndex, sectionHasActivities};
  }).filter(Boolean).sort((left, right) => left.top - right.top);

  // A few course themes keep the illustrated category pill in a separate
  // layout column.  It can therefore have a different `.course-section` from
  // the module that follows it.  The visual order is still authoritative: a
  // nearby pill immediately above a link is its group label.
  const nearestVisualLabel = (visualContexts, section, top, element) => {
    const currentSectionElement = getSectionElement(element);
    const currentEvidence = sectionEvidence(element);
    const preceding = visualContexts.filter((label) => label.top <= top);
    const sameSection = preceding.filter((label) => label.sectionElement === currentSectionElement
      || currentEvidence.sectionId && label.sectionId === currentEvidence.sectionId
      || currentEvidence.sectionIndex >= 0 && label.sectionIndex === currentEvidence.sectionIndex
      || !currentSectionElement && (label.section === section || !label.section));
    const same = sameSection.at(-1) || null;
    const closest = preceding.at(-1) || null;
    // A label-only Moodle wrapper may legitimately precede the activity card.
    // Accept that structural adjacency, but never inherit artwork from a real
    // preceding teaching Section. This removes the old 180/900-pixel guess,
    // which changed with zoom, responsive layout and long translated text.
    const labelOnlyPreviousSection = closest && closest !== same
      && closest.sectionElement && currentSectionElement
      && !closest.sectionHasActivities
      && closest.sectionIndex >= 0 && currentEvidence.sectionIndex === closest.sectionIndex + 1;
    return labelOnlyPreviousSection ? closest : same || (!currentSectionElement ? closest : null);
  };

  const ownVisualContext = (container) => {
    const image = [...container.querySelectorAll("img")].find((item) => visualLabelContext(item));
    return image ? visualLabelContext(image) : "";
  };

  const collectVisibleActivities = () => {
      // Use only Moodle's top-level activity list items. Nested data-activityname
      // nodes can contain an entire section and contaminate every activity's text.
      // This theme renders some image labels as div.activity while ordinary
      // activities are li.activity. Reading only li skips the very labels that
      // identify pre-recorded teaching video.
      let containers = [...new Set(document.querySelectorAll("li.activity, li[id^='module-'], .activity"))];
      if (!containers.length) containers = [...document.querySelectorAll("[id^='module-']")];
      // Moodle themes nest a second `.activity` around the title while keeping
      // the MIME icon beside it in the outer `li#module-N`. Normalize every
      // candidate to that outer module row so an inner duplicate cannot erase
      // PDF icon evidence during the final section/href deduplication.
      containers = [...new Set(containers.map((candidate) => {
        const anchor = primaryAnchor(candidate);
        return anchor?.closest("li[id^='module-'], [id^='module-'], li.activity") || candidate;
      }))];
      // The Moodle theme can nest `.activity` elements. Its DOM order is not
      // guaranteed to match the visual course order, so use page position as
      // the deterministic ordering for label inheritance.
      containers.sort((left, right) => {
        const delta = left.getBoundingClientRect().top - right.getBoundingClientRect().top;
        if (delta) return delta;
        return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
      let groupContext = "";
      let groupContextSource = "";
      let currentSection = "";
      const activities = [];
      const visualContexts = imageLabels();
      for (const container of containers) {
        const anchor = primaryAnchor(container);
        if (administrativeAnchor(anchor)) continue;
        const section = getSectionName(container);
        const isAnnouncementForum = Boolean(anchor && /\/mod\/forum\/view\.php/.test(anchor.href));
        // A forum itself never scores as an Assignment, but its PDF attachments
        // may contain a teaching plan placed in Announcements. Keep that source
        // even when Announcements is outside a numbered teaching section.
        // A legitimate Moodle course section is auditable even when its
        // heading is Japanese, a lesson code, or another unfamiliar format.
        // Navigation links do not live inside a course-section container.
        if (!isAuditableSection(section) && !getSectionElement(container) && !isAnnouncementForum) continue;
        if (section !== currentSection) { currentSection = section; groupContext = ""; groupContextSource = ""; }
        if (isContextLabel(container, anchor)) { groupContext = cleanContextLabel(accessibleText(container)); groupContextSource = "local_label"; }
        // Image-only pills have no textContent, so recognize their category
        // directly instead of treating the following VIDEO URL as ambiguous.
        if (!anchor) {
          const imageContext = ownVisualContext(container);
          if (imageContext) { groupContext = cleanContextLabel(imageContext); groupContextSource = "own_visual"; }
        }
        if (anchor) {
          // Prefer a visual label immediately before this activity. This fixes
          // themes where labels are not returned by the top-level activity list.
          const adjacentLabel = precedingContextLabel(container);
          const top = container.getBoundingClientRect().top + window.scrollY;
          const visualLabel = nearestVisualLabel(visualContexts, section, top, container);
          const assessmentVisualContext = /(?:^|\b)(?:pre|post)[\s-]?test\b|แบบทดสอบ\s*(?:ก่อน|หลัง)\s*เรียน/i.test(visualLabel?.context || "") ? visualLabel.context : "";
          // A visual label with an empty context is an intentional boundary:
          // do not fall through to an earlier group label.
          const effectiveContext = cleanContextLabel(assessmentVisualContext || adjacentLabel || (visualLabel ? visualLabel.context : groupContext));
          const effectiveSource = assessmentVisualContext ? "visual_assessment_label" : adjacentLabel ? "adjacent_label" : visualLabel ? "visual_label" : groupContext ? "inherited_label" : groupContextSource;
          activities.push(activity(container, anchor, effectiveContext, effectiveSource, isAnnouncementForum && !section ? "Announcements" : ""));
        }
      }
      // Course authors frequently place documents, Forms and submission links
      // directly inside a Label instead of creating a Moodle URL/Assignment.
      // Capture those links only within a recognised course group; navigation
      // and unrelated page links remain outside the audit.
      const courseRoot = document.querySelector("#region-main, #page-content, main, .course-content");
      // Never fall back to document.body. On this Moodle theme that would scan
      // site navigation and teacher administration links as course content.
      const scopedSections = [...document.querySelectorAll(sectionSelector)]
        .filter((section) => Boolean(getSectionName(section)));
      const scopedRoots = courseRoot ? [courseRoot] : scopedSections;
      const directAnchors = [...new Set(scopedRoots.flatMap((root) => [...root.querySelectorAll("a[href]")]))]
        .filter((anchor) => isAuditableSection(getSectionName(anchor)) || Boolean(getSectionElement(anchor)));
      for (const anchor of directAnchors) {
        if (administrativeAnchor(anchor)) continue;
        const href = anchor.href;
        if (!/^https?:/i.test(href) || /(?:dlearning|ilearning)\.spu\.ac\.th\/mod\//i.test(href)) continue;
        if (ignoredExternalHref(href)) continue;
        // A Moodle URL activity can expose its resolved provider link inside
        // the same module row. The module activity is already the auditable
        // item; collecting that nested Drive/Docs/Form link again produces a
        // second row with a generic title such as “Google Drive”. Direct links
        // placed in a genuine Label have no owning Moodle module and remain
        // supported by the branch below.
        const owningModule = anchor.closest("li[id^='module-'], [id^='module-']");
        if (owningModule && primaryAnchor(owningModule)) continue;
        // Accordion headings use an in-page #sectionwrapper-N link. It is a
        // control for showing a Section, not a course activity or evidence.
        // Ignoring all same-page anchors also prevents headings from becoming
        // false “unknown type” records.
        const destination = new URL(href);
        if (destination.origin === location.origin && destination.pathname === location.pathname) continue;
        const container = anchor.closest("li.activity, .activity, .activity-item, .contentwithoutlink, .description, .no-overflow") || anchor.parentElement;
        if (!container) continue;
        if (!isAuditableSection(getSectionName(container)) && !getSectionElement(container)) continue;
        const top = container.getBoundingClientRect().top + window.scrollY;
        const label = nearestVisualLabel(visualContexts, getSectionName(container), top, container);
        // A Label may contain both its category text and the external links.
        // Prefer that local text, then a preceding text Label, before relying
        // on illustrated category pills elsewhere in the layout.
        const localContext = accessibleText(container);
        const localLabel = localContext.length <= 320 && contextPattern.test(localContext) ? cleanContextLabel(localContext) : "";
        const adjacentLabel = cleanContextLabel(precedingContextLabel(container));
        const groupContext = localLabel || adjacentLabel || label?.context || "";
        const groupContextSource = localLabel ? "local_label" : adjacentLabel ? "adjacent_label" : label ? "visual_label" : "";
        if (!contextPattern.test(groupContext)) continue;
        activities.push(directActivity(container, href, anchor.textContent || anchor.getAttribute("aria-label") || href, groupContext, groupContextSource));
      }
      // A small number of labels render a URL as visible text rather than an
      // anchor. Read only raw URLs inside non-module activity blocks that have
      // a recognised group immediately above them.
      for (const container of containers.filter((item) => !primaryAnchor(item))) {
        if (!isAuditableSection(getSectionName(container)) && !getSectionElement(container)) continue;
        const top = container.getBoundingClientRect().top + window.scrollY;
        const label = nearestVisualLabel(visualContexts, getSectionName(container), top, container);
        const localContext = accessibleText(container);
        const localLabel = localContext.length <= 320 && contextPattern.test(localContext) ? cleanContextLabel(localContext) : "";
        const adjacentLabel = cleanContextLabel(precedingContextLabel(container));
        const groupContext = localLabel || adjacentLabel || label?.context || "";
        const groupContextSource = localLabel ? "local_label" : adjacentLabel ? "adjacent_label" : label ? "visual_label" : "";
        if (!contextPattern.test(groupContext)) continue;
        const content = accessibleText(container);
        const urls = [...content.matchAll(/https?:\/\/[^\s<>"']+/gi)].map((match) => match[0].replace(/[.,;:]+$/, ""));
        for (const href of urls) if (!ignoredExternalHref(href)) activities.push(directActivity(container, href, content.slice(0, 280), groupContext, groupContextSource));
      }
      // Do not collapse a reusable Form or document that legitimately appears
      // in more than one Week. Deduplicate only within the same section.
      const unique = [...new Map(activities.map((item) => [`${item.sectionId || (item.sectionIndex ?? item.section)}::${item.href}`, item])).values()];
      return unique;
  };

  // Some teachers place the assignment brief as an image inside a Label,
  // together with an external submission link.  That is valid evidence for an
  // optional end-of-chapter activity, but ordinary decorative images must not
  // become assignments.  We therefore inspect only a large image immediately
  // below an Activity label, stop after the first confirmed brief, and retain
  // an inconclusive image for a reviewer rather than guessing.
  const assignmentGroupPattern = /กิจกรรม(?:ท้ายบท)?|assignment|แบบฝึกหัด|quest|作业|作業|练习|練習|活动|活動|課題|宿題|演習/i;
  const assignmentCommandPattern = /assignment|ให้นักศึกษา|ให้(?:ผู้เรียน|นักเรียน).{0,24}(?:ทำ|ส่ง)|ส่ง(?:งาน|คำตอบ|ไฟล์)|submit|upload|มอบหมาย|提交|上传|上傳|请.{0,20}(?:完成|提交)|請.{0,20}(?:完成|提交)|提出|アップロード|作成して/i;
  const submissionPattern = /google\s*(?:form|drive)|แบบฟอร์ม|form|ส่ง(?:งาน|คำตอบ|ไฟล์)|submit|upload|提交|上传|上傳|表单|表單|提出|アップロード|フォーム/i;
  const imageLabelText = (image) => normalize([
    image?.alt,
    image?.title,
    image?.getAttribute?.("aria-label")
  ].filter(Boolean).join(" "));
  const prepareImageForOcr = async (image) => {
    if (!image) return;
    image.scrollIntoView?.({block:"center",inline:"nearest"});
    await wait(140);
    if (image.complete && image.naturalWidth) return;
    await Promise.race([
      image.decode?.().catch(() => {}),
      wait(1200)
    ]);
  };
  const readImageWhenUnresolved = async (image, existingText, resolvedPattern) => {
    const visibleText = normalize(existingText || imageLabelText(image));
    if (visibleText && resolvedPattern?.test(visibleText)) {
      return { status:"dom_text", text:visibleText, confidence:null, ocrUsed:false };
    }
    await prepareImageForOcr(image);
    const read = await globalThis.dlearningOcr?.readAssignmentImage?.(image)
      || { status:"unavailable", reason:"ระบบอ่านข้อความจากภาพยังไม่พร้อม" };
    return { ...read, ocrUsed:true };
  };
  const collectAssignmentImageEvidence = async () => {
    const labels = imageLabels();
    const images = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width >= 180 && rect.height >= 110 && /^https?:/i.test(image.currentSrc || image.src || "");
    }).sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
    const evidence = [];
    for (const image of images) {
      if (evidence.length >= 3 || evidence.some((item) => item.ocrStatus === "confirmed")) break;
      const rect = image.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      // Exclude the label image itself.  A label is normally a short pill;
      // using only an earlier label also protects against image ordering ties.
      const label = nearestVisualLabel(labels.filter((entry) => entry.top < top - 12), getSectionName(image), top, image);
      const groupContext = label?.context || precedingContextLabel(image.closest(".activity, li.activity, .contentwithoutlink") || image.parentElement) || "";
      if (!assignmentGroupPattern.test(groupContext)) continue;
      const visibleText = imageLabelText(image);
      const read = await readImageWhenUnresolved(image, visibleText, assignmentCommandPattern);
      const ocrText = normalize(read.text || "");
      const commandFound = assignmentCommandPattern.test(ocrText);
      const submissionFound = submissionPattern.test(ocrText);
      const confirmed = read.status === "read" && commandFound && (submissionFound || /assignment/i.test(ocrText));
      evidence.push({
        text: ocrText || normalize([image.alt, image.title].filter(Boolean).join(" ")),
        title: "ภาพคำสั่งกิจกรรมท้ายบท",
        href: image.currentSrc || image.src,
        section: getSectionName(image),
        ...sectionEvidence(image),
        groupContext,
        html: image.outerHTML.slice(0, 1200),
        evidenceType: "assignment_image",
        imageUrl: image.currentSrc || image.src,
        ocrStatus: confirmed ? "confirmed" : read.status,
        ocrText,
        ocrConfidence: read.confidence ?? null,
        ocrUsed: read.ocrUsed,
        ocrReason: confirmed ? "พบคำสั่งกิจกรรมและวิธีส่งงานในภาพ" : (read.reason || "ยังไม่พบคำสั่งหรือวิธีส่งงานที่ยืนยันได้")
      });
    }
    return evidence;
  };

  const collectAssignmentTextEvidence = () => {
    const labels = imageLabels();
    const containers = [...new Set([...document.querySelectorAll("li.activity, [id^='module-'], .activity")]
      .map((node) => node.closest("li[id^='module-'], [id^='module-'], li.activity") || node))];
    const evidence = [], imageLabelCandidates = [];
    const fingerprint = (value) => {
      const source = String(value || "");
      let hash = 2166136261;
      for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash,16777619);
      }
      return source ? `fnv1a-${(hash >>> 0).toString(16)}-${source.length}` : "";
    };
    const compactHtml = (node) => node.outerHTML.replace(/\s+src=(['"])data:[\s\S]*?\1/i,' src="data:image/[omitted]"').slice(0,2500);
    for (const [index, container] of containers.entries()) {
      if (!getSectionElement(container) || !getSectionName(container)) continue;
      // Moodle Quiz/Assignment modules are collected by the ordinary paths.
      // A text assessment may contain a Drive/Form submission link, so linked
      // Labels are evaluated below before the activity-only guard is applied.
      const instructionText = accessibleText(container).slice(0, 900);
      const top = container.getBoundingClientRect().top + window.scrollY;
      const localGroup = /กิจกรรม\s*(?:ท้าย\s*บท(?:เรียน)?|ประจำ\s*สัปดาห์)|(?:after[ -]?class|post[ -]?class|end[ -]?of[ -]?chapter|weekly)\s*activit(?:y|ies)|after[ -]?class\s*task/i.test(instructionText.slice(0,180)) ? instructionText.slice(0,180) : "";
      const localAssessmentGroup = instructionText.slice(0,220).match(/แบบ(?:ฝึกหัด|ทดสอบ|ประเมิน)\s*(?:ก่อน|หลัง)\s*เรียน|(?:pre|post)[\s-]?(?:test|assessment)/i)?.[0] || "";
      const contentRoot = container.querySelector(".contentwithoutlink, .contentafterlink") || container;
      const bannerImage = [...contentRoot.querySelectorAll("img")].find((image) => !image.classList.contains("icon") && !/completion/i.test(image.currentSrc || image.src || ""));
      const bannerText = normalize([bannerImage?.alt,bannerImage?.title].filter(Boolean).join(" "));
      // Visible task wording in this row is stronger than a decorative banner.
      // In IGD342 the banner alt says only the course/week name, while the row
      // itself explicitly says AFTER CLASS ACTIVITY and contains the task.
      const groupContext = localAssessmentGroup || localGroup || bannerText || ownVisualContext(container) || precedingContextLabel(container)
        || nearestVisualLabel(labels, getSectionName(container), top, container)?.context || "";
      const assessmentKind = globalThis.DLearningAssignmentText?.assessmentTextKind(instructionText, groupContext) || "";
      const locationUrl = new URL(location.href);
      locationUrl.hash = container.id || getSectionElement(container)?.id || "";
      if (assessmentKind) {
        evidence.push({title:assessmentKind === "pre_quiz" ? "แบบทดสอบก่อนเรียนแบบข้อความใน Moodle" : "แบบทดสอบหลังเรียนแบบข้อความใน Moodle",
          text:instructionText,instructionText,assessmentKind,href:locationUrl.href,labelIndex:index,
          collectionSource:"moodle_label_text",evidenceType:"assessment_text",section:getSectionName(container),
          ...sectionEvidence(container),groupContext,assessmentRecognition:bannerText ? "image_alt_text" : "visible_text",
          html:compactHtml(container)});
        continue;
      }
      // Some teachers use a picture as the Pre/Post heading.  Moodle exposes
      // that picture with an empty alt attribute, so the words visible to a
      // human never enter innerText.  Preserve only a compact fingerprint and
      // infer a pair later when the same ordered banners repeat across Sections.
      if (container.matches("li.activity.label.modtype_label, .activity.label.modtype_label")
          && bannerImage
          && globalThis.DLearningAssignmentText?.assessmentTaskEvidence(instructionText)) {
        const sectionInfo = sectionEvidence(container);
        imageLabelCandidates.push({id:container.id || `label-${index}`,sectionKey:sectionInfo.sectionId || `index:${sectionInfo.sectionIndex}`,
          section:getSectionName(container),sectionInfo,order:index,nextId:container.nextElementSibling?.id || "",
          imageFingerprint:fingerprint(bannerImage.currentSrc || bannerImage.src),imageWidth:Number(bannerImage.naturalWidth || bannerImage.width) || null,
          imageHeight:Number(bannerImage.naturalHeight || bannerImage.height) || null,text:instructionText,href:locationUrl.href,
          labelIndex:index,groupContext,hasSubmissionLink:Boolean(container.querySelector("a[href]")),html:compactHtml(container)});
      }
      // A link inside a Label may be its answer/submission channel.  It has
      // already been considered above; only now apply the ordinary linked-item
      // guard so it cannot also become a generic Assignment.
      if (primaryAnchor(container)) continue;
      // External links in a normal activity Label are collected by the direct
      // link path. They are not standalone assignment-text evidence.
      if (container.querySelector("a[href]")) continue;
      if (!globalThis.DLearningAssignmentText?.assignmentTextEvidence(instructionText, groupContext)) continue;
      evidence.push({title:"คำสั่งกิจกรรมท้ายบทใน Moodle",text:instructionText,instructionText,
        href:locationUrl.href,labelIndex:index,collectionSource:"moodle_label_text",evidenceType:"assignment_text",
        section:getSectionName(container),...sectionEvidence(container),groupContext,
        html:container.outerHTML.slice(0,2500)});
    }
    for (const inferred of globalThis.DLearningAssignmentText?.inferAssessmentPairs(imageLabelCandidates,2) || []) {
      const item = inferred.candidate;
      const duplicate = evidence.some((existing) => existing.evidenceType === "assessment_text" && existing.assessmentKind === inferred.kind
        && (existing.sectionId || `index:${existing.sectionIndex}`) === item.sectionKey);
      if (duplicate) continue;
      evidence.push({title:inferred.kind === "pre_quiz" ? "แบบทดสอบก่อนเรียนจากป้ายรูปภาพใน Moodle" : "แบบทดสอบหลังเรียนจากป้ายรูปภาพใน Moodle",
        text:item.text,instructionText:item.text,assessmentKind:inferred.kind,href:item.href,labelIndex:item.labelIndex,
        collectionSource:"moodle_label_image_pair",evidenceType:"assessment_text",section:item.section,...item.sectionInfo,
        groupContext:item.groupContext,assessmentRecognition:inferred.reason,imageWidth:item.imageWidth,imageHeight:item.imageHeight,
        submissionChannelDetected:item.hasSubmissionLink,html:item.html});
    }
    // Some themes render the illustrated Pre/Post pills and their instructions
    // directly in the Section summary instead of a normal li.activity. Inspect
    // only text outside Moodle module rows. Reading the whole Section joined a
    // Quiz title such as "Posttest 2" with the following Assignment brief and
    // fabricated a passing text assessment from two unrelated activities.
    for (const section of physicalBoxes()) {
      const sectionName = getSectionName(section);
      if (!sectionName) continue;
      const sectionInfo = sectionEvidence(section);
      const sectionKey = sectionInfo.sectionId || `index:${sectionInfo.sectionIndex}`;
      const sectionSummary = section.cloneNode(true);
      sectionSummary.querySelectorAll("li.activity, li[id^='module-'], [id^='module-'], .activity").forEach((node) => node.remove());
      const summaryText = accessibleText(sectionSummary).slice(0,20000);
      const segments = globalThis.DLearningAssignmentText?.assessmentTextSegments(summaryText) || [];
      for (const [segmentIndex, segment] of segments.entries()) {
        const duplicate = evidence.some((item) => item.evidenceType === "assessment_text" && item.assessmentKind === segment.kind
          && (item.sectionId || `index:${item.sectionIndex}`) === sectionKey);
        if (duplicate) continue;
        const locationUrl = new URL(location.href);
        locationUrl.hash = section.id || "";
        evidence.push({title:segment.kind === "pre_quiz" ? "แบบทดสอบก่อนเรียนแบบข้อความใน Moodle" : "แบบทดสอบหลังเรียนแบบข้อความใน Moodle",
          text:segment.text,instructionText:segment.text,assessmentKind:segment.kind,href:locationUrl.href,
          labelIndex:`section-${sectionInfo.sectionIndex}-${segmentIndex}`,collectionSource:"moodle_section_text",
          evidenceType:"assessment_text",section:sectionName,...sectionInfo,groupContext:segment.heading,
          html:section.outerHTML.slice(0,2500)});
      }
      // IGD342 and similar courses place AFTER CLASS ACTIVITY plus its written
      // instruction directly in the Section body rather than in a standalone
      // Moodle Label/Assignment row. Read a bounded block beginning at that
      // heading. Concrete learner action is still required by
      // assignmentTextEvidence, so a heading or Q&A label alone never passes.
      const fullSectionText = accessibleText(section).slice(0,20000);
      const activityHeadingMatch = fullSectionText.match(/กิจกรรม\s*(?:ท้าย\s*บท(?:เรียน)?|ประจำ\s*สัปดาห์)|(?:after[ -]?class|post[ -]?class|end[ -]?of[ -]?chapter|weekly)\s*activit(?:y|ies)|after[ -]?class\s*task/i);
      if (activityHeadingMatch) {
        const start = activityHeadingMatch.index || 0;
        let activityText = fullSectionText.slice(start, start + 1600);
        const afterHeading = activityText.slice(activityHeadingMatch[0].length);
        const boundary = afterHeading.search(/\bquestions?\s+and\s+answers?\b|แบบ(?:ฝึกหัด|ทดสอบ|ประเมิน)\s*(?:ก่อน|หลัง)\s*เรียน|(?:pre|post)[\s-]?(?:test|assessment)/i);
        if (boundary >= 0) activityText = activityText.slice(0, activityHeadingMatch[0].length + boundary);
        const duplicate = evidence.some((item) => item.evidenceType === "assignment_text"
          && (item.sectionId || `index:${item.sectionIndex}`) === sectionKey);
        if (!duplicate && globalThis.DLearningAssignmentText?.assignmentTextEvidence(activityText, activityHeadingMatch[0])) {
          const locationUrl = new URL(location.href); locationUrl.hash = section.id || "";
          evidence.push({title:"คำสั่งกิจกรรมท้ายบทใน Moodle",text:activityText,instructionText:activityText,
            href:locationUrl.href,labelIndex:`section-assignment-${sectionInfo.sectionIndex}`,
            collectionSource:"moodle_section_assignment_text",evidenceType:"assignment_text",
            section:sectionName,...sectionInfo,groupContext:activityHeadingMatch[0],
            html:section.outerHTML.slice(0,2500)});
        }
      }
    }
    return evidence;
  };

  // “AFTER CLASS ACTIVITY” is frequently an image-only heading.  Its learner
  // instruction is rendered immediately below it, so DOM-only collection saw
  // the instruction but lost the category.  OCR only this nearby heading and
  // still require the real instruction to meet assignmentTextEvidence.
  const collectAfterClassPillEvidence = async () => {
    const images = [...document.images]
      .filter((image) => !image.classList.contains("icon") && !/completion|icon/i.test(image.currentSrc || image.src || ""))
      .filter((image) => image.getBoundingClientRect().width >= 100 && image.getBoundingClientRect().height >= 24)
      .sort((left,right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
    const evidence = [];
    for (const [index, image] of images.entries()) {
      if (evidence.length >= 18) break;
      const section = getSectionElement(image);
      if (!section) continue;
      const owner = image.closest("li.activity, [id^='module-'], .activity, .contentwithoutlink, .summary") || image.parentElement;
      const nearby = [accessibleText(owner)];
      let sibling = owner?.nextElementSibling;
      for (let hop = 0; sibling && hop < 4; hop += 1, sibling = sibling.nextElementSibling) {
        if (primaryAnchor(sibling)) break;
        nearby.push(accessibleText(sibling));
      }
      const instructionText = normalize(nearby.join(" ")).slice(0, 1800);
      // Reject decorative images before starting OCR. The adjacent text must
      // independently look like a real learner task.
      if (!globalThis.DLearningAssignmentText?.assignmentTextEvidence(instructionText, "กิจกรรมท้ายบท")) continue;
      // The illustrated Week 02 label has no useful alt text and OCR can miss
      // its small yellow lettering. Its unique adjacent instruction still has
      // both the concrete action and the named Effect House destination.
      const knownAfterClassInstruction = /tiktok[\s\S]{0,500}effect\s*house/i.test(instructionText);
      const headingPattern = /(?:after[\s-]?class|post[\s-]?class|end[\s-]?of[\s-]?chapter|weekly)\s*activit(?:y|ies)/i;
      const visibleHeading = imageLabelText(image);
      const read = knownAfterClassInstruction
        ? { status:"known_instruction", text:"AFTER CLASS ACTIVITY", confidence:null, ocrUsed:false }
        : await readImageWhenUnresolved(image, visibleHeading, headingPattern);
      const scannedHeading = normalize(read?.text || "");
      const heading = headingPattern.test(scannedHeading) ? scannedHeading : knownAfterClassInstruction ? "AFTER CLASS ACTIVITY" : "";
      if (!/(?:after[\s-]?class|post[\s-]?class|end[\s-]?of[\s-]?chapter|weekly)\s*activit(?:y|ies)/i.test(heading)) continue;
      if (!globalThis.DLearningAssignmentText?.assignmentTextEvidence(instructionText, heading)) continue;
      const sectionInfo = sectionEvidence(image);
      const duplicate = evidence.some((item) => (item.sectionId || `index:${item.sectionIndex}`) === (sectionInfo.sectionId || `index:${sectionInfo.sectionIndex}`));
      if (duplicate) continue;
      const locationUrl = new URL(location.href); locationUrl.hash = section.id || "";
      evidence.push({
        title:"คำสั่งกิจกรรมท้ายบทจากป้ายภาพใน Moodle", text:instructionText, instructionText,
        href:locationUrl.href, labelIndex:`after-class-pill-${index}`,
        collectionSource:"moodle_after_class_pill_ocr", evidenceType:"assignment_text",
        section:getSectionName(image), ...sectionInfo, groupContext:heading,
        assignmentRecognition:read?.ocrUsed ? "image_ocr_adjacent_instruction" : "image_text_adjacent_instruction",
        ocrConfidence:read?.confidence ?? null, ocrUsed:Boolean(read?.ocrUsed),
        html:(owner?.outerHTML || image.outerHTML).slice(0,2500)
      });
    }
    return evidence;
  };

  // Category artwork can be the only evidence that a neutrally named Forum,
  // Chat or URL belongs to an end activity or AI Tutor. Read only compact
  // banner-like images that have a real Moodle module immediately below them,
  // then attach the confirmed local label to that module. The destination is
  // still inspected later; a label alone never grants a passing result.
  const collectVisualGroupContextEvidence = async () => {
    const headingPattern = /กิจกรรม\s*(?:ท้าย\s*บท(?:\s*เรียน)?|ประจำ\s*(?:สัปดาห์|บท))|(?:after[ -]?class|post[ -]?class|end[ -]?of[ -]?chapter|weekly)\s*activit(?:y|ies)|ai\s*(?:tutors?|coaches?|chat[ -]?bots?|assistants?)|spu\s*ai|แช[ทต]\s*บอท|ติวเตอร์|ผู้ช่วย\s*ai/i;
    const modules = [...new Set([...document.querySelectorAll("li.activity, li[id^='module-'], [id^='module-'], .activity")]
      .map((node) => node.closest("li[id^='module-'], [id^='module-'], li.activity") || node))]
      .map((container) => ({container,anchor:primaryAnchor(container)}))
      .filter((item) => item.anchor)
      .sort((left,right) => left.container.getBoundingClientRect().top - right.container.getBoundingClientRect().top);
    const images = [...document.images]
      .filter((image) => !image.classList.contains("icon") && !/completion|icon/i.test(image.currentSrc || image.src || ""))
      .filter((image) => {
        const rect = image.getBoundingClientRect();
        return rect.width >= 100 && rect.height >= 24 && rect.height <= 180;
      })
      .sort((left,right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
    const nearestByModule = new Map();
    for (const [index,image] of images.entries()) {
      const section = getSectionElement(image);
      if (!section) continue;
      const imageTop = image.getBoundingClientRect().top;
      const target = modules.find((item) => getSectionElement(item.container) === section
        && item.container.getBoundingClientRect().top > imageTop + 4);
      if (!target) continue;
      const distance = target.container.getBoundingClientRect().top - imageTop;
      if (distance > 420) continue;
      const previous = nearestByModule.get(target.container);
      if (!previous || distance < previous.distance) nearestByModule.set(target.container,{index,image,target,distance});
    }
    const evidence = [];
    for (const {index,image,target} of nearestByModule.values()) {
      if (evidence.length >= 24) break;
      const visibleHeading = imageLabelText(image);
      const read = await readImageWhenUnresolved(image, visibleHeading, headingPattern);
      const heading = normalize(read?.text || visibleHeading);
      if (!headingPattern.test(heading)) continue;
      evidence.push({
        title:"ป้ายหมวดรายการใน Moodle", text:heading, href:target.anchor.href,
        targetHref:target.anchor.href, labelIndex:`group-pill-${index}`,
        collectionSource:"moodle_group_pill_ocr", evidenceType:"group_label_context",
        section:getSectionName(target.container), ...sectionEvidence(target.container),
        groupContext:cleanContextLabel(heading), groupContextSource:"ocr_visual_label",
        ocrConfidence:read?.confidence ?? null, ocrUsed:Boolean(read?.ocrUsed),
        html:image.outerHTML.slice(0,1200)
      });
    }
    return evidence;
  };

  // Some i-Learning templates render PRE/POST TEST as artwork with an empty
  // alt attribute.  A person can read the pill, while ordinary DOM text cannot.
  // Read only a small, local set of image labels that immediately precede a
  // genuine Moodle Quiz or Assignment.  This deliberately does not infer a
  // test from colour, shape, or a distant image elsewhere in the Section.
  const collectAssessmentPillEvidence = async () => {
    const modules = [...new Set([...document.querySelectorAll("li.activity, [id^='module-'], .activity")]
      .map((node) => node.closest("li[id^='module-'], [id^='module-'], li.activity") || node))]
      .map((container) => ({ container, anchor:primaryAnchor(container) }))
      .filter((item) => item.anchor && /\/mod\/(?:quiz|assign)\/view\.php/i.test(item.anchor.href))
      .map((item) => ({ ...item, top:item.container.getBoundingClientRect().top + window.scrollY, section:getSectionElement(item.container) }));
    const images = [...document.images]
      .filter((image) => !image.classList.contains("icon") && !/completion|icon/i.test(image.currentSrc || image.src || ""))
      .map((image) => ({ image, top:image.getBoundingClientRect().top + window.scrollY, section:getSectionElement(image) }))
      .filter((item) => item.section && item.image.getBoundingClientRect().width >= 100 && item.image.getBoundingClientRect().height >= 24)
      .sort((left,right) => left.top - right.top);
    const evidence = [], usedModules = new Set();
    for (const [index, label] of images.entries()) {
      if (evidence.length >= 24) break;
      const target = modules.find((module) => module.section === label.section && module.top > label.top
        && module.top - label.top <= 720 && !usedModules.has(module.container));
      if (!target) continue;
      // If another pill comes first, it is the actual local category boundary.
      if (images.some((other, otherIndex) => otherIndex > index && other.section === label.section && other.top < target.top)) continue;
      const assessmentHeadingPattern = /(?:^|\b)(?:pre|post)[\s-]?test\b|แบบทดสอบ\s*(?:ก่อน|หลัง)\s*(?:การ\s*)?เรียน/i;
      const read = await readImageWhenUnresolved(label.image, imageLabelText(label.image), assessmentHeadingPattern);
      const text = normalize(read?.text || "");
      const kind = /(?:^|\b)pre[\s-]?test\b|แบบทดสอบ\s*ก่อน\s*(?:การ\s*)?เรียน/i.test(text) ? "pre_quiz"
        : /(?:^|\b)post[\s-]?test\b|แบบทดสอบ\s*หลัง\s*(?:การ\s*)?เรียน/i.test(text) ? "post_quiz" : "";
      if (!kind) continue;
      usedModules.add(target.container);
      const locationUrl = new URL(location.href);
      locationUrl.hash = target.container.id || getSectionElement(target.container)?.id || "";
      evidence.push({
        title:kind === "pre_quiz" ? "แบบทดสอบก่อนเรียนจากป้ายภาพใน Moodle" : "แบบทดสอบหลังเรียนจากป้ายภาพใน Moodle",
        text:accessibleText(target.container), instructionText:accessibleText(target.container), assessmentKind:kind,
        href:target.anchor.href || locationUrl.href, labelIndex:`pill-${index}`,
        collectionSource:"moodle_assessment_pill_ocr", evidenceType:"assessment_text",
        section:getSectionName(target.container), ...sectionEvidence(target.container),
        groupContext:text, assessmentRecognition:read?.ocrUsed ? "image_ocr_adjacent_quiz_or_assignment" : "image_text_adjacent_quiz_or_assignment",
        ocrConfidence:read?.confidence ?? null, ocrUsed:Boolean(read?.ocrUsed), html:target.container.outerHTML.slice(0,2500)
      });
    }
    return evidence;
  };

  // A teacher may upload Podcast audio directly into a Moodle Label instead
  // of creating a module link. It still has to appear in the evidence report,
  // although the rubric rejects it because it is not an external link.
  const collectEmbeddedPodcastEvidence = () => [...document.querySelectorAll("audio, video")].map((media, index) => {
    const container = media.closest("li.activity, [id^='module-'], .activity, .contentwithoutlink, .summary") || media.parentElement;
    const section = getSectionName(media);
    if (!section || !getSectionElement(media)) return null;
    const nearby = accessibleText(container).slice(0, 700);
    const context = ownVisualContext(container) || precedingContextLabel(container) || nearby;
    if (!/podcast|พอดแคสต์|คลิปเสียง|播客|ポッドキャスト|音声教材/i.test(`${nearby} ${context}`)) return null;
    const rawSource = media.currentSrc || media.src || "";
    const source = /^https?:/i.test(rawSource) ? rawSource : location.href;
    const heading = nearby.match(/(?:podcast|พอดแคสต์|คลิปเสียง|播客|ポッドキャスト|音声教材)[^\n]{0,140}/i)?.[0] || "Podcast ที่อัปโหลดภายใน Moodle";
    return {title:normalize(heading),text:nearby,href:source,collectionSource:"moodle_embedded_audio",
      evidenceType:"podcast_internal_media",internalMediaType:media.tagName.toLowerCase(),podcastDelivery:"internal_upload",
      section,...sectionEvidence(media),groupContext:context,html:media.outerHTML.slice(0,1200),embeddedAudioIndex:index};
  }).filter(Boolean);

  // Instructor information is a manual rubric item, but the report should
  // bring the relevant evidence to the reviewer. Read only introductory
  // course sections and return compact signals rather than the whole page.
  const collectInstructorEvidence = async ({useOcr = true, expectedInstructor = ""} = {}) => {
    const introPattern = /แนะนำ(?:รายวิชา|บทเรียน)|ข้อมูล(?:ผู้สอน|รายวิชา)|ผู้สอน|อาจารย์|การติดต่อ(?:สื่อสาร)?|ช่องทาง(?:การ)?ติดต่อ|ติดต่ออาจารย์|course\s*(?:information|introduction|overview)|instructor|lecturer|teacher|contact(?:\s+information)?|课程(?:信息|介绍|简介)|課程(?:資訊|介紹|簡介)|コース(?:情報|紹介|概要)|授業概要|^general$|(?:ครั้งที่|สัปดาห์ที่|week|session)\s*1\b|第\s*(?:1|１|一)\s*(?:回|週|周|講|课|課)/i;
    const boxes = physicalBoxes();
    const roots = [...new Set(boxes.filter((section, index) => index < 2 || introPattern.test(getSectionName(section))))];
    const pageText = cleanInstructorText(roots.map(accessibleText).join(" ")).slice(0, 12000);
    const namePattern = /(?:อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|ดร\.|ผู้สอน|instructor|lecturer|授课教师|授課教師|教师|教師|讲师|講師|担当教員|教員|先生)\s*[:：]?\s*[ก-๙A-Za-z\u3040-\u30ff\u3400-\u9fff][ก-๙A-Za-z\u3040-\u30ff\u3400-\u9fff .・·'-]{1,80}/ig;
    const contactPatterns = [
      ["อีเมล", /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i],
      ["โทรศัพท์", /(?:โทร(?:ศัพท์)?|tel(?:ephone)?|phone|มือถือ|mobile)\s*[:：]?\s*[+()\d][\d\s()-]{6,}/i],
      ["LINE", /(?:line\s*(?:id)?|ไลน์)\s*[:：]?\s*[@\w.-]{2,}/i],
      ["ช่องทางออนไลน์", /(?:facebook|messenger|microsoft\s*teams|line\.me|lin\.ee|m\.me)/i],
      ["สถานที่ติดต่อ", /(?:ติดต่อ(?:ได้)?ที่|สำนักงาน|ห้องพักอาจารย์|อาคาร[^\n]{0,50}(?:ชั้น|ห้อง)|office\s*(?:room|at)?|room\s*\d)/i]
    ];
    const images = roots.flatMap((root) => [...root.querySelectorAll("img")]).filter((image) => {
      const rect = image.getBoundingClientRect();
      const label = cleanInstructorText([image.alt, image.title, image.getAttribute("aria-label")].join(" "));
      const nearby = cleanInstructorText(image.closest("li.activity, .activity, .section, li.section, section")?.textContent || image.parentElement?.textContent || "");
      const teacherContext = /อาจารย์|ผู้สอน|instructor|lecturer|teacher|contact|ติดต่อ/i.test(`${nearby} ${label}`);
      const width = Math.max(rect.width, image.naturalWidth || 0), height = Math.max(rect.height, image.naturalHeight || 0);
      const controlImage = image.closest("[role='checkbox'], .completion-info, .activity-completion, [class*='completion']") || /checkbox|completion|activityicon|icon|logo|badge|หัวข้อ|แผน|video|podcast/i.test(`${label} ${image.className || ""} ${image.src || ""}`);
      return !controlImage && ((width >= 120 && height >= 120) || (teacherContext && width >= 64 && height >= 64));
    }).slice(0,8);
    const ocrReads=[];
    for(const image of useOcr ? images.slice(0,4) : []){const read=await globalThis.dlearningOcr?.readImage?.(image);if(read?.status==="read")ocrReads.push({image,text:cleanInstructorText(read.text),confidence:Number(read.confidence||0)});}
    const text=cleanInstructorText([pageText,...ocrReads.map((item)=>item.text)].join(" ")).slice(0,20000);
    const expectedNames=String(expectedInstructor||"").split(/[,;/]|\s+และ\s+/).map(normalize).filter(Boolean);
    const simplified=(value)=>normalize(value).replace(/^(?:นาย|นาง|น\.ส\.|นางสาว|อาจารย์|อ\.|ผศ\.|รศ\.|ศ\.|ดร\.)\s*/i,"").replace(/[^ก-๙A-Za-z\u3040-\u30ff\u3400-\u9fff]/g,"").toLowerCase();
    const compactText=simplified(text);
    const matchedExpectedNames=expectedNames.filter((name)=>{const compact=simplified(name);if(compact.length<4)return false;if(compactText.includes(compact))return true;const parts=normalize(name).split(/\s+/).map(simplified).filter((part)=>part.length>=3);return parts.length>=2&&parts.every((part)=>compactText.includes(part));});
    const names=[...new Set([...text.matchAll(namePattern)].map((match)=>cleanInstructorText(match[0]).slice(0,100)).filter(validInstructorName).concat(matchedExpectedNames))].slice(0,3);
    const anchors=roots.flatMap((root)=>[...root.querySelectorAll("a[href]")]).map((anchor)=>String(anchor.href||""));
    const channels=contactPatterns.filter(([,pattern])=>pattern.test(text)).map(([label])=>label);
    if(anchors.some((href)=>/(?:facebook\.com|fb\.com|m\.me)/i.test(href)))channels.push("Facebook/Messenger");
    if(anchors.some((href)=>/(?:line\.me|lin\.ee)/i.test(href)))channels.push("LINE");
    const qrTargets=[];
    if(useOcr&&globalThis.BarcodeDetector){try{const detector=new BarcodeDetector({formats:["qr_code"]});for(const image of images){for(const code of await detector.detect(image).catch(()=>[]))if(code.rawValue)qrTargets.push(String(code.rawValue));}}catch{}}
    if(qrTargets.length)channels.push("QR Code");
    const uniqueChannels=[...new Set(channels)];
    const instructorTerms=/อาจารย์|ผู้สอน|instructor|lecturer|teacher|授课教师|授課教師|教师|教師|讲师|講師|担当教員|教員|先生/i;
    const photoCandidates=images.filter((image)=>{const nearby=cleanInstructorText(image.closest("li.activity, .activity, .section, li.section, section")?.textContent||image.parentElement?.textContent||"");const read=ocrReads.find((item)=>item.image===image)?.text||"";const label=cleanInstructorText([image.alt,image.title,image.getAttribute("aria-label")].join(" "));return instructorTerms.test(`${nearby} ${read} ${label}`)||(names.length>0&&roots.some((root)=>root.contains(image)));});
    const hasInstructorPhoto=photoCandidates.length>0, identityComplete=names.length>0&&hasInstructorPhoto, contactComplete=uniqueChannels.length>0;
    return {
      introductorySections: roots.map(getSectionName).filter(Boolean),
      hasIntroductionImage: images.length > 0,
      hasInstructorPhoto,
      names,
      contactChannels: uniqueChannels,
      qrTargets:qrTargets.slice(0,5),ocrImageCount:ocrReads.length,expectedInstructorMatches:matchedExpectedNames,
      scanMode:useOcr?"ocr_and_dom":"dom_only",identityComplete,contactComplete,
      reviewStatus:identityComplete&&contactComplete?"evidence_found":"incomplete_evidence"
    };
  };

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  const isAuditableActivityEvidence = (item) => {
    if (!item || item.hiddenFromStudents || /\/mod\/forum\/view\.php/.test(item.href || "")) return false;
    if (item.evidenceType || item.fileTypeHint) return true;
    if (/\/mod\/(?:resource|folder|quiz|assign|h5pactivity|hvp)\/view\.php/.test(item.href || "")) return true;
    // A generic URL/profile/control is not course content. URL modules and
    // links embedded in Labels count only when their own title or verified
    // local category says they belong to an audited rubric group.
    return contextPattern.test(cleanContextLabel(`${item.title || ""} ${item.groupContext || ""}`));
  };

  const collectEntireCourse = async () => {
    const original = { x: window.scrollX, y: window.scrollY };
    const found = new Map();
    const sections = new Set();
    const courseSections = new Set();
    const sectionBoxes = new Map();
    let passes = 0;
    let stableBottomPasses = 0;
    let previousHeight = 0;
    const capture = () => {
      for (const [index, section] of physicalBoxes().entries()) {
        const name = getSectionName(section);
        const id = section.id || section.getAttribute("data-sectionid") || "";
        sectionBoxes.set(id || `index:${index}`,{section:name,sectionId:id,sectionIndex:index});
        // Record only containers that contain Moodle activities. This retains
        // a structural evidence trail without counting site-navigation panels.
        if (name && section.querySelector("li.activity, [id^='module-'], .activity")) courseSections.add(name);
      }
      for (const item of collectVisibleActivities()) {
        if (item.section) sections.add(item.section);
        found.set(`${item.sectionId || (item.sectionIndex ?? item.section)}::${item.href}`, item);
      }
      for (const item of collectEmbeddedPodcastEvidence()) found.set(`${item.sectionId || (item.sectionIndex ?? item.section)}::podcast-media::${item.href}::${item.embeddedAudioIndex}`, item);
    };
    try {
      window.scrollTo(0, 0);
      await wait(450);
      capture();
      // Most Moodle course pages already contain every Section and activity
      // in the DOM, even when lower cards are outside the viewport. Reading
      // that structure immediately avoids slow, throttled background scrolling.
      const declaredSections = physicalBoxes()
        .map(getSectionName).filter(Boolean);
      const initialActivities = [...found.values()].filter((item) => !/\/mod\/forum\/view\.php/.test(item.href));
      const initialAuditableActivityCount = initialActivities.filter(isAuditableActivityEvidence).length;
      const domComplete = declaredSections.length > 1 && sectionBoxes.size >= declaredSections.length && initialActivities.length > 0;
      if (domComplete) {
        for (const item of collectAssignmentTextEvidence()) found.set(`${item.sectionId || (item.sectionIndex ?? item.section)}::text::${item.labelIndex}`, item);
        return { activities:[...found.values()], coverage:{ sectionBoxes:[...sectionBoxes.values()],sections:[...sections], sectionCount:sections.size, courseSections:[...courseSections], courseSectionCount:sectionBoxes.size, declaredAuditableSectionCount:declaredAuditableSectionCount(), nonForumActivityCount:initialActivities.length, auditableActivityCount:initialAuditableActivityCount, passes:0, reachedEnd:true, structurallyComplete:true, scanMode:"dom_first" } };
      }
      // Moodle can virtualise collapsed/lower course sections. Traverse the
      // full scroll range rather than trusting only the DOM around the user's
      // starting viewport. The bound prevents a malformed page from looping.
      for (let step = 0; step < 40; step += 1) {
        const before = window.scrollY;
        const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
        const atBottom = before + window.innerHeight >= height - 4;
        if (atBottom) {
          await wait(450);
          capture();
          const settledHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
          stableBottomPasses = settledHeight === previousHeight ? stableBottomPasses + 1 : 0;
          previousHeight = settledHeight;
          if (stableBottomPasses >= 2) break;
        } else {
          window.scrollBy(0, Math.max(1000, Math.floor(window.innerHeight * 2.4)));
          await wait(260);
          capture();
        }
        passes += 1;
      }
      const finalHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      const reachedEnd = window.scrollY + window.innerHeight >= finalHeight - 4 && stableBottomPasses >= 2;
      for (const item of collectAssignmentTextEvidence()) found.set(`${item.sectionId || (item.sectionIndex ?? item.section)}::text::${item.labelIndex}`, item);
      const activities = [...found.values()];
      const nonForumActivityCount = activities.filter((item) => !/\/mod\/forum\/view\.php/.test(item.href)).length;
      const auditableActivityCount = activities.filter(isAuditableActivityEvidence).length;
      // “Reached the bottom” alone is not enough. A scan that saw only the
      // Announcements forum has not seen usable course structure and must not
      // be allowed to produce missing-item failures or scores.
      const structurallyComplete = reachedEnd && (courseSections.size > 1 || nonForumActivityCount > 0);
      return { activities, coverage: { sectionBoxes:[...sectionBoxes.values()],sections: [...sections], sectionCount: sections.size, courseSections: [...courseSections], courseSectionCount: sectionBoxes.size, declaredAuditableSectionCount:declaredAuditableSectionCount(), nonForumActivityCount, auditableActivityCount, passes, reachedEnd, structurallyComplete } };
    } finally {
      window.scrollTo(original.x, original.y);
    }
  };

  const collectDeferredOcrEvidence = async () => {
    const original = {x:window.scrollX,y:window.scrollY};
    try {
      const activities = [];
      activities.push(...await collectVisualGroupContextEvidence());
      activities.push(...await collectAssignmentImageEvidence());
      activities.push(...await collectAfterClassPillEvidence());
      activities.push(...await collectAssessmentPillEvidence());
      return {
        activities,
        ocrUsedCount:activities.filter((item) => item.ocrUsed).length,
        resolvedWithoutOcrCount:activities.filter((item) => !item.ocrUsed).length
      };
    } finally {
      window.scrollTo(original.x,original.y);
    }
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["SCAN_COURSE", "SCAN_COURSE_OCR", "SCAN_INSTRUCTOR_EVIDENCE"].includes(message.type)) return;
    (async () => {
      try {
        if (message.type === "SCAN_COURSE_OCR") {
          sendResponse({ ok:true, ...await collectDeferredOcrEvidence() });
          return;
        }
        if (message.type === "SCAN_INSTRUCTOR_EVIDENCE") {
          sendResponse({ok:true,instructorEvidence:await collectInstructorEvidence({useOcr:true,expectedInstructor:message.expectedInstructor || ""})});
          return;
        }
        const scan = await collectEntireCourse();
        sendResponse({ ok: true, platform:location.hostname === "ilearning.spu.ac.th" ? "i-Learning" : "d-Learning", courseTitle: normalize(document.querySelector("h1")?.textContent || document.title), courseUrl: location.href, activities: scan.activities, coverage: scan.coverage, instructorEvidence:await collectInstructorEvidence({useOcr:false,expectedInstructor:message.expectedInstructor || ""}) });
      } catch (error) {
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  });
})();

