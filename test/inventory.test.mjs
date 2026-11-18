import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchPrompt } from '../js/local-ai-panel.mjs';
import { applyImport, filterItems, groupItems, previewCsv, readLink, saveLink, sortItems, toBigcapitalCsv, toHomeboxCsv } from '../js/inventory.mjs';
import { saveItem } from '../js/ihavit.mjs';

function memory() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('inventory CSV stays on the phone until OK', () => {
  const storage = memory();
  saveItem(storage, { name: 'Bike', category: 'bike', location: 'Shed', quantity: 2, price: '100', purchased: '2024-01-01', condition: 'good', plan: 'sell' }, true);
  saveItem(storage, { name: 'Lamp', category: 'home', location: 'Shed', quantity: 1, price: '20', purchased: '2023-01-01', condition: 'fair' }, true);
  const home = toHomeboxCsv([{ name: 'Bike', quantity: 2, notes: 'blue', location: 'Shed', price: '100', purchased: '2024-01-01', id: 'b1' }]);
  assert.match(home, /HB\.name/);
  assert.match(toBigcapitalCsv([{ name: 'Bike', id: 'b1', price: '100', category: 'bike', quantity: 2, purchased: '2024-01-01', condition: 'good' }]), /Item Name/);
  const preview = previewCsv(home);
  assert.equal(preview.ok, true);
  assert.equal(preview.rows[0].name, 'Bike');
  assert.equal(applyImport(storage, preview.rows, false).ok, false);
  const before = storage.getItem('lgme.ihavit.items');
  assert.equal(before.includes('Lamp'), true);
  const sorted = sortItems([{ name: 'Lamp' }, { name: 'Bike' }], 'name');
  assert.equal(sorted[0].name, 'Bike');
  const groups = groupItems([{ name: 'Bike', location: 'Shed', category: 'bike' }, { name: 'Lamp', location: 'Shed', category: 'home' }], 'location');
  assert.equal(groups[0][0], 'Shed');
  assert.equal(groups[0][1].length, 2);
  assert.equal(filterItems([{ name: 'Bike', category: 'bike', location: '', notes: '' }], { query: 'bike' }).length, 1);
  assert.equal(saveLink(storage, { homeboxUrl: 'https://home.example' }, false).ok, false);
  assert.equal(saveLink(storage, { homeboxUrl: 'https://home.example', homeboxToken: 'secret' }, true).called, false);
  assert.equal(readLink(storage).enabled, false);
  assert.equal(matchPrompt('open inventory').kind, 'inventory');
  const source = readFileSync(new URL('../js/inventory.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('fetch('), false);
  const page = readFileSync(new URL('../inventory.html', import.meta.url), 'utf8');
  assert.match(page, /Debit = you owe/);
  assert.match(page, /href="\/homebox"/);
  assert.match(page, /href="\/bigcapital"/);
  assert.match(readFileSync(new URL('../homebox.html', import.meta.url), 'utf8'), /What works now/);
  assert.match(readFileSync(new URL('../bigcapital.html', import.meta.url), 'utf8'), /What works now/);
});
