# Handoff — Web Platform / Dashboard & Services

> สถานะเอกสาร: **Migration baseline 24 พ.ย. 2569** จาก Handoff เดิมถึง §130 และ Source ใน `main` ณ Commit `b1813af93b45`  
> **ไม่ใช่การรับรองเวอร์ชันที่ติดตั้งบนเครื่อง หรือสถานะ production ปัจจุบัน**: ทุกครั้งที่ทำงานต้องตรวจ Source/Release/CI/Runtime ล่าสุดก่อน

> เจ้าของเรื่อง: หน้าเว็บและระบบบริการร่วม **ไม่ใช่ policy ของ Extension ตัวใดตัวหนึ่ง**. ผลต่อ Extension ต้องแจ้งกลับ track เจ้าของเรื่องและ Shared Core

## Architecture และ Source inventory (GitHub main)

| Layer | Path / จุดที่เกี่ยวข้อง | ข้อควรตรวจ |
|---|---|---|
| Dashboard / Home | `index.html`, `README.md` | ตัวกรอง active, กราฟ/KPI, GR/GS และการอ่านชีต |
| Admin / Worker UI | `audit-review.html`, `audit-review.js`, `audit-worker.js`, `audit-api.js`, `audit-bridge.js` | รายชื่อวิชา, queue, role, reviewer action, ack/result, worker heartbeat |
| User/Admin evidence | `audit-evidence.html`, `audit-evidence.js`, `audit-evidence-v2.css`, `audit-report-layout.css` | เปิดผลจาก run ที่เผยแพร่ตรงกับ DB, privacy, overview/session details, source links |
| Shared presentation | `ui-i18n.js`, `audit-dark-complete.css`, `ui-refresh.css`, `audit-system.css` | TH/EN, theme, dynamic text, dark contrast; translated boilerplate vs Moodle source text |
| Server & criteria | `supabase/functions/api/index.ts`, `criteria-12569.mjs`, `review-reuse.js`, `audit-quality.mjs` | authorization, evidence persistence, calculation policy selected by track |
| Database migrations | `supabase/migrations/` | Audit runs, jobs, catalog, sync outbox, RLS and deployment records |
| Release portal | `download-extension.html`, `downloads/dashboard/<version>/release.json`, `parts/`, `.github/workflows/build-dashboard-*.yml` | version/size/hash, link and published artifact match |
| UI regression | `tests/dashboard-appearance.test.mjs`, `tests/audit-evidence-issues.test.mjs`, `.github/workflows/verify-dashboard-appearance.yml` | translated details, status copy, dark mode, misleading media warnings |

**Deployment architecture:** GitHub Pages เป็น Frontend; Supabase API/DB เป็นฐานหลังบ้าน; Google Sheets Main Data และ GRGS_Public เป็นชั้นการเผยแพร่/รายงานบางส่วน. Workflow/Apps Script ที่รันจริงต้องตรวจ runtime ต่างหาก; อย่าใช้ Source commit แทนหลักฐาน deployed version

## Data-flow / Sync contract

`Extension → audit job/result + evidenceSnapshot → Supabase audit_runs/public_course_results → gr_sheet_sync_outbox → Main Data (GR 69/1 V/W/X) → GRGS_Public → Dashboard`

- `course_id` เป็น Course ID จาก Moodle URL; แยก Group/Term/track เพื่อไม่ส่งผิดชีต
- คะแนนภายในและเหตุผลการตรวจไม่ควรออกไปใน Public ที่ไม่ได้อนุญาต; User view แสดง published overview + weekly components
- **Main Data verified ≠ Supabase saved**: ต้องยืนยัน outbox state/row V/W/X และการคำนวณ GRGS_Public; ไม่อ้างซิงก์เสร็จจากการเปลี่ยน Public projection
- การตรวจ/ส่งซ้ำต้อง idempotent ไม่เปลี่ยน run โดยไม่มี guards และไม่ทำลายประวัติ/การยืนยันผู้ตรวจ
- รายงานผลที่ส่งผู้บริหารต้องตรวจกำหนดช่วงเวลาและ publication snapshot ใหม่; จำนวนรายวิชาเปลี่ยนตาม active semester

## ประวัติสำคัญที่แยกจากตัวตรวจ

- Catalog/active 160 vs 163 (§§1–14); main data / sheet routing (§§77–82)
- หน้าคิว/หลักฐาน/แผงคำแนะนำ (§§83–88, 96, 108–109)
- Worker retry, HTTP 546, ack และ Apps Script performance (§§93–99)
- การตรวจสอบคะแนนของ GR (§§100–110) เป็น **ผลในข้อมูล production ตามเวลานั้น** ไม่ใช่ policy ถาวร
- อัปเดตหน้า Download version drift (§112)
- TH/EN/Dark/Light (§113), video warning evidence (§116), localized lesson plan/materials/status (§§118–119)
- การแก้ข้อมูลเฉพาะวิชา (§§103, 109, 114–115) ให้รักษาเหตุผล, reviewer trace และไม่ทำเป็น global rule โดยพลการ

