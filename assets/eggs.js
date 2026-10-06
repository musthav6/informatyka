/* Пасхалки. Вимкнути бонус-питання: CONFIG.EGG_CHANCE = 0. Додати своє — у список bonus нижче
   (формат як у тестах: правильна відповідь перша). Оновлюємо з кожним новим набором тем.
   Сучасний сленг («аура», «могаю», «сігма»…) — лише тут, у розважальному шарі, на прохання вчителя (06.10.2026);
   у теорії, конспектах і завданнях — тільки літературна мова. Лайки — ніде. */
(function () {
  "use strict";

  /* Бонус-питання: з імовірністю CONFIG.EGG_CHANCE (типово 1 зі 100) замість звичайного питання
     в тренажері випадає дуже легке й не про інформатику. Не більше одного на спробу.
     У діагностувальних і тематичних — ніколи (CONFIG.EGG_KINDS). */
  const bonus = [
    ["Яке число йде після 66?", ["67", "68", "65", "666"], "Шість… сім! 🤷 Так, ми теж знаємо цей мем."],
    ["Скільки буде 6 + 1?", ["7", "6", "67", "61"], "Сім. А хтось точно хотів відповісти «67» 😄"],
    ["Скільки буде 60 + 7?", ["67", "13", "607", "76"], "Ну звісно ж 67 🤷"],
    ["Скільки буде 7 − 1?", ["6", "8", "71", "0"], "Шість. А тепер додай до неї сім… 🤷"],
    ["Бомбардіро Крокоділо — це…", ["Крокодил-літак із мемів", "Новий процесор", "Операційна система для холодильників", "Вид шрифту"], "Інформатики тут нуль, зате бал — твій 🐊✈️"],
    { tf: false, q: "Так чи ні: Бомбардіро Крокоділо — новий потяг Укрзалізниці.", x: "Ні 😄 Укрзалізниця возить потягами, а не крокодилами." },
    ["Скільки лап у кота?", ["4", "3", "5", "Залежить від Wi-Fi"], "Чотири. А хвостом кіт натискає Enter, коли ти відвернувся."],
    ["Скільки ніг у павука?", ["8", "6", "4", "10"], "Вісім — як бітів у байті. Збіг? 🕷️"],
    ["Який звук видає корова?", ["Му", "Мяу", "Гав", "Біп-біп"], "Му! 🐄 Чистий звук, без перешкод."],
    ["Що з цього — фрукт?", ["Яблуко", "Принтер", "Монітор", "Флешка"], "Яблуко. Хоча буває й надкушене на ноутбуці 😉"],
    ["Що з цього можна з'їсти?", ["Бутерброд", "Клавіатуру", "Флешку", "Wi-Fi"], "Бутерброд. Тільки не над клавіатурою!"],
    ["Яке з цих слів — назва кольору?", ["Зелений", "Монітор", "Понеділок", "Бутерброд"], "Зелений. Як кнопка «Почати» на нашому сайті… майже 🙂"],
    ["Якого кольору небо в ясний день?", ["Блакитного", "Зеленого", "У клітинку", "Кольору #FF0000"], "Блакитного. А #FF0000 — це червоний, знадобиться на уроці про кольори."],
    ["Скільки днів у тижні?", ["7", "5", "10", "Залежить від канікул"], "Сім. Канікули, на жаль, на це не впливають."],
    ["Скільки місяців у році?", ["12", "10", "7", "52"], "Дванадцять. А тижнів — 52, але це вже інше питання 😉"],
    ["Яка пора року настає після осені?", ["Зима", "Весна", "Літо", "Осінь 2.0"], "Зима ❄️ Час для гарячого чаю й тренажерів."],
    ["Скільки буде 2 + 2?", ["4", "22", "5", "Помилка 404"], "Чотири. Навіть без калькулятора."],
    ["Що робить будильник?", ["Будить", "Друкує", "Готує сніданок", "Літає"], "Будить. На жаль, навіть у понеділок ⏰"],
    ["Що кажуть у відповідь на «дякую»?", ["Будь ласка", "Ctrl + Z", "Перезавантаж", "404"], "«Будь ласка». Ввічливість працює й без інтернету."],
    ["Як привітатися з учителем?", ["Добрий день!", "Ctrl + Alt + Del", "Помилка 404", "Біп-біп"], "Добрий день! І вчитель уже усміхається 🙂"],
    ["Хто веде в тебе інформатику?", ["Денис Анатолійович", "Бомбардіро Крокоділо", "Робот-пилосос", "Ніхто, вона сама"], "Правильно! І він радий, що тобі випало це питання 🙂"],
    ["Яке місто — столиця України?", ["Київ", "Вінниця", "Бомбардіро-Сіті", "Інтернет"], "Київ. Хоча Вінниця теж чудова 💙💛"],
    ["У якому місті твій ліцей?", ["Вінниця", "Нью-Йорк", "Хмарне сховище", "Бомбардіро-Сіті"], "Вінниця! Ліцей №2 передає привіт 👋"],
    { tf: true, q: "Так чи ні: зараз ти проходиш тест з інформатики.", x: "Так! Бонус зараховано 🎁" },
    ["Що в мемах означає «+1000 аури»?", ["Хтось зробив щось дуже круте", "Зарядився телефон", "Пішов дощ", "Нова оцінка з фізики"], "Саме так ✨ А за правильну відповідь — ще +1000."],
    ["NPC у комп'ютерній грі — це…", ["Персонаж, яким керує комп'ютер", "Найкращий гравець", "Помилка в грі", "Новий процесор"], "Non-Player Character. Не будь NPC — проходь тренажер сам 🤖"],
    ["«Імба» в іграх означає, що щось…", ["Надто сильне", "Зламалося", "Коштує дорого", "Дуже повільне"], "Від англійського imbalance. Твоя відповідь — теж імба 💪"],
    ["Що зазвичай роблять із «кринжем»?", ["Швидко гортають далі", "Друкують на принтері", "Зберігають на флешці", "Вставляють у презентацію"], "Гортають 🙈 А от тренажер краще не гортати."]
  ];

  /* Сучасний сленг: набрав слово на клавіатурі (поза полями вводу й не під час тесту) — отримав реакцію.
     Слово — регулярний вираз на кінець набраного; реакції — без лайки, з гумором, про навчання. */
  const SLANG = [
    [/могаю$|замогав$|могати$|\bmog$/, "Тут усіх могають лише 12 балів 😎"],
    [/коч$/, "Коч прийнято 🫡 А тепер — тренажер!"],
    [/аура$|aura$/, "+1000 аури за урок інформатики ✨"],
    [/сігма$|сигма$|sigma$/, "Сігма-правило №1: спершу теорія, потім тренажер 🗿"],
    [/скібіді$|скибиди$|skibidi$/, "Скібіді-доп-доп… а тренажер сам себе не пройде 😄"],
    [/імба$|имба$/, "Імба — це 12 балів без жодної підказки 💪"],
    [/кринж$|cringe$/, "Кринж — це вийти з тесту й спалити питання 🙈"],
    [/вайб$|vibe$/, "Вайб уроку: теорія ➜ конспект ➜ тренажер ✨"],
    [/флекс$|flex$/, "Флексити найкраще оцінкою 12 🎉"],
    [/рофл$|rofl$/, "Рофл рофлом, а Ctrl + S ніхто не скасовував 😄"],
    [/нпс$|npc$/, "Не будь NPC — проходь тренажер сам 🤖"],
    [/чіл$|чил$|chill$/, "Чіл — це коли тренажер уже пройдено 😌"],
    [/краш$|crush$/, "Твій краш — 12 балів? Тоді вперед 😉"],
    [/різз$|riz$|rizz$/, "Rizz рівня «знаю всі сполучення клавіш» 😎"],
    [/тралалеро$|тунгтунг$|сахур$/, "Тралалеро-тралала… Бомбардіро вже летить 🐊✈️"]
  ];
  let typed = "";

  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  const inTest = () => { const q = document.getElementById("quiz"); return !!(q && !q.hidden); };
  const typing = (e) => { const t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  function toast(text) {
    document.querySelectorAll(".egg-toast").forEach((x) => x.remove());
    const t = document.createElement("div");
    t.className = "egg-toast"; t.setAttribute("role", "status"); t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  /* Конфеті на 12 балів */
  function confetti() {
    if (reduced()) return;
    const colors = ["#1f6fd1", "#1d8a4e", "#e3b341", "#c2372f", "#8a5cf6"];
    const box = document.createElement("div"); box.className = "egg-confetti"; box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 80; i++) {
      const s = document.createElement("i");
      s.style.left = Math.random() * 100 + "vw";
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = Math.random() * 0.6 + "s";
      s.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      s.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4000);
  }

  /* Підсумок тесту: 12 — конфеті; 6 або 7 — сам знаєш що; 1–3 — підбадьорення.
     Серія тренажерів кожного учня (за іменем): 3, 5, 10, 20 — похвала. Лічильник живе лише в браузері учня. */
  const STREAK = { 3: "Три тренажери пройдено — так тримати! 💪", 5: "П'ять тренажерів! Ти справжній марафонець 🏃", 10: "Десять тренажерів! Бомбардіро Крокоділо аплодує 🐊👏", 20: "Двадцять тренажерів! Легенда кабінету інформатики 🏆" };
  function onResult(g, box, T, name) {
    if (box) box.querySelectorAll(".egg-line").forEach((x) => x.remove());
    let line = "";
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (g === 12) { line = pick(["Ідеально! 🎉", "+1000 аури ✨ 12 з 12!", "Ти всіх замогав 😎 12 балів!", "Імба! Жодної помилки 💪"]); confetti(); }
    else if (g >= 10) line = pick(["Майже імба — до 12 зовсім трохи 💪", "Сильно! Аура росте ✨"]);
    else if (g === 6 || g === 7) line = "Шість… сім! 🤷 Наступного разу — більше.";
    else if (g <= 3) line = pick(["Не здавайся — наступна спроба буде кращою 💪", "Перечитай «Теорію коротко» — і друга спроба буде імба 😉"]);
    if (line && box) {
      const p = document.createElement("p"); p.className = "egg-line"; p.textContent = line;
      box.insertBefore(p, box.querySelector(".report"));
    }
    if (T && T.kind === "train") {
      const key = "egg:trainers:" + String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
      const n = store.get(key, 0) + 1; store.set(key, n);
      if (STREAK[n]) setTimeout(() => toast(STREAK[n]), 900);
    }
  }

  /* Бомбардіро Крокоділо пролітає над сторінкою: 7 швидких натискань на заголовок або код Konami */
  function flyby() {
    toast("Бомбардіро Крокоділо пролетів над уроком! 🐊✈️");
    if (reduced()) return;
    const f = document.createElement("div"); f.className = "egg-fly"; f.setAttribute("aria-hidden", "true"); f.textContent = "🐊✈️";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 3600);
  }
  let taps = [];
  function onClick(e) {
    if (!e.target.closest || !e.target.closest("h1") || inTest()) return;
    const now = Date.now(); taps = taps.filter((t) => now - t < 3000); taps.push(now);
    if (taps.length >= 7) { taps = []; flyby(); }
  }

  /* Клавіатура: код Konami (↑↑↓↓←→←→BA) — політ; «6», потім «7» — сам знаєш що. Не в полях вводу й не під час тесту. */
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kpos = 0, last6 = 0;
  function onKey(e) {
    if (inTest() || typing(e)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = k === KONAMI[kpos] ? kpos + 1 : k === KONAMI[0] ? 1 : 0;
    if (kpos === KONAMI.length) { kpos = 0; flyby(); }
    if (k === "6") last6 = Date.now();
    else if (k === "7" && Date.now() - last6 < 1500) { last6 = 0; toast("Шість… сім! 🤷"); }
    if (/^[a-zа-щьюяїієґ']$/i.test(k)) {
      typed = (typed + k.toLowerCase()).slice(-14);
      const hit = SLANG.find(([re]) => re.test(typed));
      if (hit) { typed = ""; toast(hit[1]); }
    } else if (k === " " || k === "Enter") typed = "";
  }

  /* Мемне «ім'я» в тесті — лагідне нагадування (тест не блокується) */
  let nameHinted = false;
  function onInput(e) {
    if (nameHinted || !e.target || e.target.id !== "name") return;
    if (/бомбард|крокод|тунг|сахур|тралал|сігма|сигма|скібіді|скибиди|(^|\s)(аура|коч|могаю|нпс|npc|імба|кринж)(\s|$)|(^|\D)67(\D|$)/i.test(e.target.value)) {
      nameHinted = true;
      toast("Гарна спроба 😄 Введи справжні прізвище та ім'я — учитель має знати, чия це робота.");
    }
  }

  /* Грудень і перші дні січня — сніжинки на головній (один раз при відкритті) */
  function snow() {
    if (reduced() || !document.getElementById("listView")) return;
    const d = new Date(), m = d.getMonth(), day = d.getDate();
    if (!(m === 11 || (m === 0 && day <= 10))) return;
    const box = document.createElement("div"); box.className = "egg-snow"; box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 36; i++) {
      const s = document.createElement("i"); s.textContent = "❄";
      s.style.left = Math.random() * 100 + "vw";
      s.style.fontSize = 10 + Math.random() * 14 + "px";
      s.style.animationDelay = Math.random() * 4 + "s";
      s.style.animationDuration = 6 + Math.random() * 5 + "s";
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 16000);
  }

  /* Привіт для тих, хто відкрив консоль розробника (F12) */
  try {
    console.log("%cПривіт, юний хакере! 👋", "font:700 18px system-ui;color:#1f6fd1");
    console.log("Якщо ти дивишся сюди — ти вже на півдорозі до програміста.\nПідійди до Дениса Анатолійовича: для таких, як ти, є окремі цікаві завдання 🙂\nА от відповіді на тести тут шукати марно — краще пройди тренажер ще раз.");
  } catch (e) {}

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  document.addEventListener("input", onInput);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", snow); else snow();

  window.EGGS = { bonus, onResult, confetti, flyby, toast };
})();
