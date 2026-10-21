# SPU Learning Auditor Dashboard — Handoff & Knowledge Base

> Living handoff / บันทึกส่งต่องาน อัปเดต 19 ตุลาคม 2569 (2026-10-19)
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
5. **บริหารโควต้าเป็นข้อจำกัดสำคัญ:** รวมการอ่าน/ตรวจ/แก้/ทดสอบเป็นรอบ ลด tool call และงานซ้ำที่ไม่จำเป็น ใช้ผลเดิมที่ยืนยันแล้ว และสำรองโควต้าให้ผู้ใช้สนทนา ตรวจผล และแก้ไขงานต่อ ห้ามใช้โควต้าส่วนใหญ่กับคำสั่งย่อย 1–2 งานโดยไม่จำเป็น

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


## 12. อัปเดต 2026-10-19 — บังคับบันทึกงานทุกครั้งเพื่อส่งต่อข้ามเครื่อง
**สถานะ: ผู้ใช้กำหนดเป็นข้อตกลงถาวรของโครงการ / บันทึกใน GitHub แล้ว**

ผู้ใช้กำหนดให้ตั้งแต่งานนี้เป็นต้นไป ทุกคำสั่งที่เกี่ยวกับการทำงาน แก้ไข ตรวจสอบ ตัดสินใจ ทดสอบ หรือเผยแพร่ของ **SPU Learning Auditor Dashboard / Extension / Supabase / Google Sheets และระบบที่เชื่อมโยง** ต้องอัปเดตไฟล์ Knowledge Base นี้บน GitHub ด้วย เพื่อให้รับช่วงงานได้จากทุกเครื่องและทุกแชท

### ขั้นตอนบังคับ
1. ก่อนเริ่มงาน ให้อ่านไฟล์นี้จาก branch `main` และตรวจ source/commit ล่าสุดก่อนเสมอ
2. ระหว่างทำงาน ให้เก็บคำขอของผู้ใช้ เหตุผลในการตัดสินใจ ขอบเขตที่แตะ และสิ่งที่ตั้งใจไม่แตะ
3. หลังแต่ละงานที่มีสาระสำคัญ ให้อัปเดตไฟล์นี้ใน commit เดียวกับงาน หรือ commit ติดตามทันที ห้ามรอรวมหลายงานจนบริบทสูญหาย
4. รายการบันทึกขั้นต่ำต้องมี:
   - วันเวลาและคำขอของผู้ใช้
   - สิ่งที่ทำจริงและสิ่งที่ไม่ได้ทำ
   - ไฟล์/ระบบ/ฐานข้อมูลที่เปลี่ยน
   - รุ่น Extension/Dashboard และ commit SHA
   - ผลการทดสอบ พร้อมจำนวนชุดทดสอบ
   - สถานะ deploy แยก Frontend, Supabase และไฟล์ดาวน์โหลด
   - ผลกระทบต่อคิว ข้อมูล production และความเข้ากันได้ของ Local/Dashboard
   - ปัญหาคงค้าง ความเสี่ยง และ next steps
5. แยกสถานะให้ชัดว่า **ยืนยันแล้ว / ผู้ใช้รายงาน / อนุมาน / ยังไม่ตรวจ / ทำไม่สำเร็จ**
6. ห้ามบันทึก token, cookie, รหัสผ่าน, secret หรือข้อมูลส่วนบุคคลที่ไม่จำเป็นลง repository
7. หาก GitHub เขียนไม่ได้ ให้แจ้งผู้ใช้ตรงไปตรงมาและจัดทำข้อความอัปเดตพร้อม commit ที่ยังค้าง ห้ามกล่าวว่าอัปเดต Knowledge Base แล้ว
8. เมื่อย้ายเครื่องหรือเริ่มแชทใหม่ ให้ถือไฟล์นี้เป็นจุดเริ่มต้นหลัก แต่ยังต้องเทียบกับ source และ production จริงก่อนลงมือ

### บริบท ณ วันที่กำหนดข้อตกลง
- Shared chat ที่ใช้อ้างอิง: `https://chatgpt.com/s/cx_6ad0b12348f08191a48d8fedfa38fb15`
- จาก shared chat มีรายงานว่า Dashboard และ Local อยู่ที่รุ่น `0.13.15`; ต้องตรวจ source, release และ production จริงก่อนแก้ครั้งถัดไป
- Workspace ของเครื่องที่อ่านข้อตกลงครั้งแรกอาจเป็น source รุ่นเก่ากว่า จึงห้ามนำไฟล์เก่าทับ GitHub โดยไม่ sync/compare ก่อน


## 13. อัปเดต 2026-10-19 — Backfill ความคืบหน้าจาก Shared Chat (25 ก.ย.–15 ต.ค. 2026)
**แหล่งข้อมูล:** shared chat `https://chatgpt.com/s/cx_6ad0b12348f08191a48d8fedfa38fb15`, ประวัติ commit ใน GitHub และ source บน branch `main`  
**วัตถุประสงค์:** เติมประวัติงานช่วงที่ยังไม่ได้บันทึกลง Handoff เพื่อให้ย้ายเครื่องหรือเปลี่ยนแชทแล้วรับช่วงได้ โดยแยกสิ่งที่มีหลักฐานใน GitHub ออกจากคำรายงานและงานที่ยังต้องตรวจ production

### 13.1 ภาพรวมระบบและนโยบายที่ตกลงกัน
- ระบบประกอบด้วย Dashboard/Back Office, Extension (Dashboard และ Local), Supabase API/Database/Storage และบัญชีรายวิชา Google Sheets
- ใช้บัญชี Google Workspace `@spu.ac.th`; มีบทบาท Admin, Super Admin และ Owner สำหรับงานจัดการสิทธิ์ โดยไม่บันทึกข้อมูลส่วนบุคคลของผู้ถือสิทธิ์ลง Handoff
- ผลตรวจสาธารณะต้องเป็นแบบอ่านอย่างเดียวและแสดงผลล่าสุดของรายวิชา; เก็บผลย้อนหลังตามนโยบาย **ผลล่าสุด + ก่อนหน้า 2 ครั้ง (รวมไม่เกิน 3 รอบต่อรายวิชา)** โดยต้องไม่ลบหลักฐานที่เผยแพร่แล้วเพราะการตรวจใหม่ล้มเหลวหรือยังไม่สมบูรณ์
- คะแนนเต็ม 110 และผ่านที่ 80; คะแนนวิดีโอให้นับสูงสุดหนึ่งคะแนนต่อครั้งเรียน ไม่ใช่ต่อจำนวนคลิป
- ผลจาก Extension รุ่นเก่า, schema/สูตรเก่า หรือ scan ไม่ครบ ต้องเข้าสถานะรอตรวจและห้ามแทนผลเผยแพร่โดยอัตโนมัติ
- งานล้างหลักฐานที่ไม่ใช้งานควรเข้าคิว retry; ห้ามลบหลักฐานที่ยังถูกอ้างอิงโดยผลเผยแพร่

### 13.2 รายการที่ยืนยันได้จาก GitHub commits
#### ขอบเขตรายวิชาและคิวตรวจ
- `c2edc3200905fd3cd9fbc93e439b201c3891dad8` — ใช้เกณฑ์ GR/GS และตัดเฉพาะรายวิชาที่มี “อาจารย์พิเศษ” เป็นผู้สอนเพียงคนเดียว
- `fb514f66215c1668eeb89013f4e11cca3452effa` — ทำเกณฑ์ eligibility ของ Back Office ให้ตรงกัน
- `6db2837ca4be7a84a2a532e0ea53764ee33f0f3f` — ทำเกณฑ์ eligibility ของ Dashboard ให้ตรงกัน
- `0ff8885f42e0a3c5895b45ba94ea792f63a7267d` — รองรับแทนรายการ queued ด้วยขอบเขตที่ผู้ใช้เลือก โดยไม่ยกเลิกงานที่กำลัง running
- `c90a251018a558c202691c97fc2f806507bc407c` — จำกัด RPC สำหรับเปลี่ยนคิวให้เรียกผ่าน backend
- หลักการล่าสุดคือ **ห้าม hard-code จำนวน GR/GS**: เพิ่มรายวิชาใหม่ได้; หากจำนวนลดลงผิดปกติให้รอการยืนยันแทนการ deactivate อัตโนมัติ

#### รายงานสาธารณะและสถานะใน Google Sheet
- `4c2495d...`, `6f064ace...` — เพิ่มลิงก์รายงานรายวิชาแบบอ่านอย่างเดียว
- `40321b4...` — เปิด API/ข้อมูลรายงานที่เผยแพร่แล้วแบบ read-only
- `87c35cd...` และ `7beec264...` — แก้และ refresh client สำหรับ anonymous public report
- `23aa129...`, `393510d...`, `9d2398b...` — แสดงผลตรวจล่าสุดสำหรับรายวิชา active; รายวิชายังไม่มีผลต้องแสดง “ยังไม่มีผลตรวจ”
- `e776d8b3179f08573d1e8de9420f4518a1ad9f03` — sync สถานะผลตรวจกลับ Sheet ฝั่ง GR และเพิ่มการ reset สำหรับผู้ตรวจ
- จาก shared chat ระบุว่า tab `69/1-GR` ใช้คอลัมน์ R “ผลการตรวจรายวิชา” และสร้างลิงก์จาก course link สำหรับรายวิชาปัจจุบันและแถวใหม่; ต้องตรวจสูตร/automation จริงเมื่อเปลี่ยน Sheet

