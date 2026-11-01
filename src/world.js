// Harbour Heights: procedural high-rise city. All art drawn on canvas.
const W = {
  N: 7, PITCH: 420, ROAD: 110, PAVE: 26,
  get SIZE() { return this.N * this.PITCH + this.ROAD; },
};
// Size class -> hole level needed. r is the "body" radius used for swallowing.
const TYPES = {
  cone:   { size: 1, r: 7,   ht: 10 },
  bin:    { size: 1, r: 9,   ht: 14 },
  bench:  { size: 2, r: 14,  ht: 8 },
  lamp:   { size: 2, r: 8,   ht: 46 },
  tree:   { size: 3, r: 20,  ht: 34 },
  car:    { size: 4, r: 22,  ht: 14 },
  taxi:   { size: 4, r: 22,  ht: 14 },
  bus:    { size: 5, r: 44,  ht: 26 },
  kiosk:  { size: 5, r: 36,  ht: 34 },
  shop:   { size: 6, r: 60,  ht: 70 },
  office: { size: 7, r: 98,  ht: 230 },
  tower:  { size: 8, r: 135, ht: 420 },
};
const HOLE_R = [0, 18, 24, 32, 42, 62, 88, 122, 168];
// City Run tuned for hand play in a few minutes (points per item = size^2)
const LEVEL_NEED = [0, 8, 50, 180, 420, 750, 1150, 1600, 1e9]; // ~3-4 min City Run by hand

// ---------- worlds ----------
// Each world reuses the same size classes (type) but swaps the art (spr) and the block mix.
let THEME = 'city';
const THEMES = {
  city:     { kinds: [['highrise', .45], ['office', .6], ['shops', .85], ['plaza', 1]], furn: [['lamp', .22], ['bin', .42], ['cone', .58], ['tree', .66], ['bench', .70]], veh: [['car', .62], ['taxi', .82], ['bus', 1]], spr: {}, marks: true },
  district: { kinds: [['shops', .45], ['plaza', .7], ['office', .85], ['highrise', 1]], furn: [['lamp', .25], ['bin', .45], ['tree', .62], ['bench', .72]], veh: [['car', .5], ['taxi', .72], ['tram', 1]], vspr: { tram: ['b-tram', 112, 1], nboat: ['b-nboat', 124] }, spr: {}, marks: true, canal: true },
  village:  { kinds: [['shops', .5], ['office', .66], ['plaza', .86], ['farm', 1]], furn: [['tree', .2], ['bin', .3], ['cone', .45], ['bench', .52], ['lamp', .58]], veh: [['car', .45], ['tractor', .75], ['vbus', 1]], spr: { tree: ['v-oak', 66], bin: ['v-postbox', 16], cone: ['v-flowers', 30], kiosk: ['v-hay', 80] }, vspr: { tractor: ['v-tractor', 52], vbus: ['v-bus', 104, 1] }, organic: { w: 62, col: '#bfa679', edge: '#8f7a52' } },
  desert:   { kinds: [['shops', .4], ['office', .55], ['plaza', .85], ['beach', 1]], furn: [['tree', .22], ['bin', .36], ['cone', .46], ['bench', .52]], veh: [['raptor', .5], ['stego', .78], ['trike', 1]], spr: { bin: ['d-crate', 22], cone: ['m-rock', 14], bench: ['d-boat', 44], tree: ['d-palm', 52], kiosk: ['d-lighthouse', 60], shop: ['d-hut', 125], office: ['d-volcano', 230], tower: ['d-brachio', 300] }, vspr: { raptor: ['d-raptor', 58], stego: ['d-stego', 100], trike: ['d-trike', 104] }, flat: true, organic: { w: 70, col: '#f2e2b4', edge: '#cdb27a' } },
  moon:     { kinds: [['shops', .4], ['office', .55], ['plaza', .85], ['craters', 1]], furn: [['cone', .2], ['bin', .34], ['tree', .44], ['bench', .54]], veh: [['rover', .55], ['shuttle', 1]], spr: { cone: ['m-rock', 16], bin: ['m-crate', 22], bench: ['m-solar', 38], tree: ['m-dish', 44], kiosk: ['m-dome', 90], shop: ['m-hab', 150], office: ['m-greenhouse', 210], tower: ['m-rocket', 170] }, vspr: { rover: ['m-rover', 60], shuttle: ['m-shuttle', 110] }, flat: true, organic: { w: 62, col: '#6c6f78', edge: '#4f525a', tyre: 1 } },
};
// moving things: size class + body for each themed vehicle
const VEH = { car: ['car', 48, 24], taxi: ['taxi', 48, 22], bus: ['bus', 96, 28], tractor: ['car', 48, 26], raptor: ['car', 48, 22], stego: ['bus', 90, 30], trike: ['bus', 90, 30], rover: ['car', 50, 26], shuttle: ['bus', 96, 30], vbus: ['bus', 96, 28], tram: ['bus', 100, 28], nboat: ['bus', 110, 30] };
function setTheme(t) { THEME = THEMES[t] ? t : 'city'; PAT = null; }
const TH = () => THEMES[THEME];
function pick(list, v) { for (const [k, p] of list) if (v < p) return k; return null; }
function themeSprName(type) { const m = TH().spr[type]; return m ? m[0] : type; }

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

function makeObj(type, x, y, extra = {}) {
  const T = TYPES[type];
  const o = Object.assign({ type, x, y, size: T.size, r: T.r, ht: T.ht, angle: 0, state: 'idle', ft: 0, wob: 0, hue: 0 }, extra);
  const m = TH().spr[type]; if (m) { o.spr = m[0]; o.sw = m[1]; if (TH().flat) o.flat = true; }
  return o;
}

