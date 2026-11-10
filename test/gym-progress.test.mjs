import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardCards, chooseProgress, manualEntry, progressRows, publicProgressCard, sharePreview } from '../js/gym-progress.mjs';
import * as sim from '../js/p2p-exchange-sim.mjs';
import { seedDemoClub } from '../js/gym-demo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');
const now = new Date('2026-11-10T15:00:00.000Z');

test('a member picks 3 to 5 categories and the share card has no location', () => {
  assert.equal(chooseProgress({ kinds: ['miles', 'minutes'] }).ok, false);
  assert.equal(chooseProgress({ kinds: ['miles', 'minutes', 'sessions', 'calories', 'verified', 'health'] }).ok, false);
  const chosen = chooseProgress({ kinds: ['miles', 'minutes', 'sessions', 'health'], allowGps: true, customName: 'Push-ups', customUnit: 'reps' });
  assert.equal(chosen.ok, true);
  assert.equal(chosen.progress.share.health, 'me');
  assert.equal(chosen.progress.custom.name, 'Push-ups');
  const ada = {
    id: 'ada',
    name: 'Ada',
    gymProgress: {
      chosen: ['sessions'],
      share: { sessions: 'board' },
      manual: [],
      allowGps: false
    },
    exerciseSessions: { a: { sessionId: 'a', day: '2026-11-10', durationSec: 60, sensors: [], evidence: 'phone-recorded (unverified)' } }
  };
  const sam = {
    id: 'sam',
    name: 'Sam',
    example: true,
    gymProgress: {
      ...chosen.progress,
      share: { miles: 'board', minutes: 'me', sessions: 'me', health: 'me', custom: 'me' },
      manual: [{ kind: 'miles', value: 12, at: now.toISOString(), source: 'example' }]
    },
    exerciseSessions: {
      a: { sessionId: 'a', day: '2026-11-10', durationSec: 1200, sensors: ['gps'], evidence: 'phone-recorded + verified by trainer/group member' }
    },
    exercisePrivate: { a: { bundle: { points: [{ lat: 38.9, lon: -77 }, { lat: 38.91, lon: -77 }], photos: ['secret-photo'] } } }
  };
  const miles = progressRows(sam, now).find((row) => row.id === 'miles');
  assert.equal(miles.current > 12, true);
  assert.equal(miles.change, miles.current);
  const preview = sharePreview(sam, miles);
  const raw = JSON.stringify(preview);
  assert.equal(raw.includes('38.9'), false);
  assert.equal(raw.includes('secret-photo'), false);
  assert.equal(raw.includes('Hedera'), false);
  assert.deepEqual(Object.keys(preview).sort(), ['category', 'example', 'handle', 'line', 'number', 'selfReported', 'unit', 'week']);
  assert.equal(manualEntry({ kind: 'health', energy: 11, mood: 5, sleep: 5 }).ok, false);
  sam.gymProgress.manual.push(manualEntry({ kind: 'health', energy: 7, mood: 6, sleep: 8, at: now.toISOString() }).entry);
  const meter = progressRows(sam, now).find((row) => row.id === 'health');
  assert.equal(meter.current, 7);
  assert.equal(meter.selfReported, true);
  const cards = boardCards([ada, sam], now);
  assert.deepEqual(cards.map((card) => card.handle), ['Ada', 'Sam']);
  assert.equal(text('help.html').includes('My progress stays on this phone'), true);
  assert.equal(text('glossary.html').includes('Health meter'), true);
  assert.equal(text('glossary.html').includes('My progress'), true);
  assert.equal(text('sw.js').includes('lgme-v99'), true);
  const shared = publicProgressCard({ ...preview, lat: 38.9, photos: ['x'] });
  assert.equal(shared.ok, false);
  const clean = publicProgressCard(preview);
  assert.equal(clean.ok, true);
  assert.equal(clean.card.lat, undefined);
  assert.equal(clean.card.hedera, false);
});

test('the example club can show Sam walking 12 miles', async () => {
  const store = sim.createMemoryStore();
  const seeded = await seedDemoClub(store);
  assert.equal(seeded.ok, true, seeded.error);
  const sam = await store.get('sam');
  const miles = progressRows(sam, new Date()).find((row) => row.id === 'miles');
  assert.equal(miles.current, 12);
  assert.equal(miles.share, 'board');
  const card = boardCards([sam], new Date())[0];
  assert.equal(card.example, true);
  assert.equal(card.line.includes('12'), true);
  assert.equal(JSON.stringify(card).includes('lat'), false);
});
