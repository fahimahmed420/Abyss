import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { state, emit } from './state.js';

// Final grade: chromatic fringing at the edges, a vignette that tightens with
// depth, and a little grain so the dark isn't flat.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    depth: { value: 0 },
    pulse: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float depth;
    uniform float pulse;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r = dot(c, c);
      float ab = (0.004 + depth * 0.006 + pulse * 0.02) * r * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ab).b;
      float vig = smoothstep(0.85, 0.15, r * (1.0 + depth * 0.9));
      col *= mix(0.45, 1.0, vig);
      float g = hash(uv * vec2(1920.0, 1080.0) + fract(time * 7.0) * vec2(17.0, 31.0)) - 0.5;
      col += g * (0.035 + depth * 0.05);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.95, 0.65, 0.3);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // Frame-rate watchdog: if most frames in a 4 s window are slow, drop bloom.
  let slow = 0;
  let total = 0;
  let warmup = 2;
  let pulse = 0;

  function render(dt, t) {
    if (!state.lowQuality) {
      if (warmup > 0) warmup -= dt;
      else {
        total += dt;
        if (dt > 0.038) slow += dt;
        if (total > 4) {
          if (slow / total > 0.55) {
            state.lowQuality = true;
            emit('quality');
          }
          slow = 0;
          total = 0;
        }
      }
    }
    pulse *= Math.exp(-dt * 4);
    grade.uniforms.time.value = t;
    grade.uniforms.depth.value = state.depth / state.maxDepth;
    grade.uniforms.pulse.value = pulse;
    if (state.lowQuality) renderer.render(scene, camera);
    else composer.render();
  }

  function resize(w, h) {
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  }

  function setQuality(high) {
    state.lowQuality = !high;
    warmup = 3;
    slow = total = 0;
    emit('quality');
  }

  function kick(amount = 1) {
    pulse = Math.max(pulse, amount);
  }

  return { render, resize, bloom, setQuality, kick };
}
