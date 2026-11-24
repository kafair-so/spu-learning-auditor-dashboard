# Handoff — DB / Dashboard Current

> สถานะเอกสาร: **Migration baseline 24 พ.ย. 2569** จาก Handoff เดิมถึง §130 และ Source ใน `main` ณ Commit `b1813af93b45`  
> **ไม่ใช่การรับรองเวอร์ชันที่ติดตั้งบนเครื่อง หรือสถานะ production ปัจจุบัน**: ทุกครั้งที่ทำงานต้องตรวจ Source/Release/CI/Runtime ล่าสุดก่อน

> **DB = Dashboard** สาย current; อย่าสับสนกับ **DL = Dashboard Legacy** ที่ใช้กลไกหน้าเว็บ/แหล่งโค้ดบางส่วนร่วมกัน

## ขอบเขต

- Dashboard Extension ที่ใช้เกณฑ์/การตัดสิน **current** (แยกจาก `legacy_12569` ของ DL)
- การตรวจจับข้อมูล Moodle และ media ควรทำตาม [Shared Core](HANDOFF_SHARED_CORE.md) แต่การคำนวณคะแนนและ rubric ต้องยึดกฎ DB เท่านั้น
- User/Admin page, login, queue, API, Supabase, Sheets อยู่ใน [Web Platform](HANDOFF_WEB_PLATFORM.md); DB เก็บเฉพาะ export/compatibility ที่ Extension ต้องทำ

## Baseline ณ Migration

- รุ่น **DB 0.13.34** ระบุใน Archive §§70–75; ชุด Source/ZIP เคยอยู่ในเครื่องต้นทางตาม §70 (ไม่ยืนยันว่ารุ่นนี้เป็น latest installed)
- §70: DB/LC ตัดแผนการสอนครั้งที่ 1 ออกจากข้อกำหนดเฉพาะ current track; บันทึกว่าทดสอบ DB 38/38 ก่อนเผยแพร่
- §§71–73: DB Podcast input/10-min logic, reviewer acknowledgement and published download alignment
- §75: Admin/User ใช้ evidence source เดียวกันเพื่อป้องกันรายงานไม่ตรง
- ประวัติ Dashboard ที่ระบุไม่ชัดว่าเป็น DB หรือ DL (เช่น §§58–68) **ต้องตรวจไฟล์จริงและ mode ก่อนจัด ownership**
- ZIP/source ของ DB 0.13.34 ในประวัติอาจไม่ได้เก็บครบใน `main`; ไม่ใช้ `release-src/dashboard-0.13.39` เป็นหลักฐานว่า DB รุ่นนี้อัปเดตตาม DL แล้ว

## Rubric / guardrails

- แยก `current` scoring model ออกจาก `legacy_12569`, มาตรการผ่อนปรน 1/2569, theory 70 / practical 40 ซึ่งเป็นของ Legacy track
- ไม่ backport ข้อผ่อนปรน Moodle Quiz ของ DL แบบอัตโนมัติ
- ประเภทวิชา/Section/ผู้สอน/วิดีโอ/Podcast ที่อาจแชร์กติกาตรวจจับได้ ต้อง test ว่าไม่ทำคะแนนเดิมหาย

## รายการตรวจย้อนกลับ (Archive)

- §47 — shared parser backport Dashboard/Local
- §§58–62 — reviewer reuse, instructor evidence, SharePoint media, ZIP integrity (ต้องยืนยัน track)
- §§64–68 — assignment/text, instructor lazy image, credit-aware video (ต้องยืนยัน track)
- §§70–75 — DB-specific release/rules/evidence

## งานถัดไป

- [ ] ตรวจ DB source/manifest/ZIP ที่ใช้งานจริงและทำ link/version checksum inventory
- [ ] สร้าง independent regression test ของ DB current rules และ compare DL/LL shared reader
- [ ] ตรวจ Podcast handling, course-type boundary, first-session plan exception และ report export
- [ ] หากมีข้อแก้เชิง parser ใน DL/LL ให้ประเมิน parity ผ่าน Shared Core ไม่คัดลอกคะแนน/threshold ตามกัน

## Change log

- 2026-11-24 — เริ่ม Handoff สาย DB ด้วยข้อมูลเฉพาะที่ Archive ยืนยัน; ไม่มีการเปลี่ยน Source หรือ Deploy
