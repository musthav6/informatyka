/* =====================================================================
   Квести: учень ходить картою й розмовляє з персонажами.
   Сторінка: quest.html?q=<id файлу в quests/>, наприклад quest.html?q=7-07.

   Урок-квест замість конспекту: персонажі розповідають теорію, учень записує в паперовий зошит,
   гра перевіряє пропущеними словами й діями. Станції відкриваються по черзі.

   Формат файлу quests/<id>.js:
   QUEST.add({
     id, grade, lesson, title, intro,
     rooms: [{ id, name, decor: "cinema|booth|pcs|workshop|library|museum", row: 0|1, col: 0|1|2 }],
     stations: [{
       room, at: [fx, fy] (частки кімнати), topic,
       optional?  — ⭐ (відкривається після всіх основних, можна пропустити),
       final?     — останній персонаж; після нього — результат,
       npc: { name, look: "#колір", hat: "cap|bun|long|short|beret|pony|messy", glasses? },
       steps: [ — кроки розмови, по одному на екран:
         { t: "say", text: "**жирне** можна", table?: [[заголовки], [рядок]…], write?: true }  — write: перепиши таблицю
         { t: "write", term?, def?, rule?, sec? }  — «✍️ Запиши»; кнопка оживає через sec (або за довжиною тексту)
         { t: "demo", kind: "fps|flip|tour|spin|markers", text }  — жива демонстрація; «Далі» — коли спробував
         { t: "gate" }  — у фіналі: запропонувати ⭐ станції, якщо їх не пройдено
         { t: "check", type, … }  — 1 бал; текст сховано, учень користується зошитом:
           cloze   { text: "… [[слово|варіант]] …" }                       — впиши пропущені слова
           choice  { v: [["питання", ["правильна", "хибна", …], "пояснення"], …] }
           calc    { gen: (R) => ({ q, ans: число, unit, x }) }           — числа свої для кожного учня
           order   { v: [{ q, items: [у правильному порядку], x }] }
           spot    { v: [{ q, target: "top|tools|stage|palette|params|layers|timeline|play" }] }
           markers { v: [{ goal: "move|size|rotate", q }] }
           form    {}  — «Новий проєкт» Стрибок_Прізвище, 640×480, 24, світло-блакитний, «Зберегти»
       ]
     }]
   });
   Оцінка = бали за перевірки / кількість перевірок · 12. Результат летить у ту саму таблицю, що й тести.
   ===================================================================== */
