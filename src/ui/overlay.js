import { state, zoneAt, events, smoothstep } from '../state.js';
import { resurface } from '../scroll.js';

const TEETH = `<svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0 0H100V8L96 30 92 8 88 32 84 8 80 26 76 8 72 34 68 8 64 28 60 8 56 36 52 8 48 30 44 8 40 33 36 8 32 27 28 8 24 35 20 8 16 29 12 8 8 31 4 8 0 24Z" fill="#e9e4d4"/></svg>`;

export function createOverlay({ audio, post }) {
  const ui = document.getElementById('ui');
  ui.innerHTML = `
    <div class="title"><h1>ABYSS</h1><p>${state.touch ? 'drag up to dive' : 'scroll to dive'}</p></div>
    <div class="meter">
      <div class="track"><div class="marker"></div></div>
      <div class="readout"><span class="m">0</span><small>m</small></div>
      <div class="zone">Surface</div>
    </div>
    <div class="hint audio">tap anywhere for sound</div>
    <div class="hud">
      <button id="mute">sound: tap to start</button>
      <button id="quality">bloom: on</button>
      <span class="kbd">X hides this</span>
    </div>
    <div class="credit">a dive with no purpose</div>
    <div class="angler"><div class="timer">20.0</div><div class="sub">don't let the light touch you</div></div>
    <div class="toast"></div>
    <div class="keys"></div>
    <div class="stats">
      <h2>the bottom</h2>
      <dl></dl>
      <div class="badges"></div>
      <button class="btn" id="resurface">resurface</button>
    </div>
    <div class="modal log"><div class="paper"><pre class="text"></pre><button class="close">close the log</button></div></div>
    <div class="nom">${TEETH.replace('<svg', '<svg class="top"')}<div class="word">nom.</div>${TEETH.replace('<svg', '<svg class="bottom"')}</div>
  `;
  const $ = (s) => ui.querySelector(s);
  const title = $('.title');
  const marker = $('.marker');
  const readout = $('.readout .m');
  const zoneEl = $('.meter .zone');
  const hintAudio = $('.hint.audio');
  const muteBtn = $('#mute');
  const qualityBtn = $('#quality');
  const anglerEl = $('.angler');
  const anglerTimer = $('.angler .timer');
  const toastEl = $('.toast');
  const keysEl = $('.keys');
  const statsEl = $('.stats');
  const statsDl = $('.stats dl');
  const statsBadges = $('.stats .badges');
  const modal = $('.modal.log');
  const paper = $('.paper');
  const logText = $('.paper .text');
  const nomEl = $('.nom');

  const api = { onKey: null };

  // HUD
  muteBtn.addEventListener('click', () => {
    if (!state.audioOn) return; // boot happens on the pointerdown itself
    audio.toggleMute();
  });
  qualityBtn.addEventListener('click', () => post.setQuality(state.lowQuality));
  events.addEventListener('audio', () => {
    muteBtn.textContent = state.audioOn ? (state.muted ? 'sound: off' : 'sound: on') : 'sound: tap to start';
    hintAudio.classList.add('gone');
  });
  events.addEventListener('quality', () => {
    qualityBtn.textContent = state.lowQuality ? 'bloom: off' : 'bloom: on';
    if (state.lowQuality) toast('bloom switched off to keep things smooth', 3000);
  });
  events.addEventListener('badge', (e) => toast(e.detail, 3600, 'badge'));
  events.addEventListener('resurface', () => {
    toast('resurfacing', 2500);
    stats(false);
  });
  events.addEventListener('surfaced', () => toast('welcome back. the sun is still there.', 3500));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLog();
    if (e.key.toLowerCase() === 'x' && !state.modalOpen) {
      state.uiHidden = !state.uiHidden;
      ui.classList.toggle('hidden', state.uiHidden);
    }
    if (e.key.toLowerCase() === 'm' && state.audioOn) audio.toggleMute();
  });

  // Touch piano strip.
  const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
  NAMES.forEach((n, i) => {
    const b = document.createElement('button');
    b.textContent = n;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      api.onKey && api.onKey(i);
    });
    keysEl.appendChild(b);
  });

  function toast(msg, ms = 2600, cls = '') {
    const el = document.createElement('div');
    el.className = `item ${cls}`;
    el.textContent = msg;
    toastEl.appendChild(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 450);
  }

  let typeTimer = 0;
  function openLog(text) {
    state.modalOpen = true;
    modal.classList.add('on');
    logText.textContent = '';
    let i = 0;
    clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      i += 1;
      logText.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(typeTimer);
    }, 16);
    paper.onclick = (e) => {
      if (e.target.classList.contains('close')) return;
      clearInterval(typeTimer);
      logText.textContent = text;
    };
  }
  function closeLog() {
    if (!state.modalOpen) return;
    clearInterval(typeTimer);
    modal.classList.remove('on');
    state.modalOpen = false;
  }
  $('.paper .close').addEventListener('click', closeLog);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeLog();
  });

  function nom() {
    return new Promise((res) => {
      nomEl.classList.add('on');
      setTimeout(() => {
        nomEl.classList.remove('on');
        res();
      }, 1700);
    });
  }

  function angler(sec) {
    anglerEl.classList.toggle('on', sec != null);
    if (sec != null) anglerTimer.textContent = Math.max(0, sec).toFixed(1);
  }

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function stats(show) {
    statsEl.classList.toggle('on', show);
    if (!show) return;
    const st = state.stats;
    const rows = [
      ['time to bottom', fmtTime(performance.now() - state.startTime)],
      ['jellies petted', st.jellies],
      ['notes played', st.notes],
      ['eaten', st.anglerDeaths + (st.anglerDeaths === 1 ? ' time' : ' times')],
      ['angler outrun', st.anglerWins ? 'yes' : 'no'],
    ];
    statsDl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    statsBadges.textContent = state.badges.length ? state.badges.map((b) => '✦ ' + b).join('   ') : 'no badges. a pure, aimless descent.';
  }
  $('#resurface').addEventListener('click', () => {
    audio.whoosh(7);
    resurface();
  });

  function keys(show) {
    keysEl.classList.toggle('on', show && state.touch);
    if (show && state.touch) hintAudio.classList.add('gone');
  }

  // Zone label swap is driven from the frame loop, not timers, so rapid
  // depth changes can't leave it stale.
  let shownZone = '';
  let swapAt = 0;
  function update() {
    const d = state.depth;
    readout.textContent = Math.round(d);
    marker.style.top = `${(d / state.maxDepth) * 100}%`;
    title.style.opacity = 1 - smoothstep(60, 320, d);
    title.style.pointerEvents = 'none';
    const z = zoneAt(d).name;
    if (z !== shownZone) {
      if (!zoneEl.classList.contains('swap')) {
        zoneEl.classList.add('swap');
        swapAt = performance.now() + (shownZone ? 300 : 0);
      }
      if (performance.now() >= swapAt) {
        zoneEl.textContent = z;
        shownZone = z;
        zoneEl.classList.remove('swap');
      }
    }
  }

  Object.assign(api, { update, toast, openLog, closeLog, nom, angler, stats, keys });
  return api;
}
