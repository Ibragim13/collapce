// src/ai/webllm.js
//
// Real, offline, in-browser LLM integration on top of @mlc-ai/web-llm (WebLLM / MLC),
// running entirely on-device via WebGPU. No network calls once a model is cached.
//
// This file replaces the old fake "AI tab" (which faked device detection, faked a
// download progress bar, and actually answered from a hand-written knowledge base).
// Everything here really talks to the WebLLM engine: real device capability probing,
// a real catalog of downloadable models pulled from the installed package's
// `prebuiltAppConfig.model_list`, real download progress via `initProgressCallback`,
// and real token-by-token streaming chat completions.

// @mlc-ai/web-llm is a genuinely huge package (bundled WASM/tokenizer glue,
// ~14MB in node_modules) that most sessions will never touch (users who don't
// visit the AI tab, or don't choose to download a model, shouldn't pay for it
// in their initial bundle / PWA precache). It's dynamically imported on first
// use inside `loadWebLlm()` below instead of statically imported here.
let _webllmPromise = null;
function loadWebLlm() {
  if (!_webllmPromise) _webllmPromise = import("@mlc-ai/web-llm");
  return _webllmPromise;
}

/**
 * Attempt to obtain a real WebGPU adapter. We deliberately call
 * `navigator.gpu.requestAdapter()` rather than just checking `!!navigator.gpu`,
 * because the API surface can exist (e.g. behind a flag, or in a browser that
 * ships the API but has no compatible GPU/driver) while adapter acquisition
 * still fails or resolves to null.
 */
