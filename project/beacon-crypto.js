/* Beacon crypto — real WebCrypto identity, PIN (PBKDF2), 12-word recovery, AES-GCM E2E.
   Assigns window.BeaconCrypto. Recovery phrase uses a 256-symbol syllable mnemonic
   (16 syllables x 16 = 256; 1 byte/word). 12 words -> 96-bit identity seed.
   NOTE: production should use BIP39 (2048 words + checksum). */
(function () {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const SYL = ['ba','de','fi','go','hu','ka','le','mi','no','pu','ra','se','ti','vo','wu','za'];

  function hex(buf) { return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  function hexToBytes(h) { return new Uint8Array(h.match(/../g).map(x => parseInt(x, 16))); }
  function bytesToWords(bytes) { return [...bytes].map(b => SYL[b >> 4] + SYL[b & 15]); }
  function wordsToBytes(words) {
    const out = [];
    for (const w of words) {
      const hi = SYL.indexOf(w.slice(0, 2)), lo = SYL.indexOf(w.slice(2, 4));
      if (hi < 0 || lo < 0 || w.length !== 4) return null;
      out.push((hi << 4) | lo);
    }
    return new Uint8Array(out);
  }
  async function sha256(buf) { return crypto.subtle.digest('SHA-256', buf); }

  function newEntropy() { const e = new Uint8Array(12); crypto.getRandomValues(e); return e; }
  function phraseFromEntropy(e) { return bytesToWords(e).join(' '); }
  function entropyFromPhrase(p) {
    const w = String(p || '').trim().toLowerCase().split(/\s+/);
    if (w.length !== 12) return null;
    return wordsToBytes(w);
  }
  async function nodeIdFromEntropy(e) {
    const h = hex(await sha256(e)).toUpperCase();
    return 'BCN-' + h.slice(0, 4) + '-' + h.slice(4, 8);
  }

  async function derivePin(pin, saltBytes) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 120000, hash: 'SHA-256' }, base, 256);
    return hex(bits);
  }
  function randSalt() { const s = new Uint8Array(16); crypto.getRandomValues(s); return s; }

  async function channelKey(code) {
    const base = await crypto.subtle.importKey('raw', enc.encode(code || 'OPEN'), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('beacon-mesh-v1'), iterations: 60000, hash: 'SHA-256' }, base, 256);
    return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async function encryptMsg(key, text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
    return { iv: [...iv], ct: hex(ct) };
  }
  async function decryptMsg(key, payload) {
    try {
      const iv = new Uint8Array(payload.iv);
      const ct = hexToBytes(payload.ct);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return dec.decode(pt);
    } catch (e) { return null; }
  }

  window.BeaconCrypto = {
    SYL, hex, hexToBytes,
    newEntropy, phraseFromEntropy, entropyFromPhrase, nodeIdFromEntropy,
    derivePin, randSalt,
    channelKey, encryptMsg, decryptMsg,
    supported: !!(window.crypto && crypto.subtle)
  };
})();
