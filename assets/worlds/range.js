/* Світ «Тир» — 3D (three.js r128), вигляд від першої особи, як у тактичних шутерах, але
   мирний: фарбовий тир. Інструктори стоять у кабінках уздовж залу; герой переходить між
   кабінками (клацни інструктора, рядок «Далі» або E). Приціл — за мишею, постріл — клацання;
   на телефоні — торкнись мішені. Між розмовами вискакують тренувальні мішені — за влучання монети.
   theme: { wall, floor, accent, gun }
   Міні-гра світу: { type: "shoot", v: [{ q, rounds: [["що знайти", ["правильна", "хибна", …]]], x }] } або gen: (R) => {…}
   — «#RRGGBB» у варіанті малюється кольоровою мішенню, решта — написом. */
(function () {
  "use strict";
  const GAP = 9, EYE = 1.6;

  window.QWORLDS.range = {
    howto: ["🎯 Це фарбовий тир. Наводь мишкою й <b>клацай</b>, щоб стріляти; на телефоні — просто <b>торкнись</b> мішені. До наступного інструктора — клацни по ньому або по рядку «Далі» внизу."],
    keys: "миша — приціл · клацання — постріл · E — говорити · клацни «Далі» внизу — до наступного інструктора · N — зошит",
    startHint: "Клацни по інструктору з «!» — підійдеш до його кабінки. Тренувальні мішені можна збивати — це монети!",
    init(core, stage) {
      const THREE = window.THREE, TH = core.Q.theme || {};
      const S = core.stations;
      S.forEach((s, i) => { s.bx = i * GAP; s.place = s.optional ? `⭐ кабінка ${i + 1}` : `кабінка ${i + 1}`; });
      const renderer = new THREE.WebGLRenderer({ antialias: !matchMedia("(pointer:coarse)").matches });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      stage.append(renderer.domElement);
      const scene = new THREE.Scene(); scene.background = new THREE.Color(TH.bg || "#0f172a"); scene.fog = new THREE.Fog(scene.background, 25, 60);
      const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
      const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < innerHeight ? 85 : 70; camera.updateProjectionMatrix(); };
      addEventListener("resize", resize); resize();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x475569, 1.05));
      const BOX = new THREE.BoxGeometry(1, 1, 1), M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
      const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); scene.add(m); return m; };
      function textTex(text, opt = {}) {
        const w = opt.w || 512, h = opt.h || 128, c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.fillStyle = opt.bg || "#1e1b4b"; g.fillRect(0, 0, w, h);
        if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16); }
        g.fillStyle = opt.fg || "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
        const lines = String(text).split("\n"); let size = opt.size || 60; const fam = opt.mono ? "Consolas, 'Courier New', monospace" : "Rubik, system-ui, sans-serif";
        const fit = () => { g.font = `800 ${size}px ${fam}`; return lines.every((l) => g.measureText(l).width < w - 36) && lines.length * size * 1.15 < h - 20; };
        while (!fit() && size > 16) size -= 3;
        lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15 + 3));
        return new THREE.CanvasTexture(c);
      }
      function sprite(text, opt = {}) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(text, opt) })); s.scale.set(opt.sx || 2.4, opt.sy || 0.6, 1); scene.add(s); return s; }

      /* ---------------- зал */
      const L = (S.length - 1) * GAP;
      const floorC = document.createElement("canvas"); floorC.width = floorC.height = 128; const fg = floorC.getContext("2d");
      fg.fillStyle = TH.floor || "#334155"; fg.fillRect(0, 0, 128, 128); fg.strokeStyle = "rgba(255,255,255,.12)"; fg.lineWidth = 3; fg.strokeRect(0, 0, 128, 128);
      const ft = new THREE.CanvasTexture(floorC); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set((L + 30) / 2, 14);
      add(new THREE.PlaneGeometry(L + 30, 28), new THREE.MeshLambertMaterial({ map: ft }), L / 2, 0, -5).rotation.x = -Math.PI / 2;
      add(BOX, M(TH.wall || "#475569"), L / 2, 4, -19, L + 30, 8, 0.5); // дальня стіна
      add(BOX, M("#1e293b"), L / 2, 8, -5, L + 30, 0.3, 28); // стеля
      for (let x = -6; x < L + 10; x += 6) { const lt = add(BOX, new THREE.MeshBasicMaterial({ color: 0xe0f2fe }), x, 7.8, -6, 3, 0.1, 0.6); void lt; const pl = new THREE.PointLight(0xffffff, 0.35, 18); pl.position.set(x, 7, -4); scene.add(pl); }
      // кабінки: перегородки й стійка
      S.forEach((s, i) => {
        const x = s.bx;
        [x - GAP / 2, x + GAP / 2].forEach((wx) => add(BOX, M("#64748b"), wx, 1.4, 0, 0.25, 2.8, 8));
        add(BOX, M(TH.accent || "#4f46e5"), x, 0.55, -3.6, GAP - 0.6, 1.1, 0.5); // стійка-бар'єр
        add(BOX, M(s.optional ? "#ca8a04" : "#0f172a"), x, 0.02, -1.5, GAP - 0.6, 0.04, 5); // килимок
        const num = sprite(`${i + 1}`, { bg: s.optional ? "#ca8a04" : TH.accent || "#4f46e5", w: 128, h: 128, size: 90, sx: 0.8, sy: 0.8 }); num.position.set(x, 3.4, 3.9);
        s.topicS = sprite(s.topic || "", { bg: "#0b1222", border: s.optional ? "#eab308" : "#6366f1", size: 50, sx: 4.6, sy: 0.75 }); s.topicS.position.set(x, 5.6, -18.6);
        // декоративні мішені в глибині
        for (let k = -1; k <= 1; k++) { const t = add(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24), M(k ? "#f8fafc" : "#ef4444"), x + k * 2.4, 2.2, -18.6); t.rotation.x = Math.PI / 2; }
      });

      /* ---------------- інструктори */
      function person(look, hat) {
        const g = new THREE.Group(); const part = (c, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(BOX, M(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };
        part(look, 0.8, 0.9, 0.45, 0, 1.25, 0); part("#fcd9b8", 0.6, 0.6, 0.6, 0, 2, 0); part(hat === "helmet" ? "#334155" : "#3f2a1d", 0.66, 0.2, 0.66, 0, 2.38, 0);
        part("#111827", 0.62, 0.12, 0.05, 0, 2.08, 0.31); // окуляри для тиру
        part("#334155", 0.3, 0.8, 0.32, -0.2, 0.4, 0); part("#334155", 0.3, 0.8, 0.32, 0.2, 0.4, 0);
        part(look, 0.24, 0.75, 0.26, -0.55, 1.3, 0); part(look, 0.24, 0.75, 0.26, 0.55, 1.3, 0);
        return g;
      }
      const bangTex = { open: textTex("!", { bg: "#facc15", fg: "#422006", w: 128, h: 128, size: 100 }), star: textTex("★", { bg: "#eab308", fg: "#422006", w: 128, h: 128, size: 100 }), done: textTex("✓", { bg: "#16a34a", fg: "#fff", w: 128, h: 128, size: 100 }), lock: textTex("…", { bg: "#cbd5e1", fg: "#475569", w: 128, h: 128, size: 100 }) };
      S.forEach((s) => {
        const g = person(s.npc.look, s.npc.hat); g.position.set(s.bx + 3.1, 0, -2.6); g.rotation.y = -0.55; scene.add(g); s.mesh = g;
        g.traverse((o) => { o.userData.station = s; });
        s.bang = sprite("!", { w: 128, h: 128, sx: 0.6, sy: 0.6 }); s.bang.position.set(s.bx + 3.1, 3, -2.6); s.bang.userData.station = s;
        const nm = sprite(s.npc.name, { bg: "#ffffff", fg: "#1f2937", size: 54, sx: 1.7, sy: 0.42 }); nm.position.set(s.bx + 3.1, 2.65, -2.6); nm.userData.station = s;
      });

      /* ---------------- зброя (бластер) у кадрі */
      const gun = new THREE.Group();
      const gp = (c, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: c })); m.scale.set(sx, sy, sz); m.position.set(x, y, z); gun.add(m); };
      gp(TH.gun || "#22d3ee", 0.12, 0.13, 0.55, 0, 0, 0); gp("#0f172a", 0.07, 0.07, 0.25, 0, 0.02, -0.38); gp("#0f172a", 0.08, 0.18, 0.1, 0, -0.13, 0.1); gp("#f472b6", 0.13, 0.05, 0.2, 0, 0.09, -0.05);
      camera.add(gun); gun.scale.setScalar(0.55); gun.position.set(0.3, -0.28, -0.62); scene.add(camera);

      /* ---------------- стан камери */
      let cur = 0, camX = 0, glide = null, yaw = 0, pitch = 0, aimX = 0.5, aimY = 0.45, paused = true, tt = 0, game = null, recoil = 0;
      const coarse = matchMedia("(pointer:coarse)").matches;
      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      const targets = []; // { m, kind: "practice"|"game", opt, idx, vx, base }
      const splats = [];
      function paint(p, color) {
        const s = new THREE.Mesh(new THREE.CircleGeometry(0.22 + Math.random() * 0.12, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
        s.position.copy(p); s.lookAt(camera.position); scene.add(s); splats.push({ m: s, t: 0 }); if (splats.length > 40) scene.remove(splats.shift().m);
      }
      function makeTarget(opt) {
        const isCol = /^#[0-9a-f]{6}$/i.test(opt);
        const g = new THREE.Group();
        const plate = new THREE.Mesh(BOX, M("#0b1222")); plate.scale.set(isCol ? 1.9 : 2.7, isCol ? 1.9 : 1.15, 0.12); g.add(plate);
        const face = new THREE.Mesh(isCol ? new THREE.CircleGeometry(0.85, 32) : new THREE.PlaneGeometry(2.55, 1.02), isCol ? new THREE.MeshBasicMaterial({ color: opt }) : new THREE.MeshBasicMaterial({ map: textTex(opt.trim(), { bg: "#f8fafc", fg: "#0f172a", size: 56, w: 640, h: 256, mono: /^#/.test(opt) }) }));
        face.position.z = 0.07; g.add(face);
        if (isCol) { const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xffffff })); ring.position.z = 0.075; g.add(ring); }
        const post = new THREE.Mesh(BOX, M("#475569")); post.scale.set(0.12, 1.6, 0.12); post.position.y = -1.4; g.add(post);
        scene.add(g); return g;
      }
      function spawnPractice() {
        if (game || targets.some((t) => t.kind === "practice")) return;
        const g = new THREE.Group(); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 20), M("#f8fafc")); d.rotation.x = Math.PI / 2; g.add(d);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), M("#ef4444")); c.rotation.x = Math.PI / 2; g.add(c);
        const x = camX + (Math.random() - 0.5) * 5;
        g.position.set(x, 0.5, -10 - Math.random() * 4); scene.add(g);
        targets.push({ m: g, kind: "practice", vx: (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random()), base: camX, rise: 0, life: 6 });
      }

      /* ---------------- міні-гра «тир» */
      function startShoot(p, R, done) {
        if (game) return; // уже йде
        const v = p.gen ? p.gen(R) : R.pick(p.v);
        targets.filter((t) => t.kind === "practice").forEach((t) => scene.remove(t.m)); targets.length = 0;
        game = { v, k: 0, res: [], done, hud: core.el("div", "gamehud") };
        document.body.append(game.hud);
        paused = false; nextRound();
      }
      function nextRound() {
        const g = game; targets.filter((t) => t.kind === "game").forEach((t) => scene.remove(t.m)); for (let i = targets.length - 1; i >= 0; i--) if (targets[i].kind === "game") targets.splice(i, 1);
        const r = g.v.rounds[g.k];
        if (!r) return endShoot();
        const opts = core.R.shuffle(r[1].map((o, i) => ({ o, ok: i === 0 })));
        // на вузькому (портретному) екрані мішені менші й ближче одна до одної
        const narrow = camera.aspect < 1, n = opts.length, spread = Math.min(3, 8 / n) * (narrow ? 0.58 : 1);
        opts.forEach((it, i) => {
          const m = makeTarget(it.o); const x = camX + (i - (n - 1) / 2) * spread; if (narrow) m.scale.setScalar(0.62);
          m.position.set(x, -1, -6.8 - (i % 2) * 1.2);
          targets.push({ m, kind: "game", ok: it.ok, opt: it.o, base: x, vx: (i % 2 ? 1 : -1) * (g.k > 1 ? 0.5 : 0), rise: 0, ph: Math.random() * 6 });
        });
        g.hud.innerHTML = `<small>${core.esc(g.v.q)} · ${g.k + 1} з ${g.v.rounds.length}</small><div class="big${/#|RGB/.test(r[0]) ? " mono" : ""}">${core.esc(r[0])}</div><small>${coarse ? "Торкнись" : "Наведи й клацни по"} правильній мішені — постріл один!</small>`;
      }
      function hitGame(t, point) {
        const g = game, r = g.v.rounds[g.k];
        g.res.push({ r, ok: t.ok }); paint(point, t.ok ? 0x22c55e : 0xef4444);
        if (t.ok) core.addCoins(1);
        flash(t.ok ? "#22c55e" : "#ef4444");
        targets.filter((x) => x.kind === "game").forEach((x) => { x.falling = true; x.mark = x.ok; });
        g.k++; setTimeout(() => game && nextRound(), 900);
      }
      function endShoot() {
        const g = game; game = null; g.hud.remove(); paused = true;
        targets.filter((t) => t.kind === "game").forEach((t) => scene.remove(t.m));
        const bad = g.res.filter((x) => !x.ok);
        g.done(!bad.length, (bad.length ? "Помилки: " + bad.map((x) => `«${core.esc(x.r[0])}» — ${core.esc(x.r[1][0])}`).join("; ") + ". " : "") + core.esc(g.v.x || ""), `Влучних пострілів: ${g.res.length - bad.length} з ${g.res.length}.`);
      }
      const flashEl = core.el("div", "flash"); document.body.append(flashEl);
      function flash(c) { flashEl.style.background = c; flashEl.classList.remove("on"); void flashEl.offsetWidth; flashEl.classList.add("on"); }
      const cross = core.el("div", "cross"); cross.hidden = true; document.body.append(cross);

      /* ---------------- постріл / вибір */
      function shoot(cx, cy) {
        recoil = 1;
        ndc.set(cx * 2 - 1, -(cy * 2 - 1)); ray.setFromCamera(ndc, camera);
        const objs = targets.filter((t) => !t.falling).map((t) => t.m).concat(game ? [] : S.flatMap((s) => [s.mesh, s.bang]));
        const hit = ray.intersectObjects(objs, true)[0];
        if (!hit) { const p = ray.ray.at(14, new THREE.Vector3()); p.z = Math.max(p.z, -18.7); paint(p, [0xf472b6, 0x38bdf8, 0xfacc15][Math.floor(Math.random() * 3)]); return; }
        let o = hit.object; while (o && !o.userData.station && !targets.some((t) => t.m === o)) o = o.parent;
        if (!o) return;
        if (o.userData.station) { const s = o.userData.station; if (Math.abs(s.bx - camX) < 1 && !glide) core.open(s); else api.goTo(s, true); return; }
        const t = targets.find((x) => x.m === o);
        if (t.kind === "practice") { paint(hit.point, 0xfacc15); t.falling = true; core.addCoins(1); }
        else if (game) hitGame(t, hit.point);
      }
      const cv = renderer.domElement;
      // приціл іде за мишею, камера лише трохи повертається слідом; стріляємо туди, де приціл
      cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { aimX = e.clientX / innerWidth; aimY = e.clientY / innerHeight; cross.style.left = e.clientX + "px"; cross.style.top = e.clientY + "px"; } });
      cv.addEventListener("pointerdown", (e) => {
        if (paused && !game) return;
        aimX = e.clientX / innerWidth; aimY = e.clientY / innerHeight;
        shoot(aimX, aimY);
      });

      /* ---------------- кадр */
      let T0 = performance.now(), practiceT = 2;
      function frame(now) {
        const dt = Math.min(0.05, (now - T0) / 1000); T0 = now; tt += dt;
        if (glide) { glide.t += dt / glide.d; camX = glide.a + (glide.b - glide.a) * (1 - Math.pow(1 - Math.min(1, glide.t), 3)); if (glide.t >= 1) { const g = glide; glide = null; cur = g.i; if (g.open && core.st && !core.paused) core.open(S[g.i]); } }
        // приціл за мишею (на ПК): камера трохи повертається туди, куди вказує миша
        const ty = coarse ? 0 : -(aimX - 0.5) * 0.35, tp = coarse ? 0 : -(aimY - 0.45) * 0.2 - 0.03;
        yaw += (ty - yaw) * Math.min(1, dt * 10); pitch += (tp - pitch) * Math.min(1, dt * 10);
        camera.position.set(camX, EYE + Math.sin(tt * 1.5) * 0.015, 2.2);
        camera.rotation.set(pitch, yaw, 0, "YXZ");
        recoil = Math.max(0, recoil - dt * 6); gun.position.z = -0.62 + recoil * 0.05; gun.rotation.x = recoil * 0.25;
        gun.visible = !paused || !!game;
        cross.hidden = coarse || (paused && !game);
        if (!paused && core.st && !game && !glide) {
          const s = S[cur]; core.near(Math.abs(s.bx - camX) < 1 ? s : null);
          practiceT -= dt; if (practiceT <= 0) { practiceT = 3 + Math.random() * 3; spawnPractice(); }
        }
        for (let i = targets.length - 1; i >= 0; i--) {
          const t = targets[i];
          t.rise = Math.min(1, t.rise + dt * 3);
          if (t.kind === "practice") { t.life -= dt; t.m.position.x += t.vx * dt; if (Math.abs(t.m.position.x - t.base) > 3.2) t.vx *= -1; t.m.position.y = 0.4 + t.rise * 1.7; if (t.life < 0) t.falling = true; }
          else { t.m.position.y = -1 + t.rise * 3.4 + Math.sin(tt * 2 + t.ph) * 0.06; if (t.vx) t.m.position.x = t.base + Math.sin(tt * 1.3 + t.ph) * 0.6; }
          if (t.falling) { t.m.rotation.x -= dt * 6; if (t.m.rotation.x < -1.5) { scene.remove(t.m); targets.splice(i, 1); } }
        }
        for (const s of S) { const stt = !core.st ? "lock" : core.isDone(s) ? "done" : !core.available(s) ? "lock" : s.optional ? "star" : "open"; if (s.bang.userData.st !== stt) { s.bang.material.map = bangTex[stt]; s.bang.material.needsUpdate = true; s.bang.userData.st = stt; } s.bang.position.y = 3 + (stt === "open" || stt === "star" ? Math.sin(tt * 4 + s.i) * 0.1 : 0); }
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      // «Далі» в HUD веде до наступного інструктора
      document.getElementById("qNext").classList.add("clickable");
      const api = {
        start() { paused = false; const nx = core.next(); cur = nx ? nx.i : 0; camX = S[cur].bx; },
        pause(p) { paused = p; if (p) core.near(null); },
        goTo(s, open = true) {
          if (!core.available(s)) { core.lockedToast(s); return; }
          if (Math.abs(s.bx - camX) < 0.5) { if (open) core.open(s); return; }
          core.near(null); glide = { a: camX, b: s.bx, t: 0, d: Math.min(1.6, 0.4 + Math.abs(s.bx - camX) / 14), i: s.i, open: true };
        },
        challenge(p, R, done) { if (p.type === "shoot") startShoot(p, R, done); else done(false, "Невідома міні-гра"); },
        celebrate(s) { for (let k = 0; k < 8; k++) paint(new THREE.Vector3(s.bx - 3 + Math.random() * 6, 1 + Math.random() * 5, -18.6), [0x22c55e, 0xfacc15, 0x38bdf8, 0xf472b6][k % 4]); },
        finish() { cross.hidden = true; }
      };
      window.QUEST.range = { game: () => game, targets: () => targets, hit: (ok) => { const t = targets.find((x) => x.kind === "game" && !x.falling && x.ok === ok); if (t) hitGame(t, t.m.position.clone()); } };
      return api;
    }
  };
})();
