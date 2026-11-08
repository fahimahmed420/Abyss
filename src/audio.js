import { state, lerp, smoothstep, emit } from './state.js';

// Everything is synthesised: no audio files. The context is created on the
// first user gesture, as browsers require.
let ctx = null;
let master, wet, dry;
let drone = null;

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

function makeImpulse(seconds = 3, decay = 2.6) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function makeNoise(seconds = 1) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function boot() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = state.muted ? 0 : 0.6;
  master.connect(ctx.destination);

  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse();
  wet = ctx.createGain();
  wet.gain.value = 0.5;
  wet.connect(conv);
  conv.connect(master);
  dry = ctx.createGain();
  dry.gain.value = 0.8;
  dry.connect(master);

  startDrone();
  state.audioOn = true;
  emit('audio');
}

function startDrone() {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(dry);
  g.connect(wet);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 340;
  filt.Q.value = 1.1;
  filt.connect(g);
  const oscs = [
    ['sawtooth', 1, 0.45],
    ['sawtooth', 1.004, 0.45],
    ['sine', 0.5, 0.9],
    ['triangle', 1.5, 0.12],
  ].map(([type, ratio, vol]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = 58 * ratio;
    const og = ctx.createGain();
    og.gain.value = vol;
    o.connect(og);
    og.connect(filt);
    o.start();
    return { o, ratio };
  });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lg = ctx.createGain();
  lg.gain.value = 110;
  lfo.connect(lg);
  lg.connect(filt.frequency);
  lfo.start();
  g.gain.setTargetAtTime(0.09, ctx.currentTime, 2.5);
  drone = { g, filt, oscs };
}

function env(node, peak, a, d) {
  const now = ctx.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(0.0001, now);
  node.gain.exponentialRampToValueAtTime(peak, now + a);
  node.gain.exponentialRampToValueAtTime(0.0001, now + a + d);
}

function voice(freq, { type = 'sine', peak = 0.2, a = 0.01, d = 1.2, wetAmt = 1, detune = 0 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  const g = ctx.createGain();
  o.connect(g);
  g.connect(dry);
  if (wetAmt > 0) {
    const wg = ctx.createGain();
    wg.gain.value = wetAmt;
    g.connect(wg);
    wg.connect(wet);
  }
  env(g, peak, a, d);
  o.start();
  o.stop(ctx.currentTime + a + d + 0.1);
}

function chime() {
  if (!ctx) return;
  const f = PENTA[Math.floor(Math.random() * PENTA.length)];
  voice(f, { peak: 0.16, d: 1.6 });
  voice(f * 2, { peak: 0.04, d: 0.9 });
  voice(f * 1.5, { peak: 0.03, a: 0.03, d: 1.2 });
}

function piano(freq) {
  if (!ctx) return;
  voice(freq, { type: 'triangle', peak: 0.2, a: 0.004, d: 1.9 });
  voice(freq * 2, { type: 'sine', peak: 0.05, a: 0.004, d: 1.0 });
  voice(freq, { type: 'sine', peak: 0.09, a: 0.004, d: 2.4, detune: 5 });
}

function thud() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, now);
  o.frequency.exponentialRampToValueAtTime(26, now + 0.5);
  const g = ctx.createGain();
  o.connect(g);
  g.connect(dry);
  g.connect(wet);
  env(g, 0.9, 0.01, 0.7);
  o.start();
  o.stop(now + 0.9);

  const n = ctx.createBufferSource();
  n.buffer = makeNoise(0.4);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  const ng = ctx.createGain();
  n.connect(f);
  f.connect(ng);
  ng.connect(dry);
  env(ng, 0.5, 0.005, 0.35);
  n.start();
}

function win() {
  if (!ctx) return;
  [0, 2, 4, 6].forEach((i, k) => setTimeout(() => piano(PENTA[i] * 0.5), k * 110));
  setTimeout(chime, 520);
}

function whoosh(dur = 6) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const n = ctx.createBufferSource();
  n.buffer = makeNoise(dur + 0.5);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(180, now);
  f.frequency.exponentialRampToValueAtTime(2200, now + dur * 0.55);
  f.frequency.exponentialRampToValueAtTime(300, now + dur);
  const g = ctx.createGain();
  n.connect(f);
  f.connect(g);
  g.connect(dry);
  g.connect(wet);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.35, now + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  n.start();
  n.stop(now + dur + 0.1);
}

function moan() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, now);
  o.frequency.linearRampToValueAtTime(52, now + 2.2);
  o.frequency.linearRampToValueAtTime(58, now + 3.6);
  const vib = ctx.createOscillator();
  vib.frequency.value = 4.5;
  const vg = ctx.createGain();
  vg.gain.value = 2.5;
  vib.connect(vg);
  vg.connect(o.frequency);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 400;
  const g = ctx.createGain();
  o.connect(f);
  f.connect(g);
  g.connect(wet);
  g.connect(dry);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.5, now + 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 4);
  o.start();
  vib.start();
  o.stop(now + 4.1);
  vib.stop(now + 4.1);
}

function click() {
  voice(1800, { type: 'square', peak: 0.025, a: 0.002, d: 0.06, wetAmt: 0 });
}

function toggleMute() {
  state.muted = !state.muted;
  if (ctx) master.gain.setTargetAtTime(state.muted ? 0 : 0.6, ctx.currentTime, 0.05);
  emit('audio');
}

function update() {
  if (!drone) return;
  const d = state.depth;
  const base = lerp(58, 27, smoothstep(0, 4000, d));
  const now = ctx.currentTime;
  for (const { o, ratio } of drone.oscs) o.frequency.setTargetAtTime(base * ratio, now, 0.6);
  drone.filt.frequency.setTargetAtTime(lerp(380, 130, smoothstep(0, 3500, d)), now, 0.6);
}

export function createAudio() {
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, boot, { passive: true });
  return {
    update,
    chime,
    piano,
    thud,
    win,
    whoosh,
    moan,
    click,
    toggleMute,
    get ready() {
      return !!ctx;
    },
  };
}
