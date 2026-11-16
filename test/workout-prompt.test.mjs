import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchPrompt, planSend, stageLine } from '../js/local-ai-panel.mjs';

test('workout phrases become a 10 minute treadmill receipt', () => {
  for (const phrase of ['log 10min treadmill', '10 min treadmill', 'treadmill 10 minutes', 'Log a workout 10 min treadmill']) {
    const matched = matchPrompt(phrase);
    assert.equal(matched.kind, 'ididit', phrase);
    assert.equal(matched.activity, 'Treadmill', phrase);
    assert.equal(matched.minutes, 10, phrase);
    assert.equal(matched.title, 'Treadmill, 10 min', phrase);
  }
  const line = stageLine(matchPrompt('log 10min treadmill'));
  assert.match(line, /Ready to log on IdidIt: Treadmill, 10 min\./);
  assert.match(line, /1\) Press Send again or tap Confirm to open the filled-in draft\./);
  assert.equal(matchPrompt('log a workout').title, 'I did the session');
  const pace = matchPrompt('Treadmill 5 miles at 3mph');
  assert.equal(pace.activity, 'Treadmill');
  assert.equal(pace.distance, '5 miles');
  assert.equal(pace.speed, '3 mph');
  assert.equal(pace.minutes, 100);
  assert.equal(pace.computed, true);
  assert.equal(pace.title, 'Treadmill, 5 miles, 3 mph, about 100 min');
  const walked = matchPrompt('Walked 30 min');
  assert.equal(walked.activity, 'Walk');
  assert.equal(walked.minutes, 30);
  assert.equal(walked.title, 'Walk, 30 min');
  assert.equal(matchPrompt('ran 2 miles').title, 'Run, 2 miles');
  assert.equal(matchPrompt('did yoga 20 minutes').title, 'Yoga, 20 min');
  const first = planSend({ staged: null, stagedText: '', text: 'Walked 30 min' });
  assert.equal(first.action, 'stage');
  assert.match(first.line, /Ready to log on IdidIt: Walk, 30 min\./);
  assert.match(first.line, /4\) Ask a trainer or nearby member to attest \(optional\)\./);
  const second = planSend({ staged: first.matched, stagedText: 'Walked 30 min', text: 'Walked 30 min' });
  assert.equal(second.action, 'open');
  const missed = planSend({ staged: null, stagedText: '', text: 'hello there' });
  assert.equal(missed.action, 'explain');
  const again = planSend({ staged: null, stagedText: 'hello there', text: 'hello there' });
  assert.equal(again.action, 'reexplain');
  assert.equal(again.categories.length >= 2 && again.categories.length <= 3, true);
  const css = readFileSync(new URL('../site-nav.css', import.meta.url), 'utf8');
  assert.match(css, /#ai-dock\.is-open\s*\{[^}]*height:\s*25vh/);
  assert.match(css, /data-screen="simple"\] #ai-dock\.is-open \{ height: 45vh/);
  assert.match(css, /data-screen="full"\] #ai-dock\.is-open \{ height: 30vh/);
});