#### UX/UI, ภาษา และสิทธิ์
- `79e736163cc0f8996b2086e3b56d823f7251a8e8` — ปรับ Dashboard UI และเพิ่มภาษาไทย/อังกฤษ
- `f38884f86febe84e4c2481269daa33ff0bead980` — ปรับ controls และการมองเห็นสถานะ
- `6053f7f14234eae953c4059fd92d8ebb1eb793ce`, `f1ef8a35d76a3e1f015a21c3d6e9c6332bdae0bf`, `6df1e5559650ac292008c5c365c78e0a9a3ccc0d` — แก้ slider ภาษา/ธีมและการมองเห็นใน dark mode
- `878337921f7c97a593eacc29bc0e9fa9886667a6` — ปรับ dark controls, แปลข้อความเพิ่ม และรองรับ Owner access
- `68385811696b53b608de285523afb433a9c5a988` — รวมข้อแก้ไขที่ผู้สอนต้องทำเป็นรายการสั้นและชัดเจน
- `ddf3525b1d7489040f590d22d2b12bdb668241a4` — จำกัดรายละเอียด audit review สำหรับ Super Admin
- `0ac2dce360a3fb946caded9a0015d0669d366637` — ปรับสรุปคำแนะนำผู้สอนของ Dashboard 0.13.15
- แนว UX ที่ตกลง: Light/Dark, ไทย/อังกฤษ, สีสถานะอ่านง่าย, แยก “สิ่งที่ผู้สอนต้องแก้” ออกจาก “สิ่งที่ผู้ตรวจต้องยืนยัน”, แสดงสรุปก่อนรายละเอียด และไม่แสดงข้อมูลภายในทีมตรวจแก่ผู้ใช้ทั่วไป

#### รุ่นดาวน์โหลดและการแก้ผลตรวจ
- `4048c8cd02b3426bffaff01b6d5e37359db5d9f3` — แก้ลิงก์ดาวน์โหลด Extension
- `90e365a6375a4dd641c751ed144821f4530113b6` — เปลี่ยนไฟล์ดาวน์โหลด Dashboard เป็นรุ่น 0.13.15
- Repo root มีไฟล์ `SPU-Learning-Auditor-Dashboard-0.13.12.zip` และ `SPU-Learning-Auditor-Dashboard-0.13.15.zip`
- `40236e97af050c941df0dcdd521c0d5a1d856e39` — แก้ missing evidence state และการตรวจซ้ำรายวิชา

### 13.3 ความคืบหน้าที่รายงานใน Shared Chat แต่ต้องตรวจ runtime/source ล่าสุดอีกครั้ง
- มีรายงานว่า Dashboard และ Local อยู่ที่รุ่น `0.13.15` และชุดทดสอบผ่าน 33 tests ทั้งสองชุด; ขณะรับช่วงต้องหา source/package ของ Local และรัน tests ใหม่ก่อนอ้างเป็นสถานะปัจจุบัน
- มีรายงานว่า GitHub Pages ถูก deploy หลายรอบ แต่ backend Supabase ต้อง deploy แยกเสมอ; commit ของ frontend ไม่ได้ยืนยันว่า Edge Function production ใช้ source เดียวกัน
- OCR ถูกปรับแนวทางให้ตรวจโครงสร้างก่อน แล้วใช้ OCR เฉพาะ label รูปภาพที่กำกวม; OCR ล้มเหลวควรทำให้เฉพาะรายการนั้น “รอตรวจ” ไม่ใช่ทำให้ทั้งรายวิชาล้มเหลว
- Google Photos ถูกเพิ่มเป็นแหล่งวิดีโอ โดยพยายามอ่าน metadata/player/iframe duration หลังบ้านและ retry แบบ foreground ชั่วคราวเมื่อจำเป็น; album ว่างต้องไม่นับเป็นเนื้อหา
- Token/session หมดอายุควรหยุดอย่างปลอดภัย แจ้งให้ login ใหม่ และ resume คิวเดิมโดยไม่สร้างคิวซ้ำ; ยังต้องทดสอบงานยาวบน production
- Owner สามารถจัดการชื่อ/บทบาท, โอน Owner และจัดการ Super Admin ได้ตามรายงาน; ต้องตรวจ policy จริงก่อนแก้สิทธิ์ production

### 13.4 ข้อค้นพบเกี่ยวกับ catalog และจำนวนรายวิชา
- ช่วงหนึ่ง source ส่ง 140 active courses (GR 100 + GS 40) และระบบเคย deactivate GR 20 รายวิชาเพราะ shrink guard ยอมรับ 160 → 140
- ผู้ใช้ยืนยันเกณฑ์ที่ถูกต้องภายหลังว่าให้ตรวจ GR/GS ทุกวิชา ยกเว้นกรณีมี “อาจารย์พิเศษ” เป็นผู้สอนเพียงคนเดียว ดังนั้นเลข 120/40 หรือ 160 เป็น snapshot ไม่ใช่ค่าถาวร
- เมื่อ sync รอบใหม่: ต้องรายงานจำนวนเพิ่ม/ลด, รายการ Course IDs ที่เปลี่ยน, เหตุผล eligibility และหยุดรอยืนยันหากจำนวนลดลงผิดปกติ; ห้ามลบ audit history
- ตัวอย่างจาก shared chat เคยมีคิว GS 40 และอีกช่วงมี 43 งานคงเหลือ (queued 42 + running 1); ตัวเลขเหล่านี้เป็น snapshot ในอดีต ไม่ใช่สถานะคิวปัจจุบัน

### 13.5 งานที่ยังไม่ยืนยันหรือยังค้างจากท้าย Shared Chat
1. **แสดงรายชื่อวิชาจริงในคิว:** ท้ายแชทมีการแก้ `audit-review.js` และ `supabase/functions/api/index.ts` แต่ไม่พบข้อความยืนยัน test/deploy ขั้นสุดท้ายใน shared snapshot; ต้องเทียบ source ล่าสุดและตรวจ API production
2. **Google Drive folder ว่าง:** ต้องสรุป “ไม่มีเนื้อหา — พบลิงก์โฟลเดอร์ แต่ภายในไม่มีไฟล์วิดีโอ” เป็นสถานะสีแดงและไม่นับ; มีคำสั่งให้แก้แต่ยังไม่มีหลักฐานปิดงาน
3. **OCR background flow:** ต้องทดสอบกับรายวิชาจริงทั้ง Dashboard และ Local ว่าไม่ค้าง 90 วินาทีและไม่ทำให้ทั้งรายวิชาล้มเหลว
4. **Session refresh/resume:** ต้องจำลอง token หมดอายุระหว่างคิวจำนวนมากและยืนยันว่า login ใหม่แล้วทำต่อจากคิวเดิม
5. **Catalog หลังเหตุ 140 วิชา:** ต้องยืนยัน active GR/GS ปัจจุบันตามเกณฑ์ “อาจารย์พิเศษผู้เดียว” และตรวจว่า 20 วิชาที่เคยถูก deactivate ถูกคืนอย่างถูกต้องหากเข้าเกณฑ์
6. **Local 0.13.15 portability:** shared chat ระบุว่า Local ไม่ได้เผยแพร่บนหน้าเว็บ; ต้องระบุตำแหน่ง source/package ที่เชื่อถือได้หรือจัดเก็บในพื้นที่ควบคุม เพื่อส่งต่อข้ามเครื่องโดยไม่ใช้ไฟล์เก่าทับงานใหม่
7. **Supabase deployment:** การแก้ `supabase/functions/api/index.ts` หลัง API v22 ต้องตรวจ version/source บน production แยกจาก GitHub
8. **Google Photos diagnostics:** ต้องยืนยันว่าข้อความวินิจฉัยแยก “เปิดไม่ได้/ไม่มีสิทธิ์/album ว่าง/อ่านเวลาไม่ได้” ได้จริง ไม่ใช้ข้อความรวมที่ทำให้ผู้สอนแก้ไม่ถูกจุด

### 13.6 ขั้นตอนรับช่วงงานครั้งถัดไป
1. อ่าน Handoff นี้และ fetch `main` ล่าสุด; เปรียบเทียบ commit หลัง `40236e97...` และหลัง commit ของ Handoff นี้
2. ตรวจ version จาก source, manifest และไฟล์ ZIP ทั้ง Dashboard/Local; ห้ามเชื่อเลขรุ่นจากชื่อไฟล์เพียงอย่างเดียว
3. รันชุดทดสอบที่มีอยู่และบันทึกจำนวน test จริง แยก Dashboard/Local/backend
4. ตรวจ GitHub Pages deployment และ Supabase Edge Function production แยกกัน
5. ตรวจ catalog/queue ด้วย Course IDs จริงและเกณฑ์ eligibility ล่าสุดก่อนสั่ง sync หรือ replace queue
6. ปิดงานค้างในข้อ 13.5 ทีละรายการ พร้อม commit, tests, deploy evidence และอัปเดต Handoff ทันที

### 13.7 บันทึกการอัปเดตรอบนี้
- คำขอผู้ใช้: ให้อัปเดต GitHub Handoff ตามความคืบหน้าจาก shared chat ก่อนเริ่มงานอื่น
- สิ่งที่ทำ: อ่านและสรุปประวัติจาก shared chat, เทียบกับ Handoff และ GitHub commits, เพิ่ม section 13 พร้อมแยกหลักฐาน/คำรายงาน/งานค้าง
- สิ่งที่ไม่ได้ทำ: ไม่แก้ source code, ไม่ deploy GitHub Pages/Supabase, ไม่แก้คิวหรือข้อมูล production และไม่อ้างว่างานที่ไม่มีหลักฐาน deploy สำเร็จแล้ว


## 14. อัปเดต 2026-10-19 — ปิดงานแสดงรายชื่อวิชาจริงในคิวตรวจ
**สถานะ: Source + GitHub Pages + Supabase production สำเร็จ / ยังไม่ได้ทดสอบ endpoint ด้วย reviewer session จริง**

### คำขอและการรับช่วง
- ผู้ใช้สั่งให้อ่านงานล่าสุดจาก Handoff และทำงานค้างต่อ โดยให้ใช้แท็บภายในในการตรวจสอบ
- ตรวจจาก GitHub ผ่าน in-app browser และเทียบ source บน `main` พบว่างานข้อ 13.5(1) ยังไม่ปิดจริง: `queueOverview()` ส่งเพียงจำนวน, current job และ recent 8 รายการ; หน้า Audit Control Center ไม่มีรายชื่อวิชาทั้งหมดที่ queued/running

