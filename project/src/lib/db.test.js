import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// db.js opens a single shared connection lazily and caches the promise at module
// scope, so each test gets a fresh IndexedDB factory + a fresh import of the module
// (vi.resetModules) to avoid cross-test contamination through that cache.
async function freshDb() {
  globalThis.indexedDB = new IDBFactory();
  const mod = await import('./db.js?t=' + Math.random());
  return mod.BeaconDB;
}

describe('BeaconDB', () => {
  it('stores and retrieves a value in the keyless "kv" store', async () => {
    const db = await freshDb();
    await db.set('kv', 'identity', { name: 'Alice' });
    const got = await db.get('kv', 'identity');
    expect(got).toEqual({ name: 'Alice' });
  });

  it('returns undefined for a missing kv key', async () => {
    const db = await freshDb();
    const got = await db.get('kv', 'nope');
    expect(got).toBeUndefined();
  });

  it('stores and lists records in a keyPath store ("messages")', async () => {
    const db = await freshDb();
    await db.set('messages', { id: 'm1', text: 'hi', ts: 1 });
    await db.set('messages', { id: 'm2', text: 'yo', ts: 2 });
    const all = await db.all('messages');
    expect(all.map(m => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('overwrites a record with the same key (put semantics)', async () => {
    const db = await freshDb();
    await db.set('markers', { id: 'me', lat: 1, lng: 2 });
    await db.set('markers', { id: 'me', lat: 3, lng: 4 });
    const all = await db.all('markers');
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({ id: 'me', lat: 3, lng: 4 });
  });

  it('deletes a record', async () => {
    const db = await freshDb();
    await db.set('sos', { id: 's1', ts: 1 });
    await db.del('sos', 's1');
    expect(await db.all('sos')).toEqual([]);
  });

  it('clears a store', async () => {
    const db = await freshDb();
    await db.set('zim_meta', { id: 'z1' });
    await db.set('zim_meta', { id: 'z2' });
    await db.clear('zim_meta');
    expect(await db.all('zim_meta')).toEqual([]);
  });
});
