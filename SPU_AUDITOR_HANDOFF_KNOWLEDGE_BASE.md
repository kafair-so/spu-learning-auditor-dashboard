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
