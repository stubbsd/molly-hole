// Molly Hole — main loop, input, UI. Offline, no network, no tracking.
(() => {
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
let Wd = 0, Ht = 0, dpr = 1;
let resScale = 1.25; // adaptive: dropped automatically if the device can't hold ~55fps
function resize() { dpr = Math.min(resScale, window.devicePixelRatio || 1); Wd = innerWidth; Ht = innerHeight; cv.width = Wd * dpr; cv.height = Ht * dpr; }
addEventListener('resize', resize); resize();

// ---------- save (this device only) ----------
const SAVE_KEY = 'mollyHole.v1';
let save = { stars: 0, skin: 'blue', muted: false };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
Sfx.setMuted(save.muted);

// ---------- state ----------
let city, objs, vehicles, peds, birds, falling, parts, respawnQ, critterQ = [];
let mode = null, playing = false, paused = false, ending = 0, runStars = 0, time = 0;
const hole = { x: 0, y: 0, tx: 0, ty: 0, R: 14, level: 1, pts: 0, pulse: 0 };
const cam = { x: 0, y: 0, s: 1 };

function newWorld() {
  city = buildCity(7 + Math.floor(Math.random() * 1000));
  objs = city.objs; peds = city.peds; birds = city.birds; setGroundCity(city); critterQ = [];
  vehicles = []; for (let i = 0; i < 34; i++) vehicles.push(spawnVehicle(city, true));
  falling = []; parts = []; respawnQ = [];
}
function startGame(m) {
  Sfx.init(); Sfx.startMusic(); newWorld();
  mode = m; playing = true; paused = false; ending = 0; runStars = 0;
  // start on a road near a corner of the central area
  const p = W.PITCH * 2 + W.ROAD / 2;
  Object.assign(hole, { x: p, y: p, tx: p, ty: p, R: HOLE_R[1], level: 1, pts: 0, pulse: 0 });
  cam.x = p; cam.y = p;
  show('hud'); hide('home'); hide('ward'); hide('pause'); hide('end'); updateHud();
}
function goHome() {
  playing = false; paused = false; mode = null; hide('hud'); hide('pause'); hide('end'); hide('ward'); show('home'); refreshStars();
}
const show = id => $(id).classList.remove('hidden'), hide = id => $(id).classList.add('hidden');

// ---------- input: one finger, relative drag, mash-safe ----------
let activeId = null, lastPX = 0, lastPY = 0, fingerDown = false;
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Sfx.init();
  if (activeId !== null || !playing || paused) return;
  activeId = e.pointerId; lastPX = e.clientX; lastPY = e.clientY; fingerDown = true;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== activeId) return; e.preventDefault();
  lastPX = e.clientX; lastPY = e.clientY; // absolute: the hole heads for the point under the finger (no accumulated offset)
});
const endPtr = e => { if (e.pointerId === activeId) { activeId = null; fingerDown = false; } };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr); cv.addEventListener('lostpointercapture', endPtr);
['gesturestart', 'gesturechange', 'contextmenu', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing && !ending) doPause(); });
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// debounced buttons so mashing can't double-fire
function btn(id, fn) { let last = 0; $(id).addEventListener('pointerup', e => { e.stopPropagation(); const n = performance.now(); if (n - last < 350) return; last = n; Sfx.init(); Sfx.tap(); fn(); }); }
function doPause() { if (!playing || ending) return; paused = true; activeId = null; show('pause'); }
btn('btnPause', doPause);
btn('btnHome', goHome);
btn('btnResume', () => { paused = false; hide('pause'); });
btn('btnPauseHome', goHome);
btn('btnRun', () => startGame('run'));
btn('btnFree', () => startGame('free'));
btn('btnAgain', () => startGame('run'));
btn('btnEndHome', goHome);
btn('btnWard', () => { hide('home'); show('ward'); buildWardrobe(); });
btn('btnWardBack', () => { hide('ward'); show('home'); });
btn('btnMute', () => { save.muted = !save.muted; Sfx.setMuted(save.muted); persist(); drawMuteIcon(); });
function drawMuteIcon() {
  $('muteIcon').innerHTML = '<path d="M4 9h4l5-4v14l-5-4H4z"/>' + (save.muted ? '<path d="M16 9l5 6M21 9l-5 6" fill="none" stroke-width="2.4"/>' : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke-width="2.2"/>');
}
drawMuteIcon();

// ---------- wardrobe: skins unlock automatically as total stars grow ----------
function buildWardrobe() {
  const box = $('skins'); box.innerHTML = '';
  for (const s of SKINS) {
    const unlocked = save.stars >= s.cost;
    const card = document.createElement('button');
    card.className = 'skin' + (save.skin === s.id ? ' on' : '') + (unlocked ? '' : ' locked');
    const c = document.createElement('canvas'); c.width = c.height = 200; const cx = c.getContext('2d');
    cx.fillStyle = '#3a3f47'; cx.fillRect(0, 0, 200, 200); drawHole(cx, 100, 100, 58, s.id, 0);
    card.appendChild(c);
    const cost = document.createElement('div'); cost.className = 'cost';
    cost.innerHTML = unlocked ? (save.skin === s.id ? '<span class="star">✔</span>' : '') : '<span>🔒</span><span class="star">★</span>' + s.cost;
    card.appendChild(cost);
    card.addEventListener('pointerup', () => { if (!unlocked) { Sfx.teeter(); return; } save.skin = s.id; persist(); Sfx.star(); buildWardrobe(); });
    box.appendChild(card);
  }
  refreshStars();
}
function refreshStars() { $('starCount').textContent = save.stars; $('starCountHome').textContent = save.stars; $('starCountWard').textContent = save.stars; }
function updateHud() {
  const need = LEVEL_NEED[hole.level];
  $('growFill').style.width = (hole.level >= 8 ? 100 : Math.min(100, hole.pts / need * 100)) + '%';
  const gh = $('growHole').style; const sz = 40 + hole.level * 5; gh.width = gh.height = sz + 'px';
  refreshStars();
}
function addStars(n) { save.stars += n; runStars += n; persist(); refreshStars(); Sfx.star(); }

// ---------- update ----------
function update(dt) {
  time += dt;
  // vehicles always drive (living world), slower near the hole so they are catchable
  for (const v of vehicles) {
    if (v.state !== 'idle') continue;
    const near = playing && Math.hypot(v.x - hole.x, v.y - hole.y) < hole.R + 140;
    v.along += v.speed * dt * (near ? 0.35 : 1);
    if (v.along < -100 || v.along > W.SIZE + 100) v.along = v.speed > 0 ? -90 : W.SIZE + 90;
    placeVehicle(v);
  }
  updatePeds(dt); updateBirds(dt);
  if (!playing) { cam.x = W.SIZE / 2 + Math.cos(time * 0.05) * 600; cam.y = W.SIZE / 2 + Math.sin(time * 0.05) * 400; cam.s = Math.min(Wd, Ht) / 900; return; }

  if (AUTOPLAY) autoSteer();
  // hole glides toward target (smoothed, speed-capped)
  if (fingerDown && !AUTOPLAY) { const w = screenToWorld(lastPX, lastPY); hole.tx = clamp(w.x, 30, W.SIZE - 30); hole.ty = clamp(w.y, 30, W.SIZE - 30); }
  const dx = hole.tx - hole.x, dy = hole.ty - hole.y, d = Math.hypot(dx, dy), maxV = (230 + hole.R * 2.2) * dt;
  if (d > 0.01) { const k = Math.min(1, maxV / d); hole.x += dx * k; hole.y += dy * k; }
  const targetR = HOLE_R[hole.level];
  hole.R += (targetR - hole.R) * Math.min(1, dt * 4); hole.pulse = Math.max(0, hole.pulse - dt * 2);

  // swallow / teeter
  const all = objs.concat(vehicles);
  for (const o of all) {
    if (o.state !== 'idle') continue;
    const dd = Math.hypot(o.x - hole.x, o.y - hole.y);
    if (dd > hole.R + o.r + 10) { o.wob = Math.max(0, o.wob - dt); continue; }
    if (o.size <= hole.level && dd + o.r * 0.5 < hole.R) { if (falling.length < 8) startFall(o); }
    else if (o.size > hole.level && dd < hole.R + o.r * 0.6) { o.wob = 0.6; Sfx.teeter(); }
  }
  // people and pets can be swallowed too (they pop back out somewhere else later)
  for (const arr of [peds, birds]) for (let i = arr.length - 1; i >= 0; i--) {
    const c = arr[i]; if (falling.length >= 8) break;
    if (Math.hypot(c.x - hole.x, c.y - hole.y) < hole.R * 0.85) { arr.splice(i, 1); startFall({ critter: c, arr, ped: arr === peds, x: c.x, y: c.y, size: 1, r: 6 }); }
  }
  for (let i = critterQ.length - 1; i >= 0; i--) { const q = critterQ[i]; if (time > q.at) { const c = q.f.critter; c.ox = c.oy = 0; c.run = 0; c.fly = 0; if (!q.f.ped) { c.x = c.hx; c.y = c.hy; } q.f.arr.push(c); critterQ.splice(i, 1); } }
  for (const f of falling) f.ft += dt / f.dur;
  for (let i = falling.length - 1; i >= 0; i--) if (falling[i].ft >= 1) { finishFall(falling[i]); falling.splice(i, 1); }

  // free play: refill things once the hole is away
  if (mode === 'free') for (let i = respawnQ.length - 1; i >= 0; i--) {
    const q = respawnQ[i]; if (time < q.at) continue;
    if (Math.hypot(q.o.x - hole.x, q.o.y - hole.y) > hole.R + q.o.r + 250) { q.o.state = 'idle'; q.o.ft = 0; q.o.pop = 1; objs.push(q.o); respawnQ.splice(i, 1); }
  }
  updateParts(dt);
  if (ending) { ending -= dt; if (Math.random() < dt * 6) firework(); if (ending <= 0) { ending = 0; playing = false; $('endStars').textContent = '+' + runStars; show('end'); } }

  // camera follows hole, zooms out as it grows
  const want = Math.min(Wd, Ht) / Math.max(380, hole.R * 7);
  cam.s += (want - cam.s) * Math.min(1, dt * 2);
  { // camera only scrolls when the hole leaves the middle of the screen, so the hole stays under the finger
    const ex = hole.x - cam.x, ey = hole.y - cam.y, dzx = Wd * 0.22 / cam.s, dzy = Ht * 0.18 / cam.s / TILT;
    const kx = Math.min(1, dt * 5);
    if (ex > dzx) cam.x += (ex - dzx) * kx; else if (ex < -dzx) cam.x += (ex + dzx) * kx;
    if (ey > dzy) cam.y += (ey - dzy) * kx; else if (ey < -dzy) cam.y += (ey + dzy) * kx; }
}

// Demo/test autoplay (only via ?autoplay=1 in the URL; never shown to players)
const AUTOPLAY = /[?&]autoplay=1/.test(location.search);
function autoSteer() {
  let best = null, bs = -1;
  for (const o of objs.concat(vehicles)) {
    if (o.state !== 'idle' || o.size > hole.level) continue;
    const d = Math.hypot(o.x - hole.x, o.y - hole.y) + 40, sc = (o.landmark ? 1e4 : o.size * o.size) / d;
    if (sc > bs) { bs = sc; best = o; }
  }
  if (best) { hole.tx = clamp(best.x, 30, W.SIZE - 30); hole.ty = clamp(best.y, 30, W.SIZE - 30); }
}
window.__molly = { hole, get mode() { return mode; }, get playing() { return playing; }, start: m => startGame(m), get time() { return time; }, get camS() { return cam.s; }, get swallowed() { return swallowed; }, get scored() { return scored; }, get pts() { return hole.pts; }, get level() { return hole.level; }, targets: () => objs.concat(vehicles).filter(o => o.state === 'idle').map(o => ({ x: o.x, y: o.y, size: o.size, lm: !!o.landmark })), toScreen: (x, y) => { const p = P3(x, y, 0), W2 = cv.width, H2 = cv.height, k = PJ.k, zr = p[1] - PJ.ocy, f = 1 / (1 - zr * k); return [(W2 / 2 + (p[0] - PJ.ocx) * f) / dpr, (H2 / 2 + zr * f) / dpr]; } };
function startFall(o) {
  o.state = 'fall'; o.ft = 0; o.dur = 0.6 + o.size * 0.1; o.sx = o.x; o.sy = o.y; o.spin = (Math.random() - 0.5) * 2.4; falling.push(o);
  Sfx.swallow(o.size, save.skin);
  if (parts.length < 120) for (let i = 0; i < 4 + o.size; i++) parts.push({ x: o.x, y: o.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.6, col: SKINS.find(s => s.id === save.skin).rim[1], sz: 2 + o.size * 0.5 });
}
let swallowed = 0, scored = 0;
function finishFall(o) {
  swallowed++;
  if (o.critter) { critterQ.push({ f: o, at: time + 15 }); hole.pts += 2; scored++; checkLevel(); updateHud(); return; }
  if (o.moving) { o.state = 'idle'; o.along = o.speed > 0 ? -90 : W.SIZE + 90; placeVehicle(o); o.lane = city.lanes[Math.floor(Math.random() * city.lanes.length)]; o.speed = Math.abs(o.speed) * o.lane.sgn; placeVehicle(o); }
  else { const i = objs.indexOf(o); if (i >= 0) objs.splice(i, 1); o.x = o.sx; o.y = o.sy; if (mode === 'free') respawnQ.push({ o, at: time + 20 + Math.random() * 15 }); }
  if (o.landmark && mode === 'run') { addStars(5); Sfx.win(); ending = 3.2; return; }
  if (hole.level < 8) {
    hole.pts += o.size * o.size + 1; scored++; // +1 so small early snacks always visibly fill the bar
    checkLevel();
  }
  updateHud();
}
function checkLevel() {
  if (hole.level < 8) {
    if (hole.pts >= LEVEL_NEED[hole.level]) {
      hole.pts -= LEVEL_NEED[hole.level]; hole.level++; hole.pulse = 1; Sfx.grow(); addStars(1);
      for (let i = 0; i < 40; i++) { const a = Math.random() * 7; parts.push({ x: hole.x, y: hole.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 1, col: ['#ffd84a', '#6fe0ff', '#ff7ab8', '#7dff9a'][i % 4], sz: 4 }); }
      if (hole.level >= 8) hole.pts = 0;
    }
  }
  updateHud();
}

function pushOut(a, minD) { const dx = a.x - hole.x, dy = a.y - hole.y, d = Math.hypot(dx, dy) || 1; if (d < minD) { a.x = hole.x + dx / d * minD; a.y = hole.y + dy / d * minD; } return d; }
function updatePeds(dt) {
  const e = W.PAVE / 2;
  for (const p of peds) {
    const L = p.s - 2 * e; p.t = (p.t + p.sp * dt * (p.run > 0 ? 2.5 : 1) + 4) % 4;
    const side = Math.floor(p.t), f = p.t - side; let px, py;
    if (side === 0) { px = p.bx + e + f * L; py = p.by + e; } else if (side === 1) { px = p.bx + e + L; py = p.by + e + f * L; }
    else if (side === 2) { px = p.bx + e + L - f * L; py = p.by + e + L; } else { px = p.bx + e; py = p.by + e + L - f * L; }
    p.ox = p.ox || 0; p.oy = p.oy || 0;
    if (playing) {
      const dx = px + p.ox - hole.x, dy = py + p.oy - hole.y, d = Math.hypot(dx, dy) || 1;
      if (d < hole.R + 45) { p.run = 1; p.ox += dx / d * 90 * dt; p.oy += dy / d * 90 * dt; } else { p.run = Math.max(0, p.run - dt); p.ox *= 1 - dt; p.oy *= 1 - dt; }
    }
    p.x = px + p.ox; p.y = py + p.oy;
  }
}
function updateBirds(dt) {
  for (const b of birds) {
    const dx = b.x - hole.x, dy = b.y - hole.y, d = Math.hypot(dx, dy) || 1;
    if (playing && d < hole.R + 60 && b.fly <= 0) { b.fly = 1.2; const sp = b.kind === 'pigeon' ? 160 : 90; b.vx = dx / d * sp; b.vy = dy / d * sp; }
    if (b.fly > 0) { b.fly -= dt; b.x += b.vx * dt; b.y += b.vy * dt; }
    else { b.x += (b.hx - b.x) * dt * 0.08 + Math.sin(time * 2 + b.hx) * 4 * dt; b.y += (b.hy - b.y) * dt * 0.08 + Math.cos(time * 1.7 + b.hy) * 4 * dt; }
  }
}
function firework() {
  const x = cam.x + (Math.random() - 0.5) * Wd / cam.s * 0.8, y = cam.y + (Math.random() - 0.6) * Ht / cam.s * 0.6;
  const col = ['#ffd84a', '#6fe0ff', '#ff7ab8', '#7dff9a', '#ffffff'][Math.floor(Math.random() * 5)];
  for (let i = 0; i < 40; i++) { const a = i / 40 * 7, sp = 200 + Math.random() * 120; parts.push({ x, y, vx: Math.cos(a) * sp / cam.s * 0.4, vy: Math.sin(a) * sp / cam.s * 0.4, life: 1.2, col, sz: 3 / cam.s }); }
}
function updateParts(dt) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); } }

