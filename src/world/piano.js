import * as THREE from 'three';
import { state, rand, award } from '../state.js';
import { anchorAt } from '../camera.js';
import { noise3 } from './environment.js';

const ZONE_DEPTH = 2000;
// Semitone offsets from C4 for two octaves of white and black keys.
const WHITE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
const BLACK = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
const WHITE_KEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"];
const BLACK_KEYS = ['w', 'e', 't', 'y', 'u', 'o', 'p', '[', ']'];
const LAMB = [4, 2, 0, 2, 4, 4, 4];
const freqOf = (semi) => 261.63 * Math.pow(2, semi / 12);

export function createPiano({ scene, fx, audio, overlay }) {
  const group = new THREE.Group();
  group.position.copy(anchorAt(ZONE_DEPTH, 16));
  scene.add(group);

  // A rock ledge, roughed up.
  const ledgeGeo = new THREE.BoxGeometry(20, 2.5, 9, 12, 1, 6);
  const lp = ledgeGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i), y = lp.getY(i), z = lp.getZ(i);
    if (y > 0) lp.setY(i, y + noise3(x * 0.6, z * 0.6, 0) * 0.35 - 0.2);
    if (Math.abs(x) > 9 || Math.abs(z) > 4) lp.setXYZ(i, x + noise3(y, z, x) * 0.6, lp.getY(i), z + noise3(x, y, z) * 0.5);
  }
  ledgeGeo.computeVertexNormals();
  const ledge = new THREE.Mesh(ledgeGeo, new THREE.MeshStandardMaterial({ color: 0x0c1219, roughness: 1, flatShading: true }));
  ledge.position.y = -1.5;
  group.add(ledge);

  // The piano.
  const piano = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0d1116, roughness: 0.55, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 2.8), bodyMat);
  body.position.set(0, 1.1, -0.7);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 2.8), bodyMat);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 2.2, -2.1);
  lid.position.set(0, 0, 1.4);
  lidPivot.add(lid);
  lidPivot.rotation.x = -1.0;
  const keybed = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.3, 1.8), bodyMat);
  keybed.position.set(0, 0.0, 0.8);
  for (const sx of [-3.6, 3.6]) {
    for (const sz of [-1.6, 0.9]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.5, 6), bodyMat);
      leg.position.set(sx, -0.6, sz);
      piano.add(leg);
    }
  }
  piano.add(body, lidPivot, keybed);

  const keys = [];
  const keyByKeyboard = new Map();
  const whiteX = (i) => (i - 7) * 0.5;
  WHITE.forEach((semi, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xdfe9f0, emissive: 0x2a6e7c, emissiveIntensity: 0.35, roughness: 0.4 });
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 1.5), mat);
    k.position.set(whiteX(i), 0.26, 0.95);
    k.userData = { semi, baseY: 0.26, press: 0, baseEm: new THREE.Color(0x2a6e7c), baseInt: 0.35 };
    piano.add(k);
    keys.push(k);
    if (WHITE_KEYS[i]) keyByKeyboard.set(WHITE_KEYS[i], k);
  });
  BLACK.forEach((semi, i) => {
    const w = WHITE.findIndex((ws, idx) => ws < semi && WHITE[idx + 1] > semi);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b0f14, emissive: 0x1b3a5a, emissiveIntensity: 0.5, roughness: 0.35 });
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.95), mat);
    k.position.set(whiteX(w) + 0.25, 0.36, 0.68);
    k.userData = { semi, baseY: 0.36, press: 0, baseEm: new THREE.Color(0x1b3a5a), baseInt: 0.5 };
    piano.add(k);
    keys.push(k);
    if (BLACK_KEYS[i]) keyByKeyboard.set(BLACK_KEYS[i], k);
  });
  piano.position.y = 0.5;
  piano.rotation.y = -0.12;
  piano.scale.setScalar(1.3);
  group.add(piano);

  const keyLight = new THREE.PointLight(0x5ff0ff, 5, 14, 1.5);
  keyLight.position.set(0, 3.5, 3);
  group.add(keyLight);

  // Little anemones on the ledge for company.
  for (let i = 0; i < 14; i++) {
    const col = new THREE.Color().setHSL(rand(0, 1), 0.9, 0.6);
    const a = new THREE.Mesh(
      new THREE.SphereGeometry(rand(0.12, 0.3), 8, 6),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2 })
    );
    a.position.set(rand(-9, 9), -0.3 + rand(0, 0.2), rand(-4, 4));
    if (Math.abs(a.position.x) < 4.5 && a.position.z > -2.5 && a.position.z < 2) a.position.x += 6;
    group.add(a);
  }

  const recent = [];
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1.2, 0);

  function play(key) {
    if (!key) return;
    const u = key.userData;
    u.press = 1;
    audio.piano(freqOf(u.semi));
    state.stats.notes++;
    const col = new THREE.Color().setHSL(((u.semi % 12) / 12 + 0.5) % 1, 0.95, 0.65);
    key.material.emissive.copy(col);
    key.getWorldPosition(tmp);
    fx.bubble(tmp.clone().add(up), col.getHex(), new THREE.Vector3(rand(-0.3, 0.3), rand(1, 1.8), rand(0.2, 0.6)));
    fx.ripple(tmp, col.getHex(), 0.5);

    recent.push(u.semi);
    if (recent.length > LAMB.length) recent.shift();
    if (recent.length === LAMB.length && recent.every((s, i) => s === LAMB[i])) {
      award('Lamb Summoner');
      overlay.toast('somewhere, a very small sheep is listening.');
      for (let i = 0; i < 18; i++) fx.bubble(tmp.clone().add(new THREE.Vector3(rand(-3, 3), rand(0.5, 2), rand(-1, 1))), new THREE.Color().setHSL(rand(0, 1), 0.9, 0.65).getHex());
    }
    if (state.stats.notes === 1) overlay.toast('it still works. somehow.');
    if (state.stats.notes === 30) award('Deep Pianist');
  }

  const api = { name: 'piano', group, depth: ZONE_DEPTH, range: 650, hitTargets: keys, onHit: play, update, active: false, onActive };

  window.addEventListener('keydown', (e) => {
    if (!api.active || state.modalOpen || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = keyByKeyboard.get(e.key.toLowerCase());
    if (k) {
      play(k);
      e.preventDefault();
    }
  });

  overlay.onKey = (i) => play(keys[i]);

  function onActive(on) {
    overlay.keys(on);
    if (on && state.stats.notes === 0 && !state.touch) overlay.toast('a piano. keys A to K, if you dare.');
  }

  function update(dt, t, raycaster) {
    const hit = raycaster.intersectObjects(keys, false);
    if (hit.length) state.hot = true;
    const k = 1 - Math.exp(-dt * 2);
    for (const key of keys) {
      const u = key.userData;
      u.press *= Math.exp(-dt * 7);
      key.position.y = u.baseY - u.press * 0.14;
      key.material.emissiveIntensity = u.baseInt + u.press * 3;
      key.material.emissive.lerp(u.baseEm, k * 0.5);
    }
    keyLight.intensity = 5 + Math.sin(t * 1.7) * 0.8;
  }

  return api;
}
