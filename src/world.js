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
const LEVEL_NEED = [0, 5, 20, 60, 130, 220, 330, 460, 1e9];

function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

function makeObj(type, x, y, extra = {}) {
  const T = TYPES[type];
  return Object.assign({ type, x, y, size: T.size, r: T.r, ht: T.ht, angle: 0, state: 'idle', ft: 0, wob: 0, hue: 0 }, extra);
}

function buildCity(seed = 7) {
  const R = rng(seed), objs = [], peds = [], birds = [], blocks = [];
  const P = W.PITCH, RD = W.ROAD, N = W.N, inner = P - RD;
  const mid = Math.floor(N / 2);
  for (let bx = 0; bx < N; bx++) for (let by = 0; by < N; by++) {
    const x0 = bx * P + RD, y0 = by * P + RD, cx = x0 + inner / 2, cy = y0 + inner / 2;
    let kind;
    if (bx === mid && by === mid) kind = 'tower';
    else if ((bx + by * 3) % 5 === 1) kind = 'park';
    else { const v = R(); kind = v < 0.45 ? 'highrise' : v < 0.6 ? 'office' : v < 0.85 ? 'shops' : 'plaza'; }
    blocks.push({ x0, y0, s: inner, kind });
    // pavement furniture on all four edges
    const e = W.PAVE / 2;
    for (let k = 30; k < inner - 20; k += 45) {
      const pts = [[x0 + k, y0 + e], [x0 + k, y0 + inner - e], [x0 + e, y0 + k], [x0 + inner - e, y0 + k]];
      for (const [px, py] of pts) {
        const v = R();
        if (v < 0.22) objs.push(makeObj('lamp', px, py));
        else if (v < 0.42) objs.push(makeObj('bin', px, py, { hue: R() < 0.5 ? 0 : 1 }));
        else if (v < 0.58) objs.push(makeObj('cone', px, py));
        else if (v < 0.62) objs.push(makeObj('tree', px, py, { hue: R() }));
      }
    }
    const ins = W.PAVE + 6, a = x0 + ins, b = y0 + ins, s = inner - ins * 2;
    if (kind === 'tower') {
      objs.push(makeObj('tower', cx, cy, { w: 250, d: 250, landmark: true }));
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
      for (let i = 0; i < 6; i++) birds.push({ kind: 'pigeon', x: cx + (R() - 0.5) * 150, y: cy + (R() - 0.5) * 150, hx: cx, hy: cy, fly: 0, vx: 0, vy: 0 });
    } else if (kind === 'park') {
      blocks[blocks.length - 1].pond = { x: cx + 30, y: cy + 20, rx: 70, ry: 50 };
      for (let i = 0; i < 10; i++) { const x = a + R() * s, y = b + R() * s; if (Math.hypot(x - cx - 30, y - cy - 20) > 90) objs.push(makeObj('tree', x, y, { hue: R() })); }
      for (let i = 0; i < 3; i++) objs.push(makeObj('bench', a + 30 + i * 70, b + s - 25));
      for (let i = 0; i < 4; i++) birds.push({ kind: 'duck', x: cx + 30 + (R() - 0.5) * 80, y: cy + 20 + (R() - 0.5) * 50, hx: cx + 30, hy: cy + 20, fly: 0, vx: 0, vy: 0 });
      if (R() < 0.6) birds.push({ kind: 'dog', x: a + 40, y: b + 40, hx: cx, hy: cy, fly: 0, vx: 0, vy: 0 });
    }
    // pedestrians walking around this block's pavement
    const nP = 2 + Math.floor(R() * 3);
    for (let i = 0; i < nP; i++) peds.push({ bx: x0, by: y0, s: inner, t: R() * 4, sp: (0.04 + R() * 0.03) * (R() < 0.5 ? 1 : -1), x: 0, y: 0, col: Math.floor(R() * 6), run: 0 });
  }
  // traffic: lanes on every road
  const lanes = [];
  for (let k = 0; k <= N; k++) {
    const o = k * P;
    lanes.push({ dir: 'h', pos: o + 32, sgn: 1 }, { dir: 'h', pos: o + 78, sgn: -1 }, { dir: 'v', pos: o + 32, sgn: -1 }, { dir: 'v', pos: o + 78, sgn: 1 });
  }
  return { objs, peds, birds, blocks, lanes, R };
}