(function () {
  "use strict";
  const CFG = window.CONFIG || {};
  const LIST = [];
  window.QUEST = { add: (q) => LIST.push(q) };

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

  /* ---------------------------------------------------------- геометрія */
  const WW = 1600, WH = 1100, CX = [30, 560, 1040, 1570], ROWS = [[30, 470], [630, 1070]], COR = [470, 630];
  const WT = 14, DOOR = 120, PR = 14, TALK_R = 96;
  const rect = (x, y, w, h) => ({ x, y, w, h });
  const roomRect = (r) => { const [y0, y1] = ROWS[r.row]; return rect(CX[r.col], y0, CX[r.col + 1] - CX[r.col], y1 - y0); };
  const doorX = (rr) => rr.x + rr.w / 2;

  function buildWalls(rooms) {
    const w = [rect(16, 16, WW - 32, WT), rect(16, WH - 30, WW - 32, WT), rect(16, 16, WT, WH - 32), rect(WW - 30, 16, WT, WH - 32)];
    for (const x of [CX[1], CX[2]]) { w.push(rect(x - 7, ROWS[0][0], 14, ROWS[0][1] - ROWS[0][0])); w.push(rect(x - 7, ROWS[1][0], 14, ROWS[1][1] - ROWS[1][0])); }
    for (const r of rooms) {
      const rr = roomRect(r), dc = doorX(rr), y = r.row ? ROWS[1][0] : ROWS[0][1] - WT;
      w.push(rect(rr.x, y, dc - DOOR / 2 - rr.x, WT), rect(dc + DOOR / 2, y, rr.x + rr.w - dc - DOOR / 2, WT));
    }
    return w;
  }

  /* ---------------------------------------------------------- оздоблення кімнат */
  // f(rr) → { floor, solids: [rect], draw(ctx, t) }. Координати — частки кімнати.
  const F = (rr, fx, fy, fw, fh) => rect(rr.x + fx * rr.w, rr.y + fy * rr.h, fw * rr.w, fh * rr.h);
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function box(ctx, b, fill, stroke, r = 6) { rrect(ctx, b.x, b.y, b.w, b.h, r); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
  function label(ctx, txt, x, y, size = 13, color = "#1f2937", align = "center") { ctx.font = `600 ${size}px Rubik, system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(txt, x, y); }
  function emoji(ctx, e, x, y, size) { ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e, x, y); }

  const DECOR = {
    cinema(rr) {
      const screen = F(rr, 0.08, 0.035, 0.84, 0.07), proj = F(rr, 0.05, 0.36, 0.07, 0.1);
      const rows = [0.34, 0.48, 0.62].map((fy) => F(rr, 0.32, fy, 0.36, 0.06));
      return {
        floor: ["#3b1f4a", "#43244f"], solids: [screen, proj, ...rows],
        draw(ctx, t) {
          box(ctx, screen, "#f8fafc", "#cbd5e1", 4);
          // на екрані — справжня анімація: 8 кадрів/с, м'яч стрибає
          const fr = Math.floor(t * 8) % 16, ph = fr < 8 ? fr / 8 : (16 - fr) / 8;
          const bx = screen.x + screen.w * (0.12 + 0.76 * (fr / 15)), by = screen.y + screen.h * (0.78 - 0.55 * Math.sin(ph * Math.PI));
          ctx.fillStyle = "#cbd5e1"; ctx.fillRect(screen.x + 6, screen.y + screen.h - 6, screen.w - 12, 2);
          ctx.beginPath(); ctx.arc(bx, by, 7, 0, 7); ctx.fillStyle = "#f97316"; ctx.fill();
          label(ctx, `кадр ${fr + 1}`, screen.x + screen.w - 34, screen.y + 10, 10, "#64748b");
          box(ctx, proj, "#1f2937", "#111827", 5); ctx.beginPath(); ctx.arc(proj.x + proj.w / 2, proj.y + 8, 7, 0, 7); ctx.fillStyle = "#94a3b8"; ctx.fill();
          ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = "#fef9c3"; ctx.beginPath(); ctx.moveTo(proj.x + proj.w / 2, proj.y); ctx.lineTo(screen.x + 20, screen.y + screen.h); ctx.lineTo(screen.x + screen.w * 0.6, screen.y + screen.h); ctx.fill(); ctx.restore();
          for (const r of rows) { const n = 7, sw = r.w / n; for (let i = 0; i < n; i++) { rrect(ctx, r.x + i * sw + 2, r.y, sw - 4, r.h, 5); ctx.fillStyle = "#b91c1c"; ctx.fill(); ctx.fillStyle = "#7f1d1d"; ctx.fillRect(r.x + i * sw + 2, r.y + r.h - 6, sw - 4, 6); } }
        }
      };
    },
    booth(rr) {
      const counter = F(rr, 0.1, 0.44, 0.42, 0.06), pop = F(rr, 0.84, 0.12, 0.1, 0.12), sofa = F(rr, 0.12, 0.82, 0.3, 0.08);
      return {
        floor: ["#f1e7d0", "#e7d9bb"], solids: [counter, pop, sofa],
        draw(ctx) {
          const posters = [["24", "кадр/с"], ["25", "кадр/с"], ["30", "кадр/с"]];
          posters.forEach((p, i) => { const b = F(rr, 0.12 + i * 0.16, 0.035, 0.12, 0.09); box(ctx, b, ["#1d4ed8", "#be185d", "#047857"][i], "#0f172a", 4); label(ctx, p[0], b.x + b.w / 2, b.y + b.h * 0.4, 15, "#fff"); label(ctx, p[1], b.x + b.w / 2, b.y + b.h * 0.78, 9, "#e2e8f0"); });
          box(ctx, counter, "#92400e", "#78350f", 4); ctx.fillStyle = "#fbbf24"; ctx.fillRect(counter.x, counter.y, counter.w, 5);
          emoji(ctx, "🎟️", counter.x + counter.w * 0.75, counter.y + counter.h / 2, 16);
          box(ctx, pop, "#dc2626", "#7f1d1d", 4); emoji(ctx, "🍿", pop.x + pop.w / 2, pop.y + pop.h / 2, 22);
          box(ctx, sofa, "#7c3aed", "#5b21b6", 8);
          label(ctx, "КАСА", counter.x + counter.w / 2, counter.y - 52, 12, "#78350f");
        }
      };
    },
    pcs(rr) {
      const d1 = F(rr, 0.3, 0.12, 0.42, 0.08), d2 = F(rr, 0.32, 0.48, 0.4, 0.08), cab = F(rr, 0.88, 0.75, 0.07, 0.15);
      return {
        floor: ["#dbeafe", "#cfe0fb"], solids: [d1, d2, cab],
        draw(ctx, t) {
          for (const d of [d1, d2]) {
            box(ctx, d, "#e5e7eb", "#9ca3af", 4);
            const n = 3, sw = d.w / n;
            for (let i = 0; i < n; i++) {
              const m = rect(d.x + i * sw + 8, d.y - 14, sw - 16, 20); box(ctx, m, "#111827", "#374151", 3);
              // на моніторах — шкала кадрів з бігунком
              ctx.fillStyle = "#334155"; ctx.fillRect(m.x + 3, m.y + m.h - 6, m.w - 6, 3);
              ctx.fillStyle = "#f97316"; ctx.fillRect(m.x + 3 + ((t * 20 + i * 13) % (m.w - 8)), m.y + m.h - 8, 2, 7);
              ctx.fillStyle = "#38bdf8"; ctx.fillRect(m.x + 4, m.y + 3, (m.w - 8) * 0.4, 6);
            }
          }
          box(ctx, cab, "#64748b", "#334155", 3); label(ctx, "🖨", cab.x + cab.w / 2, cab.y + cab.h / 2, 14);
        }
      };
    },
    workshop(rr) {
      const t1 = F(rr, 0.08, 0.32, 0.22, 0.14), t2 = F(rr, 0.7, 0.32, 0.22, 0.14), easel = F(rr, 0.1, 0.72, 0.08, 0.12), lb = F(rr, 0.78, 0.72, 0.14, 0.1);
      return {
        floor: ["#d6b88f", "#cdad81"], solids: [t1, t2, easel, lb],
        draw(ctx, t) {
          for (const tb of [t1, t2]) {
            box(ctx, tb, "#a16207", "#713f12", 6);
            for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(tb.x + 18 + i * (tb.w - 30) / 3, tb.y + tb.h / 2); ctx.rotate((i - 1.5) * 0.12); ctx.fillStyle = "#fffbeb"; ctx.fillRect(-11, -14, 22, 28); ctx.restore(); }
          }
          box(ctx, easel, "#78350f", null, 3); const fr = Math.floor(t * 4) % 5; emoji(ctx, ["🌰", "🌱", "🌿", "🌷", "🌸"][fr], easel.x + easel.w / 2, easel.y + easel.h / 2, 22);
          box(ctx, lb, "#fef9c3", "#ca8a04", 4); label(ctx, "світловий стіл", lb.x + lb.w / 2, lb.y + lb.h / 2, 9, "#854d0e");
        }
      };
    },
    library(rr) {
      const sh = F(rr, 0.04, 0.84, 0.92, 0.1), sl = F(rr, 0.03, 0.2, 0.06, 0.5), sr = F(rr, 0.91, 0.2, 0.06, 0.5);
      const dl = F(rr, 0.18, 0.4, 0.16, 0.1), dr = F(rr, 0.66, 0.4, 0.16, 0.1);
      return {
        floor: ["#efe2c6", "#e6d5b2"], solids: [sh, sl, sr, dl, dr],
        draw(ctx) {
          const books = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316"];
          for (const s of [sh, sl, sr]) {
            box(ctx, s, "#7c2d12", null, 3);
            const horiz = s.w > s.h, n = Math.floor((horiz ? s.w : s.h) / 9);
            for (let i = 0; i < n; i++) { ctx.fillStyle = books[(i * 7) % books.length]; if (horiz) ctx.fillRect(s.x + 3 + i * 9, s.y + 4, 7, s.h - 8); else ctx.fillRect(s.x + 4, s.y + 3 + i * 9, s.w - 8, 7); }
          }
          for (const d of [dl, dr]) { box(ctx, d, "#b45309", "#78350f", 4); emoji(ctx, "📖", d.x + d.w / 2, d.y + d.h / 2, 16); }
        }
      };
    },
    museum(rr) {
      const ped = F(rr, 0.06, 0.38, 0.07, 0.08), cam = F(rr, 0.32, 0.8, 0.08, 0.09), cas = F(rr, 0.42, 0.26, 0.16, 0.12), desk = F(rr, 0.88, 0.32, 0.08, 0.2);
      return {
        floor: ["#f5f5f4", "#e7e5e4"], solids: [ped, cam, cas, desk],
        draw(ctx, t) {
          box(ctx, ped, "#d6d3d1", "#78716c", 4);
          // тауматроп на постаменті крутиться
          const c = Math.cos(t * 9); ctx.save(); ctx.translate(ped.x + ped.w / 2, ped.y - 6); ctx.scale(Math.abs(c) * 0.9 + 0.1, 1); ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#78716c"; ctx.stroke(); emoji(ctx, c > 0 ? "🐦" : "▦", 0, 0, 12); ctx.restore();
          box(ctx, cam, "#292524", "#0c0a09", 4); emoji(ctx, "🎥", cam.x + cam.w / 2, cam.y + cam.h / 2, 18);
          const poster = F(rr, 0.44, 0.9, 0.14, 0.08); box(ctx, poster, "#fde68a", "#92400e", 3); label(ctx, "1927 · Бичок", poster.x + poster.w / 2, poster.y + poster.h / 2, 9, "#78350f");
          box(ctx, cas, "rgba(186,230,253,.6)", "#0284c7", 4); emoji(ctx, "🎞️", cas.x + cas.w / 2, cas.y + cas.h / 2, 18);
          box(ctx, desk, "#1e3a8a", "#172554", 4);
          for (let i = 0; i < 3; i++) { const p = F(rr, 0.08 + i * 0.3, 0.035, 0.12, 0.08); box(ctx, p, "#fafaf9", "#a8a29e", 3); label(ctx, "⭐", p.x + p.w / 2, p.y + p.h / 2, 12, "#ca8a04"); }
        }
      };
    }
  };

  /* ---------------------------------------------------------- зіткнення й шлях */
  let SOLIDS = [];
  function hits(x, y, r = PR) {
    if (x < 30 + r || y < 30 + r || x > WW - 30 - r || y > WH - 30 - r) return true;
    for (const s of SOLIDS) {
      const cx = clamp(x, s.x, s.x + s.w), cy = clamp(y, s.y, s.y + s.h), dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }
  function lineFree(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 8);
    for (let i = 1; i <= n; i++) { const t = i / n; if (hits(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, PR + 1)) return false; }
    return true;
  }
  const CELL = 20, GW = Math.ceil(WW / CELL), GH = Math.ceil(WH / CELL);
  let GRID = null;
  function buildGrid() { GRID = new Uint8Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) GRID[j * GW + i] = hits(i * CELL + CELL / 2, j * CELL + CELL / 2, PR + 2) ? 1 : 0; }
  // A* по сітці; goal(i, j) — чи підходить клітинка; h — оцінка до цілі
  function findPath(from, tx, ty, goalR) {
    const si = clamp(Math.floor(from.x / CELL), 0, GW - 1), sj = clamp(Math.floor(from.y / CELL), 0, GH - 1);
    const g = new Float32Array(GW * GH).fill(1e9), prev = new Int32Array(GW * GH).fill(-1), closed = new Uint8Array(GW * GH);
    const heap = []; const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
    const s = sj * GW + si; g[s] = 0; push(s, 0);
    const H = (i, j) => Math.hypot(i * CELL + CELL / 2 - tx, j * CELL + CELL / 2 - ty);
    let found = -1, guard = 0;
    while (heap.length && guard++ < 20000) {
      const k = pop(); if (closed[k]) continue; closed[k] = 1;
      const i = k % GW, j = (k - i) / GW;
      if (H(i, j) <= goalR) { found = k; break; }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GW || nj >= GH) continue;
        const nk = nj * GW + ni; if (GRID[nk] || closed[nk]) continue;
        if (di && dj && (GRID[j * GW + ni] || GRID[nj * GW + i])) continue;
        const ng = g[k] + (di && dj ? 1.414 : 1); if (ng < g[nk]) { g[nk] = ng; prev[nk] = k; push(nk, ng + H(ni, nj) / CELL); }
      }
    }
    if (found < 0) return null;
    const pts = []; for (let k = found; k !== -1 && k !== s; k = prev[k]) { const i = k % GW; pts.push({ x: i * CELL + CELL / 2, y: (k - i) / GW * CELL + CELL / 2 }); }
    pts.reverse();
    // «натягнута нитка»: пропускаємо точки, до яких видно напряму
    const out = []; let cur = from, i = 0;
    while (i < pts.length) { let j = pts.length - 1; while (j > i && !lineFree(cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; i = j + 1; }
    return out;
  }

  /* ---------------------------------------------------------- малювання персонажів */
  function drawPerson(ctx, x, y, look, opt = {}) {
    const bob = opt.walk ? Math.sin(opt.t * 14) * 1.5 : 0;
    ctx.save(); ctx.translate(x, y + bob);
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, 15 - bob, 15, 6, 0, 0, 7); ctx.fill();
    rrect(ctx, -12, -4, 24, 20, 9); ctx.fillStyle = look; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -12, 11, 0, 7); ctx.fillStyle = "#fcd9b8"; ctx.fill();
    const hair = opt.hair || "#3f2a1d"; ctx.fillStyle = hair;
    const h = opt.hat;
    if (h === "cap") { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); ctx.fillRect(opt.dir < 0 ? -18 : 2, -16, 16, 4); }
    else if (h === "bun") { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(0, -26, 6, 0, 7); ctx.fill(); }
    else if (h === "long") { ctx.beginPath(); ctx.arc(0, -14, 12, Math.PI, 0); ctx.fill(); ctx.fillRect(-12, -14, 5, 16); ctx.fillRect(7, -14, 5, 16); }
    else if (h === "beret") { ctx.fillStyle = "#b91c1c"; ctx.beginPath(); ctx.ellipse(-2, -21, 12, 5, -0.2, 0, 7); ctx.fill(); }
    else if (h === "pony") { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.ellipse(12, -10, 4, 9, 0.3, 0, 7); ctx.fill(); }
    else if (h === "messy") { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 4, -21 + Math.abs(i), 4, 0, 7); ctx.fill(); } }
    else { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = "#1f2937"; const ex = (opt.dir || 0) * 2;
    ctx.beginPath(); ctx.arc(-4 + ex, -11, 1.6, 0, 7); ctx.arc(4 + ex, -11, 1.6, 0, 7); ctx.fill();
    if (opt.glasses) { ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-4 + ex, -11, 3.4, 0, 7); ctx.moveTo(7.4 + ex, -11); ctx.arc(4 + ex, -11, 3.4, 0, 7); ctx.stroke(); }
    ctx.restore();
  }

  /* ================================================================ ГРА */
  function run(Q) {
    document.title = Q.title;
    const KEY = `qs:${Q.id}`;
    const rooms = Q.rooms.map((r) => ({ ...r, rr: roomRect(r) }));
    const roomOf = (id) => rooms.find((r) => r.id === id);
    const deco = rooms.map((r) => ({ room: r, d: DECOR[r.decor](r.rr) }));
    const stations = Q.stations.map((s, i) => { const rr = roomOf(s.room).rr; return { ...s, i, x: rr.x + s.at[0] * rr.w, y: rr.y + s.at[1] * rr.h, roomName: roomOf(s.room).name.replace("⭐ ", "") }; });
    const npcSolid = (s) => rect(s.x - 13, s.y - 6, 26, 22);
    const WALLS = buildWalls(rooms);
    SOLIDS = WALLS.concat(...deco.map((d) => d.d.solids)).concat(stations.map(npcSolid));
    buildGrid();
    const N = stations.length;
    const CHECKS = [];
    stations.forEach((s) => s.steps.forEach((p, k) => { if (p.t === "check") CHECKS.push(`${s.i}:${k}`); }));

    /* -------- стан */
    let st = null; // { cls, name, start, done: {i: 1}, checks: {"i:k": 0|1}, notes: [i…], viol, x, y }
    const saveSt = () => { if (st) store.set(KEY + ":run", st); };
    const P = { x: 380, y: 550, dir: 1, path: null, goal: null, moving: false };
    let paused = true, openSt = null;
    const isDone = (s) => !!(st && st.done[s.i]);
    const basics = stations.filter((s) => !s.optional && !s.final);
    // доступна, якщо пройдено всі обов'язкові станції перед нею; ⭐ і фінал — після всіх обов'язкових
    const available = (s) => !st ? false : (s.optional || s.final) ? basics.every(isDone) : basics.filter((b) => b.i < s.i).every(isDone);
    const score = () => CHECKS.reduce((a, k) => a + (st.checks[k] || 0), 0);

    /* -------- DOM */
    const cv = $("#world"), ctx = cv.getContext("2d");
    const hud = $("#hud"), list = $("#qList"), bar = $("#qBar i"), prog = $("#qProg"), nextEl = $("#qNext"), talkBtn = $("#talk");
    $("#qTitle").textContent = Q.title;
    $("#sTitle").textContent = Q.title;
    $("#sIntro").textContent = Q.intro;
    $("#sEyebrow").textContent = `${Q.grade} клас · урок ${Q.lesson} · 🕹️ урок-квест`;
    $("#backLink").href = `index.html?l=${Q.grade}-${String(Q.lesson).padStart(2, "0")}`;

    const clsSel = $("#cls"), nameIn = $("#name"), goBtn = $("#go");
    const classes = (CFG.CLASSES || []).filter((c) => c.startsWith(String(Q.grade)));
    clsSel.innerHTML = `<option value="">— клас —</option>` + classes.map((c) => `<option>${esc(c)}</option>`).join("");
    const last = store.get("qz:me", null);
    if (last) { if (classes.includes(last.cls)) clsSel.value = last.cls; nameIn.value = last.name || ""; }
    const ready = () => { goBtn.disabled = !(clsSel.value && nameIn.value.trim().split(/\s+/).length >= 2); };
    clsSel.onchange = nameIn.oninput = ready; ready();

    const saved = store.get(KEY + ":run", null);
    if (saved && !saved.finished && saved.done && Object.keys(saved.done).length) {
      $("#resume").hidden = false;
      $("#resume").innerHTML = `Є незавершений урок: <b>${esc(saved.name)}</b>, пройдено ${Object.keys(saved.done).length} з ${N}. Натисни «Почати» з тим самим іменем — продовжиш з того місця.`;
    }

    goBtn.onclick = () => {
      const cls = clsSel.value, name = nameIn.value.trim().replace(/\s+/g, " ");
      store.set("qz:me", { cls, name });
      const prev = store.get(KEY + ":run", null);
      if (prev && !prev.finished && prev.checks && prev.cls === cls && personKey(prev.name) === personKey(name)) st = prev;
      else st = { cls, name, start: Date.now(), done: {}, checks: {}, notes: [], viol: 0, x: 380, y: 550 };
      P.x = st.x; P.y = st.y;
      $("#start").hidden = true; hud.hidden = false; paused = false;
      renderHud(); saveSt();
      toast("Іди до того, у кого над головою «!» — клацни по ньому або підійди й натисни E", 5000);
    };

    /* -------- HUD */
    function renderHud() {
      const done = stations.filter(isDone).length;
      prog.textContent = `Пройдено ${done} з ${N}`;
      bar.style.width = (done / N * 100) + "%";
      list.innerHTML = "";
      stations.forEach((s) => {
        const li = el("li", isDone(s) ? "ok" : available(s) ? "" : "lock");
        li.innerHTML = `<span class="box"></span><span><b>${esc(s.topic || s.npc.name)}</b><small>${esc(s.npc.name)} · ${esc(s.roomName)}${s.optional ? " · ⭐ на 12" : ""}</small></span>`;
        li.onclick = () => { goTo(s); };
        list.appendChild(li);
      });
      $("#bookN").textContent = st.notes.length;
    }
    function nextStation() {
      return stations.find((s) => !isDone(s) && available(s) && !s.final) || stations.find((s) => !isDone(s) && available(s)) || null;
    }
    $("#listToggle").onclick = () => hud.classList.toggle("open");

    /* -------- рух */
    const keys = new Set();
    const KM = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
    addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select")) return;
      if (KM[e.code] && !paused) { keys.add(KM[e.code]); P.path = null; P.goal = null; e.preventDefault(); }
      if ((e.code === "KeyE" || e.code === "Enter" || e.code === "Space") && !paused && near) { e.preventDefault(); openStation(near); }
      if (e.code === "KeyN" && !paused) openBook();
      if (e.code === "Escape") closeBook();
    });
    addEventListener("keyup", (e) => { if (KM[e.code]) keys.delete(KM[e.code]); });
    addEventListener("blur", () => keys.clear());

    function goTo(s) {
      if (paused) return;
      hud.classList.remove("open");
      if (!available(s)) { lockedToast(s); return; }
      const path = findPath(P, s.x, s.y, TALK_R - 30);
      if (path) { P.path = path; P.goal = s; }
    }
    function lockedToast(s) {
      const nx = nextStation();
      toast(`${s.optional || s.final ? "Сюди — після всіх основних станцій." : "Не поспішай — усе по черзі."} Зараз іди до: ${nx ? nx.npc.name + " (" + nx.roomName + ")" : ""}`, 3500);
    }
    let cam = { x: P.x, y: P.y, z: 1 }, marker = null;
    cv.addEventListener("pointerdown", (e) => {
      if (paused) return;
      const r = cv.getBoundingClientRect(), wx = (e.clientX - r.left - r.width / 2) / cam.z + cam.x, wy = (e.clientY - r.top - r.height / 2) / cam.z + cam.y;
      const hit = stations.find((s) => Math.hypot(s.x - wx, s.y - wy + 8) < 34);
      if (hit) { if (Math.hypot(hit.x - P.x, hit.y - P.y) < TALK_R) openStation(hit); else goTo(hit); return; }
      const path = findPath(P, wx, wy, 14);
      if (path) { P.path = path; P.goal = null; marker = { x: wx, y: wy, t: 0 }; }
    });

    let near = null;
    function update(dt) {
      let vx = 0, vy = 0;
      if (keys.has("u")) vy--; if (keys.has("d")) vy++; if (keys.has("l")) vx--; if (keys.has("r")) vx++;
      const sp = 250;
      if (vx || vy) { const l = Math.hypot(vx, vy); vx = vx / l * sp; vy = vy / l * sp; }
      else if (P.path && P.path.length) {
        const w = P.path[0], dx = w.x - P.x, dy = w.y - P.y, d = Math.hypot(dx, dy);
        if (d < 6) P.path.shift(); else { vx = dx / d * sp; vy = dy / d * sp; }
        if (!P.path.length) P.path = null;
      }
      P.moving = !!(vx || vy);
      if (P.moving) {
        if (Math.abs(vx) > 1) P.dir = vx > 0 ? 1 : -1;
        const nx = P.x + vx * dt, ny = P.y + vy * dt;
        if (!hits(nx, P.y)) P.x = nx; if (!hits(P.x, ny)) P.y = ny;
      }
      near = null; let nd = TALK_R;
      for (const s of stations) { const d = Math.hypot(s.x - P.x, s.y - P.y); if (d < nd) { nd = d; near = s; } }
      if (P.goal && near === P.goal && !P.path) { const g = P.goal; P.goal = null; openStation(g); }
      if (near && !paused) { talkBtn.hidden = false; talkBtn.innerHTML = `💬 ${esc(near.npc.name)} <kbd>E</kbd>`; } else talkBtn.hidden = true;
      const nx = nextStation();
      nextEl.innerHTML = nx ? `${nx.optional ? "⭐ " : ""}Далі: <b>${esc(nx.npc.name)}</b> · ${esc(nx.roomName)}` : "Урок пройдено!";
      if (st && Math.random() < dt) { st.x = Math.round(P.x); st.y = Math.round(P.y); saveSt(); }
    }
    talkBtn.onclick = () => { if (near) openStation(near); };

    /* -------- кадр */
    let W = 0, H = 0, DPR = 1;
    function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px"; }
    addEventListener("resize", resize); resize();
    const tileFloor = (b, a, c, s = 40) => { ctx.fillStyle = a; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = c; for (let y = b.y; y < b.y + b.h; y += s) for (let x = b.x + (((y - b.y) / s) % 2 ? s : 0); x < b.x + b.w; x += s * 2) ctx.fillRect(x, y, Math.min(s, b.x + b.w - x), Math.min(s, b.y + b.h - y)); };
    let T0 = performance.now(), tt = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - T0) / 1000); T0 = now; tt += dt;
      if (!paused) update(dt);
      const z = clamp(Math.min(W / 1000, H / 720), 0.55, 1.2);
      cam.z = z; cam.x += (P.x - cam.x) * Math.min(1, dt * 6); cam.y += (P.y - cam.y) * Math.min(1, dt * 6);
      const hw = W / 2 / z, hh = H / 2 / z;
      cam.x = WW * z > W ? clamp(cam.x, hw, WW - hw) : WW / 2; cam.y = WH * z > H ? clamp(cam.y, hh, WH - hh) : WH / 2;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
      tileFloor(rect(30, COR[0], WW - 60, COR[1] - COR[0]), "#e2e8f0", "#d8dee8", 40);
      for (const { room, d } of deco) tileFloor(room.rr, d.floor[0], d.floor[1], 32);
      ctx.fillStyle = "rgba(79,70,229,.12)"; ctx.fillRect(40, 528, WW - 80, 44);
      label(ctx, "СТАРТ →", 344, 550, 12, "#64748b", "right");
      for (const { room } of deco) label(ctx, room.name, doorX(room.rr), room.row ? COR[1] - 20 : COR[0] + 20, 14, "#334155");
      for (const { d } of deco) d.draw(ctx, tt);
      ctx.fillStyle = "#475569"; for (const w of WALLS) ctx.fillRect(w.x, w.y, w.w, w.h);
      if (marker) { marker.t += dt; ctx.strokeStyle = `rgba(79,70,229,${Math.max(0, 1 - marker.t)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(marker.x, marker.y, 8 + marker.t * 14, 0, 7); ctx.stroke(); if (marker.t > 1) marker = null; }
      const nx = st && nextStation();
      if (nx && !paused && Math.hypot(nx.x - P.x, nx.y - P.y) > TALK_R + 30) {
        const a = Math.atan2(nx.y - P.y, nx.x - P.x); ctx.save(); ctx.translate(P.x + Math.cos(a) * 34, P.y + Math.sin(a) * 34); ctx.rotate(a);
        ctx.fillStyle = nx.optional ? "#eab308" : "#4f46e5"; ctx.globalAlpha = 0.75 + Math.sin(tt * 5) * 0.2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore();
      }
      const people = stations.map((s) => ({ y: s.y, f: () => drawNpc(s) })).concat([{ y: P.y, f: () => drawPerson(ctx, P.x, P.y, "#2563eb", { walk: P.moving, t: tt, dir: P.dir, hat: "short", hair: "#1f2937" }) }]);
      people.sort((a, b) => a.y - b.y).forEach((p) => p.f());
      requestAnimationFrame(frame);
    }
    function drawNpc(s) {
      drawPerson(ctx, s.x, s.y, s.npc.look, { hat: s.npc.hat, glasses: s.npc.glasses, t: tt, dir: Math.sign(P.x - s.x) * 0.6 });
      ctx.font = "600 11px Rubik, system-ui, sans-serif"; const w = ctx.measureText(s.npc.name).width + 12;
      rrect(ctx, s.x - w / 2, s.y + 20, w, 16, 8); ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fill();
      label(ctx, s.npc.name, s.x, s.y + 28.5, 11, "#1f2937");
      const done = isDone(s), open = available(s), by = s.y - 44 + (!done && open ? Math.sin(tt * 4 + s.i) * 3 : 0);
      ctx.beginPath(); ctx.arc(s.x, by, 11, 0, 7);
      ctx.fillStyle = done ? "#16a34a" : !open ? "#cbd5e1" : s.optional ? "#eab308" : "#facc15"; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5; ctx.stroke();
      label(ctx, done ? "✓" : !open ? "…" : s.optional ? "★" : "!", s.x, by + (open || done ? 1 : -3), 14, done ? "#fff" : open ? "#422006" : "#64748b");
    }
    requestAnimationFrame(frame);

    /* -------- вихід із вкладки */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && st && !st.finished && $("#start").hidden) { st.viol++; saveSt(); toast("Виходити з уроку не можна — це фіксується.", 3500); }
    });

    /* ============================================================ РОЗМОВА: КРОКИ СТАНЦІЇ */
    const dlg = $("#dlg"), dBody = $("#dBody");
    function openStation(s) {
      if (openSt || !st) return;
      if (!available(s)) { lockedToast(s); return; }
      openSt = s; paused = true; keys.clear(); P.path = null; talkBtn.hidden = true; $("#toast").hidden = true;
      $("#dWho").textContent = s.npc.name; $("#dWhere").textContent = (s.topic || "") + " · " + s.roomName;
      $("#dAva").style.background = s.npc.look; $("#dAva").textContent = s.npc.name.split(" ").pop()[0];
      dlg.hidden = false;
      if (isDone(s)) {
        dBody.innerHTML = ""; $("#dStep").textContent = "";
        dBody.append(el("p", "say", "Ми вже поговорили! Можу розповісти ще раз — перевірки при цьому вже не рахуються."));
        footer([["Розкажи ще раз", "", () => step(s, 0)], ["Добре", "pri", closeDlg]]);
      } else step(s, 0);
    }
    function closeDlg() {
      dlg.hidden = true; openSt = null; paused = false;
      const fin = stations.find((x) => x.final);
      if (fin && isDone(fin) && !st.finished) finishAll();
    }
    function footer(btns) {
      const f = $("#dFoot"); f.innerHTML = "";
      for (const [t, cls, fn, dis] of btns) { const b = el("button", "btn " + (cls || ""), t); b.onclick = fn; if (dis) b.disabled = true; f.append(b); }
      return [...f.children];
    }
    function step(s, k) {
      dBody.innerHTML = ""; dBody.scrollTop = 0; $("#dlg").scrollTop = 0;
      const steps = s.steps;
      if (k >= steps.length) {
        const was = isDone(s); st.done[s.i] = 1; saveSt(); renderHud(); closeDlg();
        if (!was) toast(s.final ? "Урок пройдено!" : `✓ ${s.topic || s.npc.name} — пройдено`, 2500);
        return;
      }
      $("#dStep").textContent = `${k + 1} / ${steps.length}`;
      const p = steps[k], next = () => step(s, k + 1);
      STEP[p.t](s, p, `${s.i}:${k}`, next);
    }
    // **жирне** у репліках
    const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
    const qp = (t) => el("p", "q", rich(t));
    function table(rows) {
      const t = el("table", "tbl");
      rows.forEach((r, i) => { const tr = el("tr"); r.forEach((c) => tr.append(el(i ? "td" : "th", "", esc(c)))); t.append(tr); });
      return t;
    }
    const noteLabel = (p, s) => p.term ? p.term : p.table ? `${s.topic} — таблиця` : (p.rule || "").split("\n")[0].slice(0, 60);
    function addNote(s, p, k) {
      const id = `${s.i}:${k}`;
      if (!st.notes.some((n) => n.id === id)) { st.notes.push({ id, label: noteLabel(p, s), term: p.term, def: p.def, rule: p.rule, table: p.table }); saveSt(); renderHud(); }
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
        DEMO[p.kind](dBody, () => { b.disabled = false; });
        if (isDone(s)) b.disabled = false;
      },
      check(s, p, k, next) {
        if (k in st.checks) {
          dBody.append(el("p", "say", "Цю перевірку ти вже пройшов(ла) — вона зарахована."));
          footer([["Далі →", "pri", next]]); return;
        }
        dBody.append(el("div", "chk", "🔎 Перевірка — текст сховано, користуйся своїм зошитом"));
        TASK[p.type]({ task: p, sname: st.name }, dBody, (ok, x) => {
          if (!isDone(s)) { st.checks[k] = ok ? 1 : 0; saveSt(); }
          const fb = el("div", "fb " + (ok ? "ok" : "bad"), (ok ? "✅ Правильно!" : "❌ Не зовсім.") + (x ? ` <span>${x}</span>` : ""));
          dBody.append(fb); footer([["Далі →", "pri", next]]);
          fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      },
      gate(s, p, k, next) {
        const left = stations.filter((x) => x.optional && !isDone(x));
        if (!left.length) return next();
        dBody.append(el("p", "say", rich(`Вітаю, стажере! Можна складати перевірку вже зараз — це до **9 балів**. А хто хоче **12** — спершу зазирни в ⭐ Музей анімації: там ще ${left.length} ${left.length === 1 ? "станція" : "станції"}. Після перевірки повернутися вже не вийде.`)));
        footer([["⭐ Іду в музей", "", closeDlg], ["Складати зараз", "pri", next]]);
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

    /* ============================================================ ЗОШИТ */
    const book = $("#book");
    function openBook() {
      if (!st) return;
      const body = $("#bookBody"); body.innerHTML = "";
      body.append(el("p", "say", "Тут — лише <b>назви</b> того, що ти мав(ла) записати. Сам текст — у твоєму паперовому зошиті. Наприкінці уроку побачиш усе повністю й зможеш звірити."));
      if (!st.notes.length) body.append(el("p", "hint", "Поки порожньо."));
      const ul = el("ul", "blist"); st.notes.forEach((n) => ul.append(el("li", "", esc(n.label)))); body.append(ul);
      book.hidden = false; paused = true;
    }
    function closeBook() { if (book.hidden) return; book.hidden = true; if (!openSt && $("#res").hidden && st && !st.finished) paused = false; }
    $("#bookBtn").onclick = openBook; $("#bookClose").onclick = closeBook;
    book.addEventListener("click", (e) => { if (e.target === book) closeBook(); });

    /* ============================================================ ФІНАЛ */
    function finishAll() {
      st.finished = true; paused = true; hud.hidden = true;
      const sc = score(), total = CHECKS.length, g12 = Math.max(1, Math.round(sc / total * 12));
      const sec = Math.round((Date.now() - st.start) / 1000);
      const ak = `${KEY}:att:${st.cls}|${personKey(st.name)}`, att = store.get(ak, 0) + 1; store.set(ak, att);
      saveSt();
      const wrong = CHECKS.map((k, i) => (st.checks[k] ? 0 : i + 1)).filter(Boolean).join(", ");
      const skipped = stations.filter((s) => s.optional && !isDone(s)).length;
      queueResult({ ts: new Date().toISOString(), testId: Q.id, test: Q.title, kind: "quest", cls: st.cls, name: st.name, attempt: att, score: sc, total, grade12: g12, violations: st.viol, durationSec: sec, wrong, note: "🕹️ урок-квест" + (skipped ? `; ⭐ пропущено: ${skipped}` : "") + (st.viol ? `; виходів: ${st.viol}` : "") });
      $("#rGrade").textContent = g12; $("#rScore").textContent = `${sc} з ${total}`; $("#rTime").textContent = `${Math.floor(sec / 60)} хв ${sec % 60} с`;
      $("#rTitle").textContent = g12 >= 10 ? "Стажування пройдено блискуче!" : g12 >= 7 ? "Стажування пройдено!" : "Стажування пройдено — але варто повторити";
      const ul = $("#rList"); ul.innerHTML = "";
      stations.forEach((s) => { const ks = s.steps.map((p, k) => p.t === "check" ? `${s.i}:${k}` : null).filter(Boolean); if (!ks.length) return; const got = ks.filter((k) => st.checks[k]).length; ul.append(el("li", got === ks.length ? "ok" : "bad", `${esc(s.topic)} <small>${got}/${ks.length}</small>`)); });
      const nb = $("#rNotes"); nb.innerHTML = "";
      stations.forEach((s) => s.steps.forEach((p, k) => { if (p.t === "write" || (p.t === "say" && p.write)) { if (!s.optional || isDone(s)) nb.append(p.t === "write" ? noteCard(p) : noteBox(table(p.table), `✍️ ${s.topic} — таблиця`)); } }));
      $("#toast").hidden = true; $("#res").hidden = false;
    }
    $("#again").onclick = () => { store.set(KEY + ":run", null); location.reload(); };

    function queueResult(row) { const box = store.get("qz:outbox", []); box.push(row); store.set("qz:outbox", box); flush(); }
    async function flush() {
      if (!CFG.SHEETS_URL) return;
      let box = store.get("qz:outbox", []);
      while (box.length) {
        try { await fetch(CFG.SHEETS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(box[0]) }); box.shift(); store.set("qz:outbox", box); }
        catch (e) { break; }
      }
    }
    window.QUEST.debug = { findPath, goTo, stations, P, st: () => st, openStation, finishAll, available };
  }

  /* ---------------------------------------------------------- сповіщення */
  let toastT = 0;
  function toast(t, ms = 2600) { const e = $("#toast"); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { e.hidden = true; }, ms); }

  /* ---------------------------------------------------------- запуск */
  const id = (new URLSearchParams(location.search).get("q") || "7-07").replace(/[^\w-]/g, "");
  const s = document.createElement("script");
  s.src = `quests/${id}.js?v=${Date.now() / 6e5 | 0}`;
  s.onload = () => LIST.length ? run(LIST[0]) : ($("#sTitle").textContent = "Квест не знайдено");
  s.onerror = () => { $("#sTitle").textContent = "Квест не знайдено"; };
  document.head.append(s);
})();
