/* Автопрохідник у браузері: правильно розв'язує кожен тест на десктопі й телефоні (Pixel 7);
   чекає 12 / 12 і жодної помилки сторінки. Результати в Google Таблицю не летять (перехоплюються).
   Запуск з кореня репозиторію (потрібен Playwright):
     python3 -m http.server 8766 &
     TEACHER_PWD=… NODE_PATH=$(npm root -g) node tools/solve_all.js /tmp/shots [5-l3,7-sim-mail]
   Скриншоти — у вказану папку; помилка → ERR-<пристрій>-<тест>.png. */
const { chromium, devices } = require("playwright"); const fs = require("fs"), path = require("path");
const PWD = process.env.TEACHER_PWD;   // пароль учителя відкриває код уроку; у репозиторій не писати
if (!PWD) { console.error("Задай пароль учителя: TEACHER_PWD=… node tools/solve_all.js …"); process.exit(2); }
const OUT = process.argv[2] || "."; const ONLY = process.argv[3] ? process.argv[3].split(",") : null;
const BASE = "http://localhost:8766/";
const parent = (p) => p.split("/").slice(0, -1).join("/"), base = (p) => p.split("/").pop();
const node = (tree, path) => { let n = tree; for (const k of path.split("/").filter(Boolean)) { if (!n || typeof n !== "object" || !(k in n)) return undefined; n = n[k]; } return n; };
const findLoc = (tree, name, skip, pre = "") => { for (const [k, v] of Object.entries(tree)) { const p = pre ? pre + "/" + k : k; if (k === name && p !== skip) return p; if (typeof v === "object") { const r = findLoc(v, name, skip, p); if (r) return r; } } return null; };
const keyOf = (c) => c.split("+").map((k) => k.trim()).map((k) => k === "Ctrl" ? "Control" : /^[A-Z]$/.test(k) ? "Key" + k : k === "Esc" ? "Escape" : k).join("+");

async function byData(p, sel, attr, val) { for (const h of await p.$$(sel)) if ((await h.getAttribute(attr)) === val) return h; throw new Error(`немає ${sel}[${attr}=${val}]`); }

async function files(p, v) {
  const tree = JSON.parse(JSON.stringify(v.start)); let cwd = "";
  const item = async (name) => { for (const h of await p.$$(".fx-item")) if ((await h.$eval(".fx-n", (e) => e.textContent)) === name) return h; throw new Error("немає елемента " + name + " у " + cwd); };
  const btn = (t) => p.click(`.fx-b:has-text("${t}")`);
  const openDir = async (path) => {
    if (path === cwd) return;
    while (!(await p.$eval(".fx-up", (b) => b.disabled))) await p.click(".fx-up");
    cwd = "";
    for (const part of path.split("/").filter(Boolean)) {
      const before = await p.textContent(".fx-path"); await (await item(part)).click();
      if ((await p.textContent(".fx-path")) === before) await (await item(part)).click();   // перший дотик лише виділив
      cwd = cwd ? cwd + "/" + part : part;
    }
  };
  const select = async (name) => { const h = await item(name); if (!(await h.evaluate((e) => e.classList.contains("on")))) await h.click(); };
  const typeName = async (name) => { await p.fill(".fx-rename input", name); await p.click(".fx-rename .btn"); };
  const ensureDir = async (path) => {
    if (node(tree, path) !== undefined) return;
    const par = parent(path); if (par) await ensureDir(par);
    await openDir(par); await btn("Нова папка"); await typeName(base(path));
    (par ? node(tree, par) : tree)[base(path)] = {};
  };
  const nots = v.goals.filter((g) => g.not).map((g) => g.not);
  for (const g of v.goals) {
    if (g.sel) { await openDir(parent(g.sel)); await select(base(g.sel)); }
    else if (g.dir && node(tree, g.dir) === undefined) {
      const par = parent(g.dir), from = nots.find((n) => parent(n) === par && typeof node(tree, n) === "object");
      if (from) { await openDir(par); await select(base(from)); await btn("Перейме"); await typeName(base(g.dir)); const d = par ? node(tree, par) : tree; d[base(g.dir)] = d[base(from)]; delete d[base(from)]; }
      else await ensureDir(g.dir);
    }
    else if (g.has && node(tree, g.has) === undefined) {
      const src = findLoc(tree, base(g.has), g.has);
      if (src) {
        const copy = v.goals.some((h) => h.has === src);
        await openDir(parent(src)); await select(base(src)); await btn(copy ? "Копіювати" : "Вирізати");
        await openDir(parent(g.has)); await btn("Вставити");
        node(tree, parent(g.has))[base(g.has)] = "file"; if (!copy) delete node(tree, parent(src))[base(src)];
      } else {
        const from = nots.find((n) => parent(n) === parent(g.has) && node(tree, n) !== undefined);
        await openDir(parent(from)); await select(base(from)); await btn("Перейме"); await typeName(base(g.has));
        const d = node(tree, parent(from)); d[base(g.has)] = d[base(from)]; delete d[base(from)];
      }
    }
    else if (g.bin) { const src = findLoc(tree, g.bin); await openDir(parent(src)); await select(g.bin); await btn("Видалити"); delete node(tree, parent(src))[g.bin]; }
    else if (g.restored) {
      await openDir(parent(g.at)); await select(g.restored); await btn("Видалити");
      await btn("Кошик"); await (await (await item(g.restored)).$(".fx-restore")).click(); await btn("Закрити Кошик");
    }
  }
}

