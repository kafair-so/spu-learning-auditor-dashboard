Warning: truncated output (original token count: 65634)
Total output lines: 1832

# SPU Learning Auditor Dashboard — Handoff & Knowledge Base

> Living handoff / บันทึกส่งต่องาน อัปเดต 26 ตุลาคม 2569 (2026-10-26)
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
7. การตรวจซ้ำต้องเก็บผล, PDF และประวัติเดิมไว้จนกว่าผลรอบใหม่จะสำเร็จ…15634 tokens truncated…t_result` เปลี่ยนงานที่ส่งผลสำเร็จเป็น `completed` ถูกต้อง
- ตรวจ 13 งาน completed ชุดแรกแล้ว ทั้ง 13 วิชามี `latest_internal_run_id` และพบ `audit_runs` ครบ: pass 3, has_content 7, no_content 1, needs_review 1, audit_failed 1
- ทุกวิชาที่ completed ดังกล่าวมีแถว `cancelled` เก่าซึ่งมี `created_at` ใหม่กว่า จึงถูก `queueOverview()` เลือกแทนแถว completed

### สาเหตุในโค้ด
- `enqueue_selected_audits` ใช้ job_key เดิมและ requeue แถวเก่าด้วยการอัปเดต `updated_at`; ค่า `created_at` ของงานยังเป็นวันที่สร้างครั้งแรก
- `queueOverview()` ดึง `audit_jobs` เรียง `created_at desc` แล้วเลือก terminal job แรกต่อวิชา
- เมื่อแถว completed ที่เพิ่งตรวจเสร็จมี created_at เก่ากว่าแถว cancelled ในอดีต Dashboard จึงนับ cancelled แทน completed
- หน้า UI ไม่มีการ์ดแสดง cancelled ทำให้ผู้ใช้เห็น completed=0 ทั้งที่ผลถูกเก็บแล้ว

### แนวทางแก้ที่เสนอ (รอผู้ใช้อนุมัติ)
- เปลี่ยนการเลือก terminal job ใน `queueOverview()` ให้เรียงตามเวลาสถานะล่าสุด เช่น `updated_at/completed_at` แทน `created_at` โดยยังให้ queued/running มีลำดับความสำคัญสูงสุด
- เพิ่ม regression test กรณี requeue job เดิมแล้ว completed แต่มี cancelled job ที่ created_at ใหม่กว่า
- Deploy Supabase Edge Function `api` และตรวจ production ว่า completed เพิ่มตามจำนวนจริงโดยไม่แก้หรือลบ audit history


## 42. แก้ Dashboard ให้แสดงจำนวนตรวจเสร็จจากคิว GR ถูกต้อง (2026-10-26)

**สถานะ: แก้ source แล้ว / regression checks ผ่าน / Deploy Supabase Edge Function Version 33 / Production ตรวจแล้ว**

### การแก้ไข
- ใน `queueOverview()` เพิ่ม `updated_at` ในข้อมูล `audit_jobs`
- เปลี่ยนลำดับ query จาก `created_at desc` เป็น `updated_at desc, created_at desc`
- queued/running ยังมีลำดับความสำคัญสูงสุดเหมือนเดิม แต่ terminal job ต่อวิชาจะเลือกจากเวลาที่สถานะถูกอัปเดตจริง
- ไม่แก้หรือลบ `audit_jobs`, `audit_runs`, หลักฐาน หรือประวัติย้อนหลัง

### Source และการทดสอบ
- Source commit: `74e0212742ad8684c4392aa8e85e063df7a2606f`
- Regression test commit: `43cd7d33647e70865504b70e9e58a007c3fcbd03`
- ตรวจ regression/static assertions ของ queue overview และ UI รวม 14 จุด ผ่าน 14, fail 0
- ยืนยัน source ก่อน Deploy ตรงกับ Production Version 32 และ source หลัง Deploy ตรงกับ GitHub ทุกบรรทัด

### Production
- Supabase project: `SPU OOE Learning Auditor` (`nwupjnkotdkodyxnraie`)
- Edge Function `api`: Version **33**, status `ACTIVE`, `verify_jwt=false` คงเดิม
- หลัง Deploy คำนวณด้วยลำดับเดียวกับ Production ได้ queued 105, running 1, completed 14, cancelled 40 ณ เวลาตรวจ
- ตัวเลขเปลี่ยนต่อเนื่องได้ตาม worker; ประเด็นสำคัญคือ completed 14 ไม่ถูก cancelled เก่าบดบังอีก


## 43. Local Legacy 0.2.9 — ปรับข้อความเอกสารสำหรับผู้สอนให้ตรงสาเหตุ (2026-10-26)

**สถานะ: แก้ source แล้ว / tests ผ่าน / สร้าง ZIP แล้ว / ยังไม่ได้อัปโหลด ZIP ขึ้น GitHub**

### คำขอและข้อสรุปที่ผู้ใช้อนุมัติ
- ข้อความในรายงานสำหรับผู้สอนต้องบอกสิ่งที่ขาดและสิ่งที่ต้องทำด้วยคำสั้น ๆ ไม่ใช้ภาษาของระบบ
- หากไม่มีแผนการสอนจริง ห้ามใช้คำว่า `แก้ไขหัวข้อ “แผนการสอน”` เพราะทำให้เข้าใจผิดว่ามีเอกสารแล้วแต่ตั้งชื่อผิด
- หากมีลิงก์เอกสารแต่เปิดไม่ได้หรือติดสิทธิ์ ต้องแยกจากกรณีไม่มีเอกสาร และระบุครั้งที่มีปัญหา

### การแก้ไข
- ไม่มีแผนการสอน → `เพิ่มแผนการสอน`
- ไม่มีเอกสารประกอบการสอน → `เพิ่มเอกสารประกอบการสอน`
- ลิงก์แผนการสอนเปิดไม่ได้/ติดสิทธิ์ → `ลิงก์แผนการสอนไม่สามารถเข้าถึงได้`
- ลิงก์เอกสารประกอบการสอนเปิดไม่ได้/ติดสิทธิ์ → `ลิงก์เอกสารประกอบการสอนไม่สามารถเข้าถึงได้`
- ระบบยังรวมครั้งที่ต่อเนื่องให้อ่านง่าย เช่น `ครั้งที่ 3–6, 9 และ 12`
- ตัดข้อความยาว `เพราะระบบไม่พบเอกสารที่ใช้ให้คะแนน` ออกจากคำแนะนำผู้สอน
- เพิ่มคำแปล EN/zh-CN/JA สำหรับข้อความใหม่

### Source และการทดสอบ
- Source หลัก: `spu-learning-auditor-local-legacy-0.1.0-from-0.13.16/teacher-summary.js`
- อัปเดต `i18n.js`, `manifest.json`, `README.md`, `RELEASE-NOTES.md`, `TEST-RESULTS.txt` และ regression tests
- Extension version: **0.2.9**
- Automated tests: **39/39 ผ่าน**, 0 fail
- Regression ครอบคลุม missing plan, missing materials, inaccessible plan/material links, needs-review link ที่เป็นปัญหาชัดเจน และการรวมช่วงครั้งที่

### Artifact
- Local ZIP: `C:\\Users\\Administrator\\Documents\\Codex\\2026-08-24\\new-chat\\outputs\\SPU-Learning-Auditor-Local-Legacy-0.2.9.zip`
- ZIP size: **9,497,769 bytes**, 131 entries
- SHA-256: `23C35153D11DC7DB3713EA332C34C86F1FE9F6F40B1B85E6126491909170E23C`
- ตรวจ `manifest.json` ภายใน ZIP แล้วเป็น version `0.2.9` และมี `teacher-summary.js`
- การเปลี่ยนครั้งนี้อยู่ใน Extension จึงต้อง Reload/Load Unpacked รุ่น 0.2.9 ก่อนสร้างรายงานใหม่
- รายงาน/PDF ที่สร้างไว้ก่อนอัปเดตจะไม่เปลี่ยนย้อนหลัง ต้องตรวจหรือส่ง PDF ใหม่หากต้องการข้อความแบบใหม่

### GitHub และงานส่งต่อ
- อัปเดต Handoff นี้แล้ว
- GitHub in-app browser ไม่มี session ที่มี push access จึงยังไม่ได้อัปโหลด ZIP 0.2.9 ไป `downloads/`; ห้ามอ้างว่ามีไฟล์บน GitHub จนกว่าจะอัปโหลดและตรวจ URL สำเร็จ
- Source ของ Local Legacy ยังไม่ได้เก็บเป็น tree ใน repo นี้; งานถัดไปควรอัปโหลด ZIP 0.2.9 หรือเพิ่ม source tree เพื่อให้ย้ายเครื่องได้จริง


## 44. Local Legacy 0.3.3–0.3.6 — ข้อมูลผู้สอนและการจำแนก Pre/Post-test (2026-11-04)

**สถานะ: แก้ source แล้ว / ตรวจด้วย scan จริงแล้ว / tests 43/43 ผ่าน / ยังไม่ได้อัปโหลด ZIP 0.3.6 ขึ้น GitHub**

### การเปลี่ยนแปลงช่วง 0.3.3–0.3.5
- 0.3.3 ปรับการตรวจลิงก์/กลุ่ม LINE และปิดงานข้อมูลผู้สอนอัตโนมัติเมื่อผลตรวจครบ
- 0.3.4 แยกครั้งที่ 1 ไม่ให้มีแถว Pre-test/Post-test และคงคะแนน Pre/Post จากครั้งที่ 2–15
- 0.3.5 เพิ่ม fallback จับคู่ป้าย Pre/Post เมื่อ OCR อ่านป้ายไม่ได้
- การแก้ 0.3.4–0.3.5 **ยังไม่แก้กรณีจริงของ PHY212** และไม่ควรอ้างว่าแก้สำเร็จจากข้อมูลจำลองเพียงอย่างเดียว

### สาเหตุจริงและการแก้ใน 0.3.6
- ตรวจไฟล์จริง `dlearning-structure-scan (9).json` ของ `ฟิสิกส์ 2 [683GR-PHY212(T)-(T)]` จำนวน 182 activities
- Moodle Quiz `https://dlearning.spu.ac.th/mod/quiz/view.php?id=2895684` มีชื่อ `แบบทดสอบครั้งที่ 1 ทบทวนเรื่อง Vector Quiz`
- `groupContext` มีข้อความชัดเจนว่า `ทำแบบทดสอบหลังการเรียนครั้งที่ 1...`
- กฎเดิมรองรับ `หลังเรียน` แต่ไม่รองรับ `หลังการเรียน` จึงตกไปเป็นกิจกรรมท้ายบท แม้ข้อมูลต้นทางครบ
- ขยายกฎให้รองรับ `ก่อนเรียน/ก่อนการเรียน` และ `หลังเรียน/หลังการเรียน` ใน `rules.js`, `assignment-text.js` และตัวอ่านบริบทใน `content.js`
- แก้ลำดับ classifier ให้ป้ายติดกิจกรรมที่ระบุ `แบบทดสอบหลังการเรียน` ชนะบริบทผสม Video/แบบฝึกหัด/WORKSHEET แต่ไม่ยอมรับป้ายเก่าค้างหรือข้อมูลเก่าที่ไม่มีแหล่งที่มาของป้าย