function spawnVehicle(city, initial) {
  const R = city.R, lane = city.lanes[Math.floor(R() * city.lanes.length)];
  const v = R(), type = v < 0.62 ? 'car' : v < 0.82 ? 'taxi' : 'bus';
  const along = initial ? R() * W.SIZE : (lane.sgn > 0 ? -60 : W.SIZE + 60);
  const speed = (type === 'bus' ? 55 : 80 + R() * 40) * lane.sgn;
  const o = makeObj(type, 0, 0, { lane, along, speed, moving: true, hue: R(), len: type === 'bus' ? 96 : 48, wid: type === 'bus' ? 28 : (type === 'taxi' ? 22 : 24) });
  placeVehicle(o); return o;
}
function placeVehicle(o) {
  if (o.lane.dir === 'h') { o.x = o.along; o.y = o.lane.pos; o.angle = o.lane.sgn > 0 ? 0 : Math.PI; }
  else { o.y = o.along; o.x = o.lane.pos; o.angle = o.lane.sgn > 0 ? Math.PI / 2 : -Math.PI / 2; }
}

// ---------- drawing ----------
// Angled camera: the ground is foreshortened by TILT; buildings/props are upright sprites.
const TILT = 0.74;
const SPR = {};
const SPR_NAMES = ['hr-glass', 'hr-stone', 'hr-dark', 'car-side', 'car-front', 'car-rear', 'taxi-side', 'taxi-front', 'taxi-rear', 'bus-side', 'bus-front', 'bus-rear', 'office-glass', 'office-stone', 'office-grey', 'tower', 'shop', 'kiosk', 'tree', 'car', 'taxi', 'bus', 'bin', 'lamp', 'bench', 'cone'];
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
function makePatterns(ctx) {
  const asph = noiseCanvas(128, [72, 76, 84], 14, (x, s) => { for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.05)`; x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 0, 7); x.fill(); } });
  const pave = noiseCanvas(64, [196, 192, 184], 10, (x, s) => { x.strokeStyle = 'rgba(90,85,80,.35)'; x.lineWidth = 1.2; for (let i = 0; i <= s; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); } });
  const plaza = noiseCanvas(96, [214, 204, 186], 10, (x, s) => { x.strokeStyle = 'rgba(120,105,90,.3)'; x.lineWidth = 1.5; for (let i = 0; i <= s; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); } x.fillStyle = 'rgba(160,140,120,.25)'; x.fillRect(0, 0, 24, 24); x.fillRect(48, 48, 24, 24); });
  const grass = noiseCanvas(96, [96, 150, 72], 30, (x, s) => { for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '40,90,30' : '150,200,100'},.25)`; x.fillRect(Math.random() * s, Math.random() * s, 2, 3); } });
  PAT = { asph: ctx.createPattern(asph, 'repeat'), pave: ctx.createPattern(pave, 'repeat'), plaza: ctx.createPattern(plaza, 'repeat'), grass: ctx.createPattern(grass, 'repeat') };
}

