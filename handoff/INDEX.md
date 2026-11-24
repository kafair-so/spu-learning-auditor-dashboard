# SPU Learning Auditor — Handoff Index

> สถานะเอกสาร: **Migration baseline 24 พ.ย. 2569** จาก Handoff เดิมถึง §130 และ Source ใน `main` ณ Commit `b1813af93b45`  
> **ไม่ใช่การรับรองเวอร์ชันที่ติดตั้งบนเครื่อง หรือสถานะ production ปัจจุบัน**: ทุกครั้งที่ทำงานต้องตรวจ Source/Release/CI/Runtime ล่าสุดก่อน

## Quick start — ต้องอ่านอะไรไม่ให้ข้อมูลคลาดเคลื่อน

**Handoff แต่ละฉบับมีรายละเอียดปฏิบัติที่คัดออกมาจาก Archive เพิ่มแล้ว**: Policy snapshots, historical release/test evidence, regression fixtures, safety/rollback gates และงานเปิดค้าง. แต่ต้องอ่าน `source` รุ่นที่ใช้จริงก่อนทุกครั้ง โดยเฉพาะ DB/LC ที่เคยเก็บ ZIP ในเครื่อง Local ไม่ใช่ใน GitHub ทั้งหมด.

`DB/LC/DL/LL` **ห้ามแชร์ตัวเลขเกณฑ์หรือภาคเรียนโดยอัตโนมัติ**: DB/LC current ในเอกสารรุ่น 0.13.34/0.13.27 = 80/110 + mandatory; DL 1/2569 theory 70/100 practical 40/50; LL legacy ระบุ 70/100/40/50 ในประวัติช่วงหลัง. รายละเอียดอาจเปลี่ยนใน runtime; ให้ถือ source+policy+scope เป็นตัวตัดสิน ไม่ใช้ข้อความสรุปนี้แทน code.

## เริ่มงานจากตรงนี้

โครงการนี้แยก Handoff ตาม **สายพัฒนา (track)** ไม่ใช่แยกเลข release ทุกตัว และแยกมาตรฐานการตรวจออกจากเกณฑ์ให้คะแนนของแต่ละสาย

| เอกสาร | เจ้าของเรื่อง / ขอบเขต |
|---|---|
| [Shared Core](HANDOFF_SHARED_CORE.md) | พฤติกรรมที่ควรนำไปใช้ร่วมกัน: course parsing, classifier, media reader, instructor evidence, error semantics, parity และ acceptance |
| [Web Platform](HANDOFF_WEB_PLATFORM.md) | GitHub Pages, Admin/User evidence, Dashboard, APIs, Auth, Supabase, Sheets, Sync, i18n และธีม |
| [DB — Dashboard](HANDOFF_DB.md) | Extension Dashboard สายเกณฑ์ปัจจุบัน; เกณฑ์/รุ่น/issue/ทดสอบเฉพาะ DB |
| [LC — Local Current](HANDOFF_LC.md) | Local Current; ความสามารถออฟไลน์/การออกผล/เกณฑ์เฉพาะ LC |
| [LL — Local Legacy](HANDOFF_LL.md) | Local Legacy; legacy criteria, GN, PDF, local releases และ issue เฉพาะ LL |
| [DL — Dashboard Legacy](HANDOFF_DL.md) | Dashboard Legacy; คิวกลาง/GR 1/2569/legacy_12569 และ integration ในสาย DL |
| [Master Archive — สำเนาต้นฉบับ](HANDOFF_MASTER_ARCHIVE.md) | สำเนา **ตรง Git Blob ทุกไบต์** จากไฟล์ก่อนย้าย; อ่านประวัติย้อนหลัง |
| [Legacy entrypoint เดิม](../SPU_AUDITOR_HANDOFF_KNOWLEDGE_BASE.md) | คงไฟล์เดิมและลิงก์เก่าทั้งหมดไว้โดยไม่แก้ไข; **หยุดใช้เป็นจุดบันทึกงานใหม่** |

## สถานะเวอร์ชันที่มีหลักฐาน ณ วัน Migration

