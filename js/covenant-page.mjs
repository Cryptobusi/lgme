import { CLARIFICATIONS, COVENANT_TITLE, FIELD_LABELS, covenantText } from './covenant.mjs';

function inputFor(label) {
  const field = document.createElement('input');
  field.className = 'short';
  field.setAttribute('aria-label', label);
  field.autocomplete = 'off';
  return field;
}

function verbatim(text) {
  const host = document.createElement('div');
  host.id = 'covenant-verbatim';
  host.className = 'covenant-text';
  const parts = covenantText(text).split('____');
  parts.forEach((part, index) => {
    host.append(document.createTextNode(part));
    if (index < parts.length - 1) host.append(inputFor(FIELD_LABELS[index] || 'Field'));
  });
  return host;
}

function clarifications() {
  const box = document.createElement('section');
  box.id = 'covenant-clarifications';
  box.className = 'clarify';
  const title = document.createElement('h2');
  title.textContent = COVENANT_TITLE;
  const list = document.createElement('ol');
  for (const point of CLARIFICATIONS) {
    const item = document.createElement('li');
    item.textContent = point;
    list.append(item);
  }
  box.append(title, list);
  return box;
}

const response = await fetch('/data/member-covenant.txt');
const text = await response.text();
const charter = verbatim(text);
for (const node of charter.childNodes) {
  if (node.textContent.startsWith('Section 2:')) {
    const link = document.createElement('a');
    link.href = '/gym/intake-protocol';
    link.textContent = 'Intake protocol';
    node.append(' ', link);
  }
}
document.getElementById('covenant-body')?.append(charter, clarifications());
