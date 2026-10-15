/* Сторінки уроків, практичних робіт і QR-кодів. Дані: lessons.js, tests/*.js, practice/*.js. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const params = new URLSearchParams(location.search);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const SITE = (window.CONFIG && window.CONFIG.SITE_URL) || "https://musthav6.github.io/informatyka/";
  const lessonUrl = (id) => `${SITE}?l=${id}`;

  window.PRACTICE = window.PRACTICE || { list: [], add(p) { this.list.push(p); } };

  // Мітка версії з власного <script src="assets/site.js?v=…"> — щоб і підвантажені тести бралися свіжі
  const V = (() => { try { return new URL(document.currentScript.src).searchParams.get("v") || ""; } catch (e) { return ""; } })();
  const withV = (src) => (V ? `${src}?v=${V}` : src);
  function loadAll(dir, files) {
    return Promise.all((files || []).map((f) => new Promise((ok) => {
      const s = document.createElement("script"); s.src = withV(dir + f); s.onload = s.onerror = ok; document.body.appendChild(s);
    })));
  }
  const ready = () => Promise.all([loadAll("tests/", window.TEST_FILES), loadAll("practice/", window.PRACTICE_FILES)]);
  const findTest = (id) => (window.TESTS ? TESTS.list.find((t) => t.id === id) : null);
  const findPractice = (id) => PRACTICE.list.find((p) => p.id === id);
  const lessonOf = (grade, n) => (window.LESSONS || []).find((l) => l.grade === grade && l.n === n);

  const kindOf = (a) => (a.tool ? "tool" : a.practice ? "practice" : (findTest(a.test) || {}).kind || "train");
  const TOOLS = { animator: { href: "animator.html", title: "«Аніматор Ліцею» — редактор анімації", meta: "Працює в браузері: комп'ютер і телефон · без входу" } };

  /* Поле «Код уроку»: показати, перевірити, після успіху — onOpen() */
  function setupGate(lessonId, onOpen) {
    const inp = $("gateCode"), btn = $("gateBtn"), msg = $("gateMsg");
    $("gate").hidden = false;
    btn.onclick = () => {
      if (QZ.unlockLesson(lessonId, inp.value)) { $("gate").hidden = true; onOpen(); return; }
      msg.textContent = "Неправильний код уроку. Запитай учителя."; inp.value = ""; inp.focus();
    };
    inp.oninput = () => (msg.textContent = "");
    inp.onkeydown = (e) => { if (e.key === "Enter") btn.click(); };
  }

  // 1–4, 21–24… → «запитання», решта → «запитань»
  const fewForm = (n) => n % 10 >= 1 && n % 10 <= 4 && !(n % 100 >= 11 && n % 100 <= 14);
  /* Опис однієї дії уроку: посилання, назва, бейдж, підпис */
  function actInfo(a) {
    if (a.tool) {
      const t = TOOLS[a.tool];
      return t ? { href: t.href, title: t.title, badge: "Редактор", cls: "tool", icon: "🎬", meta: t.meta } : null;
    }
    if (a.practice) {
      const p = findPractice(a.practice);
      if (!p) return null;
      return { href: `practice.html?p=${encodeURIComponent(p.id)}`, title: p.title, badge: "Практична", cls: "prac", icon: "🛠️", meta: "Покроково · комп'ютер або телефон" };
    }
    const t = findTest(a.test);
    if (!t) return null;
    const diag = t.kind === "diag", tema = t.id.includes("tema"), sim = !!t.sim;
    return {
      href: `test.html?t=${encodeURIComponent(t.id)}`, title: t.title, badge: diag ? (tema ? "Тематичне" : "Діагностувальна") : sim ? "Симулятор" : "Тренажер",
      cls: diag ? "diag" : sim ? "sim" : "", icon: diag ? (tema ? "🏁" : "🎯") : sim ? "🕹️" : "🧠",
      meta: `${t.slots.length} ${(sim ? "завдан" : "запитан") + (fewForm(t.slots.length) ? "ня" : "ь")}${t.minutes ? " · " + t.minutes + " хв" : ""} · спроб: ${t.attempts || 1}`
    };
  }

  function actLink(a) {
    const info = actInfo(a);
    if (!info) return null;
    const link = el("a", "titem"); link.href = info.href;
    const ico = el("span", "ticon " + info.cls, info.icon); ico.setAttribute("aria-hidden", "true");
    const body = el("span", "tbody");
    body.append(el("span", "t", info.title), el("span", "small muted", info.meta));
    const side = el("span", "tside");
    side.append(el("span", "badge " + info.cls, info.badge), el("span", "arrow", "→"));
    side.lastChild.setAttribute("aria-hidden", "true");
    link.append(ico, body, side);
    return link;
  }

  /* ================================================================ ГОЛОВНА: перелік уроків */
  function renderIndex() {
    const id = params.get("l");
    const lesson = id && (window.LESSONS || []).find((l) => l.id === id);
    if (lesson) { renderLesson(lesson); return; }
    $("listView").hidden = false;
    const grades = [...new Set(LESSONS.map((l) => String(l.grade)))];
    let grade = params.get("g") || store.get("site:grade", grades[0]);
    if (!grades.includes(grade)) grade = grades[0];
    const draw = () => {
      const tabs = $("tabs"); tabs.innerHTML = "";
      grades.forEach((g) => {
        const b = el("button", g === grade ? "on" : "", g + " клас"); b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(g === grade));
        b.onclick = () => { grade = g; store.set("site:grade", g); draw(); };
        tabs.appendChild(b);
      });
      const list = $("list"); list.innerHTML = "";
      LESSONS.filter((l) => String(l.grade) === grade).forEach((l) => {
        const card = el("a", "lcard"); card.href = `?l=${l.id}`;
        const no = el("span", "lno", String(l.n)); no.setAttribute("aria-hidden", "true");
        const body = el("span", "lbody");
        body.appendChild(el("span", "lnum", `Урок ${l.n}${l.alt ? " · " + l.alt : ""}`));
        body.appendChild(el("span", "t", l.title));
        const chips = el("span", "chips");
        l.acts.forEach((a) => { const i = actInfo(a); if (i) chips.appendChild(el("span", "badge " + i.cls, `${i.icon} ${i.badge}`)); });
        body.appendChild(chips);
        card.append(no, body);
        list.appendChild(card);
      });
    };
    draw();
  }

  /* ================================================================ СТОРІНКА УРОКУ */
  function renderLesson(l) {
    document.title = `Урок ${l.n}. ${l.title}`;
    $("lessonView").hidden = false;
    $("back").href = `?g=${l.grade}`;
    $("lEyebrow").textContent = `Інформатика · ${l.grade} клас${l.alt ? " · " + l.alt : ""}`;
    $("lNo").textContent = l.n;
    $("lTitle").textContent = l.title;
    $("lBook").textContent = l.book ? `Підручник: ${l.book}` : "";

    // нові уроки (з 7-го): «Коротко — на 9 балів» з абзацами суті, а ⭐-визначення для 12 — у повному конспекті
    $("shortTitle").textContent = l.brief ? "Коротко — на 9 балів" : "Теорія коротко";
    $("fullTitle").textContent = l.plus ? "Повний конспект — на 12 балів" : "Повний конспект";
    $("plusLegend").hidden = !l.plus;
    const brief = $("brief"); brief.innerHTML = ""; brief.hidden = !(l.brief && l.brief.length);
    (l.brief || []).forEach((t) => brief.appendChild(el("p", "", t)));
    const defs = $("defs"); defs.innerHTML = "";
    $("writeHint").hidden = !(l.defs && l.defs.length);
    (l.defs || []).forEach(([term, text]) => {
      const d = el("div", "def");
      d.appendChild(el("b", "", term)); d.appendChild(document.createTextNode(" — " + text));
      defs.appendChild(d);
    });
    // повний конспект: notes/<клас>.js генерує tools/make_notes.py з Google Docs (без відповідей)
    loadAll("notes/", [`${l.grade}.js`]).then(() => {
      const html = window.NOTES && NOTES[l.id];
      if (!html) return;
      $("notes").innerHTML = html;
      $("notesWrap").hidden = false;
    });
    const key = $("key"); key.innerHTML = "";
    (l.key || []).forEach((k) => key.appendChild(el("li", "", k)));
    $("keyWrap").hidden = !(l.key && l.key.length);

    const acts = $("acts"), tools = $("toolActs"); acts.innerHTML = ""; tools.innerHTML = "";
    // редактори (tool) відкриваються без коду уроку — окремим списком над полем коду
    l.acts.forEach((a) => { const link = actLink(a); if (link) (a.tool ? tools : acts).appendChild(link); });
    tools.hidden = !tools.children.length;
    $("qrLink").href = `qr.html?l=${l.id}`;
    if (l.acts.some((a) => QZ.needCode(l.id, kindOf(a)))) {
      acts.classList.add("dim"); acts.setAttribute("aria-disabled", "true");
      setupGate(l.id, () => { acts.classList.remove("dim"); acts.removeAttribute("aria-disabled"); });
    }
  }

  /* ================================================================ ПРАКТИЧНА РОБОТА */
  function renderPractice() {
    const p = findPractice(params.get("p"));
    if (!p) { $("pTitle").textContent = "Практичну роботу не знайдено"; return; }
    const l = lessonOf(p.grade, p.lesson);
    document.title = p.title;
    $("pBack").href = $("pBack2").href = l ? `index.html?l=${l.id}` : "index.html";
    $("pEyebrow").textContent = `Інформатика · ${p.grade} клас · Урок ${p.lesson}`;
    $("pTitle").textContent = p.title;
    $("pGoal").textContent = p.goal || "";
    $("pSafety").hidden = !p.safety;
    const lessonId = QZ.lessonIdOf(p.grade, p.lesson);
    if (QZ.needCode(lessonId, "practice")) setupGate(lessonId, () => showPractice(p));
    else showPractice(p);
  }

  /* Розмітка в текстах практичних: `Пр1_Шевченко` → моноширинний «код», **слово** → жирне, [Ctrl + C] → клавіші ([Ctrl + Shift + ]] — клавіша «]»). */
  function rich(text) {
    const box = document.createDocumentFragment();
    String(text).split(/(`[^`]+`|\*\*[^*]+\*\*|\[(?:[^\]]|\](?=\]))+\])/).forEach((part) => {
      if (!part) return;
      if (part[0] === "`") box.appendChild(el("code", "fname", part.slice(1, -1)));
      else if (part.startsWith("**")) box.appendChild(el("b", "", part.slice(2, -2)));
      else if (part[0] === "[" && part.length > 2) {
        const k = el("span", "keys");
        part.slice(1, -1).split(/\s*\+\s*/).forEach((key, i) => { if (i) k.append(" + "); k.appendChild(el("kbd", "", key)); });
        box.appendChild(k);
      } else box.append(part);
    });
    return box;
  }
  const richEl = (tag, cls, text) => { const e = el(tag, cls); e.appendChild(rich(text)); return e; };

  /* Ілюстрації (SVG у кольорах теми). У даних: img: "disks" | "newfolder" | "name" | "save" */
  const ILLUS = {
    disks: `<svg viewBox="0 0 340 200" role="img" aria-label="Вікно «Цей ПК»: диск C: закреслено, диски D: і E: позначено як дозволені">
      <rect x="1" y="1" width="338" height="198" rx="12" fill="var(--surface)" stroke="var(--line-2)"/>
      <rect x="1" y="1" width="338" height="30" rx="12" fill="var(--surface-2)"/><rect x="1" y="20" width="338" height="11" fill="var(--surface-2)"/>
      <text x="14" y="21" font-size="13" font-weight="600" fill="var(--fg)">🖥 Цей ПК</text>
      <text x="14" y="52" font-size="11" fill="var(--muted)">Пристрої та диски</text>
      <g transform="translate(12,62)">
        <rect width="100" height="74" rx="10" fill="var(--fail-soft)" stroke="var(--fail)" stroke-width="1.5"/>
        <text x="50" y="28" text-anchor="middle" font-size="22">💽</text>
        <line x1="32" y1="8" x2="68" y2="36" stroke="var(--fail)" stroke-width="3" stroke-linecap="round"/>
        <line x1="68" y1="8" x2="32" y2="36" stroke="var(--fail)" stroke-width="3" stroke-linecap="round"/>
        <text x="50" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fg)">Диск C:</text>
        <text x="50" y="66" text-anchor="middle" font-size="14" font-weight="700" fill="var(--fail)">✕</text>
        <text x="50" y="94" text-anchor="middle" font-size="11" font-weight="600" fill="var(--fail)">не сюди —</text>
        <text x="50" y="108" text-anchor="middle" font-size="11" font-weight="600" fill="var(--fail)">тут Windows</text>
      </g>
      <g transform="translate(120,62)">
        <rect width="100" height="74" rx="10" fill="var(--pass-soft)" stroke="var(--pass)" stroke-width="1.5"/>
        <text x="50" y="28" text-anchor="middle" font-size="22">💽</text>
        <text x="50" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fg)">Диск D:</text>
        <text x="50" y="66" text-anchor="middle" font-size="14" font-weight="700" fill="var(--pass)">✓</text>
        <text x="50" y="94" text-anchor="middle" font-size="11" font-weight="600" fill="var(--pass)">можна</text>
      </g>
      <g transform="translate(228,62)">
        <rect width="100" height="74" rx="10" fill="var(--pass-soft)" stroke="var(--pass)" stroke-width="1.5"/>
        <text x="50" y="28" text-anchor="middle" font-size="22">💽</text>
        <text x="50" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="var(--fg)">Диск E:</text>
        <text x="50" y="66" text-anchor="middle" font-size="14" font-weight="700" fill="var(--pass)">✓</text>
        <text x="50" y="94" text-anchor="middle" font-size="11" font-weight="600" fill="var(--pass)">теж можна</text>
      </g>
      <text x="170" y="190" text-anchor="middle" font-size="11" fill="var(--muted)">Букви бувають різні (D:, E:, F:…). Головне — не C:</text>
    </svg>`,
    newfolder: `<svg viewBox="0 0 340 170" role="img" aria-label="Контекстне меню: Створити, потім Папку">
      <rect x="1" y="1" width="338" height="168" rx="12" fill="var(--surface)" stroke="var(--line-2)"/>
      <text x="14" y="24" font-size="12" fill="var(--muted)">1. Правою кнопкою миші — на порожнє місце</text>
      <path d="M40 40 l0 22 l6 -5 l4 9 l4 -2 l-4 -9 l8 0 z" fill="var(--fg)" stroke="var(--surface)" stroke-width="1"/>
      <g transform="translate(58,48)">
        <rect width="120" height="104" rx="8" fill="var(--surface-2)" stroke="var(--line-2)"/>
        <text x="12" y="22" font-size="12" fill="var(--muted)">Вигляд</text>
        <text x="12" y="44" font-size="12" fill="var(--muted)">Сортувати</text>
        <rect x="4" y="54" width="112" height="24" rx="5" fill="var(--accent-soft)"/>
        <text x="12" y="70" font-size="12" font-weight="700" fill="var(--accent-ink)">Створити</text>
        <text x="104" y="70" font-size="12" fill="var(--accent-ink)">▸</text>
        <text x="12" y="96" font-size="12" fill="var(--muted)">Властивості</text>
      </g>
      <g transform="translate(182,94)">
        <rect width="140" height="58" rx="8" fill="var(--surface-2)" stroke="var(--line-2)"/>
        <rect x="4" y="6" width="132" height="24" rx="5" fill="var(--accent-soft)"/>
        <text x="12" y="22" font-size="12" font-weight="700" fill="var(--accent-ink)">📁 Папку</text>
        <text x="12" y="48" font-size="12" fill="var(--muted)">📄 Текстовий документ</text>
      </g>
      <text x="182" y="80" font-size="12" fill="var(--muted)">2. Створити → Папку</text>
    </svg>`,
    name: `<svg viewBox="0 0 340 176" role="img" aria-label="Ім'я ПР1_Шевченко: номер роботи, знак підкреслення, твоє прізвище">
      <rect x="1" y="1" width="338" height="174" rx="12" fill="var(--surface)" stroke="var(--line-2)"/>
      <g font-family="ui-monospace,Consolas,monospace" font-size="26" font-weight="700">
        <rect x="24" y="22" width="70" height="44" rx="8" fill="var(--accent-soft)"/><text x="59" y="53" text-anchor="middle" fill="var(--accent-ink)">ПР1</text>
        <rect x="100" y="22" width="34" height="44" rx="8" fill="var(--warn-soft)"/><text x="117" y="53" text-anchor="middle" fill="var(--warn)">_</text>
        <rect x="140" y="22" width="176" height="44" rx="8" fill="var(--pass-soft)"/><text x="228" y="53" text-anchor="middle" fill="var(--pass)">Шевченко</text>
      </g>
      <g font-size="11" fill="var(--muted)" text-anchor="middle">
        <text x="59" y="84">номер роботи</text><text x="117" y="84">знак</text><text x="117" y="97">«_»</text>
        <text x="228" y="84">ТВОЄ прізвище,</text><text x="228" y="97">а не слово «Прізвище»</text>
      </g>
      <text x="14" y="130" font-size="12" fill="var(--fg)">Знак «_»:</text>
      <g transform="translate(76,113)" font-size="12" font-weight="700" fill="var(--fg)">
        <rect width="54" height="26" rx="5" fill="var(--surface-2)" stroke="var(--line-2)"/><text x="27" y="17" text-anchor="middle">Shift</text>
        <text x="66" y="17" text-anchor="middle">+</text>
        <rect x="78" width="30" height="26" rx="5" fill="var(--surface-2)" stroke="var(--line-2)"/><text x="93" y="12" text-anchor="middle" font-size="11">_</text><text x="93" y="23" text-anchor="middle" font-size="11">-</text>
      </g>
      <text x="194" y="130" font-size="11" fill="var(--muted)">клавіша праворуч від 0</text>
      <text x="170" y="160" text-anchor="middle" font-size="11" fill="var(--muted)">Дефіс теж годиться: ПР1-Шевченко. Пробіли — ні.</text>
    </svg>`,
    save: `<svg viewBox="0 0 340 150" role="img" aria-label="Вікно «Зберегти як»: обрати папку, вписати ім'я, натиснути Зберегти">
      <rect x="1" y="1" width="338" height="148" rx="12" fill="var(--surface)" stroke="var(--line-2)"/>
      <text x="14" y="22" font-size="13" font-weight="600" fill="var(--fg)">Зберегти як</text>
      <rect x="14" y="32" width="312" height="26" rx="6" fill="var(--accent-soft)"/>
      <text x="22" y="49" font-size="11" fill="var(--accent-ink)">① Папка: Цей ПК › D: › 5-Б › ПР1_Шевченко</text>
      <text x="14" y="80" font-size="11" fill="var(--muted)">Ім'я файлу:</text>
      <rect x="84" y="66" width="242" height="22" rx="5" fill="var(--warn-soft)" stroke="var(--warn)"/>
      <text x="92" y="81" font-size="12" font-family="ui-monospace,Consolas,monospace" fill="var(--fg)">② Афіша_Шевченко</text>
      <text x="14" y="108" font-size="11" fill="var(--muted)">Тип файлу: залиш, як є</text>
      <rect x="236" y="116" width="90" height="24" rx="6" fill="var(--accent)"/>
      <text x="281" y="132" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">③ Зберегти</text>
    </svg>`
  };
  const illus = (key) => { if (!ILLUS[key]) return null; const f = el("figure", "illus"); f.innerHTML = ILLUS[key]; return f; };

  // Довідник типових проблем (practice/index.js → PRACTICE_HELP). В даних: "disk" або [питання, відповідь(і), img?]
  const helpItem = (h) => {
    if (typeof h === "string") return (window.PRACTICE_HELP || {})[h] || null;
    if (Array.isArray(h)) return { q: h[0], a: h[1], img: h[2] };
    return h;
  };
  function helpBlock(item, cls) {
    const d = el("details", cls || "qa");
    d.appendChild(richEl("summary", "", item.q));
    const body = el("div", "qa-body");
    (Array.isArray(item.a) ? item.a : [item.a]).forEach((t) => body.appendChild(richEl("p", "", t)));
    const fig = item.img && illus(item.img); if (fig) body.appendChild(fig);
    d.appendChild(body);
    return d;
  }

  function showPractice(p) {
    $("pCard").hidden = false;
    if (p.tool && !$("pTool")) { const link = actLink({ tool: p.tool }); if (link) { link.id = "pTool"; $("pTabs").before(link); } }

    const modes = Object.keys(p.modes);
    // first — вкладка за замовчуванням саме цієї практичної (вибір запам'ятовується окремо для неї)
    const modeKey = p.first ? `prac:${p.id}:mode` : "prac:mode";
    let mode = store.get(modeKey, p.first || null);
    if (!modes.includes(mode)) mode = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && modes.includes("phone") ? "phone" : modes[0];
    // :2 — кроки переписано (жовтень 2026), старі галочки не підходять за номерами
    const doneKey = () => `prac:${p.id}:${mode}:2`;

    const draw = () => {
      const tabs = $("pTabs"); tabs.innerHTML = ""; tabs.hidden = modes.length < 2;
      modes.forEach((m) => {
        const b = el("button", m === mode ? "on" : "", p.modes[m].label);
        b.onclick = () => { mode = m; store.set(modeKey, m); draw(); };
        tabs.appendChild(b);
      });
      const M = p.modes[mode];
      const note = $("pNote"); note.innerHTML = ""; if (M.note) note.appendChild(rich(M.note)); note.hidden = !M.note;

      // «Перш ніж почати» — що означають слова з завдання
      const prep = $("pPrep"); prep.innerHTML = "";
      (M.prep || []).forEach((it) => {
        const box = el("div", "prep-item");
        box.appendChild(richEl("p", "", typeof it === "string" ? it : it.t));
        const fig = it.img && illus(it.img); if (fig) box.appendChild(fig);
        prep.appendChild(box);
      });
      $("pPrepWrap").hidden = !(M.prep && M.prep.length);

      const done = store.get(doneKey(), []);
      const ol = $("pSteps"); ol.innerHTML = "";
      M.steps.forEach((raw, i) => {
        const s = typeof raw === "string" ? { t: raw } : raw;
        const li = el("li", "step" + (done.includes(i) ? " done" : ""));
        const lab = el("label");
        const cb = el("input"); cb.type = "checkbox"; cb.checked = done.includes(i);
        cb.onchange = () => {
          const cur = new Set(store.get(doneKey(), []));
          cb.checked ? cur.add(i) : cur.delete(i);
          store.set(doneKey(), [...cur]); li.classList.toggle("done", cb.checked); progress();
        };
        lab.append(cb, el("span", "n", String(i + 1)), richEl("span", "stext", s.t));
        li.appendChild(lab);
        // Деталі — поза <label>, щоб клік по підказці не ставив галочку
        if (s.how || s.hint || s.img) {
          const ex = el("div", "step-extra");
          if (s.how) { const how = el("ol", "how"); s.how.forEach((h) => how.appendChild(richEl("li", "", h))); ex.appendChild(how); }
          const fig = s.img && illus(s.img); if (fig) ex.appendChild(fig);
          if (s.hint) {
            const d = el("details", "tip"); d.appendChild(el("summary", "", "💡 Підказка"));
            (Array.isArray(s.hint) ? s.hint : [s.hint]).forEach((t) => d.appendChild(richEl("p", "", t)));
            ex.appendChild(d);
          }
          li.appendChild(ex);
        }
        ol.appendChild(li);
      });
      const progress = () => {
        const n = store.get(doneKey(), []).length, all = M.steps.length;
        $("pProg").textContent = n === all ? "Усі кроки виконано — покажи результат учителеві." : `Виконано кроків: ${n} з ${all}`;
        $("pProg").className = "prog" + (n === all ? " full" : "");
      };
      progress();

      // «Якщо щось не виходить»
      const help = $("pHelp"); help.innerHTML = "";
      (M.trouble || []).map(helpItem).filter(Boolean).forEach((it) => help.appendChild(helpBlock(it)));
      $("pHelpWrap").hidden = !help.children.length;
    };
    draw();

    const tb = $("pCrit"); tb.innerHTML = "";
    let sum = 0;
    (p.criteria || []).forEach(([c, b]) => { const tr = el("tr"); tr.append(richEl("td", "", c), el("td", "pts", String(b))); tb.appendChild(tr); sum += b; });
    const tr = el("tr", "sum"); tr.append(el("td", "", "Разом"), el("td", "pts", String(sum))); tb.appendChild(tr);
    $("pCritWrap").hidden = !(p.criteria && p.criteria.length);

    if (p.check && findTest(p.check)) {
      const link = actLink({ test: p.check });
      $("pCheck").appendChild(link); $("pCheckWrap").hidden = false;
    }
  }

  /* ================================================================ QR-КОДИ */
  function renderQR() {
    if (params.get("l") === "home") {
      document.body.classList.add("projector");
      $("qrOne").hidden = false;
      $("qoTitle").textContent = "Інформатика · Вінницький ліцей №2";
      $("qoSub").textContent = "Уроки, тренажери й тести";
      $("qoImg").src = "qr/home.svg";
      $("qoUrl").textContent = SITE.replace(/^https:\/\//, "");
      $("qoBack").href = "index.html";
      return;
    }
    const one = (window.LESSONS || []).find((l) => l.id === params.get("l"));
    if (one) {
      document.body.classList.add("projector");
      $("qrOne").hidden = false;
      $("qoTitle").textContent = `${one.grade} клас · Урок ${one.n}`;
      $("qoSub").textContent = one.title;
      $("qoImg").src = `qr/${one.id}.svg`;
      $("qoUrl").textContent = lessonUrl(one.id).replace(/^https:\/\//, "");
      $("qoBack").href = `index.html?l=${one.id}`;
      return;
    }
    $("qrAll").hidden = false;
    const box = $("qrGrid"); box.innerHTML = "";
    const home = el("a", "qcard qhome"); home.href = "?l=home";
    const himg = el("img"); himg.src = "qr/home.svg"; himg.alt = "QR-код головної сторінки";
    home.append(himg, el("b", "", "Головна сторінка"), el("span", "small", "Усі уроки, тренажери й тести"), el("code", "", SITE.replace(/^https:\/\//, "")));
    box.appendChild(home);
    LESSONS.forEach((l) => {
      const c = el("a", "qcard"); c.href = `?l=${l.id}`;
      const img = el("img"); img.src = `qr/${l.id}.svg`; img.alt = `QR-код уроку ${l.id}`; img.loading = "lazy";
      c.append(img, el("b", "", `${l.grade} клас · Урок ${l.n}`), el("span", "small", l.title), el("code", "", `?l=${l.id}`));
      box.appendChild(c);
    });
  }

  window.SITE = { ready, renderIndex, renderLesson, renderPractice, renderQR, lessonOf };
})();
