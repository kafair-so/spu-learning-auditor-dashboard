// One provider registry is used by the permission prompt and by the media
// reader. Keeping these in separate arrays previously allowed Chrome to grant
// a host while the reader still claimed that it had no permission.
export const MEDIA_PROVIDER_ORIGINS = [
  "https://drive.google.com/*", "https://docs.google.com/*", "https://*.googleusercontent.com/*", "https://youtube.googleapis.com/*",
  "https://photos.app.goo.gl/*", "https://photos.google.com/*", "https://photos.fife.usercontent.google.com/*",
  "https://1drv.ms/*", "https://onedrive.live.com/*", "https://*.sharepoint.com/*",
  "https://notebooklm.google.com/*", "https://notebook.google.com/*",
  "https://spuai.spu.ac.th/*", "https://spu-km.jib-ai.com/*", "https://spulive-my.sharepoint.com/*",
  "https://www.youtube.com/*", "https://www.youtube-nocookie.com/*", "https://youtu.be/*",
  "https://*.heygen.com/*",
  "https://www.tiktok.com/*", "https://m.tiktok.com/*", "https://vm.tiktok.com/*", "https://vt.tiktok.com/*",
  "https://*.loom.com/*", "https://*.vidyard.com/*", "https://*.vimeo.com/*",
  "https://fast.wistia.net/*", "https://*.wistia.com/*", "https://*.kaltura.com/*",
  "https://spulive.spu.ac.th/*", "https://canva.link/*", "https://canva.com/*", "https://www.canva.com/*", "https://*.canva.site/*",
  "https://gamma.app/*", "https://*.gamma.app/*"
];

export function providerOriginsForUrl(targetUrl) {
  let host;
  try { host = new URL(targetUrl).hostname; } catch { return []; }
  // Drive renders MP4 previews in a YouTube player iframe hosted at
  // youtube.googleapis.com. The outer Drive page exposes no duration, so the
  // media probe must be allowed to inspect that frame as well.
  if (host === "drive.google.com" || host.endsWith(".googleusercontent.com")) return ["https://drive.google.com/*", "https://*.googleusercontent.com/*", "https://youtube.googleapis.com/*"];
  // A Google Photos share link redirects from photos.app.goo.gl to
  // photos.google.com, while the actual stream can come from a
  // googleusercontent.com stream and a youtube.googleapis.com player frame.
  // Request the complete chain once so allFrames can inspect the visible clock.
  if (host === "photos.app.goo.gl" || host === "photos.google.com" || host === "photos.fife.usercontent.google.com") return ["https://photos.app.goo.gl/*", "https://photos.google.com/*", "https://*.googleusercontent.com/*", "https://photos.fife.usercontent.google.com/*", "https://youtube.googleapis.com/*"];
  if (host === "youtube.googleapis.com") return ["https://youtube.googleapis.com/*"];
  if (host === "docs.google.com") return ["https://docs.google.com/*"];
  if (host === "1drv.ms" || host.endsWith(".1drv.ms")) return ["https://1drv.ms/*", "https://onedrive.live.com/*", "https://*.sharepoint.com/*"];
  if (host === "onedrive.live.com") return ["https://onedrive.live.com/*", "https://*.sharepoint.com/*"];
  if (host === "spulive-my.sharepoint.com") return ["https://spulive-my.sharepoint.com/*"];
  if (host.endsWith(".sharepoint.com")) return ["https://*.sharepoint.com/*"];
  if (host === "notebooklm.google.com") return ["https://notebooklm.google.com/*"];
  if (host === "notebook.google.com") return ["https://notebook.google.com/*"];
  if (host === "spuai.spu.ac.th") return ["https://spuai.spu.ac.th/*"];
  if (host === "spu-km.jib-ai.com") return ["https://spu-km.jib-ai.com/*"];
  if (host === "www.youtube.com") return ["https://www.youtube.com/*"];
  if (host === "www.youtube-nocookie.com") return ["https://www.youtube-nocookie.com/*"];
  if (host === "youtu.be") return ["https://youtu.be/*"];
  if (host === "heygen.com" || host.endsWith(".heygen.com")) return ["https://*.heygen.com/*"];
  if (["www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"].includes(host)) return ["https://www.tiktok.com/*", "https://m.tiktok.com/*", "https://vm.tiktok.com/*", "https://vt.tiktok.com/*"];
  if (host.endsWith(".loom.com")) return ["https://*.loom.com/*"];
  if (host.endsWith(".vidyard.com")) return ["https://*.vidyard.com/*"];
  if (host.endsWith(".vimeo.com")) return ["https://*.vimeo.com/*"];
  if (host === "fast.wistia.net") return ["https://fast.wistia.net/*"];
  if (host.endsWith(".wistia.com")) return ["https://*.wistia.com/*"];
  if (host.endsWith(".kaltura.com")) return ["https://*.kaltura.com/*"];
  if (host === "spulive.spu.ac.th") return ["https://spulive.spu.ac.th/*"];
  if (host === "canva.link") return ["https://canva.link/*", "https://canva.com/*", "https://www.canva.com/*"];
  if (host === "canva.com") return ["https://canva.com/*"];
  if (host === "www.canva.com") return ["https://www.canva.com/*"];
  if (host.endsWith(".canva.site")) return ["https://*.canva.site/*"];
  if (host === "gamma.app") return ["https://gamma.app/*", "https://*.gamma.app/*"];
  if (host.endsWith(".gamma.app")) return ["https://*.gamma.app/*"];
  return [];
}

