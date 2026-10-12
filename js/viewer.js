/* ==========================================================================
   Modelo 3D explodido da válvula de 10 mm.
   Carrega os 7 STL reais (pasta /stl) uma única vez e cria um visualizador
   independente em cada aba de protótipo:
     const v = ValveViewer.mount(elemento, { getAngle, view, explode });
   Requer THREE (r128, build global).
   ========================================================================== */
(() => {
  'use strict';
  const THREE = window.THREE;

  const PARTS = [
    { id: 'corpo', file: 'stl/corpo.stl', name: 'Corpo', dim: '88 × 50 × 36 mm', color: 0x5b5b63, explode: 0,
      desc: 'Canal Ø10 no eixo X, rebaixos Ø10,3 (assento dos O-rings), câmara Ø32, bucha do eixo Ø6,36 e fixação 4× M4.' },
    { id: 'obturador', file: 'stl/obturador.stl', name: 'Obturador', dim: 'Ø32 × 3 mm', color: 0xFF007F, explode: -38, spin: true,
      desc: 'Disco da borboleta com furo central Ø6 para o eixo. A 0° fica perpendicular ao fluxo; a 90°, alinhado.' },
    { id: 'eixo', file: 'stl/eixo.stl', name: 'Eixo', dim: 'Ø6 × 43 mm', color: 0xF2F2F2, explode: -85, spin: true,
      desc: 'Vertical (Z). A ponta superior fica dentro da caixa eletrônica e leva o ímã diametral lido pelo AS5600.' },
    { id: 'caixa_eletronica', file: 'stl/caixa_eletronica.stl', name: 'Caixa eletrônica', dim: '68 × 48 × 22 mm', color: 0x3c3c44, explode: 22,
      desc: 'Três passagens Ø7 na parede +Y, em x = −20 / 0 / +20: alimentação 12 V, DS18B20 e reserva.' },
    { id: 'placa_sensores', file: 'stl/placa_sensores.stl', name: 'Placa AS5600', dim: '54 × 34 × 3 mm', color: 0xFF3D9A, explode: 48,
      desc: 'PCB com o AS5600 centrado sobre a ponta do eixo. O DS3231 pode ficar na mesma placa ou em módulo ao lado.' },
    { id: 'junta', file: 'stl/junta.stl', name: 'Junta de vedação', dim: '62 × 42 × 1 mm', color: 0xa0a0a8, explode: 72,
      desc: 'Vedação entre a caixa eletrônica e a tampa.' },
    { id: 'tampa', file: 'stl/tampa.stl', name: 'Tampa', dim: '68 × 48 × 6 mm', color: 0x7a7a84, explode: 100,
      desc: 'Fecha a caixa eletrônica, com 4 furos de fixação.' }
  ];

  const VIEWS = {
    conjunto: { label: 'Conjunto', ids: null, explode: 70 },
    camara:   { label: 'Câmara', ids: ['corpo', 'obturador'], explode: 100 },
    encoder:  { label: 'Eixo e sensor', ids: ['eixo', 'placa_sensores'], explode: 70 },
    caixa:    { label: 'Caixa', ids: ['caixa_eletronica', 'placa_sensores', 'junta', 'tampa'], explode: 80 }
  };

  /* ---------- STL: leitura e cache (um download por arquivo) ---------- */
  function parseBinarySTL(buf) {
    const dv = new DataView(buf);
    const n = dv.getUint32(80, true);
    if (84 + n * 50 !== buf.byteLength) throw new Error('STL inválido (esperado binário)');
    const pos = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      for (let k = 0; k < 9; k++) pos[i * 9 + k] = dv.getFloat32(o + k * 4, true);
    }
    return pos;
  }

  function creaseNormals(pos, angleDeg) {
    const n = pos.length / 9;
    const fn = new Float32Array(n * 3);
    for (let f = 0; f < n; f++) {
      const o = f * 9;
      const ax = pos[o + 3] - pos[o], ay = pos[o + 4] - pos[o + 1], az = pos[o + 5] - pos[o + 2];
      const bx = pos[o + 6] - pos[o], by = pos[o + 7] - pos[o + 1], bz = pos[o + 8] - pos[o + 2];
      const x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx;
      const l = Math.hypot(x, y, z) || 1;
      fn[f * 3] = x / l; fn[f * 3 + 1] = y / l; fn[f * 3 + 2] = z / l;
    }
    const key = (o) => Math.round(pos[o] * 50) + ',' + Math.round(pos[o + 1] * 50) + ',' + Math.round(pos[o + 2] * 50);
    const map = new Map();
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < 3; c++) {
        const k = key(f * 9 + c * 3);
        let arr = map.get(k);
        if (!arr) { arr = []; map.set(k, arr); }
        arr.push(f);
      }
    }
    const cosT = Math.cos(angleDeg * Math.PI / 180);
    const out = new Float32Array(n * 9);
    for (let f = 0; f < n; f++) {
      for (let c = 0; c < 3; c++) {
        const list = map.get(key(f * 9 + c * 3));
        let sx = 0, sy = 0, sz = 0;
        for (const g of list) {
          const d = fn[f * 3] * fn[g * 3] + fn[f * 3 + 1] * fn[g * 3 + 1] + fn[f * 3 + 2] * fn[g * 3 + 2];
          if (d >= cosT) { sx += fn[g * 3]; sy += fn[g * 3 + 1]; sz += fn[g * 3 + 2]; }
        }
        const l = Math.hypot(sx, sy, sz) || 1;
        const o = f * 9 + c * 3;
        out[o] = sx / l; out[o + 1] = sy / l; out[o + 2] = sz / l;
      }
    }
    return out;
  }

  let geoPromise = null;
  function loadGeometries() {
    if (geoPromise) return geoPromise;
    geoPromise = Promise.all(PARTS.map((p) =>
      fetch(p.file)
        .then((r) => { if (!r.ok) throw new Error(p.file + ' (HTTP ' + r.status + ')'); return r.arrayBuffer(); })
        .then((buf) => {
          const pos = parseBinarySTL(buf);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          geo.setAttribute('normal', new THREE.BufferAttribute(creaseNormals(pos, 38), 3));
          geo.computeBoundingBox();
          geo.computeBoundingSphere();
          return [p.id, geo];
        })
    )).then((list) => Object.fromEntries(list));
    geoPromise.catch(() => { geoPromise = null; });
    return geoPromise;
  }

  /* ---------- Visualizador ---------- */
  function mount(root, opts = {}) {
    const getAngle = opts.getAngle || (() => 0);
    const startView = VIEWS[opts.view] ? opts.view : 'conjunto';
    const col = opts.colors || {};
    // cor de cada peça neste visualizador (o obturador e a placa seguem o tema da aba)
    const colorOf = (p) => (p.id === 'obturador' && col.a != null ? col.a : p.id === 'placa_sensores' && col.b != null ? col.b : p.color);
    const startExplode = opts.explode != null ? opts.explode : VIEWS[startView].explode;

    root.innerHTML =
      '<div class="vw">' +
        '<div class="vw-stage">' +
          '<div class="vw-status" role="status">Carregando o modelo…</div>' +
          '<p class="vw-hint">Arraste para girar · Ctrl + roda para aproximar · Clique em uma peça</p>' +
        '</div>' +
        '<div class="vw-side">' +
          '<div class="field"><div class="lab"><span>Explodir</span><output data-r="exOut">0%</output></div>' +
            '<input type="range" min="0" max="100" step="1" value="0" data-r="explode" aria-label="Explodir o modelo"></div>' +
          '<div class="vw-views" role="group" aria-label="Destacar um conjunto"></div>' +
          '<div class="field"><div class="lab"><span>Ângulo do disco</span><output data-r="angOut">0°</output></div>' +
            '<input type="range" min="0" max="90" step="1" value="0" data-r="angle" aria-label="Ângulo do disco" disabled>' +
            '<label class="vw-sync"><input type="checkbox" data-r="sync" checked> Seguir o simulador</label></div>' +
          '<div class="actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-r="auto" aria-pressed="false">Girar sozinho</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-r="reset">Recentralizar</button>' +
          '</div>' +
          '<div class="vw-parts"><h3>Peças</h3><ul data-r="list"></ul><p class="vw-info" data-r="info" aria-live="polite"></p></div>' +
        '</div>' +
      '</div>';

    const $r = (n) => root.querySelector('[data-r="' + n + '"]');
    const stage = root.querySelector('.vw-stage');
    const statusEl = root.querySelector('.vw-status');
    const setStatus = (msg, err) => { statusEl.textContent = msg || ''; statusEl.hidden = !msg; statusEl.dataset.error = err ? '1' : '0'; };

    if (!THREE) { setStatus('Não foi possível carregar a biblioteca 3D. Verifique a conexão e recarregue a página.', true); return null; }
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { setStatus('Seu navegador não conseguiu iniciar o WebGL, necessário para o modelo 3D. Tente outro navegador ou ative a aceleração de hardware.', true); return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    canvas.className = 'vw-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Modelo 3D explodido da válvula de 10 mm. Arraste para girar, use as setas para girar e + e − para aproximar.');
    stage.insertBefore(canvas, stage.firstChild);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 3000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.85); key.position.set(160, 260, 200); scene.add(key);
    const rim = new THREE.DirectionalLight(col.a != null ? col.a : 0xff4da6, 0.35); rim.position.set(-220, 90, -160); scene.add(rim);

    const grid = new THREE.GridHelper(420, 21, 0x3a3a3a, 0x1c1c1c);
    grid.position.y = -122;
    scene.add(grid);

    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2;   // Z do CAD vira Y (para cima)
    scene.add(group);

    const axisLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -118), new THREE.Vector3(0, 0, 158)]),
      new THREE.LineDashedMaterial({ color: col.a != null ? col.a : 0xFF007F, dashSize: 4, gapSize: 4, transparent: true, opacity: 0 })
    );
    axisLine.computeLineDistances();
    group.add(axisLine);

    const hotCol = new THREE.Color(col.a != null ? col.a : 0xFF007F);
    const meshes = {};
    const st = {};
    PARTS.forEach((p) => { st[p.id] = { visible: true, opacity: 1, goal: 1 }; });
    const view = {
      explode: 0, goal: 0, angle: 0, sync: true,
      target: new THREE.Vector3(0, 15, 0), targetGoal: new THREE.Vector3(0, 15, 0),
      radius: 330, radiusGoal: 330, theta: -0.62, phi: 1.12,
      auto: false, current: startView, selected: null, hover: null
    };

    /* ----- interface ----- */
    const exRange = $r('explode'), exOut = $r('exOut');
    const angRange = $r('angle'), angOut = $r('angOut');
    const syncChk = $r('sync'), autoBtn = $r('auto'), resetBtn = $r('reset');
    const list = $r('list'), info = $r('info');
    const viewsBox = root.querySelector('.vw-views');

    Object.keys(VIEWS).forEach((k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-ghost'; b.textContent = VIEWS[k].label; b.dataset.view = k;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => applyView(k, false));
      viewsBox.appendChild(b);
    });

    PARTS.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'vw-part'; li.dataset.id = p.id;
      const hex = '#' + colorOf(p).toString(16).padStart(6, '0');
      li.innerHTML =
        '<button type="button" class="vw-pick" aria-pressed="false"><span class="vw-sw" style="background:' + hex + '"></span>' +
        '<span>' + p.name + '<span class="vw-dim">' + p.dim + '</span></span></button>' +
        '<input type="checkbox" checked aria-label="Mostrar ' + p.name + '">';
      const pick = li.querySelector('.vw-pick');
      pick.addEventListener('click', () => selectPart(view.selected === p.id ? null : p.id));
      pick.addEventListener('mouseenter', () => { view.hover = p.id; });
      pick.addEventListener('mouseleave', () => { view.hover = null; });
      li.querySelector('input').addEventListener('change', (e) => { st[p.id].visible = e.target.checked; fitCamera(false); });
      list.appendChild(li);
    });

    function selectPart(id) {
      view.selected = id;
      list.querySelectorAll('.vw-part').forEach((li) => {
        const on = li.dataset.id === id;
        li.classList.toggle('is-sel', on);
        li.querySelector('.vw-pick').setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const p = PARTS.find((x) => x.id === id);
      info.innerHTML = p ? '<strong>' + p.name + '</strong><br>' + p.desc : 'Escolha uma peça na lista ou no modelo para ver a descrição.';
    }

    function applyView(name, instant) {
      const v = VIEWS[name]; if (!v) return;
      view.current = name;
      viewsBox.querySelectorAll('[data-view]').forEach((b) => {
        const on = b.dataset.view === name;
        b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      PARTS.forEach((p) => { st[p.id].goal = (!v.ids || v.ids.includes(p.id)) ? 1 : 0.1; });
      setExplode(v.explode, instant);
    }

    function setExplode(val, instant) {
      view.goal = val; exRange.value = val; exOut.textContent = Math.round(val) + '%';
      if (instant) view.explode = val;
      fitCamera(!!instant);
    }

    function fitCamera(instant) {
      const v = VIEWS[view.current];
      const t = view.goal / 100;
      const box = new THREE.Box3();
      PARTS.forEach((p) => {
        const m = meshes[p.id]; if (!m) return;
        if (v.ids && !v.ids.includes(p.id)) return;
        if (!st[p.id].visible) return;
        const b = m.geometry.boundingBox.clone();
        b.min.z += p.explode * t; b.max.z += p.explode * t;
        box.union(b);
      });
      if (box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
      view.targetGoal.set(c.x, c.z, -c.y);
      // distância que enquadra a esfera do conjunto na vertical e na horizontal
      const R = box.getBoundingSphere(new THREE.Sphere()).radius;
      const half = THREE.MathUtils.degToRad(camera.fov / 2);
      const fitV = R / Math.sin(half);
      const fitH = R / Math.sin(Math.atan(Math.tan(half) * Math.max(camera.aspect, 0.3)));
      view.radiusGoal = Math.max(120, Math.max(fitV, fitH) * 1.08);
      if (instant) { view.target.copy(view.targetGoal); view.radius = view.radiusGoal; }
    }

    exRange.addEventListener('input', () => { view.goal = +exRange.value; exOut.textContent = exRange.value + '%'; fitCamera(false); });
    angRange.addEventListener('input', () => { view.angle = +angRange.value; });
    const syncUi = () => { view.sync = syncChk.checked; angRange.disabled = view.sync; };
    syncChk.addEventListener('change', syncUi); syncUi();
    autoBtn.addEventListener('click', () => {
      view.auto = !view.auto; autoBtn.setAttribute('aria-pressed', view.auto ? 'true' : 'false');
    });
    resetBtn.addEventListener('click', () => { view.theta = -0.62; view.phi = 1.12; applyView(view.current, false); });

    /* ----- órbita: mouse, toque e teclado ----- */
    const pointers = new Map();
    let lastPinch = 0, moved = 0, wheelOn = false;
    const clampR = (r) => Math.min(900, Math.max(70, r));
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; wheelOn = true;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; lastPinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 1) {
        view.theta -= dx * 0.008;
        view.phi = Math.min(Math.PI - 0.12, Math.max(0.12, view.phi - dy * 0.008));
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastPinch) view.radiusGoal = view.radius = clampR(view.radius * (lastPinch / d));
        lastPinch = d;
      }
    });
    const endPointer = (e) => {
      const click = moved < 6 && pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastPinch = 0;
      if (click && e.type === 'pointerup') pickAt(e);
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', () => { wheelOn = false; });
    canvas.addEventListener('wheel', (e) => {
      if (!wheelOn || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      view.radiusGoal = clampR(view.radiusGoal * (1 + Math.sign(e.deltaY) * 0.1));
    }, { passive: false });
    canvas.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') view.theta += 0.1;
      else if (k === 'ArrowRight') view.theta -= 0.1;
      else if (k === 'ArrowUp') view.phi = Math.max(0.12, view.phi - 0.1);
      else if (k === 'ArrowDown') view.phi = Math.min(Math.PI - 0.12, view.phi + 0.1);
      else if (k === '+' || k === '=') view.radiusGoal = clampR(view.radiusGoal * 0.9);
      else if (k === '-' || k === '_') view.radiusGoal = clampR(view.radiusGoal * 1.1);
      else return;
      e.preventDefault();
    });
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pickAt(e) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const objs = PARTS.filter((p) => meshes[p.id] && st[p.id].visible && st[p.id].opacity > 0.5).map((p) => meshes[p.id]);
      const hit = ray.intersectObjects(objs, false)[0];
      selectPart(hit ? hit.object.userData.id : null);
    }

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      fitCamera(false);
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);

    /* ----- laço: só desenha quando a aba está visível ----- */
    let onScreen = false, raf = 0, ready = false, introDone = false;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lerp = (a, b, k) => a + (b - a) * k;

    function frame() {
      raf = requestAnimationFrame(frame);
      const k = reduce ? 1 : 0.1;
      view.explode = lerp(view.explode, view.goal, k);
      if (Math.abs(view.explode - view.goal) < 0.05) view.explode = view.goal;
      const t = view.explode / 100;

      const ang = view.sync ? getAngle() : view.angle;
      if (view.sync) angRange.value = Math.round(ang);
      angOut.textContent = Math.round(ang) + '°';

      PARTS.forEach((p) => {
        const m = meshes[p.id]; if (!m) return;
        const s = st[p.id];
        m.visible = s.visible;
        m.position.z = p.explode * t;
        m.rotation.z = p.spin ? THREE.MathUtils.degToRad(ang) : 0;
        s.opacity = lerp(s.opacity, s.goal, k);
        const mat = m.material;
        mat.opacity = s.opacity;
        const tr = s.opacity < 0.985;
        if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
        mat.depthWrite = !tr || s.opacity > 0.5;
        const hot = (view.hover === p.id || view.selected === p.id) ? 0.3 : 0;
        mat.emissive.copy(hotCol).multiplyScalar(hot);
      });
      axisLine.material.opacity = Math.min(0.8, t * 1.6);

      if (view.auto && !pointers.size && !reduce) view.theta += 0.006;
      view.target.lerp(view.targetGoal, k);
      view.radius = lerp(view.radius, view.radiusGoal, k);
      const sp = Math.sin(view.phi), cp = Math.cos(view.phi);
      camera.position.set(
        view.target.x + view.radius * sp * Math.sin(view.theta),
        view.target.y + view.radius * cp,
        view.target.z + view.radius * sp * Math.cos(view.theta)
      );
      camera.lookAt(view.target);
      renderer.render(scene, camera);
    }
    const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const sync = () => { (onScreen && ready && !document.hidden) ? start() : stop(); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => {
        onScreen = es[0].isIntersecting; sync();
        // uma única abertura: ao chegar na tela, o modelo se desmonta
        if (onScreen && ready && !introDone) { introDone = true; setExplode(startExplode, false); }
      }, { threshold: 0.35 }).observe(stage);
    } else { onScreen = true; }
    document.addEventListener('visibilitychange', sync);

    /* ----- carga ----- */
    loadGeometries().then((geos) => {
      PARTS.forEach((p) => {
        const mesh = new THREE.Mesh(geos[p.id], new THREE.MeshStandardMaterial({ color: colorOf(p), metalness: 0.25, roughness: 0.5, emissive: 0x000000 }));
        mesh.userData.id = p.id;
        group.add(mesh); meshes[p.id] = mesh;
      });
      setStatus('');
      ready = true;
      applyView(startView, true);
      view.explode = 0; view.goal = 0; exRange.value = 0; exOut.textContent = '0%';
      resize(); sync();
      if (onScreen && !introDone) { introDone = true; setExplode(startExplode, false); }
      if (!('IntersectionObserver' in window)) setExplode(startExplode, false);
    }).catch((err) => {
      console.error(err);
      setStatus('Não foi possível carregar os arquivos STL (' + err.message + '). Publique a pasta stl/ junto com o site e abra por um servidor, não por file://.', true);
    });

    selectPart(null);
    return { resize, destroy() { stop(); renderer.dispose(); } };
  }

  window.ValveViewer = { mount };
})();
