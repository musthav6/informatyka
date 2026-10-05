/**
 * Приймає результати тестів із сайту й записує їх у цю Google Таблицю.
 * Кожен тест — окремий аркуш (назва = id тесту), плюс загальний аркуш «Усі результати».
 */
const HEADERS = ["Час", "Клас", "Учень", "Тест", "Спроба", "Правильних", "З", "Оцінка (12)",
                 "Виходів із вкладки", "Тривалість, хв", "Неправильні №", "Примітка", "Пристрій"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const row = [new Date(d.ts), d.cls, d.name, d.test, d.attempt, d.score, d.total, d.grade12,
                 d.violations, Math.round((d.durationSec || 0) / 6) / 10, d.wrong, d.note, d.device];
    append_(String(d.testId || "Інше").slice(0, 90), row);
    append_("Усі результати", row);
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("Сервер результатів працює.");
}

function append_(name, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#E8E8E8");
    sh.setFrozenRows(1);
  }
  sh.appendRow(row);
}
