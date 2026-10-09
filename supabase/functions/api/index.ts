// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";
import { applyAutomaticPublicationGate } from "./audit-quality.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const COURSE_CSV_URL = Deno.env.get("COURSE_CSV_URL") || "";
const AUDIT_MAX_SCORE = 110;
const ALLOWED_ORIGINS = new Set((Deno.env.get("ALLOWED_ORIGINS") ||
  "http://127.0.0.1:8765,http://localhost:8765,https://donut204.github.io,https://kafair-so.github.io")
  .split(",").map(value => value.trim()).filter(Boolean));
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function respond(request, status, body, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache }
  });
}

function routeParts(request) {
  const path = new URL(request.url).pathname
    .replace(/^\/functions\/v1\/api\/?/, "")
    .replace(/^\/api\/?/, "");
  return path.split("/").filter(Boolean);
}

function bearer(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function identity(request) {
  const token = bearer(request);
  if (!token) throw Object.assign(new Error("missing_token"), { status: 401 });
  if (!GOOGLE_CLIENT_ID) throw Object.assign(new Error("google_client_id_not_configured"), { status: 500 });
  const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: GOOGLE_CLIENT_ID
  });
  const email = String(payload.email || "").trim().toLowerCase();
  if (payload.email_verified !== true || !email.endsWith("@spu.ac.th")) {
    throw Object.assign(new Error("spu_account_required"), { status: 403 });
  }
  if (payload.hd && String(payload.hd).toLowerCase() !== "spu.ac.th") {
    throw Object.assign(new Error("spu_account_required"), { status: 403 });
  }
  return { email, name: String(payload.name || ""), subject: String(payload.sub || "") };
}

async function reviewer(request) {
  const user = await identity(request);
  const { data, error } = await db.from("reviewer_emails").select("email,active,role").eq("email", user.email).maybeSingle();
  if (error) throw error;
  if (!data || data.active !== true) throw Object.assign(new Error("reviewer_required"), { status: 403 });
  return { ...user, role: data.role || "admin" };
}

async function superAdmin(request) {
  const user = await reviewer(request);
  if (user.role !== "super_admin") throw Object.assign(new Error("super_admin_required"), { status: 403 });
  return user;
}

function normalizeAdminEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@spu\.ac\.th$/.test(email)) throw Object.assign(new Error("invalid_spu_email"), { status: 400 });
  return email;
}

async function listAccessUsers(request) {
  await superAdmin(request);
  const { data, error } = await db.from("reviewer_emails")
    .select("email,display_name,role,active,created_at,created_by,updated_at")
    .order("role", { ascending: false }).order("email", { ascending: true });
  if (error) throw error;
  return { users: data || [] };
}

async function saveAccessUser(request) {
  const actor = await superAdmin(request);
  const payload = await request.json();
  const email = normalizeAdminEmail(payload.email);
  const role = ["admin", "super_admin"].includes(String(payload.role || "admin")) ? String(payload.role || "admin") : null;
  if (!role) throw Object.assign(new Error("invalid_reviewer_role"), { status: 400 });
  const now = new Date().toISOString();
  const { data: existing, error: lookupError } = await db.from("reviewer_emails")
    .select("email,role").eq("email", email).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.role === "super_admin") throw Object.assign(new Error("super_admin_record_protected"), { status: 409 });
  const accessRecord = {
    email,
    display_name: String(payload.displayName || "").trim() || null,
    role,
    active: true,
    updated_at: now
  };
  if (!existing) accessRecord.created_by = actor.email;
  const { data, error } = await db.from("reviewer_emails").upsert(accessRecord, { onConflict: "email" })
    .select("email,display_name,role,active,created_at,created_by,updated_at").single();
  if (error) throw error;
  return { user: data };
}

async function setAccessUserStatus(request, emailPart) {
  const actor = await superAdmin(request);
  const email = normalizeAdminEmail(decodeURIComponent(emailPart));
  const payload = await request.json();
  if (typeof payload.active !== "boolean") throw Object.assign(new Error("active_boolean_required"), { status: 400 });
  if (email === actor.email) throw Object.assign(new Error("cannot_change_own_access"), { status: 409 });
  const { data: existing, error: lookupError } = await db.from("reviewer_emails")
    .select("email,role").eq("email", email).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) throw Object.assign(new Error("access_user_not_found"), { status: 404 });
  if (existing.role === "super_admin") throw Object.assign(new Error("super_admin_record_protected"), { status: 409 });
  const { data, error } = await db.from("reviewer_emails")
    .update({ active: payload.active, updated_at: new Date().toISOString() })
    .eq("email", email).select("email,display_name,role,active,created_at,created_by,updated_at").single();
  if (error) throw error;
  return { user: data };
}

