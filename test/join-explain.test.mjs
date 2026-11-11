import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { explainReady } from '../js/device-capabilities.mjs';
import { JOIN_STEPS, explainJoin } from '../js/join-explain.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'index.html'), 'utf8');

test('section 2 is five short steps and the helper only explains', () => {
  assert.equal(JOIN_STEPS.length, 5);
  for (const step of JOIN_STEPS) {
    assert.equal(step.split(/[.!?]/).filter(Boolean).length, 1, step);
    assert.equal(/\b(testnet|hedera|anchor|attester|third seat|\$trust)\b/i.test(step), false, step);
  }
  const plain = explainJoin('');
  assert.equal(plain.sent, false);
  assert.match(plain.text, /I do not sign you up/);
  const refused = explainJoin('Please sign me up');
  assert.match(refused.text, /cannot sign you up/);
  assert.equal(refused.sent, false);
  const money = explainJoin('What about $lgme?');
  assert.match(money.text, /pegged to US\$/);
  assert.match(explainJoin('Do I earn coins?').text, /credit, not coins/);
  assert.equal(/\b(testnet|hedera|attester|third seat|\$trust)\b/i.test(explainJoin('').text), false);
  assert.equal(explainReady({ navigator: {}, WebAssembly: { validate: () => false } }).ok, true);
  assert.equal(explainReady({ navigator: { lgmeAi: 'off' } }).ok, false);
  assert.equal(page.includes('id="join-step-2"'), true);
  assert.equal(page.includes('Explain this to me'), true);
  assert.equal(page.includes('id="join-explain" hidden'), true);
  assert.equal(page.includes('Disclaimer (Live beta v.5)'), true);
  assert.equal(page.includes('$Trust'), false);
});