async function solve(p, tag, id, shots) {
  const v = await p.evaluate((id) => {
    const T = TESTS.list.find((t) => t.id === id), q = document.getElementById("qtext").textContent;
    const dom = (sel, f) => [...document.querySelectorAll(sel)].map(f).sort().join("|");
    const cands = T.slots.flat().filter((v) => QZ.parseVariant(v).q === q);
    if (cands.length <= 1) return cands[0] || null;
    return cands.find((v) => {
      if (v.type === "sort") return dom(".srow", (e) => e.dataset.t) === v.items.map((i) => i[0]).sort().join("|");
      if (v.type === "order") return dom(".oitem", (e) => e.dataset.t) === v.items.slice().sort().join("|");
      if (v.sim === "feed") return dom(".fd-item", (e) => (e.querySelector(".fd-title") || e.querySelector(".fd-who b")).textContent) === v.items.map((m) => v.view === "chat" ? m.from : m.subj).sort().join("|");
      if (v.sim === "color") return document.querySelector(".cl-code").dataset.code === v.target.toUpperCase();
      if (v.sim === "tween") return document.querySelectorAll(".tw-cell").length === v.frames && document.querySelector(".tw-obj text").textContent === v.obj;
      if (v.sim === "inbox") return dom(".ib-row .ib-meta span", (e) => e.textContent) === v.mails.map((m) => m.subj).sort().join("|");
      if (v.type === "spot") return true;
      if (!v.type) return dom("#opts .opt", (e) => e.dataset.v) === QZ.parseVariant(v).opts.slice().sort().join("|") || QZ.parseVariant(v).fixed;
      return false;
    }) || cands[0];
  }, id);
  if (!v) throw new Error("не знайшов варіант");
  if (!v.type) {
    const pv = await p.evaluate((v) => QZ.parseVariant(v), v);
    if (pv.type === "input") await p.fill("#ans", pv.accept[0]);
    else for (const ok of pv.ok) await (await byData(p, "#opts .opt", "data-v", ok)).click();
    return "classic";
  }
  if (v.type === "sort") for (const row of await p.$$(".srow")) { const t = await row.getAttribute("data-t"); const g = v.items.find((i) => i[0] === t)[1]; for (const b of await row.$$(".sbtn")) if ((await b.textContent()) === g) await b.click(); }
  else if (v.type === "order") for (const t of v.items) await (await byData(p, ".oitem", "data-t", t)).click();
  else if (v.type === "keys") { if (await p.$(".kshow")) await p.keyboard.press(keyOf(v.keys)); else await (await byData(p, ".kopt", "data-v", v.keys)).click(); }
  else if (v.type === "spot") await p.click(`svg.scene [data-spot="${[].concat(v.target)[0]}"]`);
  else if (v.sim === "files") await files(p, v);
  else if (v.sim === "inbox") {
    for (const m of v.mails) {
      for (const r of await p.$$(".ib-row")) if ((await r.$eval(".ib-meta span", (e) => e.textContent)) === m.subj) { await r.click(); break; }
      if (await p.$(".ib-link")) await p.click(".ib-link");
      if (shots && !(await p.$(".ib-row")) && m.phish) { await p.screenshot({ path: `${OUT}/${tag}-${id}-mail.png` }); shots = false; }
      await p.click(m.phish ? ".ib-btns .ib-ph" : ".ib-btns .btn:not(.ib-ph)");
    }
  }
  else if (v.sim === "feed") {
    for (const card of await p.$$(".fd-item")) {
      const m = v.items[+(await card.getAttribute("data-i"))], lab = v.labels.find((l) => l[0] === m.ans)[1];
      for (const b of await card.$$(".fd-b")) if ((await b.textContent()) === lab) { await b.click(); break; }
    }
  }
  else if (v.sim === "color") {
    const t = [1, 3, 5].map((k) => parseInt(v.target.slice(k, k + 2), 16));
    if (v.mode === "hex") await p.fill(".cl-hexrow input", v.target.slice(1).toLowerCase());   // без «#» — рушій додасть сам
    else { const nums = await p.$$(".cl-row input[type=number]"); for (let k = 0; k < 3; k++) await nums[k].fill(String(t[k])); }
  }
  else if (v.sim === "tween") {
    const st = { x: 40, y: 100, s: 40, rot: 0, op: 255, ...v.start };
    for (const g of v.goals) {
      await p.click(`.tw-cell[data-f="${g.f}"]`);
      for (const [k, i] of [["s", 0], ["rot", 1], ["op", 2]]) if (g[k] !== undefined) {
        const rows = await p.$$(".tw-row"); const names = await Promise.all(rows.map((r) => r.$eval(".tw-n", (e) => e.textContent)));
        const row = rows[names.findIndex((n) => n.startsWith({ s: "Розмір", rot: "Кут", op: "Щільність" }[k]))];
        await (await row.$("input[type=number]")).fill(String(g[k])); await (await row.$("input[type=number]")).dispatchEvent("change");
      }
      if (g.x !== undefined) {
        await p.locator("svg.tw-stage").scrollIntoViewIfNeeded();
        const [from, to] = await p.evaluate((g) => {
          const svg = document.querySelector("svg.tw-stage"), m = svg.getScreenCTM(), o = document.querySelector(".tw-obj").transform.baseVal.consolidate().matrix;
          const tr = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(m); return [q.x, q.y]; };
          return [tr(o.e, o.f), tr(g.x, g.y)];
        }, g);
        await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move(to[0], to[1], { steps: 8 }); await p.mouse.up();
      }
    }
  }
  else if (v.sim === "nodes") {
    await p.locator("svg.nodes").scrollIntoViewIfNeeded();
    const box = await (await p.$("svg.nodes")).boundingBox(), k = box.width / 300;
    for (let j = 0; j < v.from.length; j++) {
      const [fx, fy] = v.from[j], [tx, ty] = v.to[j]; if (fx === tx && fy === ty) continue;
      await p.mouse.move(box.x + fx * k, box.y + fy * k); await p.mouse.down(); await p.mouse.move(box.x + tx * k, box.y + ty * k, { steps: 8 }); await p.mouse.up();
    }
  }
  return v.sim || v.type;
}

