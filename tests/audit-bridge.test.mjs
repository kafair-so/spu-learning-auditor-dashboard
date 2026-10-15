import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const store=new Map();
const context={
  URL,Date,
  localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)},
  window:{}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../audit-bridge.js",import.meta.url),"utf8"),context);
const bridge=context.window.AuditBridge;

const record=(status,publicStatus="")=>({schemaVersion:1,recordType:"spu_learning_audit_result",auditId:`a-${status}`,group:"GS",courseCode:"ABC123",courseId:"19859",courseUrl:"https://dlearning.spu.ac.th/course/view.php?id=19859",internalStatus:status,publicStatus,auditedAt:"2026-10-01T00:00:00Z"});

test("orange and gray never replace the last public status",()=>{
  bridge.importPayload(record("pass","pass"));
  bridge.importPayload(record("needs_review",""));
  assert.equal(bridge.loadRecords()[0].publicStatus,"pass");
  bridge.importPayload(record("audit_failed",""));
  assert.equal(bridge.loadRecords()[0].publicStatus,"pass");
});

test("public export includes only three public statuses",()=>{
  const values=[record("pass","pass"),record("has_content","has_content"),record("no_content","no_content"),record("needs_review","")];
  const published=values.map(bridge.publishableRecord).filter(Boolean);
  assert.deepEqual([...new Set(published.map(item=>item.publicStatus))].sort(),["has_content","no_content","pass"]);
});

test("below-threshold status uses the orange public label",()=>{
  assert.equal(bridge.LABELS.has_content,"ไม่ผ่านเกณฑ์");
  assert.equal(bridge.COLORS.has_content,"orange");
  assert.equal(bridge.COLORS.no_content,"red");
});

test("matching prefers Moodle course id",()=>{
  const found=bridge.matchRecord({courseLink:"https://dlearning.spu.ac.th/course/view.php?id=19859",group:"GS",courseCode:"OTHER"},[record("pass","pass")]);
  assert.equal(found.courseCode,"ABC123");
});

test("keeps latest result plus two previous results per course",()=>{
  store.clear();
  for(let day=1;day<=4;day++)bridge.importPayload({...record("pass","pass"),auditId:`run-${day}`,auditedAt:`2026-10-0${day}T00:00:00Z`,confirmedScore:80+day});
  const history=bridge.historyForCourse(record("pass"));
  assert.equal(history.length,3);
  assert.equal(history.map(item=>item.auditId).join(","),"run-4,run-3,run-2");
  assert.equal(bridge.latestRecords().length,1);
});

test("reimporting the same audit updates it without adding history",()=>{
  store.clear();
  bridge.importPayload({...record("pass","pass"),auditId:"same",confirmedScore:80});
  bridge.importPayload({...record("pass","pass"),auditId:"same",confirmedScore:85});
  assert.equal(bridge.historyForCourse(record("pass")).length,1);
  assert.equal(bridge.historyForCourse(record("pass"))[0].confirmedScore,85);
});

