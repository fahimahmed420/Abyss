import * as THREE from 'three';
import { rand } from '../state.js';

// Short-lived glowing things: ripples, bubbles, sparks. Shared geometry, pooled list.
export function createEffects(scene, camera) {
  const items = [];
  const ringGeo = new THREE.RingGeometry(0.75, 0.9, 48);
  const bubGeo = new THREE.SphereGeometry(0.14, 12, 10);
  const sparkGeo = new THREE.SphereGeometry(0.06, 6, 5);

  function ripple(pos, color = 0xffffff, size = 1) {
    const m = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    m.position.copy(pos);
    m.scale.setScalar(size * 0.3);
    scene.add(m);
    items.push({ m, type: 'ring', t: 0, life: 0.9, size });
  }

  function bubble(pos, color = 0x9fe8ff, vel = null) {
    const m = new THREE.Mesh(bubGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    m.position.copy(pos);
    m.scale.setScalar(rand(0.6, 1.4));
    scene.add(m);
    items.push({
      m,
      type: 'bubble',
      t: 0,
      life: rand(2.2, 3.6),
      vel: vel ? vel.clone() : new THREE.Vector3(rand(-0.4, 0.4), rand(0.6, 1.4), rand(-0.4, 0.4)),
      ph: rand(0, 6.28),
    });
  }

  function burst(pos, color = 0xffffff, n = 14, speed = 3) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      m.position.copy(pos);
      scene.add(m);
      const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
      items.push({ m, type: 'spark', t: 0, life: rand(0.5, 1.1), vel: dir });
    }
  }

  function update(dt, t) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        scene.remove(it.m);
        it.m.material.dispose();
        items.splice(i, 1);
        continue;
      }
      const m = it.m;
      if (it.type === 'ring') {
        m.scale.setScalar(it.size * (0.3 + k * 6));
        m.material.opacity = 0.9 * Math.pow(1 - k, 1.5);
        m.quaternion.copy(camera.quaternion);
      } else if (it.type === 'bubble') {
        it.vel.y += 0.9 * dt;
        m.position.addScaledVector(it.vel, dt);
        m.position.x += Math.sin(t * 3 + it.ph) * dt * 0.3;
        m.material.opacity = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
      } else {
        it.vel.multiplyScalar(Math.exp(-dt * 2.5));
        m.position.addScaledVector(it.vel, dt);
        m.material.opacity = 1 - k;
        m.scale.setScalar(1 - k * 0.6);
      }
    }
  }

  return { ripple, bubble, burst, update };
}
