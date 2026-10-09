# SPU Learning Auditor Dashboard — Handoff & Knowledge Base

> Living handoff / บันทึกส่งต่องาน อัปเดต 9 ตุลาคม 2569 (2026-10-09)
> Repo: https://github.com/kafair-so/spu-learning-auditor-dashboard
> Branch: `main` | Frontend: https://kafair-so.github.io/spu-learning-auditor-dashboard/

## กติกาการทำงานต่อเนื่อง (Working Protocol) — ข้อบังคับสำหรับงานในโครงการนี้

**ก่อนเริ่มคำสั่งใหม่ทุกครั้ง**
1. อ่านไฟล์ Handoff ฉบับล่าสุดจาก `main` และตรวจ commit SHA ล่าสุดของ Repository (ไฟล์อาจถูกแก้โดยคนอื่น/แชทอื่นแล้ว)
2. เทียบกับคำสั่งใหม่และสถานะโค้ดจริง: สิ่งที่เสร็จแล้ว, ค้างอยู่, ยังไม่ตรวจยืนยัน, ปัญหา/ความเสี่ยง, และ deployment ที่ใช้งานจริง
3. อย่าเชื่อสถานะจาก Handoff เพียงอย่างเดียวเมื่อมีหลักฐานใหม่: เช็ก code, GitHub Actions, Supabase API และข้อมูลต้นทางตามความจำเป็น; บันทึกความขัดแย้งให้ชัดเจน
4. ไม่ทำซ้ำหรือย้อนการแก้ไขเก่าโดยไม่จำเป็น; ระบุขอบเขตงานก่อนแก้; ระวังไม่แตะข้อมูล production หรือ deploy backend โดยไม่จำเป็น

**หลังทำงาน/ได้ข้อสรุปใหม่ทุกครั้ง**
1. อัปเดต Handoff ใน `main` ให้สอดคล้องกับสิ่งที่เกิดขึ้นจริง (รวมทั้งกรณีแก้ไม่สำเร็จ หรือติดสิทธิ์)
2. บันทึกวันเวลา, คำขอ/ข้อสรุป, ไฟล์ที่เปลี่ยน, commit SHA, สถานะ test/deploy (สำเร็จ/ล้มเหลว/ยังไม่ตรวจ), ปัญหาคงค้างและ next steps
3. แยกสถานะ **ยืนยันแล้ว / รายงานจากผู้ใช้ / ข้อสันนิษฐาน / ยังไม่ตรวจ** เพื่อไม่ให้ข้อมูลคลาดเคลื่อน
4. หลีกเลี่ยงอ้างว่า deploy สำเร็จถ้าไม่มีหลักฐานจริง และรักษาประวัติของการตัดสินใจสำคัญไว้

กติกานี้เป็นแนวทางประจำโครงการ; เมื่อเริ่มแชทใหม่ ให้ผู้ใช้ส่งลิงก์ Repository หรือบอกให้เปิด Handoff ก่อนเริ่มงาน

## 1. เป้าหมาย
- เชื่อม OOE Dashboard, หลังบ้านผลตรวจ และ Supabase เป็นชุดข้อมูลรายวิชา GS/GR ปัจจุบันเดียวกัน
- ยึด **160 รายวิชาปัจจุบัน** ตามบัญชีรายวิชาเป้าหมาย (ต้องยืนยันจากแหล่งข้อมูลจริงทุกครั้งที่เปลี่ยนภาคเรียน)
- หน้าหลังบ้านและ Dashboard ต้องไม่แสดงผลตรวจของรายวิชานอกชุด active; แสดงผลล่าสุดหนึ่งชุดต่อรายวิชา; ประวัติย้อนหลังเก็บตามนโยบายระบบ
- ข้อมูลผลตรวจและหลักฐานต้องไม่ถูกลบเพื่อแก้เพียงปัญหาการแสดงผล

