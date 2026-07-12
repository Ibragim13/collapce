import { describe, it, expect } from 'vitest';
import { CATS, search } from './kb.js';

describe('BeaconKB content', () => {
  it('has every article populated in both languages with matching step counts', () => {
    for (const cat of CATS) {
      expect(cat.ru).toBeTruthy();
      expect(cat.en).toBeTruthy();
      for (const art of cat.articles) {
        expect(art.ru.t).toBeTruthy();
        expect(art.en.t).toBeTruthy();
        expect(art.ru.b.length).toBeGreaterThan(0);
        expect(art.en.b.length).toBe(art.ru.b.length);
      }
    }
  });
});

describe('BeaconKB.search', () => {
  it('finds the bleeding article by a Russian title keyword', () => {
    const hits = search('кровотечения', 'ru');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toBe('Остановка кровотечения');
  });

  it('finds the water purification article by an English keyword', () => {
    const hits = search('purify water', 'en');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].art.en.t).toBe('Purify water');
  });

  it('also matches on body-only text, not just the title', () => {
    // "жгут" (tourniquet) only appears in the bleed article's body, not its title.
    const hits = search('жгут', 'ru');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].title).toBe('Остановка кровотечения');
  });

  it('gives a title match a higher score than a pure body-only match', () => {
    // "shelter" only appears in "Warmth & shelter"'s title (a title-match bonus applies);
    // "жгут" only appears in the bleed article's body (no title bonus) — the title match
    // should score noticeably higher for a single occurrence of the search term.
    const titleHit = search('shelter', 'en')[0];
    const bodyHit = search('жгут', 'ru')[0];
    expect(titleHit.score).toBeGreaterThan(bodyHit.score);
  });

  it('returns nothing for an empty query', () => {
    expect(search('', 'ru')).toEqual([]);
    expect(search('   ', 'ru')).toEqual([]);
  });

  it('returns nothing for a nonsense query', () => {
    expect(search('xyzzyqwerty12345', 'en')).toEqual([]);
  });
});
