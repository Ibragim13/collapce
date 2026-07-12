// Beacon mesh chat — unifies same-device BroadcastChannel transport with real,
// serverless, device-to-device WebRTC transport (LAN/hotspot pairing via QR/text
// SDP exchange, no signaling server, no internet required). Framework-agnostic:
// extends EventTarget so React (or anything else) can subscribe via addEventListener.
import { channelKey, encryptMsg, decryptMsg } from '../lib/crypto.js';

const BC_NAME = 'beacon-mesh-v1';
const MAX_HOPS = 6;
const SEEN_CAP = 500;
const ICE_GATHER_TIMEOUT = 2500; // ms — fallback if gathering never reaches 'complete' (e.g. fully offline)
const RTC_CONFIG = {
  // Optional aid only — connections must still work purely from local host candidates
  // when there's no internet to reach this server. Never awaited/required.
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'm-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function randomPeerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

// Waits for ICE gathering to finish so the local SDP already embeds usable
// candidates (non-trickle exchange — the whole point is a single QR per direction).
// Resolves early if gathering completes; otherwise resolves anyway after `timeoutMs`
// so we're never stuck waiting forever when offline / no STUN reachable.
function waitIceGatheringComplete(pc, timeoutMs = ICE_GATHER_TIMEOUT) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    pc.addEventListener('icegatheringstatechange', onChange);
    const timer = setTimeout(finish, timeoutMs);
  });
}

export class Mesh extends EventTarget {
  constructor({ nodeId, nodeName } = {}) {
    super();
    this.nodeId = nodeId;
    this.nodeName = nodeName || nodeId || 'Node';

    this.channelCode = null;
    this._key = null;
    this._keyReady = this.setChannel('OPEN'); // sensible default so broadcast() works pre-pairing

    this.seenIds = new Set();
    this._seenOrder = [];

    // peerId -> { id, pc, dc, connected }
    this.peerConns = new Map();
    // host-side in-progress invite awaiting the joiner's answer: { pc, dc, peerId }
    this.pendingHostInvite = null;

    this.bc = null;
    this._initBroadcastChannel();
  }

  // ---- channel (E2E key) management ----------------------------------------

  async setChannel(code) {
    this.channelCode = code;
    const keyPromise = channelKey(code);
    this._keyReady = keyPromise;
    this._key = await keyPromise;
    return this._key;
  }

  // ---- local same-device transport ------------------------------------------

  _initBroadcastChannel() {
    try {
      this.bc = new BroadcastChannel(BC_NAME);
      this.bc.onmessage = (ev) => {
        this._handleWireEnvelope(ev.data, 'bc');
      };
    } catch (e) {
      this.bc = null; // BroadcastChannel unsupported — WebRTC peers still work
    }
  }

  // ---- sending / receiving ----------------------------------------------------

  async broadcast(text) {
    await this._keyReady;
    const key = this._key;
    const id = randomId();
    const ts = Date.now();
    const payload = await encryptMsg(key, text);
    const env = { id, from: this.nodeId, name: this.nodeName, payload, ts, hops: 0 };
    this._markSeen(id);
    this._sendEnvelope(env);
    return { id, from: this.nodeName, nodeId: this.nodeId, text, ts, hops: 0 };
  }

  // Sends an envelope out to BroadcastChannel + connected data channels, with
  // optional exclusions to avoid redundant echoes when relaying a flood message.
  _sendEnvelope(env, { skipBc = false, exceptPeerId = null } = {}) {
    if (!skipBc && this.bc) {
      try { this.bc.postMessage(env); } catch (e) { /* ignore */ }
    }
    const json = JSON.stringify(env);
    for (const [peerId, peer] of this.peerConns) {
      if (peerId === exceptPeerId) continue;
      if (peer.dc && peer.dc.readyState === 'open') {
        try { peer.dc.send(json); } catch (e) { /* ignore */ }
      }
    }
  }

  _markSeen(id) {
    if (this.seenIds.has(id)) return;
    this.seenIds.add(id);
    this._seenOrder.push(id);
    if (this._seenOrder.length > SEEN_CAP) {
      const old = this._seenOrder.shift();
      this.seenIds.delete(old);
    }
  }

