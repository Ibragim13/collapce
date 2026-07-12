# Progress

Status snapshot for the BEACON / МАЯК implementation. See `docs/ARCHITECTURE.md` for how it's
built; this file tracks *what's done, what's simplified, and what's left*.

## Status by feature

| Area | Status | Notes |
|---|---|---|
| Identity (create/unlock/restore) | ✅ Done | Real WebCrypto: PBKDF2 PIN, 12-word recovery phrase, SHA-256 node ID. Verified via automated tests + browser click-through. |
| Home dashboard | ✅ Done | Mesh/battery/GPS tiles, group list, quick links. |
| Offline map | ✅ Done | Real MapLibre + OSM tiles, GPS, Nominatim search, tap-to-pin (IndexedDB), offline tile cache via service worker. Tile fetches obviously need network the *first* time an area is viewed — that's inherent to any real map, not a gap. |
| SOS beacon | ✅ Done | Real siren (WebAudio), vibration pattern, screen-strobe SOS morse, location QR (qrious), dead-man switch with auto-trigger. |
| Mesh chat — same device | ✅ Done | BroadcastChannel transport, from the original prototype. |
| Mesh chat — cross device | ✅ Done (upgraded this pass) | Real WebRTC DataChannels, serverless QR/text pairing (no signaling server). Flood-relay with hop limit + de-dupe. Manually verified handshake logic can't be exercised in this sandbox (no camera/2nd device) — code was reviewed, unit-testable parts (encrypt/decrypt, relay/de-dupe over BroadcastChannel) are covered by automated tests. |
| Local AI | ✅ Done (upgraded this pass) | Real `@mlc-ai/web-llm` integration: device capability detection (real WebGPU adapter probe), 3-tier model catalog (Llama 3.2 1B/3B, Llama 3.1 8B), real streaming download progress + chat completions. Falls back to knowledge-base search when WebGPU/a model isn't available — verified in this sandbox (no GPU here), which correctly showed "WebGPU unavailable" rather than faking success. |
| Knowledge base — built-in | ✅ Done | Bilingual survival articles + search, unchanged from the original prototype's real content. |
| Knowledge base — offline Wikipedia (Kiwix) | ⚠️ Done, unverified against a real file | New this pass. ZIM parser implemented to spec (from memory, see risk note below), OPFS-backed streaming download, title search, article + image rendering. **Needs one real-world check** — see "Open items." |
| Settings | ✅ Done | SOS toggles, dead-man timer config, data export to QR. |
| Barter / Monitoring | ✅ Done | Ported as-is (barter listings are static demo data in both the original design and here — no backend was ever scoped for real peer-to-peer listings). |
| PWA installability | ✅ Done | Manifest with SVG + 192/512 PNG icons, service worker (Workbox `injectManifest` + custom tile-cache route), install prompt wired to `beforeinstallprompt`. |
| Automated tests | ✅ Added this pass | Vitest: 30 tests across `crypto.js`, `db.js`, `kb.js`, `mesh.js` (BroadcastChannel path). WebRTC pairing and all UI is *not* unit-tested (needs a real browser) — covered instead by the Playwright click-through below. |
| CI | ✅ Added this pass | `.github/workflows/ci.yml` — install, test, build on every push/PR. |
| Deploy configs | ✅ Added this pass | `netlify.toml`, `vercel.json`, `.github/workflows/deploy-gh-pages.yml` (repo root) — see `project/README.md` § Deploying. Not actually deployed anywhere live (that needs your hosting account) — configs are ready to connect-and-go. |
| Icons | ✅ Added this pass | Generated 192×192 / 512×512 PNGs from the existing `icon.svg`; dropped the `maskable` purpose claim from the SVG since the artwork has no safe-zone padding and would get ugly-cropped as a maskable icon — PNGs + SVG are all declared `purpose: any` instead. |
| Docs | ✅ Added this pass | This file + `docs/ARCHITECTURE.md`. |

## Verification history

- **Build**: `npm run build` succeeds cleanly (code-split: ~450KB main bundle, ~1MB MapLibre
  chunk lazy-loaded, ~6MB web-llm chunk lazy-imported at model-load time only); service worker
  precache manifest generated (47 entries, ~7.9MB).
- **Unit tests**: `npm test` — 30/30 passing (see table above for coverage scope).
- **Browser click-through** (Playwright, headless Chromium, this sandbox): boot → create identity
  → recovery phrase → home → map → SOS (activated, timer ran, siren/strobe/vibrate attempted) →
  chat (sent + received own broadcast message) → pair screen (host/join UI reachable) → AI chat
  (knowledge-base fallback answered correctly) → AI model tab (correctly reported no WebGPU in
  this sandboxed browser — not faked) → knowledge base (built-in + Kiwix tabs) → settings. Zero
  console errors except expected network failures for hosts this sandbox blocks (OpenStreetMap
  tiles, Nominatim) — real internet access will make those work normally.
- **Sandbox network constraints** (for context on what could *not* be verified here): outbound
  access from this environment is limited to the npm registry; `tile.openstreetmap.org`,
  `nominatim.openstreetmap.org`, `api.open-meteo.com`, `kiwix.org`/`library.kiwix.org`, and CDNs
  (`unpkg`, `jsdelivr`) all return `403`. None of the app's code depends on sandbox-only access —
  these are exactly the hosts a deployed instance will reach fine from a normal network.

## Open items (in priority order)

1. **Verify the ZIM parser against a real `.zim` file.** Not done this pass (explicitly deferred,
   per your call, rather than guessed at further without a way to check). To verify: download any
   small archive from https://library.kiwix.org/ (a "test" or single-article ZIM is easiest),
   add it via Knowledge → Offline Wikipedia → paste its URL (or serve it locally and point the
   downloader at it), and see if it opens. If it fails, call `ZimArchive.debugInfo()` on the parsed
   archive — every header field plus sanity-check booleans (are offsets within file bounds, is
   `entryCount` plausible, etc.) print immediately, which should make a wrong byte offset obvious
   within a couple of minutes. All offsets live as named constants at the top of `src/kiwix/zim.js`
   for a one-line fix.
2. **Real hosting/CI secrets.** The GitHub Pages workflow needs Pages enabled in repo settings
   (Settings → Pages → Source: GitHub Actions) to actually run; Netlify/Vercel need the repo
   connected in their respective dashboards. None of this can be done from here (no credentials).
3. **Native mesh (Bluetooth/LoRa).** Out of browser scope by definition. If a longer-range mesh
   (Meshtastic/LoRa hardware) is wanted later, the path discussed in the original design chat still
   applies: wrap this PWA in Capacitor for native Bluetooth access.
4. **Kiwix article styling.** Images are rewritten to load correctly; the article's own CSS is not
   currently reattached, so wiki articles render as plain (but fully readable) HTML.
5. **Full-text Kiwix search.** Currently title/prefix search only, not a Xapian full-text index —
   this was an explicit scope decision from the original design conversation, not an oversight.