function adminResultRecord(row) {
  const source = row.source_payload || {};
  const course = row.courses || {};
  const score = row.score == null ? null : Number(row.score);
  const reviewable = Number(row.reviewable_points || 0);
  const scoreModel = String(source.scoreModel || "");
  const scoreNeedsRefresh = row.internal_status === "needs_review" && scoreModel !== "weekly_criterion_v2";
  return {
    ...source,
    runId: row.run_id,
    auditId: row.external_audit_id,
    courseId: row.course_id,
    courseCode: course.course_code || source.courseCode || "",
    courseTitle: course.course_title || source.courseTitle || "",
    courseProfile: source.courseProfile || course.course_title || "",
    courseUrl: course.course_url || source.courseUrl || "",
    group: course.course_group || source.group || "",
    faculty: course.faculty || source.faculty || "",
    instructors: course.instructor_names || source.instructors || [],
    internalStatus: row.internal_status,
    publicStatus: row.public_status || "",
    confirmedScore: score,
    possibleScore: score == null || scoreNeedsRefresh ? null : Math.min(AUDIT_MAX_SCORE, score + reviewable),
    maxScore: AUDIT_MAX_SCORE,
    scoreModel,
    scoreNeedsRefresh,
    threshold: row.passing_score == null ? null : Number(row.passing_score),
    hasContent: row.has_content,
    auditedAt: row.audited_at,
    auditorVersion: row.auditor_version || "",
    evidenceAvailable: Boolean(row.evidence_object_path),
    reason: source.reason || row.internal_note || ""
  };
}

function historyRunRecord(row) {
  const source = row.source_payload || {};
  const score = row.score == null ? null : Number(row.score);
  const reviewable = Number(row.reviewable_points || 0);
  const scoreModel = String(source.scoreModel || "");
  const scoreNeedsRefresh = row.internal_status === "needs_review" && scoreModel !== "weekly_criterion_v2";
  return {
    ...source,
    runId: row.run_id,
    auditedAt: row.audited_at,
    auditorVersion: row.auditor_version || "",
    internalStatus: row.internal_status,
    publicStatus: row.public_status || "",
    confirmedScore: score,
    possibleScore: score == null || scoreNeedsRefresh ? null : Math.min(AUDIT_MAX_SCORE, score + reviewable),
    maxScore: AUDIT_MAX_SCORE,
    scoreModel,
    scoreNeedsRefresh,
    threshold: row.passing_score == null ? null : Number(row.passing_score),
    evidenceAvailable: Boolean(row.evidence_object_path)
  };
}

async function listAdminResults(request) {
  await reviewer(request);
  const { data, error } = await db.from("audit_runs").select(
    "run_id,external_audit_id,course_id,internal_status,public_status,score,passing_score,reviewable_points,has_content,audited_at,auditor_version,evidence_object_path,source_payload,internal_note,created_at,courses!audit_runs_course_id_fkey(course_code,course_title,course_group,faculty,instructor_names,course_url)"
  ).order("audited_at", { ascending:false }).order("created_at", { ascending:false }).limit(5000);
  if (error) throw error;
  const latest = new Map();
  for (const row of data || []) if (!latest.has(row.course_id)) latest.set(row.course_id, adminResultRecord(row));
  return { records:[...latest.values()] };
}

