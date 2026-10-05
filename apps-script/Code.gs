/**
 * Сервер результатів для сайту з тестами (Google Apps Script, прив'язаний до таблиці).
 *  - Сайт надсилає результат спроби → рядок в аркуші тесту (назва = id тесту) і в «Усі результати».
 *  - Сторінка вчителя (teacher.html) просить результати з паролем → скрипт перевіряє пароль тут,
 *    на боці Google, і лише тоді віддає дані.
 *
 * Розгортання: Розгорнути → Керувати розгортаннями → олівець → Version: New version → Deploy.
 * «Хто має доступ» — обов'язково «Anyone» (інакше сайт отримує 403 і результати губляться).
 */

// SHA-256 від пароля вчителя — той самий рядок, що й TEACHER_HASH у config.js на сайті.
// Змінюєш пароль — онови тут і там.
const TEACHER_HASH = "f7852b73682f784157fd404d0cb342a9ebe374fdd61caeaa455e65b5cf79a93a";

const ALL = "Усі результати";
const HEADERS = ["Час", "Клас", "Учень", "Тест", "Спроба", "Правильних", "З", "Оцінка (12)",
                 "Виходів із вкладки", "Тривалість, хв", "Неправильні №", "Примітка", "Пристрій", "ID тесту"];

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.action === "results") return results_(d);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const row = [new Date(d.ts), d.cls, d.name, d.test, d.attempt, d.score, d.total, d.grade12,
                 d.violations, Math.round((d.durationSec || 0) / 6) / 10, d.wrong, d.note, d.device, d.testId];
    append_(String(d.testId || "Інше").slice(0, 90), row);
    append_(ALL, row);
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("Сервер результатів працює.");
}

/* Віддати всі рядки «Усі результати» — лише з правильним паролем учителя. */
function results_(d) {
  if (sha256_(String(d.pwd || "").trim()) !== TEACHER_HASH) return json_({ ok: false, error: "password" });
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ALL);
  const values = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues() : [];
  const rows = values.map((r) => ({
    t: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), cls: r[1], name: r[2], test: r[3], att: r[4],
    score: r[5], total: r[6], g: r[7], viol: r[8], min: r[9], wrong: r[10], note: r[11], dev: r[12], id: r[13]
  }));
  return json_({ ok: true, rows: rows });
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

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
