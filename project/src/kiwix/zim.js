/**
 * ZIM archive reader (Kiwix offline content format — https://wiki.openzim.org/wiki/ZIM_file_format).
 *
 * IMPORTANT HONESTY NOTE FOR MAINTAINERS:
 * The byte-offset layout below (header, directory entry, cluster) was written from best-effort
 * training-data memory of the ZIM spec. It was NOT cross-checked against a live copy of the spec
 * page or a real .zim file in the sandbox that produced this file (no internet access there).
 * The parsing *mechanics* (DataView usage, pointer-list binary search, cluster/blob slicing,
 * zstd decompression via fzstd) were validated with a hand-built synthetic ZIM-like buffer — see
 * `__selftest.md` in this directory for exactly what was verified and how to re-verify against a
 * real file. If something doesn't parse, start with `ZimArchive.debugInfo()` — it dumps every
 * parsed header field plus bounds-sanity booleans so a mismatch (usually one of the offset
 * constants below being wrong) is easy to spot.
 *
 * All offsets are named constants (never inline magic numbers) so they're trivial to patch.
 */

import { decompress as zstdDecompress } from 'fzstd';

// ---------------------------------------------------------------------------
// Header layout (80 bytes total, little-endian)
// ---------------------------------------------------------------------------
const HEADER_SIZE = 80;

const OFF_MAGIC_NUMBER = 0;   // uint32
const OFF_MINOR_VERSION = 4;  // uint16
const OFF_MAJOR_VERSION = 6;  // uint16
const OFF_UUID = 8;           // 16 bytes
const OFF_ENTRY_COUNT = 24;   // uint32
const OFF_CLUSTER_COUNT = 28; // uint32
const OFF_URL_PTR_POS = 32;   // uint64
const OFF_TITLE_PTR_POS = 40; // uint64
const OFF_CLUSTER_PTR_POS = 48; // uint64
const OFF_MIME_LIST_POS = 56; // uint64
const OFF_MAIN_PAGE = 64;     // uint32 (entry index; 0xFFFFFFFF = none)
const OFF_LAYOUT_PAGE = 68;   // uint32 (entry index; 0xFFFFFFFF = none)
const OFF_CHECKSUM_POS = 72;  // uint64

const EXPECTED_MAGIC_NUMBER = 0x044d495a;
const NO_PAGE = 0xffffffff;

// Pointer-list element sizes (bytes)
const URL_PTR_SIZE = 8;   // Url Pointer List: uint64 file offsets, entryCount of them
const TITLE_PTR_SIZE = 4; // Title Pointer List: uint32 indices into the Url Pointer List
const CLUSTER_PTR_SIZE = 8; // Cluster Pointer List: uint64 file offsets, clusterCount of them

// Directory entry mimetype sentinel values
const MIMETYPE_REDIRECT = 0xffff;
const MIMETYPE_LINKTARGET = 0xfffe;
const MIMETYPE_DELETED = 0xfffd;

// Directory entry fixed prefix: uint16 mimetype + uint8 parameterLen + char namespace + uint32 revision
const DIRENT_FIXED_PREFIX_SIZE = 2 + 1 + 1 + 4;

// Cluster info byte
const CLUSTER_COMPRESSION_MASK = 0x0f; // low nibble = compression type
const CLUSTER_EXTENDED_BIT = 0x10;     // bit 4 = extended (64-bit) blob pointers, best-effort per spec note
const COMPRESSION_NONE_0 = 0;
const COMPRESSION_NONE_1 = 1;
const COMPRESSION_LZMA = 4;
const COMPRESSION_ZSTD = 5;

const MAX_REDIRECT_HOPS = 20;
const LINEAR_SEARCH_THRESHOLD = 2000; // below this entryCount, searchTitles() just scans linearly

// ---------------------------------------------------------------------------
// Small binary helpers
// ---------------------------------------------------------------------------

/** Combine two little-endian uint32 reads into a JS Number (safe for realistic ZIM file sizes). */
function combineUint64LE(view, offset) {
  const low = view.getUint32(offset, true);
  const high = view.getUint32(offset + 4, true);
  return low + high * 4294967296;
}

