/* Спільне для 3D-світів: написи звичайним HTML-текстом поверх сцени (чіткі на будь-якому екрані —
   браузер малює їх векторно, а не текстурою). Напис прив'язаний до 3D-об'єкта й рухається з ним.
   L.add(text, obj, { dy, cls, size, ref, fitW, fitH, mono, bg }) → label; label.visible = false — сховати;
   fitW / fitH — розмір таблички у світових одиницях: шрифт підбирається, щоб текст уліз у неї.
   size + ref — звичайний напис size px на відстані ref, ближче — більший, далі — менший. */
(function () {
  "use strict";
  function makeLabels(THREE, camera, host) {
    const layer = document.createElement("div"); layer.className = "l3d-layer"; host.append(layer);
    const list = [], v = new THREE.Vector3(), fwd = new THREE.Vector3(), cp = new THREE.Vector3();
    const inScene = (o) => { for (let k = 0; o && k < 12; k++, o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; };
    function add(text, obj, o = {}) {
      const el = document.createElement("div");
      el.className = "l3d " + (o.cls || ""); el.textContent = text;
      if (o.bg) el.style.background = o.bg;
      if (o.fg) el.style.color = o.fg;
      if (o.mono) el.classList.add("mono");
      layer.append(el);
      const lab = { el, obj, o, visible: true, text };
      list.push(lab); return lab;
    }
    function remove(lab) { const i = list.indexOf(lab); if (i >= 0) list.splice(i, 1); lab.el.remove(); }
    function setText(lab, t) { lab.text = t; lab.el.textContent = t; }
    function update() {
      const W = host.clientWidth || innerWidth, H = host.clientHeight || innerHeight;
      camera.getWorldDirection(fwd); camera.getWorldPosition(cp);
      const tanH = Math.tan(camera.fov * Math.PI / 360);
      for (let i = list.length - 1; i >= 0; i--) {
        const l = list[i], o = l.o;
        if (l.obj.isObject3D) {
          let r = l.obj; while (r.parent) r = r.parent;
          if (r.isScene) l.seen = true; else if (l.seen) { remove(l); continue; } // об'єкт прибрано зі сцени — напис теж
        }
        const show = l.visible && (l.obj.isObject3D ? inScene(l.obj) : true);
        if (!show) { if (l.el.style.display !== "none") l.el.style.display = "none"; continue; }
        if (l.obj.isObject3D) l.obj.getWorldPosition(v); else v.copy(l.obj);
        v.y += o.dy || 0;
        const d = v.clone().sub(cp).dot(fwd);
        if (d < 0.3) { l.el.style.display = "none"; continue; }
        v.project(camera);
        if (v.x < -1.3 || v.x > 1.3 || v.y < -1.3 || v.y > 1.3) { l.el.style.display = "none"; continue; }
        const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, ppu = H / (2 * d * tanH);
        if (o.fitW) {
          const mw = o.fitW * ppu * 0.92, mh = (o.fitH || 1) * ppu * 0.84, n = Math.max(3, l.text.length);
          const one = mw / (n * 0.56);
          const fs = one >= mh * 0.42 ? Math.min(one, mh * 0.62) : Math.min(mw * 2 / (n * 0.56), mh / 2.5);
          if (fs < 5) { l.el.style.display = "none"; continue; }
          l.el.style.fontSize = fs.toFixed(1) + "px"; l.el.style.width = mw.toFixed(0) + "px";
        } else if (o.ref) {
          const fs = Math.max(o.min || 9, Math.min(o.max || 30, (o.size || 14) * o.ref / d));
          l.el.style.fontSize = fs.toFixed(1) + "px";
        }
        l.el.style.display = "";
        l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%)`;
        l.el.style.zIndex = String(1000 - Math.round(d * 10));
      }
    }
    return { add, remove, setText, update, layer };
  }
  window.L3D = { makeLabels };
})();
