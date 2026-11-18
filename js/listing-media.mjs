import { preparePersonalImage } from './personal-images.mjs';
import { incognitoOn } from './incognito.mjs';

export const DB_NAME = 'lgme-listing-media';
export const STORE = 'listingMedia';
export const IMAGE_LIMIT = 2 * 1024 * 1024;
export const VIDEO_LIMIT = 50 * 1024 * 1024;
export const FILE_CAP = 10;
const HOLD = new Map();

export function freshSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashWithSalt(bytes, salt) {
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const saltBytes = new TextEncoder().encode(String(salt || ''));
  const joined = new Uint8Array(saltBytes.length + body.length);
  joined.set(saltBytes, 0);
  joined.set(body, saltBytes.length);
  const digest = await crypto.subtle.digest('SHA-256', joined);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function stripExif(file, scope = globalThis) {
  if (!String(file?.type || '').startsWith('image/')) return { ok: true, blob: file, stripped: false };
  if (typeof scope.createImageBitmap !== 'function' || !scope.document?.createElement) {
    return { ok: false, error: 'This phone cannot redraw the photo.' };
  }
  const bitmap = await scope.createImageBitmap(file);
  const canvas = scope.document.createElement('canvas');
  canvas.width = bitmap.width || 1;
  canvas.height = bitmap.height || 1;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) return { ok: false, error: 'That photo could not be redrawn.' };
  return { ok: true, blob, stripped: true };
}

export function browserMediaStore() {
  if (!globalThis.indexedDB) return memoryMediaStore();
  let opening;
  const open = () => {
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'hash' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return opening;
  };
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.result ?? result);
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    async put(record) { await run('readwrite', (store) => store.put(record)); },
    async get(hash) { return run('readonly', (store) => store.get(hash)); },
    async list(listingId) {
      const rows = await run('readonly', (store) => store.getAll());
      return (rows || []).filter((row) => row.listingId === listingId);
    },
    async remove(hash) { await run('readwrite', (store) => store.delete(hash)); },
    async used() {
      const rows = await run('readonly', (store) => store.getAll());
      return (rows || []).reduce((sum, row) => sum + (row.size || 0), 0);
    }
  };
}

export function memoryMediaStore() {
  const rows = new Map();
  return {
    async put(record) { rows.set(record.hash, record); },
    async get(hash) { return rows.get(hash) || null; },
    async list(listingId) { return [...rows.values()].filter((row) => row.listingId === listingId); },
    async remove(hash) { rows.delete(hash); },
    async used() { return [...rows.values()].reduce((sum, row) => sum + (row.size || 0), 0); }
  };
}

export function publicMedia(record) {
  return { hash: record.hash, mime: record.mime };
}

export function storageMeter(used) {
  const safe = Math.max(0, Number(used) || 0);
  return { used: safe, label: `${(safe / 1000000).toFixed(1)} MB on this phone` };
}

export async function addMedia(store, spec, options = {}) {
  const listingId = String(spec.listingId || '').slice(0, 80);
  if (!listingId) return { ok: false, error: 'Name the listing first.' };
  const existing = await store.list(listingId);
  if (existing.length >= FILE_CAP) return { ok: false, error: 'This listing already has 10 files.' };
  let bytes = spec.bytes instanceof Uint8Array ? spec.bytes : new Uint8Array(spec.bytes || []);
  let mime = String(spec.mime || spec.file?.type || 'application/octet-stream').slice(0, 80);
  let size = spec.file?.size || bytes.byteLength;
  if (mime.startsWith('video/') && size > VIDEO_LIMIT) return { ok: false, error: 'Video stays under 50 MB.' };
  if (mime.startsWith('image/') && spec.file && options.prepare !== false) {
    const prepared = await preparePersonalImage(spec.file, options.document || globalThis.document);
    if (!prepared.ok) return prepared;
    mime = prepared.type || mime;
    const raw = await prepared.blob.arrayBuffer();
    bytes = new Uint8Array(raw);
    size = bytes.byteLength;
  }
  if (mime.startsWith('image/') && size > IMAGE_LIMIT) return { ok: false, error: 'That photo is over about 2 MB.' };
  const salt = options.salt || spec.salt || freshSalt();
  const hash = await hashWithSalt(bytes, salt);
  const record = {
    hash,
    listingId,
    mime,
    size,
    label: String(spec.label || 'File').slice(0, 40),
    addedAt: spec.addedAt || new Date().toISOString(),
    salt
  };
  const hidden = options.incognito === true || (options.storage && incognitoOn(options.storage));
  if (hidden && options.approved !== true) {
    HOLD.set(hash, { ...record, bytes });
    return { ok: true, held: true, record: publicMedia(record) };
  }
  await store.put({ ...record, bytes });
  if (options.persist !== false && globalThis.navigator?.storage?.persist) {
    try { await navigator.storage.persist(); } catch { /* the files still stay for this visit */ }
  }
  return { ok: true, held: false, record: publicMedia(record) };
}

export async function approveHeld(store, hash) {
  const held = HOLD.get(hash);
  if (!held) return { ok: false, error: 'Nothing is waiting.' };
  HOLD.delete(hash);
  await store.put(held);
  return { ok: true, record: publicMedia(held) };
}

export async function getMedia(store, hash) {
  return (await store.get(hash)) || HOLD.get(hash) || null;
}

export async function listForListing(store, listingId) {
  const saved = await store.list(listingId);
  const held = [...HOLD.values()].filter((row) => row.listingId === listingId);
  return [...saved, ...held];
}

export async function removeMedia(store, hash) {
  HOLD.delete(hash);
  await store.remove(hash);
  return { ok: true };
}

export async function verifyFile(bytes, record) {
  if (!record?.salt || !record?.hash) return { ok: true, match: false, label: "Doesn't match" };
  const hash = await hashWithSalt(bytes, record.salt);
  const match = hash === record.hash;
  return { ok: true, match, label: match ? 'Matches' : "Doesn't match" };
}

export function normalizeMediaHashes(spec = {}) {
  const raw = spec.media ?? spec.file ?? spec.blob;
  if (raw instanceof Uint8Array || (raw && typeof raw === 'object' && raw.byteLength > 80)) {
    return { ok: false, error: 'Send the hash only. The file stays on the phone.' };
  }
  const incoming = Array.isArray(spec.mediaHashes) ? spec.mediaHashes : [];
  const rows = [];
  for (const item of incoming) {
    if (typeof item === 'string' && (item.startsWith('data:') || item.startsWith('blob:') || item.length > 80)) {
      return { ok: false, error: 'Send the hash only. The file stays on the phone.' };
    }
    const hash = String(item?.hash || '').toLowerCase();
    const mime = String(item?.mime || '');
    if (!/^[0-9a-f]{64}$/.test(hash) || mime.length > 80 || /data:|blob:/.test(mime)) {
      return { ok: false, error: 'Send the hash only. The file stays on the phone.' };
    }
    rows.push({ hash, mime: mime || 'application/octet-stream' });
  }
  const photoHash = String(spec.photoHash || '').toLowerCase();
  if (!rows.length && /^[0-9a-f]{64}$/.test(photoHash)) rows.push({ hash: photoHash, mime: 'image/jpeg' });
  if (rows.length > FILE_CAP) return { ok: false, error: 'Send the hash only. The file stays on the phone.' };
  return { ok: true, mediaHashes: rows };
}