// called with the ground transform (y squashed by TILT)
function drawGround(ctx, city, view) {
  if (!PAT) makePatterns(ctx);
  const S = W.SIZE;
  ctx.fillStyle = PAT.asph; ctx.fillRect(-600, -600, S + 1200, S + 1200);
  for (let k = 0; k <= W.N; k++) {
    const o = k * W.PITCH;
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let t = 0; t < S; t += 48) { if ((t % W.PITCH) < W.ROAD + 10) continue; ctx.fillRect(t, o + W.ROAD / 2 - 2, 26, 4); ctx.fillRect(o + W.ROAD / 2 - 2, t, 4, 26); }
    ctx.fillStyle = 'rgba(240,200,60,.8)'; // yellow edge lines
    ctx.fillRect(0, o + 8, S, 2); ctx.fillRect(0, o + W.ROAD - 10, S, 2); ctx.fillRect(o + 8, 0, 2, S); ctx.fillRect(o + W.ROAD - 10, 0, 2, S);
  }
  for (const b of city.blocks) {
    if (b.x0 > view.x1 || b.x0 + b.s < view.x0 || b.y0 > view.y1 || b.y0 + b.s < view.y0) continue;
    // zebra crossings on approach to each junction
    ctx.fillStyle = 'rgba(250,250,250,.85)';
    for (let i = 0; i < 7; i++) { ctx.fillRect(b.x0 - W.ROAD + 14 + i * 12, b.y0 - 26, 7, 20); ctx.fillRect(b.x0 - 26, b.y0 - W.ROAD + 14 + i * 12, 20, 7); }
    // kerb + pavement
    ctx.fillStyle = '#8d8a84'; ctx.fillRect(b.x0 - 3, b.y0 - 3, b.s + 6, b.s + 6);
    ctx.fillStyle = PAT.pave; ctx.fillRect(b.x0, b.y0, b.s, b.s);
    const p = W.PAVE;
    ctx.fillStyle = b.kind === 'park' ? PAT.grass : b.kind === 'plaza' || b.kind === 'tower' ? PAT.plaza : PAT.pave;
    ctx.fillRect(b.x0 + p, b.y0 + p, b.s - 2 * p, b.s - 2 * p);
    if (b.kind === 'park') { ctx.strokeStyle = 'rgba(210,195,160,.9)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(b.x0 + p, b.y0 + b.s / 2 + 60); ctx.quadraticCurveTo(b.x0 + b.s / 2, b.y0 + b.s / 2 - 90, b.x0 + b.s - p, b.y0 + p + 40); ctx.stroke(); }
    if (b.pond) {
      ctx.fillStyle = '#7d776c'; ctx.beginPath(); ctx.ellipse(b.pond.x, b.pond.y, b.pond.rx + 6, b.pond.ry + 6, 0, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(b.pond.x - 20, b.pond.y - 15, 5, b.pond.x, b.pond.y, b.pond.rx); g.addColorStop(0, '#7fd0ea'); g.addColorStop(1, '#2f7fa8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(b.pond.x, b.pond.y, b.pond.rx, b.pond.ry, 0, 0, 7); ctx.fill();
    }
  }
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
  const w = o.spr ? o.w * 1.3 : o.type !== 'tower' && o.w ? o.w * 1.12 : SPRITE_W[o.type] || 30;
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
  const t = o.type, h = o.lane.dir === 'h';
  if (h) return { img: SPR[t + '-side'], w: t === 'bus' ? 112 : 56, flip: (o.lane.sgn < 0) !== (t === 'bus') };
  return { img: SPR[t + (o.lane.sgn > 0 ? '-front' : '-rear')], w: t === 'bus' ? 80 : 28, flip: false };
}
function drawVehicleUp(ctx, o) { // upright space, origin at vehicle ground point
  const v = vehView(o); if (!v.img) return;
  const h = v.w * v.img.height / v.img.width;
  if (o.type === 'car' && o.hue > 0.15) ctx.filter = `hue-rotate(${CAR_TINT[Math.floor(o.hue * CAR_TINT.length)]}deg) saturate(${o.hue > 0.85 ? 0.1 : 1})`;
  if (v.flip) ctx.scale(-1, 1);
  ctx.drawImage(v.img, -v.w / 2, -h * 0.72, v.w, h);
  ctx.filter = 'none';
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
  const g = ctx.createLinearGradient(-5, -20, 5, -8); g.addColorStop(0, SHIRT[p.col]); g.addColorStop(1, shade(SHIRT[p.col], 0.7));
  ctx.fillStyle = g; roundRect(ctx, -4.5, -20, 9, 12, 3); ctx.fill();
  ctx.strokeStyle = SHIRT[p.col]; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4.5, -18); ctx.lineTo(-5.5 - sw * 0.5, -11); ctx.moveTo(4.5, -18); ctx.lineTo(5.5 + sw * 0.5, -11); ctx.stroke();
  ctx.fillStyle = ['#f1c9a5', '#c68e65', '#8d5a3b', '#e8b98f'][p.col % 4]; ctx.beginPath(); ctx.arc(0, -24, 4, 0, 7); ctx.fill();
  ctx.fillStyle = ['#3a2a1e', '#1d1d1d', '#a0622c', '#d8b25a'][p.col % 4]; ctx.beginPath(); ctx.arc(0, -25, 4, Math.PI, 0); ctx.fill();
}
function drawBird(ctx, b, t) {
  ctx.fillStyle = 'rgba(10,15,30,.25)'; ctx.beginPath(); ctx.ellipse(0, 2, 6, 2.5, 0, 0, 7); ctx.fill();
  if (b.kind === 'duck') {
    const g = ctx.createLinearGradient(0, -8, 0, 2); g.addColorStop(0, '#8a6a4a'); g.addColorStop(1, '#5c452f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -3, 8, 5, 0, 0, 7); ctx.fill();
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
