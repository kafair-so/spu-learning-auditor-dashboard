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

1. **Audit Eligible vs Display Eligible**: OWNER confirmed **audit all target-course Profiles in principle, GS/GR first and GN later, independently of public Dashboard display**. Exactly which academic exemptions apply and whether Admin-hidden courses may be audited remains **pending rubric/OWNER policy review**; current QA `effective_visible` checks must remain fail-closed until a separate approved implementation changes them.
2. **GN**: OWNER confirmed GN as secondary/deferred audit scope, with no requirement to publish it on primary payment-oriented Dashboard. **GN criteria infographic was supplied on 25 Nov 2026**, including separate first-session and weeks 2–15 components, theory/practical recording count and monitoring elements; scoring weights/thresholds and full eligibility exceptions still require reviewed decisions (see §9).
3. **Term versioning**: OWNER confirmed 3/2568 and 1/2569 use the **Legacy family**. **Criteria infographics and updated owner exceptions received 25 Nov 2026**; numeric weights/score threshold, policy effective dates, source exceptions and exhaustive eligibility still require formal reconciliation. Future terms have **no approved rubric** and require a new OWNER decision. Never infer one shared numeric score gate merely from the word Legacy.
4. **Publication/storage**: OWNER confirmed **QA vNext results must be stored completely separately from current QA/DB published results**, never overwrite existing run or publication pointers. New QA auto-publication/default visibility and exact storage schema/provider are **not yet approved**; default is no auto replacement.
5. **Repository/release ownership**: whether QA Extension source stays in `donut204/spu-course-qa/extension/` or moves to dedicated source branch/repo; require ownership/CI/test path confirmation.
6. **Source freshness**: reconcile Neon live Raw/Published/Override/Personnel/SCMS data without changing it; earlier mismatched Course ID investigations remain unconfirmed until Neon read-only checks.

## 8. OWNER confirmed scope + database consultation — 2026-11-25

**Status:** `owner_policy_confirmed_in_part / storage_design_proposal_only`; historical source analysis is based on Course QA `main@003926456e16`, not live Neon inspection. **This entry records decisions and alternatives only; no new extension/schema/DB/queue/deployment created.**

### A. Confirmed academic and deployment requirements

- **Priorities:** Scan **all relevant GS and GR Course Profiles first** for faculty payment-supporting audit; support GN as a later, lower-priority scan group whose results do **not** have to be visible on the primary payment-oriented Dashboard.
- **Main Concern:** GS, GR, GN. Previously excluded group codes `GU/FN/GI/FS/GH` remain out of initial audit concern; raw database rows must remain untouched. "All target Profiles" does **not** authorize inventing academic exemptions (student=0, special-only faculty, project, etc.). Await OWNER-provided academic criteria for full inclusion/exclusion and GN rubric.
- **Term family:** Semester **3/2568** and **1/2569** use Legacy criteria as a **family**. Freeze rubric by `academic_year + semester + course_group + source + approved version`; numeric criteria and relief rules require the forthcoming documents. Later terms require explicit policy negotiation and approval, not automatic inheritance.
- **Result isolation:** New QA vNext results must never mix or overwrite published data, immutable evidence, user corrections, or publication pointers of the current QA-integrated `0.13.34` / DB / DL / LC / LL.
- **Retention:** Keep **latest three audit results per course** as the operating history (recommended identity = `source + Moodle Course ID + academic year + semester`); retain **course Profile/metadata history for 3–5 years**. Clarify exact years, revision/legal obligations and cold-archive policies before physical deletions.
- **Migration direction:** Temporary Cloud storage now; the full application and database are intended to move to the university's **on-premises** servers. Keep implementation PostgreSQL-portable.

### B. Storage options (recommendation pending OWNER decision)

