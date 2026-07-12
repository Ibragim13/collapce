// Polyfills so browser-only modules (IndexedDB) can be unit-tested under Node.
// BroadcastChannel and crypto.subtle are real Node globals already (Node 18+/19+) —
// no polyfill needed for those.
import 'fake-indexeddb/auto';
