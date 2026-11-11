import { acceptsPhoto, fittedSize } from './health-tile-photo.mjs';

export const PERSONAL_EDGE = 800;
export const PAGE_DB = 'lgme-health-page';
export const PAGE_STORE = 'pages';

const photo = (name) => `/images/photos/${name}-640.webp`;

export const BUILTINS = Object.freeze([
  { id: 'jogger', src: photo('jogger'), label: 'Park jog', alt: 'A person jogging away along a tree-lined park path', words: ['jog', 'run', 'park', 'path', 'walk'] },
  { id: 'stretch', src: photo('stretch'), label: 'Stretch on the grass', alt: 'An adult stretching on the grass', words: ['stretch', 'yoga', 'grass', 'flex'] },
  { id: 'neighborhood', src: photo('neighborhood'), label: 'Neighborhood path', alt: 'A quiet path through pines', words: ['neighbor', 'pine', 'quiet', 'tree', 'path'] },
  { id: 'shop-street', src: photo('shop-street'), label: 'City walk', alt: 'Adults walking together on a city street', words: ['city', 'street', 'people', 'group', 'walk'] },
  { id: 'volunteers', src: photo('volunteers'), label: 'Neighbors working', alt: 'Neighbors working together outdoors', words: ['volunteer', 'community', 'together', 'work', 'neighbor'] },
  { id: 'dumbbells', src: photo('dumbbells'), label: 'Dumbbells', alt: 'A rack of dumbbells', words: ['dumbbell', 'strength', 'weight', 'gym', 'lift'] },
  { id: 'market', src: photo('market'), label: 'Market stall', alt: 'A market vendor hands a bag of goods to a buyer at a covered stall in Antibes', words: ['market', 'stall', 'vendor', 'buyer', 'antibes'] },
  { id: 'repair', src: '/assets/img/repair-extraordinaire.webp', label: 'Repair Extraordinaire', alt: 'Person exercising on a treadmill: The Repair Extraordinaire, equipment repair', words: ['repair', 'treadmill', 'equipment', 'fix'] }
]);

function slot(id, label, group, builtin) {
  const picture = BUILTINS.find((item) => item.id === builtin);
  return { id, label, group, defaultSrc: picture.src, alt: picture.alt };
}

export const IMAGE_SLOTS = Object.freeze([
  slot('banner', 'Banner', 'Banner', 'jogger'),
  slot('tile-health', 'Health', 'Category tiles', 'stretch'),
  slot('tile-campus', 'Campus', 'Category tiles', 'volunteers'),
  slot('tile-neighbor', 'Neighbor help', 'Category tiles', 'neighborhood'),
  slot('tile-hosts', 'Hosts', 'Category tiles', 'shop-street'),
  slot('tile-circles', 'Circles', 'Category tiles', 'stretch'),
  slot('tile-stories', 'Stories', 'Category tiles', 'jogger'),
  slot('tile-exchange', 'Exchange', 'Category tiles', 'dumbbells'),
  slot('thumb-ex-strength', 'Strength session', 'Listing thumbnails', 'dumbbells'),
  slot('thumb-ex-running', 'Running plan', 'Listing thumbnails', 'jogger'),
  slot('thumb-ex-yoga', 'Yoga and stretch', 'Listing thumbnails', 'stretch'),
  slot('thumb-ex-plan', 'Home workout plan', 'Listing thumbnails', 'neighborhood'),
  slot('thumb-ex-motivation', 'Motivation talk', 'Listing thumbnails', 'shop-street'),
  slot('thumb-ex-seniors', 'Seniors mobility', 'Listing thumbnails', 'shop-street'),
  slot('thumb-ex-bike', 'Bike tune', 'Listing thumbnails', 'neighborhood'),
  slot('thumb-ex-loan', 'Equipment loan', 'Listing thumbnails', 'dumbbells'),
  slot('thumb-ex-walk', 'Walking group', 'Listing thumbnails', 'jogger'),
  slot('thumb-ex-repair', 'Repair listing', 'Listing thumbnails', 'repair'),
  slot('thumb-pool', 'Membership fee pool', 'Listing thumbnails', 'volunteers'),
  slot('thumb-repair', 'Repair Extraordinaire', 'Listing thumbnails', 'repair'),
  slot('header-exchange', 'Exchange header', 'Card headers', 'market'),
  slot('header-help', 'Help header', 'Card headers', 'jogger'),
  slot('header-disclaimer', 'Disclaimer header', 'Card headers', 'neighborhood'),
  slot('header-pool', 'Pool card', 'Card headers', 'volunteers'),
  slot('header-repair', 'Repair card', 'Card headers', 'repair'),
  slot('background', 'Page background', 'Background', 'neighborhood')
]);

export function builtinById(id) {
  return BUILTINS.find((item) => item.id === id) || null;
}

export function slotById(id) {
  return IMAGE_SLOTS.find((item) => item.id === id) || null;
}

export function pageStorageKey(memberId) {
  return `lgme.health.page:${memberId || 'this-phone'}`;
}

export function viewerId(storage) {
  try {
    return storage?.getItem?.('lgme-gym.seat') || storage?.getItem?.('lgme.seat') || '';
  } catch {
    return '';
  }
}

export function slimImages(images) {
  const out = {};
  for (const [id, choice] of Object.entries(images || {})) {
    if (!choice || choice.source === 'default' || !slotById(id)) continue;
    out[id] = {
      source: choice.source === 'upload' || choice.source === 'suggest' ? choice.source : 'builtin',
      builtin: choice.source === 'upload' ? '' : (choice.builtin || ''),
      note: String(choice.note || '').slice(0, 160)
    };
  }
  return out;
}

