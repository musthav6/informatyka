/* Світ «Арена» — 2D згори, у стилі командних аренних ігор: яскрава карта, кущі, каміння,
   персонажі-«бійці» з товстим контуром. По арені блукають спам-боти: їх можна збивати
   (⚡ / пробіл / клацання по боту) — за це монети. Оцінки боти не зачіпають.
   Станції: at: [fx, fy] — частки арени. theme: { title, floor: [два кольори], center: "emoji" }.
   Міні-гра світу: { type: "deliver", v: [{ q, groups: [назви зон], items: [["текст", № зони]], x }] }
   — ящики з написами лежать на арені, герой підбирає (підходить) і відносить у потрібну зону. */
(function () {
  "use strict";
  const { clamp, rect, rrect, box, label, emoji, drawPerson, drawBadge, nameTag, makeNav, makeWalker, drawArrow, fitCanvas, stateOf } = window.L2D;
  const WW = 1500, WH = 1050, PR = 16, TALK_R = 100;

  window.QWORLDS.arena = {
    howto: ["🎮 Керування: <b>WASD</b> / стрілки або <b>клацни</b> (торкнись) туди, куди бігти. <b>⚡</b> або пробіл — збити спам-бота (за це монети)."],
    keys: "WASD / стрілки — бігти · клацни по арені — бігти туди · ⚡ / пробіл — збити бота · E — говорити · N — зошит",
    startHint: "Біжи до того, у кого над головою «!». Спам-ботів 👾 можна збивати — це монети!",
    init(core, stage) {
      const Q = core.Q, TH = Q.theme || {};
      const S = core.stations;
      S.forEach((s) => { s.x = s.at[0] * WW; s.y = s.at[1] * WH; s.place = s.zone || ""; });
      // перешкоди: каміння (тверде), кущі (декор), центральна вежа
      const rocks = [rect(330, 220, 90, 60), rect(1080, 220, 90, 60), rect(330, 770, 90, 60), rect(1080, 770, 90, 60), rect(600, 300, 60, 100), rect(760, 720, 60, 100), rect(150, 470, 60, 110), rect(1290, 470, 60, 110)];
      const tower = rect(WW / 2 - 45, WH / 2 - 45, 90, 90);
      const bushes = [[250, 360], [280, 390], [1230, 640], [1260, 610], [700, 280], [820, 760], [460, 640], [1040, 380], [130, 160], [1380, 900]];
      const solids = rocks.concat([tower], S.map((s) => rect(s.x - 15, s.y - 6, 30, 24)));
      const nav = makeNav(WW, WH, solids, PR, [20, 20, WW - 20, WH - 20]);
      const cv = document.createElement("canvas"); stage.append(cv);
      const ctx = cv.getContext("2d"), scr = fitCanvas(cv);
      const P = { x: WW / 2, y: WH / 2 + 110, dir: 1, path: null, goal: null, moving: false, hurt: 0 };
      const cam = { x: P.x, y: P.y, z: 1 };
      let bots = [], fx = [], tt = 0, ws = null, game = null, paused = true;

      const walker = makeWalker({ canvas: cv, nav, P, speed: 270, getCam: () => cam, onTap(wx, wy) {
        const bot = bots.find((b) => Math.hypot(b.x - wx, b.y - wy) < 30);
        if (bot) { zap(bot); return true; }
        if (game) return false;
        const hit = S.find((s) => Math.hypot(s.x - wx, s.y - wy + 8) < 36);
        if (!hit) return false;
        if (Math.hypot(hit.x - P.x, hit.y - P.y) < TALK_R) core.open(hit); else api.goTo(hit);
        return true;
      } });

      // кнопка ⚡ для телефона
      const zapBtn = core.el("button", "zapbtn", "⚡"); zapBtn.setAttribute("aria-label", "Збити найближчого бота"); zapBtn.hidden = true; document.body.append(zapBtn);
      zapBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); zapNearest(); });
      addEventListener("keydown", (e) => { if (e.code === "Space" && !paused && !(e.target.closest && e.target.closest("input,textarea,button"))) { e.preventDefault(); zapNearest(); } });

      function spawnBot() {
        for (let k = 0; k < 20; k++) {
          const x = 60 + Math.random() * (WW - 120), y = 60 + Math.random() * (WH - 120);
          if (Math.hypot(x - P.x, y - P.y) > 380 && !nav.hits(x, y, 18)) { bots.push({ x, y, vx: 0, vy: 0, t: Math.random() * 6, hp: 1 }); return; }
        }
      }
      function zap(b) {
        if (Math.hypot(b.x - P.x, b.y - P.y) > 300) { core.toast("Підбіжи ближче!", 1200); return; }
        fx.push({ k: "beam", x1: P.x, y1: P.y - 10, x2: b.x, y2: b.y, t: 0 });
        fx.push({ k: "boom", x: b.x, y: b.y, t: 0 });
        bots = bots.filter((o) => o !== b); core.addCoins(2);
      }
      function zapNearest() {
        if (paused) return;
        let best = null, bd = 300;
        for (const b of bots) { const d = Math.hypot(b.x - P.x, b.y - P.y); if (d < bd) { bd = d; best = b; } }
        if (best) zap(best); else core.toast("Поруч немає ботів", 900);
      }

      /* ---------------- міні-гра «доставка» */
      function startDeliver(p, R, done) {
        if (game) return; // уже йде
        const v = R.pick(p.v), n = v.groups.length;
        // зони вздовж верхнього краю, ящики — розкидані по арені
        const zones = v.groups.map((g, i) => ({ g, i, x: WW * (i + 1) / (n + 1) - 160, y: 36, w: 320, h: 185 }));
        const spots = R.shuffle([[220, 600], [420, 880], [640, 640], [880, 600], [1100, 880], [1300, 640], [250, 300], [1250, 300], [740, 960], [520, 420], [980, 420]]);
        const crates = R.shuffle(v.items).map(([t, gi], i) => ({ t, gi, x: spots[i % spots.length][0], y: spots[i % spots.length][1], held: false, placed: null }));
        game = { v, zones, crates, done, carry: null, hud: core.el("div", "gamehud bottom") };
        document.body.append(game.hud);
        P.x = WW / 2; P.y = WH / 2 + 110; P.path = null; P.goal = null;
        drawGameHud();
        walker.setPaused(false); paused = false;
      }
      function drawGameHud() {
        const g = game, left = g.crates.filter((c) => c.placed == null).length;
        g.hud.innerHTML = `<div class="big">${core.esc(g.v.q)}</div><small>Підбіжи до ящика — він підніметься. Віднеси в потрібну зону вгорі. Залишилось: ${left}${g.carry ? ` · несеш: «${core.esc(g.carry.t)}»` : ""}</small>`;
      }
      function updateGame() {
        const g = game;
        if (!g.carry) {
          const c = g.crates.find((c) => c.placed == null && !c.held && Math.hypot(c.x - P.x, c.y - P.y) < 42);
          if (c) { c.held = true; g.carry = c; drawGameHud(); }
        } else {
          const z = g.zones.find((z) => P.x > z.x && P.x < z.x + z.w && P.y > z.y && P.y < z.y + z.h + 20);
          if (z) {
            const c = g.carry; c.held = false; c.placed = z.i; g.carry = null;
            const k = g.crates.filter((o) => o.placed === z.i).length - 1;
            c.x = z.x + 82 + (k % 2) * 156; c.y = z.y + 56 + Math.floor(k / 2) * 32;
            fx.push({ k: "boom", x: c.x, y: c.y, t: 0, c: "#a5b4fc" });
            drawGameHud();
            if (g.crates.every((o) => o.placed != null)) endGame();
          }
        }
      }
      function endGame() {
        const g = game; game = null; g.hud.remove();
        const bad = g.crates.filter((c) => c.placed !== c.gi);
        const x = (bad.length ? "Помилки: " + bad.map((c) => `«${core.esc(c.t)}» — це «${core.esc(g.v.groups[c.gi])}»`).join("; ") + ". " : "") + core.esc(g.v.x || "");
        setTimeout(() => g.done(!bad.length, x, bad.length ? `Правильно розкладено ${g.crates.length - bad.length} з ${g.crates.length}.` : `Усі ${g.crates.length} ящики — на своїх місцях!`), 500);
      }

      /* ---------------- кадр */
      let T0 = performance.now();
      function frame(now) {
        const dt = Math.min(0.05, (now - T0) / 1000); T0 = now; tt += dt;
        walker.update(dt);
        if (!paused && core.st) {
          if (!game) {
            let near = null, nd = TALK_R;
            for (const s of S) { const d = Math.hypot(s.x - P.x, s.y - P.y); if (d < nd) { nd = d; near = s; } }
            core.near(near);
            if (P.goal && near === P.goal && !P.path) { const g = P.goal; P.goal = null; core.open(g); }
            else if (P.goal && !P.path) walker.go(P.goal.x, P.goal.y, TALK_R - 30, P.goal); // бот відкинув — доходимо
          } else updateGame();
          // боти
          if (bots.length < (game ? 2 : 4) && Math.random() < dt / 3) spawnBot();
          for (const b of bots) {
            b.t += dt; const d = Math.hypot(P.x - b.x, P.y - b.y);
            let tx = Math.cos(b.t * 0.7) * 60, ty = Math.sin(b.t * 0.9) * 60;
            if (d < 320) { tx = (P.x - b.x) / d * 75; ty = (P.y - b.y) / d * 75; }
            const nx = b.x + tx * dt, ny = b.y + ty * dt;
            if (!nav.hits(nx, b.y, 16)) b.x = nx; if (!nav.hits(b.x, ny, 16)) b.y = ny;
            if (d < 30 && P.hurt <= 0) {
              P.hurt = 1.2; const st = core.st; if (st.coins > 0) { st.coins = Math.max(0, st.coins - 3); core.addCoins(0); }
              const kx = P.x + (P.x - b.x) / d * 60, ky = P.y + (P.y - b.y) / d * 60; if (!nav.hits(kx, ky)) { P.x = kx; P.y = ky; }
              core.toast("Ой! Спам-бот вкрав 3 монети 👾", 1300);
            }
          }
          P.hurt -= dt;
          if (ws && Math.random() < dt) { ws.x = Math.round(P.x); ws.y = Math.round(P.y); core.save(); }
        }
        draw(dt);
        requestAnimationFrame(frame);
      }
      function draw(dt) {
        const { W, H, DPR } = scr;
        const z = clamp(Math.min(W / 950, H / 700), 0.6, 1.25);
        cam.z = z; cam.x += (P.x - cam.x) * Math.min(1, dt * 6); cam.y += (P.y - cam.y) * Math.min(1, dt * 6);
        const hw = W / 2 / z, hh = H / 2 / z;
        cam.x = WW * z > W ? clamp(cam.x, hw, WW - hw) : WW / 2; cam.y = WH * z > H ? clamp(cam.y, hh, WH - hh) : WH / 2;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = "#14532d"; ctx.fillRect(0, 0, W, H);
        ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * (W / 2 - cam.x * z), DPR * (H / 2 - cam.y * z));
        // підлога-плитка
        const f = TH.floor || ["#4ade80", "#3fcf74"];
        for (let y = 0; y < WH; y += 50) for (let x = 0; x < WW; x += 50) { ctx.fillStyle = ((x + y) / 50) % 2 ? f[0] : f[1]; ctx.fillRect(x, y, 50, 50); }
        ctx.strokeStyle = "#0f3d1f"; ctx.lineWidth = 12; ctx.strokeRect(14, 14, WW - 28, WH - 28);
        // кабелі від вежі до станцій
        for (const s of S) { ctx.strokeStyle = core.isDone(s) ? "rgba(250,204,21,.9)" : "rgba(15,23,42,.18)"; ctx.lineWidth = core.isDone(s) ? 5 : 3; ctx.setLineDash(s.optional ? [10, 8] : []); ctx.beginPath(); ctx.moveTo(WW / 2, WH / 2); ctx.lineTo(s.x, s.y); ctx.stroke(); }
        ctx.setLineDash([]);
        // зони міні-гри
        if (game) for (const zn of game.zones) { box(ctx, zn, "rgba(255,255,255,.7)", "#4338ca", 18); label(ctx, zn.g, zn.x + zn.w / 2, zn.y + 22, 18, "#312e81"); }
        for (const r of rocks) { box(ctx, rect(r.x, r.y + 8, r.w, r.h), "#334155", null, 14); box(ctx, r, "#94a3b8", "#334155", 14); }
        // вежа-роутер
        box(ctx, rect(tower.x, tower.y + 10, tower.w, tower.h), "#1e1b4b", null, 18); box(ctx, tower, "#6366f1", "#1e1b4b", 18);
        emoji(ctx, TH.center || "📡", tower.x + tower.w / 2, tower.y + tower.h / 2, 44);
        for (let k = 0; k < 3; k++) { const r = 60 + ((tt * 40 + k * 40) % 120); ctx.strokeStyle = `rgba(99,102,241,${1 - r / 180})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(WW / 2, WH / 2, r, 0, 7); ctx.stroke(); }
        // ящики
        if (game) for (const c of game.crates) {
          const x = c.held ? P.x : c.x, y = c.held ? P.y - 46 : c.y;
          ctx.font = "700 13px Rubik, sans-serif"; const w = Math.min(c.placed != null ? 150 : 230, ctx.measureText(c.t).width + 24);
          box(ctx, rect(x - w / 2, y - 14 + 4, w, 28), "#78350f", null, 8); box(ctx, rect(x - w / 2, y - 14, w, 28), c.placed != null ? "#e0e7ff" : "#fbbf24", "#78350f", 8);
          const lim = c.placed != null ? 19 : 30; label(ctx, c.t.length > lim ? c.t.slice(0, lim - 1) + "…" : c.t, x, y, 13, "#422006");
        }
        // боти
        for (const b of bots) { ctx.save(); ctx.translate(b.x, b.y + Math.sin(b.t * 6) * 2); ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(0, 16, 16, 6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fillStyle = "#ef4444"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#450a0a"; ctx.stroke(); emoji(ctx, "👾", 0, 1, 20); ctx.restore(); }
        walker.drawMarker(ctx, dt);
        const nx = !game && core.st && core.next();
        if (nx && !paused && Math.hypot(nx.x - P.x, nx.y - P.y) > TALK_R + 30) drawArrow(ctx, P, nx, nx.optional ? "#eab308" : "#4f46e5", tt);
        // кущі поверх (у них можна «сховатись»)
        const people = S.map((s) => ({ y: s.y, f: () => {
          ctx.save(); ctx.lineWidth = 5; drawPerson(ctx, s.x, s.y, s.npc.look, { hat: s.npc.hat, glasses: s.npc.glasses, t: tt, dir: Math.sign(P.x - s.x) * 0.6, scale: 1.35 }); ctx.restore();
          nameTag(ctx, s.npc.name, s.x, s.y + 26);
          if (core.st && !game) drawBadge(ctx, s.x, s.y - 54, stateOf(core, s), tt, s.i);
        } })).concat([{ y: P.y, f: () => { ctx.globalAlpha = P.hurt > 0 && Math.sin(tt * 30) > 0 ? 0.4 : 1; drawPerson(ctx, P.x, P.y, TH.hero || "#f97316", { walk: P.moving, t: tt, dir: P.dir, hat: "helmet", helmet: "#1d4ed8", scale: 1.35 }); ctx.globalAlpha = 1; } }]);
        people.sort((a, b) => a.y - b.y).forEach((p) => p.f());
        for (const [x, y] of bushes) { ctx.fillStyle = "#166534"; ctx.beginPath(); ctx.arc(x, y + 6, 34, 0, 7); ctx.fill(); ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(x, y, 32, 0, 7); ctx.fill(); ctx.fillStyle = "#4ade80"; ctx.beginPath(); ctx.arc(x - 10, y - 10, 12, 0, 7); ctx.fill(); }
        // ефекти
        fx = fx.filter((e) => (e.t += dt) < 0.4);
        for (const e of fx) {
          if (e.k === "beam") { ctx.strokeStyle = `rgba(56,189,248,${1 - e.t / 0.4})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke(); }
          else { for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28, r = e.t * 120; ctx.fillStyle = e.c || ["#facc15", "#f472b6", "#38bdf8"][k % 3]; ctx.fillRect(e.x + Math.cos(a) * r - 4, e.y + Math.sin(a) * r - 4, 8, 8); } }
        }
      }
      requestAnimationFrame(frame);

      const api = {
        start(w) { ws = w; if (w.x) { P.x = w.x; P.y = w.y; } cam.x = P.x; cam.y = P.y; paused = false; walker.setPaused(false); zapBtn.hidden = false; for (let k = 0; k < 3; k++) spawnBot(); },
        pause(p) { paused = p; walker.setPaused(p); zapBtn.hidden = p; if (p) P.goal = null; },
        goTo(s) { if (!walker.go(s.x, s.y, TALK_R - 30, s)) core.toast("Сюди не пробігти"); },
        challenge(p, R, done) { if (p.type === "deliver") { zapBtn.hidden = false; startDeliver(p, R, (ok, x, extra) => { paused = true; walker.setPaused(true); zapBtn.hidden = true; done(ok, x, extra); }); } else done(false, "Невідома міні-гра"); },
        celebrate(s) { for (let k = 0; k < 4; k++) fx.push({ k: "boom", x: s.x + (k - 1.5) * 20, y: s.y - 30, t: -k * 0.08 }); },
        finish() { zapBtn.hidden = true; }
      };
      window.QUEST.arena = { P, S, bots: () => bots, game: () => game };
      return api;
    }
  };
})();
