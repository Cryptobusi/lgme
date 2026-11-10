import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendId, validateLayout, layoutFromText, fallbackLayout } from '../js/health-layout.mjs';
import { inQuietHours, publicPresence, timeProposal, unreadCount, visibleConnect } from '../js/health-presence.mjs';
import { contactLinks, makeContactKey, openContact, publicDirect, sealContact } from '../js/health-contact.mjs';
import { recallPage, rememberPage } from '../js/health-page.mjs';
import * as sim from '../js/p2p-exchange-sim.mjs';

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

test('a confirmed page is remembered on the device and is not sent', () => {
  const storage = memory();
  const record = rememberPage(storage, {
    memberId: 'mina',
    confirmedAt: '2026-11-10T20:00:00.000Z',
    prompt: 'Easy version.',
    layout: fallbackLayout('easy', 'morning walk'),
    reminders: { days: ['mon'], time: '19:00', text: 'A short walk, if you want.' },
    status: { status: 'resting', note: '', share: false },
    background: 'health-page:mina'
  });
  const again = recallPage(storage, 'mina');
  assert.equal(again.confirmed, true);
  assert.equal(again.prompt, 'Easy version.');
  assert.equal(again.confirmedAt, '2026-11-10T20:00:00.000Z');
  assert.equal(again.layout.layout.title, 'Easy Health');
  assert.equal(again.background, 'health-page:mina');
  assert.equal(again.hedera, false);
  assert.equal(JSON.stringify(record).includes('http'), false);
  assert.equal(recallPage(storage, 'riley'), null);
});

test('the recommended page follows the intake goals and rejects markup', () => {
  assert.equal(recommendId(''), 'easy');
  assert.equal(recommendId('weekly buddy check-in'), 'engaging');
  assert.equal(recommendId('intake goal and a 12-week trainer review'), 'ultimate');
  const bad = validateLayout({ title: 'Bad', tone: 'x', sections: [{ id: 'habits', title: 'Habits', body: '<script>alert(1)</script>' }] }, 'easy');
  assert.equal(bad.ok, false);
  const wrapped = layoutFromText('sure {"title":"Easy day","tone":"Quiet.","sections":[{"id":"habits","title":"Habits","body":"Walk, water, stretch."}]}', 'easy');
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.layout.sections[0].body.includes('<'), false);
});

test('presence is opt-in, expires, and a suggested time is plain text', () => {
  const now = Date.parse('2026-11-10T20:00:00.000Z');
  const hidden = publicPresence({ handle: 'mina', code: 'demo-club', share: false, status: 'training', at: '2026-11-10T20:00:00.000Z' });
  assert.equal(hidden.row.status, '');
  assert.equal(hidden.row.connect, '');
  assert.equal(hidden.row.hedera, false);
  const online = publicPresence({ handle: 'mina', code: 'demo-club', connect: 'online', at: '2026-11-10T20:00:00.000Z', seen: '2026-11-10T20:00:00.000Z' });
  assert.equal(visibleConnect([online.row], now).length, 1);
  assert.equal(visibleConnect([online.row], now + 31 * 60 * 1000).length, 0);
  const windowed = publicPresence({ handle: 'riley', code: 'demo-club', connect: 'ok', until: '2020-01-01T00:00', at: '2026-11-10T20:00:00.000Z', seen: '2026-11-10T20:00:00.000Z' });
  assert.equal(visibleConnect([windowed.row], now).length, 0);
  assert.equal(timeProposal('Time: 2026-11-12T18:00'), '2026-11-12T18:00');
  assert.equal(unreadCount([{ to: 'riley', from: 'mina', at: '2026-11-10T20:05:00.000Z' }], 'riley', '2026-11-10T20:00:00.000Z'), 1);
  assert.equal(inQuietHours({ start: '22:00', end: '07:00' }, new Date('2026-11-10T23:00:00')), true);
  assert.equal(inQuietHours({ start: '22:00', end: '07:00' }, new Date('2026-11-10T12:00:00')), false);
  const peer = { id: 'mina', name: 'Mina', tape: [], exchanges: {}, receipts: {}, healthPage: recordLite() };
  assert.equal(sim.toExport(peer).healthPage.prompt, 'Easy version.');
  assert.equal(sim.toExport({ id: 'no', name: 'No', tape: [], exchanges: {}, receipts: {} }).healthPage, undefined);
});

test('a call contact is sealed for one member and can be revoked', async () => {
  const mina = await makeContactKey();
  const riley = await makeContactKey();
  const sealed = await sealContact(mina.privateJwk, riley.publicJwk, { kind: 'phone', value: '+15551212' });
  const opened = await openContact(riley.privateJwk, mina.publicJwk, sealed);
  assert.equal(opened.value, '+15551212');
  assert.equal(JSON.stringify(sealed).includes('15551212'), false);
  const links = contactLinks('phone', opened.value);
  assert.equal(links.call, 'tel:+15551212');
  assert.equal(links.video.startsWith('facetime:'), true);
  const share = publicDirect({ direct: 'share', to: 'riley', iv: sealed.iv, cipher: sealed.cipher }, 'mina');
  assert.equal(share.ok, true);
  assert.equal(share.row.hedera, false);
  const leaked = publicDirect({ direct: 'share', to: 'riley', iv: sealed.iv, cipher: 'tel:+15551212' }, 'mina');
  assert.equal(leaked.ok, false);
  const revoked = publicDirect({ direct: 'revoke', to: 'riley' }, 'mina');
  assert.equal(revoked.row.kind, 'revoke');
  assert.equal(JSON.stringify(revoked.row).includes('1555'), false);
});

function recordLite() {
  return { prompt: 'Easy version.', hedera: false, confirmed: true };
}