## Known risks / สิ่งต้องตรวจเมื่อเปิดงาน

1. **Supabase API safeguard**: §114 บันทึกว่า `applyLegacyMoodlePrePost` ถูก commit แต่ deploy API ล้มเหลวเพราะ npm package dependency; **ยังไม่ได้พิสูจน์ runtime รุ่นล่าสุด ณ 24 พ.ย.** ให้ตรวจ function version/code deployment ก่อนเชื่อว่า active
2. **Shared presentation**: Automated i18n/dark mode ผ่าน แต่หลายจุดยังต้อง live browser acceptance ทั้ง User/Admin โดยเฉพาะข้อความสร้างภายหลัง, รูปแบบวัน และ PDF
3. **Outbox**: §99 มี queue delivery แบบ durable; ต้องยืนยันการ drain และ lease จริงเมื่อมีรายการค้าง
4. **Security**: Owner/Super Admin/ผู้สอน/Anon แสดงข้อมูลไม่เท่ากัน; ทดสอบสิทธิ์เมื่อแก้ public evidence หรือ RLS
5. **Release portal**: สาย DB/DL อาจมีหน้าโหลด/ไฟล์ร่วม; ห้าม hardcode latest DB เป็น DL เวอร์ชันปัจจุบันโดยไม่แยก track

## Web change acceptance

- [ ] GitHub SHA/Pages run status **completed/success**
- [ ] Browser login จริง: Admin queue, User evidence, review modal, mobile width, both languages & both themes
- [ ] API authorized/unauthorized contract และ data privacy ไม่เปลี่ยนโดยไม่ตั้งใจ
- [ ] Single-course test ว่า saved result, public evidence, GRGS_Public และ Main Data แสดงตรงกัน
- [ ] Regression fixture ของ media warning ไม่กล่าวหาลิงก์เสียจาก `skipped_recording` / ไม่มีเวลา
- [ ] Handoff ของ affected Extension ระบุ compatibility decision; Shared Core parity อัปเดตหากพฤติกรรม reader เปลี่ยน


## Operational troubleshooting — Evidence / Queue / Sync

| อาการ | จุดที่ควรเริ่มตรวจ | ห้ามสรุปเร็วเกินไป |
|---|---|---|
| User/Admin ผลต่างกัน | `audit_runs` ล่าสุดที่ published, `public_course_results`, `evidenceSnapshot` และ cache | ไม่ใช่ทุกครั้งที่ต้องรัน Extension ใหม่ |
| คะแนนใน Supabase ถูกแต่ Sheet ยังเก่า | `gr_sheet_sync_outbox` state/lease/run, Worker polling, Google Sheet V/W/X, GRGS_Public formula | `saved` ไม่เท่ากับ `verified` |
| วิดีโอเปิดได้แต่ banner บอกเปิดไม่ได้ | `mediaStatus` ของ video จริง เทียบ recording skipped และข้อความจาก UI | อย่านับทุก LiveRecord เป็นลิงก์เสีย (§116) |
| สลับ EN แล้วไทยค้าง | `ui-i18n.js`, dynamic nodes, raw/last source and templates, language storage, PDF output | ไม่แปลชื่อไฟล์/ข้อความที่ผู้สอนสร้าง (§§113,118–119,130) |
| คิวซ้ำ/ผลหาย | job id/run id, ack/retry, prior review decisions, outbox; ตรวจ `audit-review.js` และ API | retry ไม่ควรทำ score/review ย้อนหรือสร้าง run ซ้ำ |
| หน้าโหลดแสดงรุ่นไม่ตรง ZIP | manifest, Release JSON, checksum parts, admin hardcoded version, Pages cache | เปลี่ยน label หน้าเว็บไม่ได้แปลว่า ZIP ที่ติดตั้งเปลี่ยน (§112) |

### คำสั่งตรวจรับก่อนส่งรายงาน

1. อ่าน source version และ GitHub Pages workflow ของ Web แยกจาก Extension ZIP workflow
2. ถ้ามีการเปลี่ยน publication ให้ตรวจจำนวน active Course IDs, latest/published run, public status, review evidence และ sync state ณ เวลาเดียวกัน
3. ไม่ส่งผลคะแนนกลับ Sheet หรือยืนยันการเปลี่ยน status ด้วย SQL ที่ไม่ guard latest run + reviewer decision + no-job/no-lease
4. หน้า Evidence ของ User ต้องไม่เผย internal scoring/reviewer-only action และต้องแสดง overview + sessions ตามผล published จริง
5. Test ไฟล์ `tests/dashboard-appearance.test.mjs` และ `tests/audit-evidence-issues.test.mjs` ก่อน release UI; automated test ไม่ใช่การรับรอง authenticated Chrome

## Change log

- 2026-11-24 — แยก Web Platform ownership ออกจาก 4 Extension; ไม่แก้ runtime, DB, API หรือคะแนน
