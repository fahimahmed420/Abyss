import * as THREE from 'three';
import { state, rand, award } from '../state.js';
import { anchorAt } from '../camera.js';

const PALETTE = [0xff5fc8, 0x5ff0ff, 0xb48cff, 0x7dffb0, 0xffb36b];
const ZONE_DEPTH = 400;
const N = 46;
const TENT = 7;
const SEG = 9;

export function createJellies({ scene, fx, audio, overlay, dot }) {
  const group = new THREE.Group();
  group.position.copy(anchorAt(ZONE_DEPTH, 20));
  scene.add(group);

  const bellGeo = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const innerGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const jellies = [];
  const bells = [];
  const tmp = new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    const color = new THREE.Color(PALETTE[i % PALETTE.length]);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.72,
      roughness: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const bell = new THREE.Mesh(bellGeo, mat);
    const inner = new THREE.Mesh(
      innerGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    inner.position.y = 0.1;

    const tPos = new Float32Array(TENT * SEG * 2 * 3);
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
    const tent = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    halo.scale.setScalar(2.2);
    halo.position.y = 0.2;
    const holder = new THREE.Group();
    holder.scale.setScalar(rand(0.5, 1.4));
    holder.add(bell, inner, tent, halo);
    const base = new THREE.Vector3(rand(-22, 22), rand(-16, 16), rand(-14, 10));
    holder.position.copy(base);
    group.add(holder);

    bell.userData.index = i;
    bells.push(bell);
    const tentAngles = [];
    for (let k = 0; k < TENT; k++) tentAngles.push((k / TENT) * Math.PI * 2 + rand(-0.2, 0.2));
    jellies.push({
      holder, bell, inner, halo, mat, tent, tPos, tentAngles,
      tentLen: rand(2.5, 5),
      base,
      off: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      phase: rand(0, 6.28),
      speed: rand(0.6, 1.1),
      hover: 0,
      pets: 0,
      color,
    });
  }

  function layoutTentacles(j, t) {
    const a = j.tPos;
    let p = 0;
    const dy = -j.tentLen / SEG;
    for (let k = 0; k < TENT; k++) {
      const ang = j.tentAngles[k];
      let x = Math.cos(ang) * 0.6, y = 0.05, z = Math.sin(ang) * 0.6;
      for (let s = 0; s < SEG; s++) {
        const sway = Math.sin(t * 1.2 + j.phase + s * 0.55 + k * 0.9) * 0.05 * (s + 1);
        const x2 = x + Math.cos(ang) * 0.03 + sway;
        const z2 = z + Math.sin(ang) * 0.03 + sway * 0.6;
        const y2 = y + dy;
        a[p++] = x; a[p++] = y; a[p++] = z;
        a[p++] = x2; a[p++] = y2; a[p++] = z2;
        x = x2; y = y2; z = z2;
      }
    }
    j.tent.geometry.attributes.position.needsUpdate = true;
  }

  let lastHover = -1;

  function update(dt, t, raycaster) {
    // Hover: flash and dart away.
    const hits = raycaster.intersectObjects(bells, false);
    let hoverIdx = -1;
    if (hits.length) {
      hoverIdx = hits[0].object.userData.index;
      const j = jellies[hoverIdx];
      j.hover = Math.max(j.hover, 1);
      state.hot = true;
      if (hoverIdx !== lastHover) {
        j.vel.set(rand(-3, 3), rand(1, 3), rand(-2, 2));
      }
    }
    lastHover = hoverIdx;

    for (const j of jellies) {
      const pulse = Math.sin(t * j.speed * 2.2 + j.phase);
      j.bell.scale.set(1 + pulse * 0.1, 1 - pulse * 0.14, 1 + pulse * 0.1);
      j.off.addScaledVector(j.vel, dt);
      j.vel.multiplyScalar(Math.exp(-dt * 1.5));
      j.off.multiplyScalar(Math.exp(-dt * 0.15));
      j.holder.position.set(
        j.base.x + Math.sin(t * 0.3 + j.phase) * 1.2 + j.off.x,
        j.base.y + Math.sin(t * 0.5 + j.phase) * 0.8 + Math.cos(t * 0.13 + j.phase) * 2 + j.off.y,
        j.base.z + Math.cos(t * 0.27 + j.phase) * 1.0 + j.off.z
      );
      j.holder.rotation.z = Math.sin(t * 0.4 + j.phase) * 0.15 + j.vel.x * -0.05;
      j.hover *= Math.exp(-dt * 2.5);
      j.mat.emissiveIntensity = 0.7 + j.hover * 2.2 + pulse * 0.15;
      j.inner.material.opacity = 0.3 + j.hover * 0.5;
      j.halo.material.opacity = 0.08 + pulse * 0.03 + j.hover * 0.3;
      layoutTentacles(j, t);
    }
  }

  function onHit(obj) {
    const j = jellies[obj.userData.index];
    if (!j) return;
    j.pets++;
    state.stats.jellies++;
    j.holder.getWorldPosition(tmp);
    audio.chime();
    fx.ripple(tmp, j.color.getHex(), j.holder.scale.x * 1.4);
    fx.burst(tmp, j.color.getHex(), 10, 2.5);
    j.hover = 2.5;
    j.vel.y += 4;
    j.vel.x += rand(-2, 2);
    if (state.stats.jellies === 1) overlay.toast('it liked that.');
    if (state.stats.jellies === 10) award('Jelly Whisperer');
    if (j.pets === 5) overlay.toast('this one is your friend now.');
  }

  return { name: 'jellies', group, depth: ZONE_DEPTH, range: 800, hitTargets: bells, onHit, update, active: false };
}
