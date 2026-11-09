(() => {
  // A text-only Moodle Label can be the brief itself. A category pill alone
  // is not enough: require an instruction and an observable learner response.
  const assignmentTextEvidence = (text, groupContext) => {
    const body = String(text || "").replace(/\s+/g, " ").trim();
    const group = String(groupContext || "");
    const activityGroup = /กิจกรรม\s*(?:ท้าย\s*บท(?:เรียน)?|ประจำ\s*สัปดาห์)|(?:end[ -]?of[ -]?chapter|weekly|after[ -]?class|post[ -]?class)\s*activit(?:y|ies)|after[ -]?class\s*task|assignment|章末(?:活动|活動|练习|練習)|每周(?:活动|活動|作业|作業)|課末(?:活動|練習)|週次(?:課題|活動)|宿題/i.test(group);
    const direction = /(?:ให้(?:นักศึกษา|ผู้เรียน|นักเรียน)?\s*(?:เข้า|ดู|ชม|อ่าน|เขียน|ตอบ|ทำ|แสดง|กด|สมัคร|ลงทะเบียน|ติดตั้ง|ทดลอง|สร้าง)|(?:นักศึกษา|ผู้เรียน|นักเรียน)\s*(?:สมัคร|ลงทะเบียน|ติดตั้ง|ทดลอง|สร้าง)|จง\s*(?:ตอบ|อธิบาย|เขียน|แสดง|สมัคร|ลงทะเบียน|ติดตั้ง|ทดลอง|สร้าง)|กรุณา\s*(?:ตอบ|เขียน|แสดง|ส่ง|สมัคร|ลงทะเบียน|ติดตั้ง|ทดลอง|สร้าง)|please\s*(?:watch|read|write|answer|comment|submit|register|sign\s*up|install|try|create)|请.{0,30}(?:观看|阅读|回答|撰写|完成|提交|注册|註冊|安装|安裝)|請.{0,30}(?:觀看|閱讀|回答|撰寫|完成|提交|註冊|安裝)|(?:見て|読んで|答えて|書いて|作成して|提出して|登録して|インストールして)(?:ください)?)/i.test(body);
    const response = /แสดง\s*ความ\s*คิดเห็น|คอมเมนต์|comment|ตอบ\s*คำถาม|เขียน\s*(?:ตอบ|สรุป|รายงาน|ความเห็น)|ส่ง\s*(?:งาน|คำตอบ|ไฟล์)|submit|upload|กด\s*(?:like|share|ไลก์|แชร์)|สมัคร(?:สมาชิก|ใช้งาน|การใช้งาน|โปรแกรม)?|ลงทะเบียน|ติดตั้ง(?:โปรแกรม|แอป(?:พลิเคชัน)?)?|ทดลองใช้งาน|สร้าง(?:บัญชี|ชิ้นงาน)|register|sign\s*up|install(?:\s+(?:the\s+)?(?:app|program|software))?|create\s+(?:an?\s+)?(?:account|project)|发表评论|發表評論|回答问题|回答問題|提交|上传|上傳|注册|註冊|安装|安裝|コメント|質問に答|レポート|提出|アップロード|登録|インストール/i.test(body);
    const quizOnly = /(?:ทำ|ตอบ)\s*(?:แบบทดสอบ|quiz)|(?:完成|回答).{0,8}(?:测验|測驗|测试|測試)|(?:テスト|クイズ).{0,8}(?:受け|回答)/i.test(body) && !/แสดง\s*ความ\s*คิดเห็น|คอมเมนต์|comment|เขียน\s*(?:สรุป|รายงาน|ความเห็น)|ส่ง\s*(?:งาน|คำตอบ|ไฟล์)|กด\s*(?:like|share|ไลก์|แชร์)|评论|評論|提交|上传|上傳|コメント|レポート|提出|アップロード/i.test(body);
    const worksheetTask = /ให้(?:นักศึกษา|ผู้เรียน|นักเรียน)?.{0,120}(?:เตรียม|พิมพ์|ปริ้นท์|พริ้นท์|สแกน).{0,120}(?:worksheet|work\s*sheet|ใบงาน|เอกสาร)/i.test(body);
    return activityGroup && (direction || worksheetTask) && (response || worksheetTask) && !quizOnly && body.length >= 35;
  };

  // Submission links are optional.  A real assessment may ask for an answer
  // directly in Moodle, on paper, or through a channel the teacher does not
  // spell out.  Require an observable task/question instead of requiring a
  // particular provider such as Google Drive.
  const assessmentTaskEvidence = (text) => {
    const body = String(text || "").replace(/\s+/g, " ").trim();
    const direction = /ให้(?:นักศึกษา|ผู้เรียน|นักเรียน)?\s*(?:แสดง|คำนวณ|คำนวน|ตอบ|เขียน|อธิบาย|ทำ|หา)|(?:นักศึกษา|ผู้เรียน|นักเรียน)\s*(?:ทำ\s*กิจกรรม.{0,100})?(?:โดย\s*(?:การ)?\s*)?(?:ตอบ|ทำ|เขียน|อธิบาย)|(?:กรุณา|โปรด)\s*(?:ตอบ|ทำ|เขียน|อธิบาย|คำนวณ|คำนวน)|จง\s*(?:แสดง|คำนวณ|คำนวน|ตอบ|เขียน|อธิบาย|หา)|please\s*(?:calculate|answer|explain|write|show|complete)|请.{0,30}(?:计算|計算|回答|说明|說明|完成)|(?:計算|回答|説明|記述|解答)(?:して|せよ|してください)/i.test(body);
    const concreteQuestion = /โจทย์|คำนวณ|คำนวน|อธิบาย|แสดง\s*วิธี|(?:กี่|เท่าไหร่|อย่างไร|เพราะเหตุใด|ทำไม)(?:\s|$|[?.])|calculate|explain|problem|计算|計算|問題|説明/i.test(body);
    const scored = /\(\s*\d+(?:\.\d+)?\s*(?:คะแนน|points?|marks?)\s*\)|\b\d+(?:\.\d+)?\s*(?:คะแนน|points?|marks?)\b/i.test(body);
    const response = /save\s*file|แปลง(?:ไฟล์)?เป็น\s*pdf|ส่ง(?:ใน|ไปยัง|ผ่าน|งาน|คำตอบ|ไฟล์)|google\s*(?:drive|forms?)|https?:\/\/|(?:link|ลิงก์)\s*(?:ที่\s*วาง\s*ไว้|นี้|สำหรับ|ไปยัง|here)|submit|upload|เขียน\s*(?:คำตอบ|วิธีทำ)|提交|上传|上傳|提出|アップロード/i.test(body);
    const explicitAssessmentAction = /(?:นักศึกษา|ผู้เรียน|นักเรียน).{0,120}(?:ทำ\s*กิจกรรม|ทำ\s*แบบทดสอบ|ตอบ\s*คำถาม)|(?:กรุณา|โปรด|จง|ให้).{0,80}(?:ทำ\s*แบบทดสอบ|ตอบ\s*คำถาม)/i.test(body);
    return body.length >= 35 && direction && (explicitAssessmentAction || concreteQuestion || scored || response);
  };

  // A teacher may write the complete Pre/Post task directly in a Moodle Label
  // instead of creating Quiz or Assignment. Count only a real task with a
  // learner response/submission; a category pill by itself is never evidence.
  const assessmentTextKind = (text, groupContext) => {
    const body = String(text || "").replace(/\s+/g, " ").trim();
    const group = String(groupContext || "").replace(/\s+/g, " ").trim();
    const localHeading = body.slice(0, 220);
    const pre = /แบบ(?:ฝึกหัด|ทดสอบ|ประเมิน)\s*ก่อน\s*(?:การ\s*)?เรียน|pre[\s-]?(?:test|assessment)|课前(?:测验|測驗|测试|測試)|事前(?:テスト|試験)/i.test(`${group} ${localHeading}`);
    const post = /แบบ(?:ฝึกหัด|ทดสอบ|ประเมิน)\s*หลัง\s*(?:การ\s*)?เรียน|post[\s-]?(?:test|assessment)|课后(?:测验|測驗|测试|測試)|事後(?:テスト|試験)/i.test(`${group} ${localHeading}`);
    if (pre === post) return "";
    return assessmentTaskEvidence(body) ? (pre ? "pre_quiz" : "post_quiz") : "";
  };
  const assessmentTextSegments = (text) => {
    const body = String(text || "").replace(/\s+/g, " ").trim();
    const heading = /แบบ(?:ฝึกหัด|ทดสอบ|ประเมิน)\s*(?:ก่อน|หลัง)\s*เรียน|(?:pre|post)[\s-]?(?:test|assessment)/gi;
    const matches = [...body.matchAll(heading)];
    return matches.map((match, index) => {
      const segment = body.slice(match.index, matches[index + 1]?.index ?? body.length).trim();
      return {heading:match[0],text:segment,kind:assessmentTextKind(segment, match[0])};
    }).filter((item) => item.kind);
  };

  // Infer image-only Pre/Post banners only when the same ordered pair repeats
  // in at least two different Sections.  A one-off image, one item, or an
  // equally common reverse order stays unclassified instead of being guessed.
  const inferAssessmentPairs = (candidates, minimumSections = 2) => {
    const bySection = new Map();
    for (const item of candidates || []) {
      if (!item?.id || !item?.sectionKey || !item?.imageFingerprint) continue;
      if (!bySection.has(item.sectionKey)) bySection.set(item.sectionKey, []);
      bySection.get(item.sectionKey).push(item);
    }
    const occurrences = [];
    for (const [sectionKey, items] of bySection) {
      items.sort((a,b) => Number(a.order) - Number(b.order));
      for (let index = 0; index < items.length - 1; index += 1) {
        const first = items[index], second = items[index + 1];
        if (first.nextId !== second.id || first.imageFingerprint === second.imageFingerprint) continue;
        occurrences.push({sectionKey,first,second,key:`${first.imageFingerprint}>${second.imageFingerprint}`});
      }
    }
    const stats = new Map();
    for (const occurrence of occurrences) {
      if (!stats.has(occurrence.key)) stats.set(occurrence.key,{count:0,sections:new Set()});
      const stat = stats.get(occurrence.key);
      stat.count += 1;
      stat.sections.add(occurrence.sectionKey);
    }
    const qualified = new Set();
    for (const [key,stat] of stats) {
      const [first,second] = key.split(">");
      const reverse = stats.get(`${second}>${first}`);
      if (stat.sections.size >= minimumSections && stat.count > (reverse?.count || 0)) qualified.add(key);
    }
    const assigned = new Set(), result = [];
    for (const occurrence of occurrences) {
      if (!qualified.has(occurrence.key) || assigned.has(occurrence.first.id) || assigned.has(occurrence.second.id)) continue;
      assigned.add(occurrence.first.id); assigned.add(occurrence.second.id);
      result.push({candidate:occurrence.first,kind:"pre_quiz",reason:"repeated_image_label_pair"});
      result.push({candidate:occurrence.second,kind:"post_quiz",reason:"repeated_image_label_pair"});
    }
    return result;
  };
  globalThis.DLearningAssignmentText = { assignmentTextEvidence, assessmentTaskEvidence, assessmentTextKind, assessmentTextSegments, inferAssessmentPairs };
})();