// This deliberately works from only a heading and the labels of visible
// actions.  It never returns page text, account names or owner information to
// the audit report.  A provider-neutral gate lets Google Drive, Loom and Thai
// file hosts fail quickly without treating a spinner as an access failure.
export function accessGateFromEvidence({ url = "", heading = "", actions = "", bodyText = "" } = {}) {
  const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const headingText = compact(heading);
  const actionText = compact(actions);
  const body = compact(bodyText);
  const combined = `${headingText} ${actionText} ${body}`;
  const googlePhotosPage = /^https?:\/\/(?:photos\.google\.com|photos\.app\.goo\.gl)(?:[/?#]|$)/i.test(url);
  const emptyGooglePhotosAlbum = googlePhotosPage && /\b(?:this\s+)?album\s+is\s+empty\b|อัลบั้ม(?:นี้)?\s*(?:ว่าง|ไม่มี(?:รูป|วิดีโอ|รายการ|สื่อ))|ไม่มี(?:รูป|วิดีโอ|รายการ|สื่อ).{0,20}ในอัลบั้ม/i.test(combined);
  const missingFilePhrase = /sorry,?\s+the file you have requested does not exist|the requested file does not exist|file (?:was not found|does not exist)|(?:page|video|content) (?:was not found|does not exist|is unavailable)|this (?:video|content|loom) (?:isn['’]t|is not) available|the video may have been deleted or archived|404\s*(?:not found)?|ขออภัย.{0,24}ไฟล์ที่คุณขอ.{0,24}(?:ไม่มีอยู่|ไม่พบ)|ไม่พบ(?:ไฟล์|หน้า|วิดีโอ|เนื้อหา)ที่(?:คุณ)?(?:ร้องขอ|ต้องการ)?|(?:ไฟล์|หน้า|วิดีโอ|เนื้อหา)(?:นี้)?(?:ไม่มีอยู่|ไม่พร้อมใช้งาน|ถูกลบแล้ว)/i;
  const accessDeniedUrl = /(?:^|\.)sharepoint\.com\/.*\/_layouts\/15\/AccessDenied\.aspx(?:[?#]|$)/i.test(url);
  const notebookAccessRequestUrl = /^https?:\/\/notebook(?:lm)?\.google\.com\/accessrequest(?:[/?#]|$)/i.test(url);
  const accessPhrase = /\b(?:you need access|you (?:do not|don't) have access|request access|contact (?:the )?owner|permission denied|access restricted|access denied)\b|คุณ\s*(?:ต้องมีการเข้าถึง|ไม่มีสิทธิ์เข้าถึง)|คุณไม่ได้รับอนุญาต|คุณเข้าถึง\s*(?:เอกสาร|ไฟล์|รายการ|เนื้อหา)?\s*(?:นี้)?\s*ไม่ได้|ต้องติดต่อเจ้าของ(?:ไฟล์)?|โปรดติดต่อ(?:เจ้าของ|บุคคลที่(?:ให้คุณ)?แชร์)|ขอ(?:สิทธิ์|การ)เข้าถึง|ไฟล์นี้ถูกจำกัดการเข้าถึง|ผู้ดูแลระบบไม่อนุญาต/i;
  const accessAction = /request access|contact (?:the )?owner|ขอ(?:สิทธิ์|การ)เข้าถึง|ติดต่อเจ้าของ/i;
  const loginPhrase = /\b(?:sign in|log in|login)\b|ลงชื่อเข้าใช้|เข้าสู่ระบบ/i;
  const loginUrl = /(?:accounts\.google\.com|\/login(?:[/?#]|$)|\/signin(?:[/?#]|$)|oauth)/i;
  const explicitHeading = /\b(?:you need access|permission denied|access restricted|access denied)\b|คุณ\s*(?:ต้องมีการเข้าถึง|ไม่มีสิทธิ์เข้าถึง)|คุณไม่ได้รับอนุญาต|ต้องติดต่อเจ้าของ(?:ไฟล์)?|ไฟล์นี้ถูกจำกัดการเข้าถึง/i.test(headingText);
  const explicitBodyAccess = /\byou (?:do not|don't) have access\b|คุณ\s*(?:ต้องมีการเข้าถึง|ไม่มีสิทธิ์เข้าถึง)|คุณเข้าถึง\s*(?:เอกสาร|ไฟล์|รายการ|เนื้อหา)?\s*(?:นี้)?\s*ไม่ได้|โปรดติดต่อบุคคลที่(?:ให้คุณ)?แชร์/i.test(body);

  if (emptyGooglePhotosAlbum) return { status:"empty_media", accessNote:"ปลายทาง Google Photos เปิดได้ แต่อัลบั้มว่างและไม่มีวิดีโอ" };
  if (missingFilePhrase.test(combined)) {
    return { status: "missing_file", accessNote: "ปลายทางแจ้งว่าไฟล์หรือวิดีโอไม่มีอยู่" };
  }
  if (accessDeniedUrl || notebookAccessRequestUrl || (accessPhrase.test(combined) && (explicitHeading || explicitBodyAccess || accessAction.test(actionText)))) {
    return { status: "access_denied", accessNote: "ติดสิทธิ์ผู้ให้บริการ — ยืนยันจากหน้าสิทธิ์ของปลายทาง" };
  }
  if ((loginUrl.test(url) || loginPhrase.test(headingText)) && loginPhrase.test(combined)) {
    return { status: "login_required", accessNote: "ต้องลงชื่อเข้าใช้ผู้ให้บริการก่อนจึงตรวจลิงก์นี้ได้" };
  }
  return null;
}

