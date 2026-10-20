/* Світ «Раннер» — 3D (three.js r128), у стилі нескінченних раннерів: герой сам біжить трьома
   смугами, учень перемикає смугу (← → / A D / свайп / кнопки) і стрибає (↑ / пробіл / свайп угору).
   Перешкоди й монети — для азарту; оцінки вони не зачіпають (зіткнення = мінус монети).
   Біля кожного персонажа герой зупиняється — починається розмова з ядра уроку.
   Після основних станцій — розвилка: ⭐ маршрут (на 12) або одразу до фінішу.
   theme: { sky, ground, lane, side: [кольори будинків], hero, sign: "напис на табличках" }
   Міні-гра світу: { type: "lanes", v: [{ q, lanes: ["варіант", …2–3], items: [["твердження", № смуги]], x }] }
   — ворота з варіантами на смугах; забігай у смугу з правильною відповіддю. */
(function () {
  "use strict";
  const LANE = 2.3, SPEED = 15, GAP = 70;

  window.QWORLDS.runner = {
    howto: ["🏃 Герой біжить сам. <b>← →</b> (або A / D, свайп, кнопки внизу) — змінити смугу, <b>↑</b> / пробіл / свайп угору — стрибнути. Збирай 🪙, оминай перешкоди."],
    keys: "← → / A D — смуга · ↑ / пробіл — стрибок · свайп на телефоні · E — говорити · N — зошит",
    startHint: "Біжи! Персонажі чекають уздовж траси — герой сам зупиниться біля них.",
    init(core, stage) {
      const THREE = window.THREE, TH = core.Q.theme || {};
      const S = core.stations;
      S.forEach((s) => { s.place = s.optional ? "⭐ маршрут" : s.final ? "фініш" : "траса"; });
      const renderer = new THREE.WebGLRenderer({ antialias: !matchMedia("(pointer:coarse)").matches, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      stage.append(renderer.domElement);
      const scene = new THREE.Scene();
      const sky = new THREE.Color(TH.sky || "#7dd3fc");
      scene.background = sky; scene.fog = new THREE.Fog(sky, 40, 150);
      const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
      camera.position.set(0, 3.6, 7); camera.lookAt(0, 1.2, -8);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.95));
      const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(5, 10, 6); scene.add(sun);
      const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w < h ? 75 : 62; camera.updateProjectionMatrix(); };
      addEventListener("resize", resize); resize();
      const M = (c) => new THREE.MeshLambertMaterial({ color: c });
      const BOX = new THREE.BoxGeometry(1, 1, 1);

      // текстура з написом
      function textTex(text, opt = {}) {
        const w = opt.w || 512, h = opt.h || 128, c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d");
        g.fillStyle = opt.bg || "#1e1b4b"; g.fillRect(0, 0, w, h);
        if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12); }
        g.fillStyle = opt.fg || "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
        let size = opt.size || 64; g.font = `800 ${size}px Rubik, system-ui, sans-serif`;
        while (g.measureText(text).width > w - 40 && size > 18) { size -= 4; g.font = `800 ${size}px Rubik, system-ui, sans-serif`; }
        g.fillText(text, w / 2, h / 2 + 4);
        const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
      }
      function sprite(text, opt = {}) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(text, opt), transparent: true, depthTest: opt.depth !== false })); s.scale.set(opt.sx || 2.4, opt.sy || 0.6, 1); return s; }

      // земля: смуги з прокруткою
      const gc = document.createElement("canvas"); gc.width = 256; gc.height = 256; const gg = gc.getContext("2d");
      gg.fillStyle = TH.ground || "#475569"; gg.fillRect(0, 0, 256, 256);
      gg.fillStyle = TH.lane || "#64748b"; for (const x of [0, 1, 2]) gg.fillRect(20 + x * 78, 0, 60, 256);
      gg.fillStyle = "rgba(255,255,255,.55)"; for (const x of [0, 1, 2]) for (let y = 0; y < 256; y += 64) gg.fillRect(48 + x * 78, y, 4, 30);
      const gtex = new THREE.CanvasTexture(gc); gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(1, 40);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 400), new THREE.MeshLambertMaterial({ map: gtex }));
      ground.rotation.x = -Math.PI / 2; ground.position.z = -150; scene.add(ground);
      const side = new THREE.Mesh(new THREE.PlaneGeometry(80, 400), M(TH.grass || "#1f2937")); side.rotation.x = -Math.PI / 2; side.position.set(0, -0.02, -150); scene.add(side);

      // будинки обабіч
      const sideCols = TH.side || ["#6366f1", "#ec4899", "#0ea5e9", "#f59e0b", "#10b981"];
      const blds = [];
      for (let i = 0; i < 36; i++) {
        const h = 4 + Math.random() * 14, b = new THREE.Mesh(BOX, M(sideCols[i % sideCols.length]));
        b.scale.set(4 + Math.random() * 3, h, 5 + Math.random() * 4); b.position.set((i % 2 ? 1 : -1) * (8 + Math.random() * 4), h / 2, -i * 7);
        scene.add(b); blds.push(b);
        if (TH.sign && i % 5 === 0) { const sg = sprite(TH.sign[i % TH.sign.length], { bg: "#0f172a", fg: "#fde047", w: 512, h: 128, size: 54, sx: 3.6, sy: 0.9 }); sg.position.set(b.position.x * 0.82, Math.min(h, 7), b.position.z); scene.add(sg); blds.push(sg); sg.userData.sign = true; }
      }

      // герой: блоковий бігун
      const hero = new THREE.Group();
      const hc = TH.hero || "#f97316";
      const body = new THREE.Mesh(BOX, M(hc)); body.scale.set(0.7, 0.8, 0.45); body.position.y = 1.25; hero.add(body);
      const head = new THREE.Mesh(BOX, M("#fcd9b8")); head.scale.set(0.55, 0.55, 0.55); head.position.y = 1.95; hero.add(head);
      const cap = new THREE.Mesh(BOX, M("#1d4ed8")); cap.scale.set(0.6, 0.18, 0.62); cap.position.y = 2.25; hero.add(cap);
      const legL = new THREE.Mesh(BOX, M("#1e293b")), legR = legL.clone(); [legL, legR].forEach((l, i) => { l.scale.set(0.25, 0.8, 0.28); l.position.set(i ? 0.18 : -0.18, 0.45, 0); hero.add(l); });
      const armL = new THREE.Mesh(BOX, M(hc)), armR = armL.clone(); [armL, armR].forEach((a, i) => { a.scale.set(0.2, 0.7, 0.22); a.position.set(i ? 0.47 : -0.47, 1.3, 0); hero.add(a); });
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; scene.add(shadow);
      scene.add(hero);

      function person(look, hat) {
        const g = new THREE.Group();
        const b = new THREE.Mesh(BOX, M(look)); b.scale.set(0.8, 0.9, 0.5); b.position.y = 1.2; g.add(b);
        const h = new THREE.Mesh(BOX, M("#fcd9b8")); h.scale.set(0.6, 0.6, 0.6); h.position.y = 1.95; g.add(h);
        const hr = new THREE.Mesh(BOX, M(hat === "helmet" ? "#334155" : "#3f2a1d")); hr.scale.set(0.66, 0.2, 0.66); hr.position.y = 2.3; g.add(hr);
        [-0.2, 0.2].forEach((x) => { const l = new THREE.Mesh(BOX, M("#334155")); l.scale.set(0.28, 0.8, 0.3); l.position.set(x, 0.4, 0); g.add(l); });
        return g;
      }

      /* ---------------- стан траси */
      let speed = 0, dist = 0, lane = 0, laneX = 0, y = 0, vy = 0, stumble = 0, paused = true, started = false;
      let objs = []; // { m, z, kind: coin|low|tall|station|gate|fork, lane, s?, gate? }
      let target = null, skipStars = false, forkDone = false, game = null, tt = 0;
      const addObj = (o) => { o.m.position.z = o.z; scene.add(o.m); objs.push(o); return o; };
      const drop = (o) => { scene.remove(o.m); o.dead = true; };

      function targetStation() {
        if (skipStars) return S.find((s) => s.final && !core.isDone(s)) || null;
        return core.next();
      }
      function needFork() { return !forkDone && S.some((s) => s.optional && !core.isDone(s)) && S.filter((s) => !s.optional && !s.final).every(core.isDone); }
      // наступний відрізок траси: монети й перешкоди, а в кінці — станція (або розвилка)
      function planSegment() {
        objs.filter((o) => o.kind !== "coin" && o.kind !== "low" && o.kind !== "tall").forEach(drop);
        const len = Object.keys(core.st.done).length ? 110 : 60;
        for (let z = -22; z > -len + 18; z -= 9 + Math.random() * 6) {
          const r = Math.random(), ln = Math.floor(Math.random() * 3) - 1;
          if (r < 0.28) addObj({ kind: "low", lane: ln, z, m: barrier() });
          else if (r < 0.42) addObj({ kind: "tall", lane: ln, z, m: server() });
          else for (let k = 0; k < 4; k++) addObj({ kind: "coin", lane: ln, z: z - k * 1.6, m: coin() });
        }
        if (needFork()) { addObj({ kind: "fork", z: -len, m: forkGate() }); lane = 0; core.toast("Попереду розвилка: ⭐ ліворуч і посередині (на 12), 🏁 праворуч — одразу фініш (на 9)", 4500); return; }
        target = targetStation();
        if (target) addObj({ kind: "station", s: target, z: -len, m: stationModel(target) });
      }
      function barrier() { const g = new THREE.Group(); const a = new THREE.Mesh(BOX, M("#ef4444")); a.scale.set(1.9, 0.35, 0.25); a.position.y = 0.55; g.add(a); const b = new THREE.Mesh(BOX, M("#f8fafc")); b.scale.set(0.5, 0.36, 0.26); b.position.y = 0.55; g.add(b); [-0.8, 0.8].forEach((x) => { const p = new THREE.Mesh(BOX, M("#475569")); p.scale.set(0.12, 0.55, 0.12); p.position.set(x, 0.27, 0); g.add(p); }); return g; }
      function server() { const g = new THREE.Group(); const a = new THREE.Mesh(BOX, M(TH.block || "#334155")); a.scale.set(1.8, 2.6, 1.4); a.position.y = 1.3; g.add(a); for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: k % 2 ? 0x22c55e : 0x38bdf8 })); l.scale.set(1.2, 0.08, 0.02); l.position.set(0, 0.6 + k * 0.5, 0.71); g.add(l); } return g; }
      function coin() { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16), new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0x6b4f00 })); m.rotation.x = Math.PI / 2; m.position.y = 0.9; return m; }
      function stationModel(s) {
        const g = new THREE.Group();
        const pad = new THREE.Mesh(BOX, M(s.optional ? "#fde047" : "#a5b4fc")); pad.scale.set(2.2, 0.25, 2.2); pad.position.set(LANE * 1.75, 0.12, 0); g.add(pad);
        const p = person(s.npc.look, s.npc.hat); p.position.set(LANE * 1.75, 0.25, 0); p.rotation.y = -0.6; g.add(p);
        const bang = sprite(s.optional ? "★" : "!", { bg: s.optional ? "#eab308" : "#facc15", fg: "#422006", w: 128, h: 128, size: 100, sx: 0.8, sy: 0.8 }); bang.position.set(LANE * 1.75, 3.1, 0); g.add(bang); g.userData.bang = bang;
        const nm = sprite(s.npc.name, { bg: "#ffffff", fg: "#1f2937", size: 56, sx: 2.6, sy: 0.65 }); nm.position.set(LANE * 1.75, 2.55, 0); g.add(nm);
        const arch = new THREE.Mesh(BOX, M("#1e1b4b")); arch.scale.set(7.4, 0.35, 0.35); arch.position.y = 4.2; g.add(arch);
        [-3.7, 3.7].forEach((x) => { const c = new THREE.Mesh(BOX, M("#1e1b4b")); c.scale.set(0.35, 4.2, 0.35); c.position.set(x, 2.1, 0); g.add(c); });
        const sg = sprite(s.topic || s.npc.name, { bg: "#4f46e5", fg: "#fff", size: 54, sx: 5.2, sy: 0.8 }); sg.position.set(0, 4.75, 0); g.add(sg);
        return g;
      }
      function forkGate() {
        const g = new THREE.Group();
        const mk = (txt, x, w, bg) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.4), new THREE.MeshBasicMaterial({ map: textTex(txt, { bg, fg: "#fff", size: 60, w: 768, h: 160 }) })); s.position.set(x, 3.4, 0); g.add(s); };
        mk("⭐ Зоряний маршрут (на 12)", -LANE / 2, LANE * 2 - 0.2, "#ca8a04");
        mk("🏁 Фініш (на 9)", LANE, LANE - 0.2, "#16a34a");
        [-3.7, LANE / 2, 3.7].forEach((x) => { const c = new THREE.Mesh(BOX, M("#0f172a")); c.scale.set(0.3, 4.2, 0.3); c.position.set(x, 2.1, 0); g.add(c); });
        return g;
      }

      /* ---------------- міні-гра «смуги» */
      function laneGate(item, labels) {
        const g = new THREE.Group(), n = labels.length;
        labels.forEach((t, i) => {
          const x = n === 2 ? (i ? LANE * 0.5 : -LANE * 0.5) * 2 : (i - 1) * LANE, w = n === 2 ? LANE * 2 - 0.3 : LANE - 0.2;
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.1), new THREE.MeshBasicMaterial({ map: textTex(t, { bg: ["#2563eb", "#db2777", "#059669"][i], fg: "#fff", size: 64, w: 512, h: 128 }), transparent: true, opacity: 0.95 }));
          pl.position.set(x, 3, 0); g.add(pl);
        });
        const top = new THREE.Mesh(BOX, M("#0f172a")); top.scale.set(7.4, 0.25, 0.25); top.position.y = 3.65; g.add(top);
        return g;
      }
      function startLanes(p, R, done) {
        if (game) return; // уже йде
        const v = R.pick(p.v), items = R.shuffle(v.items);
        objs.forEach(drop); objs = [];
        game = { v, items, k: 0, res: [], done, hud: core.el("div", "gamehud") };
        document.body.append(game.hud);
        items.forEach((it, i) => { const o = addObj({ kind: "gate", z: -40 - i * GAP, m: laneGate(it, v.lanes), it, i }); for (let k = 1; k < 4; k++) addObj({ kind: "coin", lane: Math.floor(Math.random() * 3) - 1, z: o.z + 18 + k * 2, m: coin() }); });
        lane = v.lanes.length === 2 ? -1 : 0; paused = false; speed = SPEED * 0.75;
        gameHud();
      }
      function gameHud() {
        const g = game, it = g.items[g.k];
        g.hud.innerHTML = it ? `<small>${core.esc(g.v.q)} · ${g.k + 1} з ${g.items.length}</small><div class="big">«${core.esc(it[0])}»</div><small>Забіжи в смугу з правильною відповіддю: ${g.v.lanes.map((l) => "«" + core.esc(l) + "»").join(" · ")}</small>` : "";
      }
      function passGate(o) {
        const g = game, n = g.v.lanes.length, chosen = n === 2 ? (lane < 0 ? 0 : 1) : lane + 1;
        const ok = chosen === o.it[1]; g.res.push({ it: o.it, ok, chosen });
        flash(ok ? "#22c55e" : "#ef4444"); if (ok) core.addCoins(1);
        g.k++; gameHud();
        if (g.k >= g.items.length) {
          const bad = g.res.filter((r) => !r.ok);
          setTimeout(() => { const gg = game; game = null; gg.hud.remove(); speed = 0; paused = true;
            gg.done(!bad.length, (bad.length ? "Помилки: " + bad.map((r) => `«${core.esc(r.it[0])}» — ${core.esc(gg.v.lanes[r.it[1]])}`).join("; ") + ". " : "") + core.esc(gg.v.x || ""), `Правильних смуг: ${gg.res.length - bad.length} з ${gg.res.length}.`);
          }, 700);
        }
      }
      const flashEl = core.el("div", "flash"); document.body.append(flashEl);
      function flash(c) { flashEl.style.background = c; flashEl.classList.remove("on"); void flashEl.offsetWidth; flashEl.classList.add("on"); }

      /* ---------------- керування */
      const ctl = core.el("div", "runctl", `<button data-a="l" aria-label="Ліва смуга">◀</button><button data-a="j" aria-label="Стрибок">▲</button><button data-a="r" aria-label="Права смуга">▶</button>`);
      ctl.hidden = true; document.body.append(ctl);
      const act = (a) => {
        if (paused) return;
        const two = game && game.v.lanes.length === 2; // два варіанти — лише крайні смуги
        if (a === "l") lane = two ? -1 : Math.max(-1, lane - 1);
        if (a === "r") lane = two ? 1 : Math.min(1, lane + 1);
        if (a === "j" && y <= 0.001) vy = 9;
      };
      ctl.querySelectorAll("button").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); act(b.dataset.a); }));
      addEventListener("keydown", (e) => {
        if (e.target.closest && e.target.closest("input,textarea,select")) return;
        const k = { ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r", ArrowUp: "j", KeyW: "j", Space: "j" }[e.code];
        if (k && !paused) { e.preventDefault(); act(k); }
      });
      let sw = null;
      renderer.domElement.addEventListener("pointerdown", (e) => { sw = { x: e.clientX, y: e.clientY }; });
      renderer.domElement.addEventListener("pointerup", (e) => {
        if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
        if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? "l" : "r"); else if (dy < -30) act("j");
      });

      /* ---------------- кадр */
      let T0 = performance.now();
      function frame(now) {
        const dt = Math.min(0.05, (now - T0) / 1000); T0 = now; tt += dt;
        if (!paused) {
          const want = game ? SPEED * 0.75 : SPEED;
          speed += (want - speed) * Math.min(1, dt * 2);
          if (stumble > 0) { stumble -= dt; speed *= 0.97; }
        } else speed += (0 - speed) * Math.min(1, dt * 8);
        const dz = speed * dt; dist += dz;
        gtex.offset.y += dz / 10;
        for (const b of blds) { b.position.z += dz; if (b.position.z > 12) b.position.z -= 252; }
        laneX += (lane * LANE - laneX) * Math.min(1, dt * 12);
        vy -= 26 * dt; y = Math.max(0, y + vy * dt); if (y === 0) vy = Math.max(vy, 0);
        hero.position.set(laneX, y, 0); shadow.position.x = laneX; shadow.scale.setScalar(1 - y * 0.15);
        const run = speed > 1 && y === 0 ? Math.sin(tt * 16) : 0;
        legL.rotation.x = run * 0.8; legR.rotation.x = -run * 0.8; armL.rotation.x = -run * 0.7; armR.rotation.x = run * 0.7;
        hero.rotation.z = (lane * LANE - laneX) * -0.08;
        for (const o of objs) {
          if (o.dead) continue;
          o.z += dz; o.m.position.z = o.z;
          if (o.kind === "coin") { o.m.rotation.z += dt * 4; o.m.position.x = o.lane * LANE; if (Math.abs(o.z) < 0.6 && Math.abs(o.lane * LANE - laneX) < 0.9 && y < 1.6) { drop(o); core.addCoins(1); } }
          if (o.kind === "low" || o.kind === "tall") { o.m.position.x = o.lane * LANE; if (Math.abs(o.z) < 0.5 && Math.abs(o.lane * LANE - laneX) < 1.1 && !o.hit && (o.kind === "tall" || y < 0.7) && !paused) { o.hit = true; stumble = 0.8; flash("#f97316"); const st = core.st; if (st && st.coins) { st.coins = Math.max(0, st.coins - 2); core.addCoins(0); } core.toast(o.kind === "low" ? "Бар'єр! Стрибай ↑" : "Сервер! Зміни смугу ← →", 1100); } }
          if (o.kind === "station") {
            if (o.m.userData.bang) o.m.userData.bang.position.y = 3.1 + Math.sin(tt * 4) * 0.12;
            if (o.z > -1.2 && !o.reached) { o.reached = true; speed = 0; o.z = -1.2; core.near(o.s); core.open(o.s); }
            if (o.reached) o.z = -1.2;
          }
          if (o.kind === "gate" && o.z > 0 && !o.passed) { o.passed = true; passGate(o); }
          if (o.kind === "fork" && o.z > 0 && !o.passed) { o.passed = true; forkDone = true; skipStars = laneX > LANE / 2; core.toast(skipStars ? "🏁 До фінішу! (максимум — 9 балів)" : "⭐ Зоряний маршрут — за 12 балами!", 2500); planSegment(); }
          if (o.z > 14 && o.kind !== "station") drop(o);
        }
        objs = objs.filter((o) => !o.dead);
        camera.position.x += (laneX * 0.5 - camera.position.x) * Math.min(1, dt * 4);
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      const api = {
        start() { started = true; paused = false; ctl.hidden = false; planSegment(); },
        pause(p) {
          paused = p; ctl.hidden = p || !core.st || core.st.finished;
          if (p) return;
          core.near(null);
          // розмову закрито, а станцію не пройдено — це фінал, звідки учень пішов на ⭐ маршрут
          const so = objs.find((o) => o.kind === "station");
          if (so && so.reached && !core.isDone(so.s)) { skipStars = false; forkDone = true; drop(so); objs = objs.filter((o) => !o.dead); planSegment(); }
        },
        goTo() { core.toast("Тут не зійти з траси — біжи вперед, герой сам зупиниться біля персонажа!", 2500); },
        refresh() {
          // станцію пройдено (або її прибрала міні-гра) — будуємо наступний відрізок
          if (!started || game) return;
          const so = objs.find((o) => o.kind === "station");
          if (so && !core.isDone(so.s)) return;
          if (so) { drop(so); objs = objs.filter((o) => !o.dead); }
          if (!objs.some((o) => o.kind === "fork")) planSegment();
        },
        challenge(p, R, done) { if (p.type === "lanes") { ctl.hidden = false; startLanes(p, R, (ok, x, extra) => { ctl.hidden = true; done(ok, x, extra); }); } else done(false, "Невідома міні-гра"); },
        finish() { ctl.hidden = true; }
      };
      window.QUEST.runner = { objs: () => objs, game: () => game, setLane: (l) => { lane = l; laneX = l * LANE; }, speedUp: (k) => { speed *= k; } };
      return api;
    }
  };
})();
