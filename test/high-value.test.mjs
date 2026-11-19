import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { ADMIN_APPROVAL_LABEL, ATTESTATION_NOTE, ATTESTATION_THRESHOLD, DAY_NOTE, RULE_SHORT, addAttestation, addRefusal, adminAct, attestCard, attestationChainHash, autoApprove, escalateHold, escalationNotice, evaluateHold, nearingMarks, planReminders, reminderCadence, shownRecords, suggestThird } from '../js/high-value.mjs';
import { donateCredit, emptyPool } from '../js/membership-pool.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = '2026-11-10T15:00:00.000Z';

function entry(amount, kind, extra = {}) {
  return { id: extra.id || 'one', fromId: 'ada', toId: 'bo', kind, amount, price: extra.price || 0, at: extra.at || at };
}

test('the $100 line is one constant and a split across 24 hours still waits', () => {
  assert.equal(ATTESTATION_THRESHOLD, 100);
  const under = evaluateHold([], entry(100, 'credit'));
  assert.equal(under.pending, false);
  const over = evaluateHold([], entry(100.01, 'usd'));
  assert.equal(over.pending, true);
  assert.equal(over.note, ATTESTATION_NOTE);
  const priced = evaluateHold([], entry(50, 'lgme', { price: 3 }));
  assert.equal(priced.pending, true);
  assert.equal(priced.usd, 150);
  const first = { id: 'a', pair: 'ada|bo', fromId: 'ada', toId: 'bo', usd: 60, at, status: 'cleared' };
  const second = evaluateHold([first], entry(50, 'usd', { id: 'b', at: '2026-11-10T20:00:00.000Z' }));
  assert.equal(second.pending, true);
  const later = evaluateHold([first], entry(50, 'usd', { id: 'c', at: '2026-11-12T15:00:00.000Z' }));
  assert.equal(later.pending, false);
  assert.equal(evaluateHold([], entry(10, 'lgme')).ok, false);
});

