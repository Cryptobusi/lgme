import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAXIMS } from '../js/wisdom.mjs';
import { MODEL_MB, OPT_IN_COPY, answerLocal, detectEngine, isOn, offlineAnswer, setOn } from '../js/local-ai.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

test('the local assistant stays off and the offline helper does not leave the phone', async () => {
  const storage = {
    bag: {},
    getItem(key) { return this.bag[key] || null; },
    setItem(key, value) { this.bag[key] = value; }
  };
  assert.equal(isOn(storage), false);
  setOn(storage, true);
  assert.equal(isOn(storage), true);
  setOn(storage, false);
  assert.equal(isOn(storage), false);
  const scope = { navigator: {} };
  assert.equal(detectEngine(scope).id, 'rules');
  assert.equal(detectEngine(scope).label, 'Offline helper');
  const health = await answerLocal({ question: 'How is my mood?', progressLines: ['Health meter 6'], scope, storage });
  assert.match(health.text, /Not medical advice/);
  assert.equal(health.engine, 'rules');
  assert.match(offlineAnswer('How do I post IwantIT?'), /IwantIT/);
  const intent = offlineAnswer('Suggest a session intent');
  assert.equal(MAXIMS.some((maxim) => intent.includes(maxim.title)), true);
  assert.match(offlineAnswer('Draft a group message'), /not sent/i);
  assert.match(offlineAnswer('Show a leaderboard'), /no leaderboard/i);
  const source = text('js/local-ai.mjs');
  assert.equal(source.includes('fetch('), false);
  assert.match(OPT_IN_COPY, new RegExp(String(MODEL_MB)));
  assert.match(OPT_IN_COPY, /Nothing you type or your progress leaves the device/);
  const csp = text('vercel.json');
  const script = csp.match(/script-src [^;]+/)[0];
  assert.equal(script.includes("'wasm-unsafe-eval'"), true);
  assert.equal(script.includes(" 'unsafe-eval'"), false);
  assert.equal(script.includes("'unsafe-inline'"), false);
  assert.equal(csp.includes('https://huggingface.co'), true);
  assert.equal(csp.includes('https://raw.githubusercontent.com'), true);
});
