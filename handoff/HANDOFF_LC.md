# Handoff — LC / Local Current

> สถานะเอกสาร: **Migration baseline 24 พ.ย. 2569** จาก Handoff เดิมถึง §130 และ Source ใน `main` ณ Commit `b1813af93b45`  
> **ไม่ใช่การรับรองเวอร์ชันที่ติดตั้งบนเครื่อง หรือสถานะ production ปัจจุบัน**: ทุกครั้งที่ทำงานต้องตรวจ Source/Release/CI/Runtime ล่าสุดก่อน

> **LC = Local Current** — เป็น Extension/Workflow ฝั่ง Local ที่ใช้ current criteria; ไม่ใช่ LL หรือ DL

## ขอบเขต

- Local workflow, local result/export, current rule set และ local release/testing
- เมื่อแก้ Parser ให้ยึด capability contract ใน [Shared Core](HANDOFF_SHARED_CORE.md) แต่รักษา output/storage และ scoring ของ LC
- ไม่กำหนดให้ LC ใช้ Supabase queue หรือ Main Data outbox แบบ Dashboard หากไม่มี source รองรับ

## Baseline ณ Migration

- Archive §69: **Local 0.13.26** ปรับระบบตรวจให้สอดคล้องกับ Dashboard 0.13.33 (ต้องตรวจ source ก่อนยืนยันความเหมือนจริง)
- Archive §70: **LC 0.13.27**, บันทึก tests 39/39, ZIP hash และการตัดแผนครั้งที่ 1 ออกจากข้อกำหนดร่วมกับ DB
- Archive §47: backport parsers จาก Legacy สู่ Dashboard และ Local โดย **ไม่** ยก rubric Legacy 100/80 ไปปะปน
- Source/ZIP LC ในเอกสารอ้าง path เครื่อง Windows; ยังไม่พบ LC 0.13.27 source tree แยกชัดใน GitHub `main` ที่อ่านในรอบ Migration จึงไม่อ้างเวอร์ชัน live

## Guardrails

- Rubric current คือเจ้าของ LC; `legacy_12569` และเกณฑ์ผ่อนปรนเทอมเก่าไม่ถูกนำมาใช้โดยปริยาย
- ลิงก์/ชื่อไฟล์/ข้อมูลผู้สอนและ Pre/Post อาจพัฒนาร่วมกับ DB, LL, DL ได้ในระดับ reader แต่ reviewer decisions ต้องไม่ทับผลก่อนหน้า
- Local และ Dashboard มีขั้นตอนส่งผลต่างกัน — แยก UI/queue/source data transport

## งานถัดไป

- [ ] ระบุ source, artifact, SHA-256 และ version ของ LC จากเครื่องหรือ Git release ล่าสุด
- [ ] ทดสอบ LC current criteria รวม T/L/P, Moodle Quiz, PDF/non-PDF, video access และ instructor
- [ ] สร้าง contract test LC output ให้เทียบกับ shared normalized evidence ได้โดยไม่เปลี่ยนคะแนน
- [ ] ประเมินว่าการแก้ LL `0.3.30` เรื่อง EN report และ EBC314 media mapping ควร backport เฉพาะ reader/renderer หรือไม่


## Operational baseline — Local Current (LC)

**การให้คะแนนที่มีหลักฐานใน Archive ณ §69:** Current LC รุ่น 0.13.26 อ้างเกณฑ์ GR/GS แบบเดียวกับ Dashboard 0.13.33 คือคะแนนขั้นต่ำ **80/110** พร้อม mandatory gates. Theory ต้องมีแผน/เอกสาร/วิดีโอครบตาม session ที่บังคับ และ Pre/Post 2–15; Practical แต่ละองค์ประกอบต้องผ่านอย่างน้อย 7 ครั้ง (§69). ต่อมา **LC 0.13.27 (§70) ตัดแผนครั้งที่ 1 ออกจากข้อบังคับ**. กติกาเหล่านี้เป็น snapshot ของ Source ตอนนั้น ไม่ใช่การยืนยัน current runtime วันนี้

### Version milestones and source provenance

| รุ่น | งานสำคัญ | สถานะใน Handoff เดิม |
|---|---|---|
| 0.13.19 | รับ shared parser จาก LL 0.3.x พร้อม AI Tutor; คง local storage/export และ current 110/80 | §47: test 36/36, ZIP สร้างแล้ว, ยังไม่เผยแพร่ในรอบนั้น |
| 0.13.26 | sync parser/mandatory gates กับ Dashboard 0.13.33 แต่แยก local result และ Central queue | §69: test 39/39, ZIP 9,359,372 bytes, SHA-256 `95AFF513F7EC7A7B6297212312B474BF534CE2E7D0236712A976CC564BDA76A0` |
| 0.13.27 | ปรับ Session 1 lesson plan rule ร่วมกับ DB 0.13.34 | §70: test 39/39, ZIP 9,359,663 bytes, SHA-256 `6BDA6F6BAD02ABB34A487D0E07607B35BB0C526C0398237950A7C5DFA145E8C7` |

**คำสั่งกันงานคลาดเคลื่อน:** ห้ามอ้างว่า LC 0.13.27 มีคะแนน legacy 100/70, ไม่นำ `legacy_12569` หรือ GR 1/2569 เข้าเกณฑ์ LC. หากพบแต่ไฟล์ Dashboard Legacy 0.13.39 ห้ามใช้แทน Source LC; ต้องขอ/ตรวจ ZIP หรือเครื่องที่ติดตั้ง LC จริงก่อนแก้

### LC-specific regression / acceptance

- [ ] แยก Local export/result storage จาก Central Worker, Supabase API และ Main Data Sync ให้ชัด
- [ ] ทดสอบ Course ID/Profile, T/L, Moodle Quiz vs Assignment, case ที่ชื่อผิดและป้ายภาพกำกับ
- [ ] ทดสอบ AI Tutor trusted provider กับ external chat; ห้ามนับหน้าประชาสัมพันธ์ provider เป็น AI Tutor ที่ใช้งานได้
- [ ] ตรวจ required gates 80/110 และ session-1 exception ตาม version จริง; เทียบกับ DB ด้วย fixture ชุดเดียวกันแต่คนละ adapter
- [ ] ถ้าปรับ media/ชื่อผู้สอนจาก LL ให้ทดสอบผลเก่าทั้งผ่านและไม่ผ่านก่อน accept backport
- [ ] บันทึก file path, manifest version, ZIP hash, full tests, Chrome acceptance และ rollback ต่อครั้งในไฟล์นี้

## Change log

- 2026-11-24 — เพิ่มข้อมูลปฏิบัติจาก Archive: policy/เวอร์ชันที่มีหลักฐาน, test/ZIP/checksum, regression guard และข้อห้ามข้าม track; Source-grounded enrichment commit `2200787f6e2d`. สถานะดังกล่าวเป็น historical baseline ไม่ได้ยืนยัน runtime วันนี้

- 2026-11-24 — แยก Handoff สาย LC; รุ่นที่อ้างเป็น **last documented** ไม่ใช่ verified latest runtime