### หลักฐานยืนยัน
- รัน classifier กับ Moodle Quiz ใต้ข้อความ `หลังการเรียน` ทั้ง 7 รายการจริง (`id=2895684`, `2895689`, `2895732`, `2895753`, `2895772`, `2895791`, `2895849`) แล้วได้ `post_quiz` ทั้งหมด
- ตรวจรายการก่อนเรียนแล้วยังได้ `pre_quiz` และ regression ป้ายเก่าค้างยังคงได้ Quiz ปกติ
- เพิ่ม regression test ด้วยชื่อ URL และ groupContext จาก scan จริง รวมกรณีป้ายผสม Video/แบบฝึกหัด/WORKSHEET
- Automated tests ผ่าน **43/43**, fail 0

### Artifact
- Local ZIP: `C:\\Users\\Administrator\\Documents\\Codex\\2026-08-24\\new-chat\\SPU-Learning-Auditor-Local-Legacy-0.3.6.zip`
- ZIP size: **9,513,071 bytes**, 134 entries
- SHA-256: `2C49E691526AC69F8FA3FFA24B8C70CBB2311D1C65DC2089F4F9482CA8FC90A4`
- ตรวจ `manifest.json` ภายใน ZIP แล้วเป็น version `0.3.6`
- ยังไม่ได้อัปโหลด GitHub; ห้ามกล่าวว่า deploy/เผยแพร่แล้วจนกว่าจะอัปโหลดและตรวจ URL ดาวน์โหลดจริง


## 45. Local Legacy 0.3.7 — Google Photos อัลบั้มว่างไม่เข้าคิวผู้ตรวจ (2026-11-04)

**สถานะ: แก้ source แล้ว / tests 43/43 ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลด GitHub**

### อาการและสาเหตุ
- ลิงก์ Google Photos เปิดได้แต่หน้าแสดง `Album is empty` ระบบยังสร้างงานให้ผู้ตรวจเลือกว่าสอนย้อนหลัง กิจกรรม หรือสื่อเสริม
- ตัวอ่านเดิมรู้จักหน้าติดสิทธิ์ ลิงก์เสีย และวิดีโอถูกลบ แต่ไม่รู้จักข้อความอัลบั้มว่าง
- เมื่ออ่านเวลาไม่ได้จึงตกไปเป็น `duration_unavailable` และ `requiresMediaReview()` สร้างงานผู้ตรวจ ทั้งที่ไม่มีวิดีโอให้ตัดสิน

### การแก้ไข
- `providers.js` ตรวจ `Album is empty` และข้อความอัลบั้มว่างภาษาไทย เฉพาะ URL ของ Google Photos
- รีเฟรชตรวจซ้ำหนึ่งรอบก่อนยืนยัน `empty_media` ป้องกันการตัดสินจากหน้าที่ยังโหลดไม่ครบ
- `empty_media` เป็น definitive media failure: ไม่นับเวลา ไม่สร้างงานผู้ตรวจ และยังคงแสดงหลักฐานต้นทาง
- ข้อความผู้สอนเป็น `ลิงก์ Google Photos ไม่มีวิดีโอ กรุณาเพิ่มวิดีโอหรือเปลี่ยนลิงก์` แยกจากกรณีลิงก์เข้าไม่ได้
- เพิ่ม regression ป้องกันหน้าเว็บไซต์ทั่วไปที่มีคำว่า `Album is empty` ถูกตีความเป็น Google Photos

### การทดสอบและ Artifact
- Automated tests ผ่าน **43/43**, fail 0
- Local ZIP: `C:\\Users\\Administrator\\Documents\\Codex\\2026-08-24\\new-chat\\SPU-Learning-Auditor-Local-Legacy-0.3.7.zip`
- ZIP size: **9,514,257 bytes**, 134 entries
- SHA-256: `5157F8C8171210A23FD7D9C4F3B71660EB8D1CC5D64D153C4E1FA9AE0DCD5E61`
- ตรวจ ZIP แล้ว `manifest.json` เป็น `0.3.7` และ `providers.js` ภายในมี rule `empty_media`
- รายงานเดิมไม่เปลี่ยนย้อนหลัง ต้อง Reload Extension และตรวจรายวิชาใหม่จึงจะล้างงานยืนยันอัลบั้มว่าง

### ประเด็นสำคัญที่ตรวจพบระหว่างงาน แต่ยังไม่ได้แก้ใน 0.3.7
- หน้ารายงาน Local (`report.js`) และ `background.js` ยังตัดสิน GR/GS ผ่าน `legacyCompleteness()` ขณะที่ `evidence-package.js` และ Apps Script ใช้ `legacyScorecard()` 100 คะแนน ผ่านที่ 80
- ทำให้ PDF ที่พิมพ์จากหน้า Extension อาจแสดงไม่ผ่านจากองค์ประกอบขาด แม้คะแนนภายในถึง 80; ส่วนผลที่ส่งเข้า Google Sheet ใช้คะแนนภายใน
- พบรายงาน PHY121 `(L)-(L)` แสดง track เป็นทฤษฎี ทั้งที่ profile ควรเป็นปฏิบัติ; ระบบคิวต้องป้องกันค่าชนิดวิชาที่ขัดกับ suffix ของ Course Profile
- ห้ามลดผลที่ประกาศผ่านแล้ว งานถัดไปต้องรวมเส้นทางตัดสิน Local ให้ใช้ `legacyScorecard()` และตรวจเฉพาะผลไม่ผ่าน/ต้องตรวจทานเดิมเพื่อหาผลลบเท็จ


## 46. Local Legacy 0.3.8 — ยืนยันว่าไม่มีวิดีโอแบบข้ามแพลตฟอร์มและป้องกันเน็ตช้า (2026-11-04)

**สถานะ: แก้ source แล้ว / tests 43/43 ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### เป้าหมายและหลักการตัดสิน
- ขยายจาก Google Photos ไปยังลิงก์วิดีโอทุกแพลตฟอร์ม เช่น Drive/Photos, YouTube, OneDrive/SharePoint, Loom, Vimeo, Vidyard, Wistia, Kaltura, H5P, NotebookLM และหน้าเว็บที่ฝังตัวเล่นแบบทั่วไป
- ห้ามสรุปว่า `ไม่มีวิดีโอ` จากการเปิดครั้งเดียวหรือเพียงเพราะยังไม่เห็นตัวเล่น เพราะอาจเกิดจากอินเทอร์เน็ตช้า ตัวเล่นโหลดภายหลัง หรือหน้าเว็บยังไม่สมบูรณ์
- กรณีแพลตฟอร์มส่งสัญญาณชัดเจนอยู่แล้ว เช่น ลิงก์เสีย ติดสิทธิ์ วิดีโอถูกลบ หรืออัลบั้มว่าง ยังคงใช้ definitive failure ตามกฎเฉพาะของแพลตฟอร์มนั้น

### การยืนยันกรณีเปิดหน้าได้แต่ไม่มีตัวเล่น
- หน้าต้องโหลดเสร็จ (`readyState=complete`) มีเนื้อหาจริง และไม่มี spinner/progress/`aria-busy`
- ต้องไม่พบปัญหาออฟไลน์/เครือข่าย ไม่พบ `video`, `audio`, iframe หรือตัวครอบ player และไม่พบ metadata/ระยะเวลา/สัญญาณ media
- สถานะหน้าและลายเซ็นเนื้อหาต้องคงที่อย่างน้อย **3 ครั้งต่อการเปิดหนึ่งรอบ**; หากมีการโหลดต่อ เน็ตผิดปกติ หรือตัวเล่นปรากฏ ตัวนับจะเริ่มใหม่
- ต้องยืนยันแบบเดียวกันจากแท็บใหม่อย่างน้อย **2 รอบ** และยังทำ foreground/play/refresh recovery ก่อนสรุปผล
- เมื่อครบทุกเงื่อนไขจึงกำหนด `mediaStatus=no_video`, ไม่นับเวลา และไม่สร้างงานให้ผู้ตรวจมายืนยันสิ่งที่ไม่มีอยู่จริง
- ข้อความผู้สอน: `เปิดลิงก์ได้แต่ไม่พบวิดีโอ กรุณาเพิ่มวิดีโอหรือเปลี่ยนลิงก์`
- หน้าว่าง หน้ายังโหลดไม่ครบ เน็ตหลุด/ช้า หรือพบตัวครอบ player แต่ยังอ่านเวลาไม่ได้ จะคงเป็นสถานะยังยืนยันไม่ได้ ไม่ถูกตีความเป็น `no_video`

### Source และการทดสอบ
- เพิ่ม state machine `updateNoVideoProbe()` ใน `media-review.js`
- ปรับ `probeMedia()` และ `readMedia()` ใน `background.js` ให้รวบรวมสถานะการโหลด ตัวบอกกำลังโหลด ปัญหาเครือข่าย จำนวนตัวเล่น และลายเซ็นหน้า พร้อมยืนยันจากแท็บใหม่ 2 รอบ
- เพิ่ม `no_video` เป็น definitive media failure และเพิ่มข้อความแก้ไขสำหรับผู้สอน
- อัปเดต `manifest.json`, `README.md`, `RELEASE-NOTES.md`, `TEST-RESULTS.txt` และ regression tests เป็น version **0.3.8**
- Regression ครอบคลุมหน้าโหลดช้า ออฟไลน์ ตัวเล่นโหลดภายหลัง หน้าเปล่า หน้าไม่ complete และกรณีไม่มีตัวเล่นที่คงที่จริง

### การแก้เพิ่มเติมในแพ็กเกจ 0.3.8 รอบเดียวกัน
- เปลี่ยนเส้นทางตัดสิน GR/GS ใน `background.js` และ `report.js` จาก `legacyCompleteness()` เป็น `legacyScorecard()` ตามเกณฑ์ภายใน 100 คะแนน ผ่านที่ 80 คะแนน
- รายงานผู้สอนแสดงเฉพาะ `ผ่าน/ไม่ผ่าน/ต้องตรวจทาน` พร้อมข้อความว่าใช้เกณฑ์คะแนนภายใน แต่ไม่แสดงตัวเลขคะแนน
- `dashboard-export.js` อ่าน `score.total` และ `potentialTotal` ของ Legacy โดยตรง จึงไม่ตีคะแนนเป็นศูนย์เมื่อต้องส่งผล/หลักฐาน
- ปรับความผ่อนปรนวิดีโอ GR/GS ตามหน่วยกิต: 1 หน่วยกิต 5 นาที, 2 หน่วยกิต 10 นาที, 3 หน่วยกิตขึ้นไป 20 นาที และเพิ่ม guard ให้เวลา `0:00` ไม่สามารถผ่านแบบผ่อนปรนได้
- URL แบบทดสอบทั่วไป เช่น `แบบทดสอบการดูดซึมความชื้น` จะเป็นกิจกรรมท้ายบทเมื่อไม่มีชื่อหรือป้ายท้องถิ่นที่ยืนยันว่าเป็น Pre-test/Post-test; หลักฐาน Pre/Post ที่ชัดเจนยังมีลำดับสูงกว่า
- Automated tests ผ่าน **44/44**, fail 0 รวม regression ตรงจากอาการที่ผู้ใช้รายงาน

