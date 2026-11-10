import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirmCode, requestCode } from '../api/lib/email-flow.mjs';
import { hashEmail } from '../js/email-check-core.mjs';
import { EMAIL_GATEWAY, EMAIL_WAITING, requiresEmail } from '../js/health-email.mjs';
import { FALLBACK_LABEL, HEALTH_PLANS, PLAN_ORDER, draftPlan } from '../js/health-plan.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function memory() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async set(key, value) { data.set(key, structuredClone(value)); },
    async del(key) { data.delete(key); },
    keys() { return [...data.keys()]; },
    dump() { return JSON.stringify([...data.entries()]); }
  };
}

test('email is only the new Health join gateway', () => {
  assert.equal(requiresEmail(EMAIL_GATEWAY), true);
  assert.equal(requiresEmail('health-join'), true);
  for (const route of [
    '/gym', '/gym#/me', '/gym#/personalize', '/gym#/dispute', '/gym#/train',
    '/exchange', '/campus', '/neighbors', '/hosts', '/circles', '/stories', '/good-deeds',
    '/api/gym/progress', '/api/gym/chat', '/api/gym/covenant', '/api/gym/intake', '/api/gym/dispute',
    '/api/hedera/queue', '/api/hedera/anchor', '/api/hedera/cron', '/disclaimer', '/help'
  ]) {
    assert.equal(requiresEmail(route), false, route);
  }
  const untouched = [
    'api/gym/progress.mjs', 'api/gym/chat.mjs', 'api/gym/covenant.mjs', 'api/gym/intake.mjs',
    'api/gym/dispute.mjs', 'api/hedera/queue.mjs', 'api/hedera/anchor.mjs', 'exchange.html', 'campus.html'
  ];
  for (const file of untouched) {
    assert.equal(text(file).includes('healthWriteAllowed'), false, file);
    assert.equal(text(file).includes('requiresEmail'), false, file);
  }
  const join = text('js/gym-app.mjs');
  assert.equal(join.includes('id: \'health-email\''), true);
  assert.equal(join.includes('joinEmailDone'), true);
  assert.equal(text('index.html').includes('id="start-health"'), true);
  assert.equal(text('help.html').includes('No other page asks for an email code.'), true);
});

test('a new member code is stored as a peppered hash and bound to the device', async () => {
  const store = memory();
  const sent = [];
  const requested = await requestCode(store, {
    email: 'New.Member@Clinic.org',
    now: 1_000,
    pepper: 'pepper',
    code: '246810',
    send: async (email, code) => { sent.push([email, code]); return { ok: true }; }
  });
  assert.equal(requested.ok, true);
  assert.deepEqual(sent, [['new.member@clinic.org', '246810']]);
  assert.equal(store.dump().includes('new.member@clinic.org'), false);
  const verified = await confirmCode(store, {
    email: 'new.member@clinic.org',
    code: '246810',
    now: 2_000,
    pepper: 'pepper',
    publicJwk: { x: 'device-x', y: 'device-y' }
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.member, 'new');
  const emailHash = await hashEmail('new.member@clinic.org', 'pepper');
  assert.equal(verified.emailHash, emailHash);
  const member = await store.get(`email:member:${emailHash}`);
  assert.equal(member.email, undefined);
  assert.equal(store.dump().includes('new.member@clinic.org'), false);
  assert.equal(store.keys().some((key) => key.startsWith('email:device:')), true);
});

test('the three Health drafts stay on the phone and do not rank anyone', () => {
  assert.deepEqual(PLAN_ORDER, ['easy', 'engaging', 'ultimate']);
  const easy = draftPlan('easy', 'morning walk');
  assert.equal(easy.ok, true);
  assert.equal(easy.label, FALLBACK_LABEL);
  assert.equal(easy.lines.filter((line) => /^\d\./.test(line)).length, 3);
  assert.equal(HEALTH_PLANS.easy.prompt.includes('Three daily habits only.'), true);
  assert.equal(HEALTH_PLANS.engaging.prompt.includes('Buddy check-ins with a sponsor or a trainer.'), true);
  assert.equal(HEALTH_PLANS.ultimate.prompt.includes('A phased 12-week plan.'), true);
  for (const id of PLAN_ORDER) {
    const plan = HEALTH_PLANS[id];
    assert.equal(plan.prompt.includes('No streaks, no leaderboard, and no ranking.'), true, id);
    assert.equal(draftPlan(id).lines.some((line) => /your rank|day streak is/i.test(line)), false, id);
  }
  assert.equal(EMAIL_WAITING.startsWith('Email sign-in is coming.'), true);
  for (const id of PLAN_ORDER) assert.equal(existsSync(join(root, `images/health-plan-${id}.png`)), true, id);
  assert.equal(text('js/gym-app.mjs').includes('id: \'use-easy\'') || text('js/gym-app.mjs').includes('use-${id}'), true);
});
