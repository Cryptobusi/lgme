import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { equipmentReferral, holdFromChat } from '../js/equipment-referral.mjs';
import { OFFER_TITLE, publicRepairFeed, repairWrite, suggestRepairRate } from '../js/repair-follow.mjs';
import { VIEW_ONLY_MESSAGE } from '../js/view-only-api.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');
const SAMPLE = 'My ProForm 505 treadmill is broken. It stops after a minute. I already tried the reset button.';

test('an equipment question fills a referral card and another question does not', () => {
  const card = equipmentReferral(SAMPLE);
  assert.equal(card.equipment, true);
  assert.equal(card.sent, false);
  assert.equal(card.guarantee, false);
  assert.equal(card.details.item, 'treadmill');
  assert.equal(card.details.brandModel, 'ProForm 505');
  assert.match(card.details.symptom, /stops after a minute/);
  assert.match(card.details.tried, /reset button/);
  assert.match(card.text, /Contact The Repair Extraordinaire directly/);
  assert.match(card.text, /tcare4me@gmail.com/);
  assert.match(card.mailto, /^mailto:tcare4me@gmail.com\?/);
  const body = decodeURIComponent(card.mailto);
  assert.match(body, /ProForm 505/);
  assert.match(body, /reset button/);
  assert.equal(body.includes('data:image'), false);
  assert.match(card.thumbtack, /thumbtack\.com/);
  assert.match(decodeURIComponent(card.thumbtack), /The Repair Extraordinaire/);
  assert.match(card.note, /not an lgme guarantee/);
  assert.equal(card.disclaimer, '/disclaimer');
  const other = equipmentReferral('How is my mood this week?');
  assert.equal(other.equipment, false);
  assert.equal(holdFromChat('Help me set up a group chat').send, true);
  assert.equal(holdFromChat(SAMPLE).send, false);
});

test('a Health request creates the Exchange item, status updates, and other writes stay refused', async () => {
  const state = { members: {}, repairs: [] };
  const mina = await generateDeviceKey();
  const provider = await generateDeviceKey();
  const payload = {
    handle: 'mina',
    action: 'repair-request',
    origin: 'health',
    offerId: 'repair-extraordinaire',
    share: true,
    item: 'treadmill',
    brandModel: 'ProForm 505',
    symptom: 'stops after a minute',
    tried: 'the reset button',
    at: '2026-11-10T20:00:00.000Z'
  };
  const opened = await repairWrite(state, { handle: 'mina', publicJwk: mina.publicJwk, payload, sig: await signDevice(mina.privateJwk, payload) });
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.sent, false);
  assert.equal(opened.item.status, 'requested');
  assert.equal(opened.item.origin, 'health');
  assert.equal(opened.item.offerTitle, OFFER_TITLE);
  assert.equal(opened.item.details.brandModel, 'ProForm 505');
  assert.equal(JSON.stringify(opened.item).includes('data:image'), false);
  assert.equal(publicRepairFeed(state).items.length, 1);
  const photo = { ...payload, photo: 'abc' };
  const blockedPhoto = await repairWrite(state, { handle: 'mina', publicJwk: mina.publicJwk, payload: photo, sig: await signDevice(mina.privateJwk, photo) });
  assert.equal(blockedPhoto.ok, false);
  const status = { handle: 'mina', action: 'repair-status', origin: 'health', id: opened.item.id, status: 'scheduled', at: '2026-11-10T21:00:00.000Z' };
  const updated = await repairWrite(state, { handle: 'mina', publicJwk: mina.publicJwk, payload: status, sig: await signDevice(mina.privateJwk, status) });
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.item.status, 'scheduled');
  const listing = { handle: 'mina', action: 'listing', origin: 'exchange', title: 'Bike', at: '2026-11-10T21:00:00.000Z' };
  const refused = await repairWrite(state, { handle: 'mina', publicJwk: mina.publicJwk, payload: listing, sig: await signDevice(mina.privateJwk, listing) });
  assert.equal(refused.ok, false);
  assert.equal(refused.status, 403);
  assert.equal(refused.error, VIEW_ONLY_MESSAGE);
  const memberYes = { handle: 'mina', action: 'repair-confirm', origin: 'health', id: opened.item.id, side: 'member', amount: 40, confirmed: true, at: '2026-11-10T22:00:00.000Z' };
  const providerYes = { handle: 'ria', action: 'repair-confirm', origin: 'health', id: opened.item.id, side: 'provider', amount: 40, confirmed: true, at: '2026-11-10T22:01:00.000Z' };
  const one = await repairWrite(state, { handle: 'mina', publicJwk: mina.publicJwk, payload: memberYes, sig: await signDevice(mina.privateJwk, memberYes) });
  assert.equal(one.recorded, false);
  const both = await repairWrite(state, { handle: 'ria', publicJwk: provider.publicJwk, payload: providerYes, sig: await signDevice(provider.privateJwk, providerYes) });
  assert.equal(both.recorded, true, both.error);
  assert.equal(both.item.author, 39.6);
  assert.equal(both.item.skim, 0.4);
  assert.match(suggestRepairRate(60).note, /Both sides confirm/);
  const highMember = { ...memberYes, amount: 150, at: '2026-11-10T23:00:00.000Z' };
  const highProvider = { ...providerYes, amount: 150, at: '2026-11-10T23:01:00.000Z' };
  await repairWrite(state, { handle: 'mina', publicJwk: mina.publicJwk, payload: highMember, sig: await signDevice(mina.privateJwk, highMember) });
  const pending = await repairWrite(state, { handle: 'ria', publicJwk: provider.publicJwk, payload: highProvider, sig: await signDevice(provider.privateJwk, highProvider) });
  assert.equal(pending.pending, true);
  assert.match(pending.note, /3 attestations/);
  assert.equal(text('api/hedera/listings.mjs').includes('VIEW_ONLY_MESSAGE'), true);
  assert.equal(text('api/exchange/repair.mjs').includes('ALLOWED_ACTIONS'), true);
});
