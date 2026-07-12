# BEACON / МАЯК

Offline-first survival PWA: on-device crypto identity, real offline maps, mesh chat (WebRTC,
serverless QR pairing), a real local LLM (WebGPU via WebLLM), SOS beacon (siren/strobe/vibrate/
GPS/QR/dead-man switch), an offline knowledge base with optional Kiwix (offline Wikipedia)
downloads, and a barter/monitoring dashboard. Bilingual (RU/EN), night/day themes, battery-first
design. Built from a Claude Design HTML prototype into a real Vite + React app.

## Run it

```
npm install
npm run dev       # dev server
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
```

Install as an app (PWA) once served over HTTPS (or localhost) — most hardware APIs used here
(GPS, camera for QR scanning, WebGPU, Bluetooth-adjacent battery API, device orientation) require
a secure context and will not work over a plain HTTP origin.

## Deploying

Static hosting is all this needs — it's a client-only PWA. Ready-made configs are already in the
repo (at the repo root, since this app lives in the `project/` subdirectory alongside the design
handoff docs) — pick one and connect the repo, no further setup should be needed:

- **Netlify**: `netlify.toml` (repo root) already sets base directory `project`, build command,
  publish directory `dist`, and an SPA fallback redirect. Just "New site from Git" and deploy.
- **Vercel**: `vercel.json` (repo root) sets the build/output for the `project/` subdirectory.
  Import the repo as-is.
- **GitHub Pages**: `.github/workflows/deploy-gh-pages.yml` builds and publishes to Pages on every
  push to `main` (enable Pages → Source: GitHub Actions in repo settings once). It automatically
  builds with the correct `/<repo-name>/` base path for a project page.
- **Cloudflare Pages**: no config file needed — in the dashboard, set build command `npm run
  build`, output directory `dist`, and root directory `project`.
- `.github/workflows/ci.yml` runs `npm test` + `npm run build` on every push/PR — treat a red CI
  run as a hard stop before merging.

No backend is required for the app to function offline. An "online" backend (crypto-identity
backup/sync) was scoped as optional in the original design brief and is not implemented — the
identity today lives only in IndexedDB + the 12-word recovery phrase. If you want real online
sync, Supabase or Firebase (free tier) is a reasonable fit, as noted in the original design chat.

## Architecture

- `src/lib/` — core, dependency-free modules: `db.js` (IndexedDB), `crypto.js` (WebCrypto
  identity: PBKDF2 PIN, 12-word recovery phrase, AES-GCM), `kb.js` (built-in bilingual survival
  knowledge base + search).
- `src/mesh/` — `mesh.js`: unifies same-device chat (`BroadcastChannel`) with real cross-device
  mesh chat over WebRTC data channels, paired **serverlessly** via a one-time QR/text SDP
  offer/answer exchange (works on a LAN/hotspot with zero internet). `scan.js`: camera QR
  scanning helper (jsQR).
- `src/ai/webllm.js` — real local LLM via `@mlc-ai/web-llm` (WebGPU). Device capability detection
  actually requests a WebGPU adapter rather than just checking API presence. The package itself
  (~14MB) is dynamically imported only when a model is actually loaded, so it doesn't bloat the
  initial bundle. Falls back to the built-in knowledge base when WebGPU/a model isn't available.
- `src/kiwix/` — real ZIM (offline Wikipedia) file support: `download.js` streams a `.zim` from
  a URL you provide straight into OPFS (never fully in memory), `zim.js` parses the ZIM format
  (header/mimetypes/pointer lists/clusters, zstd via `fzstd`) and renders articles.
  **Caveat**: the exact ZIM header byte-offsets were implemented from training-data memory of the
  openZIM spec, without an internet connection in the build sandbox to fetch a real `.zim` file
  and cross-check. Logic was validated with a hand-built synthetic fixture (see
  `src/kiwix/__selftest.md`), but real-file compatibility needs one live check: download any small
  ZIM from https://library.kiwix.org/, add it via the Knowledge → Offline Wikipedia tab, and see if
  it opens. If not, `ZimArchive.debugInfo()` dumps every parsed header field plus sanity-check
  booleans to make the byte-offset that's off obvious immediately — every offset lives as a named
  constant at the top of `zim.js` for a one-line fix.
- `src/screens/` — one file per screen, `src/context/AppContext.jsx` — global state (auth,
  identity, settings, chat, SOS, etc.), ported 1:1 from the original prototype's state machine.
- `src/sw.js` — service worker source (Workbox `injectManifest` via `vite-plugin-pwa`):
  precaches the app shell + a hand-written runtime cache for map tiles so visited map areas work
  fully offline after a first online visit.

## Known simplifications vs. a "finished product"

- **Kiwix article rendering** rewrites `<img>` sources to blob URLs but does not rewrite
  stylesheet `<link>` tags, so wiki articles render as unstyled (but fully readable, image-having)
  HTML rather than with original CSS.
- **Kiwix full-text search** is title/prefix search only (no Xapian full-text index) — this was an
  explicit scope call, called out in the original design conversation.
- **Native mesh (Bluetooth/LoRa)** is out of scope for a web app; the WebRTC approach here is the
  most "real" mesh achievable in a browser (works fully offline on a shared LAN/hotspot). Wrapping
  this PWA in Capacitor to get real Bluetooth/LoRa access (e.g. via Meshtastic hardware) remains
  the path to a true long-range mesh, as discussed in the original design chat.
