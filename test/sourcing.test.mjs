import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PICK_CAP, buildLinks, buildSearchUrl, capPicks, customSite, detectLocalAi, dueRequests, matchCriteria, presetsFor, suggestSites } from '../js/sourcing.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const listings = [
  { title: 'Schwinn 810 Treadmill', price: '$300', city: 'Chantilly, VA', category: 'exercise equipment' },
  { title: 'Folding Treadmill with Display Console', price: '$50', city: 'Washington, DC', category: 'exercise equipment' },
  { title: 'The Repair Extraordinaire', price: 'about $99/hr', city: 'Fairfax, VA', service: 'exercise equipment repair', category: 'exercise-equipment repair' },
  { title: 'Seattle bike', price: '$40', city: 'Seattle, WA', category: 'exercise equipment' }
];

test('local listings match keywords, price, and the DC radius before any outside link', () => {
  const hits = matchCriteria(listings, {
    category: 'exercise equipment',
    keywords: 'treadmill',
    location: 'Washington DC',
    radius: 25,
    maxPrice: 150
  });
  assert.deepEqual(hits.map((item) => item.title), ['Folding Treadmill with Display Console']);
  const repair = matchCriteria(listings, { category: 'exercise-equipment repair', keywords: 'repair', location: 'Washington DC', radius: 30 });
  assert.equal(repair[0].title, 'The Repair Extraordinaire');
  assert.equal(matchCriteria(listings, { keywords: 'bike', location: 'Washington DC', radius: 10 }).length, 0);
});

test('search links are built from the criteria and a custom https template', () => {
  const criteria = { category: 'exercise equipment', keywords: 'treadmill elliptical', location: 'Washington DC', radius: 25, maxPrice: 500 };
  const links = buildLinks(criteria, ['offerup', 'ebay']);
  assert.equal(links.length, 2);
  assert.equal(links[0].url.startsWith('https://offerup.com/search?q=treadmill%20elliptical'), true);
  assert.equal(links[1].url.includes('_udhi=500'), true);
  assert.equal(links.every((link) => link.contacted === false), true);
  assert.equal(buildSearchUrl('mailto:a@b.c?body={query}', criteria), '');
  const custom = customSite('Town board', 'https://example.com/search?q={query}&near={location}');
  assert.equal(custom.ok, true, custom.error);
  const extra = buildLinks(criteria, [custom.site.id], [custom.site]);
  assert.equal(extra[0].url, 'https://example.com/search?q=treadmill%20elliptical%20exercise%20equipment&near=Washington%20DC');
  assert.equal(customSite('Nope', 'http://example.com/?q={query}').ok, false);
  assert.equal(presetsFor('exercise-equipment repair').some((site) => site.id === 'thumbtack'), true);
});

test('daily picks stay at three per category', () => {
  const daily = JSON.parse(readFileSync(join(root, 'data/sourcing-daily.json'), 'utf8'));
  assert.equal(daily.updated, '2026-11-08');
  for (const row of daily.categories) assert.ok(row.picks.length <= PICK_CAP);
  assert.equal(daily.categories[0].picks.length, 3);
  assert.equal(daily.categories[0].picks.some((pick) => pick.title === 'Mauricio Rojas Services'), false);
  const capped = capPicks({
    updated: '2026-11-08',
    categories: [{ category: 'goods', request: 'tools', picks: [1, 2, 3, 4, 5] }]
  });
  assert.equal(capped.categories[0].picks.length, 3);
  assert.deepEqual(capped.categories[0].picks, [1, 2, 3]);
});

test('on-device AI detection falls back to preset sites and does not call out', async () => {
  const empty = await detectLocalAi({});
  assert.deepEqual(empty.labels, []);
  assert.equal(empty.canSuggest, false);
  assert.match(empty.note, /Preset site lists/);
  const gpuOnly = await detectLocalAi({ navigator: { gpu: {} } });
  assert.deepEqual(gpuOnly.labels, ['WebGPU']);
  assert.equal(gpuOnly.canSuggest, false);
  const ready = await detectLocalAi({
    LanguageModel: { availability: async () => 'available' },
    ai: {},
    navigator: { gpu: {} }
  });
  assert.equal(ready.canSuggest, true);
  assert.ok(ready.labels.includes('Chrome built-in language model'));
  assert.ok(ready.labels.includes('window.ai'));
  let called = 0;
  const opted = await suggestSites(
    { category: 'exercise equipment', keywords: 'treadmill' },
    { optedIn: true, detected: ready, prompt: async () => { called += 1; return 'Try eBay and OfferUp'; } }
  );
  assert.equal(called, 1);
  assert.equal(opted.source, 'on-device');
  assert.deepEqual(opted.siteIds.sort(), ['ebay', 'offerup']);
  const fallback = await suggestSites(
    { category: 'exercise-equipment repair', keywords: 'repair' },
    { optedIn: true, detected: ready, prompt: async () => { throw new Error('closed'); } }
  );
  assert.equal(fallback.source, 'presets');
  assert.ok(fallback.siteIds.includes('thumbtack'));
  const skipped = await suggestSites(
    { category: 'exercise equipment' },
    { optedIn: false, detected: ready, prompt: async () => { throw new Error('should not run'); } }
  );
  assert.equal(skipped.source, 'presets');
  const week = dueRequests([{ frequency: 'weekly', lastSeen: '2026-11-01T00:00:00.000Z' }], Date.parse('2026-11-08T00:00:00.000Z'));
  assert.equal(week.length, 1);
  assert.equal(dueRequests([{ frequency: 'off', lastSeen: '' }], Date.now()).length, 0);
});
