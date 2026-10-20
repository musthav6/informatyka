/* Світ «Блоки» — 3D (three.js r128): блокові острови в небі, герой-«блочок» бігає й стрибає
   по містках між островами. Місток до наступного персонажа виростає, коли пройдено попереднього.
   Упав у прірву — повертаєшся на останній острів (мінус 2 монети). ⭐ острови — окремою гілкою.
   Керування: WASD / стрілки, пробіл — стрибок; на телефоні — джойстик і кнопка стрибка.
   theme: { sky, grass, dirt, hero, props: ["емодзі над островами"] }
   Міні-гра світу: { type: "chests", v: [{ q, groups: [назви скринь], items: [["напис", № скрині]], x }] }
   — кубики з написами лежать на острові; підбіжи — підбереш, неси до потрібної скрині. */
(function () {
  "use strict";
  const ISL = 10, STEP = 13, G = 26, JUMP = 9.2, SPD = 6.2;

  window.QWORLDS.blocky = {
    howto: ["🧱 Бігай островами: <b>WASD</b> / стрілки, <b>пробіл</b> — стрибок. На телефоні — джойстик ліворуч і кнопка ⤒ праворуч. Містки між островами — зі стрибками, не впади!"],
    keys: "WASD / стрілки — бігти · пробіл — стрибок · E — говорити · N — зошит",
    startHint: "Біжи містком до першого острова з «!». Між блоками — стрибай (пробіл / ⤒)!",
    init(core, stage) {
      const THREE = window.THREE, TH = core.Q.theme || {};
      const S = core.stations;
      const renderer = new THREE.WebGLRenderer({ antialias: !matchMedia("(pointer:coarse)").matches });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      stage.append(renderer.domElement);
      const scene = new THREE.Scene(), sky = new THREE.Color(TH.sky || "#a5d8ff");
      scene.background = sky; scene.fog = new THREE.Fog(sky, 35, 110);
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x5577aa, 0.95));
      const sun = new THREE.DirectionalLight(0xffffff, 0.75); sun.position.set(10, 20, 8); scene.add(sun);
      const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < innerHeight ? 72 : 60; camera.updateProjectionMatrix(); };
      addEventListener("resize", resize); resize();
      const BOX = new THREE.BoxGeometry(1, 1, 1), M = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
      const MAT = { grass: M(TH.grass || "#4ade80"), dirt: M(TH.dirt || "#a16207"), plank: M("#d97706"), stone: M("#94a3b8"), star: M("#fde047") };

      function textTex(text, opt = {}) {
        const w = opt.w || 512, h = opt.h || 128, c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.fillStyle = opt.bg || "#1e1b4b"; g.fillRect(0, 0, w, h);
        if (opt.border) { g.strokeStyle = opt.border; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); }
        g.fillStyle = opt.fg || "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
        let size = opt.size || 60; g.font = `800 ${size}px Rubik, system-ui, sans-serif`;
        while (g.measureText(text).width > w - 30 && size > 16) { size -= 3; g.font = `800 ${size}px Rubik, system-ui, sans-serif`; }
        g.fillText(text, w / 2, h / 2 + 3);
        return new THREE.CanvasTexture(c);
      }
      function sprite(text, opt = {}) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(text, opt), depthTest: opt.depth !== false })); s.scale.set(opt.sx || 2.6, opt.sy || 0.65, 1); return s; }

      /* ---------------- світ: острови й містки */
      const solids = []; // { min: [x, y, z], max: [x, y, z], on: () => bool }
      function block(x, y, z, sx, sy, sz, mat, on) {
        const m = new THREE.Mesh(BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y - sy / 2, z); scene.add(m);
        const b = { min: [x - sx / 2, y - sy, z - sz / 2], max: [x + sx / 2, y, z + sz / 2], on: on || (() => true), m };
        solids.push(b); return b;
      }
      function island(cx, cy, cz, star) {
        block(cx, cy, cz, ISL, 0.6, ISL, star ? MAT.star : MAT.grass);
        const d = new THREE.Mesh(BOX, MAT.dirt); d.scale.set(ISL - 1, 2.2, ISL - 1); d.position.set(cx, cy - 1.7, cz); scene.add(d);
        const d2 = new THREE.Mesh(BOX, MAT.dirt); d2.scale.set(ISL - 4, 1.6, ISL - 4); d2.position.set(cx, cy - 3.4, cz); scene.add(d2);
      }
      // місток зі сходинок: прогалини між блоками треба перестрибувати
      function bridge(a, b, to, kind) {
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
        const start = ISL / 2 + 0.2, end = len - ISL / 2 - 0.2, n = Math.max(2, Math.round((end - start) / 2.1));
        const blocks = [];
        for (let k = 0; k <= n; k++) {
          const t = start + (end - start) * k / n, y = a.y + (b.y - a.y) * (k / n);
          const plank = kind === "plank" || k % 3 === 0;
          const bl = block(a.x + ux * t, y, a.z + uz * t, plank ? 1.9 : 1.4, 0.4, plank ? 1.9 : 1.4, plank ? MAT.plank : MAT.stone, () => !to || core.available(to));
          bl.rise = 0; blocks.push(bl);
          if (k % 2 === 1) coins.push(coinAt(a.x + ux * t, y + 1, a.z + uz * t, bl));
        }
        bridges.push({ to, blocks });
      }
      const bridges = [], coins = [], props = [];
      function coinAt(x, y, z, on) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14), new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0x6b4f00 })); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); scene.add(m); return { m, on }; }

      // розкладка: старт → основні станції змійкою → фінал; ⭐ — гілкою вбік від останньої основної
      const basics = S.filter((s) => !s.optional && !s.final), stars = S.filter((s) => s.optional), fin = S.find((s) => s.final);
      const start = { x: 0, y: 0, z: 0 };
      island(0, 0, 0);
      const spawnSign = sprite("СТАРТ", { bg: "#16a34a", size: 64, sx: 2.2, sy: 0.6 }); spawnSign.position.set(0, 2.5, -3); scene.add(spawnSign);
      let prev = start;
      basics.forEach((s, i) => { s.pos = { x: (i + 1) * STEP, y: (i % 3) * 0.7, z: i % 2 ? -5 : 5 }; });
      const last = basics[basics.length - 1].pos;
      stars.forEach((s, j) => { s.pos = { x: last.x - j * STEP, y: 1.5 + j * 0.5, z: last.z - 17 * Math.sign(last.z || 1) }; });
      if (fin) fin.pos = { x: last.x + STEP, y: 0.6, z: 0 };
      basics.forEach((s, i) => { island(s.pos.x, s.pos.y, s.pos.z); bridge(prev, s.pos, s, i === 0 ? "plank" : ""); prev = s.pos; });
      let sp = last; stars.forEach((s) => { island(s.pos.x, s.pos.y, s.pos.z, true); bridge(sp, s.pos, s); sp = s.pos; });
      if (fin) { island(fin.pos.x, fin.pos.y, fin.pos.z); bridge(last, fin.pos, fin); }
      S.forEach((s) => { s.place = s.optional ? "⭐ острів" : s.final ? "фінальний острів" : "острів"; });
      // хмари
      for (let k = 0; k < 18; k++) { const c = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })); c.scale.set(4 + Math.random() * 5, 1.2, 2.5 + Math.random() * 3); c.position.set(-20 + Math.random() * (last.x + 50), -8 + Math.random() * 20, -40 + Math.random() * 80); scene.add(c); props.push({ m: c, cloud: true, v: 0.3 + Math.random() * 0.5 }); }

      /* ---------------- персонажі */
      function person(look, hat) {
        const g = new THREE.Group();
        const part = (c, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(BOX, M(c)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); g.add(m); return m; };
        part(look, 0.9, 0.9, 0.5, 0, 1.25, 0); part("#fcd9b8", 0.7, 0.7, 0.7, 0, 2.05, 0); part(hat === "helmet" ? "#334155" : "#3f2a1d", 0.76, 0.2, 0.76, 0, 2.45, 0);
        part("#1f2937", 0.1, 0.1, 0.02, -0.15, 2.1, 0.36); part("#1f2937", 0.1, 0.1, 0.02, 0.15, 2.1, 0.36);
        const lL = part("#334155", 0.36, 0.8, 0.4, -0.22, 0.4, 0), lR = part("#334155", 0.36, 0.8, 0.4, 0.22, 0.4, 0);
        const aL = part(look, 0.28, 0.8, 0.3, -0.6, 1.3, 0), aR = part(look, 0.28, 0.8, 0.3, 0.6, 1.3, 0);
        g.userData = { lL, lR, aL, aR };
        return g;
      }
      S.forEach((s) => {
        const g = person(s.npc.look, s.npc.hat); g.position.set(s.pos.x, s.pos.y, s.pos.z - 1.5); scene.add(g); s.mesh = g;
        const bang = sprite("!", { bg: "#facc15", fg: "#422006", w: 128, h: 128, size: 100, sx: 0.8, sy: 0.8 }); bang.position.set(s.pos.x, s.pos.y + 3.3, s.pos.z - 1.5); scene.add(bang); s.bang = bang;
        const nm = sprite(s.npc.name, { bg: "#ffffff", fg: "#1f2937", size: 54, sx: 2.6, sy: 0.65 }); nm.position.set(s.pos.x, s.pos.y + 2.75, s.pos.z - 1.5); scene.add(nm); s.nm = nm;
        const tp = sprite(s.topic || "", { bg: s.optional ? "#ca8a04" : "#4f46e5", size: 52, sx: 4.2, sy: 0.75 }); tp.position.set(s.pos.x, s.pos.y + 6, s.pos.z); scene.add(tp);
        const pr = (TH.props || [])[s.i % (TH.props || [1]).length];
        if (pr) { const e = sprite(pr, { bg: "rgba(0,0,0,0)", w: 256, h: 256, size: 200, sx: 2.2, sy: 2.2 }); e.position.set(s.pos.x + 3.2, s.pos.y + 2.2, s.pos.z - 3.2); scene.add(e); props.push({ m: e, bob: Math.random() * 6, y: e.position.y }); }
        block(s.pos.x, s.pos.y + 1.6, s.pos.z - 1.5, 0.9, 1.6, 0.6, new THREE.MeshBasicMaterial({ visible: false }));
      });
      const bangTex = { open: textTex("!", { bg: "#facc15", fg: "#422006", w: 128, h: 128, size: 100 }), star: textTex("★", { bg: "#eab308", fg: "#422006", w: 128, h: 128, size: 100 }), done: textTex("✓", { bg: "#16a34a", fg: "#fff", w: 128, h: 128, size: 100 }), lock: textTex("…", { bg: "#cbd5e1", fg: "#475569", w: 128, h: 128, size: 100 }) };

      /* ---------------- герой */
      const hero = person(TH.hero || "#2563eb", "helmet"); scene.add(hero);
      const P = { x: 0, y: 0.01, z: 2, vy: 0, ground: true, face: 0, check: { x: 0, y: 0.5, z: 2 } };
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.25 })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0x4f46e5 })); scene.add(arrow);

      const HW = 0.3, HH = 1.8;
      const overlap = (x, y, z) => solids.some((b) => b.on() && x + HW > b.min[0] && x - HW < b.max[0] && z + HW > b.min[2] && z - HW < b.max[2] && y + HH > b.min[1] && y < b.max[1]);
      function move(dt, ix, iz, jump) {
        if (jump && P.ground) { P.vy = JUMP; P.ground = false; }
        // невелику сходинку (до 0,45) переступаємо без стрибка
        const nx = P.x + ix * SPD * dt; if (!overlap(nx, P.y, P.z)) P.x = nx; else if (P.ground && !overlap(nx, P.y + 0.45, P.z)) { P.x = nx; P.y += 0.45; }
        const nz = P.z + iz * SPD * dt; if (!overlap(P.x, P.y, nz)) P.z = nz; else if (P.ground && !overlap(P.x, P.y + 0.45, nz)) { P.z = nz; P.y += 0.45; }
        P.vy -= G * dt; const ny = P.y + P.vy * dt;
        if (overlap(P.x, ny, P.z)) {
          if (P.vy < 0) { // приземлення: стаємо на верх блока
            let top = -1e9; for (const b of solids) if (b.on() && P.x + HW > b.min[0] && P.x - HW < b.max[0] && P.z + HW > b.min[2] && P.z - HW < b.max[2] && b.max[1] <= P.y + 0.05) top = Math.max(top, b.max[1]);
            P.y = top > -1e9 ? top : P.y; P.ground = true;
          }
          P.vy = 0;
        } else { P.y = ny; P.ground = false; }
        if (P.y < -14) { P.x = P.check.x; P.y = P.check.y; P.z = P.check.z; P.vy = 0; const st = core.st; if (st && st.coins) { st.coins = Math.max(0, st.coins - 2); core.addCoins(0); } core.toast("Ой, прірва! Повертаю на острів (−2 🪙)", 1500); }
      }

      /* ---------------- керування */
      const keys = new Set(); let jumpReq = false, joy = { x: 0, z: 0 }, paused = true;
      const KM = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
      addEventListener("keydown", (e) => { if (e.target.closest && e.target.closest("input,textarea,select")) return; if (KM[e.code]) { keys.add(KM[e.code]); e.preventDefault(); } if (e.code === "Space" && !paused) { jumpReq = true; e.preventDefault(); } });
      addEventListener("keyup", (e) => { if (KM[e.code]) keys.delete(KM[e.code]); });
      addEventListener("blur", () => keys.clear());
      const pad = core.el("div", "joy", `<div class="jbase"><div class="jknob"></div></div>`), jbtn = core.el("button", "jumpbtn", "⤒");
      jbtn.setAttribute("aria-label", "Стрибок"); pad.hidden = jbtn.hidden = true; document.body.append(pad, jbtn);
      jbtn.addEventListener("pointerdown", (e) => { e.preventDefault(); jumpReq = true; });
      const knob = pad.querySelector(".jknob"), base = pad.querySelector(".jbase"); let jid = null;
      const jmove = (e) => { const r = base.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), m = r.width / 2; if (d > m) { dx = dx / d * m; dy = dy / d * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; joy = { x: dx / m, z: dy / m }; };
      base.addEventListener("pointerdown", (e) => { jid = e.pointerId; base.setPointerCapture(jid); jmove(e); });
      base.addEventListener("pointermove", (e) => { if (e.pointerId === jid) jmove(e); });
      const jend = () => { jid = null; joy = { x: 0, z: 0 }; knob.style.transform = ""; };
      base.addEventListener("pointerup", jend); base.addEventListener("pointercancel", jend);

      /* ---------------- міні-гра «скрині» */
      let game = null, tt = 0, ws = null;
      function cubeTex(text, bg) { return new THREE.MeshLambertMaterial({ map: textTex(text, { bg, fg: "#fff", size: 46, w: 256, h: 256, border: "#00000033" }) }); }
      function startChests(p, R, done) {
        if (game) return; // уже йде
        const v = R.pick(p.v), s = curStation || S[0], c = s.pos, n = v.groups.length;
        const cols = ["#2563eb", "#db2777", "#059669", "#ea580c"];
        const chests = v.groups.map((g, i) => {
          const x = c.x - ISL / 2 + 1.4 + i * (ISL - 2.8) / Math.max(1, n - 1), z = c.z - ISL / 2 + 1;
          const m = new THREE.Mesh(BOX, M(cols[i])); m.scale.set(2, 1.2, 1.4); m.position.set(x, c.y + 0.6, z); scene.add(m);
          const lab = sprite(g, { bg: cols[i], size: 64, sx: 3, sy: 0.75 }); lab.position.set(x, c.y + 2.4, z); scene.add(lab);
          return { g, i, x, z, m, lab };
        });
        const items = R.shuffle(v.items).map(([t, gi], k) => {
          const a = k / v.items.length * Math.PI * 2, r = 2.6 + (k % 2) * 1.1;
          const m = new THREE.Mesh(BOX, cubeTex(t, "#f59e0b")); m.scale.set(0.9, 0.9, 0.9);
          const x = c.x + Math.cos(a) * r, z = c.z + 1 + Math.sin(a) * r * 0.75;
          m.position.set(x, c.y + 0.6, z); scene.add(m);
          const lab = sprite(t, { bg: "#78350f", size: 60, sx: 1.9, sy: 0.45 }); lab.position.set(x, c.y + 1.35, z); scene.add(lab);
          return { t, gi, m, lab, placed: null, x, z };
        });
        s.mesh.visible = s.bang.visible = s.nm.visible = false;
        game = { v, s, chests, items, carry: null, done, hud: core.el("div", "gamehud") };
        document.body.append(game.hud); hud();
        P.x = c.x - 4; P.z = c.z + 4; P.y = c.y; P.vy = 0; paused = false; pad.hidden = jbtn.hidden = !coarse;
      }
      function hud() { const g = game, left = g.items.filter((i) => i.placed == null).length; g.hud.innerHTML = `<div class="big">${core.esc(g.v.q)}</div><small>Підбіжи до кубика — він підніметься. Неси до потрібної скрині. Залишилось: ${left}${g.carry ? ` · несеш «${core.esc(g.carry.t)}»` : ""}</small>`; }
      function updateGame() {
        const g = game;
        if (!g.carry) { const it = g.items.find((i) => i.placed == null && Math.hypot(i.m.position.x - P.x, i.m.position.z - P.z) < 1.1); if (it) { g.carry = it; hud(); } }
        else {
          g.carry.m.position.set(P.x, P.y + 2.6, P.z); g.carry.lab.position.set(P.x, P.y + 3.4, P.z);
          const ch = g.chests.find((c) => Math.hypot(c.x - P.x, c.z - P.z) < 1.6);
          if (ch) {
            const it = g.carry; it.placed = ch.i; g.carry = null;
            const k = g.items.filter((o) => o.placed === ch.i).length - 1;
            it.m.position.set(ch.x - 0.6 + (k % 3) * 0.6, game.s.pos.y + 1.45 + Math.floor(k / 3) * 0.6, ch.z); it.m.scale.setScalar(0.55); it.lab.visible = false;
            core.addCoins(0); hud();
            if (g.items.every((o) => o.placed != null)) {
              const bad = g.items.filter((o) => o.placed !== o.gi);
              setTimeout(() => {
                g.items.forEach((o) => { scene.remove(o.m); scene.remove(o.lab); }); g.chests.forEach((c) => { scene.remove(c.m); scene.remove(c.lab); });
                g.hud.remove(); g.s.mesh.visible = g.s.bang.visible = g.s.nm.visible = true; game = null; paused = true; pad.hidden = jbtn.hidden = true;
                g.done(!bad.length, (bad.length ? "Помилки: " + bad.map((o) => `«${core.esc(o.t)}» — ${core.esc(g.v.groups[o.gi])}`).join("; ") + ". " : "") + core.esc(g.v.x || ""), `У правильних скринях: ${g.items.length - bad.length} з ${g.items.length}.`);
              }, 600);
            }
          }
        }
      }

      /* ---------------- кадр */
      const coarse = matchMedia("(pointer:coarse)").matches;
      let curStation = null, T0 = performance.now();
      const camPos = new THREE.Vector3(0, 9, 13);
      function frame(now) {
        const dt = Math.min(0.05, (now - T0) / 1000); T0 = now; tt += dt;
        let ix = 0, iz = 0;
        if (!paused) {
          if (keys.has("u")) iz--; if (keys.has("d")) iz++; if (keys.has("l")) ix--; if (keys.has("r")) ix++;
          ix += joy.x; iz += joy.z; const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
          move(dt, ix, iz, jumpReq);
        }
        jumpReq = false;
        // острів під ногами — точка повернення
        if (P.ground) for (const s of S.concat([{ pos: start }])) if (Math.abs(P.x - s.pos.x) < ISL / 2 && Math.abs(P.z - s.pos.z) < ISL / 2 && Math.abs(P.y - s.pos.y) < 0.2) { P.check = { x: s.pos.x, y: s.pos.y + 0.5, z: s.pos.z + 2 }; }
        if (game) updateGame();
        else if (!paused && core.st) {
          let near = null; for (const s of S) if (Math.hypot(s.pos.x - P.x, s.pos.z - 1.5 - P.z) < 2.6 && Math.abs(s.pos.y - P.y) < 1) near = s;
          core.near(near); if (near) curStation = near;
        }
        // анімація героя
        const moving = Math.hypot(ix, iz) > 0.1 && !paused;
        if (moving) P.face = Math.atan2(ix, iz);
        hero.position.set(P.x, P.y, P.z); hero.rotation.y += ((P.face - hero.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 10);
        const sw = moving && P.ground ? Math.sin(tt * 14) * 0.7 : 0, u = hero.userData;
        u.lL.rotation.x = sw; u.lR.rotation.x = -sw; u.aL.rotation.x = -sw; u.aR.rotation.x = sw;
        shadow.position.set(P.x, P.y + 0.03, P.z);
        // містки: виростають, коли станція стає доступною
        for (const br of bridges) { const on = !br.to || core.available(br.to); br.blocks.forEach((b, k) => { b.rise += ((on ? 1 : 0) - b.rise) * Math.min(1, dt * (2 + k * 0.1)); b.m.visible = b.rise > 0.02; b.m.position.y = (b.max[1] - 0.2) - (1 - b.rise) * 6; }); }
        for (const c of coins) { if (!c.m.parent) continue; c.m.visible = c.on.m.visible && c.on.rise > 0.9; c.m.rotation.z += dt * 3; if (c.m.visible && Math.hypot(c.m.position.x - P.x, c.m.position.z - P.z) < 0.8 && Math.abs(c.m.position.y - (P.y + 1)) < 1.2) { scene.remove(c.m); core.addCoins(1); } }
        for (const s of S) { const stt = !core.st ? "lock" : core.isDone(s) ? "done" : !core.available(s) ? "lock" : s.optional ? "star" : "open"; if (s.bang.userData.st !== stt) { s.bang.material.map = bangTex[stt]; s.bang.material.needsUpdate = true; s.bang.userData.st = stt; } s.bang.position.y = s.pos.y + 3.3 + (stt === "open" || stt === "star" ? Math.sin(tt * 4 + s.i) * 0.15 : 0); s.mesh.rotation.y = Math.atan2(P.x - s.pos.x, P.z - (s.pos.z - 1.5)) * 0.6; }
        for (const pr of props) { if (pr.cloud) { pr.m.position.x += pr.v * dt; if (pr.m.position.x > last.x + 40) pr.m.position.x = -30; } else pr.m.position.y = pr.y + Math.sin(tt * 2 + pr.bob) * 0.25; }
        // стрілка до наступної станції
        const nx = !game && core.st && core.next();
        arrow.visible = !!nx && !paused && Math.hypot(nx.pos.x - P.x, nx.pos.z - P.z) > 5;
        if (arrow.visible) { const a = Math.atan2(nx.pos.x - P.x, nx.pos.z - P.z); arrow.position.set(P.x + Math.sin(a) * 1.4, P.y + 0.3, P.z + Math.cos(a) * 1.4); arrow.rotation.set(Math.PI / 2, a, 0, "YXZ"); arrow.material.color.set(nx.optional ? 0xeab308 : 0x4f46e5); }
        // камера ззаду-згори
        camPos.lerp(new THREE.Vector3(P.x, P.y + 8.5, P.z + 12), Math.min(1, dt * 4));
        camera.position.copy(camPos); camera.lookAt(P.x, P.y + 1, P.z - 2.5);
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      const api = {
        start(w) { ws = w; if (w.check) { P.check = w.check; P.x = w.check.x; P.y = w.check.y; P.z = w.check.z; } paused = false; pad.hidden = jbtn.hidden = !coarse; camPos.set(P.x, P.y + 8.5, P.z + 12); setInterval(() => { if (ws) { ws.check = P.check; core.save(); } }, 3000); },
        pause(p) { paused = p; keys.clear(); pad.hidden = jbtn.hidden = p || !coarse; if (p) jend(); },
        goTo(s) { core.toast(core.available(s) ? `Біжи за стрілкою до острова «${s.topic}»` : "Цей острів ще закритий — місток виросте пізніше", 2200); },
        challenge(p, R, done) { if (p.type === "chests") startChests(p, R, done); else done(false, "Невідома міні-гра"); },
        celebrate(s) { core.toast(s.final ? "🏆" : "Місток до наступного острова виростає! 🧱", 2000); },
        finish() { pad.hidden = jbtn.hidden = true; }
      };
      window.QUEST.blocky = { P, S, game: () => game, tp: (s) => { P.x = s.pos.x; P.z = s.pos.z + 1.2; P.y = s.pos.y + 0.5; P.vy = 0; } };
      return api;
    }
  };
})();