function buildCity(seed = 7) {
  const R = rng(seed), objs = [], peds = [], birds = [], blocks = [];
  const P = W.PITCH, RD = W.ROAD, N = W.N, inner = P - RD;
  const mid = Math.floor(N / 2);
  for (let bx = 0; bx < N; bx++) for (let by = 0; by < N; by++) {
    const x0 = bx * P + RD, y0 = by * P + RD, cx = x0 + inner / 2, cy = y0 + inner / 2;
    let kind; const ORG = TH().organic, i0 = objs.length, k0 = birds.length;
    const jx = ORG ? (R() - 0.5) * 130 : 0, jy = ORG ? (R() - 0.5) * 130 : 0;
    if (bx === mid && by === mid) kind = 'tower';
    else if ((bx + by * 3) % 5 === 1) kind = 'park';
    else kind = pick(TH().kinds, R());
    blocks.push({ x0, y0, s: inner, kind });
    // pavement furniture on all four edges
    const e = W.PAVE / 2;
    if (ORG) for (let i = 0; i < 12; i++) { const f = pick(TH().furn, R()); if (f) objs.push(makeObj(f, x0 + 20 + R() * (inner - 40), y0 + 20 + R() * (inner - 40), { hue: R() })); }
    else for (let k = 26; k < inner - 20; k += 36) {
      const pts = [[x0 + k, y0 + e], [x0 + k, y0 + inner - e], [x0 + e, y0 + k], [x0 + inner - e, y0 + k]];
      for (const [px, py] of pts) {
        const f = pick(TH().furn, R());
        if (f) objs.push(makeObj(f, px, py, { hue: R() }));
      }
    }
    const ins = W.PAVE + 6, a = x0 + ins, b = y0 + ins, s = inner - ins * 2;
    if (kind === 'tower') {
      objs.push(makeObj('tower', cx, cy, { w: 250, d: 250, landmark: true }));
      if (THEME === 'village') blocks[blocks.length - 1].kind = 'green';
    } else if (kind === 'highrise') {
      const q = s / 4, HR = ['hr-glass', 'hr-stone', 'hr-dark'];
      [[cx - q, cy - q], [cx + q, cy - q], [cx - q, cy + q], [cx + q, cy + q]].forEach(([x, y]) => objs.push(makeObj('office', x, y, { w: 150, d: 150, hue: R(), spr: HR[Math.floor(R() * 3)], ht: 300 + R() * 140 })));
    } else if (kind === 'office') {
      objs.push(makeObj('office', cx, cy, { w: 180, d: 180, hue: R(), ht: 180 + R() * 120 }));
      [[a + 20, b + 20], [a + s - 20, b + 20], [a + 20, b + s - 20], [a + s - 20, b + s - 20]].forEach(([x, y]) => objs.push(makeObj('tree', x, y, { hue: R() })));
    } else if (kind === 'shops') {
      const q = s / 4;
      [[cx - q, cy - q], [cx + q, cy - q], [cx - q, cy + q], [cx + q, cy + q]].forEach(([x, y]) => objs.push(makeObj('shop', x, y, { w: 110, d: 110, hue: R(), ht: 50 + R() * 60 })));
    } else if (kind === 'plaza') {
      objs.push(makeObj('kiosk', cx, cy, { hue: R() }));
      for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2; objs.push(makeObj('tree', cx + Math.cos(ang) * 95, cy + Math.sin(ang) * 95, { hue: R() })); }
      for (let i = 0; i < 4; i++) { const ang = i / 4 * Math.PI * 2 + 0.4; objs.push(makeObj('bench', cx + Math.cos(ang) * 60, cy + Math.sin(ang) * 60, { angle: ang + Math.PI / 2 })); }
      for (let i = 0; i < 5; i++) objs.push(makeObj(R() < 0.5 ? 'bin' : 'cone', a + R() * s, b + R() * s, { hue: R() < 0.5 ? 0 : 1 }));
      for (let i = 0; i < 6; i++) birds.push({ kind: THEME === 'moon' ? 'alien' : THEME === 'desert' ? 'crab' : THEME === 'village' ? 'duck' : 'pigeon', x: cx + (R() - 0.5) * 150, y: cy + (R() - 0.5) * 150, hx: cx, hy: cy, fly: 0, vx: 0, vy: 0 });
    } else if (kind === 'farm' || kind === 'beach' || kind === 'craters') {
      // open field: big props + small ones, with grazing friends
      blocks[blocks.length - 1].field = true;
      objs.push(makeObj('kiosk', cx - 70, cy - 40, { hue: R() }), makeObj('kiosk', cx + 80, cy + 60, { hue: R() }));
      for (let i = 0; i < 9; i++) objs.push(makeObj(R() < 0.5 ? 'tree' : 'bench', a + 20 + R() * (s - 40), b + 20 + R() * (s - 40), { hue: R() }));
      for (let i = 0; i < 6; i++) objs.push(makeObj(R() < 0.5 ? 'bin' : 'cone', a + R() * s, b + R() * s, { hue: R() }));
      const crit = THEME === 'village' ? 'sheep' : THEME === 'moon' ? 'alien' : 'crab';
      for (let i = 0; i < 5; i++) birds.push({ kind: crit, x: cx + (R() - 0.5) * 200, y: cy + (R() - 0.5) * 200, hx: cx + (R() - 0.5) * 120, hy: cy + (R() - 0.5) * 120, fly: 0, vx: 0, vy: 0 });
    } else if (kind === 'park') {
      if (TH().canal) blocks[blocks.length - 1].pond = { x: cx, y: cy, rx: 150, ry: 70 }; else
      blocks[blocks.length - 1].pond = { x: cx + 30, y: cy + 20, rx: 70, ry: 50 };
      for (let i = 0; i < 10; i++) { const x = a + R() * s, y = b + R() * s; if (Math.hypot(x - cx - 30, y - cy - 20) > 90) objs.push(makeObj('tree', x, y, { hue: R() })); }
      for (let i = 0; i < 3; i++) objs.push(makeObj('bench', a + 30 + i * 70, b + s - 25));
      if (THEME === 'moon') blocks[blocks.length - 1].crater = true;
      for (let i = 0; i < 4; i++) birds.push({ kind: THEME === 'moon' ? 'alien' : 'duck', x: cx + 30 + (R() - 0.5) * 80, y: cy + 20 + (R() - 0.5) * 50, hx: cx + 30, hy: cy + 20, fly: 0, vx: 0, vy: 0 });
      if (R() < 0.6) birds.push({ kind: 'dog', x: a + 40, y: b + 40, hx: cx, hy: cy, fly: 0, vx: 0, vy: 0 });
    }
    const B = blocks[blocks.length - 1];
    if (ORG) { // organic clearing: nudge everything off the grid and give the block a soft blob outline
      const lm = kind === 'tower';
      for (let i = i0; i < objs.length; i++) if (!objs[i].landmark) { objs[i].x += jx + (R() - 0.5) * 30; objs[i].y += jy + (R() - 0.5) * 30; }
      for (let i = k0; i < birds.length; i++) { birds[i].x += jx; birds[i].y += jy; birds[i].hx += jx; birds[i].hy += jy; }
      if (B.pond) { B.pond.x += jx; B.pond.y += jy; }
      B.cx = (lm ? cx : cx + jx); B.cy = (lm ? cy : cy + jy); B.rx = inner * (0.46 + R() * 0.1); B.ry = inner * (0.42 + R() * 0.1); B.rot = (R() - 0.5) * 0.8; B.org = true;
    }
    // pedestrians walking around this block's pavement (organic: round the clearing)
    const nP = 2 + Math.floor(R() * 3);
    for (let i = 0; i < nP; i++) peds.push({ ell: !!ORG, cx: B.cx, cy: B.cy, rx: (B.rx || 0) + 18, ry: (B.ry || 0) + 18, bx: x0, by: y0, s: inner, t: R() * 4, sp: (0.04 + R() * 0.03) * (R() < 0.5 ? 1 : -1), x: 0, y: 0, col: Math.floor(R() * 6), run: 0 });
  }
  if (TH().organic) return organicPaths({ objs, peds, birds, blocks, R });
  // traffic: lanes on every road
  const lanes = [];
  for (let k = 0; k <= N; k++) {
    const o = k * P;
    lanes.push({ dir: 'h', pos: o + 32, sgn: 1 }, { dir: 'h', pos: o + 78, sgn: -1 }, { dir: 'v', pos: o + 32, sgn: -1 }, { dir: 'v', pos: o + 78, sgn: 1 });
  }
  if (TH().canal) for (const l of lanes) if (l.dir === 'h' && l.pos > 2 * P && l.pos < 2 * P + RD) l.canal = true;
  return { objs, peds, birds, blocks, lanes, R };
}
// winding lanes / dune tracks / rover loops instead of a street grid
function pathLane(pts, closed, sgn) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { dir: 'p', pts, cum, L: cum[cum.length - 1], closed, sgn };
}
function organicPaths(c) {
  const S = W.SIZE, C = S / 2, R = c.R, paths = [], ph = R() * 6;
  for (const [rr, a, b] of [[0.2, 0.14, 0.05], [0.37, 0.1, 0.07]]) { // two wobbly loops round the landmark
    const pts = []; for (let i = 0; i <= 140; i++) { const t = i / 140 * Math.PI * 2, r = S * rr * (1 + a * Math.sin(3 * t + ph) + b * Math.sin(5 * t + ph * 2)); pts.push([C + Math.cos(t) * r, C + Math.sin(t) * r]); }
    paths.push({ pts, closed: true });
  }
  const mk = (x0, y0, x1, y1, amp, f) => { const pts = []; for (let i = 0; i <= 90; i++) { const u = i / 90, nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny), w = amp * Math.sin(u * Math.PI * f + ph) ; pts.push([x0 + (x1 - x0) * u + nx / nl * w, y0 + (y1 - y0) * u + ny / nl * w]); } return { pts, closed: false }; };
  paths.push(mk(-200, S * 0.18, S + 200, S * 0.72, 220, 3), mk(S * 0.2, S + 200, S * 0.86, -200, 200, 2.5), mk(-200, S * 0.9, S * 0.55, -200, 160, 2));
  const lanes = []; for (const p of paths) lanes.push(pathLane(p.pts, p.closed, 1), pathLane(p.pts, p.closed, -1));
  // clear anything sitting on a track
  const hw = TH().organic.w / 2 + 6, G = new Map(), key = (x, y) => (Math.floor(x / 120) * 1000 + Math.floor(y / 120));
  for (const l of lanes) for (let d = 0; d < l.L; d += 14) { const q = lanePt(l, d, 0); const k = key(q.x, q.y); (G.get(k) || G.set(k, []).get(k)).push(q); }
  const near = (x, y, r) => { for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) for (const q of G.get(key(x + gx * 120, y + gy * 120)) || []) if (Math.hypot(q.x - x, q.y - y) < r) return true; return false; };
  c.objs = c.objs.filter(o => o.landmark || !near(o.x, o.y, hw + (o.w ? Math.max(o.w, o.d) * 0.45 : o.r * 0.7)));
  const st = lanePt(lanes[2], lanes[2].L * 0.08, 0);
  return Object.assign(c, { lanes, paths, organic: true, start: { x: st.x, y: st.y } });
}
function lanePt(l, s, off) {
  s = ((s % l.L) + l.L) % l.L; let lo = 0, hi = l.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (l.cum[m] <= s) lo = m; else hi = m; }
  const a = l.pts[lo], b = l.pts[hi], u = (s - l.cum[lo]) / Math.max(1e-6, l.cum[hi] - l.cum[lo]), dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
  return { x: a[0] + dx * u - dy / n * off, y: a[1] + dy * u + dx / n * off, ang: Math.atan2(dy, dx) };
}