// The queue view is intentionally separate from the course-result view.  A
// reviewer can therefore see the live workload without treating historic runs
// as work that is still waiting to be checked.
async function queueOverview(request) {
  await reviewer(request);
  const { data: catalog, error: catalogError } = await db.from("courses")
    .select("course_id").eq("active", true).limit(5000);
  if (catalogError) throw catalogError;
  const activeCourseIds = new Set((catalog || []).map(course => course.course_id));
  const { data, error } = await db.from("audit_jobs").select(
    "job_id,course_id,kind,status,priority,attempts,created_at,claimed_at,completed_at,last_error,batch_id,courses!audit_jobs_course_id_fkey(course_code,course_title,course_group)"
  ).order("created_at", { ascending:false }).limit(5000);
  if (error) throw error;
  // A course can have historical jobs from previous audit rounds.  The
  // operational board must show one current state per active course, never
  // the accumulated number of old job rows.
  const jobs = (data || []).filter(job => activeCourseIds.has(job.course_id));
  const seenCourses = new Set();
  const currentJobs = jobs.filter(job => {
    if (seenCourses.has(job.course_id)) return false;
    seenCourses.add(job.course_id);
    return true;
  });
  const count = status => currentJobs.filter(job => job.status === status).length;
  const current = currentJobs.find(job => job.status === "running") || null;
  const recent = currentJobs.slice(0, 8).map(job => ({
    jobId: job.job_id,
    courseId: job.course_id,
    courseCode: job.courses?.course_code || job.course_id,
    courseTitle: job.courses?.course_title || "",
    group: job.courses?.course_group || "",
    kind: job.kind,
    status: job.status,
    attempts: job.attempts || 0,
    createdAt: job.created_at,
    startedAt: job.claimed_at,
    finishedAt: job.completed_at,
    error: job.last_error || ""
  }));
  return {
    queued: count("queued"),
    running: count("running"),
    completed: count("completed"),
    failed: count("failed"),
    cancelled: count("cancelled"),
    outstanding: count("queued") + count("running"),
    current: current ? recent.find(item => item.jobId === current.job_id) : null,
    recent,
    generatedAt: new Date().toISOString()
  };
}

async function adminHistory(request, courseId) {
  await reviewer(request);
  const { data: course, error: courseError } = await db.from("courses")
    .select("course_id,course_code,course_title,course_group,faculty,instructor_names,course_url")
    .eq("course_id", courseId).maybeSingle();
  if (courseError) throw courseError;
  if (!course) return null;
  const { data: runs, error } = await db.from("audit_runs")
    .select("run_id,audited_at,auditor_version,internal_status,public_status,score,passing_score,reviewable_points,evidence_object_path,source_payload")
    .eq("course_id", courseId).order("audited_at", { ascending:false }).limit(3);
  if (error) throw error;
  return {
    courseId: course.course_id,
    courseCode: course.course_code || "",
    courseTitle: course.course_title || "",
    courseProfile: course.course_title || "",
    courseUrl: course.course_url || "",
    runs: (runs || []).map(historyRunRecord)
  };
}

