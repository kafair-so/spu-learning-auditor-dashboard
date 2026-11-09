import { RULES, secondsFromClock, clock, mediaTimeResult, countedVideoSeconds, podcastComplianceResult, gnCoverageResult, normalizeGnTrack, canonicalMediaTarget, declaredDurationFromTitle, markDuplicateMediaItems, markHiddenTitleAlternatives, collapseDuplicateDestinationItems, verifiedVideoCandidate, creditBasedVideoToleranceMinutes } from "./rules.js";
import { classifyActivityWithEvidence, isTeachingPlanFile, promoteSectionLessonCandidates } from "./classifier.js";
import { MEDIA_PROVIDER_ORIGINS, providerOriginsForUrl, accessGateFromEvidence } from "./providers.js";
import { canonicalWeek, sectionKey, sectionTopology, groupedByWeek } from "./section-mapping.js";
import { applyMoodleFileTypeHint, resolveMoodleResourceEvidence } from "./resource-evidence.js";
import { withDeadline, isAuditStepTimeout } from "./timeouts.js";
import { durationFromProviderMarkup, isFastMetadataHost, mediaTypeFromProviderEvidence, unavailableMediaFromProviderMarkup, filterProviderMarkupAccessGate, selectProviderDurationEvidence } from "./media-metadata.js";
import { createLimiter, interleaveByKey, runBounded } from "./audit-scheduler.js";
import { summarizeInspectionTiming } from "./performance-summary.js";
import { applyPodcastReviews, podcastReviewKey, podcastEvidenceFingerprint } from "./podcast-review.js";
import { applyMediaReviews, requiresMediaReview, MEDIA_DECISIONS, finalReviewBlockers, finalReviewBlockerDetails, isDefinitiveMediaFailure, videoStatusWithFailures, mediaReviewFingerprint, updateNoVideoProbe } from "./media-review.js";
import { forumTaskKind, forumTaskEvidence } from "./forum-evidence.js";
import { normalizeMoodleFolderEntries } from "./moodle-folder.js";
import { MISPLACED_DOCUMENT_MESSAGE, looksLikeTeachingDocumentAssignment } from "./document-placement.js";
import { usableExternalTarget, rankExternalTargets, shouldSkipExternalFetch } from "./external-target.js";
import { isLmsHost, learningPlatformName, isClearlyEmptyCourseCoverage } from "./platform.js";
import { filePreviewIssueFromEvidence } from "./file-preview.js";
import { applyInstructorDecision, normalizeInstructorDecision, resolveInstructorDecision } from "./instructor-review.js";
import {assertCanCreateReport,ensureReportStoreMigrated,loadStoredReport,saveStoredReport,updateStorageHealth} from "./report-store.js";
import {buildDashboardRecord} from "./dashboard-export.js";
import {moodleQuizTolerance} from "./semester-policy.js";
import {CENTRAL_WORKER_STATE_KEY,emptyCentralResult,failedCentralResult,normalizeCentralJob} from "./central-worker-contract.js";
import {deduplicateAuditQueue} from "./queue-dedup.js";
import {aiChatOriginsForUrl, evaluateAiChatEvidence, trustedSpuAiProvider} from "./ai-chat.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Fast HTTP/metadata work may run wider, but at most two audit tabs may exist
// at once. This keeps the browser and the shared campus connection responsive.
const auditTabLimiter = createLimiter(2);
// Calculate a media deadline only after a reader slot is acquired. Previously
// six link workers could queue behind the two browser-tab slots while their
// 30-second deadline was already ticking, so a playable clip was reported as
// timed out before its Preview had even opened.
const mediaReadLimiter = createLimiter(2);
// Load two cloud-video pages concurrently. Only the brief foreground fallback
// is serialized so parallel metadata work cannot race the user's focused tab.
const foregroundProviderLimiter = createLimiter(1);
const auditTabReleases = new Map();
const auditTabStorageKey = (tabId) => `auditOwnedTab:${tabId}`;
const courseRunLimiter = createLimiter(1);
const podcastReviewLimiter = createLimiter(1);
const reportWriteLimiter = createLimiter(1);
// Migration, cleanup of the legacy duplicate copies and storage-health checks
// are automatic. Auditing remains usable while this bounded startup task runs.
void ensureReportStoreMigrated().then(() => updateStorageHealth()).catch((error) => recordAuditDiagnostic("report-store-startup-error", {message:error.message}));
let tabSafetyError = null;
let diagnosticWrite = Promise.resolve();
function recordAuditDiagnostic(phase, details = {}) {
  if (details.url) { try { const url = new URL(details.url); details = {...details,url:url.origin + url.pathname}; } catch { details = {...details,url:""}; } }
  diagnosticWrite = diagnosticWrite.catch(() => {}).then(async () => {
    const {auditDiagnostics = []} = await chrome.storage.local.get("auditDiagnostics");
    await chrome.storage.local.set({auditDiagnostics:[...auditDiagnostics,{at:Date.now(),phase,tabCount:auditTabReleases.size,...details}].slice(-200)});
  });
  return diagnosticWrite.catch(() => {});
}
async function rememberAuditTab(tab, runId) {
  if (!tab?.id) return;
  await chrome.storage.session.set({
    [auditTabStorageKey(tab.id)]: {
      tabId:tab.id,
      runId:runId || null,
      url:String(tab.url || ""),
      createdAt:Date.now()
    }
  });
}
async function persistedAuditTab(tabId) {
  const key = auditTabStorageKey(tabId);
  const stored = await chrome.storage.session.get(key).catch(() => ({}));
  return stored[key] || null;
}
async function forgetAuditTab(tabId) {
  await chrome.storage.session.remove(auditTabStorageKey(tabId)).catch(() => {});
}
function releaseAuditTab(tabId) {
  const release = auditTabReleases.get(tabId);
  auditTabReleases.delete(tabId);
  release?.();
  if (auditTabReleases.size === 0) tabSafetyError = null;
}
chrome.tabs.onRemoved.addListener((tabId) => {
  releaseAuditTab(tabId);
  void forgetAuditTab(tabId);
});
const isTabBusyError = (error) => /Tabs cannot be edited right now|dragging a tab|tab.*not.*editable/i.test(error?.message || "");
const isTabGoneError = (error) => /No tab with id|tab.*not found|No tab/i.test(error?.message || "");
function cancelledError() { const error = new Error("หยุดการตรวจตามคำสั่งผู้ใช้"); error.name = "AuditCancelled"; return error; }
async function throwIfCancelled(runId) {
  if (!runId) return;
  const { cancelAuditId } = await chrome.storage.local.get("cancelAuditId");
  if (cancelAuditId === runId) throw cancelledError();
}
async function waitInterruptibly(ms, runId) {
  let remaining = ms;
  while (remaining > 0) {
    await throwIfCancelled(runId);
    const slice = Math.min(350, remaining);
    await wait(slice);
    remaining -= slice;
  }
  await throwIfCancelled(runId);
}

async function createInactiveTab(url, runId, maxLoadMs = 15000) {
  if (tabSafetyError) throw tabSafetyError;
  const releaseTabSlot = await auditTabLimiter.acquire();
  if (tabSafetyError) { releaseTabSlot(); throw tabSafetyError; }
  let tab;
  let lastError;
  // Chrome occasionally locks its tab strip briefly (for example while its
  // own UI is restoring or moving a tab). This is transient, not a bad link.
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await throwIfCancelled(runId);
      try {
        // Do not time out creation: its uncancellable late result would leave
        // an untracked browser tab and release capacity too early.
        tab = await chrome.tabs.create({ url, active: false });
        auditTabReleases.set(tab.id, releaseTabSlot);
        await rememberAuditTab(tab, runId);
        await recordAuditDiagnostic("tab-open", {tabId:tab.id,url,runId});
        break;
      }
      catch (error) {
        lastError = error;
        if (!isTabBusyError(error) || attempt === 3) throw error;
        await waitInterruptibly(800 * (attempt + 1), runId);
      }
    }
  } catch (error) {
    if (!tab) releaseTabSlot();
    throw error;
  }
  if (!tab) {
    releaseTabSlot();
    throw lastError || new Error("ไม่สามารถเปิดแท็บตรวจลิงก์ได้");
  }
  try {
    const deadline = Date.now() + maxLoadMs;
    while (Date.now() < deadline) {
      await throwIfCancelled(runId);
      const current = await withDeadline(() => chrome.tabs.get(tab.id), 2500, "ตรวจสถานะแท็บ").catch(() => null);
      if (!current || current.status === "complete") break;
      await waitInterruptibly(350, runId);
    }
    const finalTab = await withDeadline(() => chrome.tabs.get(tab.id), 2500, "อ่านสถานะแท็บปลายทาง").catch(() => null);
    if (!finalTab) throw new Error("แท็บปลายทางปิดก่อนอ่าน");
    return finalTab;
  } catch (error) {
    await closeAuditTab(tab.id);
    throw error;
  }
}

async function closeAuditTab(tabId) {
  // Pause only media in task-owned tabs; never touch the user's tabs.
  const ownedInMemory = auditTabReleases.has(tabId);
  const ownedPersistently = ownedInMemory ? true : Boolean(await persistedAuditTab(tabId));
  if (!ownedPersistently) return;
  await withDeadline(() => chrome.scripting.executeScript({target:{tabId,allFrames:true},func:() => {
    document.querySelectorAll("audio,video").forEach((media) => { try { media.pause(); } catch {} });
  }}), 1500, "หยุดสื่อก่อนปิดแท็บ").catch(() => {});
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await withDeadline(() => chrome.tabs.remove(tabId), 3000, "ปิดแท็บตรวจปลายทาง");
      releaseAuditTab(tabId);
      await forgetAuditTab(tabId);
      await recordAuditDiagnostic("tab-closed",{tabId});
      return;
    } catch (error) {
      try { await chrome.tabs.get(tabId); }
      catch (checkError) { if (isTabGoneError(checkError)) { releaseAuditTab(tabId); await forgetAuditTab(tabId); return; } }
      await recordAuditDiagnostic("tab-close-retry",{tabId,attempt:attempt+1,error:error.message});
      if (attempt < 3) await wait(500 * (attempt + 1));
    }
  }
  // Retain the slot until Chrome confirms removal. Starting more players here
  // would defeat the two-tab cap and obscure the source of a browser crash.
  tabSafetyError = new Error("ปิดแท็บตรวจไม่สำเร็จ — หยุดเพื่อไม่เปิดแท็บสะสม");
  auditTabLimiter.cancelWaiting(tabSafetyError);
  throw tabSafetyError;
}

async function recoverOrphanedAuditTabs() {
  const stored = await chrome.storage.session.get(null).catch(() => ({}));
  const owned = Object.entries(stored).filter(([key]) => key.startsWith("auditOwnedTab:"));
  for (const [key, record] of owned) {
    const tabId = Number(record?.tabId ?? key.slice("auditOwnedTab:".length));
    if (!Number.isInteger(tabId)) { await chrome.storage.session.remove(key).catch(() => {}); continue; }
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) { await chrome.storage.session.remove(key).catch(() => {}); continue; }
    // Session storage is cleared with the browser session, so this ownership
    // marker cannot accidentally match a newly reused tab id after a restart.
    await closeAuditTab(tabId).catch(() => {});
  }
}

// A Manifest V3 worker can be suspended while a slow cloud preview is open.
// On its next start, remove only tabs bearing our session-scoped ownership tag.
void recoverOrphanedAuditTabs();

async function probeAccessGate(tabId) {
  const [{ result } = {}] = await withDeadline(() => chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    func: () => {
      const visible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const text = (element) => String(element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 260);
      const root = document.querySelector("main, [role='main']") || document.body;
      const heading = [...root.querySelectorAll("h1, h2, [role='heading']")].find(visible);
      const actions = [...root.querySelectorAll("button, a, [role='button']")]
        .filter(visible).map(text).filter(Boolean).slice(0, 12).join(" | ");
      const providerError = [...document.querySelectorAll("yt-playability-error-supported-renderers, ytd-player-error-message-renderer, #error-screen, .ytp-error, .ytp-error-content-wrap")]
        .filter(visible).map((element) => String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" | ").slice(0, 1000);
      return { url: location.href, heading: text(heading), actions, bodyText:`${providerError} ${text(root)}`.trim().slice(0, 1200) };
    }
  }), 5000, "อ่านสถานะสิทธิ์ปลายทาง");
  return accessGateFromEvidence(result || {});
}

async function confirmMissingFileAfterOneRefresh(tabId, gate, runId) {
  if (!["missing_file", "empty_media"].includes(gate?.status)) return gate;
  const originalStatus = gate.status;
  await throwIfCancelled(runId);
  await withDeadline(() => chrome.tabs.reload(tabId), 5000, "รีเฟรชตรวจลิงก์ที่ไม่พบไฟล์");
  // Do not sample the stale DOM immediately after reload(). Wait until Chrome
  // has navigated and the replacement page has had a short render window.
  // The complete retry remains bounded to four seconds.
  const deadline = Date.now() + 4000;
  let refreshed = null;
  let sawLoading = false;
  while (Date.now() < deadline) {
    await waitInterruptibly(250, runId);
    const current = await withDeadline(() => chrome.tabs.get(tabId), 2500, "ตรวจสถานะแท็บหลังรีเฟรช").catch(() => null);
    if (!current) break;
    if (current.status === "loading") sawLoading = true;
    if (current.status !== "complete") continue;
    // Chrome can report complete for the previous document during the first
    // task after reload. Requiring a loading transition or a small minimum
    // delay prevents that old page from becoming the second observation.
    if (!sawLoading && Date.now() < deadline - 3000) continue;
    await waitInterruptibly(350, runId);
    refreshed = await probeAccessGate(tabId).catch(() => null);
    if (refreshed) break;
  }
  refreshed ||= await probeAccessGate(tabId).catch(() => null);
  if (refreshed?.status === originalStatus) return {
    status: originalStatus === "empty_media" ? "empty_media" : "link_unavailable",
    accessNote: originalStatus === "empty_media"
      ? "ปลายทางเปิดได้ แต่อัลบั้มยังว่างและไม่มีวิดีโอหลังรีเฟรชตรวจซ้ำ 1 ครั้ง"
      : "ลิงก์ไม่สามารถเข้าถึงได้ — ปลายทางยังยืนยันว่าไฟล์ไม่มีอยู่หลังรีเฟรชตรวจซ้ำ 1 ครั้ง"
  };
  return refreshed;
}

// OneDrive often withholds stream metadata from a background tab.  Give it a
// short background chance first, then temporarily focus only the audit tab and
// restore the person's previous tab immediately afterwards.  This is bounded
// and never leaves OneDrive in the foreground for the user to manage.
async function withTemporaryForeground(tabId, action) {
  const auditTab = await withDeadline(() => chrome.tabs.get(tabId), 2500, "อ่านแท็บ OneDrive");
  const [previous] = await withDeadline(() => chrome.tabs.query({ active: true, windowId: auditTab.windowId }), 2500, "จำแท็บเดิม");
  await withDeadline(() => chrome.tabs.update(tabId, { active: true }), 4000, "นำหน้า OneDrive มาตรวจชั่วคราว");
  try {
    return await action();
  } finally {
    if (previous?.id && previous.id !== tabId) {
      const stillOpen = await withDeadline(() => chrome.tabs.get(previous.id), 2500, "ตรวจแท็บเดิม").catch(() => null);
      if (stillOpen) await withDeadline(() => chrome.tabs.update(previous.id, { active: true }), 4000, "คืนแท็บเดิม").catch(() => {});
    }
  }
}

const oneDriveTransientPlayerError = (value) => /onedrive\s+doesn['’]?t\s+support\s+playing\s+this\s+video|can(?:not|'t|’t)\s+play(?:\s+this\s+video)?|try\s+again|not\s+ready|temporarily\s+unavailable/i.test(String(value || ""));

