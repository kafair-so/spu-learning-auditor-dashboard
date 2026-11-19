from pathlib import Path
import json
build=Path("build/dashboard-0.13.39")
def once(s, old, new):
    assert s.count(old)==1, f"unexpected anchor count {s.count(old)}: {old[:100]}"
    return s.replace(old,new,1)
p=build/"background.js";s=p.read_text(encoding="utf-8")
s=once(s,'function presentQuiz(items, label) {','function presentQuiz(items, label, allowLegacyMoodleQuiz = false) {')
s=once(s,'  // Pre/Post may be supplied as a question file (PDF/resource) or as an','''  // A mapped Moodle Quiz that has already passed the semester policy is
  // actual assessment evidence; external-link evaluation must not reject it.
  const accepted = tolerated.filter(item => allowLegacyMoodleQuiz && item.countingEligible !== false && !item.reviewExcluded && /^https:\\/\\/(?:dlearning|ilearning)\\.spu\\.ac\\.th\\/mod\\/quiz\\/view\\.php\\?(?:[^#]*&)?id=\\d+(?:[&#]|$)/i.test(item.href || ""));
  if(accepted.length) return answer("pass", "พบ"+label+" ใน Moodle Quiz "+accepted.length+" รายการ: "+itemNames(accepted));
  // Pre/Post may be supplied as a question file (PDF/resource) or as an''')
s=once(s,'function checklistForWeek(section, list, metrics, isFirst, courseType, instructorEvidence = null) {','function checklistForWeek(section, list, metrics, isFirst, courseType, instructorEvidence = null, allowLegacyMoodleQuiz = false) {')
s=once(s,'presentQuiz(pre, "แบบทดสอบก่อนเรียน"),','presentQuiz(pre, "แบบทดสอบก่อนเรียน", allowLegacyMoodleQuiz),')
s=once(s,'presentQuiz(post, "แบบทดสอบหลังเรียน"),','presentQuiz(post, "แบบทดสอบหลังเรียน", allowLegacyMoodleQuiz),')
s=once(s,'checklistForWeek(section, list, metrics, isFirst, payload.courseType, payload.instructorEvidence);','checklistForWeek(section, list, metrics, isFirst, payload.courseType, payload.instructorEvidence, legacyEvidenceRetry);')
s=once(s,'checklistForWeek(week.section,list,week,index === 0,report.courseType,report.instructorEvidence);','checklistForWeek(week.section,list,week,index === 0,report.courseType,report.instructorEvidence, report.legacyQuizScope === true);')
s=once(s,'rule, activities, weeks, score, coverage, mediaCoverage, mandatoryCoverage, instructorEvidence:payload.instructorEvidence || null,','rule, activities, weeks, score, coverage, mediaCoverage, mandatoryCoverage, instructorEvidence:payload.instructorEvidence || null, legacyQuizScope:legacyEvidenceRetry,')
s=once(s,'const instructorStatus = instructorEvidence?.identityComplete && instructorEvidence?.contactComplete ? "pass"','const waivedInstructorName = grContextScan && instructorEvidence?.nameWaived === true && instructorEvidence?.hasInstructorPhoto === true && instructorEvidence?.contactComplete === true;\n  const instructorStatus = (instructorEvidence?.identityComplete && instructorEvidence?.contactComplete || waivedInstructorName) ? "pass"')
s=once(s,'const instructorResult = result(instructorStatus, instructorDetail +','const instructorResult = result(instructorStatus, (waivedInstructorName ? "พบรูปผู้สอนและช่องทางติดต่อ · อนุโลมกรณีไม่ระบุชื่อผู้สอน" : instructorDetail) +')
p.write_text(s,encoding="utf-8")
p=build/"manifest.json";d=json.loads(p.read_text(encoding="utf-8"));assert d["version"]=="0.13.38";d["version"]="0.13.39";p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