async function decideAdminResult(request, runId) {
  const actor = await reviewer(request);
  const payload = await request.json();
  const { data: currentRun, error: currentRunError } = await db.from("audit_runs")
    .select("run_id,course_id,internal_status,score,passing_score,reviewable_points,audited_at,evidence_object_path,source_payload")
    .eq("run_id", runId).single();
  if (currentRunError) throw currentRunError;
  if (currentRun.internal_status !== "needs_review") {
    throw Object.assign(new Error("review_decision_not_available"), { status:409 });
  }
  const minimum = Math.max(0, Number(currentRun.score || 0));
  const maximum = Math.min(AUDIT_MAX_SCORE, minimum + Math.max(0, Number(currentRun.reviewable_points || 0)));
  const source = currentRun.source_payload || {};
  const snapshot = source.evidenceSnapshot || {};
  const reviewableCriteria = Array.isArray(source.reviewableCriteria) && source.reviewableCriteria.length
    ? source.reviewableCriteria
    : (snapshot.weeks || []).flatMap((week, weekIndex) => (week.criteria || [])
      .filter((item) => item.status === "needs_review")
      .map((item, criterionIndex) => ({ session:week.session || weekIndex + 1, criterion:item.criterion || criterionIndex + 1 })));
  const manualKeys = String(source.group || "").toUpperCase() === "GN" ? [] : [
    "student_meetings", "video_quality", "media_placement", "submission_policy", "backup"
  ];
  const reviewKeys = [
    ...reviewableCriteria.map((item) => `criterion:${item.session}:${item.criterion}`),
    ...manualKeys.map((key) => `manual:${key}`)
  ].slice(0, Math.round(maximum - minimum));
  if (!reviewKeys.length || reviewKeys.length !== Math.round(maximum - minimum)) {
    throw Object.assign(new Error("review_items_not_available"), { status:409 });
  }
  const submitted = Array.isArray(payload.reviewDecisions) ? payload.reviewDecisions : [];
  const supplied = new Map(submitted.map((item) => [String(item?.key || ""), item?.accepted === true]));
  if (submitted.length !== reviewKeys.length || supplied.size !== reviewKeys.length || reviewKeys.some((key) => !supplied.has(key))) {
    throw Object.assign(new Error("review_decisions_incomplete"), { status:400 });
  }
  const confirmedScore = minimum + reviewKeys.filter((key) => supplied.get(key)).length;
  const threshold = Number(currentRun.passing_score || 80);
  const decision = confirmedScore >= threshold ? "pass" : "has_content";
  const reviewerNote = String(payload.note || "").trim().slice(0, 1000);
  const reviewConfirmation = { confirmedAt:new Date().toISOString(), reviewer:actor.email, decisions:Object.fromEntries(reviewKeys.map((key) => [key, supplied.get(key)])) };
  const note = `reviewer_confirmation:${actor.email}${reviewerNote ? ` | ${reviewerNote}` : ""}`;
  const { data: run, error: runError } = await db.from("audit_runs")
    .update({ internal_status:decision, public_status:decision, score:confirmedScore, reviewable_points:0, internal_note:note, source_payload:{ ...source, reviewConfirmation } })
    .eq("run_id", runId)
    .select("run_id,course_id,score,audited_at,evidence_object_path").single();
  if (runError) throw runError;
  const { data: course, error: courseError } = await db.from("courses")
    .select("course_id,course_code,course_title,course_group,faculty,instructor_names,course_url")
    .eq("course_id", run.course_id).single();
  if (courseError) throw courseError;
  const now = new Date().toISOString();
  const { error: courseUpdateError } = await db.from("courses").update({
    latest_internal_run_id:run.run_id, published_run_id:run.run_id, public_status:decision, updated_at:now
  }).eq("course_id", run.course_id);
  if (courseUpdateError) throw courseUpdateError;
  const { error: publishError } = await db.from("public_course_results").upsert({
    course_id:course.course_id, course_code:course.course_code, course_title:course.course_title,
    course_group:course.course_group, faculty:course.faculty, instructor_names:course.instructor_names,
    course_url:course.course_url, status:decision, score:run.score, audited_at:run.audited_at,
    published_run_id:run.run_id, evidence_available:Boolean(run.evidence_object_path), published_at:now
  }, { onConflict:"course_id" });
  if (publishError) throw publishError;
  return { runId:run.run_id, courseId:run.course_id, internalStatus:decision, publicStatus:decision };
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map(value => value.trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((key, i) => [key, String(values[i] || "").trim()])));
}

function courseId(row) {
  try { return new URL(row.courseLink).searchParams.get("id") || ""; }
  catch { return ""; }
}

async function syncCatalog() {
  if (!COURSE_CSV_URL) throw Object.assign(new Error("course_csv_url_not_configured"), { status: 500 });
  const response = await fetch(`${COURSE_CSV_URL}${COURSE_CSV_URL.includes("?") ? "&" : "?"}_=${Date.now()}`);
  if (!response.ok) throw new Error(`catalog_http_${response.status}`);
  const now = new Date().toISOString();
  const courses = parseCsv(await response.text()).map(row => ({
    course_id: courseId(row),
    course_code: row.courseCode || null,
    course_title: row.courseName || row.courseProfile || row.courseCode || "ไม่ระบุชื่อรายวิชา",
    course_group: row.group || null,
    faculty: row.faculty || null,
    instructor_names: String(row.instructors || "").split(",").map(value => value.trim()).filter(Boolean),
    course_url: row.courseLink || null,
    active: true,
    last_seen_at: now,
    updated_at: now
  })).filter(row => row.course_id);
  // The old timestamp-based version changed on every button click.  That
  // made an unchanged Google Sheet look like a new catalog and produced
  // duplicate queue rows.  Fingerprint only the audit-relevant catalog data.
  const fingerprint = courses.map(course => ({
    course_id: course.course_id,
    course_code: course.course_code,
    course_title: course.course_title,
    course_group: course.course_group,
    faculty: course.faculty,
    course_url: course.course_url
  })).sort((a, b) => a.course_id.localeCompare(b.course_id));
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(fingerprint)));
  const version = `sheet-${Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 20)}`;
  courses.forEach(course => { course.catalog_version = version; });
  for (let offset = 0; offset < courses.length; offset += 500) {
    const { error } = await db.from("courses").upsert(courses.slice(offset, offset + 500), { onConflict: "course_id" });
    if (error) throw error;
  }
  return { version, count: courses.length };
}

