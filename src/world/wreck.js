import * as THREE from 'three';
import { state, rand, award } from '../state.js';
import { anchorAt } from '../camera.js';

const ZONE_DEPTH = 1200;

const LOG = `CAPTAIN'S LOG — M.V. PERSEVERANCE

Day 1. Sea calm. Crew in good spirits. Cook made soup.

Day 4. Something followed us in the night. Large. Patient. The cook says it's a whale. The cook also says the soup is "fine".

Day 9. The thing is not a whale. It has been humming. The crew have started humming back. I have forbidden humming.

Day 12. The divers found a piano on the sea floor. A PIANO. Who leaves a piano down here. We are two thousand metres under. Who.

Day 15. The humming has a melody now. It's catchy. That is the worst part.

Day 17. I have decided to open the porthole and say hello. If you are reading this, it went well and we are all friends now, or

[the log ends here. the last page smells faintly of soup.]`;

export function createWreck({ scene, fx, audio, overlay }) {
  const group = new THREE.Group();
  group.position.copy(anchorAt(ZONE_DEPTH, 24));
  scene.add(group);

  const hullMat = new THREE.MeshStandardMaterial({ color: 0x16212e, roughness: 0.95, metalness: 0.15, flatShading: true });
  const ship = new THREE.Group();

  // Hull: a box with a tapered bow and a rounded keel.
  const hullGeo = new THREE.BoxGeometry(16, 4.5, 5, 10, 2, 2);
  const hp = hullGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i);
    let z = hp.getZ(i);
    if (x > 3) z *= 1 - ((x - 3) / 5) * 0.9;
    if (y < -1) z *= 0.6;
    hp.setZ(i, z);
  }
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, hullMat);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.4, 3.4), hullMat);
  cabin.position.set(-3, 3.4, 0);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 2.6), hullMat);
  bridge.position.set(-3, 5.3, 0);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 3.2, 8), hullMat);
  funnel.position.set(1.2, 4.3, 0);
  funnel.rotation.z = -0.25;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 9, 6), hullMat);
  mast.position.set(5, 5.5, 0);
  mast.rotation.z = 0.35;
  ship.add(hull, cabin, bridge, funnel, mast);
  for (let i = 0; i < 9; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), hullMat);
    post.position.set(-7 + i * 1.6, 2.6, 2.4);
    ship.add(post);
    if (i % 3 !== 2) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), hullMat);
      rail.position.set(-7 + i * 1.6 + 0.8, 3.0, 2.4);
      ship.add(rail);
    }
  }

  // The porthole: the one warm thing down here.
  const port = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  port.position.set(1.5, 0.9, 2.56);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24), new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.6, metalness: 0.6 }));
  rim.position.copy(port.position);
  const hit = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.copy(port.position).add(new THREE.Vector3(0, 0, 0.05));
  const light = new THREE.PointLight(0xff9a3c, 10, 16, 1.6);
  light.position.set(1.5, 0.9, 4);
  ship.add(port, rim, hit, light);

  ship.rotation.set(0.12, 0.55, 0.38);
  ship.position.y = -2;
  group.add(ship);

  // A school of small fish circling the wreck.
  const NF = 70;
  const fishGeo = new THREE.ConeGeometry(0.09, 0.42, 5);
  fishGeo.rotateX(Math.PI / 2);
  const fish = new THREE.InstancedMesh(
    fishGeo,
    new THREE.MeshStandardMaterial({ color: 0x9fb8c8, emissive: 0x1a3a44, emissiveIntensity: 0.8, roughness: 0.5 }),
    NF
  );
  const fishData = [];
  for (let i = 0; i < NF; i++) fishData.push({ a: rand(0, 6.28), r: rand(6, 10), y: rand(1, 5), s: rand(0.35, 0.6), ph: rand(0, 6.28) });
  group.add(fish);
  const dummy = new THREE.Object3D();
  const next = new THREE.Vector3();

  let glow = 0;

  function update(dt, t, raycaster) {
    const hovering = raycaster.intersectObject(hit, false).length > 0;
    if (hovering) state.hot = true;
    glow += ((hovering ? 1 : 0) - glow) * (1 - Math.exp(-dt * 6));
    const flicker = 0.75 + Math.sin(t * 2.3) * 0.15 + Math.sin(t * 7.1) * 0.1;
    light.intensity = (8 + glow * 10) * flicker;
    port.material.color.setHSL(0.09, 1, 0.5 + glow * 0.3 + Math.sin(t * 2) * 0.04);

    for (let i = 0; i < NF; i++) {
      const f = fishData[i];
      const a = t * f.s + f.a;
      const r = f.r + Math.sin(t * 0.7 + f.ph) * 1.5;
      dummy.position.set(Math.cos(a) * r, f.y + Math.sin(t * 1.1 + f.ph) * 1.2, Math.sin(a) * r * 0.7);
      const a2 = a + 0.05;
      next.set(Math.cos(a2) * r, dummy.position.y, Math.sin(a2) * r * 0.7);
      dummy.lookAt(next);
      dummy.updateMatrix();
      fish.setMatrixAt(i, dummy.matrix);
    }
    fish.instanceMatrix.needsUpdate = true;
  }

  function onHit(obj) {
    if (obj !== hit) return;
    audio.click();
    const p = new THREE.Vector3();
    port.getWorldPosition(p);
    fx.ripple(p, 0xffb347, 1.5);
    overlay.openLog(LOG);
    award('Archivist');
  }

  return { name: 'wreck', group, depth: ZONE_DEPTH, range: 700, hitTargets: [hit], onHit, update, active: false };
}
