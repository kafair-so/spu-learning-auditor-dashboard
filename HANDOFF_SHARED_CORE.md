# Handoff — Shared Core / Cross-Version Capability Standard

> สถานะเอกสาร: **Migration baseline 24 พ.ย. 2569** จาก Handoff เดิมถึง §130 และ Source ใน `main` ณ Commit `b1813af93b45`  
> **ไม่ใช่การรับรองเวอร์ชันที่ติดตั้งบนเครื่อง หรือสถานะ production ปัจจุบัน**: ทุกครั้งที่ทำงานต้องตรวจ Source/Release/CI/Runtime ล่าสุดก่อน

> เจ้าของเรื่อง: **มาตรฐานความสามารถร่วม, compatibility contract, regression suite, feature parity และการกระจายการแก้ไข**  
> ไม่ใช่เจ้าของเกณฑ์คะแนนหรือกฎผ่อนปรนของ DB/LC/LL/DL

## หลักการร่วม (สำคัญ)

1. **Read once, classify consistently, score per track**: เนื้อหาจาก Moodle, URL, labels, Course ID และ evidence ควรจัดโครงสร้างให้เทียบกันได้ แต่แต่ละ track ต้องเลือก policy และ pass gate ของตัวเอง
2. ไม่รวม rubric โดยไม่ตั้งใจ: GR/GS/GN, theoretical/practical, หน่วยกิต, legacy/current และภาคเรียนต่างกันได้
3. Source-derived evidence ต้องรักษา raw title, URL, provenance, duration, access status และ reviewer confirmation เพื่อ audit/replay ย้อนหลัง
4. Evidence uncertainty ไม่ใช่ absence: `ocr_timeout`, `play_required`, `duration_pending`, access denial และ skipped recording ต้องแยกจาก `not_found` และ `broken`
5. ยึด **scope guards + acceptance fixtures**: ประเมินกับตัวอย่างที่เคย false-positive/false-negative, ไม่อนุมานว่า port โค้ดแล้วใช้งานทุกเวอร์ชันโดยอัตโนมัติ

## Shared capability catalog

| ID | ความสามารถร่วมที่ควรกำหนดสัญญา | ตัวอย่างข้อกำหนดร่วม | เอกสารเดิม |
|---|---|---|---|
| SC-01 | Course URL / Course ID / Profile normalization | รองรับ `/course/view.php?id=N`, source+canonical URL, ไม่ทำ ID หาย | §§27, 69, 77, 82 |
| SC-02 | Track, course-type, session mapping | อ่าน section/ครั้งที่, หลีกเลี่ยงการโยกสัปดาห์ผิด, T/L/P ใช้ metadata หลายแหล่ง | §§47, 56, 69–70, 89, 106 |
| SC-03 | Moodle activity classification | Quiz Pre/Post/Assignment, Forum, File, Page, Label, Video class, LiveRecord; กันสื่อผิดประเภท | §§18–24, 50–55, 64, 107, 114, 120–128 |
| SC-04 | Document evidence | PDF จริง, file metadata, link destination, Lesson plan vs Teaching materials, ไม่ยึดชื่อผิด | §§53, 70, 118, 130 |
| SC-05 | Instructor evidence | ชื่อ รูป ช่องทางติดต่อ QR, context, lazy-load/OCR timeout, ไม่เอารูปทั่วไปมาทึกทักว่าคือรูปผู้สอน | §§59, 66–67, 91, 109, 111, 120 |
| SC-06 | Media provider reader | OneDrive/SharePoint/Google Drive/Vidyard, origin, duration confidence, retry/foreground playback | §§61, 101–102, 111, 116, 121, 126–128 |
| SC-07 | Reviewer evidence & decision provenance | raw vs confirmed, `needs_review`, idempotent replay, ไม่เพิ่มคะแนนจากข้อมูลคาดเดา | §§58, 60, 75, 100, 109, 114–115 |
| SC-08 | Runtime reliability | checkpoint/retry, timeout, completed-job idempotency, cancellation, queue safety | §§93–99, 111 |
| SC-09 | Evidence schema / export | component/session/criteria/media items, duration, source title, immutable correction trace | §§75, 83–88, 108, 114–115 |
| SC-10 | Multilingual reporting & contrast | แปลเฉพาะข้อความระบบ, คงชื่อไฟล์/ชื่อวิชา Moodle ตามต้นฉบับ; contrast dark mode | §§113, 118–119, 129–130 |