### Artifact และการส่งต่อ
- Local ZIP: `C:\\Users\\Administrator\\Documents\\Codex\\2026-08-24\\new-chat\\SPU-Learning-Auditor-Local-Legacy-0.3.8.zip`
- ZIP size: **9,518,345 bytes**, 134 entries
- SHA-256: `29ACEC6AB9D88EBFCBAA92DE896CF56AEC47BD03E2B431542AD7386E7A3FA476`
- เปิดตรวจ ZIP จริงแล้ว: `manifest.json` เป็น `0.3.8`, มี `updateNoVideoProbe`, เงื่อนไข `confirmedNoPlayerAttempts >= 2`, ผล `mediaStatus: "no_video"`, การตัดสินผ่านด้วย `legacyScorecard`, การซ่อนคะแนน, กฎผ่อนปรนตามหน่วยกิต และ guard เวลา 0:00
- ยังไม่ได้อัปโหลด GitHub หรือ Deploy; ห้ามกล่าวว่าเผยแพร่แล้วจนกว่าจะอัปโหลดและตรวจ URL ดาวน์โหลดจริง


## 57. Dashboard 0.13.28 — ปิดงานตกหล่นและเผยแพร่จริง (2026-11-09)

**สถานะ: source/tests ผ่าน / Supabase hardening ใช้งานจริง / release workflow ผ่าน / GitHub Pages แสดง 0.13.28**

### Dashboard และไฟล์ติดตั้ง
- อัปเดตหน้า Download, ข้อความ fallback ในหน้าหลักฐาน และคำแปลทั้งหมดจาก 0.13.21/รุ่นเก่าเป็น 0.13.28
- แก้ regression test หลังเพิ่มบทบาท owner, evidence decisions รายรายการ และการซ่อนคะแนนตามสิทธิ์; ชุดทดสอบเว็บผ่านครบ 7 ไฟล์ รวม 33 tests
- ชุดทดสอบ Extension ภายใน artifact ผ่าน 36/36 และ manifest เป็น version 0.13.28
- พบไฟล์ `SPU-Learning-Auditor-Dashboard-0.13.21.zip` เดิมเสียจริงและไม่ควรนำกลับมาใช้เป็นฐาน build
- สร้าง release จาก payload 0.13.28 ที่ตรวจ SHA-256 ก่อนประกอบ; GitHub Actions run #5 ผ่าน และสร้าง commit `80bf7298beade461134038d619f67ec3dd753391`
- ไฟล์บน branch `main`: 9,330,876 bytes, SHA-256 `111AD46C11464C249E896B466E927828DEA7472A7BCF5334BD262F5F8DF2A0B8`
- หน้า production ตรวจแล้วพบข้อความ 0.13.28 และไม่พบ 0.13.21

### Supabase production hardening
- Applied migration `dashboard_release_hardening` ใน project `nwupjnkotdkodyxnraie`; ไฟล์ migration คือ `supabase/migrations/202611090001_dashboard_release_hardening.sql`
- เปลี่ยน `is_spu_user` และ `is_audit_reviewer` เป็น security invoker; anon เรียกไม่ได้ และ authenticated เรียกได้เฉพาะฟังก์ชันที่ต้องใช้
- จำกัด `enqueue_missing_audits`/`enqueue_refresh_audits` ให้ service role; ปิด public/authenticated execute ของ trigger/event-trigger helpers
- เพิ่ม foreign-key indexes 5 จุด และแก้ RLS policy ให้ใช้ `(select auth.uid())` เพื่อลดการประเมินซ้ำ
- หลัง deploy: security advisor เหลือเพียง INFO สองตาราง service-only ที่เปิด RLS แต่จงใจไม่มี policy, performance advisor เหลือเพียง INFO ว่าดัชนีใหม่ยังไม่ถูกใช้ทันที, health advisor ไม่มีข้อเตือน
- Public API smoke test: `/v1/public/results` และ course history ยังตอบ 200 และไม่มี score/threshold/internal fields รั่วไป public payload

### ข้อควรจำ
- อย่าเผยแพร่ ZIP โดยอัปโหลดก้อนใหญ่จากเครื่องตรง ๆ เมื่อช่องทาง git ใช้ไม่ได้; workflow ปัจจุบัน reconstruct จาก `release-b64/dashboard-0.13.28/part-*.b64`, ตรวจ SHA-256, รัน tests, ตรวจ ZIP แล้วจึง commit artifact
- หากแก้ Extension รุ่นถัดไป ให้สร้าง payload ใหม่และเปลี่ยน hash/version ใน workflow ห้าม reuse payload 0.13.28

## 49. Local Legacy 0.3.10 — ความถูกต้องของคอมเมนต์สรุปผู้สอน (2026-11-05)

**สถานะ: แก้ source แล้ว / tests 40/40 ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### ปัญหาที่แก้
- คอมเมนต์สรุปเคยอ่านคำว่า “ลิงก์เปิดไม่ได้” จากลิงก์สำรอง/รายการซ้ำ แม้แถวนั้นมี PDF ที่ใช้ได้และผลสุดท้ายผ่านแล้ว ทำให้ข้อความขัดกับตารางรายละเอียด
- Pre-test กับ Post-test เคยถูกรวมเป็นคำแนะนำเดียว จึงบอกครั้งที่ขาดผิดประเภทและทำให้ Week 8 ของ PHY212 ดูเหมือนไม่มี Post-test
- สรุปวิดีโอเคยบอกเพียงจำนวนที่ผ่านและติดป้าย “ส่วนแนะนำรายวิชา” โดยไม่ระบุครั้งที่เวลายังไม่ครบจริง
- ป้ายภาพ Post-test อาจแพ้ข้อความ Label ทั่วไปที่อยู่ใกล้กิจกรรม ทำให้ Quiz ถูกจัดหมวดผิด

### หลักการใหม่
- สถานะสุดท้ายของแถวเป็นฐานสำหรับคอมเมนต์: ถ้าแถวเอกสาร `pass/pass_tolerance` จะไม่สร้างคำสั่งแก้จากลิงก์ส่วนเกินที่เสียหาย
- แยก action เป็น `pre_test` และ `post_test` พร้อม session ของแต่ละประเภท
- `legacyVideoCoverage` ส่งคืน `failedSessions` และ summary แสดงครั้งที่ไม่ผ่าน/รอยืนยันจริง; ไม่ใช้ “ภาพรวมรายวิชา” หรือ “ส่วนแนะนำรายวิชา” แทนตำแหน่ง
- ป้ายภาพ Pre/Post ที่ระบุชัดและอยู่กับกิจกรรมมีลำดับสูงกว่า adjacent text label ทั่วไป
- คงกฎเดิมว่าการอัปโหลดวิดีโอภายใน Moodle ต้องแจ้งย้ายไปลิงก์ภายนอก แม้คลิปภายนอกอื่นทำให้เวลารวมของแถวนั้นผ่านแล้ว

### การทดสอบและ Artifact
- Automated tests: **40/40**, fail 0
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.10.zip`
- Size: **9,520,807 bytes**, 134 entries
- SHA-256: `3F625631319BEA7317EE3EB7C7E7721252417D2BDEE1E8F14330ECC1D3849CC2`
- เปิด ZIP และตรวจ `manifest.json` แล้วเป็น version `0.3.10`
- รายงานเก่าจะไม่เปลี่ยนย้อนหลัง ต้อง Reload รุ่น 0.3.10 และตรวจรายวิชานั้นใหม่เพื่อสร้างคอมเมนต์ชุดใหม่
- Backport กฎลำดับป้าย Pre/Post ไป Dashboard **0.13.23** และ Local **0.13.20** แล้ว; ทั้งสองรุ่นผ่าน tests **36/36** และตรวจ manifest ใน ZIP แล้ว
- Dashboard ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.23.zip` — 9,351,274 bytes, 120 entries, SHA-256 `F673D93631191459F68DCF328F755189A4F98D5F44CDE4449C5B514A43CA93EC`
- Local ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-0.13.20.zip` — 9,343,248 bytes, 120 entries, SHA-256 `C4DEDB26CD712215B54093159A471B237C8E465289D1E85F050F1D00C4E8C19D`
- ส่วน teacher summary เป็นหน้ารายงานเฉพาะ Legacy จึงไม่คัดลอก UI ไปอีกสองรุ่นโดยตรง

## 50. PHY212 — Pre-test แบบคำสั่งข้อความและ Post-test แบบไฟล์ (2026-11-05)

**สถานะ: แก้ครบสามรุ่น / tests ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### ข้อตัดสิน
- ข้อความครั้งที่ 13 ที่ระบุ `Pre-test` และสั่งให้นักศึกษาทำกิจกรรมโดยตอบคำถาม นับเป็น Pre-test ได้ เพราะมีทั้งประเภทและการตอบสนองที่ผู้เรียนต้องทำ ไม่ใช่มีเพียงหัวข้อเปล่า
- ไฟล์ `แบบทดสอบอัตนัย...` ที่อยู่ใต้ป้าย Post-test โดยตรง นับเป็น Post-test แม้เป็น Moodle Resource/PDF เพราะ MIME เป็นเพียงรูปแบบส่งมอบ ส่วนป้ายท้องถิ่นที่ชัดเจนกำหนดหมวดการประเมิน
- เอกสาร PDF ทั่วไปใต้ป้ายที่คลุมเครือยังคงเป็นเอกสารประกอบ ไม่ถูกยกเป็น Pre/Post โดยอัตโนมัติ

### Regression และ Artifact
- Local Legacy **0.3.11**: tests 40/40; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.11.zip`; 9,521,322 bytes; SHA-256 `9B6D3550F75DAD486A9870CB2FF2D8F12A2E62A6B3490115B44FEAC7F1629659`
- Dashboard **0.13.24**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.24.zip`; 9,351,534 bytes; SHA-256 `38B473F8BD1137ADD97A4CD44E91F323F9E856D32EC25DD9791EB96826207D6B`
- Local **0.13.21**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-0.13.21.zip`; 9,343,497 bytes; SHA-256 `01456A42A45F2C1CF97FC1736058E85616EEDF0F8F7FD2CCB17E3A8FACBC5458`
- เปิด ZIP ทั้งสามและตรวจ `manifest.json` แล้วตรงกับเลขรุ่น
- ต้อง Reload รุ่นใหม่และตรวจ PHY212 ใหม่ รายงานเดิมไม่แก้ย้อนหลัง

## 51. Guard ป้องกันข้อความทั่วไปถูกนับเป็น Pre/Post (2026-11-05)