test('three device signatures clear it, and the third name is only a suggestion', async () => {
  const group = (id, role, trainerAt) => ({
    id,
    clubGroups: { dawn: { role, creator: 'cy', trainerAt, admin: role === 'admin' } }
  });
  const members = [group('ada', 'member'), group('bo', 'member'), group('cy', 'admin', '2026-11-01'), group('dee', 'trainer', '2026-11-02'), group('ef', 'trainer', '2026-11-03')];
  const picked = suggestThird(members, members[0], members[1]);
  assert.equal(picked.role, 'group administrator');
  assert.equal(picked.text, 'Suggested third attester: group administrator');
  const noAdmin = suggestThird(members.filter((peer) => peer.id !== 'cy'), members[0], members[1]);
  assert.equal(noAdmin.role, 'trainer');
  assert.equal(noAdmin.handle, 'dee');
  const parties = suggestThird([group('ada', 'admin'), group('bo', 'trainer', '2026-11-01'), group('cy', 'member')], members[0], members[1]);
  assert.equal(parties.role, 'group creator');
  let record = evaluateHold([], entry(150, 'credit')).record;
  const keys = await Promise.all(['mina', 'noor', 'otis'].map(async (handle) => ({ handle, ...(await generateDeviceKey()) })));
  for (const key of keys) {
    const payload = { action: 'attest', entryId: record.id, at };
    const sig = await signDevice(key.privateJwk, payload);
    const added = await addAttestation(record, { handle: key.handle, publicJwk: key.publicJwk, sig, at });
    assert.equal(added.ok, true, added.error);
    record = added.record;
    assert.equal(added.hash.includes(key.handle), false);
    assert.equal(await attestationChainHash(record.id, sig), added.hash);
  }
  assert.equal(record.status, 'ready');
  const party = await generateDeviceKey();
  const refused = await addAttestation(record, { handle: 'ada', publicJwk: party.publicJwk, sig: await signDevice(party.privateJwk, { action: 'attest', entryId: record.id, at }), at });
  assert.equal(refused.ok, false);
  const page = readFileSync(join(root, 'help.html'), 'utf8');
  assert.equal(page.includes('Needs 3 attestations (over $100)'), true);
  assert.equal(page.includes('Suggested third attester'), true);
  assert.equal(readFileSync(join(root, 'glossary.html'), 'utf8').includes('Needs 3 attestations (over $100)'), true);
  assert.equal(readFileSync(join(root, 'js/covenant.mjs'), 'utf8').includes('This clarification is a draft'), true);
  assert.equal(readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8').includes('Suggested third attester: group administrator'), true);
});

test('a day over $1,000 stays pending until three attestations and an administrator, and a refusal stays', async () => {
  const day = evaluateHold([], entry(1000.01, 'usd'));
  assert.equal(day.tier, 'day');
  assert.equal(day.pending, true);
  assert.equal(day.note, DAY_NOTE);
  assert.equal(day.record.adminRequired, true);
  assert.equal(autoApprove(), false);
  const opened = Date.parse(day.record.openedAt);
  assert.equal(Date.parse(day.record.deadline) - opened, 24 * 60 * 60 * 1000);
  let record = day.record;
  const keys = await Promise.all(['mina', 'noor', 'otis'].map(async (handle) => ({ handle, ...(await generateDeviceKey()) })));
  for (const key of keys) {
    const sig = await signDevice(key.privateJwk, { action: 'attest', entryId: record.id, at });
    const added = await addAttestation(record, { handle: key.handle, publicJwk: key.publicJwk, sig, at });
    record = added.record;
  }
  assert.equal(record.status, 'pending');
  assert.equal(holdReadySafe(record), false);
  const admin = await generateDeviceKey();
  const early = await adminAct(record, { role: 'member', action: 'approve', publicJwk: admin.publicJwk, sig: 'no', at });
  assert.equal(early.ok, false);
  const approveSig = await signDevice(admin.privateJwk, { action: 'approve', entryId: record.id, at });
  const approved = await adminAct(record, { role: 'administrator', action: 'approve', handle: 'desk', publicJwk: admin.publicJwk, sig: approveSig, at });
  assert.equal(approved.autoApproved, false);
  assert.equal(approved.record.status, 'ready');
  assert.equal(approved.record.adminApproval.label, ADMIN_APPROVAL_LABEL);
  const seat = await generateDeviceKey();
  const refuseSig = await signDevice(seat.privateJwk, { action: 'refuse', entryId: record.id, at });
  const refused = await addRefusal(approved.record, { handle: 'ada', publicJwk: seat.publicJwk, sig: refuseSig, at, seat: 'third' });
  assert.equal(refused.penalty, 0);
  assert.equal(refused.entry.seat, 'third');
  assert.equal(refused.entry.hidden, false);
  const book = shownRecords([refused.record, refused.entry], { hideRefusals: true });
  assert.equal(book.some((row) => row.kind === 'refusal'), true);
  const again = await adminAct(record, { role: 'administrator', action: 'extend', publicJwk: admin.publicJwk, sig: await signDevice(admin.privateJwk, { action: 'extend', entryId: record.id, at }), at });
  const twice = await adminAct(again.record, { role: 'administrator', action: 'extend', publicJwk: admin.publicJwk, sig: await signDevice(admin.privateJwk, { action: 'extend', entryId: record.id, at }), at });
  assert.equal(twice.ok, false);
  assert.equal(nearingMarks(79).length, 0);
  assert.equal(nearingMarks(80).some((mark) => mark.cap === 100 && mark.ratio === 0.8), true);
  assert.equal(nearingMarks(95).some((mark) => mark.ratio === 0.95 && mark.cap === 100), true);
  assert.equal(nearingMarks(800).some((mark) => mark.cap === 1000 && mark.ratio === 0.8), true);
  assert.equal(nearingMarks(950).some((mark) => mark.cap === 1000 && mark.ratio === 0.95), true);
  const far = reminderCadence(20 * 60 * 60 * 1000);
  const mid = reminderCadence(5 * 60 * 60 * 1000);
  const near = reminderCadence(2 * 60 * 60 * 1000);
  assert.equal(far.urgent, false);
  assert.equal(mid.label, 'Urgent');
  assert.equal(near.urgent, true);
  assert.equal(near.everyMs < mid.everyMs && mid.everyMs < far.everyMs, true);
  const plans = planReminders([{ ...record, status: 'pending', usd: 80, pair: record.pair, at, deadline: record.deadline }], opened + 60 * 60 * 1000);
  assert.equal(plans.some((item) => item.kind === 'threshold' && item.ratio === 0.8), true);
  assert.equal(plans.some((item) => item.kind === 'hold' && item.inApp === true), true);
  const soon = opened + 21 * 60 * 60 * 1000;
  const notice = escalationNotice({ ...record, status: 'pending' }, soon, { attesters: ['mina'] });
  assert.equal(notice.title, 'Help resolve');
  assert.equal(notice.parties.length, 2);
  assert.equal(notice.administrator, true);
  assert.equal(notice.autoApprove, false);
  assert.equal(escalationNotice({ ...record, status: 'pending' }, opened + 60 * 60 * 1000), null);
  const card = attestCard(record, soon);
  assert.equal(card.what, DAY_NOTE);
  assert.equal(card.parties, 'ada and bo');
  assert.match(card.href, /hold=/);
  assert.equal(card.label, 'Urgent');
  const memory = new Map();
  const store = { async get(key) { return memory.get(key); }, async set(key, value) { memory.set(key, value); } };
  const escalated = await escalateHold(store, { ...record, status: 'pending' }, soon, {
    env: { OWNER_NOTIFY_EMAIL: 'owner@example.test' },
    attesters: ['mina']
  });
  assert.equal(escalated.due, true);
  assert.equal(escalated.email, false);
  assert.equal(escalated.inbox, true);
  assert.equal(escalated.autoApproved, false);
  const notices = await store.get('owner:signups');
  assert.equal(notices[0].title, 'Help resolve');
  assert.match(notices[0].link, /#help-resolve/);
  const pooled = await donateCredit(emptyPool(), { handle: 'mina', credit: 2000, amount: 1000.01, at, nonce: 'day' });
  assert.equal(pooled.pending, true);
  assert.equal(pooled.note, DAY_NOTE);
  const page = readFileSync(join(root, 'exchange.html'), 'utf8');
  const help = readFileSync(join(root, 'help.html'), 'utf8');
  const barrier = readFileSync(join(root, 'docs/Barrier_Checks.md'), 'utf8');
  assert.equal(page.includes(RULE_SHORT), true);
  assert.equal(help.includes(RULE_SHORT), true);
  assert.equal(barrier.includes(RULE_SHORT), true);
  assert.equal(readFileSync(join(root, 'js/attest-card.mjs'), 'utf8').includes("textContent = 'Attest'"), true);
  assert.equal(readFileSync(join(root, 'js/attest-card.mjs'), 'utf8').includes("kind: 'notifications'"), true);
});

function holdReadySafe(record) {
  return record.status === 'ready';
}
