# Architecture

## Repo layout

```
README.md          — handoff bundle notes from Claude Design (original, unmodified)
chats/              — the design conversation transcript that specified the product (unmodified)
docs/               — this folder: architecture + progress, for the *implementation*
project/            — the actual app: a Vite + React PWA (this is what gets deployed)
```

`project/` used to be a `.dc.html` Claude Design prototype (a custom templating format with a
`support.js` runtime, plus a few real vanilla-JS backend modules). It has been fully replaced with
a production Vite + React app that reuses the prototype's real logic (crypto, IndexedDB, knowledge
base) and rebuilds everything else (screens, mesh, AI, offline Wikipedia) as real, working code.

## Why these technology choices

- **Vite + React, no TypeScript** — matches the plain-JS style of the original hand-written
  backend modules (`beacon-db.js` etc.), no build-step surprises, fast dev server, first-class
  PWA tooling via `vite-plugin-pwa`.
- **No router** — the app has one URL and a `screen` field in state (`home`/`map`/`sos`/`chat`/…).
  A client-side router would add a dependency for zero benefit here: there's nothing to deep-link
  to (an offline survival tool doesn't need shareable URLs into its own screens), and the original
  design has no notion of URLs at all.
- **One global context (`AppContext`), not many** — the original prototype was a single class
  component with one `state` object and ~60 methods. Splitting that into a dozen contexts would
  have meant guessing new boundaries under time pressure and likely getting them wrong. One
  `useState` + a flat `patch()` merge helper (mirroring the original's `this.setState`) preserves
  the exact behavior while still being idiomatic React (hooks, not classes). Screens are plain
  presentational components that call `useApp()` and read/derive what they need — the
  view-derivation logic (formatting labels, filtering lists) intentionally lives in the screen
  files, not the context, unlike the original's monolithic `renderVals()`.

## Module map

```
src/
  lib/                  — pure, dependency-free core logic (no React, no DOM assumptions beyond
                          browser globals). Ported ~1:1 from the original beacon-*.js files.
    db.js               — IndexedDB wrapper (stores: kv, messages, sos, markers, zim_meta)
    crypto.js            — WebCrypto identity: PBKDF2 PIN hashing, 12-word recovery phrase
                          (96-bit entropy, syllable mnemonic — NOT BIP39), AES-GCM channel crypto
    kb.js                 — built-in bilingual survival knowledge base + naive substring search

  mesh/                 — real device-to-device chat, framework-agnostic (EventTarget-based)
    mesh.js              — same-device transport (BroadcastChannel) + cross-device transport
                          (WebRTC DataChannels), unified: broadcast() sends to both, receiving
                          from either flood-relays to the other (hop-limited, de-duped by id).
                          Pairing is serverless: one device creates an SDP offer, waits for full
                          ICE gathering (non-trickle), and encodes it as a single QR/text blob;
                          the other device scans it, replies with its own answer QR/text. No
                          signaling server, works fully offline on a shared LAN/hotspot.
    scan.js               — camera QR-scanning helper (jsQR), used by the Pair screen

  ai/webllm.js          — real local LLM via @mlc-ai/web-llm (WebGPU). Device capability detection
                          actually requests a WebGPU adapter (not just checks for API presence).
                          The ~14MB @mlc-ai/web-llm package is *dynamically* imported only when a
                          model is actually loaded, so it costs nothing in the initial bundle for
                          users who never open the AI tab. Falls back to `lib/kb.js` search when
                          WebGPU/a model isn't available (see `AppContext.sendAi`).

  kiwix/                — offline Wikipedia (ZIM file format) support
    download.js           — streams a .zim from a URL straight into OPFS (Origin Private File
                          System) chunk-by-chunk, so multi-GB archives never sit fully in memory;
                          tracks metadata in the `zim_meta` IndexedDB store
    zim.js                — parses the ZIM binary format (header, mimetype list, URL/title pointer
                          lists, clusters — zstd-decompressed via `fzstd`) and resolves articles +
                          their embedded resources (images) for rendering. See "Known risk: ZIM
                          byte offsets" below.

  context/AppContext.jsx — global state + actions, one `useState` + flat `patch()` merges, effects
                          for boot/timers/hardware event listeners (battery, orientation, online).
  i18n.js                — `dict(ru: boolean) -> T` — flat key/value bilingual string tables
  ui.js                   — shared inline-style snippets (buttons, inputs, cards) to avoid
                          repeating the same style object across every screen
  components/            — TopBar, TabBar, Icons (hand-drawn SVG line icons, no icon font/library)
  screens/                — one file per screen; Auth.jsx holds all 6 pre-login screens since they
                          share so much layout it wasn't worth 6 separate files
  App.jsx                 — root: theme/safe-area wrapper, auth-state switch, screen router
                          (MapScreen is React.lazy-loaded — see below)
  sw.js                   — service worker *source* (see "Service worker" below)
```

## Data flow (mesh chat, as the most involved example)

1. `AppContext` constructs one `Mesh` instance on boot and subscribes to its `message`/`peers`
   events, mirroring them into React state (`msgs`, `peers`).
2. `Chat.jsx` renders `state.msgs` and calls `sendMsg()` → `mesh.broadcast(text)`.
3. Inside `Mesh`: the text is AES-GCM encrypted with a key derived (PBKDF2) from the current
   "channel code" (a shared secret string, default `"OPEN"`), wrapped in an envelope
   `{id, from, name, payload, ts, hops}`, and sent to *both* the local `BroadcastChannel` (same
   device, other tabs) and every open `RTCDataChannel` (paired devices).
4. Any receiver that gets an envelope it hasn't seen (`seenIds` de-dupe set) decrypts it (silently
   drops on decrypt failure — wrong channel code), emits `message`, and *relays* it onward to the
   transport it didn't come from (bc → peers, peer → bc + other peers), incrementing `hops`, up to
   a hop limit — this is what makes it an actual mesh rather than a single hop.
5. `Pair.jsx` drives the one-time WebRTC handshake directly against the `Mesh` instance's
   `createInvite`/`acceptInvite`/`completeInvite` methods (QR rendered via `qrious`, scanned via
   `mesh/scan.js`).

## Service worker

Built via `vite-plugin-pwa`'s `injectManifest` strategy (not `generateSW`) because the app needs
custom `fetch` handling — a hand-written runtime cache for OpenStreetMap map tiles (cache-first,
fill on demand, so any area a user has actually viewed is available fully offline afterward) —
alongside the standard Workbox-generated app-shell precache. The source lives at `src/sw.js` and
imports `workbox-precaching` directly; `vite-plugin-pwa` injects the real precache manifest at
build time.

## Code-splitting

Two dependencies are large enough to matter: `maplibre-gl` (~1MB minified) and `@mlc-ai/web-llm`
(~6MB minified, mostly its bundled 163-model catalog metadata). Both are deferred:
- `MapScreen` is `React.lazy()`-loaded from `App.jsx`, so `maplibre-gl` only downloads once a user
  opens the Map tab.
- `@mlc-ai/web-llm` is dynamically `import()`-ed inside `ai/webllm.js` only when a model is
  actually loaded (`LocalAI.loadModel()`); the model *catalog* shown in the UI is a small hardcoded
  array so switching to the AI tab's Model view doesn't need the package at all.

This keeps the initial bundle small while still allowing the service worker to precache everything
(`maximumFileSizeToCacheInBytes` raised from Workbox's 2MB default) for full offline installs.

## Known risk: ZIM byte offsets

`kiwix/zim.js`'s header/pointer-list/cluster layout constants were implemented from training-data
memory of the openZIM spec — the sandbox this was built in has no network access to
`kiwix.org`/`library.kiwix.org` to fetch a real `.zim` file and cross-check byte-for-byte. The
parsing *logic* (varint math, blob slicing, redirect resolution, zstd decompression via `fzstd`)
was validated against a hand-built synthetic ZIM-like fixture and passed; what's unverified is
whether the specific byte offsets match a real-world file. Every offset is a named constant at the
top of `zim.js`, and `ZimArchive.debugInfo()` dumps every parsed header field plus plausibility
checks, specifically so a wrong offset is fast to spot and fix against a real file. See
`docs/PROGRESS.md` for the exact verification steps.

## Security model

- Identity: a random 96-bit seed (12-word syllable mnemonic, **not** BIP39 — noted as a
  simplification, not a production-grade standard) derives a SHA-256 node ID; the user's PIN never
  leaves the device and is stretched with PBKDF2 (120k iterations) before being compared/stored.
- Mesh chat: AES-GCM, key derived (PBKDF2, 60k iterations) from a shared "channel code" string —
  this is a shared-secret scheme (like a group password), not a full asymmetric E2E protocol (no
  per-peer key exchange/forward secrecy). Adequate for "keep casual local eavesdroppers out of a
  survival-group chat," not adequate for adversarial/high-stakes secrecy.
- Everything is stored locally (IndexedDB/OPFS) — there is no server component and no telemetry.