**สถานะ: แก้ครบสามรุ่น / regression ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### เงื่อนไขที่ต้องครบ
- มีป้ายหรือหัวข้อ Pre-test/Post-test ที่อยู่ในบริบทเดียวกับหลักฐาน
- มีประโยคสั่งให้ผู้เรียนลงมือทำจริง
- มีอย่างน้อยหนึ่งสัญญาณยืนยันงาน: โจทย์เฉพาะ/การคำนวณ/คำถามเชิงรูปธรรม, คะแนน, URL หรือข้อความลิงก์/ช่องทางตอบและส่งงาน
- คำทั่วไป เช่น `Pre-test`, `ตอบคำถาม`, `กิจกรรม`, ข้อความอธิบาย หรือข้อความเตรียมตัว เพียงอย่างเดียวไม่นับ
- ตัวอย่าง PHY212 ครั้งที่ 13 ยังนับ เพราะมี `Pretest` + คำสั่งตอบคำถาม + `Link ที่วางไว้`

### Regression และ Artifact
- เพิ่ม negative regression สำหรับข้อความบรรยายทั่วไปและข้อความกิจกรรมกำกวมที่ไม่มีโจทย์ คะแนน หรือลิงก์
- Local Legacy **0.3.12**: tests 40/40; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.12.zip`; 9,521,942 bytes; SHA-256 `C00B606F9FF4DD62BFCD14E81663743E61FDE0648B06C107C1346C69617093B0`
- Dashboard **0.13.25**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.25.zip`; 9,351,630 bytes; SHA-256 `9D4E437B800C139FBD9C89DF5FA767A4D667A3EA470C49382B3DAE7772418566`
- Local **0.13.22**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-0.13.22.zip`; 9,343,595 bytes; SHA-256 `32CE07A301E69544BE7BEEC203BBA161B3AF01682EFF5238806A247C8492791B`
- เปิด ZIP ทั้งสามและตรวจ manifest/version แล้ว

## 52. แก้ความเข้าใจ Guard Pre/Post: เป็นหลายเส้นทางทางเลือก ไม่ใช่ข้อบังคับ 3 ชั้น (2026-11-05)

**สถานะ: แก้ครบสามรุ่น / tests ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### กติกาที่ถูกต้อง
- ไม่บังคับให้ผู้สอนต้องมี `ป้าย + คำสั่ง + ลิงก์/คะแนน/ไฟล์` ครบพร้อมกัน
- เส้นทางที่นับได้เป็นทางเลือก ได้แก่ (1) ชื่อกิจกรรมระบุ Pre/Post ชัดเจน (2) กิจกรรม/ไฟล์อยู่ใต้ป้าย Pre/Post ที่ยืนยันตำแหน่งได้ หรือ (3) ข้อความระบุ Pre/Post และเป็นประโยคคำสั่ง/กิจกรรมที่ให้ผู้เรียนลงมือทำจริง
- เส้นทางข้อความไม่บังคับลิงก์ คะแนน หรือไฟล์โจทย์ หากภาษาระบุชัดว่าผู้เรียนต้องทำกิจกรรม/แบบทดสอบ/ตอบคำถาม
- Guard มีหน้าที่ตัดเฉพาะข้อความบรรยายทั่วไป การกล่าวถึงคำว่า Pre/Post หรือการตอบคำถามแบบไม่มีลักษณะเป็นคำสั่ง/กิจกรรม ไม่ใช่กำหนดรูปแบบการสร้างรายวิชา

### Regression และ Artifact
- ทดสอบ title-only, local-label, text instruction แบบไม่มีลิงก์ และข้อความบรรยายที่ต้องไม่ถูกนับ
- Local Legacy **0.3.13**: tests 40/40; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.13.zip`; 9,522,170 bytes; SHA-256 `832B6595647E829C4EE1FE495A48071DE0D55B7095FEA63589CE30CA19B7924B`
- Dashboard **0.13.26**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.26.zip`; 9,351,712 bytes; SHA-256 `C945009F597F609AB0AB5C2409F830842B84BF84CECD98057EC22BAB35C0E3D5`
- Local **0.13.23**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-0.13.23.zip`; 9,343,674 bytes; SHA-256 `A028C032912CA42ED281E61BD6D4F492FD8DC516EF5E7A174F572D7A904A7629`

## 53. ป้าย Pre/Post ห้ามทับเอกสารประกอบและไฟล์เฉลย (2026-11-05)

**สถานะ: แก้ครบสามรุ่น / tests ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### กติกา
- ชื่อรายการที่ชัดว่าเป็น `เอกสารประกอบ`, แผน, `เฉลย`, `แนวทางตอบ`, `Answer Key` หรือ `Solution` ต้องคงเป็นไฟล์เอกสาร แม้อยู่ใกล้ข้อความหรือป้าย Pre/Post
- เฉพาะไฟล์คำถาม/แบบทดสอบจริงที่ชื่อมีลักษณะ assessment และอยู่ใต้ป้าย Pre/Post ที่ยืนยันตำแหน่งได้จึงรับหมวดจากป้ายนั้น
- กฎนี้แก้ false positive จาก PHY212: `เอกสารประกอบการสอนครั้งที่ 2 : ทบทวนพื้นฐานก่อนเรียน...` และ `เฉลยแนวทางตอบแบบทดสอบ...` ไม่เป็น Quiz อีกต่อไป

### Regression และ Artifact
- Local Legacy **0.3.14**: tests 40/40; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.14.zip`; 9,522,700 bytes; SHA-256 `6AB94005661967F45D30A83282F37053DC0680AF5AA651F0A3D0113AFCEE023F`
- Dashboard **0.13.27**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.27.zip`; 9,352,043 bytes; SHA-256 `8D3D195050FD6C3DC282E54F623B83F9DD23A3DC2743E5C9382A78FC7FC54545`
- Local **0.13.24**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-0.13.24.zip`; 9,344,010 bytes; SHA-256 `9CC0E0D00B29CF2A202DC35DB7AE5DF36F66C3DDC826BC63398064EDA5658290`

## 54. ล็อกหัวข้อรายงานผู้สอนเป็น “ผลการตรวจ” (2026-11-05)

**สถานะ: Local Legacy แก้แล้ว / tests 40/40 ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

- การ์ดบนสุดของรายงานผู้สอนแสดงหัวข้อคงที่ `ผลการตรวจ`
- ลบข้อความเปิดเผยเกณฑ์คะแนนภายใน, 80%, สูตรทฤษฎี/ปฏิบัติ และองค์ประกอบบังคับออกจากการ์ดและข้อความสรุปผู้สอน
- สถานะยังแสดง `ผ่าน / ไม่ผ่าน / ต้องตรวจทาน` พร้อมข้อความกลาง เช่น `ผลการตรวจผ่าน` หรือ `โปรดตรวจสอบรายการที่ต้องแก้ไขด้านล่าง`
- การคำนวณและข้อมูลคะแนนหลังบ้านไม่เปลี่ยน
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.15.zip`; 9,522,504 bytes; 134 entries; SHA-256 `31E9A26E257893E5FC85F7222601AEC6A406E6DC284E3CFE5B14935F5950A5B2`

## 55. กิจกรรมท้ายบทแบบเตรียม/พิมพ์/สแกน WORKSHEET (2026-11-05)

**สถานะ: แก้ครบสามรุ่น / tests ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

- คำสั่งใต้ป้ายกิจกรรมท้ายบทที่ให้ผู้เรียนเตรียม พิมพ์ ปริ้นท์ พริ้นท์ หรือสแกน WORKSHEET/ใบงาน ถือเป็นกิจกรรมท้ายบท แม้ไม่มี Moodle Assignment แยก
- ต้องมีคำสั่งที่ผู้เรียนต้องลงมือทำ; การกล่าวถึง WORKSHEET หรือเอกสารเฉย ๆ ไม่นับ
- ไฟล์ PDF/เอกสารที่วางใต้คำสั่งยังคงเป็นเอกสารประกอบ ไม่ถูกเปลี่ยนชนิดเป็น Assignment; ตัวกิจกรรมเกิดจากคำสั่งข้อความ
- Local Legacy **0.3.16**: tests 40/40; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.16.zip`; 9,522,916 bytes; SHA-256 `DAA864DCD3A4549C86948DC19896CFDECE08B062FD372D00BF3FE8F1984CF77B`
- Dashboard **0.13.28**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.28.zip`; 9,352,288 bytes; SHA-256 `2B2597EFAB2271F3D0070EE30514954535BD20F50925C1952AB4BE517DA71F6B`
- Local **0.13.25**: tests 36/36; ZIP `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-0.13.25.zip`; 9,344,254 bytes; SHA-256 `7B3E738E33B23B995D3EAB959343A19F5CB15904736B8D9C69614FBB269F6BDD`


## 56. Local Legacy 0.3.17 — เพิ่ม GN แบบตัด Podcast และ AI Tutor (2026-11-05)

**สถานะ: แก้ source แล้ว / tests 40/40 ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy / Apps Script ต้องสร้าง Deployment รุ่นใหม่ก่อนดึง GN ผ่านบริการเดิม**

