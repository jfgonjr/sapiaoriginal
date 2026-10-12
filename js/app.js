/* ==========================================================================
   Válvula 10 mm — abas, galeria e simuladores.
   Sem dependências além do Three.js (viewer.js). Cada protótipo tem a sua aba,
   com simulador e modelo 3D explodido próprios.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const nf = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue sem persistir */ } }
  };

  /* ------------------------------------------------------------------
     Galeria da tela inicial: uma foto grande e quatro vistas
     ------------------------------------------------------------------ */
  (() => {
    const stage = $('#stage'), img = $('#stageImg');
    const thumbs = $$('.thumb');
    if (!stage || !img) return;
    let timer = 0;
    thumbs.forEach((b) => {
      const im = new Image(); im.src = b.dataset.src;           // pré-carrega
      b.addEventListener('click', () => {
        thumbs.forEach((x) => {
          const on = x === b;
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
          x.parentElement.dataset.on = on ? '1' : '0';
        });
        clearTimeout(timer);
        img.classList.add('is-swap');
        timer = setTimeout(() => {
          img.src = b.dataset.src; img.alt = b.dataset.alt;
          stage.style.backgroundColor = b.dataset.bg;
          img.classList.remove('is-swap');
        }, 180);
      });
    });
  })();

  // Sliders: saída formatada ao lado do rótulo
  $$('input.range').forEach((r) => {
    const out = document.getElementById(r.id + '-o');
    const show = () => {
      const v = +r.value;
      if (!out) return;
      if (r.dataset.fmt === 'hour') {
        const h = Math.floor(v), m = Math.round((v - h) * 60);
        out.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      } else out.textContent = nf(v, +r.dataset.dec || 0) + (r.dataset.unit || '');
    };
    r.addEventListener('input', show); show();
  });
  $$('[data-set]').forEach((b) => b.addEventListener('click', () => {
    const [id, val] = b.dataset.set.split(':');
    const r = document.getElementById(id);
    if (r) { r.value = val; r.dispatchEvent(new Event('input', { bubbles: true })); }
  }));

  /* ------------------------------------------------------------------
     Peças comuns dos simuladores
     ------------------------------------------------------------------ */
  const RATE = 36; // °/s do atuador (motor N20 + redução)

  class Valve {
    constructor(a) { this.a = a; this.t = a; }
    step(dt) {
      const d = RATE * dt;
      if (this.a < this.t) this.a = Math.min(this.t, this.a + d);
      else if (this.a > this.t) this.a = Math.max(this.t, this.a - d);
    }
  }

  // Textos de estado em caixa baixa (sigla técnica continua em maiúsculas)
  const KEEP = new Set(['EEPROM', 'PIR', 'LED', 'NDIR', 'VPD', 'RTC']);
  const soft = (t) => String(t)
    .replace(/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ-]{2,}/g, (w) => (KEEP.has(w) ? w : w.toLowerCase()))
    .replace(/^./, (c) => c.toUpperCase());

  const statEls = {};
  function stat(key, text, tone) {
    text = soft(text);
    const e = statEls[key] || (statEls[key] = $('[data-s="' + key + '"]'));
    if (!e) return;
    const v = e.querySelector('.v');
    if (v.textContent !== text) v.textContent = text;
    if ((e.dataset.tone || '') !== (tone || '')) { if (tone) e.dataset.tone = tone; else delete e.dataset.tone; }
  }

  function say(id, text) { const e = document.getElementById(id); if (e) e.textContent = soft(text); }

  /* Esquema da válvula (SVG): disco a 0° bloqueia o canal, a 90° fica alinhado ao fluxo */
  function buildScope(host) {
    const k = 'sc-' + host.dataset.scope, leak = host.dataset.leak === '1';
    host.innerHTML =
      '<div class="scope">' +
        '<div class="scope-top"><div><div class="k">Ângulo</div><div class="scope-ang"><span id="' + k + '-ang">000</span>°</div></div>' +
        '<div><div class="k scope-pos">Posição</div><div id="' + k + '-pos" class="scope-pos">—</div></div></div>' +
        '<svg viewBox="0 28 400 144" role="img" aria-label="Esquema da válvula com o ângulo do disco em tempo real">' +
          '<defs><pattern id="h-' + k + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)"/></pattern></defs>' +
          '<rect x="6" y="82" width="388" height="36" fill="url(#h-' + k + ')" opacity=".6"/>' +
          '<rect x="6" y="82" width="388" height="36" fill="var(--bg)" opacity=".7" stroke="var(--line-2)"/>' +
          '<circle cx="200" cy="100" r="58" fill="var(--bg)" stroke="var(--line-2)" stroke-width="2"/>' +
          '<circle cx="200" cy="100" r="50" fill="none" stroke="var(--line)" stroke-dasharray="3 5"/>' +
          '<line id="' + k + '-fl" x1="14" y1="100" x2="136" y2="100" stroke="var(--cor-secundaria)" stroke-width="2" class="flow-line" opacity=".8"/>' +
          '<line id="' + k + '-fr" x1="264" y1="100" x2="386" y2="100" stroke="var(--cor-secundaria)" stroke-width="2" class="flow-line" opacity="0"/>' +
          '<g id="' + k + '-disc"><rect x="196" y="42" width="8" height="116" rx="1" fill="var(--cor-primaria)"/></g>' +
          '<circle cx="200" cy="100" r="9" fill="var(--bg)" stroke="var(--cor-primaria)" stroke-width="2"/>' +
          (leak ? '<g id="' + k + '-leak" opacity="0" class="blink" fill="var(--cor-primaria)"><circle cx="96" cy="132" r="3.5"/><circle cx="104" cy="148" r="3"/><circle cx="94" cy="162" r="2.5"/><path d="M96 118v6" stroke="var(--cor-primaria)" stroke-width="2"/></g>' : '') +
          '<g font-family="Inter, system-ui, sans-serif" font-weight="500" font-size="9.5" fill="var(--mute)"><text x="16" y="72">Ø10 mm</text><text x="326" y="72">Ø10 mm</text><text x="16" y="146">Entrada</text><text x="340" y="146">Saída</text></g>' +
        '</svg>' +
        '<div class="scope-bar" aria-hidden="true"><i id="' + k + '-bar"></i></div>' +
      '</div>';
    const g = (s) => document.getElementById(k + s);
    const els = { disc: g('-disc'), ang: g('-ang'), pos: g('-pos'), bar: g('-bar'), fr: g('-fr'), fl: g('-fl'), leak: g('-leak') };
    return (a, o = {}) => {
      els.disc.setAttribute('transform', 'rotate(' + a.toFixed(1) + ' 200 100)');
      els.ang.textContent = String(Math.round(a)).padStart(3, '0');
      els.pos.textContent = a < 1 ? 'Fechada' : a > 89 ? 'Aberta' : 'Em movimento';
      els.bar.style.width = (a / 90 * 100) + '%';
      const f = Math.sin(a * Math.PI / 180);
      els.fr.setAttribute('opacity', (f * 0.9).toFixed(2));
      els.fl.setAttribute('opacity', o.noFlow ? '0.15' : '0.8');
      if (els.leak) els.leak.setAttribute('opacity', o.leak ? '1' : '0');
    };
  }

  /* Botão de "segurar para confirmar" (mouse, toque e teclado) */
  function holdButton({ btn, bar, ms, ok, done, fail }) {
    let t0 = 0, raf = 0, active = false;
    const reset = () => { active = false; cancelAnimationFrame(raf); bar.style.width = '0'; };
    const loop = () => {
      if (!active) return;
      if (ok && !ok()) { reset(); fail && fail(); return; }
      const p = (performance.now() - t0) / ms;
      bar.style.width = clamp(p * 100, 0, 100) + '%';
      if (p >= 1) { reset(); done(); return; }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (active) return;
      if (ok && !ok()) { fail && fail(); return; }
      active = true; t0 = performance.now(); raf = requestAnimationFrame(loop);
    };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, reset));
    btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') reset(); });
    btn.addEventListener('blur', reset);
  }

  const sims = {};

  /* ------------------------------------------------------------------
     ÁGUA — vazamento por diferença de vazão
     ------------------------------------------------------------------ */
  sims.agua = (() => {
    const draw = buildScope($('[data-scope="agua"]'));
    const q1 = $('#agua-q1'), q2 = $('#agua-q2'), lim = $('#agua-lim'), mode = $('#agua-mode'), speed = $('#agua-speed');
    const LK = 'valvula10.agua.locked';
    const v = new Valve(90);
    const s = { state: 'ok', leakT: 0, preT: 0, locked: store.get(LK) === '1' };
    if (s.locked) { s.state = 'closed'; v.a = v.t = 0; }

    const diff = () => +q1.value - +q2.value;
    const leaking = () => diff() > +lim.value + 1e-9;
    const close = () => { s.state = 'closed'; s.locked = true; v.t = 0; store.set(LK, '1'); };

    $('#agua-leak').addEventListener('click', () => { q2.value = Math.max(0, +q1.value - 4); q2.dispatchEvent(new Event('input')); say('agua-msg', 'Saída reduzida em 4 L/min.'); });
    $('#agua-fix').addEventListener('click', () => { q2.value = q1.value; q2.dispatchEvent(new Event('input')); say('agua-msg', 'Vazamento consertado: saída igual à entrada.'); });
    holdButton({
      btn: $('#agua-rearm'), bar: $('#agua-hold'), ms: 3000,
      ok: () => s.state === 'closed' && !leaking(),
      fail: () => say('agua-msg', s.state !== 'closed' ? 'A válvula não está travada.' : 'Rearme negado: o vazamento ainda está ativo.'),
      done: () => { s.state = 'ok'; s.locked = false; s.leakT = 0; v.t = 90; store.set(LK, '0'); say('agua-msg', 'Válvula rearmada e liberada.'); }
    });

    function tick(dt) {
      const d = dt * +speed.value;
      if (s.state === 'ok') {
        if (leaking()) {
          s.leakT += d;
          if (s.leakT >= 2) {
            if (mode.value === 'now') close();
            else { s.state = 'pre'; s.preT = 60; }
          }
        } else s.leakT = 0;
      } else if (s.state === 'pre') {
        if (!leaking()) { s.state = 'ok'; s.leakT = 0; }
        else { s.preT -= d; if (s.preT <= 0) close(); }
      }
      v.step(d);
    }

    function render() {
      const lk = leaking(), closed = s.state === 'closed';
      const valve = closed ? (v.a > 0.5 ? 'FECHANDO' : 'FECHADA') : (v.a < 89.5 ? 'ABRINDO' : 'ABERTA');
      stat('agua.valve', valve, closed ? 'bad' : s.state === 'pre' ? 'warn' : 'ok');
      stat('agua.pre', s.state === 'pre' ? Math.ceil(s.preT) + ' s' : s.state === 'ok' && s.leakT > 0 ? 'CONFIRMANDO ' + nf(s.leakT, 1) + '/2 s' : closed ? 'ESGOTADO' : '—', s.state === 'pre' ? 'warn' : s.leakT > 0 ? 'warn' : '');
      stat('agua.diff', nf(diff(), 1) + ' L/min', lk ? 'bad' : 'ok');
      stat('agua.eeprom', s.locked ? 'TRAVADO' : 'LIVRE', s.locked ? 'bad' : 'ok');
      stat('agua.s1', closed ? '0,0 L/min' : nf(+q1.value, 1) + ' L/min', 'info');
      stat('agua.s2', closed ? '0,0 L/min' : nf(+q2.value, 1) + ' L/min', 'info');
      stat('agua.led', s.state === 'ok' ? 'VERDE · buzzer off' : s.state === 'pre' ? 'VERMELHO piscando · buzzer on' : 'VERMELHO fixo · buzzer off', s.state === 'ok' ? 'ok' : 'bad');
      draw(v.a, { leak: lk && !closed, noFlow: closed });
    }
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     CO₂ — damper proporcional com fail-safe
     ------------------------------------------------------------------ */
  sims.co2 = (() => {
    const draw = buildScope($('[data-scope="co2"]'));
    const ppm = $('#co2-ppm'), tmp = $('#co2-t'), rh = $('#co2-rh'), vol = $('#co2-vol'), qmax = $('#co2-qmax'), prof = $('#co2-prof'), failBtn = $('#co2-fail');
    const v = new Valve(0);
    const s = { target: 0, fan: false, failed: false, failT: 0 };

    failBtn.addEventListener('click', () => {
      s.failed = !s.failed; s.failT = 0;
      failBtn.setAttribute('aria-pressed', s.failed ? 'true' : 'false');
      failBtn.textContent = s.failed ? 'Restaurar sensor' : 'Falha do sensor';
      failBtn.classList.toggle('btn-danger', !s.failed);
      failBtn.classList.toggle('btn-ghost', s.failed);
    });

    const angleFor = (p) => Math.min(90, Math.floor(clamp((p - 600) / 600 * 90, 0, 90) / 15) * 15);

    // Curva ângulo × CO₂ (estática) e marcador
    const chart = $('#co2-chart');
    const X = (p) => 22 + (p - 400) / 1600 * 270, Y = (a) => 92 - a / 90 * 80;
    let d = '';
    for (let p = 400; p <= 2000; p += 10) d += (d ? 'L' : 'M') + X(p).toFixed(1) + ' ' + Y(angleFor(p)).toFixed(1);
    chart.innerHTML =
      '<g stroke="var(--line)" stroke-width="1"><line x1="22" y1="92" x2="292" y2="92"/><line x1="22" y1="12" x2="22" y2="92"/>' +
      [0, 30, 60, 90].map((a) => '<line x1="22" y1="' + Y(a) + '" x2="292" y2="' + Y(a) + '" stroke-dasharray="2 4" opacity=".6"/>').join('') + '</g>' +
      '<g stroke="var(--cor-primaria)" stroke-opacity=".35" stroke-dasharray="3 3"><line x1="' + X(600) + '" y1="12" x2="' + X(600) + '" y2="92"/><line x1="' + X(1200) + '" y1="12" x2="' + X(1200) + '" y2="92"/></g>' +
      '<path d="' + d + '" fill="none" stroke="var(--cor-secundaria)" stroke-width="2"/>' +
      '<g font-family="Inter, system-ui, sans-serif" font-size="8" font-weight="600" fill="var(--mute)"><text x="2" y="95">0°</text><text x="2" y="66">30°</text><text x="2" y="39">60°</text><text x="2" y="15">90°</text>' +
      '<text x="' + X(600) + '" y="106" text-anchor="middle">600</text><text x="' + X(1200) + '" y="106" text-anchor="middle">1200</text><text x="22" y="106">400</text><text x="292" y="106" text-anchor="end">2000 ppm</text></g>' +
      '<circle id="co2-dot" r="4.5" fill="var(--cor-primaria)" stroke="var(--bg)" stroke-width="2"/>';
    const dot = $('#co2-dot');

    function tick(dt) {
      const p = +ppm.value;
      if (!s.failed) {
        s.failT = 0;
        const raw = clamp((p - 600) / 600 * 90, 0, 90);
        const up = Math.min(90, Math.floor(raw / 15) * 15);          // sobe ao cruzar o degrau
        const dn = Math.min(90, Math.floor((raw + 7.5) / 15) * 15);   // desce só 50 ppm (7,5°) abaixo
        if (up > s.target) s.target = up; else if (dn < s.target) s.target = dn;
        if (p > 1200) s.fan = true; else if (p < 1150) s.fan = false;
      } else {
        s.failT += dt;
        if (s.failT >= 10) { s.target = 45; s.fan = false; }
      }
      v.t = s.target;
      v.step(dt);
    }

    function render() {
      const p = +ppm.value, T = +tmp.value, H = +rh.value;
      const free = 1 - Math.cos(v.a * Math.PI / 180);
      const q = +qmax.value * free * (s.fan ? 1 : 0.10);
      const ach = q / +vol.value;
      const svp = 0.6108 * Math.exp(17.27 * T / (T + 237.3));
      const vpd = svp * (1 - H / 100);
      const [lo, hi, name] = prof.value.split(',');
      const st = vpd < +lo ? 'ABAIXO' : vpd > +hi ? 'ACIMA' : 'DENTRO';

      stat('co2.ppm', nf(p) + ' ppm', p > 1200 ? 'bad' : p > 600 ? 'warn' : 'ok');
      stat('co2.ang', s.target + '°' + (s.failed && s.failT >= 10 ? ' · FAIL-SAFE' : ''), s.failed && s.failT >= 10 ? 'warn' : 'info');
      stat('co2.q', nf(q, 1) + ' m³/h', 'info');
      stat('co2.fan', s.fan ? 'LIGADO' : 'DESLIGADO', s.fan ? 'info' : '');
      stat('co2.ach', nf(ach, 1) + ' /h', '');
      stat('co2.sensor', s.failed ? (s.failT < 10 ? 'FALHA ' + Math.ceil(10 - s.failT) + ' s' : 'ISOLADO') : 'OK', s.failed ? 'bad' : 'ok');
      stat('co2.vpd', nf(vpd, 2) + ' kPa', st === 'DENTRO' ? 'ok' : 'warn');
      stat('co2.vpdr', name + ' · ' + st, st === 'DENTRO' ? 'ok' : 'warn');
      draw(v.a);
      dot.setAttribute('cx', X(clamp(p, 400, 2000)).toFixed(1));
      dot.setAttribute('cy', Y(v.a).toFixed(1));
    }
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     GÁS — corte imediato por presença ou emergência
     ------------------------------------------------------------------ */
  sims.gas = (() => {
    const draw = buildScope($('[data-scope="gas"]'));
    const LK = 'valvula10.gas.locked';
    const v = new Valve(90);
    const s = { locked: store.get(LK) === '1', hold: false, pir: 0, dec: '—' };
    if (s.locked) { v.a = v.t = 0; s.dec = 'BLOQUEIO SALVO'; }
    const presence = () => s.hold || s.pir > 0;
    const msg = (t) => say('gas-msg', t);

    const cut = (why) => { s.locked = true; v.t = 0; s.dec = '0 s · ' + why; store.set(LK, '1'); msg('Corte imediato: ' + why + '.'); };

    $('#gas-pir').addEventListener('click', () => { s.pir = 1.5; msg('Movimento detectado (pulso de 1,5 s).'); });
    $('#gas-emerg').addEventListener('click', () => { if (!s.locked) cut('EMERGÊNCIA'); else msg('Já está fechada e bloqueada.'); });
    const pBtn = $('#gas-presence');
    pBtn.addEventListener('click', () => {
      s.hold = !s.hold;
      pBtn.setAttribute('aria-pressed', s.hold ? 'true' : 'false');
      pBtn.classList.toggle('is-active', s.hold);
      msg(s.hold ? 'Presença contínua ligada.' : 'Presença contínua desligada.');
    });
    $('#gas-open').addEventListener('click', () => {
      if (presence()) msg('Reabertura negada: há presença.');
      else if (s.locked) msg('Válvula bloqueada. Segure “Rearmar” por 3 s sem presença.');
      else msg('A válvula já está aberta.');
    });
    holdButton({
      btn: $('#gas-rearm'), bar: $('#gas-hold'), ms: 3000,
      ok: () => s.locked && !presence(),
      fail: () => msg(!s.locked ? 'Nada para rearmar.' : 'Rearme negado: há presença.'),
      done: () => { s.locked = false; v.t = 90; s.dec = '—'; store.set(LK, '0'); msg('Rearmado. Válvula reaberta.'); }
    });

    function tick(dt) {
      if (s.pir > 0) s.pir = Math.max(0, s.pir - dt);
      if (!s.locked && presence()) cut('PRESENÇA');
      v.step(dt);
    }
    function render() {
      const pr = presence();
      stat('gas.valve', s.locked ? (v.a > 0.5 ? 'FECHANDO' : 'FECHADA') : (v.a < 89.5 ? 'ABRINDO' : 'ABERTA'), s.locked ? 'bad' : 'ok');
      stat('gas.dec', s.dec, s.locked ? 'bad' : '');
      stat('gas.pres', pr ? 'DETECTADA' : 'LIVRE', pr ? 'bad' : 'ok');
      stat('gas.eeprom', s.locked ? 'BLOQUEADO' : 'LIVRE', s.locked ? 'bad' : 'ok');
      stat('gas.led', s.locked ? 'VERMELHO aceso · verde apagado' : 'VERDE aceso · vermelho apagado', s.locked ? 'bad' : 'ok');
      stat('gas.buz', s.locked ? 'ATIVO' : 'DESLIGADO', s.locked ? 'bad' : '');
      draw(v.a, { noFlow: s.locked });
    }
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     SOLAR — purga em pulsos contra congelamento
     ------------------------------------------------------------------ */
  sims.solar = (() => {
    const draw = buildScope($('[data-scope="solar"]'));
    const T = $('#solar-t'), thr = $('#solar-thr'), hr = $('#solar-h'), speed = $('#solar-speed');
    const v = new Valve(0);
    const GAP = 1800, PULSE = 30;
    const s = { since: GAP, purging: false, left: 0, count: 0, water: 0, hist: [], acc: 0 };
    const night = () => +hr.value >= 22 || +hr.value < 6;

    const start = () => { s.purging = true; s.left = PULSE; v.t = 90; s.count++; s.water += 2; };
    $('#solar-manual').addEventListener('click', () => { if (!s.purging) start(); });
    $('#solar-reset').addEventListener('click', () => { Object.assign(s, { since: GAP, purging: false, left: 0, count: 0, water: 0, hist: [] }); v.a = v.t = 0; });

    const chart = $('#solar-chart');
    function drawChart() {
      const n = s.hist.length, W = 300, H = 80;
      let pts = '';
      s.hist.forEach((a, i) => { pts += (i ? 'L' : 'M') + ((i + (480 - n)) / 480 * (W - 24) + 22).toFixed(1) + ' ' + (H - 10 - a / 90 * (H - 22)).toFixed(1); });
      chart.innerHTML =
        '<g stroke="var(--line)"><line x1="22" y1="70" x2="298" y2="70"/><line x1="22" y1="8" x2="22" y2="70"/></g>' +
        '<g stroke="var(--line)" stroke-dasharray="2 4" opacity=".6"><line x1="22" y1="39" x2="298" y2="39"/><line x1="22" y1="14" x2="298" y2="14"/></g>' +
        '<g font-family="Inter, system-ui, sans-serif" font-size="8" font-weight="600" fill="var(--mute)"><text x="2" y="73">0°</text><text x="2" y="42">45°</text><text x="2" y="17">90°</text><text x="298" y="79" text-anchor="end">agora</text><text x="22" y="79">−120 s</text></g>' +
        (pts ? '<path d="' + pts + '" fill="none" stroke="var(--cor-primaria)" stroke-width="2" stroke-linejoin="round"/>' : '');
    }

    function tick(dt) {
      const d = dt * +speed.value;
      s.since += d;
      if (s.purging) {
        s.left -= d;
        if (s.left <= 0) { s.purging = false; s.left = 0; v.t = 0; s.since = 0; }
      } else if (night() && +T.value < +thr.value && s.since >= GAP) start();
      v.step(d);
      s.acc += dt;
      if (s.acc >= 0.25) { s.acc = 0; s.hist.push(v.a); if (s.hist.length > 480) s.hist.shift(); drawChart(); }
    }

    function render() {
      const t = +T.value, nt = night();
      let next;
      if (s.purging) next = '—';
      else if (!nt) next = 'FORA DA JANELA';
      else if (t >= +thr.value) next = 'SEM RISCO';
      else if (s.since >= GAP) next = 'AGORA';
      else { const r = Math.ceil((GAP - s.since)); next = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0'); }
      stat('solar.valve', s.purging ? (v.a < 89.5 ? 'ABRINDO' : 'ABERTA · PURGANDO') : (v.a > 0.5 ? 'FECHANDO' : 'FECHADA'), s.purging ? 'warn' : 'ok');
      stat('solar.purge', nf(Math.ceil(s.left)) + ' s', s.purging ? 'warn' : '');
      stat('solar.next', next, next === 'AGORA' ? 'warn' : '');
      stat('solar.win', nt ? 'ATIVA' : 'INATIVA', nt ? 'ok' : '');
      stat('solar.temp', nf(t, 1) + ' °C', t <= 0 ? 'bad' : t < +thr.value ? 'warn' : 'ok');
      stat('solar.count', String(s.count), '');
      stat('solar.water', '≈ ' + nf(s.water, 1) + ' L', 'info');
      draw(v.a, { noFlow: !s.purging && v.a < 1 });
    }
    drawChart();
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     Temas por aba. Rosa e preto na abertura; cada protótipo tem a sua paleta.
     As cores mudam por transição (registradas com @property no CSS), sem corte.
     Fundos sempre escuros, para nunca ofuscar na troca.
     ------------------------------------------------------------------ */
  const THEMES = {
    modelo: { nome: 'rosa e preto', bg: '#000000', fg: '#ffffff', mute: '#9a9a9a', faint: '#5c5c5c', line: '#242424', line2: '#3a3a3a',
              a: '#FF007F', b: '#ffffff', on: '#000000', c3d: { a: 0xFF007F, b: 0xFF3D9A } },
    agua:   { nome: 'azul água e branco', bg: '#03121c', fg: '#f4fbff', mute: '#8fa9b8', faint: '#4c6676', line: '#0f2c3d', line2: '#1b4660',
              a: '#1FB6E8', b: '#ffffff', on: '#00131c', c3d: { a: 0x1FB6E8, b: 0xBFEAFB } },
    co2:    { nome: 'verde oliva e branco arenoso', bg: '#090b05', fg: '#efe7d2', mute: '#a6a38d', faint: '#62614c', line: '#232814', line2: '#3a4220',
              a: '#8FA13A', b: '#efe7d2', on: '#0b0d04', c3d: { a: 0x8FA13A, b: 0xE4D9B8 } },
    gas:    { nome: 'vermelho e preto', bg: '#000000', fg: '#ffffff', mute: '#a39a9a', faint: '#5f5555', line: '#2a1517', line2: '#4a2327',
              a: '#E5303A', b: '#ffffff', on: '#000000', c3d: { a: 0xE5303A, b: 0x9c1f27 } },
    solar:  { nome: 'amarelo e azul', bg: '#040a1f', fg: '#ffffff', mute: '#98a3c4', faint: '#55608a', line: '#14214f', line2: '#22357a',
              a: '#F5C518', b: '#3B82F6', on: '#0b0f24', c3d: { a: 0xF5C518, b: 0x3B82F6 } }
  };
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flower = $('.flower');
  const favicon = $('#favicon');
  const metaTheme = $('meta[name="theme-color"]');
  let rot = 0;

  // Cores da flor: migram devagar, em OKLab, para a mudança quase não ser percebida
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const gam = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)));
  const toLab = (hex) => {
    const n = parseInt(hex.slice(1), 16), r = lin(n >> 16 & 255), g = lin(n >> 8 & 255), b = lin(n & 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const fromLab = (c) => {
    const l = Math.pow(c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2], 3);
    const m = Math.pow(c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2], 3);
    const s = Math.pow(c[0] - 0.0894841775 * c[1] - 1.291485548 * c[2], 3);
    return 'rgb(' + gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) + ',' + gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) + ',' + gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) + ')';
  };
  const fl = { a: null, b: null, raf: 0 };
  function flowerColors(t, animate) {
    if (!flower) return;
    const ta = toLab(t.a), tb = toLab(t.b);
    const paint = () => { flower.style.setProperty('--f1', fromLab(fl.a)); flower.style.setProperty('--f2', fromLab(fl.b)); };
    cancelAnimationFrame(fl.raf);
    if (!animate || reduceMotion || !fl.a) { fl.a = ta; fl.b = tb; paint(); return; }
    const a0 = fl.a.slice(), b0 = fl.b.slice(), t0 = performance.now(), D = 2800;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / D), e = 0.5 - 0.5 * Math.cos(Math.PI * k);   // entra e sai devagar
      fl.a = a0.map((v, i) => v + (ta[i] - v) * e);
      fl.b = b0.map((v, i) => v + (tb[i] - v) * e);
      paint();
      if (k < 1) fl.raf = requestAnimationFrame(step);
    };
    fl.raf = requestAnimationFrame(step);
  }

  // Ícone da aba do navegador: a mesma flor
  const PETAL = 'M32 33C23 29 20 17 27 9.5C29.5 7 34.5 7 37 9.5C44 17 41 29 32 33Z';
  const flowerSvg = (a, b, bg) => {
    const ring = (fill, o, stroke, tf, extra) => [0, 60, 120, 180, 240, 300].map((d) =>
      '<path d="' + PETAL + '" fill="' + fill + '" fill-opacity="' + o + '"' + (stroke ? ' stroke="' + bg + '" stroke-width=".9"' : '') + ' transform="rotate(' + (d + extra) + ' 32 32)' + tf + '"/>').join('');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' + ring(a, 1, true, '', 0) +
      ring(b, 0.34, false, ' translate(32 32) scale(.6) translate(-32 -32)', 30) + '<circle cx="32" cy="32" r="5.2" fill="' + b + '"/></svg>';
  };

  function applyTheme(name, animate) {
    const t = THEMES[name] || THEMES.modelo;
    const set = (k, v) => root.style.setProperty(k, v);
    set('--bg', t.bg); set('--fg', t.fg); set('--mute', t.mute); set('--faint', t.faint);
    set('--line', t.line); set('--line-2', t.line2);
    set('--cor-primaria', t.a); set('--cor-secundaria', t.b); set('--on-primaria', t.on);
    if (metaTheme) metaTheme.setAttribute('content', t.bg);
    if (favicon) favicon.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(flowerSvg(t.a, t.b, t.bg)));
    flowerColors(t, animate);
    if (flower && animate && !reduceMotion) { rot += 30; flower.style.transform = 'rotate(' + rot + 'deg)'; }   // um giro lento e suave
  }

  /* ------------------------------------------------------------------
     Abas (rotas por hash) e laço principal
     ------------------------------------------------------------------ */
  const SIM_KEYS = Object.keys(sims);
  const PAGES = ['modelo', ...SIM_KEYS];
  const TITLES = { modelo: 'Válvula de 10 mm', agua: 'Vazamento de água', co2: 'Damper de CO₂', gas: 'Corte de gás', solar: 'Purga solar' };
  const VIEW_CFG = { agua: { view: 'conjunto' }, co2: { view: 'camara' }, gas: { view: 'conjunto' }, solar: { view: 'caixa' } };
  const links = $$('.tab');
  const pages = $$('[data-page]');
  const ind = $('.tab-ind');
  const viewers = {};
  let active = 'modelo', token = 0;

  // Traço deslizante sob a aba atual
  function placeIndicator() {
    const cur = links.find((l) => l.dataset.go === active);
    if (!cur || !ind) return;
    const pad = parseFloat(getComputedStyle(cur).paddingLeft) || 0;
    ind.style.width = Math.max(10, cur.offsetWidth - pad * 2) + 'px';
    ind.style.transform = 'translateX(' + (cur.offsetLeft + pad) + 'px)';
  }
  window.addEventListener('resize', placeIndicator);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeIndicator);

  function mountViewer(name) {
    if (!sims[name] || viewers[name] || !window.ValveViewer) return;
    const cfg = VIEW_CFG[name] || {};
    const t = THEMES[name];
    viewers[name] = ValveViewer.mount($('[data-viewer="' + name + '"]'), {
      view: cfg.view, getAngle: () => sims[name].v.a, colors: t.c3d
    }) || true;
  }

  function show(name, userNav) {
    active = name;
    const my = ++token;
    applyTheme(name, userNav);
    links.forEach((l) => { if (l.dataset.go === name) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
    placeIndicator();
    document.title = name === 'modelo' ? 'Sapia · Válvula de 10 mm' : TITLES[name] + ' · Sapia';
    const cur = pages.find((p) => !p.hidden);

    const swap = () => {
      if (my !== token) return;                      // outra troca começou: esta fica obsoleta
      pages.forEach((p) => {
        const on = p.dataset.page === name;
        p.hidden = !on;
        p.classList.remove('is-out', 'is-in');
        if (on && userNav) { void p.offsetWidth; p.classList.add('is-in'); }
      });
      if (userNav) { root.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); root.style.scrollBehavior = ''; }
      if (sims[name]) { sims[name].render(); mountViewer(name); }
    };
    // a página atual esmaece antes da próxima entrar, enquanto as cores já migram
    if (userNav && cur && cur.dataset.page !== name && !reduceMotion) { cur.classList.add('is-out'); setTimeout(swap, 230); }
    else swap();

    const act = links.find((l) => l.dataset.go === name);
    if (act && userNav && act.scrollIntoView) act.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  const fromHash = () => {
    const h = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
    return PAGES.includes(h) ? h : 'modelo';
  };
  window.addEventListener('hashchange', () => show(fromHash(), true));

  // "Ir para o conteúdo" sem mexer na rota
  const skip = $('[data-skip]');
  if (skip) skip.addEventListener('click', (e) => {
    e.preventDefault();
    const m = $('#conteudo'); m.tabIndex = -1; m.focus();
  });

  // Atalhos dentro da página (rolar até um bloco)
  $$('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    const t = $(b.dataset.scroll);
    if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }));

  // Entrada suave dos blocos ao rolar
  const rv = $$('.rv');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    rv.forEach((el) => io.observe(el));
  } else rv.forEach((el) => el.classList.add('rv-in'));

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    Object.values(sims).forEach((m) => m.tick(dt));   // todos continuam rodando em segundo plano
    if (sims[active]) sims[active].render();
    requestAnimationFrame(loop);
  }
  show(fromHash(), false);
  requestAnimationFrame(loop);
})();