### สิ่งที่แก้
- `supabase/functions/api/index.ts`
  - เพิ่ม `pending` ในผล `GET /v1/admin/jobs/overview` โดยคืนเฉพาะงาน queued/running ของรายวิชา active
  - payload มี Course ID, รหัส/ชื่อ/กลุ่มวิชา, สถานะ, kind, priority และเวลา; ไม่เพิ่มข้อมูลผู้สอนหรือข้อมูลรับรอง
  - เรียงงานที่กำลังตรวจขึ้นก่อน แล้วเรียง queued ตาม priority และเวลาสร้างเพื่อให้รายการคงที่
  - Commit `05061060017f214c42fc195638037328239a7ea4`
- `audit-review.js`
  - เพิ่มส่วน “รายวิชาในคิวปัจจุบัน” แสดงทุกวิชาที่ API ส่งมา พร้อมรหัส ชื่อ กลุ่ม สถานะ และเวลาสร้าง/เริ่มตรวจ
  - รายการมีพื้นที่ scroll, responsive mobile และสีที่อ่านได้ใน dark mode
  - Commit `a961e2a8cf06249d8fbead982779de8c99ea3756`
- `ui-i18n.js`
  - เพิ่มคำแปลอังกฤษสำหรับหัวข้อ สถานะโหลด ชื่อวิชาไม่ทราบ และ empty state
  - Commit `93fe21f96d3d914af1ec456ce3c8e0b4a71a8610`
- `audit-review.html`
  - bump cache key เป็น `ui-i18n.js?v=20261019a` และ `audit-review.js?v=20261019a`
  - Commit `768a1940969df3ab37019b5588317f365b9d88f0`
- เพิ่ม `tests/queue-overview.test.mjs` ครอบคลุม API payload, UI list, dark/mobile, English และ cache keys
  - Commit `a866c1255d618d898bcf352c360b1c6bcd9fc3f4`

### การตรวจสอบและ Deploy
- Static regression checks กับ source ล่าสุดผ่าน **6/6** และ JavaScript parse check ของ `audit-review.js` / `ui-i18n.js` ผ่าน
- GitHub Actions/Pages ตรวจจาก in-app browser: run `#85` (`39223344223`) **completed successfully**
- Supabase Edge Function `api` deploy production จาก GitHub source ล่าสุดพร้อม `audit-quality.mjs`: version **32**, status **ACTIVE**, `verify_jwt=false` คงค่าเดิมเพราะ function ใช้ custom reviewer authentication
- ตรวจ source ของ function v32 หลัง deploy พบ `pending` แล้ว
- Query production แบบ read-only หลัง deploy: `queued_jobs=160`, `running_jobs=0`, `active_courses_in_queue=160`, `out_of_scope_jobs=0`
- ไม่ได้แก้ schema, RLS, ข้อมูลคิว หรือผลตรวจ; deployment เปลี่ยนเฉพาะ response ของ queue overview

### ข้อจำกัดและงานถัดไป
- ยังไม่ได้เรียก `/v1/admin/jobs/overview` ด้วย reviewer session จริงใน browser เพราะ in-app tab ไม่มี session ผู้ดูแล; ให้ผู้ใช้ login แล้วเปิดหน้า “ระบบตรวจ” เพื่อตรวจว่าเห็นรายชื่อ 160 วิชาและเลื่อนดูได้ครบ
- หากหน้าที่ยังเปิดอยู่ไม่เห็นส่วนใหม่ ให้ hard refresh หนึ่งครั้งเพื่อรับ cache key `20261019a`
- งานค้างลำดับถัดไปจากข้อ 13.5: Google Drive folder ว่างต้องไม่นับเป็นเนื้อหา, OCR background flow, session refresh/resume, catalog หลังเหตุ 140 วิชา, Local 0.13.15 portability และ Google Photos diagnostics


## 15. อัปเดต 2026-10-19 — สร้าง SPU Learning Auditor Local Legacy 0.1.0 จาก Local 0.13.16
**สถานะ: ยืนยัน source และ automated tests ในเครื่อง / สร้าง ZIP ใน workspace แล้ว / ยังไม่ได้อัปโหลด ZIP หรือ source รุ่น Legacy ขึ้น GitHub / ไม่ได้ deploy ระบบปัจจุบัน**

### คำขอและขอบเขต
- ผู้ใช้ต้องการรุ่น Local แยกสำหรับตรวจรายวิชาเก่า ไม่รวมกับ Extension เกณฑ์ปัจจุบัน
- ใช้ไฟล์ต้นทางที่ผู้ใช้ระบุใน `C:\Users\Administrator\Downloads\SPU-Learning-Auditor-Local-0.13.16.zip` (9,330,043 bytes) เป็นฐาน; เก็บต้นฉบับไว้ ไม่แก้ทับ
- รองรับเฉพาะ GR/GS, 15 ครั้ง; AI Tutor และ Podcast ไม่เป็นองค์ประกอบบังคับ; Moodle Quiz นับได้; ไม่มีคะแนน; ต้องผ่านองค์ประกอบบังคับครบทั้งหมดจึงผ่าน
- ผู้ใช้สั่งเพิ่มการผ่อนปรนเวลาวิดีโอ GR/GS เป็น **20 นาที** (แทนเกณฑ์เดิมประมาณ 10 นาที)
- ผู้ใช้กำชับให้บริหารโควต้าเป็นข้อจำกัดสำคัญ จึงเพิ่มเป็น Working Protocol ด้านบน: รวมงานเป็นรอบ ลดคำสั่งซ้ำ และสำรองโควต้าสำหรับการสนทนา/ทดสอบ/แก้ไขต่อ

### สิ่งที่ยืนยันแล้วใน source Local Legacy
- ชื่อ Extension: `SPU Learning Auditor — Local Legacy`; version `0.1.0`; rubric `GR/GS-LEGACY-COMPLETENESS-1.0`
- แยกโฟลเดอร์จากรุ่นปัจจุบัน: `spu-learning-auditor-local-legacy-0.1.0-from-0.13.16`
- หน้า Queue ให้เลือกเฉพาะ GR/GS; catalog import กรองเฉพาะ GR/GS
- ตัด Podcast และ AI Tutor ออกจาก checklist, งานรอยืนยัน, unresolved blockers และรายการที่เปิดตรวจปลายทางเบื้องหลัง
- Checklist ครั้งที่ 1 มี: ข้อมูลรายวิชา, ข้อมูลผู้สอน, เอกสารประกอบ, วิดีโอ, กิจกรรมท้ายบท
- Checklist ครั้งที่ 2–15 มี: แผนการสอน, เอกสารประกอบ, วิดีโอ, Pre-test, Post-test และกิจกรรมท้ายบท (ถ้ามี)
- Moodle Quiz ที่ถูกจัดประเภท Pre/Post นับในแถวนั้น; ordinary Moodle Quiz นับเป็นกิจกรรมท้ายบทได้ โดยไม่ให้นับซ้ำ Pre/Post
- ผลรวมเป็น `complete / required / missing / pending`; `not_applicable` ไม่นับเป็นองค์ประกอบบังคับ; มี pending จะเป็น “ต้องตรวจทาน”; มี fail จะ “ไม่ผ่าน”; ผ่านเมื่อ required ทั้งหมดผ่าน
- ลบ UI ส่งออก Dashboard จากรุ่น Legacy เพื่อไม่ปะปนกับ Dashboard/Supabase เกณฑ์ปัจจุบัน
- ปรับ `RULES.GR.toleranceMinutes` และ `RULES.GS.toleranceMinutes` เป็น `20`; มากกว่า 20 นาทีที่ขาดยังไม่ผ่าน
- เพิ่ม/แก้เอกสาร `README.md`, `RELEASE-NOTES.md` และเพิ่ม `legacy-policy.js`

### การทดสอบและ Artifact
- คำสั่ง: `node --test tests/*.test.mjs`
- ผลล่าสุด: **37/37 test files ผ่าน, 0 fail** รวม stress test 900 วิชา / 162,000 activities
- เพิ่ม `tests/legacy-policy.test.mjs` และปรับ regression tests ให้ตรงนโยบาย Legacy/Moodle Quiz/ไม่มีคะแนน/ผ่อนปรน 20 นาที
- ZIP ที่สร้างในเครื่อง:
  `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.0.zip`
- ขนาดล่าสุด: 9,319,808 bytes
- SHA-256: `904DE57D2A88D4E462F6838DBBAE58079FDEE0AD88259E5AA8DCF93D89AFD3BF`

### สิ่งที่ยังไม่ยืนยัน / งานถัดไป
- ยังไม่ได้ Load unpacked และทดสอบกับรายวิชาเก่าจริงใน Chrome; automated tests ไม่แทน live acceptance test
- ยังไม่ได้อัปโหลด ZIP หรือ source Local Legacy ขึ้น GitHub เพราะรอบนี้สร้าง artifact ใน workspace; การย้ายเครื่องต้องนำ ZIP ไปเก็บใน GitHub Releases/download storage ก่อน
- ไม่ได้แก้/deploy Dashboard, GitHub Pages, Supabase Edge Function, schema, catalog หรือคิว production
- รุ่นเกณฑ์ปัจจุบัน 0.13.16 ไม่ถูกแก้; การผ่อนปรน 20 นาทีรอบนี้ใช้กับ Local Legacy เท่านั้น


## 16. อัปเดต 2026-10-20 — Local Legacy 0.1.1: เกณฑ์วิดีโอและ Podcast ตามลักษณะวิชา
**สถานะ: แก้ source / ทดสอบอัตโนมัติ / สร้าง ZIP ใน workspace แล้ว / ยังไม่ได้อัปโหลด ZIP หรือ source ขึ้น GitHub / ยังไม่ได้ทดสอบกับรายวิชาจริงใน Chrome**

