/* =====================================================================
   Конспект-гра: ядро уроку. Сторінка quest.html?q=<id файлу в quests/>.

   Ядро веде урок: розмова з персонажами крок за кроком, картки «✍️ Запиши» (учень пише в
   паперовий зошит), перевірки зі схованим текстом, бали, зошит, результат, опитування бети,
   таблиця лідерів класу. Світ-гра (assets/worlds/<world>.js) лише малює карту, рухає героя й
   вирішує, коли учень «підійшов» до персонажа. Світ може додати свої перевірки-міні-ігри.

   Формат файлу quests/<id>.js:
   QUEST.add({
     id, grade, lesson, title, intro, world: "studio|arena|runner|blocky|range", theme?: {…для світу},
     stations: [{
       topic, optional?: ⭐ (після всіх основних, можна пропустити), final?: останній персонаж,
       npc: { name, look: "#колір", hat?, glasses? },  …плюс поля, потрібні світу (room/at для studio)
       steps: [ — кроки розмови, по одному на екран:
         { t: "say", text: "**жирне** можна", table?: [[заголовки], [рядок]…], write?: true }
         { t: "write", term?, def?, rule?, sec? }  — «✍️ Запиши»; кнопка оживає через sec (або за довжиною)
         { t: "demo", kind, text }                — жива демонстрація; «Далі» — коли спробував
         { t: "gate" }                            — у фіналі: запропонувати ⭐, якщо не пройдено
         { t: "check", type, … }                  — 1 бал, текст сховано, учень користується зошитом:
           cloze  { text: "… [[слово|варіант]] …" } · choice { v: [["питання", ["правильна", …], "пояснення"]] }
           calc   { gen: (R) => ({ q, ans, unit, x }) } · order { v: [{ q, items, x }] }
           sort   { v: [{ q, groups: [назви], items: [["текст", № групи]], x }] }
           spot / markers / form — вікно «Аніматора» (7 клас)
           <будь-що інше> — міні-гра світу: діалог ховається, світ грає й повертає done(ok, пояснення)
       ]
     }]
   });
   Оцінка = бали / перевірки · 12. Результати — у ту саму таблицю, що й тести; лідери — action "board".
   ===================================================================== */
