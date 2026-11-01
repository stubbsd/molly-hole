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
    const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = YIP; s.playbackRate.value = 0.97 + Math.random() * 0.1; g.gain.value = 1.3; s.connect(g); g.connect(master); s.onended = () => { yipBusy = false; }; s.start(ctx.currentTime + 0.05);
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'sine', 0.1, f * 1.5, 0.05 + i * 0.07)); } // + a happy rising whistle
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
  // Original bouncy kids' tune: soft marimba-style lead, glockenspiel sparkle, round "oom-pah" bass, offbeat
  // ukulele-ish chord plucks and a quiet shaker. 16 bars in F major at 116 bpm.
  const F = n => 349.23 * Math.pow(2, n / 12); // semitones from F4
  const CH = [[0,4,7],[5,9,12],[7,11,14],[0,4,7], [9,12,16],[5,9,12],[7,11,14],[0,4,7], [0,4,7],[2,5,9],[7,11,14],[9,12,16], [5,9,12],[7,11,14],[0,4,7],[0,4,7]];
  const _ = null; // melody: 8 eighth-notes per bar, skipping and bouncing
  const MEL = [0,_,4,7, 9,7,4,_,  5,_,9,_, 12,9,5,_,  7,9,11,_, 14,_,11,7,  12,_,7,4, 0,_,_,_,
               9,_,12,9, 7,_,4,_,  5,7,9,_, 12,_,9,_,  11,_,7,_, 9,11,14,_,  12,_,_,7, 12,_,_,_,
               16,_,12,_, 7,_,12,_, 14,_,9,_, 5,_,9,_,  11,_,14,_, 11,7,_,_,  9,_,12,_, 16,_,_,_,
               17,_,16,14, 12,_,9,_, 14,_,11,_, 7,9,11,_, 12,_,7,_, 4,_,0,_,  7,_,_,4, 0,_,_,_];
  const SPB = 60 / 116 / 2, LOOP_T = 128 * SPB;
  let LOOP = null, loopBusy = false, musicSrc = null;
  function voice(ac, dest, freq, dur, type, vol, t) { // same envelope as tone()
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function tickAt(ac, dest, t, nb) { const s = ac.createBufferSource(); s.buffer = nb; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = ac.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.05); }
  function songStep(ac, dest, i, t, nb) {
    const bar = i >> 3, b8 = i & 7, c = CH[bar], m = MEL[i];
    if (m !== null) { voice(ac, dest, F(m), SPB * 2.2, 'sine', 0.22, t); voice(ac, dest, F(m) * 4, SPB * 2.2 * 0.25, 'sine', 0.22 * 0.12, t); if (bar % 4 === 3 && b8 === 0) voice(ac, dest, F(m + 24), 0.5, 'sine', 0.04, t); }
    if (b8 === 0 || b8 === 4) voice(ac, dest, F(c[0] - 24 + (b8 === 4 ? 7 : 0)), SPB * 1.6, 'sine', 0.32, t); // oom
    if (b8 === 2 || b8 === 6) for (let n = 0; n < 3; n++) voice(ac, dest, F(c[n] - 12), SPB * 0.7, 'triangle', 0.045, t); // pah
    if (b8 % 2 === 1) tickAt(ac, dest, t, nb);
  }
  function renderLoop() { // one-off, async; leaves the live scheduler running if anything is unsupported
    if (LOOP || loopBusy) return; const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return; loopBusy = true;
    try {
      const sr = ctx.sampleRate, n = Math.ceil((LOOP_T + 1) * sr), oc = new OAC(1, n, sr);
      const nb = oc.createBuffer(1, sr, sr), src = nbuf().getChannelData(0); nb.getChannelData(0).set(src);
      for (let i = 0; i < 128; i++) songStep(oc, oc.destination, i, 0.02 + i * SPB, nb);
      const done = b => { if (LOOP || !b) return; const d = b.getChannelData(0), L = Math.round(LOOP_T * sr), o = Math.round(0.02 * sr);
        const out = ctx.createBuffer(1, L, sr), od = out.getChannelData(0); for (let i = 0; i < L; i++) od[i] = d[i + o]; for (let i = L + o, j = 0; i < n; i++, j++) od[j % L] += d[i]; LOOP = out; }; // fold the ringing tail back onto the start: seamless loop
      oc.oncomplete = e => done(e.renderedBuffer); const pr = oc.startRendering(); if (pr && pr.then) pr.then(done, () => { loopBusy = false; });
    } catch (_) { loopBusy = false; }
  }
  function playLoop(t, off = 0) { musicSrc = ctx.createBufferSource(); musicSrc.buffer = LOOP; musicSrc.loop = true; musicSrc.connect(musicGain); musicSrc.start(t, off); }
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
    // GC: the song used to create ~50 one-shot AudioNodes a second forever (each a GC'd wrapper on iOS).
    // Now the identical notes are rendered ONCE into a buffer (OfflineAudioContext) and looped by a single node;
    // the live scheduler only plays until the buffer is ready, then hands over exactly on the loop boundary.
    startMusic() {
      if (!ctx || musicTimer || musicSrc) return;
      renderLoop();
      if (LOOP) { playLoop(ctx.currentTime + 0.1); return; }
      let step = 0, next = ctx.currentTime + 0.1;
      musicTimer = setInterval(() => {
        while (next < ctx.currentTime + 0.35) {
          if (step % 8 === 0 && step > 0 && LOOP) { clearInterval(musicTimer); musicTimer = null; playLoop(next, (step % 128) * SPB); return; } // hand over on the next bar line
          songStep(ctx, musicGain, step % 128, next, nbuf()); step++; next += SPB;
        }
      }, 100);
    },
    stopMusic() { clearInterval(musicTimer); musicTimer = null; if (musicSrc) { try { musicSrc.stop(); } catch (_) {} musicSrc.disconnect(); musicSrc = null; } },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; },
    get loopBuffer() { return LOOP; },
    get musicMode() { return musicSrc ? 'loop' : musicTimer ? 'live' : 'off'; }
  };
})();