function hexByte(n) {
  return '0x' + n.toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// ZimArchive
// ---------------------------------------------------------------------------

export class ZimArchive {
  /**
   * @param {Blob} file
   * @param {object} header parsed header fields
   * @param {string[]} mimeTypes mimetype list, index-addressable
   */
  constructor(file, header, mimeTypes) {
    this._file = file;
    this._fileSize = file.size;
    this._header = header;
    this._mimeTypes = mimeTypes;
    this._title = null; // filled in by openZimArchive() best-effort
    this._titleAtCache = new Map(); // small memoization for searchTitles() binary search
  }

  get entryCount() {
    return this._header.entryCount;
  }

  /** Best-effort archive title, read from the 'M/Title' metadata entry at open time. Null if absent. */
  get title() {
    return this._title;
  }

  // -- low-level file access -------------------------------------------------

  async _readBytes(start, length) {
    if (start < 0 || start + length > this._fileSize) {
      throw new Error(
        `ZIM read out of bounds: requested [${start}, ${start + length}) but file size is ${this._fileSize}`
      );
    }
    const buf = await this._file.slice(start, start + length).arrayBuffer();
    return new DataView(buf);
  }

  async _readUint32At(offset) {
    const view = await this._readBytes(offset, 4);
    return view.getUint32(0, true);
  }

  async _readUint64At(offset) {
    const view = await this._readBytes(offset, 8);
    return combineUint64LE(view, 0);
  }

  /** Read a NUL-terminated UTF-8 string starting at `offset`. Returns { str, end } where `end` is the offset of the byte after the NUL. */
  async _readCString(offset, { maxLen = 1 << 20 } = {}) {
    let chunkSize = 256;
    while (true) {
      const readLen = Math.min(chunkSize, this._fileSize - offset);
      if (readLen <= 0) {
        return { str: '', end: offset };
      }
      const buf = await this._file.slice(offset, offset + readLen).arrayBuffer();
      const bytes = new Uint8Array(buf);
      const nulIdx = bytes.indexOf(0);
      if (nulIdx !== -1) {
        const str = new TextDecoder('utf-8').decode(bytes.subarray(0, nulIdx));
        return { str, end: offset + nulIdx + 1 };
      }
      if (readLen >= maxLen || offset + readLen >= this._fileSize) {
        // Ran off the end of the file / hit our safety cap without a NUL — corrupt data.
        throw new Error(
          `ZIM parse error: unterminated string starting at offset ${offset} (no NUL byte found within ${readLen} bytes)`
        );
      }
      chunkSize *= 4; // grow and retry
    }
  }

  // -- header / mimetype list (parsed once, at open) -------------------------

  static _parseHeader(view) {
    const magicNumber = view.getUint32(OFF_MAGIC_NUMBER, true);
    if (magicNumber !== EXPECTED_MAGIC_NUMBER) {
      throw new Error(
        `Not a valid ZIM file: magic number check failed at offset ${OFF_MAGIC_NUMBER} ` +
          `(expected ${hexByte(EXPECTED_MAGIC_NUMBER)}, got ${hexByte(magicNumber)}). ` +
          `Either this file isn't a ZIM archive, or the header layout assumed by this reader is wrong ` +
          `— see the honesty note at the top of src/kiwix/zim.js.`
      );
    }
    return {
      magicNumber,
      minorVersion: view.getUint16(OFF_MINOR_VERSION, true),
      majorVersion: view.getUint16(OFF_MAJOR_VERSION, true),
      uuid: Array.from(new Uint8Array(view.buffer, view.byteOffset + OFF_UUID, 16))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
      entryCount: view.getUint32(OFF_ENTRY_COUNT, true),
      clusterCount: view.getUint32(OFF_CLUSTER_COUNT, true),
      urlPtrPos: combineUint64LE(view, OFF_URL_PTR_POS),
      titlePtrPos: combineUint64LE(view, OFF_TITLE_PTR_POS),
      clusterPtrPos: combineUint64LE(view, OFF_CLUSTER_PTR_POS),
      mimeListPos: combineUint64LE(view, OFF_MIME_LIST_POS),
      mainPage: view.getUint32(OFF_MAIN_PAGE, true),
      layoutPage: view.getUint32(OFF_LAYOUT_PAGE, true),
      checksumPos: combineUint64LE(view, OFF_CHECKSUM_POS),
    };
  }

  async _loadMimeTypes() {
    const list = [];
    let offset = this._header.mimeListPos;
    // Sequence of NUL-terminated strings, terminated by one empty string.
    while (true) {
      const { str, end } = await this._readCString(offset);
      if (str === '') break;
      list.push(str);
      offset = end;
      if (list.length > 100000) {
        throw new Error('ZIM parse error: mimetype list exceeded 100000 entries without a terminator — assuming corruption.');
      }
    }
    return list;
  }

  // -- directory entries ------------------------------------------------------

  /** Read+parse the directory entry located at absolute file offset `offset`. */
  async _parseDirectoryEntryAt(offset) {
    const prefixView = await this._readBytes(offset, DIRENT_FIXED_PREFIX_SIZE);
    const mimetypeIndex = prefixView.getUint16(0, true);
    const parameterLen = prefixView.getUint8(2);
    const namespace = String.fromCharCode(prefixView.getUint8(3));
    const revision = prefixView.getUint32(4, true);

    const isRedirect = mimetypeIndex === MIMETYPE_REDIRECT;
    let kind = 'content';
    if (mimetypeIndex === MIMETYPE_REDIRECT) kind = 'redirect';
    else if (mimetypeIndex === MIMETYPE_LINKTARGET) kind = 'linktarget';
    else if (mimetypeIndex === MIMETYPE_DELETED) kind = 'deleted';

    let cursor = offset + DIRENT_FIXED_PREFIX_SIZE;
    let redirectIndex = -1;
    let clusterNumber = -1;
    let blobNumber = -1;

    if (isRedirect) {
      redirectIndex = await this._readUint32At(cursor);
      cursor += 4;
    } else {
      // Per the spec given to this reader, only mimetype===0xFFFF (redirect) takes the
      // redirectIndex branch; linktarget/deleted entries are (best-effort) assumed to still
      // carry cluster/blob fields like ordinary content entries, they're just not meant to be
      // dereferenced as real content. Flag this assumption in debugInfo()/comments for anyone
      // validating against a real file.
      clusterNumber = await this._readUint32At(cursor);
      cursor += 4;
      blobNumber = await this._readUint32At(cursor);
      cursor += 4;
    }

    const urlRes = await this._readCString(cursor);
    const titleRes = await this._readCString(urlRes.end);
    const url = urlRes.str;
    const title = titleRes.str === '' ? url : titleRes.str;
    // parameterLen ignorable bytes follow `title` — deliberately skipped/unused.

    const mimeType = isRedirect ? null : this._mimeTypes[mimetypeIndex] ?? null;

    return {
      offset,
      namespace,
      mimetypeIndex,
      mimeType,
      parameterLen,
      revision,
      isRedirect,
      kind,
      redirectIndex,
      clusterNumber,
      blobNumber,
      url,
      title,
    };
  }

  /** Directory-entry offset for Url Pointer List slot `i` (0-based, sorted by namespace+url). */
  async _urlPtrEntryOffset(i) {
    return this._readUint64At(this._header.urlPtrPos + i * URL_PTR_SIZE);
  }

  /** Resolve a Url Pointer List slot straight to its parsed directory entry. */
  async _entryAtUrlPtrIndex(i) {
    const off = await this._urlPtrEntryOffset(i);
    return this._parseDirectoryEntryAt(off);
  }

  /** Follow entry.redirectIndex chains up to MAX_REDIRECT_HOPS; throws on loop/overflow. */
  async _resolveRedirects(entry) {
    let current = entry;
    let hops = 0;
    const seen = new Set();
    while (current.isRedirect) {
      if (hops++ > MAX_REDIRECT_HOPS) {
        throw new Error(`ZIM redirect chain exceeded ${MAX_REDIRECT_HOPS} hops starting from "${entry.url}" — assuming a loop.`);
      }
      if (seen.has(current.redirectIndex)) {
        throw new Error(`ZIM redirect loop detected starting from "${entry.url}" (revisited url-ptr index ${current.redirectIndex}).`);
      }
      seen.add(current.redirectIndex);
      current = await this._entryAtUrlPtrIndex(current.redirectIndex);
    }
    return current;
  }

  /**
   * Binary search the Url Pointer List (sorted by namespace, then url) for an exact match.
   * Returns the directory entry (possibly still a redirect — caller decides whether to resolve) or null.
   */
  async getEntryByUrl(namespace, url) {
    const target = namespace + url;
    let lo = 0;
    let hi = this.entryCount - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const entry = await this._entryAtUrlPtrIndex(mid);
      const key = entry.namespace + entry.url;
      if (key === target) return entry;
      if (key < target) lo = mid + 1;
      else hi = mid - 1;
    }
    return null;
  }

  async getMainPage() {
    if (this._header.mainPage === NO_PAGE) return null;
    const entry = await this._entryAtUrlPtrIndex(this._header.mainPage);
    return this._resolveRedirects(entry);
  }

  // -- title search -------------------------------------------------------

  /** Title Pointer List slot `i` -> resolved {title, url, namespace}, memoized. */
  async _titleAt(i) {
    if (this._titleAtCache.has(i)) return this._titleAtCache.get(i);
    const urlPtrIndex = await this._readUint32At(this._header.titlePtrPos + i * TITLE_PTR_SIZE);
    const entry = await this._entryAtUrlPtrIndex(urlPtrIndex);
    const result = { title: entry.title, url: entry.url, namespace: entry.namespace };
    this._titleAtCache.set(i, result);
    return result;
  }

  /**
   * Prefix search over the Title Pointer List. Case-insensitive.
   * For small archives (< LINEAR_SEARCH_THRESHOLD entries) this scans linearly. For larger
   * archives it binary-searches for a lower bound (case-sensitive comparison, since we can't
   * assume how the ZIM writer collated titles) and then scans forward; to also catch
   * differently-cased matches (the on-disk sort order is unknown to us) it repeats the search
   * for a couple of case variants of `prefix` and merges the results. This is a pragmatic
   * approximation, not a guaranteed-complete search — full-text/Xapian search is out of scope.
   */
  async searchTitles(prefix, limit = 20) {
    if (!prefix) return [];
    const n = this.entryCount;
    const needleLower = prefix.toLowerCase();
    const results = [];
    const seen = new Set();

    const consider = (r) => {
      const key = r.namespace + r.url;
      if (seen.has(key)) return;
      seen.add(key);
      results.push(r);
    };

    if (n < LINEAR_SEARCH_THRESHOLD) {
      for (let i = 0; i < n && results.length < limit; i++) {
        const r = await this._titleAt(i);
        if (r.title.toLowerCase().startsWith(needleLower)) consider(r);
      }
      return results.slice(0, limit);
    }

    const variants = Array.from(
      new Set([prefix, needleLower, prefix.charAt(0).toUpperCase() + prefix.slice(1), prefix.charAt(0).toLowerCase() + prefix.slice(1)])
    );

    for (const needle of variants) {
      if (results.length >= limit) break;
      // Binary search for the first index whose title is not < needle (case-sensitive).
      let lo = 0;
      let hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        const r = await this._titleAt(mid);
        if (r.title < needle) lo = mid + 1;
        else hi = mid;
      }
      // Scan forward while titles still case-insensitively match the prefix. Bail out after a
      // run of non-matches in case our lower-bound guess landed slightly off due to collation.
      let miss = 0;
      for (let i = lo; i < n && results.length < limit && miss < 4; i++) {
        const r = await this._titleAt(i);
        if (r.title.toLowerCase().startsWith(needleLower)) {
          consider(r);
          miss = 0;
        } else {
          miss++;
        }
      }
    }

    return results.slice(0, limit);
  }

  // -- clusters / blobs / content -----------------------------------------

  async _clusterOffset(clusterNumber) {
    return this._readUint64At(this._header.clusterPtrPos + clusterNumber * CLUSTER_PTR_SIZE);
  }

  async _readCluster(clusterNumber) {
    const { clusterCount } = this._header;
    if (clusterNumber < 0 || clusterNumber >= clusterCount) {
      throw new Error(`ZIM: cluster number ${clusterNumber} out of range (clusterCount=${clusterCount})`);
    }
    const start = await this._clusterOffset(clusterNumber);
    const end = clusterNumber + 1 < clusterCount ? await this._clusterOffset(clusterNumber + 1) : this._fileSize;
    if (end <= start) {
      throw new Error(`ZIM: cluster ${clusterNumber} has non-positive length (start=${start}, end=${end})`);
    }
    const raw = new Uint8Array(await this._file.slice(start, end).arrayBuffer());
    const infoByte = raw[0];
    const compressionType = infoByte & CLUSTER_COMPRESSION_MASK;
    const extended = (infoByte & CLUSTER_EXTENDED_BIT) !== 0;
    const payload = raw.subarray(1);

    let data;
    if (compressionType === COMPRESSION_NONE_0 || compressionType === COMPRESSION_NONE_1) {
      data = payload;
    } else if (compressionType === COMPRESSION_ZSTD) {
      data = zstdDecompress(payload);
    } else if (compressionType === COMPRESSION_LZMA) {
      throw new Error('Unsupported ZIM cluster compression: LZMA (type 4). Only uncompressed and Zstandard clusters are supported by this reader.');
    } else {
      throw new Error(`Unsupported/unknown ZIM cluster compression type: ${compressionType} (info byte ${infoByte})`);
    }

    return { data, extended };
  }

  async _readBlob(clusterNumber, blobNumber) {
    const { data, extended } = await this._readCluster(clusterNumber);
    const ptrSize = extended ? 8 : 4;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    const readPtr = (i) => {
      const off = i * ptrSize;
      if (extended) return combineUint64LE(view, off);
      return view.getUint32(off, true);
    };

    const firstPtr = readPtr(0);
    const blobCount = firstPtr / ptrSize - 1;
    if (blobNumber < 0 || blobNumber >= blobCount) {
      throw new Error(`ZIM: blob number ${blobNumber} out of range (blobCount=${blobCount}, cluster has ${data.byteLength} decompressed bytes)`);
    }
    const blobStart = readPtr(blobNumber);
    const blobEnd = readPtr(blobNumber + 1);
    return data.subarray(blobStart, blobEnd);
  }

  /**
   * Resolve redirects and return the raw content of `entry`: { mimeType, data: ArrayBuffer }.
   */
  async readEntry(entry) {
    const target = await this._resolveRedirects(entry);
    if (target.kind !== 'content') {
      throw new Error(`ZIM: cannot read content for entry "${target.url}" of kind "${target.kind}" (no article body).`);
    }
    const blob = await this._readBlob(target.clusterNumber, target.blobNumber);
    // Return a detached copy so callers can hold onto it independent of the cluster buffer.
    const data = blob.slice().buffer;
    return { mimeType: target.mimeType, data };
  }

  // -- article convenience --------------------------------------------------

  /** Best-effort relative-URL resolver against a ZIM entry url (no host, just path segments). */
  static _resolveRelativePath(baseUrl, relativeUrl) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(relativeUrl) || relativeUrl.startsWith('//')) return null; // absolute/external
    if (!relativeUrl || relativeUrl.startsWith('#')) return null;
    const path = relativeUrl.split(/[?#]/)[0];
    if (!path) return null;
    const baseParts = baseUrl.split('/');
    baseParts.pop(); // drop the article's own filename
    for (const part of path.split('/')) {
      if (part === '' || part === '.') continue;
      if (part === '..') baseParts.pop();
      else baseParts.push(part);
    }
    return baseParts.join('/');
  }

  /**
   * Convenience for 'C' namespace HTML entries. Returns the decoded HTML plus a resolver for
   * sibling resources (images/css) referenced by relative URL, so a caller can rewrite
   * <img src>/<link href> to blob: URLs. Namespace conventions differ between older
   * (A=article, I=image, -=layout, M=metadata) and newer (single C namespace) ZIM files, so this
   * is a best-effort search across a few likely namespaces — it returns null instead of throwing
   * when nothing matches, so rendering degrades gracefully.
   */
  async readArticleHtml(entry) {
    const { mimeType, data } = await this.readEntry(entry);
    const html = new TextDecoder('utf-8').decode(new Uint8Array(data));

    const resolveResource = async (relativeUrl) => {
      try {
        const resolvedPath = ZimArchive._resolveRelativePath(entry.url, relativeUrl);
        if (resolvedPath == null) return null;
        const candidateNamespaces = Array.from(new Set([entry.namespace, 'C', 'I', '-']));
        for (const ns of candidateNamespaces) {
          const found = await this.getEntryByUrl(ns, resolvedPath);
          if (!found) continue;
          const resolved = await this._resolveRedirects(found);
          if (resolved.kind !== 'content') continue;
          const { mimeType: resMime, data: resData } = await this.readEntry(resolved);
          return new Blob([resData], { type: resMime || 'application/octet-stream' });
        }
        return null;
      } catch {
        return null; // degrade gracefully — broken image icon beats a crashed article view
      }
    };

    return { html, mimeType, resolveResource };
  }

  // -- diagnostics ------------------------------------------------------------

  /** Synchronous dump of parsed header fields + sanity checks, for validating against a real file. */
  debugInfo() {
    const h = this._header;
    const fileSize = this._fileSize;
    const urlPtrListEnd = h.urlPtrPos + h.entryCount * URL_PTR_SIZE;
    const titlePtrListEnd = h.titlePtrPos + h.entryCount * TITLE_PTR_SIZE;
    const clusterPtrListEnd = h.clusterPtrPos + h.clusterCount * CLUSTER_PTR_SIZE;
    return {
      header: { ...h },
      fileSize,
      mimeTypeCount: this._mimeTypes.length,
      mimeTypes: this._mimeTypes.slice(0, 20),
      resolvedTitle: this._title,
      sanity: {
        magicNumberOk: h.magicNumber === EXPECTED_MAGIC_NUMBER,
        entryCountPlausible: h.entryCount > 0 && h.entryCount < 100_000_000,
        clusterCountPlausible: h.clusterCount >= 0 && h.clusterCount < 10_000_000,
        urlPtrPosInBounds: h.urlPtrPos >= HEADER_SIZE && h.urlPtrPos < fileSize,
        urlPtrListFitsInFile: urlPtrListEnd <= fileSize,
        titlePtrPosInBounds: h.titlePtrPos >= HEADER_SIZE && h.titlePtrPos < fileSize,
        titlePtrListFitsInFile: titlePtrListEnd <= fileSize,
        clusterPtrPosInBounds: h.clusterCount === 0 || (h.clusterPtrPos >= HEADER_SIZE && h.clusterPtrPos < fileSize),
        clusterPtrListFitsInFile: clusterPtrListEnd <= fileSize,
        mimeListPosInBounds: h.mimeListPos >= HEADER_SIZE && h.mimeListPos < fileSize,
        mainPageInRange: h.mainPage === NO_PAGE || h.mainPage < h.entryCount,
        layoutPageInRange: h.layoutPage === NO_PAGE || h.layoutPage < h.entryCount,
      },
    };
  }
}

