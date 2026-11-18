import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commitAnchor, previewAnchor, readChoices, setChoice } from '../js/hedera-choices.mjs';

function memory() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('Hedera choices anchor a testnet hash only after OK', async () => {
  const storage = memory();
  const choices = readChoices(storage);
  assert.equal(choices.ididit, true);
  assert.equal(choices.ledger, false);
  assert.equal(choices.donation, false);
  assert.equal(setChoice(storage, 'ididit', false, true).choices.ididit, true);
  assert.equal(setChoice(storage, 'ledger', true, false).ok, false);
  assert.equal(setChoice(storage, 'ledger', true, true).choices.ledger, true);
  const preview = await previewAnchor('ledger', { id: 'journal', name: 'Ada', photo: 'pic' });
  assert.equal(preview.network, 'testnet');
  assert.equal(preview.text.includes('Ada'), false);
  assert.equal(preview.text.includes('pic'), false);
  assert.match(preview.href, /^https:\/\/hashscan\.io\/testnet\//);
  assert.equal(commitAnchor(storage, preview, true, { incognito: true }).ok, false);
  assert.equal(commitAnchor(storage, preview, false, { incognito: false }).ok, false);
  const kept = commitAnchor(storage, preview, true, { incognito: false });
  assert.equal(kept.ok, true);
  assert.equal(kept.badge.label, 'On Hedera');
  const off = await previewAnchor('donation', { id: 'gift' });
  assert.equal(commitAnchor(storage, off, true, { incognito: false }).ok, false);
  const source = readFileSync(new URL('../js/hedera-choices.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('mainnet'), false);
  assert.equal(source.includes('fetch('), false);
});
