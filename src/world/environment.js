import * as THREE from 'three';
import { state, lerp, smoothstep, rand } from '../state.js';

export function makeDotTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRayTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Caustics: overlapping sine ridges, tiled and scrolled over the trench walls.
function makeCausticTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * TAU, v = (y / size) * TAU;
      let s = 0;
      s += Math.pow(0.5 + 0.5 * Math.sin(u * 3 + Math.sin(v * 2) * 1.5), 10);
      s += Math.pow(0.5 + 0.5 * Math.sin(v * 3 + Math.sin(u * 2 + 1.3) * 1.5), 10);
      s += Math.pow(0.5 + 0.5 * Math.sin((u + v) * 2 + Math.sin(u * 3 - v) * 1.2), 12) * 0.8;
      const k = Math.min(255, s * 170);
      const i = (y * size + x) * 4;
      d[i] = k; d[i + 1] = k; d[i + 2] = k; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const COL = {
  surface: new THREE.Color('#2f8fcf'),
  twilight: new THREE.Color('#0b4a66'),
  mid: new THREE.Color('#051a33'),
  deep: new THREE.Color('#02050c'),
};

export function noise3(x, y, z) {
  return (
    Math.sin(x * 0.35 + y * 0.21) * Math.cos(z * 0.29 - y * 0.13) +
    0.5 * Math.sin(x * 0.9 + z * 0.7) * Math.sin(y * 0.5) +
    0.25 * Math.sin(x * 2.1 + y * 1.7 + z * 1.3)
  );
}

