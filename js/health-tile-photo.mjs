export const TILE_DB = 'lgme-tile-photo';
export const TILE_STORE = 'photos';
export const TILE_KEY = 'health';
export const MAX_EDGE = 1280;
export const JPEG_QUALITY = 0.72;
export const MAX_BYTES = 12 * 1024 * 1024;

export function fittedSize(width, height, maxEdge = MAX_EDGE) {
  const wide = Number(width);
  const high = Number(height);
  if (!Number.isFinite(wide) || !Number.isFinite(high) || wide < 1 || high < 1) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(wide, high));
  return { width: Math.max(1, Math.round(wide * scale)), height: Math.max(1, Math.round(high * scale)) };
}

export function acceptsPhoto(file) {
  const type = String(file?.type || '');
  if (!type.startsWith('image/')) return { ok: false, error: 'Choose a photo.' };
  if (Number(file.size) > MAX_BYTES) return { ok: false, error: 'That photo is too large for this phone.' };
  return { ok: true };
}

export async function preparePhoto(file, documentRef = globalThis.document) {
  const gate = acceptsPhoto(file);
  if (!gate.ok) return gate;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = fittedSize(bitmap.width, bitmap.height);
  const canvas = documentRef.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#1a1408';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) return { ok: false, error: 'That photo could not be saved on this phone.' };
  return { ok: true, blob, width: size.width, height: size.height };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(TILE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTilePhoto(blob, key = TILE_KEY) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const write = db.transaction(TILE_STORE, 'readwrite').objectStore(TILE_STORE).put(blob, key);
    write.onsuccess = () => resolve();
    write.onerror = () => reject(write.error);
  });
  db.close();
}

export async function loadTilePhoto(key = TILE_KEY) {
  const db = await openDb();
  const blob = await new Promise((resolve, reject) => {
    const read = db.transaction(TILE_STORE).objectStore(TILE_STORE).get(key);
    read.onsuccess = () => resolve(read.result || null);
    read.onerror = () => reject(read.error);
  });
  db.close();
  return blob instanceof Blob ? blob : null;
}

export async function removeTilePhoto() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const drop = db.transaction(TILE_STORE, 'readwrite').objectStore(TILE_STORE).delete(TILE_KEY);
    drop.onsuccess = () => resolve();
    drop.onerror = () => reject(drop.error);
  });
  db.close();
}

let shownUrl = '';

function paint(tile, url) {
  if (shownUrl) URL.revokeObjectURL(shownUrl);
  shownUrl = url || '';
  if (url) {
    tile.style.backgroundImage = `url("${url}")`;
    tile.classList.add('has-photo');
    document.getElementById('health-photo-remove')?.removeAttribute('hidden');
  } else {
    tile.style.removeProperty('background-image');
    tile.classList.add('has-photo');
    document.getElementById('health-photo-remove')?.setAttribute('hidden', '');
  }
}

function say(text) {
  const node = document.getElementById('health-photo-status');
  if (node) node.textContent = text || '';
}

async function showStored(tile) {
  const blob = await loadTilePhoto();
  if (!blob) return;
  paint(tile, URL.createObjectURL(blob));
}

export function mountHealthTile(documentRef = globalThis.document) {
  const tile = documentRef.getElementById('health-tile');
  const input = documentRef.getElementById('health-photo');
  const remove = documentRef.getElementById('health-photo-remove');
  if (!tile || !input || !remove) return;
  showStored(tile).catch(() => say('The saved photo could not be opened.'));
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const prepared = await preparePhoto(file, documentRef).catch(() => ({ ok: false, error: 'That photo could not be read on this phone.' }));
    if (!prepared.ok) { say(prepared.error); return; }
    try {
      await saveTilePhoto(prepared.blob);
      paint(tile, URL.createObjectURL(prepared.blob));
      say('Saved on this phone. It is not uploaded.');
    } catch {
      say('This phone could not store the photo.');
    }
  });
  remove.addEventListener('click', async () => {
    try { await removeTilePhoto(); } catch { /* the picture still leaves the tile */ }
    paint(tile, '');
    say('Photo removed.');
  });
}

if (globalThis.document?.getElementById) mountHealthTile();