## 2. สถานะที่ยืนยันได้ / สิ่งที่ยังต้องตรวจ
- 2026-10-09 ผู้ใช้ยืนยันด้วยภาพว่าหน้าหลังบ้านมีผลตรวจแล้ว แต่แสดง **163 ผลตรวจ จาก 160 รายวิชา**; KPI ตามภาพ: ผ่าน 12, รอตรวจ 5, มีเนื้อหา 120, ไม่มีเนื้อหา 16, ตรวจไม่สำเร็จ 10 (รวม 163).
- ตัวเลข 163 ไม่ควรถูกตีความว่าเป็น 163 รายวิชา active โดยอัตโนมัติ; ต้องเปรียบเทียบ Course ID จริง
- Frontend commit `5d708694b031869f2d1e40884c0c1f70a812e720` ทำให้ `currentCatalogRecords()` ใน `audit-review.js` คืน `records` จาก API โดยตรง เพื่อลบ client-side identity filtering ที่เคยซ่อนข้อมูลทั้งหมด
- ผู้ใช้รายงานว่า Supabase Edge Function ถูก deploy แล้วและควรกรอง 160 active courses แต่ **โค้ดใน repo ณ เวลาตรวจยังไม่แสดงการกรอง active ใน `listAdminResults()`**; ห้ามสรุปว่าโค้ดที่ deploy จริงตรงกับ repo โดยไม่ตรวจ runtime
- สถานะ deploy ของ Supabase runtime, GitHub Pages และชุด Course IDs จริงต้องตรวจยืนยัน; ยังไม่มีหลักฐานว่ารายการส่วนเกิน 3 ตัวเป็นตัวใด

## 3. จุดโค้ดสำคัญ
- `audit-review.js` : `loadResults()` เรียก `AuditApi.adminResults()`; `render()` เรียก `currentCatalogRecords()` และแสดง KPI/table; `loadCourseCatalog()` โหลด CSV จาก Google Sheets
- `audit-api.js` : `adminResults() => GET /v1/admin/results`
- `supabase/functions/api/index.ts` : `listAdminResults(request)` query `audit_runs`, sort ล่าสุด, limit 5000, de-duplicate ด้วย Map keyed by `row.course_id`, **ยังไม่ join/filter `courses.active=true`** ใน source ที่ตรวจ
- `audit-bridge.js` : `identityKeys()` รองรับ Moodle Course ID, Course Profile, และ group+course code; ต้องระวังการจับคู่คลาดเคลื่อนและกรณีรหัสซ้ำข้ามกลุ่ม

### ข้อค้นพบเพิ่ม: catalog sync ไม่ de-activate รายวิชาที่ถูกถอดออก
- ใน `supabase/functions/api/index.ts` → `syncCatalog()` ทุกแถวที่อัปเดตจาก Sheet ถูกตั้ง `active: true` และ upsert แต่ไม่มีขั้นตอนตั้ง `active: false` สำหรับแถว `courses` ที่ไม่มีใน Sheet ล่าสุด
- ผลคือแม้แก้ `listAdminResults()` ให้กรอง `courses.active=true` ก็ **อาจยังได้เกิน 160** ถ้ายังมีรายวิชาเก่าที่ active ค้างอยู่
- แนวทางแก้ต้องทำทั้งสองฝั่งอย่างปลอดภัย: validate catalog (จำนวนไม่เป็นศูนย์, dedup course_id, group GS/GR), upsert สำเร็จครบ แล้ว deactivate แถวที่ไม่ได้อยู่ใน snapshot ที่ตรวจสอบแล้ว; จำกัด listAdminResults ตาม active courses; ตรวจ ID ที่หาย/เกินก่อน deploy
- ข้อควรระวัง: อย่า deactivate หลักสูตรทั้งระบบหาก CSV โหลดไม่สมบูรณ์หรือผิดกลุ่ม และอย่าลบ `audit_runs`