| สาย | เวอร์ชันที่มีบันทึกอ้างอิง | ระดับการยืนยัน |
|---|---|---|
| DB | **0.13.34** ใน §70–75 | เป็นรุ่นสุดท้ายที่ระบุ **โดยชื่อ DB โดยตรง** ใน Archive; ไม่รับรองว่าคือรุ่นติดตั้ง/รุ่นปัจจุบัน |
| LC | **0.13.27** ใน §70 | เป็นรุ่นสุดท้ายที่ระบุโดยชื่อ LC โดยตรง; Source/ZIP อยู่ในเครื่องเดิมตาม Archive; ไม่ได้ตรวจเครื่องจริง |
| LL | **0.3.30** ใน §130 (23 พ.ย. 2569) | บันทึก Build/ZIP และ test ใน Archive; ยังมี live acceptance EBC314 ค้าง |
| DL | **0.13.39** ใน §114 / `downloads/dashboard/0.13.39/release.json` | ยืนยันไฟล์ Release ใน GitHub และ Source ที่เก็บไว้; **ไม่เท่ากับ** ยืนยัน Chrome ปัจจุบัน |

การเรียก DB/DL มีแหล่งโค้ด Dashboard ร่วมและช่วงประวัติที่เรียก “Dashboard” ไม่ชัดว่า track ใด: **ให้ตรวจเกณฑ์และ `criteria_mode` ก่อนจัดเรื่องเข้า DB หรือ DL** และห้ามนำ `0.13.39` ไปอ้างเป็น latest DB โดยอัตโนมัติ

## ขั้นตอนบังคับก่อนและหลังทำงาน

1. อ่าน **Index + Handoff สายที่ทำงาน + Shared Core**; ถ้าแตะ API/เว็บ/DB/Sheet ต้องอ่าน Web Platform เพิ่ม
2. ยืนยัน Branch SHA ล่าสุด, รุ่น/manifest/ไฟล์ที่ใช้งานจริง, เงื่อนไขรายวิชา, scope (`DB/LC/LL/DL`, `GR/GS/GN`, ภาคเรียน และ `criteria_mode`) ก่อนแก้
3. แยกสถานะ **ยืนยันใน Source**, **ผ่าน automated test**, **Deploy สำเร็จ**, **ทดสอบใน Chrome/Moodle จริง**, **ผู้ใช้รายงาน**, **ยังไม่ยืนยัน** ออกจากกัน
4. แก้เฉพาะสายที่ร้องขอ; เมื่อเป็นความสามารถร่วม เพิ่มรายการ/การประเมินผลกระทบใน [Shared Core](HANDOFF_SHARED_CORE.md) และตัดสินการรับไปใช้ของแต่ละสายทีละราย
5. หากแก้ Web/Backend ให้บันทึก [Web Platform](HANDOFF_WEB_PLATFORM.md) และลงหมายเหตุความเข้ากันได้ของทั้ง 4 สายเมื่อเกี่ยวข้อง
6. **ทุกครั้งที่มีการแก้ไขหรือข้อค้นพบ** ให้เพิ่มบันทึกใน Handoff เจ้าของเรื่อง: เวลา, ปัญหา, สาเหตุ, Source/Commit, test, Deploy/runtime, ผลต่อคะแนน/ข้อมูล, rollback, ปัญหาคงค้างและ next task
7. อัปเดต Matrix/รายการค้างใน Shared Core **เมื่อความสามารถร่วมเปลี่ยนจริง**; อัปเดต Index **เฉพาะเมื่อมีการเปลี่ยนเวอร์ชัน/โครงสร้าง/สถานะสำคัญ**
8. ห้ามอ้างว่าซิงก์ Main Data สำเร็จจากการบันทึกลง Supabase อย่างเดียว ต้องอ่านค่าการ Sync ที่ยืนยันแล้ว

## ขอบเขตเรื่องและที่บันทึก (Ownership)

