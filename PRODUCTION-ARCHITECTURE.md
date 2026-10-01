# OOE Dashboard + SPU Learning Auditor production contract

The selected shared backend is Supabase project `nwupjnkotdkodyxnraie`.
Postgres stores the catalog, jobs, decisions, and three-run history; Google
Identity identifies SPU users and the Edge Function verifies each token and
reviewer email server-side; a private Storage bucket holds evidence; Edge
Functions are the API and signed-evidence boundary.

## Public read path

- The instructor dashboard reads a versioned, read-only public snapshot through a CDN.
- A published course exposes only `pass`, `has_content`, or `no_content`, the latest audit time, and three evidence-run identifiers.
- `needs_review`, `audit_failed`, reviewer notes, job errors, and queue state stay in the private API.
- Publishing a completed result and moving the course's current-result pointer must be one atomic transaction. Readers therefore see either the previous complete result or the new complete result, never a partly updated course.

## Audit commands

### 1. Missing-results scan

The scheduler queries courses without a current audit result and creates one idempotent job per course. It never queues an already-audited course and never starts a full scan. Repeating the command is safe because the unique job key is `missing:<courseId>:<catalogVersion>`.

### 2. Admin refresh

An authorized reviewer creates a refresh batch. The API snapshots the identifiers of every course that already has a result and creates one job per course. Courses discovered after the batch starts are handled by the missing-results scan. Repeating a failed job affects only that course.

## Result lifecycle

1. A worker claims one queued course.
2. SPU Learning Auditor inspects that course only and uploads its result plus evidence.
3. The API validates course identity, schema version, completion state, and evidence ownership.
4. A green, yellow, or red result becomes the new public result immediately.
5. Orange or gray stays private and preserves the previous public result until the review or rerun finishes.
6. The API keeps the newest run and two prior runs per course. Adding a fourth run deletes or archives the oldest only after the new run is committed.

## Required data collections

- `courses`: course identity, catalog fields, and pointer to the published result.
- `audit_runs`: immutable results and evidence metadata; retain three per course.
- `audit_jobs`: missing scan, refresh batch, retry, claim, progress, and error state.
- `refresh_batches`: administrator command, course count, progress, start and completion times.
- `review_decisions`: reviewer identity, decision, note, and timestamp.
- `public_course_results`: denormalized snapshot used by the dashboard and CDN.

## Scale and access

- GitHub Pages can serve the static frontend to thousands of readers, while the results must come from a shared backend rather than browser local storage.
- Cache the public snapshot at the CDN and refresh it by version/ETag. Browsers always request the newest published version but may safely reuse unchanged data.
- Domain users can read public results and evidence. Only the reviewer role can read orange/gray records or issue refresh commands.
- Evidence URLs must be short-lived signed URLs or authenticated API routes. Do not publish evidence or internal records in the Git repository or a public Google Sheet.
