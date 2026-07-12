import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // maplibre-gl / web-llm chunks are large and lazy-loaded on demand;
        // they're still worth precaching for full offline install, just above
        // the (2 MiB) default limit.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024
      },
      manifest: false, // we ship a hand-written manifest.webmanifest in public/
      injectRegister: false, // we register the SW ourselves in main.jsx
      devOptions: { enabled: false }
    })
  ],
  // Netlify/Vercel serve from the domain root (default '/'). GitHub Pages project
  // sites are served from a /<repo-name>/ subpath — the gh-pages workflow sets
  // VITE_BASE_PATH accordingly before running the build.
  base: process.env.VITE_BASE_PATH || '/',
  server: { port: 5173 },
  worker: { format: 'es' }
});