- **ตัวตรวจจับหลักฐาน/Media/Quiz/ผู้สอน**: track ที่แก้เป็นเจ้าของ + Shared Core สำหรับผลกระทบข้าม track
- **คะแนน/เกณฑ์/ผ่อนปรน/โครงสร้าง pass gates**: Handoff ของ track เท่านั้น; Shared Core เก็บเพียง interface และ guardrails
- **Admin/User evidence, PDF delivery endpoint, REST/DB/Sheets/Auth/Sync, TH/EN, Dark/Light**: Web Platform; ข้อกำหนด export ของ Extension บันทึกที่ track ด้วย
- **ทดสอบย้อนหลังว่าคะแนนหาย/ผลผ่าน→ไม่ผ่าน**: track เจ้าของเกณฑ์ พร้อม Web Platform ถ้าเกี่ยวกับการเผยแพร่หรือ sync
- เรื่องที่ยังไม่แน่ชัดว่า track ใด ให้ติดป้าย **UNCLASSIFIED — NEEDS SOURCE CHECK** ไม่คัดลอกตามคำว่า Dashboard/Local อย่างเดียว

## Migration manifest — บันทึกอ้างอิงต้นทาง

- Archive exact Git Blob: `d8b63cd96eec9434aeb8100504f569f0e294ac5e` จาก `SPU_AUDITOR_HANDOFF_KNOWLEDGE_BASE.md` ที่ `b1813af93b45ae0cddad29499d9778371085fa57`; **ไม่ได้คัดลอกผ่านข้อความที่อาจถูกตัดทอน**
- เก็บ `SPU_AUDITOR_HANDOFF_KNOWLEDGE_BASE.md` เดิมไว้ byte-identical เพื่อไม่ทำลิงก์เดิมที่อ้างหัวข้อเก่าเสีย
- แบ่งภาพรวมประวัติเดิม: §1–14 ระบบกลาง/เว็บ; §15–27 LL และ Apps Script; §47–75 ความสามารถร่วม + DB/LC/LL; §76–119 ส่วน Web/DL และผลตรวจ; §120–130 LL (มีการข้ามลำดับหัวข้อ §47/§48 ในไฟล์จริง)
- **ข้อจำกัดที่พบในต้นฉบับ:** ระหว่างปลาย §27 ถึงต้น §49 มีข้อความ `…22531 tokens truncated…` ฝังในไฟล์เดิม จึงไม่สามารถถือว่าประวัติ §28–46 สมบูรณ์ได้จาก Archive ฉบับนี้; ให้กู้จาก Git history ถ้าจำเป็น **ห้ามเติมขึ้นเอง**. §57 ไม่ปรากฏเป็นหัวข้อระดับ `##` ในเนื้อหาที่อ่านได้
- Migration นี้สร้างเอกสารจัดหมวดและข้อกำหนดการทำงานเท่านั้น **ไม่เปลี่ยน Extension, score, API, database, queue หรือข้อมูล Google Sheets**

## Change log

- 2026-11-24 — เพิ่มข้อมูลปฏิบัติจาก Archive: policy/เวอร์ชันที่มีหลักฐาน, test/ZIP/checksum, regression guard และข้อห้ามข้าม track; Source-grounded enrichment commit `2200787f6e2d`. สถานะดังกล่าวเป็น historical baseline ไม่ได้ยืนยัน runtime วันนี้

- **2026-11-24 — Handoff separation:** ตั้ง Shared Core + Web Platform + DB/LC/LL/DL + Index; สำรอง Archive เป็น Blob เดิม; เก็บ entrypoint เดิม; ระบุ parity ที่ยังต้องตรวจแทนการอ้างว่ารองรับเท่ากันแล้ว

- **2026-11-24 — Handoff folder organization:** ย้าย INDEX, Shared Core, Web Platform, DB/LC/LL/DL และ Master Archive เข้า `handoff/` (รวม 8 ไฟล์); รักษา Archive Blob SHA `d8b63cd96eec9434aeb8100504f569f0e294ac5e`, รักษาเอกสารประวัติเดิมที่ root และเพิ่ม root INDEX redirect เพื่อรองรับลิงก์เก่า. แก้ README และ relative links ครบ; เป็น documentation-only ไม่เปลี่ยนตัวตรวจหรือคะแนน.
