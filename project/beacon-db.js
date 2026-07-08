/* Beacon offline data layer — real IndexedDB. Assigns window.BeaconDB. */
(function () {
  const DBN = 'beacon', DBV = 1;
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DBN, DBV);
      r.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('sos')) db.createObjectStore('sos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('markers')) db.createObjectStore('markers', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function store(name, mode) {
    const db = await open();
    return db.transaction(name, mode).objectStore(name);
  }
  const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  const API = {
    async get(name, key) { const s = await store(name, 'readonly'); return wrap(s.get(key)); },
    async set(name, valueOrKey, value) {
      const s = await store(name, 'readwrite');
      // kv store has no keyPath -> set(name, key, value); keyed stores -> set(name, record)
      if (s.keyPath) return wrap(s.put(valueOrKey));
      return wrap(s.put(value, valueOrKey));
    },
    async all(name) { const s = await store(name, 'readonly'); return wrap(s.getAll()); },
    async del(name, key) { const s = await store(name, 'readwrite'); return wrap(s.delete(key)); },
    async clear(name) { const s = await store(name, 'readwrite'); return wrap(s.clear()); }
  };
  window.BeaconDB = API;
})();
