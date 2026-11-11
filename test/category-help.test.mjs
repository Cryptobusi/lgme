import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryOpen, helpDraft, helpPath } from '../js/category-help.mjs';
import { acceptHelpWant, publicHelpWant } from '../js/develop-want.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? data.get(key) : null; },
    async set(key, value) { data.set(key, value); }
  };
}

test('every category is open and a help IwanIT notifies without an address in the page', async () => {
  assert.equal(categoryOpen('campus'), true);
  assert.equal(categoryOpen('goods'), true);
  assert.equal(categoryOpen('secret'), false);
  const draft = helpDraft('Campus');
  assert.equal(draft.kind, 'IwanIT');
  assert.equal(draft.title, 'I want to help develop Campus');
  assert.equal(helpPath('Neighbor help'), '/develop?category=Neighbor%20help');
  const refused = publicHelpWant({ ...draft, body: 'mail me at ada@example.com' });
  assert.equal(refused.ok, false);
  const store = memory();
  const sent = [];
  const pushes = [];
  const first = await acceptHelpWant(store, draft, {
    now: 1_000,
    ip: '203.0.113.5',
    env: { OWNER_NOTIFY_EMAIL: 'owner@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'desk@lgme.app' },
    fetchImpl: async (url, options) => {
      sent.push({ url, body: JSON.parse(options.body) });
      return { ok: true };
    },
    push: async (notice) => { pushes.push(notice); return { ok: true }; }
  });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.duplicate, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.to, 'owner@example.test');
  assert.equal(sent[0].body.subject, 'IwanIT: Campus');
  assert.match(sent[0].body.text, /I want to help develop Campus/);
  assert.equal(JSON.stringify(sent[0].body.text).includes('@'), false);
  assert.equal(JSON.stringify(first).includes('owner@example.test'), false);
  assert.equal(pushes[0].link.includes('/develop?category=Campus'), true);
  const again = await acceptHelpWant(store, draft, {
    now: 2_000,
    ip: '203.0.113.5',
    env: { OWNER_NOTIFY_EMAIL: 'owner@example.test', RESEND_API_KEY: 'k', EMAIL_FROM: 'desk@lgme.app' },
    fetchImpl: async () => { sent.push({ extra: true }); return { ok: true }; }
  });
  assert.equal(again.duplicate, true);
  assert.equal(sent.length, 1);
  const home = text('index.html');
  assert.equal(home.includes('cryptovanities@gmail.com'), false);
  assert.equal(home.includes('mailto:'), false);
  assert.equal(text('js/category-help.mjs').includes('mailto:'), false);
  assert.equal(text('js/develop-want.mjs').includes('OWNER_NOTIFY_EMAIL'), true);
  assert.equal(text('js/develop-want.mjs').includes('cryptovanities'), false);
});
