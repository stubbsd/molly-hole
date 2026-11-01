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
let save = { stars: 0, coins: 0, skin: 'blue', muted: false, done: {} };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
Sfx.setMuted(save.muted);

// ---------- state ----------
let city, objs, vehicles, peds, birds, falling, parts, respawnQ, critterQ = [];
let mode = null, playing = false, paused = false, ending = 0, runStars = 0, runCoins = 0, time = 0;
let orderIdx = 0, ringT = 0, ringDone = false, curStop = null;
const MAXP = 160; // hard cap on live particles (fireworks + swallow sparks) to keep GC calm
const ORDER = ['bin', 'bench', 'tree', 'car', 'bus'];
const RING_T = 100; // seconds for the soft timer ring (never shown as numbers)
const hole = { x: 0, y: 0, tx: 0, ty: 0, R: 14, level: 1, pts: 0, pulse: 0 };
const cam = { x: 0, y: 0, s: 1 };

let worldSeed = 7;
function newWorld(seed) {
  setTheme(curWorld); worldSeed = seed || 7 + Math.floor(Math.random() * 1000);
  city = buildCity(worldSeed); city.objs.forEach((o, i) => { o.uid = i; }); city.nObjs = city.objs.length;
  objs = city.objs; peds = city.peds; birds = city.birds; setGroundCity(city); critterQ = [];
  vehicles = []; for (let i = 0; i < 34; i++) vehicles.push(spawnVehicle(city, true));
  falling = []; parts = []; respawnQ = [];
}
let lastMode = null, curWorld = 'city', lastWorld = 'city';
function startGame(m, world, seed) {
  curWorld = world || 'city'; lastMode = m; lastWorld = curWorld;
  Sfx.init(); Sfx.startMusic(); newWorld(seed);
  mode = m; playing = true; paused = false; ending = 0; runStars = 0; runCoins = 0; orderIdx = 0; ringT = 0; ringDone = false;
  // start on a road near a corner of the central area
  const p = W.PITCH * 2 + W.ROAD / 2, lv = m === 'order' ? orderLv(0) : m === 'bonus' ? 2 : 1, sx = city.start ? city.start.x : p, sy = city.start ? city.start.y : p;
  Object.assign(hole, { x: sx, y: sy, tx: sx, ty: sy, R: HOLE_R[lv], level: lv, pts: 0, pulse: 0 });
  cam.x = sx; cam.y = sy;
  if (m === 'bonus') { spawnPickups(p); for (const o of objs) if (o.uid === undefined) o.uid = city.nObjs++; } // pickups get ids too so a bonus level can resume
  $('growWrap').classList.toggle('hidden', m === 'order');
  $('orderStrip').classList.toggle('hidden', m !== 'order'); if (m === 'order') buildStrip();
  $('ring').classList.toggle('hidden', m !== 'timed'); $('ring').style.setProperty('--p', '0%');
  $('coinPill').classList.toggle('hidden', !(m === 'bonus' || m === 'timed'));
  show('hud'); hide('home'); hide('ward'); hide('pause'); hide('end'); hide('map'); hide('timeup'); updateHud();
}
function goHome() { clearSnap(); fingerDown = false; activeId = null; hideStick();
  playing = false; paused = false; mode = null; hide('hud'); hide('pause'); hide('end'); hide('ward'); hide('map'); hide('timeup'); show('home'); refreshStars();
}
// leaving a level always goes back to the start map; bonus levels count as done just for visiting
function goMap() {
  clearSnap();
  if (curStop && (mode === 'bonus' || mode === 'free')) markDone(curStop, 1);
  fingerDown = false; activeId = null; hideStick(); playing = false; paused = false; mode = null; ending = 0;
  hide('hud'); hide('pause'); hide('end'); hide('ward'); hide('home'); hide('timeup'); show('map'); buildMap();
}
// mid-level snapshot so an iOS interrupt (or Safari dropping the tab) never loses the level
const SNAP_KEY = 'mollyHole.snap';
function saveSnap() {
  if (!playing || ending) return;
  const gone = []; const have = new Set(); for (const o of objs) if (o.uid !== undefined) have.add(o.uid); for (let i = 0; i < city.nObjs; i++) if (!have.has(i)) gone.push(i);
  try { localStorage.setItem(SNAP_KEY, JSON.stringify({ at: Date.now(), mode, world: curWorld, seed: worldSeed, stop: curStop, hole: { x: hole.x, y: hole.y, level: hole.level, pts: hole.pts }, runStars, runCoins, orderIdx, ringT, swallowed, scored, gone })); } catch (_) {}
}
function clearSnap() { try { localStorage.removeItem(SNAP_KEY); } catch (_) {} }
function resumeSnap() {
  let sn = null; try { sn = JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch (_) {}
  if (!sn || Date.now() - sn.at > 30 * 60e3) return false;
  curStop = sn.stop; startGame(sn.mode, sn.world, sn.seed);
  const g = new Set(sn.gone); objs = objs.filter(o => o.uid === undefined || !g.has(o.uid)); city.objs = objs;
  Object.assign(hole, { x: sn.hole.x, y: sn.hole.y, tx: sn.hole.x, ty: sn.hole.y, level: sn.hole.level, pts: sn.hole.pts, R: HOLE_R[sn.hole.level] });
  cam.x = hole.x; cam.y = hole.y; runStars = sn.runStars; runCoins = sn.runCoins; orderIdx = sn.orderIdx; ringT = sn.ringT; swallowed = sn.swallowed || 0; scored = sn.scored || 0;
  if (mode === 'order') buildStrip(); updateHud(); doPause(); return true;
}
function markDone(id, st) { save.done[id] = Math.max(save.done[id] || 0, st); persist(); }

// ---------- start map ----------
const STOPS = [
  { id: 'run', px: 0.2246, py: 0.3958, icon: 'city', mode: 'run' },
  { id: 'order1', px: 0.2979, py: 0.4983, icon: 'puzzle', mode: 'order' },
  { id: 'gift1', px: 0.3984, py: 0.5122, icon: '', mode: 'bonus', gift: true },
  { id: 'timed1', px: 0.4932, py: 0.5469, icon: 'timer', mode: 'timed' },
  { id: 'free', px: 0.5859, py: 0.5417, icon: 'free', mode: 'free' },
  { id: 'gift2', px: 0.6719, py: 0.4479, icon: '', mode: 'bonus', gift: true },
  { id: 'thorn', px: 0.4102, py: 0.7257, icon: 'w-thorn', world: 'village' },
  { id: 'district', px: 0.2373, py: 0.7604, icon: 'w-district', world: 'district' },
  { id: 'desert', px: 0.8086, py: 0.6042, icon: 'w-desert', world: 'desert' },
  { id: 'moon', px: 0.5156, py: 0.3264, icon: 'w-moon', world: 'moon' },
];
const stopOpen = i => !STOPS[i].soon && (i === 0 || !!save.done[STOPS[i - 1].id] || !!save.done[STOPS[i].id]);
function stopPos(i) { const inr = $('mapInner'); return { x: STOPS[i].px * inr.clientWidth, y: STOPS[i].py * inr.clientHeight }; }
const LOCK_SVG = '<svg class="lock" viewBox="0 0 64 64" aria-hidden="true"><defs><filter id="lkT"><feTurbulence type="fractalNoise" baseFrequency=".35" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .12  0 0 0 0 .05  0 0 0 .5 -.15"/><feComposite in2="SourceGraphic" operator="in"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge></filter><radialGradient id="lkB" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#e9c77a"/><stop offset=".45" stop-color="#b98a3e"/><stop offset="1" stop-color="#6e4b22"/></radialGradient><linearGradient id="lkS" x1="0" x2="1"><stop offset="0" stop-color="#5b5148"/><stop offset=".4" stop-color="#a99a86"/><stop offset="1" stop-color="#4a4038"/></linearGradient><filter id="lkSh"><feGaussianBlur stdDeviation="1.6"/></filter></defs><ellipse cx="34" cy="57" rx="17" ry="4" fill="#2a2016" opacity=".45" filter="url(#lkSh)"/><path d="M20 31v-8a12 12 0 0 1 24 0v8" fill="none" stroke="url(#lkS)" stroke-width="6" stroke-linecap="round" filter="url(#lkT)"/><path d="M11.5 32c0-3 2-5 5-5h31c3 0 5 2 5 5v15c0 6-5 9.5-10 9.5H21.5c-5 0-10-3.5-10-9.5z" fill="url(#lkB)" filter="url(#lkT)"/><path d="M16 31c8-1.6 24-1.6 32 0" stroke="#f6e3b0" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/><path d="M32 36.5a4.2 4.2 0 0 0-2.3 7.7l-1.2 6h7l-1.2-6A4.2 4.2 0 0 0 32 36.5z" fill="#3b2914" opacity=".9"/><circle cx="17" cy="51" r="1.2" fill="#5a3d1c" opacity=".6"/><circle cx="47" cy="51" r="1.2" fill="#5a3d1c" opacity=".6"/></svg>';
function buildMap() {
  const inner = $('mapInner'); inner.querySelectorAll('.stop').forEach(e => e.remove());
  let next = -1;
  STOPS.forEach((st, i) => {
    const open = stopOpen(i), b = document.createElement('button'), done = save.done[st.id];
    if (open && !done && next < 0) next = i;
    b.className = 'stop' + (st.gift ? ' gift' : '') + (open ? '' : ' locked') + (i === next ? ' next' : '') + (done ? ' done' : '');
    b.style.left = (st.px * 100) + '%'; b.style.top = (st.py * 100) + '%';
    const ico = n => n ? `<img src="assets/map/icons/${n}.webp" alt="" draggable="false">` : '';
    b.innerHTML = '<span class="face">' + (open && !st.gift ? ico(st.icon) : '') + '</span>' + (!open && st.world ? `<span class="wb">${ico(st.icon)}</span>` : '') + (done && !st.gift ? `<span class="st">${'★'.repeat(Math.min(3, done))}</span>` : '');
    b.addEventListener('pointerup', e => { e.stopPropagation(); Sfx.init(); if (!open) { Sfx.teeter(); b.animate([{ transform: 'rotate(-10deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }], 300); return; } pickStop(i); });
    inner.appendChild(b);
  });
  const at = Math.max(0, STOPS.findIndex(st => st.id === curStop)), tok = $('mapToken');
  tok.style.transition = 'none'; tok.style.left = (STOPS[at].px * 100) + '%'; tok.style.top = (STOPS[at].py * 100) + '%';
  $('starCountMap').textContent = save.stars; $('coinCountMap').textContent = save.coins;
  const f = STOPS[next >= 0 ? next : at];
  requestAnimationFrame(() => { const sc = $('mapScroll'); sc.scrollLeft = Math.max(0, f.px * inner.clientWidth - sc.clientWidth / 2); });
}
// each world stop holds a run of levels: main run, order puzzle, soft-timer, bonus, then endless free play
const WSEQ = ['run', 'order', 'timed', 'bonus', 'free'];
const wKey = (st, m) => m === 'run' ? st.id : st.id + ':' + m;
function worldNext(st) { for (const m of WSEQ) if (m === 'free' || !save.done[wKey(st, m)]) return m; }
let picking = false;
function pickStop(i) {
  if (picking) return; picking = true; Sfx.tap();
  const tok = $('mapToken');
  tok.style.transition = ''; tok.style.left = (STOPS[i].px * 100) + '%'; tok.style.top = (STOPS[i].py * 100) + '%';
  const st = STOPS[i], m = st.world ? worldNext(st) : st.mode;
  curStop = st.world ? wKey(st, m) : st.id;
  setTimeout(() => { picking = false; startGame(m, st.world || 'city'); }, 800);
}

// ---------- level helpers ----------
const STRIPV = { desert: { car: 'd-raptor', bus: 'd-trike' }, moon: { car: 'm-rover', bus: 'm-shuttle' } };
function stripSpr(t) { return (STRIPV[curWorld] || {})[t] || themeSprName(t); }
function buildStrip() {
  $('orderStrip').innerHTML = ORDER.map((t, i) => `<div class="it ${i < orderIdx ? 'done' : i === orderIdx ? 'now' : ''}"><img src="assets/sprites/${stripSpr(t)}.png" alt=""><b>${i < orderIdx ? '✓' : i + 1}</b></div>`).join('');
}
const orderLv = i => Math.max(1, Math.min(8, (TYPES[ORDER[Math.min(i, ORDER.length - 1)]] || { size: 1 }).size)); // hole is just big enough for the next item
const orderMatch = o => o.type === ORDER[orderIdx] || (ORDER[orderIdx] === 'car' && o.type === 'taxi');
function spawnPickups(p) {
  if (city.organic) { // coins strung along the winding tracks, gifts every so often
    let n = 0; for (const l of city.lanes) if (l.sgn > 0) for (let d = 0; d < l.L; d += 44) { const q = lanePt(l, d, 0); if (q.x < 60 || q.y < 60 || q.x > W.SIZE - 60 || q.y > W.SIZE - 60) continue; n++;
      objs.push(n % 10 ? { type: 'coin', x: q.x, y: q.y, size: 1, r: 7, state: 'idle', ft: 0, wob: 0 } : { type: 'gift', x: q.x, y: q.y, size: 2, r: 14, state: 'idle', ft: 0, wob: 0, hue: n % 4 }); }
    return;
  }
  // a golden trail of coins along the nearby roads, with gift boxes at the junctions
  for (let gx = -2; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) {
    const jx = p + gx * W.PITCH, jy = p + gy * W.PITCH; if (jx < 60 || jy < 60 || jx > W.SIZE - 60 || jy > W.SIZE - 60) continue;
    objs.push({ type: 'gift', x: jx, y: jy, size: 2, r: 14, state: 'idle', ft: 0, wob: 0, hue: (gx * 7 + gy * 3 + 20) % 4 });
    for (let k = 1; k < W.PITCH / 42; k++) {
      if (jx + k * 42 < W.SIZE - 60) objs.push({ type: 'coin', x: jx + k * 42, y: jy, size: 1, r: 7, state: 'idle', ft: 0, wob: 0 });
      if (jy + k * 42 < W.SIZE - 60) objs.push({ type: 'coin', x: jx, y: jy + k * 42, size: 1, r: 7, state: 'idle', ft: 0, wob: 0 });
    }
  }
}
function addCoins(n) { save.coins += n; runCoins += n; persist(); $('coinCount').textContent = runCoins; Sfx.star(); }
const GIFTC = ['#ff5a7a', '#5ab4ff', '#7ddf64', '#c27dff'];
function drawPickup(ctx, o, t) { // upright space
  if (o.type === 'coin') {
    const sq = Math.abs(Math.cos(t * 3 + o.x * 0.05));
    ctx.fillStyle = 'rgba(10,15,30,.25)'; ctx.beginPath(); ctx.ellipse(0, 1, 7, 2.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c98a10'; ctx.beginPath(); ctx.ellipse(0, -12, 8 * sq + 1, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(0, -12, 6.5 * sq + 0.5, 6.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-1.5 * sq, -16, 2 * sq, 5);
  } else {
    const c = GIFTC[o.hue | 0];
    ctx.fillStyle = 'rgba(10,15,30,.3)'; ctx.beginPath(); ctx.ellipse(3, 2, 15, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = shadeHex(c, 0.75); ctx.fillRect(-12, -22, 24, 22); ctx.fillStyle = c; ctx.fillRect(-12, -28, 24, 8);
    ctx.fillStyle = '#ffe36a'; ctx.fillRect(-2.5, -28, 5, 28); ctx.beginPath(); ctx.ellipse(-5, -31, 5, 3, -0.5, 0, 7); ctx.ellipse(5, -31, 5, 3, 0.5, 0, 7); ctx.fill();
  }
}
function shadeHex(hex, f) { const n = parseInt(hex.slice(1), 16); return `rgb(${(n >> 16) * f | 0},${((n >> 8) & 255) * f | 0},${(n & 255) * f | 0})`; }
const show = id => $(id).classList.remove('hidden'), hide = id => $(id).classList.add('hidden');

// ---------- input: one finger, relative drag, mash-safe ----------
let activeId = null, lastPX = 0, lastPY = 0, fingerDown = false, anchorX = 0, anchorY = 0;
const STICK = 60; // px of finger travel for full speed
const stickEl = document.createElement('div'); stickEl.id = 'stick'; stickEl.innerHTML = '<div></div>'; document.body.appendChild(stickEl);
function showStick() { stickEl.style.display = 'block'; stickEl.style.transform = `translate(${anchorX}px,${anchorY}px)`; stickEl.firstChild.style.transform = `translate(${lastPX - anchorX}px,${lastPY - anchorY}px)`; }
function hideStick() { stickEl.style.display = 'none'; }
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Sfx.init();
  if (activeId !== null || !playing || paused) return;
  activeId = e.pointerId; lastPX = e.clientX; lastPY = e.clientY; fingerDown = true;
  anchorX = e.clientX; anchorY = e.clientY; showStick(); // floating joystick: the press point is the centre; pressing alone never moves the hole
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== activeId) return; e.preventDefault();
  lastPX = e.clientX; lastPY = e.clientY;
  // anchor trails behind the finger once it's far away, so reversing direction is instant
  const vx = lastPX - anchorX, vy = lastPY - anchorY, L = Math.hypot(vx, vy);
  if (L > STICK) { anchorX = lastPX - vx / L * STICK; anchorY = lastPY - vy / L * STICK; }
  showStick();
});
const endPtr = e => { if (e.pointerId === activeId) { activeId = null; fingerDown = false; hideStick(); } };
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr); cv.addEventListener('lostpointercapture', endPtr);
['gesturestart', 'gesturechange', 'contextmenu', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
// iOS popups, app switching and Control Centre: freeze the level and keep it, never restart it
const interrupt = () => { fingerDown = false; activeId = null; hideStick(); if (playing && !ending) { if (!paused) doPause(); saveSnap(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); else last = performance.now(); });
addEventListener('pagehide', interrupt); addEventListener('blur', interrupt);
addEventListener('pageshow', () => { last = performance.now(); });
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// debounced buttons so mashing can't double-fire
function btn(id, fn) { let last = 0; $(id).addEventListener('pointerup', e => { e.stopPropagation(); const n = performance.now(); if (n - last < 350) return; last = n; Sfx.init(); Sfx.tap(); fn(); }); }
function doPause() { if (!playing || ending) return; paused = true; activeId = null; fingerDown = false; hideStick(); show('pause'); }
btn('btnPause', doPause);
btn('btnHome', goMap);
btn('btnResume', () => { paused = false; hide('pause'); });
btn('btnPauseHome', goMap);
btn('btnRun', () => { hide('home'); show('map'); buildMap(); });
btn('btnMapBack', goHome);
btn('btnCont', () => { paused = false; hide('timeup'); });
btn('btnExit', goMap);
btn('btnFree', () => { curStop = null; startGame('free'); });
btn('btnAgain', () => startGame(lastMode || 'run', lastWorld));
btn('btnEndHome', goMap);
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
  save.owned = save.owned || []; { const eq = SKINS.find(k => k.id === save.skin); if (eq && eq.coins && !save.owned.includes(eq.id)) save.owned.push(eq.id); } // older saves keep what they wear
  for (const s of SKINS) {
    const unlocked = s.coins ? save.owned.includes(s.id) : save.stars >= s.cost, afford = s.coins && !unlocked && save.coins >= s.coins;
    const card = document.createElement('button');
    card.className = 'skin' + (save.skin === s.id ? ' on' : '') + (unlocked ? '' : ' locked') + (afford ? ' can' : ''); card.dataset.id = s.id;
    const c = document.createElement('canvas'); c.width = c.height = 200; const cx = c.getContext('2d');
    cx.fillStyle = '#3a3f47'; cx.fillRect(0, 0, 200, 200); drawHole(cx, 100, 100, 58, s.id, 0);
    card.appendChild(c);
    const cost = document.createElement('div'); cost.className = 'cost';
    cost.innerHTML = unlocked ? (save.skin === s.id ? '<span class="star">✔</span>' : '') : '<span>🔒</span>' + (s.coins ? '<span class="coin"></span>' + s.coins : '<span class="star">★</span>' + s.cost);
    const nm = document.createElement('div'); nm.className = 'sname'; nm.textContent = s.name; card.appendChild(nm);
    card.appendChild(cost);
    card.addEventListener('pointerup', () => {
      if (afford) { save.coins -= s.coins; save.owned.push(s.id); save.skin = s.id; persist(); Sfx.star(); buildWardrobe(); return; } // pay with coins earned in play
      if (!unlocked) { Sfx.teeter(); return; } save.skin = s.id; persist(); Sfx.star(); buildWardrobe(); });
    box.appendChild(card);
  }
  refreshStars();
}
function refreshStars() { $('coinCount').textContent = runCoins; $('starCountMap').textContent = save.stars; $('coinCountMap').textContent = save.coins; $('starCount').textContent = save.stars; $('starCountHome').textContent = save.stars; $('starCountWard').textContent = save.stars; if ($('coinCountWard')) $('coinCountWard').textContent = save.coins; }
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
    if (v.lane.dir !== 'p' && (v.along < -100 || v.along > W.SIZE + 100)) v.along = v.speed > 0 ? -90 : W.SIZE + 90;
    placeVehicle(v);
  }
  updatePeds(dt); updateBirds(dt);
  if (!playing) { cam.x = W.SIZE / 2 + Math.cos(time * 0.05) * 600; cam.y = W.SIZE / 2 + Math.sin(time * 0.05) * 400; cam.s = Math.min(Wd, Ht) / 900; return; }

  if (AUTOPLAY) autoSteer();
  // hole glides toward target (smoothed, speed-capped)
  if (!AUTOPLAY) { // steer: direction = finger offset from the press point, speed grows with the offset
    hole.tx = hole.x; hole.ty = hole.y;
    if (fingerDown) { const vx = lastPX - anchorX, vy = lastPY - anchorY, L = Math.hypot(vx, vy);
      if (L > 6) { const sp = (170 + hole.R * 2.4) * Math.min(1, (L - 6) / (STICK - 6)), wy = vy / TILT, n = Math.hypot(vx, wy);
        hole.tx = clamp(hole.x + vx / n * sp * dt, 30, W.SIZE - 30); hole.ty = clamp(hole.y + wy / n * sp * dt, 30, W.SIZE - 30); } } }
  const dx = hole.tx - hole.x, dy = hole.ty - hole.y, d = Math.hypot(dx, dy), maxV = (AUTOPLAY ? 380 + hole.R * 3 : 1e5) * dt;
  // glued to the finger: closes ~95% of the gap in 0.15s; the cap only stops wild teleports on a jump-tap
  if (d > 0.01) { const k = Math.min(1, maxV / d); hole.x += dx * k; hole.y += dy * k; }
  const targetR = HOLE_R[hole.level];
  hole.R += (targetR - hole.R) * Math.min(1, dt * 4); hole.pulse = Math.max(0, hole.pulse - dt * 2); hole.gulp = Math.max(0, (hole.gulp || 0) - dt * 3);

  // swallow / teeter
  for (let ai = 0, an = objs.length + vehicles.length; ai < an; ai++) { const o = ai < objs.length ? objs[ai] : vehicles[ai - objs.length]; if (!o) continue;
    if (o.state !== 'idle') continue;
    const dd = Math.hypot(o.x - hole.x, o.y - hole.y);
    if (dd > hole.R + o.r + 10) { o.wob = Math.max(0, o.wob - dt); continue; }
    if (o.size <= hole.level && dd + o.r * 0.5 < hole.R) {
      if (mode === 'order' && !orderMatch(o)) { // wrong thing: gently pops back out, no penalty
        if (!o.moving) { const ux = dd > 1 ? (o.x - hole.x) / dd : 1, uy = dd > 1 ? (o.y - hole.y) / dd : 0; o.x = hole.x + ux * (hole.R + o.r + 6); o.y = hole.y + uy * (hole.R + o.r + 6); }
        o.wob = 0.6; Sfx.teeter();
      } else if (falling.length < 8) startFall(o);
    }
    else if (o.size > hole.level && dd < hole.R + o.r * 0.6) { o.wob = 0.6; Sfx.teeter(); }
  }
  // people and pets can be swallowed too (they pop back out somewhere else later)
  for (const arr of [peds, birds]) for (let i = arr.length - 1; i >= 0; i--) {
    const c = arr[i]; if (falling.length >= 8) break;
    if (mode === 'order') { pushOut(c, hole.R + 10); continue; }
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
  if (mode === 'timed' && !ringDone && !ending) {
    ringT += dt; $('ring').style.setProperty('--p', Math.min(100, ringT / RING_T * 100).toFixed(1) + '%');
    if (ringT >= RING_T) { ringDone = true; paused = true; fingerDown = false; activeId = null; hideStick(); show('timeup'); } // nothing fails: Continue or Exit
  }
  if (!ending && (snapT += dt) > 4) { snapT = 0; saveSnap(); }
  if (ending) { if (ending > 3) clearSnap(); ending -= dt; if (Math.random() < dt * 6) firework(); if (ending <= 0) { ending = 0; playing = false; $('endStars').textContent = '+' + runStars; $('endCoins').textContent = '+' + runCoins; $('endCoinsPill').classList.toggle('hidden', !runCoins); show('end'); } }

  // camera follows hole, zooms out as it grows
  const mn = Math.min(Wd, Ht), base = mn / 380, want = Math.min(base, mn * 0.25 / (2 * hole.R)); // hole diameter <= 1/4 of the short side
  cam.s += (want - cam.s) * Math.min(1, dt * 1.5);
  cam.x += (hole.x - cam.x) * Math.min(1, dt * 8); cam.y += (hole.y - cam.y) * Math.min(1, dt * 8);
  { // keep the view inside the map so the void beyond the world edge never shows when zoomed out
    const hw = Wd * 0.6 / cam.s, hhT = Ht * 0.75 / (cam.s * TILT), hhB = Ht * 0.55 / (cam.s * TILT), S = W.SIZE;
    cam.x = 2 * hw >= S ? S / 2 : Math.max(hw, Math.min(S - hw, cam.x));
    cam.y = hhT + hhB >= S ? S / 2 : Math.max(hhT, Math.min(S - hhB, cam.y));
  }
}

// Demo/test autoplay (only via ?autoplay=1 in the URL; never shown to players)
const AUTOPLAY = /[?&]autoplay=1/.test(location.search);
function autoSteer() {
  let best = null, bs = -1;
  for (const o of objs.concat(vehicles)) {
    if (o.state !== 'idle' || o.size > hole.level) continue;
    if (mode === 'order' && !orderMatch(o) && !o.landmark) continue;
    const d = Math.hypot(o.x - hole.x, o.y - hole.y) + 40, sc = (o.landmark ? 1e4 : o.size * o.size) / d;
    if (sc > bs) { bs = sc; best = o; }
  }
  if (best) { hole.tx = clamp(best.x, 30, W.SIZE - 30); hole.ty = clamp(best.y, 30, W.SIZE - 30); }
}
window.__molly = { get orderIdx() { return orderIdx; }, get ring() { return ringT; }, goMap: () => goMap(), get coins() { return save.coins; }, hole, get mode() { return mode; }, get playing() { return playing; }, get paused() { return paused; }, get nParts() { return parts.length; }, birds: () => birds.map(b => ({ x: b.x, y: b.y, kind: b.kind })), fw: () => firework(), start: (m, w) => startGame(m, w), get time() { return time; }, get camS() { return cam.s; }, get swallowed() { return swallowed; }, get scored() { return scored; }, get pts() { return hole.pts; }, get level() { return hole.level; }, targets: () => objs.concat(vehicles).filter(o => o.state === 'idle').map(o => ({ x: o.x, y: o.y, size: o.size, type: o.type, lm: !!o.landmark })), toScreen: (x, y) => { const p = P3(x, y, 0), W2 = cv.width, H2 = cv.height, k = PJ.k, zr = p[1] - PJ.ocy, f = 1 / (1 - zr * k); return [(W2 / 2 + (p[0] - PJ.ocx) * f) / dpr, (H2 / 2 + zr * f) / dpr]; } };
function startFall(o) {
  o.state = 'fall'; o.ft = 0; o.dur = 0.6 + o.size * 0.1; o.sx = o.x; o.sy = o.y; o.spin = (Math.random() - 0.5) * 2.4; falling.push(o);
  if (o.critter) Sfx.scream(!o.ped); else Sfx.swallow(o.size, save.skin);
  if (parts.length < MAXP - 20) { const sk = SKINS.find(s => s.id === save.skin); for (let i = 0; i < 6 + o.size; i++) { const a = i / (6 + o.size) * 6.283; parts.push({ x: o.x, y: o.y, vx: Math.cos(a) * (120 + o.size * 25), vy: Math.sin(a) * (120 + o.size * 25), life: 0.5, col: i % 2 ? sk.rim[0] : '#ffffff', sz: 2 + o.size * 0.6 }); } }
}
let swallowed = 0, scored = 0;
function finishFall(o) {
  swallowed++;
  if (o.critter) { critterQ.push({ f: o, at: time + 15 }); hole.pts += 1; scored++; hole.gulp = 0.5; checkLevel(); updateHud(); return; }
  if (o.moving) { o.state = 'idle'; o.along = o.speed > 0 ? -90 : W.SIZE + 90; placeVehicle(o); o.lane = city.lanes[Math.floor(Math.random() * city.lanes.length)]; o.speed = Math.abs(o.speed) * o.lane.sgn; placeVehicle(o); }
  else { const i = objs.indexOf(o); if (i >= 0) objs.splice(i, 1); o.x = o.sx; o.y = o.sy; if (mode === 'free') respawnQ.push({ o, at: time + 20 + Math.random() * 15 }); }
  if (o.type === 'coin') { addCoins(1); updateHud(); return; }
  if (o.type === 'gift') { addCoins(5); addStars(1); for (let i = 0; i < 30 && parts.length < MAXP; i++) { const a = i / 30 * 7; parts.push({ x: hole.x, y: hole.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: 1, col: GIFTC[i % 4], sz: 4 }); } updateHud(); return; }
  if (mode === 'order') {
    orderIdx++; buildStrip(); Sfx.grow(); if (orderIdx < ORDER.length) hole.level = Math.max(hole.level, orderLv(orderIdx));
    if (orderIdx >= ORDER.length) { addStars(3); Sfx.win(); ending = 3.2; markDone(curStop || 'order1', 3); }
    updateHud(); return;
  }
  if (o.landmark && (mode === 'run' || mode === 'timed')) {
    addStars(5); Sfx.win(); ending = 3.2;
    if (mode === 'timed' && !ringDone) addCoins(25); // beat the ring: bonus coins
    if (curStop) markDone(curStop, mode === 'timed' && !ringDone ? 3 : 2);
    return;
  }
  if (hole.level < 8) {
    hole.pts += o.size * o.size + 1; scored++; hole.gulp = Math.min(1, 0.4 + o.size * 0.08); // +1 so small early snacks always visibly fill the bar
    checkLevel();
  }
  updateHud();
}
function checkLevel() {
  if (hole.level < 8 && mode !== 'order') {
    if (hole.pts >= LEVEL_NEED[hole.level]) {
      hole.pts -= LEVEL_NEED[hole.level]; hole.level++; hole.pulse = 1; Sfx.grow(); addStars(1);
      for (let i = 0; i < 40 && parts.length < MAXP; i++) { const a = Math.random() * 7; parts.push({ x: hole.x, y: hole.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 1, col: ['#ffd84a', '#6fe0ff', '#ff7ab8', '#7dff9a'][i % 4], sz: 4 }); }
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
    if (p.ell) { px = p.cx + Math.cos(p.t / 4 * 6.283) * p.rx; py = p.cy + Math.sin(p.t / 4 * 6.283) * p.ry; }
    else if (side === 0) { px = p.bx + e + f * L; py = p.by + e; } else if (side === 1) { px = p.bx + e + L; py = p.by + e + f * L; }
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
  for (let i = 0; i < 28 && parts.length < MAXP; i++) { const a = i / 28 * 7, sp = 200 + Math.random() * 120; parts.push({ x, y, vx: Math.cos(a) * sp / cam.s * 0.4, vy: Math.sin(a) * sp / cam.s * 0.4, life: 1.2, col, sz: 3 / cam.s }); }
}
function updateParts(dt) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); } }

// ---------- render ----------
// The scene is drawn flat-tilted into an oversized offscreen canvas, then warped row by row
// onto the screen with a perspective divide, so the floor recedes like a real 3D plane and
// every prop/shadow on it shares exactly the same projection.
const oc = document.createElement('canvas'), octx = oc.getContext('2d'), RLIST = [], depthCmp = (a, b) => (a.y + (a._k ? 0 : (a.d || 0) / 2)) - (b.y + (b._k ? 0 : (b.d || 0) / 2));
const EXW = 1.12, EXH = 1.07, PK = 0.15, OCY = 0.53; // just big enough for the warp source (was 1.8×1.6 = 2.6× the pixels)
function render() {
  const mctx = window.ctx || cv.getContext('2d');
  const ow = Math.ceil(cv.width * EXW), oh = Math.ceil(cv.height * EXH);
  if (oc.width !== ow || oc.height !== oh) { oc.width = ow; oc.height = oh; }
  const ctx = octx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = typeof gtBase === 'function' ? gtBase() : '#3a4048'; ctx.fillRect(0, 0, ow, oh);
  const s = cam.s * dpr, ox = ow / 2 - cam.x * s, oy = oh * OCY - cam.y * TILT * s;
  const G = () => ctx.setTransform(s, 0, 0, s * TILT, ox, oy);   // ground space
  const U = () => ctx.setTransform(s, 0, 0, s, ox, oy);          // upright space (y pre-multiplied by TILT)
  const hw = Wd * EXW / 2 / cam.s, hh = Ht * EXH / 2 / cam.s / TILT;
  const view = { x0: cam.x - hw - 200, x1: cam.x + hw + 200, y0: cam.y - hh - 200, y1: cam.y + hh + 1400 };
  drawGroundCached(ctx, s, ox, oy, view);
  const vis = o => o.x > view.x0 - 150 && o.x < view.x1 + 150 && o.y > view.y0 && o.y < view.y1;
  if (playing || ending) {
    const pr = hole.R * (1 + Math.sin(hole.pulse * 10) * hole.pulse * 0.08 + Math.sin((hole.gulp || 0) * 9) * (hole.gulp || 0) * 0.07);
    G(); drawCrackSprite(ctx, hole.x, hole.y, pr, ((SKINS.find(k => k.id === save.skin) || SKINS[0]).rim[0]).slice(0, 7), time);
    drawHole(ctx, hole.x, hole.y, pr, save.skin, time);
    drawSwirl(ctx, hole.x, hole.y, pr, time);
    if (mode === 'order' && orderIdx < ORDER.length) { // dotted trail + numbered glow to the next thing to swallow
      let best = null, bd = 1e9; for (const o of objs.concat(vehicles)) if (o.state === 'idle' && orderMatch(o)) { const d = Math.hypot(o.x - hole.x, o.y - hole.y); if (d < bd) { bd = d; best = o; } }
      if (best) { ctx.save(); ctx.setLineDash([14, 14]); ctx.lineDashOffset = -time * 40; ctx.strokeStyle = 'rgba(255,200,60,.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hole.x, hole.y); ctx.lineTo(best.x, best.y); ctx.stroke();
        ctx.setLineDash([]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,190,50,' + (0.6 + Math.sin(time * 6) * 0.3) + ')'; ctx.beginPath(); ctx.arc(best.x, best.y, best.r + 14 + Math.sin(time * 6) * 4, 0, 7); ctx.stroke(); ctx.restore(); }
    }
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
      if (o.type === 'coin' || o.type === 'gift') drawPickup(ctx, o, time); else if (o.critter) { if (o.ped) drawPed(ctx, o.critter, time); else drawBird(ctx, o.critter, time); }
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
  const list = RLIST; list.length = 0; let li = 0;
  for (const o of objs) if (o.state === 'idle' && vis(o)) list.push(o);
  for (const p of peds) if (vis(p)) { p._k = 1; list.push(p); }
  for (const v of vehicles) if (v.state === 'idle' && vis(v)) { v._k = 2; list.push(v); }
  for (const b of birds) if (vis(b)) { b._k = 3; list.push(b); }
  list.sort(depthCmp);
  const hy = hole.y * TILT;
  for (const it of list) {
    ctx.save();
    if (it._k === 1) { ctx.translate(it.x, it.y * TILT); drawPed(ctx, it, time); }
    else if (it._k === 2) { ctx.translate(it.x, it.y * TILT); if (it.wob > 0) ctx.rotate(Math.sin(time * 30) * 0.06 * it.wob); drawVehicleUp(ctx, it); }
    else if (it._k === 3) { ctx.translate(it.x, it.y * TILT); drawBird(ctx, it, time); }
    else if (it.type === 'coin' || it.type === 'gift') { ctx.translate(it.x, it.y * TILT); drawPickup(ctx, it, time); }
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
let costT = 0, costN = 0, errN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // 120Hz screens (ProMotion iPads/iPhones): cap at ~60fps so the battery and heat stay sensible
  if (now - last < 14) return;
  // slow devices: cover up to 0.2s per frame in <=1/30s substeps, so the game keeps real-time pace
  let dt = Math.min(0.2, (now - last) / 1000); last = now;
  const t0 = performance.now();
  try { // one bad frame must never freeze the game
    if (!paused) while (dt > 1e-4) { const st = Math.min(1 / 30, dt); update(st); dt -= st; }
    render();
  } catch (e) { errN++; window.__mollyErr = String(e && e.stack || e); if (errN < 4) console.error(e); }
  costT += performance.now() - t0; costN++;
  // adaptive quality: if frames are slow for ~1.5s, render at a lower internal resolution
  perfN++; perfT += now - perfLast; perfLast = now;
  if (perfT > 1500) { const fps = perfN * 1000 / perfT; perfN = 0; perfT = 0; window.__mollyFps = fps; window.__mollyCost = costT / Math.max(1, costN); costT = costN = 0;
    if (fps < 50 && resScale > 0.6) { resScale = Math.max(0.6, resScale - 0.2); resize(); } }
}
newWorld(); refreshStars(); hide('home'); show('map'); buildMap(); // always open on the levels map (or straight back into an interrupted level)
let snapT = 0;
Promise.all([loadSprites(), loadTextures()]).then(() => { try { resumeSnap(); } catch (e) { clearSnap(); } requestAnimationFrame(frame); });
})();
