import gsap from 'gsap';
import { state, clamp, emit } from './state.js';

function add(metres) {
  if (state.resurfacing || state.modalOpen) return;
  state.targetDepth = clamp(state.targetDepth + metres, 0, state.maxDepth);
}

export function initScroll() {
  window.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? innerHeight : 1;
      add(e.deltaY * unit * 0.7);
    },
    { passive: false }
  );

  // Touch: drag up to dive, drag down to rise. One finger.
  let lastY = null;
  let lastT = 0;
  let flick = 0;
  window.addEventListener(
    'touchstart',
    (e) => {
      lastY = e.touches[0].clientY;
      lastT = performance.now();
      flick = 0;
    },
    { passive: true }
  );
  window.addEventListener(
    'touchmove',
    (e) => {
      if (lastY === null) return;
      const y = e.touches[0].clientY;
      const now = performance.now();
      const dy = lastY - y;
      flick = dy / Math.max(1, now - lastT);
      add(dy * 3);
      lastY = y;
      lastT = now;
      e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener('touchend', () => {
    add(flick * 600);
    lastY = null;
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      add(e.key === 'PageDown' ? 400 : 140);
      e.preventDefault();
    }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      add(e.key === 'PageUp' ? -400 : -140);
      e.preventDefault();
    }
    if (e.key === 'Home') state.targetDepth = 0;
    if (e.key === 'End') state.targetDepth = state.maxDepth;
  });
}

export function updateScroll(dt) {
  if (state.resurfacing) return;
  const k = 1 - Math.exp(-dt * 3.2);
  state.depth += (state.targetDepth - state.depth) * k;
  if (Math.abs(state.targetDepth - state.depth) < 0.05) state.depth = state.targetDepth;
}

export function resurface() {
  if (state.resurfacing) return;
  state.resurfacing = true;
  emit('resurface');
  gsap.to(state, {
    depth: 0,
    targetDepth: 0,
    duration: 7,
    ease: 'power3.inOut',
    onComplete() {
      state.resurfacing = false;
      emit('surfaced');
    },
  });
}