function spawnVehicle(city, initial) {
  const R = city.R, lane = city.lanes[Math.floor(R() * city.lanes.length)];
  const kind = lane.canal ? 'nboat' : pick(TH().veh, R()), [type, len, wid] = VEH[kind], vs = (TH().vspr || {})[kind];
  const along = lane.dir === 'p' ? R() * lane.L : initial ? R() * W.SIZE : (lane.sgn > 0 ? -60 : W.SIZE + 60);
  const slow = lane.canal ? 0.4 : THEME === 'desert' ? 0.55 : THEME === 'village' && kind === 'tractor' ? 0.5 : 1;
  const speed = (type === 'bus' ? 55 : 80 + R() * 40) * slow * lane.sgn;
  const o = makeObj(type, 0, 0, { lane, along, speed, moving: true, hue: R(), len, wid, kind });
  delete o.spr; delete o.flat; if (vs) { o.vspr = vs[0]; o.sw = vs[1]; o.vleft = !!vs[2]; } if (kind === 'shuttle') o.hover = 1;
  placeVehicle(o); return o;
}
function placeVehicle(o) {
  if (o.lane.dir === 'p') { const q = lanePt(o.lane, o.along, o.lane.sgn * 16); o.x = q.x; o.y = q.y; o.angle = q.ang + (o.speed < 0 ? Math.PI : 0); return; }
  if (o.lane.dir === 'h') { o.x = o.along; o.y = o.lane.pos; o.angle = o.lane.sgn > 0 ? 0 : Math.PI; }
  else { o.y = o.along; o.x = o.lane.pos; o.angle = o.lane.sgn > 0 ? Math.PI / 2 : -Math.PI / 2; }
}

// ---------- drawing ----------
// Angled camera: the ground is foreshortened by TILT; buildings/props are upright sprites.
const TILT = 0.74;
const SPR = {};
const SPR_NAMES = ['v-oak', 'c-sheep', 'c-crab', 'c-alien', 'v-bus', 'b-tram', 'b-nboat', 'v-hay', 'v-postbox', 'v-flowers', 'v-tractor', 'd-palm', 'd-crate', 'd-hut', 'd-boat', 'd-raptor', 'd-trike', 'd-stego', 'd-brachio', 'd-lighthouse', 'd-volcano', 'm-rock', 'm-crate', 'm-dish', 'm-solar', 'm-rover', 'm-shuttle', 'm-dome', 'm-rocket', 'm-hab', 'm-greenhouse', 'hr-glass', 'hr-stone', 'hr-dark', 'car-side', 'car-front', 'car-rear', 'taxi-side', 'taxi-front', 'taxi-rear', 'bus-side', 'bus-front', 'bus-rear', 'office-glass', 'office-stone', 'office-grey', 'tower', 'shop', 'kiosk', 'tree', 'car', 'taxi', 'bus', 'bin', 'lamp', 'bench', 'cone'];
function loadSprites() {
  return Promise.all(SPR_NAMES.map(n => new Promise(res => { const i = new Image(); i.onload = () => { SPR[n] = i; res(); }; i.onerror = res; i.src = 'assets/sprites/' + n + '.png'; })));
}
const SHIRT = ['#e85d5d', '#3f8cff', '#ffcc33', '#4cc28a', '#b46cff', '#ff8a3d'];
const CAR_TINT = [0, 0, 140, 200, 300, -40, 90]; // hue-rotate variants of the blue car

