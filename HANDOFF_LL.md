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


## Operational safety — อย่าให้รายงาน Local Legacy เพี้ยน

### คะแนน/ประเภท/การอ่านหลักฐาน

- แยก Course Profile **T/TT** กับ **L/LL/P** ก่อนตัดสิน rubric; ทฤษฎี 100/70, ปฏิบัติ 50/40 ตามนโยบายที่บันทึก ณ §120. การนำตัวตรวจอ่านหลักฐานจาก DL มาปรับ LL ไม่ได้แปลว่าต้องยก legacy_12569 ของ DL มาใช้ทุกภาคเรียน
- เหตุการณ์ Week 1 มีข้อกำหนดต่างจาก current DB/LC โดย LL §120 ยืนยันว่า lesson-plan ถูกนับรวมกับ teaching materials. ระยะวิดีโอผ่อนปรน 3/5/10 นาที Week 1 และ 5/10/20 นาที Week 2–15 ตามหน่วยกิต 1/2/3+
- **GN (§56)** มีข้อยกเว้น Podcast และ AI Tutor; ห้ามบังคับใช้การตรวจ GS/GR แบบเหมารวมและห้ามเดาว่ากิจกรรม optional เป็น mandatory
- ค่า `0:00` ที่อ่านเวลาไม่ได้ไม่ใช่หลักฐานว่าสื่อไม่มีจริง: ดู media provider, redirected URL, metadata, access rights และ video category ก่อนตัดคะแนน

### EBC314 forensic history & acceptance (Course ID 19734)

| รุ่น | ปมปัญหาที่ตรวจ | สิ่งที่ต้องไม่ทำซ้ำ |
|---|---|---|
| 0.3.22 | Moodle Pre/Post Quiz จัดประเภทขัดแย้ง และ Google Drive วิดีโอ EBC411 อ่านเวลาไม่ได้ | จัดประเภทจาก title จริงก่อน override จากป้ายข้างเคียง |
| 0.3.23 | Direct Video Class links ใต้ image-only label ไม่ถูก collect | อ่าน URL ใน activity row จริง แม้ label OCR ไม่ได้; ไม่ดึงลิงก์ของรายการถัดไป |
| 0.3.24–0.3.26 | Moodle redirect, player lookup และ URL→duration reader ยังพลาด | ไล่ content→classifier→destination→provider probe→duration→report |
| 0.3.27 | Vidyard ไม่มี total clock ถาวร | อ่าน authoritative `length_in_seconds` หรือ `VidyardV4.players`, ไม่ใช้ timeline tooltip เป็น full duration |
| 0.3.28 | คำว่า `Pre record` ถูก early-branch จัดเป็น `recording` ก่อนคลาส `video` | context แบบ Pre-recorded ต้องไม่ถูกตีความเป็น LiveRecord โดย substring `record`; fixture EBC314 6/6 |
| 0.3.29–0.3.30 | รายงาน EN ยังมีข้อความระบบไทยปน | แปล **whole system sentence** และเก็บ source title/user authored text เดิม; test saved EBC211 PDF |

**สถานะความเชื่อมั่น:** §128 ผ่าน synthetic fixtures แต่กำหนดให้ทดสอบ Chrome จริงสองรายวิชาก่อนปิด Issue #1; §130 แก้ PDF/i18n ไม่ได้ปิด acceptance วิดีโอของ EBC314. อย่าอ้างว่า “แม่นยำ ≥90%” จากจำนวน unit tests เพียงอย่างเดียว

### Release integrity & checks

- §130: LL 0.3.30 — Archive ZIP 151 entries, 9,581,967 bytes, SHA-256 `781740c8655805965b9ed5cd8370a435cc3e06f045c92a4779e6f824b8dddac5`; regression 50/50, 104 JS/module syntax checks ผ่านตามบันทึกใน Archive
- แยก **patch overlay** รุ่น 0.3.23 จาก full ZIP; overlay ตัวเดียว **ติดตั้งเป็น Extension ไม่ได้** ต้องประกอบกับ source base ให้ถูก
- การแก้ LL ทุกรอบต้องรักษา Extension ID/ประวัติ Local, ตรวจ PDF ที่ Save แล้ว, ทั้ง TH/EN และไม่ไปแตะ Dashboard/Supabase/Main Data หากไม่ได้รับมอบหมาย

## Change log

- 2026-11-24 — แยก LL ด้วยบริบทจาก §§15–27, 48–56, 63, 66–67, 120–130; ไม่ย้าย Source/ZIP หรือเปลี่ยนผลตรวจ