export function createEnvironment(scene, camera) {
  const fog = new THREE.FogExp2(COL.surface.getHex(), 0.02);
  scene.fog = fog;
  scene.background = new THREE.Color().copy(COL.surface);

  // Daylight that dies with depth.
  const hemi = new THREE.HemisphereLight(0xa8dcff, 0x041225, 1.4);
  const sun = new THREE.DirectionalLight(0xcfeaff, 1.4);
  sun.position.set(6, 40, 12);
  scene.add(hemi, sun, camera);

  // The diver's torch: a spot cone ahead and below, plus a soft fill.
  const torch = new THREE.SpotLight(0x9fd0ff, 0, 70, 0.55, 0.7, 1.5);
  torch.position.set(0, 0, 0);
  torch.target.position.set(0, -3, -20);
  camera.add(torch, torch.target);
  const fill = new THREE.PointLight(0x8ec5ff, 6, 40, 1.6);
  fill.position.set(0, -0.5, -1.5);
  camera.add(fill);

  // A visible beam for the torch, faint and additive.
  const rayTex = makeRayTexture();
  const beamDir = new THREE.Vector3(0, -3, -20).normalize();
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(9, 34, 32, 1, true),
    new THREE.MeshBasicMaterial({
      map: rayTex,
      color: 0x6fb6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
  );
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir);
  beam.position.copy(beamDir).multiplyScalar(17);
  camera.add(beam);

  // Trench walls: an inside-out cylinder, roughed up with noise.
  const wallGeo = new THREE.CylinderGeometry(44, 50, 480, 72, 96, true);
  const wp = wallGeo.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const x = wp.getX(i), y = wp.getY(i), z = wp.getZ(i);
    const r = Math.hypot(x, z);
    const n = noise3(x * 0.22, y * 0.22, z * 0.22) + 0.4 * noise3(x * 0.7, y * 0.5, z * 0.7);
    const s = (r + n * 7) / r;
    wp.setXYZ(i, x * s, y + noise3(z * 0.1, x * 0.1, y * 0.1) * 2, z * s);
  }
  wallGeo.computeVertexNormals();
  const wall = new THREE.Mesh(
    wallGeo,
    new THREE.MeshStandardMaterial({ color: 0x0e1c2d, roughness: 1, metalness: 0, side: THREE.BackSide, flatShading: true })
  );
  wall.position.y = -220;
  scene.add(wall);

  // Caustic light dancing on the walls near the surface.
  const causticTex = makeCausticTexture();
  causticTex.repeat.set(20, 14);
  const caustic = new THREE.Mesh(
    new THREE.CylinderGeometry(43.5, 48, 140, 48, 1, true),
    new THREE.MeshBasicMaterial({
      map: causticTex,
      color: 0x9fe0ff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })
  );
  caustic.position.y = -50;
  scene.add(caustic);

  // Boulders and ledges along the walls: parallax as you pass them.
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    const s = 1 + noise3(x * 3, y * 3, z * 3) * 0.25;
    rp.setXYZ(i, x * s, y * s, z * s);
  }
  rockGeo.computeVertexNormals();
  const NR = 110;
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x14243a, roughness: 1, flatShading: true }), NR);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < NR; i++) {
    const a = rand(0, Math.PI * 2);
    const y = rand(-440, -70);
    const r = 42 + rand(-1, 4);
    dummy.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    dummy.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
    const s = rand(1.5, 5);
    dummy.scale.set(s * rand(0.8, 1.6), s * rand(0.4, 1), s * rand(0.8, 1.4));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);

  // The surface, seen from below.
  const sky = new THREE.Mesh(
    new THREE.CircleGeometry(90, 48),
    new THREE.MeshBasicMaterial({ color: 0xd8f1ff, fog: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
  );
  sky.rotation.x = Math.PI / 2;
  sky.position.y = 30;
  scene.add(sky);

  // God rays near the surface.
  const rayGeo = new THREE.PlaneGeometry(1.6, 120);
  const rays = [];
  const rayGroup = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(
      rayGeo,
      new THREE.MeshBasicMaterial({
        map: rayTex,
        color: 0xeaf7ff,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      })
    );
    m.position.set(rand(-30, 30), -25, rand(-40, -4));
    m.rotation.z = rand(-0.2, 0.2);
    m.rotation.y = rand(-0.5, 0.5);
    m.scale.x = rand(0.4, 1.5);
    m.userData = { base: m.rotation.z, phase: rand(0, 6.28), op: rand(0.04, 0.11) };
    rayGroup.add(m);
    rays.push(m);
  }
  scene.add(rayGroup);

  // Particle layers: bubbles rising, far snow, near snow, distant specks.
  const dot = makeDotTexture();
  function makeLayer(n, box, size, color, opacity, additive) {
    const pos = new Float32Array(n * 3);
    const spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-box.x, box.x);
      pos[i * 3 + 1] = rand(-box.y, box.y);
      pos[i * 3 + 2] = rand(-box.z, box.z * 0.2);
      spd[i] = rand(0.5, 1.5);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size,
        map: dot,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      })
    );
    scene.add(pts);
    return { pts, geo, pos, spd, n, box };
  }
  const bubbles = makeLayer(500, new THREE.Vector3(30, 45, 45), 0.32, 0xcfefff, 0.55, true);
  const snowFar = makeLayer(1600, new THREE.Vector3(38, 50, 50), 0.1, 0xe6f1ff, 0.35, false);
  const snowNear = makeLayer(260, new THREE.Vector3(10, 12, 14), 0.28, 0xffffff, 0.22, false);
  const specks = makeLayer(700, new THREE.Vector3(60, 60, 70), 0.14, 0x7ff0ff, 0, true);

  function recycle(layer, dy, drift, t) {
    const { pos, spd, n, box } = layer;
    const camY = camera.position.y;
    for (let i = 0; i < n; i++) {
      const k = i * 3;
      pos[k + 1] += dy * spd[i];
      pos[k] += Math.sin(t * 0.5 + i * 0.3) * drift;
      if (pos[k + 1] > camY + box.y) {
        pos[k + 1] = camY - box.y;
        pos[k] = rand(-box.x, box.x);
        pos[k + 2] = rand(-box.z, box.z * 0.2);
      } else if (pos[k + 1] < camY - box.y) {
        pos[k + 1] = camY + box.y;
        pos[k] = rand(-box.x, box.x);
        pos[k + 2] = rand(-box.z, box.z * 0.2);
      }
    }
    layer.geo.attributes.position.needsUpdate = true;
  }

  const col = new THREE.Color();

  function update(dt, t) {
    const d = state.depth;

    if (d < 700) col.lerpColors(COL.surface, COL.twilight, smoothstep(0, 700, d));
    else if (d < 1500) col.lerpColors(COL.twilight, COL.mid, smoothstep(700, 1500, d));
    else col.lerpColors(COL.mid, COL.deep, smoothstep(1500, 3000, d));
    fog.color.copy(col);
    scene.background.copy(col);
    fog.density = lerp(0.016, 0.03, smoothstep(0, 1500, d)) + lerp(0, 0.02, smoothstep(1500, 3200, d));

    hemi.intensity = lerp(1.4, 0.03, smoothstep(0, 2600, d));
    sun.intensity = lerp(1.4, 0, smoothstep(0, 1800, d));
    const torchOn = smoothstep(350, 2200, d);
    torch.intensity = torchOn * 260;
    fill.intensity = lerp(6, 40, torchOn);
    beam.material.opacity = torchOn * 0.07 * (0.9 + Math.sin(t * 1.7) * 0.1);

    sky.material.opacity = 0.95 * (1 - smoothstep(150, 900, d));
    sky.visible = d < 950;
    caustic.material.opacity = 0.07 * (1 - smoothstep(200, 750, d));
    caustic.visible = d < 800;
    causticTex.offset.x += dt * 0.012;
    causticTex.offset.y += dt * 0.006;

    const rayFade = 1 - smoothstep(250, 1000, d);
    rayGroup.visible = d < 1050;
    if (rayGroup.visible) {
      for (const r of rays) {
        r.rotation.z = r.userData.base + Math.sin(t * 0.25 + r.userData.phase) * 0.04;
        r.material.opacity = r.userData.op * rayFade * (0.75 + 0.25 * Math.sin(t * 0.7 + r.userData.phase));
      }
    }

    recycle(bubbles, dt * 1.6, dt * 0.3, t);
    recycle(snowFar, -dt * 0.4, dt * 0.12, t);
    recycle(snowNear, -dt * 0.25, dt * 0.2, t);
    recycle(specks, -dt * 0.05, dt * 0.05, t);
    bubbles.pts.material.opacity = lerp(0.55, 0.22, smoothstep(0, 2500, d));
    snowFar.pts.material.opacity = lerp(0.3, 0.6, smoothstep(500, 2500, d));
    specks.pts.material.opacity = smoothstep(1700, 2600, d) * (0.5 + 0.2 * Math.sin(t * 0.9));
    specks.pts.visible = d > 1700;
  }

  return { update, dot };
}