export function suggestBuiltin(description) {
  const text = String(description || '').toLowerCase();
  if (!text.trim()) return { ok: false, error: 'Describe a picture first.' };
  let best = BUILTINS[0];
  let score = 0;
  for (const item of BUILTINS) {
    const hit = item.words.filter((word) => text.includes(word)).length;
    if (hit > score) {
      best = item;
      score = hit;
    }
  }
  const sentence = score
    ? `Suggested ${best.label}. ${best.alt}`
    : `No close match in the licensed set. Suggested ${best.label}. ${best.alt}`;
  return { ok: true, builtin: best.id, src: best.src, alt: best.alt, sentence, onDevice: true, sent: false };
}

export function choiceFor(slotId, spec = {}) {
  if (!slotById(slotId)) return { ok: false, error: 'That picture slot is not on this page.' };
  const source = spec.source || 'default';
  if (source === 'default') return { ok: true, choice: null };
  if (source === 'upload') {
    const dataUrl = String(spec.dataUrl || '');
    if (!dataUrl.startsWith('data:image/')) return { ok: false, error: 'The photo stayed on this phone, but it could not be saved.' };
    return { ok: true, choice: { source: 'upload', builtin: '', note: String(spec.note || 'Your photo').slice(0, 160), dataUrl } };
  }
  const built = builtinById(spec.builtin);
  if (!built) return { ok: false, error: 'Pick a picture from the licensed set.' };
  return {
    ok: true,
    choice: {
      source: source === 'suggest' ? 'suggest' : 'builtin',
      builtin: built.id,
      note: String(spec.note || '').slice(0, 160)
    }
  };
}

export function resolveImage(slotId, images, ownerId, viewer) {
  const slot = slotById(slotId);
  const fallback = { src: slot?.defaultSrc || '', alt: slot?.alt || '', custom: false };
  if (!slot || !ownerId || ownerId !== viewer) return fallback;
  const choice = images?.[slotId];
  if (!choice || choice.source === 'default') return fallback;
  if (choice.source === 'upload' && String(choice.dataUrl || '').startsWith('data:image/')) {
    return { src: choice.dataUrl, alt: choice.note || slot.alt, custom: true };
  }
  const built = builtinById(choice.builtin);
  if (!built) return fallback;
  return { src: built.src, alt: built.alt, custom: true };
}

export function visibleImages(record, viewer) {
  const ownerId = record?.memberId || '';
  const out = {};
  for (const slot of IMAGE_SLOTS) out[slot.id] = resolveImage(slot.id, record?.images, ownerId, viewer);
  return out;
}

export function exportPersonalVersion(record) {
  const images = {};
  for (const [id, choice] of Object.entries(record?.images || {})) {
    if (!slotById(id) || !choice || choice.source === 'default') continue;
    images[id] = {
      source: choice.source,
      builtin: choice.builtin || '',
      note: choice.note || '',
      ...(choice.dataUrl ? { dataUrl: choice.dataUrl } : {})
    };
  }
  return {
    kind: 'personal-version',
    memberId: record?.memberId || 'this-phone',
    confirmedAt: record?.confirmedAt || '',
    images,
    hedera: false,
    uploaded: false
  };
}

export function slotForListing(item = {}) {
  const id = String(item.id || '');
  if (slotById(`thumb-${id}`)) return `thumb-${id}`;
  if (/repair extraordinaire/i.test(item.title || '')) return 'thumb-repair';
  if (/membership fee pool/i.test(item.title || '')) return 'thumb-pool';
  return '';
}

function openPages() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { resolve(null); return; }
    const request = indexedDB.open(PAGE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(PAGE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readPageRecord(memberId) {
  const db = await openPages();
  if (!db) return null;
  const saved = await new Promise((resolve, reject) => {
    const read = db.transaction(PAGE_STORE).objectStore(PAGE_STORE).get(pageStorageKey(memberId));
    read.onsuccess = () => resolve(read.result || null);
    read.onerror = () => reject(read.error);
  });
  db.close();
  return saved;
}

export async function loadPersonalImages(memberId, storage) {
  const key = pageStorageKey(memberId);
  let slim = null;
  try { slim = JSON.parse(storage?.getItem?.(key) || 'null'); } catch { slim = null; }
  let full = null;
  try { full = await readPageRecord(memberId); } catch { full = null; }
  return {
    memberId: memberId || 'this-phone',
    images: full?.images || slim?.images || {},
    layout: full?.layout || slim?.layout || null,
    confirmedAt: full?.confirmedAt || slim?.confirmedAt || ''
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function preparePersonalImage(file, documentRef = globalThis.document) {
  const gate = acceptsPhoto(file);
  if (!gate.ok) return gate;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = fittedSize(bitmap.width, bitmap.height, PERSONAL_EDGE);
  if (size.width > PERSONAL_EDGE || size.height > PERSONAL_EDGE) {
    bitmap.close?.();
    return { ok: false, error: 'That photo could not be resized on this phone.' };
  }
  const canvas = documentRef.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#efe8dc';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close?.();
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.72));
  if (!blob) blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
  if (!blob) return { ok: false, error: 'That photo could not be saved on this phone.' };
  const dataUrl = await blobToDataUrl(blob);
  return { ok: true, blob, dataUrl, width: size.width, height: size.height, type: blob.type };
}