- เพิ่ม `GN` ในหน้าคิว การเพิ่มด้วยมือ การนำเข้า JSON การอ่าน Google Sheet โดยตรง และ Apps Script catalog
- เกณฑ์ GN ครั้งที่ 1: ข้อมูล/รูปผู้สอนและช่องทางติดต่อ, เอกสารประกอบการสอน, วิดีโอแนะนำหรือบันทึกการสอน
- เกณฑ์ GN ครั้งที่ 2–15: แผนการจัดการเรียนการสอน, เอกสารประกอบการสอน, วิดีโอบันทึกการสอนล่วงหน้า
- ตัด Podcast และ AI Tutor ออกจากแถวตรวจ ข้อความแนะนำผู้สอน งานรอยืนยัน และผลผ่าน–ไม่ผ่านของ GN; หลักฐานประเภทดังกล่าวอาจยังอยู่ในภาคผนวกหลักฐาน แต่ไม่ถูกเปิดตรวจปลายทางและไม่คิดผล
- GN ไม่ใช้คะแนน 100/110: ตัดสินด้วย checklist และความครอบคลุมวิดีโอ โดยทฤษฎีต้องผ่านครบ 15 ครั้ง ปฏิบัติต้องผ่านอย่างน้อย 7 ครั้ง; วิดีโอ GN ใช้ 15 นาทีต่อหน่วยกิตและค่าผ่อนปรนตามกฎ GN เดิม
- แก้ผลตัดสิน backend ให้ GN สามารถได้ `pass/fail/needs_review` จริง ไม่ค้างสถานะ “รอผู้ตรวจสรุป” และทำให้การยืนยันผล/ส่งหลักฐานใช้สถานะเดียวกับหน้ารายงาน
- Apps Script `getCatalog_` รองรับ Course Profile `683GN-...` และ service version เพิ่มเป็น 3; ถ้ายังใช้ Web app deployment เก่า บริการจะยังไม่ส่ง GN จนกว่าจะสร้าง Deployment รุ่นใหม่
- Regression ครอบคลุม GN theory/practical ผ่าน–ไม่ผ่าน–ต้องตรวจทาน, รายงาน/PDF ไม่มี Podcast/AI Tutor เป็นเกณฑ์, queue มีตัวเลือก GN, Sheet parser รับ GN และ Apps Script regex รับ GN
- Tests: **40/40**, fail 0
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.17.zip`
- Size: **9,524,186 bytes**, 134 entries
- SHA-256: `4A9C82AF501E0A52B33531FCF9177BE9D92C93B97B77D06C5F4704C0019A0B2C`
- เปิด ZIP จริงและยืนยัน `manifest.json` เป็น version `0.3.17`, ตัวเลือก GN อยู่ใน `queue.html`, GN checklist ไม่มี Podcast/AI Tutor, rubric เป็น `GN-CLASSROOM-CHECKLIST-1.0` และ Apps Script มี `(GN|GR|GS)`


## 48. Local Legacy 0.3.9 — เกณฑ์คะแนนเฉพาะวิชาปฏิบัติ (2026-11-04)

**สถานะ: แก้ source แล้ว / tests 40/40 ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### เหตุผลและขอบเขต
- ผลที่ประกาศก่อนหน้านี้ไม่มีวิชาปฏิบัติ จึงไม่กระทบผลผ่านเดิม
- วิชาทฤษฎียังคงสูตรเดิม 100 คะแนน ผ่านที่ 80
- วิชาปฏิบัติใช้สูตรใหม่ 50 คะแนน ผ่านที่ 40 แต่ต้องผ่านองค์ประกอบบังคับด้วย การหารคะแนนเดิมครึ่งหนึ่งอย่างเดียวไม่ใช้ เพราะไม่ปิดช่องโหว่

### สูตรวิชาปฏิบัติ
- ข้อมูลรายวิชาและผู้สอน 5 คะแนน (อย่างละ 2.5)
- แผนการสอน 7.5 คะแนน
- เอกสารประกอบ 7.5 คะแนน
- วิดีโอ 7.5 คะแนน
- Pre-test 5 คะแนน และ Post-test 5 คะแนน
- กิจกรรม/งานปฏิบัติ 12.5 คะแนน
- รวม 50 คะแนน ผ่านที่ 40 คะแนน (80%); คะแนนองค์ประกอบปัดเป็นช่วง .5 และเปอร์เซ็นต์สุดท้ายเป็นจำนวนเต็ม

### องค์ประกอบบังคับ
- ข้อมูลผู้สอนครบ
- แผนการสอนอย่างน้อย 12/15 ครั้ง
- เอกสารประกอบอย่างน้อย 12/15 ครั้ง
- วิดีโอผ่านอย่างน้อย 7/15 ครั้ง
- Pre-test อย่างน้อย 7/14 ครั้ง และ Post-test อย่างน้อย 7/14 ครั้ง
- กิจกรรมปฏิบัติอย่างน้อย 7/15 ครั้ง
- คะแนนถึง 40 อย่างเดียวไม่พอ หากองค์ประกอบบังคับข้อใดไม่ผ่าน ผลยังเป็นไม่ผ่าน

### Regression สำคัญ
- กรณีเทียบเท่า CEG111: วิดีโอผ่าน 7 ครั้ง, แผน/เอกสาร/กิจกรรมครบ แต่ไม่มีข้อมูลผู้สอนและไม่มี Pre/Post ได้ 37.5/50 = 75% และไม่ผ่าน
- กรณีได้ 40/50 แต่ไม่มี Pre/Post ยังไม่ผ่านเพราะติด mandatory gate
- วิชาทฤษฎี full-score ยังคง 100/100 และเส้นทางตัดสินเดิม
- รายงานผู้สอนไม่แสดงตัวเลขคะแนน แต่ระบุว่าใช้เกณฑ์วิชาปฏิบัติ 80% พร้อมองค์ประกอบบังคับ
- rubric ในรายงานเป็น `GR/GS-LEGACY-PRACTICAL-50-1.0` สำหรับวิชาปฏิบัติ และคง `SCORE-100-1.0` สำหรับทฤษฎี

### Artifact
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.9.zip`
- Size: **9,519,707 bytes**, 134 entries
- SHA-256: `596BC8E15E5676BC31B75E715F9C5BA2EEC969B6C993A066C4B195E5C89F37F6`
- เปิด ZIP จริงและตรวจ `manifest.json` แล้วเป็น version `0.3.9`
- ยังไม่ได้อัปโหลด GitHub หรือ Deploy; ต้อง Load/Reload รุ่น 0.3.9 และตรวจ CEG111 ใหม่เพื่อให้รายงานใช้สูตรใหม่
- รายงานและงานยืนยันที่สร้างไว้ก่อนอัปเดตจะไม่เปลี่ยนย้อนหลัง ต้อง Reload/Load Unpacked รุ่น 0.3.8 แล้วตรวจรายวิชาที่เกี่ยวข้องใหม่
- ประเด็นการตัดสินผ่านแบบคะแนนจากหัวข้อ 45 แก้แล้วใน 0.3.8 รอบล่าสุด; ประเด็นชนิดวิชา PHY121 `(L)-(L)` ต้องตรวจข้อมูลต้นทาง/การอนุมาน suffix แยก และห้ามลดผลที่ประกาศผ่านแล้ว


## 47. Backport ระบบตรวจร่วมสู่ Dashboard 0.13.22 และ Local 0.13.19 (2026-11-04)

**สถานะ: แก้ source แล้ว / Dashboard tests 36/36 ผ่าน / Local tests 36/36 ผ่าน / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### ขอบเขตและหลักการแยกรุ่น
- ย้ายเฉพาะกติกาตรวจหลักฐานที่ใช้ร่วมกันจากรอบ Local Legacy ไปยัง Dashboard และ Local โดยไม่ยกเกณฑ์คะแนน Legacy 100/80 หรือรูปแบบรายงาน Legacy มาปะปน
- Dashboard และ Local ยังคงระบบประเมินเดิม 110 คะแนน ผ่านที่ 80 และพฤติกรรมการเก็บ/ส่งผลของแต่ละรุ่นตามเดิม
- การแก้ทำแบบ marker-by-marker ไม่แทนไฟล์ทั้งก้อน เพื่อรักษาความสามารถที่ Dashboard/Local มีใหม่กว่า Legacy และลดโอกาส regression

### สิ่งที่ย้ายไปทั้ง Dashboard และ Local
- รองรับ `ก่อนการเรียน/หลังการเรียน` เพิ่มจาก `ก่อนเรียน/หลังเรียน`; ป้าย Pre/Post ที่ยืนยันว่าอยู่ติดรายการจริงชนะชื่อแบบทดสอบที่คัดลอกผิด
- URL ชื่อแบบทดสอบทั่วไปที่ไม่มีป้าย Pre/Post ชัดเจนถูกจัดเป็นกิจกรรมท้ายบท ไม่ถูกนับเป็น Pre/Post โดยอัตโนมัติ
- ความผ่อนปรนเวลาวิดีโอตามหน่วยกิต: 1 หน่วยกิต 5 นาที, 2 หน่วยกิต 10 นาที, 3 หน่วยกิตขึ้นไป 20 นาที; เวลา 0:00 ห้ามผ่านแบบผ่อนปรน
- Google Photos ที่ยืนยันว่าอัลบั้มว่างหลังรีเฟรชตรวจซ้ำเป็น `empty_media` และไม่สร้างงานผู้ตรวจ
- หน้าเว็บทุกแพลตฟอร์มที่เปิดได้แต่ไม่มีตัวเล่นจริง ต้องคงที่ 3 probe ต่อแท็บและยืนยัน 2 แท็บ จึงเป็น `no_video`; spinner, หน้าไม่ complete, ปัญหาเครือข่าย และตัวครอบ player จะยกเลิกการสรุปนี้เพื่อป้องกันผลลบเท็จจากเน็ตช้า
- ข้อมูลผู้สอนที่พบรูป ชื่อ และช่องทางติดต่อครบ ตัดสิน `complete` อัตโนมัติ; เมื่อสแกน DOM+OCR จบรอบแล้วและหลักฐานไม่ครบ ตัดสิน `missing` แทนการทิ้งเป็นงานค้างผู้ตรวจ
- รักษาการใช้ผลยืนยันสื่อเดิมจาก fingerprint/ปลายทางเดิมของแต่ละรุ่น; definitive failure เช่น `empty_media` และ `no_video` ไม่สร้างงานยืนยันซ้ำ

### การปรับเฉพาะรุ่น
- **Dashboard 0.13.22:** รักษาการตรวจหน้าแชท AI ที่มีอยู่แล้ว, การส่ง Supabase, ระบบคิวกลาง และการแสดงคะแนนตามสิทธิ์เดิม
- **Local 0.13.19:** เพิ่มตัวตรวจ AI Tutor ให้เทียบเท่า Dashboard; SPU AI/SPU-KM ผ่านได้จากโดเมนที่มหาวิทยาลัยอนุมัติโดยไม่บังคับล็อกอิน ส่วน ChatGPT, Poe, Gemini, Copilot, Claude, Perplexity, Character AI, Botpress, Chatbase, Voiceflow, Dify/Udify และ Coze ต้องพบโครงสร้างหน้าแชทจริงก่อนผ่าน
- Local ยังเก็บผลในเครื่องและส่งออกไฟล์ตามเดิม ไม่มีการเพิ่มการส่งข้อมูลไป Supabase

### การประหยัดโควตาและเวลา
- ใช้กฎ deterministic จาก DOM/ชื่อ/ป้ายก่อน ไม่เรียกบริการ AI ภายนอกเพื่อจัดประเภท
- เปิดปลายทางเพิ่มเฉพาะรายการที่ต้องยืนยันสื่อหรือหน้าแชท; SPU AI ที่เชื่อถือได้ไม่เปิดแท็บเพื่อล็อกอิน
- การยืนยัน 2 แท็บใช้เฉพาะกรณีที่หน้าเปิดได้แต่ไม่มีตัวเล่นและผ่านเงื่อนไขสะอาดครบ; หน้าเสีย/ติดสิทธิ์/อัลบั้มว่างใช้เส้นทางสั้นกว่า
- คง cache/fingerprint ของผลเดิมเพื่อไม่ให้ผู้ตรวจยืนยัน Podcast/วิดีโอซ้ำเมื่อปลายทางไม่เปลี่ยน

### การทดสอบ
- Dashboard automated tests **36/36**, fail 0
- Local automated tests **36/36**, fail 0
- Regression ใหม่ครอบคลุม: Pre/Post ภาษาไทยแบบมีคำว่า `การ`, แบบทดสอบทั่วไปเป็นกิจกรรมท้ายบท, Google Photos อัลบั้มว่าง, no-player stable probe, การยกเลิกเมื่อโหลด/เน็ต/ตัวเล่นยังอยู่, ข้อมูลผู้สอน complete/missing/pending, ความผ่อนปรน 5/10/20 นาที และ guard 0:00
- Local เพิ่ม AI chat tests ครอบคลุม trusted SPU AI, ผู้ให้บริการภายนอก, หน้า marketing ที่ไม่ใช่แชท และสิทธิ์โดเมนใน manifest

