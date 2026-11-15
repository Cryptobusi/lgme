import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPrompt, stageLine } from '../js/local-ai-panel.mjs';

test('workout phrases become a 10 minute treadmill receipt', () => {
  for (const phrase of ['log 10min treadmill', '10 min treadmill', 'treadmill 10 minutes', 'Log a workout 10 min treadmill']) {
    const matched = matchPrompt(phrase);
    assert.equal(matched.kind, 'ididit', phrase);
    assert.equal(matched.activity, 'Treadmill', phrase);
    assert.equal(matched.minutes, 10, phrase);
    assert.equal(matched.title, 'Treadmill, 10 min', phrase);
  }
  const line = stageLine(matchPrompt('log 10min treadmill'));
  assert.equal(line, 'Recommend: log Treadmill, 10 min as an IdidIt receipt. Verify: it stays on this phone until you confirm; Health is on testnet. Explain: tap Confirm or press Send again to open the filled draft.');
  assert.equal(matchPrompt('log a workout').title, 'I did the session');
});
