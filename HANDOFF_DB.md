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


## Operational baseline — ก่อนแตะ Source/คะแนน DB

| ประเด็น | เงื่อนไขที่บันทึกในประวัติ | หลักฐาน |
|---|---|---|
| ระบบให้คะแนน | Current Dashboard รุ่น 0.13.33: คะแนนภายในขั้นต่ำ **80/110** และต้องผ่านองค์ประกอบบังคับพร้อมกัน | §68; ก่อนเปลี่ยนทุกครั้งต้องตรวจ scoring function ของ DB ที่ใช้งาน |
| ทฤษฎี | แผน/เอกสาร/วิดีโอล่วงหน้าครบตาม session ที่บังคับ; Pre/Post ตรวจ session 2–15; §70 เปลี่ยนให้ **ไม่นับแผนครั้งที่ 1 เป็นข้อบังคับ** | §§68,70; ห้ามเอา rule §68 ไปใช้เดี่ยว ๆ โดยไม่อ่าน §70 |
| ปฏิบัติ | แผน เอกสาร วิดีโอ Pre และ Post แต่ละรายการต้องผ่านอย่างน้อย 7 ครั้ง ไม่จำเป็นต้องเป็น 7 ครั้งชุดเดียวกัน | §68 |
| วิดีโอ | การอ่านเวลา/เงื่อนไขผ่อนปรนตามหน่วยกิตและช่วง session มีพัฒนาการใน §68; ต้องยืนยันว่าเกณฑ์ยังเป็น **current** ที่ DB ใช้จริง | §68, source ในรุ่นที่รันจริง |
| Podcast/AI Tutor | มี logic เฉพาะในการตรวจและยืนยัน; §72 ระบุ Podcast 10 นาทีและการกรอกเวลาจากผู้ตรวจ | §§47,61,71–73 |
| Reviewer | ผลยืนยันเก่าผูกกับ evidence signature; หากปลายทางเปลี่ยน ห้าม reuse decision | §§58,60,65,73 |
| การเผยแพร่ | manifest, download-version label, ชิ้นส่วน ZIP, SHA-256 และหน้าเว็บต้องเป็นเวอร์ชันเดียวกัน | §§62,70–75 |

**อย่านำ current 80/110 เท่ากับ legacy theory 70/100:** ทั้ง denominator, gating และ session-1 exceptions ต่างกัน. ก่อนแก้ไขคะแนน DB ให้เลือก policy จาก actual installed source/criteria ไม่ใช่ข้อความใน DL หรือ LL

### Historical verified test/release milestones (ไม่ใช่ production snapshot วันนี้)

- **0.13.22**: backport Moodle/AI Tutor classifier ไป DB ร่วมกับ LC 0.13.19; test Dashboard 36/36; Archive §47 ระบุ ZIP มี hash แต่ยังไม่เผยแพร่ในรอบนั้น
- **0.13.28–0.13.32**: instructor complete, reviewer decision reuse, duplicate QR/image safeguard, media validation; §§58–67 ต้องตรวจว่าชุด code ของ current ยังคงใช้รายละเอียดใด
- **0.13.33**: required-criteria gates + unit-based video rules; test 38 ไฟล์ตาม §68 และหน้าโหลดที่เผยแพร่ในเวลานั้น
- **0.13.34**: session-1 lesson-plan exception (§70), Podcast follow-up (§§71–72) และ acknowledgment (§73). §70 บันทึก ZIP ขนาด 9,360,081 bytes และ SHA-256 `AB5FBAD939C744A4FEDE5A40B241136B95FF78208A8D19A7C70AA7C091BB0F1F` — เป็น **artifact ที่ระบุในประวัติ** ไม่ยืนยันว่าไฟล์นั้นยังเป็น production version
- หากมีข้อกำหนดใหม่ที่เรียก “Dashboard” อย่างเดียว ให้ตรวจว่าเป็น DB current หรือ DL legacy ก่อนย้ายข้อมูลมาที่นี่

### DB acceptance checklist / fail-safe

- [ ] ตรวจ manifest, Source SHA, ZIP SHA และ runtime version; ห้ามเลือก latest จากชื่อโฟลเดอร์ `dashboard` อย่างเดียว
- [ ] นับคะแนน current จาก fixture อิสระ ทั้ง theory/practical + mandatory gates, ผัง session 1 และ 2–15
- [ ] แยก `duration_read` กับ `duration_unreadable`; วิดีโอเปิดได้ไม่ได้แปลว่ามีเวลาครบเกณฑ์
- [ ] ตรวจ reviewer decisions เก่า/ใหม่ เทียบผลล่าสุดและประวัติ; ห้ามเปลี่ยนผลผ่าน→ไม่ผ่านจาก regression โดยไม่มีคำอธิบาย
- [ ] ถ้ามีการส่ง Supabase/Sheets ให้ตรวจ Web Platform + outbox ก่อนอ้างว่าเผยแพร่ผลครบ

## Change log

- 2026-11-24 — เริ่ม Handoff สาย DB ด้วยข้อมูลเฉพาะที่ Archive ยืนยัน; ไม่มีการเปลี่ยน Source หรือ Deploy