1. **Preferred for initial integration (proposal, not approved):** Keep Neon PostgreSQL as the QA data source and add a separate proposed `qa_auditor_v2` schema with its **own roles, migrations, queue/job/run/evidence/review/publication tables, endpoints, feature flags and versioned contract**. Existing `auditor.*` remains untouched and the new vNext presentation reads its own result pointers only. Reuse `course_profiles` and scoped immutable reference snapshots as read-only source data; do not clone raw master rows unnecessarily. Because schemas share compute/storage, run isolated tests in a **separate non-Production Neon project/branch or local PostgreSQL**, and complete capacity/load/permission gates before production integration.
2. **Stronger resource isolation if needed:** Dedicated Neon **project/database** for new Auditor records plus explicit read-only Course QA source connection. Benefits: separated compute/limits/blast radius; costs: two DB connection domains, cross-DB referential integrity impossible without replicated identifiers, additional reconciliation and migration/backup complexity. Consider only after measured size/load/security constraints; **do not switch vendor merely to obtain a new table**.
3. **On-prem:** Retain PostgreSQL schemas or separate them into databases according to university IAM/backups. Export/import using tested `pg_dump`/`pg_restore` and explicit restore verification; check PG version/extensions/roles, replayable migrations, row counts, SHA-256 checksums, read-only Moodle config, backups and RPO/RTO. Never assume a ZIP or SQL dump alone proves successful migration.

**Cost truth:** QA Handoff states Neon was changed to **Launch** on 13 Nov 2026; user mentioned Free Cloud generally. **Actual production plan, storage, compute, growth and remaining quotas require direct Neon console verification**; do not assume Free quota. Budget with measured audit evidence size (median/p95), number of GS/GR/GN Profiles, retained 3 runs, metadata over 3–5 years, indexes, backup/archive and concurrency. Evidence may be large (current QA schema2 allows up to 2 MiB per payload); keep heavyweight artifacts out of main result tables unless justified.

**Proposed retention semantics, pending policy:** Latest three *full* results per audit subject available online; older results that must remain legally/accountably traceable are transitioned to immutable metadata/archive records without breaking publication/reviewer FKs. Existing QA `auditor.audit_run_snapshots` and guarded retention migrations are examples to inspect, **not** authorization to reuse their destructive cleanup for `qa_auditor_v2`. Course snapshots should be captured by year/term/version with source/capture timestamp; a course missing in a later term must not erase its earlier history.

### C. Gates before real coding / integration

- [ ] OWNER sends academic eligibility and scoring documents (including GN) for rule inventory; resolve exclusions per term and profile **separately from Dashboard display eligibility**
- [ ] Confirm actual Neon project/plan, `pg_total_relation_size`, Cloud storage remaining, quota and retention policy; estimate 3-result + 3–5-year growth
- [ ] Approve separate-schema versus separate-project topology, migration ownership, feature flags and independent QA results route
- [ ] Define new `qa_auditor_v2` schema contract + access role boundaries without writing to existing `auditor` or historical publications
- [ ] Define source/readiness/priority rule `GS/GR → GN`, de-dup by source-qualified Course ID, archive references and 3-run handling
- [ ] Isolated PostgreSQL + Browser/Moodle READ-ONLY replay, then OWNER Production approval and on-prem migration dry-run plan
- [ ] Mirror implementation facts into `donut204/spu-course-qa/SPU_COURSE_QA_HANDOFF.md` **when QA repository actually changes**; shared scanner changes go to Shared Core Handoff

## 9. Criteria intake — 2026-11-25: GS/GR, GN and overall Table 3

**Status: DOCUMENTS RECEIVED + OWNER POLICY CONFIRMED FOR QA DESIGN; NOT IMPLEMENTED / NOT RECOMPUTED.**  
Source evidence from chat: `GR-GS.jpg` (blue Fully Online criteria), `GN.jpg` (pink in-class criteria), `image(20261125-043426).png` (Table 3 overall checks). These sources were inspected at full resolution, with manual magnification of the component rows. **The screenshots do not specify numeric scoring weights for Table 3.** In prose below distinguish (A) infographic baseline, (B) OWNER's later authorized exceptions, (C) pending grading decisions.

### 9.1 Source scope and baseline components (what the images actually say)

