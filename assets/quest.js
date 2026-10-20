/* =====================================================================
   Квести: учень ходить картою, підходить до персонажів і виконує завдання.
   Сторінка: quest.html?q=<id файлу в quests/>, наприклад quest.html?q=7-07.

   Формат файлу quests/<id>.js:
   QUEST.add({
     id, grade, lesson, title, intro,
     rooms: [{ id, name, decor: "cinema|booth|pcs|workshop|library|museum", row: 0|1, col: 0|1|2, star? }],
     stations: [{
       room, at: [fx, fy] (частки кімнати), star?,
       npc: { name, look: "#колір", hat: "cap|bun|long|short|beret|pony|messy", glasses? },
       say: "репліка персонажа",
       task: { type, ... }   — варіанти беруться випадково для кожного учня:
         choice  { v: [["питання", ["правильна", "хибна", …], "пояснення"], …] }
         calc    { gen: (R) => ({ q, ans: число, unit, x }) }      — числа свої для кожного учня
         order   { v: [{ q, items: [у правильному порядку], x }] }
         sort    { v: [{ q, groups: [2 назви], items: [["текст", № групи]], x }] }
         spot    { v: [{ q, target: "top|tools|stage|palette|params|layers|timeline|play" }] }  — вікно «Аніматора»
         markers { v: [{ goal: "move|size|rotate", q }] }          — маркери вибраного об'єкта
         spin    { then: [варіанти choice] }                        — тауматроп, потім питання
         copy    { v: [{ term, text }] }                            — переписати визначення (вставлення вимкнено)
       note: { term?, def?, rule? }  — картка «✍️ Запиши в зошит» після завдання
     }]
   });
   Кожна станція — 1 бал, оцінка = бали / станції · 12. Результат летить у ту саму таблицю, що й тести.
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
    const stations = Q.stations.map((s, i) => { const rr = roomOf(s.room).rr; return { ...s, i, x: rr.x + s.at[0] * rr.w, y: rr.y + s.at[1] * rr.h, roomName: roomOf(s.room).name }; });
    const npcSolid = (s) => rect(s.x - 13, s.y - 6, 26, 22);
    const WALLS = buildWalls(rooms);
    SOLIDS = WALLS.concat(...deco.map((d) => d.d.solids)).concat(stations.map(npcSolid));
    buildGrid();
    const N = stations.length;

    /* -------- стан */
    let st = null; // { cls, name, start, done: {i: 0|1}, notes: [...], viol, x, y }
    const saveSt = () => { if (st) store.set(KEY + ":run", st); };
    const P = { x: 380, y: 550, dir: 1, path: null, goal: null, moving: false };
    let paused = true, openSt = null;

    /* -------- DOM */
    const cv = $("#world"), ctx = cv.getContext("2d");
    const hud = $("#hud"), list = $("#qList"), bar = $("#qBar i"), prog = $("#qProg"), nextEl = $("#qNext"), talkBtn = $("#talk");
    $("#qTitle").textContent = Q.title;
    $("#sTitle").textContent = Q.title;
    $("#sIntro").textContent = Q.intro;
    $("#sEyebrow").textContent = `${Q.grade} клас · урок ${Q.lesson} · 🕹️ квест`;
    $("#backLink").href = `index.html?l=${Q.grade}-${String(Q.lesson).padStart(2, "0")}`;

    const clsSel = $("#cls"), nameIn = $("#name"), goBtn = $("#go");
    const classes = (CFG.CLASSES || []).filter((c) => c.startsWith(String(Q.grade)));
    clsSel.innerHTML = `<option value="">— клас —</option>` + classes.map((c) => `<option>${esc(c)}</option>`).join("");
    const last = store.get("qz:me", null);
    if (last) { if (classes.includes(last.cls)) clsSel.value = last.cls; nameIn.value = last.name || ""; }
    const ready = () => { goBtn.disabled = !(clsSel.value && nameIn.value.trim().split(/\s+/).length >= 2); };
    clsSel.onchange = nameIn.oninput = ready; ready();

    const saved = store.get(KEY + ":run", null);
    if (saved && !saved.finished && Object.keys(saved.done).length) {
      $("#resume").hidden = false;
      $("#resume").innerHTML = `Є незавершений квест: <b>${esc(saved.name)}</b>, ${Object.keys(saved.done).length} з ${N}. Натисни «Почати» з тим самим іменем — продовжиш з того місця.`;
    }

    goBtn.onclick = () => {
      const cls = clsSel.value, name = nameIn.value.trim().replace(/\s+/g, " ");
      store.set("qz:me", { cls, name });
      const prev = store.get(KEY + ":run", null);
      if (prev && !prev.finished && prev.cls === cls && personKey(prev.name) === personKey(name)) st = prev;
      else st = { cls, name, start: Date.now(), done: {}, notes: [], viol: 0, x: 380, y: 550 };
      P.x = st.x; P.y = st.y;
      $("#start").hidden = true; hud.hidden = false; paused = false;
      renderHud(); saveSt();
      toast("Підходь до тих, у кого над головою «!» — клацни по них або підійди й натисни E", 5000);
    };

    /* -------- HUD */
    function renderHud() {
      const done = Object.keys(st.done).length, score = Object.values(st.done).reduce((a, b) => a + b, 0);
      prog.textContent = `Виконано ${done} з ${N}`;
      bar.style.width = (done / N * 100) + "%";
      list.innerHTML = "";
      stations.forEach((s) => {
        const li = el("li", s.i in st.done ? (st.done[s.i] ? "ok" : "bad") : "");
        li.innerHTML = `<span class="box"></span><span><b>${esc(s.npc.name)}</b><small>${esc(s.roomName.replace("⭐ ", ""))}${s.star ? " · ⭐" : ""}</small></span>`;
        li.onclick = () => { goTo(s); };
        list.appendChild(li);
      });
      $("#bookN").textContent = st.notes.length;
      void score;
    }
    function nextStation() {
      let best = null, bd = 1e9;
      for (const s of stations) if (!(s.i in st.done)) { const d = Math.hypot(s.x - P.x, s.y - P.y) + (s.star ? 1500 : 0); if (d < bd) { bd = d; best = s; } }
      return best;
    }
    $("#listToggle").onclick = () => hud.classList.toggle("open");

    /* -------- рух */
    const keys = new Set();
    const KM = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
    addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input,textarea,select")) return;
      if (KM[e.code]) { keys.add(KM[e.code]); P.path = null; P.goal = null; e.preventDefault(); }
      if ((e.code === "KeyE" || e.code === "Enter" || e.code === "Space") && !paused && near) { e.preventDefault(); openStation(near); }
      if (e.code === "KeyN" && !paused) openBook();
      if (e.code === "Escape") { closeBook(); }
    });
    addEventListener("keyup", (e) => { if (KM[e.code]) keys.delete(KM[e.code]); });
    addEventListener("blur", () => keys.clear());

    function goTo(s) {
      if (paused) return;
      const path = findPath(P, s.x, s.y, TALK_R - 30);
      if (path) { P.path = path; P.goal = s; }
      hud.classList.remove("open");
    }
    let cam = { x: P.x, y: P.y, z: 1 };
    cv.addEventListener("pointerdown", (e) => {
      if (paused) return;
      const r = cv.getBoundingClientRect(), wx = (e.clientX - r.left - r.width / 2) / cam.z + cam.x, wy = (e.clientY - r.top - r.height / 2) / cam.z + cam.y;
      const hit = stations.find((s) => Math.hypot(s.x - wx, s.y - wy + 8) < 34);
      if (hit) { if (Math.hypot(hit.x - P.x, hit.y - P.y) < TALK_R) openStation(hit); else goTo(hit); return; }
      const path = findPath(P, wx, wy, 14);
      if (path) { P.path = path; P.goal = null; marker = { x: wx, y: wy, t: 0 }; }
    });
    let marker = null;

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
      nextEl.innerHTML = nx ? `${nx.star ? "⭐ " : ""}Далі: <b>${esc(nx.npc.name)}</b> · ${esc(nx.roomName.replace("⭐ ", ""))}` : "Усі станції пройдено!";
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
      // підлоги
      tileFloor(rect(30, COR[0], WW - 60, COR[1] - COR[0]), "#e2e8f0", "#d8dee8", 40);
      for (const { room, d } of deco) { tileFloor(room.rr, d.floor[0], d.floor[1], 32); }
      // килимова доріжка й старт
      ctx.fillStyle = "rgba(79,70,229,.12)"; ctx.fillRect(40, 528, WW - 80, 44);
      label(ctx, "СТАРТ →", 344, 550, 12, "#64748b", "right");
      for (const { room } of deco) { const dx = doorX(room.rr), y = room.row ? COR[1] + 18 : COR[0] - 18; label(ctx, room.name, dx, room.row ? COR[1] - 20 : COR[0] + 20, 14, "#334155"); void y; }
      for (const { d } of deco) d.draw(ctx, tt);
      // стіни
      ctx.fillStyle = "#475569"; for (const w of WALLS) ctx.fillRect(w.x, w.y, w.w, w.h);
      // ціль
      if (marker) { marker.t += dt; ctx.strokeStyle = `rgba(79,70,229,${Math.max(0, 1 - marker.t)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(marker.x, marker.y, 8 + marker.t * 14, 0, 7); ctx.stroke(); if (marker.t > 1) marker = null; }
      // стрілка до наступної станції
      const nx = st && nextStation();
      if (nx && !paused && Math.hypot(nx.x - P.x, nx.y - P.y) > TALK_R + 30) {
        const a = Math.atan2(nx.y - P.y, nx.x - P.x); ctx.save(); ctx.translate(P.x + Math.cos(a) * 34, P.y + Math.sin(a) * 34); ctx.rotate(a);
        ctx.fillStyle = nx.star ? "#eab308" : "#4f46e5"; ctx.globalAlpha = 0.75 + Math.sin(tt * 5) * 0.2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore();
      }
      // персонажі в порядку глибини
      const people = stations.map((s) => ({ y: s.y, f: () => drawNpc(s) })).concat([{ y: P.y, f: () => drawPerson(ctx, P.x, P.y, "#2563eb", { walk: P.moving, t: tt, dir: P.dir, hat: "short", hair: "#1f2937" }) }]);
      people.sort((a, b) => a.y - b.y).forEach((p) => p.f());
      requestAnimationFrame(frame);
    }
    function drawNpc(s) {
      drawPerson(ctx, s.x, s.y, s.npc.look, { hat: s.npc.hat, glasses: s.npc.glasses, t: tt, dir: Math.sign(P.x - s.x) * 0.6 });
      ctx.font = "600 11px Rubik, system-ui, sans-serif"; const w = ctx.measureText(s.npc.name).width + 12;
      rrect(ctx, s.x - w / 2, s.y + 20, w, 16, 8); ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.fill();
      label(ctx, s.npc.name, s.x, s.y + 28.5, 11, "#1f2937");
      const done = st && s.i in st.done, by = s.y - 44 + (done ? 0 : Math.sin(tt * 4 + s.i) * 3);
      ctx.beginPath(); ctx.arc(s.x, by, 11, 0, 7);
      ctx.fillStyle = done ? (st.done[s.i] ? "#16a34a" : "#ea580c") : s.star ? "#eab308" : "#facc15"; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5; ctx.stroke();
      label(ctx, done ? (st.done[s.i] ? "✓" : "✗") : s.star ? "★" : "!", s.x, by + 1, 14, done ? "#fff" : "#422006");
    }
    requestAnimationFrame(frame);

    /* -------- вихід із вкладки */
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && st && !st.finished && $("#start").hidden) { st.viol++; saveSt(); toast("Виходити з квесту не можна — це фіксується.", 3500); }
    });

    /* ============================================================ ДІАЛОГ СТАНЦІЇ */
    const dlg = $("#dlg"), dBody = $("#dBody");
    function openStation(s) {
      if (openSt) return;
      openSt = s; paused = true; $("#toast").hidden = true; keys.clear(); P.path = null; talkBtn.hidden = true;
      $("#dWho").textContent = s.npc.name; $("#dWhere").textContent = s.roomName + (s.star ? " · ⭐ для 12 балів" : "");
      $("#dAva").style.background = s.npc.look; $("#dAva").textContent = s.npc.name.split(" ").pop()[0];
      dBody.innerHTML = "";
      if (s.i in st.done) {
        dBody.append(el("p", "say", "Дякую, ти мені вже допоміг(ла)! Зазирни до інших — над ними «!»."));
        if (s.note) dBody.append(noteCard(s.note));
        footer([["Добре", "pri", closeDlg]]);
      } else {
        dBody.append(el("p", "say", esc(s.say)));
        TASK[s.task.type](s, dBody, (ok, x) => finish(s, ok, x));
      }
      dlg.hidden = false;
      setTimeout(() => { const f = dlg.querySelector("input,textarea,button.opt,button.pri"); if (f && matchMedia("(pointer:fine)").matches) f.focus(); }, 30);
    }
    function closeDlg() {
      dlg.hidden = true; openSt = null; paused = false;
      if (Object.keys(st.done).length === N && !st.finished) finishAll();
    }
    function footer(btns) {
      const f = $("#dFoot"); f.innerHTML = "";
      for (const [t, cls, fn, dis] of btns) { const b = el("button", "btn " + (cls || ""), t); b.onclick = fn; if (dis) b.disabled = true; f.append(b); }
      return f;
    }
    function finish(s, ok, x) {
      st.done[s.i] = ok ? 1 : 0;
      if (s.note && !st.notes.some((n) => n.i === s.i)) st.notes.push({ i: s.i, ...s.note });
      saveSt(); renderHud();
      const fb = el("div", "fb " + (ok ? "ok" : "bad"), (ok ? "✅ Правильно!" : "❌ Не зовсім.") + (x ? ` <span>${x}</span>` : ""));
      dBody.append(fb);
      if (s.note) dBody.append(noteCard(s.note, true));
      footer([["Далі →", "pri", closeDlg]]);
      fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
      $("#bookBtn").classList.add("pulse"); setTimeout(() => $("#bookBtn").classList.remove("pulse"), 1600);
    }
    function noteCard(n, fresh) {
      const c = el("div", "note" + (n.term && n.term.startsWith("⭐") ? " star" : ""));
      c.innerHTML = `<div class="tag">✍️ Запиши в зошит${fresh ? " · додано в 📒" : ""}</div>` + (n.term ? `<p><b>${esc(n.term.replace("⭐ ", ""))}</b> — ${esc(n.def)}</p>` : "") + (n.rule ? `<p class="rule">${esc(n.rule)}</p>` : "");
      return c;
    }

    /* ---------------- типи завдань: (станція, контейнер, done(ok, пояснення)) */
    const qp = (t) => el("p", "q", esc(t));
    const TASK = {
      choice(s, box, done, variants) {
        const v = R.pick(variants || s.task.v), ok = v[1][0];
        box.append(qp(v[0]));
        const opts = el("div", "opts"); let sel = null;
        for (const o of R.shuffle(v[1])) { const b = el("button", "opt", esc(o)); b.onclick = () => { if (b.disabled) return; opts.querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); sel = o; ans.disabled = false; }; opts.append(b); }
        box.append(opts);
        const [ans] = footer([["Відповісти", "pri", () => {
          opts.querySelectorAll(".opt").forEach((b) => { b.disabled = true; if (b.textContent === ok) b.classList.add("right"); else if (b.classList.contains("sel")) b.classList.add("wrong"); });
          done(sel === ok, esc(v[2] || ""));
        }, true]]).children;
      },
      calc(s, box, done) {
        const v = s.task.gen(R);
        box.append(qp(v.q));
        const row = el("div", "calc"); const inp = el("input"); inp.type = "text"; inp.inputMode = "decimal"; inp.autocomplete = "off"; inp.placeholder = "Відповідь";
        row.append(inp, el("span", "unit", esc(v.unit || ""))); box.append(row);
        box.append(el("p", "hint", "💡 Порахуй у зошиті й впиши лише число."));
        const [ans] = footer([["Відповісти", "pri", () => {
          const n = parseFloat(inp.value.replace(",", ".").replace(/[^\d.\-]/g, ""));
          inp.disabled = true; ans.disabled = true; done(Math.abs(n - v.ans) < 1e-6, esc(v.x));
        }, true]]).children;
        inp.oninput = () => { ans.disabled = !inp.value.trim(); };
        inp.onkeydown = (e) => { if (e.key === "Enter" && !ans.disabled) ans.click(); };
      },
      order(s, box, done) {
        const v = R.pick(s.task.v); box.append(qp(v.q));
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
        }, true]]).children;
        draw();
      },
      sort(s, box, done) {
        const v = R.pick(s.task.v); box.append(qp(v.q));
        box.append(el("p", "hint", "💡 Для кожного рядка натисни, куди він належить."));
        const tbl = el("div", "sort"); box.append(tbl);
        const pick = {}; const items = R.shuffle(v.items);
        items.forEach(([t], k) => {
          const row = el("div", "srow", `<span>${esc(t)}</span>`); const bs = el("div", "sbtns");
          v.groups.forEach((g, gi) => { const b = el("button", "sb", esc(g)); b.onclick = () => { if (b.disabled) return; pick[k] = gi; bs.querySelectorAll(".sb").forEach((x, xi) => x.classList.toggle("sel", xi === gi)); ans.disabled = Object.keys(pick).length !== items.length; }; bs.append(b); });
          row.append(bs); tbl.append(row);
        });
        const [ans] = footer([["Відповісти", "pri", () => {
          let ok = true;
          tbl.querySelectorAll(".srow").forEach((row, k) => { const good = pick[k] === items[k][1]; if (!good) ok = false; row.classList.add(good ? "right" : "wrong"); row.querySelectorAll(".sb").forEach((b) => { b.disabled = true; }); });
          ans.disabled = true; done(ok, esc(v.x || ""));
        }, true]]).children;
      },
      spot(s, box, done) {
        const v = R.pick(s.task.v); box.append(qp(v.q));
        const zones = [["top", "Верхня панель", "📄 Новий проєкт · 💾 Зберегти · 📂 Мої проєкти"], ["tools", "Інструменти", "↖ ▭ ◯ △ ╱ T 🙂 🪣 🗑"], ["stage", "Робоче поле", ""], ["palette", "Колірна палітра", ""], ["params", "Параметри", "X · Y · ширина · кут"], ["layers", "Шари", "тло · анімація"], ["timeline", "Шкала кадрів", ""], ["play", "Програвач", "▶ ⟳ 24"]];
        const win = el("div", "anim"); win.innerHTML = `<div class="ttl"><i></i><i></i><i></i> Аніматор Ліцею</div>`;
        const names = { top: "верхня панель", tools: "панель інструментів", stage: "робоче поле", palette: "колірна палітра", params: "панель параметрів", layers: "шари", timeline: "шкала кадрів", play: "програвач" };
        for (const [id, t, sub] of zones) {
          const z = el("button", "z z-" + id); z.dataset.z = id; z.setAttribute("aria-label", t);
          if (id === "stage") z.innerHTML = `<span class="ball"></span><span class="sq"></span>`;
          else if (id === "palette") z.innerHTML = `<span class="sw" style="background:#ef4444"></span><span class="sw" style="background:#f59e0b"></span><span class="sw" style="background:#22c55e"></span><span class="sw" style="background:#3b82f6"></span><span class="sw" style="background:#a855f7"></span><span class="sw" style="background:#111"></span>`;
          else if (id === "timeline") z.innerHTML = Array.from({ length: 12 }, (_, k) => `<span class="fr${k === 3 ? " cur" : ""}">${k + 1}</span>`).join("");
          else z.innerHTML = `<span class="zs">${esc(sub)}</span>`;
          z.onclick = () => {
            win.querySelectorAll(".z").forEach((x) => { x.disabled = true; });
            const ok = id === v.target; z.classList.add(ok ? "right" : "wrong");
            if (!ok) win.querySelector(".z-" + v.target).classList.add("right");
            done(ok, ok ? `Це ${names[id]}.` : `Ти клацнув(ла) «${names[id]}», а треба — «${names[v.target]}» (підсвічено зеленим).`);
          };
          win.append(z);
        }
        box.append(win);
        box.append(el("p", "hint", "💡 Клацни потрібну частину вікна. Підписів немає — як у справжній програмі."));
        footer([]);
      },
      markers(s, box, done) {
        const v = R.pick(s.task.v); box.append(qp(v.q));
        box.append(el("p", "hint", "💡 Сам м'яч не тягнеться — лише маркери навколо нього. Тягни мишею або пальцем, потім натисни «Перевірити»."));
        const NS = "http://www.w3.org/2000/svg", VW = 340, VH = 220;
        const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`); svg.classList.add("mk");
        const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
        const b0 = { x: 110, y: 115, s: 70, a: 0 }, b = { ...b0 };
        const tgt = { x: 230, y: 70, w: 92, h: 92 };
        mk("rect", { x: 0, y: 0, width: VW, height: VH, fill: "#bae6fd" });
        if (v.goal === "move") mk("rect", { x: tgt.x, y: tgt.y, width: tgt.w, height: tgt.h, fill: "rgba(34,197,94,.15)", stroke: "#16a34a", "stroke-width": 2, "stroke-dasharray": "6 5", rx: 8 });
        const g = mk("g", {}); const ball = document.createElementNS(NS, "ellipse"), stripe = document.createElementNS(NS, "rect"); g.append(ball, stripe);
        const frame = mk("rect", { fill: "none", stroke: "#4f46e5", "stroke-dasharray": "4 3", "stroke-width": 1.5 });
        const rotLine = mk("line", { stroke: "#16a34a", "stroke-width": 1.5 });
        const hs = { c: mk("circle", { r: 9, fill: "#fff", stroke: "#4f46e5", "stroke-width": 2.5, class: "h hc" }), rot: mk("circle", { r: 9, fill: "#22c55e", stroke: "#14532d", "stroke-width": 2, class: "h hr" }) };
        ["nw", "ne", "se", "sw"].forEach((k) => { hs[k] = mk("rect", { width: 14, height: 14, fill: "#fff", stroke: "#4f46e5", "stroke-width": 2.5, class: "h hk" }); });
        const used = new Set();
        function draw() {
          const r = b.s / 2;
          g.setAttribute("transform", `translate(${b.x} ${b.y}) rotate(${b.a})`);
          ball.setAttribute("rx", r); ball.setAttribute("ry", r); ball.setAttribute("fill", "#f97316"); ball.setAttribute("stroke", "#9a3412"); ball.setAttribute("stroke-width", 2);
          stripe.setAttribute("x", -r); stripe.setAttribute("y", -4); stripe.setAttribute("width", b.s); stripe.setAttribute("height", 8); stripe.setAttribute("fill", "#fff7ed");
          const rot = (dx, dy) => { const a = b.a * Math.PI / 180; return [b.x + dx * Math.cos(a) - dy * Math.sin(a), b.y + dx * Math.sin(a) + dy * Math.cos(a)]; };
          frame.setAttribute("x", b.x - r); frame.setAttribute("y", b.y - r); frame.setAttribute("width", b.s); frame.setAttribute("height", b.s); frame.setAttribute("transform", `rotate(${b.a} ${b.x} ${b.y})`);
          hs.c.setAttribute("cx", b.x); hs.c.setAttribute("cy", b.y);
          const [rx, ry] = rot(0, -r - 24), [lx, ly] = rot(0, -r); hs.rot.setAttribute("cx", rx); hs.rot.setAttribute("cy", ry);
          rotLine.setAttribute("x1", lx); rotLine.setAttribute("y1", ly); rotLine.setAttribute("x2", rx); rotLine.setAttribute("y2", ry);
          const cs = { nw: [-r, -r], ne: [r, -r], se: [r, r], sw: [-r, r] };
          for (const k in cs) { const [x, y] = rot(...cs[k]); hs[k].setAttribute("x", x - 7); hs[k].setAttribute("y", y - 7); }
        }
        draw();
        const toSvg = (e) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; };
        let drag = null;
        for (const k in hs) hs[k].addEventListener("pointerdown", (e) => { e.preventDefault(); hs[k].setPointerCapture(e.pointerId); const p = toSvg(e); drag = { k, p, b: { ...b } }; used.add(k === "c" ? "move" : k === "rot" ? "rotate" : "size"); });
        svg.addEventListener("pointermove", (e) => {
          if (!drag || locked) return; const p = toSvg(e), d = drag;
          if (d.k === "c") { b.x = clamp(d.b.x + p.x - d.p.x, 10, VW - 10); b.y = clamp(d.b.y + p.y - d.p.y, 10, VH - 10); }
          else if (d.k === "rot") { b.a = Math.round(Math.atan2(p.y - b.y, p.x - b.x) * 180 / Math.PI + 90); }
          else { const d0 = Math.hypot(d.p.x - d.b.x, d.p.y - d.b.y), d1 = Math.hypot(p.x - b.x, p.y - b.y); b.s = clamp(d.b.s * d1 / d0, 24, 190); }
          draw();
        });
        const end = () => { drag = null; }; svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
        let locked = false;
        box.append(svg);
        box.append(el("p", "legend", `<span><i class="lc"></i> центральний</span><span><i class="lk"></i> кутові</span><span><i class="lr"></i> верхній круглий</span>`));
        footer([["↺ Спочатку", "", () => { Object.assign(b, b0); used.clear(); draw(); }], ["Перевірити", "pri", () => {
          const a = ((b.a % 360) + 540) % 360 - 180;
          const ok = v.goal === "move" ? (b.x > tgt.x && b.x < tgt.x + tgt.w && b.y > tgt.y && b.y < tgt.y + tgt.h)
            : v.goal === "size" ? b.s >= b0.s * 1.3 : Math.abs(a) >= 25;
          locked = true; svg.classList.add("locked");
          done(ok, { move: "Переміщують за центральний маркер.", size: "Розмір змінюють кутові маркери.", rotate: "Повертають за верхній круглий (зелений) маркер." }[v.goal] + (used.size > 1 ? " Інші маркери роблять інше: центральний — переміщує, кутові — змінюють розмір, верхній круглий — повертає." : ""));
        }]]);
      },
      spin(s, box, done) {
        box.append(el("p", "hint", "💡 Затисни кнопку «Крутити» (або пробіл) і тримай, доки кружечок не розкрутиться."));
        const c = el("canvas", "spin"); c.width = 440; c.height = 300; box.append(c);
        const meter = el("div", "meter", "<i></i>"); box.append(meter);
        const hold = el("button", "btn hold", "🌀 Крутити (тримай)"); box.append(hold);
        const g = c.getContext("2d"); let ang = 0, w = 0, held = false, good = 0, alive = true, revealed = false;
        const on = (e) => { e.preventDefault(); held = true; }, off = () => { held = false; };
        hold.addEventListener("pointerdown", on); addEventListener("pointerup", off); hold.addEventListener("pointerleave", off);
        const kd = (e) => { if (e.code === "Space") { e.preventDefault(); held = true; } }, ku = (e) => { if (e.code === "Space") held = false; };
        addEventListener("keydown", kd); addEventListener("keyup", ku);
        const side = (bird, a) => { g.globalAlpha = a; if (bird) { g.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🐦", 0, 4); } else { g.strokeStyle = "#334155"; g.lineWidth = 5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 18, -50); g.lineTo(k * 18, 55); g.stroke(); } g.beginPath(); g.arc(0, -50, 38, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(-42, 55); g.lineTo(42, 55); g.stroke(); } g.globalAlpha = 1; };
        let last = performance.now();
        (function loop(now) {
          if (!alive || !document.body.contains(c)) { removeEventListener("keydown", kd); removeEventListener("keyup", ku); removeEventListener("pointerup", off); return; }
          const dt = Math.min(0.05, (now - last) / 1000); last = now;
          w = held ? Math.min(60, w + dt * 30) : Math.max(0, w - dt * 18); ang += w * dt;
          g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 440, 300);
          g.strokeStyle = "#a8a29e"; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 150); g.lineTo(150, 150); g.moveTo(290, 150); g.lineTo(430, 150); g.stroke();
          g.translate(220, 150); const sx = Math.cos(ang), fast = clamp((w - 22) / 20, 0, 1);
          g.scale(fast > 0 ? 1 : Math.max(0.05, Math.abs(sx)), 1);
          g.beginPath(); g.arc(0, 0, 100, 0, 7); g.fillStyle = "#fffbeb"; g.fill(); g.strokeStyle = "#a16207"; g.lineWidth = 4; g.stroke();
          if (fast > 0) { side(true, 0.5 + fast * 0.5); side(false, 0.5 + fast * 0.5); } else side(sx > 0, 1);
          meter.firstChild.style.width = (w / 60 * 100) + "%";
          if (fast >= 1) good += dt; if (good > 1 && !revealed) { revealed = true; reveal(); }
          requestAnimationFrame(loop);
        })(last);
        function reveal() {
          const p = el("p", "say", "Бачиш? Пташка «сидить» у клітці, хоча намальовані вони на різних боках! А тепер питання:"); box.append(p);
          const sub = el("div"); box.append(sub); TASK.choice(s, sub, (ok, x) => { alive = false; done(ok, x); }, s.task.then);
          p.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        footer([]);
      },
      copy(s, box, done) {
        const v = R.pick(s.task.v);
        box.append(qp("Перепиши визначення в картку — літера в літеру. Потім запиши його і в зошит."));
        const src = el("blockquote", "src noselect", esc(v.text)); box.append(src);
        const ta = el("textarea"); ta.rows = 4; ta.placeholder = "Друкуй тут…"; ta.spellcheck = false; box.append(ta);
        const m = el("div", "meter", "<i></i>"), lab = el("p", "hint", "Збіг: 0 %. Треба щонайменше 90 %."); box.append(m, lab);
        for (const ev of ["paste", "drop"]) ta.addEventListener(ev, (e) => { e.preventDefault(); toast("Вставляти не можна — тільки друкувати 🙂"); });
        src.addEventListener("copy", (e) => e.preventDefault());
        const norm = (t) => t.toLowerCase().replace(/[’ʼ`']/g, "'").replace(/[«»“”"]/g, '"').replace(/[—–-]/g, "-").replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
        const target = norm(v.text);
        const sim = (a, b) => { const n = a.length, m2 = b.length; if (!n) return 0; let prev = Array.from({ length: m2 + 1 }, (_, j) => j); for (let i = 1; i <= n; i++) { const cur = [i]; for (let j = 1; j <= m2; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return 1 - prev[m2] / Math.max(n, m2); };
        let pct = 0;
        ta.oninput = () => { pct = Math.round(sim(norm(ta.value), target) * 100); m.firstChild.style.width = pct + "%"; m.classList.toggle("ok", pct >= 90); lab.textContent = `Збіг: ${pct} %. ` + (pct >= 90 ? "Чудово, можна здавати!" : "Треба щонайменше 90 %."); ans.disabled = pct < 90; };
        const [ans] = footer([["Здати картку", "pri", () => { ta.disabled = true; ans.disabled = true; done(true, `Збіг ${pct} %. Тепер — у зошит!`); }, true]]).children;
      }
    };

    /* ============================================================ ЗОШИТ */
    const book = $("#book");
    function openBook() {
      if (!st) return;
      const body = $("#bookBody"); body.innerHTML = "";
      if (!st.notes.length) body.append(el("p", "hint", "Поки порожньо. Допомагай персонажам — після кожного завдання сюди потрапить те, що треба записати."));
      st.notes.slice().sort((a, b) => a.i - b.i).forEach((n) => body.append(noteCard(n)));
      book.hidden = false; paused = true;
    }
    function closeBook() { if (book.hidden) return; book.hidden = true; if (!openSt && $("#res").hidden) paused = false; }
    $("#bookBtn").onclick = openBook; $("#bookClose").onclick = closeBook;
    book.addEventListener("click", (e) => { if (e.target === book) closeBook(); });

    /* ============================================================ ФІНАЛ */
    function finishAll() {
      st.finished = true; paused = true; hud.hidden = true;
      const score = Object.values(st.done).reduce((a, b) => a + b, 0), g12 = Math.max(1, Math.round(score / N * 12));
      const sec = Math.round((Date.now() - st.start) / 1000);
      const ak = `${KEY}:att:${st.cls}|${personKey(st.name)}`, att = store.get(ak, 0) + 1; store.set(ak, att);
      saveSt();
      const wrong = stations.filter((s) => !st.done[s.i]).map((s) => s.i + 1).join(", ");
      queueResult({ ts: new Date().toISOString(), testId: Q.id, test: Q.title, kind: "quest", cls: st.cls, name: st.name, attempt: att, score, total: N, grade12: g12, violations: st.viol, durationSec: sec, wrong, note: "🕹️ квест" + (st.viol ? `; виходів: ${st.viol}` : "") });
      $("#rGrade").textContent = g12; $("#rScore").textContent = `${score} з ${N}`; $("#rTime").textContent = `${Math.floor(sec / 60)} хв ${sec % 60} с`;
      $("#rTitle").textContent = g12 >= 10 ? "Стажування пройдено блискуче!" : g12 >= 7 ? "Стажування пройдено!" : "Стажування пройдено — але варто повторити";
      const ul = $("#rList"); ul.innerHTML = "";
      stations.forEach((s) => ul.append(el("li", st.done[s.i] ? "ok" : "bad", `${esc(s.npc.name)} <small>${esc(s.roomName.replace("⭐ ", ""))}${s.star ? " · ⭐" : ""}</small>`)));
      const nb = $("#rNotes"); nb.innerHTML = ""; st.notes.slice().sort((a, b) => a.i - b.i).forEach((n) => nb.append(noteCard(n)));
      $("#res").hidden = false;
    }
    $("#again").onclick = () => { store.set(KEY + ":run", null); location.reload(); };

    function queueResult(row) {
      const box = store.get("qz:outbox", []); box.push(row); store.set("qz:outbox", box); flush();
    }
    async function flush() {
      if (!CFG.SHEETS_URL) return;
      let box = store.get("qz:outbox", []);
      while (box.length) {
        try { await fetch(CFG.SHEETS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(box[0]) }); box.shift(); store.set("qz:outbox", box); }
        catch (e) { break; }
      }
    }
    window.QUEST.debug = { findPath, goTo, stations, P, st: () => st, openStation, finishAll };
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
