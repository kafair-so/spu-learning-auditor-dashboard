# Handoff — LL / Local Legacy

> สถานะเอกสาร: **Migration baseline 24 พ.ย. 2569** จาก Handoff เดิมถึง §130 และ Source ใน `main` ณ Commit `b1813af93b45`  
> **ไม่ใช่การรับรองเวอร์ชันที่ติดตั้งบนเครื่อง หรือสถานะ production ปัจจุบัน**: ทุกครั้งที่ทำงานต้องตรวจ Source/Release/CI/Runtime ล่าสุดก่อน

> **LL = Local Legacy**, local legacy policy และ PDF/report/reviewer workflow ของตัวเอง  
> ข้อมูล Release ล่าสุดใน Archive คือ **0.3.30** (23 พ.ย. 2569) แต่ Source/ZIP อยู่ในงาน Local ตามบันทึก ไม่ได้ถือว่า GitHub `main` มีไฟล์ Release นี้

## Policy snapshot (ต้องอ่าน scope ตอนใช้งานจริง)

- §120 ระบุวิชา T/TT: ทฤษฎีเต็ม 100 ผ่าน 70; L/LL/P: ปฏิบัติเต็ม 50 ผ่าน 40 ในบริบทที่อ้าง ณ เวลานั้น
- Week 1 แผนการสอนอยู่ร่วมกับเอกสารประกอบตามกฎ LL; video allowance ตามหน่วยกิต: Week 1 = 3/5/10 นาที, Week 2–15 = 5/10/20 นาที สำหรับ 1/2/3+ หน่วยกิต
- GS/GR/GN และ Podcast/AI Tutor ต้องใช้ policy ต่อประเภท; §56 เพิ่ม GN แบบไม่นับ Podcast/AI Tutor
- **อย่ารับนโยบาย DL ภาค 1/2569 หรือ current DB/LC เข้า LL โดยอัตโนมัติ** แม้จะแชร์ parser

## Version timeline & evidence

| Version | ประเด็นสำคัญจาก Archive | หลักฐาน/ข้อจำกัด |
|---|---|---|
| 0.1.0–0.1.7 | เริ่ม Local Legacy, Video-only, Pre/Post Chat/Page/Image/Forum | §§15–24 |
| 0.2.0 | ตรวจหลาย GR/GS และ PDF Evidence Service / Apps Script | §§25–27 |
| 0.3.9–0.3.20 | practical scoring, comments, instructor images, GN/Forum/Worksheet | §§48–56, 63, 66–67 |
| 0.3.21 | port reader/Legacy context from Dashboard Legacy 0.13.39 | §120, not a wholesale DL rubric copy |
| 0.3.22 | Moodle Quiz classification + Google Drive foreground time | §121 |
| 0.3.23 | direct Moodle Video Class URL without readable image-label | §122, patch overlay release |
| 0.3.24–0.3.28 | EBC314 URL/player/Pre-record image icon/Vidyard handling | §§124–128; live acceptance **open** |
| 0.3.29 | English teacher-facing evidence/report renderer | §129 |
| **0.3.30** | Saved PDF 8-page EBC211 localization completeness; 50/50 tests, 104 syntax checks | §130; PDF/report-only changes, EBC314 live acceptance still open |

## Active issue: EBC314 (ต้องยืนยันใน Chrome จริง)

- §123 report observed Session 1 `Video Class 1–6` มี Moodle links แต่สแกนไม่พบ/เวลาเป็น 0:00
- §§124–128 มีการแก้ source แบบสืบเนื่อง; ห้ามถือว่า automated tests เท่ากับ live playback/duration success
- ต้องเปิดเนื้อหา Section จริงใน Chrome ที่ล็อกอินและยืนยัน URL mapping, player duration, 6/6 detection, evidence report, no duplicate count
- ขอบเขต test สองรายวิชาที่ระบุใน §128 ยังไม่ปิดจาก §130

## Related Shared Core

- Classifier `Pre-test/Post-test/Quiz` ควรแยก image label และ HTML module reality (SC-03)
- Foreground duration / Vidyard/OneDrive/Drive fallback ต้องเก็บ source-confidence และไม่นำ 0:00 ที่อ่านไม่ได้ไปตัดเป็นไม่มีคลิป (SC-06)
- Saved PDF EN: แปล UI/output ของระบบ แต่คงชื่อไฟล์และหัวข้ออาจารย์เดิม (SC-10)

## Next tasks

- [ ] ทำ authenticated acceptance EBC314 + second-course baseline ตาม §128
- [ ] ตรวจ LL 0.3.30 manifest, ZIP SHA และ source path จาก artifact ที่เก็บจริง
- [ ] ตรวจข้อความไทยค้างใน EN PDF ด้วย saved-file test เหมือน §130 เมื่อมี report ใหม่
- [ ] ประเมิน code patch เป็น reusable shared fixture และเสนอ backport ไป DB/LC/DL ทีละสาย

## Change log

- 2026-11-24 — แยก LL ด้วยบริบทจาก §§15–27, 48–56, 63, 66–67, 120–130; ไม่ย้าย Source/ZIP หรือเปลี่ยนผลตรวจ
