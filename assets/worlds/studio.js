/* Світ «Кіностудія» (7-07): 2D-карта згори, шість кімнат навколо коридору.
   Станції: room — id кімнати з Q.rooms, at: [fx, fy] — частки кімнати. */
(function () {
  "use strict";
  const { clamp, rect, rrect, box, label, emoji, drawPerson, drawBadge, nameTag, makeNav, makeWalker, drawArrow, fitCanvas, stateOf } = window.L2D;
  const WW = 1600, WH = 1100, CX = [30, 560, 1040, 1570], ROWS = [[30, 470], [630, 1070]], COR = [470, 630];
  const WT = 14, DOOR = 120, PR = 14, TALK_R = 96;
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


  window.QWORLDS.studio = {
    howto: ["🚶 Ходи студією: <b>WASD</b> / стрілки або просто <b>клацни</b> (торкнись) туди, куди треба піти."],
    startHint: "Іди до того, у кого над головою «!» — клацни по ньому або підійди й натисни E",
    init(core, stage) {
      const Q = core.Q;
      const rooms = Q.rooms.map((r) => ({ ...r, rr: roomRect(r) }));
      const roomOf = (id) => rooms.find((r) => r.id === id);
      const deco = rooms.map((r) => ({ room: r, d: DECOR[r.decor](r.rr) }));
      const S = core.stations;
      S.forEach((s) => { const r = roomOf(s.room), rr = r.rr; s.x = rr.x + s.at[0] * rr.w; s.y = rr.y + s.at[1] * rr.h; s.place = r.name.replace("⭐ ", ""); });
      const WALLS = buildWalls(rooms);
      const nav = makeNav(WW, WH, WALLS.concat(...deco.map((d) => d.d.solids)).concat(S.map((s) => rect(s.x - 13, s.y - 6, 26, 22))), PR);
      const cv = document.createElement("canvas"); cv.className = "world"; stage.append(cv);
      const ctx = cv.getContext("2d"), scr = fitCanvas(cv);
      const P = { x: 380, y: 550, dir: 1, path: null, goal: null, moving: false };
      const cam = { x: P.x, y: P.y, z: 1 };
      const walker = makeWalker({ canvas: cv, nav, P, getCam: () => cam, onTap(wx, wy) {
        const hit = S.find((s) => Math.hypot(s.x - wx, s.y - wy + 8) < 34);
        if (!hit) return false;
        if (Math.hypot(hit.x - P.x, hit.y - P.y) < TALK_R) core.open(hit); else api.goTo(hit);
        return true;
      } });
      const tileFloor = (b, a, c, s = 40) => { ctx.fillStyle = a; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = c; for (let y = b.y; y < b.y + b.h; y += s) for (let x = b.x + (((y - b.y) / s) % 2 ? s : 0); x < b.x + b.w; x += s * 2) ctx.fillRect(x, y, Math.min(s, b.x + b.w - x), Math.min(s, b.y + b.h - y)); };
      let T0 = performance.now(), tt = 0, ws = null;
      function frame(now) {
        const dt = Math.min(0.05, (now - T0) / 1000); T0 = now; tt += dt;
        walker.update(dt);
        if (!core.paused && core.st) {
          let near = null, nd = TALK_R;
          for (const s of S) { const d = Math.hypot(s.x - P.x, s.y - P.y); if (d < nd) { nd = d; near = s; } }
          core.near(near);
          if (P.goal && near === P.goal && !P.path) { const g = P.goal; P.goal = null; core.open(g); }
          if (ws && Math.random() < dt) { ws.x = Math.round(P.x); ws.y = Math.round(P.y); core.save(); }
        }
        const { W, H, DPR } = scr;
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
        walker.drawMarker(ctx, dt);
        const nx = core.next();
        if (nx && !core.paused && core.st && Math.hypot(nx.x - P.x, nx.y - P.y) > TALK_R + 30) drawArrow(ctx, P, nx, nx.optional ? "#eab308" : "#4f46e5", tt);
        const people = S.map((s) => ({ y: s.y, f: () => {
          drawPerson(ctx, s.x, s.y, s.npc.look, { hat: s.npc.hat, glasses: s.npc.glasses, t: tt, dir: Math.sign(P.x - s.x) * 0.6 });
          nameTag(ctx, s.npc.name, s.x, s.y + 20);
          if (core.st) drawBadge(ctx, s.x, s.y - 44, stateOf(core, s), tt, s.i);
        } })).concat([{ y: P.y, f: () => drawPerson(ctx, P.x, P.y, "#2563eb", { walk: P.moving, t: tt, dir: P.dir, hat: "short", hair: "#1f2937" }) }]);
        people.sort((a, b) => a.y - b.y).forEach((p) => p.f());
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      const api = {
        start(w) { ws = w; if (w.x) { P.x = w.x; P.y = w.y; } cam.x = P.x; cam.y = P.y; walker.setPaused(false); },
        pause(p) { walker.setPaused(p); if (p) P.goal = null; },
        goTo(s) { if (!walker.go(s.x, s.y, TALK_R - 30, s)) core.toast("Сюди не пройти"); }
      };
      window.QUEST.studio = { P, nav, S };
      return api;
    }
  };
})();
