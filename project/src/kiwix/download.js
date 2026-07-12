/**
 * Downloads ZIM files into OPFS (Origin Private File System) so multi-gigabyte archives never
 * sit fully in memory, and tracks metadata about them in BeaconDB's `zim_meta` store.
 *
 * Files are streamed straight from the network `Response` body into a
 * `FileSystemWritableFileStream` chunk by chunk. This runs on the main thread — no dedicated
 * Worker — since writing to OPFS via `createWritable()` doesn't block the UI thread the way
 * synchronous OPFS access handles do.
 */
import { BeaconDB } from '../lib/db.js';

const ZIM_META_STORE = 'zim_meta';
const OPFS_DIR = 'zim'; // subdirectory of the OPFS root that holds downloaded .zim files

/** Deterministic short slug derived from a URL (djb2-ish hash), used as both the BeaconDB id and OPFS filename stem. */
function slugFromUrl(url) {
  let h = 5381;
  for (let i = 0; i < url.length; i++) {
    h = ((h << 5) + h + url.charCodeAt(i)) | 0; // h*33 + c
  }
  return 'zim_' + (h >>> 0).toString(36);
}

async function getOpfsDir({ create = true } = {}) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create });
}

function filenameFor(id) {
  return `${id}.zim`;
}

/**
 * Stream a ZIM file from `url` into OPFS.
 * @param {string} url source URL to fetch
 * @param {object} opts
 * @param {string} [opts.name] human-readable name to store in metadata (defaults to the last URL path segment)
 * @param {(progress: {receivedBytes: number, totalBytes: number|null}) => void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal] cancellation
 * @returns {Promise<{id: string, name: string, sizeBytes: number}>}
 */
export async function downloadZim(url, { name, onProgress, signal } = {}) {
  const id = slugFromUrl(url);
  const displayName = name || url.split('/').filter(Boolean).pop() || id;

  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ZIM from ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  const totalBytesHeader = response.headers.get('content-length');
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;

  const dir = await getOpfsDir({ create: true });
  const fileName = filenameFor(id);
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  let receivedBytes = 0;
  const reader = response.body.getReader();

  const cleanupPartial = async () => {
    try {
      await writable.abort();
    } catch {
      /* already closed/aborted */
    }
    try {
      await dir.removeEntry(fileName);
    } catch {
      /* nothing to remove */
    }
  };

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  if (signal) {
    if (signal.aborted) {
      await cleanupPartial();
      throw signal.reason instanceof Error ? signal.reason : new Error('Download aborted');
    }
    signal.addEventListener('abort', onAbort);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writable.write(value);
      receivedBytes += value.byteLength;
      if (onProgress) onProgress({ receivedBytes, totalBytes });
    }
    await writable.close();
  } catch (err) {
    await cleanupPartial();
    if (signal && signal.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error('Download aborted');
    }
    throw err;
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  const record = {
    id,
    url,
    name: displayName,
    sizeBytes: receivedBytes,
    downloadedAt: Date.now(),
  };
  await BeaconDB.set(ZIM_META_STORE, record);

  return { id, name: displayName, sizeBytes: receivedBytes };
}

/** @returns {Promise<Array<{id: string, url: string, name: string, sizeBytes: number, downloadedAt: number}>>} */
export async function listDownloadedZims() {
  return BeaconDB.all(ZIM_META_STORE);
}

/** Remove both the OPFS file and the BeaconDB metadata record for a downloaded ZIM. */
export async function deleteZim(id) {
  const dir = await getOpfsDir({ create: true });
  try {
    await dir.removeEntry(filenameFor(id));
  } catch {
    /* file already gone — still clear metadata below */
  }
  await BeaconDB.del(ZIM_META_STORE, id);
}

/**
 * @param {string} id
 * @returns {Promise<File>} a File for random-access reads (e.g. via .slice()) of a previously downloaded ZIM.
 */
export async function getZimFile(id) {
  const dir = await getOpfsDir({ create: true });
  const fileHandle = await dir.getFileHandle(filenameFor(id), { create: false });
  return fileHandle.getFile();
}
