import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryReport, personalReport, readPersonalBook } from '../js/health-dashboard.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const now = Date.parse('2026-11-11T00:00:00Z');
const day = 86400000;

test('the category report keeps test and real apart and hides people', () => {
  const listings = [
    { sequenceNumber: 1, consensusTimestamp: String((now - day) / 1000), item: { id: 'hx-walk', kind: 'listing', group: 'health', service: 'walk', side: 'offer', status: 'Test item - unclaimed', durationMin: 60 } },
    { sequenceNumber: 2, consensusTimestamp: String((now - 2 * day) / 1000), item: { id: 'ex-repair', kind: 'listing', group: 'health', service: 'repair', side: 'offer', status: 'Claimed by trainer', durationMin: 60 } },
    { sequenceNumber: 3, consensusTimestamp: String((now - day) / 1000), item: { id: 'hx-breath', kind: 'listing', group: 'health', service: 'mental', side: 'offer', status: 'Test item - declined', durationMin: 30 } }
  ];
  const report = categoryReport(listings, { span: 'day', now });
  assert.equal(report.test, 2);
  assert.equal(report.real, 1);
  assert.equal(report.hours, 2.5);
  assert.equal(report.usd, 0);
  assert.equal(report.timing.listedToMatched, null);
  assert.equal(JSON.stringify(report).includes('trainer'), false);
  assert.equal(JSON.stringify(report).includes('mina'), false);
  const dashboard = readFileSync(join(root, 'js/health-dashboard.mjs'), 'utf8');
  const ui = readFileSync(join(root, 'js/exchange-overview-ui.mjs'), 'utf8');
  assert.equal(dashboard.includes('fetch('), false);
  assert.equal(ui.includes('readPersonalBook'), true);
  assert.equal(ui.includes('lgme.health.book'), false);
});

test('a personal book stays on the device and is hidden until a seat is saved', () => {
  const storage = { values: {}, getItem(key) { return this.values[key] || null; }, setItem(key, value) { this.values[key] = value; } };
  assert.equal(readPersonalBook(storage), null);
  storage.setItem('lgme-gym.seat', 'mina-vale');
  storage.setItem('lgme.health.book', JSON.stringify({
    handle: 'mina-vale',
    sessions: [{ id: 's1', at: new Date(now - day).toISOString(), side: 'offer', minutes: 45, status: 'Test item - receipt', activity: 'Walking group', credit: 2, attestations: 1 }]
  }));
  const book = readPersonalBook(storage);
  const report = personalReport(book, { span: 'day', now });
  assert.equal(report.private, true);
  assert.equal(report.offers, 1);
  assert.equal(report.hours, 0.8);
  assert.equal(report.receipts, 1);
  assert.equal(report.attestations, 1);
  assert.equal(report.credit, 2);
});
