import test from 'node:test';
import assert from 'node:assert/strict';
import { addMedia, freshSalt, hashWithSalt, memoryMediaStore, normalizeMediaHashes, stripExif, verifyFile } from '../js/listing-media.mjs';
import { publicExchangeListing, seedPayload, SEED_LISTINGS } from '../js/exchange-listing.mjs';

test('listing files stay on the phone as salted hashes', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const salt = 'abcd';
  const first = await hashWithSalt(bytes, salt);
  const again = await hashWithSalt(bytes, salt);
  assert.equal(first, again);
  assert.notEqual(first, await hashWithSalt(bytes, freshSalt()));
  const store = memoryMediaStore();
  const held = await addMedia(store, { listingId: 'draft', bytes, mime: 'text/plain', label: 'Manual', size: 4 }, { incognito: true, salt, prepare: false });
  assert.equal(held.held, true);
  assert.equal((await store.list('draft')).length, 0);
  const raw = publicExchangeListing({ ...seedPayload(SEED_LISTINGS[0]), mediaHashes: ['data:image/png;base64,aaaa'] });
  assert.equal(raw.ok, false);
  assert.equal(raw.error, 'Send the hash only. The file stays on the phone.');
  const legacy = publicExchangeListing({ ...seedPayload(SEED_LISTINGS[0]), photoHash: first });
  assert.equal(legacy.ok, true);
  assert.deepEqual(legacy.body.mediaHashes, [{ hash: first, mime: 'image/jpeg' }]);
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return { drawImage() {} }; },
    toBlob(done) { done(new Blob([new Uint8Array([9])], { type: 'image/jpeg' })); }
  };
  const stripped = await stripExif({ type: 'image/jpeg', size: 20 }, {
    createImageBitmap: async () => ({ width: 2, height: 2, close() {} }),
    document: { createElement: () => canvas }
  });
  assert.equal(stripped.stripped, true);
  assert.notEqual(stripped.blob, undefined);
  const saved = await addMedia(store, { listingId: 'draft', bytes, mime: 'text/plain', label: 'Receipt', size: 4 }, { incognito: true, approved: true, salt, prepare: false });
  const record = await store.get(saved.record.hash);
  assert.equal((await verifyFile(bytes, record)).label, 'Matches');
  assert.equal((await verifyFile(new Uint8Array([9]), record)).label, "Doesn't match");
  assert.equal(normalizeMediaHashes({ photoHash: first }).mediaHashes.length, 1);
});