## 4. การแก้ปัญหา 163 vs 160 — ข้อควรทำตามลำดับ
1. ตรวจ Supabase ที่ deploy จริงว่า `/v1/admin/results` ส่ง 163 รายการหรือไม่ และแต่ละรายการมี `courseId` ใดบ้าง (requires authorized reviewer credentials; อย่าเผย token ลง chat/commit)
2. อ่านตาราง `courses` และบัญชีรายวิชาที่เป็นแหล่ง active จริง; เปรียบเทียบรายการที่ส่งกลับจาก API กับ course_id ของ 160 รายวิชา
3. หา Course IDs ของรายการนอกขอบเขต 3 รายการ (ถ้ามีจริง) รวมถึงตรวจ duplicate IDs, course profiles, course_group และ active flag
4. แก้ **backend query** ให้ใช้ active course scope เดียวกับคิวตรวจ/แดชบอร์ด (ไม่ลบ `audit_runs`); ดีที่สุดให้คืนผลล่าสุดหนึ่งผลต่อ active `course_id` เท่านั้น
5. แก้ frontend เฉพาะส่วนที่จำเป็นเพื่อแสดงจำนวนผลที่มีจาก 160 รายวิชาปัจจุบันโดยไม่ประดิษฐ์ผลตรวจที่ยังไม่มี; แยกชัดเจนระหว่าง “จำนวนรายวิชา” กับ “จำนวนผลตรวจ”
6. Test: จำนวน distinct courseId ในผล <=160, ทุก ID เป็น active, KPI sum=จำนวนผลที่แสดง, table/count/filter/export สอดคล้องกัน, ไม่มีการซ่อนข้อมูลผิดเงื่อนไข และผลรายวิชาที่ไม่มีผลตรวจยังคงเป็น no result
7. Commit/deploy frontend ผ่าน GitHub Pages; **backend Edge Function ต้อง deploy แยกอย่างชัดเจน** หากมีการแก้ `supabase/functions/api/index.ts`. ตรวจหลัง deploy จริงก่อนปิดงาน

## 5. ข้อควรระวัง
- ห้ามแก้ตัวเลข UI จาก 163 เป็น 160 แบบ hard-code, ตัด 3 รายการแรก/ท้าย, หรือสุ่มซ่อนผล
- ห้ามลบข้อมูล audit history หรือเปลี่ยนฐานข้อมูลเพื่อแก้แค่การแสดงผล
- ห้ามใช้ “160” เป็นจำนวนผลตรวจที่เกิดขึ้นจริง หาก 160 รายวิชายังตรวจไม่ครบ
- การกรองฝั่ง browser ไม่ใช่ security boundary; ขอบเขต active ควรบังคับจาก API และใช้ร่วมกันทุกหน้าจอ
- หาก CSV source โหลดไม่สำเร็จ ต้องแสดงข้อผิดพลาดและไม่รายงานจำนวน active ที่ยืนยันไม่ได้
- GitHub connector เคยเขียนไม่ได้ด้วย HTTP 403; หลัง reconnect แก้ `audit-review.js` และ commit ได้สำเร็จ
- ผู้ใช้ไม่มีโควต้า ChatGPT Work เหลือ; ใช้ GitHub Connector และขั้นตอน Deploy เท่าที่สิทธิ์อนุญาต

## 6. Repo และเอกสารอ้างอิง
- `README.md`, `AUDITOR-INTEGRATION.md`, `PRODUCTION-ARCHITECTURE.md`
- `audit-review.js`, `audit-api.js`, `audit-bridge.js`
- `supabase/functions/api/index.ts`
- Screenshot ล่าสุด: KPI 12+5+120+16+10=163, table text “163 ผลตรวจ จาก 160 รายวิชา”
- แหล่งข้อมูลใหม่ทุกครั้ง: git main ล่าสุด, API runtime, current catalog CSV, active course rows ใน Supabase

## 7. Prompt สำหรับเริ่มแชทใหม่
> อ่าน `SPU_AUDITOR_HANDOFF_KNOWLEDGE_BASE.md` ใน GitHub repo `kafair-so/spu-learning-auditor-dashboard` ก่อนเริ่มงาน ตรวจ main ล่าสุด และช่วยแก้ 163 ผลตรวจ vs 160 รายวิชาปัจจุบัน โดยเทียบ Course IDs จริงและแก้ active filter ที่ Supabase API อย่างปลอดภัย ไม่ hard-code ตัวเลข ไม่ลบ audit history ตรวจ Deploy จริง และอัปเดต Handoff ทุกครั้งที่แก้ระบบ

