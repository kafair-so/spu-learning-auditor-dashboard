# SPU Learning Auditor integration

This copy is isolated from the existing OOE Dashboard deployment. It reads the existing published course CSV in read-only mode and connects audit results through the Supabase API.

## Pages

- `index.html` combines the original course dashboard with the instructor-facing audit result. It exposes only `pass`, `has_content`, and `no_content`.
- `audit-review.html` is the reviewer view. It exposes all five internal statuses and imports Auditor JSON files.
- `audit-evidence.html` lets an authenticated instructor inspect the newest result and the two previous results for one course.

## Prototype workflow

1. Install the SPU Learning Auditor extension build.
2. Audit a course and open its report.
3. Select **ส่งออกเข้า Dashboard** to download a JSON result.
4. Open `audit-review.html` as an authorized reviewer and import one or more JSON files.
5. Review orange items when their possible score can reach the threshold.
6. Export the public CSV. It contains only green, yellow, and red public statuses.

## Publication rules

- A confirmed score at or above the threshold publishes `pass` immediately.
- `needs_review` is used only when reviewable points may reach the threshold.
- A completed audit that cannot reach the threshold but contains course material publishes `has_content`.
- A completed audit with no substantive course material publishes `no_content`.
- An incomplete/system-failed audit uses `audit_failed`.
- `needs_review` and `audit_failed` preserve the last public status and never create a new public status.
- Each course retains at most three audit runs. Reimporting the same audit ID updates that run instead of creating a duplicate.

## Access boundary

Before any deployment, populate `reviewerEmails` in `auth-config.js`. The reviewer page denies domain users who are not on that list. The instructor-facing page contains no reviewer-page link.

Production stores internal reviewer records in Supabase and serves public results through the Edge Function. Do not publish internal records, detailed evidence, or audit exports in GitHub or the existing public Google Sheets CSV.

The production queue and publication contract is documented in `PRODUCTION-ARCHITECTURE.md`. It separates a missing-results scan from an administrator-triggered refresh and publishes only complete, atomic snapshots.