- The GS/GR infographic is titled "เกณฑ์การจัดการเรียนการสอน สำหรับรายวิชาที่จัดการเรียนการสอนแบบออนไลน์ (Fully Online)"; the GN infographic is titled "เกณฑ์การจัดการเรียนการสอน สำหรับรายวิชาที่จัดการเรียนการสอนในห้องเรียน". Both state application **from term 2/2568 onward** in their headers. For QA vNext, OWNER previously specified Legacy family for **3/2568** and **1/2569**, with future-term policy explicitly TBD; do not silently retroactively change historical public results.
- **GS/GR first session:** subject/instructor overview (subject name, credits, prerequisite where relevant, description, learning outcomes, evaluation/weights, instructor name/photo, contact and learning agreement); course-wide teaching material/document (including 15-session plan); course introductory/prerecorded video; Podcast; first-session activity (Assignment/Quiz/other suitable); AI Tutor.
- **GS/GR sessions 2–15:** per-session teaching plan; per-session teaching materials; prerecord video; Podcast; pre-test and post-test with **at least 5 questions each** according to blue infographic; optional end-of-session activity.
- **GN first session:** subject/instructor overview; course-wide teaching material/document and 15-session outline; introductory/prerecorded video; Podcast; AI Tutor. GN infographic does **not** list first-session activity as an independent row.
- **GN sessions 2–15:** per-session teaching plan; materials; prerecord video; Podcast; no GS/GR-style mandatory pre/post requirement in the pink infographic. Pink infographic notes theoretical courses need video+Podcast all 15 sessions while practical courses need them for **at least 7 sessions** across the term.
- **Unrelaxed video durations stated in images:** GS/GR first session >=15 minutes per credit (combined intro/video), sessions 2–15 >=30 minutes per credit per session. GN first >=15 minutes per credit; sessions 2–15 >=15 minutes per credit per session. These are source-document requirements, **not the operational relaxed minimum**; see §9.2 for owner preference and verification gate.
- **AI Tutor / Podcast details shown:** Podcast content/audio at least one per cited session and 10 minutes total according to infographic; week1 AI Tutor is a learning-support/feedback tool. Keep exact found/missing counts and provenance even if payment scoring does not require them.

### 9.2 OWNER's controlling operational decisions for QA vNext

1. **Payment versus OOE KPI are separate outputs:** For **GS/GR only**, AI Tutor and Podcast (combined shorthand **"AI Podcast"**) must still be scanned and reported `present/absent/unreadable` with relevant evidence/count and KPI applicability, **but contribute zero payment score and cannot fail a faculty-payment audit**. Do not silently remove the AI Podcast checklist from evidence. GN KPI/scoring disposition remains to be separately confirmed; GN is not in initial payment-dashboard priority.
2. **Strict external Quiz:** Withdraw the 1/2569 concession that accepted **Moodle-native Quiz**; use externally linked Quiz/pre-/post-test evidence as required by the approved criteria. The supplied instruction explicitly says ordinary Moodle Quiz is not countable for QA vNext, regardless of previous DL/LL relaxed behavior. Preserve course-specific legacy results; do not rewrite prior published records. Review the distinction between week1 generic activity and weeks2–15 pre/post separately before coding.
3. **Alternative learning documents are accepted:** A legitimate lesson plan or teaching material that is not a native PDF may count, including **Canva, Google services/Docs/Drive, Excel, DOC/DOCX, PowerPoint, Gamma, PDF and other authentic instructional resources or external links**. Reader must verify relevant content and correct component/session, not award points for empty, unrelated or inaccessible links; use `needs_review/unreadable` when the target cannot be verified. Differentiate teaching plan from teaching materials while preserving source URLs/type.
4. **Recording quality for GS and GR:** Minimum changed from the blue image's **B+** standard (historical GR non-plan exception B) to **B for both GS and GR** per OWNER's current rule. GN infographic already states B minimum; no invented GN adjustment.
5. **Video runtime tolerance stays in force:** OWNER requests *preserving existing reduced minima by course credits and session*. Historical LL Handoff provides **first session 3/5/10 min and sessions 2–15 5/10/20 min for 1/2/3+ credits**. This is an existing-tracking reference, not an automatic proof that QA's 3/2568 and 1/2569 runtime implementation is aligned. Before hardcoding, verify the precise approved DL/LL tolerance, combined-duration handling, relevant group, source, and effective term against current course policies. Never interpret unreadable time as genuine zero.
6. **New results isolated:** QA vNext reads/analyzes these criteria without writing over QA old `auditor` results, other tracks or earlier confirmed manual corrections; publish only with separately authorized migration/release.

### 9.3 Table 3 — "การตรวจสอบข้อกำหนดทั่วไปของรายวิชา (ตรวจสอบภาพรวม)"

Owner reports that a **third scored table existed in older Sheet reporting but its scoring disappeared in later Auditor output**. Supplied screenshot is an overview checklist with **five items and checkboxes, not explicit numeric weights**:

