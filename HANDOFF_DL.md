# Handoff — DL / Dashboard Legacy

> สถานะเอกสาร: **Migration baseline 24 พ.ย. 2569** จาก Handoff เดิมถึง §130 และ Source ใน `main` ณ Commit `b1813af93b45`  
> **ไม่ใช่การรับรองเวอร์ชันที่ติดตั้งบนเครื่อง หรือสถานะ production ปัจจุบัน**: ทุกครั้งที่ทำงานต้องตรวจ Source/Release/CI/Runtime ล่าสุดก่อน

> **DL = Dashboard Legacy** — Dashboard-side Legacy checker, queue, evidence/result export และเกณฑ์ `legacy_12569` ที่ใช้งานตาม scope. **ไม่ใช่ DB current**.

## Code & Release inventory

- GitHub Source: `release-src/dashboard-0.13.35/`, `release-src/dashboard-0.13.37/`, `release-src/dashboard-0.13.38/`, `release-src/dashboard-0.13.39/`
- Build scripts: `release-tools/patch-dashboard-0.13.38.py`, `release-tools/patch-dashboard-0.13.39.py`, `.github/workflows/build-dashboard-0.13.39.yml`
- Release manifest: [`downloads/dashboard/0.13.39/release.json`](downloads/dashboard/0.13.39/release.json) → **0.13.39**, ZIP 9,330,641 bytes, 24 parts, SHA-256 `046E50F1CA0D2C03991DC8D09F617691CB8F0B8D3DF88EDA5E2C53D814B0533B`
- Release/Source verified **ใน GitHub**, ไม่ได้ยืนยัน Chrome ที่ผู้ใช้ติดตั้งอยู่จริง ณ 24 พ.ย.

## Policy / Criteria (scope-locked)

- `criteria_mode=legacy_12569`, `semester_code=1/2569`, course group=GR เป็นขอบเขตที่ระบุสำหรับงาน DL ชุดล่าสุด
- Theory 100 คะแนน, ผ่าน **70**; practical 50 คะแนน, ผ่าน **40** โดยต้องรักษา mandatory gates ตาม track; รายละเอียด policy ต้องอ่าน `supabase/functions/api/criteria-12569.mjs` กับ matcher/source ของรุ่นจริงก่อนแก้
- Video tolerance ผ่อนปรนตามหน่วยกิตและครั้งเรียน (§§101–104), และ Moodle Quiz ผ่อนปรน Pre/Post **เฉพาะครั้ง 2–10** (§114), อย่าขยายขอบเขตเอง
- Instructor missing-name waiver **ไม่ใช่รูปทั่วไป**: ต้องมี contextual instructor photo/contact และ reviewer provenance ตาม scope (§§111, 114)
- หากคะแนนหรือสถานะใน DB ถูก manual-correct แล้ว ต้องไม่ให้รันเก่าทับผลโดยไม่มี guard

## Critical chronology / lessons

- §§77–82 — ข้อมูล GR/GS Sheets, scope และกรอบการ Sync
- §§83–92 — evidence review UX, video duration, false-positive instructor, structure problems
- §§93–100 — retry/ack/queue, result reconciliation and 1/2569 scoring
- §§101–107 — credit-aware tolerance, case-based fixes, topology repair Extension 0.13.37
- §§108–109 — User evidence overview/weekly details + ALB311 manual correction
- §110 — full GR regression investigation (read-only) and 13-course first shortlist at the time
- §111 — 0.13.38 contextual instructor + provider retry; §112 — admin version drift (Web Platform)
- §114 — 0.13.39 Moodle Pre/Post and scoped instructor-name waiver; 43 production corrections, outcome changes (historical snapshot)
- §115 — ICT306 reviewer-confirmed activity classification (course-specific; not global new Quiz rule)
- §116 — BUS431 warning misleading (Web Platform), **not** grounds to change 53/100
- §117 — 2 older-pass/current-nonpass cross-criteria cases BUS431/MKT453; cannot compare old 80 vs new 70 as same policy

## Unresolved technical/operational risks

1. **Server fallback not deployed in §114**: Source committed `applyLegacyMoodlePrePost`, deploy failed on npm dependency; verify live Supabase API before claiming active (may have changed since).
2. **Main Data Sync**: durable outbox & worker must confirm row V/W/X, GRGS_Public. Do not claim success from Supabase projection or score alone.
3. **Live provider playback**: OneDrive/Drive/Vidyard click-to-play, duplicate URLs, duration confidence; old/new same asset comparisons need verified matching not broad reuse
4. **Instructor false negative/positive**: ALB311, IAI239, EBC340, FDM313 fixtures; don't blanket restore all old instructor passes
5. **Old current vs new legacy score**: BUS431/MKT453 history is cross-criteria, not proof of score loss on identical rubric
6. **Version pinning**: Do not overwrite DB current by treating latest `downloads/dashboard` as universal DB release