  // Handles an envelope arriving from either the BroadcastChannel or a WebRTC peer:
  // de-dupes, decrypts + emits 'message' locally, and flood-relays to the other
  // transport(s) while respecting the hop limit.
  async _handleWireEnvelope(env, source, sourcePeerId) {
    if (!env || typeof env.id !== 'string' || !env.payload) return;
    if (this.seenIds.has(env.id)) return;
    this._markSeen(env.id);

    await this._keyReady;
    const text = await decryptMsg(this._key, env.payload);
    if (text != null) {
      this.dispatchEvent(new CustomEvent('message', {
        detail: {
          id: env.id,
          from: env.name,
          nodeId: env.from,
          text,
          ts: env.ts,
          hops: env.hops || 0,
          me: false,
        },
      }));
    }
    // else: wrong channel code — silently drop (don't emit), but still relay below
    // so peers with the right code further out in the mesh can still receive it.

    const hops = env.hops || 0;
    if (hops < MAX_HOPS) {
      const relayed = { ...env, hops: hops + 1 };
      if (source === 'bc') {
        this._sendEnvelope(relayed, { skipBc: true }); // local tabs already have it directly
      } else {
        this._sendEnvelope(relayed, { exceptPeerId: sourcePeerId }); // don't bounce back to sender
      }
    }
  }

  // ---- WebRTC peer wiring -----------------------------------------------------

  _wirePeerConnectionLifecycle(peerId, pc) {
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        const entry = this.peerConns.get(peerId);
        if (entry && entry.connected) {
          entry.connected = false;
          this._emitPeers();
        }
      }
    };
  }

  _wireDataChannel(peerId, pc, dc) {
    dc.onopen = () => {
      const entry = this.peerConns.get(peerId) || { id: peerId, pc, dc };
      entry.dc = dc;
      entry.connected = true;
      this.peerConns.set(peerId, entry);
      this._emitPeers();
    };
    const onDown = () => {
      const entry = this.peerConns.get(peerId);
      if (entry && entry.connected) {
        entry.connected = false;
        this._emitPeers();
      }
    };
    dc.onclose = onDown;
    dc.onerror = onDown;
    dc.onmessage = (ev) => {
      let env;
      try { env = JSON.parse(ev.data); } catch (e) { return; }
      this._handleWireEnvelope(env, 'peer', peerId);
    };
  }

  _emitPeers() {
    this.dispatchEvent(new CustomEvent('peers', { detail: this.peers }));
  }

  // ---- serverless WebRTC pairing: offerer / "host" side -----------------------

  async createInvite() {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerId = randomPeerId();
    const dc = pc.createDataChannel('beacon');

    this.peerConns.set(peerId, { id: peerId, pc, dc, connected: false });
    this._wireDataChannel(peerId, pc, dc);
    this._wirePeerConnectionLifecycle(peerId, pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIceGatheringComplete(pc);

    this.pendingHostInvite = { pc, dc, peerId };

    const inviteText = JSON.stringify({ t: 'offer', id: peerId, sdp: pc.localDescription.sdp });
    return { inviteText };
  }

  // ---- serverless WebRTC pairing: joiner side ---------------------------------

  async acceptInvite(inviteText) {
    const invite = JSON.parse(inviteText);
    if (!invite || invite.t !== 'offer' || !invite.sdp) throw new Error('Invalid invite');

    const peerId = invite.id || randomPeerId();
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConns.set(peerId, { id: peerId, pc, dc: null, connected: false });
    this._wirePeerConnectionLifecycle(peerId, pc);
    pc.ondatachannel = (ev) => {
      const entry = this.peerConns.get(peerId);
      if (entry) entry.dc = ev.channel;
      this._wireDataChannel(peerId, pc, ev.channel);
    };

    await pc.setRemoteDescription({ type: 'offer', sdp: invite.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIceGatheringComplete(pc);

    const answerText = JSON.stringify({ t: 'answer', id: peerId, sdp: pc.localDescription.sdp });
    return { answerText };
  }

  // ---- host side: finish the handshake after scanning the joiner's answer -----

  async completeInvite(answerText) {
    const msg = JSON.parse(answerText);
    if (!msg || msg.t !== 'answer' || !msg.sdp) throw new Error('Invalid answer');
    if (!this.pendingHostInvite) throw new Error('No pending invite to complete');

    const { pc, peerId } = this.pendingHostInvite;
    await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
    this.pendingHostInvite = null;
    return { peerId };
  }

  // ---- peers -------------------------------------------------------------------

  get peers() {
    return [...this.peerConns.values()].map((p) => ({ id: p.id, connected: !!p.connected }));
  }

  // ---- teardown ------------------------------------------------------------------

  close() {
    if (this.bc) {
      try { this.bc.close(); } catch (e) { /* ignore */ }
      this.bc = null;
    }
    for (const peer of this.peerConns.values()) {
      try { peer.dc && peer.dc.close(); } catch (e) { /* ignore */ }
      try { peer.pc && peer.pc.close(); } catch (e) { /* ignore */ }
    }
    this.peerConns.clear();
    if (this.pendingHostInvite) {
      try { this.pendingHostInvite.pc.close(); } catch (e) { /* ignore */ }
      this.pendingHostInvite = null;
    }
  }
}
