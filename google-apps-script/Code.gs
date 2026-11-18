const STATUS_SPREADSHEET_ID = '1q8Dfe2f79ehjk7NsefGGYP6UduajKJDV7E79w1_fKMg';
const STATUS_SHEETS = Object.freeze({ GS:'69/1-GS', GR:'69/1-GR' });
const CONTENT_COLUMN = 22; // V
const RESULT_COLUMN = 23; // W
const EVIDENCE_COLUMN = 24; // X

function doPost(event) {
  try {
    const payload = JSON.parse(event?.postData?.contents || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('SHEET_STATUS_WEBHOOK_SECRET');
    if (!expected || payload.secret !== expected) return json_({ ok:false, error:'unauthorized' });
    if (payload.spreadsheetId !== STATUS_SPREADSHEET_ID) return json_({ ok:false, error:'spreadsheet_not_allowed' });
    const courseId = String(payload.courseId || '').trim();
    const group = String(payload.group || '').trim().toUpperCase();
    const contentStatus = String(payload.contentStatus || '').trim();
    const resultStatus = String(payload.resultStatus || '').trim();
    const evidenceUrl = String(payload.evidenceUrl || '').trim();
    if (!courseId || !STATUS_SHEETS[group]) return json_({ ok:false, error:'invalid_course_identity' });
    if (!['พบเนื้อหา', 'ไม่พบเนื้อหา'].includes(contentStatus)
      || !['ผ่าน', 'ไม่ผ่าน', 'ไม่พบเนื้อหา'].includes(resultStatus)
      || !evidenceUrl) return json_({ ok:false, error:'invalid_status_update' });
    if ((contentStatus === 'ไม่พบเนื้อหา') !== (resultStatus === 'ไม่พบเนื้อหา')) {
      return json_({ ok:false, error:'content_result_mismatch' });
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const sheetName = STATUS_SHEETS[group];
      const sheet = SpreadsheetApp.openById(STATUS_SPREADSHEET_ID).getSheetByName(sheetName);
      if (!sheet) return json_({ ok:false, error:'sheet_not_found' });
      const rows = findCourseRows_(sheet, courseId);
      if (!rows.length) return json_({ ok:false, error:'course_not_found', courseId, sheetName });
      if (rows.length !== 1) return json_({ ok:false, error:'duplicate_course_id', courseId, sheetName, rows });
      const row = rows[0];
      sheet.getRange(row, CONTENT_COLUMN, 1, 3).setValues([[contentStatus, resultStatus, evidenceUrl]]);
      SpreadsheetApp.flush();
      const verified = sheet.getRange(row, CONTENT_COLUMN, 1, 3).getDisplayValues()[0].map(value => String(value || '').trim());
      if (verified[0] !== contentStatus || verified[1] !== resultStatus || verified[2] !== evidenceUrl) {
        return json_({ ok:false, error:'write_verification_failed', courseId, sheetName, row, verified });
      }
      return json_({ ok:true, row, courseId, group, sheetName, contentStatus, resultStatus, evidenceUrl, verified:true });
    } finally { lock.releaseLock(); }
  } catch (error) {
    return json_({ ok:false, error:String(error?.message || error) });
  }
}

function findCourseRows_(sheet, courseId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const matches = new Set();
  const evidenceValues = sheet.getRange(2, EVIDENCE_COLUMN, lastRow - 1, 1).getDisplayValues();
  evidenceValues.forEach((row, index) => {
    const match = String(row[0] || '').match(/[?&]courseId=([^&#]+)/i);
    if (match && decodeURIComponent(match[1]) === courseId) matches.add(index + 2);
  });
  const courseValues = sheet.getRange(2, 9, lastRow - 1, 1).getDisplayValues();
  courseValues.forEach((row, index) => {
    const match = String(row[0] || '').match(/[?&]id=([^&#]+)/i);
    if (match && decodeURIComponent(match[1]) === courseId) matches.add(index + 2);
  });
  return Array.from(matches).sort((a, b) => a - b);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
