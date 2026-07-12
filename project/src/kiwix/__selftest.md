# zim.js self-test (mechanics only, not real-file-verified)

This sandbox has no internet access, so `zim.js` could not be tested against a real `.zim` file
from kiwix.org / library.kiwix.org. The header/directory-entry/cluster byte layout in `zim.js` was
written from best-effort memory of the openZIM spec and is **not yet confirmed correct**.

What *was* verified: the parsing mechanics — DataView offset math, URL/Title pointer-list binary
search, directory-entry parsing (content + redirect), cluster/blob pointer-list slicing, and real
Zstandard decompression via `fzstd.decompress()` — by hand-building a small synthetic ZIM-like
buffer in Node and reading it back through `openZimArchive()`. Node 22's built-in
`zlib.zstdCompressSync` was used to produce genuine zstd-compressed cluster bytes (fzstd only
decompresses), so the zstd path is exercised with real compressed data, not a fake.

The synthetic archive had: a header, a 3-entry mimetype list, 4 directory entries (one redirect,
three content: HTML, a small PNG-shaped byte blob, and an `M/Title` metadata string), one
uncompressed cluster, and one zstd-compressed cluster. Assertions covered:

- header parses and `entryCount`/`title` are correct (`M/Title` resolved via `getEntryByUrl`)
- `debugInfo()` sanity checks (all 12) pass
- `getMainPage()` resolves `header.mainPage` to the right entry
- `getEntryByUrl('C', 'alias.html')` finds a redirect entry; `readEntry()` follows the redirect
  and returns the target's HTML bytes (uncompressed-cluster path)
- `getEntryByUrl('C', 'img/pic.png')` + `readEntry()` returns byte-identical content to the
  original PNG-shaped bytes after a real zstd compress/decompress round trip
- `searchTitles('hello')` finds the right entry via the small-archive linear-scan path
- `readArticleHtml()` decodes HTML text and its `resolveResource('img/pic.png')` callback resolves
  the sibling image entry to a `Blob` with the correct bytes and `image/png` MIME type
- `resolveResource('http://example.com/x.png')` returns `null` instead of throwing (external URL)
- corrupting the magic number makes `openZimArchive()` throw an `Error` whose message mentions
  "magic number" (not a silent failure / not garbage data)

All of the above passed. The throwaway test script itself was deleted after use (per instructions)
— its logic is summarized here rather than kept as a stray file in the repo.

## How to validate against a real ZIM file

1. Get any small `.zim` file (e.g. a Kiwix "mini" Wikipedia or Wiktionary snapshot, a few
   hundred MB, from https://library.kiwix.org/ or https://download.kiwix.org/zim/).
2. In a browser console (or a small Node script using `fs` + wrapping a `Blob`-like shim, or just
   drop the file into the app's downloader once it's wired up):
   ```js
   import { openZimArchive } from './src/kiwix/zim.js';
   const file = /* a File/Blob for the .zim */;
   const archive = await openZimArchive(file);
   console.log(archive.debugInfo());
   ```
3. Check the `sanity` block: every boolean should be `true`. If `magicNumberOk` is false, the file
   isn't ZIM or isn't being read from offset 0. If any `*InBounds`/`*FitsInFile` check is false,
   one of the offset constants at the top of `zim.js` (`OFF_*`) is likely wrong for the real spec —
   compare against the current openZIM spec page and patch the named constant (never scattered
   magic numbers).
4. Try `await archive.getMainPage()` and `await archive.readArticleHtml(mainPage)` — if the HTML
   looks right, directory-entry parsing and cluster/blob decompression are correct end-to-end.
5. Try `await archive.searchTitles('a', 20)` and sanity-check the results look like real titles.
6. If the archive has an `M/Title` entry, `archive.title` should show the real archive title.

If step 2-3 reveals wrong offsets, the fix is localized: only the `OFF_*` / `*_SIZE` constants at
the top of `zim.js` should need to change, not the surrounding logic.
