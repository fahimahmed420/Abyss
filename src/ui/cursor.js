import { state, rand, smoothstep } from '../state.js';

// A glowing orb replaces the cursor, and a wake of little bubbles follows it.
export function createCursor() {
  const orb = document.createElement('div');
  orb.className = 'orb';
  document.body.appendChild(orb);
  if (state.touch) orb.classList.add('hidden');
  else document.body.classList.add('no-cursor');

  const canvas = document.getElementById('trail');
  const g = canvas.getContext('2d');
  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  resize();

  let ox = innerWidth / 2, oy = innerHeight / 2;
  let lx = ox, ly = oy;
  const parts = [];

  document.addEventListener('mouseleave', () => { state.pointerInside = false; });
  document.addEventListener('mouseenter', () => { state.pointerInside = true; });

  function update(dt) {
    const p = state.pointerPx;
    const k = 1 - Math.exp(-dt * 22);
    ox += (p.x - ox) * k;
    oy += (p.y - oy) * k;
    orb.style.transform = `translate(${ox}px, ${oy}px)`;
    orb.classList.toggle('hot', state.hot);
    if (!state.touch) orb.classList.toggle('hidden', !state.pointerInside || state.modalOpen);

    // Spawn wake particles when the pointer moves.
    const moved = Math.hypot(p.x - lx, p.y - ly);
    if (moved > 3 && state.pointerInside && !state.modalOpen) {
      const n = Math.min(4, Math.ceil(moved / 10));
      for (let i = 0; i < n; i++) {
        const f = i / n;
        parts.push({
          x: lx + (p.x - lx) * f + rand(-3, 3),
          y: ly + (p.y - ly) * f + rand(-3, 3),
          vx: rand(-12, 12),
          vy: rand(-30, -8),
          life: 1,
          size: rand(1.5, 4),
          decay: rand(0.9, 1.6),
        });
      }
      lx = p.x;
      ly = p.y;
      if (parts.length > 320) parts.splice(0, parts.length - 320);
    }

    // Colour drifts with depth: cyan near the surface, violet in the mid, amber at the floor.
    const d = state.depth;
    const hue = d < 2200 ? 190 + smoothstep(0, 2200, d) * 90 : 280 + smoothstep(2200, 4000, d) * 110;

    g.clearRect(0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt * q.decay;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const r = q.size * (0.6 + q.life);
      const grd = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 2.2);
      grd.addColorStop(0, `hsla(${hue}, 100%, 80%, ${0.55 * q.life})`);
      grd.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
      g.fillStyle = grd;
      g.beginPath();
      g.arc(q.x, q.y, r * 2.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  return { update, resize };
}