### Artifact
- Dashboard ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.22.zip`
- Dashboard size: **9,351,116 bytes**, 120 entries, version `0.13.22`
- Dashboard SHA-256: `F11D0A48ABA9188D3F2B01FE0AF13BC998DA89DD66A43F6FD8D42EC89FE05266`
- Local ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-0.13.19.zip`
- Local size: **9,343,090 bytes**, 120 entries, version `0.13.19`
- Local SHA-256: `6F3657B7F7ABF207E7380010717A604D3AC9D4D01EB691CFBAC72E25A9141B70`
- เปิด ZIP จริงและอ่าน `manifest.json` ภายในแล้วทั้งสองไฟล์
- ยังไม่ได้อัปโหลด GitHub หรือ Deploy; ห้ามกล่าวว่าเผยแพร่แล้วจนกว่าจะอัปโหลดและตรวจ URL ดาวน์โหลดจริง


## 58. Dashboard — ใช้ผลยืนยันเดิมโดยไม่สร้างงานซ้ำ (2026-11-09)

**สถานะ: แก้ backend และ Deploy Supabase Edge Function แล้ว / tests 34/34 ผ่าน / แก้ผลล่าสุด SOC119 แล้ว**

### อาการและสาเหตุ
- SOC119 เคยยืนยันผลรอบ Auditor 0.13.16 แล้ว ได้ 93/110 และผ่าน แต่รอบ 0.13.28 กลับเป็น 76/110 `needs_review` และขอให้ผู้ตรวจยืนยัน 17 คะแนนซ้ำ
- ผลยืนยันรุ่นเดิมเก็บเป็น `reviewConfirmation.decisions` ระดับ criterion ซึ่งผูกกับเลขครั้ง/เลขหัวข้อ
- ตัวจัด Section รุ่นใหม่ย้ายหลักฐานเดิมไปอยู่คนละเลขครั้ง จึงทำให้ key เดิมไม่ตรง ทั้งที่ปลายทางหลักฐานเดิมยังอยู่ครบ
- backend เดิมรองรับการใช้ซ้ำเฉพาะ `evidenceDecisions` รายลิงก์จากรุ่นใหม่ และค้นเฉพาะ run ก่อนหน้าทันที จึงไม่พบผลยืนยันเก่าหากมี run `needs_review` คั่นอยู่

### การแก้ไขถาวร
- ค้นย้อนสูงสุด 10 run และเลือก run ล่าสุดที่มีผลยืนยันเสร็จสมบูรณ์ ไม่ให้ run รอตรวจที่คั่นอยู่บังผลเดิม
- canonicalize URL โดยตัด tracking parameters (`utm_*`, `fbclid`, `gclid`, `si`, `feature`, `t`, `nav`, `ga`, `referrer`, `referrerscenario`, `usp`) แต่รักษาตัวระบุปลายทางจริง เช่น SharePoint `id`
- ใช้ผลเดิมเมื่อ score envelope ก่อนยืนยันตรงกัน (`confirmedScore`, `possibleScore`, `threshold`) และหลักฐานปลายทางทุกตัวที่เคยยืนยันยังอยู่ครบ
- ยอมรับหลักฐานใหม่ที่เพิ่มเข้ามาโดยไม่ล้างผลยืนยันเดิม แต่หากปลายทางเดิมหายหรือเปลี่ยน หรือ score envelope เปลี่ยน จะไม่ใช้ผลเดิมอัตโนมัติ
- เก็บ `reviewReuseEnvelope`, `priorReviewReuse`, `reusedFromRunId`, `reusedAt` และ `reuseBasis` ใน payload เพื่อให้ตรวจสอบย้อนหลังและใช้ซ้ำต่อเนื่องในรอบถัดไปได้
- ทำ reuse ก่อนคำนวณ publication gate และก่อนบันทึก run เพื่อให้ `reviewable_points=0`, สถานะ และผลเผยแพร่สอดคล้องกัน

### การแก้ข้อมูล SOC119
- เทียบ run เดิม `3fc5a93f-8f5c-44a9-90f0-b336fd641bd1` กับ run ล่าสุด `5893ba7f-36af-4651-b2c9-dc3ccaf53f9d`
- score envelope ตรงกัน: 76/93 ผ่านที่ 80 และหลักฐานปลายทางเดิมไม่หายแม้มีหลักฐานใหม่เพิ่ม
- แก้ run ล่าสุดเป็น 93/110, `pass`, `reviewable_points=0` และตั้งเป็น published run ล่าสุดแล้ว จึงไม่ควรปรากฏเป็นงานรอตรวจอีก

### การตรวจสอบ
- Dashboard tests ผ่าน **34/34**, fail 0
- Supabase Edge Function `api` deploy เป็น version **40** และสถานะ ACTIVE
- ฐานข้อมูลยืนยัน SOC119 ล่าสุดเป็น `pass`, score 93 และ published run เป็น run วันที่ 9 พฤศจิกายน 2569


## 59. Dashboard 0.13.28 — ข้อมูลผู้สอนครบต้องผ่านอัตโนมัติ (2026-11-09)

**สถานะ: แก้ Extension + backend + หน้าหลักฐานแล้ว / Deploy Edge Function แล้ว / ซ่อมผลล่าสุดแล้ว / ZIP 0.13.28 เผยแพร่ใหม่แล้ว**

### สาเหตุ
- `checklistForWeek()` สร้าง `instructorResult` ถูกต้องจาก `identityComplete && contactComplete` แล้ว
- แต่เส้นทาง GR/GS ครั้งที่ 1 กลับใส่ `result("needs_review", instructorDetail)` แบบค่าคงที่แทน `instructorResult`
- จึงเกิดผลขัดแย้ง: รายละเอียดเขียนว่า `พบข้อมูลผู้สอนครบอัตโนมัติ` แต่สถานะยังเป็น `รอตรวจ` และหน้า Dashboard แสดงปุ่มให้ผู้ตรวจตัดสิน
- หน้า `audit-evidence.js` ยังแสดงปุ่มตัดสิน criterion แม้สถานะรวมของ run ไม่ใช่ `needs_review` ทำให้เห็นปุ่มที่บันทึกไม่ได้ในผล `has_content`

### การแก้ไข
- Extension ใช้ `instructorResult` จริงในแถวข้อมูลผู้สอนครั้งที่ 1 ของ GR/GS
- Backend `resolveAutomaticInstructorCriterion()` ตรวจ `identityComplete`, `contactComplete`, `hasInstructorPhoto`; หากครบจะเปลี่ยน criterion 1:2 เป็น `pass`, ตัดออกจาก `reviewableCriteria`, คืนคะแนนยืนยัน 1 คะแนน และคำนวณสถานะใหม่ก่อนบันทึก
- หน้า Dashboard แสดงปุ่มยืนยัน criterion เฉพาะ run ที่มี `internalStatus=needs_review` เท่านั้น
- ซ่อมผลล่าสุดของ IGD211, IGD371 และ MAT320: เปลี่ยนข้อมูลผู้สอนเป็นผ่านอัตโนมัติ ตัดงานยืนยัน และคืนคะแนนหลังบ้านวิชาละ 1 คะแนน

### การตรวจสอบและ Artifact
- Extension tests ผ่าน **41/41**, fail 0
- Dashboard tests ผ่าน **35/35**, fail 0
- เปิด ZIP จริงและรัน tests จากไฟล์ที่แตกออกมาแล้วผ่าน **41/41**
- ZIP `SPU-Learning-Auditor-Dashboard-0.13.28.zip`: 120 entries, 9,352,449 bytes
- SHA-256: `7E1C1BABE6DA741686C57E0FFD3C1FF69F7DA2160F922089CC772BAD736951BE`
- Supabase Edge Function `api` version **41**, ACTIVE
- GitHub release commit: `3192ef0cc4b08637ed5592481cad1bc095d9be92`


## 60. Dashboard — คืนการยืนยันตารางที่ 3 และรักษา 5 ข้อ (2026-11-09)

**สถานะ: แก้หน้า Dashboard + backend แล้ว / tests 36/36 ผ่าน / Deploy Edge Function แล้ว**

### อาการ
- หลังปิดงานข้อมูลผู้สอนอัตโนมัติ หน้า evidence ซ่อนปุ่มยืนยันทั้งหมดเมื่อสถานะรวมเป็น `has_content` แม้ยังมีคะแนนตารางที่ 3 รอผู้ตรวจ
- `reviewCandidates()` รวม criterion ก่อน manual แล้วตัดรายการด้วย `.slice(0,count)` เมื่อจำนวนคลาดเคลื่อน 1 ข้อจึงตัด manual ตัวท้ายสุด คือ `การสำรองเนื้อหา`

### การแก้ไข
- ตารางที่ 3 แสดงครบ 5 ข้อเสมอ: การพบนักศึกษา, คุณภาพวิดีโอ, การวางสื่อ, การส่งงาน, การสำรองเนื้อหา
- กันพื้นที่ 5 ข้อ manual ก่อนจำกัดจำนวน criterion ทั้งในหน้าเว็บและ backend จึงไม่ตัดข้อที่ 5 จากท้ายรายการอีก
- เปิดปุ่ม `ผ่าน/ไม่ผ่าน` และแผงยืนยันสำหรับทั้ง `needs_review` และ `has_content` เมื่อ `possibleScore > confirmedScore`
- backend อนุญาตการบันทึกผลของ `has_content` ที่ยังมี `reviewable_points > 0`; หลังยืนยันครบจะคำนวณคะแนนและสถานะใหม่ตามเกณฑ์เดิม
- เปลี่ยนหัวข้อเป็น `ตารางที่ 3 — ข้อกำหนดภาพรวมที่ผู้ตรวจยืนยัน` และระบุชัดว่ามีครบ 5 ข้อ

### การตรวจสอบ
- Dashboard tests ผ่าน **36/36**, fail 0
- Supabase Edge Function `api` version **42**, ACTIVE


## 61. Dashboard 0.13.28 — SharePoint `.m4a` และสถานะข้อมูลผู้สอน (2026-11-09)

**สถานะ: แก้ Extension + backend แล้ว / tests ผ่าน / Deploy Edge Function และเผยแพร่ ZIP ใหม่แล้ว**

