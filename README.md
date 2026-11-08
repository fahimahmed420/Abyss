# ABYSS

A website with no purpose. You scroll, and you sink.

It starts in sunlit water and ends four kilometres down, where the only light
is whatever is glowing at you. Along the way: a garden of jellyfish you can pet,
something very large passing in the twilight, a wreck with a captain's log, a
piano that still works, a swarm of lanternfish that scatters from your cursor,
an anglerfish that wants you, and a message carved into the sea floor.

Your torch comes on as the daylight fails. Caustics play on the trench walls
near the surface, rocks slide past as you sink, and the picture itself goes
grainier and tighter the deeper you get.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints. `npm run build` makes a static `dist/` folder
you can host anywhere.

## Controls

| Input | Does |
|---|---|
| Scroll / drag up / arrow keys | Dive and rise |
| Mouse | Look around, hover things |
| Click / tap | Pet a jelly, open the porthole, press a piano key |
| A S D F G H J K L ; ' and W E T Y U O P [ ] | Play the piano (when you're at it) |
| X | Hide the UI |
| M | Mute |
| Esc | Close the log |

## Made from

Three.js for the world, GSAP for the resurface, the Web Audio API for every
sound (no audio files, it is all synthesised), Vite to serve it. No 3D models:
everything is primitives, noise, emissive materials and bloom.