/**
 * Open a ZIM archive from a File/Blob. Reads + validates the 80-byte header, parses the mimetype
 * list, and best-effort resolves the M/Title metadata entry. Throws a descriptive Error if the
 * magic number doesn't match (i.e. this isn't a ZIM file, or the header layout assumed here is wrong).
 */
export async function openZimArchive(file) {
  if (!file || typeof file.slice !== 'function') {
    throw new Error('openZimArchive(file): expected a File/Blob with a .slice() method.');
  }
  if (file.size < HEADER_SIZE) {
    throw new Error(`Not a valid ZIM file: file is only ${file.size} bytes, smaller than the ${HEADER_SIZE}-byte header.`);
  }
  const headerBuf = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const header = ZimArchive._parseHeader(new DataView(headerBuf));

  const archive = new ZimArchive(file, header, []);
  archive._mimeTypes = await archive._loadMimeTypes();

  try {
    const titleEntry = await archive.getEntryByUrl('M', 'Title');
    if (titleEntry) {
      const resolved = await archive._resolveRedirects(titleEntry);
      if (resolved.kind === 'content') {
        const { data } = await archive.readEntry(resolved);
        archive._title = new TextDecoder('utf-8').decode(new Uint8Array(data)).trim() || null;
      }
    }
  } catch {
    archive._title = null; // best-effort only — never fail archive open over a missing/odd title
  }

  return archive;
}