### อาการและสาเหตุ
- SharePoint Stream ใช้โครงตัวเล่น `<video>` ร่วมกันทั้งไฟล์ภาพและไฟล์เสียง ทำให้ Podcast ที่ชื่อไฟล์จริงลงท้าย `.m4a` ถูกจัดเป็นวิดีโอและไม่เปิดช่องยืนยันเวลา
- การคำนวณคะแนนข้อมูลผู้สอนใช้ `identityComplete && contactComplete` แต่ตัวปิดงานผู้ตรวจยังบังคับ flag รูปอีกชุดหนึ่ง จึงเกิดกรณีคะแนนเพิ่มและข้อความบอกว่าพบครบ แต่สถานะยังค้าง `รอตรวจ`
- payload บางรุ่นเปลี่ยน criterion เป็นผ่านแล้ว แต่ยังเก็บข้อมูลผู้สอนไว้ใน `reviewableCriteria` ทำให้ Dashboard ค้างสถานะรอตรวจโดยไม่ควรเพิ่มคะแนนซ้ำ

### การแก้ไข
- สำหรับ Google Drive, OneDrive และ SharePoint ให้ชื่อไฟล์จริงใน URL/พารามิเตอร์ที่ถอดรหัสแล้วเป็นหลักฐานชนิดสื่อที่มีน้ำหนักสูงกว่าตัวเล่นกลาง: `.m4a`, `.mp3`, `.wav`, `.ogg`, `.oga`, `.aac`, `.flac`, `.opus`, `.wma` เป็นเสียง และนามสกุลวิดีโอยังคงเป็นวิดีโอ
- เมื่อตรวจหลาย frame ให้ frame ที่พบชื่อไฟล์เสียงหรือวิดีโอชัดเจนชนะ frame `<video>` ทั่วไปของผู้ให้บริการ
- backend ปรับชนิดกิจกรรมจากนามสกุลไฟล์เสียงซ้ำอีกชั้นก่อนบันทึกผล เพื่อกันข้อมูลผิดจากส่วนขยายรุ่นเก่า
- ข้อมูลผู้สอนถือว่าผ่านอัตโนมัติเมื่อ `identityComplete`, `contactComplete` และ `reviewStatus=evidence_found` (หรือมี flag รูปผู้สอน) จากนั้นเปลี่ยน criterion เป็นผ่านและลบงานยืนยันข้อมูลผู้สอนออก
- รายงานเดิมที่หลักฐานครบจะคำนวณสถานะแถวและสีของกล่องจากผลอัตโนมัติทันที พร้อมซ่อนตัวเลือกยืนยันข้อมูลผู้สอนที่ไม่จำเป็น
- ป้องกันคะแนนซ้ำ: เพิ่ม 1 คะแนนเฉพาะเมื่อ criterion เดิมยังเป็น `needs_review`; หากคะแนนขึ้นแล้วแต่ `reviewableCriteria` ค้าง จะลบเฉพาะงานค้างและคำนวณสถานะใหม่

### การตรวจสอบและ Artifact
- Extension tests ผ่าน **41/41**, fail 0 ทั้ง source และ ZIP ที่แตกตรวจจริง
- Dashboard tests ผ่าน **37/37**, fail 0
- Supabase Edge Function `api` version **43**, ACTIVE
- ZIP `SPU-Learning-Auditor-Dashboard-0.13.28.zip`: 120 entries, 9,353,370 bytes
- SHA-256: `B03D7BE26D727099158BB044B3A5AB951A8B42D6C1BCC93102BCABAED291CD81`
- GitHub ZIP blob: `75e45ba1ea70c577dd549215afaf92b6c5c60304`
- GitHub release commit: `d8e218211f8f719bcf85eb4cb7c1a2548c4610ca`
- รายงานที่สร้างค้างไว้ก่อนติดตั้ง/Reload ส่วนขยายยังเก็บผลเดิม; ต้องตรวจรายวิชานั้นใหม่หนึ่งครั้งเพื่อให้กิจกรรม `.m4a` ถูกสร้างเป็น Podcast เสียงและให้สถานะข้อมูลผู้สอนถูกคำนวณใหม่


## 62. Dashboard 0.13.28 — แก้ไฟล์ ZIP ที่เผยแพร่เสียหาย (2026-11-10)

**สถานะ: พบสาเหตุแล้ว / เปลี่ยนเป็นตัวดาวน์โหลดที่ประกอบไฟล์และตรวจความถูกต้องก่อนบันทึก / tests 39/39 ผ่าน**

### อาการและสาเหตุ
- ZIP ที่หน้าเว็บชี้ไปดาวน์โหลดได้เพียง 9,097,242 bytes และแตกไม่ได้ โดยมี SHA-256 `91231CAB5161BCCF94BB6A0139171A6C3E38DC5570561E75FD22AADE19F77DEC`
- ไฟล์ใน GitHub blob ถูกตัดระหว่างอัปโหลด จึงไม่ใช่ปัญหาจาก Windows หรือโปรแกรมแตกไฟล์ของผู้ใช้
- ZIP ต้นฉบับที่ถูกต้องมี 9,353,370 bytes, 120 entries และ SHA-256 `B03D7BE26D727099158BB044B3A5AB951A8B42D6C1BCC93102BCABAED291CD81`

### การแก้ไข
- การทดสอบจาก GitHub Pages จริงพบว่าไฟล์ส่วนขนาดหลาย MB ยังถูกขั้นอัปโหลดตัดข้อมูล จึงไม่ปล่อยชุดนั้นให้ใช้งาน
- แบ่ง ZIP ต้นฉบับแบบ byte-for-byte เป็น 24 ส่วน: 23 ส่วนแรกส่วนละ 400,000 bytes และส่วนสุดท้าย 153,370 bytes เพื่ออยู่ต่ำกว่าขีดจำกัดที่ตรวจพบอย่างปลอดภัย
- เพิ่ม `download-extension.html` ให้ดาวน์โหลดทั้ง 24 ส่วน ประกอบกลับในเบราว์เซอร์ ตรวจขนาดทุกส่วน ตรวจขนาดรวม และตรวจ SHA-256 ก่อนสร้างไฟล์ `SPU-Learning-Auditor-Dashboard-0.13.28.zip`
- หากส่วนใดโหลดไม่ครบหรือ hash ไม่ตรง ระบบจะไม่ปล่อย ZIP เสียให้ผู้ใช้ และแสดงปุ่มลองใหม่
- ปุ่มดาวน์โหลด Extension ทุกจุดใน Dashboard เปลี่ยนมาที่หน้าดาวน์โหลดแบบตรวจสอบนี้

### การตรวจสอบ
- Dashboard tests ผ่าน **39/39**, fail 0
- ดาวน์โหลดทั้ง 24 ส่วนจาก GitHub Pages จริงแล้วได้ขนาดตรงทุกส่วน ประกอบกลับเป็น ZIP 9,353,370 bytes และ hash ตรงต้นฉบับทุก byte
- เปิด ZIP จากข้อมูลที่ดาวน์โหลดจริงได้ 120 entries, `manifest.json` เป็น 0.13.28 และตรวจ CRC ทุกไฟล์ผ่าน (`testzip()` ไม่พบไฟล์เสีย)
- test ตรวจว่าปุ่มใน HTML และ JavaScript ชี้ผ่านตัวดาวน์โหลดที่ตรวจ hash แล้ว
- GitHub Pages deploy run `42744789904` สำเร็จ; release commit `6fba7f27ce82067bb27003c53f1b9f1a79a93b3e`


## 63. Local Legacy 0.3.18 — แยกคะแนนเสริมและองค์ประกอบบังคับวิชาปฏิบัติ (2026-11-10)

**สถานะ: แก้ source แล้ว / tests source และ ZIP ผ่าน 44/44 / สร้างและตรวจ ZIP แล้ว / ยังไม่ได้อัปโหลดหรือ Deploy**

### เกณฑ์ที่ยืนยัน
- `ควรมี`: ข้อมูลผู้สอน แผน และเอกสารประกอบ มีแล้วได้คะแนน ไม่มีแล้วเสียเฉพาะคะแนน แต่ไม่เป็น gate ตัดสินไม่ผ่าน
- `ต้องมี`: VDO และ Pre/Post-test ต้องครบตามจำนวนขั้นต่ำที่เกณฑ์กำหนด
- `มีหรือไม่มีก็ได้`: กิจกรรมท้ายบทครั้งที่ 2–15 มีแล้วได้คะแนน ไม่มีแล้วไม่สร้างรายการแก้ไขและไม่เป็น gate
- ข้อยกเว้น: กิจกรรมท้ายบทครั้งที่ 1 เป็นองค์ประกอบบังคับ

### สาเหตุและการแก้
- รุ่น 0.3.9 เคยตีความตัวอย่าง `พบกิจกรรม 7 ครั้ง = 7 คะแนน` ผิดเป็น gate ว่าต้องพบอย่างน้อย 7 ครั้ง และเพิ่ม gate ของข้อมูลผู้สอน/แผน/เอกสารโดยไม่มีเกณฑ์รองรับ
- รุ่น 0.3.18 ลบ gate ที่เกินเกณฑ์ทั้งหมด เหลือเฉพาะ VDO, Pre-test, Post-test และกิจกรรมครั้งที่ 1
- คะแนนกิจกรรมยังคำนวณจากทั้ง 15 ครั้งตามเดิม จึงเป็นคะแนนเสริมโดยไม่บังคับครั้งที่ 2–15
- regression PHY222: คะแนน 40/50, วิดีโอผ่าน 7 ครั้ง, Pre/Post ผ่าน, มีกิจกรรมครั้งที่ 1 และมีกิจกรรมรวมเพียง 3 ครั้ง ต้องได้ `pass`
- regression ตรงข้าม: คะแนน 40/50 แต่ไม่มีกิจกรรมครั้งที่ 1 ต้องได้ `fail`

### Artifact
- Source: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.18`
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Local-Legacy-0.3.18.zip`
- ZIP size: **9,524,820 bytes**, 134 entries
- SHA-256: `F294811725E928E348E3A9D7357974B113BE0063817E00EEC9EDA5C8D6F24693`
- เปิด ZIP จริง ยืนยัน manifest version 0.3.18 และรัน tests จากไฟล์ที่แตกออกมาแล้วผ่าน **44/44**, fail 0


## 64. Dashboard 0.13.29 — ตรวจพบ “แบบฝึกหัดท้ายบทเรียน” ที่เป็น Moodle File (2026-11-11)

**สถานะ: แก้ source แล้ว / tests source และ ZIP ผ่าน 36/36 / Dashboard tests ผ่าน 39/39 / เผยแพร่และตรวจจาก GitHub Pages จริงแล้ว**

### อาการและสาเหตุ
- รายวิชามีป้าย `กิจกรรม ท้ายบทเรียน` และไฟล์ชื่อ `แบบฝึกหัดท้ายบทเรียนครั้งที่ 1 ...` ชัดเจน แต่ผลตรวจครั้งที่ 1 แจ้งว่าไม่พบกิจกรรมท้ายบท
- ตัวอ่านพบรายการดังกล่าวแล้ว แต่กฎชื่อกิจกรรมสำหรับ Moodle Resource รองรับ `ใบงาน`, `การบ้าน` และ `กิจกรรมท้ายบท` โดยยังไม่รองรับคำว่า `แบบฝึกหัดท้ายบท/แบบฝึกหัดท้ายบทเรียน` จึงส่งรายการไปเป็นเอกสารประกอบการสอนชนิด `file`
- ปัญหาไม่เกี่ยวกับการจับคู่ Section และไม่เกี่ยวกับการเปิดไฟล์ปลายทาง

