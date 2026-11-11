import assert from "node:assert/strict";
import test from "node:test";
import { applyReviewDecisionStatuses, matchingPriorReviewDecisions, reusePriorReviewDecisions } from "../supabase/functions/api/review-reuse.js";

const podcast = (session, id) => ({ auditSession:session, kind:"podcast", externalUrl:`https://drive.google.com/file/d/${id}/view?usp=sharing` });
const weeks = () => Array.from({ length:15 }, (_, index) => ({
  session:index + 1,
  criteria:Array.from({ length:index ? 7 : 7 }, (_, criterion) => ({ criterion:criterion + 1, status:"needs_review" }))
}));
const reviewable = [
  { session:1, criterion:2 }, { session:1, criterion:5 },
  ...Array.from({ length:14 }, (_, index) => ({ session:index + 2, criterion:4 }))
];
const priorDecisions = Object.fromEntries([
  ["criterion:1:2", false], ["criterion:1:5", true],
  ...Array.from({ length:14 }, (_, index) => [`criterion:${index + 2}:4`, true]),
  ["manual:student_meetings", true], ["manual:video_quality", true], ["manual:media_placement", true],
  ["manual:submission_policy", true], ["manual:backup", true]
]);
const prior = {
  evidenceSnapshot:{ weeks:weeks(), activities:[...Array.from({ length:15 }, (_, index) => podcast(index + 1, `P${index + 1}`)), { auditSession:1, kind:"file", href:"https://moodle/file/old" }] },
  reviewConfirmation:{ decisions:priorDecisions, reviewer:"auditor@example.org", confirmedAt:"2026-10-27T00:00:00Z" }
};
const current = () => ({
  group:"GR", confirmedScore:72, possibleScore:93, threshold:80,
  reviewableCriteria:structuredClone(reviewable),
  evidenceSnapshot:{ weeks:weeks(), activities:[...Array.from({ length:15 }, (_, index) => podcast(index + 1, `P${index + 1}`)), { auditSession:1, kind:"file", href:"https://moodle/file/new" }] }
});

test("MKT453-style Podcast decisions survive a changed score envelope but unrelated manual decisions do not", () => {
  const matches = matchingPriorReviewDecisions(current(), prior);
  assert.equal(Object.keys(matches).length,15);
  assert.equal(matches["criterion:1:5"],true);
  assert.equal(matches["criterion:15:4"],true);
  assert.equal(matches["criterion:1:2"],undefined);
  assert.equal(matches["manual:backup"],undefined);
  const result = reusePriorReviewDecisions(current(), prior, "old-run");
  assert.equal(result.reused,15);
  assert.equal(result.payload.confirmedScore,87);
  assert.equal(result.payload.possibleScore,93);
  assert.equal(result.payload.internalStatus,"pass");
  assert.deepEqual(result.payload.reviewableCriteria,[{ session:1, criterion:2 }]);
});

test("a changed Podcast destination is not reused", () => {
  const payload = current();
  payload.evidenceSnapshot.activities.find((item) => item.auditSession === 10 && item.kind === "podcast").externalUrl = "https://drive.google.com/file/d/CHANGED/view";
  const matches = matchingPriorReviewDecisions(payload, prior);
  assert.equal(matches["criterion:10:4"],undefined);
  assert.equal(Object.keys(matches).length,14);
});

test("confirmed decisions replace pending statuses with pass or fail", () => {
  const source = current();
  applyReviewDecisionStatuses(source,{"criterion:1:2":false,"criterion:1:5":true},{confirmedScore:80,possibleScore:80,internalStatus:"pass",publicStatus:"pass"});
  assert.equal(source.evidenceSnapshot.weeks[0].criteria[1].status,"fail");
  assert.equal(source.evidenceSnapshot.weeks[0].criteria[4].status,"pass");
  assert.equal(source.reviewableCriteria.length,14);
  assert.equal(source.internalStatus,"pass");
});