### ข้อกำหนดล่าสุด (ใช้แทนข้อความเรื่อง Podcast ในข้อ 15)
- ผู้ใช้กำหนดให้เกณฑ์นี้ใช้กับรายวิชา **ทุกประเภทที่ Local Legacy รองรับ** คือ GR และ GS
- ผู้ใช้ต้องเลือกลักษณะวิชาเป็น **ทฤษฎี** หรือ **ปฏิบัติ** ก่อนเข้าคิวตรวจ
- วิดีโอและ Podcast ต้องผ่าน **ครบคู่กันในครั้งเรียนเดียวกัน**
- วิชาทฤษฎีต้องมีคู่สื่อผ่านครบ **15 ครั้ง**
- วิชาปฏิบัติต้องมีคู่สื่อผ่านอย่างน้อย **7 ครั้ง**
- ยังคงประเมินแบบองค์ประกอบครบ/ไม่ครบ ไม่ใช้คะแนน 80/110; AI Tutor ยังไม่อยู่ในเกณฑ์ Legacy
- การผ่อนปรนเวลาวิดีโอ GR/GS **20 นาที** จากข้อ 15 ยังคงเดิม

### สิ่งที่แก้ใน Local Legacy 0.1.1
- เพิ่ม Podcast กลับเข้า checklist ครั้งที่ 1 และครั้งที่ 2–15 และเปิดการตรวจปลายทาง/การยืนยันเวลาของ Podcast
- เพิ่มตัวเลือกลักษณะวิชาในหน้าคิวสำหรับ GR/GS ทุกวิชา; import catalog อ่านค่า `gnTrack`, `track` หรือคอลัมน์ `ลักษณะวิชา` และใช้ทฤษฎีเป็นค่าเริ่มต้น
- เพิ่ม aggregate media coverage: นับเฉพาะครั้งที่วิดีโอและ Podcast ผ่านพร้อมกัน; ทฤษฎี 15/15 และปฏิบัติอย่างน้อย 7/15
- แยกเกณฑ์สื่อออกจากการนับองค์ประกอบรายแถว เพื่อไม่ให้วิชาปฏิบัติที่ผ่านครบ 7 ครั้งถูกบังคับให้ผ่านสื่ออีก 8 ครั้ง
- เมื่อวิชาปฏิบัติครบขั้นต่ำแล้ว สื่อที่ยังรอตรวจในครั้งส่วนเกินไม่ขวางการยืนยันผล
- รายงานแสดงตารางความครอบคลุมวิดีโอ/Podcast, ลักษณะวิชา, จำนวนครั้งที่ผ่าน และผลรวม พร้อมคำแนะนำอาจารย์แบบ aggregate
- เพิ่ม Podcast ในตัวกรองหลักฐาน และ final-review blockers เฉพาะกรณีที่ยังมีผลต่อเกณฑ์
- อัปเดต README, Release Notes, manifest description และ version เป็น `0.1.1`

### การทดสอบและ Artifact
- Automated test files ผ่าน **34/34**, 0 fail
- ตรวจ syntax JavaScript ระดับไฟล์ด้วย `node --check` ผ่าน
- ZIP:
  `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.1.zip`
- ขนาด: **9,321,434 bytes**
- SHA-256: `D1F8C0070C72DDFF006374276A1CDB5CDA2B02307A767803EB97ECF5C49A07FF`

### สิ่งที่ยังไม่ยืนยัน / งานถัดไป
- ยังไม่ได้ Load unpacked และทดสอบ acceptance กับรายวิชาเก่าจริงใน Chrome โดยเฉพาะ GR/GS ทฤษฎีและปฏิบัติ
- ยังไม่ได้อัปโหลด ZIP/source Local Legacy 0.1.1 ขึ้น GitHub หรือ Releases
- ไม่ได้แก้รุ่นเกณฑ์ปัจจุบัน 0.13.16, Dashboard, Supabase, catalog production หรือคิว production


## 17. แก้ไขข้อ 16 — Local Legacy 0.1.2 นับเฉพาะวิดีโอ (2026-10-20)
**สถานะ: ใช้ข้อนี้แทนข้อ 16 ทั้งหมดสำหรับ Local Legacy / source แก้แล้ว / tests ผ่าน / สร้าง ZIP ใน workspace / ยังไม่ได้ live test หรืออัปโหลด GitHub**

### การแก้ความเข้าใจ
- ผู้ใช้ชี้แจงว่าข้อกำหนดวิดีโอและ Podcast ที่กล่าวก่อนหน้าเป็นแนวทางสำหรับ **Extension เกณฑ์ปัจจุบันในงานภายหลัง** ไม่ใช่ Local Legacy
- งานปัจจุบันต้องทำตัวตรวจ **เกณฑ์เก่า** ให้เสร็จก่อน
- ดังนั้น Local Legacy ต้อง **ไม่นับ Podcast** และ **ไม่นับ AI Tutor**
- Artifact 0.1.1 ในข้อ 16 เป็นฉบับชั่วคราวที่ตีความผิดและ **ห้ามนำไปใช้งาน/ส่งต่อ**

### เกณฑ์ที่ถูกต้องของ Local Legacy 0.1.2
- รองรับ GR และ GS
- ผู้ตรวจเลือก `ทฤษฎี` หรือ `ปฏิบัติ` ในหน้าคิว
- เกณฑ์จำนวนครั้งใช้กับ **วิดีโอเท่านั้น**
  - ทฤษฎี: วิดีโอต้องผ่านครบ 15 ครั้ง
  - ปฏิบัติ: วิดีโอต้องผ่านอย่างน้อย 7 ครั้ง
- Podcast และ AI Tutor ถูกตัดออกจาก checklist, unresolved blockers, งานรอตรวจ และรายการที่ระบบเปิดปลายทางเบื้องหลัง
- Moodle Quiz ยังนับเป็น Pre-test, Post-test หรือกิจกรรมท้ายบทตามประเภท
- ยังไม่คิดคะแนน; ต้องผ่านองค์ประกอบบังคับและเกณฑ์จำนวนครั้งของวิดีโอ
- ผ่อนปรนเวลาวิดีโอ GR/GS ได้ไม่เกิน 20 นาทีตามข้อกำหนดก่อนหน้า
- วิชาปฏิบัติที่วิดีโอผ่านครบ 7 ครั้งแล้วไม่ถูกบังคับให้ผ่านวิดีโออีก 8 ครั้ง

### การทดสอบและ Artifact
- Automated test files ผ่าน **34/34**, 0 fail
- JavaScript `node --check` ผ่าน
- ZIP:
  `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.2.zip`
- ขนาด: **9,321,245 bytes**
- SHA-256: `D26B277921BE1ED82D3D850EB08EA7B11B5C0A2D555C8EA0482CFFD7BCF8EEF3`

### งานถัดไป
- Load unpacked และทดสอบกับรายวิชาเก่าจริงอย่างน้อย GR/GS ทฤษฎีและปฏิบัติ
- ยังไม่ได้อัปโหลด ZIP/source 0.1.2 ขึ้น GitHub หรือ Releases
- ยังไม่ได้แก้เกณฑ์วิดีโอ+Podcast ใน Extension รุ่นปัจจุบัน; เก็บเป็นงานแยกหลัง Local Legacy ผ่าน acceptance test


## 18. Known issue — Post-test ใน Moodle Chat ไม่ถูกจัดประเภทเมื่อคำถามภาษาไทยเขียนติดคำ (2026-10-20)
**สถานะ: วินิจฉัยสาเหตุแล้ว / ยังไม่แก้ source**

- ตัวอย่างที่พบในครั้งที่ 4 เป็น Moodle Chat ชื่อขึ้นต้น `Post-test` และมีข้อความ `...นโยบายอย่างไรเพื่อส่งเสริม...`
- scanner เก็บ Moodle activity ชนิด Chat ได้อยู่แล้ว และ classifier รองรับ Pre/Post ใน Chat/Page
- สาเหตุอยู่ที่ `questionInTitle` ใน `classifier.js`: คำบอกคำถามภาษาไทย เช่น `อย่างไร` ต้องตามด้วยช่องว่าง, จบข้อความ หรือเครื่องหมายคำถาม
- ในรายการนี้คำว่า `อย่างไรเพื่อ` เขียนติดกัน จึงไม่ผ่านเงื่อนไข question title; generic Moodle Chat จบเป็น `other` แทน `post_quiz`
- ยืนยันด้วยการทดสอบตรงจากชื่อในภาพ: Pre-test ได้ `pre_quiz`; Post-test ได้ `other`; `POST_PATTERN` จับคำว่า Post-test ได้ แต่ `questionInTitle` เป็น false
- แนวทางแก้ที่เสนอ: เมื่อชื่อมี Pre-test/Post-test ชัดเจน ให้คำถามภาษาไทย (`อย่างไร/อะไร/เพราะเหตุใด/ทำไม/ข้อใด/เท่าไร`) จับได้แม้คำถัดไปเขียนติดกัน และเพิ่ม regression test ของข้อความจริงนี้
- ยังไม่ได้แก้หรือแพ็ก Local Legacy รุ่นใหม่ในรายการนี้ เพราะผู้ใช้ถามหาสาเหตุเท่านั้น


## 19. แก้ Post-test ใน Moodle Chat/Page — Local Legacy 0.1.3 (2026-10-20)
**สถานะ: แก้ source / regression test / full automated tests / สร้าง ZIP แล้ว / ยังไม่ได้ live acceptance test**

### การแก้ไข
- ปรับ `questionInTitle` ใน `classifier.js` ให้คำบอกคำถามภาษาไทย `อย่างไร/อะไร/เพราะเหตุใด/ทำไม/ข้อใด/เท่าไร` ใช้ได้แม้เขียนติดคำถัดไป
- เงื่อนไขนี้ใช้ร่วมกับชื่อ Pre-test/Post-test ที่ชัดเจน จึงไม่เปลี่ยนข้อความทั่วไปให้เป็นแบบทดสอบโดยไม่มีป้ายประเภท
- กรณีจริง `Post-test ... นโยบายอย่างไรเพื่อส่งเสริม...` ใน Moodle Chat เปลี่ยนจาก `other` เป็น `post_quiz`
- เพิ่ม regression test ด้วยชื่อเต็มจากรายการจริงในครั้งที่ 4
- เกณฑ์ Local Legacy 0.1.2 เดิมยังคงเดิม: นับเฉพาะวิดีโอ 15/7 ครั้ง; Podcast และ AI Tutor ไม่นับ