### การแก้ไขและตัวกันผลผิด
- เพิ่มรูปแบบชื่อที่ชัดเจน `แบบฝึกหัดท้ายบท` และ `แบบฝึกหัดท้ายบทเรียน` ให้เป็นกิจกรรมท้ายบท แม้ป้ายภาพจะอ่านไม่ได้
- ไม่ใช้คำกว้าง `แบบฝึกหัด` เพียงอย่างเดียว เพื่อไม่ให้แบบฝึกหัดเพิ่มเติมหรือเอกสารฝึกปฏิบัติทั่วไปถูกนับเป็นกิจกรรมท้ายบท
- เอกสารประกอบการสอนที่วางใต้ป้ายกิจกรรมโดยบังเอิญยังคงเป็นเอกสาร ไม่รับชนิดกิจกรรมจากตำแหน่งอย่างเดียว
- เพิ่ม regression test จากชื่อจริงในภาพ รวมถึงเคสกัน `แบบฝึกหัดเพิ่มเติม` และเอกสารประกอบการสอน

### Artifact
- Source: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.29`
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.29.zip`
- ZIP size: **9,353,632 bytes**, 120 entries
- SHA-256: `C3A8EDB18767C6AD7A4C7D8FC692DC0D941A704FFB425ABE9ED0D57CA4474111`
- เปิด ZIP จริง ยืนยัน manifest version 0.13.29 และรัน test files จากไฟล์ที่แตกออกมาแล้วผ่าน **36/36**, fail 0
- ตัวดาวน์โหลดบนหน้าเว็บประกอบไฟล์จาก 24 ส่วน ตรวจขนาดรวมและ SHA-256 ก่อนปล่อย ZIP; Dashboard tests ผ่าน **39/39**, fail 0
- GitHub release commits: `b870999b06a34de7ccaa7f211f04271d006f2873`, `c026005c72044190b9f81297a00d6eaba345db31`
- GitHub Pages deploy run `42949712654` สำเร็จ และทดสอบดาวน์โหลดทั้ง 24 ส่วนจาก Pages จริงแล้วได้ 9,353,632 bytes, hash ตรง และ ZIP magic เป็น `PK`
- รายงานที่สร้างด้วย 0.13.28 หรือต่ำกว่ายังคงผลเดิม ต้องติดตั้ง/Reload 0.13.29 แล้วตรวจรายวิชาใหม่จึงจะจำแนกรายการนี้เป็นกิจกรรมท้ายบท


## 65. Dashboard 0.13.30 — ใช้ผลยืนยันเดิมเป็นรายหลักฐานและแก้ข้อมูลผู้สอนสลับกัน (2026-11-11)

**สถานะ: แก้ Extension + backend แล้ว / tests ผ่าน / Edge Function version 44 ACTIVE / เผยแพร่และตรวจ GitHub Pages จริงแล้ว**

### อาการและสาเหตุ
- MKT453 รอบ Auditor 0.13.16 เคยยืนยันแล้วและผ่าน 91/110 แต่รอบ 0.13.28 กลับเป็น 72/110 `needs_review` ทั้งที่ลิงก์ Podcast ทั้ง 15 ครั้งยังเหมือนเดิมทุกตัว
- กฎเดิมนำผลยืนยันกลับมาใช้เฉพาะเมื่อกรอบคะแนนรวมและคะแนนที่ต้องยืนยันเหมือนเดิมทั้งชุด เมื่อ Extension รุ่นใหม่จำแนกหลักฐานได้ต่างไปเล็กน้อยจึงทิ้งผลยืนยันเดิมทั้งหมด แม้ปลายทางของหัวข้อนั้นไม่เปลี่ยน
- การบันทึกคำตัดสินเพิ่มคะแนนแล้ว แต่ snapshot บางรายการยังเก็บ `needs_review` ทำให้หน้าผลขึ้น `รอตรวจ` แม้ผู้ตรวจยืนยันผ่านหรือไม่ผ่านแล้ว
- รายวิชาตัวอย่างแสดงชื่อผู้สอนใต้ QR code แต่ตัวอ่านเก็บข้อความปนคำว่า `ผู้สอน` และตัวนับ Moodle และอาจใช้ QR code เป็นรูปบุคคล จึงรายงานกลับด้านว่า “พบรูป ไม่พบชื่อ”

### นโยบายและการแก้ไข
- นำผลยืนยันเดิมกลับมาใช้เป็นรายหัวข้อ โดยจับคู่ประเภทเกณฑ์กับชุดลิงก์ปลายทางที่ทำให้เป็นรูปแบบมาตรฐานแล้ว ไม่ผูกกับคะแนนรวมทั้งรายงาน
- ถ้าลิงก์ของหัวข้อนั้นเปลี่ยนแม้เพียงรายการเดียวจะไม่ใช้ผลเก่าและต้องให้ผู้ตรวจยืนยันใหม่
- คำตัดสินตารางที่ 3 ทั้งห้าข้อใช้ซ้ำเฉพาะเมื่อชุดปลายทางหลักฐานทั้งรายงานเหมือนเดิมทุกตัว เพื่อไม่ยกคำตัดสินภาพรวมข้ามไปยังรายงานที่เปลี่ยนเนื้อหา
- เมื่อบันทึกหรือเปิดดูผลยืนยัน ระบบใช้คำตัดสินที่เก็บไว้แทนสถานะ `needs_review` ทันที: ผ่านเป็น `pass`, ไม่ผ่านเป็น `fail` และตัดหัวข้อที่จบแล้วออกจากคิวรอตรวจ
- ไม่แก้ทับผล MKT453 รอบล่าสุดอัตโนมัติ เพราะผู้ใช้แจ้งว่าจะยืนยันรอบปัจจุบันเอง; การแก้มีผลกับการบันทึกครั้งนี้ รอบใหม่ และการแสดงผลย้อนหลังที่มีคำตัดสินบันทึกอยู่แล้ว
- ตัวอ่านชื่อผู้สอนตัดคำนำหน้าซ้ำและข้อความตัวนับ Moodle เช่น `1 File, 2 URLs` ออกก่อนประเมิน
- รูปที่ BarcodeDetector ถอดเป็น QR code ได้จะไม่ถูกใช้เป็นรูปผู้สอน และข้อความรายงานแยกชัดระหว่าง “พบรูปผู้สอน” กับ “พบภาพประกอบ แต่ยังไม่พบรูปผู้สอน”

### การตรวจสอบและ Artifact
- Dashboard tests ผ่าน **43/43**, fail 0 รวม regression ของ MKT453, ลิงก์ Podcast ที่เปลี่ยน และสถานะหลังยืนยัน
- Extension source tests ผ่าน **36/36**, fail 0; ZIP ที่แตกตรวจจริงรัน test files ผ่าน **41/41**, fail 0
- Supabase Edge Function `api` version **44**, ACTIVE, `verify_jwt=false` ตามค่าที่ใช้งานเดิม และมีไฟล์ `review-reuse.js` ใน deployment จริง
- Source: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.30`
- ZIP: `C:\Users\Administrator\Documents\Codex\2026-08-24\new-chat\SPU-Learning-Auditor-Dashboard-0.13.30.zip`
- ZIP size: **9,353,971 bytes**, 120 entries
- SHA-256: `321265EFEF62BB8345F28F3DB92510957634A14EA3391B573D16ABB949E0EC24`
- GitHub release commits: `2efa74d0fc742e1d05360ff30883e34a55bd1e08`, `b6ad96fee518e03110d01f6992d40d9ad90a290d`
- GitHub Pages deploy runs `42953503335` และ `42953838318` สำเร็จ
- ตรวจจาก GitHub Pages จริง: หน้า Download แสดง 0.13.30, ทั้ง 24 ส่วนมีขนาดถูกต้อง, ประกอบได้ 9,353,971 bytes, SHA-256 ตรง และ ZIP magic เป็น `PK`


## 66. Legacy 0.3.19 / Dashboard 0.13.31 — ป้องกันหัวข้อ “แนะนำผู้สอน” กลืนชื่อจริง (2026-11-11)

**สถานะ: แก้ source และสร้าง ZIP แล้ว / Legacy tests 44/44 / Dashboard tests 42/42 / รอเผยแพร่ Dashboard**

### อาการและสาเหตุ
- กล่องครั้งที่ 1 มีข้อความหัวข้อ `แนะนำรายวิชา แนะนำผู้สอน แนะนำกิจกรรม และการประเมินผล` แล้วตามด้วย `ผู้สอน อาจารย์จรรยา ผลประเสริฐ`
- regex เดิมเริ่มจับจากคำว่า `ผู้สอน` ในหัวข้อและกินข้อความต่อเนื่องจนรวมชื่อจริงไว้ในก้อนเดียว จากนั้นตัวกรองพบคำว่า `กิจกรรม` จึงทิ้งก้อนทั้งหมด ทำให้ชื่อจริงไม่มีโอกาสถูกจับรอบใหม่
- รูปบุคคลอาจถูกพบอยู่แล้ว แต่ `identityComplete` บังคับให้มีทั้งชื่อและรูป จึงตกเป็นไม่ครบ และข้อความรวมเดิมทำให้ดูเหมือนไม่พบทั้งชื่อและรูป
- Dashboard 0.13.30 ใช้รูปแบบ regex เดียวกัน จึงมีความเสี่ยงเดียวกัน แม้มีตัวทำความสะอาดชื่อเพิ่มเติมแล้ว

### การแก้ไข
- เปลี่ยนเป็นตรวจทุกตำแหน่งของ marker `ผู้สอน/อาจารย์/Instructor` แยกจากกัน ไม่ให้ marker ในหัวข้อกิน marker และชื่อจริงที่ตามมา
- อ่านเฉพาะคู่ชื่อ–นามสกุลหลัง marker และปฏิเสธคำขึ้นต้นที่เป็นหัวข้อ เช่น `แนะนำ`, `กิจกรรม`, `ข้อมูล`, `การประเมิน`, `ช่องทาง` และ `รายวิชา`
- เพิ่ม regression จากข้อความจริง ต้องได้ `จรรยา ผลประเสริฐ`; หัวข้อ `ผู้สอน แนะนำกิจกรรม และการประเมินผล` ลำพังต้องไม่ถูกนับเป็นชื่อ

### Artifact
- Legacy 0.3.19 source tests **44/44**, fail 0; ZIP 9,525,890 bytes, 135 entries, SHA-256 `EEEF1CF01CFDDC0F8B78BEABEFA54AA2FD5AC3AEE5FF6366FAB7A28F3E4A3275`
- Dashboard 0.13.31 source tests **42/42**, fail 0; ZIP 9,355,337 bytes, 122 entries, SHA-256 `AB4274AD2D3B7C9C360EE8ADCA07459DF3693B064E1BB7172A5990B18B9C65C4`

