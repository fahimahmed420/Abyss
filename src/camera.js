import * as THREE from 'three';
import { state, depthToY } from './state.js';

// The descent path: a straight drop with a gentle sway, so every zone can be
// placed relative to where the camera will be when it passes.
export const wobbleX = (d) => Math.sin(d * 0.0021) * 3 + Math.sin(d * 0.0007) * 2;
export const wobbleZ = (d) => Math.cos(d * 0.0016) * 2.5;

// Where the camera is looking when the depth meter reads `depth`: `forward`
// units ahead, and lower by the camera's downward pitch.
export function anchorAt(depth, forward = 18) {
  return new THREE.Vector3(wobbleX(depth), depthToY(depth) - forward * 0.45, wobbleZ(depth) - forward);
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 220);
  cam.rotation.order = 'YXZ';
  cam.rotation.x = -0.45;
  cam.position.set(wobbleX(0), 0, wobbleZ(0));
  return cam;
}

const BASE_PITCH = -0.42;
let shake = 0;
export function kickCamera(amount = 1) {
  shake = Math.max(shake, amount);
}

export function updateCamera(cam, dt, t) {
  const d = state.depth;
  const velocity = state.targetDepth - d; // how hard we are being pulled
  cam.position.set(wobbleX(d), depthToY(d) + Math.sin(t * 0.6) * 0.12, wobbleZ(d) + Math.sin(t * 0.37) * 0.1);

  const pitch = BASE_PITCH + state.mouse.y * 0.22 - Math.max(-0.25, Math.min(0.25, velocity * 0.0006));
  const yaw = -state.mouse.x * 0.3;
  const roll = -state.mouse.x * 0.05 + Math.sin(t * 0.4) * 0.01;
  const k = 1 - Math.exp(-dt * 6);
  cam.rotation.x += (pitch - cam.rotation.x) * k;
  cam.rotation.y += (yaw - cam.rotation.y) * k;
  cam.rotation.z += (roll - cam.rotation.z) * k;

  if (shake > 0.001) {
    cam.position.x += (Math.random() - 0.5) * shake * 0.6;
    cam.position.y += (Math.random() - 0.5) * shake * 0.6;
    shake *= Math.exp(-dt * 6);
  }
  cam.fov = 62 + Math.min(14, Math.abs(velocity) * 0.012);
  cam.updateProjectionMatrix();
}