// textures (made once, procedural)
let PAT = null;
function noiseCanvas(size, base, vary, fn) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const id = x.createImageData(size, size), d = id.data;
  for (let i = 0; i < size * size; i++) { const n = (Math.random() - 0.5) * vary; d[i * 4] = base[0] + n; d[i * 4 + 1] = base[1] + n; d[i * 4 + 2] = base[2] + n; d[i * 4 + 3] = 255; }
  x.putImageData(id, 0, 0); if (fn) fn(x, size); return c;
}
const GROUND = {
  city: { asph: [72, 76, 84], pave: [196, 192, 184], plaza: [214, 204, 186], grass: [96, 150, 72], kerb: '#8d8a84' },
  district: { asph: [70, 70, 76], pave: [200, 180, 160], plaza: [190, 160, 130], grass: [96, 150, 72], kerb: '#8a6f5a' },
  village: { asph: [88, 88, 86], pave: [176, 160, 128], plaza: [110, 160, 80], grass: [100, 152, 70], kerb: '#4f7a3a' },
  desert: { asph: [214, 190, 140], pave: [236, 214, 160], plaza: [232, 206, 150], grass: [140, 170, 80], kerb: '#c9a874' },
  moon: { asph: [86, 90, 100], pave: [150, 150, 156], plaza: [170, 170, 176], grass: [128, 128, 134], kerb: '#6d7078' },
};
function makePatterns(ctx) {
  const G = GROUND[THEME];
  const asph = noiseCanvas(128, G.asph, 14, (x, s) => { for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.05)`; x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 0, 7); x.fill(); } });
  const pave = noiseCanvas(64, G.pave, 10, (x, s) => { if (THEME === 'desert' || THEME === 'moon') return craters(x, s); x.strokeStyle = 'rgba(90,85,80,.35)'; x.lineWidth = 1.2; for (let i = 0; i <= s; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); } });
  const plaza = noiseCanvas(96, G.plaza, 10, (x, s) => { if (THEME !== 'city' && THEME !== 'district') return craters(x, s); x.strokeStyle = 'rgba(120,105,90,.3)'; x.lineWidth = 1.5; for (let i = 0; i <= s; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); } x.fillStyle = 'rgba(160,140,120,.25)'; x.fillRect(0, 0, 24, 24); x.fillRect(48, 48, 24, 24); });
  const grass = noiseCanvas(96, G.grass, 30, (x, s) => { for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '40,90,30' : '150,200,100'},.25)`; x.fillRect(Math.random() * s, Math.random() * s, 2, 3); } });
  PAT = {};
  const O = { village: [[92, 140, 62], [118, 160, 78], [150, 128, 84], [184, 160, 116]], desert: [[226, 202, 150], [236, 216, 170], [244, 230, 196], [214, 188, 136]], moon: [[132, 132, 138], [156, 156, 162], [104, 104, 112], [96, 98, 106]] }[THEME];
  if (O) {
    const blade = (x, s, R) => { for (let i = 0; i < 900; i++) { const px = R() * s, py = R() * s; x.strokeStyle = R() < .5 ? 'rgba(40,80,20,.35)' : 'rgba(190,220,120,.3)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - .5) * 3, py - 3 - R() * 4); x.stroke(); } };
    const ripple = (x, s, R) => { x.strokeStyle = 'rgba(150,115,60,.18)'; x.lineWidth = 2; for (let i = 0; i < 26; i++) { const y = R() * s; x.beginPath(); for (let k = 0; k <= s; k += 8) x.lineTo(k, y + Math.sin(k / 22 + i) * 4); x.stroke(); } };
    const pebble = (x, s, R) => { for (let i = 0; i < 260; i++) { x.fillStyle = R() < .5 ? 'rgba(60,45,30,.25)' : 'rgba(255,245,225,.22)'; x.beginPath(); x.ellipse(R() * s, R() * s, 1 + R() * 2.5, 1 + R() * 1.8, R() * 3, 0, 7); x.fill(); } };
    const pits = (x, s, R) => { for (let i = 0; i < 26; i++) { const px = R() * s, py = R() * s, r = 2 + R() * 10; x.fillStyle = 'rgba(40,40,50,.22)'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 1.5; x.beginPath(); x.arc(px - 1, py - 1, r, 3.4, 5.6); x.stroke(); } pebble(x, s, R); };
    const ground = THEME === 'village' ? blade : THEME === 'desert' ? ripple : pits;
    PAT.obase = ctx.createPattern(richTex(256, O[0], 11, ground), 'repeat');
    PAT.oclear = ctx.createPattern(richTex(256, O[1], 23, ground), 'repeat');
    PAT.ofield = ctx.createPattern(richTex(256, O[2], 37, THEME === 'village' ? (x, s, R) => { x.strokeStyle = 'rgba(80,60,30,.35)'; x.lineWidth = 5; for (let k = 0; k < s; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, s); x.stroke(); } pebble(x, s, R); } : ground), 'repeat');
    PAT.opath = ctx.createPattern(richTex(128, O[3], 51, pebble), 'repeat');
  }
  Object.assign(PAT, { asph: ctx.createPattern(asph, 'repeat'), pave: ctx.createPattern(pave, 'repeat'), plaza: ctx.createPattern(plaza, 'repeat'), grass: ctx.createPattern(grass, 'repeat') });
}

