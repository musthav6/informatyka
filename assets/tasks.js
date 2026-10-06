/* Інтерактивні завдання для тренажерів: рушій (engine.js) делегує сюди показ, перевірку й підсвітку.
   Формат у файлах тестів — об'єкт із полем type:
     { type: "sort",  q, groups: [...], items: [["текст", "група"], ...], x }      — розклади по групах
     { type: "order", q, items: ["перший", "другий", ...], x }                    — встанови порядок
     { type: "keys",  q, keys: "Ctrl+C", alt: ["Ctrl+V", ...], x }                — натисни сполучення
     { type: "spot",  q, scene: "window|desktop|mail|ppt|share|network|word|pptshow|animator", target: "id" | [...], x } — знайди на картинці
     { type: "sim",   sim: "files|inbox|nodes|feed|color|tween", q, ..., x }      — симулятори
       files: start {"Папка": {"файл.txt": "file"}}, goals [{t, dir|has|not|empty|sel: "Папка/файл.txt" | bin: "ім'я" | restored: "ім'я", at}]
       inbox: mails [{from, addr, subj, body ("текст [посилання](url)"), attach?, phish, why}]
       nodes: from [[x,y]...], to [[x,y]...] — полотно 300×300, допуск 20
       feed:  view "search"|"chat", title, query?, labels [[ключ,"підпис"]…], items [{from, addr, subj, body, ans, why}]
       color: target "#RRGGBB", mode "rgb" (дано HEX — став повзунки) | "hex" (дано RGB — введи код), tol (типово 30)
       tween: frames, obj (емодзі), start {x,y,s,rot,op}, goals [{f, x?, y?, s?, rot?, op?}] — сцена 300×200, ключові кадри
   Кожен тип: parse(v) → p; render(box, p, setReady) → api {get, text}; judge(p, ans); reveal(box, p, api); correctText(p).
   Усе працює дотиками (без перетягування мишею, крім вузлів — там pointer events). */
