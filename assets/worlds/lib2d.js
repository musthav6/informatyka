/* Спільне для 2D-світів (studio, arena): малювання, персонажі, зіткнення й пошук шляху (A*). */
(function () {
  "use strict";
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rect = (x, y, w, h) => ({ x, y, w, h });
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  function box(ctx, b, fill, stroke, r = 6) { rrect(ctx, b.x, b.y, b.w, b.h, r); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
  function label(ctx, txt, x, y, size = 13, color = "#1f2937", align = "center") { ctx.font = `600 ${size}px Rubik, system-ui, sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(txt, x, y); }
  function emoji(ctx, e, x, y, size) { ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(e, x, y); }

  function drawPerson(ctx, x, y, look, opt = {}) {
    const bob = opt.walk ? Math.sin(opt.t * 14) * 1.5 : 0, s = opt.scale || 1;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.ellipse(0, 15 - bob, 15, 6, 0, 0, 7); ctx.fill();
    rrect(ctx, -12, -4, 24, 20, 9); ctx.fillStyle = look; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -12, 11, 0, 7); ctx.fillStyle = opt.skin || "#fcd9b8"; ctx.fill();
    ctx.fillStyle = opt.hair || "#3f2a1d";
    const h = opt.hat;
    if (h === "cap") { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); ctx.fillRect(opt.dir < 0 ? -18 : 2, -16, 16, 4); }
    else if (h === "bun") { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(0, -26, 6, 0, 7); ctx.fill(); }
    else if (h === "long") { ctx.beginPath(); ctx.arc(0, -14, 12, Math.PI, 0); ctx.fill(); ctx.fillRect(-12, -14, 5, 16); ctx.fillRect(7, -14, 5, 16); }
    else if (h === "beret") { ctx.fillStyle = "#b91c1c"; ctx.beginPath(); ctx.ellipse(-2, -21, 12, 5, -0.2, 0, 7); ctx.fill(); }
    else if (h === "pony") { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.ellipse(12, -10, 4, 9, 0.3, 0, 7); ctx.fill(); }
    else if (h === "messy") { for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 4, -21 + Math.abs(i), 4, 0, 7); ctx.fill(); } }
    else if (h === "helmet") { ctx.fillStyle = opt.helmet || "#334155"; ctx.beginPath(); ctx.arc(0, -15, 12.5, Math.PI, 0); ctx.fill(); ctx.fillStyle = "rgba(56,189,248,.8)"; ctx.fillRect(-9, -15, 18, 5); }
    else { ctx.beginPath(); ctx.arc(0, -15, 11, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = "#1f2937"; const ex = (opt.dir || 0) * 2;
    if (h !== "helmet") { ctx.beginPath(); ctx.arc(-4 + ex, -11, 1.6, 0, 7); ctx.arc(4 + ex, -11, 1.6, 0, 7); ctx.fill(); }
    if (opt.glasses) { ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(-4 + ex, -11, 3.4, 0, 7); ctx.moveTo(7.4 + ex, -11); ctx.arc(4 + ex, -11, 3.4, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  // мітка над персонажем: ✓ пройдено, «…» закрито, «!» / «★» — чекає
  function drawBadge(ctx, x, y, state, t, seed) {
    const open = state === "open" || state === "star", by = y + (open ? Math.sin(t * 4 + seed) * 3 : 0);
    ctx.beginPath(); ctx.arc(x, by, 11, 0, 7);
    ctx.fillStyle = state === "done" ? "#16a34a" : state === "lock" ? "#cbd5e1" : state === "star" ? "#eab308" : "#facc15"; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1.5; ctx.stroke();
    label(ctx, state === "done" ? "✓" : state === "lock" ? "…" : state === "star" ? "★" : "!", x, by + (state === "lock" ? -3 : 1), 14, state === "done" ? "#fff" : state === "lock" ? "#64748b" : "#422006");
  }
  function nameTag(ctx, name, x, y) {
    ctx.font = "600 11px Rubik, system-ui, sans-serif"; const w = ctx.measureText(name).width + 12;
    rrect(ctx, x - w / 2, y, w, 16, 8); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fill();
    label(ctx, name, x, y + 8.5, 11, "#1f2937");
  }

  // Навігація: solids — масив прямокутників; бордюр [x0, y0, x1, y1]
  function makeNav(WW, WH, solids, PR, border) {
    const B = border || [30, 30, WW - 30, WH - 30];
    function hits(x, y, r = PR) {
      if (x < B[0] + r || y < B[1] + r || x > B[2] - r || y > B[3] - r) return true;
      for (const s of solids) {
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
    let GRID;
    function build() { GRID = new Uint8Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) GRID[j * GW + i] = hits(i * CELL + CELL / 2, j * CELL + CELL / 2, PR + 2) ? 1 : 0; }
    build();
    function findPath(from, tx, ty, goalR) {
      const si = clamp(Math.floor(from.x / CELL), 0, GW - 1), sj = clamp(Math.floor(from.y / CELL), 0, GH - 1);
      const g = new Float32Array(GW * GH).fill(1e9), prev = new Int32Array(GW * GH).fill(-1), closed = new Uint8Array(GW * GH);
      const heap = []; const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
      const s = sj * GW + si; g[s] = 0; push(s, 0);
      const H = (i, j) => Math.hypot(i * CELL + CELL / 2 - tx, j * CELL + CELL / 2 - ty);
      let found = -1, guard = 0;
      while (heap.length && guard++ < 25000) {
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
      const out = []; let cur = from, i = 0;
      while (i < pts.length) { let j = pts.length - 1; while (j > i && !lineFree(cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; i = j + 1; }
      return out;
    }
    return { hits, findPath, rebuild: build };
  }

  // Типовий «ходок» 2D: клавіатура, клацання/дотик по карті, віртуальний джойстик не потрібен
  function makeWalker(opts) {
    const { canvas, nav, P, speed = 250, getCam, onTap } = opts;
    const keys = new Set();
    const KM = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
    let paused = true, marker = null;
    addEventListener("keydown", (e) => { if (e.target.closest && e.target.closest("input,textarea,select")) return; if (KM[e.code] && !paused) { keys.add(KM[e.code]); P.path = null; P.goal = null; e.preventDefault(); } });
    addEventListener("keyup", (e) => { if (KM[e.code]) keys.delete(KM[e.code]); });
    addEventListener("blur", () => keys.clear());
    canvas.addEventListener("pointerdown", (e) => {
      if (paused) return;
      const cam = getCam(), r = canvas.getBoundingClientRect();
      const wx = (e.clientX - r.left - r.width / 2) / cam.z + cam.x, wy = (e.clientY - r.top - r.height / 2) / cam.z + cam.y;
      if (onTap && onTap(wx, wy)) return;
      const path = nav.findPath(P, wx, wy, 14);
      if (path) { P.path = path; P.goal = null; marker = { x: wx, y: wy, t: 0 }; }
    });
    return {
      setPaused(p) { paused = p; keys.clear(); if (p) P.path = null; },
      go(tx, ty, r, goal) { const path = nav.findPath(P, tx, ty, r); if (path) { P.path = path; P.goal = goal || null; return true; } return false; },
      update(dt) {
        if (paused) { P.moving = false; return; }
        let vx = 0, vy = 0;
        if (keys.has("u")) vy--; if (keys.has("d")) vy++; if (keys.has("l")) vx--; if (keys.has("r")) vx++;
        const sp = speed * (P.boost || 1);
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
          if (!nav.hits(nx, P.y)) P.x = nx; if (!nav.hits(P.x, ny)) P.y = ny;
        }
      },
      drawMarker(ctx, dt) { if (!marker) return; marker.t += dt; ctx.strokeStyle = `rgba(79,70,229,${Math.max(0, 1 - marker.t)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(marker.x, marker.y, 8 + marker.t * 14, 0, 7); ctx.stroke(); if (marker.t > 1) marker = null; }
    };
  }
  function drawArrow(ctx, from, to, color, t) {
    const a = Math.atan2(to.y - from.y, to.x - from.x); ctx.save(); ctx.translate(from.x + Math.cos(a) * 34, from.y + Math.sin(a) * 34); ctx.rotate(a);
    ctx.fillStyle = color; ctx.globalAlpha = 0.75 + Math.sin(t * 5) * 0.2; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore();
  }
  // canvas на весь екран з урахуванням DPR
  function fitCanvas(cv) {
    const st = { W: 0, H: 0, DPR: 1 };
    const f = () => { st.DPR = Math.min(2, devicePixelRatio || 1); st.W = innerWidth; st.H = innerHeight; cv.width = st.W * st.DPR; cv.height = st.H * st.DPR; cv.style.width = st.W + "px"; cv.style.height = st.H + "px"; };
    addEventListener("resize", f); f(); return st;
  }
  const stateOf = (core, s) => core.isDone(s) ? "done" : !core.available(s) ? "lock" : s.optional ? "star" : "open";

  window.L2D = { clamp, rect, rrect, box, label, emoji, drawPerson, drawBadge, nameTag, makeNav, makeWalker, drawArrow, fitCanvas, stateOf };
})();