## Feature Parity Matrix — baseline เอกสาร ไม่ใช่ live certification

**สัญลักษณ์:** `D` = มีหลักฐานใน Handoff/Source ว่า *เคยรองรับหรือเคยพัฒนา*; `?` = ต้องตรวจ implementation/runtime หรือยังไม่พบหลักฐานชัด; `N/A` = ไม่มีเป้าหมายใช้งานตาม track. ตัว `D` **ไม่แปลว่าพฤติกรรมตรงกันหรือผ่าน acceptance ล่าสุด**.

| Feature | DB | LC | LL | DL | เงื่อนไขก่อนถือว่า Parity สำเร็จ |
|---|---|---|---|---|---|
| Course ID, Course Profile, ชนิดวิชา | D | D | D | D | กรณี URL/Section/Course Type เดียวกันแปลง schema ถูก; ใช้ policy คนละชุดได้ |
| Section / Week topology | D | D | D | D | ไม่สลับ Week; ทดสอบ 15 ครั้งและหัวข้อ Image-only |
| Moodle Quiz Pre/Post / activity | D | D | D | D | ชื่อผิด/ป้ายภาพ/Forum/Quiz tests; ตรวจขอบเขตผ่อนปรนของแต่ละ track |
| รูปผู้สอน + QR/LINE + OCR uncertainty | D | ? | D | D | ห้ามนับ avatar ทั่วไป, missing name waiver ต้องมีหลักฐานและ policy |
| Video class vs LiveRecord | D | ? | D | D | recording skipped ไม่ถูกคิดเป็น broken VOD |
| OneDrive/SharePoint/Drive/Vidyard duration | D | ? | D | D | เปิดจริง, consent, duration confidence, no bogus zero, no cross-file access cache |
| PDF/Teaching materials classification | D | D | D | D | ตรวจปลายทางจริงและ section, ไม่ทึกทักว่าไฟล์ทุกชนิดเป็น PDF |
| Reviewer confirmation reuse | D | ? | D | D | ไม่ทับผลผู้ตรวจเดิม, audit trail และ no duplicate count |
| Report TH/EN & persisted evidence | D | ? | D | D | ตรวจ saved PDF/actual Chrome, free-form user titles ไม่ถูกแปล |
| Publishing / Main Data sync | Web | N/A | N/A | Web | ไม่บังคับ Local ใช้ queue กลาง; outcome verification อยู่ Web Platform |

ตารางนี้เป็น **starting audit** ไม่ใช่ข้อรับรองว่าทั้ง 4 รุ่นมี code parity ให้ลง `source hash`, `test ID`, `verified at` และ `owner` เมื่อเริ่มรับงานแต่ละ feature

## วิธีรับการแก้ไขจาก Track หนึ่งไปอีก 3 Track

| Phase | กิจกรรม | ข้อกำหนดผ่าน |
|---|---|---|
| 1. Capture | บันทึก bug, source screenshot/URL, schema & false-positive/false-negative | มี reproducer และ expected/actual |
| 2. Classify | แยก **Shared reader** กับ **track-specific policy** | ไม่พ่วงคะแนน/เกณฑ์ไปอีกสาย |
| 3. Adapt | ใช้ adapter/compatibility layer สำหรับ DOM, permission, output format | เปลี่ยนเฉพาะโปรแกรมที่ยอมรับ migration |
| 4. Verify | unit/fixtures + live Moodle media/read test + compare previous known pass | ไม่เพิ่ม false-positive และไม่ทำคะแนนหาย |
| 5. Release | Tag track version; sign/check ZIP hash; deploy เฉพาะที่ต้อง deploy | เวอร์ชัน/หน้าโหลด/manifest ตรง |
| 6. Record | อัปเดต matrix พร้อม test evidence และ Handoff ของแต่ละ track ที่เปลี่ยน | มี SHA, scope, rollback, unresolved issues |

## Shared regression fixtures ที่ต้องรักษา