async function publicResults() {
  const { data, error } = await db.from("public_course_results")
    .select("course_id,course_code,course_title,course_group,faculty,instructor_names,course_url,status,score,audited_at,published_run_id,evidence_available,published_at")
    .order("course_code", { ascending: true }).limit(5000);
  if (error) throw error;
  return data || [];
}

async function publicHistory(courseId) {
  const { data: publicRow, error: publicError } = await db.from("public_course_results").select("*").eq("course_id", courseId).maybeSingle();
  if (publicError) throw publicError;
  if (!publicRow) return null;
  const { data: runs, error } = await db.from("audit_runs")
    .select("run_id,audited_at,auditor_version,internal_status,public_status,score,passing_score,reviewable_points,evidence_object_path,source_payload")
    .eq("course_id", courseId).not("public_status", "is", null)
    .order("audited_at", { ascending: false }).limit(3);
  if (error) throw error;
  return { ...publicRow, runs: (runs || []).map(historyRunRecord) };
}

async function evidence(request, courseId, runId) {
  await identity(request);
  const { data: run, error } = await db.from("audit_runs")
    .select("evidence_object_path,public_status").eq("course_id", courseId).eq("run_id", runId).maybeSingle();
  if (error) throw error;
  if (!run || !run.public_status || !run.evidence_object_path) return null;
  const { data, error: signError } = await db.storage.from("audit-evidence").createSignedUrl(run.evidence_object_path, 300);
  if (signError) throw signError;
  return data;
}

async function adminEvidence(request, courseId, runId) {
  await reviewer(request);
  const { data: run, error } = await db.from("audit_runs")
    .select("evidence_object_path").eq("course_id", courseId).eq("run_id", runId).maybeSingle();
  if (error) throw error;
  if (!run?.evidence_object_path) return null;
  const { data, error: signError } = await db.storage.from("audit-evidence").createSignedUrl(run.evidence_object_path, 300);
  if (signError) throw signError;
  return data;
}

async function ingestReviewerResult(request) {
  const user = await reviewer(request);
  const payload = await request.json();
  const externalId = String(payload.auditId || payload.runId || "").trim();
  const course = String(payload.courseId || "").trim();
  const allowed = new Set(["pass", "needs_review", "has_content", "no_content", "audit_failed"]);
  if (!externalId || !course || !allowed.has(payload.internalStatus)) {
    throw Object.assign(new Error("invalid_audit_result"), { status: 400 });
  }
  const now = new Date().toISOString();
  const { error: courseError } = await db.from("courses").upsert({
    course_id: course,
    course_code: payload.courseCode || null,
    course_title: payload.courseTitle || payload.courseProfile || payload.courseCode || `Course ${course}`,
    course_group: payload.group || null,
    course_url: payload.courseUrl || null,
    catalog_version: "reviewer-upload",
    active: true,
    last_seen_at: now,
    updated_at: now
  }, { onConflict: "course_id" });
  if (courseError) throw courseError;

  const jobKey = `manual:${course}:${externalId}`;
  let { data: job, error: jobError } = await db.from("audit_jobs")
    .select("job_id,status").eq("job_key", jobKey).maybeSingle();
  if (jobError) throw jobError;
  if (job?.status === "completed") return { courseId: course, duplicate: true };
  if (!job) {
    const inserted = await db.from("audit_jobs").insert({
      job_key: jobKey, course_id: course, kind: "retry", status: "running",
      priority: 100, claimed_by: user.email, claimed_at: now,
      lease_expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), attempts: 1
    }).select("job_id,status").single();
    if (inserted.error) throw inserted.error;
    job = inserted.data;
  } else if (job.status !== "running") {
    const restarted = await db.from("audit_jobs").update({
      status: "running", claimed_by: user.email, claimed_at: now,
      lease_expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), updated_at: now
    }).eq("job_id", job.job_id).select("job_id,status").single();
    if (restarted.error) throw restarted.error;
    job = restarted.data;
  }
  return await submitResult(new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(payload)
  }), job.job_id);
}

