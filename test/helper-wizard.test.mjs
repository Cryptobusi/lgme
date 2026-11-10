import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFields, makeHelperKey, openText, publicHelper, sealText, summaryCard } from '../js/helper-wizard.mjs';
import { saveHelper } from '../js/helper-store.mjs';

test('the offline helper drafts fields and keeps the member words sealed', async () => {
  const fields = extractFields('I can coach sessions. I also prep meals. My goal is 3 sessions a week. 2 hours. 8 a month.');
  assert.equal(fields.primary.includes('coach'), true);
  assert.equal(fields.secondary.includes('prep'), true);
  assert.equal(fields.hours, '2');
  assert.equal(fields.monthly, '8');
  assert.equal(fields.goals.includes('3 sessions'), true);
  assert.equal(fields.signature, undefined);
  const card = summaryCard({ name: 'Gym buddy', engineLabel: 'Offline helper', terms: { remind: true, summarize: true, frequency: 'Once a day', quietStart: '21:00', quietEnd: '07:00' } });
  assert.equal(card.does.includes('Remind'), true);
  assert.equal(card.sends, undefined);
  const key = await makeHelperKey();
  const sealed = await sealText('my private words', key);
  assert.equal(JSON.stringify(sealed).includes('my private words'), false);
  assert.equal(await openText(sealed, key), 'my private words');
  const memory = { item: null, getItem() { return this.item; }, setItem(keyName, value) { this.item = value; } };
  let savedKey = null;
  await saveHelper({ name: 'Gym buddy', engine: 'rules', engineLabel: 'Offline helper', words: 'secret plan', terms: { remind: true, frequency: 'Once a day', quietStart: '21:00', quietEnd: '07:00' }, fields }, memory, { async getOrCreate() { savedKey = savedKey || await makeHelperKey(); return savedKey; } });
  const stored = JSON.parse(memory.item);
  assert.equal(stored.name, 'Gym buddy');
  assert.equal(JSON.stringify(stored).includes('secret plan'), false);
  assert.equal(publicHelper({ name: 'Gym buddy', engineLabel: 'Offline helper', terms: {} }).mints, false);
});