| # | Check | Source requirement | Implementation/evidence note |
|---|---|---|---|
| 1 | การจัดให้มีการพบนักศึกษา | กำหนดตารางพบนักศึกษาเพื่อเพิ่มประสิทธิภาพการเรียนการสอน **รวม 3 ครั้ง** | Inspect documented contact plan; distinguish scheduled from proven completed meetings when policy specifies |
| 2 | คุณภาพวิดีโอบันทึกการสอน | Image: >= B+ (GR non-plan >= B); **OWNER override: GS/GR >= B** | Track quality evidence separately from presence/duration; manual review if no reliable classification |
| 3 | การวางสื่อใน d-Learning | วาง **ลิงก์วิดีโอและคลิปเสียง** ในระบบ ไม่วางไฟล์โดยตรง | Validate LMS link-versus-direct-upload; do not confuse permitted *document* file types with forbidden direct *video/audio* uploads |
| 4 | การส่งงานของนักศึกษา | มอบหมายงานใน d-Learning ได้ แต่ไม่กำหนดให้ส่งงานใน d-Learning | Separate announcement/assignment from submission destination |
| 5 | การสำรองเนื้อหา | จัดเก็บเนื้อหาและวิดีโอเข้าระบบตามที่มหาวิทยาลัยกำหนดและตามช่วงเวลาที่กำหนด | Cross-system backup may be **not externally verifiable** without approved evidence; do not infer fail or pass |

**Source-code comparison:** At `kafair-so/spu-learning-auditor-dashboard/main` on 25 Nov, `supabase/functions/api/criteria-12569.mjs` computes theory 100/70 and practical 50/40 from first-session and weekly checklist categories (`courseInformation`, `teachingPlan`, `teachingMaterials`, `video`, `preTest`, `postTest`, `assignment`). **No distinct weighted Table-3 overview score is visible in this scorer**. This supports an investigation but does **not** establish prior Table-3 point weights or whether original Sheet points were included elsewhere. **Do not invent Table-3 scores or mandatory gates.**

Required QA vNext behavior: restore **Table 3 as a visible dedicated section** in evidence and report, with `pass/fail/needs_review/not_verifiable` for each of five checks, source provenance, and an explicit `score_weight_pending_source_verification` state until original graded Sheet/formula or approved weight matrix is obtained. If confirmed mandatory/scored, build a separately versioned rubric, test against original expected scores, then document any overall pass/fail change before activation.

### 9.4 Policy precedence / term applicability / regression

| Topic | Infographic / existing legacy code | OWNER instruction for new QA | Status |
|---|---|---|---|
| GS/GR AI Tutor, Podcast | Listed as weekly/session elements | Preserve monitoring and KPI presence; **exclude payment scoring and pass gate** | OWNER-confirmed QA vNext |
| Moodle-native Quiz | Old relaxed code counts various Moodle Quiz evidence, e.g. 1/2569 Pre/Post 2–10 in `criteria-12569.mjs` | **External link only** for countable Quiz; no Moodle internal Quiz tolerance | OWNER-confirmed QA vNext |
| Plan/material format | "File PDF" in two infographics | Accept suitable verified alternative file/links | OWNER-confirmed QA vNext |
| GS/GR video quality | B+ baseline with GR non-plan B exception | **B minimum for both** | OWNER-confirmed QA vNext |
| Video duration | Original mins higher | Preserve reduced per-credit/session tolerance; map exact term-wise baseline | Confirm exact matrix before implementation |
| Table 3 score | Image includes 5 checks, no numeric weights; Legacy scorer has no independent overview total | Include 5 checks; investigate missing grading and original Sheet | Scoring/mandatory status **OPEN** |
| Future course format/rubric | Infographics state 2/2568 onward | University deliberations ongoing, retain present approved policy **until new official announcement** | Future changes NOT assumed |

**Testing gates:** GN/GR/GS per-term/per-profile fixtures, full 15-session mapping, alternative teaching plans (Canva/Word/Gamma/etc), course-specific link validity, strict external pre/post Quiz, quality B check, session-specific duration tolerance, AI Podcast exclusion-from-payment with KPI still captured, Table-3 five-row section and pending grade, regression comparing original Legacy results without overwriting them.

**Additional open evidence required:** Original Sheet **Table 1/2/3 including actual score cells and formulas/weights**, current hand-maintained exception list and effective date, authorized quality grading evidence, video-tolerance matrix by term, and backup-verification method. These are **not blockers for documentation**, but are gates for scoring engine changes, publication and retroactive computation.

