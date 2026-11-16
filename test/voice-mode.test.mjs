import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spokenCommand, voiceFriendly } from '../js/local-ai-panel.mjs';

test('voice replies spell minutes, speed, and steps', () => {
  const line = voiceFriendly('Ready to log on IdidIt: Walk, 30 min.\n1) Press Send again or tap Confirm to open the filled-in draft.\n2) Check the activity and minutes.');
  assert.match(line, /30 minutes/);
  assert.equal(/\bmin\b/.test(line), false);
  assert.match(line, /Step one\./);
  assert.match(line, /Step two\./);
  assert.equal(voiceFriendly('3mph'), '3 miles per hour');
  assert.equal(spokenCommand('confirm'), 'confirm');
  assert.equal(spokenCommand('Yes.'), 'confirm');
  assert.equal(spokenCommand('send'), 'confirm');
  assert.equal(spokenCommand('cancel'), 'cancel');
  assert.equal(spokenCommand('undo'), 'undo');
  assert.equal(spokenCommand('Walked 30 min'), '');
  const panel = readFileSync(new URL('../js/local-ai-panel.mjs', import.meta.url), 'utf8');
  assert.equal(panel.includes('speechSynthesis'), true);
  assert.equal(panel.includes('processLocally = true'), true);
  assert.equal(panel.includes('id="ai-speaking"'), true);
  assert.equal(panel.includes('>Stop<'), true);
  assert.equal(panel.includes('>Listening<'), true);
});
