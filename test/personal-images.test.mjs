import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fittedSize } from '../js/health-tile-photo.mjs';
import { rememberPage } from '../js/health-page.mjs';
import { fallbackLayout } from '../js/health-layout.mjs';
import * as sim from '../js/p2p-exchange-sim.mjs';
import {
  IMAGE_SLOTS,
  PERSONAL_EDGE,
  choiceFor,
  exportPersonalVersion,
  resolveImage,
  slimImages,
  slotForListing,
  suggestBuiltin,
  visibleImages
} from '../js/personal-images.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
}

test('image choices stay on the device, follow one member, and export without a send', async () => {
  assert.equal(fittedSize(1600, 900, PERSONAL_EDGE).width <= PERSONAL_EDGE, true);
  const suggested = suggestBuiltin('a treadmill that needs repair');
  assert.equal(suggested.builtin, 'repair');
  assert.equal(suggested.sent, false);
  const banner = choiceFor('banner', { source: 'builtin', builtin: 'dumbbells' });
  const tile = choiceFor('tile-health', { source: 'suggest', builtin: suggested.builtin, note: 'treadmill repair' });
  const upload = choiceFor('background', { source: 'upload', dataUrl: 'data:image/webp;base64,abc', note: 'Your photo' });
  assert.equal(banner.ok && tile.ok && upload.ok, true);
  const images = { banner: banner.choice, 'tile-health': tile.choice, background: upload.choice };
  const mine = visibleImages({ memberId: 'jordan', images }, 'jordan');
  assert.equal(mine.banner.src.includes('dumbbells'), true);
  assert.equal(mine['tile-health'].src.includes('repair-extraordinaire'), true);
  assert.equal(mine.background.src.startsWith('data:image/'), true);
  const other = visibleImages({ memberId: 'jordan', images }, 'riley');
  assert.equal(other.banner.custom, false);
  assert.equal(other.banner.src.includes('jogger'), true);
  assert.equal(other.background.custom, false);
  const storage = memory();
  const saved = rememberPage(storage, {
    memberId: 'jordan',
    prompt: 'Easy version.',
    layout: fallbackLayout('easy', 'walk'),
    images
  });
  assert.equal(saved.hedera, false);
  assert.equal(JSON.stringify(saved.images).includes('data:image'), false);
  assert.equal(slimImages(images).background.dataUrl, undefined);
  const file = exportPersonalVersion({ memberId: 'jordan', confirmedAt: '2026-11-10T20:00:00.000Z', images });
  assert.equal(file.uploaded, false);
  assert.equal(file.hedera, false);
  assert.equal(file.images.background.dataUrl.startsWith('data:image/webp'), true);
  assert.equal(slotForListing({ id: 'ex-yoga', title: 'Yoga' }), 'thumb-ex-yoga');
  assert.equal(slotForListing({ title: 'The Repair Extraordinaire: equipment repair' }), 'thumb-repair');
  const store = sim.createMemoryStore();
  const created = await sim.createPeer(store, { id: 'alice', name: 'Alice', ...sim.DEMO_OPENING.alice, at: '2026-11-06T00:00:00.000Z' });
  assert.equal(created.ok, true, created.error);
  const alice = await store.get('alice');
  alice.healthPage = saved;
  const backup = await sim.exportBackup(alice, 'correct horse battery');
  assert.equal(backup.ok, true, backup.error);
  alice.privateKeyJwk = null;
  alice.healthPage = null;
  await store.set('alice', alice);
  const restored = await sim.importBackup(store, backup.backup, 'correct horse battery');
  assert.equal(restored.ok, true, restored.error);
  const back = await store.get('alice');
  assert.equal(back.healthPage.images.banner.source, 'builtin');
  assert.equal(JSON.stringify(back.healthPage).includes('data:image'), false);
  assert.equal(sim.toExport(back).healthPage.images['tile-health'].source, 'suggest');
  assert.equal(IMAGE_SLOTS.some((slot) => slot.id === 'banner'), true);
  const page = text('js/health-page.mjs');
  assert.equal(page.includes('Change image') || text('js/personal-images-ui.mjs').includes('Change image'), true);
  assert.equal(text('js/personal-images-ui.mjs').includes('Reset to default'), true);
  assert.equal(text('index.html').includes('data-image-slot="banner"'), true);
});