### การทดสอบและ Artifact
- `tests/classifier.test.mjs` ผ่าน
- Automated test files ผ่าน **34/34**, 0 fail
- JavaScript `node --check` ผ่าน
- ZIP:
  `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.3.zip`
- ขนาด: **9,321,717 bytes**
- SHA-256: `7A2D8A4A24CE04FBFBFEA57999C5DCC980CE99396AEADDD2B42614501ECF7A42`

### งานถัดไป
- Load unpacked 0.1.3 แล้วตรวจรายวิชาเดิมอีกครั้งเพื่อยืนยันว่า Post-test ครั้งที่ 4 แสดงเป็นผ่าน
- ยังไม่ได้อัปโหลด ZIP/source 0.1.3 ขึ้น GitHub หรือ Releases


## 20. Pre/Post จากชื่อ ป้าย และคำสะกดผิด — Local Legacy 0.1.4 (2026-10-20)
**สถานะ: แก้ source / tests ผ่าน / สร้าง ZIP แล้ว / ยังไม่ได้ live acceptance test**

### กฎจำแนกที่ใช้
- ไม่มีป้าย: ใช้ชื่อรายการที่ระบุ Pre/Post หรือแบบทดสอบก่อน/หลังเรียน
- มีป้าย: คำถามทั่วไปนับเป็น Pre/Post ได้เมื่อป้ายเป็น local/adjacent/visual label ของรายการใน Section เดียวกัน
- ป้ายที่เป็น inherited label จากรายการก่อนหน้าไม่สามารถเปลี่ยนคำถามทั่วไปให้เป็น Pre/Post
- หากชื่อและป้ายเฉพาะรายการขัดกัน ให้ป้ายเฉพาะรายการเป็นตัวแก้ประเภท (รักษาพฤติกรรมเดิม)
- คำถามที่ไม่มีชื่อหรือป้าย Pre/Post ไม่ถูกเดาเป็นแบบทดสอบ เพื่อป้องกันกิจกรรมท้ายบทถูกนับผิด

### การป้องกันคำสะกดผิด
- เพิ่ม `assessmentTitleKind()` ใน `rules.js`
- รองรับคำอังกฤษบริเวณต้นชื่อที่คลาดเคลื่อนหนึ่ง edit (รวม transposition) เช่น `Pre-tset`, `Postest`
- รองรับชื่อไทย `แบบทดสอบก่อนเรียน/หลังเรียน` ที่คลาดเคลื่อนหนึ่ง edit เช่น `แบบทดสอบกอนเรียน`
- จำกัด fuzzy matching ไว้ที่ต้นชื่อและเป้าหมายเฉพาะ เพื่อลด false positive

### Regression tests
- Post-test จริงที่มี `อย่างไรเพื่อ...` ยังผ่าน
- `Pre-tset Week 4` -> `pre_quiz`
- `Postest Week 4` -> `post_quiz`
- `แบบทดสอบกอนเรียน ครั้งที่ 4` -> `pre_quiz`
- คำถามทั่วไปใต้ local Post-test label -> `post_quiz`
- คำถามทั่วไปใต้ inherited Post-test label -> `other`
- คำถามทั่วไปไม่มีชื่อ/ป้าย -> `other`
- Automated test files ผ่าน **34/34**, 0 fail; JavaScript `node --check` ผ่าน

### Artifact
- `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.4.zip`
- ขนาด: **9,322,472 bytes**
- SHA-256: `8988EA89430054AE47446DCB522EC1D86213E9AA95CF2640990C950F083DA087`
- ยังไม่ได้อัปโหลด ZIP/source 0.1.4 ขึ้น GitHub หรือ Releases


## 21. แก้ Pre/Post ภายใน Moodle ถูกพบแต่ไม่ผ่าน — Local Legacy 0.1.5 (2026-10-20)
**สถานะ: แก้ source / tests ผ่าน / สร้าง ZIP แล้ว / รอ live acceptance test**

### สาเหตุ
- 0.1.4 จำแนก Post-test ใน Moodle Chat เป็น `post_quiz` ได้แล้ว
- แต่ `presentQuiz()` ยังให้ผ่านเฉพาะ `/mod/quiz/`, Resource/Assignment, question title บางรูปแบบ, assessment text หรือ external link
- ข้อความ `อย่างไรเพื่อ...` ยังติด boundary เดิมในขั้นสรุปผล จึงตกไปที่ `presentExternal()` และกิจกรรม Chat ภายใน Moodle ถูกตัดเป็น fail

### การแก้ไข
- ปรับ question detector ใน `presentQuiz()` ให้รองรับคำไทยเขียนติดกันเช่น `อย่างไรเพื่อ...`
- เมื่อ classifier ยืนยัน `pre_quiz/post_quiz` จากชื่อหรือ local label แล้ว ให้ Moodle module ภายใน เช่น Chat/Page นับผ่านได้ ไม่จำกัดเฉพาะ Quiz module
- ยังคงไม่เดาคำถามทั่วไปเป็น Pre/Post: การเข้าถึงเส้นทางนี้ต้องถูก classifier จัดเป็น `pre_quiz/post_quiz` ก่อน
- เพิ่ม regression test: Moodle Chat ชื่อ `Post-test ... อย่างไรเพื่อ...` ต้องทำให้แถว Post-test ผ่าน

### การทดสอบและ Artifact
- `tests/review-recalculation.test.mjs` ผ่าน
- Automated test files ผ่าน **34/34**, 0 fail
- JavaScript `node --check` ผ่าน
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.5.zip`
- ขนาด: **9,322,906 bytes**
- SHA-256: `022C3AF4979D58482C86F6BC35F45C24ECD37CBDAE578667C80200B0E8AE251A`
- ยังไม่ได้อัปโหลด ZIP/source 0.1.5 ขึ้น GitHub หรือ Releases


## 22. Known issue — ป้าย Post-test รูปภาพตามด้วยไฟล์ DOCX ไม่ถูกนับ (2026-10-20)
**สถานะ: วินิจฉัยสาเหตุแล้ว / ยังไม่แก้ source**

- โครงสร้างที่พบ: ป้ายรูปภาพ `Post-test` ตามด้วย Moodle Resource/File ชื่อ `แบบทดสอบ ครั้งที่ 2: ...` ปลายทาง `Quiz 2.docx` และลิงก์ Google Drive สำหรับ Assignment
- ชื่อไฟล์ไม่มีคำ `Post-test` หรือ `หลังเรียน` จึงไม่ผ่านเส้นทางจำแนกจากชื่อเพียงอย่างเดียว
- `collectAssessmentPillEvidence()` ใน `content.js` จับป้ายภาพ Pre/Post ไปยังเฉพาะโมดูล `/mod/quiz/` หรือ `/mod/assign/`; Moodle Resource/File ถูกกรองออก
- resource classifier จึงคงรายการเป็นเอกสาร และรายงานนำ DOCX ไปผ่านหัวข้อเอกสารประกอบการสอนแทน ขณะที่ Post-test แสดงว่าไม่พบ
- Google Drive รายการถัดไปมีคำ Assignment จึงถูกนับเป็นกิจกรรมท้ายบท ไม่ใช่ Post-test
- แนวทางแก้ที่ปลอดภัย: ขยายการจับคู่ป้าย Pre/Post เฉพาะรายการถัดไปใน Section เดียวกันให้รองรับ Resource/File/Page/Chat/URL เมื่อชื่อมีสัญญาณแบบทดสอบ/คำถาม และหยุดที่ป้ายหมวดถัดไป; ห้ามเหมารวมไฟล์ทุกชนิดใต้ป้าย


## 23. ป้ายภาพ Pre/Post ครอบคลุมไฟล์และกิจกรรม Moodle — Local Legacy 0.1.6 (2026-10-20)
**สถานะ: แก้ source / tests ผ่าน / สร้าง ZIP แล้ว / รอ live acceptance test**

### สาเหตุเดิม
- ตัวจับคู่ป้ายภาพ Pre-test/Post-test รับเฉพาะ Moodle Quiz และ Assignment
- กรณีป้าย `Post-test` ตามด้วย Moodle Resource/File ชื่อ `แบบทดสอบ ครั้งที่ 2...` ปลายทาง `Quiz 2.docx` จึงไม่รับประเภทจากป้าย
- ชื่อไฟล์ไม่มีคำ Post-test/หลังเรียน ทำให้ถูกจำแนกเป็นเอกสารประกอบการสอนแทน

### การแก้ไข
- ให้ป้ายภาพ Pre-test/Post-test เป็นหมวดของกิจกรรม Moodle รายการแรกที่อยู่ถัดลงมาใน Section เดียวกัน
- รองรับ Resource/File, Page, Chat, URL, Quiz, Assignment และกิจกรรม Moodle อื่นที่มีหน้า `/mod/.../view.php`
- จำกัดการจับคู่ภายในระยะเดิม 720px และไม่ข้ามป้ายภาพถัดไป
- ตัด Forum และ Label ออกจากเป้าหมาย เพื่อไม่ให้ป้ายหรือกระดานประกาศถูกนับเป็นแบบทดสอบ
- บันทึก provenance เป็น `groupContextSource: local_image_label` เพื่อให้ตรวจสอบย้อนกลับได้
- ผลที่ต้องการ: ป้าย Post-test + ไฟล์ `Quiz 2.docx` ถัดลงมา ถูกนับเป็น Post-test แม้ผู้สอนไม่ใส่คำ Post-test ในชื่อไฟล์

### การทดสอบและ Artifact
- เพิ่ม regression assertions ตรวจว่าตัวจับคู่รองรับกิจกรรม Moodle ทั่วไป หยุดที่ป้ายถัดไป และเก็บ local-label provenance
- Automated test files ผ่าน **34/34**, 0 fail
- JavaScript syntax check ผ่าน
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.6.zip`
- ขนาด: **9,323,447 bytes**
- SHA-256: `5B410E16BB1F89A152F3F4A395D9F22DEBC3C714255272DCB38C116282C9C412`
- ZIP verification: `manifest.json` ภายในเป็น Local Legacy version `0.1.6`

