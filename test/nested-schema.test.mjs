import test from 'node:test';
import assert from 'node:assert/strict';
import { check, gymCardSchema, repairConfirmsSchema, repairDetailsSchema, repairRequestSchema } from '../js/input-schema.mjs';
import { publicProgressCard } from '../js/gym-progress.mjs';
import { publicRepairDetails } from '../js/repair-follow.mjs';

const card = { handle: 'Ada', category: 'Miles', number: 12, unit: 'mi', week: '2026-11-10', selfReported: true, example: false, line: 'Ada covered 12 miles this week' };

test('gym cards and repair bodies reject unknown nested keys and bad ranges', () => {
  assert.equal(publicProgressCard(card).ok, true);
  assert.equal(publicProgressCard({ ...card, lat: 1 }).ok, false);
  assert.equal(publicProgressCard({ ...card, note: 'secret' }).ok, false);
  assert.equal(publicProgressCard({ ...card, number: -1 }).ok, false);
  assert.equal(publicProgressCard({ ...card, number: 100001 }).ok, false);
  assert.equal(publicProgressCard({ ...card, number: Number.NaN }).ok, false);
  assert.equal(publicProgressCard({ ...card, week: '11/10/2026' }).ok, false);
  assert.equal(publicProgressCard({ ...card, handle: 'a'.repeat(41) }).ok, false);
  assert.equal(publicProgressCard({ ...card, line: '<script>' }).ok, false);
  assert.equal(check({ ...card, extra: true }, gymCardSchema, 'card').ok, false);

  const details = { item: 'treadmill', brandModel: 'ProForm 505', symptom: 'stops after a minute', tried: 'the reset button' };
  assert.equal(check(details, repairDetailsSchema, 'details').ok, true);
  assert.equal(check({ ...details, photo: 'abc' }, repairDetailsSchema, 'details').ok, false);
  assert.equal(check({ ...details, symptom: 4 }, repairDetailsSchema, 'details').ok, false);
  assert.equal(check({ ...details, item: '' }, repairDetailsSchema, 'details').ok, false);
  assert.equal(check({ ...details, tried: 'x'.repeat(161) }, repairDetailsSchema, 'details').ok, false);
  const shared = publicRepairDetails({ share: true, ...details });
  assert.equal(shared.ok, true);
  assert.equal(publicRepairDetails({ share: true, ...details, admin: true }).ok, false);

  const request = {
    handle: 'mina', action: 'repair-request', origin: 'health', offerId: 'repair-extraordinaire',
    share: true, ...details, at: '2026-11-10T20:00:00.000Z'
  };
  assert.equal(check(request, repairRequestSchema, 'repair').ok, true);
  assert.equal(check({ ...request, email: 'a@b.co' }, repairRequestSchema, 'repair').ok, false);
  assert.equal(check({ member: { handle: 'mina', amount: 40 }, sneaky: 1 }, repairConfirmsSchema, 'confirms').ok, false);
  assert.equal(check({ member: { handle: 'mina', amount: -2 } }, repairConfirmsSchema, 'confirms').ok, false);
  assert.equal(check({ member: { handle: 'mina', amount: 40 } }, repairConfirmsSchema, 'confirms').ok, true);
});
