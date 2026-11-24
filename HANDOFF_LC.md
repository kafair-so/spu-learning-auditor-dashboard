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

## Change log

- 2026-11-24 — แยก Handoff สาย LC; รุ่นที่อ้างเป็น **last documented** ไม่ใช่ verified latest runtime