### งานถัดไป
- Load unpacked หรือแตก ZIP 0.1.6 แล้วตรวจรายวิชาในภาพซ้ำ เพื่อยืนยันแถวแบบทดสอบหลังเรียนแสดงผ่าน
- ยังไม่ได้อัปโหลด ZIP/source 0.1.6 ขึ้น GitHub หรือ Releases


## 24. รองรับ Moodle Forum ใต้ป้าย Pre/Post — Local Legacy 0.1.7 (2026-10-20)
**สถานะ: ผู้ใช้อธิบายขอบเขต / สรุปแผนก่อนแก้ / ผู้ใช้อนุมัติ / แก้ source / tests ผ่าน / สร้าง ZIP แล้ว / รอ live acceptance test**

### ข้อตกลงกระบวนการ
- ก่อนแก้ไขรอบต่อไป ต้องสรุปสิ่งที่จะทำ ขอบเขต ผลกระทบ และวิธีป้องกัน false positive ให้ผู้ใช้อนุมัติก่อน
- รอบนี้ผู้ใช้อนุมัติให้รองรับ Forum หลังได้รับสรุปขอบเขตแล้ว

### การแก้ไข
- Local Legacy ยอมรับ Moodle Forum เป็น Pre/Post เมื่อเป็นกิจกรรมแรกที่อยู่ใต้ป้ายภาพ Pre-test/Post-test ใน Section เดียวกัน
- ใช้ข้อจำกัดเดิม: อยู่ภายในระยะใกล้ 720px และห้ามข้ามป้ายภาพถัดไป
- Forum ที่ไม่มีป้าย Pre/Post ซึ่งสัมพันธ์กับรายการโดยตรงไม่ถูกเดาเป็นแบบทดสอบ
- เพิ่มตัวกรองไม่รับ Forum ที่มีชื่อ/ข้อความระบุ `Announcements`, `News Forum`, `กระดานข่าว`, `กระดานประกาศ`, `ข่าวสาร` หรือ `ประกาศ`
- Moodle Label ยังคงไม่เป็นเป้าหมายของการจับคู่
- การจำแนกที่ได้ยังเก็บ `groupContextSource: local_image_label` เพื่อ audit ย้อนกลับ

### การทดสอบและ Artifact
- เพิ่ม regression assertions ยืนยันว่า Forum อยู่ในกลุ่ม Moodle activity ที่ป้าย Pre/Post จับคู่ได้
- เพิ่ม regression assertion ยืนยันว่ามี Announcements/news exclusion
- ยังคงตรวจว่าการจับคู่หยุดก่อนป้ายภาพถัดไปและเก็บ local-label provenance
- Automated test files ผ่าน **34/34**, 0 fail
- JavaScript syntax check ผ่าน
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.1.7.zip`
- ขนาด: **9,323,776 bytes**
- SHA-256: `F378D4ED4B01F8D8B4F661243F39DD0B4C6AF6848C5C85B50907B49771A9E4BF`
- ตรวจ ZIP แล้ว: `manifest.json` เป็น Local Legacy version `0.1.7`

### งานถัดไป
- แตก ZIP/Load unpacked 0.1.7 แล้วทดสอบวิชาที่ใช้ Forum ใต้ป้าย Pre/Post จริง
- ตรวจยืนยันว่า Announcements หรือกระดานประกาศไม่ถูกนับ
- ยังไม่ได้อัปโหลด ZIP/source 0.1.7 ขึ้น GitHub หรือ Releases


## 25. ระบบตรวจ 683 GR/GS หลายรายวิชา + PDF หลักฐานข้ามบัญชี — Local Legacy 0.2.0 (2026-10-20)
**สถานะ: ออกแบบหลังผู้ใช้ยืนยัน / แก้ source / tests ผ่าน / สร้าง ZIP / ปรับ Google Sheet และสร้างโฟลเดอร์แล้ว / ยังต้อง Deploy Apps Script และทำ live acceptance test**

### ขอบเขตที่ผู้ใช้อนุมัติ
- สร้าง “ระบบ” สำหรับนำเข้ารายวิชาและรันคิวตรวจทั้งหมด ไม่ใช่ให้ Codex ตรวจ 152 วิชาแทนผู้ใช้ในรอบนี้
- แหล่งรายการคือ Google Sheet ID `1ueWMS36W2Ah6METy5z-rsAHpbhP4LcaApsAWB9AtCNM`, tab `เหตุผลรายวิชา`, gid `532693621`
- อ่านหน่วยกิตจากคอลัมน์ C, Course Profile จากคอลัมน์ D และลิงก์รายวิชาจากคอลัมน์เดิม Q ซึ่งเลื่อนไป R หลังเพิ่มคอลัมน์ผลใหม่
- รับเฉพาะภาค 683 ประเภท GR/GS ที่มีลิงก์ d-Learning หรือ i-Learning; `(T)` และ `(TT)` เป็นทฤษฎี, `(L)` เป็นปฏิบัติ
- เครื่องตรวจเป็นเครื่องแยกและใช้บัญชี Google คนละบัญชีกับเจ้าของ Sheet/Drive

### สถาปัตยกรรมข้ามบัญชี
- Apps Script ต้องสร้างและ Deploy โดยบัญชีเจ้าของ Sheet โดยตั้ง **Execute as: Me** และ access แบบ Anyone
- เครื่องตรวจเก็บเพียง Web app URL กับ shared secret และต้องล็อกอินเฉพาะ d-Learning/i-Learning; ไม่ต้องล็อกอินบัญชี Google ของเจ้าของเอกสาร
- Apps Script อ่าน catalog, สร้าง PDF ใน Drive ของเจ้าของ และเขียนผลกลับ Sheet ด้วยสิทธิ์เจ้าของ
- shared secret ป้องกันบุคคลทั่วไปส่งข้อมูลเข้าบริการ; ห้ามบันทึก secret ลง GitHub/Handoff
- PDF และโฟลเดอร์หลักฐานตั้งเป้า **ทุกคนที่มีลิงก์ดูได้เท่านั้น**
- ความล้มเหลวตอนส่ง Drive/Sheet ไม่ทำลายผลตรวจและไม่หยุดคิว; หน้า Queue มีปุ่มส่ง PDF ใหม่

### Google Sheet ที่แก้แล้ว
- คงคอลัมน์ G และเปลี่ยนชื่อเป็น `ผลสุดท้าย (เดิม)`
- เพิ่ม H: `ผลตรวจใหม่ (Local Legacy)`
- เพิ่ม S:W: `สถานะการตรวจใหม่`, `ผู้ตรวจต้องดำเนินการ`, `แจ้งผู้สอนแก้ไข`, `วันที่ตรวจล่าสุด`, `หลักฐานผลตรวจ (PDF)`
- รักษา dropdown/conditional formatting ของผลเดิมและเพิ่มรูปแบบให้ผลใหม่; ไม่ได้เขียนผลตรวจรายวิชาใดในรอบนี้
- ชุดข้อมูลที่อ่านก่อนพัฒนา: 152 แถว 683GR (120 `(T)`, 32 `(TT)`), 144 d-Learning และ 8 i-Learning; ระบบเตรียมรองรับ 683GS ที่เพิ่มภายหลัง

### Google Drive
- สร้างโฟลเดอร์ `SPU Learning Auditor Evidence — 683`
- Folder ID: `1ccIYrepKL1QO-UZ_XpaGBIwYALsv-Be_`
- URL: https://drive.google.com/drive/folders/1ccIYrepKL1QO-UZ_XpaGBIwYALsv-Be_
- การตั้ง Anyone-with-link จะทำผ่าน `setupEvidenceService()` ตอน Deploy เพื่อยืนยันด้วยบัญชีเจ้าของ; ยังไม่ได้ยืนยันการแชร์จริง

### Source ที่เพิ่ม/แก้
- `sheet-catalog.js`: อ่าน CSV fallback, parse Course Profile, GR/GS, T/TT/L
- `evidence-package.js`: สร้างรายงาน HTML สำหรับ PDF และแยก “ผู้ตรวจต้องดำเนินการ” ออกจาก “แจ้งผู้สอนแก้ไข”
- `evidence-sync.js`: อ่าน catalog และส่งหลักฐานผ่าน Apps Script
- `apps-script/Code.gs`, `apps-script/README.md`: owner-executed web app, secret, PDF, Sheet update
- `queue.html/css/js`: นำเข้าจากบริการเจ้าของ Sheet, ตั้ง endpoint/secret, แสดง PDF/sync state และ retry
- `background.js`: ส่งหลักฐานหลัง done/empty; หน้าโล่งสร้าง PDF ผล “ไม่ผ่าน — ไม่พบเนื้อหารายวิชา”
- `manifest.json`: Local Legacy version `0.2.0` และ optional permission สำหรับ `script.google.com`
- `tests/sheet-catalog.test.mjs`, `tests/evidence-package.test.mjs`: regression tests ใหม่

### การทดสอบและ Artifact
- JavaScript syntax checks ผ่าน รวม Apps Script parse check
- Automated test files ผ่าน **36/36**, 0 fail
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\outputs\SPU-Learning-Auditor-Local-Legacy-0.2.0.zip`
- ขนาด: **9,338,542 bytes**
- SHA-256: `88A8FF3C8515EA938B636883271C0868B19C98EAAF631F268F8AA10BF6C2CAA0`
- ZIP verification: 124 entries และมี `manifest.json`
- ยังไม่ได้อัปโหลด ZIP/source 0.2.0 ขึ้น GitHub หรือ Releases

### งานที่ต้องทำต่อก่อนเริ่มตรวจจริง
1. บัญชีเจ้าของเอกสารสร้าง/เปิด Apps Script, วาง `apps-script/Code.gs`, รัน `setupEvidenceService()` หนึ่งครั้ง และ Deploy web app (Execute as Me)
2. นำ Web app URL และ Secret ไปตั้งค่าใน Extension บนเครื่องตรวจ
3. ทดสอบนำเข้าและตรวจ 1 วิชาทดสอบก่อน; ยืนยัน PDF เปิดได้แบบไม่ล็อกอิน, Sheet เขียนถูกแถว และข้อความผู้ตรวจ/ผู้สอนแยกถูกต้อง
4. หลัง acceptance test จึงนำเข้าทั้ง 683 และกดเริ่มคิวครั้งเดียว
5. ห้ามอ้างว่าระบบ production พร้อมหรือ Apps Script deploy สำเร็จจนกว่าจะมีหลักฐาน live test จริง

