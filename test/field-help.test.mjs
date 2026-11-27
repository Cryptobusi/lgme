import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFieldOption, fieldLines, fieldMeta, lastFieldValue, nextHelpField, rememberFieldValue, safeHelpLine } from '../js/field-help.mjs';

test('field help reads data attributes and skips the dock', () => {
  const field = {
    getAttribute(name) { return name === 'data-help' ? 'This names the session.' : 'Walk|Stretch'; },
    closest() { return null; }
  };
  assert.equal(fieldMeta(field).help, 'This names the session.');
  assert.deepEqual(fieldMeta(field).options, ['Walk', 'Stretch']);
  assert.equal(fieldMeta({ getAttribute() { return ''; }, closest() { return {}; } }), null);
  assert.equal(fieldMeta({ tagName: 'BODY', type: '', getAttribute() { return ''; }, closest() { return null; } }), null);
  assert.match(fieldLines('This names the session.'), /Tap an option to fill this/);
  assert.doesNotMatch(fieldLines('This names the session.'), /diagnos|treatment|cure/i);
  assert.equal(safeHelpLine('This is a diagnosis and a cure.', 'Keep the note on this phone.'), 'Keep the note on this phone.');
});

test('an option fills the field and the next help field is the following one', () => {
  const events = [];
  const first = { type: 'text', value: '', disabled: false, readOnly: false, required: false, closest() { return null; }, hasAttribute(name) { return name === 'data-help'; }, dispatchEvent(event) { events.push(event.type); } };
  const second = { type: 'text', disabled: false, readOnly: false, required: true, closest() { return null; }, hasAttribute() { return false; } };
  const hidden = { type: 'hidden', disabled: false, readOnly: false, closest() { return null; }, hasAttribute() { return true; } };
  applyFieldOption(first, 'Walk');
  assert.equal(first.value, 'Walk');
  assert.deepEqual(events, ['input', 'change']);
  const root = { querySelectorAll() { return [hidden, first, second]; } };
  assert.equal(nextHelpField(first, root), second);
  let submitted = false;
  first.form = { submit() { submitted = true; } };
  applyFieldOption(first, 'Walk');
  assert.equal(submitted, false);
});

function fakeField(spec) {
  return {
    id: spec.id,
    type: spec.type || 'text',
    value: '',
    labels: [{ textContent: spec.label || '' }],
    getAttribute(name) {
      if (name === 'id') return spec.id || '';
      if (name === 'type') return spec.type || '';
      if (name === 'placeholder') return spec.placeholder || '';
      if (name === 'autocomplete') return spec.autocomplete || '';
      if (name === 'data-help') return spec.help || '';
      if (name === 'data-options') return spec.options || '';
      return '';
    },
    closest() { return null; },
    dispatchEvent() {}
  };
}

test('every field gets a guide, and an example fills only after a tap', () => {
  const amount = fieldMeta(fakeField({ id: 'donate-amount', label: 'Amount' }));
  assert.match(amount.text, /50\/50/);
  assert.match(amount.text, /US\$|Creo/);
  assert.equal(amount.options.length >= 2 && amount.options.length <= 3, true);
  const gift = fieldMeta(fakeField({ id: 'contrib-usd', label: ' US$' }));
  assert.match(gift.text, /50\/50/);
  assert.match(gift.text, /temporary until the DAO/);
  const deed = fieldMeta(fakeField({ id: 'ididit-input', type: 'textarea', label: 'IdidIt' }));
  assert.match(deed.text, /Creo/);
  const thing = fieldMeta(fakeField({ id: 'ihavit-name', label: 'Name' }));
  assert.match(thing.text, /tap OK/);
  const note = fieldMeta(fakeField({ id: 'note', label: 'Note' }));
  assert.match(note.help, /Note/);
  const email = fakeField({ id: 'access-email', type: 'email', label: 'Email', autocomplete: 'email' });
  const guide = fieldMeta(email);
  assert.equal(guide.personal, true);
  assert.equal(email.value, '');
  applyFieldOption(email, guide.options[0]);
  assert.equal(email.value, guide.options[0]);
  const memory = { bag: {}, getItem(key) { return this.bag[key] || null; }, setItem(key, value) { this.bag[key] = value; } };
  rememberFieldValue(memory, 'donate-amount', '5', false);
  rememberFieldValue(memory, 'donate-amount', '9', true);
  assert.equal(lastFieldValue(memory, 'donate-amount', false), '5');
  assert.equal(lastFieldValue(memory, 'donate-amount', true), '9');
});
