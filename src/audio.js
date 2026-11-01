// All sounds synthesised live with Web Audio. No sample files.
const Sfx = (() => {
  let ctx = null, master = null, musicGain = null, muted = false, musicTimer = null, lastTeeter = 0, lastSw = 0;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0, dest = null) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  let NB = null; // one shared noise buffer, made once (no per-swallow allocation)
  function nbuf() { if (!NB) { const len = ctx.sampleRate; NB = ctx.createBuffer(1, len, ctx.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; } return NB; }
  function tick(when) { const t = ctx.currentTime + when, s = ctx.createBufferSource(); s.buffer = nbuf(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + 0.05); }
  function noise(dur, vol, freq) {
    if (!ctx) return; const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = nbuf(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  return {
    init,
    swallow(size, skin) {
      const n = performance.now(); if (n - lastSw < 70) return; lastSw = n; // dense parks: don't stack dozens of voices
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
    // Original cheerful chiptune loop (square lead, triangle bass, soft noise tick), scheduled ahead on the
    // audio clock so it stays in time even when the page is busy. 8 bars, C major, ~132 bpm.
    startMusic() {
      if (!ctx || musicTimer) return;
      const N = n => 261.63 * Math.pow(2, n / 12); // semitones from middle C
      const lead = [0,4,7,12, 7,4,7,null, 5,9,12,9, 7,null,4,null, 2,5,9,5, 7,11,14,11, 12,null,7,4, 0,null,null,null,
                    0,4,7,9, 7,4,2,4, 5,null,9,7, 5,4,2,null, -1,2,5,7, 9,7,5,2, 0,4,7,4, 0,null,null,null];
      const bass = [0,0,7,7, 5,5,0,0, 2,2,7,7, 0,0,7,0, 0,0,9,9, 5,5,7,7, 0,0,5,5, 7,7,0,0];
      const SPB = 60 / 132 / 2; let step = 0, next = ctx.currentTime + 0.1;
      musicTimer = setInterval(() => {
        while (next < ctx.currentTime + 0.35) {
          const i = step % 64, t = next - ctx.currentTime, n = lead[i];
          if (n !== null) tone(N(n + 12), SPB * 0.9, 'square', 0.09, null, t, musicGain);
          if (i % 2 === 0) tone(N(bass[i / 2] - 12), SPB * 1.8, 'triangle', 0.3, null, t, musicGain);
          if (i % 4 === 2) tick(t);
          step++; next += SPB;
        }
      }, 100);
    },
    stopMusic() { clearInterval(musicTimer); musicTimer = null; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; }
  };
})();
