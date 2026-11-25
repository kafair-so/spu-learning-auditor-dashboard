# Handoff — QA / SPU Course QA Auditor (Independent Extension Track)

> **Status: DESIGN / HANDOFF INITIALIZED — 25 November 2026**  
> สายพัฒนาใหม่สำหรับ SPU Course QA; **ยังไม่มี QA Extension เวอร์ชันใหม่ที่สร้าง ทดสอบ ติดตั้ง หรือ Deploy**  
> Proposed development identifier: `QA-0.1.0-dev` (**ชื่อชั่วคราว ไม่ใช่ Release หรือหมายเลข Extension ใน Chrome**)  
> Source baselines checked: SPU Learning Auditor `5f86bd146e09`, Course QA `003926456e16`. ต้องตรวจ main ใหม่ทุกครั้งก่อนเริ่มพัฒนา

## 1. การตัดสินใจและเหตุผลที่ต้องแยกเป็นสายที่ 5

OWNER ต้องการเตรียม Auditor สำหรับ QA ซึ่งเริ่มจากข้อมูลดิบ Course Profiles ของ **d-Learning และ i-Learning** ใน Neon และให้ระบบเป็นผู้พิจารณาขอบเขตตรวจ (Main Concern: **GN, GR, GS**) ต่างจาก Dashboard ที่ใช้รายชื่อซึ่งเคยคัดกรองไว้แล้ว

**Architecture decision:** สร้าง **QA track** ที่มี Source/Manifest/Release/Config/Test/Handoff ของตัวเอง และนำระบบอ่าน Moodle หลักฐานที่ผ่าน regression จาก [Shared Core](HANDOFF_SHARED_CORE.md) มาใช้แบบมี Adapter. **ไม่แก้ DB, LC, LL, DL ที่กำลังทำงานอยู่โดยตรง** และ **ไม่เปลี่ยน Backend/Neon/หน้าแสดงผล QA Production โดยคำสั่งนี้**.

เป้าหมายคือความสามารถในการ **ตรวจจับข้อมูลให้สอดคล้องกับมาตรฐานร่วม** ไม่ใช่บังคับให้เกณฑ์คะแนน/การตีความ/การเผยแพร่ผลของทุก track เหมือนกัน

### Ownership / Source-of-truth boundary

| เรื่อง | เจ้าของเรื่อง / กฎ |
|---|---|
| Shared Moodle scanners, image/OCR, media, activity classifier, evidence normalization | [Shared Core](HANDOFF_SHARED_CORE.md) เป็นมาตรฐานการรับการแก้ไข; QA มี Adapter/Test ของตน |
| QA Extension runtime, manifest, worker integration, report mapping, track version | **HANDOFF_QA.md** (ไฟล์นี้) |
| Course Profile master, published snapshot/visibility, roster/SCMS/Personnel, eligibility, queue, schema and API | **Course QA** `donut204/spu-course-qa` และ `AGENTS.md`/`SPU_COURSE_QA_HANDOFF.md` ใน repo นั้นเป็น Source of Truth |
| Dashboard เดิม, Supabase, Google Sheets, GitHub Pages | [HANDOFF_WEB_PLATFORM.md](HANDOFF_WEB_PLATFORM.md) ของโปรเจกต์เดิมเท่านั้น; **ไม่ใช่ Backend ของ QA** |
| DB Current / DL Legacy / LC Current / LL Legacy | Handoff แต่ละ track; ห้ามย้าย rubric หรือแก้ release ของ track อื่นโดยอัตโนมัติ |

**ต้องรักษาสอง Handoff:** เมื่อเริ่ม Implementation ใน QA repository ให้บันทึก implementation/DB/API/PR/deploy ลง `donut204/spu-course-qa/SPU_COURSE_QA_HANDOFF.md` ตาม `AGENTS.md`; ขณะเดียวกันบันทึกตัว QA Extension และ parity ในไฟล์นี้/Shared Core. การสร้างไฟล์นี้ **ยังไม่ถือว่าอัปเดต Handoff ของ QA repo แล้ว**.

