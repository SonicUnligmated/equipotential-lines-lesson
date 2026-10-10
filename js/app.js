/* Lab 7A · Mapping of Equipotential Lines — lesson app (no dependencies) */
(function () {
  'use strict';

  /* =====================================================================
     1. FIELD MODEL — potential in the tray (solved Laplace grid, js/field-data.js)
     ===================================================================== */
  const F = window.FIELD;
  const H = F.h, NX = F.nx, NY = F.ny, W = F.W, HT = F.H;
  const VG = F.V;
  const PLATE = { neg: { x: 6, y0: 6, y1: 14, v: 0 }, pos: { x: 24, y0: 6, y1: 14, v: 6 } };
  const VBAT = 6;

  function node(i, j) { return VG[j * NX + i]; }
  function potential(x, y) {
    x = Math.min(Math.max(x, 0), W); y = Math.min(Math.max(y, 0), HT);
    const fx = x / H, fy = y / H;
    const i = Math.min(Math.floor(fx), NX - 2), j = Math.min(Math.floor(fy), NY - 2);
    const tx = fx - i, ty = fy - j;
    return node(i, j) * (1 - tx) * (1 - ty) + node(i + 1, j) * tx * (1 - ty) +
           node(i, j + 1) * (1 - tx) * ty + node(i + 1, j + 1) * tx * ty;
  }
  function gradV(x, y) {
    const d = 0.04;
    return [(potential(x + d, y) - potential(x - d, y)) / (2 * d), (potential(x, y + d) - potential(x, y - d)) / (2 * d)];
  }

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
    const key = level.toFixed(3);
    if (!contourCache.has(key)) {
      contourCache.set(key, contourGrid(node, NX, NY, level).map(l => l.map(p => [p[0] * H, p[1] * H])));
    }
    return contourCache.get(key);
  }
  /* Streamline along -grad V (dir=+1, toward the − plate) or +grad V (dir=-1, toward the + plate). */
  function streamline(x, y, dir, maxSteps) {
    const out = [[x, y]], ds = 0.08;
    for (let s = 0; s < (maxSteps || 1600); s++) {
      let g = gradV(x, y), m = Math.hypot(g[0], g[1]);
      if (m < 1e-4) break;
      const mx = x - dir * ds * 0.5 * g[0] / m, my = y - dir * ds * 0.5 * g[1] / m;
      g = gradV(mx, my); m = Math.hypot(g[0], g[1]);
      if (m < 1e-4) break;
      x -= dir * ds * g[0] / m; y -= dir * ds * g[1] / m;
      if (x < 0.02 || x > W - 0.02 || y < 0.02 || y > HT - 0.02) break;
      out.push([x, y]);
      const v = potential(x, y);
      if (dir > 0 && v < 0.02) break;
      if (dir < 0 && v > VBAT - 0.02) break;
    }
    return out;
  }
  let FIELD_LINES = null;
  function trayFieldLines() {
    if (FIELD_LINES) return FIELD_LINES;
    const seeds = [];
    for (let y = 6.4; y <= 13.7; y += 1.05) seeds.push([23.7, y]);
    seeds.push([24, 14.35], [24, 5.65], [24.35, 13.2], [24.35, 6.8], [23.2, 14.5], [23.2, 5.5]);
    FIELD_LINES = seeds.map(s => streamline(s[0], s[1], 1, 2400)).filter(l => l.length > 8);
    return FIELD_LINES;
  }

  /* Worked example — generated from the same field model */
  const WORKED = [
    { v: 1, pts: [[6.4, 2], [8.5, 7], [8.6, 12], [6.9, 17]] },
    { v: 2, pts: [[11.1, 2], [11.6, 7], [11.7, 12], [11.2, 17]] },
    { v: 4, pts: [[18.9, 2], [18.4, 7], [18.3, 12], [18.8, 17]] },
    { v: 5, pts: [[23.6, 2], [21.5, 7], [21.4, 12], [23.1, 17]] }
  ];

  /* colour for a potential: ink-blue (0 V) → violet → red (6 V) */
  function vColor(v, a) {
    const t = Math.min(Math.max(v / VBAT, 0), 1);
    const c0 = [45, 79, 163], c1 = [124, 62, 140], c2 = [192, 64, 43];
    const c = t < 0.5 ? c0.map((q, k) => q + (c1[k] - q) * t * 2) : c1.map((q, k) => q + (c2[k] - q) * (t - 0.5) * 2);
    return a == null ? `rgb(${c.map(Math.round).join(',')})` : `rgba(${c.map(Math.round).join(',')},${a})`;
  }
  const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const fmtV = v => v.toFixed(2);
  const fmtLabel = v => (Number.isInteger(v) ? String(v) : v.toFixed(1)) + ' V';

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

  /* ---------- tray drawing (viewBox 660 × 470, 20 px per cm) ---------- */
  const TS = 20, TX0 = 30, TY0 = 30;
  const tmap = p => [TX0 + p[0] * TS, TY0 + (HT - p[1]) * TS];
  function drawTrayBase(svg) {
    svg.innerHTML = '';
    const defs = el('defs', null, svg);
    const lg = el('linearGradient', { id: svg.id + '-sol', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: '0', 'stop-color': '#e3ebf7' }, lg); el('stop', { offset: '.5', 'stop-color': '#eef1ee' }, lg); el('stop', { offset: '1', 'stop-color': '#f6e8e2' }, lg);
    el('rect', { x: TX0 - 8, y: TY0 - 8, width: W * TS + 16, height: HT * TS + 16, rx: 14, fill: '#d9d2c2' }, svg);
    el('rect', { x: TX0, y: TY0, width: W * TS, height: HT * TS, rx: 6, fill: `url(#${svg.id}-sol)` }, svg);
    const g = el('g', { stroke: '#b9c6d8', opacity: .55 }, svg);
    for (let x = 1; x < W; x++) el('line', { x1: TX0 + x * TS, y1: TY0, x2: TX0 + x * TS, y2: TY0 + HT * TS, 'stroke-width': x % 5 ? .5 : 1 }, g);
    for (let y = 1; y < HT; y++) el('line', { x1: TX0, y1: TY0 + y * TS, x2: TX0 + W * TS, y2: TY0 + y * TS, 'stroke-width': y % 5 ? .5 : 1 }, g);
    const rl = el('g', { fill: '#6a7186', 'font-size': 14, 'font-family': 'Source Sans 3, sans-serif' }, svg);
    for (let x = 0; x <= W; x += 5) txt(rl, TX0 + x * TS, TY0 + HT * TS + 24, String(x), { 'text-anchor': 'middle' });
    for (let y = 5; y <= HT; y += 5) txt(rl, TX0 - 14, TY0 + (HT - y) * TS + 4, String(y), { 'text-anchor': 'end' });
    const layers = { under: el('g', null, svg), lines: el('g', null, svg), plates: el('g', null, svg), marks: el('g', null, svg), top: el('g', null, svg) };
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
      if (arrows) arrowAt(g, l, map, attrs.stroke, 0.45);
    });
  }

  /* ---------- graph paper (viewBox 760 × 540) ---------- */
  const GS = 21, GX0 = 92, GY0 = 50;
  const gmap = p => [GX0 + p[0] * GS, GY0 + (HT - p[1]) * GS];
  function drawGraphBase(svg) {
    svg.setAttribute('viewBox', '0 0 760 540');
    svg.innerHTML = '';
    el('rect', { x: 0, y: 0, width: 760, height: 540, fill: '#fbfdf9', rx: 12 }, svg);
    const g = el('g', null, svg);
    for (let x = 0; x <= W * 2; x++) {
      const X = GX0 + x * GS / 2, maj = x % 10 === 0, mid = x % 2 === 0;
      el('line', { x1: X, y1: GY0, x2: X, y2: GY0 + HT * GS, stroke: maj ? '#86c897' : mid ? '#bfe2c7' : '#e0f1e3', 'stroke-width': maj ? 1.2 : .8 }, g);
    }
    for (let y = 0; y <= HT * 2; y++) {
      const Y = GY0 + y * GS / 2, maj = y % 10 === 0, mid = y % 2 === 0;
      el('line', { x1: GX0, y1: Y, x2: GX0 + W * GS, y2: Y, stroke: maj ? '#86c897' : mid ? '#bfe2c7' : '#e0f1e3', 'stroke-width': maj ? 1.2 : .8 }, g);
    }
    el('line', { x1: GX0, y1: GY0 + HT * GS, x2: GX0 + W * GS + 14, y2: GY0 + HT * GS, stroke: '#1c2541', 'stroke-width': 1.8 }, svg);
    el('line', { x1: GX0, y1: GY0 + HT * GS, x2: GX0, y2: GY0 - 14, stroke: '#1c2541', 'stroke-width': 1.8 }, svg);
    el('path', { d: `M${GX0 + W * GS + 20} ${GY0 + HT * GS} l-9 -5 v10 z`, fill: '#1c2541' }, svg);
    el('path', { d: `M${GX0} ${GY0 - 20} l-5 9 h10 z`, fill: '#1c2541' }, svg);
    const lab = el('g', { fill: '#3c4663', 'font-size': 15, 'font-family': 'Source Sans 3, sans-serif' }, svg);
    for (let x = 0; x <= W; x += 5) txt(lab, GX0 + x * GS, GY0 + HT * GS + 24, String(x), { 'text-anchor': 'middle' });
    for (let y = 5; y <= HT; y += 5) txt(lab, GX0 - 12, GY0 + (HT - y) * GS + 5, String(y), { 'text-anchor': 'end' });
    txt(lab, GX0 - 12, GY0 + HT * GS + 5, '0', { 'text-anchor': 'end' });
    const ax = el('g', { fill: '#1c2541', 'font-size': 17, 'font-weight': 600, 'font-family': 'Sora, sans-serif' }, svg);
    txt(ax, GX0 + W * GS, GY0 + HT * GS + 52, 'X (cm) →', { 'text-anchor': 'end' });
    txt(ax, GX0 - 14, GY0 - 26, 'Y (cm)', { 'text-anchor': 'middle' });
    const pl = el('g', null, svg);
    [['neg', '#2d4fa3', '−'], ['pos', '#c0402b', '+']].forEach(([k, c, s]) => {
      const p = PLATE[k], a = gmap([p.x, p.y1]), b = gmap([p.x, p.y0]);
      el('rect', { x: a[0] - 3, y: a[1], width: 6, height: b[1] - a[1], rx: 2, fill: c, opacity: .8 }, pl);
      txt(pl, a[0], a[1] - 8, s, { 'text-anchor': 'middle', fill: c, 'font-size': 20, 'font-weight': 700, 'font-family': 'Sora, sans-serif' });
    });
    return { under: el('g', null, svg), lines: el('g', null, svg), pts: el('g', null, svg), labels: el('g', null, svg) };
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
      txt(layers.labels, top[0], top[1] - 14, fmtLabel(v), { 'text-anchor': 'middle', fill: col, 'font-size': 22, 'font-weight': 700, class: 'hand' });
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
  const onEnter = {};
  function goTo(i, push) {
    i = Math.max(0, Math.min(views.length - 1, i));
    if (i === current) return;
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
    const sx = 660 / W, sy = 260 / HT;
    const m = p => [p[0] * sx, 260 - p[1] * sy];
    el('rect', { width: 660, height: 260, rx: 14, fill: '#fbf9f3', stroke: '#e4dccb' }, svg);
    const g = el('g', null, svg);
    drawFieldLinesSVG(g, m, { stroke: 'rgba(212,137,26,.55)', 'stroke-width': 1.4, 'stroke-dasharray': '5 5' }, true);
    for (let v = 0.5; v < 6; v += 0.5) drawContoursSVG(g, v, m, { stroke: vColor(v, .85), 'stroke-width': Number.isInteger(v) ? 2.2 : 1.1 });
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
    const S = cv.width / W;
    const cm = p => [p[0] * S, cv.height - p[1] * S];
    const outV = document.getElementById('concept-v');
    const bEq = document.getElementById('concept-all-eq'), bFl = document.getElementById('concept-all-fl');
    let probe = null;
    const DEFAULT = [10.5, 16.5];
    function path(l) { ctx.beginPath(); l.forEach((p, k) => { const q = cm(p); k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); }
    function draw() {
      const p = probe || DEFAULT;
      const g = ctx.createLinearGradient(0, 0, cv.width, 0);
      g.addColorStop(0, '#e6edf8'); g.addColorStop(.5, '#f2f3ef'); g.addColorStop(1, '#f8ebe6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      if (bEq.getAttribute('aria-pressed') === 'true') {
        for (let v = 0.5; v < 6; v += 0.5) {
          ctx.strokeStyle = vColor(v, .38); ctx.lineWidth = 2;
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
        ctx.font = '700 44px Sora, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(s, a[0], a[1] - 18);
      });
      const v = potential(p[0], p[1]);
      const onPlate = v < 0.03 || v > VBAT - 0.03;
      if (!onPlate) {
        const fl = streamline(p[0], p[1], -1, 1600).reverse().concat(streamline(p[0], p[1], 1, 1600));
        ctx.strokeStyle = '#d4891a'; ctx.lineWidth = 5; ctx.setLineDash([16, 12]);
        path(fl); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = vColor(v); ctx.lineWidth = 6; ctx.lineCap = 'round';
        contourGrid(node, NX, NY, v).forEach(l => { path(l.map(q => [q[0] * H, q[1] * H])); ctx.stroke(); });
        const gr = gradV(p[0], p[1]), mg = Math.hypot(gr[0], gr[1]) || 1;
        const u = [gr[0] / mg, gr[1] / mg], n = [-u[1], u[0]], L = 0.75;
        const q0 = cm(p), q1 = cm([p[0] + u[0] * L, p[1] + u[1] * L]), q2 = cm([p[0] + (u[0] + n[0]) * L, p[1] + (u[1] + n[1]) * L]), q3 = cm([p[0] + n[0] * L, p[1] + n[1] * L]);
        ctx.strokeStyle = '#1c2541'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.lineTo(q3[0], q3[1]); ctx.stroke();
        ctx.fillStyle = '#1c2541'; ctx.beginPath(); ctx.arc(q0[0], q0[1], 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q0[0], q0[1], 3.5, 0, Math.PI * 2); ctx.fill();
      }
      outV.textContent = onPlate ? (v < 1 ? '0.00 V (on the − plate)' : '6.00 V (on the + plate)') : fmtV(v) + ' V';
      outV.style.color = vColor(v);
    }
    function toCm(e) {
      const r = cv.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * W, HT - (e.clientY - r.top) / r.height * HT];
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
    if (label) txt(g, q[0] + 12, q[1] + 7, `(${fmt1(p[0])}, ${fmt1(p[1])})`, { 'font-size': 24, 'font-weight': 700, fill: c, class: 'hand' });
  }
  function drawReferenceLead(g, end) {
    const a = tmap([PLATE.neg.x, PLATE.neg.y0]);
    const e = end || [640, TY0 + HT * TS - 30];
    el('path', { d: `M${a[0]} ${a[1] + 2} C${a[0]} ${a[1] + 120} ${e[0] - 220} ${TY0 + HT * TS + 10} ${e[0]} ${e[1]}`, fill: 'none', stroke: '#1c2541', 'stroke-width': 2.2 }, g);
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
    const pp = [12, 10], pv = potential(pp[0], pp[1]);
    drawReferenceLead(L1.top, [548, 412]);
    drawProbeGlyph(L1.top, pp, [612, 368]);
    const meter = el('g', { transform: 'translate(580 402)' }, L1.top);
    el('rect', { x: -58, y: -34, width: 116, height: 64, rx: 10, fill: '#2a3047' }, meter);
    el('rect', { x: -48, y: -26, width: 96, height: 30, rx: 5, fill: '#c9d5bf' }, meter);
    txt(meter, 40, -4, fmtV(pv) + ' V', { 'text-anchor': 'end', 'font-size': 18, 'font-weight': 700, fill: '#1d2a1a', 'font-family': 'Sora, sans-serif' });
    txt(meter, 0, 22, 'voltmeter', { 'text-anchor': 'middle', 'font-size': 11, fill: '#b9c1d9', 'font-family': 'Sora, sans-serif' });
    const s2 = document.getElementById('fig-step2');
    const L2 = drawTrayBase(s2);
    WORKED[1].pts.forEach(p => markPoint(L2.marks, p, 2, true));
    const s3 = document.getElementById('fig-step3');
    const L3 = drawTrayBase(s3);
    WORKED.forEach(r => r.pts.forEach(p => markPoint(L3.marks, p, r.v, false)));
    WORKED.forEach(r => { const t = tmap(r.pts[3]); txt(L3.marks, t[0], t[1] - 18, fmtLabel(r.v), { 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 700, fill: vColor(r.v), class: 'hand' }); });
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
      tr.innerHTML = `<td><span class="vtag"><i style="background:${vColor(r.v)}"></i>${r.v.toFixed(1)}</span></td>` +
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
      hint: 'One value first, then "three other values".', ex: 'You map one value, then choose three other values: four equipotential lines, four rows in the table.' },
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
    { q: 'Between the middle sections of two parallel plates, the equipotential lines are…', a: 'almost straight and parallel to the plates', o: ['circles around each plate', 'perpendicular to the plates', 'randomly shaped'],
      hint: 'The field there is nearly uniform.', ex: 'In the nearly uniform region between the plates, equipotentials are straight lines parallel to the plates; they bend near the plate ends.' },
    { q: 'With a 6 V battery and the reference on the − plate, a point exactly midway between the plates reads about…', a: '3 V', o: ['0 V', '6 V', '12 V'],
      hint: 'The potential rises from 0 V at one plate to 6 V at the other.', ex: 'By symmetry, the midline is the 3 V equipotential (x = 15 cm in the worked example).' },
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
    const tbody = document.querySelector('#pr-table tbody');
    const chipsBox = document.getElementById('chips');
    const dmmVal = document.getElementById('dmm-val');
    const scale = document.getElementById('dmm-scale');
    const tbT = document.getElementById('tb-target'), tbD = document.getElementById('tb-diff'), msg = document.getElementById('tb-msg');
    const bEq = document.getElementById('pr-true-eq'), bFl = document.getElementById('pr-true-fl');
    const CHOICES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    const DEFAULT_TARGETS = [1, 2, 4, 5];
    const TOL = 0.1;
    let targets = [], points = {}, active = null, probe = null;

    const L = drawTrayBase(tray);
    drawReferenceLead(L.under);
    const probeG = el('g', { style: 'display:none', 'pointer-events': 'none' }, L.top);
    const wire = el('path', { fill: 'none', stroke: '#c0402b', 'stroke-width': 2.2 }, probeG);
    const ring = el('circle', { r: 7, fill: 'none', stroke: '#1c2541', 'stroke-width': 2 }, probeG);
    const dotP = el('circle', { r: 2.5, fill: '#d4891a' }, probeG);
    el('rect', { x: TX0, y: TY0, width: W * TS, height: HT * TS, fill: 'transparent' }, tray);

    (function buildScale() {
      const cx = 120, cy = 66, R = 54;
      const ang = v => Math.PI * (1 - v / VBAT);
      el('path', { d: `M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}`, fill: 'none', stroke: '#59607a', 'stroke-width': 2 }, scale);
      for (let v = 0; v <= 6; v += 0.5) {
        const a = ang(v), r1 = Number.isInteger(v) ? R - 9 : R - 5;
        el('line', { x1: cx + R * Math.cos(a), y1: cy - R * Math.sin(a), x2: cx + r1 * Math.cos(a), y2: cy - r1 * Math.sin(a), stroke: '#b9c1d9', 'stroke-width': Number.isInteger(v) ? 1.6 : 1 }, scale);
        if (Number.isInteger(v)) txt(scale, cx + (R + 9) * Math.cos(a), cy - (R + 9) * Math.sin(a) + 3, String(v), { 'text-anchor': 'middle', 'font-size': 9, fill: '#b9c1d9', 'font-family': 'Sora, sans-serif' });
      }
      const tgt = el('line', { x1: cx, y1: cy, x2: cx, y2: cy, stroke: '#d4891a', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, scale);
      const needle = el('line', { x1: cx, y1: cy, x2: cx - R + 12, y2: cy, stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, scale);
      el('circle', { cx, cy, r: 4, fill: '#fff' }, scale);
      scale._set = (v, t) => {
        const a = ang(Math.max(0, Math.min(VBAT, v))), r = R - 12;
        needle.setAttribute('x2', cx + r * Math.cos(a)); needle.setAttribute('y2', cy - r * Math.sin(a));
        if (t == null) { tgt.setAttribute('opacity', 0); return; }
        const b = ang(t);
        tgt.setAttribute('opacity', .9);
        tgt.setAttribute('x1', cx + (R - 4) * Math.cos(b)); tgt.setAttribute('y1', cy - (R - 4) * Math.sin(b));
        tgt.setAttribute('x2', cx + (R + 3) * Math.cos(b)); tgt.setAttribute('y2', cy - (R + 3) * Math.sin(b));
      };
    })();

    const rowFull = v => (points[v] || []).length >= 4;
    function nextActive() { const k = targets.find(v => !rowFull(v)); return k == null ? null : k; }
    function say(text, kind) { msg.textContent = text; msg.className = 'tb-msg' + (kind ? ' ' + kind : ''); }
    const more = n => `Choose ${n} more target${n === 1 ? '' : 's'}.`;

    function renderChips() {
      chipsBox.innerHTML = '';
      CHOICES.forEach(v => {
        const b = document.createElement('button'); b.type = 'button';
        const on = targets.includes(v);
        b.className = 'chip' + (on ? ' on' : '');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) b.style.background = vColor(v);
        b.textContent = fmtLabel(v);
        b.addEventListener('click', () => toggleTarget(v));
        chipsBox.appendChild(b);
      });
    }
    function toggleTarget(v) {
      if (targets.includes(v)) {
        const had = (points[v] || []).length;
        targets = targets.filter(t => t !== v); delete points[v];
        if (active === v) active = nextActive();
        say(had ? `Removed the ${fmtLabel(v)} row and its point${had > 1 ? 's' : ''}. ${more(4 - targets.length)}` : more(4 - targets.length), '');
      } else {
        if (targets.length >= 4) { say('Four targets are already chosen. Deselect one first.', 'warn'); return; }
        targets = targets.concat(v).sort((a, b) => a - b); points[v] = [];
        if (active == null || rowFull(active)) active = v;
        say(targets.length < 4 ? more(4 - targets.length) : '', '');
      }
      refresh();
    }
    function renderTable() {
      tbody.innerHTML = '';
      if (!targets.length) { tbody.innerHTML = '<tr><td colspan="5" class="cell-empty">Choose target voltages above.</td></tr>'; return; }
      targets.forEach(v => {
        const tr = document.createElement('tr');
        if (v === active) tr.className = 'active';
        const td0 = document.createElement('td'); td0.className = 'vcell';
        const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'row-pick';
        pick.innerHTML = `<span class="vtag"><i style="background:${vColor(v)}"></i>${v.toFixed(1)}</span>`;
        pick.setAttribute('aria-label', `Record points for ${fmtLabel(v)}`);
        pick.addEventListener('click', () => { active = v; say(`Recording the ${fmtLabel(v)} line.`, ''); refresh(); });
        td0.appendChild(pick); tr.appendChild(td0);
        for (let k = 0; k < 4; k++) {
          const td = document.createElement('td'); const p = (points[v] || [])[k];
          if (p) {
            const span = document.createElement('span'); span.className = 'cell-pt';
            span.textContent = `(${fmt1(p.x)}, ${fmt1(p.y)})`;
            const x = document.createElement('button'); x.type = 'button'; x.className = 'cell-x'; x.textContent = '×';
            x.setAttribute('aria-label', 'Remove this point');
            x.addEventListener('click', () => { points[v].splice(k, 1); if (active == null) active = v; say('Point removed.', ''); refresh(); });
            span.appendChild(x); td.appendChild(span);
          } else td.innerHTML = '<span class="cell-empty">—</span>';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    }
    const showEq = () => bEq.getAttribute('aria-pressed') === 'true';
    const showFl = () => bFl.getAttribute('aria-pressed') === 'true';
    function renderTrayMarks() {
      L.marks.innerHTML = ''; L.lines.innerHTML = '';
      if (showFl()) drawFieldLinesSVG(L.lines, tmap, { stroke: 'rgba(212,137,26,.8)', 'stroke-width': 1.6, 'stroke-dasharray': '6 5' }, true);
      if (showEq()) targets.forEach(v => drawContoursSVG(L.lines, v, tmap, { stroke: vColor(v, .75), 'stroke-width': 2.2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }));
      targets.forEach(v => (points[v] || []).forEach(p => {
        const q = tmap([p.x, p.y]), c = vColor(v);
        el('path', { d: `M${q[0] - 6} ${q[1] - 6}L${q[0] + 6} ${q[1] + 6}M${q[0] + 6} ${q[1] - 6}L${q[0] - 6} ${q[1] + 6}`, stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round' }, L.marks);
      }));
    }
    function renderGraph() {
      const G = drawGraphBase(graph);
      if (showFl()) drawFieldLinesSVG(G.under, gmap, { stroke: 'rgba(212,137,26,.75)', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }, true);
      if (showEq()) targets.forEach(v => drawContoursSVG(G.under, v, gmap, { stroke: vColor(v, .6), 'stroke-width': 2.2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }));
      targets.forEach(v => { const ps = (points[v] || []).map(p => [p.x, p.y]); if (ps.length) plotSet(G, v, ps); });
    }
    function updateMeter() {
      if (!probe) {
        dmmVal.textContent = '– – –'; tbD.textContent = '—'; tbD.className = ''; scale._set(0, active);
        probeG.style.display = 'none'; return;
      }
      const v = potential(probe[0], probe[1]);
      dmmVal.textContent = fmtV(v);
      scale._set(v, active);
      probeG.style.display = '';
      const q = tmap(probe);
      ring.setAttribute('cx', q[0]); ring.setAttribute('cy', q[1]); dotP.setAttribute('cx', q[0]); dotP.setAttribute('cy', q[1]);
      wire.setAttribute('d', `M${q[0]} ${q[1]} C${q[0] + 50} ${q[1] - 60} 560 ${TY0 - 10} 655 ${TY0 + 40}`);
      if (active != null) {
        const d = v - active, on = Math.abs(d) <= TOL;
        tbD.textContent = (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2) + ' V';
        tbD.className = on ? 'ok' : '';
        setReading('tray', fmtV(v) + ' V', on);
      } else { tbD.textContent = '—'; tbD.className = ''; setReading('tray', fmtV(v) + ' V', false); }
    }
    function refresh() {
      if (active != null && !targets.includes(active)) active = nextActive();
      tbT.textContent = active == null ? (targets.length < 4 ? 'choose targets' : 'all rows full') : fmtLabel(active);
      renderChips(); renderTable(); renderTrayMarks(); renderGraph(); updateMeter();
    }
    function toCm(e) {
      const pt = tray.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const s = pt.matrixTransform(tray.getScreenCTM().inverse());
      return [(s.x - TX0) / TS, HT - (s.y - TY0) / TS];
    }
    const inside = p => p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= HT;
    function record(p) {
      if (active == null) { say(targets.length < 4 ? 'Choose four target voltages first.' : 'All rows are full. Remove a point or pick another row.', 'warn'); return false; }
      const x = Math.round(p[0] * 10) / 10, y = Math.round(p[1] * 10) / 10;
      const v = potential(x, y), d = v - active;
      if (Math.abs(d) > TOL) {
        say(`${fmtV(v)} V is ${Math.abs(d).toFixed(2)} V ${d > 0 ? 'above' : 'below'} the ${fmtLabel(active)} target. Move toward the ${d > 0 ? '− plate' : '+ plate'}.`, 'warn');
        return false;
      }
      const row = points[active];
      if (row.some(q => Math.hypot(q.x - x, q.y - y) < 1.5)) { say('There is already a point close to this one. Spread the points along the line.', 'warn'); return false; }
      row.push({ x, y, v });
      const done = row.length >= 4, label = fmtLabel(active);
      if (done) active = nextActive();
      if (done && active == null) say(`Recorded (${fmt1(x)}, ${fmt1(y)}). All four lines are recorded; compare them with the true equipotentials.`, 'good');
      else if (done) say(`Recorded (${fmt1(x)}, ${fmt1(y)}). ${label} line complete; next, the ${fmtLabel(active)} line.`, 'good');
      else say(`Recorded (${fmt1(x)}, ${fmt1(y)}) at ${fmtV(v)} V.`, 'good');
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
      b.setAttribute('aria-pressed', showEqFlip(b));
      renderTrayMarks(); renderGraph();
    }));
    function showEqFlip(b) { return b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'; }
    function reset() {
      targets = DEFAULT_TARGETS.slice(); points = {}; targets.forEach(v => { points[v] = []; });
      active = targets[0]; probe = null;
      bEq.setAttribute('aria-pressed', 'false'); bFl.setAttribute('aria-pressed', 'false');
      say('', '');
      refresh();
    }
    document.getElementById('pr-reset').addEventListener('click', reset);
    reset();
    window.__practical = { state: () => ({ targets: targets.slice(), points: JSON.parse(JSON.stringify(points)), active }) };
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
