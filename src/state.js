// One number drives everything: state.depth (metres below the surface).
export const state = {
  depth: 0,
  targetDepth: 0,
  maxDepth: 4000,
  mouse: { x: 0, y: 0 }, // normalised device coords, -1..1
  pointerPx: { x: innerWidth / 2, y: innerHeight / 2 },
  pointerInside: true,
  touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  stats: { jellies: 0, notes: 0, anglerWins: 0, anglerDeaths: 0 },
  badges: [],
  startTime: performance.now(),
  uiHidden: false,
  audioOn: false,
  muted: false,
  resurfacing: false,
  lowQuality: false,
  modalOpen: false,
  hot: false, // pointer is over something interactive this frame
};

export const DEPTH_SCALE = 0.1; // world units per metre
export const depthToY = (d) => -d * DEPTH_SCALE;

export const ZONES = [
  { name: 'Surface', depth: 0, from: -1, to: 200 },
  { name: 'Jelly Garden', depth: 400, from: 200, to: 620 },
  { name: 'Twilight', depth: 800, from: 620, to: 980 },
  { name: 'The Wreck', depth: 1200, from: 980, to: 1600 },
  { name: 'Sunken Piano', depth: 2000, from: 1600, to: 2300 },
  { name: 'Lantern Drift', depth: 2450, from: 2300, to: 2620 },
  { name: 'Anglerfish Lane', depth: 2800, from: 2620, to: 3400 },
  { name: 'The Floor', depth: 4000, from: 3400, to: 99999 },
];

export function zoneAt(depth) {
  return ZONES.find((z) => depth >= z.from && depth < z.to) || ZONES[ZONES.length - 1];
}

export const events = new EventTarget();
export const emit = (name, detail) => events.dispatchEvent(new CustomEvent(name, { detail }));

export function award(badge) {
  if (state.badges.includes(badge)) return;
  state.badges.push(badge);
  emit('badge', badge);
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