### 9.5 OWNER decision — Table 3 manual scoring and integer final-score decision (2026-11-25)

**Status: OWNER-confirmed design direction; NOT IMPLEMENTED / NOT RECOMPUTED / NO PRODUCTION CHANGE.** This entry extends §9.3–9.4 for the independent QA vNext GS/GR payment audit only. Preserve all prior published results, confirmed reviewer decisions, and the existing four Auditor tracks. The OWNER requested documentation before implementation.

#### A. Table 3 — integrate into the existing total, Admin verifies manually

- OWNER confirms the five overall checks should contribute to the existing scoring total without increasing the full score or changing the pass threshold: theory **100 points / pass 70**, practical **50 points / pass 40**. Preserve other approved mandatory gates; do not invent new mandatory gates. The OWNER/Admin will personally verify these items in the Admin evidence/review page rather than require the automated scanner to decide them.
- Show a dedicated **Table 3 — การตรวจสอบข้อกำหนดทั่วไปของรายวิชา (ตรวจสอบภาพรวม)** checklist:
  1. การจัดให้มีการพบนักศึกษา 3 ครั้ง — scheduled meetings as specified by policy.
  2. คุณภาพวิดีโอบันทึกการสอน — GS/GR minimum B per §9.2; Admin confirms quality evidence.
  3. การวางลิงก์วิดีโอและคลิปเสียงแทนการอัปโหลดโดยตรง — distinguish audio/video from permitted document uploads.
  4. ข้อกำหนดเกี่ยวกับการส่งงานของนักศึกษา — assignments may be announced in d-Learning, but student submissions must not be required there.
  5. การสำรองเนื้อหาและวิดีโอ — Admin checks approved backup evidence/method.
- Proposed interaction: five checkboxes, per-item point display, running subtotal and explicit Admin confirmation/save. An unchecked box **before confirmation means unreviewed**, not fail. After the reviewer explicitly confirms the complete checklist, checked items receive their assigned points and unchecked items receive zero under the proposed binary scoring model. Keep review pending until complete confirmation; retain evidence/notes and distinguish unreviewed, fail and not-verifiable internally. Do not silently assign zero or publish final pass/fail before confirmation. If evidence is not verifiable, require reviewer resolution rather than treating it as an automatic failure.
- Proposed workflow: scan Tables 1/2 automatically → persist provisional exact score/evidence → Admin manually reviews Table 3 → combine scores → round final total → apply threshold and other mandatory gates → authorized confirmation/publication in the isolated QA vNext store. Preserve reviewer identity, timestamps, notes/evidence, checklist state, policy version, corrections and audit trail; no automatic rerun may overwrite confirmed manual decisions or prior published results.
- **Proposed allocation, not independently approved as final weights:** preserve the relative weights of existing automatic components, scale their normalized scores to 90% of the original total, allocate 10% to Table 3 equally across its five checks. Theory: auto max 90 + manual max 10 (2 each) = 100; practical: auto max 45 + manual max 5 (1 each) = 50. Illustrative formula with old automatic subtotal normalized to the original maximum and excluding AI Podcast from payment: `raw_total = 0.9 * auto_score + passed_checks * (full_score * 0.02)`. AI Tutor and Podcast still appear as monitoring/KPI evidence, never contribute payment points or payment pass gates for GS/GR. If the old automatic score has a different denominator after exclusions, normalize explicitly before scaling; do not double-count removed categories. The OWNER agreed with the direction of integrating Table 3 and preserving historical results; the exact 90:10 allocation and source historical weights remain to be confirmed before implementation. Retain §9.3's investigation of the original graded Sheets/formulas; the proposed allocation is not a claim of historical official weights.
- Consequence: even with unchanged maximum and threshold, redistributing points may change an outcome. Use a new versioned rubric for QA vNext, compare fixtures around the threshold and never retroactively replace already certified results. GN-specific scoring/eligibility remains pending.

#### B. OWNER-confirmed final score rounding and pass decision