## 2. ระบบปัจจุบันที่ตรวจพบ (Verified Source — ไม่ใช่ Live Runtime)

| Component | Source in Course QA | Baseline ที่ยืนยันจาก GitHub |
|---|---|---|
| QA-integrated Extension | [`extension/learning-auditor-0.13.34/COURSE-QA-INTEGRATION.md`](https://github.com/donut204/spu-course-qa/blob/main/extension/learning-auditor-0.13.34/COURSE-QA-INTEGRATION.md) | ดัดแปลงจาก Dashboard Extension `0.13.34`; `schemaVersion=2`, ไม่ใช้ `spu-course-catalog-2569.json`; ต้องใช้ host/origin QA ที่อนุญาต |
| Target discovery | [`services/auditor_target_service.py`](https://github.com/donut204/spu-course-qa/blob/main/services/auditor_target_service.py) | อ้าง `dashboard_payload(GR/GS)`, source d-/i-Learning; `ALL` แปลว่า **GR+GS** เท่านั้น |
| Population rules | [`services/grgs_dashboard_service.py`](https://github.com/donut204/spu-course-qa/blob/main/services/grgs_dashboard_service.py) | Query `course_profiles` ปัจจุบัน (Neon) สำหรับ 2569/1; GR/GS filter ตาม Owner decision 20 Nov, Admin `hide` จำกัดเพิ่ม; **ไม่ใช้ Catalog Published Snapshot เป็น target source โดยตรง** |
| Target readiness | [`services/auditor_contract.py`](https://github.com/donut204/spu-course-qa/blob/main/services/auditor_contract.py) | strict HTTPS + source hostname + Course ID URL, valid positive SCMS credits, academic scope, rubric version; ห้าม default หน่วยกิตเป็น 3 |
| Queue | [`services/auditor_queue_service.py`](https://github.com/donut204/spu-course-qa/blob/main/services/auditor_queue_service.py) | revalidate `effective_visible` + `audit_ready`; คิวต่อ `(source,moodle_course_id,academic_year,semester)`, max batch 500, ไม่สร้าง queued/running ซ้ำ |
| Result contract | [`services/auditor_extension_contract.py`](https://github.com/donut204/spu-course-qa/blob/main/services/auditor_extension_contract.py) | QA Backend ตรวจ schema 2 + allowlist fields, bounded/sanitized evidence; source/credits/rubric ต้องเป็น server-owned |
| Multi-term | [`docs/architecture/AUDITOR_MULTI_TERM_PLAN.md`](https://github.com/donut204/spu-course-qa/blob/main/docs/architecture/AUDITOR_MULTI_TERM_PLAN.md) | **Future design เท่านั้น**; current scope GR/GS 2569/1 |

**ห้ามถือ** ว่า Source QA-integrated `0.13.34` คือ ZIP เดียวกับ DB Current ที่ติดตั้งจริง หรือถือว่า DL `0.13.39` ใช้กับ QA ได้ทันที. ต้องตรวจ Source diff, manifest, schema, score policy, permissions, URL/origin และ live browser ก่อนเลือกฐานสร้าง QA track.

## 3. นโยบายคัดเลือกและความหมายของจำนวน (Design Target, NOT IMPLEMENTED)

Pipeline ที่เสนอสำหรับสาย QA ใหม่:

```text
Raw Course Profiles (Neon, d-Learning + i-Learning; immutable/provenance)
  → Source / academic year / semester / Course ID normalization
  → Main Concern group gate: GN / GR / GS (GU/FN/GI/FS/GH outside initial scope)
  → Track-specific Audit Eligibility + explicit reason codes
  → Admin display/override policy decision (must reconcile with QA OWNER)
  → Readiness: exact source URL + actual SCMS credits + selected rubric
  → Versioned target generation / audit queue
  → QA Extension scans Moodle READ ONLY
  → Schema-versioned result / reviewer / publication (Course QA Neon)
```

**สำคัญ:** `Raw` คือฐานที่ต้องคงไว้ครบ ไม่ใช่ทั้งหมดต้องถูกตรวจ. QA ปัจจุบันถือ `effective_visible` ของ Dashboard GR/GS เป็น guard ก่อนเข้าคิว. เป้าหมายใหม่ที่ OWNER กล่าวถึงคือให้ QA กรองข้อมูลเอง. ดังนั้น **ห้ามแอบเปลี่ยนจาก `effective_visible` เป็น scan-all** ก่อน OWNER ตัดสินว่า eligibility ของการตรวจต่างจาก eligibility เพื่อแสดงผลอย่างไร และรายวิชาที่ถูกซ่อนควรมีสิทธิ์เข้าคิวหรือไม่. ถ้าไม่ได้อนุมัติให้ bypass ให้ fail closed ตาม guard เดิม.

**ไม่มีการสมมติยอด Live:** ไฟล์ JSON ที่เคยตรวจ 1,643 profiles รวม 2 sources เป็น snapshot/export ในการสนทนา ไม่ใช่ยอดล่าสุดของ Neon หรือ eligible targets. Dashboard QA 1,288 profiles/1,013 courses เป็นมุมมอง display หลังกรอง ไม่ใช่ Auditor denominator. ต้องจัด report แสดง `raw → main_concern → audit_eligible → audit_ready → queued → audited` **แยกตาม source, group, year, term** พร้อม Course IDs และ exclusion reason เพื่อ reconcile ได้ทุกแถว.

### ข้อกำหนดทางข้อมูล / เหตุผลคัดออกที่เสนอ

- `source`, `moodle_course_id`, `academic_year`, `semester_code` ต้องแยกกัน ไม่ใช้ shortname เพียงอย่างเดียว
- `course_group` GN/GR/GS ต้องตรวจจาก metadata/shortname ที่ได้รับจริง; malformed/unknown ต้องแยก `needs_review` ไม่เดา
- `profile_type` T/TT/L/TL/P เป็น metadata สำหรับเลือก rubric **ไม่ใช่ blanket exclusion**; GR/GS latest 20 Nov อนุญาต L
- `student_count=0` มีผลกับ GS ตามกฎ QA ปัจจุบันเท่านั้น ไม่ขยายไป GN/GR โดยไม่อนุมัติ
- ตัดคณะของ d-Learning ที่ไม่เข้า reporting policy ในระบบเดิม; การใช้เป็น **audit exclusion** ต้องยืนยันกับ OWNER ต่างหาก ไม่โยกกฎ Catalog มาโดยพลการ
- `instructor` / `employment_type` ไม่ใช่ GR/GS eligibility exclusion ตาม policy ล่าสุด; การมีรูป+ชื่อ+ช่องทางติดต่อใน Moodle ยังเป็นหลักฐานที่ Extension ต้องตรวจแยก
- `credits_missing`, `course_url_invalid`, `rubric_missing`, `source_scope_mismatch`, `admin_hidden`, `out_of_concern` และ `unsupported_term` ต้องแยกอย่างตรวจสอบย้อนกลับได้

## 4. QA Architecture — แยกโค้ด แต่แชร์ความสามารถที่ผ่าน Test

**เสนอ source track ใหม่** ไม่สร้าง/แก้ไฟล์ของ DB/LC/LL/DL ระหว่างการออกแบบ; repository/branch/folder จริงให้ OWNER รับรองก่อนเริ่มเขียน Source. ให้เริ่มจาก audited compatible QA overlay `0.13.34` แทนการ fork ด้วย version number สูงสุดโดยไม่ทดสอบ

| ชั้น | นำมาใช้ร่วมได้ | สิ่งที่ QA ต้องแยก |
|---|---|---|
| Moodle page and section parsers | Section mapping, video class, Moodle Quiz, document detection | source d/i + permission adaptation, term-specific scope |
| Instructor/media readers | Contextual name/photo/contact, provider duration, unknown vs absent | QA evidence projection, approved redaction |
| Scoring engine | Evidence primitives & fixtures | **QA rubric registry** เลือก GN/GR/GS ตาม year/term/profile; no hidden coupling to current/legacy |
| Extension state & delivery | Result checkpoint / retry / idempotency principles | QA-only origin allowlist, extension identity/manifest, schema2 adapter + version handshake, QA lease/generation |
| Output | Immutable evidence, accuracy checks, TH/EN usability | Neon contract and QA Admin/User publication/visibility; **not** Supabase/Sheets |

**Security boundaries (non-negotiable):**
- Moodle d-/i-Learning **READ ONLY**. ห้าม enrol/unenrol, suspend/reactivate, assign roles, edit course/enrolment; ตรวจ `services/moodle_read_only_policy.py` allowlist และ token role ที่ใช้จริงใน QA
- ห้าม raw Moodle tokens, user PII, Personnel emails หรือ signed URLs หลุดสู่ log/public evidence; QA schema 2 server allowlist/redaction ต้องคงอยู่
- Backend เป็นเจ้าของ Course ID, URL/source origin, credits จาก SCMS ที่ยืนยัน, year/term, `rubric_version`, `target_generation_id`, `job_id` และ `lease_attempt`
- ห้ามใช้ Dashboard origin wildcard, hardcode fallback URL, และตั้ง credits=3 หากข้อมูลไม่ครบ
- Keep old installed QA 0.13.34 + existing 4 track artifacts intact as rollback; QA vNext ต้องมีเวอร์ชัน/manifest/ZIP/checksum/worker handshake ของตัวเอง

## 5. Roadmap เฉพาะ QA Track (ยังไม่อนุมัติให้ Implement)

| Stage | งาน | Exit / Acceptance |
|---|---|---|
| Q0 — Decision gate | ยืนยันแหล่ง Raw vs Published, Audit Eligibility กับ Admin hide, GN rubric, current/legacy policy, multi-term และสิทธิ์; รวบรวม catalog reconciliation | OWNER sign-off + dataset/Policy matrix; **no production writes** |
| Q1 — Compatibility & baseline | Freeze QA existing `0.13.34` contract, select source baseline, compare DL/DB/LL shared readers; establish independent QA branch/release identity | source inventory, acceptance fixtures, no missing reader behavior |
| Q2 — Target selection | Independent QA eligibility engine + reason codes, source+term+group guards, validate real SCMS credits, display KPI funnel; QA repo implementation only after approval | One-to-one raw/profile reconciliation, no silently excluded/included profiles; GN is explicit feature gate |
| Q3 — Extension adapter | Port Shared Core readers to isolated QA runtime, mapping to QA schema 2, browser permissions/origin+lease identity | Contract/replay/duplicate/idempotency tests pass for d/i |
| Q4 — Isolated E2E | Isolated Neon branch/test DB + authorized Chrome/Moodle read-only tests and side-by-side replay versus current QA 0.13.34 | Exact course identity, no score regression, no PII/permission leaks, documented false pos/neg |
| Q5 — Controlled pilot | Separate feature flag, explicit allowlisted cohort, **no auto-publication** for pilot, reviewers compare results without replacing current published runs | OWNER validates target counts, sample results, rollback and reference scope |
| Q6 — Owner-go release | Review PR/CI, migration compatibility, Chrome installation package + SHA, Vercel quota/Production GO | Verified runtime, queue, published evidence and fallback; no silent switch |

**Multi-term**: `2569/2`, `2568/1` และปีอื่นต้องไม่เปิดก่อน snapshot + reference generation + policy + tests ครบ ตาม QA `AUDITOR_MULTI_TERM_PLAN.md`. **GN** ก็ต้องไม่เปิดก่อนกำหนด GN rubric และ eligibility สอดคล้องกันทั้ง server/extension.

## 6. Regression & risk checklist (ต้องรักษาเดิม)

- [ ] เก็บ snapshot ของ UI/ผลเดิมบน QA GR/GS และ Dashboard เดิมก่อนเริ่ม; current production ไม่เปลี่ยนจาก docs-only task
- [ ] Identity uniqueness `source + course_id + year + semester`; d/i course IDs ที่ตัวเลขตรงกันห้ามชนกัน
- [ ] Valid/invalid Course URL hostname และ Course ID; credits NULL/0/decimal/ผิดรูปแบบ ไม่ใส่ default
- [ ] GN unknown/ambiguous class and separate rubric, GR/GS current 20 Nov rules, GS zero enrollment & specific OCM491, i-Learning IC
- [ ] Reference provenance + display hide and audited eligibility: explain every excluded profile
- [ ] Moodle Pre/Post Quiz, Moodle Videos, LiveRecord vs Video Class, document evidence, contextual instructor photo/contact, duration unknown
- [ ] Schema2 bounded JSONB, no raw PII/credential leaks, proper role auth and CSRF, no arbitrary Moodle Web Service calls
- [ ] Queue duplicate active job, recheck eligibility at enqueue/claim/result, stale lease and result replay, not overwrite immutable manual review
- [ ] QA Admin detail versus published User redaction stays separate; web display changes require QA owner approval
- [ ] Verify actual Chrome in both d-/i-Learning, not infer success only from Node tests or successful Vercel deployment
- [ ] Verify all DB/LC/LL/DL released assets untouched; cross-version changes require Shared Core review

## 7. Open decisions / blockers — do not make assumptions

1. **Audit Eligible vs Display Eligible**: current QA `effective_visible` gating versus requested QA-filtered raw master; how should hidden but relevant courses be handled? **OWNER decision pending**.
2. **GN**: category-specific QA rubric, mandatory/optional components, 15-week gates, Podcast/AI Tutor, exclusions and scoring **not approved by this document**.
3. **Term versioning**: choose rubric by date/type/profile, source-specific exceptions and GN/GR/GS coverage (not blindly 110/80 or 100/70).
4. **Publication**: whether new QA results may auto-publish, whether it supersedes existing QA 0.13.34 published runs, and how to preserve history; default **no auto replacement**.
5. **Repository/release ownership**: whether QA Extension source stays in `donut204/spu-course-qa/extension/` or moves to dedicated source branch/repo; require ownership/CI/test path confirmation.
6. **Source freshness**: reconcile Neon live Raw/Published/Override/Personnel/SCMS data without changing it; earlier mismatched Course ID investigations remain unconfirmed until Neon read-only checks.

## 8. Handoff and Change Log protocol

- Edit `HANDOFF_QA.md` for QA Extension scope and compatibility, `HANDOFF_SHARED_CORE.md` for cross-track parity, `handoff/INDEX.md` for important status/versions.
- If implementation touches Course QA repo, **also** update `SPU_COURSE_QA_HANDOFF.md` and follow `AGENTS.md` on that repo, production/Neon safety and reviewed release approvals.
- Each change: date, request, selected branch/commit, filenames, test commands & results, production/runtime verification, scanner accuracy impact, changed contract/schema version, fallback, release SHA, open issues and next tasks.
- State values: `planned` / `implemented` / `tested` / `deployed` / `browser_verified`. **Never mark a state without evidence.**

### Change log

- **2026-11-25 — QA track registered:** OWNER proposed independent QA Auditor to protect DB/DL/LC/LL and current QA published results; this handoff, shared-core parity entry and INDEX were created as **design only**. Baselines: Auditor `5f86bd146e09`, QA `003926456e16`. **No Extension Source, Backend, Neon, Moodle, queue or published result changed.**
