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
    $("pBack").href = l ? `index.html?l=${l.id}` : "index.html";
    $("pEyebrow").textContent = `Інформатика · ${p.grade} клас · Урок ${p.lesson}`;
    $("pTitle").textContent = p.title;
    $("pGoal").textContent = p.goal || "";
    $("pSafety").hidden = !p.safety;
    const lessonId = QZ.lessonIdOf(p.grade, p.lesson);
    if (QZ.needCode(lessonId, "practice")) setupGate(lessonId, () => showPractice(p));
    else showPractice(p);
  }

  function showPractice(p) {
    $("pCard").hidden = false;
    if (p.tool && !$("pTool")) { const link = actLink({ tool: p.tool }); if (link) { link.id = "pTool"; $("pTabs").before(link); } }

    const modes = Object.keys(p.modes);
    // first — вкладка за замовчуванням саме цієї практичної (вибір запам'ятовується окремо для неї)
    const modeKey = p.first ? `prac:${p.id}:mode` : "prac:mode";
    let mode = store.get(modeKey, p.first || null);
    if (!modes.includes(mode)) mode = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && modes.includes("phone") ? "phone" : modes[0];
    const doneKey = () => `prac:${p.id}:${mode}`;

    const draw = () => {
      const tabs = $("pTabs"); tabs.innerHTML = ""; tabs.hidden = modes.length < 2;
      modes.forEach((m) => {
        const b = el("button", m === mode ? "on" : "", p.modes[m].label);
        b.onclick = () => { mode = m; store.set(modeKey, m); draw(); };
        tabs.appendChild(b);
      });
      const M = p.modes[mode];
      $("pNote").textContent = M.note || ""; $("pNote").hidden = !M.note;
      const done = store.get(doneKey(), []);
      const ol = $("pSteps"); ol.innerHTML = "";
      M.steps.forEach((s, i) => {
        const li = el("li", "step" + (done.includes(i) ? " done" : ""));
        const lab = el("label");
        const cb = el("input"); cb.type = "checkbox"; cb.checked = done.includes(i);
        cb.onchange = () => {
          const cur = new Set(store.get(doneKey(), []));
          cb.checked ? cur.add(i) : cur.delete(i);
          store.set(doneKey(), [...cur]); li.classList.toggle("done", cb.checked); progress();
        };
        lab.append(cb, el("span", "n", String(i + 1)), el("span", "", s));
        li.appendChild(lab); ol.appendChild(li);
      });
      const progress = () => {
        const n = store.get(doneKey(), []).length, all = M.steps.length;
        $("pProg").textContent = n === all ? "Усі кроки виконано — покажи результат учителеві." : `Виконано кроків: ${n} з ${all}`;
        $("pProg").className = "prog" + (n === all ? " full" : "");
      };
      progress();
    };
    draw();

    const tb = $("pCrit"); tb.innerHTML = "";
    let sum = 0;
    (p.criteria || []).forEach(([c, b]) => { const tr = el("tr"); tr.append(el("td", "", c), el("td", "pts", String(b))); tb.appendChild(tr); sum += b; });
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