// layered painterly texture: soft light/dark blotches at several scales + fine detail strokes
function richTex(size, base, seed, detail) {
  const c = noiseCanvas(size, base, 10), x = c.getContext('2d'); let r = seed;
  const R = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (const [n, rad, a] of [[14, 60, .10], [40, 26, .09], [160, 8, .08]]) for (let i = 0; i < n; i++) {
    const px = R() * size, py = R() * size, rr = rad * (0.6 + R()), lt = R() < .5, g = x.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, lt ? `rgba(255,248,220,${a})` : `rgba(20,25,10,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { x.save(); x.translate(ox, oy); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); x.restore(); }
  }
  if (detail) detail(x, size, R); return c;
}
function craters(x, s) {
  for (let i = 0; i < (THEME === 'moon' ? 6 : 30); i++) { const r = THEME === 'moon' ? 3 + Math.random() * 8 : 1 + Math.random() * 2, px = Math.random() * s, py = Math.random() * s;
    x.fillStyle = THEME === 'moon' ? 'rgba(40,40,50,.25)' : THEME === 'village' ? 'rgba(60,110,40,.3)' : 'rgba(150,120,70,.25)'; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    if (THEME === 'moon') { x.strokeStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(px - 1, py - 1, r, 3.4, 5.6); x.stroke(); } }
}
// called with the ground transform (y squashed by TILT)
function drawGround(ctx, city, view) {
  if (!PAT) makePatterns(ctx);
  const S = W.SIZE;
  if (city.organic) return drawOrganicGround(ctx, city, view);
  ctx.fillStyle = PAT.asph; ctx.fillRect(-600, -600, S + 1200, S + 1200);
  for (let k = 0; k <= W.N; k++) {
    const o = k * W.PITCH;
    if (!TH().marks) continue;
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let t = 0; t < S; t += 48) { if ((t % W.PITCH) < W.ROAD + 10) continue; ctx.fillRect(t, o + W.ROAD / 2 - 2, 26, 4); ctx.fillRect(o + W.ROAD / 2 - 2, t, 4, 26); }
    ctx.fillStyle = 'rgba(240,200,60,.8)'; // yellow edge lines
    ctx.fillRect(0, o + 8, S, 2); ctx.fillRect(0, o + W.ROAD - 10, S, 2); ctx.fillRect(o + 8, 0, 2, S); ctx.fillRect(o + W.ROAD - 10, 0, 2, S);
  }
  for (const b of city.blocks) {
    if (b.x0 > view.x1 || b.x0 + b.s < view.x0 || b.y0 > view.y1 || b.y0 + b.s < view.y0) continue;
    // zebra crossings on approach to each junction
    ctx.fillStyle = TH().marks ? 'rgba(250,250,250,.85)' : 'rgba(0,0,0,0)';
    for (let i = 0; i < 7; i++) { ctx.fillRect(b.x0 - W.ROAD + 14 + i * 12, b.y0 - 26, 7, 20); ctx.fillRect(b.x0 - 26, b.y0 - W.ROAD + 14 + i * 12, 20, 7); }
    // kerb + pavement
    ctx.fillStyle = GROUND[THEME].kerb; ctx.fillRect(b.x0 - 3, b.y0 - 3, b.s + 6, b.s + 6);
    ctx.fillStyle = PAT.pave; ctx.fillRect(b.x0, b.y0, b.s, b.s);
    const p = W.PAVE;
    ctx.fillStyle = b.kind === 'park' || b.kind === 'green' || b.field ? PAT.grass : b.kind === 'plaza' || b.kind === 'tower' ? PAT.plaza : PAT.pave;
    ctx.fillRect(b.x0 + p, b.y0 + p, b.s - 2 * p, b.s - 2 * p);
    if (b.kind === 'park') { ctx.strokeStyle = 'rgba(210,195,160,.9)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(b.x0 + p, b.y0 + b.s / 2 + 60); ctx.quadraticCurveTo(b.x0 + b.s / 2, b.y0 + b.s / 2 - 90, b.x0 + b.s - p, b.y0 + p + 40); ctx.stroke(); }
    if (b.pond && !TH().canal) {
      ctx.fillStyle = '#7d776c'; ctx.beginPath(); ctx.ellipse(b.pond.x, b.pond.y, b.pond.rx + 6, b.pond.ry + 6, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(b.pond.x - 20, b.pond.y - 15, 5, b.pond.x, b.pond.y, b.pond.rx); g.addColorStop(0, b.crater ? '#8e8e94' : '#7fd0ea'); g.addColorStop(1, b.crater ? '#4c4c55' : '#2f7fa8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.pond.x, b.pond.y, b.pond.rx, b.pond.ry, 0, 0, 7); ctx.fill();
    }
  }
  if (TH().canal) drawCanal(ctx);
}
// canal through Bridge District: water down one road, with brick bridges where streets cross
function drawCanal(ctx) {
  const y = 2 * W.PITCH, S = W.SIZE;
  ctx.fillStyle = '#7a5a46'; ctx.fillRect(-600, y - 4, S + 1200, W.ROAD + 8);
  const g = ctx.createLinearGradient(0, y, 0, y + W.ROAD); g.addColorStop(0, '#2f6f86'); g.addColorStop(0.5, '#4f97ad'); g.addColorStop(1, '#2f6f86');
  ctx.fillStyle = g; ctx.fillRect(-600, y + 6, S + 1200, W.ROAD - 12);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 2; for (let x = -600; x < S + 600; x += 70) { ctx.beginPath(); ctx.moveTo(x, y + 30 + (x % 3) * 12); ctx.lineTo(x + 26, y + 30 + (x % 3) * 12); ctx.stroke(); }
  for (let k = 0; k <= W.N; k++) { const x = k * W.PITCH; ctx.fillStyle = '#8a6450'; ctx.fillRect(x - 6, y - 6, W.ROAD + 12, W.ROAD + 12); ctx.fillStyle = PAT.asph; ctx.fillRect(x + 4, y - 6, W.ROAD - 8, W.ROAD + 12); ctx.fillStyle = '#a77a5e'; ctx.fillRect(x - 6, y - 6, 10, W.ROAD + 12); ctx.fillRect(x + W.ROAD - 4, y - 6, 10, W.ROAD + 12); }
}
function drawOrganicGround(ctx, city, view) {
  const S = W.SIZE, O = TH().organic;
  ctx.fillStyle = PAT.obase; ctx.fillRect(-600, -600, S + 1200, S + 1200);
  const blob = (b, grow) => { ctx.beginPath(); ctx.ellipse(0, 0, b.rx + grow, b.ry + grow, 0, 0, 7); };
  for (const b of city.blocks) {
    if (b.cx + b.rx + 60 < view.x0 || b.cx - b.rx - 60 > view.x1 || b.cy + b.ry + 60 < view.y0 || b.cy - b.ry - 60 > view.y1) continue;
    const fill = b.field ? PAT.ofield : PAT.oclear;
    ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(b.rot);
    // feathered edge: a few widening translucent passes
    for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.22; ctx.fillStyle = fill; blob(b, k * 10); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = fill; blob(b, 0); ctx.fill();
    // soft inner shading for depth
    const g = ctx.createRadialGradient(-b.rx * .3, -b.ry * .35, 10, 0, 0, Math.max(b.rx, b.ry));
    g.addColorStop(0, 'rgba(255,250,225,.16)'); g.addColorStop(1, 'rgba(30,25,10,.14)'); ctx.fillStyle = g; blob(b, 0); ctx.fill();
    if (THEME === 'moon' && b.field) for (const [u, v, r] of [[-60, -30, 60], [70, 40, 46], [10, 90, 30]]) {
      const cg = ctx.createRadialGradient(u - r * .3, v - r * .3, r * .1, u, v, r); cg.addColorStop(0, '#55565e'); cg.addColorStop(.85, '#76777f'); cg.addColorStop(1, 'rgba(190,190,198,.9)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(u, v, r, r * .8, 0, 0, 7); ctx.fill(); }
    if (THEME === 'desert' && b.field) { const wg = ctx.createRadialGradient(b.rx * .35, b.ry * .3, 4, b.rx * .35, b.ry * .3, b.rx * .45); wg.addColorStop(0, 'rgba(60,170,190,.85)'); wg.addColorStop(.7, 'rgba(90,190,200,.6)'); wg.addColorStop(1, 'rgba(240,230,200,0)'); ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(b.rx * .35, b.ry * .3, b.rx * .45, b.ry * .34, .3, 0, 7); ctx.fill(); }
    ctx.restore();
    if (b.pond) { const g2 = ctx.createRadialGradient(b.pond.x - 20, b.pond.y - 15, 5, b.pond.x, b.pond.y, b.pond.rx); g2.addColorStop(0, b.crater ? '#8e8e94' : '#86c9d8'); g2.addColorStop(.8, b.crater ? '#4c4c55' : '#3b7f95'); g2.addColorStop(1, b.crater ? '#9a9aa2' : '#5c6d4a');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(b.pond.x, b.pond.y, b.pond.rx, b.pond.ry, 0, 0, 7); ctx.fill(); }
  }
  // tracks: soft dark verge, textured surface, worn centre
  ctx.lineCap = ctx.lineJoin = 'round';
  const trace = p => { ctx.beginPath(); p.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); };
  for (const [w, st, a] of [[O.w + 22, 'rgba(40,30,15,1)', .08], [O.w + 10, 'rgba(40,30,15,1)', .12], [O.w, PAT.opath, 1]]) { ctx.globalAlpha = a; ctx.strokeStyle = st; ctx.lineWidth = w; city.paths.forEach(trace); }
  ctx.globalAlpha = 1;
  if (O.tyre) { ctx.strokeStyle = 'rgba(40,42,50,.35)'; ctx.lineWidth = 6; }
  else { ctx.strokeStyle = THEME === 'village' ? 'rgba(90,130,50,.35)' : 'rgba(255,250,235,.18)'; ctx.lineWidth = THEME === 'village' ? 8 : 18; }
  for (const p of city.paths) for (const off of O.tyre ? [-14, 14] : [0]) { ctx.beginPath(); p.pts.forEach((q, i, a) => { const n = a[Math.min(i + 1, a.length - 1)], m = a[Math.max(i - 1, 0)], dx = n[0] - m[0], dy = n[1] - m[1], l = Math.hypot(dx, dy) || 1, x = q[0] - dy / l * off, y = q[1] + dx / l * off; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
}
// soft ground shadows for upright things (ground transform)
function drawShadow(ctx, o) {
  const w = o.w || o.r * 2, sx = (o.ht || 10) * 0.55;
  ctx.fillStyle = 'rgba(10,15,30,.28)';
  if (o.w) { ctx.beginPath(); ctx.moveTo(o.x - w / 2, o.y + o.d / 2); ctx.lineTo(o.x + w / 2, o.y + o.d / 2); ctx.lineTo(o.x + w / 2 + sx, o.y + o.d / 2 + sx * 0.6); ctx.lineTo(o.x + w / 2 + sx, o.y - o.d / 2 + sx * 0.6); ctx.lineTo(o.x + w / 2, o.y - o.d / 2); ctx.closePath(); ctx.fill(); ctx.fillRect(o.x - w / 2, o.y - o.d / 2, w, o.d); }
  else { ctx.beginPath(); ctx.ellipse(o.x + sx * 0.4, o.y + sx * 0.25, o.r * 1.1, o.r * 0.8, 0, 0, 7); ctx.fill(); }
}

const SPRITE_W = { tower: 270, shop: 128, kiosk: 82, tree: 54, lamp: 12, bin: 22, bench: 40, cone: 16 };
function spriteFor(o) {
  if (o.spr) return o.spr;
  if (o.type === 'office') return o.hue < 0.4 ? 'office-glass' : o.hue < 0.7 ? 'office-stone' : 'office-grey';
  return o.type;
}
// upright sprite metrics in "upright space" (x, y*TILT); returns {img,w,h,bx,by}
function spriteBox(o) {
  const img = SPR[spriteFor(o)]; if (!img) return null;
  const w = o.sw ? o.sw : o.spr ? o.w * 1.3 : o.type !== 'tower' && o.w ? o.w * 1.12 : SPRITE_W[o.type] || 30;
  const h = w * img.height / img.width;
  const by = o.y * TILT + (o.d ? o.d * TILT * 0.5 : 4);
  return { img, w, h, bx: o.x, by };
}
// vehicles: top-down sprites in ground space
function drawVehicle(ctx, o) {
  const img = SPR[o.type]; if (!img) return;
  ctx.rotate(o.angle);
  ctx.fillStyle = 'rgba(10,15,30,.3)'; ctx.fillRect(-o.len / 2 + 3, -o.wid / 2 + 3, o.len, o.wid);
  if (o.type === 'car' && o.hue > 0.15) ctx.filter = `hue-rotate(${CAR_TINT[Math.floor(o.hue * CAR_TINT.length)]}deg) saturate(${o.hue > 0.85 ? 0.1 : 1})`;
  ctx.drawImage(img, -o.len / 2, -o.wid / 2, o.len, o.wid);
  ctx.filter = 'none';
}
function vehView(o) {
  const cx = Math.cos(o.angle), sy = Math.sin(o.angle), right = cx > 0;
  if (o.vspr) return { img: SPR[o.vspr], w: o.sw, flip: !right !== !!o.vleft };
  const t = o.type, h = o.lane.dir === 'h' || (o.lane.dir === 'p' && Math.abs(cx) > 0.55);
  if (h) return { img: SPR[t + '-side'], w: t === 'bus' ? 112 : 56, flip: !right !== (t === 'bus') };
  return { img: SPR[t + (sy > 0 ? '-front' : '-rear')], w: t === 'bus' ? 80 : 28, flip: false };
}
function drawVehicleUp(ctx, o) { // upright space, origin at vehicle ground point
  const v = vehView(o); if (!v.img) return;
  const h = v.w * v.img.height / v.img.width;
  if (o.hover) ctx.translate(0, -18 - Math.sin(performance.now() / 300 + o.hue * 9) * 5);
  if (v.flip) ctx.scale(-1, 1);
  if (o.vspr) { ctx.drawImage(v.img, -v.w / 2, -h * 0.9, v.w, h); return; }
  ctx.drawImage(o.type === 'car' && o.hue > 0.15 ? tinted(v.img, o.hue) : v.img, -v.w / 2, -h * 0.72, v.w, h);
}
function drawVehShadow(ctx, o) { // ground space
  ctx.fillStyle = 'rgba(10,15,30,.35)'; ctx.save(); ctx.translate(o.x + 4, o.y + 4); ctx.rotate(o.angle); ctx.fillRect(-o.len / 2, -o.wid / 2, o.len, o.wid); ctx.restore();
}
// cracked tarmac + glow around the hole (ground space)
const CRACKS = (() => { const r = rng(99), out = []; for (let i = 0; i < 26; i++) { let a = i / 26 * Math.PI * 2 + r() * 0.2, d = 1, pts = [[Math.cos(a), Math.sin(a)]]; const L = 1.35 + r() * 0.75; while (d < L) { d += 0.12 + r() * 0.12; a += (r() - 0.5) * 0.35; pts.push([Math.cos(a) * d, Math.sin(a) * d]); } out.push(pts); if (r() < 0.5) { const k = 1 + Math.floor(r() * (pts.length - 1)), b = a + (r() < .5 ? .6 : -.6); out.push([pts[k], [pts[k][0] + Math.cos(b) * .3, pts[k][1] + Math.sin(b) * .3]]); } } return out; })();
function drawCracks(ctx, x, y, R, col) {
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 1.45); g.addColorStop(0, 'rgba(20,18,16,.55)'); g.addColorStop(1, 'rgba(20,18,16,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.45, 0, 7); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? 'rgba(28,26,26,.75)' : 'rgba(200,200,205,.22)'; ctx.lineWidth = Math.max(1.4, R * (pass ? 0.03 : 0.07));
    for (const c of CRACKS) { ctx.beginPath(); c.forEach(([px, py], i) => i ? ctx.lineTo(px * R, py * R) : ctx.moveTo(px * R, py * R)); ctx.stroke(); }
  }
  // broken slabs tilting into the hole
  ctx.fillStyle = 'rgba(60,62,68,.95)';
  for (let i = 0; i < 12; i++) { const a = i / 12 * 7 + 0.3; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(R * 0.98, -R * 0.12); ctx.lineTo(R * 1.12, -R * 0.08); ctx.lineTo(R * 1.1, R * 0.1); ctx.lineTo(R * 0.97, R * 0.13); ctx.closePath(); ctx.fill(); ctx.restore(); }
  const gl = ctx.createRadialGradient(0, 0, R * 0.85, 0, 0, R * 1.3); gl.addColorStop(0, col + 'cc'); gl.addColorStop(0.4, col + '55'); gl.addColorStop(1, col + '00');
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, R * 1.3, 0, 7); ctx.fill();
  ctx.restore();
}
function drawObj(ctx, o) { // generic, used for falling items (ground space)
  if (o.moving) { drawVehicleUp(ctx, o); return; }
  const sb = spriteBox(o); if (!sb) return;
  ctx.drawImage(sb.img, -sb.w / 2, -sb.h * 0.8, sb.w, sb.h);
}
// people and birds in upright space
function drawPed(ctx, p, t) {
  const ph = t * (p.run ? 16 : 9) + p.t * 50, sw = Math.sin(ph) * (p.run ? 3 : 2);
  ctx.fillStyle = 'rgba(10,15,30,.3)'; ctx.beginPath(); ctx.ellipse(2, 1, 6, 2.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2d3442'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-1.5, -9); ctx.lineTo(-1.5 + sw, 0); ctx.moveTo(1.5, -9); ctx.lineTo(1.5 - sw, 0); ctx.stroke();
  if (THEME === 'moon') { ctx.fillStyle = '#f4f6f8'; roundRect(ctx, -5.5, -21, 11, 13, 4); ctx.fill(); ctx.fillStyle = SHIRT[p.col]; ctx.fillRect(-5.5, -15, 11, 2); ctx.fillStyle = '#f4f6f8'; ctx.beginPath(); ctx.arc(0, -25, 5.5, 0, 7); ctx.fill(); ctx.fillStyle = '#3a5a8a'; ctx.beginPath(); ctx.ellipse(1, -25, 3.6, 2.8, 0, 0, 7); ctx.fill(); return; }
  ctx.fillStyle = SHIRT[p.col]; roundRect(ctx, -4.5, -20, 9, 12, 3); ctx.fill();
  ctx.strokeStyle = SHIRT[p.col]; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4.5, -18); ctx.lineTo(-5.5 - sw * 0.5, -11); ctx.moveTo(4.5, -18); ctx.lineTo(5.5 + sw * 0.5, -11); ctx.stroke();
  ctx.fillStyle = ['#f1c9a5', '#c68e65', '#8d5a3b', '#e8b98f'][p.col % 4]; ctx.beginPath(); ctx.arc(0, -24, 4, 0, 7); ctx.fill();
  ctx.fillStyle = ['#3a2a1e', '#1d1d1d', '#a0622c', '#d8b25a'][p.col % 4]; ctx.beginPath(); ctx.arc(0, -25, 4, Math.PI, 0); ctx.fill();
}
const CRIT = { sheep: ['c-sheep', 26], crab: ['c-crab', 20], alien: ['c-alien', 13] };
function drawBird(ctx, b, t) {
  ctx.fillStyle = 'rgba(10,15,30,.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 8, 3, 0, 0, 7); ctx.fill();
  const cs = CRIT[b.kind], im = cs && SPR[cs[0]];
  if (im) { const w = cs[1], h = w * im.height / im.width, bob = Math.abs(Math.sin(t * 5 + b.hx)) * 1.5; ctx.save(); if ((b.vx || 0) < 0) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h - bob + 2, w, h); ctx.restore(); return; }
  if (b.kind === 'sheep') {
    ctx.fillStyle = '#f2efe6'; for (const [x, y, r] of [[-5, -8, 6], [2, -10, 7], [7, -7, 5], [-1, -5, 6]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#2b2622'; ctx.beginPath(); ctx.ellipse(12, -10, 3.5, 4.5, 0.3, 0, 7); ctx.fill(); ctx.fillRect(-4, -3, 2, 4); ctx.fillRect(5, -3, 2, 4);
  } else if (b.kind === 'alien') {
    const w = Math.sin(t * 4 + b.hx) * 1.5;
    ctx.fillStyle = '#7fd65a'; ctx.beginPath(); ctx.ellipse(w * .3, -9, 6, 9, w * .05, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7fd65a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -17); ctx.lineTo(-4 + w, -23); ctx.moveTo(2, -17); ctx.lineTo(4 + w, -23); ctx.stroke();
    ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.arc(-4 + w, -23, 1.8, 0, 7); ctx.arc(4 + w, -23, 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -11, 3.2, 0, 7); ctx.fill(); ctx.fillStyle = '#223'; ctx.beginPath(); ctx.arc(0.6, -11, 1.6, 0, 7); ctx.fill();
  } else if (b.kind === 'crab') {
    const l = Math.sin(t * 14 + b.hx) * 1.2;
    ctx.fillStyle = '#e8643a'; ctx.beginPath(); ctx.ellipse(0, -4, 7, 4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#c94e2a'; ctx.lineWidth = 1.4; ctx.beginPath(); for (const sx of [-1, 1]) for (const k of [0, 3]) { ctx.moveTo(sx * 5, -3 + k * .5); ctx.lineTo(sx * (9 + l), 0 + k * .5); } ctx.stroke();
    ctx.beginPath(); ctx.arc(-8, -7, 2.4, 0, 7); ctx.arc(8, -7, 2.4, 0, 7); ctx.fill();
  } else if (b.kind === 'duck') {
    ctx.fillStyle = '#7a5c3f'; ctx.beginPath(); ctx.ellipse(0, -3, 8, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f7a46'; ctx.beginPath(); ctx.arc(6, -9, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#f2b23a'; ctx.fillRect(9, -9.5, 4, 2);
  } else if (b.kind === 'dog') {
    ctx.fillStyle = '#b8834f'; ctx.beginPath(); ctx.ellipse(0, -7, 10, 5, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(9, -12, 5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b8834f'; ctx.lineWidth = 2.5; const l = Math.sin(t * 20) * (b.fly > 0 ? 3 : 0.5); ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-6 + l, 1); ctx.moveTo(6, -4); ctx.lineTo(6 - l, 1); ctx.stroke();
    ctx.fillStyle = '#6e4a2a'; ctx.beginPath(); ctx.ellipse(11, -16, 2, 3.5, 0.4, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(13.5, -12, 1.2, 0, 7); ctx.fill();
  } else {
    const lift = b.fly > 0 ? -14 : 0, flap = b.fly > 0 ? Math.abs(Math.sin(t * 40)) : 0;
    ctx.fillStyle = '#7f8794'; ctx.beginPath(); ctx.ellipse(0, -4 + lift, 5.5, 3.8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5d6672'; ctx.beginPath(); ctx.arc(4.5, -7 + lift, 2.6, 0, 7); ctx.fill();
    if (flap) { ctx.fillStyle = '#a3abb6'; ctx.beginPath(); ctx.ellipse(-1, -7 + lift, 3, 8 * flap, 0.3, 0, 7); ctx.fill(); }
  }
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${Math.min(255, r * f) | 0},${Math.min(255, g * f) | 0},${Math.min(255, b * f) | 0})`;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

// silhouette cache for cast shadows
const SIL = new Map();
function silhouette(img) {
  let c = SIL.get(img); if (c) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#0a0f1e'; x.fillRect(0, 0, c.width, c.height);
  SIL.set(img, c); return c;
}
// lays the sprite's silhouette flat on the floor from its base line, sheared away from the sun
function castShadow(ctx, img, bx, by, w, h, rot, flip) {
  ctx.save(); ctx.translate(bx, by); if (rot) ctx.rotate(rot);
  ctx.transform(1, 0, -0.75, -0.32, 0, 0); // height -> along the floor, down-right
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = 0.38; ctx.drawImage(silhouette(img), -w / 2, -h, w, h);
  ctx.restore();
}

// ctx.filter is very slow on iPad Safari, so car colour variants are baked once into cached canvases
const TINT = new Map();
function tinted(img, hue) {
  const i = Math.floor(hue * CAR_TINT.length), key = img.src + i; let c = TINT.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
  x.filter = `hue-rotate(${CAR_TINT[i]}deg) saturate(${hue > 0.85 ? 0.1 : 1})`; x.drawImage(img, 0, 0);
  TINT.set(key, c); return c;
}
// Ground is static, so it is rendered once into 512px tiles at three zoom levels and reused every frame
const GT = new Map(); let gtFrame = 0;
function drawGroundCached(ctx, s, ox, oy, view) {
  const q = s > 1.3 ? 2 : s > 0.65 ? 1 : 0.5, T = 512 / q, pad = 2; gtFrame++;
  const vx0 = view.x0 + 150, vx1 = view.x1 - 150, vy0 = view.y0 + 150, vy1 = Math.min(view.y1 - 1300, W.SIZE + 600);
  ctx.setTransform(s, 0, 0, s * TILT, ox, oy); ctx.imageSmoothingEnabled = true;
  for (let ty = Math.floor(vy0 / T); ty * T < vy1; ty++) for (let tx = Math.floor(vx0 / T); tx * T < vx1; tx++) {
    const key = q + ':' + tx + ':' + ty; let t = GT.get(key);
    if (!t) {
      const c = document.createElement('canvas'); c.width = c.height = 512 + pad * 2; const x = c.getContext('2d');
      x.setTransform(q, 0, 0, q, -tx * T * q + pad, -ty * T * q + pad);
      drawGround(x, CITY_FOR_TILES, { x0: tx * T - 260, x1: (tx + 1) * T + 260, y0: ty * T - 260, y1: (ty + 1) * T + 260 });
      t = { c }; GT.set(key, t);
      if (GT.size > 48) { let old = null, ok = null; for (const [k2, v] of GT) if (!old || v.u < old.u) { old = v; ok = k2; } GT.delete(ok); }
    }
    t.u = gtFrame;
    ctx.drawImage(t.c, pad, pad, 512, 512, tx * T, ty * T, T + 0.6 / s, T + 0.6 / s);
  }
}
let CITY_FOR_TILES = null;
function setGroundCity(c) { CITY_FOR_TILES = c; GT.clear(); }
// crack ring around the hole: drawn once into a sprite, then rotated slowly each frame
const CRK = new Map();
function drawCrackSprite(ctx, x, y, R, col, t) {
  let c = CRK.get(col);
  if (!c) { c = document.createElement('canvas'); c.width = c.height = 400; const k = c.getContext('2d'); drawCracks(k, 200, 200, 100, col); CRK.set(col, c); }
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6); const S = R * 4 * (1 + Math.sin(t * 3) * 0.04); ctx.drawImage(c, -S / 2, -S / 2, S, S); ctx.restore();
}