async function purgeRetiredEvidence(limit = 20) {
  const { data: paths, error } = await db.rpc("claim_retired_evidence_paths", { p_limit: limit });
  if (error) throw error;
  for (const item of paths || []) {
    const path = item.evidence_object_path;
    const { error: removeError } = await db.storage.from("audit-evidence").remove([path]);
    if (removeError) {
      await db.rpc("fail_retired_evidence_path", { p_evidence_object_path: path, p_error: removeError.message });
      continue;
    }
    const { error: completeError } = await db.rpc("complete_retired_evidence_path", { p_evidence_object_path: path });
    if (completeError) throw completeError;
  }
}

async function submitResult(request, jobId) {
  await reviewer(request);
  const submittedPayload = await request.json();
  const { payload, gate } = applyAutomaticPublicationGate(submittedPayload);
  const externalId = String(payload.auditId || payload.runId || "").trim();
  const course = String(payload.courseId || "").trim();
  const allowed = new Set(["pass", "needs_review", "has_content", "no_content", "audit_failed"]);
  if (!externalId || !course || !allowed.has(payload.internalStatus)) throw Object.assign(new Error("invalid_audit_result"), { status: 400 });
  const path = `evidence/${course}/${externalId}.json`;
  const bytes = new TextEncoder().encode(JSON.stringify(payload.evidenceSnapshot || {}));
  const { error: uploadError } = await db.storage.from("audit-evidence").upload(path, bytes, {
    contentType: "application/json", cacheControl: "0", upsert: true
  });
  if (uploadError) throw uploadError;
  const hasConfirmedScore = payload.confirmedScore != null || payload.score != null;
  const confirmedScore = Math.max(0, Math.min(AUDIT_MAX_SCORE, Number(payload.confirmedScore ?? payload.score ?? 0)));
  const reportedPossibleScore = Number(payload.possibleScore ?? confirmedScore);
  const reviewablePoints = Math.max(0, Math.min(AUDIT_MAX_SCORE, reportedPossibleScore) - confirmedScore);
  const { data, error } = await db.rpc("record_audit_result", {
    p_job_id: jobId, p_external_audit_id: externalId, p_internal_status: payload.internalStatus,
    p_score: hasConfirmedScore ? confirmedScore : null, p_passing_score: payload.threshold ?? null,
    p_reviewable_points: reviewablePoints,
    p_has_content: payload.hasContent ?? null, p_audited_at: payload.auditedAt || new Date().toISOString(),
    p_auditor_version: payload.auditorVersion || null, p_schema_version: Number(payload.schemaVersion || 1),
    p_evidence_summary: payload.evidenceSummary || {}, p_evidence_object_path: path,
    p_evidence_sha256: payload.evidenceSha256 || null, p_source_payload: payload
  });
  if (error) throw error;
  await purgeRetiredEvidence().catch(error => console.warn("retired_evidence_cleanup_failed", error));
  return { runId: data, courseId: course, automaticPublication: gate.approved, qualityFailures: gate.failures };
}

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return respond(request, 403, { error: "origin_not_allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  const parts = routeParts(request);
  try {
    if (request.method === "GET" && parts.join("/") === "v1/public/results") {
      return respond(request, 200, { courses: await publicResults() }, "public, max-age=60, stale-while-revalidate=300");
    }
    if (request.method === "GET" && parts[0] === "v1" && parts[1] === "public" && parts[2] === "courses" && parts[4] === "history") {
      await identity(request); const result = await publicHistory(parts[3]);
      return result ? respond(request, 200, result, "private, max-age=60") : respond(request, 404, { error: "course_not_found" });
    }
    if (request.method === "GET" && parts[0] === "v1" && parts[1] === "evidence" && parts.length === 4) {
      const result = await evidence(request, parts[2], parts[3]);
      return result ? respond(request, 200, result) : respond(request, 404, { error: "evidence_not_found" });
    }
    if (request.method === "GET" && parts.join("/") === "v1/admin/session") {
      const user = await reviewer(request);
      return respond(request, 200, { reviewer: true, email: user.email, role: user.role }, "private, no-store");
    }
    if (request.method === "GET" && parts.join("/") === "v1/admin/access-users") {
      return respond(request, 200, await listAccessUsers(request), "private, no-store");
    }
    if (request.method === "GET" && parts.join("/") === "v1/admin/results") {
      return respond(request, 200, await listAdminResults(request), "private, no-store");
    }
    if (request.method === "GET" && parts.join("/") === "v1/admin/jobs/overview") {
      return respond(request, 200, await queueOverview(request), "private, no-store");
    }
    if (request.method === "GET" && parts[0] === "v1" && parts[1] === "admin" && parts[2] === "courses" && parts[4] === "history") {
      const result = await adminHistory(request, parts[3]);
      return result ? respond(request, 200, result, "private, no-store") : respond(request, 404, { error:"course_not_found" });
    }
    if (request.method === "GET" && parts[0] === "v1" && parts[1] === "admin" && parts[2] === "evidence" && parts.length === 5) {
      const result = await adminEvidence(request, parts[3], parts[4]);
      return result ? respond(request, 200, result) : respond(request, 404, { error:"evidence_not_found" });
    }
    if (request.method === "POST" && parts[0] === "v1" && parts[1] === "admin" && parts[2] === "results" && parts[4] === "decision") {
      return respond(request, 200, await decideAdminResult(request, parts[3]));
    }
    if (request.method === "POST" && parts.join("/") === "v1/admin/access-users") {
      return respond(request, 200, await saveAccessUser(request));
    }
    if (request.method === "POST" && parts[0] === "v1" && parts[1] === "admin" && parts[2] === "access-users" && parts[4] === "status") {
      return respond(request, 200, await setAccessUserStatus(request, parts[3]));
    }
    if (request.method === "POST" && parts.join("/") === "v1/admin/jobs/missing") {
      await reviewer(request); const catalog = await syncCatalog();
      const { data, error } = await db.rpc("enqueue_missing_audits", { p_catalog_version: catalog.version });
      if (error) throw error; return respond(request, 202, { queued: data, catalogCount: catalog.count, catalogVersion: catalog.version });
    }
    if (request.method === "POST" && parts.join("/") === "v1/admin/jobs/selected") {
      await reviewer(request);
      const body = await request.json().catch(() => ({}));
      const scope = String(body.scope || "missing").toLowerCase();
      const catalog = await syncCatalog();
      const { data, error } = await db.rpc("enqueue_selected_audits", { p_catalog_version: catalog.version, p_scope: scope });
      if (error) throw error;
      return respond(request, 202, { queued: data, catalogCount: catalog.count, catalogVersion: catalog.version, scope });
    }
    if (request.method === "POST" && parts.join("/") === "v1/admin/jobs/refresh") {
      await reviewer(request); const { data, error } = await db.rpc("enqueue_refresh_audits");
      if (error) throw error; return respond(request, 202, { batchId: data });
    }
    if (request.method === "POST" && parts.join("/") === "v1/admin/results") {
      return respond(request, 200, await ingestReviewerResult(request));
    }
    if (request.method === "POST" && parts.join("/") === "v1/worker/jobs/claim") {
      const user = await reviewer(request); const { data, error } = await db.rpc("claim_next_audit_job", { p_worker: user.email, p_lease_minutes: 45 });
      if (error) throw error;
      if (!data?.job_id) return respond(request, 200, { job:null });
      const { data:course, error:courseError } = await db.from("courses")
        .select("course_id,course_code,course_title,course_group,course_url,faculty,instructor_names")
        .eq("course_id", data.course_id).single();
      if (courseError) throw courseError;
      return respond(request, 200, { job:{...data,course} });
    }
    if (request.method === "POST" && parts[0] === "v1" && parts[1] === "worker" && parts[2] === "jobs" && parts[4] === "result") {
      return respond(request, 200, await submitResult(request, parts[3]));
    }
    return respond(request, 404, { error: "route_not_found" });
  } catch (error) {
    console.error(error); return respond(request, Number(error.status || 400), { error: error.message || "request_failed" });
  }
});