- Calculate all component scores and weighted subtotals at their real decimal precision (not restricted to .0/.5); **do not round individual components or intermediate subtotals before addition**.
- Persist the exact raw final score and the rounded integer final score separately, with the rubric version and inputs needed for independent replay.
- Round the final combined total once to the nearest integer, conventional **round half up** for non-negative scores: fractional part below 0.5 rounds down, 0.5 or above rounds up. Avoid binary floating-point boundary artifacts; use deterministic decimal/fixed-precision arithmetic and explicit rounding semantics, not banker's rounding.
- **OWNER explicitly confirms:** if the rounded total reaches the unchanged pass threshold, count the score criterion as passed even when the raw score is below it. Theory: rounded >=70/100; practical: rounded >=40/50 (corresponding unchanged practical threshold). Other approved mandatory gates and complete manual review still apply; a rounded passing score cannot bypass an unmet gate.
- Display integer scores consistently in Admin, Dashboard, teacher-facing evidence and PDF reports. If component scores are displayed, format them as integers for presentation only; never sum displayed rounded component values to compute the total. The raw decimals remain accessible to authorized auditors for traceability, not as conflicting public pass indicators.

| Type | Exact final score | Displayed / decision score | Score criterion |
|---|---:|---:|---|
| Theory | 69.49 | 69/100 | Fail |
| Theory | 69.50 | 70/100 | Pass |
| Theory | 69.75 | 70/100 | Pass (explicit OWNER example) |
| Practical | 39.49 | 39/50 | Fail |
| Practical | 39.50 | 40/50 | Pass |
| Practical | 39.85 | 40/50 | Pass |

#### C. Acceptance before implementation/release

- Confirm actual Table 1/2/3 weights and approved new allocation; preserve maximum 100/50, pass threshold 70/40 and all approved mandatory gates.
- Test arbitrary fractional component values, half-up boundaries, zero/full totals, no intermediate rounding, exact-score replay, and identical integer display/status across Admin/Dashboard/evidence/PDF.
- Test checklist pending vs explicitly confirmed, no silent failure for unreviewed items, permission checks, audit trail, manual decision reuse only with valid provenance, and isolated publication pointers.
- Confirm no historical result recomputation or overwrite, no changes to DB/LC/LL/DL or existing QA-integrated 0.13.34, and no production/schema changes until separately authorized. This is a documentation-only decision record.

## 10. Handoff and Change Log protocol

- Edit `HANDOFF_QA.md` for QA Extension scope and compatibility, `HANDOFF_SHARED_CORE.md` for cross-track parity, `handoff/INDEX.md` for important status/versions.
- If implementation touches Course QA repo, **also** update `SPU_COURSE_QA_HANDOFF.md` and follow `AGENTS.md` on that repo, production/Neon safety and reviewed release approvals.
- Each change: date, request, selected branch/commit, filenames, test commands & results, production/runtime verification, scanner accuracy impact, changed contract/schema version, fallback, release SHA, open issues and next tasks.
- State values: `planned` / `implemented` / `tested` / `deployed` / `browser_verified`. **Never mark a state without evidence.**

### Change log

- **2026-11-25 — OWNER Table 3 manual review + final score rounding:** agreed to integrate all five manual Admin checks into unchanged GS/GR Legacy totals and pass thresholds, with no historical overwrite; documented proposed 90:10 allocation (exact weights pending). OWNER explicitly confirmed integer half-up rounding of final total for display and pass/fail threshold, including 69.75→70. Raw decimal retained, other gates preserved. **Docs only; not implemented or deployed.**

- **2026-11-25 — GS/GR/GN criteria reviewed + Table 3 issue:** Read OWNER's blue GS/GR and pink GN infographics and Table-3 overall checklist; recorded payment vs AI Podcast KPI split, withdrawal of native Moodle Quiz tolerance, accepted non-PDF instructional resources, B minimum GS/GR video quality, preserved video time tolerance (exact policy verification pending), 5 overview checks and missing Table-3 score investigation. Future university policy remains under discussion. **Docs only**.

- **2026-11-25 — OWNER decisions / QA storage planning:** confirmed GS/GR-first all-target-profile audit, GN later and not required for payment-facing Dashboard, Legacy rubric family for 3/2568 and 1/2569, strict isolation of new results, latest three results and 3–5 year course metadata goal; proposed separate Neon PostgreSQL schema versus isolated project, future on-prem migration and pending criteria. **Docs only; no DB or Extension changes**.

- **2026-11-25 — QA track registered:** OWNER proposed independent QA Auditor to protect DB/DL/LC/LL and current QA published results; this handoff, shared-core parity entry and INDEX were created as **design only**. Baselines: Auditor `5f86bd146e09`, QA `003926456e16`. **No Extension Source, Backend, Neon, Moodle, queue or published result changed.**