### สถานะการเปิดหน้า Deploy
- เปิด `script.google.com/home` ในแท็บภายในแล้ว แต่ Google แสดง `Verify it’s you` สำหรับ `siraprah.so@spu.ac.th`; หยุดตามข้อกำหนดความปลอดภัยและเก็บแท็บไว้ให้เจ้าของบัญชีกดยืนยันตัวตนเอง
- หลังผู้ใช้ยืนยันบัญชีแล้ว ให้ทำต่อจากแท็บเดิม: สร้าง project, วาง Code.gs, รัน setup และ Deploy; ยังไม่มี Web app URL/Secret ในขณะบันทึกนี้


## 26. Apps Script Evidence Service Deploy สำเร็จ — Local Legacy 0.2.0 (2026-10-20)
**สถานะ: Deploy สำเร็จ / setup สิทธิ์สำเร็จ / GET endpoint ผ่าน / ยังไม่ได้ live test POST catalog และยังไม่ได้ตรวจรายวิชาทดสอบ**

### Deployment ที่ยืนยันแล้ว
- Project: `SPU Learning Auditor Evidence — 683`
- Script project ID: `1y45LoTMAhyVOG8PnGANu83vR8T1qKPHnNiSseQHYb68mQKbeXGEf8_W-`
- Deployment ID: `AKfycbxJoSKj-YU9hmnSFqrk8OEYAbgvTUs37-6wrEJWci6fNdpci63VlZbfCMkrmJU63HittA`
- Web app URL: https://script.google.com/macros/s/AKfycbxJoSKj-YU9hmnSFqrk8OEYAbgvTUs37-6wrEJWci6fNdpci63VlZbfCMkrmJU63HittA/exec
- Version 1 deployed 20 ตุลาคม 2569 เวลา 14:55 น. (Asia/Bangkok)
- Execute as: เจ้าของเอกสาร `siraprah.so@spu.ac.th`
- Access: `Anyone`; ทุกคำสั่ง POST ที่ใช้งานจริงยังตรวจ shared secret
- `setupEvidenceService()` execution completed: สร้าง shared secret และตั้งโฟลเดอร์หลักฐานเป็น Anyone with link / Viewer สำเร็จ
- GET endpoint ยืนยันผลจริง: `{"ok":true,"service":"SPU Learning Auditor Evidence","version":"1"}`
- **ห้ามบันทึก shared secret ลง GitHub/Handoff**; ค่าอยู่ในไฟล์ local ส่วนตัว `outputs/SPU-Auditor-683-Connection-PRIVATE.txt` เท่านั้น

### Source/Artifact ที่ปรับให้ตรงกับ Deployment
- เปลี่ยน URL validation ใน `apps-script/Code.gs` จาก regex เป็น URL parser เพื่อให้ข้อความที่วางผ่าน Apps Script Editor ไม่เสีย escape characters
- Automated test files ผ่าน **36/36**, 0 fail
- Apps Script syntax check ผ่าน
- ZIP เดิมถูก rebuild โดยยังใช้ชื่อ `SPU-Learning-Auditor-Local-Legacy-0.2.0.zip`
- ขนาดใหม่: **9,338,611 bytes**
- SHA-256 ใหม่: `207209BA7A6B80195C8F5F744A2BABE17F9833CD1D72A175C79DAC246AE31B37`
- 124 entries และมี `manifest.json`

### งานถัดไป
1. ย้าย ZIP และไฟล์ connection แบบ PRIVATE ไปเครื่องตรวจ โดยห้ามเผย Secret
2. Load unpacked 0.2.0, ตั้ง Web app URL + Secret และเปิด automatic evidence sync
3. ทดสอบนำเข้า catalog 683; ต้องยืนยันจำนวน/ประเภทที่อ่านได้ก่อนเริ่มคิว
4. ตรวจ 1 วิชาทดสอบและยืนยัน end-to-end: PDF ถูกสร้าง, ลิงก์เปิดแบบไม่ล็อกอิน, Sheet เขียนถูกแถว และข้อความผู้ตรวจ/ผู้สอนถูกคอลัมน์
5. เมื่อ acceptance test ผ่าน จึงเริ่มคิวทั้งหมด; ณ จุดนี้ยังไม่มีการตรวจ 152 วิชาจริง

## 27. แก้ Apps Script Catalog URL Parser และเตรียมโหมดเลือกชุดตรวจ (2026-10-20)

**สถานะ: จัดทำโค้ดแก้ไขสำหรับวางใน Apps Script แล้ว / ยังไม่ได้ยืนยันว่า Save, Deploy หรือทดสอบบน production สำเร็จ**

### คำขอ
- ผู้ใช้อนุมัติให้แก้ปัญหา Apps Script ที่ดึง catalog แล้วได้ 0 รายการ ทั้งที่ Sheet มีรายวิชา 683GR/GS ที่เข้าเกณฑ์ 152 รายการ
- ผู้ใช้ขอเพิ่มรูปแบบการเลือกชุดตรวจ 4 แบบ:
  1. เลือกวิชาเอง
  2. สุ่ม 10 วิชาที่ยังไม่มีผลตรวจ
  3. ตรวจทั้งหมดที่ยังไม่มีผลตรวจ
  4. เลือกตรวจซ้ำในรายวิชาที่มีผลตรวจแล้ว

### การวินิจฉัย
- โค้ดเดิมใช้ `new URL()` และ `URLSearchParams` ใน Apps Script
- Runtime ของ Apps Script ในโปรเจกต์นี้ไม่รองรับ browser Web API ดังกล่าวอย่างเชื่อถือได้
- การตรวจ URL ล้มเหลวและถูกดักเป็น error/fallback ส่งผลให้ URL รายวิชาที่ถูกต้องอาจถูกปฏิเสธ ทำให้ catalog ว่าง
- ตรวจพบว่าต้องแก้ทั้งจุดอ่าน catalog และจุดจับคู่ URL ก่อนเขียนผล/PDF กลับลง Sheet ไม่ใช่เฉพาะ `getCatalog_()`

### สิ่งที่จัดทำแล้ว
- จัดทำ `Code.gs` ฉบับเต็มสำหรับคัดลอกวาง
- เพิ่ม `parseSupportedCourseUrl_()` ที่ใช้ string operations แทน `new URL()`
- จำกัด URL ที่รับเฉพาะ:
  - `https://dlearning.spu.ac.th/course/view.php?id=ตัวเลข`
  - `https://ilearning.spu.ac.th/course/view.php?id=ตัวเลข`
- URL ที่มี query parameter อื่นหรือ fragment ยังรับได้ หากมี `id` เป็นตัวเลข
- เพิ่ม canonical URL รูปแบบ `host/course/view.php?id=ตัวเลข` เพื่อให้จับคู่ URL ระหว่าง Extension กับ Sheet ได้สม่ำเสมอ
- `getCatalog_()` คืน diagnostics:
  - `rowsRead`
  - `profileRejected`
  - `urlRejected`
  - `accepted`
  - `withResult`
  - `withoutResult`
- catalog ระบุ `hasAuditResult` จากคอลัมน์ผลตรวจใหม่, สถานะการตรวจใหม่ หรือหลักฐาน PDF
- ไม่เปลี่ยนข้อมูลใน Google Sheet, ไม่เริ่มคิว 152 วิชา, ไม่สร้าง PDF และไม่หมุน shared secret

### สิ่งที่ยังไม่ได้ทำ / ยังไม่ยืนยัน
- ยังไม่ได้ยืนยันว่าโค้ดถูกวางและ Save ใน Apps Script project จริง
- ยังไม่ได้ Deploy Apps Script version ใหม่
- ยังไม่ได้ทดสอบ POST `getCatalog` ด้วย shared secret จริง
- ยังไม่ได้ยืนยันว่า endpoint ส่งกลับ `accepted = 152`
- ยังไม่ได้ทดสอบ `publishEvidence` แบบ end-to-end
- ยังไม่ได้ยืนยัน source/commit ล่าสุดของ GitHub main หรืออัปเดต ZIP Extension
- โหมดเลือกชุดตรวจ 4 แบบมีรายงานว่าเริ่มแก้ source และกำลังทดสอบ แต่ยังไม่มีหลักฐาน source, test result, commit หรือ deploy ที่ยืนยันได้ในบันทึกนี้

### ข้อกำหนดก่อนเริ่มตรวจจริง
1. วางและ Save `Code.gs` ฉบับแก้ไข
2. Deploy เป็น New version บน Web App deployment เดิม เพื่อรักษา Web app URL และ shared secret เดิม
3. ห้ามรัน `setupEvidenceService()` ซ้ำ เว้นแต่ต้องการหมุน Secret โดยตั้งใจ
4. ทดสอบ `getCatalog` และยืนยันว่าได้ 152 รายการ พร้อมตรวจ diagnostics
5. ทดสอบ 1 รายวิชาแบบ end-to-end: import → สร้างคิว → ตรวจ → PDF → เขียน Sheet → เปิด PDF โดยไม่ต้องล็อกอิน
6. ทดสอบโหมดเลือกวิชา, สุ่ม 10, ตรวจทั้งหมดที่ไม่มีผล และเลือกตรวจซ้ำ โดยต้องกันวิชาที่ queued/running ไม่ให้สร้างงานซ้ำ
7. การตรวจซ้ำต้องเก็บผล, PDF และประวัติเดิมไว้จนกว่าผลรอบใหม่จะสำเร็จ

