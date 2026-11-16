import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyMode } from '../js/screen-modes.mjs';
import {
  NOTICE,
  UNPUBLISHED,
  deletePending,
  editPending,
  holdPrivate,
  incognitoOn,
  installIncognitoGuard,
  isAuthTraffic,
  listPending,
  receiptStatus,
  setIncognito,
  shareApproved,
  sharePreview,
  voiceInputAllowed
} from '../js/incognito.mjs';

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
}

function reload(storage) {
  const next = memory();
  for (const key of ['lgme.incognito', 'lgme.incognito.pending', 'lgme.variant.active', 'lgme.variant.undo', 'lgme.screen.chosen', 'lgme.member.id', 'lgme.access']) {
    const value = storage.getItem(key);
    if (value != null) next.setItem(key, value);
  }
  return next;
}

test('incognito holds private writes and does not flush them', async () => {
  const storage = memory();
  const sent = [];
  const scope = {
    fetch: async (url, init) => {
      sent.push({ url, method: init?.method || 'GET', body: init?.body || '' });
      return new Response(JSON.stringify({ ok: true, transactionId: '0.0.1@1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  };
  installIncognitoGuard(scope, storage);
  assert.equal(setIncognito(storage, true).flushed, false);
  assert.equal(incognitoOn(storage), true);
  const held = await scope.fetch('/api/hedera/queue', { method: 'POST', body: '{"hash":"abc"}' });
  const body = await held.json();
  assert.equal(held.status, 409);
  assert.equal(body.ok, false);
  assert.equal(body.held, true);
  assert.equal(sent.length, 0);
  assert.equal(listPending(storage).length, 1);
  assert.equal(listPending(storage)[0].destination, 'Hedera testnet queue');
  assert.match(receiptStatus(body), /Unpublished/);
  assert.equal(receiptStatus(body).includes('Recorded on testnet'), false);

  const auth = await scope.fetch('/api/authenticator', { method: 'POST', body: '{"action":"nonce"}' });
  assert.equal(auth.status, 200);
  assert.equal(isAuthTraffic('/api/email/send'), true);
  assert.equal(sent.length, 1);
  await scope.fetch('/api/gym/progress');
  assert.equal(sent.length, 2);
  assert.equal(listPending(storage).length, 1);

  holdPrivate(storage, { kind: 'voice', summary: 'walked 30 minutes', shareable: false });
  const voice = listPending(storage)[1];
  assert.equal(voice.destination, 'Stays on this phone');
  editPending(storage, voice.id, 'walked 20 minutes');
  assert.equal(listPending(storage)[1].summary, 'walked 20 minutes');
  const preview = sharePreview(storage, listPending(storage).map((item) => item.id));
  assert.equal(preview[0].destination, 'Hedera testnet queue');
  assert.match(preview[0].leaves, /abc/);
  assert.equal(preview[0].label, UNPUBLISHED);
  assert.equal(preview[1].leaves, 'Nothing leaves. This stays on this phone.');
  assert.equal(sent.length, 2);

  const turnedOff = setIncognito(storage, false);
  assert.equal(turnedOff.flushed, false);
  assert.equal(listPending(storage).length, 2);
  applyMode(storage, 'simple');
  storage.setItem('lgme.member.id', 'member');
  storage.setItem('lgme.access', 'full');
  const again = reload(storage);
  assert.equal(incognitoOn(again), false);
  assert.equal(listPending(again).length, 2);
  await scope.fetch('/api/develop/want', { method: 'POST', body: '{"title":"new"}' });
  assert.equal(sent.at(-1).body, '{"title":"new"}');
  assert.equal(listPending(again).length, 2);

  setIncognito(again, true);
  const shared = await shareApproved(again, [listPending(again)[0].id], scope.__lgmeNativeFetch);
  assert.deepEqual(shared.sent, ['hold-1']);
  assert.equal(shared.failed.length, 0);
  assert.equal(listPending(again).some((item) => item.kind === 'voice'), true);
  assert.equal(sent.some((call) => String(call.body).includes('abc')), true);
  deletePending(again, listPending(again)[0].id);
  assert.equal(listPending(again).length, 0);

  assert.equal(voiceInputAllowed({ incognito: true, processLocally: true }).ok, true);
  const blocked = voiceInputAllowed({ incognito: true, processLocally: false });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /Typing still works/);
  assert.equal(/audio stays private while we send it/i.test(blocked.message), false);
  const panel = readFileSync(new URL('../js/local-ai-panel.mjs', import.meta.url), 'utf8');
  assert.equal(panel.includes(NOTICE), true);
  assert.equal(panel.includes('id="ai-incognito"'), true);
  assert.equal(panel.includes('Approve and share'), true);
  assert.equal(panel.includes('speechSynthesis'), true);
  const settings = readFileSync(new URL('../js/gym-app.mjs', import.meta.url), 'utf8');
  assert.equal(settings.includes('id: \'incognito-settings\''), true);
  assert.equal(settings.includes('does not send pending items'), true);
  const policy = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = policy.headers.flatMap((block) => block.headers).find((header) => header.key === 'Content-Security-Policy').value;
  assert.match(csp, /default-src 'self'/);
  assert.equal(csp.includes('incognito'), false);
});