## 8. Change log
- 2026-10-09: ตรวจพบหลังบ้านแสดง 163 ผลตรวจ จาก 160 รายวิชา, source listAdminResults ยังไม่มี filter active, จัดทำ handoff และแผนพิสูจน์ความต่างก่อนแก้ไข

## 9. อัปเดต 2026-10-09 — จำกัดการตรวจและรายงานตาม 160 รายวิชาจากเอกสาร
**สถานะ: แก้ไข source + commit แล้ว / ยังไม่ได้ deploy Supabase / ยังไม่ได้ยืนยัน Course IDs บน Production**
- คำขอผู้ใช้: รายวิชาที่ไม่อยู่ในเอกสาร 160 วิชาต้องไม่ถูกนำเข้าคิวตรวจและไม่แสดงในรายงานผล ทั้งหลังบ้านและ Dashboard
- Commit Backend: `cfd2bc4743618abe2a17387d571dd9cb0c8d4944`; แก้ `supabase/functions/api/index.ts`
- `activeCatalogIds()` ดึง `courses.active=true` และ `course_group IN (GR,GS)` เพื่อกรองทั้ง `listAdminResults()` และ `publicResults()`
- `syncCatalog()` กรอง GS/GR, ตรวจ URL Course ID, ลดความเสี่ยง CSV ว่าง/ข้อมูลหายเกิน 20%, dedup ID และ upsert; หลัง upsert สำเร็จ จะปิด active สำหรับวิชาที่ไม่อยู่ใน catalog_version ล่าสุดและยกเลิกคิวที่ยัง queued สำหรับรายวิชาเหล่านั้น (ไม่ลบผลย้อนหลัง)
- ตอน worker claim มีด่านยืนยันว่า course ยัง active และอยู่ใน GR/GS; งานที่ไม่เข้าเกณฑ์จะถูกยกเลิกโดยไม่ส่งให้ Extension ตรวจ
- **ข้อจำกัด/งานค้าง:** GitHub commit ไม่ได้ deploy Supabase Edge Function อัตโนมัติ; ต้อง deploy function `api` ใน Supabase project ที่ใช้งานจริง และให้เกิดการ syncCatalog จากเอกสารล่าสุดอย่างปลอดภัยก่อนคาดหวังให้ active เหลือ 160
- ต้องเช็ก 160 unique Moodle Course IDs จาก CSV จริง, เปรียบเทียบ 3 ส่วนเกิน, ตรวจ jobs ที่กำลัง running ขณะ deploy (ไม่หยุดงาน running อัตโนมัติ), และตรวจผลจาก admin/public APIs หลัง deploy
- สำคัญ: หากบัญชีรายวิชาเปลี่ยนมากกว่า 20% ระหว่างเทอม การ sync จะหยุดพร้อม error และต้องทบทวน source ก่อนปรับ guard; อย่าปิด guard อย่างไม่ตรวจสอบ
- ตรวจ static source checks ของส่วนกรองและ worker guard ผ่าน แต่ยังไม่ได้ execute runtime tests หรือทดสอบฐานข้อมูลจริง
- งานต่อไป: ทดสอบ end-to-end กับ catalog + Supabase staging; deployment ด้วย Supabase Dashboard/CLI ในสิทธิ์ผู้ดูแล; verify active count=160, report count<=160, queued/running out-of-scope=0; อัปเดตผลจริงใน Handoff