### ความเสี่ยง
- ห้ามถือว่า `auditStatus` ที่มีข้อความเพียงอย่างเดียวเป็นผลตรวจที่สมบูรณ์โดยไม่ตรวจนิยามสถานะใน Extension
- ควรใช้ Course Profile ร่วมกับ canonical Moodle Course URL เพื่อระบุแถว Sheet และป้องกันการเขียนผลผิดรายวิชา
- ห้ามบันทึก shared secret, token, cookie หรือข้อมูลบัญชีผู้ใช้ลง GitHub หรือ Handoff


## 28. Local Legacy 0.2.1 — เลือกชุดตรวจและปรับ PDF สำหรับผู้สอน (2026-10-20)

**สถานะ: แก้ source แล้ว / tests ผ่าน / สร้าง ZIP และ PDF preview แล้ว / ยังไม่ได้อัปโหลด ZIP หรือ source ขึ้น GitHub / ไม่ได้เริ่มตรวจรายวิชาจริง**

### ขอบเขตและข้อยืนยันจากผู้ใช้
- ผู้ใช้ยืนยันว่าปัญหาดึงคิวรายวิชาไม่ได้ถูกแก้แล้วจากงานอีกช่วงหนึ่ง จึงไม่แก้หรือ Deploy Apps Script ซ้ำในรอบนี้
- งานรอบนี้จำกัดที่การเลือกชุดรายวิชาในหน้าคิวและการปรับ PDF หลักฐานสำหรับผู้สอน

### โหมดเลือกชุดตรวจในหน้าคิว
เพิ่ม 4 รูปแบบ:
1. เลือกวิชาที่ยังไม่มีผลด้วยตนเอง
2. สุ่ม 10 วิชาที่ยังไม่มีผล
3. **ตรวจเฉพาะวิชาที่ยังไม่มีผลทั้งหมด**
4. เลือกตรวจซ้ำจากวิชาที่มีผลแล้ว

- เพิ่มช่องค้นหา, เลือกทั้งหมดที่มองเห็น, ล้างรายการที่เลือก และจำนวนรายการก่อนเพิ่มเข้าคิว
- ป้องกันการเพิ่มซ้ำเมื่อรายวิชาเดียวกันอยู่ในสถานะ queued/running/paused
- การเลือกตรวจซ้ำเปลี่ยนเฉพาะงานในคิว; ไม่ลบผลและ PDF รอบก่อนจากแหล่งประวัติ
- Catalog อ่านสถานะผลเดิมจากผลตรวจใหม่, สถานะการตรวจใหม่ หรือ URL หลักฐาน PDF เพื่อแบ่ง “มีผลแล้ว/ยังไม่มีผล”

### PDF หลักฐานสำหรับผู้สอน
- ปรับเป็นรายงาน A4 ที่อ่านง่ายขึ้น: สรุปผลเด่นด้านบน, สิ่งที่ผู้สอนต้องดำเนินการ, ข้อมูลรายวิชา, ตารางองค์ประกอบ และหลักฐานต้นทาง
- เพิ่มสีสถานะ, ระยะห่าง,หัวตารางซ้ำเมื่อขึ้นหน้าใหม่ และรูปแบบพิมพ์ที่คงสี
- นำส่วน “งานที่ผู้ตรวจต้องทำ/รอผู้ตรวจยืนยัน” ออกจาก PDF ทั้งหมด เพราะ PDF มีไว้ส่งให้ผู้สอน
- ข้อมูล reviewer actions ภายในระบบยังคงอยู่สำหรับ workflow/Sheet; เปลี่ยนเฉพาะเอกสารที่ผู้สอนเห็น

### Source ที่เพิ่ม/แก้
- เพิ่ม: `catalog-selection.js`, `tests/catalog-selection.test.mjs`
- แก้: `queue.html`, `queue.css`, `queue.js`, `sheet-catalog.js`, `evidence-package.js`, tests ที่เกี่ยวข้อง, `README.md`, `RELEASE-NOTES.md`, `manifest.json`
- Version: `0.2.1`

### การทดสอบและ Artifact
- Automated test files ผ่าน **37/37**, 0 fail
- JavaScript syntax checks ของ queue และ evidence package ผ่าน
- PDF QA: render และตรวจด้วยภาพครบ **4 หน้า A4**; ไม่พบข้อความซ้อน ตัดขอบ หรือหน้าว่าง
- ZIP: `C:\\Users\\Administrator\\Documents\\Codex\\2026-08-24\\new-chat\\outputs\\SPU-Learning-Auditor-Local-Legacy-0.2.1.zip`
- ZIP size: **9,344,402 bytes**, 126 entries
- SHA-256: `FB7DEA9827894F2C14EBB37A9A0011B69111AF6F0A797FD885124B7F8D88AA5A`
- ตรวจ `manifest.json` ภายใน ZIP แล้วเป็น version `0.2.1`
- PDF preview: `output/pdf/SPU-Learning-Auditor-PDF-Preview-0.2.1.pdf` (154,816 bytes)

### สิ่งที่ไม่ได้ทำในรอบนี้
- ไม่ Deploy หรือแก้ Apps Script production เพิ่ม
- ไม่เปลี่ยนข้อมูล Google Sheet และไม่เริ่มคิวตรวจจริง
- ไม่อัปโหลด ZIP/source 0.2.1 ขึ้น GitHub หรือ Releases

### งานถัดไป
1. Load unpacked หรือแตก ZIP 0.2.1 บนเครื่องตรวจ
2. ทดสอบ Catalog จริงว่าการแบ่ง “มีผลแล้ว/ยังไม่มีผล” ตรงกับ Sheet
3. ทดลองแต่ละโหมด โดยเฉพาะ “ตรวจเฉพาะวิชาที่ยังไม่มีผลทั้งหมด” และตรวจว่าจำนวนก่อนเข้าคิวถูกต้อง
4. ตรวจ 1 วิชา end-to-end และเปิด PDF จากบัญชีผู้สอน/หน้าต่างไม่ระบุตัวตน เพื่อยืนยันสิทธิ์และความอ่านง่ายก่อนเริ่มคิวจำนวนมาก


## 29. ข้อกำหนดสถานะผลตรวจและข้อความวิดีโอมาตรฐาน (2026-10-20)

**สถานะ: บันทึกข้อกำหนดแล้ว / รอสรุปขอบเขตและอนุมัติก่อนแก้โค้ด / รอบแรกให้แก้เฉพาะ Local Legacy**

### ตรรกะสถานะผลตรวจที่ผู้ใช้กำหนด
1. หากยังมีรายการที่ **ผู้สอนต้องแก้ไข** อย่างน้อยหนึ่งรายการ ให้ผลรวมเป็น **ไม่ผ่าน** ทันที ห้ามแสดงเป็น “ต้องตรวจทาน”
2. ใช้สถานะ **ต้องตรวจทาน** เฉพาะเมื่อไม่มีสิ่งที่ผู้สอนต้องแก้แล้ว และเหลือเพียงรายการที่ทีมผู้ตรวจต้องเข้าไปยืนยันผล
3. เมื่อไม่มีทั้งรายการผู้สอนต้องแก้และรายการรอทีมตรวจ ให้สรุปผ่าน/ไม่ผ่านตามเกณฑ์องค์ประกอบปกติ
4. ผลตรวจตามองค์ประกอบในรายงานควรแยกเป็นรายสัปดาห์/ครั้ง เพื่อให้อ่านง่ายในรูปแบบเดียวกับหน้าตัวตรวจ

### ข้อความมาตรฐานกรณีวิดีโอเปิดตรวจไม่ได้
ให้รวมกรณีต่อไปนี้เป็นข้อความสำหรับผู้สอนแบบเดียวกันว่า **“ลิงก์ไม่สามารถเข้าถึงได้”**
- ลิงก์ติดสิทธิ์หรือผู้ตรวจไม่มีสิทธิ์เปิด
- คลิปถูกลบ/หาย หรือแพลตฟอร์มแสดง Video unavailable
- ลิงก์โฟลเดอร์ Google Drive ที่ว่างหรือไม่พบวิดีโอสำหรับตรวจ
- กรณีปลายทางอื่นที่ไม่สามารถเปิดหลักฐานวิดีโอได้จริง

หมายเหตุการออกแบบ: ภายในระบบยังควรเก็บรหัสสาเหตุเชิงเทคนิคแยกกันเพื่อวินิจฉัยย้อนหลัง แต่ข้อความที่แสดงต่อผู้สอนใช้ถ้อยคำมาตรฐานข้างต้น

### ลำดับการนำไปใช้
- รอบปัจจุบัน: แก้เฉพาะ **SPU Learning Auditor Local Legacy** หลังผู้ใช้อนุมัติสรุปขอบเขต
- งานค้างสำหรับอนาคต: เมื่อต่อ Dashboard หรือ Local รุ่นปัจจุบัน ต้องนำตรรกะสถานะ, รูปแบบผลรายสัปดาห์ และข้อความวิดีโอมาตรฐานเดียวกันไปใช้ให้สอดคล้องกันทุกช่องทาง ได้แก่ UI, PDF, Sheet/API/export และ Dashboard
- ก่อนแก้ Dashboard/Local ต้องตรวจ mapping สถานะเดิมและข้อมูลย้อนหลัง เพื่อไม่เปลี่ยนความหมายของผลเก่าโดยไม่ตั้งใจ

### Acceptance criteria สำหรับ Legacy รอบแรก
- มี teacher action อย่างน้อย 1 รายการ → ผลรวม “ไม่ผ่าน”
- teacher action = 0 และ reviewer action อย่างน้อย 1 รายการ → ผลรวม “ต้องตรวจทาน”
- teacher action = 0 และ reviewer action = 0 → สรุปตามเกณฑ์ปกติ
- PDF/หน้ารายงานไม่แสดง “ต้องตรวจทาน” ในรายวิชาที่ยังมีสิ่งให้ผู้สอนแก้
- ตารางองค์ประกอบจัดกลุ่มและอ่านผลแยกตามสัปดาห์/ครั้งได้ชัดเจน
- กรณีวิดีโอทั้งสี่กลุ่มข้างต้นแสดงข้อความผู้สอน “ลิงก์ไม่สามารถเข้าถึงได้” เหมือนกัน
