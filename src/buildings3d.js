// Real 3D buildings. Every corner is projected through the same pinhole camera that the
// floor warp in game.js implies, then mapped back into the offscreen (pre-warp) canvas.
// After the warp, walls, roofs and floor share one perspective and one set of vanishing points.
const TEX = {};
function loadTextures() {
  return Promise.all(['glass', 'stone', 'dark', 'brick', 'f-cottage', 'f-pub', 'f-church', 'f-terrace', 'f-warehouse', 'f-shopfront', 'f-deco', 'f-modern'].map(n => new Promise(res => { const i = new Image(); i.onload = () => { TEX[n] = i; res(); }; i.onerror = res; i.src = 'assets/tex/' + n + '.jpg'; })));
}
let PJ = null; // set every frame by render()
function setProjection(p) { // p: {s, camx, camy, ocx, ocy, k}
  p.Fk = Math.sqrt(1 / (TILT * TILT) - 1); p.F = p.Fk / p.k; PJ = p;
}
// world (x, y, height z) -> offscreen canvas pixel
function P3(x, y, z) {
  const p = PJ, u = (x - p.camx) * p.s, v = (y - p.camy) * TILT * p.s, hz = z * p.s;
  const yc = v - hz * TILT * p.Fk, zc = Math.max(p.F * 0.05, p.F - p.Fk * v - hz * TILT);
  const X = p.F * u / zc, Y = p.F * yc / zc;
  const zr = Y / (1 + Y * p.k), f = 1 / (1 - zr * p.k);
  const r = P3R[P3i]; P3i = (P3i + 1) & 255; r[0] = p.ocx + X / f; r[1] = p.ocy + zr; return r; // GC: ring of reused [x,y] pairs, every caller uses them immediately
}
const P3R = Array.from({ length: 256 }, () => [0, 0]); let P3i = 0;
const is3D = o => !o.flat && !o.spr_flat && (o.type === 'office' || o.type === 'tower' || o.type === 'shop');
function bStyle(o) { if (o._sk === THEME && o._st) return o._st; o._sk = THEME; return (o._st = bStyle0(o)); } // GC: memoised per building
function bStyle0(o) {
  if (THEME === 'village') { const D = bDims(o); return o.type === 'tower' ? { tex: 'f-church', tw: D.w, th: D.h, roof: '#5e6670' } : o.type === 'office' ? { tex: 'f-pub', tw: D.w, th: D.h, roof: '#55606b' } : { tex: 'f-cottage', tw: D.w, th: D.h, roof: o.hue < 0.5 ? '#e0a33a' : '#d0562e' }; }
  if (THEME === 'district' && o.type !== 'tower') { const D = bDims(o); if (o.hue > 0.72) return { tex: o.type === 'office' ? 'f-deco' : 'f-shopfront', tw: D.w, th: D.h, roof: '#2f6fd6' }; return { tex: o.type === 'office' ? (o.hue < 0.35 ? 'brick' : 'f-warehouse') : 'f-terrace', ...(o.type === 'office' && o.hue < 0.35 ? { tw: 70, th: 64 } : {}), tw: D.w, th: D.h, roof: o.hue < 0.5 ? '#3a7bd5' : '#d9542f', ...(o.type === 'office' && o.hue < 0.35 ? { tw: 70, th: 64 } : {}) }; }
  if (THEME === 'district') return o.type === 'tower' ? { tex: 'stone', tw: 56, th: 52, roof: '#e0a030' } : { tex: 'brick', tw: o.type === 'shop' ? 64 : 70, th: o.type === 'shop' ? 60 : 64, roof: o.hue < 0.5 ? '#3a7bd5' : '#d9542f' };
  if (THEME === 'village') return o.type === 'tower' ? { tex: 'stone', tw: 56, th: 52, roof: '#5e6670' } : o.type === 'office' ? { tex: 'stone', tw: 56, th: 52, roof: '#55606b' } : { tex: o.hue < 0.55 ? 'brick' : 'stone', tw: 70, th: 64, roof: o.hue < 0.3 ? '#d8452f' : o.hue < 0.7 ? '#c8502a' : '#58626d' };
  if (o.type === 'shop') { const D = bDims(o), k = Math.floor(o.hue * 4); return k === 0 ? { tex: 'f-shopfront', tw: D.w, th: D.h, roof: '#e04a3a' } : k === 1 ? { tex: 'f-terrace', tw: D.w, th: D.h, roof: '#2f6fd6' } : k === 2 ? { tex: 'stone', tw: 56, th: 52, roof: '#2fa36b' } : { tex: 'brick', tw: 64, th: 60, roof: '#e04a3a' }; }
  if (o.type === 'tower') return { tex: 'glass', tw: 60, th: 60, roof: '#33b3c9' };
  if (!o.spr && o.hue >= 0.25 && o.hue < 0.5) { const D = bDims(o); return { tex: o.hue < 0.37 ? 'f-modern' : 'f-deco', tw: D.w, th: Math.min(D.h, D.w * 1.6), roof: '#f0b43c' }; }
  const t = o.spr ? o.spr.slice(3) : (o.hue < 0.25 ? 'glass' : o.hue < 0.7 ? 'stone' : 'dark');
  return { tex: t, tw: t === 'glass' ? 60 : 56, th: t === 'glass' ? 58 : 52, roof: t === 'dark' ? '#5b4fc4' : '#e8763a' };
}
function bDims(o) { if (o._dk === THEME && o._dm) return o._dm; o._dk = THEME; return (o._dm = bDims0(o)); }
function bDims0(o) {
  if (THEME === 'district' && o.type === 'office') return { w: o.w * 0.94, d: o.d * 0.8, h: Math.min(170, 110 + o.hue * 80) };
  if (THEME === 'village') { if (o.type === 'tower') return { w: 120, d: 120, h: 210 }; if (o.type === 'office') return { w: o.w * 0.8, d: o.d * 0.5, h: 110 }; return { w: o.w * 0.78, d: o.d * 0.6, h: 74 }; }
  if (o.type === 'shop') { o.bh = o.bh || Math.max(80, o.ht + 30 + ((o.hue * 11.7) % 1) * 70); return { w: o.w * (0.8 + ((o.hue * 5.3) % 1) * 0.16), d: o.d * (0.78 + ((o.hue * 9.1) % 1) * 0.18), h: o.bh }; }
  if (o.type === 'tower') return { w: 160, d: 160, h: 470 };
  const tall = o.spr ? o.ht : o.ht * 1.25, fw = 0.78 + ((o.hue * 7.3) % 1) * 0.2, fd = 0.7 + ((o.hue * 13.1) % 1) * 0.26;
  return { w: o.w * fw, d: o.d * fd, h: tall };
}
const pats = new Map(), RS3 = [0.25, 0.5, 0.75];
function pat(ctx, name) { let p = pats.get(name); if (!p && TEX[name]) { p = ctx.createPattern(TEX[name], 'repeat'); pats.set(name, p); } return p; }

