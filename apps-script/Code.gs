/**
 * Сервер результатів для сайту з тестами (Google Apps Script, прив'язаний до таблиці).
 *  - Сайт надсилає результат спроби → рядок в аркуші тесту (назва = id тесту) і в «Усі результати».
 *  - Сторінка вчителя (teacher.html) просить результати з паролем → скрипт перевіряє пароль тут,
 *    на боці Google, і лише тоді віддає дані.
 * Дані пишуться й читаються за НАЗВАМИ колонок (рядок 1), тож колонки можна переставляти чи додавати.
 *
 * Розгортання: Розгорнути → Керувати розгортаннями → олівець → Version: New version → Deploy.
 * «Хто має доступ» — обов'язково «Anyone» (інакше сайт отримує 403 і результати губляться).
 */

// SHA-256 від пароля вчителя — той самий рядок, що й TEACHER_HASH у config.js на сайті.
// Змінюєш пароль — онови тут і там.
const TEACHER_HASH = "f7852b73682f784157fd404d0cb342a9ebe374fdd61caeaa455e65b5cf79a93a";

const ALL = "Усі результати";
// Колонка → поле у відповіді кабінету вчителя
const COLS = [
  ["Час", "t"], ["Клас", "cls"], ["Учень", "name"], ["Тест", "test"], ["Спроба", "att"],
  ["Правильних", "score"], ["З", "total"], ["Оцінка (12)", "g"], ["Виходів із вкладки", "viol"],
  ["Тривалість, хв", "min"], ["Неправильні №", "wrong"], ["Примітка", "note"], ["ID тесту", "id"]
];
const HEADERS = COLS.map((c) => c[0]);

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.action === "results") return results_(d);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const rec = {
      "Час": new Date(d.ts), "Клас": txt_(d.cls), "Учень": txt_(d.name), "Тест": txt_(d.test), "Спроба": num_(d.attempt),
      "Правильних": num_(d.score), "З": num_(d.total), "Оцінка (12)": num_(d.grade12), "Виходів із вкладки": num_(d.violations),
      "Тривалість, хв": Math.round((num_(d.durationSec) || 0) / 6) / 10, "Неправильні №": txt_(d.wrong),
      "Примітка": txt_(d.note), "ID тесту": txt_(d.testId)
    };
    append_(String(d.testId || "Інше").slice(0, 90), rec);
    append_(ALL, rec);
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
  if (!sh || sh.getLastRow() < 2) return json_({ ok: true, rows: [] });
  const data = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const head = data[0].map(String);
  // since — віддати лише записи, новіші за цю дату (кабінет за замовчуванням просить останні 40 днів)
  const since = d.since ? new Date(d.since).getTime() : 0, ti = head.indexOf("Час");
  const fresh = since && ti >= 0 ? data.slice(1).filter((r) => { const v = r[ti]; const ms = v && typeof v.getTime === "function" ? v.getTime() : new Date(v).getTime(); return isNaN(ms) || ms >= since; }) : data.slice(1);
  const rows = fresh.map((r) => {
    const o = {};
    COLS.forEach(([h, k]) => { const i = head.indexOf(h); o[k] = i < 0 ? "" : r[i]; });
    o.t = o.t && typeof o.t.getTime === "function" ? new Date(o.t.getTime()).toISOString() : String(o.t);
    return o;
  });
  return json_({ ok: true, rows: rows, since: since ? new Date(since).toISOString() : "" });
}

/* Дописати запис в аркуш, розклавши значення за назвами колонок цього аркуша */
function append_(name, rec) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#E8E8E8");
    sh.setFrozenRows(1);
  }
  const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
  sh.appendRow(head.map((h) => (h in rec ? rec[h] : "")));
}

/* Текст — завжди як текст: апостроф на початку не дає таблиці перетворити «2, 5, 9» на дату
   чи виконати «=формулу» з імені учня. У клітинці апостроф не видно. */
function txt_(v) {
  return v === undefined || v === null || v === "" ? "" : "'" + String(v).slice(0, 300);
}
function num_(v) {
  const n = Number(v);
  return isFinite(n) ? n : "";
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, "0")).join("");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
