import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFieldOption, fieldLines, fieldMeta, nextHelpField, safeHelpLine } from '../js/field-help.mjs';

test('field help reads data attributes and skips the dock', () => {
  const field = {
    getAttribute(name) { return name === 'data-help' ? 'This names the session.' : 'Walk|Stretch'; },
    closest() { return null; }
  };
  assert.equal(fieldMeta(field).help, 'This names the session.');
  assert.deepEqual(fieldMeta(field).options, ['Walk', 'Stretch']);
  assert.equal(fieldMeta({ getAttribute() { return ''; }, closest() { return {}; } }), null);
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
});
