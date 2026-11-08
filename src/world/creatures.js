import * as THREE from 'three';
import { state, rand, smoothstep, award } from '../state.js';
import { anchorAt } from '../camera.js';

// Things that live between the zones: a school near the surface, something
// large in the twilight, and a swarm of lanternfish before the angler.

function makeSchool(count, { radius, height, speed, size, color, emissive }) {
  const geo = new THREE.ConeGeometry(0.09 * size, 0.42 * size, 5);
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.8, roughness: 0.5 }), count);
  const data = [];
  for (let i = 0; i < count; i++) data.push({ a: rand(0, 6.28), r: rand(radius * 0.6, radius), y: rand(-height, height), s: rand(speed * 0.7, speed * 1.3), ph: rand(0, 6.28) });
  const dummy = new THREE.Object3D();
  const next = new THREE.Vector3();
  function update(t) {
    for (let i = 0; i < count; i++) {
      const f = data[i];
      const a = t * f.s + f.a;
      const r = f.r + Math.sin(t * 0.7 + f.ph) * radius * 0.15;
      dummy.position.set(Math.cos(a) * r, f.y + Math.sin(t * 1.1 + f.ph) * height * 0.3, Math.sin(a) * r * 0.7);
      next.set(Math.cos(a + 0.05) * r, dummy.position.y, Math.sin(a + 0.05) * r * 0.7);
      dummy.lookAt(next);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
}

export function createCreatures({ scene, camera, audio, overlay, dot }) {
  const zones = [];

  // 1. Silver school at 250 m, catching the last of the light.
  {
    const group = new THREE.Group();
    group.position.copy(anchorAt(250, 22)).add(new THREE.Vector3(8, 4, 0));
    const school = makeSchool(120, { radius: 9, height: 3, speed: 0.5, size: 1.1, color: 0xcfe3f0, emissive: 0x3a5a6a });
    group.add(school.mesh);
    scene.add(group);
    zones.push({ name: 'school-1', group, depth: 250, range: 600, hitTargets: [], onHit() {}, update: (dt, t) => school.update(t), active: false });
  }

  // 2. Something large, passing in the twilight. Once per visit.
  {
    const group = new THREE.Group();
    const base = anchorAt(800, 40);
    group.position.copy(base);
    const skin = new THREE.MeshStandardMaterial({ color: 0x06111c, roughness: 0.9 });
    const whale = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), skin);
    body.scale.set(7, 2.2, 2.4);
    const headBump = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), skin);
    headBump.position.set(5.2, 0.4, 0);
    const tailStem = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 6, 10), skin);
    tailStem.rotation.z = Math.PI / 2;
    tailStem.position.set(-8.6, 0.2, 0);
    const fluke = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 7), skin);
    fluke.position.set(-12, 0.3, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 1.2), skin);
    fin.position.set(2, -1.4, 2.2);
    fin.rotation.set(0.3, 0.3, -0.4);
    const fin2 = fin.clone();
    fin2.position.z = -2.2;
    fin2.rotation.set(-0.3, -0.3, -0.4);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
    eye.position.set(5.6, 0.6, 2.1);
    whale.add(body, headBump, tailStem, fluke, fin, fin2, eye);
    whale.rotation.y = Math.PI; // swims toward -x
    group.add(whale);
    scene.add(group);

    let passing = false;
    let progress = 0;
    let cooldown = 0;
    const SPAN = 150;
    whale.position.x = SPAN;

    function update(dt, t) {
      const d = state.depth;
      cooldown -= dt;
      if (!passing && cooldown <= 0 && d > 550 && d < 1000 && !state.resurfacing) {
        passing = true;
        progress = 0;
        audio.moan();
        setTimeout(() => overlay.toast('something large is passing. it is not interested in you.', 4000), 2500);
      }
      if (passing) {
        progress += dt / 38;
        whale.position.x = SPAN / 2 - progress * SPAN;
        whale.position.y = Math.sin(progress * 6) * 1.5;
        whale.position.z = Math.sin(progress * 3) * 4;
        whale.rotation.z = Math.sin(progress * 6) * 0.05;
        fluke.rotation.z = Math.sin(t * 1.3) * 0.25;
        tailStem.rotation.y = Math.sin(t * 1.3) * 0.08;
        if (progress >= 1) {
          passing = false;
          cooldown = 70;
          award('Witness');
        }
      }
      whale.visible = passing;
    }
    zones.push({ name: 'whale', group, depth: 800, range: 700, hitTargets: [], onHit() {}, update, active: false });
  }

  // 3. A second school around the wreck's depth, lower and darker.
  {
    const group = new THREE.Group();
    group.position.copy(anchorAt(1550, 20)).add(new THREE.Vector3(-6, 2, -6));
    const school = makeSchool(90, { radius: 7, height: 2.5, speed: 0.35, size: 0.9, color: 0x8fa8b8, emissive: 0x1a3a4a });
    group.add(school.mesh);
    scene.add(group);
    zones.push({ name: 'school-2', group, depth: 1550, range: 600, hitTargets: [], onHit() {}, update: (dt, t) => school.update(t), active: false });
  }

  // 4. Lanternfish: a swarm of photophores that scatters from your cursor.
  {
    const group = new THREE.Group();
    const centre = anchorAt(2450, 18);
    group.position.copy(centre);
    scene.add(group);
    const N = 420;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const home = [];
    const vel = [];
    for (let i = 0; i < N; i++) {
      const h = new THREE.Vector3(rand(-10, 10), rand(-6, 6), rand(-6, 5));
      home.push(h);
      vel.push(new THREE.Vector3());
      pos.set([h.x, h.y, h.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.5, map: dot, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    group.add(pts);
    const swarmLight = new THREE.PointLight(0x6fd8ff, 14, 24, 1.5);
    group.add(swarmLight);

    const p = new THREE.Vector3();
    const closest = new THREE.Vector3();
    const push = new THREE.Vector3();
    const drift = new THREE.Vector3();
    let scattered = 0;
    let announced = false;

    function update(dt, t, raycaster) {
      drift.set(Math.sin(t * 0.21) * 6, Math.sin(t * 0.17) * 3, Math.cos(t * 0.13) * 3);
      const ray = raycaster.ray;
      let hits = 0;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        p.set(pos[k], pos[k + 1], pos[k + 2]).add(group.position);
        ray.closestPointToPoint(p, closest);
        const dist = closest.distanceTo(p);
        const v = vel[i];
        if (dist < 3.2) {
          push.copy(p).sub(closest).normalize().multiplyScalar((3.2 - dist) * 14 * dt);
          v.add(push);
          hits++;
        }
        const h = home[i];
        v.x += (h.x + drift.x + Math.sin(t * 1.3 + i) * 0.6 - pos[k]) * dt * 1.2;
        v.y += (h.y + drift.y + Math.cos(t * 1.1 + i * 0.7) * 0.4 - pos[k + 1]) * dt * 1.2;
        v.z += (h.z + drift.z - pos[k + 2]) * dt * 1.2;
        v.multiplyScalar(Math.exp(-dt * 2.2));
        pos[k] += v.x * dt * 4;
        pos[k + 1] += v.y * dt * 4;
        pos[k + 2] += v.z * dt * 4;
        const blink = 0.7 + 0.3 * Math.sin(t * 3 + i * 1.7);
        const hot = Math.min(1.2, v.length() * 0.8);
        col[k] = 0.45 * blink + hot;
        col[k + 1] = 1.1 * blink + hot * 0.6;
        col[k + 2] = 1.4 * blink;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      swarmLight.position.copy(drift);
      swarmLight.intensity = 5 + Math.sin(t * 2) * 1.5;
      if (hits > 0) {
        state.hot = true;
        scattered += dt;
        if (scattered > 2 && !announced) {
          announced = true;
          overlay.toast('they would rather you didn’t.', 2600);
        }
        if (scattered > 12) award('Shepherd of Lanterns');
      }
      pts.material.opacity = 0.95 * smoothstep(2100, 2350, state.depth) * (1 - smoothstep(2600, 2750, state.depth));
    }
    zones.push({ name: 'lanterns', group, depth: 2450, range: 450, hitTargets: [], onHit() {}, update, active: false });
  }

  return zones;
}