export async function isWebGPUSupported() {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

/**
 * Detects device capability signals available to the browser and turns them
 * into a recommended model tier. `ram`/`cores` are best-effort: Safari and
 * Firefox do not implement `navigator.deviceMemory`, so `ram` may be `null`.
 */
export async function detectDeviceCapability() {
  const ram =
    typeof navigator !== "undefined" && typeof navigator.deviceMemory === "number"
      ? navigator.deviceMemory
      : null;
  const cores =
    typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : null;
  const webgpu = await isWebGPUSupported();

  const recommendedTier = computeRecommendedTier({ ram, cores, webgpu });

  return { ram, cores, webgpu, recommendedTier };
}

/**
 * Conservative tiering: we only ever recommend 'full' when we have concrete
 * evidence (deviceMemory >= 8GB, and if core count is known it isn't
 * suspiciously low). If WebGPU isn't available at all we still return a tier
 * string (never null) per the public contract; callers should gate actually
 * loading a model on the separate `webgpu` boolean.
 */
function computeRecommendedTier({ ram, cores, webgpu }) {
  if (!webgpu) return "nano";

  if (ram != null) {
    if (ram >= 8 && (cores == null || cores >= 4)) return "full";
    if (ram >= 4) return "base";
    return "nano";
  }

  // deviceMemory unavailable (Safari/Firefox): fall back to core count as a
  // weak signal, but never recommend 'full' without a real RAM reading.
  if (cores != null && cores >= 8) return "base";
  return "nano";
}

/**
 * Three-tier model catalog. Model ids are real, existing @mlc-ai/web-llm
 * prebuiltAppConfig.model_list entries (confirmed against the installed
 * @mlc-ai/web-llm@0.2.84, 163-entry catalog, at integration time) — not
 * invented — chosen from the same model family (Meta Llama 3.x) so tone/
 * behavior stays consistent as a user steps up tiers:
 *
 *   nano -> Llama-3.2-1B-Instruct-q4f16_1-MLC  (~0.9GB, vram_required_MB 879,  low_resource_required)
 *   base -> Llama-3.2-3B-Instruct-q4f16_1-MLC  (~2.2GB, vram_required_MB 2264, low_resource_required)
 *   full -> Llama-3.1-8B-Instruct-q4f16_1-MLC  (~4.9GB, vram_required_MB 5001)
 *
 * approxSizeGB is hardcoded here (rather than derived live from
 * prebuiltAppConfig) precisely so this catalog can be displayed in the UI
 * without pulling in the ~14MB @mlc-ai/web-llm package — that package is only
 * dynamically imported once the user actually loads a model (see
 * `LocalAI.loadModel`, which re-validates the modelId against the live
 * catalog and throws if a future package version drops it).
 */
export const MODEL_CATALOG = [
  { tier: "nano", modelId: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "NANO — Llama 3.2 1B", approxSizeGB: 0.9, minRamGB: 2, requiresWebgpu: true },
  { tier: "base", modelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "BASE — Llama 3.2 3B", approxSizeGB: 2.2, minRamGB: 4, requiresWebgpu: true },
  { tier: "full", modelId: "Llama-3.1-8B-Instruct-q4f16_1-MLC", label: "FULL — Llama 3.1 8B", approxSizeGB: 4.9, minRamGB: 8, requiresWebgpu: true },
];

function catalogEntryForTier(tier) {
  const entry = MODEL_CATALOG.find((m) => m.tier === tier);
  if (!entry) {
    throw new Error(`Unknown model tier "${tier}". Expected one of nano/base/full.`);
  }
  return entry;
}

/** Resolve + validate a ModelRecord against the live (dynamically imported) package catalog. */
async function findModelRecord(modelId) {
  const { prebuiltAppConfig } = await loadWebLlm();
  const record = prebuiltAppConfig.model_list.find((m) => m.model_id === modelId);
  if (!record) {
    throw new Error(
      `Model "${modelId}" is not present in this @mlc-ai/web-llm build's prebuiltAppConfig.model_list.`,
    );
  }
  return record;
}

/**
 * Wraps a single WebLLM MLCEngine's lifecycle (load/unload) and chat
 * completion calls. Framework-agnostic: extends EventTarget so any UI layer
 * (React, vanilla, etc.) can subscribe to 'progress' / 'ready' / 'error'
 * CustomEvents without this file depending on React.
 */
export class LocalAI extends EventTarget {
  constructor() {
    super();
    this._engine = null;
    this._loadedTier = null;
    this._isLoading = false;
  }

  get loadedTier() {
    return this._loadedTier;
  }

  get isLoading() {
    return this._isLoading;
  }

  /**
   * Downloads (if not already cached) and initializes the model for `tier`,
   * emitting real progress events as WebLLM reports them.
   */
  async loadModel(tier) {
    const entry = catalogEntryForTier(tier);
    this._isLoading = true;
    try {
      await findModelRecord(entry.modelId); // validates the id still exists in the live catalog
      const { CreateMLCEngine } = await loadWebLlm();
      const engine = await CreateMLCEngine(entry.modelId, {
        initProgressCallback: (report) => {
          this.dispatchEvent(
            new CustomEvent("progress", {
              detail: {
                tier,
                progress: report.progress,
                text: report.text,
              },
            }),
          );
        },
      });
      this._engine = engine;
      this._loadedTier = tier;
      this._isLoading = false;
      this.dispatchEvent(new CustomEvent("ready", { detail: { tier } }));
      return engine;
    } catch (err) {
      this._isLoading = false;
      this._loadedTier = null;
      const message = err && err.message ? err.message : String(err);
      this.dispatchEvent(new CustomEvent("error", { detail: { tier, message } }));
      throw err;
    }
  }

  /**
   * Runs a streaming chat completion against the currently loaded engine.
   * Throws if no model has been loaded yet (caller is expected to catch this
   * and fall back to the offline knowledge-base search; that fallback is
   * implemented elsewhere, not here).
   */
  async chat(messages, { onToken } = {}) {
    if (!this._engine) {
      throw new Error(
        "LocalAI.chat() called with no model loaded. Call loadModel(tier) first.",
      );
    }

    const stream = await this._engine.chat.completions.create({
      messages,
      stream: true,
    });

    let full = "";
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        if (onToken) onToken(delta);
      }
    }
    return full;
  }

  /**
   * Frees the underlying engine/GPU resources if the installed WebLLM API
   * supports it. Safe no-op if nothing is loaded or unload isn't available.
   */
  unload() {
    if (this._engine && typeof this._engine.unload === "function") {
      // Fire-and-forget: unload() is async in WebLLM, but callers of this
      // synchronous convenience method shouldn't have to await teardown.
      this._engine.unload().catch(() => {});
    }
    this._engine = null;
    this._loadedTier = null;
    this._isLoading = false;
  }
}
