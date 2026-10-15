const STATUS_SPREADSHEET_ID = '1q8Dfe2f79ehjk7NsefGGYP6UduajKJDV7E79w1_fKMg';
const STATUS_SHEET_NAME = '69/1-GR';
const STATUS_COLUMN = 23; // W
const EVIDENCE_COLUMN = 24; // X

function doPost(event) {
  try {
    const payload = JSON.parse(event?.postData?.contents || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('SHEET_STATUS_WEBHOOK_SECRET');
    if (!expected || payload.secret !== expected) return json_({ ok:false, error:'unauthorized' });
    if (payload.spreadsheetId !== STATUS_SPREADSHEET_ID) return json_({ ok:false, error:'spreadsheet_not_allowed' });
    const courseId = String(payload.courseId || '').trim();
    const status = String(payload.status || '').trim();
    if (!courseId || !['ผ่าน', 'ไม่ผ่าน', 'ไม่มีเนื้อหา'].includes(status)) {
      return json_({ ok:false, error:'invalid_status_update' });
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const sheet = SpreadsheetApp.openById(STATUS_SPREADSHEET_ID).getSheetByName(STATUS_SHEET_NAME);
      if (!sheet) return json_({ ok:false, error:'sheet_not_found' });
      const row = findCourseRow_(sheet, courseId);
      if (!row) return json_({ ok:false, error:'course_not_found' });
      sheet.getRange(row, STATUS_COLUMN).setValue(status);
      SpreadsheetApp.flush();
      return json_({ ok:true, row, courseId, status });
    } finally { lock.releaseLock(); }
  } catch (error) {
    return json_({ ok:false, error:String(error?.message || error) });
  }
}

function findCourseRow_(sheet, courseId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const evidenceValues = sheet.getRange(2, EVIDENCE_COLUMN, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < evidenceValues.length; index += 1) {
    const value = String(evidenceValues[index][0] || '');
    const match = value.match(/[?&]courseId=([^&#]+)/i);
    if (match && decodeURIComponent(match[1]) === courseId) return index + 2;
  }
  const courseValues = sheet.getRange(2, 9, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < courseValues.length; index += 1) {
    const value = String(courseValues[index][0] || '');
    const match = value.match(/[?&]id=([^&#]+)/i);
    if (match && decodeURIComponent(match[1]) === courseId) return index + 2;
  }
  return 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
