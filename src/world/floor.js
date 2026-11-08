import * as THREE from 'three';
import { state, rand, award, depthToY } from '../state.js';
import { wobbleX, wobbleZ } from '../camera.js';
import { noise3 } from './environment.js';

const ZONE_DEPTH = 4000;

function makeTabletTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 600;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 600);
  g.textAlign = 'center';
  g.fillStyle = '#bff3ff';
  g.shadowColor = '#5ff0ff';
  g.shadowBlur = 28;
  g.font = '300 84px "Cormorant Garamond", Georgia, serif';
  g.fillText('YOU REACHED THE BOTTOM', 512, 170, 900);
  g.font = 'italic 300 62px "Cormorant Garamond", Georgia, serif';
  g.fillText('there is nothing down here', 512, 300, 900);
  g.fillText('except you.', 512, 380, 900);
  g.font = '300 30px "JetBrains Mono", monospace';
  g.fillStyle = '#ff5fc8';
  g.shadowColor = '#ff5fc8';
  g.fillText('N O W   G O   O U T S I D E', 512, 500, 900);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFloor({ scene, overlay, dot }) {
  const group = new THREE.Group();
  group.position.set(wobbleX(ZONE_DEPTH), depthToY(ZONE_DEPTH) - 6, wobbleZ(ZONE_DEPTH));
  scene.add(group);

  // Ground.
  const groundGeo = new THREE.CircleGeometry(75, 90);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const flat = Math.hypot(x, z + 16) < 10 ? 0.15 : 1;
    gp.setY(i, noise3(x * 0.5, 0, z * 0.5) * 1.3 * flat + noise3(x * 2, 3, z * 2) * 0.2);
  }
  groundGeo.computeVertexNormals();
  group.add(new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 1, flatShading: true })));

  // Hydrothermal vents.
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 1, flatShading: true });
  const ventPos = [
    [-9, -14], [7, -21], [-4, -26], [12, -11], [-14, -23], [5, -8],
  ];
  const vents = [];
  for (const [x, z] of ventPos) {
    const h = rand(3, 5);
    const v = new THREE.Mesh(new THREE.ConeGeometry(rand(1.2, 1.8), h, 7, 1, true), ventMat);
    v.position.set(x, h / 2, z);
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.14, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xff6a2a, emissive: 0xff5a1a, emissiveIntensity: 2 })
    );
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(x, h - 0.1, z);
    const light = new THREE.PointLight(0xff6a2a, 5, 12, 1.6);
    light.position.set(x, h + 0.5, z);
    group.add(v, mouth, light);
    vents.push({ x, z, top: h, light, ph: rand(0, 6.28) });
    // Tube worms huddle around the warmth.
    for (let i = 0; i < 5; i++) {
      const len = rand(0.8, 2);
      const a = rand(0, 6.28), r = rand(1.8, 3.2);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, len, 5), new THREE.MeshStandardMaterial({ color: 0xdde6ea, roughness: 0.8 }));
      tube.position.set(x + Math.cos(a) * r, len / 2, z + Math.sin(a) * r);
      tube.rotation.z = rand(-0.2, 0.2);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 7, 6), new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2222, emissiveIntensity: 1.2 }));
      tip.position.set(tube.position.x, len, tube.position.z);
      group.add(tube, tip);
    }
  }

  // Smoke from the vents: one particle system, each particle tied to a vent.
  const NP = 120 * vents.length;
  const sp = new Float32Array(NP * 3);
  const sv = new Float32Array(NP);
  const sVent = new Uint8Array(NP);
  for (let i = 0; i < NP; i++) {
    const vi = i % vents.length;
    sVent[i] = vi;
    const v = vents[vi];
    sp[i * 3] = v.x + rand(-0.4, 0.4);
    sp[i * 3 + 1] = v.top + rand(0, 10);
    sp[i * 3 + 2] = v.z + rand(-0.4, 0.4);
    sv[i] = rand(1.2, 2.8);
  }
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const smoke = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({ size: 0.55, map: dot, color: 0xff9a5a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  group.add(smoke);

  // The tablet.
  const tablet = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a2330, roughness: 0.9 }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.95), new THREE.MeshBasicMaterial({ map: makeTabletTexture(), transparent: true }));
  face.position.z = 0.26;
  tablet.add(slab, face);
  tablet.position.set(0, 1.9, -16);
  tablet.rotation.set(0.05, 0.06, 0.02);
  group.add(tablet);
  const tabletLight = new THREE.PointLight(0x5ff0ff, 4, 14, 1.5);
  tabletLight.position.set(0, 2.5, -13.5);
  group.add(tabletLight);

  // Eyes in the dark. They blink.
  const NE = 32;
  const ep = new Float32Array(NE * 2 * 3);
  const ec = new Float32Array(NE * 2 * 3);
  const eyes = [];
  for (let i = 0; i < NE; i++) {
    const x = rand(-40, 40), y = rand(0.5, 9), z = rand(-55, -4);
    if (Math.hypot(x, z + 16) < 12) continue;
    const gap = rand(0.25, 0.5);
    ep.set([x - gap, y, z, x + gap, y, z], i * 6);
    eyes.push({ i, ph: rand(0, 50), period: rand(2, 7) });
  }
  const eyeGeo = new THREE.BufferGeometry();
  eyeGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  eyeGeo.setAttribute('color', new THREE.BufferAttribute(ec, 3));
  const eyePts = new THREE.Points(
    eyeGeo,
    new THREE.PointsMaterial({ size: 0.22, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  group.add(eyePts);

  let shown = false;
  let awarded = false;

  function update(dt, t) {
    for (const v of vents) v.light.intensity = 4 + Math.sin(t * 3 + v.ph) * 1.2 + Math.sin(t * 11 + v.ph) * 0.6;
    const a = smokeGeo.attributes.position.array;
    for (let i = 0; i < NP; i++) {
      const k = i * 3;
      a[k + 1] += sv[i] * dt;
      a[k] += Math.sin(t * 0.8 + i) * dt * 0.5;
      a[k + 2] += Math.cos(t * 0.6 + i) * dt * 0.3;
      const v = vents[sVent[i]];
      if (a[k + 1] > v.top + 11) {
        a[k] = v.x + rand(-0.4, 0.4);
        a[k + 1] = v.top;
        a[k + 2] = v.z + rand(-0.4, 0.4);
      }
    }
    smokeGeo.attributes.position.needsUpdate = true;

    for (const e of eyes) {
      const open = (t + e.ph) % e.period > 0.25 ? 1 : 0;
      const g = 0.9 * open;
      ec.set([g, g * 0.9, g * 0.5, g, g * 0.9, g * 0.5], e.i * 6);
    }
    eyeGeo.attributes.color.needsUpdate = true;
    tabletLight.intensity = 4 + Math.sin(t * 1.3) * 0.8;

    const d = state.depth;
    const wantShown = d > 3750 && !state.resurfacing;
    if (wantShown !== shown) {
      shown = wantShown;
      overlay.stats(shown);
    }
    if (!awarded && d > 3900) {
      awarded = true;
      award('Bottom Feeder');
    }
  }

  function onActive(on) {
    if (!on && shown) {
      shown = false;
      overlay.stats(false);
    }
  }

  return { name: 'floor', group, depth: ZONE_DEPTH, range: 900, hitTargets: [], onHit() {}, update, onActive, active: false };
}