(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ids = await (async () => { const c = await b.newContext(); const p = await c.newPage(); await p.goto(BASE + "index.html"); await p.waitForFunction(() => window.TESTS && TESTS.list.length > 10); const r = await p.evaluate(() => TESTS.list.map((t) => t.id)); await c.close(); return r; })();
  const cfg = fs.readFileSync(path.resolve(__dirname, "../config.js"), "utf8").replace("EGG_CHANCE: 0.01", "EGG_CHANCE: 0");
  for (const [tag, opts] of [["desk", { viewport: { width: 1100, height: 900 } }], ["mob", { ...devices["Pixel 7"] }]]) {
    for (const id of ids.filter((i) => !ONLY || ONLY.includes(i))) {
      const ctx = await b.newContext(opts);
      await ctx.route("**/script.google.com/**", (r) => r.fulfill({ status: 200, body: "ok" }));
      await ctx.route("**/config.js*", (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: cfg }));
      const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(`${tag} ${id}: ${e.message}`));
      await p.goto(`${BASE}test.html?t=${id}`); await p.waitForSelector("#cls option:nth-child(2)", { state: "attached" });
      await p.selectOption("#cls", { index: 1 }); await p.fill("#name", "Перевірка Робот"); if (await p.isVisible("#lcode")) await p.fill("#lcode", PWD); await p.click("#go");
      const kinds = {}; const bad = []; let n = 0;
      try {
        while (true) {
          await p.waitForSelector("#quiz:not([hidden]), #result:not([hidden])");
          if (await p.isVisible("#result")) break;
          n++;
          const kind = await solve(p, tag, id, n <= 2);
          kinds[kind] = (kinds[kind] || 0) + 1;
          if (await p.$eval("#next", (x) => x.disabled)) { bad.push(`${n}: кнопка неактивна (${kind})`); break; }
          const instant = await p.evaluate((id) => TESTS.list.find((t) => t.id === id).feedback === "instant", id);
          await p.click("#next");
          if (!instant) continue;
          const fb = await p.textContent("#fb");
          if (!/Правильно/.test(fb)) bad.push(`${n} (${kind}): ${fb.slice(0, 80)}`);
          if (kind !== "classic" && n <= 14 && shotsWanted(id, kind, tag)) await p.screenshot({ path: `${OUT}/${tag}-${id}-${n}-${kind}.png`, fullPage: tag === "desk" });
          await p.click("#next");
        }
        const g = (await p.textContent("#rbig")).trim();
        if (g !== "12 / 12") bad.push("результат " + g);
        console.log(`${bad.length ? "✗" : "✓"} ${tag} ${id}: ${g} · ${JSON.stringify(kinds)}`);
      } catch (e) { bad.push("ВИНЯТОК: " + e.message.split("\n").slice(0, 12).join(" ¦ ")); console.log(`✗ ${tag} ${id}`); await p.screenshot({ path: `${OUT}/ERR-${tag}-${id}.png`, fullPage: true }); }
      if (bad.length) { fails++; console.log("   " + bad.join("\n   ")); }
      await ctx.close();
    }
  }
  console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors"); console.log(fails ? `FAILED: ${fails}` : "ALL OK"); process.exitCode = fails || errs.length ? 1 : 0;
  await b.close();
})();
const seen = new Set();
function shotsWanted(id, kind, tag) { const k = tag + kind + (kind === "files" || kind === "nodes" || kind === "inbox" ? id : ""); if (seen.has(k)) return false; seen.add(k); return true; }
