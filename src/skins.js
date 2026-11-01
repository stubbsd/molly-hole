// Hole skins: drawn procedurally. Unlocked with stars earned in play. No purchases.
const SKINS = [
  // cost = stars needed (unlocks by itself as stars build up); coins = price paid once with earned coins
  { id: 'blue', name: 'Blue Glow', cost: 0, rim: ['#1f8fff', '#9fe0ff'] },
  { id: 'stone', name: 'Stone Well', cost: 10, img: 'k-stone', inner: 0.49, rim: ['#8a8676', '#c9c3ad'] },
  { id: 'galaxy', name: 'Galaxy', cost: 25, img: 'k-galaxy', inner: 0.55, rim: ['#6a3cff', '#e08bff'] },
  { id: 'ice', name: 'Ice Crystal', cost: 40, img: 'k-ice', inner: 0.49, rim: ['#7fd8ff', '#ffffff'] },
  { id: 'tiger', name: 'Tiger Mouth', cost: 0, coins: 30, img: 'k-tiger', inner: 0.57, rim: ['#e8871e', '#ffc066'] },
  { id: 'gold', name: 'Molten Gold', cost: 0, coins: 60, img: 'k-gold', inner: 0.49, rim: ['#e8b923', '#fff1a8'] },
  { id: 'neon', name: 'Neon', cost: 0, coins: 90, img: 'k-neon', inner: 0.62, rim: ['#19ff9c', '#d0ffef'] },
];
function drawHole(ctx, x, y, R, skinId, t) { // simplified flat look: solid rim, thick outline, plain dark middle
  const s = SKINS.find(k => k.id === skinId) || SKINS[0];
  const rimW = Math.max(4, R * 0.16);
  ctx.save();
  ctx.fillStyle = s.rim[0]; ctx.beginPath(); ctx.arc(x, y, R + rimW * 1.3, 0, 7); ctx.fill();
  ctx.strokeStyle = '#1a1f2b'; ctx.lineWidth = Math.max(2, rimW * 0.3); ctx.stroke();
  ctx.fillStyle = s.rim[1]; ctx.beginPath(); ctx.arc(x, y, R + rimW * 0.55, 0, 7); ctx.fill();
  ctx.fillStyle = '#0d1220'; ctx.beginPath(); ctx.arc(x, y, R - rimW * 0.05, 0, 7); ctx.fill();
  ctx.restore();
}

// swirling arms inside the hole so it always feels alive (cheap: a few arcs)
function drawSwirl(ctx, x, y, R, t) {
  return; // simplified art: plain hole, no swirl
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  // two counter-rotating layers of spiral arms + a sparkle ring sucked toward the middle
  for (const [n, sp, a0, r0, w] of [[6, -2.6, .42, .62, .09], [4, 1.5, .26, .38, .06]]) {
    ctx.save(); ctx.rotate(t * sp);
    for (let i = 0; i < n; i++) { ctx.rotate(Math.PI * 2 / n); ctx.strokeStyle = i % 2 ? `rgba(120,210,255,${a0})` : `rgba(255,255,255,${a0 * 0.7})`; ctx.lineWidth = Math.max(1.5, R * w); ctx.beginPath(); ctx.arc(R * 0.2, 0, R * r0, -0.5, 1.4); ctx.stroke(); }
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(200,240,255,.8)';
  for (let i = 0; i < 10; i++) { const ph = (t * 0.7 + i / 10) % 1, rr = R * 0.92 * (1 - ph), a = i * 2.4 - t * 3 - ph * 4; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, Math.max(1, R * 0.035), 0, 7); ctx.fill(); }
  ctx.restore();
}
