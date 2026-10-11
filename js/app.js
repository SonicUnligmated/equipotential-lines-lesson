/* Lab 7A · Mapping of Equipotential Lines — lesson app (no dependencies) */
(function () {
  'use strict';

  /* tutorial clock: virtual milliseconds that stop while paused and run slower or faster with the speed setting */
  const TC = { speed: 1, paused: false, base: 0, at: performance.now() };
  function tnow() { const n = performance.now(); if (!TC.paused) TC.base += (n - TC.at) * TC.speed; TC.at = n; return TC.base; }
  function tcSet(o) { tnow(); Object.assign(TC, o); }

  /* =====================================================================
     1. FIELD MODEL — two small plates in a wide, shallow tray of solution
     Each plate is modelled as a thin conductor of equivalent radius A (a strip of
     height 4A). For two parallel conductors of radius A whose centres are 2D apart,
     the exact 2-D potential is that of two line charges at x = ±B, B = √(D² − A²):
       V(x, y) = VBAT/2 + VBAT · ln(r₋ / r₊) / (2 · acosh(D / A))
     The − plate is at 0 V (reference) and the + plate at VBAT.
     ===================================================================== */
  const VBAT = 3.9, PD = 10, PA = 0.3, PB = Math.sqrt(PD * PD - PA * PA), PK = Math.acosh(PD / PA);
  const PLATE = { neg: { x: -PD, y0: -2 * PA, y1: 2 * PA, v: 0 }, pos: { x: PD, y0: -2 * PA, y1: 2 * PA, v: VBAT } };
  const BOARD = 5;                         // graph board: x and y from −5 to +5 cm
  const VMIN = 1.7, VMAX = 2.2;            // target equipotentials inside the board
  const XMIN = -12, XMAX = 12, YMIN = -8, YMAX = 8, H = 0.1;   // modelled region for drawing
  const NX = Math.round((XMAX - XMIN) / H) + 1, NY = Math.round((YMAX - YMIN) / H) + 1;

  function potential(x, y) {
    const rm = Math.max(1e-6, Math.hypot(x + PB, y)), rp = Math.max(1e-6, Math.hypot(x - PB, y));
    const v = VBAT / 2 + VBAT * Math.log(rm / rp) / (2 * PK);
    return Math.min(VBAT, Math.max(0, v));
  }
  function gradV(x, y) {
    const d = 0.02;
    return [(potential(x + d, y) - potential(x - d, y)) / (2 * d), (potential(x, y + d) - potential(x, y - d)) / (2 * d)];
  }
  const VG = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) VG[j * NX + i] = potential(XMIN + i * H, YMIN + j * H);
  function node(i, j) { return VG[j * NX + i]; }
  /* x where the potential equals v on the row y, inside the board (null if the line misses the board there) */
  function locateX(v, y) {
    let a = -BOARD, b = BOARD;
    if (potential(a, y) > v || potential(b, y) < v) return null;
    for (let k = 0; k < 50; k++) { const m = (a + b) / 2; if (potential(m, y) < v) a = m; else b = m; }
    return (a + b) / 2;
  }
  const r1 = v => Math.round(v * 10) / 10 + 0;

  /* Marching squares on any grid. get(i,j) value; returns chained polylines in grid index coords. */
  function contourGrid(get, nx, ny, level) {
    const pts = new Map();
    const adj = new Map();
    function ept(key, ax, ay, bx, by, va, vb) {
      if (!pts.has(key)) { const t = (level - va) / (vb - va); pts.set(key, [ax + (bx - ax) * t, ay + (by - ay) * t]); }
      return key;
    }
    function link(a, b) {
      if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b); adj.get(b).push(a);
    }
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v00 = get(i, j), v10 = get(i + 1, j), v11 = get(i + 1, j + 1), v01 = get(i, j + 1);
        const c = (v00 > level ? 1 : 0) | (v10 > level ? 2 : 0) | (v11 > level ? 4 : 0) | (v01 > level ? 8 : 0);
        if (c === 0 || c === 15) continue;
        const e = [];
        if ((v00 > level) !== (v10 > level)) e.push(ept('h' + i + ',' + j, i, j, i + 1, j, v00, v10));
        if ((v10 > level) !== (v11 > level)) e.push(ept('v' + (i + 1) + ',' + j, i + 1, j, i + 1, j + 1, v10, v11));
        if ((v01 > level) !== (v11 > level)) e.push(ept('h' + i + ',' + (j + 1), i, j + 1, i + 1, j + 1, v01, v11));
        if ((v00 > level) !== (v01 > level)) e.push(ept('v' + i + ',' + j, i, j, i, j + 1, v00, v01));
        if (e.length === 2) link(e[0], e[1]);
        else if (e.length === 4) {
          const ctr = (v00 + v10 + v11 + v01) / 4;
          if ((ctr > level) === (v00 > level)) { link(e[0], e[1]); link(e[2], e[3]); }
          else { link(e[0], e[3]); link(e[1], e[2]); }
        }
      }
    }
    const seen = new Set(), lines = [];
    function walk(start) {
      const line = [start]; seen.add(start);
      let cur = start;
      for (;;) {
        const nb = (adj.get(cur) || []).find(k => !seen.has(k));
        if (!nb) break; seen.add(nb); line.push(nb); cur = nb;
      }
      return line;
    }
    for (const [k, nbs] of adj) if (nbs.length === 1 && !seen.has(k)) lines.push(walk(k).map(q => pts.get(q)));
    for (const k of adj.keys()) if (!seen.has(k)) { const l = walk(k); l.push(l[0]); lines.push(l.map(q => pts.get(q))); }
    return lines;
  }
  const contourCache = new Map();
  function trayContours(level) {
    const key = level.toFixed(4);
    if (!contourCache.has(key)) {
      if (contourCache.size > 60) contourCache.clear();
      contourCache.set(key, contourGrid(node, NX, NY, level).map(l => l.map(p => [XMIN + p[0] * H, YMIN + p[1] * H])));
    }
    return contourCache.get(key);
  }
  /* Streamline along -grad V (dir=+1, toward the − plate) or +grad V (dir=-1, toward the + plate). */
  function streamline(x, y, dir, maxSteps) {
    const out = [[x, y]], ds = 0.08;
    for (let s = 0; s < (maxSteps || 1600); s++) {
      let g = gradV(x, y), m = Math.hypot(g[0], g[1]);
      if (m < 1e-5) break;
      const mx = x - dir * ds * 0.5 * g[0] / m, my = y - dir * ds * 0.5 * g[1] / m;
      g = gradV(mx, my); m = Math.hypot(g[0], g[1]);
      if (m < 1e-5) break;
      x -= dir * ds * g[0] / m; y -= dir * ds * g[1] / m;
      if (x < XMIN || x > XMAX || y < YMIN || y > YMAX) break;
      out.push([x, y]);
      if (Math.hypot(x + PD, y) < PA * 1.2 || Math.hypot(x - PD, y) < PA * 1.2) break;
    }
    return out;
  }
  let FIELD_LINES = null;
  function trayFieldLines() {             // field lines through evenly spaced points on the centre line x = 0
    if (FIELD_LINES) return FIELD_LINES;
    FIELD_LINES = [-7, -5.4, -4, -2.8, -1.7, -0.8, 0, 0.8, 1.7, 2.8, 4, 5.4, 7]
      .map(y => streamline(0, y, -1, 3000).reverse().concat(streamline(0, y, 1, 3000).slice(1)))
      .filter(l => l.length > 8);
    return FIELD_LINES;
  }

  /* Worked example — generated from the same field model, points read to 0.1 cm */
  const SPREAD_Y = [-4.5, -1.5, 1.5, 4.5];
  const WORKED = [1.8, 1.9, 2.0, 2.1].map(v => ({ v, pts: SPREAD_Y.map(y => [r1(locateX(v, y)), y]) }));

  /* colour for a potential: ink-blue (1.7 V and below) → violet → red (2.2 V and above);
     full = true spreads the same ramp over the whole 0 V … VBAT range */
  function vColor(v, a, full) {
    const t = full ? Math.min(Math.max(v / VBAT, 0), 1) : Math.min(Math.max((v - VMIN) / (VMAX - VMIN), 0), 1);
    const c0 = [45, 79, 163], c1 = [124, 62, 140], c2 = [192, 64, 43];
    const c = t < 0.5 ? c0.map((q, k) => q + (c1[k] - q) * t * 2) : c1.map((q, k) => q + (c2[k] - q) * (t - 0.5) * 2);
    return a == null ? `rgb(${c.map(Math.round).join(',')})` : `rgba(${c.map(Math.round).join(',')},${a})`;
  }
  const MINUS = '\u2212';
  const fmt1 = v => { const r = Math.round(v * 10) / 10; return (r < 0 ? MINUS : '') + Math.abs(r).toFixed(1); };
  const fmtV = v => v.toFixed(2);
  const fmtT = v => (Math.abs(v * 10 - Math.round(v * 10)) < 1e-6 ? v.toFixed(1) : v.toFixed(2));
  const fmtLabel = v => fmtT(v) + ' V';
  const fmtTick = n => (n < 0 ? MINUS : '') + Math.abs(n);

  /* =====================================================================
     2. SVG HELPERS
     ===================================================================== */
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  function polyD(pts, map) { return pts.map((p, k) => (k ? 'L' : 'M') + map(p).map(n => n.toFixed(1)).join(' ')).join(''); }
  function smoothD(sp) {
    if (sp.length < 2) return '';
    if (sp.length === 2) return `M${sp[0][0]} ${sp[0][1]}L${sp[1][0]} ${sp[1][1]}`;
    let d = `M${sp[0][0].toFixed(1)} ${sp[0][1].toFixed(1)}`;
    for (let i = 0; i < sp.length - 1; i++) {
      const p0 = sp[i - 1] || sp[i], p1 = sp[i], p2 = sp[i + 1], p3 = sp[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  }
  function arrowAt(parent, line, map, color, frac) {
    if (line.length < 6) return;
    const k = Math.floor(line.length * (frac || 0.5));
    const a = map(line[k]), b = map(line[Math.min(k + 2, line.length - 1)]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    el('path', { d: 'M-5 -4 L4 0 L-5 4 Z', fill: color, transform: `translate(${a[0].toFixed(1)} ${a[1].toFixed(1)}) rotate(${ang.toFixed(1)})` }, parent);
  }

  /* ---------- tray drawing (viewBox 660 × 470, 28 px per cm, x −11…11, y −7…7 cm shown) ---------- */
  const TS = 28, TX0 = 22, TY0 = 22, TXL = -11, TXR = 11, TYB = -7, TYT = 7;
  const tmap = p => [TX0 + (p[0] - TXL) * TS, TY0 + (TYT - p[1]) * TS];
  function drawTrayBase(svg) {
    svg.innerHTML = '';
    const defs = el('defs', null, svg);
    const lg = el('linearGradient', { id: svg.id + '-sol', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': '#e3ebf7' }, lg); el('stop', { offset: '.5', 'stop-color': '#eef1ee' }, lg); el('stop', { offset: '1', 'stop-color': '#f6e8e2' }, lg);
    const cp = el('clipPath', { id: svg.id + '-clip' }, defs);
    const TW = (TXR - TXL) * TS, THh = (TYT - TYB) * TS;
    el('rect', { x: TX0, y: TY0, width: TW, height: THh, rx: 6 }, cp);
    el('rect', { x: TX0 - 8, y: TY0 - 8, width: TW + 16, height: THh + 16, rx: 14, fill: '#d9d2c2' }, svg);
    el('rect', { x: TX0, y: TY0, width: TW, height: THh, rx: 6, fill: `url(#${svg.id}-sol)` }, svg);
    const b0 = tmap([-BOARD, BOARD]), b1 = tmap([BOARD, -BOARD]);
    el('rect', { x: b0[0], y: b0[1], width: b1[0] - b0[0], height: b1[1] - b0[1], fill: '#ffffff', opacity: .45, stroke: '#9fb0c8', 'stroke-width': 1.2 }, svg);
    const g = el('g', { stroke: '#b9c6d8', opacity: .7 }, svg);
    for (let k = -BOARD + 1; k < BOARD; k++) {
      const X = tmap([k, 0])[0], Y = tmap([0, k])[1];
      el('line', { x1: X, y1: b0[1], x2: X, y2: b1[1], 'stroke-width': k === 0 ? 1.4 : .6, stroke: k === 0 ? '#8496b3' : null }, g);
      el('line', { x1: b0[0], y1: Y, x2: b1[0], y2: Y, 'stroke-width': k === 0 ? 1.4 : .6, stroke: k === 0 ? '#8496b3' : null }, g);
    }
    const rl = el('g', { fill: '#6a7186', 'font-size': 13, 'font-family': 'Source Sans 3, sans-serif' }, svg);
    for (let k = -BOARD; k <= BOARD; k++) {
      txt(rl, tmap([k, 0])[0], b1[1] + 17, fmtTick(k), { 'text-anchor': 'middle' });
      txt(rl, b0[0] - 8, tmap([0, k])[1] + 4, fmtTick(k), { 'text-anchor': 'end' });
    }
    txt(rl, b1[0] + 8, b1[1] + 17, 'x (cm)', { 'font-weight': 600 });
    txt(rl, b0[0] - 8, b0[1] - 12, 'y (cm)', { 'text-anchor': 'end', 'font-weight': 600 });
    const clip = { 'clip-path': `url(#${svg.id}-clip)` };
    const layers = { under: el('g', clip, svg), lines: el('g', clip, svg), plates: el('g', null, svg), marks: el('g', null, svg), top: el('g', null, svg) };
    drawPlates(layers.plates);
    return layers;
  }
  function drawPlates(g) {
    [['neg', '#2d4fa3', '−'], ['pos', '#c0402b', '+']].forEach(([k, c, s]) => {
      const p = PLATE[k], a = tmap([p.x, p.y1]), b = tmap([p.x, p.y0]);
      el('rect', { x: a[0] - 4, y: a[1] - 2, width: 8, height: b[1] - a[1] + 4, rx: 2, fill: c }, g);
      el('circle', { cx: a[0], cy: a[1] - 18, r: 11, fill: '#fff', stroke: c, 'stroke-width': 2 }, g);
      txt(g, a[0], a[1] - 12.5, s, { 'text-anchor': 'middle', fill: c, 'font-size': 18, 'font-weight': 700, 'font-family': 'Sora, sans-serif' });
    });
  }
  function drawContoursSVG(g, level, map, attrs) {
    trayContours(level).forEach(l => el('path', Object.assign({ d: polyD(l, map), fill: 'none' }, attrs), g));
  }
  function drawFieldLinesSVG(g, map, attrs, arrows) {
    trayFieldLines().forEach(l => {
      el('path', Object.assign({ d: polyD(l, map), fill: 'none' }, attrs), g);
      if (arrows) arrowAt(g, l, map, attrs.stroke, 0.36);
    });
  }

  /* ---------- graph paper (viewBox 640 × 640, 50 px per cm, x and y −5…5 cm) ---------- */
  const GS = 50, GX0 = 80, GY0 = 40;
  const gmap = p => [GX0 + (p[0] + BOARD) * GS, GY0 + (BOARD - p[1]) * GS];
  let graphClipN = 0;
  function drawGraphBase(svg) {
    svg.setAttribute('viewBox', '0 0 640 640');
    svg.innerHTML = '';
    const SZ = 2 * BOARD * GS;
    el('rect', { x: 0, y: 0, width: 640, height: 640, fill: '#fbfdf9', rx: 12 }, svg);
    const cid = 'gclip-' + (svg.id || 'g') + '-' + (++graphClipN);
    el('rect', { x: GX0, y: GY0, width: SZ, height: SZ }, el('clipPath', { id: cid }, el('defs', null, svg)));
    const g = el('g', null, svg);
    for (let k = 0; k <= 2 * BOARD * 5; k++) {          // 2 mm squares, bold every 1 cm
      const X = GX0 + k * GS / 5, Y = GY0 + k * GS / 5, cmLine = k % 5 === 0;
      const st = { stroke: cmLine ? '#a9d8b4' : '#e0f1e3', 'stroke-width': cmLine ? 1 : .7 };
      el('line', Object.assign({ x1: X, y1: GY0, x2: X, y2: GY0 + SZ }, st), g);
      el('line', Object.assign({ x1: GX0, y1: Y, x2: GX0 + SZ, y2: Y }, st), g);
    }
    el('rect', { x: GX0, y: GY0, width: SZ, height: SZ, fill: 'none', stroke: '#86c897', 'stroke-width': 1.4 }, svg);
    const o = gmap([0, 0]);
    el('line', { x1: GX0, y1: o[1], x2: GX0 + SZ, y2: o[1], stroke: '#1c2541', 'stroke-width': 1.6 }, svg);
    el('line', { x1: o[0], y1: GY0, x2: o[0], y2: GY0 + SZ, stroke: '#1c2541', 'stroke-width': 1.6 }, svg);
    const lab = el('g', { fill: '#3c4663', 'font-size': 15, 'font-family': 'Source Sans 3, sans-serif' }, svg);
    for (let k = -BOARD; k <= BOARD; k++) {
      const X = gmap([k, 0])[0], Y = gmap([0, k])[1];
      el('line', { x1: X, y1: o[1] - 5, x2: X, y2: o[1] + 5, stroke: '#1c2541', 'stroke-width': 1.4 }, svg);
      el('line', { x1: o[0] - 5, y1: Y, x2: o[0] + 5, y2: Y, stroke: '#1c2541', 'stroke-width': 1.4 }, svg);
      txt(lab, X, GY0 + SZ + 22, fmtTick(k), { 'text-anchor': 'middle' });
      txt(lab, GX0 - 12, Y + 5, fmtTick(k), { 'text-anchor': 'end' });
    }
    const ax = el('g', { fill: '#1c2541', 'font-size': 16, 'font-weight': 600, 'font-family': 'Sora, sans-serif' }, svg);
    txt(ax, GX0 + SZ, GY0 + SZ + 46, 'x (cm)', { 'text-anchor': 'end' });
    txt(ax, GX0 - 12, GY0 - 14, 'y (cm)', { 'text-anchor': 'middle' });
    const pl = el('g', { 'font-size': 14, 'font-family': 'Source Sans 3, sans-serif', fill: '#3c4663' }, svg);
    el('rect', { x: GX0, y: GY0 + SZ + 66, width: 6, height: 18, rx: 2, fill: '#2d4fa3' }, pl);
    txt(pl, GX0 + 12, GY0 + SZ + 80, '− plate at x = −10 cm (left)');
    el('rect', { x: GX0 + SZ - 6, y: GY0 + SZ + 66, width: 6, height: 18, rx: 2, fill: '#c0402b' }, pl);
    txt(pl, GX0 + SZ - 12, GY0 + SZ + 80, '+ plate at x = +10 cm (right)', { 'text-anchor': 'end' });
    return { under: el('g', { 'clip-path': `url(#${cid})` }, svg), lines: el('g', null, svg), pts: el('g', null, svg), labels: el('g', null, svg) };
  }
  function plotSet(layers, v, pts) {
    const col = vColor(v);
    const sorted = pts.slice().sort((a, b) => a[1] - b[1]);
    const sp = sorted.map(gmap);
    if (sp.length >= 2) el('path', { d: smoothD(sp), fill: 'none', stroke: col, 'stroke-width': 3, 'stroke-linecap': 'round' }, layers.lines);
    sp.forEach(p => {
      el('circle', { cx: p[0], cy: p[1], r: 5.5, fill: '#fff', stroke: col, 'stroke-width': 2.5 }, layers.pts);
      el('circle', { cx: p[0], cy: p[1], r: 1.8, fill: col }, layers.pts);
    });
    if (sp.length) {
      const top = sp[sp.length - 1];
      txt(layers.labels, top[0], top[1] - 14, fmtLabel(v), { 'text-anchor': 'middle', fill: col, 'font-size': 20, 'font-weight': 700, class: 'hand' });
    }
  }

  /* =====================================================================
     3. NAVIGATION + RAIL
     ===================================================================== */
  const views = Array.from(document.querySelectorAll('.view'));
  const ids = views.map(v => v.id.replace('view-', ''));
  const nav = document.getElementById('rail-nav');
  const fill = document.getElementById('rail-fill');
  const btnPrev = document.getElementById('btn-prev');
  const items = views.map((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rail-item';
    b.innerHTML = `<span class="rk"></span><span>${v.dataset.title}</span>`;
    b.addEventListener('click', () => goTo(i, true));
    nav.appendChild(b);
    return b;
  });
  let current = -1;
  const onEnter = {}, onLeave = {};
  function goTo(i, push) {
    i = Math.max(0, Math.min(views.length - 1, i));
    if (i === current) return;
    if (current >= 0 && onLeave[ids[current]]) onLeave[ids[current]]();
    current = i;
    views.forEach((v, k) => v.classList.toggle('active', k === i));
    items.forEach((b, k) => {
      b.classList.toggle('current', k === i); b.classList.toggle('done', k < i);
      if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    btnPrev.hidden = i === 0;
    const it = items[i];
    requestAnimationFrame(() => {
      if (getComputedStyle(fill.parentElement).display !== 'none') {
        fill.style.height = Math.max(0, it.offsetTop + it.offsetHeight / 2 - 14) + 'px';
      }
      if (window.matchMedia('(max-width:980px)').matches) it.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    if (push && location.hash !== '#' + ids[i]) history.pushState(null, '', '#' + ids[i]);
    window.scrollTo({ top: 0 });
    document.title = views[i].dataset.title.replace('&amp;', '&') + ' · Equipotential Lines · Lab 7A';
    if (onEnter[ids[i]]) onEnter[ids[i]]();
  }
  btnPrev.addEventListener('click', () => goTo(current - 1, true));
  document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => goTo(current + 1, true)));
  function fromHash() { const k = ids.indexOf(location.hash.replace('#', '')); return k < 0 ? 0 : k; }
  window.addEventListener('popstate', () => goTo(fromHash(), false));
  window.addEventListener('hashchange', () => goTo(fromHash(), false));

  /* =====================================================================
     4. CUSTOM PROBE CURSOR
     ===================================================================== */
  const cur = document.getElementById('probe-cursor');
  const curRead = document.getElementById('probe-read');
  const fine = window.matchMedia('(pointer:fine)').matches;
  let curOwner = null;
  if (fine) {
    window.addEventListener('mousemove', e => {
      if (!document.body.classList.contains('has-probe')) document.body.classList.add('has-probe');
      cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      cur.classList.remove('hidden');
      const hot = e.target.closest && e.target.closest('button, a, input, select, [role="button"]');
      cur.classList.toggle('hot', !!hot);
    }, { passive: true });
    document.addEventListener('mouseleave', () => cur.classList.add('hidden'));
    window.addEventListener('blur', () => cur.classList.add('hidden'));
  }
  function setReading(owner, text, onTarget) {
    if (text == null) {
      if (curOwner === owner) { cur.classList.remove('reading'); curOwner = null; }
      return;
    }
    curOwner = owner;
    curRead.textContent = text;
    curRead.classList.toggle('on-target', !!onTarget);
    cur.classList.add('reading');
  }

  /* =====================================================================
     5. BACKGROUND — drifting field lines and equipotential contours
     ===================================================================== */
  (function background() {
    const cv = document.getElementById('bg-field');
    const ctx = cv.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1, gx = 0, gy = 0, grid = null;
    const cell = 18;
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gx = Math.ceil(w / cell) + 1; gy = Math.ceil(h / cell) + 1;
      grid = new Float32Array(gx * gy);
      if (reduce) frame(9000);
    }
    function charges(t) {
      const s = t * 0.00004;
      return [
        { q: 1.0, x: w * (0.70 + 0.10 * Math.sin(s * 1.3)), y: h * (0.30 + 0.12 * Math.cos(s * 0.9)) },
        { q: 0.8, x: w * (0.88 + 0.06 * Math.cos(s * 1.1 + 1)), y: h * (0.78 + 0.10 * Math.sin(s * 0.7)) },
        { q: -1.0, x: w * (0.32 + 0.10 * Math.cos(s * 1.0 + 2)), y: h * (0.62 + 0.12 * Math.sin(s * 1.2 + 1)) },
        { q: -0.8, x: w * (0.12 + 0.06 * Math.sin(s * 0.8 + 3)), y: h * (0.18 + 0.10 * Math.cos(s * 1.4)) }
      ];
    }
    function pot(cs, x, y) {
      let v = 0;
      for (const c of cs) v -= c.q * Math.log(Math.hypot(x - c.x, y - c.y) + 28);
      return v;
    }
    const levels = [-2.4, -1.8, -1.2, -0.75, -0.35, 0, 0.35, 0.75, 1.2, 1.8, 2.4];
    function frame(t) {
      const cs = charges(t);
      ctx.clearRect(0, 0, w, h);
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) grid[j * gx + i] = pot(cs, i * cell, j * cell);
      ctx.lineWidth = 1.1;
      for (const L of levels) {
        ctx.strokeStyle = L < 0 ? 'rgba(45,79,163,0.13)' : L > 0 ? 'rgba(192,64,43,0.11)' : 'rgba(90,70,140,0.12)';
        ctx.beginPath();
        contourGrid((i, j) => grid[j * gx + i], gx, gy, L).forEach(l => {
          l.forEach((p, k) => k ? ctx.lineTo(p[0] * cell, p[1] * cell) : ctx.moveTo(p[0] * cell, p[1] * cell));
        });
        ctx.stroke();
      }
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = -(t * 0.012) % 22;
      ctx.strokeStyle = 'rgba(212,137,26,0.20)';
      ctx.lineWidth = 1.2;
      for (const c of cs) {
        if (c.q < 0) continue;
        for (let a = 0; a < 14; a++) {
          const th = a / 14 * Math.PI * 2 + 0.2;
          let x = c.x + 34 * Math.cos(th), y = c.y + 34 * Math.sin(th);
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let s = 0; s < 260; s++) {
            let ex = 0, ey = 0;
            for (const d of cs) { const dx = x - d.x, dy = y - d.y, r2 = dx * dx + dy * dy + 800; ex += d.q * dx / r2; ey += d.q * dy / r2; }
            const m = Math.hypot(ex, ey); if (m < 1e-7) break;
            x += 9 * ex / m; y += 9 * ey / m;
            ctx.lineTo(x, y);
            if (x < -40 || y < -40 || x > w + 40 || y > h + 40) break;
            let hitNeg = false; for (const d of cs) if (d.q < 0 && Math.hypot(x - d.x, y - d.y) < 30) hitNeg = true;
            if (hitNeg) break;
          }
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }
    let last = 0;
    function loop(t) {
      if (!document.hidden && t - last > 45) { last = t; frame(t); }
      requestAnimationFrame(loop);
    }
    window.addEventListener('resize', resize);
    resize();
    if (!reduce) requestAnimationFrame(loop);
  })();

  /* =====================================================================
     6. AIM HERO
     ===================================================================== */
  (function aimHero() {
    const svg = document.getElementById('aim-hero');
    const S = 660 / (XMAX - XMIN);
    const m = p => [(p[0] - XMIN) * S, 130 - p[1] * S];
    el('rect', { width: 660, height: 260, rx: 14, fill: '#fbf9f3', stroke: '#e4dccb' }, svg);
    const g = el('g', null, svg);
    drawFieldLinesSVG(g, m, { stroke: 'rgba(212,137,26,.55)', 'stroke-width': 1.4, 'stroke-dasharray': '5 5' }, true);
    for (let k = 1; k <= 12; k++) { const v = k * 0.3; drawContoursSVG(g, v, m, { stroke: vColor(v, .85, true), 'stroke-width': k % 2 ? 1.1 : 2.2 }); }
    [['neg', '#2d4fa3'], ['pos', '#c0402b']].forEach(([k, c]) => {
      const p = PLATE[k], a = m([p.x, p.y1]), b = m([p.x, p.y0]);
      el('rect', { x: a[0] - 4, y: a[1], width: 8, height: b[1] - a[1], rx: 2, fill: c }, svg);
    });
  })();

  /* =====================================================================
     7. CONCEPT CANVAS
     ===================================================================== */
  (function concept() {
    const cv = document.getElementById('concept-canvas');
    const ctx = cv.getContext('2d');
    const S = cv.width / (XMAX - XMIN);
    const cm = p => [(p[0] - XMIN) * S, cv.height / 2 - p[1] * S];
    const outV = document.getElementById('concept-v');
    const bEq = document.getElementById('concept-all-eq'), bFl = document.getElementById('concept-all-fl');
    let probe = null;
    const DEFAULT = [-2.5, 3.5];
    function path(l) { ctx.beginPath(); l.forEach((p, k) => { const q = cm(p); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); }
    function draw() {
      const p = probe || DEFAULT;
      const g = ctx.createLinearGradient(0, 0, cv.width, 0);
      g.addColorStop(0, '#e6edf8'); g.addColorStop(.5, '#f2f3ef'); g.addColorStop(1, '#f8ebe6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      if (bEq.getAttribute('aria-pressed') === 'true') {
        for (let k = 1; k <= 12; k++) {
          const v = k * 0.3;
          ctx.strokeStyle = vColor(v, .38, true); ctx.lineWidth = 2;
          trayContours(v).forEach(l => { path(l); ctx.stroke(); });
        }
      }
      if (bFl.getAttribute('aria-pressed') === 'true') {
        ctx.strokeStyle = 'rgba(212,137,26,.45)'; ctx.lineWidth = 2; ctx.setLineDash([10, 9]);
        trayFieldLines().forEach(l => { path(l); ctx.stroke(); });
        ctx.setLineDash([]);
      }
      [['neg', '#2d4fa3', '−'], ['pos', '#c0402b', '+']].forEach(([k, c, s]) => {
        const P = PLATE[k], a = cm([P.x, P.y1]), b = cm([P.x, P.y0]);
        ctx.fillStyle = c; ctx.fillRect(a[0] - 7, a[1], 14, b[1] - a[1]);
        ctx.font = '700 44px Sora, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s, a[0], a[1] - 22);
      });
      const v = potential(p[0], p[1]);
      const onPlate = v < 0.03 || v > VBAT - 0.03;
      if (!onPlate) {
        const fl = streamline(p[0], p[1], -1, 1600).reverse().concat(streamline(p[0], p[1], 1, 1600));
        ctx.strokeStyle = '#d4891a'; ctx.lineWidth = 5; ctx.setLineDash([16, 12]);
        path(fl); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = vColor(v, null, true); ctx.lineWidth = 6; ctx.lineCap = 'round';
        contourGrid(node, NX, NY, v).forEach(l => { path(l.map(q => [XMIN + q[0] * H, YMIN + q[1] * H])); ctx.stroke(); });
        const gr = gradV(p[0], p[1]), mg = Math.hypot(gr[0], gr[1]) || 1;
        const u = [gr[0] / mg, gr[1] / mg], n = [-u[1], u[0]], L = 0.75;
        const q0 = cm(p), q1 = cm([p[0] + u[0] * L, p[1] + u[1] * L]), q2 = cm([p[0] + (u[0] + n[0]) * L, p[1] + (u[1] + n[1]) * L]), q3 = cm([p[0] + n[0] * L, p[1] + n[1] * L]);
        ctx.strokeStyle = '#1c2541'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q3[0], q3[1]); ctx.stroke();
        ctx.fillStyle = '#1c2541'; ctx.beginPath(); ctx.arc(q0[0], q0[1], 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q0[0], q0[1], 3.5, 0, Math.PI * 2); ctx.fill();
      }
      outV.textContent = onPlate ? (v < 1 ? '0.00 V (on the − plate)' : fmtV(VBAT) + ' V (on the + plate)') : fmtV(v) + ' V';
      outV.style.color = vColor(v, null, true);
    }
    function toCm(e) {
      const r = cv.getBoundingClientRect();
      return [XMIN + (e.clientX - r.left) / r.width * (XMAX - XMIN), YMAX - (e.clientY - r.top) / r.height * (YMAX - YMIN)];
    }
    let raf = 0;
    cv.addEventListener('pointermove', e => {
      probe = toCm(e);
      setReading('concept', fmtV(potential(probe[0], probe[1])) + ' V');
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); });
    });
    cv.addEventListener('pointerdown', e => { probe = toCm(e); draw(); });
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { probe = null; draw(); } setReading('concept', null); });
    [bEq, bFl].forEach(b => b.addEventListener('click', () => { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); draw(); }));
    onEnter.concept = draw;
    draw();
  })();

  /* =====================================================================
     8. MEDICAL ILLUSTRATIONS
     ===================================================================== */
  (function medical() {
    // (a) heart dipole field in the chest + two ECG electrodes
    const s1 = document.getElementById('med-tissue');
    const W1 = 320, H1 = 200;
    const dip = [{ q: 1, x: 150, y: 92 }, { q: -1, x: 182, y: 128 }];
    const pf = (x, y) => dip.reduce((s, c) => s - c.q * Math.log(Math.hypot(x - c.x, y - c.y) + 6), 0);
    const torso = 'M70 196 C60 120 78 40 120 22 L200 22 C242 40 260 120 250 196 Z';
    el('path', { d: torso, fill: '#fff4ec', stroke: '#e3c7b5', 'stroke-width': 2 }, s1);
    const cl = el('clipPath', { id: 'torso-clip' }, el('defs', null, s1));
    el('path', { d: torso }, cl);
    const gg = el('g', { 'clip-path': 'url(#torso-clip)' }, s1);
    const nx = 65, ny = 41, sx = W1 / (nx - 1), sy = H1 / (ny - 1);
    const get = (i, j) => pf(i * sx, j * sy);
    [-1.2, -0.8, -0.45, -0.15, 0.15, 0.45, 0.8, 1.2].forEach(L => {
      contourGrid(get, nx, ny, L).forEach(l => el('path', { d: polyD(l, p => [p[0] * sx, p[1] * sy]), fill: 'none', stroke: L > 0 ? 'rgba(192,64,43,.55)' : 'rgba(45,79,163,.55)', 'stroke-width': 1.3 }, gg));
    });
    el('path', { d: 'M166 132 C140 116 136 92 152 86 C162 82 168 90 168 96 C170 88 180 84 188 90 C200 100 186 122 166 132 Z', fill: '#c0402b', opacity: .85, transform: 'rotate(-18 166 108)' }, s1);
    [[110, 60, 'V₁'], [222, 160, 'V₂']].forEach(([x, y, s]) => {
      el('circle', { cx: x, cy: y, r: 9, fill: '#fff', stroke: '#1c2541', 'stroke-width': 2 }, s1);
      el('circle', { cx: x, cy: y, r: 3, fill: '#1c2541' }, s1);
      txt(s1, x + (x < 160 ? -16 : 16), y + 5, s, { 'text-anchor': x < 160 ? 'end' : 'start', 'font-size': 14, 'font-weight': 700, fill: '#1c2541', 'font-family': 'Sora, sans-serif' });
    });
    txt(s1, 160, 194, 'ECG reads V₁ − V₂', { 'text-anchor': 'middle', 'font-size': 12, fill: '#3c4663', 'font-family': 'Source Sans 3, sans-serif' });

    // (b) TENS: two skin electrodes, field lines dipping into tissue
    const s2 = document.getElementById('med-tens');
    el('rect', { x: 0, y: 70, width: 320, height: 130, fill: '#fbe9df' }, s2);
    el('rect', { x: 0, y: 130, width: 320, height: 70, fill: '#f4d6c8' }, s2);
    el('path', { d: 'M0 152 C80 146 160 160 320 150', stroke: '#d4891a', 'stroke-width': 3, fill: 'none' }, s2);
    txt(s2, 312, 172, 'nerve', { 'text-anchor': 'end', 'font-size': 12, fill: '#8a5a10', 'font-family': 'Source Sans 3, sans-serif' });
    txt(s2, 8, 88, 'skin', { 'font-size': 12, fill: '#8a6b5e', 'font-family': 'Source Sans 3, sans-serif' });
    const gl = el('g', { fill: 'none', stroke: 'rgba(45,79,163,.65)', 'stroke-width': 1.5 }, s2);
    [16, 30, 46, 64, 84].forEach((d, k) => {
      el('path', { d: `M${100 - k * 4} 72 C${100 - k * 4} ${72 + d * 1.6} ${220 + k * 4} ${72 + d * 1.6} ${220 + k * 4} 72`, 'stroke-dasharray': '5 4' }, gl);
    });
    [[80, '#c0402b', '+'], [210, '#2d4fa3', '−']].forEach(([x, c, s]) => {
      el('rect', { x, y: 58, width: 40, height: 14, rx: 4, fill: c }, s2);
      txt(s2, x + 20, 50, s, { 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: c, 'font-family': 'Sora, sans-serif' });
    });
    el('path', { d: 'M100 40 C100 18 230 18 230 40', fill: 'none', stroke: '#6a7186', 'stroke-width': 1.5 }, s2);
    el('rect', { x: 146, y: 8, width: 38, height: 22, rx: 5, fill: '#2a3047' }, s2);
    txt(s2, 165, 23, 'TENS', { 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#fff', 'font-family': 'Sora, sans-serif' });

    // (c) electrode edge effect: small dry electrode vs large gel pad
    const s3 = document.getElementById('med-electrode');
    function panel(x0, wPad, gel, label) {
      const cx = x0 + 75;
      el('rect', { x: x0, y: 70, width: 150, height: 110, fill: '#fbe9df' }, s3);
      if (gel) el('rect', { x: cx - wPad / 2 - 6, y: 62, width: wPad + 12, height: 9, rx: 4, fill: '#9cc7e6', opacity: .8 }, s3);
      el('rect', { x: cx - wPad / 2, y: 52, width: wPad, height: 10, rx: 3, fill: '#2d4fa3' }, s3);
      const g = el('g', { stroke: '#c0402b', 'stroke-width': 1.6, fill: 'none' }, s3);
      const n = 9;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1) * 2 - 1;
        const u = gel ? t : Math.sign(t) * Math.pow(Math.abs(t), 0.45);
        const sx0 = cx + u * wPad / 2, ex = cx + t * 66;
        el('path', { d: `M${sx0.toFixed(1)} 72 Q${(sx0 + (ex - sx0) * .3).toFixed(1)} 120 ${ex.toFixed(1)} 176` }, g);
      }
      if (!gel) [-1, 1].forEach(sg => el('circle', { cx: cx + sg * wPad / 2, cy: 72, r: 7, fill: 'rgba(212,137,26,.35)' }, s3));
      txt(s3, cx, 34, label, { 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 600, fill: '#1c2541', 'font-family': 'Source Sans 3, sans-serif' });
      txt(s3, cx, 196, gel ? 'even current' : 'hot spots at edges', { 'text-anchor': 'middle', 'font-size': 11.5, fill: gel ? '#2f7d5b' : '#8a5a10', 'font-family': 'Source Sans 3, sans-serif' });
    }
    panel(6, 40, false, 'Small, dry electrode');
    panel(164, 110, true, 'Large pad with gel');
  })();

  /* =====================================================================
     9. METHOD
     ===================================================================== */
  function markPoint(g, p, v, label) {
    const q = tmap(p), c = vColor(v);
    el('circle', { cx: q[0], cy: q[1], r: 6, fill: '#fff', stroke: c, 'stroke-width': 2.5 }, g);
    el('circle', { cx: q[0], cy: q[1], r: 2, fill: c }, g);
    if (label) txt(g, q[0] + 12, q[1] + 7, `(${fmt1(p[0])}, ${fmt1(p[1])})`, { 'font-size': 21, 'font-weight': 700, fill: c, class: 'hand' });
  }
  function drawReferenceLead(g, end) {
    const a = tmap([PLATE.neg.x, PLATE.neg.y0]);
    const BOT = TY0 + (TYT - TYB) * TS;
    const e = end || [640, BOT - 30];
    el('path', { d: `M${a[0]} ${a[1] + 2} C${a[0]} ${a[1] + 120} ${e[0] - 220} ${BOT + 10} ${e[0]} ${e[1]}`, fill: 'none', stroke: '#1c2541', 'stroke-width': 2.2 }, g);
    el('rect', { x: a[0] - 7, y: a[1] - 6, width: 14, height: 12, rx: 3, fill: '#1c2541' }, g);
  }
  function drawProbeGlyph(g, p, end) {
    const q = tmap(p), e = end || [652, TY0 + 70];
    el('path', { d: `M${q[0]} ${q[1]} C${q[0] + 120} ${q[1] - 70} ${e[0] + 40} ${e[1] - 160} ${e[0]} ${e[1]}`, fill: 'none', stroke: '#c0402b', 'stroke-width': 2.2 }, g);
    el('line', { x1: q[0], y1: q[1], x2: q[0] + 26, y2: q[1] - 26, stroke: '#1c2541', 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
    el('circle', { cx: q[0], cy: q[1], r: 4, fill: '#d4891a', stroke: '#1c2541', 'stroke-width': 1.5 }, g);
  }
  (function method() {
    const steps = Array.from(document.querySelectorAll('#method-steps .step'));
    const figs = Array.from(document.querySelectorAll('#step-figure .sf'));
    steps.forEach(b => b.addEventListener('click', () => {
      const k = +b.dataset.step;
      steps.forEach(s => s.setAttribute('aria-pressed', s === b ? 'true' : 'false'));
      figs.forEach(f => f.classList.toggle('active', +f.dataset.fig === k));
    }));
    const s1 = document.getElementById('fig-step1');
    const L1 = drawTrayBase(s1);
    const pp = [1.5, 2.5], pv = potential(pp[0], pp[1]);
    drawReferenceLead(L1.top, [548, 412]);
    drawProbeGlyph(L1.top, pp, [612, 368]);
    const meter = el('g', { transform: 'translate(580 402)' }, L1.top);
    el('rect', { x: -58, y: -34, width: 116, height: 64, rx: 10, fill: '#2a3047' }, meter);
    el('rect', { x: -48, y: -26, width: 96, height: 30, rx: 5, fill: '#c9d5bf' }, meter);
    txt(meter, 40, -4, fmtV(pv) + ' V', { 'text-anchor': 'end', 'font-size': 18, 'font-weight': 700, fill: '#1d2a1a', 'font-family': 'Sora, sans-serif' });
    txt(meter, 0, 22, 'voltmeter', { 'text-anchor': 'middle', 'font-size': 11, fill: '#b9c1d9', 'font-family': 'Sora, sans-serif' });
    const s2 = document.getElementById('fig-step2');
    const L2 = drawTrayBase(s2);
    WORKED[1].pts.forEach(p => markPoint(L2.marks, p, WORKED[1].v, true));
    const s3 = document.getElementById('fig-step3');
    const L3 = drawTrayBase(s3);
    WORKED.forEach(r => r.pts.forEach(p => markPoint(L3.marks, p, r.v, false)));
    WORKED.forEach((r, i) => { const t = tmap(r.pts[i % 2 ? 0 : 3]); txt(L3.marks, t[0], t[1] + (i % 2 ? 30 : -14), fmtLabel(r.v), { 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: vColor(r.v), class: 'hand' }); });
    const s4 = document.getElementById('fig-step4');
    const G = drawGraphBase(s4);
    WORKED.forEach(r => plotSet(G, r.v, r.pts));
  })();

  /* =====================================================================
     10. FORMULA — Coulomb's law explorer
     ===================================================================== */
  (function formula() {
    const K = 8.99e9;
    const q1s = document.getElementById('sl-q1'), q2s = document.getElementById('sl-q2'), rs = document.getElementById('sl-r');
    const o1 = document.getElementById('out-q1'), o2 = document.getElementById('out-q2'), orr = document.getElementById('out-r');
    const of = document.getElementById('co-f'), ok = document.getElementById('co-kind');
    const svg = document.getElementById('coulomb-svg'), fr = document.getElementById('fr-svg');
    const qfmt = q => (q > 0 ? '+' : q < 0 ? '−' : '') + Math.abs(q).toFixed(1) + ' μC';
    function fN(Fv) {
      if (Fv === 0) return '0 N';
      if (Fv >= 100) return Fv.toFixed(0) + ' N';
      if (Fv >= 1) return Fv.toFixed(2) + ' N';
      return Fv.toFixed(3) + ' N';
    }
    const force = (a, b, rcm) => K * Math.abs(a * b) * 1e-12 / Math.pow(rcm / 100, 2);
    function render() {
      const a = +q1s.value, b = +q2s.value, r = +rs.value;
      o1.textContent = qfmt(a); o2.textContent = qfmt(b); orr.textContent = r.toFixed(1) + ' cm';
      const Fv = force(a, b, r);
      of.textContent = fN(Fv);
      ok.textContent = Fv === 0 ? 'no force' : a * b > 0 ? 'repel' : 'attract';
      svg.innerHTML = '';
      el('line', { x1: 40, y1: 120, x2: 680, y2: 120, stroke: '#e4dccb', 'stroke-width': 2 }, svg);
      const half = 30 + r * 10;
      const x1 = 360 - half, x2 = 360 + half;
      el('line', { x1, y1: 186, x2, y2: 186, stroke: '#6a7186', 'stroke-width': 1.4 }, svg);
      [x1, x2].forEach(x => el('line', { x1: x, y1: 178, x2: x, y2: 194, stroke: '#6a7186', 'stroke-width': 1.4 }, svg));
      txt(svg, 360, 210, 'r = ' + r.toFixed(1) + ' cm', { 'text-anchor': 'middle', 'font-size': 14, fill: '#3c4663', 'font-family': 'Source Sans 3, sans-serif' });
      if (Fv > 0) {
        const L = 16 + 110 * Math.min(1, Math.max(0, (Math.log10(Fv) - Math.log10(0.05)) / (Math.log10(600) - Math.log10(0.05))));
        const rep = a * b > 0;
        [[x1, rep ? -1 : 1, a], [x2, rep ? 1 : -1, b]].forEach(([x, d, q]) => {
          const R = 14 + 2.4 * Math.abs(q);
          if (!rep) { // attraction arrows point inward; keep them short enough not to cross
            const room = Math.max(8, half - R - 22);
            const Ls = Math.min(L, room);
            const xs = x + d * (R + 4), xe = xs + d * Ls;
            el('line', { x1: xs, y1: 120, x2: xe, y2: 120, stroke: '#d4891a', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
            el('path', { d: `M${xe + d * 10} 120 L${xe - d * 2} 112 L${xe - d * 2} 128 Z`, fill: '#d4891a' }, svg);
          } else {
            const room = (d < 0 ? x : 720 - x) - R - 4 - 22;
            const xs = x + d * (R + 4), xe = xs + d * Math.min(L, room);
            el('line', { x1: xs, y1: 120, x2: xe, y2: 120, stroke: '#d4891a', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
            el('path', { d: `M${xe + d * 10} 120 L${xe - d * 2} 112 L${xe - d * 2} 128 Z`, fill: '#d4891a' }, svg);
          }
        });
      }
      [[x1, a], [x2, b]].forEach(([x, q]) => {
        const R = 14 + 2.4 * Math.abs(q), c = q > 0 ? '#c0402b' : q < 0 ? '#2d4fa3' : '#9aa0b0';
        el('circle', { cx: x, cy: 120, r: R, fill: c }, svg);
        txt(svg, x, 126, q > 0 ? '+' : q < 0 ? '−' : '0', { 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: '#fff', 'font-family': 'Sora, sans-serif' });
        txt(svg, x, 120 - R - 12, qfmt(q), { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: c, 'font-family': 'Sora, sans-serif' });
      });
      txt(svg, 712, 20, 'arrow length on a log scale', { 'text-anchor': 'end', 'font-size': 11.5, 'font-style': 'italic', fill: '#6a7186', 'font-family': 'Source Sans 3, sans-serif' });
      // F–r plot
      fr.innerHTML = '';
      const X0 = 90, Y0 = 46, PW = 500, PH = 190, rmin = 2, rmax = 20;
      const qq = Math.abs(a * b);
      const Fmax = qq ? force(a, b, rmin) : 1;
      const px = rr => X0 + (rr - rmin) / (rmax - rmin) * PW, py = f => Y0 + PH - f / Fmax * PH;
      const g = el('g', { stroke: '#ece6d8', 'stroke-width': 1 }, fr);
      for (let k = 0; k <= 4; k++) el('line', { x1: X0, y1: Y0 + k * PH / 4, x2: X0 + PW, y2: Y0 + k * PH / 4 }, g);
      for (let rr = 2; rr <= 20; rr += 2) el('line', { x1: px(rr), y1: Y0, x2: px(rr), y2: Y0 + PH }, g);
      el('line', { x1: X0, y1: Y0 + PH, x2: X0 + PW + 12, y2: Y0 + PH, stroke: '#1c2541', 'stroke-width': 1.6 }, fr);
      el('line', { x1: X0, y1: Y0 + PH, x2: X0, y2: Y0 - 10, stroke: '#1c2541', 'stroke-width': 1.6 }, fr);
      const lab = el('g', { 'font-size': 13, fill: '#3c4663', 'font-family': 'Source Sans 3, sans-serif' }, fr);
      for (let rr = 2; rr <= 20; rr += 2) txt(lab, px(rr), Y0 + PH + 20, String(rr), { 'text-anchor': 'middle' });
      if (qq) txt(lab, X0 - 10, Y0 + 5, fN(Fmax).replace(' N', ''), { 'text-anchor': 'end' });
      txt(lab, X0 - 10, Y0 + PH + 5, '0', { 'text-anchor': 'end' });
      const ax = el('g', { 'font-size': 14, 'font-weight': 600, fill: '#1c2541', 'font-family': 'Sora, sans-serif' }, fr);
      txt(ax, X0 + PW + 12, Y0 + PH + 46, 'r (cm) →', { 'text-anchor': 'end' });
      txt(ax, X0, Y0 - 20, 'F (N)', { 'text-anchor': 'middle' });
      if (qq) {
        let d = '';
        for (let rr = rmin; rr <= rmax + 1e-9; rr += 0.25) d += (d ? 'L' : 'M') + px(rr).toFixed(1) + ' ' + py(force(a, b, rr)).toFixed(1);
        el('path', { d, fill: 'none', stroke: '#2d4fa3', 'stroke-width': 2.5 }, fr);
        const mk = (rr, label) => {
          const X = px(rr), Y = py(force(a, b, rr));
          el('line', { x1: X, y1: Y, x2: X, y2: Y0 + PH, stroke: '#d4891a', 'stroke-width': 1.3, 'stroke-dasharray': '4 4' }, fr);
          el('circle', { cx: X, cy: Y, r: 6, fill: '#d4891a', stroke: '#fff', 'stroke-width': 2 }, fr);
          const right = X > X0 + PW * 0.8;
          txt(fr, right ? X - 10 : X + 10, Y - 12, label, { 'text-anchor': right ? 'end' : 'start', 'font-size': 14, 'font-weight': 700, fill: '#8a5a10', 'font-family': 'Sora, sans-serif' });
        };
        mk(r, 'F');
        if (2 * r <= rmax) mk(2 * r, 'F ÷ 4 at 2r');
      } else {
        txt(fr, X0 + PW / 2, Y0 + PH / 2, 'F = 0 when either charge is zero', { 'text-anchor': 'middle', 'font-size': 15, fill: '#6a7186', 'font-family': 'Source Sans 3, sans-serif' });
      }
    }
    [q1s, q2s, rs].forEach(s => s.addEventListener('input', render));
    render();
  })();

  /* =====================================================================
     11. OBSERVATION — worked example
     ===================================================================== */
  (function observation() {
    const tb = document.querySelector('#obs-table tbody');
    WORKED.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><span class="vtag"><i style="background:${vColor(r.v)}"></i>${fmtT(r.v)}</span></td>` +
        r.pts.map(p => `<td>(${fmt1(p[0])}, ${fmt1(p[1])})</td>`).join('');
      tb.appendChild(tr);
    });
    const G = drawGraphBase(document.getElementById('obs-graph'));
    WORKED.forEach(r => plotSet(G, r.v, r.pts));
  })();

  /* =====================================================================
     12. MCQs
     ===================================================================== */
  const MCQ = [
    { q: 'What is the aim of this experiment?', a: 'To map equipotential lines in an electric field', o: ['To measure the charge on each plate', 'To measure the resistance of the conducting solution', 'To find the emf of the battery'],
      hint: 'Look back at the first page: the experiment is about drawing lines.', ex: 'The aim is to map equipotential lines in an electric field by finding and plotting points of equal potential.' },
    { q: 'An equipotential line joins points that have the same…', a: 'electric potential', o: ['electric field strength', 'charge', 'distance from the battery'],
      hint: 'The word itself is the clue: equi- (equal) + potential.', ex: 'Every point on an equipotential line is at the same potential, so a voltmeter reads the same value all along it.' },
    { q: 'How much work is done moving a charge along an equipotential line?', a: 'Zero', o: ['It depends on the charge only', 'The maximum possible amount', 'An amount equal to the battery voltage'],
      hint: 'Work = q × ΔV. What is ΔV along the line?', ex: 'ΔV = 0 along an equipotential, so W = qΔV = 0.' },
    { q: 'At what angle do field lines cross equipotential lines?', a: '90°', o: ['0°', '45°', '180°'],
      hint: 'If the field had a component along the line, moving along it would need work.', ex: 'Field lines are always perpendicular to equipotential lines.' },
    { q: 'In this lab, where is one voltmeter probe kept fixed?', a: 'On one of the charge plates', o: ['On the battery case', 'In the middle of the solution', 'Outside the tray'],
      hint: 'Method step 2.', ex: 'One probe stays on a charge plate (the reference); the other probe is moved to measure the potential inside.' },
    { q: 'What do the charge plates sit in during the experiment?', a: 'A conducting solution', o: ['Dry sand', 'Air only', 'An insulating oil'],
      hint: 'The probe needs a medium that carries a small current.', ex: 'The plates are placed in a conducting solution so the potential can be measured at any point in it.' },
    { q: 'What does the moving probe actually measure?', a: 'The potential difference between that point and the reference plate', o: ['The current from the battery', 'The charge at that point', 'The resistance of the plate'],
      hint: 'A voltmeter always compares two points.', ex: 'The voltmeter reads the potential difference between the probe tip and the plate the other lead is connected to.' },
    { q: 'Following the method, how many different potential values are mapped in total?', a: 'Four', o: ['One', 'Two', 'Ten'],
      hint: 'One value first, then "three other values".', ex: 'One value is mapped first, then three other values are chosen: four equipotential lines, four rows in the table.' },
    { q: 'In the observation table, one row contains…', a: 'the coordinates of points that share one potential value', o: ['four different potentials at one point', 'the battery voltage at four times', 'the current through four resistors'],
      hint: 'The first column is V; the rest are (X, Y) pairs.', ex: 'Each row is one equipotential line: a voltage V and the (X, Y) positions of points at that voltage.' },
    { q: "According to Coulomb's law, the force between two charges is proportional to…", a: 'q₁q₂ / r²', o: ['q₁ + q₂', 'q₁q₂ × r', 'r² / q₁q₂'],
      hint: 'Force grows with the charges and falls with the distance squared.', ex: 'F ∝ q₁q₂ / r², or F = k q₁q₂ / r² with k ≈ 8.99 × 10⁹ N·m²/C².' },
    { q: 'If the distance between two charges is doubled, the force becomes…', a: 'one quarter of the original', o: ['half of the original', 'twice the original', 'four times the original'],
      hint: 'Inverse square: what is 2²?', ex: 'F ∝ 1/r², so doubling r divides F by 2² = 4.' },
    { q: 'What is the SI unit of electric charge?', a: 'Coulomb (C)', o: ['Volt (V)', 'Ampere (A)', 'Newton (N)'],
      hint: 'It shares its name with the law on the Formula page.', ex: 'Charge is measured in coulombs (C).' },
    { q: 'Where equipotential lines are drawn closer together, the electric field is…', a: 'stronger', o: ['weaker', 'zero', 'unchanged'],
      hint: 'Think E ≈ ΔV / Δd.', ex: 'The same ΔV over a smaller distance means a larger field: E ≈ ΔV / Δd.' },
    { q: 'Why can two equipotential lines never cross?', a: 'A point cannot have two different potentials', o: ['Field lines would block them', 'The voltmeter cannot read there', 'The solution would short-circuit'],
      hint: 'What would the voltmeter read at the crossing point?', ex: 'At a crossing point the potential would have two values at once, which is impossible.' },
    { q: 'In this setup, the equipotential lines between 1.7 V and 2.2 V on the board…', a: 'curve gently around the plate they are closer to', o: ['are circles centred on the origin', 'run parallel to the x-axis', 'cross each other near the centre'],
      hint: 'Look at the shape of the 1.8 V and 2.1 V lines in the example graph.', ex: 'Each line bows around the nearer plate; only the 1.95 V line through the middle (x = 0) is straight.' },
    { q: 'With a 3.9 V supply and the reference on the − plate, the centre of the board (0, 0), midway between the plates, reads about…', a: '1.95 V', o: ['0 V', '3.9 V', '7.8 V'],
      hint: 'The potential rises from 0 V at one plate to 3.9 V at the other.', ex: 'By symmetry, the centre line x = 0 is the 1.95 V equipotential, half of the 3.9 V supply.' },
    { q: 'The electric field points from…', a: 'higher potential to lower potential', o: ['lower potential to higher potential', 'one point to another along an equipotential', 'the voltmeter to the battery'],
      hint: 'A positive charge moves "downhill" in potential.', ex: 'Field lines run from the + plate (high potential) to the − plate (low potential).' },
    { q: 'What does a defibrillator do?', a: 'Delivers a high-energy electric shock to the heart', o: ['Measures blood pressure', 'Records brain waves', 'Supplies oxygen to the lungs'],
      hint: 'See the photo on the Medical perspectives page.', ex: 'A defibrillator delivers a high-energy shock to the heart to reset an abnormal rhythm.' },
    { q: 'Why does pad placement matter in defibrillation?', a: 'The field lines between the pads must pass through the heart muscle', o: ['Pads only work on the back', 'The shock must avoid the heart', 'Placement only changes the sound of the device'],
      hint: 'Current follows the field between the pads.', ex: 'Pads are placed so the field (and current) between them crosses enough heart muscle to depolarise it at once.' },
    { q: 'Why are medical electrodes often made larger and used with conductive gel?', a: 'To spread current evenly and avoid hot spots at the edges', o: ['To increase the battery voltage', 'To block the electric field', 'To make the field lines cross'],
      hint: 'Field lines crowd at the edges of small electrodes.', ex: 'Current density is highest at electrode edges; larger pads and gel spread it out, lowering burn risk and signal noise.' }
  ];
  (function mcq() {
    const list = document.getElementById('mcq-list');
    const score = document.getElementById('mcq-score');
    let solved = 0;
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function updScore() { score.textContent = `${solved} of ${MCQ.length} correct`; }
    function render() {
      solved = 0; list.innerHTML = '';
      MCQ.forEach((m, qi) => {
        const li = document.createElement('li'); li.className = 'mcq';
        let opts = shuffle([m.a].concat(m.o));
        li.innerHTML = `<p class="mcq-q"><span class="mcq-n">${qi + 1}.</span><span></span></p><div class="mcq-opts"></div><div class="mcq-fb" aria-live="polite"></div>`;
        li.querySelector('.mcq-q span:last-child').textContent = m.q;
        const box = li.querySelector('.mcq-opts'), fb = li.querySelector('.mcq-fb');
        opts.forEach(o => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.textContent = o;
          b.addEventListener('click', () => {
            if (li.classList.contains('solved')) return;
            if (o === m.a) {
              b.classList.remove('wrong'); b.classList.add('right'); li.classList.add('solved');
              box.querySelectorAll('.opt').forEach(x => { x.disabled = true; x.classList.remove('wrong'); });
              fb.className = 'mcq-fb show explain'; fb.textContent = m.ex;
              solved++; updScore();
            } else {
              b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
              fb.className = 'mcq-fb show hint'; fb.textContent = 'Not quite. ' + m.hint;
            }
          });
          box.appendChild(b);
        });
        list.appendChild(li);
      });
      updScore();
    }
    document.getElementById('mcq-reset').addEventListener('click', render);
    render();
  })();

  /* =====================================================================
     13. PRACTICAL
     ===================================================================== */
  (function practical() {
    const tray = document.getElementById('tray');
    const graph = document.getElementById('pr-graph');
    const table = document.getElementById('pr-table');
    const tbody = table.querySelector('tbody');
    const dmmVal = document.getElementById('dmm-val');
    const scale = document.getElementById('dmm-scale');
    const tbT = document.getElementById('tb-target'), tbD = document.getElementById('tb-diff'), msg = document.getElementById('tb-msg');
    const bEq = document.getElementById('pr-true-eq'), bFl = document.getElementById('pr-true-fl');
    const btnAdd = document.getElementById('pr-add-row');
    const DEFAULT_TARGETS = [1.8, 1.9, 2.0, 2.1];
    const MAX_ROWS = 6, TOL = 0.02;
    const blankPt = () => ({ x: '', y: '', ax: false, ay: false });
    const blankRow = v => ({ v: v == null ? '' : String(v), p: [blankPt(), blankPt(), blankPt(), blankPt()] });
    let rows = [], active = 0, probe = null, tutLinesHidden = false;

    const L = drawTrayBase(tray);
    drawReferenceLead(L.under);
    const probeG = el('g', { style: 'display:none', 'pointer-events': 'none' }, L.top);
    const wire = el('path', { fill: 'none', stroke: '#c0402b', 'stroke-width': 2.2 }, probeG);
    const ring = el('circle', { r: 7, fill: 'none', stroke: '#1c2541', 'stroke-width': 2 }, probeG);
    const dotP = el('circle', { r: 2.5, fill: '#d4891a' }, probeG);
    el('rect', { x: TX0, y: TY0, width: (TXR - TXL) * TS, height: (TYT - TYB) * TS, fill: 'transparent' }, tray);

    (function buildScale() {
      const cx = 120, cy = 66, R = 54, FS = 4;
      const ang = v => Math.PI * (1 - v / FS);
      el('path', { d: `M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}`, fill: 'none', stroke: '#59607a', 'stroke-width': 2 }, scale);
      for (let k = 0; k <= FS * 10; k++) {
        const v = k / 10, a = ang(v), major = k % 10 === 0, half = k % 5 === 0;
        const r1 = major ? R - 9 : half ? R - 6 : R - 3.5;
        el('line', { x1: cx + R * Math.cos(a), y1: cy - R * Math.sin(a), x2: cx + r1 * Math.cos(a), y2: cy - r1 * Math.sin(a), stroke: '#b9c1d9', 'stroke-width': major ? 1.6 : half ? 1.1 : .6 }, scale);
        if (major) txt(scale, cx + (R + 9) * Math.cos(a), cy - (R + 9) * Math.sin(a) + 3, String(v), { 'text-anchor': 'middle', 'font-size': 9, fill: '#b9c1d9', 'font-family': 'Sora, sans-serif' });
      }
      const tgt = el('line', { x1: cx, y1: cy, x2: cx, y2: cy, stroke: '#d4891a', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, scale);
      const needle = el('line', { x1: cx, y1: cy, x2: cx - R + 12, y2: cy, stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, scale);
      el('circle', { cx, cy, r: 4, fill: '#fff' }, scale);
      scale._set = (v, t) => {
        const a = ang(Math.max(0, Math.min(FS, v))), r = R - 12;
        needle.setAttribute('x2', cx + r * Math.cos(a)); needle.setAttribute('y2', cy - r * Math.sin(a));
        if (t == null) { tgt.setAttribute('opacity', 0); return; }
        const b = ang(t);
        tgt.setAttribute('opacity', .9);
        tgt.setAttribute('x1', cx + (R - 4) * Math.cos(b)); tgt.setAttribute('y1', cy - (R - 4) * Math.sin(b));
        tgt.setAttribute('x2', cx + (R + 3) * Math.cos(b)); tgt.setAttribute('y2', cy - (R + 3) * Math.sin(b));
      };
    })();

    /* ---------- table model ---------- */
    const num = s => { const t = String(s == null ? '' : s).trim().replace(/[\u2212\u2013]/g, '-').replace(',', '.'); return t === '' ? null : (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? +t : NaN); };
    const isBlank = s => String(s == null ? '' : s).trim() === '';
    function rowV(r) { const v = num(rows[r] && rows[r].v); return v != null && Number.isFinite(v) && v >= VMIN - 1e-9 && v <= VMAX + 1e-9 ? v : null; }
    function ptXY(pt) { const x = num(pt.x), y = num(pt.y); return x != null && y != null && Number.isFinite(x) && Number.isFinite(y) ? [Math.max(-BOARD, Math.min(BOARD, x)), Math.max(-BOARD, Math.min(BOARD, y))] : null; }
    const rowPts = r => rows[r].p.map(ptXY).filter(Boolean);
    function say(text, kind) { msg.textContent = text; msg.className = 'tb-msg' + (kind ? ' ' + kind : ''); }
    const RANGE_HINT = 'Target voltages for this setup run from 1.7 to 2.2 V.';
    const XY_HINT = 'x and y run from −5 to +5 cm, measured from the centre of the board.';

    function buildTable() {
      tbody.innerHTML = '';
      rows.forEach((row, r) => {
        const tr = document.createElement('tr'); tr.dataset.r = r;
        let h = `<td class="vcell"><span class="vbox"><i class="vdot"></i><input class="vin" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="1.7–2.2" aria-label="Voltage, row ${r + 1}"></span></td>`;
        for (let k = 0; k < 4; k++) {
          h += `<td class="pcell"><span class="pair">(<input class="cin" data-k="${k}" data-c="x" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="x${k + 1}, row ${r + 1}">,` +
               `<input class="cin" data-k="${k}" data-c="y" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="y${k + 1}, row ${r + 1}">)</span></td>`;
        }
        h += `<td class="rcell"><button type="button" class="row-del" aria-label="Remove row ${r + 1}" title="Remove row">×</button></td>`;
        tr.innerHTML = h;
        tbody.appendChild(tr);
      });
      syncInputs();
    }
    const trOf = r => tbody.children[r];
    const vInput = r => trOf(r).querySelector('.vin');
    const cInput = (r, k, c) => trOf(r).querySelector(`.cin[data-k="${k}"][data-c="${c}"]`);
    function syncInputs() {
      rows.forEach((row, r) => {
        const tr = trOf(r); if (!tr) return;
        const vi = tr.querySelector('.vin'); if (vi.value !== row.v) vi.value = row.v;
        row.p.forEach((pt, k) => ['x', 'y'].forEach(c => {
          const inp = cInput(r, k, c); if (inp.value !== pt[c]) inp.value = pt[c];
          inp.classList.toggle('auto', !!pt['a' + c]);
        }));
      });
      decorate();
    }
    function decorate() {
      rows.forEach((row, r) => {
        const tr = trOf(r); if (!tr) return;
        const v = rowV(r), raw = num(row.v);
        tr.classList.toggle('active', r === active);
        tr.querySelector('.vdot').style.background = v == null ? 'transparent' : vColor(v);
        tr.querySelector('.vin').classList.toggle('flag', !isBlank(row.v) && v == null);
        row.p.forEach((pt, k) => {
          const xy = ptXY(pt), span = cInput(r, k, 'x').parentNode;
          const off = v != null && xy && Math.abs(potential(xy[0], xy[1]) - v) > TOL;
          span.classList.toggle('off', !!off);
          span.title = off ? `This point reads ${fmtV(potential(xy[0], xy[1]))} V` : '';
        });
        if (raw == null) tr.querySelector('.vin').title = '';
      });
      tbody.querySelectorAll('.row-del').forEach(b => { b.disabled = rows.length <= 1; });
      if (btnAdd) btnAdd.disabled = rows.length >= MAX_ROWS;
    }
    const showEq = () => bEq.getAttribute('aria-pressed') === 'true';
    const showFl = () => bFl.getAttribute('aria-pressed') === 'true';
    const validRows = () => rows.map((_, r) => r).filter(r => rowV(r) != null);
    function renderTrayMarks() {
      L.marks.innerHTML = ''; L.lines.innerHTML = '';
      if (showFl()) drawFieldLinesSVG(L.lines, tmap, { stroke: 'rgba(212,137,26,.8)', 'stroke-width': 1.6, 'stroke-dasharray': '6 5' }, true);
      const vs = [...new Set(validRows().map(rowV))];
      if (showEq()) vs.forEach(v => drawContoursSVG(L.lines, v, tmap, { stroke: vColor(v, .75), 'stroke-width': 2.2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }));
      validRows().forEach(r => rowPts(r).forEach(p => {
        const q = tmap(p), c = vColor(rowV(r));
        el('path', { d: `M${q[0] - 6} ${q[1] - 6}L${q[0] + 6} ${q[1] + 6}M${q[0] + 6} ${q[1] - 6}L${q[0] - 6} ${q[1] + 6}`, stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round' }, L.marks);
      }));
    }
    function renderGraph() {
      const G = drawGraphBase(graph);
      if (showFl()) drawFieldLinesSVG(G.under, gmap, { stroke: 'rgba(212,137,26,.75)', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }, true);
      const vs = [...new Set(validRows().map(rowV))];
      if (showEq()) vs.forEach(v => drawContoursSVG(G.under, v, gmap, { stroke: vColor(v, .6), 'stroke-width': 2.2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }));
      validRows().forEach(r => { const ps = rowPts(r); if (ps.length) plotSet(G, rowV(r), ps); });
      if (tutLinesHidden) G.lines.setAttribute('opacity', 0);
    }
    function updateMeter() {
      const t = rows[active] ? rowV(active) : null;
      tbT.textContent = t == null ? 'enter a voltage' : fmtLabel(t);
      if (!probe) {
        dmmVal.textContent = '– – –'; tbD.textContent = '—'; tbD.className = ''; scale._set(0, t);
        probeG.style.display = 'none'; return;
      }
      const v = potential(probe[0], probe[1]);
      dmmVal.textContent = fmtV(v);
      scale._set(v, t);
      probeG.style.display = '';
      const q = tmap(probe);
      ring.setAttribute('cx', q[0]); ring.setAttribute('cy', q[1]); dotP.setAttribute('cx', q[0]); dotP.setAttribute('cy', q[1]);
      wire.setAttribute('d', `M${q[0]} ${q[1]} C${q[0] + 50} ${q[1] - 60} 560 ${TY0 - 10} 655 ${TY0 + 40}`);
      if (t != null) {
        const d = v - t, on = Math.abs(d) <= TOL;
        tbD.textContent = (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2) + ' V';
        tbD.className = on ? 'ok' : '';
        if (!tut.on) setReading('tray', fmtV(v) + ' V', on);
      } else { tbD.textContent = '—'; tbD.className = ''; if (!tut.on) setReading('tray', fmtV(v) + ' V', false); }
    }
    function refresh() { decorate(); renderTrayMarks(); renderGraph(); updateMeter(); }
    function setActive(r) { if (r !== active && rows[r]) { active = r; decorate(); updateMeter(); } }

    /* ---------- autofill from the field model ---------- */
    const GRID_Y = []; for (let y = -4.5; y <= 4.5 + 1e-9; y += 0.5) GRID_Y.push(Math.round(y * 10) / 10);
    function pickYs(v, used, n) {               // spread n new y values, bases first, never close to used ones
      const out = [], taken = used.slice();
      const md = y => taken.length ? Math.min(...taken.map(u => Math.abs(u - y))) : Infinity;
      for (const pool of [SPREAD_Y, GRID_Y]) {
        while (out.length < n) {
          let best = null, bd = 0.75 - 1e-9;
          for (const y of pool) { if (locateX(v, y) == null) continue; const d = md(y); if (d > bd) { bd = d; best = y; } }
          if (best == null) break;
          out.push(best); taken.push(best);
        }
      }
      return out.sort((a, b) => a - b);
    }
    function fillRow(r) {
      const v = rowV(r); if (v == null) return 0;
      const row = rows[r];
      const empties = row.p.map((pt, k) => k).filter(k => isBlank(row.p[k].x) && isBlank(row.p[k].y));
      if (!empties.length) return 0;
      const used = row.p.map(pt => num(pt.y)).filter(y => y != null && Number.isFinite(y));
      const ys = pickYs(v, used, empties.length);
      ys.forEach((y, i) => {
        const pt = row.p[empties[i]];
        pt.x = fmt1(locateX(v, y)); pt.y = fmt1(y); pt.ax = true; pt.ay = true;
      });
      syncInputs(); refresh();
      return ys.length;
    }
    function clampCell(r, k, c) {
      const pt = rows[r].p[k], n = num(pt[c]);
      if (n == null) return true;
      if (!Number.isFinite(n)) { say('Enter a number for x and y, for example −1.5. ' + XY_HINT, ''); return false; }
      if (Math.abs(n) > BOARD + 1e-9) { pt[c] = fmt1(Math.sign(n) * BOARD); cInput(r, k, c).value = pt[c]; say(XY_HINT + ' The value was limited to the board edge.', ''); }
      return true;
    }
    function onEnter(r, k, c) {
      const v = rowV(r);
      if (k == null) {                          // Enter in the voltage cell
        if (v == null) { say(isBlank(rows[r].v) ? 'Enter a target voltage first. ' + RANGE_HINT : RANGE_HINT, ''); return; }
        const n = fillRow(r);
        say(n ? `Filled ${n} point${n === 1 ? '' : 's'} on the ${fmtLabel(v)} line from the field model.` : `The ${fmtLabel(v)} row already has four points.`, n ? 'good' : '');
        return;
      }
      clampCell(r, k, c);
      if (v == null) { say('Set this row’s voltage first. ' + RANGE_HINT, ''); return; }
      const pts = rows[r].p.map(ptXY), have = pts.filter(Boolean);
      const allBlank = rows[r].p.every(pt => isBlank(pt.x) && isBlank(pt.y));
      if (!have.length && !allBlank) { say('Enter both x and y for the point, then press Enter.', ''); return; }
      const n = fillRow(r);
      if (!n) { say(`The ${fmtLabel(v)} row already has four points.`, ''); return; }
      const own = pts[k];
      const off = own && Math.abs(potential(own[0], own[1]) - v) > TOL;
      say(off ? `(${fmt1(own[0])}, ${fmt1(own[1])}) reads ${fmtV(potential(own[0], own[1]))} V, so it is off the ${fmtLabel(v)} line. The filled points follow the ${fmtLabel(v)} line from the field model.`
              : `Filled ${n} point${n === 1 ? '' : 's'} on the ${fmtLabel(v)} line from the field model.`, off ? '' : 'good');
    }
    tbody.addEventListener('focusin', e => { const tr = e.target.closest('tr'); if (tr) setActive(+tr.dataset.r); });
    tbody.addEventListener('input', e => {
      const t = e.target, tr = t.closest('tr'); if (!tr) return;
      const r = +tr.dataset.r;
      if (t.classList.contains('vin')) { rows[r].v = t.value; }
      else if (t.classList.contains('cin')) {
        const pt = rows[r].p[+t.dataset.k], c = t.dataset.c;
        pt[c] = t.value; pt['a' + c] = false; t.classList.remove('auto');
      } else return;
      refresh();
    });
    tbody.addEventListener('change', e => {
      const t = e.target, tr = t.closest('tr'); if (!tr) return;
      const r = +tr.dataset.r;
      if (t.classList.contains('vin')) { if (!isBlank(rows[r].v) && rowV(r) == null) say(RANGE_HINT, ''); }
      else if (t.classList.contains('cin')) { clampCell(r, +t.dataset.k, t.dataset.c); refresh(); }
    });
    tbody.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing) return;
      const t = e.target, tr = t.closest('tr'); if (!tr) return;
      e.preventDefault();
      const r = +tr.dataset.r;
      if (t.classList.contains('vin')) onEnter(r, null, null);
      else if (t.classList.contains('cin')) onEnter(r, +t.dataset.k, t.dataset.c);
    });
    tbody.addEventListener('click', e => {
      const b = e.target.closest('.row-del'); if (!b || rows.length <= 1) return;
      const r = +b.closest('tr').dataset.r;
      rows.splice(r, 1); if (active >= rows.length) active = rows.length - 1; else if (active > r) active--;
      buildTable(); refresh(); say('Row removed.', '');
    });
    if (btnAdd) btnAdd.addEventListener('click', () => {
      if (rows.length >= MAX_ROWS) return;
      rows.push(blankRow()); active = rows.length - 1; buildTable(); refresh();
      vInput(active).focus();
    });

    /* ---------- probe on the tray ---------- */
    function toCm(e) {
      const pt = tray.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const s = pt.matrixTransform(tray.getScreenCTM().inverse());
      return [TXL + (s.x - TX0) / TS, TYT - (s.y - TY0) / TS];
    }
    const inside = p => Math.abs(p[0]) <= BOARD && Math.abs(p[1]) <= BOARD;
    function nextOpenRow(from) {
      for (let i = 1; i <= rows.length; i++) {
        const r = (from + i) % rows.length;
        if (rowV(r) != null && rows[r].p.some(pt => isBlank(pt.x) && isBlank(pt.y))) return r;
      }
      return null;
    }
    function record(p) {
      const r = active, t = rowV(r);
      if (t == null) { say('Enter a target voltage in the highlighted row first. ' + RANGE_HINT, ''); return false; }
      const x = Math.round(p[0] * 10) / 10, y = Math.round(p[1] * 10) / 10;
      const v = potential(x, y), d = v - t;
      if (Math.abs(d) > TOL) {
        say(`${fmtV(v)} V is ${Math.abs(d).toFixed(2)} V ${d > 0 ? 'above' : 'below'} the ${fmtLabel(t)} target. Move toward the ${d > 0 ? '− plate (left)' : '+ plate (right)'}.`, 'warn');
        return false;
      }
      const row = rows[r];
      const k = row.p.findIndex(pt => isBlank(pt.x) && isBlank(pt.y));
      if (k < 0) { say('All four points in this row are filled. Clear a cell or choose another row.', 'warn'); return false; }
      if (rowPts(r).some(q => Math.hypot(q[0] - x, q[1] - y) < 0.5)) { say('There is already a point close to this one. Spread the points along the line.', 'warn'); return false; }
      Object.assign(row.p[k], { x: fmt1(x), y: fmt1(y), ax: false, ay: false });
      const full = row.p.every(pt => !isBlank(pt.x) || !isBlank(pt.y));
      syncInputs();
      if (full) {
        const nx = nextOpenRow(r);
        if (nx != null) { active = nx; say(`Recorded (${fmt1(x)}, ${fmt1(y)}). The ${fmtLabel(t)} row is full; next, the ${fmtLabel(rowV(nx))} row.`, 'good'); }
        else say(`Recorded (${fmt1(x)}, ${fmt1(y)}). Every row is full; compare the lines with the true equipotentials.`, 'good');
      } else say(`Recorded (${fmt1(x)}, ${fmt1(y)}) at ${fmtV(v)} V.`, 'good');
      refresh();
      return true;
    }
    let downAt = null;
    tray.addEventListener('pointermove', e => {
      const p = toCm(e);
      probe = inside(p) ? p : null;
      if (!probe) setReading('tray', null);
      updateMeter();
    });
    tray.addEventListener('pointerleave', () => { probe = null; setReading('tray', null); updateMeter(); });
    tray.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; const p = toCm(e); if (inside(p)) { probe = p; updateMeter(); } });
    tray.addEventListener('pointerup', e => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      downAt = null;
      const p = toCm(e);
      if (moved < 8 && inside(p)) record(p);
    });
    [bEq, bFl].forEach(b => b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      renderTrayMarks(); renderGraph();
    }));
    function reset() {
      rows = [blankRow(), blankRow(), blankRow(), blankRow()];
      active = 0; probe = null;
      bEq.setAttribute('aria-pressed', 'false'); bFl.setAttribute('aria-pressed', 'false');
      buildTable();
      say('Enter target voltages (1.7 to 2.2 V) in the table, then record points with the probe or press Enter in a row to fill it from the field model.', '');
      refresh();
    }

    /* ---------- guided tutorial ---------- */
    const tut = { on: false, cancel: false, skip: false };
    const bar = document.getElementById('tut-bar'), tTitle = document.getElementById('tut-title'), tText = document.getElementById('tut-text'), tF = document.getElementById('tut-f');
    const btnTut = document.getElementById('tut-start'), btnPause = document.getElementById('tut-pause'), selSpeed = document.getElementById('tut-speed');
    const STOP = new Error('tutorial-stop');
    const tutL = el('g', { 'pointer-events': 'none' }, L.top);
    let pausedAnims = [];
    function setPaused(p) {
      tcSet({ paused: p });
      btnPause.classList.toggle('paused', p); btnPause.setAttribute('aria-pressed', p ? 'true' : 'false');
      btnPause.querySelector('.tl').textContent = p ? 'Resume' : 'Pause';
      btnPause.title = p ? 'Resume (Space)' : 'Pause (Space)';
      document.body.classList.toggle('tut-paused', p);
      if (p) { pausedAnims = document.getAnimations().filter(a => a.playState === 'running'); pausedAnims.forEach(a => a.pause()); }
      else { pausedAnims.forEach(a => { try { a.play(); } catch (_) { /* finished */ } }); pausedAnims = []; }
    }
    function resetPlayback() { setPaused(false); tcSet({ speed: 1 }); selSpeed.value = '1'; }
    btnPause.addEventListener('click', () => { if (tut.on) setPaused(!TC.paused); });
    selSpeed.addEventListener('change', () => { tcSet({ speed: +selSpeed.value || 1 }); });
    document.addEventListener('keydown', e => {
      if (!tut.on || e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input, select, textarea, button, a, [role="button"], [tabindex]')) return;
      e.preventDefault(); setPaused(!TC.paused);
    });
    const frame = () => new Promise(r => requestAnimationFrame(() => r()));
    function wait(ms) {
      return new Promise((res, rej) => {
        const t0 = tnow();
        (function w() { if (tut.cancel) return rej(STOP); if (tut.skip || tnow() - t0 >= ms) return res(); setTimeout(w, 25); })();
      });
    }
    async function anim(ms, fn) {             // eased 0 → 1 on the tutorial clock
      const t0 = tnow();
      for (;;) {
        if (tut.cancel) throw STOP;
        let k = Math.min(1, (tnow() - t0) / ms); if (tut.skip) k = 1;
        fn(k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
        if (k >= 1) return;
        await frame();
      }
    }
    function step(title, text, f) { tut.skip = false; tTitle.textContent = title; tText.textContent = text; tF.textContent = f || ''; }
    let hiEls = [];
    function hi(...els) { hiEls.forEach(e => e.classList.remove('tut-hi')); hiEls = els.filter(Boolean); hiEls.forEach(e => e.classList.add('tut-hi')); }
    async function scrollToEl(elm) {
      const r = elm.getBoundingClientRect();
      const y = Math.max(0, window.scrollY + r.top - Math.max(60, (window.innerHeight - Math.min(r.height, window.innerHeight - 220)) / 2 - 80));
      const y0 = window.scrollY;
      await anim(Math.min(900, 250 + Math.abs(y - y0) * .5), e => window.scrollTo({ top: y0 + (y - y0) * e, behavior: 'instant' }));
      await wait(250);
    }
    async function probeTo(p, ms) {
      const p0 = probe ? probe.slice() : [p[0], p[1]];
      await anim(ms, e => { probe = [p0[0] + (p[0] - p0[0]) * e, p0[1] + (p[1] - p0[1]) * e]; updateMeter(); });
    }
    async function typeInto(inp, s, set) {      // type a value into a table cell, one character at a time
      inp.classList.add('typing');
      for (let i = 1; i <= s.length; i++) { inp.value = s.slice(0, i); await wait(85); }
      inp.classList.remove('typing');
      set(s);
    }
    function pendingMark(p, v) {
      const q = tmap(p), c = vColor(v);
      const g = el('g', null, tutL);
      el('circle', { cx: q[0], cy: q[1], r: 11, fill: 'none', stroke: c, 'stroke-width': 1.6, 'stroke-dasharray': '3 3' }, g);
      el('path', { d: `M${q[0] - 6} ${q[1] - 6}L${q[0] + 6} ${q[1] + 6}M${q[0] + 6} ${q[1] - 6}L${q[0] - 6} ${q[1] + 6}`, stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
      const right = q[0] < 400;
      txt(g, q[0] + (right ? 14 : -14), q[1] - 10, `(${fmt1(p[0])}, ${fmt1(p[1])})`, { 'text-anchor': right ? 'start' : 'end', 'font-size': 14, 'font-weight': 700, fill: c, 'font-family': 'Sora, sans-serif' });
      return g;
    }
    function plateTags() {
      const g = el('g', null, tutL);
      [['neg', '#2d4fa3', '0 V'], ['pos', '#c0402b', fmtV(VBAT).replace(/0$/, '') + ' V']].forEach(([k, c, s]) => {
        const pl = PLATE[k], a = tmap([pl.x, (pl.y0 + pl.y1) / 2 - 2.2]);
        el('rect', { x: a[0] - 30, y: a[1] - 15, width: 60, height: 30, rx: 8, fill: '#fff', stroke: c, 'stroke-width': 2 }, g);
        txt(g, a[0], a[1] + 6, s, { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: c, 'font-family': 'Sora, sans-serif' });
      });
      return g;
    }
    async function drawLines(list) {           // trace each plotted line on the graph, one voltage at a time
      tutLinesHidden = false; renderGraph();
      const paths = Array.from(graph.querySelectorAll('path[stroke-width="3"]'));
      paths.forEach(pth => { const n = pth.getTotalLength(); pth.style.strokeDasharray = n; pth.style.strokeDashoffset = n; });
      for (let i = 0; i < paths.length; i++) {
        const v = list[i] ? list[i].v : null, n = paths[i].getTotalLength();
        step('Draw the equipotential line', `A smooth curve through the four ${v == null ? '' : fmtLabel(v) + ' '}points. Every point on it is at the same potential.`, v == null ? '' : `V = ${fmtLabel(v)}`);
        await anim(1500, e => { paths[i].style.strokeDashoffset = n * (1 - e); });
        await wait(500);
      }
      paths.forEach(pth => { pth.style.strokeDasharray = ''; pth.style.strokeDashoffset = ''; });
    }
    function rightAngle(v, y) {                // a small square where a field line crosses the equipotential
      const x = locateX(v, y); if (x == null) return null;
      const gv = gradV(x, y), m = Math.hypot(gv[0], gv[1]) || 1;
      const f = [-gv[0] / m, -gv[1] / m], t = [-f[1], f[0]], s = .4;
      const P = (a, b) => gmap([x + a[0] * s + b[0] * s, y + a[1] * s + b[1] * s]);
      const q0 = gmap([x, y]), q1 = P(f, [0, 0]), q2 = P(f, t), q3 = P([0, 0], t);
      const g = el('g', null, graph);
      el('path', { d: `M${q1[0]} ${q1[1]}L${q2[0]} ${q2[1]}L${q3[0]} ${q3[1]}`, fill: 'none', stroke: '#1c2541', 'stroke-width': 2 }, g);
      el('circle', { cx: q0[0], cy: q0[1], r: 3.5, fill: '#1c2541' }, g);
      return g;
    }
    /* the run plan: the voltages currently set in the table (their values and their count) */
    function tutorialPlan() {
      const notes = [], seen = new Set();
      let list = [];
      rows.forEach((row, r) => {
        if (isBlank(row.v)) return;
        const v = rowV(r);
        if (v == null) { notes.push(`“${row.v.trim()}” skipped (outside 1.7–2.2 V)`); return; }
        const key = v.toFixed(3);
        if (seen.has(key)) { notes.push(`repeat of ${fmtLabel(v)} skipped`); return; }
        seen.add(key); list.push({ r, v });
      });
      const defaults = !list.length;
      const rowsV = defaults ? DEFAULT_TARGETS.map(String) : rows.map(row => row.v);
      if (defaults) list = DEFAULT_TARGETS.map((v, r) => ({ r, v }));
      return { list, notes, rowsV, defaults };
    }
    function applyPlan(plan) {
      rows = plan.rowsV.map(v => blankRow(v));
      active = plan.list[0].r; probe = null;
      bEq.setAttribute('aria-pressed', 'false'); bFl.setAttribute('aria-pressed', 'false');
      buildTable(); say('', ''); refresh();
    }
    async function tutorial() {
      tut.on = true; tut.cancel = false; document.body.classList.add('tut-on'); bar.hidden = false; btnTut.disabled = true;
      const bench = document.querySelector('.bench'), dmm = document.querySelector('.dmm'), tbox = document.querySelector('.target-box');
      const tblWrap = table.closest('.pr-block'), gWrap = graph.closest('.pr-block');
      const plan = tutorialPlan(), list = plan.list;
      try {
        applyPlan(plan); setReading('tray', null); tutL.innerHTML = ''; tutLinesHidden = true; renderGraph();
        await scrollToEl(bench); hi(bench);
        step('The setup', 'Two small metal plates stand in a wide tray of weak conducting solution, at x = −10 cm and x = +10 cm. The graph board under the tray runs from −5 to +5 cm in x and y, centred between the plates.', '');
        await wait(3200);
        step('Connect the supply', `The supply holds the − plate at 0 V and the + plate at ${fmtV(VBAT).replace(/0$/, '')} V, so a steady current flows through the solution. The centre of the board sits at about 1.95 V.`, `− plate: 0 V · + plate: ${fmtV(VBAT).replace(/0$/, '')} V`);
        const tags = plateTags(); await wait(3400);
        hi(dmm);
        step('Connect the voltmeter', 'COM goes to the − plate; the probe goes to V. The meter then reads the potential of the point the probe touches.', '');
        await wait(3000);
        tags.remove();
        await scrollToEl(tblWrap); hi(tblWrap);
        const vs = list.map(o => fmtT(o.v)).join(', ') + ' V';
        step('Target voltages', plan.defaults
          ? `No target voltages are set in the table, so the run uses the defaults: one equipotential line for each.`
          : `The run uses the ${list.length} voltage${list.length === 1 ? '' : 's'} set in the table: one equipotential line for each.`,
          vs + (plan.notes.length ? ' · ' + plan.notes.join('; ') : ''));
        await wait(2800);
        for (const { r, v } of list) {
          active = r; refresh();
          await scrollToEl(bench); hi(bench, tbox);
          step(`Target ${fmtLabel(v)}`, `Find four points where the voltmeter reads ${fmtLabel(v)}, spread across the board from y = −4.5 cm to y = 4.5 cm.`, `target = ${fmtLabel(v)}`);
          await wait(1800);
          const found = [];
          for (const y of SPREAD_Y) {
            const x = r1(locateX(v, y)), side = found.length % 2 ? 1 : -1;
            const start = Math.max(-4.8, Math.min(4.8, x + side * 2.2));
            step('Move the probe', `Slide the probe along y = ${fmt1(y)} cm and watch the reading.`, `y = ${fmt1(y)} cm`);
            await probeTo([start, y], found.length ? 700 : 1000);
            const r0 = potential(start, y);
            tF.textContent = `${fmtV(r0)} V: ${r0 < v ? 'too low, move toward the + plate' : 'too high, move toward the − plate'}`;
            await wait(600);
            const over = x + (x > start ? .4 : -.4);
            await probeTo([over, y], 1400);
            tF.textContent = `${fmtV(potential(over, y))} V: just past the target, ease back`;
            await wait(500);
            await probeTo([x, y], 700);
            const rv = potential(x, y);
            step('Reading matches', `The reading is within ${TOL.toFixed(2)} V of the target. Mark the point and note its coordinates.`, `${fmtV(rv)} V at (${fmt1(x)}, ${fmt1(y)})`);
            pendingMark([x, y], v); found.push([x, y]);
            await wait(1300);
          }
          probe = null; updateMeter();
          await scrollToEl(tblWrap); hi(tblWrap);
          step('Fill the table', `Write the four ${fmtLabel(v)} points into the table, one cell at a time.`, '');
          await wait(900);
          for (let k = 0; k < found.length; k++) {
            const pt = rows[r].p[k], td = cInput(r, k, 'x').closest('td');
            hi(tblWrap, td);
            tF.textContent = `(x${k + 1}, y${k + 1}) = (${fmt1(found[k][0])}, ${fmt1(found[k][1])})`;
            await typeInto(cInput(r, k, 'x'), fmt1(found[k][0]), s => { pt.x = s; });
            await typeInto(cInput(r, k, 'y'), fmt1(found[k][1]), s => { pt.y = s; });
            syncInputs(); renderTrayMarks(); renderGraph();
            await wait(500);
          }
          tutL.innerHTML = '';
          hi(); await wait(400);
        }
        await scrollToEl(gWrap); hi(gWrap);
        step('Plot the points', 'Each row of the table is plotted on graph paper, with x and y from −5 to +5 cm and the origin at the centre.', '');
        await wait(1800);
        await drawLines(list);
        hi(bEq, gWrap);
        step('Compare with the true lines', 'The dashed curves are the true equipotentials from the field model. The plotted lines follow them closely.', '');
        bEq.setAttribute('aria-pressed', 'true'); renderTrayMarks(); renderGraph();
        await wait(3600);
        hi(bFl, gWrap);
        step('Field lines', 'The amber field lines run from the + plate to the − plate and cross every equipotential at right angles.', 'field lines ⟂ equipotentials');
        bFl.setAttribute('aria-pressed', 'true'); renderTrayMarks(); renderGraph();
        rightAngle(list[0].v, 3); if (list.length > 1) rightAngle(list[list.length - 1].v, -3);
        await wait(4200);
        hi();
        step('Done', `${list.length} equipotential line${list.length === 1 ? '' : 's'} mapped and checked against the field model. Start over to map them by hand.`, '');
        await wait(4000);
      } catch (e) {
        if (e !== STOP) throw e;
      } finally {
        tut.on = false; tut.skip = false; resetPlayback(); hi(); tutL.innerHTML = '';
        tbody.querySelectorAll('.typing').forEach(i => i.classList.remove('typing'));
        syncInputs();
        tutLinesHidden = false; probe = null; updateMeter(); renderGraph();
        document.body.classList.remove('tut-on'); bar.hidden = true; btnTut.disabled = false;
      }
    }
    btnTut.addEventListener('click', () => { if (!tut.on) tutorial(); });
    document.getElementById('tut-stop').addEventListener('click', () => { tut.cancel = true; });
    document.getElementById('tut-skip').addEventListener('click', () => { tut.skip = true; });
    onLeave.practical = () => { if (tut.on) tut.cancel = true; };

    document.getElementById('pr-reset').addEventListener('click', () => { if (!tut.on) reset(); });
    reset();
    window.__practical = {
      state: () => ({ rows: JSON.parse(JSON.stringify(rows)), active, probe: probe && probe.slice() }),
      potential, locateX
    };
  })();

  /* =====================================================================
     14. OPTIONAL EXTRAS — opens upward, closes ~500 ms after the pointer leaves
     ===================================================================== */
  (function extras() {
    const box = document.getElementById('extras'), btn = document.getElementById('extras-toggle');
    let t = null, openedAt = 0;
    const open = () => { clearTimeout(t); if (!box.classList.contains('open')) openedAt = Date.now(); box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { clearTimeout(t); box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
    const later = () => { clearTimeout(t); t = setTimeout(close, 500); };
    box.addEventListener('mouseenter', open);
    box.addEventListener('mouseleave', later);
    btn.addEventListener('click', () => {
      if (!box.classList.contains('open')) open();
      else if (Date.now() - openedAt > 350) close();
    });
    box.addEventListener('focusin', open);
    box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) later(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  })();

  goTo(fromHash(), false);
})();