// ---------- render ----------
// The scene is drawn flat-tilted into an oversized offscreen canvas, then warped row by row
// onto the screen with a perspective divide, so the floor recedes like a real 3D plane and
// every prop/shadow on it shares exactly the same projection.
const oc = document.createElement('canvas'), octx = oc.getContext('2d');
const EXW = 1.12, EXH = 1.07, PK = 0.15, OCY = 0.53; // just big enough for the warp source (was 1.8×1.6 = 2.6× the pixels)
function render() {
  window.__mollyFalling = falling.filter(o => o.size >= 2 && o.ft > 0.2 && o.ft < 0.55).length;
  const mctx = window.ctx || cv.getContext('2d');
  const ow = Math.ceil(cv.width * EXW), oh = Math.ceil(cv.height * EXH);
  if (oc.width !== ow || oc.height !== oh) { oc.width = ow; oc.height = oh; }
  const ctx = octx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#3a4048'; ctx.fillRect(0, 0, ow, oh);
  const s = cam.s * dpr, ox = ow / 2 - cam.x * s, oy = oh * OCY - cam.y * TILT * s;
  const G = () => ctx.setTransform(s, 0, 0, s * TILT, ox, oy);   // ground space
  const U = () => ctx.setTransform(s, 0, 0, s, ox, oy);          // upright space (y pre-multiplied by TILT)
  const hw = Wd * EXW / 2 / cam.s, hh = Ht * EXH / 2 / cam.s / TILT;
  const view = { x0: cam.x - hw - 200, x1: cam.x + hw + 200, y0: cam.y - hh - 200, y1: cam.y + hh + 1400 };
  drawGroundCached(ctx, s, ox, oy, view);
  const vis = o => o.x > view.x0 - 150 && o.x < view.x1 + 150 && o.y > view.y0 && o.y < view.y1;
  if (playing || ending) {
    const pr = hole.R * (1 + Math.sin(hole.pulse * 10) * hole.pulse * 0.08);
    G(); drawCrackSprite(ctx, hole.x, hole.y, pr, ((SKINS.find(k => k.id === save.skin) || SKINS[0]).rim[0]).slice(0, 7), time);
    drawHole(ctx, hole.x, hole.y, pr, save.skin, time);
    drawSwirl(ctx, hole.x, hole.y, pr, time);
  }
  // projection shared by floor warp and 3D buildings
  setProjection({ s, camx: cam.x, camy: cam.y, ocx: ow / 2, ocy: oh * OCY, k: PK / cv.height });
  G(); ctx.beginPath();
  for (const o of objs) if (o.state === 'idle' && is3D(o) && vis(o)) buildingShadowPath(ctx, o);
  ctx.fillStyle = 'rgba(10,15,30,.38)'; ctx.fill('nonzero');
  // cast shadows: each sprite's own silhouette laid onto the floor (light from top-left)
  U();
  for (const o of objs) if (o.state === 'idle' && !is3D(o) && vis(o)) { const sb = spriteBox(o); if (sb) castShadow(ctx, sb.img, sb.bx, sb.by, sb.w, sb.h, o.wob > 0 ? Math.sin(time * 30) * 0.05 * o.wob : 0); }
  for (const v of vehicles) if (v.state === 'idle' && vis(v)) { const vv = vehView(v); if (vv.img) castShadow(ctx, vv.img, v.x, v.y * TILT, vv.w, vv.w * vv.img.height / vv.img.width * 0.72, 0, vv.flip); }
  // things being swallowed: upright, sliding down through the hole's front lip
  if (playing || ending) {
    const pr = hole.R, hy = hole.y * TILT;
    ctx.save(); ctx.beginPath(); ctx.rect(hole.x - 4000, hy - 4000, 8000, 4000); ctx.ellipse(hole.x, hy, pr, pr * TILT, 0, 0, 7); ctx.clip();
    for (const o of falling) {
      // gravity: a little hop on the lip, slide to the centre, then accelerate down (d = ½gt²) with squash & stretch
      const t = o.ft, slide = Math.min(1, t / 0.35), sl = slide * slide * (3 - 2 * slide);
      const bx = o.sx + (hole.x - o.sx) * sl, by0 = (o.sy + (hole.y - o.sy) * sl) * TILT;
      const hop = t < 0.25 ? Math.sin(t / 0.25 * Math.PI) * (6 + o.size * 2) : 0;
      const ft = Math.max(0, t - 0.2) / 0.8, drop = ft * ft * pr * 2.4;
      const sq = t < 0.25 ? 1 + 0.22 * Math.sin(t / 0.25 * Math.PI * 2) : 1 + ft * 0.35; // squash on the lip, stretch while falling
      ctx.save(); ctx.globalAlpha = 1 - ft * 0.6;
      if (is3D(o)) { drawBuilding3D(ctx, o, ft * ft * bDims(o).h * 1.1, (hole.x - o.sx) * sl, (hole.y - o.sy) * sl); ctx.restore(); continue; }
      ctx.translate(bx, by0 - hop + drop); ctx.rotate(ft * o.spin); const sc = 1 - ft * 0.45; ctx.scale(sc / Math.sqrt(sq), sc * sq);
      if (o.critter) { if (o.ped) drawPed(ctx, o.critter, time); else drawBird(ctx, o.critter, time); }
      else if (o.moving) drawVehicleUp(ctx, o); else { const sb = spriteBox(o); if (sb) ctx.drawImage(sb.img, -sb.w / 2, -sb.h, sb.w, sb.h); }
      ctx.restore();
    }
    // inner darkness over the sunk part so it reads as depth
    const dg = ctx.createLinearGradient(0, hy - pr * TILT, 0, hy + pr * TILT); dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.beginPath(); ctx.ellipse(hole.x, hy, pr, pr * TILT, 0, 0, 7); ctx.fillStyle = dg; ctx.fill();
    ctx.restore();
  }
  G();
  // vehicles lie flat on the road (ground space)
  // upright things, depth sorted by their front edge
  U();
  const list = [];
  for (const o of objs) if (o.state === 'idle' && vis(o)) list.push(o);
  for (const p of peds) if (vis(p)) list.push({ ped: p, y: p.y });
  for (const v of vehicles) if (v.state === 'idle' && vis(v)) list.push({ veh: v, y: v.y });
  for (const b of birds) if (vis(b)) list.push({ bird: b, y: b.y });
  list.sort((a, b) => (a.y + (a.d || 0) / 2) - (b.y + (b.d || 0) / 2));
  const hy = hole.y * TILT;
  for (const it of list) {
    ctx.save();
    if (it.ped) { ctx.translate(it.ped.x, it.ped.y * TILT); drawPed(ctx, it.ped, time); }
    else if (it.veh) { ctx.translate(it.veh.x, it.veh.y * TILT); if (it.veh.wob > 0) ctx.rotate(Math.sin(time * 30) * 0.06 * it.veh.wob); drawVehicleUp(ctx, it.veh); }
    else if (it.bird) { ctx.translate(it.bird.x, it.bird.y * TILT); drawBird(ctx, it.bird, time); }
    else if (is3D(it)) {
      if (playing || ending) { const bb = bBounds(it), hp = P3(hole.x, hole.y, 0); if (hp[0] > bb.x0 - 20 && hp[0] < bb.x1 + 20 && hp[1] > bb.y0 && hp[1] < bb.y1 && hole.y < it.y + it.d / 2) ctx.globalAlpha = 0.35; }
      if (it.wob > 0) { const j = Math.sin(time * 30) * 3 * it.wob; drawBuilding3D(ctx, it, 0, j, 0); } else drawBuilding3D(ctx, it);
    }
    else {
      const sb = spriteBox(it); if (!sb) { ctx.restore(); continue; }
      ctx.translate(sb.bx, sb.by);
      if (it.wob > 0) ctx.rotate(Math.sin(time * 30) * 0.05 * it.wob);
      if (it.pop) { const k = 1 - it.pop; ctx.scale(k, k); it.pop = Math.max(0, it.pop - 0.04); }
      // see-through when the sprite covers the hole, so the hole is never hidden
      if ((playing || ending) && Math.abs(hole.x - sb.bx) < sb.w / 2 + hole.R * 0.6 && hy < sb.by && hy > sb.by - sb.h) ctx.globalAlpha = 0.35;
      ctx.drawImage(sb.img, -sb.w / 2, -sb.h, sb.w, sb.h);
    }
    ctx.restore();
  }
  G();
  for (const p of parts) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  // perspective warp onto the screen
  const W2 = cv.width, H2 = cv.height, cy = H2 * 0.5, ocx = ow / 2, ocy = oh * OCY, k = PK / H2, step = 6;
  proj = { ow, oh, s, ox, oy, W2, H2, k };
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.imageSmoothingEnabled = true;
  const zOf = Y => Y / (1 + Y * k);
  for (let Y = -cy; Y < H2 - cy; Y += step) {
    const z0 = zOf(Y), z1 = zOf(Y + step), f = 1 / (1 - (z0 + z1) * 0.5 * k), sw = W2 / f;
    mctx.drawImage(oc, ocx - sw / 2, ocy + z0, sw, Math.max(0.5, z1 - z0), 0, cy + Y, W2, step);
  }
}
// inverse of the warp: CSS pixel under the finger -> world ground point
let proj = null;
function screenToWorld(px, py) {
  if (!proj) return { x: hole.x, y: hole.y };
  const { ow, oh, s, ox, oy, W2, H2, k } = proj, X = px * dpr, Y = py * dpr - H2 * 0.5;
  const z = Y / (1 + Y * k), f = 1 / (1 - z * k), offx = ow / 2 + (X - W2 / 2) / f, offy = oh * OCY + z;
  return { x: (offx - ox) / s, y: (offy - oy) / (s * TILT) };
}

let last = performance.now(), perfN = 0, perfT = 0, perfLast = performance.now();
function frame(now) {
  // slow devices: cover up to 0.2s per frame in <=1/30s substeps, so the game keeps real-time pace
  let dt = Math.min(0.2, (now - last) / 1000); last = now;
  if (!paused) while (dt > 1e-4) { const st = Math.min(1 / 30, dt); update(st); dt -= st; }
  render(); requestAnimationFrame(frame);
  // adaptive quality: if frames are slow for ~1.5s, render at a lower internal resolution
  perfN++; perfT += now - perfLast; perfLast = now;
  if (perfT > 1500) { const fps = perfN * 1000 / perfT; perfN = 0; perfT = 0; window.__mollyFps = fps;
    if (fps < 50 && resScale > 0.6) { resScale = Math.max(0.6, resScale - 0.2); resize(); } }
}
newWorld(); refreshStars(); Promise.all([loadSprites(), loadTextures()]).then(() => requestAnimationFrame(frame));
})();
