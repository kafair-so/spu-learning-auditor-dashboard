# SPU Learning Auditor Dashboard — Handoff & Knowledge Base

> Living handoff / บันทึกส่งต่องาน อัปเดต 9 ตุลาคม 2569 (2026-10-09)
> Repo: https://github.com/kafair-so/spu-learning-auditor-dashboard
> Branch: `main` | Frontend: https://kafair-so.github.io/spu-learning-auditor-dashboard/

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
