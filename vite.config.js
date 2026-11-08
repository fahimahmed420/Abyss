import { defineConfig } from 'vite';

// Served from https://<user>.github.io/Abyss/ on GitHub Pages, so assets need
// the repo name as their base. Local dev and `vite preview` still work.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Abyss/' : '/',
  build: { chunkSizeWarningLimit: 900 },
});
