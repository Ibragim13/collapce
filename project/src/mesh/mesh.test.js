import { describe, it, expect, afterEach } from 'vitest';
import { Mesh } from './mesh.js';

// These tests exercise the same-device transport (BroadcastChannel, a real global
// in Node 18+) plus the E2E encrypt/decrypt path. The WebRTC pairing methods
// (createInvite/acceptInvite/completeInvite) need RTCPeerConnection, which only
// exists in a real browser — those were verified manually (Playwright + the design
// chat's own two-tab testing), not here.

// A ceiling, not a real budget: with the deterministic mock BroadcastChannel
// (see src/test/setup.js) delivery is microtask-scheduled, so this resolves
// in well under a millisecond on the happy path — the timeout only matters if
// delivery never happens at all (a real failure).
function onceMessage(mesh, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
    mesh.addEventListener('message', (ev) => { clearTimeout(t); resolve(ev.detail); }, { once: true });
  });
}

function neverMessage(mesh, waitMs = 500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, waitMs);
    mesh.addEventListener('message', () => { clearTimeout(t); reject(new Error('unexpected message received')); }, { once: true });
  });
}

const meshes = [];
function makeMesh(opts) { const m = new Mesh(opts); meshes.push(m); return m; }
afterEach(() => { while (meshes.length) meshes.pop().close(); });

describe('Mesh (same-device BroadcastChannel transport)', () => {
  it('delivers a broadcast message to another instance on the default channel', async () => {
    const alice = makeMesh({ nodeId: 'BCN-A', nodeName: 'Alice' });
    const bob = makeMesh({ nodeId: 'BCN-B', nodeName: 'Bob' });

    const received = onceMessage(bob);
    const sent = await alice.broadcast('hello mesh');
    const detail = await received;

    expect(sent.text).toBe('hello mesh');
    expect(detail.text).toBe('hello mesh');
    expect(detail.nodeId).toBe('BCN-A');
    expect(detail.from).toBe('Alice');
    expect(detail.hops).toBe(0);
  });

  it('does not deliver messages across different channel codes', async () => {
    const alice = makeMesh({ nodeId: 'BCN-A', nodeName: 'Alice' });
    const eve = makeMesh({ nodeId: 'BCN-E', nodeName: 'Eve' });
    await alice.setChannel('SECRET-1');
    await eve.setChannel('SECRET-2');

    const guard = neverMessage(eve);
    await alice.broadcast('you should not read this');
    await expect(guard).resolves.toBeUndefined();
  });

  it('delivers messages once both sides share the same custom channel code', async () => {
    const alice = makeMesh({ nodeId: 'BCN-A', nodeName: 'Alice' });
    const bob = makeMesh({ nodeId: 'BCN-B', nodeName: 'Bob' });
    await alice.setChannel('TEAM-42');
    await bob.setChannel('TEAM-42');

    const received = onceMessage(bob);
    await alice.broadcast('squad up');
    const detail = await received;
    expect(detail.text).toBe('squad up');
  });

  it('exposes an empty peers list with no WebRTC connections made', () => {
    const alice = makeMesh({ nodeId: 'BCN-A', nodeName: 'Alice' });
    expect(alice.peers).toEqual([]);
  });
});