## 10. อัปเดต 2026-10-09 — Supabase Production Deploy สำเร็จ (API v22)
**ยืนยันจาก Supabase Connector**
- Project: `SPU OOE Learning Auditor` (`nwupjnkotdkodyxnraie`), Edge Function `api` version **22**, status `ACTIVE`.
- Deploy ใช้ GitHub source `supabase/functions/api/index.ts` ณ commit `cfd2bc4743618abe2a17387d571dd9cb0c8d4944` และ dependency จาก function production เดิม `file3.ts` (แปลง import จาก `./audit-quality.mjs` ไป `./file3.ts`); คง `verify_jwt=false` เช่นเดิม เพราะ function มี custom auth logic. ไม่ได้ deploy GitHub Pages รอบนี้
- ก่อน deploy พบ `courses.active = true` สำหรับ GS/GR = **160**, `audit_runs` มี 163 distinct course IDs; รายวิชานอกชุด 3 ตัวซึ่ง active=false คือ `20194 / ICT24167`, `20248 / ICT12267`, `21148 / ICT308`; เก็บ audit history ไว้
- หลัง deploy SQL ตรวจ: `active_courses=160`, `visible_audited_courses=160`, `excluded_audited_courses=3`, `out_of_scope_pending=0`; Edge Function status ACTIVE version 22
- **ยังไม่ยืนยันด้วยการเรียก HTTP endpoint ผ่าน session ผู้ดูแลจริง** ว่าหน้าเว็บแสดง 160 และ KPI นับถูกต้อง; ให้ผู้ใช้รีเฟรช `audit-review.html` แล้วตรวจ Dashboard พร้อมกัน
- ตรวจพบ security advisories ของ Supabase เดิมที่ไม่เกี่ยวกับ scope นี้ (โดยเฉพาะ SECURITY DEFINER grants); ยังไม่ได้แก้ในรอบนี้ เพื่อไม่กระทบงาน production
- สิ่งที่ต้องติดตาม: ปุ่ม syncCatalog จะ sync จาก CSV และ deactivate รายวิชาหลุดชุด; ห้ามเริ่มคิวหาก CSV ไม่ถูกต้อง, เกณฑ์ shrink 20% จะบล็อกการลดจำนวนครั้งใหญ่; ตรวจผลหลัง sync และแจ้งปัญหา

## 11. อัปเดต 2026-10-09 — UI Loading State & Micro-interactions
**สถานะ: GitHub commit แล้ว; ยังต้องตรวจ GitHub Pages และหน้าเว็บด้วยบัญชีจริง**
- ผู้ใช้แจ้งว่าการ์ด KPI แสดง 0 ระหว่างโหลดผลตรวจ ทำให้เข้าใจผิดว่าไม่มีข้อมูลหรือระบบขัดข้อง และต้องการหน้าเว็บดูมี Movement มากขึ้น
- Commit `ce3660ff7b6f220d8e4d4762814d3c714792bc56` แก้เฉพาะ `audit-review.js` (ไม่มีการเปลี่ยน Supabase หรือหลักเกณฑ์คะแนน)
- เพิ่ม `resultsState` และ `hasLoadedResults`; ก่อนโหลดครั้งแรก แสดง skeleton บน KPI/ตารางพร้อมข้อความโหลด แทนเลข 0; เมื่อสำเร็จจึง render ผลจริง
- หากโหลดครั้งแรกล้มเหลว แสดงขีด — และข้อความ error; หากอัปเดตข้อมูลล้มเหลวหลังเคยโหลดสำเร็จ คงค่าเดิมพร้อมข้อความแจ้ง ไม่ล้าง KPI เป็น 0
- เพิ่ม animation fade/slide, hover card lift, button feedback และ `prefers-reduced-motion` เพื่อลดการเคลื่อนไหวสำหรับผู้ที่ตั้งค่าไว้
- การตรวจแบบ static หลัง commit: ตรวจพบ loading/error/ready/skeleton/reduced-motion/render guard ใน source ทุกจุด; ยังไม่ได้ทดสอบจริงใน Browser หรือยืนยัน GitHub Pages deploy
- งานต่อ: ทดสอบเวลาโหลดช้าหรือ network offline, refresh/retry, dark mode, mobile view, และทบทวน UX สำหรับหน้า Dashboard สาธารณะ/หน้าคิวอื่นหากผู้ใช้ต้องการให้สอดคล้องกัน
