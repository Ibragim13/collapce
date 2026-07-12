// Polyfills so browser-only modules can be unit-tested under Node.
import 'fake-indexeddb/auto';

// Replace Node's real BroadcastChannel with a small deterministic in-process
// mock for the test environment. mesh.test.js exercises OUR delivery/relay/
// de-dupe logic, not Node's BroadcastChannel scheduling internals — and
// creating/closing many same-named real channels across test files in one
// process was occasionally dropping a delivery (observed: consistently fast
// in isolation, occasionally never-arrives when run alongside other test
// files even with fileParallelism disabled — a Node-runtime timing quirk,
// not a bug in Mesh, which is also verified working in a real browser via
// Playwright). A microtask-scheduled, name-scoped mock removes that whole
// class of flakiness while still exercising the real postMessage/onmessage/
// close contract Mesh depends on.
const channels = new Map(); // name -> Set<FakeBroadcastChannel>

class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    this._closed = false;
    if (!channels.has(name)) channels.set(name, new Set());
    channels.get(name).add(this);
  }
  postMessage(data) {
    if (this._closed) return;
    for (const peer of channels.get(this.name) || []) {
      if (peer === this || peer._closed) continue;
      queueMicrotask(() => {
        if (peer._closed || !peer.onmessage) return;
        peer.onmessage({ data });
      });
    }
  }
  close() {
    this._closed = true;
    const set = channels.get(this.name);
    if (set) set.delete(this);
  }
}

globalThis.BroadcastChannel = FakeBroadcastChannel;
