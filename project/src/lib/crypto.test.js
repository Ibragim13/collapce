import { describe, it, expect } from 'vitest';
import * as Crypto from './crypto.js';

describe('crypto: recovery phrase <-> entropy round-trip', () => {
  it('encodes and decodes a random 12-byte entropy losslessly', () => {
    const e = Crypto.newEntropy();
    expect(e.length).toBe(12);
    const phrase = Crypto.phraseFromEntropy(e);
    expect(phrase.split(' ')).toHaveLength(12);
    const back = Crypto.entropyFromPhrase(phrase);
    expect([...back]).toEqual([...e]);
  });

  it('rejects a phrase that is not exactly 12 words', () => {
    expect(Crypto.entropyFromPhrase('ba de fi')).toBeNull();
  });

  it('rejects a phrase with a word outside the syllable set', () => {
    const words = Array(12).fill('baba');
    words[3] = 'zzzz';
    expect(Crypto.entropyFromPhrase(words.join(' '))).toBeNull();
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    const e = Crypto.newEntropy();
    const phrase = Crypto.phraseFromEntropy(e).toUpperCase();
    const back = Crypto.entropyFromPhrase('  ' + phrase.split(' ').join('   ') + '  ');
    expect([...back]).toEqual([...e]);
  });
});

describe('crypto: node id derivation', () => {
  it('is deterministic for the same entropy', async () => {
    const e = Crypto.newEntropy();
    const id1 = await Crypto.nodeIdFromEntropy(e);
    const id2 = await Crypto.nodeIdFromEntropy(e);
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^BCN-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('differs for different entropy (no accidental collisions in a small sample)', async () => {
    const ids = await Promise.all(Array.from({ length: 20 }, () => Crypto.nodeIdFromEntropy(Crypto.newEntropy())));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('crypto: PIN hashing (PBKDF2)', () => {
  it('derives the same hash for the same PIN + salt', async () => {
    const salt = Crypto.randSalt();
    const h1 = await Crypto.derivePin('1234', salt);
    const h2 = await Crypto.derivePin('1234', salt);
    expect(h1).toBe(h2);
  });

  it('derives a different hash for a different PIN', async () => {
    const salt = Crypto.randSalt();
    const h1 = await Crypto.derivePin('1234', salt);
    const h2 = await Crypto.derivePin('4321', salt);
    expect(h1).not.toBe(h2);
  });

  it('derives a different hash for the same PIN with a different salt', async () => {
    const h1 = await Crypto.derivePin('1234', Crypto.randSalt());
    const h2 = await Crypto.derivePin('1234', Crypto.randSalt());
    expect(h1).not.toBe(h2);
  });
});

describe('crypto: AES-GCM channel messages (mesh chat E2E)', () => {
  it('round-trips a message through the same channel code', async () => {
    const key = await Crypto.channelKey('OPEN');
    const payload = await Crypto.encryptMsg(key, 'hello mesh');
    const out = await Crypto.decryptMsg(key, payload);
    expect(out).toBe('hello mesh');
  });

  it('fails to decrypt with a different channel code', async () => {
    const keyA = await Crypto.channelKey('ALPHA');
    const keyB = await Crypto.channelKey('BRAVO');
    const payload = await Crypto.encryptMsg(keyA, 'secret');
    const out = await Crypto.decryptMsg(keyB, payload);
    expect(out).toBeNull();
  });

  it('produces a different ciphertext each time (random IV)', async () => {
    const key = await Crypto.channelKey('OPEN');
    const p1 = await Crypto.encryptMsg(key, 'same text');
    const p2 = await Crypto.encryptMsg(key, 'same text');
    expect(p1.ct).not.toBe(p2.ct);
  });
});

describe('crypto: hex helpers', () => {
  it('hex <-> bytes round-trips', () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    const hex = Crypto.hex(bytes.buffer);
    expect(hex).toBe('00010f10ff');
    expect([...Crypto.hexToBytes(hex)]).toEqual([...bytes]);
  });
});
