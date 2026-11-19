import test from 'node:test';
import assert from 'node:assert/strict';
import { controlText, pageOverview } from '../js/control-help.mjs';

function el(id, text, attrs = {}) {
  return {
    id,
    textContent: text,
    getAttribute(name) { return attrs[name] || (name === 'aria-label' ? '' : ''); },
    closest() { return null; }
  };
}

test('named controls explain what happens on OK', () => {
  assert.match(controlText(el('screen-reopen', 'Choose your screen')), /Choose your screen/);
  assert.match(controlText(el('credits-total', 'Creo 0.00')), /Creo/);
  assert.match(controlText(el('messages-open', 'Messages')), /OK/);
  assert.match(controlText(el('incognito-menu', 'Incognito off')), /keeps everything on this phone until you approve/);
  assert.match(controlText(el('testnet-chip', 'Testnet')), /Testnet/);
  assert.match(controlText(el('ai-confirm', 'OK')), /OK/);
  assert.match(controlText(el('one-more', 'More')), /More/);
  assert.equal(controlText({ id: 'ai-ask', getAttribute() { return ''; }, closest() { return {}; } }), '');
});

test('a page overview stays above a typed draft and names the steps', () => {
  const home = pageOverview('/', '');
  assert.match(home.line, /Home/);
  assert.equal(home.steps.length, 3);
  const deed = pageOverview('/gym', '#/ididit');
  assert.match(deed.line, /IdidIt/);
  assert.equal(deed.steps[0].startsWith('Name'), true);
  const other = pageOverview('/no-such', '', 'Notes · lgme');
  assert.match(other.line, /Notes/);
  assert.equal(other.steps.length, 3);
});
