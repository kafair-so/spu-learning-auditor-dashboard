export const REQUIRED_DASHBOARD_SCHEMA_VERSION = 2;
export const REQUIRED_SCORE_MODEL = "weekly_criterion_v2";
export const MINIMUM_AUTOMATIC_AUDITOR_VERSION = "0.13.10";

function versionParts(value) {
  const match = String(value || "").match(/(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

export function isAtLeastVersion(actual, minimum = MINIMUM_AUTOMATIC_AUDITOR_VERSION) {
  const actualParts = versionParts(actual);
  const minimumParts = versionParts(minimum);
  if (!actualParts || !minimumParts) return false;
  for (let index = 0; index < minimumParts.length; index += 1) {
    if (actualParts[index] !== minimumParts[index]) return actualParts[index] > minimumParts[index];
  }
  return true;
}

// This is a quality annotation, not a decision about the course result.
// The Auditor has already applied the agreed status rules from the scores and
// evidence. A format/version warning must never turn "has content" or
// "no content" into "needs review".
export function automaticPublicationGate(payload = {}) {
  const failures = [];
  if (Number(payload.schemaVersion) < REQUIRED_DASHBOARD_SCHEMA_VERSION) failures.push("schema_outdated");
  if (payload.scoreModel !== REQUIRED_SCORE_MODEL) failures.push("score_model_outdated");
  if (!isAtLeastVersion(payload.auditorVersion)) failures.push("auditor_version_outdated");
  if (payload.coverageComplete !== true) failures.push("scan_incomplete");
  return { approved: failures.length === 0, failures };
}

export function applyAutomaticPublicationGate(payload = {}) {
  const gate = automaticPublicationGate(payload);
  if (gate.approved) return { payload, gate };
  return {
    payload: {
      ...payload,
      qualityGate: { approved: false, failures: gate.failures }
    },
    gate
  };
}
