/* «Аніматор Ліцею» — браузерний редактор двовимірної анімації для 7 класу (замість TupiTube, якого немає в кабінеті).
   Частини вікна названо так само, як у підручнику: верхня панель, панель інструментів, робоче поле, колірна палітра,
   панель параметрів, шари (статичне тло, динамічне тло, анімація, передній план), шкала кадрів, програвач.

   Проєкт: { v, id, name, w, h, fps, frames, loop, bg, dyn: {dir, step}, objs: [obj] }
   obj: { id, layer: "static|dynamic|anim|front", type: "rect|ellipse|tri|line|text|emoji", text?, spin (°/кадр), keys: { кадр: props } }
   props: { x, y, w, h, rot, skew, fill, stroke, sw, op } — центр, розміри, кут, зсув (°), кольори (#RRGGBB або none), товщина штриха, щільність 0–255.
   Метод ключових кадрів: на шарі «Анімація» зміна на кадрі N записує ключовий кадр keys[N]; між ключовими — лінійна інтерполяція.
   На інших шарах об'єкт має лише keys[1]. Зберігається в localStorage цього браузера (anim:list, anim:p:<id>, anim:cur). */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const sv = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* приватне вікно */ } }
  };

  const LAYERS = [
    ["static", "🏞️ Статичне тло", "Статичне тло — нерухомі об'єкти: їх видно на всіх кадрах, і вони не змінюються."],
    ["dynamic", "🔁 Динамічне тло", "Динамічне тло прокручується: у кожному кадрі зсувається на задане число пікселів. Під час малювання воно стоїть — рух видно на інших шарах і під час відтворення."],
    ["anim", "🎬 Анімація", "Анімація — об'єкти, що змінюються. Вибери об'єкт, перейди на інший кадр і зміни його — з'явиться ключовий кадр ◆."],
    ["front", "🪟 Передній план", "Передній план — нерухомі об'єкти попереду всіх інших (наприклад, кущі, за якими ховається герой)."]
  ];
  const LNAME = { static: "Статичне тло", dynamic: "Динамічне тло", anim: "Анімація", front: "Передній план" };
  const TOOLS = [
    ["select", "↖", "Вибір"], ["rect", "▭", "Прямокутник"], ["ellipse", "◯", "Еліпс"], ["tri", "△", "Трикутник"], ["line", "╱", "Лінія"],
    ["text", "T", "Текст"], ["emoji", "🙂", "Малюнок"], ["fill", "🪣", "Заповнення"], ["erase", "🗑️", "Видалити"]
  ];
  const TNAME = { rect: "Прямокутник", ellipse: "Еліпс", tri: "Трикутник", line: "Лінія", text: "Текст", emoji: "Малюнок" };
  const EMOJI = ["🙂", "☀️", "🌕", "🌙", "⭐", "☁️", "🌧️", "❄️", "🌈", "⚡", "🌳", "🌲", "🌸", "🌻", "🍎", "🍄", "🏠", "🏫", "🚗", "🚌", "🚲", "✈️", "🚀", "🛸", "⛵", "⚽", "🏀", "🎈", "🎁", "🐱", "🐶", "🐦", "🐟", "🦋", "🐝", "🐢", "🦊", "🐸", "🐞", "👦", "👧", "🔥", "💧", "❤️", "🎵", "🌍"];
  const BASIC = ["#000000", "#FFFFFF", "#7F7F7F", "#C3C3C3", "#8B5A2B", "#F5DEB3", "#FF0000", "#FF8800", "#FFD500",
    "#22C55E", "#15803D", "#00C8FF", "#2563EB", "#1E3A8A", "#A855F7", "#FF4FA3", "#FFB3B3", "none"];
  const NUM = ["x", "y", "w", "h", "rot", "skew", "sw", "op"];
  const isHex = (s) => /^#[0-9A-F]{6}$/i.test(s);
  const okColor = (s) => s === "none" || isHex(s);
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (c) => "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();

  /* ================================================================ СТАН */
  let P = null;               // проєкт
  let cur = 1;                // поточний кадр
  let layer = "anim";         // шар, на якому малюємо
  let tool = "select";
  let selId = null;
  let target = "fill";        // який зразок палітри активний
  const pal = { stroke: "#1E3A8A", fill: "#FFD500", op: 255 };
  let emoji = "⭐";
  let timer = null;           // відтворення
  let undo = [], redo = [], lastPush = 0;

  const sel = () => (P && selId ? P.objs.find((o) => o.id === selId) || null : null);
  // палітра змінює вибраний об'єкт лише з інструментом «Вибір»; з іншими — колір для нових об'єктів
  const editSel = () => { const o = sel(); return o && tool === "select" && o.layer === layer ? o : null; };
  const keysOf = (o) => Object.keys(o.keys).map(Number).sort((a, b) => a - b);

  /* ================================================================ ПРОЄКТ */
  function blank(o) {
    return { v: 1, id: uid(), name: o.name || "Мій мультфільм", w: o.w || 640, h: o.h || 360, fps: o.fps || 12, frames: o.frames || 24,
      loop: true, bg: o.bg || "#CFEAFF", dyn: { dir: "left", step: 4 }, objs: [] };
  }
  /* Перевірка проєкту з файлу чи сховища: лише відомі поля й допустимі значення */
  function sanitize(src) {
    if (!src || typeof src !== "object") throw new Error("не проєкт");
    const n = (v, a, b, d) => (Number.isFinite(+v) ? clamp(+v, a, b) : d);
    const p = blank({});
    p.id = typeof src.id === "string" && /^[a-z0-9]{4,24}$/.test(src.id) ? src.id : uid();
    p.name = String(src.name || "Мій мультфільм").slice(0, 60);
    p.w = Math.round(n(src.w, 100, 1280, 640)); p.h = Math.round(n(src.h, 100, 1280, 360));
    p.fps = Math.round(n(src.fps, 1, 30, 12)); p.frames = Math.round(n(src.frames, 1, 240, 24));
    p.loop = src.loop !== false; p.bg = isHex(src.bg) ? src.bg.toUpperCase() : "#CFEAFF";
    p.dyn = { dir: ["left", "right", "up", "down"].includes(src.dyn && src.dyn.dir) ? src.dyn.dir : "left", step: Math.round(n(src.dyn && src.dyn.step, 0, 50, 4)) };
    p.objs = (Array.isArray(src.objs) ? src.objs : []).slice(0, 400).map((o) => {
      if (!o || !TNAME[o.type] || !LNAME[o.layer]) return null;
      const keys = {};
      Object.entries(o.keys || {}).forEach(([f, k]) => {
        f = Math.round(+f); if (!(f >= 1 && f <= 240) || !k) return;
        keys[f] = { x: n(k.x, -5000, 5000, 100), y: n(k.y, -5000, 5000, 100), w: n(k.w, 1, 5000, 80), h: n(k.h, 1, 5000, 60), rot: n(k.rot, -36000, 36000, 0),
          skew: n(k.skew, -70, 70, 0), sw: n(k.sw, 0, 40, 3), op: n(k.op, 0, 255, 255), fill: okColor(k.fill) ? k.fill : "#FFD500", stroke: okColor(k.stroke) ? k.stroke : "#1E3A8A" };
      });
      if (!Object.keys(keys).length) return null;
      const out = { id: typeof o.id === "string" ? o.id.slice(0, 24) : uid(), layer: o.layer, type: o.type, spin: n(o.spin, -90, 90, 0), keys };
      if (o.layer !== "anim") { const k = keys[Object.keys(keys).map(Number).sort((a, b) => a - b)[0]]; out.keys = { 1: k }; out.spin = 0; }
      if (o.type === "text" || o.type === "emoji") out.text = String(o.text || "").slice(0, 80);
      return out;
    }).filter(Boolean);
    return p;
  }

  /* Приклад: тло з сонцем, хмари динамічного тла, м'яч стрибає за ключовими кадрами, вітряк крутиться */
  function demo() {
    const p = blank({ name: "Приклад: м'яч і вітряк", w: 640, h: 360, fps: 12, frames: 36, bg: "#BFE6FF" });
    const k = (o) => ({ x: 0, y: 0, w: 80, h: 60, rot: 0, skew: 0, fill: "#FFD500", stroke: "none", sw: 0, op: 255, ...o });
    const add = (layer, type, keys, extra) => p.objs.push({ id: uid(), layer, type, spin: 0, keys, ...extra });
    add("static", "rect", { 1: k({ x: 320, y: 330, w: 680, h: 80, fill: "#4CAF50" }) });
    add("static", "emoji", { 1: k({ x: 70, y: 60, w: 60, h: 60 }) }, { text: "☀️" });
    add("dynamic", "ellipse", { 1: k({ x: 160, y: 70, w: 120, h: 44, fill: "#FFFFFF", op: 230 }) });
    add("dynamic", "ellipse", { 1: k({ x: 470, y: 110, w: 150, h: 50, fill: "#FFFFFF", op: 230 }) });
    add("static", "rect", { 1: k({ x: 520, y: 220, w: 12, h: 140, fill: "#8B5A2B" }) });
    add("anim", "rect", { 1: k({ x: 520, y: 150, w: 160, h: 18, fill: "#FF8800", stroke: "#7F3F00", sw: 2 }) }, { spin: 10 });
    add("anim", "rect", { 1: k({ x: 520, y: 150, w: 160, h: 18, rot: 90, fill: "#FF8800", stroke: "#7F3F00", sw: 2 }) }, { spin: 10 });
    add("static", "ellipse", { 1: k({ x: 520, y: 150, w: 16, h: 16, fill: "#7F3F00" }) });
    add("anim", "ellipse", {
      1: k({ x: 60, y: 120, w: 50, h: 50, fill: "#FF0000", stroke: "#7F0000", sw: 3 }),
      10: k({ x: 160, y: 265, w: 58, h: 42, fill: "#FF0000", stroke: "#7F0000", sw: 3, rot: 180 }),
      20: k({ x: 260, y: 140, w: 50, h: 50, fill: "#FF8800", stroke: "#7F0000", sw: 3, rot: 360 }),
      30: k({ x: 360, y: 265, w: 58, h: 42, fill: "#FFD500", stroke: "#7F0000", sw: 3, rot: 540 }),
      36: k({ x: 410, y: 200, w: 50, h: 50, fill: "#FFD500", stroke: "#7F0000", sw: 3, rot: 620, op: 0 })
    });
    add("front", "emoji", { 1: k({ x: 600, y: 300, w: 70, h: 70 }) }, { text: "🌳" });
    add("anim", "text", { 1: k({ x: 320, y: 40, w: 200, h: 30, fill: "#1E3A8A", op: 0 }), 12: k({ x: 320, y: 40, w: 200, h: 30, fill: "#1E3A8A", op: 255 }) }, { text: "Аніматор Ліцею" });
    p.dyn = { dir: "left", step: 3 };
    return p;
  }

  /* ---------- збереження в браузері */
  const LIST = "anim:list", CUR = "anim:cur", PK = (id) => "anim:p:" + id;
  let saveT = 0;
  function saveNow(quiet) {
    clearTimeout(saveT);
    if (!P) return;
    const ok = store.set(PK(P.id), P);
    const list = store.get(LIST, []).filter((x) => x.id !== P.id);
    list.unshift({ id: P.id, name: P.name, updated: Date.now(), objs: P.objs.length, frames: P.frames });
    store.set(LIST, list.slice(0, 50)); store.set(CUR, P.id);
    if (!quiet) toast(ok ? "Збережено в цьому браузері ✓" : "Не вдалося зберегти: браузер не дозволяє (приватне вікно?). Завантаж файл у «Мої проєкти».");
  }
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => saveNow(true), 600); };

  function load(p) {
    stop(); P = p; cur = 1; selId = null; undo = []; redo = [];
    $("anName").value = P.name;
    buildCells(); render(); saveNow(true);
  }

  /* ---------- скасування */
  /* Точка скасування перед зміною. merge — безперервне введення (повзунок, число): поки воно триває, нова точка не потрібна */
  function snap(merge) {
    const now = Date.now(), cont = merge && now - lastPush < 800;
    lastPush = merge ? now : 0;
    if (cont) return;
    undo.push(JSON.stringify(P)); if (undo.length > 60) undo.shift(); redo = [];
  }
  function undoDo(back) {
    const from = back ? undo : redo, to = back ? redo : undo;
    if (!from.length) { toast(back ? "Нема чого скасовувати" : "Нема чого повторювати"); return; }
    to.push(JSON.stringify(P)); P = sanitize(JSON.parse(from.pop())); lastPush = 0;
    if (!sel()) selId = null;
    buildCells(); render(); saveSoon();
  }

  /* ================================================================ КАДРИ Й ІНТЕРПОЛЯЦІЯ */
  function mix(a, b, t) {
    const r = {};
    NUM.forEach((k) => (r[k] = a[k] + (b[k] - a[k]) * t));
    ["fill", "stroke"].forEach((k) => {
      if (a[k] === b[k] || a[k] === "none" || b[k] === "none") r[k] = t < 1 ? a[k] : b[k];
      else { const A = hex2rgb(a[k]), B = hex2rgb(b[k]); r[k] = rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); }
    });
    return r;
  }
  /* Властивості об'єкта на кадрі f (без ефектів) */
  function propsAt(o, f) {
    const ks = keysOf(o);
    if (f <= ks[0]) return { ...o.keys[ks[0]] };
    const last = ks[ks.length - 1];
    if (f >= last) return { ...o.keys[last] };
    let i = 0; while (ks[i + 1] < f) i++;
    const a = ks[i], b = ks[i + 1];
    return mix(o.keys[a], o.keys[b], (f - a) / (b - a));
  }
  /* Те, що видно на кадрі f: + неперервне обертання */
  function shownAt(o, f) {
    const p = propsAt(o, f);
    if (o.spin) p.rot += o.spin * (f - 1);
    return p;
  }
  /* Змінити об'єкт: на шарі «Анімація» — ключовий кадр на поточному кадрі, на інших — єдиний keys[1] */
  function change(o, ch) {
    if (o.layer === "anim") { const base = propsAt(o, cur); o.keys[cur] = { ...base, ...ch }; }
    else o.keys[1] = { ...o.keys[1], ...ch };
    saveSoon();
  }

  /* ================================================================ МАЛЮВАННЯ */
  const stage = $("anStage");
  let gBg, gLayers = {}, gOver;
  function setupStage() {
    stage.replaceChildren();
    stage.setAttribute("viewBox", `0 0 ${P.w} ${P.h}`);
    gBg = sv("rect", { x: 0, y: 0, width: P.w, height: P.h });
    stage.appendChild(gBg);
    ["static", "dynamic", "anim", "front"].forEach((L) => { gLayers[L] = sv("g", { "data-layer": L }); stage.appendChild(gLayers[L]); });
    gOver = sv("g", {}); stage.appendChild(gOver);
  }
  function transform(p) { return `translate(${round1(p.x)} ${round1(p.y)}) rotate(${round1(p.rot)}) skewX(${round1(p.skew)})`; }
  function shapeOf(o, p) {
    const w = p.w, h = p.h, paint = { fill: p.fill, stroke: p.stroke === "none" || !p.sw ? "none" : p.stroke, "stroke-width": p.sw, "stroke-linejoin": "round" };
    switch (o.type) {
      case "rect": return [sv("rect", { x: -w / 2, y: -h / 2, width: w, height: h, ...paint })];
      case "ellipse": return [sv("ellipse", { cx: 0, cy: 0, rx: w / 2, ry: h / 2, ...paint })];
      case "tri": return [sv("polygon", { points: `0,${-h / 2} ${w / 2},${h / 2} ${-w / 2},${h / 2}`, ...paint })];
      case "line": {
        const c = p.stroke === "none" ? "#000000" : p.stroke;
        return [sv("line", { x1: -w / 2, y1: 0, x2: w / 2, y2: 0, stroke: "transparent", "stroke-width": Math.max(p.sw, 18), "stroke-linecap": "round" }),
          sv("line", { x1: -w / 2, y1: 0, x2: w / 2, y2: 0, stroke: c, "stroke-width": Math.max(p.sw, 1), "stroke-linecap": "round" })];
      }
      case "text": {
        const t = sv("text", { x: 0, y: 0, "font-size": h, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Rubik, Arial, sans-serif", "font-weight": 600,
          fill: p.fill, stroke: paint.stroke, "stroke-width": p.sw, "paint-order": "stroke" });
        t.textContent = o.text || " "; return [t];
      }
      case "emoji": {
        const t = sv("text", { x: 0, y: 0, "font-size": h, "text-anchor": "middle", "dominant-baseline": "central" });
        t.textContent = o.text || "⭐"; return [t];
      }
    }
    return [];
  }
  function objNode(o, p) {
    const g = sv("g", { transform: transform(p), opacity: round1(p.op / 255 * 100) / 100 });
    g.dataset.id = o.id;
    shapeOf(o, p).forEach((s) => g.appendChild(s));
    return g;
  }
  /* Зсув динамічного тла на кадрі f: копія поруч дає безшовне прокручування */
  function dynOffsets(f) {
    const s = (P.dyn.step * (f - 1)) % (P.dyn.dir === "left" || P.dyn.dir === "right" ? P.w : P.h);
    switch (P.dyn.dir) {
      case "left": return [[-s, 0], [P.w - s, 0]];
      case "right": return [[s, 0], [s - P.w, 0]];
      case "up": return [[0, -s], [0, P.h - s]];
      default: return [[0, s], [0, s - P.h]];
    }
  }
  /* Намалювати кадр f у шари; editing — чи приглушувати інші шари */
  function drawFrame(f, editing, layersTarget, bgTarget) {
    bgTarget.setAttribute("fill", P.bg);
    Object.entries(layersTarget).forEach(([L, g]) => {
      g.replaceChildren();
      // інші шари не клікаються; під час роботи з тлом чи переднім планом ще й бліднуть (як у TupiTube)
      g.classList.toggle("lock", !!editing && L !== layer);
      g.classList.toggle("dim", !!editing && L !== layer && layer !== "anim");
      const objs = P.objs.filter((o) => o.layer === L);
      if (L === "dynamic" && !(editing && layer === "dynamic")) {
        dynOffsets(f).forEach(([dx, dy]) => {
          const copy = sv("g", { transform: `translate(${dx} ${dy})` });
          objs.forEach((o) => copy.appendChild(objNode(o, shownAt(o, f))));
          g.appendChild(copy);
        });
      } else objs.forEach((o) => g.appendChild(objNode(o, shownAt(o, f))));
    });
  }
  /* Межі об'єкта у власних координатах (для рамки вибору) */
  function localBox(o, p, node) {
    if (o.type === "text" || o.type === "emoji") {
      try { const b = node.lastChild.getBBox(); if (b.width) return { x: b.x, y: b.y, w: b.width, h: b.height }; } catch (e) { /* ще не на екрані */ }
      return { x: -p.h / 2, y: -p.h / 2, w: p.h, h: p.h };
    }
    if (o.type === "line") return { x: -p.w / 2, y: -Math.max(p.sw, 8) / 2, w: p.w, h: Math.max(p.sw, 8) };
    return { x: -p.w / 2, y: -p.h / 2, w: p.w, h: p.h };
  }
  const unit = () => P.w / Math.max(1, stage.getBoundingClientRect().width);   // одиниць сцени на 1 пікс. екрана
  function drawOverlay() {
    gOver.replaceChildren();
    const o = sel();
    if (!o || timer || o.layer !== layer) return;
    const p = shownAt(o, cur), node = stage.querySelector(`[data-layer="${o.layer}"] [data-id="${o.id}"]`);
    if (!node) return;
    const b = localBox(o, p, node), u = unit(), r = 9 * u;
    const g = sv("g", { transform: transform(p) });
    g.appendChild(sv("rect", { x: b.x - 3 * u, y: b.y - 3 * u, width: b.w + 6 * u, height: b.h + 6 * u, class: "sel-box" }));
    const top = b.y - 3 * u, rotY = top - 30 * u;
    g.appendChild(sv("line", { x1: 0, y1: top, x2: 0, y2: rotY, class: "sel-ln" }));
    const rot = sv("circle", { cx: 0, cy: rotY, r: r * 1.1, class: "sel-r" }); rot.dataset.h = "rot"; g.appendChild(rot);
    [["nw", b.x, b.y], ["ne", b.x + b.w, b.y], ["sw", b.x, b.y + b.h], ["se", b.x + b.w, b.y + b.h]].forEach(([k, x, y]) => {
      const h = sv("rect", { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: 3 * u, class: "sel-h " + k }); h.dataset.h = k; g.appendChild(h);
    });
    const c = sv("circle", { cx: 0, cy: 0, r: r * 0.8, class: "sel-c" }); c.dataset.h = "move"; g.appendChild(c);
    gOver.appendChild(g);
  }
  function render() {
    if (!P) return;
    if (stage.getAttribute("viewBox") !== `0 0 ${P.w} ${P.h}` || !gBg) setupStage();
    stage.setAttribute("class", "t-" + (tool === "select" ? "select" : tool === "fill" || tool === "erase" ? "pick" : "draw"));
    drawFrame(cur, !timer, gLayers, gBg);
    drawOverlay();
    renderCells(); renderLayers(); renderPalette(); renderParams(); renderStatus();
  }

  /* ================================================================ РОБОЧЕ ПОЛЕ: МИША Й ДОТИКИ */
  function pt(e) { const m = stage.getScreenCTM().inverse(); const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return { x: q.x, y: q.y }; }
  function toLocal(o, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y, a = -p.rot * Math.PI / 180;
    const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    return { x: lx - ly * Math.tan(p.skew * Math.PI / 180), y: ly };
  }
  let drag = null;
  stage.addEventListener("pointerdown", (e) => {
    if (!P || timer || (e.button !== undefined && e.button > 0)) return;
    const q = pt(e), hit = e.target.closest && e.target.closest("[data-id]"), handle = e.target.dataset && e.target.dataset.h;
    const o = hit ? P.objs.find((x) => x.id === hit.dataset.id && x.layer === layer) : null;
    stage.setPointerCapture(e.pointerId); e.preventDefault();
    if (handle && sel()) {
      const s = sel(), p = shownAt(s, cur), base = propsAt(s, cur);
      snap();
      if (handle === "move") drag = { kind: "move", o: s, start: q, base };
      else if (handle === "rot") drag = { kind: "rot", o: s, base, last: Math.atan2(q.y - p.y, q.x - p.x), acc: 0 };
      else { const l = toLocal(s, p, q); drag = { kind: "size", o: s, base, l0: l, p }; }
      return;
    }
    // з інструментом фігури вибраний об'єкт усе одно можна тягнути (щоб на іншому кадрі не перемикатися на «Вибір»)
    if (o && o.id === selId && tool !== "fill" && tool !== "erase") { snap(); drag = { kind: "move", o, start: q, base: propsAt(o, cur) }; return; }
    if (tool === "select") {
      selId = o ? o.id : null;
      if (o) { snap(); drag = { kind: "move", o, start: q, base: propsAt(o, cur) }; }
      render(); return;
    }
    if (tool === "fill") {
      snap();
      if (o) { change(o, target === "stroke" ? { stroke: pal.stroke } : { fill: pal.fill }); selId = o.id; }
      else if (pal.fill !== "none") { P.bg = pal.fill; saveSoon(); toast("Колір тла змінено"); }
      render(); return;
    }
    if (tool === "erase") { if (o) { snap(); P.objs = P.objs.filter((x) => x !== o); if (selId === o.id) selId = null; saveSoon(); render(); } return; }
    if (tool === "text" || tool === "emoji") {
      snap();
      const n = add(tool, q.x, q.y, tool === "text" ? { w: 160, h: 36, text: "Текст" } : { w: 64, h: 64, text: emoji });
      selId = n.id; if (n.type === "text") setTool("select"); else render();
      if (n.type === "text") setTimeout(() => { const t = $("parText"); if (t) { t.focus(); t.select(); } }, 30);
      return;
    }
    drag = { kind: "new", type: tool, start: q, now: q };   // фігури: проведи або торкнись
  });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const q = pt(e);
    if (drag.kind === "new") { drag.now = q; drawPreview(); return; }
    const o = drag.o;
    if (drag.kind === "move") {
      let nx = drag.base.x + q.x - drag.start.x, ny = drag.base.y + q.y - drag.start.y;
      if (e.shiftKey) { if (Math.abs(q.x - drag.start.x) > Math.abs(q.y - drag.start.y)) ny = drag.base.y; else nx = drag.base.x; }
      change(o, { x: nx, y: ny });
    } else if (drag.kind === "rot") {
      const p = shownAt(o, cur), a = Math.atan2(q.y - p.y, q.x - p.x);
      let d = a - drag.last; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      drag.last = a; drag.acc += d * 180 / Math.PI;
      let rot = drag.base.rot + drag.acc; if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      change(o, { rot: Math.round(rot) });
    } else if (drag.kind === "size") {
      const l = toLocal(o, drag.p, q);
      if (o.type === "text" || o.type === "emoji") {
        const k = Math.hypot(l.x, l.y) / Math.max(1, Math.hypot(drag.l0.x, drag.l0.y));
        change(o, { h: clamp(Math.round(drag.base.h * k), 8, 600) });
      } else {
        let w = Math.max(4, Math.abs(l.x) * 2), h = Math.max(4, Math.abs(l.y) * 2);
        if (e.shiftKey) { const k = Math.max(w / drag.base.w, h / drag.base.h); w = drag.base.w * k; h = drag.base.h * k; }
        change(o, o.type === "line" ? { w: Math.round(w) } : { w: Math.round(w), h: Math.round(h) });
      }
    }
    drawFrame(cur, true, gLayers, gBg); drawOverlay(); renderParams(true);
  });
  function endDrag(e) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.kind === "new") {
      gOver.replaceChildren(); snap();
      const a = d.start, b = d.now, far = Math.hypot(b.x - a.x, b.y - a.y) > 6 * unit();
      let n;
      if (d.type === "line") {
        n = far ? add("line", (a.x + b.x) / 2, (a.y + b.y) / 2, { w: Math.round(Math.hypot(b.x - a.x, b.y - a.y)), h: 10, rot: Math.round(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) })
          : add("line", a.x, a.y, { w: 120, h: 10 });
      } else {
        n = far ? add(d.type, (a.x + b.x) / 2, (a.y + b.y) / 2, { w: Math.round(Math.abs(b.x - a.x)) || 4, h: Math.round(Math.abs(b.y - a.y)) || 4 })
          : add(d.type, a.x, a.y, { w: 100, h: 70 });
      }
      selId = n.id;   // інструмент лишається: можна малювати далі; змінити — «Вибір»
    }
    render();
    if (e && e.pointerId !== undefined && stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  }
  stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);
  function drawPreview() {
    gOver.replaceChildren();
    const a = drag.start, b = drag.now;
    if (drag.type === "line") gOver.appendChild(sv("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "preview", "stroke-width": 3 }));
    else {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      if (drag.type === "ellipse") gOver.appendChild(sv("ellipse", { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, class: "preview" }));
      else if (drag.type === "tri") gOver.appendChild(sv("polygon", { points: `${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`, class: "preview" }));
      else gOver.appendChild(sv("rect", { x, y, width: w, height: h, class: "preview" }));
    }
  }
  /* Новий об'єкт на поточному шарі з кольорами палітри */
  function add(type, x, y, o) {
    const props = { x: Math.round(x), y: Math.round(y), w: o.w, h: o.h, rot: o.rot || 0, skew: 0,
      fill: type === "line" ? "none" : pal.fill, stroke: type === "line" && pal.stroke === "none" ? "#000000" : pal.stroke,
      sw: type === "line" ? 6 : type === "text" ? 0 : 3, op: pal.op };
    const n = { id: uid(), layer, type, spin: 0, keys: { [layer === "anim" ? cur : 1]: props } };
    if (o.text !== undefined) n.text = o.text;
    P.objs.push(n); saveSoon();
    return n;
  }

  /* ================================================================ ПАНЕЛЬ ІНСТРУМЕНТІВ */
  function buildTools() {
    const box = $("anTools");
    TOOLS.forEach(([id, ic, lb]) => {
      const b = el("button", "an-tool"); b.type = "button"; b.dataset.tool = id; b.title = lb;
      b.append(el("span", "ic", ic), el("span", "lb", lb));
      b.onclick = () => setTool(id === tool && id === "emoji" ? "emoji" : id);
      box.appendChild(b);
    });
    const eb = $("anEmoji");
    EMOJI.forEach((ch) => {
      const b = el("button", "", ch); b.type = "button"; b.title = "Малюнок " + ch;
      b.onclick = () => { emoji = ch; eb.hidden = true; [...eb.children].forEach((x) => x.classList.toggle("on", x === b)); renderStatus(); };
      eb.appendChild(b);
    });
  }
  function setTool(t) {
    tool = t;
    document.querySelectorAll(".an-tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
    $("anEmoji").hidden = t !== "emoji";
    if (t !== "select" && t !== "fill") { selId = t === "erase" ? null : selId; }
    render();
  }

  /* ================================================================ ШАРИ */
  function buildLayers() {
    const box = $("anLTabs");
    LAYERS.forEach(([id, name]) => {
      const b = el("button", "an-ltab"); b.type = "button"; b.dataset.layer = id;
      b.append(document.createTextNode(name), el("span", "n", "0"));
      b.onclick = () => { layer = id; if (sel() && sel().layer !== id) selId = null; render(); };
      box.appendChild(b);
    });
    $("anDynDir").onchange = (e) => { snap(); P.dyn.dir = e.target.value; saveSoon(); render(); };
    $("anDynStep").oninput = (e) => { snap(true); P.dyn.step = clamp(Math.round(+e.target.value || 0), 0, 50); saveSoon(); drawFrame(cur, true, gLayers, gBg); };
  }
  function renderLayers() {
    document.querySelectorAll(".an-ltab").forEach((b) => {
      b.classList.toggle("on", b.dataset.layer === layer);
      b.querySelector(".n").textContent = P.objs.filter((o) => o.layer === b.dataset.layer).length;
    });
    $("anLDesc").textContent = LAYERS.find((l) => l[0] === layer)[2];
    $("anDyn").hidden = layer !== "dynamic";
    $("anDynDir").value = P.dyn.dir; if (document.activeElement !== $("anDynStep")) $("anDynStep").value = P.dyn.step;
  }

  /* ================================================================ ШКАЛА КАДРІВ І ПРОГРАВАЧ */
  function buildCells() {
    const box = $("anCells"); box.replaceChildren();
    for (let f = 1; f <= P.frames; f++) {
      const c = el("button", "an-cell"); c.type = "button"; c.dataset.f = f; c.title = "Кадр " + f;
      c.append(el("span", "k", ""), el("span", "", String(f)));
      if (f % P.fps === 0) c.classList.add("sec");
      c.onclick = () => { stop(); go(f); };
      box.appendChild(c);
    }
    $("anFps").value = P.fps; $("anFrames").value = P.frames; $("anLoop").checked = P.loop;
  }
  function renderCells() {
    const s = sel(), sk = s && s.layer === "anim" ? new Set(keysOf(s)) : new Set(), other = new Set();
    P.objs.forEach((o) => { if (o.layer === "anim" && o !== s && Object.keys(o.keys).length > 1) keysOf(o).forEach((f) => other.add(f)); });
    document.querySelectorAll(".an-cell").forEach((c) => {
      const f = +c.dataset.f, k = c.firstChild;
      c.classList.toggle("cur", f === cur);
      k.textContent = sk.has(f) ? "◆" : other.has(f) ? "•" : ""; k.className = "k" + (sk.has(f) ? "" : " o");
    });
    $("anTime").textContent = `Кадр ${cur} з ${P.frames} · ${(cur / P.fps).toFixed(1).replace(".", ",")} с з ${(P.frames / P.fps).toFixed(1).replace(".", ",")} с`;
    $("anPlay").textContent = timer ? "⏸" : "▶";
    $("anPlay").title = timer ? "Пауза (пропуск)" : "Відтворити (пропуск)";
  }
  function go(f, follow) {
    cur = clamp(f, 1, P.frames);
    if (timer) { drawFrame(cur, false, gLayers, gBg); renderCells(); }
    else render();
    const c = document.querySelector(`.an-cell[data-f="${cur}"]`);
    if (c && follow !== false) { const box = $("anCells"); const l = c.offsetLeft - box.offsetLeft; if (l < box.scrollLeft || l > box.scrollLeft + box.clientWidth - 40) box.scrollLeft = l - box.clientWidth / 2; }
  }
  function play() {
    if (timer) { stop(); return; }
    if (cur >= P.frames) cur = 0;
    timer = setInterval(() => {
      if (cur >= P.frames) { if (P.loop) go(1); else { stop(); return; } }
      else go(cur + 1);
    }, 1000 / P.fps);
    render();
  }
  function stop() { if (!timer) return; clearInterval(timer); timer = null; render(); }
  function buildPlayer() {
    $("anPlay").onclick = play;
    $("anFirst").onclick = () => { stop(); go(1); };
    $("anPrev").onclick = () => { stop(); go(cur - 1); };
    $("anNext").onclick = () => { stop(); go(cur + 1); };
    $("anLoop").onchange = (e) => { P.loop = e.target.checked; saveSoon(); };
    $("anFps").onchange = (e) => { P.fps = clamp(Math.round(+e.target.value || 12), 1, 30); e.target.value = P.fps; saveSoon(); if (timer) { stop(); play(); } buildCells(); render(); };
    $("anFrames").onchange = (e) => {
      const n = clamp(Math.round(+e.target.value || 24), 1, 240);
      const lost = P.objs.some((o) => o.layer === "anim" && keysOf(o).some((f) => f > n));
      if (lost && !confirm(`Ключові кадри після кадру ${n} буде видалено. Продовжити?`)) { e.target.value = P.frames; return; }
      snap(); P.frames = n; e.target.value = n;
      P.objs.forEach((o) => { if (o.layer !== "anim") return; const ks = keysOf(o); const keep = ks.filter((f) => f <= n); if (!keep.length) o.keys = { [n]: propsAt(o, n) }; else ks.forEach((f) => { if (f > n) delete o.keys[f]; }); });
      cur = Math.min(cur, n); buildCells(); render(); saveSoon();
    };
  }

  /* ================================================================ КОЛІРНА ПАЛІТРА */
  let rgbInputs = [];
  function buildPalette() {
    const basic = $("anBasic");
    BASIC.forEach((c) => {
      const b = el("button", c === "none" ? "none" : ""); b.type = "button";
      b.title = c === "none" ? "Без кольору" : c; if (c !== "none") b.style.background = c;
      b.onclick = () => setColor(c);
      basic.appendChild(b);
    });
    $("swStroke").onclick = () => { target = "stroke"; renderPalette(); };
    $("swFill").onclick = () => { target = "fill"; renderPalette(); };
    $("swSwap").onclick = () => {
      [pal.stroke, pal.fill] = [pal.fill, pal.stroke];
      const o = editSel(); if (o && o.type !== "emoji") { snap(); const p = propsAt(o, cur); change(o, { fill: p.stroke, stroke: p.fill }); }
      render();
    };
    $("anHex").addEventListener("change", () => { let v = $("anHex").value.trim(); if (v && v[0] !== "#") v = "#" + v; if (isHex(v)) setColor(v.toUpperCase()); else { toast("Код кольору — # і шість символів 0–9, A–F, наприклад #FF8800"); renderPalette(); } });
    $("anHex").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
    const box = $("anRgb");
    rgbInputs = ["R", "G", "B"].map((ch, k) => {
      const row = el("label", "an-row an-row-" + ch.toLowerCase());
      const r = el("input"); r.type = "range"; r.min = 0; r.max = 255;
      const n = el("input"); n.type = "number"; n.min = 0; n.max = 255; n.inputMode = "numeric";
      const set = (v) => { const cur3 = hex2rgb(pal[target] === "none" ? "#000000" : pal[target]); cur3[k] = clamp(Math.round(+v || 0), 0, 255); setColor(rgb2hex(cur3), true); };
      r.oninput = () => set(r.value); n.oninput = () => set(n.value);
      row.append(el("b", ch.toLowerCase(), ch), r, n); box.appendChild(row);
      return [r, n];
    });
    const op = (v) => { pal.op = clamp(Math.round(+v || 0), 0, 255); const o = editSel(); if (o) { snap(true); change(o, { op: pal.op }); } render(); };
    $("anOp").oninput = (e) => op(e.target.value); $("anOpN").oninput = (e) => op(e.target.value);
  }
  function setColor(c, live) {
    pal[target] = c;
    const o = editSel();
    if (o && o.type !== "emoji") { snap(live); change(o, target === "stroke" ? { stroke: c } : { fill: c }); }
    if (live) { drawFrame(cur, true, gLayers, gBg); drawOverlay(); renderPalette(true); renderCells(); } else render();
  }
  function renderPalette(live) {
    const o = editSel();
    $("anPalNote").textContent = o ? "Колір і щільність змінюються у вибраного об'єкта" + (o.layer === "anim" ? " — на цьому кадрі з'явиться ключовий кадр ◆." : ".") : "Колір і щільність для нових об'єктів. Перефарбувати наявний — «Заповнення» або «Вибір».";
    if (o && !live) { const p = propsAt(o, cur); if (o.type !== "emoji") { pal.fill = p.fill; pal.stroke = p.stroke; } pal.op = Math.round(p.op); }
    $("swStroke").classList.toggle("on", target === "stroke"); $("swFill").classList.toggle("on", target === "fill");
    const sc = $("swStroke").firstChild, fc = $("swFill").firstChild;
    sc.style.borderColor = pal.stroke === "none" ? "" : pal.stroke; sc.classList.toggle("none", pal.stroke === "none");
    fc.style.background = pal.fill === "none" ? "" : pal.fill; fc.classList.toggle("none", pal.fill === "none");
    const c = pal[target];
    if (document.activeElement !== $("anHex")) $("anHex").value = c === "none" ? "" : c;
    $("anHex").placeholder = c === "none" ? "без кольору" : "#RRGGBB";
    const rgb = c === "none" ? [0, 0, 0] : hex2rgb(c);
    rgbInputs.forEach(([r, n], k) => { r.value = rgb[k]; if (document.activeElement !== n) n.value = rgb[k]; });
    $("anOp").value = pal.op; if (document.activeElement !== $("anOpN")) $("anOpN").value = pal.op;
  }

  /* ================================================================ ПАНЕЛЬ ПАРАМЕТРІВ */
  function numField(label, key, val, step) {
    const l = el("label"); l.append(label);
    const i = el("input"); i.type = "number"; i.step = step || 1; i.value = Math.round(val * 10) / 10; i.dataset.k = key; i.inputMode = "decimal";
    i.oninput = () => { const o = sel(); if (!o || i.value === "" || !Number.isFinite(+i.value)) return; snap(true); change(o, { [key]: +i.value }); drawFrame(cur, true, gLayers, gBg); drawOverlay(); renderCells(); renderStatus(); };
    l.appendChild(i); return l;
  }
  function renderParams(live) {
    const box = $("anPar"), o = sel();
    if (live && o) {   // під час перетягування лише оновлюємо числа
      const p = propsAt(o, cur);
      box.querySelectorAll("input[data-k]").forEach((i) => { if (document.activeElement !== i) i.value = Math.round(p[i.dataset.k] * 10) / 10; });
      const kk = box.querySelector(".key"); if (kk) keyInfo(kk, o);
      return;
    }
    if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && o && box.dataset.id === o.id && box.dataset.f === String(cur)) return;
    box.replaceChildren(); box.dataset.id = o ? o.id : ""; box.dataset.f = cur;
    if (!o || o.layer !== layer) {
      box.append(el("p", "small muted", "Вибери об'єкт інструментом «Вибір» — тут з'являться його положення (X, Y), розміри, кут, зсув і ефекти."));
      const pr = el("p", "small", `Проєкт: кадр ${P.w} × ${P.h} пікс., ${P.frames} кадрів, ${P.fps} кадрів/с. Колір тла — ${P.bg}: щоб змінити, вибери «Заповнення» й торкнись порожнього місця на робочому полі.`);
      box.append(pr);
      return;
    }
    const p = propsAt(o, cur);
    const head = el("div", "head"); head.append(el("b", "", TNAME[o.type]), el("span", "small muted", "шар «" + LNAME[o.layer] + "»"));
    box.appendChild(head);
    if (o.type === "text" || o.type === "emoji") {
      const l = el("label", "small"); l.append(o.type === "text" ? "Текст" : "Малюнок (емодзі)");
      const i = el("input"); i.type = "text"; i.id = "parText"; i.maxLength = o.type === "text" ? 80 : 8; i.value = o.text || "";
      i.oninput = () => { snap(true); o.text = i.value; saveSoon(); drawFrame(cur, true, gLayers, gBg); drawOverlay(); };
      l.appendChild(i); box.appendChild(l);
    }
    const grid = el("div", "grid");
    grid.append(numField("X", "x", p.x), numField("Y", "y", p.y), numField("Кут, °", "rot", p.rot));
    if (o.type === "text" || o.type === "emoji") grid.append(numField("Розмір", "h", p.h));
    else if (o.type === "line") grid.append(numField("Довжина", "w", p.w));
    else grid.append(numField("Ширина", "w", p.w), numField("Висота", "h", p.h));
    grid.append(numField("Зсув, °", "skew", p.skew));
    if (o.type !== "emoji") grid.append(numField("Товщина штриха", "sw", p.sw));
    box.appendChild(grid);
    if (o.layer === "anim") {
      const kk = el("div", "key"); keyInfo(kk, o); box.appendChild(kk);
      box.appendChild(el("h4", "", "Ефекти"));
      const eff = el("div", "eff");
      const dl = el("label"); dl.append("Неперервне обертання");
      const ds = el("select"); [["0", "вимкнено"], ["1", "за годинниковою стрілкою"], ["-1", "проти годинникової стрілки"]].forEach(([v, t]) => { const op = el("option", "", t); op.value = v; ds.appendChild(op); });
      ds.value = String(Math.sign(o.spin));
      const sl = el("label"); sl.append("Швидкість, °/кадр");
      const si = el("input"); si.type = "number"; si.min = 0; si.max = 90; si.value = Math.abs(o.spin) || 10; si.inputMode = "numeric";
      const upd = () => { snap(true); const dir = +ds.value; o.spin = dir * clamp(Math.abs(+si.value || 0), 0, 90); si.disabled = !dir; saveSoon(); drawFrame(cur, true, gLayers, gBg); drawOverlay(); renderStatus(); };
      ds.onchange = upd; si.oninput = () => { if (+ds.value) upd(); }; si.disabled = !o.spin;
      dl.appendChild(ds); sl.appendChild(si); eff.append(dl, sl); box.appendChild(eff);
      box.appendChild(el("p", "small muted", "Наприклад, 3 °/кадр: за 120 кадрів — повний оберт (120 · 3° = 360°)."));
    } else box.appendChild(el("p", "small muted", "Ефекти й ключові кадри — на шарі «Анімація». Щоб об'єкт рухався, перенеси його туди."));
    const mv = el("label", "small"); mv.append("Перенести на шар");
    const ms = el("select"); LAYERS.forEach(([id]) => { const op = el("option", "", LNAME[id]); op.value = id; ms.appendChild(op); }); ms.value = o.layer;
    ms.onchange = () => {
      snap(); const p2 = shownAt(o, cur); p2.rot = Math.round(p2.rot);
      o.layer = ms.value; o.keys = { [ms.value === "anim" ? 1 : 1]: p2 }; if (ms.value !== "anim") o.spin = 0;
      layer = ms.value; saveSoon(); render(); toast("Об'єкт перенесено на шар «" + LNAME[ms.value] + "»");
    };
    mv.appendChild(ms); box.appendChild(mv);
    const btns = el("div", "btns");
    const b = (t, fn, cls) => { const x = el("button", cls || "", t); x.type = "button"; x.onclick = fn; btns.appendChild(x); };
    b("⧉ Дублювати", () => { snap(); const c = JSON.parse(JSON.stringify(o)); c.id = uid(); Object.values(c.keys).forEach((k) => { k.x += 20; k.y += 20; }); P.objs.push(c); selId = c.id; saveSoon(); render(); });
    b("⬆ Вперед", () => zorder(o, 1)); b("⬇ Назад", () => zorder(o, -1));
    b("🗑️ Видалити", () => del(o), "danger");
    box.appendChild(btns);
  }
  function keyInfo(box, o) {
    box.replaceChildren();
    const isKey = !!o.keys[cur], n = Object.keys(o.keys).length;
    box.classList.toggle("on", isKey);
    if (isKey) {
      box.append(el("span", "", `◆ Кадр ${cur} — ключовий. `));
      if (n > 1) { const r = el("button", "link", "Прибрати ключовий кадр"); r.type = "button"; r.onclick = () => { snap(); delete o.keys[cur]; saveSoon(); render(); }; box.append(r); }
      else box.append(el("span", "small", "Перейди на інший кадр і зміни об'єкт — з'явиться ще один ◆, а проміжні кадри редактор обчислить сам."));
    } else box.append(el("span", "", `Кадр ${cur} — проміжний: його обчислено автоматично. Зміниш щось — він стане ключовим ◆.`));
  }
  function zorder(o, d) {
    snap();
    const same = P.objs.filter((x) => x.layer === o.layer), i = same.indexOf(o), j = i + d;
    if (j < 0 || j >= same.length) return;
    const a = P.objs.indexOf(o), b = P.objs.indexOf(same[j]);
    [P.objs[a], P.objs[b]] = [P.objs[b], P.objs[a]];
    saveSoon(); render();
  }
  function del(o) { if (!o) return; snap(); P.objs = P.objs.filter((x) => x !== o); selId = null; saveSoon(); render(); }

  function renderStatus() {
    const s = $("anStatus"), o = sel();
    const tl = TOOLS.find((t) => t[0] === tool)[2];
    let msg;
    if (timer) msg = "▶ Відтворення… Натисни ⏸, щоб зупинити й редагувати.";
    else if (tool === "select") msg = o && o.layer === layer ? (o.layer === "anim" ? `Вибрано: ${TNAME[o.type]}. Тягни його або перейди на інший кадр і зміни — буде ключовий кадр ◆.` : `Вибрано: ${TNAME[o.type]}. Тягни за об'єкт, кутові маркери — розмір, зелений — кут.`) : "Інструмент «Вибір»: торкнись об'єкта на шарі «" + LNAME[layer] + "».";
    else if (tool === "fill") msg = `«Заповнення»: торкнись об'єкта — він отримає колір ${target === "stroke" ? "штриха" : "заповнення"}; торкнись порожнього місця — зміниться колір тла.`;
    else if (tool === "erase") msg = "«Видалити»: торкнись об'єкта, який треба прибрати (Ctrl + Z — повернути).";
    else if (tool === "emoji") msg = `«Малюнок»: вибери малюнок (зараз ${emoji}) і торкнись робочого поля.`;
    else if (tool === "text") msg = "«Текст»: торкнись робочого поля, потім впиши текст на панелі «Параметри».";
    else msg = `«${tl}»: проведи по робочому полю або просто торкнись його. Малюємо на шарі «${LNAME[layer]}».` + (o && o.layer === layer ? " Щойно намальоване можна тягнути; змінити інше — «Вибір»." : "");
    s.textContent = msg;
  }

  /* ================================================================ ЕКСПОРТ У GIF */
  /* Кадр → SVG-рядок → зображення → canvas; палітра з 256 найчастіших кольорів; кодування GIF89a (LZW) */
  function frameSvg(f, W, H) {
    const s = sv("svg", { xmlns: NS, viewBox: `0 0 ${P.w} ${P.h}`, width: W, height: H });
    const bg = sv("rect", { x: 0, y: 0, width: P.w, height: P.h }); s.appendChild(bg);
    const L = {}; ["static", "dynamic", "anim", "front"].forEach((k) => { L[k] = sv("g", {}); s.appendChild(L[k]); });
    drawFrame(f, false, L, bg);
    return new XMLSerializer().serializeToString(s);
  }
  async function rasterize(f, ctx, W, H) {
    const url = URL.createObjectURL(new Blob([frameSvg(f, W, H)], { type: "image/svg+xml" }));
    try {
      const img = new Image(); img.src = url; await img.decode();
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
      return ctx.getImageData(0, 0, W, H).data;
    } finally { URL.revokeObjectURL(url); }
  }
  function lzw(ix, minSize) {
    const clear = 1 << minSize, eoi = clear + 1, out = [];
    let size = minSize + 1, next = eoi + 1, dict = new Map(), acc = 0, bits = 0;
    const emit = (c) => { acc |= c << bits; bits += size; while (bits >= 8) { out.push(acc & 255); acc >>>= 8; bits -= 8; } };
    emit(clear);
    let prefix = ix[0];
    for (let i = 1; i < ix.length; i++) {
      const k = ix[i], key = (prefix << 8) | k, v = dict.get(key);
      if (v !== undefined) { prefix = v; continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); dict = new Map(); next = eoi + 1; size = minSize + 1; }
      else { if (next >= (1 << size)) size++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (bits > 0) out.push(acc & 255);
    return out;
  }
  async function exportGif() {
    stop();
    const dlg = $("dlgGif"), msg = $("gifMsg"), prog = $("gifProg"), link = $("gifLink");
    link.hidden = true; if (link.href) URL.revokeObjectURL(link.href); prog.value = 0; prog.hidden = false;
    msg.textContent = "Малюю кадри…"; dlg.showModal();
    try {
      const k = Math.min(1, 480 / Math.max(P.w, P.h)), W = Math.round(P.w * k), H = Math.round(P.h * k), N = P.frames;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      // 1) гістограма кольорів (5 біт на канал) по всіх кадрах
      const cnt = new Uint32Array(32768), sr = new Float64Array(32768), sg = new Float64Array(32768), sb = new Float64Array(32768);
      for (let f = 1; f <= N; f++) {
        const d = await rasterize(f, ctx, W, H);
        for (let i = 0; i < d.length; i += 4) { const q = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3); cnt[q]++; sr[q] += d[i]; sg[q] += d[i + 1]; sb[q] += d[i + 2]; }
        prog.value = f / N / 2; msg.textContent = `Малюю кадри… ${f} з ${N}`;
        if (!dlg.open) return;
      }
      const bins = [...cnt.keys()].filter((q) => cnt[q]).sort((a, b) => cnt[b] - cnt[a]).slice(0, 256);
      const palR = bins.map((q) => sr[q] / cnt[q]), palG = bins.map((q) => sg[q] / cnt[q]), palB = bins.map((q) => sb[q] / cnt[q]);
      const map = new Int16Array(32768).fill(-1);
      const nearest = (q) => {
        if (map[q] >= 0) return map[q];
        const r = ((q >> 10) << 3) + 4, g = (((q >> 5) & 31) << 3) + 4, b = ((q & 31) << 3) + 4;
        let best = 0, bd = Infinity;
        for (let j = 0; j < bins.length; j++) { const dr = r - palR[j], dg = g - palG[j], db = b - palB[j], dd = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (dd < bd) { bd = dd; best = j; } }
        return (map[q] = best);
      };
      bins.forEach((q, j) => (map[q] = j));
      // 2) кодування
      const bytes = [];
      const w16 = (v) => bytes.push(v & 255, (v >> 8) & 255);
      "GIF89a".split("").forEach((c) => bytes.push(c.charCodeAt(0)));
      w16(W); w16(H); bytes.push(0xF7, 0, 0);
      for (let j = 0; j < 256; j++) bytes.push(Math.round(palR[j] || 0), Math.round(palG[j] || 0), Math.round(palB[j] || 0));
      if (P.loop) { bytes.push(0x21, 0xFF, 0x0B); "NETSCAPE2.0".split("").forEach((c) => bytes.push(c.charCodeAt(0))); bytes.push(3, 1, 0, 0, 0); }
      const delay = Math.max(2, Math.round(100 / P.fps)), ix = new Uint8Array(W * H);
      for (let f = 1; f <= N; f++) {
        const d = await rasterize(f, ctx, W, H);
        for (let i = 0, p = 0; i < d.length; i += 4, p++) ix[p] = nearest(((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3));
        bytes.push(0x21, 0xF9, 4, 0); w16(delay); bytes.push(0, 0);
        bytes.push(0x2C); w16(0); w16(0); w16(W); w16(H); bytes.push(0, 8);
        const data = lzw(ix, 8);
        for (let i = 0; i < data.length; i += 255) { const part = data.slice(i, i + 255); bytes.push(part.length, ...part); }
        bytes.push(0);
        prog.value = 0.5 + f / N / 2; msg.textContent = `Складаю GIF… ${f} з ${N}`;
        if (!dlg.open) return;
        await new Promise((r) => setTimeout(r, 0));
      }
      bytes.push(0x3B);
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/gif" });
      link.href = URL.createObjectURL(blob); link.download = fileName(".gif"); link.hidden = false; prog.hidden = true;
      msg.textContent = `Готово: ${N} кадрів, ${W} × ${H}, ${Math.round(blob.size / 1024)} КБ. Збережи файл і надішли вчителеві.`;
    } catch (e) {
      msg.textContent = "Не вдалося зробити GIF у цьому браузері. Спробуй Chrome або покажи анімацію вчителеві на екрані.";
      prog.hidden = true;
    }
  }
  const fileName = (ext) => (P.name || "Анімація").replace(/[\\/:*?"<>|]+/g, " ").trim().replace(/\s+/g, "_").slice(0, 50) + ext;

  /* ================================================================ ДІАЛОГИ, ВЕРХНЯ ПАНЕЛЬ */
  function buildTop() {
    $("anName").oninput = (e) => { P.name = e.target.value.slice(0, 60) || "Мій мультфільм"; saveSoon(); };
    $("anSave").onclick = () => saveNow(false);
    $("anNew").onclick = () => { stop(); $("nName").value = "Мій мультфільм"; $("dlgNew").showModal(); };
    $("anHelp").onclick = () => $("dlgHelp").showModal();
    $("anGif").onclick = exportGif;
    $("dlgNew").addEventListener("close", () => {
      if ($("dlgNew").returnValue !== "ok") return;
      saveNow(true);
      const [w, h] = $("nSize").value.split("x").map(Number);
      load(blank({ name: $("nName").value.trim().slice(0, 60) || "Мій мультфільм", w, h, fps: clamp(+$("nFps").value || 12, 1, 30), frames: clamp(+$("nFrames").value || 24, 1, 240), bg: $("nBg").value.toUpperCase() }));
      layer = "anim"; setTool("rect");
      toast("Проєкт створено — малюй! Шари (тло, анімація) — під робочим полем.");
    });
    $("anOpen").onclick = () => { stop(); saveNow(true); listProjects(); $("dlgOpen").showModal(); };
    $("pDemo").onclick = () => { saveNow(true); load(demo()); layer = "anim"; setTool("select"); $("dlgOpen").close(); toast("Приклад відкрито. Натисни ▶"); };
    $("pDown").onclick = () => {
      saveNow(true);
      const a = el("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(P)], { type: "application/json" })); a.download = fileName(".json");
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    $("pUp").onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try { const p = sanitize(JSON.parse(await f.text())); if (store.get(PK(p.id))) p.id = uid(); saveNow(true); load(p); $("dlgOpen").close(); toast("Проєкт відкрито з файлу"); }
      catch (err) { toast("Цей файл — не проєкт Аніматора."); }
    };
  }
  function listProjects() {
    const ul = $("pList"); ul.replaceChildren();
    const list = store.get(LIST, []);
    if (!list.length) { ul.appendChild(el("li", "", "Збережених проєктів поки немає.")); return; }
    list.forEach((x) => {
      const li = el("li", x.id === P.id ? "cur" : "");
      const n = el("span", "pn"); n.append(el("b", "", x.name), el("span", "small muted", `${x.objs || 0} об'єктів · ${x.frames || "?"} кадрів · ${new Date(x.updated).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`));
      const open = el("button", "", x.id === P.id ? "Відкрито" : "Відкрити"); open.type = "button"; open.disabled = x.id === P.id;
      open.onclick = () => { const p = store.get(PK(x.id)); if (!p) { toast("Проєкт не знайдено"); return; } try { load(sanitize(p)); $("dlgOpen").close(); } catch (e) { toast("Проєкт пошкоджено"); } };
      const rm = el("button", "", "🗑️"); rm.type = "button"; rm.title = "Видалити проєкт";
      rm.onclick = () => {
        if (!confirm(`Видалити проєкт «${x.name}» з цього браузера?`)) return;
        store.del(PK(x.id)); store.set(LIST, store.get(LIST, []).filter((y) => y.id !== x.id));
        if (x.id === P.id) { load(blank({})); }
        listProjects();
      };
      li.append(n, open, rm); ul.appendChild(li);
    });
  }
  let toastT = 0;
  function toast(t) { const b = $("anToast"); b.textContent = t; b.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (b.hidden = true), 3200); }

  /* ================================================================ КЛАВІАТУРА */
  document.addEventListener("keydown", (e) => {
    if (!P || document.querySelector("dialog[open]")) return;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && e.key.toLowerCase() === "z") { e.preventDefault(); undoDo(!e.shiftKey); return; }
    if (mod && !typing && e.key.toLowerCase() === "y") { e.preventDefault(); undoDo(false); return; }
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(false); return; }
    if (typing || mod) return;
    if (e.key === "ArrowRight") { e.preventDefault(); stop(); go(cur + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); go(cur - 1); }
    else if (e.key === " ") { e.preventDefault(); play(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && sel()) { e.preventDefault(); del(sel()); }
    else if (e.key === "Escape") { selId = null; setTool("select"); }
  });
  window.addEventListener("resize", () => { if (P && !timer) drawOverlay(); });
  window.addEventListener("pagehide", () => saveNow(true));

  /* ================================================================ СТАРТ */
  buildTools(); buildLayers(); buildPlayer(); buildPalette(); buildTop();
  let start = null;
  const curId = store.get(CUR, null);
  if (curId) { try { start = sanitize(store.get(PK(curId))); } catch (e) { start = null; } }
  load(start || demo());
  setTool("select");
  // для перевірок (tools/solve_all.js) і для учителя в консолі
  window.ANIMATOR = { get project() { return P; }, get frame() { return cur; }, propsAt: (o, f) => shownAt(o, f), go, load: (p) => load(sanitize(p)) };
})();