(function () {
  "use strict";
  const CFG = window.CONFIG || {};
  const LIST = [];
  window.QUEST = { add: (q) => LIST.push(q) };
  window.QWORLDS = window.QWORLDS || {};

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* сховище недоступне */ } }
  };
  const R = {
    int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    pick: (a) => a[Math.floor(Math.random() * a.length)],
    shuffle: (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  };
  const normName = (s) => String(s || "").toLowerCase().replace(/[’ʼ`']/g, "'").replace(/\s+/g, " ").trim();
  const personKey = (s) => normName(s).split(" ").filter(Boolean).sort().join(" ");
  const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  // у таблиці лідерів — «Софія К.» (ім'я + перша літера прізвища): учні вводять «Прізвище Ім'я»
  const shortName = (s) => { const w = String(s || "").trim().split(/\s+/); return w.length < 2 ? w[0] || "" : `${w[1]} ${w[0][0]}.`; };

  let toastT = 0;
  function toast(t, ms = 2600) { const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { e.hidden = true; }, ms); }
  function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.append(s); }); }
  const VER = "202610202148"; // мітка для світів і quests/*.js — міняти разом із bump_version.py

  /* ================================================================ УРОК */
  function run(Q, W) {
    document.title = Q.title;
    document.body.dataset.world = Q.world;
    const KEY = `qs:${Q.id}`;
    const stations = Q.stations.map((s, i) => ({ ...s, i }));
    const N = stations.length;
    const CHECKS = [];
    stations.forEach((s) => s.steps.forEach((p, k) => { if (p.t === "check") CHECKS.push(`${s.i}:${k}`); }));

    /* -------- стан */
    let st = null; // { cls, name, start, done: {i: 1}, checks: {"i:k": 0|1}, notes: [...], viol, coins, world: {...} }
    const saveSt = () => { if (st) store.set(KEY + ":run", st); };
    let paused = true, openSt = null, nearSt = null;
    const isDone = (s) => !!(st && st.done[s.i]);
    const basics = stations.filter((s) => !s.optional && !s.final);
    const available = (s) => !st ? false : (s.optional || s.final) ? basics.every(isDone) : basics.filter((b) => b.i < s.i).every(isDone);
    const score = () => CHECKS.reduce((a, k) => a + (st.checks[k] || 0), 0);
    const nextStation = () => !st ? null : stations.find((s) => !isDone(s) && available(s) && !s.final) || stations.find((s) => !isDone(s) && available(s)) || null;

    /* -------- API для світу */
    const core = {
      Q, stations, R, el, esc, clamp, toast, store,
      get paused() { return paused; },
      get st() { return st; },
      isDone, available, next: nextStation,
      open: (s) => openStation(s),
      near(s) { // світ повідомляє, біля кого стоїть герой
        if (s === nearSt) return; nearSt = s;
        const b = $("#talk");
        if (s && !paused) { b.hidden = false; b.innerHTML = `💬 ${esc(s.npc.name)} <kbd>E</kbd>`; } else b.hidden = true;
      },
      lockedToast(s) {
        const nx = nextStation();
        toast(`${s.optional || s.final ? "Сюди — після всіх основних станцій." : "Не поспішай — усе по черзі."} Зараз: ${nx ? nx.npc.name + (nx.place ? " (" + nx.place + ")" : "") : ""}`, 3500);
      },
      addCoins(n) { if (!st) return; st.coins = (st.coins || 0) + n; $("#coins").textContent = st.coins; $("#coinBox").classList.remove("bump"); void $("#coinBox").offsetWidth; $("#coinBox").classList.add("bump"); },
      save: saveSt
    };
    const world = W.init(core, $("#stage")) || {};

    /* -------- старт */
    $("#qTitle").textContent = Q.title;
    $("#sTitle").textContent = Q.title;
    $("#sIntro").textContent = Q.intro;
    $("#sEyebrow").textContent = `${Q.grade} клас · урок ${Q.lesson} · 🕹️ конспект-гра · бета`;
    $("#backLink").href = `index.html?l=${Q.grade}-${String(Q.lesson).padStart(2, "0")}`;
    if (W.keys) $("#keysHint").textContent = W.keys;
    if (W.howto) $("#sHow").innerHTML = W.howto.map((t) => `<li>${t}</li>`).join("") + $("#sHow").innerHTML;

    const clsSel = $("#cls"), nameIn = $("#name"), goBtn = $("#go");
    const classes = (CFG.CLASSES || []).filter((c) => c.startsWith(String(Q.grade)));
    clsSel.innerHTML = `<option value="">— клас —</option>` + classes.map((c) => `<option>${esc(c)}</option>`).join("");
    const last = store.get("qz:me", null);
    if (last) { if (classes.includes(last.cls)) clsSel.value = last.cls; nameIn.value = last.name || ""; }
    const ready = () => { goBtn.disabled = !(clsSel.value && nameIn.value.trim().split(/\s+/).length >= 2); };
    clsSel.onchange = () => { ready(); showBoard($("#sBoard"), clsSel.value, 5); };
    nameIn.oninput = ready; ready();
    if (clsSel.value) showBoard($("#sBoard"), clsSel.value, 5);

    const saved = store.get(KEY + ":run", null);
    if (saved && !saved.finished && saved.done && Object.keys(saved.done).length) {
      $("#resume").hidden = false;
      $("#resume").innerHTML = `Є незавершена гра: <b>${esc(saved.name)}</b>, пройдено ${Object.keys(saved.done).length} з ${N}. Натисни «Почати» з тим самим іменем — продовжиш з того місця. Час теж іде далі.`;
    }

    goBtn.onclick = () => {
      const cls = clsSel.value, name = nameIn.value.trim().replace(/\s+/g, " ");
      store.set("qz:me", { cls, name });
      const prev = store.get(KEY + ":run", null);
      if (prev && !prev.finished && prev.checks && prev.cls === cls && personKey(prev.name) === personKey(name)) st = prev;
      else st = { cls, name, start: Date.now(), done: {}, checks: {}, notes: [], viol: 0, coins: 0, world: {} };
      $("#start").hidden = true; $("#hud").hidden = false; paused = false;
      renderHud(); saveSt();
      world.start && world.start(st.world);
      toast(W.startHint || "Іди до того, у кого над головою «!»", 5000);
    };

    /* -------- HUD */
    function renderHud() {
      const done = stations.filter(isDone).length;
      $("#qProg").textContent = `Пройдено ${done} з ${N}`;
      $("#qBar i").style.width = (done / N * 100) + "%";
      const list = $("#qList"); list.innerHTML = "";
      stations.forEach((s) => {
        const li = el("li", isDone(s) ? "ok" : available(s) ? "" : "lock");
        li.innerHTML = `<span class="box"></span><span><b>${esc(s.topic || s.npc.name)}</b><small>${esc(s.npc.name)}${s.place ? " · " + esc(s.place) : ""}${s.optional ? " · ⭐ на 12" : ""}</small></span>`;
        li.onclick = () => { $("#hud").classList.remove("open"); if (!available(s)) core.lockedToast(s); else world.goTo && world.goTo(s); };
        list.appendChild(li);
      });
      $("#bookN").textContent = st.notes.length;
      $("#coins").textContent = st.coins || 0;
      const nx = nextStation();
      $("#qNext").innerHTML = nx ? `${nx.optional ? "⭐ " : ""}Далі: <b>${esc(nx.npc.name)}</b>${nx.place ? " · " + esc(nx.place) : ""}` : "Урок пройдено!";
      world.refresh && world.refresh();
    }
    core.renderHud = renderHud;
    $("#listToggle").onclick = () => $("#hud").classList.toggle("open");
    $("#qNext").onclick = () => { const nx = nextStation(); if (nx && world.goTo && !paused) world.goTo(nx, true); };
    $("#talk").onclick = () => { if (nearSt) openStation(nearSt); };
    addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select")) return;
      if ((e.code === "KeyE" || e.code === "Enter") && !paused && nearSt) { e.preventDefault(); openStation(nearSt); }
      if (e.code === "KeyN" && !paused && st) openBook();
      if (e.code === "Escape") closeBook();
    });
    // секундомір: час іде лише між стартом і фіналом (для таблиці лідерів)
    setInterval(() => { if (st && !st.finished) $("#timer").textContent = fmtTime((Date.now() - st.start) / 1000); }, 500);

    /* -------- вихід із вкладки */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && st && !st.finished && $("#start").hidden) { st.viol++; saveSt(); toast("Виходити з гри не можна — це фіксується.", 3500); }
    });

    /* ============================================================ РОЗМОВА: КРОКИ СТАНЦІЇ */
    const dlg = $("#dlg"), dBody = $("#dBody");
    function setPaused(p) { paused = p; world.pause && world.pause(p); if (p) $("#talk").hidden = true; else { const s = nearSt; nearSt = null; core.near(s); } }
    function openStation(s) {
      if (openSt || !st) return;
      if (!available(s)) { core.lockedToast(s); return; }
      openSt = s; setPaused(true); $("#toast").hidden = true;
      $("#dWho").textContent = s.npc.name; $("#dWhere").textContent = (s.topic || "") + (s.place ? " · " + s.place : "");
      $("#dAva").style.background = s.npc.look; $("#dAva").textContent = s.npc.name.split(" ").pop()[0];
      dlg.hidden = false;
      if (isDone(s)) {
        dBody.innerHTML = ""; $("#dStep").textContent = "";
        dBody.append(el("p", "say", "Ми вже поговорили! Можу розповісти ще раз — перевірки при цьому вже не рахуються."));
        footer([["Розкажи ще раз", "", () => step(s, 0)], ["Добре", "pri", closeDlg]]);
      } else step(s, 0);
    }
    function closeDlg() {
      dlg.hidden = true; openSt = null; setPaused(false);
      const fin = stations.find((x) => x.final);
      if (fin && isDone(fin) && !st.finished) finishAll();
    }
    function footer(btns) {
      const f = $("#dFoot"); f.innerHTML = "";
      for (const [t, cls, fn, dis] of btns) { const b = el("button", "btn " + (cls || ""), t); b.onclick = fn; if (dis) b.disabled = true; f.append(b); }
      return [...f.children];
    }
    function step(s, k) {
      dBody.innerHTML = ""; dlg.scrollTop = 0;
      const steps = s.steps;
      if (k >= steps.length) {
        const was = isDone(s); st.done[s.i] = 1;
        if (!was) core.addCoins(s.optional ? 15 : 10);
        saveSt(); renderHud(); closeDlg();
        if (!was) { toast(s.final ? "Урок пройдено!" : `✓ ${s.topic || s.npc.name} — пройдено`, 2500); world.celebrate && world.celebrate(s); }
        return;
      }
      $("#dStep").textContent = `${k + 1} / ${steps.length}`;
      const p = steps[k], next = () => step(s, k + 1);
      STEP[p.t](s, p, `${s.i}:${k}`, next);
    }
    const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
    const qp = (t) => el("p", "q", rich(t));
    function table(rows) {
      const t = el("table", "tbl");
      rows.forEach((r, i) => { const tr = el("tr"); r.forEach((c) => tr.append(el(i ? "td" : "th", "", esc(c)))); t.append(tr); });
      return t;
    }
    const noteLabel = (p, s) => p.term ? p.term : p.table ? `${s.topic} — таблиця` : (p.rule || "").split("\n")[0].slice(0, 60);
    function addNote(s, p, k) {
      if (!st.notes.some((n) => n.id === k)) { st.notes.push({ id: k, label: noteLabel(p, s) }); saveSt(); renderHud(); }
      $("#bookBtn").classList.add("pulse"); setTimeout(() => $("#bookBtn").classList.remove("pulse"), 1600);
    }
    // кнопка «Я записав(ла)» оживає через стільки секунд, скільки треба, щоб записати
    function writeButton(s, p, k, text, next) {
      const sec = p.sec || clamp(Math.round(text.length / 6), 8, 25);
      const [b] = footer([[`✍️ Я записав(ла) · ${sec}`, "pri", () => { addNote(s, p, k); next(); }, true]]);
      if (isDone(s)) { b.disabled = false; b.textContent = "Далі →"; return; }
      let left = sec;
      const tm = setInterval(() => { left--; if (!document.body.contains(b)) return clearInterval(tm); if (left <= 0) { clearInterval(tm); b.disabled = false; b.textContent = "✍️ Я записав(ла)"; } else b.textContent = `✍️ Я записав(ла) · ${left}`; }, 1000);
    }
    function showResult(ok, x, next) {
      const fb = el("div", "fb " + (ok ? "ok" : "bad"), (ok ? "✅ Правильно!" : "❌ Не зовсім.") + (x ? ` <span>${x}</span>` : ""));
      dBody.append(fb); footer([["Далі →", "pri", next]]);
      fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    const STEP = {
      say(s, p, k, next) {
        dBody.append(el("p", "say", rich(p.text)));
        if (p.table) dBody.append(p.write ? noteBox(table(p.table), "✍️ Перепиши таблицю в зошит") : table(p.table));
        if (p.write) writeButton(s, p, k, p.table.flat().join(" "), next);
        else footer([["Далі →", "pri", next]]);
      },
      write(s, p, k, next) {
        dBody.append(el("p", "hint", "📒 Відкрий паперовий зошит і запиши. Пізніше тебе спитають — і текст уже не показуватимуть."));
        dBody.append(noteCard(p));
        writeButton(s, p, k, (p.term || "") + (p.def || "") + (p.rule || ""), next);
      },
      demo(s, p, k, next) {
        if (p.text) dBody.append(el("p", "say", rich(p.text)));
        const [b] = footer([["Далі →", "pri", next, true]]);
        const D = DEMO[p.kind] || (world.demos && world.demos[p.kind]);
        D(dBody, () => { b.disabled = false; }, p);
        if (isDone(s)) b.disabled = false;
      },
      check(s, p, k, next) {
        if (k in st.checks) {
          dBody.append(el("p", "say", "Цю перевірку ти вже пройшов(ла) — вона зарахована."));
          footer([["Далі →", "pri", next]]); return;
        }
        const record = (ok) => { if (!isDone(s)) { st.checks[k] = ok ? 1 : 0; if (ok) core.addCoins(5); saveSt(); } };
        if (TASK[p.type]) {
          dBody.append(el("div", "chk", "🔎 Перевірка — текст сховано, користуйся своїм зошитом"));
          TASK[p.type]({ task: p, sname: st.name }, dBody, (ok, x) => { record(ok); showResult(ok, x, next); });
          return;
        }
        // міні-гра світу: діалог ховається, світ грає, потім повертаємось із результатом
        dBody.append(el("div", "chk", "🎮 Перевірка-гра"), el("p", "say", rich(p.intro || "Готовий(а)? Поїхали!")));
        let launched = false;
        footer([["▶ Грати", "pri", () => {
          if (launched) return; launched = true; // подвійне натискання не запускає дві гри
          dlg.hidden = true; document.body.classList.add("ingame");
          world.challenge(p, R, (ok, x, extra) => {
            document.body.classList.remove("ingame");
            record(ok); dlg.hidden = false; dBody.innerHTML = "";
            if (extra) dBody.append(el("p", "say", rich(extra)));
            showResult(ok, x, next);
          });
        }]]);
      },
      gate(s, p, k, next) {
        const left = stations.filter((x) => x.optional && !isDone(x));
        if (!left.length) return next();
        dBody.append(el("p", "say", rich(`Можна складати фінальну перевірку вже зараз — це до **9 балів**. А хто хоче **12** — спершу ⭐ ${left.length === 1 ? "станція" : "станції"}: ${left.map((x) => x.npc.name).join(", ")}. Після перевірки повернутися вже не вийде.`)));
        footer([["⭐ Спершу ⭐-станції", "", closeDlg], ["Складати зараз", "pri", next]]);
      }
    };
    function noteBox(inner, tag) { const c = el("div", "note"); c.append(el("div", "tag", tag), inner); return c; }
    function noteCard(n) {
      const c = el("div", "note" + (n.term && n.term.startsWith("⭐") ? " star" : ""));
      c.innerHTML = `<div class="tag">✍️ Запиши в зошит</div>` + (n.term ? `<p><b>${esc(n.term.replace("⭐ ", ""))}</b> — ${esc(n.def)}</p>` : "") + (n.rule ? `<p class="rule">${rich(n.rule)}</p>` : "");
      if (n.table) c.append(table(n.table));
      return c;
    }

    /* ---------------- демонстрації: (контейнер, ready) — ready() відкриває «Далі» */
    const NS = "http://www.w3.org/2000/svg";
    const DEMO = {
      fps(box, ready) {
        const c = el("canvas", "demo"); c.width = 520; c.height = 220; box.append(c);
        const row = el("div", "seg"); box.append(row);
        const lab = el("p", "hint", ""); box.append(lab);
        const g = c.getContext("2d"); let fps = 2, tried = new Set([2]), fr = 0, acc = 0, last = performance.now();
        [2, 4, 8, 12, 24].forEach((v) => { const b = el("button", "sb" + (v === fps ? " sel" : ""), `${v} кадр/с`); b.onclick = () => { fps = v; tried.add(v); row.querySelectorAll(".sb").forEach((x) => x.classList.toggle("sel", x === b)); if (tried.size >= 3) ready(); }; row.append(b); });
        const N = 24; // кадрів у циклі
        (function loop(now) {
          if (!document.body.contains(c)) return;
          acc += (now - last) / 1000; last = now;
          if (acc >= 1 / fps) { acc %= 1 / fps; fr = (fr + 1) % N; }
          const t = fr / N, x = 40 + t * 440, y = 180 - Math.abs(Math.sin(t * Math.PI * 3)) * 130;
          g.fillStyle = "#f8fafc"; g.fillRect(0, 0, 520, 220); g.fillStyle = "#94a3b8"; g.fillRect(20, 196, 480, 3);
          g.beginPath(); g.arc(x, y, 16, 0, 7); g.fillStyle = "#f97316"; g.fill();
          g.font = "600 14px Rubik, sans-serif"; g.fillStyle = "#475569"; g.textAlign = "left"; g.fillText(`кадр ${fr + 1} з ${N} · ${fps} кадр/с`, 16, 24);
          lab.textContent = tried.size >= 3 ? "Порівняй: 2 кадр/с — ривками, 24 кадр/с — плавно." : `Спробуй ще ${3 - tried.size} ${3 - tried.size === 1 ? "варіант" : "варіанти"}.`;
          requestAnimationFrame(loop);
        })(last);
      },
      flip(box, ready) {
        const c = el("canvas", "demo"); c.width = 520; c.height = 240; box.append(c);
        const ctl = el("div", "flipctl"), rng = el("input"); rng.type = "range"; rng.min = 0; rng.max = 7; rng.value = 0; rng.setAttribute("aria-label", "Сторінка флікбука");
        const play = el("button", "btn", "▶ Гортати"); ctl.append(rng, play); box.append(ctl);
        const g = c.getContext("2d"), seen = new Set();
        const ys = [190, 140, 100, 75, 70, 85, 120, 175];
        const draw = () => {
          const k = +rng.value; seen.add(k);
          g.fillStyle = "#fffbeb"; g.fillRect(0, 0, 520, 240); g.strokeStyle = "#e7d9b0"; for (let y = 30; y < 240; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(520, y); g.stroke(); }
          if (k > 0) { g.globalAlpha = 0.18; g.beginPath(); g.arc(150 + (k - 1) * 30, ys[k - 1], 18, 0, 7); g.fillStyle = "#f97316"; g.fill(); g.globalAlpha = 1; }
          g.beginPath(); g.arc(150 + k * 30, ys[k], 18, 0, 7); g.fillStyle = "#f97316"; g.fill(); g.strokeStyle = "#9a3412"; g.lineWidth = 2; g.stroke();
          g.fillStyle = "#57534e"; g.fillRect(40, 210, 440, 4);
          g.font = "600 15px Rubik, sans-serif"; g.fillStyle = "#78350f"; g.textAlign = "left"; g.fillText(`Сторінка ${k + 1} з 8 — фаза ${k + 1}`, 14, 22);
          if (seen.size === 8) ready();
        };
        rng.oninput = draw; draw();
        let tm = 0; play.onclick = () => { clearInterval(tm); let k = 0; tm = setInterval(() => { if (!document.body.contains(c)) return clearInterval(tm); rng.value = k; draw(); if (++k > 7) clearInterval(tm); }, 120); };
      },
      tour(box, ready) {
        const info = el("div", "say", "👆 Клацни будь-яку частину вікна.");
        const win = animWindow((id, z) => {
          z.classList.add("seen"); seen.add(id);
          info.innerHTML = `<b>${esc(ZONES[id][0])}</b> — ${esc(ZONES[id][1])}<br><small class="muted">Переглянуто ${seen.size} з 8</small>`;
          if (seen.size === 8) ready();
        });
        const seen = new Set(); box.append(win, info);
      },
      spin(box, ready) {
        const c = el("canvas", "spin"); c.width = 440; c.height = 300; box.append(c);
        const meter = el("div", "meter", "<i></i>"); box.append(meter);
        const hold = el("button", "btn hold", "🌀 Крутити (тримай)"); box.append(hold);
        const g = c.getContext("2d"); let ang = 0, w = 0, held = false, good = 0, fired = false;
        const on = (e) => { e.preventDefault(); held = true; }, off = () => { held = false; };
        hold.addEventListener("pointerdown", on); addEventListener("pointerup", off); hold.addEventListener("pointerleave", off);
        const kd = (e) => { if (e.code === "Space") { e.preventDefault(); held = true; } }, ku = (e) => { if (e.code === "Space") held = false; };
        addEventListener("keydown", kd); addEventListener("keyup", ku);
        const side = (bird, a) => { g.globalAlpha = a; if (bird) { g.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🐦", 0, 4); } else { g.strokeStyle = "#334155"; g.lineWidth = 5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 18, -50); g.lineTo(k * 18, 55); g.stroke(); } g.beginPath(); g.arc(0, -50, 38, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(-42, 55); g.lineTo(42, 55); g.stroke(); } g.globalAlpha = 1; };
        let last = performance.now();
        (function loop(now) {
          if (!document.body.contains(c)) { removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("pointerup", off); return; }
          const dt = Math.min(0.05, (now - last) / 1000); last = now;
          w = held ? Math.min(60, w + dt * 30) : Math.max(0, w - dt * 18); ang += w * dt;
          g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 440, 300);
          g.strokeStyle = "#a8a29e"; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 150); g.lineTo(150, 150); g.moveTo(290, 150); g.lineTo(430, 150); g.stroke();
          g.translate(220, 150); const sx = Math.cos(ang), fast = clamp((w - 22) / 20, 0, 1);
          g.scale(fast > 0 ? 1 : Math.max(0.05, Math.abs(sx)), 1);
          g.beginPath(); g.arc(0, 0, 100, 0, 7); g.fillStyle = "#fffbeb"; g.fill(); g.strokeStyle = "#a16207"; g.lineWidth = 4; g.stroke();
          if (fast > 0) { side(true, 0.5 + fast * 0.5); side(false, 0.5 + fast * 0.5); } else side(sx > 0, 1);
          meter.firstChild.style.width = (w / 60 * 100) + "%";
          if (fast >= 1) good += dt; if (good > 1 && !fired) { fired = true; ready(); toast("Пташка в клітці! 🐦"); }
          requestAnimationFrame(loop);
        })(last);
      },
      markers(box, ready) {
        const used = new Set(), lab = el("p", "hint", "Спробовано: —");
        markerSim(box, null, (kind) => { used.add(kind); lab.textContent = "Спробовано: " + [...used].map((x) => ({ move: "центральний (переміщення)", size: "кутовий (розмір)", rotate: "верхній круглий (поворот)" }[x])).join(", ") + (used.size === 3 ? " — усі три!" : ""); if (used.size === 3) ready(); });
        box.append(lab);
      }
    };

    /* ---------------- вікно «Аніматора» (екскурсія й spot) */
    const ZONES = {
      top: ["Верхня панель", "назва проєкту, кнопки «Новий проєкт», «Зберегти», «Мої проєкти»"],
      tools: ["Панель інструментів (ліворуч)", "Вибір об'єкта, Прямокутник, Еліпс, Трикутник, Лінія, Текст, Малюнок, Заповнення, Видалити"],
      stage: ["Робоче поле (у центрі)", "сцена, на якій малюють і рухають об'єкти"],
      palette: ["Колірна палітра (праворуч)", "кольори штриха й заповнення, код кольору, повзунки R, G, B і Щільність"],
      params: ["Панель параметрів (під палітрою)", "X, Y, ширина, висота, кут, зсув вибраного об'єкта; ефекти"],
      layers: ["Шари", "«Статичне тло», «Динамічне тло», «Анімація», «Передній план»"],
      timeline: ["Шкала кадрів (унизу)", "номери кадрів, поточний кадр, кількість кадрів; ключові кадри позначено ◆"],
      play: ["Програвач", "кнопки «Відтворити / Пауза», «Зациклити», частота кадрів"]
    };
    function animWindow(onClick) {
      const win = el("div", "anim"); win.innerHTML = `<div class="ttl"><i></i><i></i><i></i> Аніматор Ліцею</div>`;
      const subs = { top: "📄 Новий проєкт · 💾 Зберегти · 📂 Мої проєкти", tools: "↖ ▭ ◯ △ ╱ T 🙂 🪣 🗑", params: "X · Y · ширина · кут", layers: "тло · анімація", play: "▶ ⟳ 24" };
      for (const id of Object.keys(ZONES)) {
        const z = el("button", "z z-" + id); z.setAttribute("aria-label", ZONES[id][0]);
        if (id === "stage") z.innerHTML = `<span class="ball"></span><span class="sq"></span>`;
        else if (id === "palette") z.innerHTML = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#111"].map((c) => `<span class="sw" style="background:${c}"></span>`).join("");
        else if (id === "timeline") z.innerHTML = Array.from({ length: 12 }, (_, k) => `<span class="fr${k === 3 ? " cur" : ""}">${k + 1}</span>`).join("");
        else z.innerHTML = `<span class="zs">${esc(subs[id])}</span>`;
        z.onclick = () => onClick(id, z, win);
        win.append(z);
      }
      return win;
    }

    /* ---------------- маркери: goal = move|size|rotate|null (вільна гра); onUse(kind) */
    function markerSim(box, goal, onUse) {
      const VW = 340, VH = 220;
      const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`); svg.classList.add("mk");
      const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
      const b0 = { x: 110, y: 115, s: 70, a: 0 }, b = { ...b0 }, tgt = { x: 230, y: 70, w: 92, h: 92 };
      mk("rect", { x: 0, y: 0, width: VW, height: VH, fill: "#bae6fd" });
      if (goal === "move") mk("rect", { x: tgt.x, y: tgt.y, width: tgt.w, height: tgt.h, fill: "rgba(34,197,94,.15)", stroke: "#16a34a", "stroke-width": 2, "stroke-dasharray": "6 5", rx: 8 });
      const g = mk("g", {}); const ball = document.createElementNS(NS, "ellipse"), stripe = document.createElementNS(NS, "rect"); g.append(ball, stripe);
      const frame = mk("rect", { fill: "none", stroke: "#4f46e5", "stroke-dasharray": "4 3", "stroke-width": 1.5 });
      const rotLine = mk("line", { stroke: "#16a34a", "stroke-width": 1.5 });
      const hs = { c: mk("circle", { r: 9, fill: "#fff", stroke: "#4f46e5", "stroke-width": 2.5, class: "h hc" }), rot: mk("circle", { r: 9, fill: "#22c55e", stroke: "#14532d", "stroke-width": 2, class: "h hr" }) };
      ["nw", "ne", "se", "sw"].forEach((k) => { hs[k] = mk("rect", { width: 14, height: 14, fill: "#fff", stroke: "#4f46e5", "stroke-width": 2.5, class: "h hk" }); });
      function draw() {
        const r = b.s / 2, A = b.a * Math.PI / 180, rot = (dx, dy) => [b.x + dx * Math.cos(A) - dy * Math.sin(A), b.y + dx * Math.sin(A) + dy * Math.cos(A)];
        g.setAttribute("transform", `translate(${b.x} ${b.y}) rotate(${b.a})`);
        Object.entries({ rx: r, ry: r, fill: "#f97316", stroke: "#9a3412", "stroke-width": 2 }).forEach(([k, v]) => ball.setAttribute(k, v));
        Object.entries({ x: -r, y: -4, width: b.s, height: 8, fill: "#fff7ed" }).forEach(([k, v]) => stripe.setAttribute(k, v));
        Object.entries({ x: b.x - r, y: b.y - r, width: b.s, height: b.s, transform: `rotate(${b.a} ${b.x} ${b.y})` }).forEach(([k, v]) => frame.setAttribute(k, v));
        hs.c.setAttribute("cx", b.x); hs.c.setAttribute("cy", b.y);
        const [rx, ry] = rot(0, -r - 24), [lx, ly] = rot(0, -r); hs.rot.setAttribute("cx", rx); hs.rot.setAttribute("cy", ry);
        Object.entries({ x1: lx, y1: ly, x2: rx, y2: ry }).forEach(([k, v]) => rotLine.setAttribute(k, v));
        const cs = { nw: [-r, -r], ne: [r, -r], se: [r, r], sw: [-r, r] };
        for (const k in cs) { const [x, y] = rot(...cs[k]); hs[k].setAttribute("x", x - 7); hs[k].setAttribute("y", y - 7); }
      }
      draw();
      const toSvg = (e) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; };
      let drag = null, locked = false;
      for (const k in hs) hs[k].addEventListener("pointerdown", (e) => { if (locked) return; e.preventDefault(); hs[k].setPointerCapture(e.pointerId); drag = { k, p: toSvg(e), b: { ...b } }; });
      svg.addEventListener("pointermove", (e) => {
        if (!drag || locked) return; const p = toSvg(e), d = drag;
        if (d.k === "c") { b.x = clamp(d.b.x + p.x - d.p.x, 10, VW - 10); b.y = clamp(d.b.y + p.y - d.p.y, 10, VH - 10); onUse && onUse("move"); }
        else if (d.k === "rot") { b.a = Math.round(Math.atan2(p.y - b.y, p.x - b.x) * 180 / Math.PI + 90); onUse && onUse("rotate"); }
        else { const d0 = Math.hypot(d.p.x - d.b.x, d.p.y - d.b.y), d1 = Math.hypot(p.x - b.x, p.y - b.y); b.s = clamp(d.b.s * d1 / d0, 24, 190); onUse && onUse("size"); }
        draw();
      });
      const end = () => { drag = null; }; svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
      box.append(svg);
      box.append(el("p", "legend", `<span><i class="lc"></i> центральний</span><span><i class="lk"></i> кутові</span><span><i class="lr"></i> верхній круглий</span>`));
      return {
        reset() { Object.assign(b, b0); draw(); },
        check() {
          locked = true; svg.classList.add("locked");
          const a = ((b.a % 360) + 540) % 360 - 180;
          return goal === "move" ? (b.x > tgt.x && b.x < tgt.x + tgt.w && b.y > tgt.y && b.y < tgt.y + tgt.h) : goal === "size" ? b.s >= b0.s * 1.3 : Math.abs(a) >= 25;
        }
      };
    }

    /* ---------------- перевірки: (ctx {task}, контейнер, done(ok, пояснення)) */
    const normW = (t) => String(t).toLowerCase().replace(/[’ʼ`']/g, "'").replace(/ё/g, "е").replace(/\s+/g, " ").replace(/^[\s.,;:!?«»"]+|[\s.,;:!?«»"]+$/g, "").trim();
    function lev(a, b) { let prev = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[b.length]; }
    const TASK = {
      choice(c, box, done) {
        const v = R.pick(c.task.v), ok = v[1][0];
        box.append(qp(v[0]));
        const opts = el("div", "opts"); let sel = null;
        for (const o of R.shuffle(v[1])) { const b = el("button", "opt", esc(o)); b.onclick = () => { opts.querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); sel = o; ans.disabled = false; }; opts.append(b); }
        box.append(opts);
        const [ans] = footer([["Відповісти", "pri", () => {
          opts.querySelectorAll(".opt").forEach((b) => { b.disabled = true; if (b.textContent === ok) b.classList.add("right"); else if (b.classList.contains("sel")) b.classList.add("wrong"); });
          ans.disabled = true; done(sel === ok, esc(v[2] || ""));
        }, true]]);
      },
      cloze(c, box, done) {
        box.append(qp("Впиши пропущені слова — так, як записано в зошиті."));
        const p = el("p", "cloze"), blanks = [];
        c.task.text.split(/(\[\[.+?\]\])/).forEach((part) => {
          const m = part.match(/^\[\[(.+?)\]\]$/);
          if (!m) return p.append(document.createTextNode(part));
          const alts = m[1].split("|"), inp = el("input"); inp.type = "text"; inp.autocomplete = "off"; inp.spellcheck = false; inp.autocapitalize = "off";
          inp.style.width = Math.max(4, alts[0].length + 2) + "ch"; inp.setAttribute("aria-label", "Пропущене слово");
          blanks.push({ inp, alts }); p.append(inp);
        });
        box.append(p);
        const check = () => blanks.map(({ inp, alts }) => { const v = normW(inp.value); return alts.some((a) => { const n = normW(a); return v === n || (n.length >= 6 && lev(v, n) <= 1); }); });
        const [ans] = footer([["Перевірити", "pri", () => {
          const res = check(); blanks.forEach(({ inp, alts }, i) => { inp.disabled = true; inp.classList.add(res[i] ? "right" : "wrong"); if (!res[i]) inp.title = alts[0]; });
          ans.disabled = true;
          const full = esc(c.task.text).replace(/\[\[(.+?)\]\]/g, (_, a) => `<b>${esc(a.split("|")[0])}</b>`);
          done(res.every(Boolean), res.every(Boolean) ? "" : "Має бути: " + full);
        }, true]]);
        blanks.forEach(({ inp }) => { inp.oninput = () => { ans.disabled = !blanks.every((b) => b.inp.value.trim()); }; inp.onkeydown = (e) => { if (e.key === "Enter" && !ans.disabled) ans.click(); }; });
      },
      calc(c, box, done) {
        const v = c.task.gen(R);
        box.append(qp(v.q));
        const row = el("div", "calc"); const inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"; inp.autocomplete = "off"; inp.placeholder = "Відповідь";
        row.append(inp, el("span", "unit", esc(v.unit || ""))); box.append(row);
        box.append(el("p", "hint", "💡 Формула — у твоєму зошиті. Порахуй і впиши лише число."));
        const [ans] = footer([["Відповісти", "pri", () => {
          const n = parseFloat(inp.value.replace(",", ".").replace(/[^\d.\-]/g, ""));
          inp.disabled = true; ans.disabled = true; done(Math.abs(n - v.ans) < 1e-6, esc(v.x));
        }, true]]);
        inp.oninput = () => { ans.disabled = !inp.value.trim(); };
        inp.onkeydown = (e) => { if (e.key === "Enter" && !ans.disabled) ans.click(); };
      },
      order(c, box, done) {
        const v = R.pick(c.task.v); box.append(qp(v.q));
        box.append(el("p", "hint", "💡 Торкайся карток по черзі — від першого кадру до останнього. Помилився — торкнись картки в рядку кадрів, щоб повернути."));
        const seq = el("ol", "seq"), pool = el("div", "pool"); box.append(seq, pool);
        let items = R.shuffle(v.items); while (items.join() === v.items.join()) items = R.shuffle(v.items);
        const picked = [];
        const draw = () => {
          seq.innerHTML = ""; pool.innerHTML = "";
          picked.forEach((t, k) => { const li = el("li", "", `<span class="n">${k + 1}</span>${esc(t)}`); li.onclick = () => { picked.splice(k, 1); draw(); }; seq.append(li); });
          for (let k = picked.length; k < v.items.length; k++) seq.append(el("li", "empty", `<span class="n">${k + 1}</span>…`));
          items.filter((t) => !picked.includes(t)).forEach((t) => { const b = el("button", "chip", esc(t)); b.onclick = () => { picked.push(t); draw(); }; pool.append(b); });
          ans.disabled = picked.length !== v.items.length;
        };
        const [ans] = footer([["Відповісти", "pri", () => {
          const ok = picked.every((t, k) => t === v.items[k]);
          seq.querySelectorAll("li").forEach((li, k) => { li.onclick = null; li.classList.add(picked[k] === v.items[k] ? "right" : "wrong"); });
          ans.disabled = true; done(ok, (ok ? "" : "Правильно: " + v.items.map(esc).join(" → ") + ". ") + esc(v.x || ""));
        }, true]]);
        draw();
      },
      spot(c, box, done) {
        const v = R.pick(c.task.v); box.append(qp(v.q));
        const win = animWindow((id, z, w) => {
          w.querySelectorAll(".z").forEach((x) => { x.disabled = true; });
          const ok = id === v.target; z.classList.add(ok ? "right" : "wrong");
          if (!ok) w.querySelector(".z-" + v.target).classList.add("right");
          done(ok, ok ? `Це ${ZONES[id][0].toLowerCase()}.` : `Ти клацнув(ла) «${ZONES[id][0]}», а треба — «${ZONES[v.target][0]}» (підсвічено зеленим).`);
        });
        box.append(win, el("p", "hint", "💡 Підписів немає — як у справжній програмі."));
        footer([]);
      },
      markers(c, box, done) {
        const v = R.pick(c.task.v); box.append(qp(v.q));
        box.append(el("p", "hint", "💡 Тягни потрібний маркер, потім натисни «Перевірити»."));
        const sim = markerSim(box, v.goal, null);
        footer([["↺ Спочатку", "", () => sim.reset()], ["Перевірити", "pri", () => {
          done(sim.check(), { move: "Переміщують за центральний маркер.", size: "Розмір змінюють кутові маркери.", rotate: "Повертають за верхній круглий (зелений) маркер." }[v.goal]);
        }]]);
      },
      // «Новий проєкт»: назва Стрибок_Прізвище, 640×480, 24 кадр/с, світло-блакитне тло, потім «Зберегти»
      form(c, box, done) {
        const sur = String(c.sname || "").split(" ")[0] || "Прізвище";
        box.append(qp(`Створи свій перший проєкт: назва — **Стрибок_${sur}**, розмір кадру — **640×480**, частота — **24 кадр/с**, колір тла — **світло-блакитний**. Потім збережи.`));
        const f = el("div", "pform");
        f.innerHTML = `<div class="ptitle">📄 Новий проєкт</div>
          <label>Назва проєкту<input type="text" id="pfName" autocomplete="off" spellcheck="false" placeholder="Назва"></label>
          <label>Розмір кадру<select id="pfSize"><option value="">— вибери —</option><option>320×240</option><option>640×480</option><option>1280×720</option><option>1920×1080</option></select></label>
          <label>Частота кадрів, кадр/с<input type="text" id="pfFps" inputmode="numeric" autocomplete="off" placeholder="?"></label>
          <div class="plab">Колір тла</div><div class="psw" id="pfCol"></div>`;
        box.append(f);
        const cols = [["#ffffff", "білий"], ["#bfe3ff", "світло-блакитний"], ["#1e3a8a", "темно-синій"], ["#fde68a", "жовтий"], ["#bbf7d0", "світло-зелений"]];
        let col = null; const sw = f.querySelector("#pfCol");
        cols.forEach(([h, n]) => { const b = el("button", "pc"); b.style.background = h; b.title = n; b.setAttribute("aria-label", n); b.onclick = () => { col = n; sw.querySelectorAll(".pc").forEach((x) => x.classList.toggle("sel", x === b)); }; sw.append(b); });
        const [mk] = footer([["Створити", "pri", () => {
          const name = f.querySelector("#pfName").value.trim(), size = f.querySelector("#pfSize").value, fps = f.querySelector("#pfFps").value.trim();
          const errs = [];
          if (!/^стрибок[_-]\S{2,}$/i.test(name)) errs.push(`назва має бути «Стрибок_${sur}»`);
          if (size !== "640×480") errs.push("розмір кадру — 640×480");
          if (fps.replace(/\D/g, "") !== "24") errs.push("частота — 24 кадр/с");
          if (col !== "світло-блакитний") errs.push("колір тла — світло-блакитний");
          f.querySelectorAll("input,select,button").forEach((x) => { x.disabled = true; }); mk.disabled = true;
          const stage = el("div", "pstage", `<div class="pbar2"><b>${esc(name || "Без назви")}</b><button class="btn" id="pfSave">💾 Зберегти</button></div><div class="pfield" style="background:${(cols.find((x) => x[1] === col) || cols[0])[0]}"><span>кадр 1 — ${esc(size || "?")}</span></div>`);
          box.append(stage, el("p", "hint", "Проєкт створено — у робочому полі перший кадр. Що треба зробити одразу?"));
          stage.scrollIntoView({ block: "nearest", behavior: "smooth" });
          footer([]);
          stage.querySelector("#pfSave").onclick = (e) => { e.target.disabled = true; e.target.textContent = "✓ Збережено"; done(!errs.length, errs.length ? "Перевір: " + errs.join("; ") + "." : "Параметри правильні, проєкт збережено одразу."); };
        }]]);
      }
    };


    /* ---------------- ще перевірки */
    TASK.sort = (c, box, done) => {
      const v = R.pick(c.task.v); box.append(qp(v.q));
      box.append(el("p", "hint", "💡 Для кожного рядка натисни, куди він належить."));
      const tbl = el("div", "sort"); box.append(tbl);
      const pick = {}; const items = R.shuffle(v.items);
      items.forEach(([t], k) => {
        const row = el("div", "srow", `<span>${esc(t)}</span>`); const bs = el("div", "sbtns");
        v.groups.forEach((g, gi) => { const b = el("button", "sb", esc(g)); b.onclick = () => { pick[k] = gi; bs.querySelectorAll(".sb").forEach((x, xi) => x.classList.toggle("sel", xi === gi)); ans.disabled = Object.keys(pick).length !== items.length; }; bs.append(b); });
        row.append(bs); tbl.append(row);
      });
      const [ans] = footer([["Відповісти", "pri", () => {
        let ok = true;
        tbl.querySelectorAll(".srow").forEach((row, k) => { const good = pick[k] === items[k][1]; if (!good) ok = false; row.classList.add(good ? "right" : "wrong"); row.querySelectorAll(".sb").forEach((b) => { b.disabled = true; }); });
        ans.disabled = true; done(ok, esc(v.x || ""));
      }, true]]);
    };

    /* ---------------- ще демонстрації (5–7 класи, уроки 7–8) */
    // 5-07: мережа з роутером — торкнись кожного пристрою
    DEMO.net = (box, ready) => {
      const devs = [["💻", "Комп'ютер", "дротове: кабелем до комунікаційного пристрою", 1, 50, 40], ["🖨️", "Принтер", "дротове: спільний мережевий принтер — друкують з усіх комп'ютерів", 1, 250, 40], ["📱", "Смартфон", "бездротове: радіосигнал Wi-Fi", 2, 285, 150], ["💻", "Ноутбук", "бездротове: Wi-Fi (кабель теж можна)", 2, 15, 150], ["📺", "«Розумний» телевізор", "бездротове: Wi-Fi", 2, 150, 205], ["🖱️", "Миша", "НЕ в мережі: її під'єднують до комп'ютера, сама даними в мережі не обмінюється", 0, 60, 230], ["🎧", "Навушники", "НЕ в мережі: їх під'єднують до телефона чи комп'ютера", 0, 245, 230]];
      const W = 340, H = 292, svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.classList.add("netd");
      const mk = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; svg.append(e); return e; };
      mk("rect", { x: 0, y: 0, width: W, height: H, fill: "#f8fafc", rx: 12 });
      const lines = mk("g", {});
      const cx = 170, cy = 125;
      mk("circle", { cx, cy, r: 30, fill: "#4f46e5" }); mk("text", { x: cx, y: cy + 6, "text-anchor": "middle", "font-size": 22 }, "📡");
      mk("text", { x: cx, y: cy + 46, "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#312e81" }, "роутер");
      mk("text", { x: cx, y: 18, "text-anchor": "middle", "font-size": 11, fill: "#64748b" }, "🌍 Інтернет ↑ через роутер");
      mk("line", { x1: cx, y1: 24, x2: cx, y2: cy - 30, stroke: "#94a3b8", "stroke-width": 2, "stroke-dasharray": "2 3" });
      const info = el("p", "say", "👆 Торкнись кожного пристрою."), seen = new Set();
      devs.forEach(([e, n, how, kind, x, y], i) => {
        const g = mk("g", { class: "dev", tabindex: 0, role: "button", "aria-label": n });
        const c = document.createElementNS(NS, "circle"); Object.entries({ cx: x + 20, cy: y + 18, r: 22, fill: "#fff", stroke: "#cbd5e1", "stroke-width": 2 }).forEach(([k, v]) => c.setAttribute(k, v));
        const t = document.createElementNS(NS, "text"); Object.entries({ x: x + 20, y: y + 26, "text-anchor": "middle", "font-size": 22 }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = e;
        g.append(c, t);
        const pick = () => {
          if (!seen.has(i)) {
            seen.add(i);
            if (kind) { const l = document.createElementNS(NS, "line"); Object.entries({ x1: x + 20, y1: y + 18, x2: cx, y2: cy, stroke: kind === 1 ? "#0f172a" : "#0ea5e9", "stroke-width": kind === 1 ? 3 : 2, "stroke-dasharray": kind === 1 ? "" : "4 4" }).forEach(([k, v]) => l.setAttribute(k, v)); lines.append(l); }
            c.setAttribute("stroke", kind ? (kind === 1 ? "#0f172a" : "#0ea5e9") : "#ef4444");
          }
          info.innerHTML = `<b>${e} ${esc(n)}</b> — ${esc(how)}<br><small class="muted">Переглянуто ${seen.size} з ${devs.length} · суцільна лінія — кабель, пунктир — Wi-Fi</small>`;
          if (seen.size === devs.length) ready();
        };
        g.addEventListener("click", pick); g.addEventListener("keydown", (ev) => { if (ev.key === "Enter") pick(); });
      });
      box.append(svg, info);
    };
    // 5-08: невдалий і вдалий запит у пошуковій системі
    DEMO.search = (box, ready) => {
      const qs = [
        ["підкажіть будь ласка яка в нас гора найвища і скільки там метрів", false, ["Форум: «а хто знає, яка гора найвища?» (без відповіді)", "Як правильно писати «будь ласка»", "Топ-10 найвищих гір світу"]],
        ["висота Говерли", true, ["Говерла — найвища гора України, 2061 м", "Говерла — Вікіпедія", "Маршрути на Говерлу — офіційний сайт парку"]],
        ["Шевченко", false, ["Андрій Шевченко — футболіст", "Шевченківський район", "Вулиця Шевченка — карта"]],
        ["Тарас Шевченко дата народження", true, ["Тарас Шевченко народився 9 березня 1814 року", "Біографія Т. Г. Шевченка", "Музей Тараса Шевченка"]]
      ];
      const tried = new Set(), wrap = el("div", "srch");
      const field = el("div", "sfield", "🔎 <span>натисни запит нижче</span>"), res = el("ol", "sres"), opts = el("div", "seg");
      qs.forEach(([q, good, r], i) => { const b = el("button", "sb", esc(q.length > 34 ? q.slice(0, 32) + "…" : q)); b.onclick = () => {
        tried.add(good); opts.querySelectorAll(".sb").forEach((x) => x.classList.toggle("sel", x === b));
        field.innerHTML = `🔎 <span>${esc(q)}</span>`;
        res.innerHTML = r.map((t, k) => `<li class="${good && k === 0 ? "hit" : ""}">${esc(t)}</li>`).join("") + `<p class="hint">${good ? "✅ Ключові слова — і потрібне вже першим!" : "❌ Зайві слова або занадто загально — потрібного немає."}</p>`;
        if (tried.size === 2) ready();
      }; opts.append(b); });
      wrap.append(field, res); box.append(wrap, opts);
    };
    // 6-07: вкладка «Вставлення» — зображення, відео, аудіо; відео з ПК чи онлайн (без інтернету)
    DEMO.media = (box, ready) => {
      const rib = el("div", "rib"), slide = el("div", "slide6"), info = el("p", "say", "👆 Встав на слайд зображення, відео й аудіо — кнопки на вкладці «Вставлення».");
      const items = { img: ["🖼️ Зображення", "Фото.jpg", "JPG, PNG, GIF, BMP"], vid: ["🎬 Відео", "Дослід.mp4", "MP4, WMV, AVI"], aud: ["🔊 Аудіо", "Пісня.mp3", "MP3, WAV, WMA"] };
      const got = new Set();
      rib.append(el("span", "rtab", "Вставлення"));
      for (const [k, [lab, file, fmt]] of Object.entries(items)) {
        const b = el("button", "sb", lab); b.onclick = () => {
          if (!got.has(k)) { got.add(k); slide.append(el("div", "obj6 " + k, `<b>${k === "img" ? "🖼️" : k === "vid" ? "▶" : "🔊"}</b><small>${esc(file)}</small>`)); }
          info.innerHTML = `<b>${esc(lab)}</b> — формати: ${esc(fmt)}. ${k === "aud" ? "На слайді з'являється значок гучномовця." : k === "vid" ? "На слайді — віконце з першим кадром і кнопками." : ""}`;
          if (got.size === 3) ready();
        }; rib.append(b);
      }
      box.append(rib, slide, info);
    };
    DEMO.online = (box, ready) => {
      let net = true; const flips = new Set();
      const sw = el("button", "btn", "📶 Інтернет: є"), row = el("div", "vrow");
      const a = el("div", "vid6", "<b>Відео з комп'ютера</b><div class='scr'>▶ грає</div><small>усередині файлу презентації</small>");
      const b = el("div", "vid6", "<b>Онлайнове відео</b><div class='scr'>▶ грає</div><small>на слайді — лише посилання</small>");
      row.append(a, b);
      const info = el("p", "hint", "Вимкни й увімкни інтернет — подивись, що станеться з кожним відео.");
      sw.onclick = () => { net = !net; flips.add(net); sw.textContent = net ? "📶 Інтернет: є" : "🚫 Інтернет: немає"; b.querySelector(".scr").textContent = net ? "▶ грає" : "⚠ Немає з'єднання"; b.classList.toggle("off", !net); if (flips.size === 2) ready(); };
      box.append(sw, row, info);
    };
    // 6-08: показ і режим доповідача — клавіші F5, Shift + F5, Esc, →, ←
    DEMO.show = (box, ready) => {
      const n = 5; let cur = 2, mode = "edit"; const used = new Set();
      const scr = el("div", "show6"), mon = el("div", "mon6"), keys = el("div", "seg"), info = el("p", "hint", "");
      const draw = () => {
        scr.innerHTML = mode === "edit" ? `<div class="ed">✏️ Режим редагування · виділено слайд ${cur}</div>` : `<div class="sl">Слайд ${cur}</div>`;
        mon.innerHTML = mode === "presenter" ? `<b>Монітор доповідача</b><div class="sl small">Слайд ${cur}</div><div class="nt">📝 Нотатки: «Розповісти про слайд ${cur}»</div><div class="nx">Далі: слайд ${Math.min(n, cur + 1)}</div>` : `<b>Монітор доповідача</b><div class="nt muted">${mode === "show" ? "той самий слайд, що й на проєкторі" : "—"}</div>`;
        info.textContent = { edit: "Показ не запущено.", show: "Іде показ: клас бачить на проєкторі лише слайд.", presenter: "Режим доповідача: клас бачить слайд, а ти — ще й нотатки й наступний слайд." }[mode];
      };
      const K = [["F5", () => { mode = "show"; cur = 1; }], ["Shift + F5", () => { mode = "show"; }], ["Alt + F5", () => { mode = "presenter"; cur = 1; }], ["→", () => { if (mode !== "edit") cur = Math.min(n, cur + 1); }], ["←", () => { if (mode !== "edit") cur = Math.max(1, cur - 1); }], ["Esc", () => { mode = "edit"; }]];
      K.forEach(([k, f]) => { const b = el("button", "sb", `<kbd>${k}</kbd>`); b.onclick = () => { f(); used.add(k); draw(); if (["F5", "Shift + F5", "Esc", "Alt + F5"].every((x) => used.has(x))) ready(); }; keys.append(b); });
      const row = el("div", "vrow"); const pj = el("div", "pj6"); pj.append(el("b", "", "📽️ Проєктор (бачить клас)"), scr); row.append(pj, mon);
      box.append(row, keys, info, el("p", "hint", "Спробуй F5, Shift + F5, Alt + F5 і Esc.")); draw();
    };
    // 7-08: RGB-повзунки й HEX-код
    DEMO.rgb = (box, ready) => {
      const c = [255, 136, 0], moved = new Set();
      const sw = el("div", "rgbsw"), code = el("div", "rgbcode"), wrap = el("div", "rgbw");
      const hx = (v) => v.toString(16).padStart(2, "0").toUpperCase();
      const draw = () => { const h = "#" + c.map(hx).join(""); sw.style.background = h; code.innerHTML = `<b>${h}</b> · RGB ${c.join(", ")}`; };
      ["R", "G", "B"].forEach((n, i) => {
        const lab = el("label", "rgbl", `<span style="color:${["#dc2626", "#16a34a", "#2563eb"][i]}">${n}</span>`); const r = el("input"); r.type = "range"; r.min = 0; r.max = 255; r.value = c[i];
        const out = el("output", "", c[i]); r.oninput = () => { c[i] = +r.value; out.textContent = r.value; moved.add(n); draw(); if (moved.size === 3) ready(); };
        lab.append(r, out); wrap.append(lab);
      });
      box.append(sw, code, wrap, el("p", "hint", "Порухай усі три повзунки. Спробуй отримати жовтий: R = 255, G = 255, B = 0.")); draw();
    };
    // 7-08: статичне й динамічне тло
    DEMO.bg = (box, ready) => {
      const cv = el("canvas", "demo"); cv.width = 520; cv.height = 220; box.append(cv);
      const g = cv.getContext("2d"); let off = 3, dir = 1, x = 0; const tried = new Set();
      const ctl = el("div", "seg");
      [["◀ ліворуч", () => { dir = -1; tried.add("dir"); }], ["праворуч ▶", () => { dir = 1; tried.add("dir"); }], ["зміщення 1", () => { off = 1; tried.add("o1"); }], ["зміщення 5", () => { off = 5; tried.add("o5"); }], ["зміщення 10", () => { off = 10; tried.add("o10"); }]].forEach(([t, f]) => { const b = el("button", "sb", t); b.onclick = () => { f(); if (tried.size >= 3) ready(); }; ctl.append(b); });
      box.append(ctl, el("p", "hint", "Будинок і сніг — на статичному тлі (стоять), хмари — на динамічному (прокручуються). Зміни напрям і зміщення."));
      (function loop() {
        if (!document.body.contains(cv)) return;
        x = (x + off * dir * 0.5 + 520) % 520;
        g.fillStyle = "#99ccff"; g.fillRect(0, 0, 520, 220);
        for (let k = -1; k < 3; k++) { const cx = (x + k * 260) % 780 - 60; g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(cx, 50, 46, 18, 0, 0, 7); g.ellipse(cx + 30, 40, 30, 16, 0, 0, 7); g.fill(); }
        g.fillStyle = "#ffffff"; g.fillRect(0, 170, 520, 50);
        g.fillStyle = "#993300"; g.fillRect(320, 110, 90, 60); g.fillStyle = "#CC0000"; g.beginPath(); g.moveTo(310, 112); g.lineTo(365, 70); g.lineTo(420, 112); g.fill();
        g.font = "600 12px Rubik, sans-serif"; g.fillStyle = "#1e3a8a"; g.fillText(`динамічне тло: ${dir > 0 ? "праворуч" : "ліворуч"}, зміщення ${off}`, 12, 20);
        requestAnimationFrame(loop);
      })();
    };

    /* ============================================================ ЗОШИТ */
    const book = $("#book");
    function openBook() {
      if (!st) return;
      const body = $("#bookBody"); body.innerHTML = "";
      body.append(el("p", "say", "Тут — лише <b>назви</b> того, що ти мав(ла) записати. Сам текст — у твоєму паперовому зошиті. Наприкінці гри побачиш усе повністю й зможеш звірити."));
      if (!st.notes.length) body.append(el("p", "hint", "Поки порожньо."));
      const ul = el("ul", "blist"); st.notes.forEach((n) => ul.append(el("li", "", esc(n.label)))); body.append(ul);
      book.hidden = false; setPaused(true);
    }
    function closeBook() { if (book.hidden) return; book.hidden = true; if (!openSt && $("#res").hidden && st && !st.finished) setPaused(false); }
    $("#bookBtn").onclick = openBook; $("#bookClose").onclick = closeBook;
    book.addEventListener("click", (e) => { if (e.target === book) closeBook(); });

    /* ============================================================ ФІНАЛ */
    function finishAll() {
      st.finished = true; setPaused(true); $("#hud").hidden = true;
      const sc = score(), total = CHECKS.length, g12 = Math.max(1, Math.round(sc / total * 12));
      const sec = Math.round((Date.now() - st.start) / 1000);
      const ak = `${KEY}:att:${st.cls}|${personKey(st.name)}`, att = store.get(ak, 0) + 1; store.set(ak, att);
      st.result = { sc, total, sec, att }; saveSt();
      const wrong = CHECKS.map((k, i) => (st.checks[k] ? 0 : i + 1)).filter(Boolean).join(", ");
      const skipped = stations.filter((s) => s.optional && !isDone(s)).length;
      queueResult({ ts: new Date().toISOString(), testId: Q.id, test: Q.title, kind: "quest", cls: st.cls, name: st.name, attempt: att, score: sc, total, grade12: g12, violations: st.viol, durationSec: sec, wrong, note: `🕹️ конспект-гра · 🪙 ${st.coins || 0}` + (skipped ? `; ⭐ пропущено: ${skipped}` : "") + (st.viol ? `; виходів: ${st.viol}` : "") });
      $("#rGrade").textContent = g12; $("#rScore").textContent = `${sc} з ${total}`; $("#rTime").textContent = fmtTime(sec);
      $("#rTitle").textContent = g12 >= 10 ? "Пройдено блискуче!" : g12 >= 7 ? "Пройдено!" : "Пройдено — але варто повторити";
      $("#rBonusHint").innerHTML = att === 1 && sc === total ? "🎯 Усе правильно з першої спроби — ти в боротьбі за <b>🏅 +1 бал</b>: його отримують троє найшвидших у класі з таким самим результатом." : att > 1 ? "Це не перша спроба — у таблиці лідерів рахується лише перша." : "🏅 +1 бал отримують троє найшвидших у класі, хто з першої спроби відповів правильно на <b>все</b>, включно з ⭐.";
      const ul = $("#rList"); ul.innerHTML = "";
      stations.forEach((s) => { const ks = s.steps.map((p, k) => p.t === "check" ? `${s.i}:${k}` : null).filter(Boolean); if (!ks.length) return; const got = ks.filter((k) => st.checks[k]).length; ul.append(el("li", got === ks.length ? "ok" : "bad", `${esc(s.topic)} <small>${got}/${ks.length}</small>`)); });
      const nb = $("#rNotes"); nb.innerHTML = "";
      stations.forEach((s) => s.steps.forEach((p) => { if (p.t === "write" || (p.t === "say" && p.write)) { if (!s.optional || isDone(s)) nb.append(p.t === "write" ? noteCard(p) : noteBox(table(p.table), `✍️ ${s.topic} — таблиця`)); } }));
      $("#toast").hidden = true; $("#res").hidden = false;
      world.finish && world.finish();
      // таблиця лідерів: даємо таблиці кілька секунд записати наш рядок
      const me = { name: st.name, score: sc, total, min: sec / 60, me: true };
      $("#rBoard").innerHTML = "<p class='hint'>Завантажую таблицю лідерів…</p>";
      flush().then(() => setTimeout(() => showBoard($("#rBoard"), st.cls, 10, att === 1 ? me : null), 2500));
    }
    $("#again").onclick = () => { store.set(KEY + ":run", null); location.reload(); };

    // опитування бети: окремий рядок у таблиці (аркуш beta-<id>), оцінка 2 / 1 / 0
    let pollV = null;
    document.querySelectorAll("#poll .opt").forEach((b) => { b.onclick = () => { pollV = +b.dataset.v; document.querySelectorAll("#poll .opt").forEach((x) => x.classList.toggle("sel", x === b)); $("#pollSend").disabled = false; }; });
    $("#pollSend").onclick = () => {
      if (pollV == null || !st) return;
      const lab = document.querySelector(`#poll .opt[data-v="${pollV}"]`).textContent, txt = $("#pollTxt").value.trim().slice(0, 500);
      queueResult({ ts: new Date().toISOString(), testId: "beta-" + Q.id, test: `Відгук: ${Q.title} (бета)`, kind: "feedback", cls: st.cls, name: st.name, attempt: 1, score: pollV, total: 2, grade12: 0, violations: 0, durationSec: 0, wrong: "", note: lab + (txt ? " · " + txt : "") });
      document.querySelectorAll("#poll .opt, #pollTxt, #pollSend").forEach((x) => { x.disabled = true; });
      $("#pollOk").hidden = false;
    };

    /* ---------------- таблиця лідерів класу (Code.gs, action "board") */
    async function showBoard(box, cls, top, me) {
      if (!box || !cls) { if (box) box.innerHTML = ""; return; }
      if (!CFG.QUEST_BOARD) { box.innerHTML = me ? `<p class="hint">🏆 Таблиця лідерів класу скоро запрацює — твій результат уже збережено й потрапить туди.</p>` : ""; return; }
      let rows = null;
      try {
        const r = await fetch(CFG.SHEETS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "board", test: Q.id, cls }) });
        const d = await r.json(); if (d && d.ok) rows = d.rows;
      } catch (e) { rows = null; }
      if (!rows) { box.innerHTML = me ? `<p class="hint">Таблиця лідерів поки недоступна — твій результат збережено, він з'явиться там пізніше.</p>` : ""; return; }
      if (me && !rows.some((r) => personKey(r.name) === personKey(me.name))) { rows.push(me); rows.sort((a, b) => b.score - a.score || a.min - b.min); }
      if (!rows.length) { box.innerHTML = `<p class="hint">🏆 У ${esc(cls)} ще ніхто не пройшов цю гру — будь першим(ою)!</p>`; return; }
      const mine = me ? rows.findIndex((r) => personKey(r.name) === personKey(me.name)) : -1;
      const list = rows.slice(0, top).map((r, i) => ({ r, i }));
      if (mine >= top) list.push({ r: rows[mine], i: mine });
      box.innerHTML = `<h2>🏆 Лідери ${esc(cls)}</h2>` + `<ol class="lead">${list.map(({ r, i }) => `<li class="${i === mine ? "me" : ""}${i >= top ? " gap" : ""}"><span class="pl">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span><span class="nm">${esc(shortName(r.name))}${r.bonus ? ' <span class="bonus">🏅 +1</span>' : ""}</span><span class="sc">${r.score}/${r.total}</span><span class="tm">${fmtTime(r.min * 60)}</span></li>`).join("")}</ol>` + `<p class="hint">Рахується перша спроба: спершу бали, потім час. 🏅 +1 бал — троє найшвидших із результатом «усе правильно».</p>`;
    }

    function queueResult(row) { const box = store.get("qz:outbox", []); box.push(row); store.set("qz:outbox", box); flush(); }
    let flushing = null;
    function flush() {
      if (!CFG.SHEETS_URL) return Promise.resolve();
      if (flushing) return flushing;
      flushing = (async () => {
        let box = store.get("qz:outbox", []);
        while (box.length) {
          try { await fetch(CFG.SHEETS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(box[0]) }); box.shift(); store.set("qz:outbox", box); }
          catch (e) { break; }
        }
        flushing = null;
      })();
      return flushing;
    }
    window.QUEST.debug = { core, stations, st: () => st, openStation, finishAll, available, world };
  }

  /* ---------------------------------------------------------- запуск */
  const id = (new URLSearchParams(location.search).get("q") || "7-07").replace(/[^\w-]/g, "");
  const fail = (m) => { $("#sTitle").textContent = m; };
  loadScript(`quests/${id}.js?v=${VER}`).then(async () => {
    if (!LIST.length) return fail("Гру не знайдено");
    const Q = LIST[0], wname = Q.world || "studio";
    if (["runner", "blocky", "range"].includes(wname) && !window.THREE) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
    if (["studio", "arena"].includes(wname)) await loadScript(`assets/worlds/lib2d.js?v=${VER}`);
    await loadScript(`assets/worlds/${wname}.js?v=${VER}`);
    run(Q, window.QWORLDS[wname]);
  }).catch(() => fail("Не вдалося завантажити гру — перевір інтернет і онови сторінку"));
})();
