/* Пасхалки. Вимкнути бонус-питання: CONFIG.EGG_CHANCE = 0. Додати своє — у список bonus нижче
   (формат як у тестах). Мова — літературна, без сленгу й лайки: це матеріали для учнів. */
(function () {
  "use strict";

  /* Бонус-питання: з імовірністю CONFIG.EGG_CHANCE (типово 1 зі 100) замість звичайного питання
     в тренажері випадає дуже легке й не про інформатику. Не більше одного на спробу.
     У діагностувальних і тематичних — ніколи (CONFIG.EGG_KINDS). */
  const bonus = [
    ["Яке число йде після 66?", ["67", "68", "65", "666"], "Шість… сім! 🤷 Так, ми теж знаємо цей мем."],
    ["Скільки буде 6 + 1?", ["7", "6", "67", "61"], "Сім. А хтось точно хотів відповісти «67» 😄"],
    ["Бомбардіро Крокоділо — це…", ["Крокодил-літак із мемів", "Новий процесор", "Операційна система для холодильників", "Вид шрифту"], "Інформатики тут нуль, зате бал — твій 🐊✈️"],
    ["Скільки лап у кота?", ["4", "3", "5", "Залежить від Wi-Fi"], "Чотири. А хвостом кіт натискає Enter, коли ти відвернувся."],
    ["Що з цього — фрукт?", ["Яблуко", "Принтер", "Монітор", "Флешка"], "Яблуко. Хоча буває й надкушене на ноутбуці 😉"],
    ["Скільки днів у тижні?", ["7", "5", "10", "Залежить від канікул"], "Сім. Канікули, на жаль, на це не впливають."],
    ["Хто веде в тебе інформатику?", ["Денис Анатолійович", "Бомбардіро Крокоділо", "Робот-пилосос", "Ніхто, вона сама"], "Правильно! І він радий, що тобі випало це питання 🙂"],
    ["Якого кольору небо в ясний день?", ["Блакитного", "Зеленого", "У клітинку", "Кольору #FF0000"], "Блакитного. А #FF0000 — це червоний, знадобиться на уроці про кольори."],
    ["Скільки буде 2 + 2?", ["4", "22", "5", "Помилка 404"], "Чотири. Навіть без калькулятора."],
    ["Що з цього можна з'їсти?", ["Бутерброд", "Клавіатуру", "Флешку", "Wi-Fi"], "Бутерброд. Тільки не над клавіатурою!"],
    ["Що кажуть у відповідь на «дякую»?", ["Будь ласка", "Ctrl + Z", "Перезавантаж", "404"], "«Будь ласка». Ввічливість працює й без інтернету."],
    { tf: true, q: "Так чи ні: зараз ти проходиш тест з інформатики.", x: "Так! Бонус зараховано 🎁" }
  ];

  const reduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  function toast(text) {
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

  /* Підсумок тесту: 12 — конфеті, 6 або 7 — сам знаєш що */
  function onResult(g, box) {
    if (box) box.querySelectorAll(".egg-line").forEach((x) => x.remove());
    let line = "";
    if (g === 12) { line = "Ідеально! 🎉"; confetti(); }
    else if (g === 6 || g === 7) line = "Шість… сім! 🤷 Наступного разу — більше.";
    if (!line || !box) return;
    const p = document.createElement("p"); p.className = "egg-line"; p.textContent = line;
    box.insertBefore(p, box.querySelector(".report"));
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
    if (!e.target.closest || !e.target.closest("h1")) return;
    if (document.getElementById("quiz") && !document.getElementById("quiz").hidden) return; // під час тесту — ні
    const now = Date.now(); taps = taps.filter((t) => now - t < 3000); taps.push(now);
    if (taps.length >= 7) { taps = []; flyby(); }
  }
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kpos = 0;
  function onKey(e) {
    if (document.getElementById("quiz") && !document.getElementById("quiz").hidden) return; // під час тесту — ні
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = k === KONAMI[kpos] ? kpos + 1 : k === KONAMI[0] ? 1 : 0;
    if (kpos === KONAMI.length) { kpos = 0; flyby(); }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);

  window.EGGS = { bonus, onResult, confetti, flyby };
})();