(function () {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const shuffle = (a) => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const svgEl = (tag, attrs) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const locked = (box) => box.classList.contains("locked");

  /* ================================================================ РОЗКЛАДИ ПО ГРУПАХ */
  const sort = {
    parse: (v) => ({ type: "sort", q: v.q, groups: v.groups, items: v.items.map(([t, g]) => ({ t, g })), x: v.x || "", hint: "Біля кожного рядка натисни кнопку з правильною групою — вона підсвітиться. Розклав усе — тисни «Відповісти»." }),
    render(box, p, setReady) {
      const choice = new Map();
      const rows = shuffle(p.items.slice()).map((it) => {
        const row = el("div", "srow"); row.append(el("span", "stext", it.t));
        const btns = el("div", "sbtns");
        p.groups.forEach((g) => {
          const b = el("button", "sbtn", g); b.type = "button";
          b.onclick = () => {
            if (locked(box)) return;
            choice.set(it.t, g);
            [...btns.children].forEach((x) => x.classList.toggle("on", x === b));
            setReady(choice.size === p.items.length);
          };
          btns.appendChild(b);
        });
        row.appendChild(btns); row.dataset.t = it.t; box.appendChild(row);
        return row;
      });
      return { get: () => choice, text: () => p.items.map((it) => `${it.t} → ${choice.get(it.t) || "?"}`).join("; "), rows };
    },
    judge: (p, ch) => p.items.every((it) => ch.get(it.t) === it.g),
    reveal(box, p, api) {
      const ch = api.get();
      box.querySelectorAll(".srow").forEach((row) => {
        const it = p.items.find((i) => i.t === row.dataset.t), ok = ch.get(it.t) === it.g;
        row.classList.add(ok ? "right" : "wrong");
        if (!ok) row.appendChild(el("span", "sfix", "✓ " + it.g));
      });
    },
    correctText: (p) => p.groups.map((g) => `${g}: ${p.items.filter((i) => i.g === g).map((i) => i.t).join(", ")}`).join("; ")
  };

  /* ================================================================ ВСТАНОВИ ПОРЯДОК */
  const order = {
    parse: (v) => ({ type: "order", q: v.q, items: v.items, x: v.x || "", hint: "Натискай пункти по черзі: перший, другий, третій… Біля кожного з'явиться номер. Помилився — натисни ще раз, і номер зникне." }),
    render(box, p, setReady) {
      const seq = [];
      const list = el("div", "olist");
      const draw = () => {
        [...list.children].forEach((b) => { const i = seq.indexOf(b.dataset.t); b.querySelector(".ono").textContent = i < 0 ? "" : i + 1; b.classList.toggle("on", i >= 0); });
        setReady(seq.length === p.items.length);
      };
      shuffle(p.items.slice()).forEach((t) => {
        const b = el("button", "oitem"); b.type = "button"; b.dataset.t = t;
        b.append(el("span", "ono"), el("span", "otext", t));
        b.onclick = () => { if (locked(box)) return; const i = seq.indexOf(t); if (i >= 0) seq.splice(i, 1); else seq.push(t); draw(); };
        list.appendChild(b);
      });
      box.appendChild(list); draw();
      return { get: () => seq.slice(), text: () => seq.join(" → ") };
    },
    judge: (p, seq) => seq.length === p.items.length && seq.every((t, i) => t === p.items[i]),
    reveal(box, p, api) {
      const seq = api.get();
      box.querySelectorAll(".oitem").forEach((b) => {
        const want = p.items.indexOf(b.dataset.t), got = seq.indexOf(b.dataset.t);
        b.classList.add(want === got ? "right" : "wrong");
        if (want !== got) b.appendChild(el("span", "sfix", "✓ " + (want + 1)));
      });
    },
    correctText: (p) => p.items.join(" → ")
  };

  /* ================================================================ НАТИСНИ КЛАВІШІ */
  const normCombo = (s) => String(s).replace(/\s+/g, "").toLowerCase().replace(/cmd|meta/g, "ctrl").split("+").sort((a, b) => {
    const r = (x) => ({ ctrl: 0, shift: 1, alt: 2 }[x] ?? 3); return r(a) - r(b) || a.localeCompare(b);
  }).join("+");
  const codeKey = (e) => {
    const c = e.code || "";
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (/^Digit\d$/.test(c)) return c.slice(5);
    if (/^F\d{1,2}$/.test(c)) return c;
    return { BracketRight: "]", BracketLeft: "[", Delete: "Delete", Backspace: "Backspace", Enter: "Enter", Escape: "Esc", Space: "Space", Tab: "Tab", Minus: "-", Equal: "=" }[c] || "";
  };
  const comboOf = (e) => {
    const k = codeKey(e); if (!k) return "";
    return [(e.ctrlKey || e.metaKey) && "Ctrl", e.shiftKey && "Shift", e.altKey && "Alt", k].filter(Boolean).join(" + ");
  };
  const hasKeyboard = () => { try { return matchMedia("(pointer: fine)").matches && !("ontouchstart" in window && navigator.maxTouchPoints > 0 && !matchMedia("(hover: hover)").matches); } catch (e) { return true; } };
  const keys = {
    parse: (v) => ({ type: "keys", q: v.q, keys: v.keys, alt: v.alt || [], x: v.x || "", hint: "" }),
    render(box, p, setReady) {
      let ans = "", mode = hasKeyboard() ? "press" : "pick";
      const api = { get: () => ans, text: () => ans, mode: () => mode, stop() { document.removeEventListener("keydown", onKey, true); } };
      const wrap = el("div", "kwrap"); box.appendChild(wrap);
      function onKey(e) {
        if (mode !== "press" || locked(box) || !document.body.contains(wrap)) return;
        const c = comboOf(e);
        if (!c || ["Enter", "Tab"].includes(c)) return;
        e.preventDefault(); e.stopPropagation();
        ans = c; wrap.querySelector(".kshow").replaceChildren(...c.split(" + ").map((k) => el("kbd", "", k)));
        setReady(true);
      }
      const drawPress = () => {
        wrap.replaceChildren();
        const show = el("div", "kshow"); show.appendChild(el("span", "muted", "Натисни сполучення на клавіатурі…"));
        const alt = el("button", "link", "Немає клавіатури? Обери зі списку"); alt.type = "button";
        alt.onclick = () => { mode = "pick"; ans = ""; setReady(false); drawPick(); };
        wrap.append(show, alt);
        document.addEventListener("keydown", onKey, true);
      };
      const drawPick = () => {
        document.removeEventListener("keydown", onKey, true);
        wrap.replaceChildren();
        const opts = shuffle([p.keys, ...p.alt.filter((a) => normCombo(a) !== normCombo(p.keys))].slice(0, 4));
        const grid = el("div", "kgrid");
        opts.forEach((o) => {
          const b = el("button", "kopt"); b.type = "button"; b.dataset.v = o;
          b.append(...o.split("+").map((k) => el("kbd", "", k.trim())));
          b.onclick = () => { if (locked(box)) return; ans = o; [...grid.children].forEach((x) => x.classList.toggle("on", x === b)); setReady(true); };
          grid.appendChild(b);
        });
        wrap.appendChild(grid);
      };
      mode === "press" ? drawPress() : drawPick();
      return api;
    },
    judge: (p, ans) => !!ans && normCombo(ans) === normCombo(p.keys),
    reveal(box, p, api) {
      api.stop && api.stop();
      const ok = keys.judge(p, api.get());
      const show = box.querySelector(".kshow"); if (show) show.classList.add(ok ? "right" : "wrong");
      box.querySelectorAll(".kopt").forEach((b) => { if (normCombo(b.dataset.v) === normCombo(p.keys)) b.classList.add("right"); else if (b.classList.contains("on")) b.classList.add("wrong"); });
    },
    correctText: (p) => p.keys
  };

  /* ================================================================ ЗНАЙДИ НА КАРТИНЦІ */
  // Сцени — спрощені схеми інтерфейсів. Кожна клікабельна зона має id (data-spot).
  const SCENES = {
    window: { vb: "0 0 360 220", draw(g) {
      g.add("rect", { x: 8, y: 8, width: 344, height: 204, rx: 10, class: "sc-frame" });
      g.spot("title", "rect", { x: 8, y: 8, width: 256, height: 32, rx: 10, class: "sc-bar" }); g.text(22, 29, "Нотатки — Блокнот", "sc-t");
      g.spot("min", "rect", { x: 264, y: 8, width: 29, height: 32, class: "sc-btn" }); g.text(278, 30, "—", "sc-ic");
      g.spot("max", "rect", { x: 293, y: 8, width: 29, height: 32, class: "sc-btn" }); g.text(307, 30, "□", "sc-ic");
      g.spot("close", "rect", { x: 322, y: 8, width: 30, height: 32, class: "sc-btn sc-close" }); g.text(337, 30, "✕", "sc-ic");
      g.spot("menu", "rect", { x: 8, y: 40, width: 344, height: 22, class: "sc-menu" }); g.text(20, 55, "Файл   Редагування   Формат   Вигляд", "sc-s");
      g.add("rect", { x: 16, y: 70, width: 312, height: 112, class: "sc-paper" });
      [86, 102, 118].forEach((y, i) => g.add("rect", { x: 24, y, width: [210, 250, 160][i], height: 6, rx: 3, class: "sc-line" }));
      g.spot("scroll", "rect", { x: 332, y: 66, width: 14, height: 118, rx: 6, class: "sc-scroll" });
      g.spot("status", "rect", { x: 8, y: 188, width: 344, height: 24, class: "sc-menu" }); g.text(20, 204, "Рядок 1, стовпчик 1", "sc-s");
    } },
    desktop: { vb: "0 0 360 240", draw(g) {
      g.add("rect", { x: 0, y: 0, width: 360, height: 240, rx: 10, class: "sc-wall" });
      const icon = (id, x, y, emoji, label, arrow) => {
        g.spot(id, "rect", { x: x - 4, y: y - 4, width: 64, height: 60, rx: 8, class: "sc-icon" });
        g.text(x + 28, y + 28, emoji, "sc-emoji"); g.text(x + 28, y + 50, label, "sc-lbl");
        if (arrow) { g.add("rect", { x: x + 8, y: y + 18, width: 14, height: 14, rx: 3, class: "sc-arrowbg" }); g.text(x + 15, y + 30, "↗", "sc-arrow"); }
      };
      icon("recycle", 14, 12, "🗑️", "Кошик"); icon("folder", 14, 78, "📁", "Документи"); icon("shortcut", 14, 144, "🎮", "Гра", true); icon("file", 86, 12, "📝", "Реферат.docx");
      g.spot("taskbar", "rect", { x: 0, y: 206, width: 360, height: 34, class: "sc-task" });
      g.spot("start", "rect", { x: 4, y: 210, width: 30, height: 26, rx: 6, class: "sc-tbtn" }); g.text(19, 229, "⊞", "sc-start");
      g.spot("apps", "rect", { x: 40, y: 210, width: 92, height: 26, rx: 6, class: "sc-tbtn" }); g.text(86, 228, "🌐  📁  📝", "sc-apps");
      g.spot("clock", "rect", { x: 300, y: 210, width: 56, height: 26, rx: 6, class: "sc-tbtn" }); g.text(328, 228, "09:20", "sc-clock");
    } },
    mail: { vb: "0 0 360 250", draw(g) {
      g.add("rect", { x: 6, y: 6, width: 348, height: 238, rx: 10, class: "sc-frame" });
      g.add("rect", { x: 6, y: 6, width: 348, height: 28, rx: 10, class: "sc-bar" }); g.text(18, 25, "Новий лист", "sc-t");
      const field = (id, y, label) => { g.text(16, y + 15, label, "sc-s"); g.spot(id, "rect", { x: 110, y, width: 236, height: 22, rx: 5, class: "sc-field" }); };
      field("to", 42, "Кому"); field("cc", 68, "Копія"); field("bcc", 94, "Прихована копія"); field("subject", 120, "Тема");
      g.spot("body", "rect", { x: 14, y: 150, width: 332, height: 56, rx: 6, class: "sc-field" }); g.text(22, 168, "Доброго дня! …", "sc-s");
      g.spot("send", "rect", { x: 14, y: 214, width: 84, height: 24, rx: 12, class: "sc-send" }); g.text(56, 230, "Надіслати", "sc-sendt");
      g.spot("attach", "rect", { x: 108, y: 214, width: 30, height: 24, rx: 6, class: "sc-tbtn2" }); g.text(123, 231, "📎", "sc-emoji2");
      g.spot("sign", "rect", { x: 144, y: 214, width: 30, height: 24, rx: 6, class: "sc-tbtn2" }); g.text(159, 231, "✍️", "sc-emoji2");
      g.spot("trash", "rect", { x: 316, y: 214, width: 30, height: 24, rx: 6, class: "sc-tbtn2" }); g.text(331, 231, "🗑️", "sc-emoji2");
    } },
    ppt: { vb: "0 0 360 150", draw(g) {
      g.add("rect", { x: 4, y: 4, width: 352, height: 142, rx: 10, class: "sc-frame" });
      const tabs = [["file", "Файл", 34], ["home", "Основне", 48], ["insert", "Вставлення", 60], ["design", "Конструктор", 64], ["trans", "Переходи", 54], ["anim", "Анімація", 52], ["show", "Показ", 36]];
      let x = 8;
      tabs.forEach(([id, t, w]) => { g.spot(id, "rect", { x, y: 10, width: w - 2, height: 22, rx: 5, class: "sc-tab" + (id === "home" ? " sc-tabon" : "") }); g.text(x + (w - 2) / 2, 25, t, "sc-tabt"); x += w; });
      g.add("rect", { x: 8, y: 36, width: 344, height: 58, rx: 6, class: "sc-ribbon" });
      const btn = (id, x, w, ic, t) => { g.spot(id, "rect", { x, y: 42, width: w, height: 46, rx: 6, class: "sc-rbtn" }); g.text(x + w / 2, 62, ic, "sc-emoji2"); g.text(x + w / 2, 81, t, "sc-tabt"); };
      btn("paste", 14, 50, "📋", "Вставити"); btn("font", 70, 80, "𝐁 𝐼 U̲", "Шрифт"); btn("para", 156, 60, "≡", "Абзац"); btn("draw", 222, 62, "⬛◯", "Малювання"); btn("select", 290, 56, "⬚▾", "Виділити");
      g.add("rect", { x: 8, y: 100, width: 344, height: 40, rx: 6, class: "sc-paper" }); g.text(180, 125, "Слайд 1", "sc-tabt");
    } },
    share: { vb: "0 0 360 230", draw(g) {
      g.add("rect", { x: 6, y: 6, width: 348, height: 218, rx: 12, class: "sc-frame" });
      g.text(20, 32, "Надати доступ до «Проєкт_Мельник»", "sc-t");
      g.spot("add", "rect", { x: 18, y: 42, width: 324, height: 28, rx: 6, class: "sc-field" }); g.text(28, 61, "Додайте людей і групи", "sc-s");
      g.text(20, 90, "Люди з доступом", "sc-s");
      g.add("rect", { x: 18, y: 96, width: 324, height: 30, rx: 6, class: "sc-paper" }); g.text(28, 116, "olena.koval@…", "sc-s");
      g.spot("role", "rect", { x: 250, y: 100, width: 86, height: 22, rx: 5, class: "sc-tbtn2" }); g.text(293, 115, "Редактор ▾", "sc-tabt");
      g.text(20, 146, "Загальний доступ", "sc-s");
      g.spot("general", "rect", { x: 18, y: 152, width: 200, height: 26, rx: 6, class: "sc-tbtn2" }); g.text(28, 169, "🔒 Обмежено ▾", "sc-s");
      g.spot("link", "rect", { x: 18, y: 190, width: 150, height: 26, rx: 13, class: "sc-tbtn2" }); g.text(93, 207, "🔗 Копіювати посилання", "sc-tabt");
      g.spot("done", "rect", { x: 268, y: 190, width: 74, height: 26, rx: 13, class: "sc-send" }); g.text(305, 207, "Готово", "sc-sendt");
    } },
    /* локальна мережа класу: Інтернет — маршрутизатор — дротові й бездротові пристрої */
    network: { vb: "0 0 360 240", draw(g) {
      g.add("rect", { x: 0, y: 0, width: 360, height: 240, rx: 10, class: "sc-frame" });
      g.add("line", { x1: 180, y1: 58, x2: 180, y2: 92, class: "sc-wire" });
      g.spot("internet", "ellipse", { cx: 180, cy: 34, rx: 78, ry: 24, class: "sc-cloud" }); g.text(180, 39, "🌐 Інтернет", "sc-tc");
      g.add("line", { x1: 84, y1: 112, x2: 130, y2: 112, class: "sc-wire" });
      g.add("polyline", { points: "160,132 160,204 118,204", class: "sc-wire", fill: "none" });
      g.spot("cable", "rect", { x: 86, y: 103, width: 42, height: 18, rx: 4, class: "sc-icon" });
      g.spot("cable", "rect", { x: 151, y: 140, width: 18, height: 56, rx: 4, class: "sc-icon" }); g.text(107, 98, "кабель", "sc-lbl");
      g.spot("router", "rect", { x: 130, y: 92, width: 100, height: 40, rx: 8, class: "sc-tbtn2" }); g.text(180, 109, "📡", "sc-emoji2"); g.text(180, 125, "Маршрутизатор", "sc-lbl");
      g.add("path", { d: "M 248 104 q 8 8 0 16 M 256 98 q 14 14 0 28 M 264 92 q 20 20 0 40", class: "sc-waves", fill: "none" });
      g.spot("wifi", "rect", { x: 236, y: 88, width: 40, height: 48, rx: 6, class: "sc-icon" }); g.text(256, 148, "Wi-Fi", "sc-lbl");
      g.add("line", { x1: 276, y1: 104, x2: 284, y2: 92, class: "sc-wireless" });
      g.add("line", { x1: 276, y1: 120, x2: 284, y2: 168, class: "sc-wireless" });
      const dev = (id, x, y, emoji, label, w = 72) => { g.spot(id, "rect", { x, y, width: w, height: 56, rx: 8, class: "sc-tbtn2" }); g.text(x + w / 2, y + 28, emoji, "sc-emoji"); g.text(x + w / 2, y + 48, label, "sc-lbl"); };
      dev("pc", 12, 86, "🖥️", "Комп'ютер"); dev("printer", 30, 176, "🖨️", "Спільний принтер", 88);
      dev("laptop", 284, 66, "💻", "Ноутбук"); dev("phone", 284, 150, "📱", "Телефон");
    } },
    /* стрічка Word, вкладка «Основне»: група «Шрифт» і група «Абзац» зі списками */
    word: { vb: "0 0 360 170", draw(g) {
      g.add("rect", { x: 4, y: 4, width: 352, height: 162, rx: 10, class: "sc-frame" });
      const tabs = [["file", "Файл", 40], ["home", "Основне", 54], ["insert", "Вставлення", 66], ["layout", "Макет", 46]];
      let x = 8;
      tabs.forEach(([id, t, w]) => { g.spot(id, "rect", { x, y: 10, width: w - 2, height: 22, rx: 5, class: "sc-tab" + (id === "home" ? " sc-tabon" : "") }); g.text(x + (w - 2) / 2, 25, t, "sc-tabt"); x += w; });
      g.add("rect", { x: 8, y: 36, width: 344, height: 74, rx: 6, class: "sc-ribbon" });
      g.spot("font", "rect", { x: 12, y: 42, width: 92, height: 62, rx: 6, class: "sc-rbtn" }); g.text(58, 64, "Calibri 11", "sc-tabt"); g.text(58, 82, "𝐁  𝐼  U̲  A", "sc-emoji2"); g.text(58, 100, "Шрифт", "sc-tabt");
      g.add("line", { x1: 108, y1: 44, x2: 108, y2: 104, class: "sc-wire" });
      const b = (id, x, y, ic, tip) => { g.spot(id, "rect", { x, y, width: 34, height: 26, rx: 5, class: "sc-tbtn2" }); g.text(x + 17, y + 18, ic, "sc-ic"); };
      b("bullets", 114, 44, "•≡"); b("numbering", 150, 44, "1≡"); b("multilevel", 186, 44, "1.a"); b("indentDec", 222, 44, "⇤"); b("indentInc", 258, 44, "⇥"); b("sort", 294, 44, "А↓Я");
      g.spot("align", "rect", { x: 114, y: 74, width: 70, height: 22, rx: 5, class: "sc-tbtn2" }); g.text(149, 89, "≡ ≡ ≡ ≡", "sc-ic");
      g.text(260, 101, "Абзац", "sc-tabt");
      g.add("rect", { x: 8, y: 114, width: 344, height: 48, rx: 6, class: "sc-paper" });
      g.text(24, 130, "• Хліб", "sc-s"); g.text(24, 145, "• Молоко", "sc-s"); g.text(120, 130, "1. Вступ", "sc-s"); g.text(120, 145, "2. Основна частина", "sc-s"); g.text(250, 130, "1. Тварини", "sc-s"); g.text(262, 145, "a. Ссавці", "sc-s");
    } },
    /* PowerPoint: вкладка «Вставлення» (мультимедіа) і вкладка «Показ слайдів» */
    pptshow: { vb: "0 0 360 190", draw(g) {
      g.add("rect", { x: 4, y: 4, width: 352, height: 182, rx: 10, class: "sc-frame" });
      g.text(14, 22, "Вставлення", "sc-t");
      g.add("rect", { x: 8, y: 28, width: 344, height: 58, rx: 6, class: "sc-ribbon" });
      const btn = (id, x, y, w, ic, l1, l2) => { g.spot(id, "rect", { x, y, width: w, height: 50, rx: 6, class: "sc-rbtn" }); g.text(x + w / 2, y + 18, ic, "sc-emoji2"); g.text(x + w / 2, y + 33, l1, "sc-tabt sc-xs"); if (l2) g.text(x + w / 2, y + 44, l2, "sc-tabt sc-xs"); };
      btn("image", 14, 32, 70, "🖼️", "Зображення"); g.text(108, 62, "…", "sc-tabt"); btn("video", 132, 32, 64, "🎬", "Відео"); btn("audio", 202, 32, 64, "🔊", "Звук");
      g.text(14, 108, "Показ слайдів", "sc-t");
      g.add("rect", { x: 8, y: 114, width: 344, height: 66, rx: 6, class: "sc-ribbon" });
      btn("fromStart", 12, 120, 62, "▶", "Із", "початку"); btn("fromCurrent", 78, 120, 66, "▶", "З поточного", "слайда"); btn("setup", 148, 120, 66, "⚙️", "Налаштування", "показу");
      btn("hide", 218, 120, 62, "🙈", "Приховати", "слайд"); btn("rehearse", 284, 120, 64, "⏱️", "Репетиція", "часу");
    } },
    /* «Аніматор Ліцею» (animator.html): ті самі частини вікна, що й у редакторі */
    animator: { vb: "0 0 360 236", draw(g) {
      g.add("rect", { x: 2, y: 2, width: 356, height: 232, rx: 10, class: "sc-frame" });
      g.spot("top", "rect", { x: 6, y: 6, width: 348, height: 22, rx: 6, class: "sc-bar" }); g.text(14, 21, "🎬 Аніматор Ліцею · Мій мультфільм", "sc-s"); g.text(312, 20, "Новий · Зберегти", "sc-tabt");
      g.spot("tools", "rect", { x: 6, y: 32, width: 30, height: 136, rx: 6, class: "sc-tbtn2" });
      ["↖", "▭", "◯", "△", "╱", "T", "🪣"].forEach((ic, i) => g.text(21, 48 + i * 18, ic, "sc-ic"));
      g.spot("stage", "rect", { x: 40, y: 32, width: 210, height: 136, rx: 4, class: "sc-stage" });
      g.add("circle", { cx: 110, cy: 110, r: 16, class: "sc-ball" }); g.add("path", { d: "M 126 104 q 40 -50 80 0", class: "sc-path", fill: "none" });
      g.spot("palette", "rect", { x: 254, y: 32, width: 100, height: 66, rx: 6, class: "sc-tbtn2" }); g.text(304, 46, "Колірна палітра", "sc-tabt");
      ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"].forEach((c, i) => g.add("rect", { x: 262 + i * 18, y: 52, width: 14, height: 14, rx: 3, fill: c }));
      g.text(304, 86, "#FF8800  R G B", "sc-tabt");
      g.spot("params", "rect", { x: 254, y: 102, width: 100, height: 66, rx: 6, class: "sc-tbtn2" }); g.text(304, 116, "Параметри", "sc-tabt"); g.text(304, 134, "X 110  Y 110", "sc-tabt"); g.text(304, 150, "Кут 0°  Ефекти", "sc-tabt");
      g.spot("layers", "rect", { x: 40, y: 172, width: 314, height: 20, rx: 5, class: "sc-tbtn2" }); g.text(197, 186, "Статичне тло · Динамічне тло · Анімація", "sc-tabt");
      g.spot("play", "rect", { x: 6, y: 172, width: 30, height: 56, rx: 6, class: "sc-send" }); g.text(21, 205, "▶", "sc-sendt");
      g.spot("timeline", "rect", { x: 40, y: 196, width: 314, height: 32, rx: 5, class: "sc-tbtn2" });
      for (let i = 0; i < 12; i++) { g.add("rect", { x: 46 + i * 25, y: 202, width: 21, height: 20, rx: 3, class: i === 0 || i === 11 ? "sc-key" : "sc-cell" }); g.text(56.5 + i * 25, 216, i === 0 || i === 11 ? "◆" : String(i + 1), "sc-tabt"); }
    } }
  };
  const spot = {
    parse: (v) => ({ type: "spot", q: v.q, scene: v.scene, target: [].concat(v.target), x: v.x || "", hint: "Торкнись (клацни) потрібного місця на схемі — воно підсвітиться. Потім тисни «Відповісти»." }),
    render(box, p, setReady) {
      let ans = "";
      const S = SCENES[p.scene];
      const svg = svgEl("svg", { viewBox: S.vb, class: "scene", role: "img", "aria-label": "Схема інтерфейсу" });
      const g = {
        add: (t, a) => { const e = svgEl(t, a); svg.appendChild(e); return e; },
        text: (x, y, s, c) => { const e = svgEl("text", { x, y, class: c }); e.textContent = s; svg.appendChild(e); return e; },
        spot: (id, t, a) => {
          const e = svgEl(t, a); e.dataset.spot = id; e.classList.add("hot"); e.setAttribute("tabindex", "0"); e.setAttribute("role", "button");
          const pick = () => { if (locked(box)) return; ans = id; svg.querySelectorAll(".hot").forEach((h) => h.classList.toggle("on", h === e)); setReady(true); };
          e.addEventListener("click", pick); e.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
          svg.appendChild(e); return e;
        }
      };
      S.draw(g);
      // підписи, значки й прикраси не перехоплюють натискання — клікається зона під ними
      svg.querySelectorAll("*:not(.hot)").forEach((t) => t.setAttribute("pointer-events", "none"));
      const wrap = el("div", "scenewrap"); wrap.appendChild(svg); box.appendChild(wrap);
      return { get: () => ans, text: () => ans || "" };
    },
    judge: (p, ans) => p.target.includes(ans),
    reveal(box, p, api) {
      box.querySelectorAll(".hot").forEach((h) => {
        if (p.target.includes(h.dataset.spot)) h.classList.add("right");
        else if (h.dataset.spot === api.get()) h.classList.add("wrong");
      });
    },
    correctText: () => "показано на схемі зеленим"
  };

  /* ================================================================ СИМУЛЯТОРИ */
  const sims = {};

  /* ---------- «Провідник»: папки й файли ---------- */
  const FORBID = /[\\/:*?"<>|]/;
  const iconOf = (n) => n.type === "dir" ? "📁" : ({ txt: "📄", docx: "📝", xlsx: "📊", pptx: "📽️", jpg: "🖼️", png: "🖼️", mp3: "🎵", mp4: "🎬", pdf: "📕", exe: "⚙️", zip: "🗜️" }[n.name.split(".").pop().toLowerCase()] || "📄");
  const build = (name, spec) => spec === "file" || typeof spec === "string" ? { type: "file", name } : { type: "dir", name, children: Object.entries(spec || {}).map(([k, v]) => build(k, v)) };
  const clone = (n) => n.type === "dir" ? { type: "dir", name: n.name, children: n.children.map(clone) } : { type: "file", name: n.name };
  sims.files = {
    hint: "Торкнись файлу чи папки, щоб виділити, — потім обери дію на кнопках угорі. Папку відкриває кнопка «Відкрити» (або подвійне натискання). Підказка внизу вікна скаже, що робити далі. На комп'ютері працюють і Ctrl + C / X / V, F2, Delete.",
    render(box, p, setReady) {
      const root = build("Диск D:", p.start);
      const S = { cwd: [root], sel: null, clip: null, bin: [], binOpen: false, restored: new Set(), msg: "" };
      const cur = () => S.cwd[S.cwd.length - 1];
      const find = (path) => { let n = root; for (const part of path.split("/").filter(Boolean)) { if (!n || n.type !== "dir") return null; n = n.children.find((c) => c.name === part); } return n || null; };
      const uniq = (dir, name) => {
        if (!dir.children.some((c) => c.name === name)) return name;
        const dot = name.lastIndexOf("."), base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : "";
        let i = 1, n; do { n = `${base} - копія${i > 1 ? " (" + i + ")" : ""}${ext}`; i++; } while (dir.children.some((c) => c.name === n)); return n;
      };
      const say = (m) => { S.msg = m; draw(); };
      const goals = el("ul", "goals"); (p.goals || []).forEach((g) => goals.appendChild(el("li", "", g.t)));
      const fx = el("div", "fx");
      box.append(goals, fx);
      const act = {
        open() { if (!S.sel || S.sel.type !== "dir") return say("Виділи папку, яку треба відкрити."); S.cwd.push(S.sel); S.sel = null; S.msg = ""; draw(); },
        newdir() { const d = cur(); const n = { type: "dir", name: uniq(d, "Нова папка"), children: [] }; d.children.push(n); S.sel = n; startRename(); },
        rename() { if (!S.sel) return say("Спершу виділи файл або папку."); startRename(); },
        copy() { if (!S.sel) return say("Спершу виділи, що копіювати."); S.clip = { node: S.sel, from: cur(), mode: "copy" }; say(`Скопійовано в буфер: ${S.sel.name}`); },
        cut() { if (!S.sel) return say("Спершу виділи, що вирізати."); S.clip = { node: S.sel, from: cur(), mode: "cut" }; say(`Вирізано: ${S.sel.name}. Відкрий іншу папку й встав.`); },
        paste() {
          if (!S.clip) return say("Буфер обміну порожній: спершу скопіюй або виріж.");
          const d = cur(), { node, from, mode } = S.clip;
          if (node.type === "dir" && S.cwd.includes(node)) return say("Не можна вставити папку саму в себе.");
          if (mode === "cut") {
            if (from === d) return say("Файл і так у цій папці.");
            if (d.children.some((c) => c.name === node.name)) return say("Тут уже є об'єкт з таким іменем.");
            from.children = from.children.filter((c) => c !== node); d.children.push(node); S.clip = null; S.sel = node; return say(`Переміщено: ${node.name}`);
          }
          const c = clone(node); c.name = uniq(d, node.name); d.children.push(c); S.sel = c; say(`Вставлено: ${c.name}`);
        },
        del() {
          if (!S.sel) return say("Спершу виділи, що видалити.");
          const d = cur(); d.children = d.children.filter((c) => c !== S.sel); S.bin.push({ node: S.sel, from: d }); say(`${S.sel.name} — у Кошику.`); S.sel = null; draw();
        },
        bin() { S.binOpen = !S.binOpen; draw(); },
        up() { if (S.cwd.length > 1) { S.cwd.pop(); S.sel = null; S.msg = ""; draw(); } }
      };
      function startRename() {
        draw();
        const bar = fx.querySelector(".fx-rename"); bar.hidden = false;
        const inp = bar.querySelector("input"); inp.value = S.sel.name; inp.focus(); inp.select();
      }
      function finishRename(ok) {
        const bar = fx.querySelector(".fx-rename"), inp = bar.querySelector("input");
        if (!ok) { bar.hidden = true; return draw(); }
        const v = inp.value.trim(), d = cur();
        if (!v) return say("Ім'я не може бути порожнім.");
        if (FORBID.test(v)) { S.msg = "В імені не можна використовувати символи \\ / : * ? \" < > |"; draw(); return startRename(); }
        if (d.children.some((c) => c !== S.sel && c.name === v)) { S.msg = "Тут уже є об'єкт з таким іменем."; draw(); return startRename(); }
        S.sel.name = v; bar.hidden = true; say(`Перейменовано: ${v}`);
      }
      function tap(n) {
        if (locked(box)) return;
        if (S.sel === n && n.type === "dir") { S.cwd.push(n); S.sel = null; S.msg = ""; return draw(); }
        S.sel = n; S.msg = ""; draw();
      }
      function draw() {
        fx.replaceChildren();
        const bar = el("div", "fx-bar");
        // кнопка, якій зараз нічого робити (нічого не виділено, буфер порожній), — бліда, але натискається й пояснює чому
        const can = { open: !S.binOpen && !!S.sel && S.sel.type === "dir", newdir: !S.binOpen, rename: !S.binOpen && !!S.sel, copy: !S.binOpen && !!S.sel, cut: !S.binOpen && !!S.sel, paste: !S.binOpen && !!S.clip, del: !S.binOpen && !!S.sel, bin: true };
        [["open", "📂", "Відкрити"], ["newdir", "📁＋", "Нова папка"], ["rename", "✏️", "Перейме\u00adнувати"], ["copy", "📋", "Копіювати"], ["cut", "✂️", "Вирізати"], ["paste", "📥", "Вставити"], ["del", "🗑️", "Видалити"], ["bin", "♻️", S.binOpen ? "Закрити Кошик" : `Кошик (${S.bin.length})`]]
          .forEach(([k, ic, t]) => { const b = el("button", "fx-b" + (can[k] ? "" : " off")); b.type = "button"; b.append(el("span", "fx-bi", ic), el("span", "fx-bt", t)); b.onclick = () => { if (!locked(box)) act[k](); }; bar.appendChild(b); });
        const path = el("div", "fx-path");
        const up = el("button", "fx-up", "⬆"); up.type = "button"; up.title = "Вгору"; up.disabled = S.cwd.length < 2; up.onclick = () => !locked(box) && act.up();
        path.append(up, el("span", "", S.cwd.map((d) => d.name).join(" › ")));
        const grid = el("div", "fx-grid");
        if (S.binOpen) {
          if (!S.bin.length) grid.appendChild(el("p", "muted small", "Кошик порожній."));
          S.bin.forEach((it, i) => {
            const t = el("div", "fx-item"); t.append(el("span", "fx-ic", iconOf(it.node)), el("span", "fx-n", it.node.name));
            const r = el("button", "fx-restore", "Відновити"); r.type = "button";
            r.onclick = () => { if (locked(box)) return; S.bin.splice(i, 1); it.node.name = uniq(it.from, it.node.name); it.from.children.push(it.node); S.restored.add(it.node.name); say(`Відновлено: ${it.node.name}`); };
            t.appendChild(r); grid.appendChild(t);
          });
        } else {
          const items = cur().children.slice().sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "uk") : a.type === "dir" ? -1 : 1));
          if (!items.length) grid.appendChild(el("p", "muted small", "Папка порожня."));
          items.forEach((n) => {
            const t = el("button", "fx-item" + (S.sel === n ? " on" : "") + (S.clip && S.clip.mode === "cut" && S.clip.node === n ? " cut" : "")); t.type = "button";
            t.append(el("span", "fx-ic", iconOf(n)), el("span", "fx-n", n.name));
            t.onclick = () => tap(n); t.ondblclick = () => { if (n.type === "dir" && !locked(box)) { S.cwd.push(n); S.sel = null; draw(); } };
            grid.appendChild(t);
          });
        }
        const ren = el("div", "fx-rename"); ren.hidden = true;
        const inp = el("input"); inp.type = "text"; inp.setAttribute("aria-label", "Нове ім'я"); inp.autocomplete = "off"; inp.spellcheck = false;
        inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); finishRename(true); } if (e.key === "Escape") finishRename(false); e.stopPropagation(); };
        const ok = el("button", "btn small-btn", "OK"); ok.type = "button"; ok.onclick = () => finishRename(true);
        ren.append(inp, ok);
        const status = el("div", "fx-status", S.msg ? "ℹ️ " + S.msg : "👉 " + nextStep());
        fx.append(bar, path, grid, ren, status);
        markGoals();
      }
      // підказка «що робити далі» — коли немає свіжого повідомлення про дію
      function nextStep() {
        if (S.binOpen) return S.bin.length ? "Біля потрібного файлу натисни «Відновити». Щоб повернутися до папок — «Закрити Кошик»." : "Кошик порожній. Натисни «Закрити Кошик».";
        if (S.clip) return `У буфері: ${S.clip.node.name}. Відкрий папку, куди його треба вставити, і натисни «Вставити».`;
        if (S.sel && S.sel.type === "dir") return `Виділено папку «${S.sel.name}». Натисни «Відкрити», щоб зайти в неї, або обери іншу дію вгорі.`;
        if (S.sel) return `Виділено «${S.sel.name}». Тепер обери дію на кнопках угорі.`;
        return S.cwd.length > 1 ? "Торкнись файлу чи папки, щоб виділити. Кнопка ⬆ — повернутися на рівень вище." : "Торкнись файлу чи папки, щоб виділити.";
      }
      // ціль, яку вже виконано, одразу отримує галочку
      function markGoals() { [...goals.children].forEach((li, i) => { if (!li.classList.contains("right") && !li.classList.contains("wrong")) li.classList.toggle("done", check(p.goals[i])); }); }
      function onKey(e) {
        if (locked(box) || !document.body.contains(fx) || (e.target && e.target.tagName === "INPUT")) return;
        const c = comboOf(e), map = { "Ctrl + C": "copy", "Ctrl + X": "cut", "Ctrl + V": "paste", "F2": "rename", "Delete": "del", "Backspace": "up" };
        if (map[c]) { e.preventDefault(); act[map[c]](); }
        else if (c === "Enter" && S.sel && S.sel.type === "dir") { e.preventDefault(); tap(S.sel); }
      }
      document.addEventListener("keydown", onKey, true);
      const check = (g) => {
        if (g.dir) { const n = find(g.dir); return !!n && n.type === "dir"; }
        if (g.has) return !!find(g.has);
        if (g.not) return !find(g.not);
        if (g.empty) { const n = find(g.empty); return !!n && n.type === "dir" && !n.children.length; }
        if (g.bin) return S.bin.some((b) => b.node.name === g.bin);
        if (g.restored) return S.restored.has(g.restored) && !!find(g.at || g.restored);
        if (g.sel) { const n = find(g.sel); return !!n && S.sel === n; }
        return false;
      };
      draw(); setReady(true);
      return { get: () => (p.goals || []).map(check), text: () => (p.goals || []).filter((g, i) => !check(g)).map((g) => "не виконано: " + g.t).join("; ") || "усе виконано", stop: () => document.removeEventListener("keydown", onKey, true), goals };
    },
    judge: (p, res) => res.length > 0 && res.every(Boolean),
    reveal(box, p, api) { api.stop(); const res = api.get(); [...api.goals.children].forEach((li, i) => li.classList.add(res[i] ? "right" : "wrong")); },
    correctText: (p) => (p.goals || []).map((g) => g.t).join("; ")
  };

  /* ---------- «Пошта Ліцею»: фішинг чи ні ---------- */
  const richText = (s) => {   // «текст [посилання](https://адреса) текст» → вузли, без innerHTML
    const out = []; const re = /\[([^\]]+)\]\(([^)]+)\)/g; let last = 0, m;
    while ((m = re.exec(s))) { if (m.index > last) out.push(document.createTextNode(s.slice(last, m.index))); const a = el("span", "ib-link", m[1]); a.dataset.url = m[2]; a.tabIndex = 0; a.setAttribute("role", "link"); out.push(a); last = re.lastIndex; }
    if (last < s.length) out.push(document.createTextNode(s.slice(last)));
    return out;
  };
  sims.inbox = {
    hint: "Відкривай листи, дивись на адресу відправника й на те, куди насправді ведуть посилання (наведи вказівник або торкнись). Познач кожен лист.",
    render(box, p, setReady) {
      const mails = shuffle(p.mails.map((m, i) => ({ ...m, i })));
      const mark = new Map(); let open = null;
      const ib = el("div", "ib"); box.appendChild(ib);
      function draw() {
        ib.replaceChildren();
        const head = el("div", "ib-head"); head.append(el("b", "", "📬 Пошта Ліцею"), el("span", "", "навчальна скринька — справжні паролі тут не вводь"));
        ib.appendChild(head);
        if (open === null) {
          const list = el("div", "ib-list");
          mails.forEach((m) => {
            const r = el("button", "ib-row"); r.type = "button"; r.dataset.i = m.i;
            const v = mark.get(m.i);
            r.append(el("span", "ib-av", (m.from || "?").trim()[0].toUpperCase()), Object.assign(el("span", "ib-meta"), {}), el("span", "ib-mark" + (v === undefined ? "" : v ? " ph" : " ok"), v === undefined ? "…" : v ? "🚩" : "✅"));
            r.children[1].append(el("b", "", m.from), el("span", "", m.subj));
            r.onclick = () => { if (!locked(box)) { open = m; draw(); } };
            if (m.verdict !== undefined) r.classList.add(m.verdict ? "right" : "wrong");
            list.appendChild(r);
            if (m.why && m.verdict !== undefined) list.appendChild(el("p", "ib-why", (m.phish ? "🚩 Фішинг: " : "✅ Безпечний: ") + m.why));
          });
          ib.appendChild(list);
          ib.appendChild(el("p", "small muted", `Позначено: ${mark.size} з ${mails.length}`));
        } else {
          const m = open, v = el("div", "ib-view");
          const back = el("button", "link", "← До списку листів"); back.type = "button"; back.onclick = () => { open = null; draw(); };
          const from = el("p", "ib-from"); from.append(el("b", "", m.from + " "), el("span", "ib-addr", "<" + m.addr + ">"));
          const subj = el("p", "ib-subj", m.subj);
          const body = el("div", "ib-body"); m.body.split("\n").forEach((line) => { const pp = el("p"); pp.append(...richText(line)); body.appendChild(pp); });
          if (m.attach) { const at = el("p", "ib-att", "📎 " + m.attach); body.appendChild(at); }
          const status = el("div", "ib-status", "Наведи вказівник або торкнись посилання, щоб побачити, куди воно веде.");
          body.querySelectorAll(".ib-link").forEach((a) => {
            const showUrl = (e) => { if (e) e.preventDefault(); status.textContent = "Посилання веде на: " + a.dataset.url; status.classList.add("on"); };
            a.addEventListener("mouseenter", () => showUrl()); a.addEventListener("focus", () => showUrl()); a.addEventListener("click", showUrl);
          });
          const btns = el("div", "ib-btns");
          const ok = el("button", "btn ghost", "✅ Безпечний"), ph = el("button", "btn ghost ib-ph", "🚩 Фішинг"); ok.type = ph.type = "button";
          ok.onclick = () => { if (locked(box)) return; mark.set(m.i, false); open = null; setReady(mark.size === mails.length); draw(); };
          ph.onclick = () => { if (locked(box)) return; mark.set(m.i, true); open = null; setReady(mark.size === mails.length); draw(); };
          btns.append(ok, ph);
          v.append(back, from, subj, body, status, btns); ib.appendChild(v);
        }
      }
      draw();
      return {
        get: () => mark, text: () => mails.map((m) => `${m.subj}: ${mark.get(m.i) === undefined ? "?" : mark.get(m.i) ? "фішинг" : "безпечний"}`).join("; "),
        reveal() { open = null; mails.forEach((m) => (m.verdict = mark.get(m.i) === !!m.phish)); draw(); }
      };
    },
    judge: (p, mark) => p.mails.every((m, i) => mark.get(i) === !!m.phish),
    reveal(box, p, api) { api.reveal(); },
    correctText: (p) => p.mails.filter((m) => m.phish).map((m) => "фішинг: " + m.subj).join("; ")
  };

  /* ---------- Стрічка: результати пошуку («Шукач») або повідомлення («Чат класу») ----------
     items [{from, addr, subj, body, ans, why}], labels [[ключ, «підпис»]…]. Кожен елемент позначають однією міткою. */
  sims.feed = {
    hint: "Прочитай кожен елемент і познач його кнопкою під ним. Посилання показує, куди насправді веде, — наведи вказівник або торкнись.",
    render(box, p, setReady) {
      const items = shuffle(p.items.map((m, i) => ({ ...m, i })));
      const mark = new Map(), chat = p.view === "chat";
      const fd = el("div", "fd" + (chat ? " fd-chat" : " fd-search")); box.appendChild(fd);
      const status = el("div", "ib-status", chat ? "Посилання в повідомленні? Торкнись його, щоб побачити адресу." : "Наведи вказівник на посилання або торкнись його — тут з'явиться справжня адреса.");
      const head = el("div", "ib-head"); head.append(el("b", "", p.title || (chat ? "💬 Чат класу" : "🔎 Шукач")), el("span", "", chat ? "навчальний чат — справжніх людей тут немає" : "навчальний пошуковик — результати вигадані"));
      fd.appendChild(head);
      if (!chat && p.query) { const q = el("div", "fd-query"); q.append(el("span", "", "🔎"), el("span", "fd-qtext", p.query)); fd.appendChild(q); }
      const count = el("p", "small muted fd-count");
      const showCount = () => { count.textContent = `Позначено: ${mark.size} з ${items.length}`; };
      const cards = items.map((m) => {
        const card = el("div", "fd-item"); card.dataset.i = m.i;
        if (chat) {
          const top = el("div", "fd-top"), who = el("span", "fd-who");
          who.append(el("b", "", m.from || ""), el("span", "", m.addr || ""));
          top.append(el("span", "ib-av", (m.from || "?").trim()[0].toUpperCase()), who);
          card.appendChild(top);
        } else {
          if (m.subj) card.appendChild(el("div", "fd-title", m.subj));
          if (m.addr) card.appendChild(el("div", "fd-url", m.addr));
        }
        const body = el("div", "fd-body");
        if (chat && m.subj && m.body) body.appendChild(el("p", "", m.subj));
        String(m.body || (chat ? m.subj : "")).split("\n").forEach((line) => { const pp = el("p"); pp.append(...richText(line)); body.appendChild(pp); });
        card.appendChild(body);
        body.querySelectorAll(".ib-link").forEach((a) => {
          const showUrl = (e) => { if (e) e.preventDefault(); status.textContent = "Посилання веде на: " + a.dataset.url; status.classList.add("on"); };
          a.addEventListener("mouseenter", () => showUrl()); a.addEventListener("focus", () => showUrl()); a.addEventListener("click", showUrl);
        });
        const btns = el("div", "fd-btns");
        p.labels.forEach(([k, t]) => {
          const b = el("button", "fd-b", t); b.type = "button";
          b.onclick = () => {
            if (locked(box)) return;
            mark.set(m.i, k); [...btns.children].forEach((x) => x.classList.toggle("on", x === b));
            card.classList.add("marked"); showCount(); setReady(mark.size === items.length);
          };
          btns.appendChild(b);
        });
        card.appendChild(btns); fd.appendChild(card);
        return { card, m };
      });
      fd.append(status, count); showCount();
      const reveal = () => cards.forEach(({ card, m }) => {
        const ok = mark.get(m.i) === m.ans; card.classList.add(ok ? "right" : "wrong");
        const lab = (p.labels.find(([k]) => k === m.ans) || [, m.ans])[1];
        card.appendChild(el("p", "ib-why", (ok ? "✓ " : "✗ Правильно: " + lab + ". ") + (m.why || "")));
      });
      return { get: () => mark, text: () => items.map((m) => `${m.subj || m.from}: ${(p.labels.find(([k]) => k === mark.get(m.i)) || [, "?"])[1]}`).join("; "), reveal };
    },
    judge: (p, mark) => p.items.every((m, i) => mark.get(i) === m.ans),
    reveal(box, p, api) { api.reveal(); },
    correctText: (p) => p.items.map((m) => `${m.subj || m.from} — ${(p.labels.find(([k]) => k === m.ans) || [, m.ans])[1]}`).join("; ")
  };

  /* ---------- Колірна палітра: зібрати колір за кодом ----------
     mode "rgb" — дано HEX, учень ставить повзунки R, G, B; mode "hex" — дано R, G, B, учень вводить код HEX. */
  const hex2rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
  sims.color = {
    hint: (v) => v.mode === "hex"
      ? "Переведи кожне число R, G, B у два шістнадцяткові символи й запиши код у поле: #RRGGBB. Квадратик покаже твій колір."
      : "Рухай повзунки R (червоний), G (зелений), B (синій) або впиши числа 0–255. Квадратик показує, що вийшло.",
    render(box, p, setReady) {
      const target = hex2rgb(p.target), rgbMode = p.mode !== "hex";
      let cur = rgbMode ? [128, 128, 128] : null;
      const wrap = el("div", "cl"); box.appendChild(wrap);
      const given = el("div", "cl-given");
      const code = el("b", "cl-code", rgbMode ? p.target.toUpperCase() : "");
      code.dataset.code = p.target.toUpperCase();
      if (!rgbMode) ["R", "G", "B"].forEach((ch, k) => { const c = el("span", "cl-chip cl-" + ch.toLowerCase()); c.append(el("small", "", ch), document.createTextNode(" " + target[k])); code.appendChild(c); });
      given.append(el("span", "small muted", rgbMode ? "Код кольору:" : "Складники кольору:"), code);
      const prev = el("div", "cl-prev"), sw = el("span", "cl-sw"), lab = el("span", "cl-lab");
      prev.append(sw, lab);
      const paint = () => {
        sw.style.background = cur ? rgb2hex(cur) : "transparent"; sw.classList.toggle("empty", !cur);
        lab.textContent = cur ? (rgbMode ? `Твій колір: ${rgb2hex(cur)}` : `Твій колір: R ${cur[0]}  G ${cur[1]}  B ${cur[2]}`) : "Тут з'явиться твій колір";
      };
      wrap.append(given);
      if (rgbMode) {
        const sl = el("div", "cl-sliders");
        ["R", "G", "B"].forEach((ch, k) => {
          const row = el("label", "cl-row cl-row-" + ch.toLowerCase()); const nm = el("b", "cl-ch cl-" + ch.toLowerCase(), ch);
          const r = el("input"); r.type = "range"; r.min = 0; r.max = 255; r.value = cur[k];
          const num = el("input"); num.type = "number"; num.min = 0; num.max = 255; num.value = cur[k]; num.inputMode = "numeric";
          const set = (v) => { if (locked(box)) return; v = Math.max(0, Math.min(255, +v || 0)); cur[k] = v; r.value = v; num.value = v; paint(); setReady(true); };
          r.oninput = () => set(r.value); num.oninput = () => set(num.value);
          row.append(nm, r, num); sl.appendChild(row);
        });
        wrap.append(sl);
      } else {
        const row = el("label", "cl-hexrow"); row.append(el("span", "", "Код HEX:"));
        const inp = el("input"); inp.type = "text"; inp.placeholder = "#RRGGBB"; inp.maxLength = 7; inp.autocomplete = "off"; inp.spellcheck = false; inp.setAttribute("autocapitalize", "characters");
        inp.oninput = () => { if (locked(box)) return; let v = inp.value.trim(); if (v && v[0] !== "#") v = "#" + v; cur = hex2rgb(v); paint(); setReady(!!cur); };
        row.appendChild(inp); wrap.append(row);
      }
      wrap.append(prev); paint();
      return { get: () => cur, text: () => (cur ? rgb2hex(cur) : "") , wrap };
    },
    judge(p, cur) { const t = hex2rgb(p.target); const tol = p.tol ?? 30; return !!cur && cur.every((v, k) => Math.abs(v - t[k]) <= tol); },
    reveal(box, p, api) {
      const t = hex2rgb(p.target), ok = sims.color.judge(p, api.get());
      const r = el("div", "cl-prev cl-target"); const sw = el("span", "cl-sw"); sw.style.background = rgb2hex(t);
      r.append(sw, el("span", "cl-lab", `Потрібний колір: ${rgb2hex(t)} = R ${t[0]}, G ${t[1]}, B ${t[2]}`));
      api.wrap.appendChild(r); api.wrap.classList.add(ok ? "right" : "wrong");
    },
    correctText: (p) => { const t = hex2rgb(p.target); return `${p.target.toUpperCase()} = R ${t[0]}, G ${t[1]}, B ${t[2]}`; }
  };

  /* ---------- Ключові кадри: міні-«Аніматор» ----------
     frames N, obj "⚽" (емодзі), start {x, y, s, rot, op}, goals [{f, x?, y?, s?, rot?, op?}] — сцена 300×200.
     Учень вибирає кадр на шкалі й змінює об'єкт → ключовий кадр ◆; між ключовими кадрами — лінійна інтерполяція.
     Зараховується, якщо на кожному кадрі з goals об'єкт (з урахуванням інтерполяції) у межах допуску. */
  const TW_TOL = { x: 15, y: 15, s: 8, rot: 10, op: 30 };
  const twAt = (keys, f) => {
    const ks = Object.keys(keys).map(Number).sort((a, b) => a - b);
    if (f <= ks[0]) return { ...keys[ks[0]] };
    if (f >= ks[ks.length - 1]) return { ...keys[ks[ks.length - 1]] };
    let i = 0; while (ks[i + 1] < f) i++;
    const a = ks[i], b = ks[i + 1], t = (f - a) / (b - a), r = {};
    for (const k in keys[a]) r[k] = keys[a][k] + (keys[b][k] - keys[a][k]) * t;
    return r;
  };
  const twOk = (p, keys, g) => { const v = twAt(keys, g.f); return Object.keys(TW_TOL).every((k) => g[k] === undefined || Math.abs(v[k] - g[k]) <= TW_TOL[k]); };
  sims.tween = {
    hint: "Вибери кадр на шкалі (там, де 🎯) і перетягни об'єкт у пунктирне коло. Розмір, кут чи щільність — повзунками. На кадрі з'явиться ключовий кадр ◆, проміжні кадри обчисляться самі. ▶ — переглянути.",
    render(box, p, setReady) {
      const start = { x: 40, y: 100, s: 40, rot: 0, op: 255, ...p.start };
      const keys = { 1: { ...start } };
      const props = ["s", "rot", "op"].filter((k) => p.goals.some((g) => g[k] !== undefined));
      let cur = 1, timer = null;
      const wrap = el("div", "tw"); box.appendChild(wrap);
      const svg = svgEl("svg", { viewBox: "0 0 300 200", class: "tw-stage", role: "img", "aria-label": "Робоче поле" });
      svg.appendChild(svgEl("rect", { x: 0, y: 0, width: 300, height: 200, class: "tw-bg" }));
      const ghosts = svgEl("g", {}), trail = svgEl("g", {}), obj = svgEl("g", { class: "tw-obj" });
      const glyph = svgEl("text", { x: 0, y: 0, "text-anchor": "middle", "dominant-baseline": "central" }); glyph.textContent = p.obj || "⚽";
      obj.append(svgEl("circle", { r: 26, class: "tw-hit" }), glyph);
      svg.append(ghosts, trail, obj);
      const sw = el("div", "scenewrap"); sw.appendChild(svg); wrap.appendChild(sw);
      const info = el("p", "small tw-info"); wrap.appendChild(info);
      const sliders = {};
      const NAMES = { s: ["Розмір", 10, 120], rot: ["Кут, °", -360, 360], op: ["Щільність", 0, 255] };
      props.forEach((k) => {
        const row = el("label", "cl-row tw-row"); const r = el("input"); r.type = "range"; r.min = NAMES[k][1]; r.max = NAMES[k][2];
        const n = el("input"); n.type = "number"; n.min = NAMES[k][1]; n.max = NAMES[k][2]; n.inputMode = "numeric";
        const set = (v) => { if (locked(box) || timer) return; setKey({ [k]: clamp(Math.round(+v || 0), NAMES[k][1], NAMES[k][2]) }); };
        r.oninput = () => set(r.value); n.onchange = () => set(n.value);
        row.append(el("b", "tw-n", NAMES[k][0]), r, n); wrap.appendChild(row); sliders[k] = [r, n];
      });
      const tl = el("div", "tw-cells"); wrap.appendChild(tl);
      const cells = [];
      for (let f = 1; f <= p.frames; f++) {
        const c = el("button", "tw-cell"); c.type = "button"; c.dataset.f = f;
        c.append(el("span", "k"), el("span", "", String(f)));
        c.onclick = () => { if (timer) return; cur = f; draw(); };
        tl.appendChild(c); cells.push(c);
      }
      const bar = el("div", "tw-bar");
      const playB = el("button", "btn ghost small-btn", "▶ Переглянути"); playB.type = "button";
      const delB = el("button", "link", "Прибрати ключовий кадр"); delB.type = "button";
      const resetB = el("button", "link", "↺ Почати спочатку"); resetB.type = "button";
      bar.append(playB, delB, resetB); wrap.appendChild(bar);
      function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
      function setKey(ch) { keys[cur] = { ...twAt(keys, cur), ...ch }; setReady(true); draw(); }
      function place(g, v) { g.setAttribute("transform", `translate(${v.x.toFixed(1)} ${v.y.toFixed(1)}) rotate(${v.rot.toFixed(1)})`); g.setAttribute("opacity", (v.op / 255).toFixed(2)); g.lastChild.setAttribute("font-size", v.s.toFixed(1)); }
      function draw(showAll) {
        const v = twAt(keys, cur);
        place(obj, v);
        ghosts.replaceChildren();
        p.goals.filter((g) => showAll || g.f === cur).forEach((g) => {
          const gv = { ...twAt(keys, g.f), ...g };
          const gg = svgEl("g", { class: "tw-ghost" + (showAll ? (twOk(p, keys, g) ? " right" : " wrong") : "") });
          const t = svgEl("text", { "text-anchor": "middle", "dominant-baseline": "central" }); t.textContent = p.obj || "⚽";
          gg.append(svgEl("circle", { r: Math.max(16, gv.s * 0.62), class: "tw-ring" }), t);
          place(gg, { ...gv, op: 255 }); gg.setAttribute("opacity", showAll ? "0.9" : "0.45");
          if (showAll) { const lab = svgEl("text", { y: -Math.max(16, gv.s * 0.62) - 6, "text-anchor": "middle", class: "tw-lab" }); lab.textContent = "кадр " + g.f; gg.appendChild(lab); }
          ghosts.appendChild(gg);
        });
        trail.replaceChildren();   // слід руху: положення на всіх кадрах
        for (let f = 1; f <= p.frames; f++) { const q = twAt(keys, f); trail.appendChild(svgEl("circle", { cx: q.x, cy: q.y, r: keys[f] ? 3.5 : 2, class: "tw-dot" + (keys[f] ? " key" : "") })); }
        cells.forEach((c, i) => {
          const f = i + 1, goal = p.goals.some((g) => g.f === f);
          c.classList.toggle("cur", f === cur); c.classList.toggle("goal", goal);
          c.firstChild.textContent = keys[f] ? "◆" : goal ? "🎯" : "";
        });
        props.forEach((k) => { const [r, n] = sliders[k]; r.value = Math.round(v[k]); if (document.activeElement !== n) n.value = Math.round(v[k]); });
        delB.hidden = !keys[cur] || Object.keys(keys).length < 2;
        const goal = p.goals.find((g) => g.f === cur);
        info.textContent = `Кадр ${cur} з ${p.frames}` + (keys[cur] ? " — ключовий ◆" : " — проміжний (обчислено автоматично)") + (goal ? ". 🎯 Тут об'єкт має бути в пунктирному колі." : "");
      }
      // перетягування з «прилипанням» до цілі цього кадру
      let drag = null;
      const toSvg = (e) => { const m = svg.getScreenCTM().inverse(); const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return { x: clamp(q.x, 5, 295), y: clamp(q.y, 5, 195) }; };
      obj.addEventListener("pointerdown", (e) => { if (locked(box) || timer) return; const q = toSvg(e), v = twAt(keys, cur); drag = { dx: v.x - q.x, dy: v.y - q.y }; obj.setPointerCapture(e.pointerId); obj.classList.add("on"); e.preventDefault(); });
      obj.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const q = toSvg(e); let x = q.x + drag.dx, y = q.y + drag.dy;
        const g = p.goals.find((g) => g.f === cur && g.x !== undefined);
        if (g && Math.hypot(x - g.x, y - g.y) < 12) { x = g.x; y = g.y; }
        setKey({ x: Math.round(x), y: Math.round(y) });
      });
      const end = () => { drag = null; obj.classList.remove("on"); };
      obj.addEventListener("pointerup", end); obj.addEventListener("pointercancel", end);
      playB.onclick = () => {
        if (timer) { clearInterval(timer); timer = null; playB.textContent = "▶ Переглянути"; draw(); return; }
        cur = 1; draw(); playB.textContent = "⏸ Зупинити";
        timer = setInterval(() => { if (cur >= p.frames) { clearInterval(timer); timer = null; playB.textContent = "▶ Переглянути"; draw(); return; } cur++; draw(); }, 1000 / 6);
      };
      delB.onclick = () => { if (locked(box) || timer) return; delete keys[cur]; draw(); };
      resetB.onclick = () => { if (locked(box) || timer) return; Object.keys(keys).forEach((k) => delete keys[k]); keys[1] = { ...start }; cur = 1; draw(); };
      draw();
      return { get: () => keys, text: () => "ключові кадри: " + Object.keys(keys).sort((a, b) => a - b).join(", "), reveal: () => { if (timer) playB.click(); draw(true); }, stop: () => { if (timer) playB.click(); } };
    },
    judge: (p, keys) => p.goals.every((g) => twOk(p, keys, g)),
    reveal(box, p, api) { api.reveal(); box.querySelector(".tw").classList.add(sims.tween.judge(p, api.get()) ? "right" : "wrong"); },
    correctText: (p) => p.goals.map((g) => `кадр ${g.f}: ` + ["x", "y", "s", "rot", "op"].filter((k) => g[k] !== undefined).map((k) => ({ x: "X", y: "Y", s: "розмір", rot: "кут", op: "щільність" }[k]) + " " + g[k]).join(", ")).join("; ")
  };

  /* ---------- Вузли: зміни форму фігури ---------- */
  sims.nodes = {
    hint: "Перетягни вузли (кружечки) на кути пунктирної фігури. На телефоні — пальцем.",
    render(box, p, setReady) {
      const pts = p.from.map(([x, y]) => ({ x, y }));
      const svg = svgEl("svg", { viewBox: "0 0 300 300", class: "nodes", role: "img", "aria-label": "Полотно з фігурою й вузлами" });
      for (let i = 30; i < 300; i += 30) { svg.appendChild(svgEl("line", { x1: i, y1: 0, x2: i, y2: 300, class: "nd-grid" })); svg.appendChild(svgEl("line", { x1: 0, y1: i, x2: 300, y2: i, class: "nd-grid" })); }
      svg.appendChild(svgEl("polygon", { points: p.to.map((q) => q.join(",")).join(" "), class: "nd-target" }));
      const poly = svgEl("polygon", { class: "nd-shape" }); svg.appendChild(poly);
      const handles = pts.map((pt) => { const g = svgEl("g", { class: "nd-node" }); g.append(svgEl("circle", { r: 22, class: "nd-hit" }), svgEl("circle", { r: 9, class: "nd-dot" })); svg.appendChild(g); return g; });
      const draw = () => { poly.setAttribute("points", pts.map((q) => `${q.x},${q.y}`).join(" ")); handles.forEach((h, i) => h.setAttribute("transform", `translate(${pts[i].x},${pts[i].y})`)); };
      let drag = -1;
      const toSvg = (e) => { const m = svg.getScreenCTM().inverse(); const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return { x: Math.max(10, Math.min(290, q.x)), y: Math.max(10, Math.min(290, q.y)) }; };
      handles.forEach((h, i) => h.addEventListener("pointerdown", (e) => { if (locked(box)) return; drag = i; h.setPointerCapture(e.pointerId); h.classList.add("on"); e.preventDefault(); }));
      svg.addEventListener("pointermove", (e) => { if (drag < 0) return; Object.assign(pts[drag], toSvg(e)); draw(); });
      const end = () => { if (drag >= 0) handles[drag].classList.remove("on"); drag = -1; };
      svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
      const reset = el("button", "link", "↺ Почати спочатку"); reset.type = "button";
      reset.onclick = () => { if (locked(box)) return; p.from.forEach(([x, y], i) => Object.assign(pts[i], { x, y })); draw(); };
      const wrap = el("div", "scenewrap"); wrap.appendChild(svg); box.append(wrap, reset); draw(); setReady(true);
      return { get: () => pts.map((q) => [q.x, q.y]), text: () => "фігуру змінено" };
    },
    judge(p, got) {   // кожному куту цілі — свій вузол поруч (до 20 одиниць)
      const used = new Set();
      return p.to.every(([tx, ty]) => { let best = -1, bd = 1e9; got.forEach(([x, y], i) => { const d = Math.hypot(x - tx, y - ty); if (!used.has(i) && d < bd) { bd = d; best = i; } }); if (bd > 20) return false; used.add(best); return true; });
    },
    reveal(box, p, api) { const ok = sims.nodes.judge(p, api.get()); box.querySelector(".nd-shape").classList.add(ok ? "right" : "wrong"); },
    correctText: () => "вузли мають збігтися з кутами пунктирної фігури"
  };

  const sim = {
    parse: (v) => ({ ...v, type: "sim", x: v.x || "", hint: v.hint || (sims[v.sim] && (typeof sims[v.sim].hint === "function" ? sims[v.sim].hint(v) : sims[v.sim].hint)) || "" }),
    render: (box, p, setReady) => sims[p.sim].render(box, p, setReady),
    judge: (p, ans) => sims[p.sim].judge(p, ans),
    reveal: (box, p, api) => sims[p.sim].reveal(box, p, api),
    correctText: (p) => sims[p.sim].correctText(p),
    button: "Перевірити"
  };

  window.TASKS = { sort, order, keys, spot, sim, SCENES, normCombo };
})();