- **ALB311** — รูป/ชื่อ/QR, Session 9 old video duration reuse มี reviewer trace (§109)
- **FDM313** — รูป/ชื่อทั่วไปถูกนับเป็นผู้สอนผิด ต้องกัน false-positive (§91)
- **EBC314** — 6 Video Class links, image-only label, Moodle URL-to-player, Vidyard total clock; LL live test ยังเปิด (§§123–130)
- **BUS431** — valid VOD vs skipped LiveRecord และคำเตือน “ลิงก์วิดีโอเปิดปลายทางไม่ได้” ต้องอิง media status ไม่ใช่ข้อความทั่วไป (§116)
- **ICT218 / ICT306** — Moodle Quiz tolerance และ reviewer-confirmed end-of-session exception ไม่ขยายเกณฑ์โดยไม่ตั้งใจ (§§114–115)
- **EBC211 saved PDF** — บังคับระบบภาษา EN ไม่มีไทยที่เป็นข้อความระบบ โดยรักษาชื่อเอกสารต้นฉบับ (§130)

## Open cross-track backlog

- [ ] ทำ authoritative source/version inventory **แยก DB/LC/LL/DL** พร้อม manifest hash; งานใน Local อาจไม่ได้เก็บ Source ใน repo
- [ ] รวบรวม fixture ที่ใช้ร่วมกันให้เป็นชุดตรวจเดียว แต่ parameterize policy ต่อ track
- [ ] ตรวจจริง Instructor contextual image + QR และ OneDrive foreground duration ทุก track ก่อนเลื่อน `?` เป็น `D (verified)`
- [ ] แยก source-level event `unreadable` / `not_found` / `skipped_recording` / `invalid` ใน shared evidence contract
- [ ] นำกรณีผิดพลาดที่แก้ใน DL/LL ไปประเมินว่า DB/LC ได้รับผลกระทบหรือไม่; ไม่ cherry-pick ค่าคะแนนตามกัน
- [ ] กู้/ตรวจประวัติ §§28–46 จาก Git history (ต้นฉบับมี pre-existing truncation; ดู [INDEX](INDEX.md))


## Cross-version rollout decision register — baseline 2026-11-24

| หัวข้อที่เคยแก้ | Track ต้นทางในประวัติ | แนะนำให้ตรวจผลกระทบกับ | ข้อห้ามขณะ backport |
|---|---|---|---|
| Moodle Quiz Pre/Post ชื่อผิด/ป้ายภาพ (§§21–24, 121–122) | LL | DB, LC, DL | ห้ามเปลี่ยนเกณฑ์นับช่วงสัปดาห์หรือคะแนนโดยไม่แยก policy |
| Video Class ชื่อ/ภาพ/Pre-record vs LiveRecord (§§123–128) | LL | DB, LC, DL | ห้ามเหมารวม recording กับ VOD; ห้ามเครดิตเวลาเพราะกดลิงก์เปิดได้ |
| เครดิต Moodle Quiz เกณฑ์ผ่อนปรน 1/2569 (§114) | DL | LL เฉพาะ review policy, DB/LC เฉพาะ classifier | **ห้ามคัดลอกการผ่อนปรน 2–10 ไป current** |
| รูปผู้สอน/QR/LINE และชื่อไม่ครบ (§§59,66–67,109,114) | DB/DL/LL | ทุก track | Generic QR/ภาพประกอบไม่ใช่รูปผู้สอนจริง; การ waive ชื่อต้องเก็บเหตุผล |
| PDF English rendering ของ EBC211 (§130) | LL | DB/LC/DL ในส่วนรายงาน | แปลข้อความระบบเท่านั้น ไม่แปลชื่อวิชาและชื่อไฟล์อาจารย์ |
| Wrong broken-video banner ของ BUS431 (§116) | Web Platform | ทุก track ที่ส่ง media status | `duration_unreadable` และ `skipped_recording` ไม่ใช่ `link_error` |

**ตารางนี้ยังเป็น `needs evaluation`** ไม่ใช่คำสั่งให้ merge หรืออ้างว่าแต่ละรุ่นผ่านแล้ว. ทุกงานที่รับเข้าต้องระบุ `source version`, `target track/version`, fixture, expected behavior, acceptance result และ release commit ก่อนเปลี่ยน Parity Matrix

## Change log

- 2026-11-24 — สร้างมาตรฐาน Shared Core และ Parity baseline; ยังไม่แก้/รวม Source Code หรือเปลี่ยนผลตรวจ