function mediaProviderEvidence(targetUrl) {
  try {
    const url = new URL(targetUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    if (/\.(?:mp4|webm|m4v|mov|m3u8)(?:$|[?#])/i.test(targetUrl)) return "ไฟล์วิดีโอโดยตรง";
    if (/(?:youtube(?:-nocookie)?\.com|youtu\.be|heygen\.com|loom\.com|vidyard\.com|vimeo\.com|wistia\.com|kaltura\.com)$/i.test(host)) return "ผู้ให้บริการวิดีโอ";
    if ((host === "1drv.ms" || host.endsWith(".1drv.ms")) && /^\/v\//i.test(path)) return "ลิงก์วิดีโอ OneDrive";
    if ((host === "onedrive.live.com" || host.endsWith(".sharepoint.com")) && /\/:v:\//i.test(path)) return "ลิงก์วิดีโอ OneDrive/SharePoint";
  } catch { /* unresolved URLs remain generic evidence */ }
  return null;
}

function mediaProbeCandidateEvidence(targetUrl) {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    if (host === "photos.app.goo.gl" || host === "photos.google.com") {
      return "ปลายทาง Google Photos — ต้องยืนยันว่าเป็นวิดีโอจากหน้าเล่น";
    }
    return host === "1drv.ms" || host.endsWith(".1drv.ms") || host === "onedrive.live.com" || host.endsWith(".sharepoint.com")
      ? "ปลายทาง OneDrive/SharePoint — ต้องยืนยันจากหน้าเล่น" : null;
  } catch { return null; }
}

async function waitForTabSettled(tabId, runId, maxWaitMs = 20000) {
  const deadline = Date.now() + maxWaitMs;
  let latest = null;
  while (Date.now() < deadline) {
    await throwIfCancelled(runId);
    latest = await withDeadline(() => chrome.tabs.get(tabId), 2500, "ตรวจสถานะ OneDrive").catch(() => null);
    if (!latest) throw new Error("แท็บ OneDrive ปิดระหว่างรอหน้าเล่น");
    if (latest.status === "complete") {
      // A completed navigation is not necessarily a ready streaming player.
      // Let OneDrive's own startup tasks run once before probing its DOM.
      await waitInterruptibly(900, runId);
      return latest;
    }
    await waitInterruptibly(350, runId);
  }
  return latest;
}

async function readExternalTargetViaFetch(moodleUrl, deadline = Date.now() + 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(250, Math.min(3500, deadline - Date.now())));
  try {
    // Do not follow a Moodle redirect with fetch. Hosts such as TikTok,
    // Google Forms and Microsoft login reject extension-origin CORS and fill
    // chrome://extensions with errors. A manual redirect is read when exposed;
    // otherwise the existing temporary-tab resolver handles navigation.
    const response = await fetch(moodleUrl, { redirect:"manual", credentials:"include", signal:controller.signal });
    const locationHeader = response.headers.get("location");
    if (locationHeader) {
      const redirected = usableExternalTarget(new URL(locationHeader, moodleUrl).href);
      if (redirected) return { target:redirected, source:"http-location" };
    }
    const redirected = usableExternalTarget(response.url);
    if (redirected) return { target:redirected, source:"http-redirect" };
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html")) return null;
    // Moodle redirect pages are small. Bound the read so a misconfigured URL
    // returning a large download cannot consume a worker before classification.
    const html = await responseTextWithin(response, 512000);
    const decode = (value) => String(value || "")
      .replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/\\u002f/gi, "/").replace(/\\u0026/gi, "&").replaceAll("\\/", "/");
    const candidates = [];
    for (const match of html.matchAll(/(?:href|data-url|data-href|content)\s*=\s*["']([^"']+)["']/gi)) candidates.push(decode(match[1]));
    for (const match of decode(html).matchAll(/https?:\/\/[^"'\s<>]+/gi)) candidates.push(match[0]);
    const ranked = rankExternalTargets(candidates);
    return ranked[0] ? { target:ranked[0].target, source:"moodle-html" } : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function readExternalTarget(moodleUrl, runId, deadline = Date.now() + 10000) {
  const direct = usableExternalTarget(moodleUrl);
  if (direct) return direct;
  // Do not send a cross-origin request to URLs deliberately excluded by the
  // target filter (Moodle documentation, analytics, social widgets, etc.).
  // Only an LMS URL is eligible for redirect discovery after this point.
  if (shouldSkipExternalFetch(moodleUrl)) return null;
  const fetched = await readExternalTargetViaFetch(moodleUrl, deadline);
  if (fetched?.target) return fetched.target;
  // Do not wait the old 15 seconds for a redirect page to become "complete".
  // The bounded resolver below can inspect a still-loading Moodle redirect.
  if (Date.now() >= deadline) return null;
  const tab = await createInactiveTab(moodleUrl, runId, Math.max(250, Math.min(3500, deadline - Date.now())));
  try {
    // Moodle URL activities can redirect by HTTP, meta refresh, inline script
    // or a delayed JavaScript navigation. Poll a short, bounded window and
    // score candidates instead of assuming the first anchor is the target.
    // This preserves a specific Loom/Drive file URL over a platform homepage.
    const candidateFromPage = async () => {
      const [{ result }] = await withDeadline(() => chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          const normalizeUrl = (value) => {
            const raw = String(value || "").replace(/&amp;/g, "&").replaceAll("\\/", "/").trim();
            try { const url = new URL(raw, location.href); return /^https?:$/i.test(url.protocol) ? url.href : null; } catch { return null; }
          };
          const rawUrls = (text) => [...String(text || "").replaceAll("\\/", "/").matchAll(/https?:\/\/[^"'\s<>]+/gi)]
            .map((match) => normalizeUrl(match[0]));
          const candidates = [location.href];
          for (const anchor of document.querySelectorAll("a[href], [data-url], [data-href], [data-link]")) {
            candidates.push(anchor.href, anchor.dataset?.url, anchor.dataset?.href, anchor.dataset?.link, anchor.getAttribute("onclick"));
          }
          for (const meta of document.querySelectorAll("meta[http-equiv='refresh' i][content]")) {
            const match = meta.content.match(/url\s*=\s*(.+)$/i); if (match) candidates.push(match[1]);
          }
          for (const script of document.scripts) candidates.push(...rawUrls(script.textContent));
          candidates.push(...rawUrls(document.documentElement?.innerHTML));
          const unique = [...new Set(candidates.flatMap((value) => {
            const direct = normalizeUrl(value);
            return [direct, ...rawUrls(value)].filter(Boolean);
          }))];
          const trackingHost = (host) => /(?:^|\.)(?:googletagmanager\.com|google-analytics\.com|doubleclick\.net|analytics\.google\.com|facebook\.com|connect\.facebook\.net|clarity\.ms)$/i.test(host);
          const metadataHost = (host) => /(?:^|\.)(?:data-vocabulary\.org|schema\.org|w3\.org|ogp\.me)$/i.test(host);
          const metadataUrl = (value) => /(?:breadcrumb|schema(?:\.org)?|structured[-_]?data)/i.test(value);
          const external = unique.filter((value) => {
            try { const host = new URL(value).hostname; return host && !/(?:^|\.)(?:dlearning|ilearning)\.spu\.ac\.th$/i.test(host) && !trackingHost(host) && !metadataHost(host) && !metadataUrl(value) && !/docs\.moodle\.org$/i.test(host); } catch { return false; }
          });
          const score = (value) => {
            const lower = value.toLowerCase();
            let points = 0;
            if (/drive\.google\.com\/file\/d\//.test(lower)) points += 100;
            if (/docs\.google\.com\/(?:forms|presentation|document|spreadsheets)/.test(lower)) points += 90;
            if (/loom\.com\/share\//.test(lower)) points += 90;
            if (/1drv\.ms\//.test(lower)) points += 130;
            if (/onedrive\.live\.com\//.test(lower)) points += 125;
            if (/notebook(?:lm)?\.google\.com\/(?:notebook|artifact)/.test(lower)) points += 125;
            if (/youtube|vimeo|vidyard|wistia|kaltura|sharepoint/.test(lower)) points += 70;
            if (/\/(?:file|share|watch|view)\b/.test(lower)) points += 20;
            if (/\?(?:id|file|redirect|url|target)=/.test(lower)) points += 10;
            if (/^(?:https?:\/\/)?(?:www\.)?(?:loom|drive)\.(?:com|google\.com)\/?$/i.test(value)) points -= 80;
            return points;
          };
          // DOM links are collected before script/HTML text, so preserve their
          // order when two candidates have the same evidence score.
          return external.map((value, index) => ({ value, index }))
            .sort((left, right) => score(right.value) - score(left.value) || left.index - right.index)[0]?.value || null;
        }
      }), Math.max(250, Math.min(5000, deadline - Date.now())), "ค้นหาลิงก์ปลายทาง");
      return result || null;
    };
    for (let attempt = 0; attempt < 7 && Date.now() < deadline; attempt += 1) {
      await throwIfCancelled(runId);
      const current = await withDeadline(() => chrome.tabs.get(tab.id), 2500, "ตรวจหน้าลิงก์ปลายทาง").catch(() => null);
      if (current?.url && /^https?:/i.test(current.url)) {
        const host = new URL(current.url).hostname;
        const metadataTarget = /(?:^|\.)(?:data-vocabulary\.org|schema\.org|w3\.org|ogp\.me)$/i.test(host) || /(?:breadcrumb|structured[-_]?data)/i.test(current.url);
        if (!/(?:^|\.)(?:dlearning|ilearning)\.spu\.ac\.th$/i.test(host) && !/(?:^|\.)docs\.moodle\.org$/i.test(host) && !metadataTarget && !/(?:^|\.)(?:googletagmanager\.com|google-analytics\.com|doubleclick\.net|analytics\.google\.com|facebook\.com|clarity\.ms)$/i.test(host)) return current.url;
      }
      const candidate = await candidateFromPage().catch(() => null);
      if (candidate) return candidate;
      await waitInterruptibly(Math.min(650, Math.max(0, deadline - Date.now())), runId);
    }
    return null;
  } finally {
    await closeAuditTab(tab.id);
  }
}

function fileDetails(targetUrl) {
  let target = String(targetUrl || "");
  try { target = new URL(target).searchParams.get("file") || target; } catch { /* leave raw target */ }
  let decoded = target;
  try { decoded = decodeURIComponent(target); } catch { /* leave encoded target */ }
  const name = decoded.split("/").pop().split(/[?#]/)[0] || "";
  const isPdf = /\.pdf(?:$|[?#])/i.test(decoded) || /\.pdf$/i.test(name);
  const isAudio = /\.(?:m4a|mp3|wav|ogg|oga|aac|flac)(?:$|[?#])/i.test(decoded) || /\.(?:m4a|mp3|wav|ogg|oga|aac|flac)$/i.test(name);
  const isVideo = /\.(?:mp4|m4v|webm|mov|mkv|avi|wmv|mpeg|mpg)(?:$|[?#])/i.test(decoded) || /\.(?:mp4|m4v|webm|mov|mkv|avi|wmv|mpeg|mpg)$/i.test(name);
  const isImage = /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i.test(decoded);
  // A route such as /view is a page address, not proof that its document is
  // non-PDF.  Only a real, recognised file extension can establish non-PDF.
  const hasKnownNonPdfExtension = /\.(?:pptx?|docx?|xlsx?|csv|txt|zip|rar|jpe?g|png|gif|mp4|m4a|mp3|wav)(?:$|[?#])/i.test(decoded);
  const googleEditor = /docs\.google\.com\/(?:document|presentation|spreadsheets)\//i.test(decoded);
  const onlineDocument = /\/\/(?:[^/]+\.)?gamma\.app\/docs\//i.test(decoded);
  return { target, name, isPdf, isAudio, isVideo, isImage, fileVerification: isPdf ? "pdf" : hasKnownNonPdfExtension || googleEditor || onlineDocument ? "not_pdf" : "unresolved", sourceType: googleEditor ? "google_editor" : onlineDocument ? "online_document" : isImage ? "image" : "" };
}

// Inspect only response headers and the first returned bytes.  This never
// uses Chrome Downloads and never writes a document to disk.  Servers that do
// not honour Range simply fall back to the existing in-page inspection.
async function inspectFileResponse(targetUrl) {
  // A direct recognised filename already proves its type. Avoid a needless
  // cross-origin fetch (and the resulting Chrome CORS error) for such files.
  const namedFile = fileDetails(targetUrl);
  if (namedFile.fileVerification !== "unresolved") return namedFile;
  // Never fetch an arbitrary external web page from the extension origin.
  // Sites such as React Native, W3Schools, Arduino and Wokwi correctly reject
  // those requests with CORS even though their pages open normally. Direct
  // filenames were already settled above; extensionless external downloads
  // are inspected through the owned temporary tab and Chrome's PDF viewer.
  // Keep byte/header inspection only for the two trusted LMS origins.
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    if (!["dlearning.spu.ac.th", "ilearning.spu.ac.th"].includes(host)) return null;
  } catch { return null; }
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(targetUrl, { redirect:"follow", headers:{ Range:"bytes=0-8191" }, signal:controller.signal });
    const target = response.url || targetUrl;
    const contentType = String(response.headers.get("content-type") || "").toLowerCase().split(";")[0];
    const contentDisposition = String(response.headers.get("content-disposition") || "");
    const direct = fileDetails(target);
    if (contentType === "application/pdf" || /filename\*?\s*=.*\.pdf(?:["';]|$)/i.test(contentDisposition)) return { ...direct, target, isPdf:true, fileVerification:"pdf", contentType, sourceType:"response_header" };
    if (/^video\//.test(contentType)) return { ...direct, target, isPdf:false, isAudio:false, isVideo:true, fileVerification:"not_pdf", contentType, sourceType:"response_header" };
    if (/^audio\//.test(contentType)) return { ...direct, target, isPdf:false, isAudio:true, isVideo:false, fileVerification:"not_pdf", contentType, sourceType:"response_header" };
    if (/^image\//.test(contentType)) return { ...direct, target, isPdf:false, isImage:true, fileVerification:"not_pdf", contentType, sourceType:"image" };
    // HTML is a preview/login/interstitial page, never proof of file type.
    if (/^(?:application\/msword|application\/vnd\.)/.test(contentType)) return { ...direct, target, isPdf:false, fileVerification:"not_pdf", contentType, sourceType:"response_header" };
    const reader = response.body?.getReader?.();
    if (!reader) return null;
    const { value } = await reader.read();
    await reader.cancel().catch(() => {});
    const bytes = value?.slice(0, 1024) || new Uint8Array();
    const first = new TextDecoder().decode(bytes);
    if (first.slice(0, 32).includes("%PDF-")) return { ...direct, target, isPdf:true, fileVerification:"pdf", contentType, sourceType:"file_signature" };
    // These signatures prove common office/archive/image formats are not PDF.
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (first.startsWith("PK") || png || first.startsWith("GIF8")) return { ...direct, target, isPdf:false, fileVerification:"not_pdf", contentType, sourceType:"file_signature" };
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(abortTimer);
  }
}

async function inspectFileTarget(targetUrl, runId) {
  const namedFile = fileDetails(targetUrl);
  if (namedFile.fileVerification !== "unresolved") return namedFile;
  const responseInspection = await inspectFileResponse(targetUrl);
  if (responseInspection?.fileVerification && responseInspection.fileVerification !== "unresolved") return responseInspection;
  const tab = await createInactiveTab(targetUrl, runId, 10000);
  try {
    // Chrome's built-in PDF viewer is an extension page and cannot be
    // scripted. Its `file=` parameter is still reliable evidence of a PDF.
    const direct = fileDetails(tab.url);
    if (direct.sourceType === "google_editor") {
      const [{result:previewText} = {}] = await withDeadline(() => chrome.scripting.executeScript({
        target:{tabId:tab.id},
        func:() => [document.title, document.querySelector("main, [role='main']")?.innerText, document.body?.innerText]
          .filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 2000)
      }), 3000, "อ่านสถานะตัวอย่าง Google เอกสาร").catch(() => []);
      const previewIssue = filePreviewIssueFromEvidence(previewText);
      if (previewIssue) return {...direct, ...previewIssue};
    }
    if (direct.fileVerification !== "unresolved") return direct;
    let inspected = null;
    for (let attempt = 0; attempt < 4; attempt++) {
    const [{ result }] = await withDeadline(() => chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const normalize = (value) => {
          try { return new URL(String(value || ""), location.href).href; } catch { return null; }
        };
        // Images, favicons, pixels and loading assets belong to the web page,
        // never to the course document.  In particular, Google Drive exposes
        // netcheck.gif and a favicon before it exposes its file metadata.
        const decorativeAsset = (url) => /(?:favicon|netcheck|pixel|spacer|logo|icon|sprite|thumbnail|thumb|avatar|loading|spinner)|\/(?:images?|icons?|assets?)\//i.test(url);
        const documentAsset = (url) => /\.(?:pdf|pptx?|docx?|xlsx?|csv|txt|zip|rar|mp4|m4a|mp3|wav)(?:$|[?#])/i.test(url) && !decorativeAsset(url);
        const urls = [...document.querySelectorAll("a[href], embed[src], iframe[src], object[data], [data-url], [data-download-url]")]
          .flatMap((element) => [element.href, element.src, element.data, element.dataset?.url, element.dataset?.downloadUrl, element.getAttribute("href"), element.getAttribute("src"), element.getAttribute("data")])
          .map(normalize).filter((url) => url && !decorativeAsset(url));
        // Read the title and MIME metadata of a Google document/Drive preview.
        // Do not search arbitrary raw URLs for a candidate: those pages contain
        // tracking GIFs and toolbar graphics which are unrelated to the file.
        const metadata = [
          document.title,
          ...[...document.querySelectorAll("meta")].map((meta) => [meta.content, meta.getAttribute("name"), meta.getAttribute("property"), meta.getAttribute("itemprop")].filter(Boolean).join(" ")),
          ...[...document.scripts].map((script) => script.textContent || "")
        ].join("\n");
        const candidates = [...new Set(urls)];
        const pdfTarget = candidates.find((url) => /\.pdf(?:$|[?#])/i.test(url));
        const nonPdfTarget = candidates.find(documentAsset);
        const metadataPdf = /application\/pdf|\.pdf(?:\s|$|["'<])/i.test(metadata);
        const metadataNonPdf = /application\/(?:msword|vnd\.openxmlformats-officedocument\.(?:wordprocessingml|presentationml|spreadsheetml)|vnd\.ms-(?:powerpoint|excel)|vnd\.google-apps\.(?:document|presentation|spreadsheet))|\.(?:docx?|pptx?|xlsx?)(?:\s|$|["'<])/i.test(metadata);
        const googleEditor = /docs\.google\.com\/(?:document|presentation|spreadsheets)\//i.test(location.href);
        const contentType = String(document.contentType || "").toLowerCase();
        const pdfViewer = contentType === "application/pdf" || document.querySelector("embed[type='application/pdf'], iframe[src*='.pdf'], object[type='application/pdf']");
        // A URL can end in /view while its response is image/png or image/jpeg.
        // The browser's document content type is the evidence in that case.
        const isImage = contentType.startsWith("image/");
        const metadataVideo = /video\/(?:mp4|webm|ogg|quicktime)|<video\b/i.test(metadata);
        const metadataAudio = /audio\/(?:mpeg|mp4|ogg|wav)|<audio\b/i.test(metadata);
        const drivePdfIcon = /(^|\.)drive\.google\.com$/i.test(location.hostname) && [...document.querySelectorAll("img, [role='img'], [aria-label]")].some(element => /(?:^|[\s/_.-])pdf(?:$|[\s/_.-])/i.test([element.getAttribute("alt"),element.getAttribute("aria-label"),element.getAttribute("src")].filter(Boolean).join(" ")));
        const pageControls = /(?:Page|หน้า)\s*\d*\s*\/\s*\d+/i.test(document.body?.innerText || "") || Boolean(document.querySelector("input[aria-label*='Page'], input[aria-label*='หน้า']"));
        const isPdf = Boolean(pdfTarget || pdfViewer || metadataPdf || drivePdfIcon && pageControls);
        const isKnownNonPdf = !isPdf && Boolean(nonPdfTarget || metadataNonPdf || googleEditor || isImage);
        const target = pdfTarget || nonPdfTarget || location.href;
        const name = decodeURIComponent(target.split("/").pop().split(/[?#]/)[0] || "");
        return { target, name, isPdf, isAudio: contentType.startsWith("audio/") || metadataAudio || /\.(?:m4a|mp3|wav|ogg|oga|aac|flac)(?:$|[?#])/i.test(target), isVideo: contentType.startsWith("video/") || metadataVideo || /\.(?:mp4|m4v|webm|mov|mkv|avi|wmv|mpeg|mpg)(?:$|[?#])/i.test(target), isImage, contentType, fileVerification: isPdf ? "pdf" : isKnownNonPdf ? "not_pdf" : "unresolved", sourceType:googleEditor ? "google_editor" : isImage ? "image" : /(^|\.)drive\.google\.com$/i.test(location.hostname) ? "google_drive" : "" };
      }
    }), 6000, "อ่านชนิดไฟล์จากหน้าปลายทาง");
    inspected = result || inspected;
    if (inspected?.fileVerification !== "unresolved" && inspected) break;
    if (attempt < 3) await waitInterruptibly(750,runId);
    }
    return inspected || direct;
  } catch (error) {
    if (error?.name === "AuditCancelled") throw error;
    return { ...fileDetails(tab?.url || targetUrl), error: error.message };
  } finally {
    await closeAuditTab(tab.id);
  }
}

async function inspectForumAttachments(forumUrl, runId, inspectTask = false) {
  const tab = await createInactiveTab(forumUrl, runId, 10000);
  try {
    const [{ result }] = await withDeadline(() => chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: async (readTask) => {
        const root = document.querySelector("#region-main, #page-content, main") || document.body;
        const seen = new Set();
        const attachments = [...root.querySelectorAll("a[href]")].map((anchor) => {
          const href = anchor.href;
          const label = String(anchor.textContent || anchor.getAttribute("title") || "").replace(/\s+/g, " ").trim();
          const pdf = /\.pdf(?:$|[?#])/i.test(href) || /\.pdf\b/i.test(label) || /application\/pdf/i.test(anchor.getAttribute("type") || "");
          if (!pdf || !href || seen.has(href)) return null;
          seen.add(href);
          return { href, title: label || decodeURIComponent(href.split("/").pop().split(/[?#]/)[0] || "ไฟล์แนบใน Announcements"), isPdf: true };
        }).filter(Boolean);
        const taskText = (doc) => [...doc.querySelectorAll('#intro, .forumintro, .posting .content, .post-content-container, [data-region="post-content"]')].map(node => node.innerText || node.textContent || '').join('\n');
        let contentText = readTask ? taskText(document) : '';
        if (readTask && contentText.trim().length < 30) {
          const links = [...new Set([...root.querySelectorAll('a[href]')].map(a => a.href).filter(href => {try {const u=new URL(href); return u.origin === location.origin && /\/mod\/forum\/discuss\.php$/.test(u.pathname);}catch{return false;}}))].slice(0,3);
          const posts = await Promise.all(links.map(async href => {
            const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),5000);
            try {const response=await fetch(href,{credentials:'include',signal:controller.signal}); if(!response.ok)return ''; return taskText(new DOMParser().parseFromString(await response.text(),'text/html'));}catch{return '';}finally{clearTimeout(timer);}
          }));
          contentText += '\n' + posts.join('\n');
        }
        return {attachments, contentText};
      },
      args:[inspectTask]
    }), 14000, "อ่านเนื้อหาและไฟล์แนบใน Forum");
    return result || {attachments:[], contentText:""};
  } catch (error) {
    if (error?.name === "AuditCancelled") throw error;
    return {attachments:[], contentText:"", error:error.message};
  } finally {
    await closeAuditTab(tab.id);
  }
}

async function inspectAiChatTarget(targetUrl, runId) {
  // SPU AI requires an account that reviewers do not have. The destination
  // domain itself is approved institutional evidence, so do not turn a valid
  // SPU AI link into a failure merely because its composer is behind login.
  if (trustedSpuAiProvider(targetUrl)) {
    return {status:"confirmed", confirmed:true, accessNote:"ยืนยัน AI Tutor จากปลายทาง SPU AI (ไม่บังคับตรวจช่องแชทหรือล็อกอิน)"};
  }
  const origins = aiChatOriginsForUrl(targetUrl);
  if (!origins.length) {
    return {status:"permission_required", confirmed:false, accessNote:"แพลตฟอร์มนี้ยังไม่มีสิทธิ์สำหรับตรวจโครงสร้างหน้าแชทอัตโนมัติ"};
  }
  const hasPermission = await withDeadline(() => chrome.permissions.contains({origins}), 3000, "ตรวจสิทธิ์แพลตฟอร์ม AI Tutor").catch(() => false);
  if (!hasPermission) return {status:"permission_required", confirmed:false, accessNote:"เครื่องตรวจยังไม่ได้รับสิทธิ์เปิดตรวจแพลตฟอร์ม AI Tutor"};
  let tab;
  try {
    tab = await createInactiveTab(targetUrl, runId, 10000);
    const current = await withDeadline(() => chrome.tabs.get(tab.id), 2500, "อ่าน URL ปลายทาง AI Tutor").catch(() => null);
    const gate = accessGateFromEvidence({url:current?.url || targetUrl}) || await probeAccessGate(tab.id).catch(() => null);
    if (gate) {
      const status = gate.status === "missing_file" ? "link_unavailable" : gate.status;
      return {status, confirmed:false, accessNote:gate.accessNote || "ลิงก์ AI Tutor ไม่สามารถเข้าถึงได้"};
    }
    const inspect = async () => {
      const frames = await withDeadline(() => chrome.scripting.executeScript({
        target:{tabId:tab.id,allFrames:true},
        func:() => {
          const visible = (node) => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.visibility !== "hidden" && style.display !== "none" && rect.width > 12 && rect.height > 12;
          };
          const roots = [document];
          for (let index = 0; index < roots.length; index += 1) {
            for (const node of roots[index].querySelectorAll("*")) if (node.shadowRoot && !roots.includes(node.shadowRoot)) roots.push(node.shadowRoot);
          }
          const all = (selector) => roots.flatMap((root) => [...root.querySelectorAll(selector)]).filter(visible);
          const label = (node) => [node.getAttribute("aria-label"),node.getAttribute("placeholder"),node.getAttribute("title"),node.textContent].filter(Boolean).join(" ").replace(/\s+/g," ").trim().slice(0,300);
          const fields = all("textarea,[contenteditable='true'],input:not([type]),input[type='text']").filter((node) => !/search|ค้นหา|email|อีเมล|username|ชื่อผู้ใช้/i.test(label(node)));
          const composerPattern = /message|prompt|ask|chat|type|send|พิมพ์|ถาม|ข้อความ|สนทนา|入力|質問|消息|提问|提問/i;
          const composers = fields.filter((node) => composerPattern.test(label(node)) || node.tagName === "TEXTAREA" || node.getAttribute("contenteditable") === "true");
          const sendPattern = /^(?:send|submit|ask|go|ส่ง|ถาม|ส่งข้อความ|送信|发送|發送)(?:\s|$)|paper.?plane/i;
          const sendActions = all("button,[role='button'],input[type='submit']").filter((node) => sendPattern.test(label(node)));
          const conversationRegions = all("[role='log'],[aria-live='polite'],[data-message-author-role],[data-testid*='conversation'],[class*='conversation'],[class*='chat-message'],[class*='message-list']");
          const body = String(document.body?.innerText || "").replace(/\s+/g," ").slice(0,6000);
          const assistantSignal = /\b(?:assistant|chatbot|ai tutor|copilot|gemini|claude|chatgpt)\b|ผู้ช่วย\s*ai|แช[ทต]\s*บอท|ติวเตอร์/i.test(`${document.title} ${body}`);
          const marketingSignal = /pricing|features|learn more|get started|product|solutions|ราคา|คุณสมบัติ|เรียนรู้เพิ่มเติม|เริ่มต้นใช้งาน/i.test(body);
          return {url:location.href,loaded:["interactive","complete"].includes(document.readyState),composerCount:composers.length,sendActionCount:sendActions.length,conversationRegionCount:conversationRegions.length,assistantSignal,marketingSignal};
        }
      }), 7000, "ตรวจโครงสร้างหน้าแชท AI");
      const signals = (frames || []).map((item) => item.result).filter(Boolean);
      return signals.sort((left,right) => Number(right.composerCount || 0) - Number(left.composerCount || 0))[0] || {url:current?.url || targetUrl,loaded:false};
    };
    let evidence = await inspect();
    let result = evaluateAiChatEvidence(evidence);
    if (result.status === "unresolved") {
      await waitInterruptibly(1800, runId);
      evidence = await inspect();
      result = evaluateAiChatEvidence(evidence);
    }
    return {...result, accessNote:result.reason, evidence:{url:evidence.url,composerCount:evidence.composerCount,sendActionCount:evidence.sendActionCount,conversationRegionCount:evidence.conversationRegionCount}};
  } catch (error) {
    if (error?.name === "AuditCancelled") throw error;
    return {status:"unresolved",confirmed:false,accessNote:`เปิดตรวจหน้าแชท AI ไม่สำเร็จ: ${error.message}`};
  } finally {
    if (tab?.id) await closeAuditTab(tab.id);
  }
}

async function inspectMoodleFolder(folderUrl, runId) {
  const tab = await createInactiveTab(folderUrl, runId, 10000);
  try {
    const gate = await probeAccessGate(tab.id).catch(() => null);
    if (gate) return {files:[], error:gate.accessNote, status:gate.status};
    const [{ result } = {}] = await withDeadline(() => chrome.scripting.executeScript({
      target:{tabId:tab.id, allFrames:false},
      func:() => {
        const root = document.querySelector("#region-main, #page-content, main") || document.body;
        return [...root.querySelectorAll("a[href]")].map((anchor) => {
          const row = anchor.closest("li, .fp-file, .fp-filename-icon, [role='treeitem'], .filemanager") || anchor;
          const title = String(anchor.textContent || anchor.getAttribute("title") || anchor.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
          const evidence = [anchor.outerHTML, row?.querySelector("img, i, [class*='icon']")?.outerHTML, row?.getAttribute?.("data-filetype")].filter(Boolean).join(" ").slice(0,2400);
          const path = String(row?.closest?.("li")?.parentElement?.closest?.("li")?.innerText || "").replace(/\s+/g, " ").trim().slice(0,300);
          return {href:anchor.href, title, type:anchor.getAttribute("type") || "", evidence, path};
        });
      }
    }), 8000, "อ่านไฟล์ภายในโฟลเดอร์ Moodle");
    return {files:normalizeMoodleFolderEntries(result || [], folderUrl), error:""};
  } catch (error) {
    if (error?.name === "AuditCancelled") throw error;
    return {files:[], error:error.message || "เปิดโฟลเดอร์ Moodle ไม่สำเร็จ"};
  } finally {
    await closeAuditTab(tab.id);
  }
}

async function inspectAssignmentDocuments(assignmentUrl, runId) {
  const tab = await createInactiveTab(assignmentUrl, runId, 10000);
  try {
    const gate = await probeAccessGate(tab.id).catch(() => null);
    if (gate) return {files:[], error:gate.accessNote};
    const [{result} = {}] = await withDeadline(() => chrome.scripting.executeScript({
      target:{tabId:tab.id, allFrames:false},
      func:() => [...document.querySelectorAll("a[href]")].filter((anchor) => {
        try {
          const url = new URL(anchor.href);
          return /\/(?:webservice\/)?pluginfile\.php\//i.test(url.pathname)
            && /\/mod_assign\/(?:intro|introattachment)\//i.test(url.pathname);
        } catch { return false; }
      }).map((anchor) => ({
        href:anchor.href,
        title:String(anchor.textContent || anchor.getAttribute("title") || anchor.getAttribute("aria-label") || "").replace(/\s+/g," ").trim(),
        type:anchor.getAttribute("type") || "",
        evidence:[anchor.outerHTML, anchor.closest("#intro, .activity-description, .no-overflow")?.innerHTML].filter(Boolean).join(" ").slice(0,2400)
      }))
    }), 8000, "อ่านไฟล์เอกสารภายใน Assignment");
    return {files:normalizeMoodleFolderEntries(result || [], assignmentUrl).map((file) => ({...file,sourceType:"assignment_attachment"})),error:""};
  } catch (error) {
    if (error?.name === "AuditCancelled") throw error;
    return {files:[],error:error.message || "เปิด Assignment ไม่สำเร็จ"};
  } finally {
    await closeAuditTab(tab.id);
  }
}

async function probeTopFrameProviderMedia(tabId, startPlayback = false, provider = "provider") {
  try {
    const [{ result } = {}] = await withDeadline(() => chrome.scripting.executeScript({
      target:{tabId, allFrames:false},
      func:async (play) => {
        const valid = (value) => Number.isFinite(value) && value > 0 && value <= 8 * 3600;
        const clockSeconds = (value) => {
          const parts = String(value || "").split(":").map(Number);
          if (!parts.length || parts.some((part) => !Number.isFinite(part)) || !parts.slice(1).every((part) => part < 60)) return 0;
          const seconds = parts.reduce((sum, part) => sum * 60 + part, 0);
          return valid(seconds) ? seconds : 0;
        };
        const media = [...document.querySelectorAll("video,audio")];
        let playError = "";
        if (play && media[0]) {
          media[0].muted = true;
          media[0].preload = "auto";
          try {
            await Promise.race([media[0].play(), new Promise((resolve) => setTimeout(resolve, 3000))]);
          } catch (error) {
            playError = String(error?.name || error?.message || "play failed");
          }
        }
        if (media.length && !media.some((item) => valid(item.duration))) {
          await Promise.race([
            Promise.all(media.map((item) => new Promise((resolve) => {
              const finish = () => { item.removeEventListener("loadedmetadata", finish); item.removeEventListener("durationchange", finish); resolve(); };
              item.addEventListener("loadedmetadata", finish, {once:true});
              item.addEventListener("durationchange", finish, {once:true});
              setTimeout(finish, 2600);
            }))),
            new Promise((resolve) => setTimeout(resolve, 2800))
          ]);
        }
        const elementSeconds = Math.max(0, ...media.map((item) => valid(item.duration) ? item.duration : 0));
        const sliderSeconds = Math.max(0, ...[...document.querySelectorAll("[role='slider'][aria-valuemax], input[type='range'][max]")].map((element) => {
          const label = [element.getAttribute("aria-label"), element.getAttribute("aria-valuetext"), element.getAttribute("title")].filter(Boolean).join(" ");
          const maximum = Number(element.getAttribute("aria-valuemax") || element.getAttribute("max"));
          return /seek|time|duration|progress|video|audio|เลื่อน|เวลา/i.test(label) && valid(maximum) ? maximum : 0;
        }));
        const text = String(document.body?.innerText || document.documentElement?.innerText || "");
        const visibleSeconds = Math.max(0, ...[...text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/g)].map((match) => clockSeconds(match[1])));
        const durationSeconds = Math.max(elementSeconds, sliderSeconds, visibleSeconds) || null;
        const videoElementCount = media.filter((item) => item.tagName === "VIDEO").length;
        const audioElementCount = media.filter((item) => item.tagName === "AUDIO").length;
        return {
          accessible:document.readyState === "complete",
          durationSeconds,
          videoElementCount,
          audioElementCount,
          mediaDetected:Boolean(media.length || durationSeconds),
          mediaType:videoElementCount ? "video" : audioElementCount ? "audio" : null,
          videoReadyState:Math.max(0, ...media.filter((item) => item.tagName === "VIDEO").map((item) => Number(item.readyState) || 0)),
          playError,
          source:visibleSeconds ? "provider-player-clock" : sliderSeconds ? "provider-player-control" : elementSeconds ? "provider-media-element" : "provider-page"
        };
      },
      args:[startPlayback]
    }), 7000, `อ่านเวลาจาก ${provider}`);
    await recordAuditDiagnostic("provider-media-probe", {
      provider,
      durationSeconds:result?.durationSeconds || null,
      videoElementCount:result?.videoElementCount || 0,
      audioElementCount:result?.audioElementCount || 0,
      videoReadyState:result?.videoReadyState || 0,
      source:result?.source || "provider-page",
      playError:result?.playError || ""
    });
    return result || {accessible:false,durationSeconds:null};
  } catch (error) {
    await recordAuditDiagnostic("provider-media-probe", {provider,error:String(error?.message || error)});
    return probeMedia(tabId, startPlayback);
  }
}

// Modern SharePoint Stream mounts the real <video> and the visible clock in
// an open Shadow DOM. Keep this probe top-frame-only so an unrelated Microsoft
// iframe cannot make the entire inspection fail, then walk every open shadow
// root ourselves. The visible total is preferred over a fractional media
// duration (for example 6545.52) because the reviewer sees 1:49:05.
async function probeSharePointPlayer(tabId, startPlayback = false) {
  const [{result} = {}] = await withDeadline(() => chrome.scripting.executeScript({
    target:{tabId, allFrames:false},
    func:async (play) => {
      const roots=[document];
      for (let index=0; index<roots.length; index+=1) {
        for (const node of roots[index].querySelectorAll("*")) if (node.shadowRoot) roots.push(node.shadowRoot);
      }
      const deepQuery=(selector)=>roots.flatMap((root)=>[...root.querySelectorAll(selector)]);
      const valid=(value)=>Number.isFinite(value) && value>0 && value<=8*3600;
      const clockSeconds=(value)=>{
        const parts=String(value || "").split(":").map(Number);
        if (![2,3].includes(parts.length) || parts.some((part)=>!Number.isFinite(part)) || parts.slice(1).some((part)=>part>=60)) return 0;
        const seconds=parts.reduce((sum,part)=>sum*60+part,0);
        return valid(seconds) ? seconds : 0;
      };
      const media=deepQuery("video,audio");
      if (play && !media.some((item)=>valid(item.duration))) {
        const button=deepQuery("button,[role='button']").find((item)=>/play|เล่น|เริ่ม/i.test(`${item.getAttribute("aria-label") || ""} ${item.getAttribute("title") || ""} ${item.textContent || ""}`));
        button?.click();
        if (media[0]) {
          media[0].muted=true;
          media[0].preload="auto";
          try { await Promise.race([media[0].play(),new Promise((resolve)=>setTimeout(resolve,2200))]); } catch { /* visible clock may still be available */ }
        }
      }
      if (media.length && !media.some((item)=>valid(item.duration))) {
        await Promise.race([
          Promise.all(media.map((item)=>new Promise((resolve)=>{
            const finish=()=>{ item.removeEventListener("loadedmetadata",finish); item.removeEventListener("durationchange",finish); resolve(); };
            item.addEventListener("loadedmetadata",finish,{once:true});
            item.addEventListener("durationchange",finish,{once:true});
            setTimeout(finish,2200);
          }))),
          new Promise((resolve)=>setTimeout(resolve,2400))
        ]);
      }
      const text=roots.map((root)=>root===document ? (document.body?.innerText || document.documentElement?.innerText || "") : (root.textContent || "")).join(" ");
      const labels=deepQuery("[aria-label],[aria-valuetext],[title]").flatMap((item)=>[item.getAttribute("aria-label"),item.getAttribute("aria-valuetext"),item.getAttribute("title")]).filter(Boolean).join(" ");
      const evidence=`${text} ${labels}`;
      const visibleSeconds=Math.max(0,...[...evidence.matchAll(/\b(\d{1,2}:\d{2}(?::\d{2})?)\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/g)]
        .map((match)=>({current:clockSeconds(match[1]),total:clockSeconds(match[2])}))
        .filter((pair)=>pair.total && pair.total>=pair.current).map((pair)=>pair.total));
      const humanClockSeconds=(value)=>{
        const match=String(value || "").match(/(?:(\d+)\s*(?:hours?|hrs?|ชั่วโมง))?\s*(?:(\d+)\s*(?:minutes?|mins?|นาที))?\s*(?:(\d+)\s*(?:seconds?|secs?|วินาที))?/i);
        if (!match || !match[0].trim()) return 0;
        const seconds=Number(match[1] || 0)*3600+Number(match[2] || 0)*60+Number(match[3] || 0);
        return valid(seconds) ? seconds : 0;
      };
      // A bare accessibility value such as "10 seconds" is the current play
      // position in Microsoft Stream, not the clip length. Accept human text
      // only when the player labels it as a total/duration or places it after
      // "of"/"from" (for example "1 second of 4 minutes 5 seconds").
      const humanTotals=[...evidence.matchAll(/(?:\bof\b|\btotal(?:\s+duration)?\b|\bduration\b|\blength\b|จาก|ทั้งหมด|ความยาว|เวลารวม)\D{0,32}((?:(?:\d+)\s*(?:hours?|hrs?|ชั่วโมง|minutes?|mins?|นาที|seconds?|secs?|วินาที)\s*){1,3})/gi)]
        .map((match)=>humanClockSeconds(match[1])).filter(valid);
      const humanSeconds=Math.max(0,...humanTotals);
      const currentTimeSeconds=Math.max(0,...media.map((item)=>Number.isFinite(item.currentTime) ? Number(item.currentTime) : 0));
      // SharePoint can expose a progressive MediaSource boundary as
      // video.duration. While playing it grows with currentTime (10/10, 11/11,
      // ...), so it is not proof of the true clip length. Keep only a duration
      // that is ahead of the playhead, is available before playback, or belongs
      // to a media element that has actually ended.
      const elementSeconds=Math.max(0,...media.map((item)=>{
        const duration=Number(item.duration), current=Number(item.currentTime) || 0;
        return valid(duration) && (current<=0.5 || duration-current>1 || item.ended) ? duration : 0;
      }));
      const durationSeconds=visibleSeconds || humanSeconds || elementSeconds || null;
      const videoElementCount=media.filter((item)=>item.tagName==="VIDEO").length;
      const audioElementCount=media.filter((item)=>item.tagName==="AUDIO").length;
      return {accessible:document.readyState==="complete",durationSeconds,currentTimeSeconds,mediaDetected:Boolean(media.length || durationSeconds),mediaType:videoElementCount || durationSeconds ? "video" : audioElementCount ? "audio" : null,videoElementCount,audioElementCount,videoReadyState:Math.max(0,...media.filter((item)=>item.tagName==="VIDEO").map((item)=>Number(item.readyState) || 0)),videoPaused:media.length ? media.every((item)=>item.paused) : null,source:visibleSeconds ? "sharepoint-player-clock" : humanSeconds ? "sharepoint-accessible-duration" : elementSeconds ? "sharepoint-video-element" : "sharepoint-player"};
    },
    args:[startPlayback]
  }),7000,"อ่านเวลาจากตัวเล่น SharePoint");
  return result || {accessible:false,durationSeconds:null,mediaDetected:false};
}

async function probeMedia(tabId, startPlayback = false) {
  const results = await withDeadline(() => chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: async (play) => {
      const roots = [document];
      for (let index = 0; index < roots.length; index += 1) {
        for (const node of roots[index].querySelectorAll("*")) if (node.shadowRoot) roots.push(node.shadowRoot);
      }
      const deepQuery = (selector) => roots.flatMap((root) => [...root.querySelectorAll(selector)]);
      const visible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const videos = deepQuery("video");
      const audios = deepQuery("audio");
      const mediaElements = [...videos, ...audios];
      let playError = "";
      if (play) {
        for (const skip of document.querySelectorAll(".ytp-ad-skip-button, .ytp-skip-ad-button, button[aria-label*='Skip'], button[aria-label*='ข้าม']")) {
          if (skip.offsetParent) { skip.click(); break; }
        }
        for (const media of mediaElements.slice(0, 1)) {
          media.muted = true;
          media.preload = "auto";
          // Do not call load() here: repeated probes would reset an in-flight
          // stream and prevent loadedmetadata from ever completing on slow Wi-Fi.
          try {
            await Promise.race([
              media.play(),
              new Promise((resolve) => setTimeout(resolve, 2500))
            ]);
          } catch (error) {
            playError ||= String(error?.name || error?.message || "ไม่สามารถเริ่มเล่นได้");
          }
        }
        for (const button of deepQuery("button,[role='button'],.h5p-play,.h5p-button")) {
          const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""} ${button.textContent || ""}`;
          if (/play|เล่น|เริ่ม/i.test(label)) { button.click(); break; }
        }
      }
      // H5P frequently inserts the <video> element before its metadata is
      // available. Wait in the player frame for loadedmetadata/durationchange
      // rather than sampling duration immediately as the old probe did.
      if (mediaElements.length && !mediaElements.some((media) => Number.isFinite(media.duration) && media.duration > 0)) {
        await Promise.race([
          Promise.all(mediaElements.map((media) => new Promise((resolve) => {
            const finish = () => { media.removeEventListener("loadedmetadata", finish); media.removeEventListener("durationchange", finish); resolve(); };
            media.addEventListener("loadedmetadata", finish, {once:true});
            media.addEventListener("durationchange", finish, {once:true});
            setTimeout(finish, 2000);
          }))),
          new Promise((resolve) => setTimeout(resolve, 2200))
        ]);
      }
      const rawElementSeconds = Math.max(0, ...mediaElements.map((media) => Number.isFinite(media.duration) ? media.duration : 0));
      const deepLabels = deepQuery("[aria-label], [aria-valuetext], [title], [role='slider']")
        .flatMap((element) => [element.getAttribute("aria-label"), element.getAttribute("aria-valuetext"), element.getAttribute("title"), element.textContent])
        .filter(Boolean).join(" ");
      // Microsoft Stream places its visible clock inside an open Shadow DOM.
      // body.innerText omits that text even though the user can see it, so read
      // every discovered root as well as accessibility labels.
      const deepText = roots.map((root) => root === document
        ? (document.body?.innerText || document.documentElement?.innerText || "")
        : (root.textContent || "")).join(" ");
      const text = `${deepText} ${deepLabels}`;
      const times = [...text.matchAll(/(?:\/|of|duration|ความยาว)\s*(\d{1,2}:\d{2}(?::\d{2})?)/gi)].map((m) => m[1]);
      const youtubeDuration = document.querySelector(".ytp-time-duration")?.textContent?.trim() || null;
      const isoDuration = [...document.querySelectorAll("meta[itemprop='duration'], meta[property='video:duration']")]
        .map((meta) => meta.content || "")
        .map((value) => {
          const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
          return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : Number(value);
        }).filter((value) => Number.isFinite(value) && value > 0);
      // Drive and Loom commonly expose duration in their bootstrapped JSON
      // before (or instead of) placing a playable <video> in a background tab.
      const pageSource = deepQuery("script").map((item) => item.textContent || "").join("\n");
      const embeddedDurations = [...pageSource.matchAll(/["'](?:duration(?:Seconds|_seconds)?|videoDuration|lengthSeconds)["']\s*:\s*["']?(\d+(?:\.\d+)?)/gi)]
        .map((match) => Number(match[1])).filter((value) => Number.isFinite(value) && value > 0 && value <= 8 * 3600);
      // Google Drive and OneDrive use streaming players. Their <video> duration is often
      // unavailable in an inactive audit tab even though the user can play the
      // file normally. Read the player accessibility labels, visible clock and
      // bootstrapped metadata before declaring its time unknown; no user
      // playback or download is required.
      const isDrive = /(^|\.)drive\.google\.com$/i.test(location.hostname);
      const isGooglePhotos = /^(?:photos\.google\.com|photos\.app\.goo\.gl)$/i.test(location.hostname);
      const isOneDrive = /(^|\.)(?:1drv\.ms|onedrive\.live\.com|sharepoint\.com)$/i.test(location.hostname);
      const seconds = isOneDrive
        ? Math.max(0, ...mediaElements.map((media) => {
            const duration = Number(media.duration), current = Number(media.currentTime) || 0;
            return Number.isFinite(duration) && duration > 0 && duration <= 8 * 3600
              && (current <= 0.5 || duration - current > 1 || media.ended) ? duration : 0;
          }))
        : rawElementSeconds;
      // Google Photos renders its real video controls in a nested
      // youtube.googleapis.com iframe. Limit this classification to the
      // Photos-specific embed parameters so unrelated YouTube API frames do
      // not contribute clocks to an audit.
      const isGooglePhotosEmbed = location.hostname === "youtube.googleapis.com" && (
        new URL(location.href).searchParams.get("origin") === "https://photos.google.com"
        || new URL(location.href).searchParams.get("ps") === "picasaweb"
        || /Google Photos Video Player/i.test(new URL(location.href).searchParams.get("aria_label") || "")
      );
      const isCloudPlayerFrame = isDrive || isOneDrive || isGooglePhotos || isGooglePhotosEmbed;
      const isNotebook = /(?:^|\.)notebook(?:lm)?\.google\.com$/i.test(location.hostname);
      const cloudFolder = isOneDrive && (
        (/\/shared(?:[/?#]|$)/i.test(location.pathname) && new URL(location.href).searchParams.has("listurl"))
        || /\/forms\/allitems\.aspx/i.test(location.href)
        || (Boolean(document.querySelector("[role='grid'], [data-automationid='DetailsList'], [data-automationid='DetailsRow']")) && /\bName\b.{0,80}\bModified\b.{0,80}\bFile size\b/is.test(text))
      );
      const playerErrorText = isOneDrive
        ? [text, ...[...document.querySelectorAll("[role='alert'], [aria-live], .ErrorMessage, .error")].map((element) => element.innerText || element.textContent || "")]
          .join(" ").match(/OneDrive\s+doesn't\s+support\s+playing\s+this\s+video|can't\s+play(?:\s+this\s+video)?|try\s+again|not\s+ready|temporarily\s+unavailable/i)?.[0] || ""
        : "";
      const cloudLabels = isCloudPlayerFrame ? deepQuery("[aria-label], [data-tooltip], [title]")
        .flatMap((element) => [element.getAttribute("aria-label"), element.getAttribute("aria-valuetext"), element.getAttribute("data-tooltip"), element.getAttribute("title"), element.textContent])
        .filter(Boolean).join(" ") : "";
      const labelledClocks = isCloudPlayerFrame ? [...`${cloudLabels} ${text}`.matchAll(/(?:duration|length|เวลา|ความยาว|total)\D{0,48}(\d{1,2}:\d{2}(?::\d{2})?)/gi)].map((match) => match[1]) : [];
      // Google Drive can already paint "0:00 / 7:57" or expose the total in
      // the seek slider while the video is paused. That is sufficient duration
      // evidence; do not wait for playback merely to obtain the same number.
      const controlEvidence = `${cloudLabels} ${text}`;
      const fractionClocks = isCloudPlayerFrame
        ? [...controlEvidence.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/g)].map((match) => match[1])
        : [];
      const sliderDurations = isCloudPlayerFrame ? deepQuery("[role='slider'][aria-valuemax], input[type='range'][max]")
        .map((element) => {
          const label = [element.getAttribute("aria-label"), element.getAttribute("aria-valuetext"), element.getAttribute("title")].filter(Boolean).join(" ");
          const maximum = Number(element.getAttribute("aria-valuemax") || element.getAttribute("max"));
          const current = Number(element.getAttribute("aria-valuenow") || element.value || 0);
          return /seek|time|duration|progress|video|audio|เลื่อน|เวลา/i.test(label)
            && Number.isFinite(maximum) && maximum > 0 && maximum <= 8 * 3600
            && (!Number.isFinite(current) || current <= 0.5 || maximum - current > 1) ? maximum : 0;
        }).filter(Boolean) : [];
      const humanDurationSeconds = isCloudPlayerFrame ? [...controlEvidence.matchAll(/(?:\bof\b|\btotal(?:\s+duration)?\b|\bduration\b|\blength\b|จาก|ทั้งหมด|ความยาว|เวลารวม)\D{0,32}((?:(?:\d+)\s*(?:hours?|hrs?|ชั่วโมง|minutes?|mins?|นาที|seconds?|secs?|วินาที)\s*){1,3})/gi)]
        .map((match) => {
          const value = match[1].match(/(?:(\d+)\s*(?:hours?|hrs?|ชั่วโมง))?\s*(?:(\d+)\s*(?:minutes?|mins?|นาที))?\s*(?:(\d+)\s*(?:seconds?|secs?|วินาที))?/i);
          return Number(value?.[1] || 0) * 3600 + Number(value?.[2] || 0) * 60 + Number(value?.[3] || 0);
        })
        .filter((value) => value > 0 && value <= 8 * 3600) : [];
      const clockSeconds = (value) => { const parts = String(value || "").split(":").map(Number); return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : 0; };
      const controlDurationSeconds = Math.max(0, ...fractionClocks.map(clockSeconds), ...sliderDurations, ...humanDurationSeconds);
      // NotebookLM video overviews can expose a short internal animation as
      // <video>.duration while their visible player correctly shows
      // "00:02 / 07:50". The total after the slash is the artifact duration
      // the reviewer sees and must outrank that internal media element.
      const notebookDurationSeconds = isNotebook
        ? Math.max(0, ...[...text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/g)].map((match) => clockSeconds(match[1])))
        : 0;
      const cloudScriptSeconds = isCloudPlayerFrame ? [...pageSource.matchAll(/(?:duration|length|playtime|mediaDuration|durationInSeconds)\D{0,48}["']?(\d{1,2}:\d{2}(?::\d{2})?)["']?/gi)]
        .map((match) => match[1]).map((value) => { const parts = value.split(":").map(Number); return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]; })
        .filter((value) => Number.isFinite(value) && value > 0 && value <= 8 * 3600) : [];
      const adShowing = Boolean(document.querySelector("#movie_player.ad-showing, .html5-video-player.ad-showing"));
      // YouTube embeds the main video's length in the initial player data.
      // This is the actual video metadata, available before or during an ad.
      let mainDurationSeconds = null;
      const frameSources = [...document.querySelectorAll("iframe[src]")].map((frame) => frame.src);
      const scriptSources = [...document.scripts].map((item) => item.textContent || "")
        .flatMap((text) => [...text.matchAll(/https?:\\?\/\\?\/(?:www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)[^"'\\\s<>]+/gi)].map((match) => match[0].replace(/\\\//g, "/")));
      const youtubeEmbedUrl = [...frameSources, ...scriptSources].find((url) => /(?:youtube(?:-nocookie)?\.com|youtu\.be)/i.test(url)) || null;
      if (/(^|\.)youtube(?:-nocookie)?\.com$|youtu\.be$/i.test(location.hostname)) {
        const videoId = new URL(location.href).searchParams.get("v") || location.pathname.split("/").filter(Boolean).at(-1);
        if (videoId) {
          const script = [...document.scripts].map((item) => item.textContent || "")
            .find((text) => text.includes('"videoDetails"') && text.includes(`"videoId":"${videoId}"`));
          const match = script?.match(/"lengthSeconds"\s*:\s*"?(\d+)"?/);
          mainDurationSeconds = match ? Number(match[1]) : null;
        }
      }
      const metadataMediaType = /(?:content|type|mimeType|mime_type)["'\s:=\\]+video\//i.test(pageSource) ? "video"
        : /(?:content|type|mimeType|mime_type)["'\s:=\\]+audio\//i.test(pageSource) ? "audio" : null;
      const pageText = String(document.body?.innerText || document.body?.textContent || "").replace(/\s+/g, " ").trim();
      const loadingIndicatorCount = deepQuery("[aria-busy='true'], [role='progressbar'], .loading, .loader, .spinner, [class*='loading'], [class*='spinner']").filter(visible).length;
      const playerContainerCount = deepQuery("video, audio, iframe[src*='youtube'], iframe[src*='vimeo'], [class*='player'], [id*='player'], [data-testid*='player']").filter(visible).length;
      const networkIssue = /ERR_(?:INTERNET|NETWORK|CONNECTION)|network\s+error|connection\s+(?:failed|lost)|ไม่มีการเชื่อมต่อ|การเชื่อมต่อ.*(?:ล้มเหลว|ขัดข้อง)/i.test(`${pageText} ${document.title}`);
      const isTopFrame = typeof window === "undefined" || window.top === window;
      const pageSignature = isTopFrame ? `${location.href}|${document.title}|${pageText.slice(0, 500)}` : "";
      return { seconds, mainDurationSeconds, controlDurationSeconds, notebookDurationSeconds, embeddedDurationSeconds: Math.max(0, ...isoDuration, ...embeddedDurations, ...cloudScriptSeconds), youtubeEmbedUrl, durationText: youtubeDuration || labelledClocks.at(-1) || times.at(-1) || null, adShowing, ready: document.readyState, isTopFrame, pageFullyLoaded:document.readyState === "complete", pageContentLength:pageText.length, pageSignature, loadingIndicatorCount, playerContainerCount, networkIssue, isDrive, isGooglePhotos:isGooglePhotos || isGooglePhotosEmbed, isOneDrive, isNotebook, cloudFolder, videoElementCount: videos.length, audioElementCount: audios.length, mediaType: videos.length || mainDurationSeconds || controlDurationSeconds || notebookDurationSeconds || youtubeEmbedUrl ? "video" : audios.length ? "audio" : metadataMediaType, videoReadyState: Math.max(0, ...videos.map((video) => Number(video.readyState) || 0)), videoPaused: videos.length ? videos.every((video) => video.paused) : null, playError, playerErrorText };
    },
    args: [startPlayback]
  }), 6000, "อ่านข้อมูลเวลาจากหน้าเล่น");
  const all = results.map((item) => item.result).filter(Boolean);
  // allFrames does not promise that the main frame comes first. Rank every
  // trustworthy duration channel, including the visible duration label used
  // by Google Photos, so an empty iframe cannot hide valid page evidence.
  const { best, durationSeconds } = selectProviderDurationEvidence(all);
  const youtubeEmbedUrl = all.map((item) => item.youtubeEmbedUrl).find(Boolean) || null;
  const playerErrorText = all.map((item) => item.playerErrorText).find(Boolean) || "";
  const playError = all.map((item) => item.playError).find(Boolean) || "";
  const videoElementCount = Math.max(0, ...all.map((item) => Number(item.videoElementCount) || 0));
  const audioElementCount = Math.max(0, ...all.map((item) => Number(item.audioElementCount) || 0));
  const mediaType = all.some((item) => item.mediaType === "video") ? "video" : all.some((item) => item.mediaType === "audio") ? "audio" : null;
  const topFrame = all.find((item) => item.isTopFrame) || {};
  return { accessible: best.ready === "complete", durationSeconds, youtubeEmbedUrl, adShowing: Boolean(best.adShowing && !best.mainDurationSeconds), playerErrorText, hasTransientPlayerError: oneDriveTransientPlayerError(playerErrorText), playError, videoElementCount, audioElementCount, mediaType, pageFullyLoaded:topFrame.pageFullyLoaded === true, pageContentLength:Number(topFrame.pageContentLength) || 0, pageSignature:topFrame.pageSignature || "", loadingIndicatorCount:Number(topFrame.loadingIndicatorCount) || 0, playerContainerCount:Number(topFrame.playerContainerCount) || 0, networkIssue:topFrame.networkIssue === true, cloudFolder:Boolean(all.some((item) => item.cloudFolder)), mediaDetected: Boolean(videoElementCount || audioElementCount || durationSeconds || playerErrorText), videoReadyState: Math.max(0, ...all.map((item) => Number(item.videoReadyState) || 0)), videoPaused: all.find((item) => item.videoPaused !== null)?.videoPaused ?? null, source: best.mainDurationSeconds ? "youtube-metadata" : best.isNotebook && best.notebookDurationSeconds ? "notebooklm-player-control" : best.seconds ? (mediaType === "audio" ? "html-audio" : "html-video") : best.controlDurationSeconds ? (best.isDrive ? "drive-player-control" : best.isGooglePhotos ? "google-photos-player-control" : best.isOneDrive ? "onedrive-player-control" : "player-control") : best.embeddedDurationSeconds ? (best.isDrive ? "drive-metadata" : best.isGooglePhotos ? "google-photos-metadata" : best.isOneDrive ? "onedrive-metadata" : "player-metadata") : best.isDrive ? "drive-player-text" : best.isGooglePhotos ? "google-photos-player-text" : best.isOneDrive ? "onedrive-player-text" : "page-text" };
}

async function probePodcastType(tabId) {
  const results = await withDeadline(() => chrome.scripting.executeScript({
    target:{tabId, allFrames:true},
    func:async () => {
      const text = String(document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 60000);
      // Cloud previews often mount the actual player in an open shadow tree
      // after the outer document has finished loading.
      const deepQuery = (selector) => {
        const found = [...document.querySelectorAll(selector)];
        const visit = (root) => {
          for (const node of root.querySelectorAll("*")) {
            if (!node.shadowRoot) continue;
            found.push(...node.shadowRoot.querySelectorAll(selector));
            visit(node.shadowRoot);
          }
        };
        visit(document);
        return found;
      };
      const markup = `${document.head?.innerHTML || ""} ${deepQuery("audio,video,source").map((node) => node.outerHTML || "").join(" ")}`;
      const videos = deepQuery("video");
      const audios = deepQuery("audio");
      const visibleVideo = videos.some((video) => Number(video.videoWidth) > 0 || Number(video.videoHeight) > 0);
      const isNotebookLm = /(?:^|\.)notebook(?:lm)?\.google\.com$/i.test(location.hostname);
      const isGoogleDrive = /(?:^|\.)drive\.google\.com$/i.test(location.hostname);
      const isOneDrive = /(?:^|\.)(?:onedrive\.live\.com|sharepoint\.com)$/i.test(location.hostname);
      // Drive/OneDrive audio players can be hidden inside an internal/shadow
      // tree. The preview title is the actual file name and remains reliable
      // type evidence even when the provider uses a shared media-player shell.
      const driveTitle = String(document.title || "").trim();
      const driveTitleAudio = isGoogleDrive && /\.(?:m4a|mp3|wav|ogg|oga|aac|flac)(?:\s*[-–—|].*)?$/i.test(driveTitle);
      const driveTitleVideo = isGoogleDrive && /\.(?:mp4|m4v|webm|mov|mkv|avi|wmv|mpeg|mpg)(?:\s*[-–—|].*)?$/i.test(driveTitle);
      const oneDriveTitleAudio = isOneDrive && /\.(?:m4a|mp3|wav|ogg|oga|aac|flac)(?:\s*[-–—|].*)?$/i.test(driveTitle);
      const oneDriveTitleVideo = isOneDrive && /\.(?:mp4|m4v|webm|mov|mkv|avi|wmv|mpeg|mpg)(?:\s*[-–—|].*)?$/i.test(driveTitle);
      const controlText = `${text} ${deepQuery("[aria-label], [aria-valuetext], [title]")
        .flatMap((node) => [node.getAttribute("aria-label"), node.getAttribute("aria-valuetext"), node.getAttribute("title"), node.textContent]).filter(Boolean).join(" ")}`;
      const oneDrivePageAudio = isOneDrive && /\.(?:m4a|mp3|wav|ogg|oga|aac|flac)(?:\b|\s|$)/i.test(controlText);
      const oneDrivePageVideo = isOneDrive && /\.(?:mp4|m4v|webm|mov|mkv|avi|wmv|mpeg|mpg)(?:\b|\s|$)/i.test(controlText);
      const hasClock = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(controlText);
      const notebookIcons = deepQuery('[aria-label], [data-mat-icon-name], mat-icon, .material-symbols-outlined');
      const notebookAudioIcon = notebookIcons.some((node) => /audio|เสียง|graphic_eq|graphic_equalizer|waveform/i.test([node.getAttribute("aria-label"),node.getAttribute("data-mat-icon-name"),node.textContent].join(" ")));
      const notebookVideoIcon = notebookIcons.some((node) => /video|movie|videocam|ภาพรวมวิดีโอ/i.test([node.getAttribute("aria-label"),node.getAttribute("data-mat-icon-name"),node.textContent].join(" ")));
      const notebookUrl = new URL(location.href);
      const selectedNotebookArtifact = /\/artifact\//.test(location.pathname) || notebookUrl.searchParams.has("artifactId");
      const hasPlayerPair = /\d{1,2}:\d{2}(?::\d{2})?\s*\/\s*\d{1,2}:\d{2}(?::\d{2})?/.test(controlText);
      const notebookVideo = isNotebookLm && hasClock && /video\s*overview|ภาพรวมวิดีโอ|วิดีโอภาพรวม/i.test(controlText)
        && (visibleVideo || notebookVideoIcon) && !notebookAudioIcon;
      // The generic NotebookLM banner mentions an audio overview even when no
      // output exists. Require an actual Studio card signal (duration plus
      // Deep Dive/audio title) so an empty three-column page cannot pass.
      const notebookAudio = isNotebookLm && hasClock && /studio/i.test(controlText)
        && (notebookAudioIcon || /deep\s*dive|audio\s*overview|ภาพรวมเสียง|เสียงบรรยาย|พอดแคสต์/i.test(controlText))
        && !notebookVideo;
      const artifactAudio = isNotebookLm && selectedNotebookArtifact
        && !notebookVideo && !visibleVideo
        && notebookAudioIcon && hasPlayerPair;
      const validDuration = (value) => Number.isFinite(value) && value > 0 && value <= 8 * 3600;
      const clockSeconds = (value) => {
        const parts = String(value || "").split(":").map(Number);
        if (!parts.length || !parts.slice(1).every((part) => part < 60)) return 0;
        const seconds = parts.reduce((sum, part) => sum * 60 + part, 0);
        return validDuration(seconds) ? seconds : 0;
      };
      const pair = controlText.match(/\d{1,2}:\d{2}(?::\d{2})?\s*\/\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
      const clocks = [...controlText.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g)].map((match) => match[0]);
      const sliderSeconds = deepQuery("[role='slider'][aria-valuemax], input[type='range'][max]").map((element) => {
        const label = [element.getAttribute("aria-label"), element.getAttribute("aria-valuetext"), element.getAttribute("title")].filter(Boolean).join(" ");
        const maximum = Number(element.getAttribute("aria-valuemax") || element.getAttribute("max"));
        return /seek|time|duration|progress|audio|เลื่อน|เวลา/i.test(label) && validDuration(maximum) ? maximum : 0;
      });
      const cloudControlDuration = Math.max(0, clockSeconds(pair?.[1]), ...clocks.map(clockSeconds), ...sliderSeconds);
      const elementDuration = audios.map((media) => media.duration).find(validDuration) || null;
      // Drive/OneDrive sometimes leave a stale or placeholder duration on an
      // internal media element (for example 16:40) while their visible audio
      // control correctly shows 6:34. For an explicit audio filename, the
      // player-facing clock/seek maximum is the evidence the reviewer sees and
      // must take precedence over that hidden element.
      let durationSeconds = (driveTitleAudio || oneDriveTitleAudio) && cloudControlDuration
        ? cloudControlDuration : elementDuration;
      let durationSource = durationSeconds && (driveTitleAudio || oneDriveTitleAudio) && cloudControlDuration
        ? (driveTitleAudio ? "drive-player-control" : "onedrive-player-control")
        : durationSeconds ? "audio-element" : null;
      if (!durationSeconds && (notebookAudio || artifactAudio || driveTitleAudio || oneDriveTitleAudio)) {
        const chosen = pair?.[1] || (notebookAudio && clocks.length === 1 ? clocks[0] : null);
        if (chosen) {
          durationSeconds = clockSeconds(chosen) || null;
          if (durationSeconds) durationSource = notebookAudio || artifactAudio ? "notebooklm-player-control" : driveTitleAudio ? "drive-player-control" : "onedrive-player-control";
        }
        if (!durationSeconds && (driveTitleAudio || oneDriveTitleAudio)) {
          durationSeconds = Math.max(0, ...sliderSeconds) || null;
          if (durationSeconds) durationSource = driveTitleAudio ? "drive-player-control" : "onedrive-player-control";
        }
      }
      const metadataVideo = /<video\b|(?:content|type|mimeType|mime_type)["'\s:=\\]+video\//i.test(markup);
      const metadataAudio = /<audio\b|(?:content|type|mimeType|mime_type)["'\s:=\\]+audio\//i.test(markup);
      const waveforms = deepQuery("[aria-label], [class], svg").filter((node) => /waveform|audio[-_ ]?wave|คลื่นเสียง/i.test([node.getAttribute("aria-label"),node.getAttribute("class"),node.getAttribute("title")].join(" ")) || (node.tagName?.toLowerCase() === "svg" && node.querySelectorAll("rect,path,line").length >= 30));
      const driveWaveformAudio = isGoogleDrive && waveforms.length > 0 && Boolean(pair) && !visibleVideo && !driveTitleVideo;
      const mediaType = driveTitleVideo || oneDriveTitleVideo || oneDrivePageVideo ? "video"
        : driveTitleAudio || oneDriveTitleAudio || oneDrivePageAudio ? "audio"
        : notebookVideo || visibleVideo || (metadataVideo && !driveWaveformAudio) ? "video"
        : notebookAudio || artifactAudio || audios.length || metadataAudio || driveWaveformAudio ? "audio" : null;
      // Podcast time is deliberately not returned or scored automatically.
      // The probe only verifies whether the destination contains audio/video;
      // the reviewer supplies and confirms the duration in the report.
      return {mediaType, durationSeconds:null, durationSource:null, isNotebookLm, notebookAudio, artifactAudio, notebookVideo, driveTitleAudio, driveTitleVideo, driveWaveformAudio, oneDriveTitleAudio:oneDriveTitleAudio || oneDrivePageAudio, oneDriveTitleVideo:oneDriveTitleVideo || oneDrivePageVideo, audioElementCount:audios.length, videoElementCount:videos.length};
    }
  }), 6000, "ตรวจชนิด Podcast จากหน้าเล่น");
  const frames = results.map((item) => item.result).filter(Boolean);
  const video = frames.find((item) => item.mediaType === "video" && !item.driveWaveformAudio);
  const audio = frames.find((item) => item.mediaType === "audio");
  return video || audio || frames[0] || {mediaType:null};
}

async function inspectPodcastType(targetUrl, runId, deadline = Date.now() + 15000) {
  const isMoodle = isLmsHost(targetUrl);
  const hasPermission = isMoodle || await withDeadline(() => chrome.permissions.contains({origins:providerOriginsForUrl(targetUrl)}), 3000, "ตรวจสิทธิ์อ่านผู้ให้บริการ");
  if (!hasPermission) return {accessible:null, durationSeconds:null, mediaType:null, mediaStatus:"permission_required", accessNote:"ยังไม่ได้อนุญาตสิทธิ์อ่านโดเมนปลายทาง"};
  const directType = mediaTypeFromProviderEvidence({targetUrl});
  if (directType === "video") return {accessible:true, durationSeconds:null, mediaType:"video", mediaStatus:"podcast_video", source:"provider-type", accessNote:"ปลายทางเป็นบริการวิดีโอ — ไม่ผ่านเกณฑ์ Podcast ที่ต้องเป็นคลิปเสียง"};
  const fast = await readFastMediaMetadata(targetUrl, Math.min(4000, Math.max(250, deadline - Date.now())));
  if (["access_denied", "login_required", "link_unavailable"].includes(fast?.mediaStatus)) return {...fast, durationSeconds:null};
  if (fast?.mediaType === "video" || fast?.mediaType === "audio") return {...fast, durationSeconds:null, mediaStatus:fast.mediaType === "video" ? "podcast_video" : "podcast_audio", accessNote:fast.mediaType === "video" ? "ยืนยันจาก metadata ว่าปลายทางเป็นวิดีโอ — ไม่ผ่านเกณฑ์ Podcast" : "ยืนยันว่าเป็นคลิปเสียง — ให้ผู้ตรวจกรอกและยืนยันเวลา"};
  let tab;
  try {
    tab = await createInactiveTab(targetUrl, runId, 8000);
    const accessGate = async () => {
      // A cloud preview may redirect to an access-request page after the tab
      // reports complete. The tab URL also works when scripting is denied.
      const current = await withDeadline(() => chrome.tabs.get(tab.id), 2500, "อ่าน URL ปลายทาง Podcast").catch(() => null);
      return accessGateFromEvidence({url:current?.url || ""}) || await probeAccessGate(tab.id).catch(() => null);
    };
    const gateResult = (gate) => ({accessible:false, durationSeconds:null, mediaType:null, mediaStatus:gate.status === "missing_file" ? "link_unavailable" : gate.status, accessNote:gate.accessNote});
    let gate = await accessGate();
    if (gate) return gateResult(gate);
    const notebook = /(?:^|\.)notebook(?:lm)?\.google\.com$/i.test(new URL(tab.url || targetUrl).hostname);
    const cloudPreview = /(?:^|\.)(?:drive\.google\.com|onedrive\.live\.com|sharepoint\.com)$/.test(new URL(tab.url || targetUrl).hostname);
    const waitUntil = Math.min(deadline, Date.now() + (cloudPreview ? 20000 : notebook ? 12000 : 7000));
    let evidence = {mediaType:fast?.mediaType || null};
    while (Date.now() < waitUntil) {
      await throwIfCancelled(runId);
      gate = await accessGate();
      if (gate) return gateResult(gate);
      const next = await probePodcastType(tab.id).catch(() => evidence);
      if (next.mediaType || !evidence.mediaType) evidence = next;
      if (evidence.mediaType === "video" || evidence.mediaType === "audio") break;
      await waitInterruptibly(900, runId);
    }
    // NotebookLM often postpones rendering Studio in an inactive tab. Bring
    // the owned audit tab forward briefly, read the selected artifact, and
    // restore the user's previous tab. Audio confirmation is enough to enable
    // the reviewer time field even when NotebookLM hides duration metadata.
    if (notebook && !evidence.mediaType && Date.now() < deadline) {
      evidence = await foregroundProviderLimiter.run(() => withTemporaryForeground(tab.id, async () => {
        let latest = evidence;
        for (let poll = 0; poll < 12 && Date.now() < deadline; poll += 1) {
          await throwIfCancelled(runId);
          const next = await probePodcastType(tab.id).catch(() => latest);
          if (next.mediaType || !latest.mediaType) latest = next;
          if (latest.mediaType) break;
          await waitInterruptibly(700, runId);
        }
        return latest;
      }));
    }
    gate = await accessGate();
    if (gate) return gateResult(gate);
    if (evidence.mediaType === "video") return {...evidence, accessible:true, durationSeconds:null, mediaStatus:"podcast_video", source:evidence.notebookVideo ? "notebooklm-video-overview" : "player-type", accessNote:"ปลายทางเป็นวิดีโอ — ไม่ผ่านเกณฑ์ Podcast ที่ต้องเป็นคลิปเสียง"};
    if (evidence.mediaType === "audio") return {...evidence, accessible:true, durationSeconds:null, mediaStatus:"podcast_audio", source:evidence.artifactAudio ? "notebooklm-artifact-audio-player" : evidence.notebookAudio ? "notebooklm-audio-overview" : evidence.driveTitleAudio ? "google-drive-audio-filename" : evidence.oneDriveTitleAudio ? "onedrive-audio-filename" : "audio-player-metadata", accessNote:"ยืนยันว่าเป็นคลิปเสียง — ให้ผู้ตรวจกรอกและยืนยันเวลา"};
    return {...evidence, accessible:true, durationSeconds:null, mediaStatus:"podcast_type_unverified", accessNote:"เปิดลิงก์ได้ แต่ยังยืนยันไม่ได้ว่าเป็นคลิปเสียงหรือวิดีโอ"};
  } catch (error) {
    if (error?.name === "AuditCancelled") throw error;
    return {accessible:false, durationSeconds:null, mediaType:null, mediaStatus:isAuditStepTimeout(error) ? "inspection_timeout" : "link_error", accessNote:`ตรวจชนิด Podcast ไม่สำเร็จ: ${error.message}`};
  } finally {
    if (tab?.id) await closeAuditTab(tab.id);
  }
}

async function discoverH5pMediaSource(tabId) {
  const results = await withDeadline(() => chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const unique = (items) => [...new Set(items.filter(Boolean))];
      const findUrls = (text) => [...String(text || "").matchAll(/https?:\\?\/\\?\/[^"'\\\s<>]+/gi)].map((match) => match[0].replace(/\\\//g, "/"));
      const jsonObjectAfter = (text, marker) => {
        const markerIndex = text.indexOf(marker), start = text.indexOf("{", markerIndex + marker.length);
        if (markerIndex < 0 || start < 0) return null;
        let depth = 0, quote = "", escaped = false;
        for (let index = start; index < text.length; index += 1) {
          const char = text[index];
          if (quote) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === quote) quote = ""; }
          else if (char === '"' || char === "'") quote = char;
          else if (char === "{") depth += 1;
          else if (char === "}" && --depth === 0) return text.slice(start, index + 1);
        }
        return null;
      };
      const frames = [...document.querySelectorAll("iframe[src]")].map((frame) => frame.src);
      const scripts = [...document.scripts].map((item) => item.textContent || "")
        .flatMap((text) => [...text.matchAll(/https?:\\?\/\\?\/(?:www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)[^"'\\\s<>]+/gi)].map((match) => match[0].replace(/\\\//g, "/")));
      const directYoutube = [...frames, ...scripts].find((url) => /(?:youtube(?:-nocookie)?\.com|youtu\.be)/i.test(url));
      if (directYoutube) return directYoutube;
      const integrationScript = [...document.scripts].map((item) => item.textContent || "").find((text) => text.includes("H5PIntegration"));
      const raw = integrationScript && jsonObjectAfter(integrationScript, "var H5PIntegration");
      if (!raw) return null;
      try {
        const integration = JSON.parse(raw), contents = integration.contents || {};
        const serialized = JSON.stringify(contents), urls = unique(findUrls(serialized));
        const youtube = urls.find((url) => /(?:youtube(?:-nocookie)?\.com|youtu\.be)/i.test(url));
        if (youtube) return youtube;
        const sourceValues = [];
        const visit = (value) => {
          if (typeof value === "string") {
            if (/^\s*[\[{]/.test(value)) { try { visit(JSON.parse(value)); return; } catch { /* plain string */ } }
            return;
          }
          if (!value || typeof value !== "object") return;
          const mime = String(value.mime || value.contentType || value.type || "");
          const path = value.path || value.src || value.source || value.videoId || value.id;
          if (path && (/youtube/i.test(mime) || /youtube/i.test(String(value.sourceType || "")))) sourceValues.push({path:String(path), youtube:true});
          else if (path && /\.(?:mp4|webm|m4v|mov|m3u8)(?:[?#].*)?$/i.test(String(path))) sourceValues.push({path:String(path), youtube:false});
          for (const child of Object.values(value)) visit(child);
        };
        visit(contents);
        const definedSource = sourceValues[0];
        if (definedSource) {
          if (definedSource.youtube) {
            if (/^https?:/i.test(definedSource.path)) return definedSource.path;
            if (/^[\w-]{11}$/.test(definedSource.path)) return `https://www.youtube.com/watch?v=${definedSource.path}`;
          }
          if (/^https?:/i.test(definedSource.path)) return definedSource.path;
        }
        const base = urls.find((url) => /\/content\/\d+(?:$|[?#])/i.test(url));
        const strings = [...serialized.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((match) => match[1].replace(/\\\//g, "/"));
        const mediaPath = strings.find((value) => /\.(?:mp4|webm|m4v|mov|m3u8)(?:[?#].*)?$/i.test(value));
        const chosenPath = definedSource?.path || mediaPath;
        if (chosenPath) return /^https?:/i.test(chosenPath) ? chosenPath : base ? `${base.replace(/\/$/, "")}/${chosenPath.replace(/^\.?\//, "")}` : null;
      } catch { /* H5P fallback below */ }
      return null;
    }
  }), 6000, "อ่านแหล่งวิดีโอจาก H5P");
  return results.map((item) => item.result).find(Boolean) || null;
}

async function waitForH5pMediaSource(tabId, runId) {
  // H5P creates the YouTube iframe after its shell has loaded. Poll the live
  // DOM briefly; do not spend minutes retrying one H5P activity.
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    await throwIfCancelled(runId);
    const source = await discoverH5pMediaSource(tabId).catch(() => null);
    if (source) return source;
    await waitInterruptibly(350, runId);
  }
  return null;
}

async function refreshMediaPreview(tabId, runId, deadline, recoveryState) {
    let latest = null;
    while (recoveryState.refreshes < 4) {
      if (Date.now() >= deadline) break;
      await throwIfCancelled(runId);
      recoveryState.refreshes += 1;
      const reloadAttempt = recoveryState.refreshes;
      await recordAuditDiagnostic("media-refresh",{tabId,runId,refreshes:reloadAttempt});
      await withDeadline(() => chrome.tabs.reload(tabId), 5000, "รีเฟรชหน้าเล่นวิดีโอ");
      await waitForTabSettled(tabId, runId, Math.max(500, Math.min(8000, deadline - Date.now())));
      for (let poll = 0; poll < 3; poll += 1) {
        if (Date.now() >= deadline) break;
        await throwIfCancelled(runId);
        const accessGate = await probeAccessGate(tabId).catch(() => null);
        if (accessGate) return { accessible:false, durationSeconds:null, mediaStatus:accessGate.status, accessNote:accessGate.accessNote, foreground:true, reloadAttempt };
        latest = await probeMedia(tabId, poll > 0);
        if (latest.adShowing) latest.durationSeconds = null;
        if (latest.durationSeconds) return { ...latest, foreground: true, reloadAttempt, recoveredAfterReload: true };
        await waitInterruptibly(900, runId);
      }
    }
    return { ...(latest || {}), reloadAttempt:recoveryState.refreshes };
}

async function readOneDriveInForeground(tabId, runId, deadline, recoveryState) {
  return withTemporaryForeground(tabId, async () => {
    let latest = null;
    let reloaded = false;
    let stableCandidate = null;
    let stableCandidateCount = 0;
    for (let poll = 0; poll < 18 && Date.now() < deadline; poll += 1) {
      await throwIfCancelled(runId);
      const accessGate = await probeAccessGate(tabId).catch(() => null);
      if (accessGate) return { accessible:false, durationSeconds:null, mediaStatus:accessGate.status, accessNote:accessGate.accessNote, foreground:true };
      latest = await probeSharePointPlayer(tabId, poll > 1).catch(() => null);
      if (!latest?.durationSeconds) latest = await probeMedia(tabId, poll > 1);
      if (latest.adShowing) latest.durationSeconds = null;
      if (latest.durationSeconds) {
        const authoritative = ["sharepoint-player-clock", "sharepoint-accessible-duration", "onedrive-metadata"].includes(latest.source);
        const rounded = Math.round(Number(latest.durationSeconds));
        if (authoritative) return { ...latest, foreground:true, recoveredAfterForeground:true };
        if (stableCandidate === rounded) stableCandidateCount += 1;
        else { stableCandidate = rounded; stableCandidateCount = 1; }
        // A real media duration is stable. A progressive SharePoint boundary
        // follows the playhead and changes from poll to poll, so never publish
        // it as the clip length after a single observation.
        if (stableCandidateCount >= 2) return { ...latest, foreground:true, recoveredAfterForeground:true, durationSeconds:rounded };
      }
      // Keep one visible player tab alive. A single reload is enough to recover
      // SharePoint's abandoned-session screen without repeatedly opening tabs.
      if (!reloaded && poll === 8 && Date.now() + 2500 < deadline) {
        reloaded = true;
        recoveryState.refreshes += 1;
        await withDeadline(() => chrome.tabs.reload(tabId), 5000, "รีเฟรชหน้าเล่น SharePoint");
        await waitForTabSettled(tabId, runId, Math.max(500, Math.min(6500, deadline - Date.now())));
      }
      await waitInterruptibly(700, runId);
    }
    return { ...(latest || {}), durationSeconds:null, unconfirmedDurationSeconds:stableCandidate, foreground:true, reloaded };
  });
}

async function readNotebookInForeground(tabId, runId, deadline) {
  return withTemporaryForeground(tabId, async () => {
    let latest = null;
    for (let poll = 0; poll < 24 && Date.now() < deadline; poll += 1) {
      await throwIfCancelled(runId);
      const accessGate = await probeAccessGate(tabId).catch(() => null);
      if (accessGate) return { accessible:false, durationSeconds:null, mediaStatus:accessGate.status, accessNote:accessGate.accessNote, foreground:true };
      latest = await probeTopFrameProviderMedia(tabId, poll > 0, "notebooklm");
      if (latest.durationSeconds) return { ...latest, foreground:true, recoveredAfterForeground:true };
      await waitInterruptibly(700, runId);
    }
    return { ...(latest || {}), foreground:true };
  });
}

async function readGooglePhotosInForeground(tabId, runId, deadline) {
  return withTemporaryForeground(tabId, async () => {
    let latest = null;
    for (let poll = 0; poll < 14 && Date.now() < deadline; poll += 1) {
      await throwIfCancelled(runId);
      const gate = await probeAccessGate(tabId).catch(() => null);
      if (gate) return {accessible:false,durationSeconds:null,mediaStatus:gate.status,accessNote:gate.accessNote,foreground:true};
      latest = await probeMedia(tabId, poll > 0);
      if (latest.durationSeconds) return {...latest,foreground:true,recoveredAfterForeground:true};
      await waitInterruptibly(650, runId);
    }
    return {...(latest || {}),foreground:true};
  });
}

async function responseTextWithin(response, byteLimit = 1200000) {
  const reader = response.body?.getReader?.();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (total < byteLimit) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value?.byteLength || 0;
      text += decoder.decode(value, { stream:true });
      if (total >= byteLimit) break;
    }
    text += decoder.decode();
    return text;
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function readFastMediaMetadata(targetUrl, maxWaitMs = 4500) {
  if (!isFastMetadataHost(targetUrl)) return null;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(250, maxWaitMs));
  try {
    const response = await fetch(targetUrl, { redirect:"manual", credentials:"include", signal:controller.signal, headers:{ Accept:"text/html,application/xhtml+xml" } });
    const locationHeader = response.headers.get("location");
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      const redirectGate = locationHeader && accessGateFromEvidence({url:new URL(locationHeader,targetUrl).href});
      if (redirectGate?.status === "access_denied") return {accessible:false,durationSeconds:null,mediaStatus:"access_denied",accessNote:redirectGate.accessNote,source:"provider-redirect",fastMetadataMs:Date.now()-startedAt};
      if (locationHeader && /(?:login\.microsoftonline\.com|accounts\.google\.com)/i.test(locationHeader)) {
        return { accessible:false, durationSeconds:null, mediaStatus:"login_required", accessNote:"ต้องลงชื่อเข้าใช้ผู้ให้บริการก่อนจึงตรวจลิงก์นี้ได้", source:"provider-redirect", fastMetadataMs:Date.now() - startedAt };
      }
      return null;
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    const directMediaType = mediaTypeFromProviderEvidence({ contentType, targetUrl, finalUrl:response.url });
    if (!contentType.includes("html") && !contentType.includes("json") && !contentType.includes("javascript")) {
      return directMediaType ? { accessible:true, durationSeconds:null, mediaDetected:true, mediaType:directMediaType, mediaStatus:"metadata_missing", accessNote:"ยืนยันชนิดสื่อจาก Content-Type แต่ยังไม่พบเวลา", source:"provider-content-type", fastMetadataMs:Date.now() - startedAt } : null;
    }
    const markup = await responseTextWithin(response);
    const unavailable = unavailableMediaFromProviderMarkup(markup, targetUrl, response.url);
    if (unavailable) {
      return { accessible:false, durationSeconds:null, ...unavailable, source:"youtube-playability", fastMetadataMs:Date.now() - startedAt };
    }
    // Remove large script/style blocks before limiting the text. Provider pages often
    // put their visible access/not-found message after tens of KB of bootstrap code.
    const stripped = markup
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 24000);
    const gate = filterProviderMarkupAccessGate(accessGateFromEvidence({ url:response.url, bodyText:stripped }), targetUrl, response.url);
    if (["missing_file", "empty_media", "login_required", "access_denied"].includes(gate?.status)) {
      return { accessible:false, durationSeconds:null, mediaStatus:gate.status === "missing_file" ? "link_unavailable" : gate.status, accessNote:gate.accessNote, source:"provider-response", fastMetadataMs:Date.now() - startedAt };
    }
    const found = durationFromProviderMarkup(markup, targetUrl, response.url);
    const mediaType = mediaTypeFromProviderEvidence({ contentType, markup, targetUrl, finalUrl:response.url });
    return found
      ? { ...found, accessible:true, mediaDetected:true, mediaType, mediaStatus:"duration_read", accessNote:"", fastMetadataMs:Date.now() - startedAt }
      : { accessible:true, durationSeconds:null, mediaDetected:Boolean(mediaType), mediaType, mediaStatus:"metadata_missing", accessNote:"", source:"provider-response", fastMetadataMs:Date.now() - startedAt };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function readMedia(targetUrl, runId, deadline = Date.now() + 90000, declaredDurationSeconds = null, recoveryState = {refreshes:0}) {
  await recordAuditDiagnostic("media-read",{url:targetUrl,runId,refreshes:recoveryState.refreshes});
  const isMoodle = isLmsHost(targetUrl);
  const hasPermission = isMoodle || await withDeadline(() => chrome.permissions.contains({ origins: providerOriginsForUrl(targetUrl) }), 3000, "ตรวจสิทธิ์อ่านผู้ให้บริการ");
  if (!hasPermission) return { accessible: null, durationSeconds: null, needsProviderPermission: true, mediaStatus:"permission_required", accessNote: "ยังไม่ได้อนุญาตสิทธิ์อ่านโดเมนปลายทาง" };
  const fastMetadata = await readFastMediaMetadata(targetUrl, Math.min(4500, Math.max(250, deadline - Date.now())));
  if (fastMetadata?.durationSeconds || ["link_unavailable", "empty_media", "login_required", "access_denied"].includes(fastMetadata?.mediaStatus)) return fastMetadata;
  if (fastMetadata?.accessible && declaredDurationSeconds) return {
    ...fastMetadata,
    durationSeconds:declaredDurationSeconds,
    mediaDetected:true,
    mediaStatus:"duration_read_declared",
    source:"title-declared-duration",
    accessNote:"ยืนยันว่าลิงก์เปิดได้ และใช้เวลาที่ระบุแบบเจาะจงในชื่อรายการ เพราะผู้ให้บริการไม่ส่ง metadata เวลา"
  };
  if (Date.now() >= deadline) return { accessible:null, durationSeconds:null, mediaStatus:"inspection_timeout", accessNote:"ตรวจ metadata ครบเวลารายการแล้ว — ไปตรวจรายการถัดไป" };
  const host = new URL(targetUrl).hostname;
  const isH5P = /\/mod\/(h5pactivity|hvp)\/view\.php/.test(targetUrl);
  const isYouTube = /(?:^|\.)youtube(?:-nocookie)?\.com$|youtu\.be$/i.test(host);
  const isNotebook = /(?:^|\.)notebook(?:lm)?\.google\.com$/i.test(host);
  const isHeyGen = /(?:^|\.)heygen\.com$/i.test(host);
  const isDrive = /(^|\.)drive\.google\.com$/i.test(host);
  const isGooglePhotos = /^(?:photos\.google\.com|photos\.app\.goo\.gl)$/i.test(host);
  const isOneDrive = /(^|\.)(?:1drv\.ms|onedrive\.live\.com|sharepoint\.com)$/i.test(host);
  const slowProvider = isH5P || isYouTube || isNotebook || isOneDrive || isGooglePhotos || /heygen|vidyard|loom|canva|drive\.google/.test(host);
  // Some providers initialise their player only after the page has been idle.
  // Retry in a fresh background tab, rather than treating one empty duration as
  // a missing video. Only failed links pay the extra waiting time.
  const tabAttempts = isOneDrive ? 1 : isH5P || isYouTube ? 2 : slowProvider ? 3 : 2;
  const polls = isOneDrive ? 1 : isH5P ? 2 : isYouTube ? 4 : slowProvider ? 7 : 5;
  let last = { accessible: false, durationSeconds: null };
  let opened = false;
  let confirmedNoPlayerAttempts = 0;
  for (let tabAttempt = 1; tabAttempt <= tabAttempts; tabAttempt += 1) {
    if (Date.now() >= deadline) break;
    let tab;
    let noVideoProbe = {};
    try {
      // An access-denied screen normally renders before a video preview.  Give
      // it a small window, classify it, and close rather than paying the full
      // player timeout (often 15+ seconds per inaccessible link).
      tab = await createInactiveTab(targetUrl, runId, (isH5P || isYouTube) ? 3500 : 2800);
      opened = true;
      const redirectedTab = await withDeadline(() => chrome.tabs.get(tab.id), 2500, "อ่าน URL หลัง redirect").catch(() => null);
      const redirectedHost = (() => { try { return new URL(redirectedTab?.url || targetUrl).hostname; } catch { return ""; } })();
      const tabIsOneDrive = isOneDrive || /(^|\.)(?:1drv\.ms|onedrive\.live\.com|sharepoint\.com)$/i.test(redirectedHost);
      let accessGate = await probeAccessGate(tab.id).catch(() => null);
      accessGate = await confirmMissingFileAfterOneRefresh(tab.id, accessGate, runId);
      if (accessGate) return { accessible:false, durationSeconds:null, mediaStatus:accessGate.status, accessNote:accessGate.accessNote, attempts:tabAttempt };
      await waitInterruptibly(tabIsOneDrive ? 450 : isH5P ? 600 : isGooglePhotos ? 250 : declaredDurationSeconds ? 300 : slowProvider ? 3500 : 2200, runId);
      accessGate = await probeAccessGate(tab.id).catch(() => null);
      accessGate = await confirmMissingFileAfterOneRefresh(tab.id, accessGate, runId);
      if (accessGate) return { accessible:false, durationSeconds:null, mediaStatus:accessGate.status, accessNote:accessGate.accessNote, attempts:tabAttempt };
      if (declaredDurationSeconds) return {
        accessible:true,
        durationSeconds:declaredDurationSeconds,
        mediaDetected:true,
        mediaStatus:"duration_read_declared",
        source:"title-declared-duration",
        accessNote:"ยืนยันว่าหน้าปลายทางเปิดได้ และใช้เวลาที่ระบุแบบเจาะจงในชื่อรายการ เพราะหน้า player ยังไม่เปิดเผย metadata",
        attempts:tabAttempt
      };
      // InteractiveVideo may embed YouTube or a local MP4 inside H5P content.
      // Discover the real source first so the player shell is never timed.
      if (isH5P) {
        const h5pSource = await waitForH5pMediaSource(tab.id, runId);
        if (h5pSource) {
          // Release the H5P shell before opening the underlying provider. If
          // two H5P shells kept both tab slots while recursing, neither source
          // player could open.
          await closeAuditTab(tab.id);
          tab = null;
          const sourceResult = await readMedia(h5pSource, runId, deadline, null, recoveryState);
          return { ...sourceResult, source: "h5p-media-source", h5pSourceUrl: h5pSource };
        }
      }
      for (let poll = 0; poll < polls; poll += 1) {
        if (Date.now() >= deadline) break;
        await throwIfCancelled(runId);
        if (tabIsOneDrive) {
          const accessGate = await probeAccessGate(tab.id).catch(() => null);
          if (accessGate) return { accessible:false, durationSeconds:null, mediaStatus:accessGate.status, accessNote:accessGate.accessNote, attempts:tabAttempt, polls:poll + 1 };
        }
        // Some Drive streams publish a finite duration only after their muted
        // player has initialised. This happens in the temporary audit tab, not
        // in the user's visible tab, and is required for files that otherwise
        // remain falsely marked "needs review" despite being playable.
        // Read embedded metadata before attempting playback.  Playback is a
        // last local fallback, avoiding a full Preview wait whenever a
        // provider has already exposed a reliable duration.
        const result = tabIsOneDrive
          ? await probeSharePointPlayer(tab.id, poll > 0).catch(() => probeMedia(tab.id, poll > 0))
          : (isNotebook || isHeyGen)
          ? await probeTopFrameProviderMedia(tab.id, poll > 0, isNotebook ? "notebooklm" : "heygen")
          : await probeMedia(tab.id, isH5P || poll > 0);
        // YouTube's HTML video exposes an ad duration first. Never accept it
        // as the teaching-video duration; continue until the main player loads.
        last = { ...result, durationSeconds: result.adShowing ? null : result.durationSeconds, attempts: tabAttempt, polls: poll + 1 };
        noVideoProbe = updateNoVideoProbe(noVideoProbe, last);
        if (last.cloudFolder) return { ...last, durationSeconds:null, mediaStatus:"cloud_folder", accessNote:"ปลายทางเป็นโฟลเดอร์ Cloud ไม่ใช่วิดีโอหนึ่งคลิป — ไม่นับเวลาของโฟลเดอร์; ตรวจจากลิงก์ไฟล์วิดีโอรายคลิป" };
        const authoritativeOneDriveDuration = ["sharepoint-player-clock", "sharepoint-accessible-duration", "onedrive-metadata"].includes(last.source);
        if (last.durationSeconds && (!tabIsOneDrive || authoritativeOneDriveDuration)) return { ...last, mediaStatus:"duration_read", accessNote: "" };
        await waitInterruptibly(isH5P ? 600 : slowProvider ? 1900 : 1500, runId);
      }
      if (tabIsOneDrive && !last.durationSeconds && Date.now() < deadline) {
        const foreground = await foregroundProviderLimiter.run(() => readOneDriveInForeground(tab.id, runId, deadline, recoveryState));
        last = { ...foreground, attempts: tabAttempt, polls: polls + 10 };
        if (last.cloudFolder) return { ...last, durationSeconds:null, mediaStatus:"cloud_folder", accessNote:"ปลายทางเป็นโฟลเดอร์ Cloud ไม่ใช่วิดีโอหนึ่งคลิป — ไม่นับเวลาของโฟลเดอร์; ตรวจจากลิงก์ไฟล์วิดีโอรายคลิป" };
        if (last.durationSeconds) return { ...last, mediaStatus:"duration_read", accessNote: "อ่านเวลาได้จากแท็บ SharePoint/OneDrive เบื้องหน้า" };
        if (["access_denied", "login_required", "link_unavailable"].includes(last.mediaStatus)) return last;
        if (/NotAllowedError|user gesture|gesture/i.test(last.playError || "") || last.mediaDetected || last.videoReadyState >= 1) {
          return { ...last, accessible:true, mediaStatus:"play_required", accessNote:"เปิดคลิปได้ แต่ SharePoint/OneDrive ต้องให้ผู้ใช้กดเล่นเพื่อเปิดเผยเวลา — เปิดรายการนี้ค้างไว้แล้วกดเล่น จากนั้นตรวจอีกครั้ง" };
        }
        return { ...last, accessible:true, mediaStatus:"play_required", accessNote:last.hasTransientPlayerError
          ? `เปิดคลิปได้ แต่ player ต้องทำงานในแท็บเบื้องหน้า (${last.playerErrorText || "ยังไม่พร้อม"}) — กดเล่นแล้วตรวจอีกครั้ง`
          : "เปิดคลิปได้ แต่ยังไม่เปิดเผยเวลา — กดเล่นในแท็บเบื้องหน้าแล้วตรวจอีกครั้ง" };
      }
      if (isGooglePhotos && !last.durationSeconds && Date.now() < deadline) {
        const foreground = await foregroundProviderLimiter.run(() => readGooglePhotosInForeground(tab.id, runId, deadline));
        last = {...foreground,attempts:tabAttempt,polls:polls + 14};
        if (last.durationSeconds) return {...last,mediaStatus:"duration_read",accessNote:"อ่านเวลาได้จากตัวเล่น Google Photos หลังเปิดแท็บตรวจชั่วคราว"};
        if (["access_denied", "login_required", "link_unavailable"].includes(last.mediaStatus)) return last;
      }
      if (isNotebook && !last.durationSeconds && Date.now() < deadline) {
        const foreground = await foregroundProviderLimiter.run(() => readNotebookInForeground(tab.id, runId, deadline));
        last = { ...foreground, attempts:tabAttempt, polls:polls + 20 };
        if (last.durationSeconds) return { ...last, mediaStatus:"duration_read", accessNote:"อ่านเวลาได้จากตัวเล่น NotebookLM หลังเปิดแท็บตรวจชั่วคราว" };
        if (["access_denied", "login_required", "link_unavailable"].includes(last.mediaStatus)) return last;
      }
      if (!tabIsOneDrive && !last.durationSeconds && recoveryState.refreshes < 4 && Date.now() < deadline) {
        last = await refreshMediaPreview(tab.id, runId, deadline, recoveryState);
        if (last.durationSeconds) return {...last, mediaStatus:"duration_read", accessNote:"อ่านเวลาจริงได้หลังรีเฟรชหน้าเล่น"};
        if (["access_denied", "login_required", "link_unavailable"].includes(last.mediaStatus)) return last;
      }
      if (noVideoProbe.confirmed) confirmedNoPlayerAttempts += 1;
    } catch (error) {
      if (error?.name === "AuditCancelled") throw error;
      last = { accessible: false, error: error.message, timedOut:isAuditStepTimeout(error), durationSeconds: null, attempts: tabAttempt };
    } finally {
      if (tab?.id) await closeAuditTab(tab.id);
    }
    if (tabAttempt < tabAttempts && Date.now() < deadline) await waitInterruptibly(Math.min(1800 * tabAttempt, Math.max(0, deadline - Date.now())), runId);
  }
  if (isH5P && last.youtubeEmbedUrl) {
    const sourceResult = await readMedia(last.youtubeEmbedUrl, runId, deadline, null, recoveryState);
    if (sourceResult.durationSeconds) return { ...sourceResult, source: "h5p-youtube-source", h5pSourceUrl: last.youtubeEmbedUrl };
  }
  if (confirmedNoPlayerAttempts >= 2) return { ...last, accessible:true, durationSeconds:null, mediaDetected:false, mediaStatus:"no_video", accessNote:"เปิดปลายทางและตรวจซ้ำแล้ว แต่ไม่พบตัวเล่นหรือสื่อวิดีโอ" };
  if (Date.now() >= deadline || last.timedOut) return { ...last, durationSeconds:null, mediaStatus:"player_not_ready", accessNote:"หน้าเล่นยังโหลดข้อมูลเวลาไม่สำเร็จ — ระบบจะเปิดใหม่ด้วยรอบกู้คืนอัตโนมัติ" };
  if (last.error) return { ...last, mediaStatus:"link_error", accessNote: `เปิดปลายทางไม่ได้: ${last.error}` };
  if (opened) return { ...last, mediaStatus:"duration_unavailable", accessNote: "เปิดปลายทางได้ แต่ระบบลองรอและเริ่มเล่นแล้ว แต่ผู้ให้บริการไม่เปิดเผยเวลา" };
  return { ...last, mediaStatus:"link_error", accessNote: "เปิดปลายทางไม่ได้" };
}

// A phrase such as "การเขียน figure ครั้งที่ 1" can describe a subtopic,
// not the course's first week. The imported mapper votes from every named item
// inside each Moodle SECTION so one decorative heading cannot merge weeks.

function result(status, detail) { return { status, detail }; }
function presentExternal(items, label) {
  if (!items.length) return result("fail", `ไม่พบ${label}`);
  const externalItems = items.filter((item) => item.linkStatus === "external");
  if (externalItems.length) return result("pass", `พบ${label}เป็นลิงก์ภายนอก ${externalItems.length} รายการ`);
  if (items.every((item) => item.linkStatus === "internal")) return result("fail", `พบ${label} แต่เป็นกิจกรรมภายใน Moodle`);
  return result("needs_review", `พบ${label} แต่ยังยืนยันปลายทางลิงก์ไม่ได้`);
}
function presentAiTutor(items) {
  if (!items.length) return result("fail", "ไม่พบลิงก์ AI Tutor");
  const confirmed = items.filter((item) => item.aiChatStatus === "confirmed" && item.aiChatConfirmed);
  if (confirmed.length) return result("pass", `พบลิงก์ AI Tutor ที่เปิดเป็นหน้าแชทกับ AI ${confirmed.length} รายการ`);
  if (items.some((item) => ["access_denied","login_required","link_unavailable"].includes(item.aiChatStatus))) {
    return result("fail", "ลิงก์ AI Tutor ไม่สามารถเข้าถึงได้");
  }
  if (items.some((item) => item.aiChatStatus === "not_chat")) {
    return result("fail", "ลิงก์ AI Tutor เปิดได้ แต่ปลายทางไม่ใช่หน้าแชทกับ AI");
  }
  if (items.some((item) => item.aiChatStatus === "permission_required")) {
    return result("needs_review", "พบลิงก์ AI Tutor แต่เครื่องตรวจยังไม่มีสิทธิ์ยืนยันหน้าแชท");
  }
  return result("needs_review", "พบลิงก์ AI Tutor แต่ระบบยังยืนยันหน้าแชทไม่ได้");
}
function presentQuiz(items, label) {
  const itemNames = (values) => values.map((item) => String(item.title || "ไม่ระบุชื่อ").replace(/\s+(?:Quiz|File|URL)$/i, "")).join(", ");
  const moodleQuizzes = items.filter((item) => /\/mod\/quiz\/view\.php/i.test(item.href || ""));
  // The university rule does not count Moodle Quiz for the Pre/Post rows.
  // Keep it visible as excluded evidence so the reviewer can see why a named
  // Quiz did not grant a pass, while allowing a separate question heading,
  // question file or written task to satisfy the row.
  const tolerated = moodleQuizzes.filter((item) => item.currentSemesterQuiz?.eligible);
  const excluded = moodleQuizzes.filter((item) => !item.currentSemesterQuiz?.eligible);
  const eligibleItems = items.filter((item) => !/\/mod\/quiz\/view\.php/i.test(item.href || "") || item.currentSemesterQuiz?.eligible);
  const quizNote = `${tolerated.length ? ` · ผ่อนปรน Moodle Quiz ภาค 1/2569 Week 1–10 จำนวน ${tolerated.length} รายการ` : ""}${excluded.length ? ` · พบ Quiz ในระบบ Moodleที่ไม่นับตามเกณฑ์ ${excluded.length} รายการ: ${itemNames(excluded)}` : ""}`;
  const answer = (status, detail) => result(status, detail + quizNote);
  // Pre/Post may be supplied as a question file (PDF/resource) or as an
  // external link. Presence of the explicitly named file is sufficient.
  const namedFiles = eligibleItems.filter((item) => /\/mod\/resource\/view\.php/i.test(item.href || "")
    || item.fileTypeHint || /\.(?:pdf|docx?|pptx?)(?:$|[?#])/i.test(item.externalUrl || item.href || ""));
  if (namedFiles.length) return answer("pass", `พบ${label}ในรูปแบบไฟล์ ${namedFiles.length} รายการ: ${itemNames(namedFiles)}`);
  const writtenAssignments = eligibleItems.filter((item) => /\/mod\/assign\/view\.php/i.test(item.href || ""));
  if (writtenAssignments.length) return answer("pass", `พบ${label}เป็นคำถามแบบอัตนัย/ตอบส่งงานใน Moodle ${writtenAssignments.length} รายการ: ${itemNames(writtenAssignments)}`);
  const titledQuestions = eligibleItems.filter((item) => /[?？]|(?:อย่างไร|อะไร|เพราะเหตุใด|ทำไม|ข้อใด|เท่าไร)(?:\s|$|[?.])/i.test(item.title || ""));
  if (titledQuestions.length) return answer("pass", `พบ${label}เป็นคำถามในหัวข้อ ${titledQuestions.length} รายการ: ${itemNames(titledQuestions)}`);
  const textAssessments = eligibleItems.filter((item) => item.evidenceType === "assessment_text");
  if (textAssessments.length) return answer("pass", `พบ${label}เป็นโจทย์และคำสั่งส่งคำตอบใน Section ${textAssessments.length} รายการ: ${itemNames(textAssessments)}`);
  if (eligibleItems.some(item => item.forumTaskConfirmed && /\/mod\/(?:forum|chat)\/view\.php/i.test(item.href || ''))) return answer('pass', `พบ${label}`);
  const external = presentExternal(eligibleItems, label);
  return answer(external.status, external.detail);
}

function podcastEvaluationForWeek(list, requiredSeconds) {
  const allCountable = list.filter((item) => item.kind === "podcast" && item.linkStatus === "external");
  const duplicates = allCountable.filter((item) => item.countingEligible === false);
  const candidates = allCountable.filter((item) => item.countingEligible !== false);
  const videos = candidates.filter((item) => item.mediaType === "video");
  const audios = candidates.filter((item) => item.mediaType === "audio");
  const unknownTypes = candidates.filter((item) => !item.mediaType && !["access_denied", "login_required", "link_unavailable", "link_error"].includes(item.mediaStatus));
  const internal = list.filter((item) => item.kind === "podcast" && item.podcastDelivery === "internal_upload");
  const internalVideos = internal.filter((item) => item.mediaType === "video");
  const failedLinks = candidates.filter((item) => ["access_denied", "login_required", "link_unavailable", "link_error"].includes(item.mediaStatus));
  const knownSeconds = audios.reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
  const unconfirmedAudio = audios.filter((item) => !item.durationSeconds).length;
  const status = podcastComplianceResult(candidates, requiredSeconds);
  const single = candidates.length === 1 && !duplicates.length && !internal.length ? candidates[0] : null;
  const singleSource = "Podcast ภายนอก";
  const singleDetail = single?.mediaType === "video"
    ? `${singleSource} 1 รายการ — ปลายทางเป็นวิดีโอ (ไม่ผ่านและไม่นับเวลา): ${single.title || "ไม่ระบุชื่อ"} · ${clock(knownSeconds)} / ${clock(requiredSeconds)}`
    : failedLinks.length === 1 && single === failedLinks[0]
    ? `${singleSource} 1 รายการ — ${single.accessNote || "ลิงก์เปิดไม่ได้"} · ${clock(knownSeconds)} / ${clock(requiredSeconds)}`
    : unknownTypes.length === 1 && single === unknownTypes[0]
    ? `${singleSource} 1 รายการ — ยังยืนยันว่าเป็นคลิปเสียงหรือวิดีโอไม่ได้ · ${clock(knownSeconds)} / ${clock(requiredSeconds)}`
    : single?.mediaType === "audio" && !single.durationSeconds
    ? `${singleSource} 1 รายการ — ยืนยันว่าเป็นคลิปเสียงแล้ว แต่รอผู้ตรวจกรอกและยืนยันเวลา · ${clock(knownSeconds)} / ${clock(requiredSeconds)}`
    : single?.mediaType === "audio"
    ? `${singleSource} 1 รายการ — ผู้ตรวจยืนยันเวลาคลิปเสียงแล้ว · ${clock(knownSeconds)} / ${clock(requiredSeconds)}`
    : null;
  const detail = singleDetail || (`${audios.length} คลิปเสียงภายนอกที่นับได้ · ผู้ตรวจยืนยันเวลา ${audios.filter((item) => item.reviewerDurationConfirmed).length}/${audios.length} รายการ · ${clock(knownSeconds)} / ${clock(requiredSeconds)}`
    + (videos.length ? ` · พบ Podcast รูปแบบวิดีโอ ${videos.length} รายการ (ไม่ผ่านและไม่นับเวลา): ${videos.map((item) => item.title || "ไม่ระบุชื่อ").join(", ")}` : "")
    + (internalVideos.length ? ` · พบ Podcast รูปแบบวิดีโอใน Moodle ${internalVideos.length} รายการ (ไม่ผ่านและไม่นับเวลา)` : "")
    + (unknownTypes.length ? ` · ยังยืนยันว่าเป็นคลิปเสียงหรือวิดีโอไม่ได้ ${unknownTypes.length} รายการ` : "")
    + (failedLinks.length ? ` · ${failedLinks.map((item) => item.accessNote || "ลิงก์ Podcast เปิดไม่ได้").join(" · ")}` : "")
    + (unconfirmedAudio ? ` · รอผู้ตรวจกรอกและยืนยันเวลา ${unconfirmedAudio} รายการ` : "")
    + (duplicates.length ? ` · พบปลายทางซ้ำ ${duplicates.length} รายการ (ไม่นับซ้ำ)` : "")
    + (internal.length ? ` · พบ Podcast อัปโหลดใน Moodle ${internal.length} รายการ (ไม่ผ่าน: ต้องเป็นคลิปเสียงผ่านลิงก์ภายนอก)` : ""));
  return { podcasts:audios.length, externalPodcasts:candidates.length, podcastVideos:videos.length, unknownPodcastTypes:unknownTypes.length, internalPodcasts:internal.length, knownPodcastSeconds:knownSeconds, unreadAudioPodcasts:unconfirmedAudio, unknownPodcasts:unconfirmedAudio + unknownTypes.length, podcastRequiredSeconds:requiredSeconds, podcastStatus:status, definitivePodcastFailure:status === "fail", result:result(status, detail) };
}

function checklistForWeek(section, list, metrics, isFirst, courseType, instructorEvidence = null) {
  const allExternalVideos = list.filter((item) => item.kind === "video" && item.linkStatus === "external");
  const duplicateVideos = allExternalVideos.filter((item) => item.countingEligible === false && !item.reviewExcluded);
  const cloudFolders = allExternalVideos.filter((item) => item.mediaStatus === "cloud_folder");
  const videos = allExternalVideos.filter((item) => item.countingEligible !== false && item.mediaStatus !== "cloud_folder");
  const internalVideos = list.filter((item) => item.kind === "video" && item.linkStatus !== "external");
  const uploadedInternalVideos = internalVideos.filter((item) => item.linkStatus === "internal" && (item.internalVideoDelivery === "internal_upload" || item.resource?.isVideo || item.fileTypeHint === "video" || /(?:video|media)/i.test(String(item.moduleTypeHint || "")) || item.evidenceType === "video_internal_media"));
  const unresolvedInternalVideos = internalVideos.filter((item) => !uploadedInternalVideos.includes(item));
  const allFiles = list.filter((item) => item.kind === "file" || item.kind === "file_link");
  // Preserve the verified PDF subset for precise wording. The approved
  // teaching-document tolerance below still passes a known non-PDF document
  // and explicitly discloses its actual type in the result.
  const files = allFiles.filter((item) => item.fileVerification === "pdf" || item.isPdf);
  const planItems = allFiles.filter(isTeachingPlanFile);
  const materialItems = allFiles.filter((item) => !isTeachingPlanFile(item));
  const misplacedDocumentAssignments = list.filter((item) => item.misplacedDocumentAssignment);
  const misplacedPlanAssignments = misplacedDocumentAssignments.filter(isTeachingPlanFile);
  const misplacedMaterialAssignments = misplacedDocumentAssignments.filter((item) => !isTeachingPlanFile(item));
  const planFiles = planItems.filter((item) => item.fileVerification === "pdf" || item.isPdf);
  const materials = materialItems.filter((item) => item.fileVerification === "pdf" || item.isPdf);
  // The first-session document criterion includes the course outline and the
  // 15-session teaching plan. From session 2 onward plan/material stay split.
  const firstSessionDocuments = files;
  const fileName = (item) => {
    const label = String(item.title || "ไฟล์ไม่ระบุชื่อ").replace(/\s+File$/i, "");
    if (item.resource?.previewStatus === "file_too_large") return label + " (ไฟล์ใหญ่เกินกว่าจะเปิดดูตัวอย่าง — ไม่ใช่ PDF)";
    if (item.resource?.sourceType === "google_editor") return label + " (Google Docs/Slides/Sheets — ไม่ใช่ PDF)";
    if (item.resource?.sourceType === "online_document") return label + " (เอกสารออนไลน์ Gamma — ไม่ใช่ PDF)";
    if (item.resource?.sourceType === "image") return label + " (ไฟล์รูปภาพ" + (item.resource?.contentType ? " " + item.resource.contentType : "") + " — ไม่ใช่ PDF)";
    const targetName = String(item.resource?.name || "").trim();
    // Preserve both the activity label and the resolved filename. A Moodle
    // resource can be titled "แผนทางเดินเอกสาร" while its target has another
    // filename; showing only the latter made two distinct activities look like
    // a scanner duplicate in the report.
    if (targetName && !label.toLocaleLowerCase("th").includes(targetName.toLocaleLowerCase("th"))) return `${label} (ไฟล์ปลายทาง: ${targetName})`;
    return targetName || label;
  };
  const fileDetail = (items) => {
    const nonPdf = items.filter((item) => item.fileVerification === "not_pdf");
    const unresolved = items.filter((item) => !item.isPdf && item.fileVerification !== "not_pdf");
    const nonPdfText = nonPdf.length ? " · ยืนยันว่าไม่ใช่ PDF " + nonPdf.length + " รายการ: " + nonPdf.map(fileName).join(", ") : "";
    const unresolvedText = unresolved.length ? " · เปิดปลายทางแล้วแต่ยืนยันว่าเป็น PDF ไม่ได้ " + unresolved.length + " รายการ: " + unresolved.map(fileName).join(", ") : "";
    return nonPdfText + unresolvedText;
  };
  const documentResult = (confirmed, candidates, label, misplaced = []) => {
    const placementDetail = misplaced.length ? ` · ${MISPLACED_DOCUMENT_MESSAGE}` : "";
    const detail = fileDetail(candidates) + placementDetail;
    if (confirmed.length) return result("pass", "พบ File PDF " + label + " " + confirmed.length + " รายการ: " + confirmed.map(fileName).join(", ") + detail);
    // Approved tolerance: the existence of a teaching document satisfies the
    // row even when it is not PDF. Keep actual type evidence in the detail.
    if (candidates.length) return result("pass", "พบเอกสาร " + label + " " + candidates.length + " รายการ: " + candidates.map(fileName).join(", ") + detail);
    return result("fail", "ไม่พบเอกสาร " + label + detail);
  };
  const pre = list.filter((item) => item.kind === "pre_quiz");
  const post = list.filter((item) => item.kind === "post_quiz");
  const moodleQuizzes = list.filter((item) => ["quiz", "pre_quiz", "post_quiz"].includes(item.kind) && /\/mod\/quiz\/view\.php/i.test(item.href || ""));
  // Pre/Post/ordinary Moodle Quiz is assessment evidence, never an
  // end-of-chapter Assignment. Keep this safeguard at checklist time as well
  // as classification time so a misplaced visual label cannot grant a pass.
  const activities = list.filter((item) => (item.kind === "assignment" || item.currentSemesterQuiz?.eligible && item.currentSemesterQuiz.role === "assignment") && (!/\/mod\/quiz\/view\.php/i.test(item.href || "") || item.currentSemesterQuiz?.eligible) && !item.misplacedDocumentAssignment);
  const activityDetail = (foundText, missingText) => {
    const toleratedActivityQuizzes = moodleQuizzes.filter((item) => item.currentSemesterQuiz?.eligible && item.currentSemesterQuiz.role === "assignment");
    const excludedActivityQuizzes = moodleQuizzes.filter((item) => !toleratedActivityQuizzes.includes(item));
    const quizNote = `${toleratedActivityQuizzes.length ? ` · ผ่อนปรน Moodle Quiz ภาค 1/2569 Week 1–10 จำนวน ${toleratedActivityQuizzes.length} รายการ` : ""}${excludedActivityQuizzes.length ? ` · พบ Quiz ในระบบ Moodle ${excludedActivityQuizzes.length} รายการ แต่ไม่นับเป็นกิจกรรมท้ายบท` : ""}`;
    const activityNames = activities.map((item) => {
      const name = String(item.title || "ไม่ระบุชื่อ").replace(/\s+(?:File|URL)$/i, "");
      const source = /\/mod\/assign\/view\.php/i.test(item.href || "") ? "Moodle Assignment"
        : /\/mod\/resource\/view\.php/i.test(item.href || "") ? "ไฟล์คำสั่งงาน"
        : item.evidenceType === "assignment_text" ? "ข้อความคำสั่งใน Moodle" : "กิจกรรมใน Moodle";
      return `${name} (${source})`;
    }).join(", ");
    return activities.length ? result("pass", `${foundText}: ${activityNames}${quizNote}`) : result(isFirst ? "fail" : "not_applicable", missingText + quizNote);
  };
  const tutors = list.filter((item) => item.kind === "ai_tutor");
  const unreadMediaDetail = (items) => {
    const labels = { duration_pending:"ยังอ่านเวลาไม่สำเร็จ (ยังไม่ยืนยันผล)", access_denied:"ติดสิทธิ์ผู้ให้บริการ", login_required:"ต้องลงชื่อเข้าใช้", link_unavailable:"ลิงก์วิดีโอไม่สามารถเข้าถึงได้", empty_media:"ปลายทางเปิดได้ แต่อัลบั้มว่างและไม่มีวิดีโอ", no_video:"ปลายทางเปิดได้ แต่ไม่พบตัวเล่นหรือวิดีโอ", inspection_timeout:"ตรวจปลายทางเกินเวลา", course_time_budget:"ถึงงบเวลาตรวจรายวิชา", player_not_ready:"หน้าเล่นยังไม่พร้อม", play_required:"ต้องกดเล่น", provider_unsupported:"ผู้ให้บริการไม่รองรับ", link_error:"ลิงก์เสีย", permission_required:"ต้องอนุญาตสิทธิ์", reviewer_confirmed_unreadable:"ผู้ตรวจยืนยันว่าเป็นวิดีโอ แต่ไม่มีเวลาที่ตรวจสอบได้" };
    const counts = new Map();
    for (const item of items.filter((item) => !item.durationSeconds)) {
      const reviewerConfirmed = item.classification?.reviewDecision === "pre_recorded" || (item.classification?.evidence || []).some(entry => entry.source === "ผู้ตรวจ" && /ยืนยันเป็นวิดีโอ/.test(entry.value || ""));
      const label = item.mediaStatus === "access_denied" && reviewerConfirmed
        ? "ผู้ตรวจยืนยันว่าเป็นวิดีโอแล้ว แต่ปลายทางติดสิทธิ์ผู้ให้บริการ"
        : labels[item.mediaStatus] || "อ่านเวลาไม่ได้";
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts].map(([label, count]) => `${label} ${count} คลิป`).join(" · ");
  };
  const videoIssues = unreadMediaDetail(videos);
  const soleUnreadVideo = videos.length === 1 && metrics.unknown === 1 && videoIssues && !cloudFolders.length && !duplicateVideos.length && !internalVideos.length && !metrics.videoCandidates;
  const videoDetail = soleUnreadVideo
    ? `วิดีโอภายนอก 1 รายการ — ${videoIssues.replace(/\s+1\s+คลิป$/, "")} · เวลาที่อ่านและนับได้ ${clock(metrics.knownSeconds)} / ${clock(metrics.requiredSeconds)}`
    : "พบลิงก์วิดีโอภายนอก " + videos.length + " รายการ · เวลาที่อ่านและนับได้ " + clock(metrics.knownSeconds) + " / " + clock(metrics.requiredSeconds) + (cloudFolders.length ? ` · พบโฟลเดอร์ Cloud ${cloudFolders.length} รายการ (ไม่นับเป็นคลิป; ใช้ลิงก์ไฟล์รายคลิป)` : "") + (duplicateVideos.length ? ` · พบปลายทางซ้ำ ${duplicateVideos.length} รายการ (ไม่นับเวลาซ้ำ)` : "") + (metrics.unknown ? " · " + (videoIssues || `อ่านเวลาไม่ได้ ${metrics.unknown} คลิป`) : "") + (uploadedInternalVideos.length ? ` · พบวิดีโออัปโหลดภายใน Moodle ${uploadedInternalVideos.length} รายการ (ไม่นับเวลาและไม่ผ่านเกณฑ์การวางสื่อ: ต้องนำคลิปไปไว้บนผู้ให้บริการภายนอกแล้วเพิ่มเป็นลิงก์ในรายวิชา)` : "") + (unresolvedInternalVideos.length ? " · พบวิดีโอที่ยังยืนยันว่าเป็นลิงก์ภายนอกไม่ได้ " + unresolvedInternalVideos.length + " รายการ (ไม่ผ่านเกณฑ์การวางสื่อ)" : "") + (metrics.videoCandidates ? " · Video ที่ยังยืนยันจากหน้าเล่นไม่ได้ " + metrics.videoCandidates + " รายการ" : "");
  const pendingDecisions = list.filter(item => item.countingEligible !== false && item.mediaStatus !== "cloud_folder" && requiresMediaReview(item) && (item.mediaReviewDecision !== "use" || !item.durationSeconds)).length;
  // Valid clips that already satisfy the required duration pass the row.
  // Broken/access-restricted extras remain in the detail as repair work, but
  // cannot erase sufficient verified teaching time.
  const durationAlreadyPasses = metrics.status === "pass" || metrics.status === "pass_tolerance";
  const video = result(durationAlreadyPasses ? metrics.status : uploadedInternalVideos.length ? "fail" : metrics.definitiveVideoFailure ? "fail" : pendingDecisions ? "needs_review" : metrics.status, videoDetail);
  if(pendingDecisions) video.detail += ` · รอผู้ตรวจเลือกใช้/ไม่นับเวลา ${pendingDecisions} คลิป`;
  const podcast = podcastEvaluationForWeek(list, metrics.podcastRequiredSeconds).result;
  const instructorDetail = instructorEvidence?.reviewStatus === "evidence_found"
    ? `พบข้อมูลผู้สอนครบอัตโนมัติ: รูปผู้สอน · ${instructorEvidence.names.join(", ")} · ช่องทางติดต่อ ${instructorEvidence.contactChannels.join(", ")}`
    : `ต้องตรวจทานข้อมูลผู้สอน: ${instructorEvidence?.hasIntroductionImage ? "พบรูปภาพ" : "ยังไม่พบรูปภาพแนะนำ"} · ${instructorEvidence?.names?.length ? `พบชื่อ ${instructorEvidence.names.join(", ")}` : "ยังไม่พบชื่อที่ระบุว่าเป็นผู้สอน"} · ${instructorEvidence?.contactChannels?.length ? `พบช่องทาง ${instructorEvidence.contactChannels.join(", ")}` : "ยังไม่พบช่องทางติดต่อ"}`;
  const instructorResult = result(instructorEvidence?.identityComplete && instructorEvidence?.contactComplete ? "pass" : "needs_review", instructorDetail);
  if (courseType === "GN") {
    if (isFirst) return [
      instructorResult,
      documentResult(firstSessionDocuments, allFiles, "เอกสารประกอบการสอน", misplacedDocumentAssignments),
      video,
      podcast,
      presentAiTutor(tutors)
    ];
    return [
      documentResult(planFiles, planItems, "แผนการจัดการเรียนการสอน", misplacedPlanAssignments),
      documentResult(materials, materialItems, "เอกสารประกอบการสอน", misplacedMaterialAssignments),
      video,
      podcast
    ];
  }
  if (isFirst) {
    return [
    result("pass", "พบหน้ารายวิชาและชื่อรายวิชา"),
    result("needs_review", instructorDetail),
    documentResult(firstSessionDocuments, allFiles, "เอกสารประกอบการสอน", misplacedDocumentAssignments),
    video,
    podcast,
    activityDetail(`พบกิจกรรมท้ายบท ${activities.length} รายการ`, "ไม่พบกิจกรรมท้ายบท"),
    presentAiTutor(tutors)
    ];
  }
  return [
    documentResult(planFiles, planItems, "แผนการสอน", misplacedPlanAssignments),
    documentResult(materials, materialItems, "เอกสารประกอบ", misplacedMaterialAssignments),
    video,
    podcast,
    presentQuiz(pre, "แบบทดสอบก่อนเรียน"),
    presentQuiz(post, "แบบทดสอบหลังเรียน"),
    activityDetail("พบกิจกรรมท้ายบท/Assignment", "ไม่พบ Assignment")
  ];
}

function preliminaryScore(weeks, coverage, courseType) {
  // GN is an onsite-course checklist. Its supplied rubric has no SC weights
  // and no 110-point total, so never present a fabricated numeric score.
  if (courseType === "GN") {
    const complete = coverage?.reachedEnd !== false && coverage?.structurallyComplete !== false;
    const topologyNeedsReview = coverage?.topologyReviewRequired === true || coverage?.topologyConfidence === "low";
    return { automatic:null, automaticMax:null, manualCurrent:null, manualMax:null, totalCurrent:null, totalMax:null, remainingToPass:null, status:topologyNeedsReview ? "ยังต้องยืนยันโครงสร้างครั้งเรียน" : complete ? "Checklist GN — รอผู้ตรวจสรุป" : "อ่านโครงสร้างไม่ครบ", suppressed:topologyNeedsReview, provisional:true, scoringMode:"gn_checklist" };
  }
  // ตารางที่ 1 = 7, ตารางที่ 2 = 14 × 7 = 98, ตารางที่ 3 = 5 manual.
  // The full denominator remains 110 even when an optional activity is absent;
  // absent/not-applicable items therefore contribute zero, per the rubric.
  const rubric = RULES[courseType];
  const automaticMax = rubric.automaticMax;
  const manualMax = rubric.manualMax;
  const automatic = weeks.flatMap((week) => week.checklist || [])
    .filter((item) => item.status === "pass" || item.status === "pass_tolerance").length;
  const totalCurrent = automatic;
  const remainingToPass = Math.max(0, rubric.passScore - totalCurrent);
  const complete = coverage?.reachedEnd !== false && coverage?.structurallyComplete !== false;
  const hasUnmappedItems = Number(coverage?.unmappedNonForumActivityCount || 0) > 0;
  const hasUnresolvedTypes = Number(coverage?.unresolvedClassificationCount || 0) > 0;
  const hasUnresolvedEvidence = Number(coverage?.unresolvedScoringEvidenceCount || 0) > 0;
  const topologyNeedsReview = coverage?.topologyReviewRequired === true || !coverage?.topologyManuallyConfirmed && (coverage?.topologyConfidence === "low" || (coverage?.topologyDiagnostics || []).some((item) => !item.excluded && /ขัด|เกิน/.test(item.reason || "")));
  const status = !complete ? "อ่านโครงสร้างไม่ครบ" : hasUnmappedItems ? "ยังจับคู่บางรายการไม่ได้" : topologyNeedsReview ? "ยังต้องยืนยันโครงสร้างครั้งเรียน" : hasUnresolvedTypes ? "ยังยืนยันประเภทรายการไม่ได้" : hasUnresolvedEvidence ? "ยังยืนยันหลักฐานบางรายการไม่ได้" : totalCurrent >= rubric.passScore ? "ผ่าน" : totalCurrent + manualMax >= rubric.passScore ? "รอคะแนนตารางที่ 3" : "ยังไม่ผ่านเกณฑ์";
  return { automatic, automaticMax, manualCurrent: 0, manualMax, totalCurrent, totalMax: automaticMax + manualMax, remainingToPass, status, suppressed:topologyNeedsReview, provisional: !complete || hasUnmappedItems || hasUnresolvedTypes || hasUnresolvedEvidence || topologyNeedsReview, scoringMode:"grgs_110" };
}

function sectionMappingFingerprint(sectionBoxes = []) {
  return JSON.stringify(sectionBoxes.map((box) => ({key:sectionKey(box)})).filter((item) => item.key).sort((left,right)=>left.key.localeCompare(right.key)));
}

function applySavedSessionMapping(topology, saved, fingerprint) {
  if (!saved?.mappings) return false;
  const rows = topology.mappingRows || [];
  const currentKeys = new Set(rows.map((row) => row.key));
  const savedKeys=Object.keys(saved.mappings);
  if (!savedKeys.length || savedKeys.some((key) => !currentKeys.has(key)) || rows.some((row)=>!(row.key in saved.mappings))) return false;
  const excluded = new Set(topology.outOfRangeSections || []);
  for (const row of rows) {
    if (!(row.key in saved.mappings)) continue;
    const chosen = Number(saved.mappings[row.key]);
    topology.mapping.delete(row.key);
    if (Number.isInteger(chosen) && chosen >= 1 && chosen <= topology.expectedSessions) { topology.mapping.set(row.key,chosen); excluded.delete(row.key); }
    else if (chosen === 0) excluded.add(row.key);
    row.chosenSession = chosen >= 1 && chosen <= topology.expectedSessions ? chosen : null;
    row.ignored = chosen === 0;
    row.outOfRange = false;
    row.reason = chosen === 0 ? "ผู้ตรวจยืนยันว่าไม่นับเป็นครั้งเรียน" : `ผู้ตรวจยืนยันเป็นครั้งที่ ${chosen}`;
  }
  topology.outOfRangeSections = [...excluded];
  topology.confidence = "confirmed";
  topology.reviewRequired = false;
  topology.safetyIssues = [];
  topology.manualConfirmation = {confirmedAt:saved.confirmedAt || saved.updatedAt || new Date().toISOString()};
  return true;
}

async function auditCourse(payload) {
  if (tabSafetyError) throw tabSafetyError;
  await recordAuditDiagnostic("course-start",{url:payload.courseUrl,runId:payload.runId});
  const linkInspectionStartedAt = Date.now();
  const structureScanMs = Number(payload.timing?.structureScanMs || 0);
  const totalCourseTargetMs = 28 * 60 * 1000;
  const reportReserveMs = 60 * 1000;
  const linkInspectionBudgetMs = Math.max(0, totalCourseTargetMs - structureScanMs - reportReserveMs);
  const linkInspectionDeadline = linkInspectionStartedAt + linkInspectionBudgetMs;
  const rule = RULES[payload.courseType];
  const requiredPerWeek = rule.minutesPerCredit * 60 * payload.credits;
  const requiredFirstSession = rule.firstSessionMinutesPerCredit * 60 * payload.credits;
  const { videoOverrides = {}, activityOverrides = {}, podcastReviews = {} } = await chrome.storage.local.get(["videoOverrides", "activityOverrides", "podcastReviews"]);
  // Keep old video decisions intact while allowing separate, evidence-based
  // reviewer confirmation for instruction images.
  const courseOverrides = { ...(videoOverrides[payload.courseUrl] || {}), ...(activityOverrides[payload.courseUrl] || {}) };
  let activities = payload.activities.map((activity) => {
    // Old exported scans include physical box titles in coverage. Only infer
    // an index when the title is unique; duplicate titles require a new scan.
    const boxTitles = payload.coverage?.courseSections || [];
    if (!activity.sectionId && !Number.isInteger(activity.sectionIndex) && boxTitles.filter((title) => title === activity.section).length === 1) {
      activity = {...activity,sectionIndex:boxTitles.indexOf(activity.section)};
    }
    const classification = classifyActivityWithEvidence(activity, courseOverrides[activity.href]);
    const skipped = ["assignment_text", "assessment_text"].includes(activity.evidenceType)
      ? {linkStatus:"internal",accessNote:`คำสั่งกิจกรรมใน Moodle: ${String(activity.instructionText || "").slice(0,280)}`}
      : classification.kind === "supplementary"
      ? { linkStatus:"skipped_supplementary", accessNote:"ไม่นับ — อยู่ใต้ป้ายข้อมูลเพิ่มเติม" }
      : classification.kind === "activity_video"
        ? { linkStatus:"skipped_activity_video", accessNote:"พบวิดีโอประกอบกิจกรรม — ไม่นับเป็นวิดีโอการสอนล่วงหน้าและไม่อ่านเวลา" }
      : classification.kind === "url"
        ? { linkStatus:"skipped_unclassified", accessNote:"ไม่นับ — ไม่มีป้ายหรือชื่อที่ยืนยันว่าเป็นวิดีโอสอนล่วงหน้า" }
        : {};
    return { ...activity, ...skipped, kind: classification.kind, classification };
  });
  activities = promoteSectionLessonCandidates(activities);
  // Pre/Post can be Moodle Quiz or an external Google Form. Resolve URL
  // activities before deciding the checklist result; otherwise every Form
  // misleadingly appears to be an internal Moodle activity.
  // An arbitrary Moodle URL is not eligible merely because it eventually
  // redirects to a video host.  It needs a teaching-video label or explicit
  // VDO/VOD title first; otherwise it is left unopened and uncounted.
  const linkKinds = new Set(["video", "video_candidate", "recording", "podcast", "ai_tutor", "pre_quiz", "post_quiz", "assignment", "supplementary", "h5p", "file", "file_link", "folder", "forum"]);
  // Moodle normally lists every item in week 1 before week 2. If one week has
  // hundreds of slow videos, strict DOM order can consume the whole budget and
  // leave later weeks completely unchecked. Round-robin preserves order inside
  // each section while giving all sections evidence early in the same run.
  const linkedActivities = interleaveByKey(
    activities.filter((item) => linkKinds.has(item.kind) && !["assignment_text", "assessment_text"].includes(item.evidenceType)),
    (item) => item.section || "ไม่มี Section"
  );
  // A course sometimes repeats the same external video in multiple places.
  // Reuse a duration read in this audit only; it cannot become stale across a
  // later course run because no long-lived URL-only cache is trusted.
  const mediaResultCache = new Map();
  const mediaInFlight = new Map();
  const podcastTypeCache = new Map();
  const podcastTypeInFlight = new Map();
  // Negative results are safe to reuse only during this audit.  The same
  // Moodle activity or resolved URL must not repeatedly open a known access
  // wall, but a later audit may succeed after the owner changes permissions.
  const accessFailureCache = new Map();
  // A SharePoint/OneDrive access wall is usually account/tenant-wide during a
  // single audit. Serialise the first probe per tenant and stop opening more
  // tabs after that probe conclusively says the signed-in reviewer has no
  // access. The cache lives only for this course run, so changed permissions
  // are rechecked on the next audit.
  const providerAccessFailureCache = new Map();
  const providerProbeInFlight = new Map();
  const microsoftProviderKey = (targetUrl) => {
    try {
      const host = new URL(targetUrl).hostname.toLowerCase();
      if (host.endsWith(".sharepoint.com")) return `sharepoint:${host}`;
      if (host === "1drv.ms" || host.endsWith(".1drv.ms") || host === "onedrive.live.com") return "onedrive";
    } catch { /* invalid URL has no provider circuit breaker */ }
    return null;
  };
  const providerDenied = (result) => ["access_denied", "login_required"].includes(result?.mediaStatus);
  let completed = 0;
  const readMediaShared = async (targetUrl, itemDeadline, declaredDurationSeconds = null) => {
    const key = `${canonicalMediaTarget(targetUrl)}${declaredDurationSeconds ? `:declared:${declaredDurationSeconds}` : ""}`;
    if (mediaInFlight.has(key)) return mediaInFlight.get(key);
    const providerKey = microsoftProviderKey(targetUrl);
    if (providerKey && providerAccessFailureCache.has(providerKey)) return {...providerAccessFailureCache.get(providerKey), source:"same-course-provider-access-cache"};
    const precedingProviderProbe = providerKey ? providerProbeInFlight.get(providerKey) : null;
    if (precedingProviderProbe) {
      const precedingResult = await precedingProviderProbe;
      if (providerDenied(precedingResult)) return {...precedingResult, source:"same-course-provider-access-cache"};
    }
    const host = new URL(targetUrl).hostname.toLowerCase();
    const cloudVideoProvider = /(?:^|\.)(?:1drv\.ms|onedrive\.live\.com|sharepoint\.com|drive\.google\.com)$/.test(host);
    const pending = mediaReadLimiter.run(async () => {
      // This clock starts after the item reaches one of the two real Preview
      // slots. Give congested cloud players more time, then retry once in a
      // completely fresh tab if the page was reachable but its duration was
      // still missing. Access-denied and broken links remain immediate results.
      const attemptWindowMs = cloudVideoProvider ? 150000 : 90000;
      const recoveryState = {refreshes:0};
      let result = await readMedia(targetUrl, payload.runId, Date.now() + attemptWindowMs, declaredDurationSeconds, recoveryState);
      const conclusive = () => result.durationSeconds || ["access_denied", "login_required", "link_unavailable", "play_required", "cloud_folder", "link_error"].includes(result.mediaStatus);
      if (!conclusive()) {
        result = await readMedia(targetUrl, payload.runId, Date.now() + attemptWindowMs, declaredDurationSeconds, recoveryState);
        if (!result.durationSeconds && result.mediaStatus === "inspection_timeout") {
          result = { ...result, mediaStatus:"player_not_ready", accessNote:"หน้าเล่นเปิดได้ แต่ยังไม่ส่งข้อมูลเวลา หลังระบบเปิดใหม่อัตโนมัติ" };
        }
      }
      if (!result.durationSeconds && ["inspection_timeout", "player_not_ready", "duration_unavailable", "provider_unsupported"].includes(result.mediaStatus)) {
        result = {...result, mediaStatus:"duration_pending", durationReadComplete:false, refreshAttempts:recoveryState.refreshes, accessNote:"ยังอ่านเวลาจริงไม่สำเร็จหลังลองกู้คืน — รายการนี้ยังตรวจไม่เสร็จและไม่ใช้ยืนยันคะแนน"};
      }
      return result;
    });
    mediaInFlight.set(key, pending);
    if (providerKey && !precedingProviderProbe) providerProbeInFlight.set(providerKey, pending);
    try {
      const result = await pending;
      if (providerKey && providerDenied(result)) providerAccessFailureCache.set(providerKey, result);
      return result;
    }
    finally {
      if (mediaInFlight.get(key) === pending) mediaInFlight.delete(key);
      if (providerKey && providerProbeInFlight.get(providerKey) === pending) providerProbeInFlight.delete(providerKey);
    }
  };
  const inspectPodcastTypeShared = async (targetUrl, itemDeadline) => {
    const key = canonicalMediaTarget(targetUrl);
    if (podcastTypeCache.has(key)) return {...podcastTypeCache.get(key), source:"same-course-type-cache"};
    if (podcastTypeInFlight.has(key)) return podcastTypeInFlight.get(key);
    const providerKey = microsoftProviderKey(targetUrl);
    if (providerKey && providerAccessFailureCache.has(providerKey)) return {...providerAccessFailureCache.get(providerKey), source:"same-course-provider-access-cache"};
    const precedingProviderProbe = providerKey ? providerProbeInFlight.get(providerKey) : null;
    if (precedingProviderProbe) {
      const precedingResult = await precedingProviderProbe;
      if (providerDenied(precedingResult)) return {...precedingResult, source:"same-course-provider-access-cache"};
    }
    const pending = mediaReadLimiter.run(() => inspectPodcastType(targetUrl, payload.runId, Math.min(itemDeadline, Date.now() + 30000)));
    podcastTypeInFlight.set(key, pending);
    if (providerKey && !precedingProviderProbe) providerProbeInFlight.set(providerKey, pending);
    try {
      const result = await pending;
      if (providerKey && providerDenied(result)) providerAccessFailureCache.set(providerKey, result);
      if (result.mediaType || ["access_denied", "login_required", "link_unavailable"].includes(result.mediaStatus)) podcastTypeCache.set(key, result);
      return result;
    } finally {
      if (podcastTypeInFlight.get(key) === pending) podcastTypeInFlight.delete(key);
      if (providerKey && providerProbeInFlight.get(providerKey) === pending) providerProbeInFlight.delete(providerKey);
    }
  };
  const processLinkedActivity = async (activity) => {
    const itemStartedAt = Date.now();
    const itemDeadline = Math.min(linkInspectionDeadline, itemStartedAt + 30000);
    const timedPhase = async (field, task) => {
      const startedAt = Date.now();
      try { return await task(); }
      finally { activity[field] = Number(activity[field] || 0) + (Date.now() - startedAt); }
    };
    const { cancelAuditId } = await chrome.storage.local.get("cancelAuditId");
    if (cancelAuditId === payload.runId) {
      throw cancelledError();
    }
    await chrome.storage.local.set({ auditProgress: { current: completed, total: linkedActivities.length, label: `กำลังตรวจ: ${activity.title || activity.kind}` } });
    const isH5PVideo = activity.kind === "video" && /\/mod\/(h5pactivity|hvp)\/view\.php/.test(activity.href);
    // A Moodle URL activity is only a redirect wrapper. Even when its title is
    // "Video on demand", resolve and inspect the external provider. It is not
    // an internally uploaded Moodle video.
    const isMoodleUrlActivity = /\/mod\/url\/view\.php/i.test(activity.href);
    // A clear Live Record never contributes to the pre-recorded-video score.
    // Do not spend one tab/navigation per recording when title and placement
    // already establish that it is excluded. Ambiguous/conflicting labels stay
    // on the normal path for reviewer safety.
    if (activity.kind === "recording" && activity.classification?.recordingFastPath) {
      activity.linkStatus = "skipped_recording";
      activity.recordingInspection = "fast_path";
      activity.accessNote = "ไม่นับเวลา — ยืนยันว่าเป็นคลิปบันทึกการสอนย้อนหลังจากชื่อรายการ; ข้ามการเปิดลิงก์เพื่อประหยัดเวลา";
      activity.readElapsedMs = Date.now() - itemStartedAt;
      return;
    }
    const cachedAccessFailure = accessFailureCache.get(activity.href);
    if (cachedAccessFailure) {
      Object.assign(activity, { ...cachedAccessFailure, accessNote:`${cachedAccessFailure.accessNote} (ใช้ผลเดิมในรอบตรวจนี้)` });
      activity.readElapsedMs = Date.now() - itemStartedAt;
      return;
    }
    // One provider may close a temporary tab while redirecting. That is
    // evidence about this link only; it must never abort the whole course.
    try {
    if (activity.kind === "folder") {
      const folder = await timedPhase("fileInspectionMs", () => inspectMoodleFolder(activity.href, payload.runId));
      activity.folderFiles = folder.files;
      activity.linkStatus = folder.error ? "unresolved" : "internal";
      activity.accessNote = folder.error
        ? `เปิดโฟลเดอร์ Moodle ไม่สำเร็จ: ${folder.error}`
        : folder.files.length
          ? `พบเอกสารภายในโฟลเดอร์ Moodle ${folder.files.length} ไฟล์`
          : "เปิดโฟลเดอร์ Moodle ได้ แต่ไม่พบไฟล์เอกสารที่รองรับ";
    } else if (activity.kind === "assignment" && looksLikeTeachingDocumentAssignment(activity)) {
      const placed = await timedPhase("fileInspectionMs", () => inspectAssignmentDocuments(activity.href, payload.runId));
      activity.assignmentDocumentFiles = placed.files;
      activity.linkStatus = placed.error ? "unresolved" : "internal";
      activity.misplacedDocumentAssignment = placed.files.length > 0;
      activity.accessNote = placed.error ? `เปิด Assignment ไม่สำเร็จ: ${placed.error}`
        : placed.files.length ? MISPLACED_DOCUMENT_MESSAGE : "Assignment ชื่อเหมือนเอกสาร แต่ไม่พบไฟล์เอกสารแนบ";
    } else if (/\/mod\/resource\/view\.php/.test(activity.href)) {
      activity.resource = await timedPhase("fileInspectionMs", () => resolveMoodleResourceEvidence(activity, (target) => inspectFileTarget(target, payload.runId)));
      activity.isPdf = activity.resource.isPdf;
      activity.isAudio = activity.resource.isAudio;
      activity.mediaType = activity.resource.isVideo ? "video" : activity.resource.isAudio ? "audio" : activity.mediaType || null;
      activity.fileVerification = activity.resource.fileVerification || (activity.isPdf ? "pdf" : "unresolved");
      activity.linkStatus = "internal";
      if (activity.resource.previewNote) activity.accessNote = activity.resource.previewNote;
      else if (activity.resource.sourceType === "moodle_activity_icon") activity.accessNote = activity.isPdf
        ? "ยืนยันว่าเป็น PDF จากไอคอนชนิดไฟล์ของ Moodle"
        : "ยืนยันชนิดไฟล์เสียงจากไอคอนชนิดไฟล์ของ Moodle";
      if (activity.kind === "podcast") {
        activity.podcastDelivery = "internal_upload";
        activity.accessNote = activity.resource.isVideo
          ? "พบ Podcast รูปแบบวิดีโออัปโหลดใน Moodle — ไม่ผ่าน: Podcast ต้องเป็นคลิปเสียงผ่านลิงก์ภายนอก"
          : activity.isAudio
          ? "พบ Podcast อัปโหลดใน Moodle — ไม่ผ่านเกณฑ์: ต้องใช้ลิงก์ภายนอก"
          : "รายการระบุ Podcast แต่ไฟล์ปลายทางไม่ใช่ชนิดเสียง — ต้องตรวจทาน";
      } else if (activity.kind === "video" && activity.resource.isVideo) {
        activity.durationSeconds = null;
        activity.mediaStatus = "internal_upload";
        activity.accessNote = "พบวิดีโออัปโหลดภายใน Moodle — ไม่นับเวลาและไม่ผ่านเกณฑ์วิดีโอลิงก์ภายนอก; ให้นำคลิปไปไว้บนผู้ให้บริการภายนอกแล้วเพิ่มเป็นลิงก์ในรายวิชา";
      }
    } else if (activity.kind === "video" && isLmsHost(activity.href) && !isH5PVideo && !isMoodleUrlActivity) {
      activity.externalUrl = null;
      activity.linkStatus = "internal";
      activity.internalVideoDelivery = "internal_upload";
      activity.mediaStatus = "internal_upload";
      activity.durationSeconds = null;
      activity.accessNote = "พบวิดีโออัปโหลดหรือเล่นภายใน Moodle — ไม่นับเวลาและไม่ผ่านเกณฑ์วิดีโอลิงก์ภายนอก; ให้นำคลิปไปไว้บนผู้ให้บริการภายนอกแล้วเพิ่มเป็นลิงก์ในรายวิชา";
    } else if (activity.kind === "file_link") {
      try {
        activity.externalUrl = await timedPhase("externalResolveMs", () => readExternalTarget(activity.href, payload.runId, itemDeadline));
        activity.resource = activity.externalUrl ? await timedPhase("fileInspectionMs", () => inspectFileTarget(activity.externalUrl, payload.runId)) : { target:null, name:"", isPdf:false, fileVerification:"unresolved", error:"ไม่พบปลายทางลิงก์" };
        // Moodle can attach its server-selected PDF icon to a URL/Label item.
        // Retain that evidence when the external preview exposes no file type.
        activity.resource = applyMoodleFileTypeHint(activity.resource, activity);
        activity.isPdf = activity.resource.isPdf;
        activity.fileVerification = activity.resource.fileVerification || (activity.isPdf ? "pdf" : "unresolved");
        activity.linkStatus = activity.externalUrl ? "external" : "unresolved";
        if (activity.resource.previewNote) activity.accessNote = activity.resource.previewNote;
      } catch (error) {
        if (error?.name === "AuditCancelled") throw error;
        activity.externalUrl = null; activity.resource = {target:null, name:"", isPdf:false, fileVerification:"unresolved", error:`เปิดลิงก์เอกสารไม่ได้: ${error.message}`}; activity.isPdf = false; activity.fileVerification = "unresolved"; activity.linkStatus = "unresolved";
      }
    } else if (isMoodleUrlActivity || (/^https?:\/\//.test(activity.href) && !/dlearning\.spu\.ac\.th/.test(activity.href))) {
      try {
        activity.externalUrl = await timedPhase("externalResolveMs", () => readExternalTarget(activity.href, payload.runId, itemDeadline));
        activity.linkStatus = activity.externalUrl ? "external" : "unresolved";
        if (activity.kind === "ai_tutor" && activity.externalUrl) {
          const chat = await timedPhase("aiChatInspectionMs", () => inspectAiChatTarget(activity.externalUrl, payload.runId));
          activity.aiChatStatus = chat.status;
          activity.aiChatConfirmed = Boolean(chat.confirmed);
          activity.aiChatEvidence = chat.evidence || null;
          activity.accessNote = chat.accessNote || activity.accessNote;
          if (["access_denied","login_required","link_unavailable"].includes(chat.status)) activity.linkStatus = "unresolved";
        }
        // A URL activity can redirect to another Moodle page containing an
        // uploaded/embedded player. Delivery is still internal even though the
        // course author created it through the URL module.
        if (activity.kind === "video" && activity.externalUrl && isLmsHost(activity.externalUrl)) {
          activity.internalTargetUrl = activity.externalUrl;
          activity.externalUrl = null;
          activity.linkStatus = "internal";
          activity.internalVideoDelivery = "internal_upload";
          activity.mediaStatus = "internal_upload";
          activity.durationSeconds = null;
          activity.accessNote = "พบวิดีโอที่เล่นอยู่ภายใน Moodle — ไม่นับเวลาและไม่ผ่านเกณฑ์วิดีโอลิงก์ภายนอก; ให้นำคลิปไปไว้บนผู้ให้บริการภายนอกแล้วเพิ่มเป็นลิงก์ในรายวิชา";
        }
        if (activity.kind === "video_candidate" && activity.externalUrl) {
          activity.mediaCandidateProbe = true;
          activity.classification = {
            ...(activity.classification || {}),
            evidence:[...(activity.classification?.evidence || []), {source:"ขั้นตอนตรวจ", value:"เปิดปลายทางเพื่อยืนยันว่าเป็นวิดีโอ"}]
          };
        }
        // A course author may call a video merely "EP.4 URL".  Do not infer
        // media from that title, but once its resolved destination proves that
        // it is a video provider/file, promote it to a verified video so it is
        // actually timed and shown in the evidence table.
        const providerEvidence = activity.externalUrl && activity.kind === "url" ? mediaProviderEvidence(activity.externalUrl) : null;
        const candidateEvidence = activity.externalUrl && activity.kind === "url" ? mediaProbeCandidateEvidence(activity.externalUrl) : null;
        if (providerEvidence) {
          activity.kind = "video";
          activity.mediaCandidateProbe = true;
          activity.classification = {
            ...(activity.classification || {}), kind:"video", confidence:"verified",
            evidence:[...(activity.classification?.evidence || []), {source:"ปลายทางลิงก์", value:providerEvidence}]
          };
        } else if (candidateEvidence) {
          activity.kind = "video_candidate";
          activity.mediaCandidateProbe = true;
          activity.classification = {
            ...(activity.classification || {}), kind:"video_candidate", confidence:"tentative",
            evidence:[...(activity.classification?.evidence || []), {source:"ปลายทางลิงก์", value:candidateEvidence}]
          };
        }
        if (!activity.externalUrl) activity.accessNote = "เปิดกิจกรรมได้ แต่ไม่พบ URL ปลายทางภายนอก";
      } catch (error) {
        if (error?.name === "AuditCancelled") throw error;
        activity.externalUrl = null; activity.linkStatus = "unresolved"; activity.accessNote = `เปิดกิจกรรมหาปลายทางไม่ได้: ${error.message}`;
      }
    } else if (activity.kind === "podcast" && isLmsHost(activity.href)) {
      // A Podcast may be uploaded inside an Assignment/Page. Inspect the page
      // to confirm its media type, but Moodle-hosted media is still an internal
      // upload and must never contribute Podcast time.
      activity.externalUrl = activity.href;
      activity.linkStatus = "internal";
      activity.podcastDelivery = "internal_upload";
    } else if (activity.kind === "forum") {
      const taskKind = forumTaskKind(activity.title, activity.groupContext);
      const forum = await timedPhase("forumInspectionMs", () => inspectForumAttachments(activity.href, payload.runId, Boolean(taskKind)));
      activity.forumAttachments = forum.attachments;
      activity.linkStatus = "internal";
      if (taskKind) {
        const evidence = forumTaskEvidence(activity.title, forum.contentText, activity.groupContext);
        activity.forumTaskConfirmed = evidence.confirmed;
        activity.forumTaskExcerpt = evidence.excerpt;
        activity.accessNote = evidence.confirmed ? 'พบคำถามหรือคำสั่งมอบหมายงานใน Forum' : 'พบ Forum แต่ยังไม่พบคำถามหรือคำสั่งมอบหมายงานจริง';
        if (evidence.confirmed || taskKind !== 'assignment') activity.kind = taskKind;
      }
    } else if (isH5PVideo) {
      // H5P's player is inside Moodle. Its duration still counts as video
      // time, while the report retains its internal-H5P source for review.
      activity.externalUrl = activity.href;
      activity.linkStatus = "internal_h5p";
    } else {
      activity.externalUrl = null;
      activity.linkStatus = "internal";
    }
    if ((activity.kind === "video" || activity.kind === "video_candidate" || activity.kind === "podcast") && activity.externalUrl) {
      await chrome.storage.local.set({ auditProgress: { current: completed, total: linkedActivities.length, label: activity.kind === "podcast" ? `กำลังตรวจชนิด Podcast: ${activity.title || activity.kind}` : `กำลังอ่านเวลาวิดีโอ: ${activity.title || activity.kind}` } });
      if (activity.kind === "podcast") {
        const podcastType = ["audio","video"].includes(activity.internalMediaType)
          ? {accessible:true,mediaType:activity.internalMediaType,mediaStatus:activity.internalMediaType === "audio" ? "podcast_audio" : "podcast_video",source:`moodle-embedded-${activity.internalMediaType}`,durationSeconds:null}
          : await timedPhase("mediaInspectionMs", () => inspectPodcastTypeShared(activity.externalUrl, itemDeadline));
        Object.assign(activity, podcastType, {durationSeconds:null,automaticDurationIgnored:Boolean(podcastType.durationSeconds),automaticDurationSeconds:null});
        if (activity.podcastDelivery === "internal_upload") {
          activity.accessNote = activity.mediaType === "audio"
            ? "พบคลิปเสียง Podcast ที่อัปโหลดภายใน Moodle — ไม่นับเวลาและไม่ผ่านเกณฑ์ที่กำหนดให้ใช้ลิงก์ภายนอก"
            : activity.mediaType === "video"
            ? "พบ Podcast รูปแบบวิดีโอภายใน Moodle — ไม่นับเวลาและไม่ผ่านเกณฑ์ Podcast เสียงภายนอก"
            : "พบรายการ Podcast ภายใน Moodle แต่ยังยืนยันชนิดสื่อไม่ได้ — ไม่นับเวลา";
        }
      } else {
      const mediaCacheKey = canonicalMediaTarget(activity.externalUrl);
      const declaredDurationSeconds = activity.kind === "video" ? declaredDurationFromTitle(activity.title) : null;
      const cached = mediaResultCache.get(mediaCacheKey);
      const cachedFailure = accessFailureCache.get(mediaCacheKey);
      const media = cached ? { ...cached, source:"same-course-cache", accessNote:"ใช้ผลเวลาเดียวกันที่ยืนยันแล้วในรายวิชานี้" }
        : cachedFailure ? { ...cachedFailure, accessNote:`${cachedFailure.accessNote} (ใช้ผลเดิมในรอบตรวจนี้)` }
        : await timedPhase("mediaInspectionMs", () => readMediaShared(activity.externalUrl, itemDeadline, declaredDurationSeconds));
      Object.assign(activity, media);
      if (!cached && media.durationSeconds && media.source !== "title-declared-duration") mediaResultCache.set(mediaCacheKey, media);
      if (media.mediaStatus === "access_denied" || media.mediaStatus === "login_required" || media.mediaStatus === "link_unavailable") {
        const failure = { accessible:false, durationSeconds:null, mediaStatus:media.mediaStatus, accessNote:media.accessNote };
        accessFailureCache.set(activity.href, failure);
        accessFailureCache.set(mediaCacheKey, failure);
      }
      if (activity.kind === "video_candidate" && activity.mediaCandidateProbe && verifiedVideoCandidate(media)) {
        activity.kind = "video";
        activity.classification = { ...(activity.classification || {}), kind:"video", confidence:"verified", evidence:[...(activity.classification?.evidence || []), {source:"หน้าเล่น", value:"พบองค์ประกอบวิดีโอหรือข้อมูลเวลา"}] };
      }
      if (courseOverrides[activity.href] === "pre_recorded" && activity.kind === "video" && !activity.durationSeconds && !isDefinitiveMediaFailure(activity)) {
        activity.mediaStatus = "reviewer_confirmed_unreadable";
        activity.accessNote = "ผู้ตรวจยืนยันว่าเป็นวิดีโอการสอนล่วงหน้า แต่ไม่มีเวลาที่ตรวจสอบได้ — ไม่ผ่านเกณฑ์เวลา";
      }
      }
    }
    } catch (error) {
      if (error?.name === "AuditCancelled") throw error;
      activity.linkStatus = "unresolved";
      activity.mediaStatus = (activity.kind === "video" || activity.kind === "podcast") ? "link_error" : activity.mediaStatus;
      activity.accessNote = isTabGoneError(error)
        ? "แท็บปลายทางปิดก่อนอ่าน — ลิงก์นี้ต้องตรวจทาน"
        : `เปิดปลายทางไม่ได้: ${error.message || "ไม่ทราบสาเหตุ"}`;
      if (activity.kind === "file" || activity.kind === "file_link") {
        activity.resource ||= { target:null, name:"", isPdf:false, fileVerification:"unresolved", error:activity.accessNote };
        activity.isPdf = false;
        activity.fileVerification = activity.resource.fileVerification || "unresolved";
      }
    }
    activity.readElapsedMs = Date.now() - itemStartedAt;
  };
  // Six workers let authenticated HTTP redirects and provider metadata finish
  // in parallel. createInactiveTab independently caps real browser tabs at two,
  // so wider metadata throughput cannot create a tab storm. SharePoint and
  // OneDrive can load two pages together; only foreground focus is serialized.
  await runBounded(linkedActivities, processLinkedActivity, {
    concurrency:6,
    // 28 minutes is a performance target, not permission to discard evidence.
    // Every queued item must start; slow Preview pages may finish after the
    // target so playable clips are not turned into a course-timeout result.
    deadline:Number.POSITIVE_INFINITY,
    onDeadline:async (activity) => {
        activity.readElapsedMs = 0;
        activity.mediaStatus = ["video", "video_candidate", "podcast"].includes(activity.kind) ? "course_time_budget" : activity.mediaStatus;
        activity.linkStatus ||= "unresolved";
        activity.accessNote = "ถึงงบเวลาตรวจรายวิชา 28 นาที — เก็บรายการนี้ไว้เป็นหลักฐานที่ยังยืนยันไม่เสร็จ ไม่เดาผล";
    },
    onSettled:async () => {
      completed += 1;
    }
  });
  // A Moodle Folder is a container, not document credit by itself. Promote
  // each confirmed child document into a traceable file row while retaining
  // the source Section and group label used for session mapping.
  const folderFiles = activities.flatMap((activity) => (activity.folderFiles || []).map((file) => ({
    section:activity.section,
    sectionId:activity.sectionId,
    sectionIndex:activity.sectionIndex,
    title:file.title,
    text:`${activity.title || "โฟลเดอร์ Moodle"} / ${file.title}`,
    groupContext:activity.groupContext || "",
    groupContextSource:activity.groupContextSource || "",
    href:file.href,
    kind:"file",
    isPdf:file.isPdf,
    fileVerification:file.fileVerification,
    resource:{target:file.href,name:file.title,isPdf:file.isPdf,fileVerification:file.fileVerification,sourceType:file.sourceType},
    externalUrl:file.href,
    linkStatus:"internal_folder_file",
    accessNote:`${file.isPdf ? "ไฟล์ PDF" : "เอกสารที่ไม่ใช่ PDF"} ภายในโฟลเดอร์ Moodle: ${activity.title || "ไม่ระบุชื่อโฟลเดอร์"}`,
    readElapsedMs:activity.readElapsedMs,
    folderSource:activity.href,
    folderPath:file.folderPath || ""
  })));
  activities.push(...folderFiles);
  // Announcements are Forum activities, not Assignments. PDF attachments are
  if (tabSafetyError) throw tabSafetyError;
  // added as separate, traceable evidence so a genuine teaching plan posted in
  // Announcements can be found without turning the Forum itself into an
  // end-of-chapter activity.
  const forumFiles = activities.flatMap((activity) => (activity.forumAttachments ? (activity.forumAttachments || []).map((attachment) => {
    const declared = String(attachment.title || "").match(/(?:ครั้งที่|week)\s*(\d+)/i);
    return {
    section: activity.sectionId || Number.isInteger(activity.sectionIndex) ? activity.section : declared ? `ครั้งที่ ${declared[1]}` : activity.section,
    sectionId:activity.sectionId,
    sectionIndex:activity.sectionIndex,
    title: attachment.title,
    text: attachment.title,
    groupContext: activity.groupContext || "",
    href: attachment.href,
    kind: "file",
    isPdf: true,
    resource: { target: attachment.href, name: attachment.title, isPdf: true },
    externalUrl: attachment.href,
    linkStatus: "internal_forum_attachment",
    accessNote: "ไฟล์ PDF แนบใน Announcements",
    readElapsedMs: activity.readElapsedMs,
    forumSource: activity.href
  }; }) : []));
  activities.push(...forumFiles);
  applyPodcastReviews(activities, podcastReviews[payload.courseUrl] || {});
  await chrome.storage.local.set({ auditProgress: { current: completed, total: linkedActivities.length, label: "กำลังสรุปผล…" } });
  const topology = sectionTopology(activities, rule.expectedSessions, payload.coverage?.sectionBoxes || []);
  const sectionFingerprint = sectionMappingFingerprint(payload.coverage?.sectionBoxes || []);
  const { sessionMappingOverrides = {} } = await chrome.storage.local.get("sessionMappingOverrides");
  applySavedSessionMapping(topology,sessionMappingOverrides[payload.courseUrl],sectionFingerprint);
  const weekMapping = topology.mapping;
  const excludedSections = new Set(topology.outOfRangeSections || []);
  for (const item of activities) {
    item.auditSession = canonicalWeek(item, weekMapping) || null;
    item.outOfRange = !item.auditSession && excludedSections.has(sectionKey(item));
    item.mappingIssue = !item.auditSession ? topology.diagnostics.find((entry) => entry.section === item.section)?.reason || "ยังไม่มีหลักฐานพอจะระบุครั้งเรียน" : null;
  }
  // The scanner normally excludes provider anchors nested inside Moodle
  // modules. Keep a post-resolution guard as well: unusual themes can wrap the
  // same link outside the recognised row, but the final destination proves it
  // is only another representation of the existing module activity.
  const destinationDuplicates = collapseDuplicateDestinationItems(activities);
  activities = destinationDuplicates.items;
  // Only now, after both hidden and visible links have been inspected, may
  // same-title Moodle alternatives be reduced to one logical clip.
  markHiddenTitleAlternatives(activities);
  // Resolve duplicates only after destination inspection. Different Moodle
  // activities can point to the same provider file; count that duration once
  // within a session while retaining both rows as traceable evidence.
  markDuplicateMediaItems(activities);
  const { mediaReviews = {} } = await chrome.storage.local.get("mediaReviews");
  applyMediaReviews(activities, mediaReviews[payload.courseUrl] || {});
  const excludedOutOfRangeActivityCount = activities.filter((item) => item.kind !== "forum" && item.outOfRange).length;
  const unmappedNonForumActivityCount = activities.filter((item) => item.kind !== "forum" && !item.auditSession && !item.outOfRange).length;
  const mappedNonForumActivityCount = activities.filter((item) => item.kind !== "forum" && canonicalWeek(item, weekMapping)).length;
  for (const item of activities) {
    if (!/\/mod\/quiz\/view\.php/i.test(item.href || "")) continue;
    item.currentSemesterQuiz = moodleQuizTolerance({...item, courseProfile:payload.courseProfile || ""});
  }
  const grouped = groupedByWeek(activities, weekMapping);
  // Always emit the full 15-session rubric. A completely missing session must
  // appear as failed rows in the report instead of disappearing from it.
  const weeks = Array.from({length:rule.expectedSessions}, (_, index) => [`ครั้งที่ ${index + 1}`, grouped[`ครั้งที่ ${index + 1}`] || []]).map(([section, list]) => {
    const isFirst = section === "ครั้งที่ 1";
    const eligible = list.filter((item) => item.kind === "video" && item.linkStatus === "external" && item.countingEligible !== false && item.mediaStatus !== "cloud_folder");
    const internalVideos = list.filter((item) => item.kind === "video" && item.linkStatus !== "external" && !item.titleAlternativeOf);
    const knownSeconds = countedVideoSeconds(eligible);
    const unknown = eligible.filter((item) => !item.durationSeconds).length;
    const requiredSeconds = isFirst ? requiredFirstSession : requiredPerWeek;
    const toleranceMinutes = creditBasedVideoToleranceMinutes(payload.credits);
    const status = videoStatusWithFailures(eligible, mediaTimeResult(eligible, knownSeconds, requiredSeconds, toleranceMinutes));
    const podcastRequiredSeconds = rule.podcastMinutes * 60;
    const podcastEvaluation = podcastEvaluationForWeek(list, podcastRequiredSeconds);
    const definitiveVideoFailure = eligible.some(isDefinitiveMediaFailure);
    const metrics = { section, videos: eligible.length, internalVideos: internalVideos.length, videoCandidates: list.filter((item) => item.kind === "video_candidate" && !item.titleAlternativeOf).length, recordings: list.filter((item) => item.kind === "recording" && !item.titleAlternativeOf).length, knownSeconds, unknown, requiredSeconds, toleranceMinutes, status, definitiveVideoFailure, ...podcastEvaluation };
    return { ...metrics, checklist: checklistForWeek(section, list, metrics, isFirst, payload.courseType, payload.instructorEvidence) };
  });
  const linkInspectionMs = Date.now() - linkInspectionStartedAt;
  const inspectionTiming = summarizeInspectionTiming(activities);
  // A generic Moodle URL/forum/link is not, by itself, a scoring criterion.
  // Only an ambiguous video (or contradictory contextual label) can change an
  // automatic result, so do not make the whole course provisional for ordinary
  // navigation and support links.
  const unresolvedClassificationCount = activities.filter((item) =>
    !item.outOfRange && !item.titleAlternativeOf && (item.kind === "video_candidate" || item.classification?.contextConflict && (!item.mediaReviewRequired || item.mediaReviewDecision === "pending"))
  ).length;
  const unresolvedScoringEvidenceCount = activities.filter((item) => {
    if (item.outOfRange) return false;
    if (["video", "podcast"].includes(item.kind) && item.countingEligible !== false && item.linkStatus === "external") {
      if (item.kind === "podcast") {
        if (item.mediaType === "video") return false;
        if (item.mediaType !== "audio") return !isDefinitiveMediaFailure(item);
        return !item.durationSeconds;
      }
      return item.mediaStatus !== "cloud_folder" && !isDefinitiveMediaFailure(item) && (item.mediaReviewRequired && item.mediaReviewDecision !== "use" || !item.durationSeconds);
    }
    // Document existence is sufficient under the approved tolerance; its
    // PDF/non-PDF/unresolved type remains visible evidence, not a blocker.
    return false;
  }).length;
  const coverage = { ...(payload.coverage || {}), excludedOutOfRangeActivityCount, unmappedNonForumActivityCount, mappedNonForumActivityCount, mappedWeekCount:weekMapping.size, unresolvedClassificationCount, unresolvedScoringEvidenceCount, topologyMode:topology.mode, topologyConfidence:topology.confidence, topologyDiagnostics:topology.diagnostics, topologyMappingRows:topology.mappingRows, topologySafetyIssues:topology.safetyIssues, topologyReviewRequired:topology.reviewRequired, topologyManuallyConfirmed:Boolean(topology.manualConfirmation), sectionMappingFingerprint:sectionFingerprint, expectedSessions:topology.expectedSessions };
  const score = preliminaryScore(weeks, coverage, payload.courseType);
  const gnTrack = payload.courseType === "GN" ? normalizeGnTrack(payload.gnTrack) : null;
  const mediaCoverage = payload.courseType === "GN" ? gnCoverageResult(weeks, gnTrack) : null;
  return {
    id: crypto.randomUUID(), runId: payload.runId, createdAt: new Date().toISOString(), courseTitle: payload.courseTitle, courseUrl: payload.courseUrl,
    platform: payload.platform || learningPlatformName(payload.courseUrl),
    courseType: payload.courseType, gnTrack, credits: payload.credits, rubric: `${payload.courseType}-0.5`, extensionVersion: chrome.runtime.getManifest().version,
    rule, activities, weeks, score, coverage, mediaCoverage, instructorEvidence:payload.instructorEvidence || null,
    timing: {
      structureScanMs,
      linkInspectionMs,
      totalElapsedMs: structureScanMs + linkInspectionMs,
      linkedItemCount: linkedActivities.length,
      averageLinkedItemMs: linkedActivities.length ? Math.round(linkInspectionMs / linkedActivities.length) : 0,
      targetTotalMs: totalCourseTargetMs,
      ...inspectionTiming,
      metadataFastPathCount: activities.filter((item) => item.durationSeconds && /metadata|meta-tag/.test(item.source || "")).length,
      playerFallbackCount: activities.filter((item) => item.durationSeconds && /html-video|player-text|page-text/.test(item.source || "")).length,
      courseTimeBudgetCount: activities.filter((item) => item.mediaStatus === "course_time_budget").length
    },
    summary: {
      externalVideos: activities.filter((item) => item.kind === "video" && item.linkStatus === "external").length,
      videoCandidates: activities.filter((item) => item.kind === "video_candidate" && !item.titleAlternativeOf).length,
      recordingsExcluded: activities.filter((item) => item.kind === "recording" && !item.titleAlternativeOf).length,
      recordingsSkipped: activities.filter((item) => item.recordingInspection === "fast_path").length,
      duplicateMediaExcluded: activities.filter((item) => item.countingEligible === false).length,
      externalPodcasts: activities.filter((item) => item.kind === "podcast" && item.linkStatus === "external").length,
      videoPodcasts: activities.filter((item) => item.kind === "podcast" && item.mediaType === "video").length,
      reviewerConfirmedPodcasts: activities.filter((item) => item.kind === "podcast" && item.reviewerDurationConfirmed).length,
      internalPodcasts: activities.filter((item) => item.kind === "podcast" && item.podcastDelivery === "internal_upload").length,
      aiTutors: activities.filter((item) => item.kind === "ai_tutor").length,
      externalAiTutors: activities.filter((item) => item.kind === "ai_tutor" && item.linkStatus === "external").length,
      internalQuizzes: activities.filter((item) => /quiz/.test(item.kind) && item.linkStatus !== "external").length,
      preQuizzes: activities.filter((item) => item.kind === "pre_quiz").length,
      postQuizzes: activities.filter((item) => item.kind === "post_quiz").length
      , supplementarySkipped: activities.filter((item) => item.kind === "supplementary").length
      , activityVideosSkipped: activities.filter((item) => item.kind === "activity_video").length
      , unclassifiedUrlsSkipped: activities.filter((item) => item.kind === "url" && item.linkStatus === "skipped_unclassified").length
    }
  };
}

async function saveReportUnlocked(report, {promoteLatest = true} = {}) {
  return saveStoredReport(report, {promoteLatest});
}
const saveReport = (report, options) => reportWriteLimiter.run(() => saveReportUnlocked(report, options));

function recalculatePodcastReport(report) {
  const rule = RULES[report.courseType];
  for (const [index, week] of (report.weeks || []).entries()) {
    const list = report.activities.filter((item) => Number(item.auditSession) === index + 1);
    const evaluation = podcastEvaluationForWeek(list, rule.podcastMinutes * 60);
    Object.assign(week, evaluation);
    const eligible = list.filter(item => item.kind === "video" && item.linkStatus === "external" && item.countingEligible !== false && item.mediaStatus !== "cloud_folder");
    week.knownSeconds = countedVideoSeconds(eligible);
    week.unknown = eligible.filter(item => !item.durationSeconds).length;
    week.videos = eligible.length;
    week.internalVideos = list.filter(item => item.kind === "video" && item.linkStatus !== "external" && !item.titleAlternativeOf).length;
    week.videoCandidates = list.filter(item => item.kind === "video_candidate" && !item.titleAlternativeOf).length;
    week.recordings = list.filter(item => item.kind === "recording" && !item.titleAlternativeOf).length;
    week.toleranceMinutes = creditBasedVideoToleranceMinutes(report.credits);
    week.status = videoStatusWithFailures(eligible,mediaTimeResult(eligible,week.knownSeconds,week.requiredSeconds,week.toleranceMinutes));
    week.definitiveVideoFailure = eligible.some(isDefinitiveMediaFailure);
    week.checklist = checklistForWeek(week.section,list,week,index === 0,report.courseType,report.instructorEvidence);
    const podcastIndex = report.courseType === "GN" ? 3 : index === 0 ? 4 : 3;
    if (week.checklist?.[podcastIndex]) week.checklist[podcastIndex] = evaluation.result;
  }
  report.coverage.unresolvedClassificationCount = report.activities.filter(item => !item.outOfRange && !item.titleAlternativeOf && (item.kind === "video_candidate" || item.classification?.contextConflict && (!item.mediaReviewRequired || item.mediaReviewDecision === "pending"))).length;
  report.coverage.unresolvedScoringEvidenceCount = report.activities.filter((item) => {
    // A reviewer-confirmed prelude/extra Section is intentionally outside the
    // 15-session rubric. Its unread Podcast/video evidence remains visible in
    // the appendix but must never block finalisation or re-enter score review.
    if (item.outOfRange || !item.auditSession) return false;
    if (item.kind === "podcast" && item.countingEligible !== false && item.linkStatus === "external") {
      return item.mediaType !== "video" && !isDefinitiveMediaFailure(item) && (!item.durationSeconds || item.mediaType !== "audio");
    }
    if (item.kind === "video" && item.countingEligible !== false && item.linkStatus === "external") {
      return item.mediaStatus !== "cloud_folder" && !isDefinitiveMediaFailure(item) && (item.mediaReviewRequired && item.mediaReviewDecision !== "use" || !item.durationSeconds);
    }
    // Document type does not block finalisation; existence is the criterion.
    return false;
  }).length;
  report.score = preliminaryScore(report.weeks, report.coverage, report.courseType);
  report.mediaCoverage = report.courseType === "GN" ? gnCoverageResult(report.weeks, report.gnTrack) : null;
  report.summary ||= {};
  report.summary.externalVideos = report.activities.filter((item) => item.kind === "video" && item.linkStatus === "external").length;
  report.summary.videoCandidates = report.activities.filter((item) => item.kind === "video_candidate" && !item.titleAlternativeOf).length;
  report.summary.recordingsExcluded = report.activities.filter((item) => item.kind === "recording" && !item.titleAlternativeOf).length;
  report.summary.duplicateMediaExcluded = report.activities.filter((item) => item.countingEligible === false).length;
  report.summary.externalPodcasts = report.activities.filter((item) => item.kind === "podcast" && item.linkStatus === "external").length;
  report.summary.videoPodcasts = report.activities.filter((item) => item.kind === "podcast" && item.mediaType === "video").length;
  report.summary.reviewerConfirmedPodcasts = report.activities.filter((item) => item.kind === "podcast" && item.reviewerDurationConfirmed).length;
  report.reviewedAt = new Date().toISOString();
  return report;
}

async function scanQueuedCourse(courseUrl, runId, course = {}) {
  const startedAt = Date.now();
  const tab = await createInactiveTab(courseUrl, runId, 20000);
  const deadline = startedAt + 90000;
  const heartbeat = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    chrome.storage.local.set({auditProgress:{current:0,total:0,label:"กำลังอ่านโครงสร้าง (" + seconds + " วินาที): " + courseUrl,updatedAt:Date.now()}});
  }, 5000);
  try {
    let scan = null;
    let consecutiveEmptyScans = 0;
    for (let attempt = 0; attempt < 12 && Date.now() < deadline; attempt += 1) {
      await throwIfCancelled(runId);
      const response = chrome.tabs.sendMessage(tab.id, { type:"SCAN_COURSE", expectedInstructor:course.instructors || "" });
      scan = await Promise.race([
        response.catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve({ok:false,error:"อ่านโครงสร้างเกินเวลา 90 วินาที"}), Math.max(1, deadline - Date.now())))
      ]);
      const clearlyEmpty = scan?.ok && isClearlyEmptyCourseCoverage(scan.coverage);
      if (clearlyEmpty) {
        consecutiveEmptyScans += 1;
        await recordAuditDiagnostic("course-structure-probe", {
          runId,
          courseId:new URL(courseUrl).searchParams.get("id") || "",
          result:"empty",
          attempt:attempt + 1,
          sectionCount:scan.coverage?.courseSectionCount || 0,
          nonForumActivityCount:scan.coverage?.nonForumActivityCount || 0,
          reachedEnd:Boolean(scan.coverage?.reachedEnd)
        });
        // Confirm the same complete-but-empty page twice so a slowly loading
        // Moodle shell is never mistaken for a genuinely blank course.
        if (consecutiveEmptyScans >= 2) {
          scan.emptyCourse = true;
          scan.emptyReason = "ไม่พบเนื้อหารายวิชา";
          break;
        }
      } else if (scan?.ok) {
        consecutiveEmptyScans = 0;
      }
      if (scan?.ok && !clearlyEmpty && scan.coverage?.structurallyComplete !== false) break;
      if (scan?.error?.includes("เกินเวลา")) throw new Error(scan.error);
      await waitInterruptibly(scan?.ok ? 1400 : 700, runId);
    }
    if (Date.now() >= deadline) throw new Error("อ่านโครงสร้างเกินเวลา 90 วินาที");
    if (!scan?.ok) throw new Error("เปิดหน้ารายวิชาได้ แต่ตัวอ่านโครงสร้างยังไม่พร้อม");
    if (scan.coverage?.structurallyComplete === false && !scan.emptyCourse) throw new Error("อ่านโครงสร้างรายวิชายังไม่ครบ");
    const structureScanMs = Date.now() - startedAt;
    const instructor = scan.emptyCourse ? {evidence:scan.instructorEvidence || null,status:"not_needed",elapsedMs:0} : await scanDeferredInstructorEvidence(tab.id, courseUrl, runId, scan.instructorEvidence, course.instructors || "");
    const ocr = scan.emptyCourse ? {activities:[],status:"not_needed",elapsedMs:0} : await scanDeferredCourseOcr(tab.id, courseUrl, runId);
    return {
      ...scan,
      instructorEvidence:instructor.evidence || scan.instructorEvidence || null,
      activities:mergeCourseActivities(scan.activities, ocr.activities).map(({html, ...item}) => item),
      coverage:{
        ...(scan.coverage || {}),
        ocrEvidenceStatus:ocr.status,
        ocrEvidenceCount:(ocr.activities || []).length,
        ocrUsedCount:Number(ocr.ocrUsedCount || 0),
        ocrResolvedWithoutOcrCount:Number(ocr.resolvedWithoutOcrCount || 0)
      },
      timing:{ ...(scan.timing || {}), structureScanMs, instructorEvidenceMs:instructor.elapsedMs || 0, deferredOcrMs:ocr.elapsedMs || 0 }
    };
  } finally {
    clearInterval(heartbeat);
    await closeAuditTab(tab.id);
  }
}

async function scanDeferredInstructorEvidence(tabId, courseUrl, runId, baseEvidence, expectedInstructor = "") {
  const startedAt = Date.now();
  if (baseEvidence?.identityComplete && baseEvidence?.contactComplete) return {evidence:baseEvidence,status:"dom_complete",elapsedMs:0};
  await chrome.storage.local.set({auditProgress:{current:0,total:0,label:"กำลังตรวจชื่อ รูป และช่องทางติดต่อผู้สอน: " + courseUrl,updatedAt:Date.now()}});
  try {
    const response = chrome.tabs.sendMessage(tabId,{type:"SCAN_INSTRUCTOR_EVIDENCE",expectedInstructor});
    const result = await Promise.race([response.catch((error)=>({ok:false,error:error?.message||String(error)})),new Promise((resolve)=>setTimeout(()=>resolve({ok:false,timedOut:true,error:"ตรวจข้อมูลผู้สอนเกินเวลา"}),45000))]);
    if(!result?.ok||!result.instructorEvidence)return {evidence:baseEvidence||null,status:result?.timedOut?"timeout":"unavailable",elapsedMs:Date.now()-startedAt};
    return {evidence:result.instructorEvidence,status:"complete",elapsedMs:Date.now()-startedAt};
  } catch { return {evidence:baseEvidence||null,status:"unavailable",elapsedMs:Date.now()-startedAt}; }
}

function mergeCourseActivities(baseActivities, extraActivities) {
  const contextual = new Map();
  for (const item of extraActivities || []) {
    if (item?.evidenceType !== "group_label_context" || !item.targetHref) continue;
    contextual.set(item.targetHref, item);
  }
  const merged = new Map();
  for (const item of [...(baseActivities || []), ...(extraActivities || [])]) {
    if (item?.evidenceType === "group_label_context") continue;
    const label = contextual.get(item.href);
    const enriched = label && (!item.groupContext || item.groupContextSource === "inherited_label")
      ? {...item, groupContext:label.groupContext, groupContextSource:label.groupContextSource,
        groupLabelEvidence:{source:label.collectionSource,text:label.groupContext,ocrUsed:label.ocrUsed,ocrConfidence:label.ocrConfidence}}
      : item;
    const section = enriched.sectionId || (enriched.sectionIndex ?? enriched.section) || "";
    const identity = enriched.labelIndex || enriched.assessmentKind || enriched.href || enriched.title || "";
    const key = `${section}::${enriched.evidenceType || enriched.collectionSource || enriched.kind || "activity"}::${identity}`;
    merged.set(key, enriched);
  }
  return [...merged.values()];
}

async function scanDeferredCourseOcr(tabId, courseUrl, runId) {
  const startedAt = Date.now();
  await chrome.storage.local.set({auditProgress:{current:0,total:0,label:"อ่านโครงสร้างแล้ว · กำลังอ่านข้อความจากป้ายภาพเฉพาะจุด: " + courseUrl,updatedAt:Date.now()}});
  try {
    const response = chrome.tabs.sendMessage(tabId, {type:"SCAN_COURSE_OCR"});
    const result = await Promise.race([
      response.catch((error) => ({ok:false,error:error?.message || String(error)})),
      new Promise((resolve) => setTimeout(() => resolve({ok:false,timedOut:true,error:"OCR ใช้เวลานานเกิน 90 วินาที"}), 90000))
    ]);
    if (!result?.ok) {
      await recordAuditDiagnostic("course-ocr-skipped", {runId,courseUrl,timedOut:Boolean(result?.timedOut),message:result?.error || "OCR ไม่พร้อม"});
      return {activities:[],status:result?.timedOut ? "timeout" : "unavailable",elapsedMs:Date.now() - startedAt};
    }
    await recordAuditDiagnostic("course-ocr-complete", {runId,courseUrl,ocrUsedCount:Number(result.ocrUsedCount || 0),resolvedWithoutOcrCount:Number(result.resolvedWithoutOcrCount || 0),evidenceCount:(result.activities || []).length});
    return {...result,status:"complete",elapsedMs:Date.now() - startedAt};
  } catch (error) {
    await recordAuditDiagnostic("course-ocr-skipped", {runId,courseUrl,timedOut:false,message:error?.message || String(error)});
    return {activities:[],status:"unavailable",elapsedMs:Date.now() - startedAt};
  }
}

let activeQueueRun = null;
let restartQueueWhenIdle = false;
let activeCentralWorkerRun = null;
let keepAwakeUsers = 0;
async function whileSystemAwake(action) {
  keepAwakeUsers += 1;
  if (keepAwakeUsers === 1) chrome.power.requestKeepAwake("system");
  try { return await action(); }
  finally {
    keepAwakeUsers = Math.max(0, keepAwakeUsers - 1);
    if (keepAwakeUsers === 0) chrome.power.releaseKeepAwake();
  }
}
function startQueueRun() {
  if (activeQueueRun) return;
  activeQueueRun = courseRunLimiter.run(() => whileSystemAwake(runAuditQueue)).finally(() => {
    activeQueueRun = null;
    if (restartQueueWhenIdle) {
      restartQueueWhenIdle = false;
      startQueueRun();
    }
  });
}
async function recoverInterruptedQueue() {
  const stored = await chrome.storage.local.get(["auditQueue", "auditQueueControl"]);
  const originalQueue = stored.auditQueue || [];
  const auditQueue = deduplicateAuditQueue(originalQueue);
  const auditQueueControl = stored.auditQueueControl || {};
  let recovered = auditQueue.length !== originalQueue.length;
  for (const job of auditQueue) {
    const legacyQuotaFailure = job.status === "failed" && /quota|QuotaBytes|QUOTA_EXCEEDED/i.test(String(job.error || ""));
    if (job.status !== "running" && !legacyQuotaFailure) continue;
    const interruptedMs = Math.max(0, Date.now() - Number(job.attemptStartedAt || job.startedAt || Date.now()));
    if (!legacyQuotaFailure) job.elapsedMs = Number(job.elapsedMs || 0) + interruptedMs;
    job.attemptElapsedMs = 0;
    job.status = auditQueueControl.paused ? "paused" : auditQueueControl.stopped ? "cancelled" : "queued";
    job.error = auditQueueControl.paused || auditQueueControl.stopped ? job.error : legacyQuotaFailure ? "แก้พื้นที่จัดเก็บแล้ว — ระบบนำงานกลับเข้าคิวอัตโนมัติ" : "กู้คืนคิวอัตโนมัติหลังระบบเบื้องหลังเริ่มใหม่";
    job.updatedAt = Date.now();
    recovered = true;
  }
  if (!recovered) return;
  await chrome.storage.local.set({auditQueue, auditQueueControl:{...auditQueueControl,activeRunId:null}, cancelAuditId:null});
  await recordAuditDiagnostic("queue-auto-recovery", {jobs:auditQueue.filter((item) => item.status === "queued").length});
  if (!auditQueueControl.paused && !auditQueueControl.stopped) startQueueRun();
}
void recoverInterruptedQueue().catch((error) => recordAuditDiagnostic("queue-recovery-error", {message:error.message}));
async function runAuditQueue() {
  const stored = await chrome.storage.local.get("auditQueue");
  const originalQueue = stored.auditQueue || [];
  const auditQueue = deduplicateAuditQueue(originalQueue);
  if (auditQueue.length !== originalQueue.length) await chrome.storage.local.set({auditQueue});
  for (const job of auditQueue.filter((item) => item.status === "queued")) {
    const { auditQueueControl = {} } = await chrome.storage.local.get("auditQueueControl");
    if (auditQueueControl.paused || auditQueueControl.stopped) break;
    const runId = crypto.randomUUID();
    // A report must show the duration of this audit attempt, not a stale
    // elapsed value carried over from an abandoned/paused browser session.
    job.status = "running"; job.runId = runId; job.error = null; job.resultMessage = null; job.startedAt = Date.now(); job.attemptStartedAt = job.startedAt; job.attemptElapsedMs = 0; job.updatedAt = Date.now();
    job.elapsedMs = Number(job.elapsedMs || 0);
    await chrome.storage.local.set({ auditQueue: [...auditQueue], auditQueueControl:{paused:false,stopped:false,activeRunId:runId}, auditProgress:{current:0,total:0,label:"กำลังอ่านโครงสร้าง: " + job.courseUrl,updatedAt:Date.now()} });
    try {
      await assertCanCreateReport();
      const scan = await scanQueuedCourse(job.courseUrl, runId, job);
      if (scan.emptyCourse) {
        job.status = "empty";
        job.reportId = null;
        job.courseTitle = scan.courseTitle || job.courseTitle || job.courseUrl;
        job.resultMessage = scan.emptyReason || "ไม่พบเนื้อหารายวิชา";
        job.updatedAt = Date.now();
        await recordAuditDiagnostic("course-empty", {
          runId,
          courseId:new URL(job.courseUrl).searchParams.get("id") || "",
          sectionCount:scan.coverage?.courseSectionCount || 0
        });
      } else {
        const report = await auditCourse({ ...scan, courseType:job.courseType, gnTrack:job.gnTrack, credits:job.credits, courseProfile:job.courseProfile, runId, timing:{structureScanMs:scan.timing?.structureScanMs || 0,auditStartedAt:job.startedAt} });
        report.timing.queueElapsedMs = Date.now() - job.attemptStartedAt;
        report.timing.previousQueueElapsedMs = job.elapsedMs;
        report.timing.queueStartedAt = job.createdAt || job.startedAt;
        report.timing.queueFinishedAt = Date.now();
        const saved = await saveReport(report);
        job.status = "done"; job.reportId = saved.id; job.courseTitle = saved.courseTitle; job.updatedAt = Date.now();
      }
    } catch (error) {
      const { auditQueueControl = {} } = await chrome.storage.local.get("auditQueueControl");
      job.status = error?.name === "AuditCancelled" && auditQueueControl.paused ? "paused" : error?.name === "AuditCancelled" ? "cancelled" : "failed";
      job.error = error?.message || "งานตรวจไม่สำเร็จ";
      job.updatedAt = Date.now();
      if (tabSafetyError) await chrome.storage.local.set({auditQueueControl:{paused:true,stopped:false,activeRunId:null}});
    }
    job.attemptElapsedMs = Math.max(0, Date.now() - Number(job.attemptStartedAt || job.startedAt || Date.now()));
    job.elapsedMs += job.attemptElapsedMs;
    job.finishedAt = Date.now();
    const { auditQueueControl: currentControl = {} } = await chrome.storage.local.get("auditQueueControl");
    await chrome.storage.local.set({ auditQueue:[...auditQueue], auditQueueControl:{...currentControl,activeRunId:null} });
    if (currentControl.paused || currentControl.stopped) break;
  }
  return auditQueue;
}

async function writeCentralWorkerState(state) {
  const next = {...state,updatedAt:new Date().toISOString()};
  await chrome.storage.local.set({[CENTRAL_WORKER_STATE_KEY]:next});
  return next;
}

async function runCentralWorkerJob(payload) {
  const job = normalizeCentralJob(payload);
  const runId = crypto.randomUUID();
  const version = chrome.runtime.getManifest().version;
  await writeCentralWorkerState({status:"running",job,runId,startedAt:new Date().toISOString(),result:null,error:null});
  try {
    await assertCanCreateReport();
    const scan = await scanQueuedCourse(job.courseUrl, runId, job);
    let result;
    let reportId = null;
    if (scan.emptyCourse) {
      result = emptyCentralResult(job, scan, {runId,version});
    } else {
      const report = await auditCourse({
        ...scan,
        courseType:job.courseType,
        gnTrack:job.gnTrack,
        credits:job.credits,
        courseProfile:job.courseProfile,
        runId,
        timing:{structureScanMs:scan.timing?.structureScanMs || 0,auditStartedAt:Date.now()}
      });
      const saved = await saveReport(report);
      reportId = saved.id;
      result = buildDashboardRecord(saved);
      result.courseId ||= job.courseId;
      result.courseCode ||= job.courseCode;
      result.courseProfile ||= job.courseProfile;
    }
    return await writeCentralWorkerState({
      status:"result_ready",job,runId,reportId,result,error:null,
      startedAt:(await chrome.storage.local.get(CENTRAL_WORKER_STATE_KEY))[CENTRAL_WORKER_STATE_KEY]?.startedAt || null,
      finishedAt:new Date().toISOString()
    });
  } catch (error) {
    const result = failedCentralResult(job, error, {runId,version});
    await recordAuditDiagnostic("central-worker-error", {runId,courseId:job.courseId,message:error?.message || String(error)});
    return await writeCentralWorkerState({
      status:"result_ready",job,runId,result,error:error?.message || String(error),finishedAt:new Date().toISOString()
    });
  }
}

function startCentralWorkerJob(payload) {
  if (activeCentralWorkerRun) return false;
  activeCentralWorkerRun = courseRunLimiter.run(() => whileSystemAwake(() => runCentralWorkerJob(payload))).finally(() => {
    activeCentralWorkerRun = null;
  });
  return true;
}

async function recoverCentralWorker() {
  const stored = await chrome.storage.local.get(CENTRAL_WORKER_STATE_KEY);
  const state = stored[CENTRAL_WORKER_STATE_KEY];
  if (state?.status === "running" && state.job) startCentralWorkerJob(state.job);
}
void recoverCentralWorker().catch((error) => recordAuditDiagnostic("central-worker-recovery-error", {message:error.message}));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUDIT") courseRunLimiter.run(() => whileSystemAwake(() => auditCourse(message.payload))).then(async (report) => {
    sendResponse({ ok: true, report: await saveReport(report) });
  }).catch((error) => sendResponse({ ok: false, error: error.message }));
  else if (message.type === "RUN_AUDIT_QUEUE") {
    startQueueRun();
    sendResponse({ ok:true, started:true });
  } else if (message.type === "CENTRAL_WORKER_PING") {
    sendResponse({ok:true,version:chrome.runtime.getManifest().version});
  } else if (message.type === "CENTRAL_WORKER_ENABLE") {
    chrome.permissions.request({origins:MEDIA_PROVIDER_ORIGINS})
      .then((granted) => sendResponse({ok:true,granted,version:chrome.runtime.getManifest().version}))
      .catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  } else if (message.type === "CENTRAL_WORKER_START") {
    (async () => {
      const incoming = normalizeCentralJob(message.payload || {});
      const stored = await chrome.storage.local.get(CENTRAL_WORKER_STATE_KEY);
      const state = stored[CENTRAL_WORKER_STATE_KEY];
      if (state?.status === "result_ready" && state.job?.jobId !== incoming.jobId) {
        throw new Error("ยังมีผลตรวจที่รอส่งเข้าระบบกลาง");
      }
      if (state?.status === "running") {
        sendResponse({ok:state.job?.jobId === incoming.jobId,started:false,state:{status:state.status,job:state.job,error:state.error || null}});
        return;
      }
      const started = startCentralWorkerJob(incoming);
      sendResponse({ok:started,started,state:{status:started?"starting":"busy",job:incoming}});
    })().catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  } else if (message.type === "CENTRAL_WORKER_STATUS") {
    (async () => {
      const stored = await chrome.storage.local.get([CENTRAL_WORKER_STATE_KEY,"auditProgress"]);
      const state = stored[CENTRAL_WORKER_STATE_KEY] || {status:"idle"};
      sendResponse({ok:true,state:{...state,progress:stored.auditProgress || null}});
    })().catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  } else if (message.type === "CENTRAL_WORKER_ACK") {
    (async () => {
      const stored = await chrome.storage.local.get(CENTRAL_WORKER_STATE_KEY);
      const state = stored[CENTRAL_WORKER_STATE_KEY];
      if (state?.job?.jobId && state.job.jobId !== String(message.payload?.jobId || "")) throw new Error("รหัสงานไม่ตรงกับผลที่รอส่ง");
      await chrome.storage.local.set({[CENTRAL_WORKER_STATE_KEY]:{status:"idle",updatedAt:new Date().toISOString()}});
      sendResponse({ok:true});
    })().catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  } else if (message.type === "SAVE_MEDIA_REVIEW_BATCH" || message.type === "FINALIZE_REVIEW") {
    podcastReviewLimiter.run(() => reportWriteLimiter.run(async () => {
      const stored = await chrome.storage.local.get(["podcastReviews","mediaReviews","videoOverrides","reviewerChecklist","manualChecklist"]);
      const report = structuredClone(await loadStoredReport(message.reportId));
      if (!report || report.courseUrl !== message.courseUrl) throw new Error("ไม่พบรายงานฉบับนี้ในประวัติ กรุณาเปิดรายงานจากคิวหรือประวัติอีกครั้ง");
      if (message.type === "SAVE_MEDIA_REVIEW_BATCH") {
        const podcastReviews = stored.podcastReviews || {}, mediaReviews = stored.mediaReviews || {}, videoOverrides = stored.videoOverrides || {};
        podcastReviews[report.courseUrl] ||= {}; mediaReviews[report.courseUrl] ||= {};
        videoOverrides[report.courseUrl] ||= {};
        for (const review of message.podcasts || []) {
          const item = report.activities.find(x => x.kind === "podcast" && podcastReviewKey(x) === review.key);
          if (!item || !Number.isInteger(review.seconds) || review.seconds < 0 || review.seconds > 5999) throw new Error("ข้อมูลเวลา Podcast ไม่ถูกต้อง");
          if (review.confirmed && (item.mediaType !== "audio" || review.seconds <= 0)) throw new Error("ยืนยันได้เฉพาะคลิปเสียงที่มีเวลาถูกต้อง");
          podcastReviews[report.courseUrl][review.key] = {seconds:review.seconds,confirmed:Boolean(review.confirmed),confirmedAt:new Date().toISOString(),fingerprint:podcastEvidenceFingerprint(item),targetUrl:item.externalUrl || item.href || ""};
        }
        for (const review of message.videos || []) {
          const item = report.activities.find(x => x.href === review.key && requiresMediaReview(x));
          if (!item || !MEDIA_DECISIONS.includes(review.decision)) throw new Error("ตัวเลือกคลิปไม่ถูกต้อง");
          const seconds = Number(review.seconds || 0);
          if (!Number.isInteger(seconds) || seconds < 0 || seconds > 43200) throw new Error("เวลาวิดีโอที่ผู้ตรวจกรอกไม่ถูกต้อง");
          const systemSeconds = Number(item.systemDurationSeconds ?? (item.source === "reviewer-confirmed-video-time" ? 0 : item.durationSeconds) ?? 0);
          if (review.decision === "use" && !seconds && !systemSeconds) throw new Error(`กรุณากรอกเวลาของคลิป: ${item.title || "ไม่ระบุชื่อ"}`);
          mediaReviews[report.courseUrl][review.key] = {decision:review.decision,seconds,updatedAt:new Date().toISOString(),fingerprint:mediaReviewFingerprint(item),targetUrl:item.externalUrl || item.href || ""};
        }
        for (const review of message.classifications || []) {
          const item = report.activities.find(x => x.href === review.key && (x.kind === "video_candidate" || x.classification?.contextConflict));
          if (!item || !["pending","confirm_current","pre_recorded","exclude"].includes(review.decision)) throw new Error("ตัวเลือกประเภทรายการไม่ถูกต้อง");
          if (review.decision === "pending") continue;
          const include = review.decision === "pre_recorded";
          const confirmCurrent = review.decision === "confirm_current";
          videoOverrides[report.courseUrl][review.key] = include ? "pre_recorded" : confirmCurrent ? "confirm_current" : "supplementary";
          if (!confirmCurrent) item.kind = include ? "video" : "supplementary";
          const decisionText = include ? "ยืนยันเป็นวิดีโอการสอนล่วงหน้า" : confirmCurrent ? `ยืนยันตามชื่อรายการเป็น ${item.kind}` : "ยืนยันว่าไม่นับรายการนี้";
          item.classification = { ...(item.classification || {}), kind:item.kind, confidence:"confirmed", requiresReview:false, contextConflict:false, reviewDecision:review.decision, evidence:[...(item.classification?.evidence || []), {source:"ผู้ตรวจ", value:decisionText, strength:"confirmed"}] };
          item.mediaCandidateProbe = false;
          item.mediaReviewRequired = false;
          item.mediaReviewDecision = include ? "use" : null;
          item.reviewExcluded = !include && !confirmCurrent;
          item.countingEligible = (include || confirmCurrent) && !item.duplicateOf;
          if (include && !item.durationSeconds) {
            if (item.mediaStatus === "access_denied") item.accessNote = "ผู้ตรวจยืนยันว่าเป็นวิดีโอการสอนล่วงหน้าแล้ว แต่ปลายทางติดสิทธิ์ผู้ให้บริการ — ไม่ผ่าน";
            else if (item.mediaStatus === "link_unavailable") item.accessNote = "ผู้ตรวจยืนยันว่าเป็นวิดีโอการสอนล่วงหน้าแล้ว แต่ลิงก์ไม่สามารถเข้าถึงได้ — ไม่ผ่าน";
            else if (item.mediaStatus === "link_error") item.accessNote = "ผู้ตรวจยืนยันว่าเป็นวิดีโอการสอนล่วงหน้าแล้ว แต่ลิงก์เสีย — ไม่ผ่าน";
            else {
              item.mediaStatus = "reviewer_confirmed_unreadable";
              item.accessNote = "ผู้ตรวจยืนยันว่าเป็นวิดีโอการสอนล่วงหน้า แต่ไม่มีเวลาที่ตรวจสอบได้ — ไม่ผ่านเกณฑ์เวลา";
            }
          }
        }
        applyPodcastReviews(report.activities,podcastReviews[report.courseUrl]);
        applyMediaReviews(report.activities,mediaReviews[report.courseUrl]);
        recalculatePodcastReport(report);
        delete report.finalResult;
        const compact = {...report,activities:report.activities.map(({html,...item})=>item)};
        const saved = await saveReportUnlocked(compact,{promoteLatest:false});
        await chrome.storage.local.set({podcastReviews,mediaReviews,videoOverrides});
        sendResponse({ok:true,report:saved});
      } else {
        const instructor = resolveInstructorDecision(stored.reviewerChecklist?.[report.courseUrl],report);
        applyInstructorDecision(report,instructor);
        // Rebuild pending counters with the current exclusion rules before
        // checking blockers. This also repairs a report saved by an older
        // version where excluded session-16 media remained in the counter.
        recalculatePodcastReport(report);
        const blockerDetails = finalReviewBlockerDetails(report);
        if (blockerDetails.length) throw new Error("ยังยืนยันผลไม่ได้: " + blockerDetails.slice(0,3).join(" · "));
        const manual = stored.manualChecklist?.[report.courseUrl] || {};
        const manualCount = ["student_meetings","video_quality","media_placement","submission_policy","backup"].filter(key=>manual[key]).length;
        report.score = preliminaryScore(report.weeks,report.coverage,report.courseType);
        const passed = report.courseType === "GN" ? report.mediaCoverage?.status === "pass" && report.weeks.every((w,i)=>w.checklist.filter((x,j)=>i===0 ? j!==2 && j!==3 : j!==2 && j!==3).every(x=>["pass","pass_tolerance","not_applicable"].includes(x.status))) : report.score.automatic + manualCount >= RULES[report.courseType].passScore;
        report.finalResult = {status:passed ? "pass" : "fail",confirmedAt:new Date().toISOString(),reviewState:JSON.stringify({instructor,manual})};
        sendResponse({ok:true,report:await saveReportUnlocked(report,{promoteLatest:false})});
      }
    })).catch(error=>sendResponse({ok:false,error:error.message}));
    return true;
  } else if (message.type === "SAVE_SESSION_MAPPING") {
    reportWriteLimiter.run(async () => {
      const report = structuredClone(await loadStoredReport(message.reportId));
      if (!report || report.courseUrl !== message.courseUrl) throw new Error("ไม่พบรายงานฉบับนี้ในประวัติ");
      const rows = report.coverage?.topologyMappingRows || [];
      const mappings = message.mappings && typeof message.mappings === "object" ? message.mappings : {};
      if (!rows.length || rows.some((row) => !(row.key in mappings))) throw new Error("กรุณาระบุผลการจับคู่ให้ครบทุกกล่อง");
      for (const row of rows) {
        const chosen = Number(mappings[row.key]);
        if (!Number.isInteger(chosen) || chosen < 0 || chosen > Number(report.coverage?.expectedSessions || 15)) throw new Error("เลขครั้งเรียนไม่ถูกต้อง");
        row.chosenSession = chosen || null;
        row.ignored = chosen === 0;
        row.outOfRange = false;
        row.reason = chosen === 0 ? "ผู้ตรวจยืนยันว่าไม่นับเป็นครั้งเรียน" : `ผู้ตรวจยืนยันเป็นครั้งที่ ${chosen}`;
      }
      for (const item of report.activities || []) {
        const key = sectionKey(item);
        if (!(key in mappings)) continue;
        const chosen = Number(mappings[key]);
        item.auditSession = chosen || null;
        item.outOfRange = chosen === 0;
        item.mappingIssue = chosen === 0 ? "ผู้ตรวจยืนยันว่าเป็นกล่องข้อมูลที่ไม่นับคะแนน" : null;
      }
      report.coverage.topologyConfidence = "confirmed";
      report.coverage.topologyReviewRequired = false;
      report.coverage.topologyManuallyConfirmed = true;
      report.coverage.topologySafetyIssues = [];
      report.coverage.topologyDiagnostics = [...(report.coverage.topologyDiagnostics || []).filter((entry) => !entry.manual),{section:"ทั้งรายวิชา",reason:"ผู้ตรวจยืนยันตารางแบ่งครั้งเรียนแล้ว",manual:true}];
      report.coverage.mappedNonForumActivityCount = report.activities.filter((item) => item.kind !== "forum" && item.auditSession).length;
      report.coverage.unmappedNonForumActivityCount = report.activities.filter((item) => item.kind !== "forum" && !item.auditSession && !item.outOfRange).length;
      report.coverage.excludedOutOfRangeActivityCount = report.activities.filter((item) => item.kind !== "forum" && item.outOfRange).length;
      recalculatePodcastReport(report);
      delete report.finalResult;
      const stored = await chrome.storage.local.get("sessionMappingOverrides");
      const sessionMappingOverrides = stored.sessionMappingOverrides || {};
      sessionMappingOverrides[report.courseUrl] = {fingerprint:report.coverage.sectionMappingFingerprint,mappings:Object.fromEntries(rows.map((row) => [row.key,Number(mappings[row.key])])),confirmedAt:new Date().toISOString()};
      await chrome.storage.local.set({sessionMappingOverrides});
      const saved = await saveReportUnlocked({...report,activities:report.activities.map(({html,...item})=>item)},{promoteLatest:false});
      return saved;
    }).then((report) => sendResponse({ok:true,report})).catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  } else if (message.type === "SET_PODCAST_REVIEW") {
    podcastReviewLimiter.run(() => reportWriteLimiter.run(async () => {
      const stored = await chrome.storage.local.get("podcastReviews");
      const latestReport = structuredClone(await loadStoredReport(message.reportId));
      const podcastReviews = stored.podcastReviews || {};
      if (!latestReport || latestReport.courseUrl !== message.courseUrl) throw new Error("ไม่พบรายงานของวิชานี้");
      const activity = latestReport.activities.find((item) => item.kind === "podcast" && podcastReviewKey(item) === message.key);
      if (!activity) throw new Error("ไม่พบรายการ Podcast");
      const seconds = Math.round(Number(message.seconds || 0));
      podcastReviews[message.courseUrl] ||= {};
      if (message.confirmed) {
        if (activity.mediaType === "video") throw new Error("Podcast นี้เป็นวิดีโอ จึงไม่สามารถยืนยันเวลาให้นับคะแนนได้");
        if (activity.mediaType !== "audio") throw new Error("ระบบยังยืนยันไม่ได้ว่าปลายทางเป็นคลิปเสียง");
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 8 * 3600) throw new Error("กรุณากรอกเวลาแบบ นาที:วินาที หรือ ชั่วโมง:นาที:วินาที");
        podcastReviews[message.courseUrl][message.key] = {seconds, confirmed:true, confirmedAt:new Date().toISOString(),fingerprint:podcastEvidenceFingerprint(activity),targetUrl:activity.externalUrl || activity.href || ""};
      } else if (Number.isFinite(seconds) && seconds > 0 && seconds <= 8 * 3600) {
        podcastReviews[message.courseUrl][message.key] = {seconds, confirmed:false, updatedAt:new Date().toISOString()};
      } else {
        delete podcastReviews[message.courseUrl][message.key];
      }
      applyPodcastReviews(latestReport.activities, podcastReviews[message.courseUrl]);
      recalculatePodcastReport(latestReport);
      await chrome.storage.local.set({podcastReviews});
      const saved = await saveReportUnlocked(latestReport,{promoteLatest:false});
      sendResponse({ok:true, report:saved});
    })).catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  } else if (message.type === "QUEUE_CONTROL") {
    (async () => {
      const { auditQueue = [], auditQueueControl = {} } = await chrome.storage.local.get(["auditQueue","auditQueueControl"]);
      const control = message.action === "resume" ? {paused:false,stopped:false,activeRunId:null} : {paused:message.action === "pause",stopped:message.action === "stop",activeRunId:auditQueueControl.activeRunId || null};
      if (message.action === "resume") auditQueue.forEach((job) => { if (job.status === "paused") { job.status = "queued"; job.error = null; } });
      if (message.action === "stop") auditQueue.forEach((job) => { if (job.status === "running") job.status = "cancelled"; });
      if (control.activeRunId) await chrome.storage.local.set({cancelAuditId:control.activeRunId});
      await chrome.storage.local.set({auditQueue, auditQueueControl:control});
      if (message.action === "resume") {
        if (activeQueueRun) restartQueueWhenIdle = true;
        else startQueueRun();
      }
      sendResponse({ok:true});
    })().catch((error) => sendResponse({ok:false,error:error.message}));
    return true;
  }
  else return;
  return message.type === "AUDIT";
});

