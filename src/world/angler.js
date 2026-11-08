import * as THREE from 'three';
import { state, rand, award } from '../state.js';
import { kickCamera } from '../camera.js';

const ZONE_DEPTH = 2800;
const HUNT_FROM = 2640;
const HUNT_TO = 3250;
const SURVIVE = 20;
const CATCH_PX = 34;

export function createAngler({ scene, camera, fx, audio, overlay }) {
  const group = new THREE.Group();
  scene.add(group);

  // The lure: the only light in this stretch.
  const lure = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
  const lureLight = new THREE.PointLight(0xffd27a, 12, 18, 1.8);
  lure.add(lureLight);
  group.add(lure);

  // The fish, barely there.
  const fish = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x0a0e16, roughness: 0.85, metalness: 0.25 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 22, 16), skin);
  head.scale.set(1.5, 1.1, 1.3);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(1.4, 22, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin);
  jaw.scale.set(1.45, 1.0, 1.25);
  jaw.position.set(0, -0.2, 0.2);
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.4 });
  const toothGeo = new THREE.ConeGeometry(0.07, 0.55, 5);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 1.35;
    const upper = i % 2 === 0;
    const tooth = new THREE.Mesh(toothGeo, toothMat);
    tooth.position.set(Math.cos(a) * r * 1.4, upper ? -0.15 : -0.35, Math.sin(a) * r * 1.2 + 0.1);
    tooth.rotation.x = upper ? Math.PI : 0;
    tooth.rotation.z = rand(-0.2, 0.2);
    if (Math.sin(a) > -0.2) (upper ? head : jaw).add(tooth);
  }
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x202838, roughness: 0.2, metalness: 0.6, emissive: 0x334455, emissiveIntensity: 0.3 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), eyeMat);
    eye.position.set(sx * 1.1, 0.6, 1.1);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(sx * 1.05, 0.7, 1.3);
    head.add(eye, glint);
  }
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12), skin);
  body.scale.set(1.3, 0.9, 2.2);
  body.position.set(0, 0, -2.6);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 3), skin);
  tail.position.set(0, 0, -5.2);
  tail.rotation.x = Math.PI / 2;
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.6, 5), skin);
  stalk.position.set(0, 1.9, 0.9);
  stalk.rotation.x = 0.8;
  fish.add(head, jaw, body, tail, stalk);
  group.add(fish);

  // Game state.
  let mode = 'idle'; // idle | hunt | dead | won
  let timer = 0;
  let speed = 0;
  let lungeT = 0;
  let wander = 0;
  const lurePx = { x: 0, y: 0 };
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const offset = new THREE.Vector3();
  let jawOpen = 0;
  let flare = 0;
  let respawnAt = 0;

  function placeFar() {
    const p = state.pointerPx;
    const corners = [
      [60, 60],
      [innerWidth - 60, 60],
      [60, innerHeight - 60],
      [innerWidth - 60, innerHeight - 60],
    ];
    corners.sort((a, b) => Math.hypot(b[0] - p.x, b[1] - p.y) - Math.hypot(a[0] - p.x, a[1] - p.y));
    lurePx.x = corners[0][0];
    lurePx.y = corners[0][1];
  }
  placeFar();

  function startHunt() {
    mode = 'hunt';
    timer = SURVIVE;
    speed = 115;
    lungeT = 3.5;
    placeFar();
    group.visible = true;
    overlay.angler(timer);
    overlay.toast(state.stats.anglerDeaths ? 'again.' : "something is watching. don't let the light touch you.", 3200);
  }

  function caught() {
    mode = 'dead';
    state.stats.anglerDeaths++;
    audio.thud();
    kickCamera(2.5);
    group.visible = false;
    overlay.angler(null);
    overlay.nom().then(() => {
      respawnAt = performance.now() + 400;
    });
  }

  function won() {
    mode = 'won';
    state.stats.anglerWins++;
    audio.win();
    award('Uneaten');
    overlay.angler(null);
    overlay.toast('the angler is disappointed in you.', 3500);
    lure.getWorldPosition(v);
    fx.burst(v, 0xffd27a, 24, 5);
  }

  function update(dt, t) {
    const d = state.depth;
    const inZone = d > HUNT_FROM && d < HUNT_TO;
    const p = state.pointerPx;

    if (mode === 'dead') {
      if (respawnAt && performance.now() > respawnAt) {
        respawnAt = 0;
        mode = 'idle';
      }
      return;
    }

    if (!inZone) {
      if (mode === 'hunt') {
        mode = 'idle';
        overlay.angler(null);
        overlay.toast('it lost interest.', 2000);
      }
    } else if (mode === 'idle' && !state.resurfacing && !state.modalOpen && state.pointerInside) {
      startHunt();
    }

    // Movement in screen space.
    const dx = p.x - lurePx.x;
    const dy = p.y - lurePx.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (mode === 'hunt' && state.pointerInside && !state.modalOpen) {
      timer -= dt;
      lungeT -= dt;
      speed += 14 * dt;
      let s = speed;
      const lunging = lungeT < 0.45 && lungeT > 0;
      flare += (((lungeT < 0.95 && lungeT > 0.45) ? 1 : 0) - flare) * (1 - Math.exp(-dt * 10));
      if (lunging) s *= 2.7;
      if (lungeT < 0) lungeT = 3 + rand(0, 1.6);
      wander += dt * 2.1;
      const px = -dy / dist, py = dx / dist; // perpendicular
      const side = Math.sin(wander) * 0.45;
      lurePx.x += (dx / dist + px * side) * s * dt;
      lurePx.y += (dy / dist + py * side) * s * dt;
      jawOpen += ((lunging ? 1 : 0.15) - jawOpen) * (1 - Math.exp(-dt * 8));
      overlay.angler(timer);
      if (dist < CATCH_PX) return caught();
      if (timer <= 0) return won();
    } else if (mode === 'won' || (mode === 'idle' && inZone)) {
      // Harmless: keeps a polite distance.
      const want = 220;
      const k = (dist - want) * 0.8;
      lurePx.x += (dx / dist) * k * dt;
      lurePx.y += (dy / dist) * k * dt;
      jawOpen += (0.1 - jawOpen) * dt * 3;
      flare *= Math.exp(-dt * 4);
    } else {
      // Out of zone: drift away to a corner and wait.
      const cx = lurePx.x < innerWidth / 2 ? 40 : innerWidth - 40;
      lurePx.x += (cx - lurePx.x) * dt;
      lurePx.y += (-60 - lurePx.y) * dt;
    }
    group.visible = inZone || mode === 'won';
    lurePx.x = Math.max(-80, Math.min(innerWidth + 80, lurePx.x));
    lurePx.y = Math.max(-120, Math.min(innerHeight + 80, lurePx.y));

    // Project to world, a fixed distance in front of the camera.
    v.set((lurePx.x / innerWidth) * 2 - 1, -((lurePx.y / innerHeight) * 2 - 1), 0.5).unproject(camera);
    dir.copy(v).sub(camera.position).normalize();
    lure.position.copy(camera.position).addScaledVector(dir, 11);
    lure.position.y += Math.sin(t * 3) * 0.08;
    lureLight.intensity = (10 + Math.sin(t * 9) * 1.5 + flare * 22) * (mode === 'won' ? 0.6 : 1);
    lure.material.color.setHSL(0.12, 1, 0.75 + flare * 0.25);

    offset.set(0.3, -1.7, -3.2).applyQuaternion(camera.quaternion);
    fish.position.copy(lure.position).add(offset);
    fish.quaternion.copy(camera.quaternion);
    fish.rotateY(Math.sin(t * 0.8) * 0.1);
    jaw.rotation.x = 0.2 + jawOpen * 0.75;
    tail.rotation.y = Math.sin(t * 4) * 0.4;
  }

  function onActive(on) {
    if (!on && mode === 'hunt') {
      mode = 'idle';
      overlay.angler(null);
    }
    if (on) group.visible = mode !== 'dead';
  }

  return { name: 'angler', group, depth: ZONE_DEPTH, range: 650, hitTargets: [], onHit() {}, update, onActive, active: false };
}
