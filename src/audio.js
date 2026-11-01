// All sounds synthesised live with Web Audio. No sample files.
const Sfx = (() => {
  let ctx = null, master = null, musicGain = null, muted = false, musicTimer = null, lastTeeter = 0;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(master);
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0, dest = null) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq) {
    if (!ctx) return; const t = ctx.currentTime; const len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  return {
    init,
    swallow(size, skin) {
      const base = 520 / (1 + size * 0.45);
      tone(base, 0.25 + size * 0.04, 'sine', 0.35, base * 0.45);
      if (size >= 4) noise(0.35 + size * 0.05, 0.25, 300 + 1200 / size);
      if (skin === 'tiger') tone(90, 0.3, 'triangle', 0.18, 70);
      if (skin === 'ice') tone(1800, 0.2, 'sine', 0.08, 2400, 0.05);
      if (skin === 'galaxy') tone(880, 0.3, 'sine', 0.06, 1320, 0.05);
    },
    grow() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.22, null, i * 0.09)); },
    teeter() { const n = performance.now(); if (n - lastTeeter < 400) return; lastTeeter = n; tone(140, 0.15, 'sine', 0.15, 110); },
    tap() { tone(660, 0.08, 'sine', 0.15, 880); },
    star() { tone(1320, 0.15, 'sine', 0.15, 1760); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.6, 'triangle', 0.2, null, i * 0.12)); for (let i = 0; i < 6; i++) setTimeout(() => noise(0.4, 0.12, 2000), 600 + i * 350); },
    startMusic() {
      if (!ctx || musicTimer) return; let step = 0;
      const prog = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]];
      musicTimer = setInterval(() => {
        const ch = prog[Math.floor(step / 8) % 4];
        tone(ch[step % 3] * 2, 0.5, 'triangle', 0.25, null, 0, musicGain);
        if (step % 8 === 0) tone(ch[0] / 2, 1.8, 'sine', 0.35, null, 0, musicGain);
        step++;
      }, 260);
    },
    stopMusic() { clearInterval(musicTimer); musicTimer = null; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; }
  };
})();
