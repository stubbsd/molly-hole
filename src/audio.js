// All sounds synthesised live with Web Audio. No sample files.
const Sfx = (() => {
  let ctx = null, master = null, musicGain = null, muted = false, musicTimer = null, lastTeeter = 0, lastSw = 0;
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    // bundled original clip (precached by the SW, so it works offline); callback decode for older Safari
    fetch('assets/sfx-loser.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b, d => { LOSER = d; }, () => {})).catch(() => {});
    fetch('assets/sfx-yippee.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b, d => { YIP = d; }, () => {})).catch(() => {});
    musicGain = ctx.createGain(); musicGain.gain.value = 0.11; // kept well under the swallow/scream SFX (0.15-0.35 on master) musicGain.connect(master);
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0, dest = null) {
    if (!ctx) return; const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  let YIP = null, yipBusy = false, lastYip = 0;
  // people dropping in shout a squeaky "Yippee!": one at a time, at most every 1.2s
  function yippee() { if (!ctx || muted || !YIP || yipBusy) return; const n = performance.now(); if (n - lastYip < 1200) return; lastYip = n; yipBusy = true;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = YIP; s.playbackRate.value = 0.95 + Math.random() * 0.15; g.gain.value = 0.7; s.connect(g); g.connect(master); s.onended = () => { yipBusy = false; }; s.start(ctx.currentTime + 0.05); }
  let LOSER = null, loserBusy = false, lastLoser = 0;
  // silly "I'm a loser!" as things drop in: one at a time, at most every 1.6s, so mashing never stacks it
  function loser() { if (!ctx || muted || !LOSER || loserBusy) return; const n = performance.now(); if (n - lastLoser < 1600) return; lastLoser = n; loserBusy = true;
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = LOSER; s.playbackRate.value = 0.94 + Math.random() * 0.14; g.gain.value = 0.7; s.connect(g); g.connect(master); s.onended = () => { loserBusy = false; }; s.start(ctx.currentTime + 0.12); }
  let NB = null; // one shared noise buffer, made once (no per-swallow allocation)
  function nbuf() { if (!NB) { const len = ctx.sampleRate; NB = ctx.createBuffer(1, len, ctx.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; } return NB; }
  function tick(when) { const t = ctx.currentTime + when, s = ctx.createBufferSource(); s.buffer = nbuf(); const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = ctx.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + 0.05); }
  function noise(dur, vol, freq) {
    if (!ctx) return; const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = nbuf(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  let lastScream = 0, screams = 0;
  // silly cartoon "wheeee-aaah!" for people dropping in: a buzzy voice through two vowel formants, pitch swooping down with a wobble
  function scream(pet) {
    if (!ctx || muted) return; const n = performance.now(); if (n - lastScream < (pet ? 150 : 260) || screams > 2) return; lastScream = n;
    const t = ctx.currentTime, p0 = pet ? 1100 + Math.random() * 300 : 520 + Math.random() * 260, dur = pet ? 0.16 : 0.75;
    const o = ctx.createOscillator(); o.type = pet ? 'triangle' : 'sawtooth';
    o.frequency.setValueAtTime(p0 * 0.8, t); o.frequency.exponentialRampToValueAtTime(p0 * 1.15, t + dur * 0.18); o.frequency.exponentialRampToValueAtTime(p0 * 0.45, t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 9; lg.gain.value = p0 * 0.05; lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pet ? 0.12 : 0.16, t + 0.03); g.gain.setValueAtTime(pet ? 0.12 : 0.16, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = g;
    if (!pet) { const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), mix = ctx.createGain(); f1.type = f2.type = 'bandpass'; f1.frequency.value = 850; f2.frequency.value = 1250; f1.Q.value = f2.Q.value = 6; mix.gain.value = 2.2;
      f1.frequency.linearRampToValueAtTime(700, t + dur); g.connect(f1); g.connect(f2); f1.connect(mix); f2.connect(mix); last = mix; }
    o.connect(g); last.connect(master); screams++; o.onended = () => { screams--; };
    o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
  }
  return {
    init, scream, loser, yippee,
    swallow(size, skin) {
      const n = performance.now(); if (n - lastSw < 70) return; lastSw = n; // dense parks: don't stack dozens of voices
      const base = 520 / (1 + size * 0.45);
      tone(base, 0.25 + size * 0.04, 'sine', 0.35, base * 0.45); loser();
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
    // Original bouncy kids' tune: soft marimba-style lead, glockenspiel sparkle, round "oom-pah" bass, offbeat
    // ukulele-ish chord plucks and a quiet shaker. 16 bars in F major at 116 bpm, scheduled ahead on the audio clock.
    startMusic() {
      if (!ctx || musicTimer) return;
      const F = n => 349.23 * Math.pow(2, n / 12); // semitones from F4
      // mallet note: sine body + quiet 4x partial, quick percussive decay (gentle, never harsh)
      const mallet = (f, t, v, d) => { tone(f, d, 'sine', v, null, t, musicGain); tone(f * 4, d * 0.25, 'sine', v * 0.12, null, t, musicGain); };
      // chords per bar (root semitone + triad shape), happy loop: I IV V I / vi IV V I / I ii V vi / IV V I I
      const CH = [[0,4,7],[5,9,12],[7,11,14],[0,4,7], [9,12,16],[5,9,12],[7,11,14],[0,4,7], [0,4,7],[2,5,9],[7,11,14],[9,12,16], [5,9,12],[7,11,14],[0,4,7],[0,4,7]];
      const _ = null; // melody: 8 eighth-notes per bar, skipping and bouncing
      const MEL = [0,_,4,7, 9,7,4,_,  5,_,9,_, 12,9,5,_,  7,9,11,_, 14,_,11,7,  12,_,7,4, 0,_,_,_,
                   9,_,12,9, 7,_,4,_,  5,7,9,_, 12,_,9,_,  11,_,7,_, 9,11,14,_,  12,_,_,7, 12,_,_,_,
                   16,_,12,_, 7,_,12,_, 14,_,9,_, 5,_,9,_,  11,_,14,_, 11,7,_,_,  9,_,12,_, 16,_,_,_,
                   17,_,16,14, 12,_,9,_, 14,_,11,_, 7,9,11,_, 12,_,7,_, 4,_,0,_,  7,_,_,4, 0,_,_,_];
      const SPB = 60 / 116 / 2; let step = 0, next = ctx.currentTime + 0.1;
      musicTimer = setInterval(() => {
        while (next < ctx.currentTime + 0.35) {
          const i = step % 128, bar = i >> 3, b8 = i & 7, t = next - ctx.currentTime, c = CH[bar], m = MEL[i];
          if (m !== null) { mallet(F(m), t, 0.22, SPB * 2.2); if (bar % 4 === 3 && b8 === 0) tone(F(m + 24), 0.5, 'sine', 0.04, null, t, musicGain); }
          if (b8 === 0 || b8 === 4) tone(F(c[0] - 24 + (b8 === 4 ? 7 : 0)), SPB * 1.6, 'sine', 0.32, null, t, musicGain); // oom
          if (b8 === 2 || b8 === 6) for (const n of c) tone(F(n - 12), SPB * 0.7, 'triangle', 0.045, null, t, musicGain); // pah
          if (b8 % 2 === 1) tick(t);
          step++; next += SPB;
        }
      }, 100);
    },
    stopMusic() { clearInterval(musicTimer); musicTimer = null; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; }
  };
})();
