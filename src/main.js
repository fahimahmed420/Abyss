import * as THREE from 'three';
import { state } from './state.js';
import { initScroll, updateScroll } from './scroll.js';
import { createCamera, updateCamera } from './camera.js';
import { createEnvironment } from './world/environment.js';
import { createEffects } from './world/effects.js';
import { createPost } from './post.js';
import { createAudio } from './audio.js';
import { createOverlay } from './ui/overlay.js';
import { createCursor } from './ui/cursor.js';
import { createJellies } from './world/jellies.js';
import { createWreck } from './world/wreck.js';
import { createPiano } from './world/piano.js';
import { createAngler } from './world/angler.js';
import { createFloor } from './world/floor.js';
import { createCreatures } from './world/creatures.js';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, state.touch ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = createCamera();
const env = createEnvironment(scene, camera);
const fx = createEffects(scene, camera);
const post = createPost(renderer, scene, camera);
const audio = createAudio();
const overlay = createOverlay({ audio, post });
const cursor = createCursor();

const ctx = { scene, camera, fx, audio, overlay, dot: env.dot };
const zones = [createJellies(ctx), createWreck(ctx), createPiano(ctx), createAngler(ctx), createFloor(ctx), ...createCreatures(ctx)];
for (const z of zones) z.group.visible = false;

initScroll();
window.abyss = state; // poke around from the console if you like

// Pointer: position for hover/aim, and a click that isn't a drag.
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let downAt = null;
function setPointer(x, y) {
  state.pointerPx.x = x;
  state.pointerPx.y = y;
  state.mouse.x = (x / innerWidth) * 2 - 1;
  state.mouse.y = -((y / innerHeight) * 2 - 1);
  state.pointerInside = true;
}
window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY));
window.addEventListener('pointerdown', (e) => {
  setPointer(e.clientX, e.clientY);
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
});
window.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  const quick = performance.now() - downAt.t < 500;
  downAt = null;
  if (moved > 8 || !quick || state.modalOpen) return;
  if (e.target.closest && e.target.closest('button')) return;
  setPointer(e.clientX, e.clientY);
  pointer.set(state.mouse.x, state.mouse.y);
  raycaster.setFromCamera(pointer, camera);
  let best = null;
  for (const z of zones) {
    if (!z.active || !z.hitTargets.length) continue;
    const hits = raycaster.intersectObjects(z.hitTargets, false);
    if (hits.length && (!best || hits[0].distance < best.hit.distance)) best = { zone: z, hit: hits[0] };
  }
  if (best) best.zone.onHit(best.hit.object, best.hit.point);
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.resize(innerWidth, innerHeight);
  cursor.resize();
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
let t = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;

  updateScroll(dt);
  updateCamera(camera, dt, t);
  camera.updateMatrixWorld();
  pointer.set(state.mouse.x, state.mouse.y);
  raycaster.setFromCamera(pointer, camera);
  state.hot = false;

  env.update(dt, t);
  for (const z of zones) {
    const active = Math.abs(state.depth - z.depth) < z.range;
    if (active !== z.active) {
      z.active = active;
      z.group.visible = active;
      z.onActive && z.onActive(active);
    }
    if (active) z.update(dt, t, raycaster);
  }
  fx.update(dt, t);
  audio.update(dt);
  overlay.update(dt);
  cursor.update(dt);
  post.render(dt, t);
});
