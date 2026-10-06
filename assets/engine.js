/* Рушій тестів: варіанти завдань, одна/кілька спроб, розблокування паролем учителя,
   штраф за вихід із вкладки, відправлення результатів у Google Таблицю. */
(function () {
  "use strict";
  const CFG = window.CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const LETTERS = "АБВГҐДЕЄ";

  /* ---------- сховище (усе в try/catch: приватний режим, заблоковані дані) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    keys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch (e) {} return out; }
  };

  /* ---------- SHA-256 (власна реалізація, бо crypto.subtle недоступний офлайн з file://) ---------- */
  function sha256(ascii) {
    const bytes = new TextEncoder().encode(ascii);
    const K = [], H = [];
    let n = 2, c = 0;
    const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
    while (c < 64) { let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; } if (p) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c++] = frac(Math.pow(n, 1 / 3)); } n++; }
    const l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(withPad);
    m.set(bytes); m[l] = 0x80;
    const bits = l * 8; const dv = new DataView(m.buffer);
    dv.setUint32(withPad - 4, bits >>> 0); dv.setUint32(withPad - 8, Math.floor(bits / 4294967296));
    const w = new Int32Array(64), h = H.slice();
    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    for (let o = 0; o < withPad; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, cc, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & cc) ^ (b & cc);
        const t2 = (S0 + mj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + cc) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  const checkTeacher = (pwd) => !!pwd && sha256(pwd.trim()) === CFG.TEACHER_HASH;

  /* ---------- код уроку: слово вчителя + година за Києвом (±1) ---------- */
  const CODE_KINDS = CFG.LESSON_CODE_FOR || ["train", "practice", "diag"];
  const DIAG_WINDOW_MS = 90 * 60000;
  const normWord = (s) => String(s || "").toLowerCase().replace(/\s+/g, "");
  function kyivHour() {
    try { return +new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", hourCycle: "h23" }).format(new Date()) % 24; }
    catch (e) { return new Date().getHours(); }
  }
  function checkLessonCode(input) {
    if (checkTeacher(input)) return true;
    const s = normWord(input), h = kyivHour();
    // Слово може саме закінчуватися цифрою («klas7»), тому пробуємо годину з однієї й з двох останніх цифр.
    return [1, 2].some((k) => {
      const tail = s.slice(-k);
      if (s.length <= k || !/^\d+$/.test(tail)) return false;
      const n = +tail, diff = Math.min((n - h + 24) % 24, (h - n + 24) % 24);
      return n < 24 && diff <= 1 && sha256(s.slice(0, -k)) === CFG.LESSON_CODE_HASH;
    });
  }
  const unlockKey = (lessonId) => `qz:unlock:${lessonId}`;
  /* Чи треба вводити код: тренажери й практичні — доки урок ще не відкривали на цьому пристрої;
     діагностувальні — якщо від введення коду минуло понад 90 хв. */
  function needCode(lessonId, kind) {
    if (!CFG.LESSON_CODE_HASH || !CODE_KINDS.includes(kind)) return false;
    const ts = store.get(unlockKey(lessonId), 0);
    return !ts || (kind === "diag" && Date.now() - ts > DIAG_WINDOW_MS);
  }
  function unlockLesson(lessonId, input) {
    if (!checkLessonCode(input)) return false;
    store.set(unlockKey(lessonId), Date.now());
    return true;
  }
  const lessonIdOf = (grade, lesson) => `${grade}-${String(lesson).padStart(2, "0")}`;

  /* ---------- утиліти ---------- */
  const shuffle = (a) => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const norm = (s) => String(s).toLowerCase().replace(/[’ʼ`']/g, "'").replace(/ё/g, "е").replace(/\s+/g, " ").replace(/,/g, ".").trim();
  const normName = (s) => norm(s).replace(/[^a-zа-щьюяїієґ' ]/gi, "");
  // одна людина — один ключ, хоч би як переставили слова: «Синявська Анастасія» = «Анастасія Синявська»
  const personKey = (s) => normName(s).split(" ").filter(Boolean).sort().join(" ");
  store.del("qz:device"); // раніше тут зберігався випадковий код пристрою — більше не використовуємо
  const fmt = (t) => { const d = new Date(t); return d.toLocaleDateString("uk-UA") + " " + d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }); };
  const grade12 = (score, total) => Math.max(1, Math.round((score / total) * 12));

  /* Варіант завдання → уніфікований вигляд */
  function parseVariant(v) {
    // інтерактивні завдання (assets/tasks.js): розклади по групах, порядок, клавіші, схема, симулятори
    if (v && v.type && window.TASKS && TASKS[v.type]) { const p = TASKS[v.type].parse(v); p.task = TASKS[v.type]; return p; }
    if (Array.isArray(v)) return { type: "single", q: v[0], ok: [v[1][0]], opts: v[1], x: v[2] || "" };
    if (v.input) return { type: "input", q: v.q, accept: v.input, x: v.x || "", hint: v.hint || "" };
    if (v.ok && v.no) return { type: "multi", q: v.q, ok: v.ok, opts: v.ok.concat(v.no), x: v.x || "" };
    if ("tf" in v) return { type: "single", q: v.q, ok: [v.tf ? "Так" : "Ні"], opts: v.tf ? ["Так", "Ні"] : ["Ні", "Так"], x: v.x || "", fixed: true };
    throw new Error("Невідомий формат завдання");
  }
  const correctText = (p) => p.task ? p.task.correctText(p) : p.type === "input" ? p.accept[0] : p.ok.join("; ");

  /* ---------- відправлення в Google Таблицю ---------- */
  function queueResult(row) {
    const box = store.get("qz:outbox", []);
    box.push(row); store.set("qz:outbox", box);
    flush();
  }
  let flushing = false;
  async function flush() {
    if (flushing || !CFG.SHEETS_URL) return;
    flushing = true;
    let box = store.get("qz:outbox", []);
    while (box.length) {
      try {
        await fetch(CFG.SHEETS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(box[0]) });
        box.shift(); store.set("qz:outbox", box);
      } catch (e) { break; }
    }
    flushing = false;
  }
  window.addEventListener("online", flush);

  /* ================================================================ ТЕСТ */
  function runTest(T) {
    const N = T.slots.length;
    const ATT = T.attempts || 1;
    const INSTANT = T.feedback === "instant";
    const KEY_ACTIVE = `qz:${T.id}:active`;
    const recKey = (cls, name) => `qz:${T.id}:stu:${cls}|${personKey(name)}`;
    const oldRecKey = (cls, name) => `qz:${T.id}:stu:${cls}|${normName(name)}`;   // до 06.10.2026 — без перестановки слів
    let st = null, picked = null, lock = false, warnTimer, tick, holdTimer;

    document.title = T.title;
    $("eyebrow").textContent = `Інформатика · ${T.grade} клас`;
    $("title").textContent = T.title;
    $("about").textContent = `${N} запитань. ${T.minutes ? `Час — ${T.minutes} хв. ` : ""}Спроб: ${ATT}. ${INSTANT ? "Після кожної відповіді одразу видно, чи вона правильна." : "Результат буде видно наприкінці."}`;
    $("topics").innerHTML = "";
    (T.topics || []).forEach((t) => { const li = document.createElement("li"); li.textContent = t; $("topics").appendChild(li); });

    const sel = $("cls");
    sel.innerHTML = '<option value="">Клас…</option>';
    (CFG.CLASSES || []).filter((c) => c.startsWith(String(T.grade))).forEach((c) => { const o = document.createElement("option"); o.textContent = c; sel.appendChild(o); });
    const LESSON_ID = lessonIdOf(T.grade, T.lesson);
    const codeInp = $("lcode");
    const gated = () => !!codeInp && needCode(LESSON_ID, T.kind);
    const showGate = () => { if (codeInp) { $("codeWrap").hidden = !gated(); $("codeMsg").textContent = ""; } };
    // кнопка «Почати» неактивна — підказуємо, чого саме бракує
    const validStart = () => {
      const words = $("name").value.trim().split(/\s+/).filter(Boolean).length;
      const miss = !sel.value ? "Обери свій клас у списку." : words < 2 ? "Впиши прізвище та ім'я — два слова, як у журналі." : gated() && !codeInp.value.trim() ? "Введи код уроку — його скаже вчитель." : "";
      $("go").disabled = !!miss;
      if ($("goHint")) $("goHint").textContent = miss ? "👉 " + miss : "Усе готово — натискай «Почати»!";
    };
    sel.onchange = validStart; $("name").oninput = validStart;
    [$("name"), codeInp].forEach((inp) => { if (inp) inp.onkeydown = (e) => { if (e.key === "Enter" && !$("go").disabled) start(); }; });
    if (codeInp) codeInp.oninput = () => { $("codeMsg").textContent = ""; validStart(); };
    $("go").onclick = start;
    validStart();
    if ($("swapPwd")) $("swapPwd").onkeydown = (e) => { if (e.key === "Enter") start(); };
    showGate();

    function rec(cls, name) { return store.get(recKey(cls, name), null) || store.get(oldRecKey(cls, name), { used: 0, extra: 0, attempts: [], lastVars: null }); }

    /* ---------- «нове ім'я — нова спроба»: хто нещодавно проходив цей тест з цього пристрою ----------
       Список живе лише в браузері учня й нікуди не надсилається; у таблицю йде тільки ім'я попередника в «Примітці». */
    const DEV_KEY = `qz:${T.id}:dev`, SWAP_MS = (T.kind === "diag" ? 120 : 60) * 60000;
    function otherOnDevice(name) {
      const me = personKey(name), since = Date.now() - SWAP_MS;
      const prev = store.get(DEV_KEY, []).filter((x) => x.at > since && x.p !== me);
      return prev.length ? prev[prev.length - 1].n : "";
    }
    function logDevice(name) {
      const me = personKey(name), keep = Date.now() - 3 * 3600e3;
      const log = store.get(DEV_KEY, []).filter((x) => x.at > keep && x.p !== me);
      log.push({ p: me, n: name, at: Date.now() }); store.set(DEV_KEY, log.slice(-20));
    }
    function saveRec(cls, name, r) { store.set(recKey(cls, name), r); }
    const allowed = (r) => ATT + (r.extra || 0);

    function start() {
      if (gated() && !unlockLesson(LESSON_ID, codeInp.value)) {
        $("codeMsg").textContent = "Неправильний код уроку. Запитай учителя.";
        codeInp.value = ""; validStart(); codeInp.focus();
        return;
      }
      showGate();
      const cls = sel.value, name = $("name").value.trim().replace(/\s+/g, " ");
      const r = rec(cls, name);
      if (r.used >= allowed(r)) { showBlocked(cls, name); return; }
      // діагностувальна: інше ім'я з того самого пристрою — лише з паролем учителя
      if (T.kind === "diag" && otherOnDevice(name) && !checkTeacher($("swapPwd").value)) {
        $("swapWrap").hidden = false;
        $("swapMsg").textContent = $("swapPwd").value ? "Неправильний пароль." : "";
        $("swapPwd").value = ""; $("swapPwd").focus();
        return;
      }
      $("swapWrap").hidden = true;
      newAttempt(cls, name);
    }

    function newAttempt(cls, name) {
      const r = rec(cls, name);
      const vars = T.slots.map((vs, s) => {
        let pool = [...vs.keys()];
        if (r.lastVars && pool.length > 1) pool = pool.filter((v) => v !== r.lastVars[s]);
        return pool[Math.floor(Math.random() * pool.length)];
      });
      st = { cls, name, no: r.used + 1, order: shuffle([...Array(N).keys()]), vars, i: 0, results: [], viol: 0, startedAt: Date.now(),
             deadline: T.minutes ? Date.now() + T.minutes * 60000 : 0, checked: false, prev: otherOnDevice(name) };
      logDevice(name);
      r.used += 1; r.lastVars = vars; saveRec(cls, name, r);   // спроба рахується з моменту старту
      // Пасхалка: з імовірністю EGG_CHANCE на кожне питання одне з них замінюється легким бонусним (assets/eggs.js)
      const pool = (window.EGGS && EGGS.bonus) || [];
      const chance = CFG.EGG_CHANCE === undefined ? 0.01 : CFG.EGG_CHANCE;
      if (pool.length && (CFG.EGG_KINDS || ["train"]).includes(T.kind)) {
        for (let s = 0; s < N; s++) if (Math.random() < chance) { st.bonus = { slot: s, q: Math.floor(Math.random() * pool.length) }; break; }
      }
      store.set(KEY_ACTIVE, st);
      openQuiz();
    }

    // Водяний знак з іменем, класом і часом поверх завдань: скрін чи фото екрана видає, чиї це завдання
    function setWatermark() {
      const d = new Date(st.startedAt), p2 = (n) => String(n).padStart(2, "0");
      const text = `${st.name} · ${st.cls} · ${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
      const esc = text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      const fg = getComputedStyle(document.body).color;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="170"><text x="210" y="90" text-anchor="middle" transform="rotate(-20 210 85)" font-family="sans-serif" font-size="15" font-weight="600" fill="${fg}" fill-opacity="0.1">${esc}</text></svg>`;
      $("quiz").style.setProperty("--wm", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    }

    function openQuiz() {
      ["start", "result", "blocked"].forEach((id) => ($(id).hidden = true));
      $("quiz").hidden = false;
      setWatermark();
      $("rail").innerHTML = "<i></i>".repeat(N);
      clearInterval(tick);
      if (st.deadline) { tick = setInterval(updTimer, 1000); updTimer(); } else $("timer").textContent = "";
      show();
    }
    function updTimer() {
      const left = Math.max(0, st.deadline - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      $("timer").textContent = `${m}:${String(s).padStart(2, "0")}`;
      $("timer").classList.toggle("low", left < 60000);
      if (left <= 0) { clearInterval(tick); finishAttempt("Час вичерпано."); }
    }
    const bonusQ = (b) => parseVariant(window.EGGS.bonus[b]);
    const isBonus = (sl) => !!(st && st.bonus && st.bonus.slot === sl && window.EGGS);
    const cur = () => { const sl = st.order[st.i]; return { sl, p: isBonus(sl) ? bonusQ(st.bonus.q) : parseVariant(T.slots[sl][st.vars[sl]]) }; };

    function show() {
      if (st.checked) { advance(); return; }
      const { p } = cur();
      picked = null;
      $("fb").hidden = true;
      $("next").textContent = "Відповісти"; $("next").disabled = true;
      [...$("rail").children].forEach((el, k) => (el.className = k < st.i ? "done" : k === st.i ? "now" : ""));
      $("qnum").textContent = `${ATT > 1 || st.no > 1 ? `Спроба ${st.no} · ` : ""}Запитання ${st.i + 1} з ${N}`;
      $("qtext").textContent = p.q;
      $("qhint").hidden = true; $("qhint").classList.remove("task");
      if ($("qbonus")) $("qbonus").hidden = !isBonus(cur().sl);
      const box = $("opts"); box.innerHTML = ""; box.classList.remove("locked");
      box.classList.toggle("tasks", !!p.task);
      if (p.task) {
        if (p.hint) { $("qhint").textContent = p.hint; $("qhint").hidden = false; $("qhint").classList.add("task"); }
        picked = p.task.render(box, p, (ready) => { if (!st.checked) $("next").disabled = !ready; });
        $("next").textContent = p.task.button || "Відповісти";
        return;
      }
      if (p.type === "input") {
        $("qhint").textContent = p.hint || "Введи відповідь з клавіатури."; $("qhint").hidden = false;
        const inp = document.createElement("input"); inp.type = "text"; inp.autocomplete = "off"; inp.id = "ans";
        inp.setAttribute("autocapitalize", "off"); inp.spellcheck = false;
        inp.oninput = () => { picked = inp.value; $("next").disabled = !inp.value.trim(); };
        inp.onkeydown = (e) => { if (e.key === "Enter" && inp.value.trim()) $("next").click(); };
        box.appendChild(inp); setTimeout(() => inp.focus(), 50);
        return;
      }
      if (p.type === "multi") { $("qhint").textContent = "Тут кілька правильних відповідей — познач усі."; $("qhint").hidden = false; }
      const opts = p.fixed ? ["Так", "Ні"] : shuffle(p.opts.slice());
      picked = p.type === "multi" ? new Set() : null;
      opts.forEach((txt, k) => {
        const lab = document.createElement("label");
        lab.className = "opt" + (p.type === "multi" ? " multi" : "");
        lab.dataset.v = txt;
        lab.innerHTML = `<input type="${p.type === "multi" ? "checkbox" : "radio"}" name="q"><span class="mk"></span><span></span>`;
        lab.children[1].textContent = LETTERS[k] || k + 1;
        lab.lastChild.textContent = txt;
        lab.querySelector("input").addEventListener("change", (e) => {
          if (st.checked) return;
          if (p.type === "multi") { e.target.checked ? picked.add(txt) : picked.delete(txt); lab.classList.toggle("sel", e.target.checked); $("next").disabled = picked.size === 0; }
          else { picked = txt; [...box.children].forEach((c) => c.classList.remove("sel")); lab.classList.add("sel"); $("next").disabled = false; }
        });
        box.appendChild(lab);
      });
    }

    function judge(p, ans) {
      if (ans === null || ans === undefined) return false;
      if (p.task) return !!p.task.judge(p, ans.get());
      if (p.type === "input") return p.accept.some((a) => norm(a).replace(/ /g, "") === norm(ans).replace(/ /g, ""));
      if (p.type === "multi") return ans.size === p.ok.length && p.ok.every((o) => ans.has(o));
      return p.ok.includes(ans);
    }
    function record(ok, ans, burnt) {
      const { sl } = cur();
      const a = burnt ? null : ans && typeof ans.text === "function" ? ans.text() : ans instanceof Set ? [...ans].join("; ") : ans;
      st.results.push({ sl, v: st.vars[sl], ok, a, b: isBonus(sl) ? st.bonus.q : undefined });
      st.checked = true; store.set(KEY_ACTIVE, st);
    }
    function advance() {
      st.checked = false; st.i++;
      if (st.i >= N) { finishAttempt(); return; }
      store.set(KEY_ACTIVE, st); show();
    }
    $("next").onclick = () => {
      if (!st) return;
      if (st.checked) { advance(); return; }
      const { p } = cur();
      if (picked === null || (picked instanceof Set && !picked.size)) return;
      const ok = judge(p, picked);
      record(ok, picked, false);
      if (!INSTANT) { advance(); return; }
      // миттєвий відгук
      const box = $("opts"); box.classList.add("locked");
      box.querySelectorAll("input").forEach((i) => (i.disabled = true));
      if (p.task) p.task.reveal(box, p, picked);
      [...box.querySelectorAll(".opt")].forEach((l) => { if (p.ok && p.ok.includes(l.dataset.v)) l.classList.add("right"); else if (l.classList.contains("sel")) l.classList.add("wrong"); });
      const fb = $("fb"); fb.className = "fb " + (ok ? "ok" : "no"); fb.innerHTML = "<b></b><p></p>";
      fb.firstChild.textContent = ok ? "Правильно!" : "Неправильно. Правильна відповідь: " + correctText(p);
      fb.lastChild.textContent = ok ? "" : p.x; fb.lastChild.hidden = ok || !p.x; fb.hidden = false;
      $("next").textContent = st.i === N - 1 ? "Завершити" : "Далі"; $("next").disabled = false;
    };

    /* ---------- вихід із вкладки, скріншот ---------- */
    function violation(reason) {
      if (!st || $("quiz").hidden || lock) return;
      lock = true; setTimeout(() => (lock = false), 1200);
      st.viol++;
      let msg = reason;
      if (!st.checked) { if (picked && typeof picked.stop === "function") picked.stop(); record(false, null, true); msg += " Поточне запитання згоріло й зараховане як неправильне."; }
      store.set(KEY_ACTIVE, st);
      const max = CFG.MAX_VIOLATIONS || 0;
      if (max && st.viol >= max) { finishAttempt(`Тест завершено: ${st.viol} виходи з вкладки.`); return; }
      if (max) msg += ` Порушень: ${st.viol} з ${max}.`;
      const w = $("warn"); w.textContent = msg; w.hidden = false;
      clearTimeout(warnTimer); warnTimer = setTimeout(() => (w.hidden = true), 7000);
      advance();
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden) violation("Ти виходив із тесту."); });
    window.addEventListener("blur", () => violation("Ти виходив із тесту."));
    // поки сторінка без фокусу (ножиці Win + Shift + S, перемикач застосунків), завдання розмите
    const veil = (on) => document.body.classList.toggle("veiled", on && !$("quiz").hidden);
    window.addEventListener("blur", () => veil(true));
    document.addEventListener("visibilitychange", () => veil(document.hidden));
    window.addEventListener("focus", () => veil(false));
    document.addEventListener("pointerdown", () => veil(false));
    document.addEventListener("keyup", (e) => {
      if (e.key !== "PrintScreen") return;
      // знімок уже в буфері — підміняємо його текстом (якщо браузер дозволить)
      if (!$("quiz").hidden) try { navigator.clipboard.writeText("Знімок екрана під час тесту заборонено.").catch(() => {}); } catch (err) { /* без буфера */ }
      violation("Зроблено знімок екрана.");
    });
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes(k)) violation("Зроблено знімок екрана.");
      if (!$("quiz").hidden && (e.ctrlKey || e.metaKey) && ["c", "p", "u", "s", "a"].includes(k)) e.preventDefault();
    });
    ["contextmenu", "copy", "cut", "dragstart", "selectstart"].forEach((t) => document.addEventListener(t, (e) => { if (!$("quiz").hidden && e.target.id !== "ans") e.preventDefault(); }));

    /* ---------- завершення спроби ---------- */
    function finishAttempt(reason) {
      clearInterval(tick);
      // незавершені запитання — неправильні
      while (st.results.length < N) {
        const sl = st.order[st.results.length];
        st.results.push({ sl, v: st.vars[sl], ok: false, a: null, b: isBonus(sl) ? st.bonus.q : undefined });
      }
      const score = st.results.filter((r) => r.ok).length;
      const r = rec(st.cls, st.name);
      const att = { no: st.no, score, total: N, g: grade12(score, N), viol: st.viol, at: Date.now(), sec: Math.round((Date.now() - st.startedAt) / 1000), reason: reason || "", results: st.results };
      r.attempts.push(att); saveRec(st.cls, st.name, r);
      queueResult({
        ts: new Date().toISOString(), testId: T.id, test: T.title, kind: T.kind, cls: st.cls, name: st.name,
        attempt: st.no, score, total: N, grade12: att.g, violations: st.viol, durationSec: att.sec, note: [att.reason, st.bonus ? "🎁 бонусне питання" : "", st.prev ? `👥 до цього з цього пристрою: ${st.prev}` : ""].filter(Boolean).join("; "),
        wrong: st.results.filter((x) => !x.ok).map((x) => `${x.sl + 1}${x.a === null ? "(пропуск)" : ""}`).join(", ")
      });
      const who = { cls: st.cls, name: st.name };
      st = null; store.del(KEY_ACTIVE);
      showResult(who.cls, who.name);
    }

    function showResult(cls, name) {
      const r = rec(cls, name), last = r.attempts[r.attempts.length - 1];
      ["start", "quiz", "blocked", "warn"].forEach((id) => ($(id).hidden = true));
      const box = $("result"); box.hidden = false;
      const left = allowed(r) - r.used;
      box.className = "card verdict " + (last.g >= 7 ? "pass" : "fail");
      $("rwho").textContent = `${name}, ${cls}`;
      $("rbig").textContent = `${last.g} / 12`;
      $("rbig").style.setProperty("--p", String(last.g / 12));
      $("rstamp").textContent = last.reason || (left > 0 ? `Залишилось спроб: ${left}` : "Тест завершено");
      const rep = $("report"); rep.innerHTML = "";
      r.attempts.forEach((a) => {
        const row = document.createElement("div"); row.className = "rrow";
        row.innerHTML = `<b></b><span>Правильних відповідей</span><em>${a.score} з ${a.total}</em><span>Оцінка</span><em>${a.g}</em>` + (a.viol ? `<span>Виходів із тесту</span><em>${a.viol}</em>` : "");
        row.firstChild.textContent = `Спроба ${a.no} · ${fmt(a.at)}`;
        rep.appendChild(row);
      });
      const showReview = INSTANT || T.review === "always" || (left <= 0 && T.review !== "never");
      if (showReview) {
        const wrong = last.results.filter((x) => !x.ok);
        if (wrong.length) {
          const det = document.createElement("details"); det.className = "review";
          det.innerHTML = "<summary>Помилки й правильні відповіді</summary>";
          wrong.forEach((w) => {
            const p = w.b !== undefined && window.EGGS ? bonusQ(w.b) : parseVariant(T.slots[w.sl][w.v]);
            const it = document.createElement("div"); it.className = "rv";
            it.innerHTML = '<p></p><p class="ra bad"></p><p class="ra good"></p><p class="muted small"></p>';
            it.children[0].textContent = p.q;
            it.children[1].textContent = "✗ " + (w.a === null ? "без відповіді (вихід із тесту або час)" : w.a);
            it.children[2].textContent = "✓ " + correctText(p);
            it.children[3].textContent = p.x || "";
            det.appendChild(it);
          });
          rep.appendChild(det);
        }
      }
      $("again").hidden = left <= 0; $("again").onclick = () => newAttempt(cls, name);
      setupUnlock("unlockR", cls, name, left <= 0);
      $("nextStudent").hidden = false;
      if (window.EGGS && EGGS.onResult) EGGS.onResult(last.g, box, T, name);
    }

    function showBlocked(cls, name) {
      ["start", "quiz", "result"].forEach((id) => ($(id).hidden = true));
      $("blocked").hidden = false;
      $("bwho").textContent = `${name}, ${cls}: усі спроби використано.`;
      const r = rec(cls, name), last = r.attempts[r.attempts.length - 1];
      $("blast").textContent = last ? `Остання оцінка: ${last.g} / 12 (${fmt(last.at)}).` : "";
      setupUnlock("unlockB", cls, name, true);
    }

    function setupUnlock(prefix, cls, name, visible) {
      const wrap = $(prefix); wrap.hidden = !visible;
      const inp = $(prefix + "Pwd"), btn = $(prefix + "Btn"), msg = $(prefix + "Msg");
      inp.value = ""; msg.textContent = "";
      btn.onclick = () => {
        if (!checkTeacher(inp.value)) { msg.textContent = "Неправильний пароль."; inp.value = ""; return; }
        const r = rec(cls, name); r.extra = (r.extra || 0) + 1; saveRec(cls, name, r);
        newAttempt(cls, name);
      };
      inp.onkeydown = (e) => { if (e.key === "Enter") btn.click(); };
    }

    /* «Новий учень» — утримувати 2 с, щоб випадково не скинути екран */
    const hold = $("nextStudent");
    const holdStart = (e) => { e.preventDefault(); holdTimer = setTimeout(toStart, 1500); };
    const holdEnd = () => clearTimeout(holdTimer);
    ["mousedown", "touchstart"].forEach((t) => hold.addEventListener(t, holdStart));
    ["mouseup", "mouseleave", "touchend", "touchcancel"].forEach((t) => hold.addEventListener(t, holdEnd));
    $("bback").onclick = toStart;
    function toStart() {
      ["quiz", "result", "blocked", "warn"].forEach((id) => ($(id).hidden = true));
      $("start").hidden = false; $("name").value = ""; sel.value = "";
      if (codeInp) codeInp.value = "";
      showGate(); validStart();
    }

    /* Відновлення після перезавантаження сторінки */
    const saved = store.get(KEY_ACTIVE);
    if (saved && saved.order) { st = saved; openQuiz(); const w = $("warn"); w.textContent = "Тест продовжено після перезавантаження. Запитання, на якому ти вийшов, згоріло."; w.hidden = false; }
    flush();
  }

  /* ================================================================ РЕЄСТР ТЕСТІВ */
  window.TESTS = window.TESTS || { list: [], add(t) { this.list.push(t); } };
  window.QZ = { runTest, sha256, checkTeacher, store, flush, grade12, parseVariant, kyivHour, checkLessonCode, needCode, unlockLesson, lessonIdOf, normWord };
})();