## Acceptance and release

- [ ] Manifest/release.json/ZIP hashes match downloaded artifact and admin version text
- [ ] GR 1/2569 course-group/course ID/credits/track guards verified
- [ ] Relevant Moodle Quiz and recording/VOD fixtures pass at scanner and scorecard
- [ ] Reviewer decisions, audit history and public score remain consistent
- [ ] Worker publish & outbox sync verified if outcome changes
- [ ] Handoff update + Shared Core compatibility note before port to DB/LC/LL


## Operational baseline — DL 0.13.39 และ production-safe guard

| หัวข้อ | แนวปฏิบัติจากหลักฐานใน Archive |
|---|---|
| Source | ใช้ release 0.13.39 ที่มี `release.json` hash ยืนยัน; `supabase/functions/api/criteria-12569.mjs` เป็น Source policy แต่ **runtime อาจ deploy คนละรุ่น** |
| Scope | GR, `semester_code=1/2569`, `criteria_mode=legacy_12569`; ห้ามให้ GS, DB current หรือ LL หลุดเงื่อนไข |
| คะแนน | Theory 100/70, practical 50/40 และ mandatory gates; อย่ายกคะแนนเดิมจาก current 110/80 มาเทียบตรง ๆ |
| Quiz | §114 พบ regression Pre/Post eligible Moodle Quiz ช่วง Session 2–10; 0.13.39 ปรับ `presentQuiz`; ห้ามนับย้อนหลังช่วง 11–15 โดยไร้ policy ใหม่ |
| Instructor | รูป/ชื่อ/ช่องทางติดต่อต้องอ่าน context ให้ถูก; การอนุโลมขาดชื่อที่ §114 ใช้กับ ICT218 มี trace ไม่ใช่การให้อภัยทุกรายวิชา |
| Video | §116 BUS431: 34 VOD ที่ `duration_read`, 30 LiveRecord ที่ skipped — ข้อความคำเตือนผิด ≠ URL เสีย; เวลาไม่ครบยังไม่ผ่าน |
| การยืนยัน | ห้ามละเมิด reviewer decision หรือ override manual score โดยไม่มี evidence mapping/trace |
| Publishing | Supabase score+public projection ต้องสอดคล้องกัน และ outbox verified/Google Sheets V/W/X จริงก่อนบอก Sync สำเร็จ |

### Regressions ที่ต้องป้องกัน

- **ALB311**: instructor/photo+QR และ Session 9 video time old/new mismatch. ระวัง replay/regression (§109)
- **ICT218**: 58→73 เพราะ Moodle Quiz tolerance และ reviewer-confirmed instructor name waiver (§114)
- **ICT306**: Course ID 21261, activity under end-of-session heading though named Post-test, reviewer explicitly reclassified one activity; นับครั้งที่ 1 เท่านั้นและห้ามให้ Pre/Post ซ้ำ (§115)
- **BUS431**: Course ID 21302, คำว่า “เปิดปลายทางไม่ได้” ผิดจากการสร้างข้อความ; video score ไม่ได้เปลี่ยนจาก UI fix (§116)
- **MKT453**: old passes/current nonpass เป็นการเทียบ **ข้ามเกณฑ์**; readback พบ video durations/duplication/access issues ไม่ใช่ข้อสรุปว่า defect เดียว (§117)

### Production correction rules

1. ตรวจ latest published run ID, audit mode/group/semester, review confirmation และหลักฐาน `evidenceSnapshot` จริงก่อนคำนวณ
2. ทำ independent score replay และ guard MD5/source payload, no queued/running job, no active outbox lease
3. เก็บ original criteria, scorecard, reviewer decision และเหตุผลก่อนเขียน; แก้เฉพาะ applicable criterion ไม่ sweep ทั้งวิชา
4. เปลี่ยนคะแนนโดยไม่มี outcome change ต้องตรวจ public projection เท่ากับ source; หาก outcome change ต้องสร้าง/ติดตาม outbox sync ไม่อ้างว่า verified ทันที
5. ดูไฟล์ `HANDOFF_WEB_PLATFORM.md` เมื่อต้องเปลี่ยน API/Schema/Cloud Worker; ห้าม Deploy server จาก commit ที่ยังไม่ยืนยันความตรงกับ production
6. ไม่ให้ตัวยืนยัน / manual correction เก่าถูกตรวจซ้ำด้วย Extension รุ่นก่อนหน้าแล้วทับผลโดยไม่ตรวจ

## Change log

- 2026-11-24 — แยก DL จาก current DB; จุดอ้างอิง Source เป็นรุ่น GitHub 0.13.39; ไม่มีการตรวจใหม่/เปลี่ยนคะแนน