// one wall: corners A->B on the floor, from z0 to z1, outward normal shade
function wall(ctx, ax, ay, bx, by, z0, z1, st, shade, H) {
  const len = hyp(bx - ax, by - ay), T = TEX[st.tex], tex = pat(ctx, st.tex);
  // whole tiles only, so every window sits fully inside the wall (no half windows hanging off edges)
  const nx = Math.max(1, Math.round(len / st.tw)), ny = Math.max(1, Math.round(H / st.th)); const sth = H / ny; // was a per-wall object spread
  const Tw = nx * T.width, strips = Math.max(2, Math.ceil((z1 - z0) / 40));
  for (let i = 0; i < strips; i++) {
    const za = z0 + (z1 - z0) * i / strips, zb = z0 + (z1 - z0) * (i + 1) / strips; // za bottom, zb top
    const TL = P3(ax, ay, zb), TR = P3(bx, by, zb), BL = P3(ax, ay, za), BR = P3(bx, by, za);
    const ty0 = (H - zb) / sth * T.height, ty1 = (H - za) / sth * T.height;
    const ax_ = (TR[0] - TL[0]) / Tw, ay_ = (TR[1] - TL[1]) / Tw, cx = (BL[0] - TL[0]) / (ty1 - ty0), cy = (BL[1] - TL[1]) / (ty1 - ty0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.moveTo(TL[0], TL[1]); ctx.lineTo(TR[0], TR[1]); ctx.lineTo(BR[0], BR[1]); ctx.lineTo(BL[0], BL[1]); ctx.closePath();
    ctx.clip();
    if (tex) { ctx.setTransform(ax_, ay_, cx, cy, TL[0] - cx * ty0, TL[1] - cy * ty0); ctx.fillStyle = tex; ctx.fillRect(-2, ty0 - 2, Tw + 4, ty1 - ty0 + 4); ctx.setTransform(1, 0, 0, 1, 0, 0); }
    // lighting: per-face shade plus a little ambient occlusion near the street
    const ao = za < 30 ? 0.18 : 0, gy0 = TL[1], gh = BL[1] - TL[1];
    const rx = Math.min(TL[0], BL[0]) - 2, ry = Math.min(TL[1], TR[1]) - 2, rw = Math.abs(TR[0] - TL[0]) + Math.abs(BL[0] - TL[0]) + 4, rh = Math.max(BL[1], BR[1]) - Math.min(TL[1], TR[1]) + 4;
    if (Math.abs(gh) > 1e-3) { // GC: one cached unit gradient (0..1) per shade, stretched by the transform, instead of a new CanvasGradient per strip
      ctx.fillStyle = shadeGrad(ctx, shade, ao); ctx.setTransform(1, 0, 0, gh, 0, gy0); ctx.fillRect(rx, (ry - gy0) / gh, rw, rh / gh); ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else { ctx.fillStyle = shadeRGBA(shade); ctx.fillRect(rx, ry, rw, rh); }
    ctx.restore();
  }
}
function poly(ctx, pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); } // ref-video look: soft shaded faces, no outlines
// solid box (roof plant rooms etc.)
function box(ctx, x0, y0, x1, y1, z0, z1, col) {
  const c = [P3(x0, y0, z1), P3(x1, y0, z1), P3(x1, y1, z1), P3(x0, y1, z1)];
  if (PJ.camx < x0) poly(ctx, [P3(x0, y0, z0), P3(x0, y1, z0), c[3], c[0]], shadeCol(col, 0.62));
  if (PJ.camx > x1) poly(ctx, [P3(x1, y0, z0), P3(x1, y1, z0), c[2], c[1]], shadeCol(col, 0.8));
  poly(ctx, [P3(x0, y1, z0), P3(x1, y1, z0), c[2], c[3]], shadeCol(col, 0.72));
  poly(ctx, c, col);
}
const SGRAD = new Map(); function shadeGrad(ctx, a, ao) { const key = a * 10 + ao; let g = SGRAD.get(key); if (!g) { g = ctx.createLinearGradient(0, 0, 0, 1); g.addColorStop(0, shadeRGBA(a)); g.addColorStop(1, shadeRGBA(a + ao)); SGRAD.set(key, g); } return g; }
const SRGBA = new Map(); function shadeRGBA(a) { let c = SRGBA.get(a); if (!c) { c = `rgba(10,14,28,${a})`; SRGBA.set(a, c); } return c; }
const SCOL = new Map(); function shadeCol(hex, f) { const m = SCOL.get(hex); let c = m && m.get(f); if (c) return c; c = shadeCol0(hex, f); if (m) m.set(f, c); else SCOL.set(hex, new Map([[f, c]])); return c; }
function shadeCol0(hex, f) { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * f | 0},${((n >> 8) & 255) * f | 0},${(n & 255) * f | 0})`; }

// sink lowers the whole building (used while it is being swallowed)
function drawBuilding3D(ctx, o, sink = 0, ox = 0, oy = 0) {
  if (o.tier === undefined) o.tier = THEME === 'city' && o.type === 'office' && !o.spr && ((o.hue * 17.3) % 1) > 0.45 ? { type: 'office', tierOf: 1, x: o.x, y: o.y, w: o.w * 0.62, d: o.d * 0.6, ht: o.ht * (0.35 + ((o.hue * 3.7) % 1) * 0.4), hue: (o.hue + 0.5) % 1 } : null;
  const st = bStyle(o), D = bDims(o), H = D.h, x0 = o.x + ox - D.w / 2, x1 = x0 + D.w, y0 = o.y + oy - D.d / 2, y1 = y0 + D.d;
  const zb = -sink, zt = H - sink;
  ctx.save();
  // side walls only when they face the camera: west wall if camera is west of it, etc.
  if (PJ.camx < x0) wall(ctx, x0, y0, x0, y1, zb, zt, st, 0.08, zt);   // west face: sun-lit
  if (PJ.camx > x1) wall(ctx, x1, y1, x1, y0, zb, zt, st, 0.5, zt);    // east face: in shade
  wall(ctx, x0, y1, x1, y1, zb, zt, st, 0.24, zt);                       // south face toward camera
  // crisp corner lines
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = 'rgba(20,24,32,.55)'; ctx.lineWidth = Math.max(1, PJ.s * 1.2);
  ctx.beginPath(); for (let c = 0; c < 2; c++) { const x = c ? x1 : x0, a = P3(x, y1, zb), b = P3(x, y1, zt); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
  // roof with parapet, plant room and (for the landmark) a spire
  const r = [P3(x0, y0, zt), P3(x1, y0, zt), P3(x1, y1, zt), P3(x0, y1, zt)];
  if (THEME === 'village' && o.type !== 'tower') { // pitched tiled roof, ridge east-west, plus a chimney
    const ym = (y0 + y1) / 2, zr = zt + D.d * 0.55, e = 6;
    poly(ctx, [P3(x0 - e, y0 - e, zt), P3(x1 + e, y0 - e, zt), P3(x1 + e, ym, zr), P3(x0 - e, ym, zr)], shadeCol(st.roof, 0.7));
    if (PJ.camx < x0) poly(ctx, [P3(x0, y0, zt), P3(x0, y1, zt), P3(x0, ym, zr)], '#cbbd9f');
    if (PJ.camx > x1) poly(ctx, [P3(x1, y0, zt), P3(x1, y1, zt), P3(x1, ym, zr)], '#8f846f');
    box(ctx, x1 - D.w * 0.25, ym - 6, x1 - D.w * 0.25 + 12, ym + 6, zt + D.d * 0.2, zr + 16, '#8a5a44');
    poly(ctx, [P3(x0 - e, y1 + e, zt), P3(x1 + e, y1 + e, zt), P3(x1 + e, ym, zr), P3(x0 - e, ym, zr)], st.roof);
    const rs = RS3; ctx.strokeStyle = 'rgba(40,20,10,.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); for (const f of rs) { const a = P3(x0 - e, y1 + e + (ym - y1 - e) * f, zt + (zr - zt) * f), b = P3(x1 + e, y1 + e + (ym - y1 - e) * f, zt + (zr - zt) * f); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
    ctx.restore(); return;
  }
  poly(ctx, r, shadeCol(st.roof, 0.85));
  const iw = Math.min(D.w, D.d) * 0.07;
  poly(ctx, [P3(x0 + iw, y0 + iw, zt), P3(x1 - iw, y0 + iw, zt), P3(x1 - iw, y1 - iw, zt), P3(x0 + iw, y1 - iw, zt)], st.roof);
  if (o.tier) { const T = o.tier; T.x = o.x; T.y = o.y; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); drawTier(ctx, T, zt, ox, oy); ctx.restore(); ctx.restore(); return; }
  if (o.type === 'tower') {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ap = P3(cx, cy, zt + 150), q = [P3(x0 + 25, y0 + 25, zt), P3(x1 - 25, y0 + 25, zt), P3(x1 - 25, y1 - 25, zt), P3(x0 + 25, y1 - 25, zt)];
    poly(ctx, [q[0], q[1], ap], '#7d8894'); poly(ctx, [q[3], q[0], ap], '#a9b4c0'); poly(ctx, [q[1], q[2], ap], '#5c6773'); poly(ctx, [q[2], q[3], ap], '#8c97a3');
  } else if (o.type !== 'shop' && false) { // simplified art: plain flat roofs, no plant rooms/AC/water tanks
    const m = D.w * 0.18;
    box(ctx, x0 + m, y0 + m, x0 + m + D.w * 0.3, y0 + m + D.d * 0.25, zt, zt + 14, '#a4a9b0');
    box(ctx, x1 - m - D.w * 0.18, y1 - m - D.d * 0.2, x1 - m, y1 - m, zt, zt + 9, '#b9bec4');
    // rooftop clutter: AC units + a water tank on taller blocks
    for (let i = 0; i < 3; i++) { const ax = x0 + m + i * D.w * 0.13; box(ctx, ax, y1 - m - 14, ax + D.w * 0.09, y1 - m - 4, zt, zt + 6, '#c9cdd2'); }
    if (H > 250) { const cx = x1 - m - D.w * 0.12, cy = y0 + m + 10; box(ctx, cx - 9, cy - 9, cx + 9, cy + 9, zt + 8, zt + 26, '#8a6d55'); box(ctx, cx - 7, cy - 7, cx - 5, cy + 7, zt, zt + 8, '#555'); box(ctx, cx + 5, cy - 7, cx + 7, cy + 7, zt, zt + 8, '#555'); }
  }
  ctx.restore();
}
// projected screen box (offscreen coords) for see-through tests
function bBounds(o) {
  const D = bDims(o), bb = o._bb || (o._bb = { x0: 0, x1: 0, y0: 0, y1: 0 }); bb.x0 = bb.y0 = Infinity; bb.x1 = bb.y1 = -Infinity; // GC: no temp arrays/spreads
  for (let i = 0; i < 8; i++) { const p = P3(i & 1 ? o.x + D.w / 2 : o.x - D.w / 2, i & 2 ? o.y + D.d / 2 : o.y - D.d / 2, i & 4 ? D.h : 0);
    if (p[0] < bb.x0) bb.x0 = p[0]; if (p[0] > bb.x1) bb.x1 = p[0]; if (p[1] < bb.y0) bb.y0 = p[1]; if (p[1] > bb.y1) bb.y1 = p[1]; }
  return bb;
}
// cast shadow of a box onto the floor: convex hull of footprint + footprint pushed by the sun (ground space)
function buildingShadowPath(ctx, o) {
  const D = bDims(o), sx = D.h * 0.75, sy = D.h * 0.52, x0 = o.x - D.w / 2, x1 = o.x + D.w / 2, y0 = o.y - D.d / 2, y1 = o.y + D.d / 2;
  // sun from the top-left: hull is a hexagon
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1 + sx, y0 + sy); ctx.lineTo(x1 + sx, y1 + sy); ctx.lineTo(x0 + sx, y1 + sy); ctx.lineTo(x0, y1); ctx.closePath();
}

// stepped upper storey on some city towers: same box drawer, lifted onto the roof
function drawTier(ctx, T, z0, ox, oy) {
  const st = bStyle(T), D = bDims(T), x0 = T.x + ox - D.w / 2, x1 = x0 + D.w, y0 = T.y + oy - D.d / 2, y1 = y0 + D.d, zt = z0 + D.h;
  if (PJ.camx < x0) wall(ctx, x0, y0, x0, y1, z0, zt, st, 0.08, zt);
  if (PJ.camx > x1) wall(ctx, x1, y1, x1, y0, z0, zt, st, 0.5, zt);
  wall(ctx, x0, y1, x1, y1, z0, zt, st, 0.24, zt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  poly(ctx, [P3(x0, y0, zt), P3(x1, y0, zt), P3(x1, y1, zt), P3(x0, y1, zt)], shadeCol(st.roof, 0.85));
  box(ctx, (x0 + x1) / 2 - 8, (y0 + y1) / 2 - 8, (x0 + x1) / 2 + 8, (y0 + y1) / 2 + 8, zt, zt + 30, '#9aa1a8');
}
