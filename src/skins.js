// Hole skins: drawn procedurally. Unlocked with stars earned in play. No purchases.
const SKINS = [
  { id: 'blue', cost: 0, rim: ['#1f8fff', '#9fe0ff'] },
  { id: 'tiger', cost: 12, rim: ['#e8871e', '#ffc066'] },
  { id: 'galaxy', cost: 25, rim: ['#6a3cff', '#e08bff'] },
  { id: 'ice', cost: 40, rim: ['#7fd8ff', '#ffffff'] },
  { id: 'gold', cost: 0, coins: 40, rim: ['#e8b923', '#fff1a8'] },   // Molten Gold: unlocked with coins
  { id: 'neon', cost: 0, coins: 90, rim: ['#19ff9c', '#d0ffef'] },
];
function drawHole(ctx, x, y, R, skinId, t) {
  const s = SKINS.find(k => k.id === skinId) || SKINS[0];
  const rimW = Math.max(4, R * 0.16);
  ctx.save();
  // soft glow
  const g = ctx.createRadialGradient(x, y, R * 0.8, x, y, R + rimW * 2.2);
  g.addColorStop(0, s.rim[0] + 'aa'); g.addColorStop(1, s.rim[0] + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R + rimW * 2.2, 0, 7); ctx.fill();
  // rim
  ctx.fillStyle = s.rim[0]; ctx.beginPath(); ctx.arc(x, y, R + rimW * 0.5, 0, 7); ctx.fill();
  if (skinId === 'tiger') {
    ctx.fillStyle = '#2a1608';
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + 0.1; ctx.save(); ctx.translate(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, rimW * 0.9, rimW * 0.22, 0, 0, 7); ctx.fill(); ctx.restore(); }
  } else if (skinId === 'galaxy') {
    for (let i = 0; i < 18; i++) { const a = i * 2.4 + t * 0.6; ctx.fillStyle = i % 3 ? '#fff' : '#ffd36b'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, rimW * 0.15 + (i % 3) * 0.6, 0, 7); ctx.fill(); }
  } else if (skinId === 'ice') {
    ctx.fillStyle = '#e8fbff';
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ctx.save(); ctx.translate(x + Math.cos(a) * (R + rimW * 0.3), y + Math.sin(a) * (R + rimW * 0.3)); ctx.rotate(a + Math.PI / 4); ctx.fillRect(-rimW * 0.35, -rimW * 0.35, rimW * 0.7, rimW * 0.7); ctx.restore(); }
  }
  ctx.strokeStyle = s.rim[1]; ctx.lineWidth = Math.max(1.5, rimW * 0.25); ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.stroke();
  // inside
  const ig = ctx.createRadialGradient(x, y - R * 0.2, R * 0.1, x, y, R);
  ig.addColorStop(0, '#000'); ig.addColorStop(0.75, '#05070c'); ig.addColorStop(1, skinId === 'tiger' ? '#3a1a0a' : '#0b1830');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(x, y, R - 0.5, 0, 7); ctx.fill();
  if (skinId === 'tiger') { // soft rounded teeth hints, friendly
    ctx.fillStyle = '#fff4e0';
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i - 1.5) * 0.35; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92, R * 0.07, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}

// swirling arms inside the hole so it always feels alive (cheap: a few arcs)
function drawSwirl(ctx, x, y, R, t) {
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
