/* Перевірка структури всіх тестів без браузера: групи, порядок, зони схем, клавіші, симулятори, прив'язка до уроків.
   Запуск з кореня репозиторію:  node tools/check_tests.js   (вихід 1, якщо є помилки) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const R = path.resolve(__dirname, "..") + "/";
const ctx = { window: {}, document: { createElement() {}, createElementNS() {} }, TESTS: null, console };
const list = []; ctx.TESTS = { add: (t) => list.push(t) };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(R + "tests/index.js", "utf8"), ctx);
for (const f of ctx.TEST_FILES) vm.runInContext(fs.readFileSync(R + "tests/" + f, "utf8"), ctx, { filename: f });
vm.runInContext(fs.readFileSync(R + "assets/tasks.js", "utf8"), ctx);
const T = ctx.TASKS;
// id зон кожної сцени: «малюємо» у фальшивий g і збираємо spot-и
const spots = {};
for (const [k, S] of Object.entries(T.SCENES)) { const ids = []; S.draw({ add() {}, text() {}, spot: (id) => ids.push(id) }); spots[k] = ids; }
let err = 0; const bad = (m) => { err++; console.log("✗", m); };
const counts = {};
for (const t of list) {
  if (!t.slots || !t.slots.length) bad(t.id + ": немає слотів");
  t.slots.forEach((vs, si) => {
    if (vs.length < 2 && t.kind === "train") bad(`${t.id} слот ${si + 1}: лише ${vs.length} варіант`);
    vs.forEach((v, vi) => {
      const w = `${t.id} слот ${si + 1}.${vi + 1}`;
      if (!v || !v.type) return;
      counts[v.type + (v.sim ? ":" + v.sim : "")] = (counts[v.type + (v.sim ? ":" + v.sim : "")] || 0) + 1;
      if (!T[v.type]) return bad(w + ": невідомий тип " + v.type);
      if (!v.q) bad(w + ": немає q");
      if (v.type === "sort") {
        const texts = v.items.map((i) => i[0]);
        if (new Set(texts).size !== texts.length) bad(w + ": повтор тексту");
        v.items.forEach(([tx, g]) => { if (!v.groups.includes(g)) bad(`${w}: «${tx}» → невідома група ${g}`); });
        v.groups.forEach((g) => { if (!v.items.some((i) => i[1] === g)) bad(`${w}: порожня група ${g}`); });
      }
      if (v.type === "order" && new Set(v.items).size !== v.items.length) bad(w + ": повтор у порядку");
      if (v.type === "spot") {
        if (!spots[v.scene]) bad(w + ": немає сцени " + v.scene);
        else [].concat(v.target).forEach((id) => { if (!spots[v.scene].includes(id)) bad(`${w}: немає зони ${id} у ${v.scene}`); });
      }
      if (v.type === "keys") {
        const all = [v.keys, ...v.alt].map(T.normCombo);
        if (new Set(all).size !== all.length) bad(w + ": alt дублює відповідь");
        if (/ctrl\+(t|w|n|d|k|p|s|o|h|j|l|r|q|tab)$/.test(T.normCombo(v.keys)) || /ctrl\+shift\+(n|t|w|q|\]|\[|delete)$/.test(T.normCombo(v.keys))) bad(w + ": браузерне сполучення " + v.keys);
      }
      if (v.type === "sim") {
        const p = T.sim.parse(v);
        if (v.sim === "nodes") {
          if (v.from.length !== v.to.length) bad(w + ": різна к-сть вузлів");
          if (T.sim.judge(p, v.from)) bad(w + ": вихідна фігура вже зараховується");
          if (!T.sim.judge(p, v.to)) bad(w + ": ціль не зараховується");
          [...v.from, ...v.to].forEach(([x, y]) => { if (x < 10 || x > 290 || y < 10 || y > 290) bad(w + ": точка поза полотном"); });
        }
        if (v.sim === "inbox") {
          v.mails.forEach((m, i) => { ["from", "addr", "subj", "body", "why"].forEach((k) => { if (!m[k]) bad(`${w} лист ${i + 1}: немає ${k}`); }); if (typeof m.phish !== "boolean") bad(`${w} лист ${i + 1}: phish`); });
          const subj = v.mails.map((m) => m.subj); if (new Set(subj).size !== subj.length) bad(w + ": однакові теми");
          const mark = new Map(v.mails.map((m, i) => [i, m.phish]));
          if (!T.sim.judge(p, mark)) bad(w + ": правильні позначки не зараховуються");
        }
        if (v.sim === "feed") {
          if (!["search", "chat"].includes(v.view)) bad(w + ": view має бути search або chat");
          const keys = (v.labels || []).map((l) => l[0]);
          if (keys.length < 2) bad(w + ": менше двох міток");
          if (!v.items || v.items.length < 3) bad(w + ": замало елементів");
          (v.items || []).forEach((m, i) => {
            if (!keys.includes(m.ans)) bad(`${w} елемент ${i + 1}: ans «${m.ans}» не серед міток`);
            if (!m.why) bad(`${w} елемент ${i + 1}: немає why`);
            if (!(m.subj || m.body)) bad(`${w} елемент ${i + 1}: порожній`);
            if (v.view === "chat" && !m.from) bad(`${w} елемент ${i + 1}: у чаті потрібен from`);
          });
          if (!T.sim.judge(p, new Map((v.items || []).map((m, i) => [i, m.ans])))) bad(w + ": правильні мітки не зараховуються");
        }
        if (v.sim === "color") {
          if (!/^#[0-9A-Fa-f]{6}$/.test(v.target || "")) bad(w + ": target має бути #RRGGBB");
          else {
            const t = [1, 3, 5].map((k) => parseInt(v.target.slice(k, k + 2), 16));
            if (!T.sim.judge(p, t)) bad(w + ": точний колір не зараховується");
            if (T.sim.judge(p, [128, 128, 128]) && v.mode !== "hex") bad(w + ": стартовий сірий уже зараховується");
          }
          if (v.mode && !["rgb", "hex"].includes(v.mode)) bad(w + ": mode має бути rgb або hex");
        }
        if (v.sim === "tween") {
          if (!(v.frames >= 2 && v.frames <= 40)) bad(w + ": frames 2–40");
          (v.goals || []).forEach((g) => { if (!(g.f >= 1 && g.f <= v.frames)) bad(`${w}: ціль на кадрі ${g.f} поза шкалою`); if ((g.x !== undefined && (g.x < 10 || g.x > 290)) || (g.y !== undefined && (g.y < 10 || g.y > 190))) bad(w + ": ціль поза сценою"); });
          const st = { x: 40, y: 100, s: 40, rot: 0, op: 255, ...v.start };
          if (T.sim.judge(p, { 1: st })) bad(w + ": стартове положення вже зараховується");
          const keys = { 1: { ...st } }; (v.goals || []).forEach((g) => { keys[g.f] = { ...(keys[g.f] || st), ...g }; delete keys[g.f].f; });
          if (!T.sim.judge(p, keys)) bad(w + ": ключові кадри з цілей не зараховуються");
        }
        if (v.sim === "files") {
          if (!v.goals || !v.goals.length) bad(w + ": немає цілей");
          v.goals.forEach((g) => { if (!g.t) bad(w + ": ціль без тексту"); if (!["dir", "has", "not", "empty", "bin", "restored", "sel"].some((k) => k in g)) bad(w + ": ціль без умови"); });
        }
      }
    });
  });
}
// посилання на тести з уроків
const lctx = { window: {} }; vm.createContext(lctx); vm.runInContext(fs.readFileSync(R + "lessons.js", "utf8"), lctx);
const ids = new Set(list.map((t) => t.id));
lctx.window.LESSONS.forEach((l) => l.acts.forEach((a) => { if (a.test && !ids.has(a.test)) bad(`${l.id}: немає тесту ${a.test}`); }));
list.forEach((t) => { const lid = `${t.grade}-${String(t.lesson).padStart(2, "0")}`; const l = lctx.window.LESSONS.find((x) => x.id === lid); if (!l || !l.acts.some((a) => a.test === t.id)) bad(`${t.id}: не прив'язаний до уроку ${lid}`); });
console.log(list.map((t) => `${t.id}:${t.slots.length}`).join("  "));
console.log(counts);
console.log(err ? `ПОМИЛОК: ${err}` : "усе гаразд");
process.exitCode = err ? 1 : 0;
