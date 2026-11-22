import { helpOverride } from './variant-schema.mjs';

const LAST_KEY = 'lgme.field.last';
const LAST_PRIVATE = 'lgme.field.last.incognito';

const CUSTOM = {
  'donate-kind': ['What you are giving.', 'Item, Creo, or $lgme.', 'Nothing is saved until you tap OK. Testnet only.', ['Item', 'Creo', '$lgme']],
  'donate-name': ['The name of the gift.', 'A short title.', 'This names the gift, not a person. Nothing is saved until you tap OK.', ['A spare lamp', 'Garden tools', 'A book']],
  'donate-amount': ['How much you are giving.', 'A number in US$ or Creo, matching what you chose.', 'The Floor split is 50/50. Nothing is paid until you tap OK. Testnet only.', ['1', '5', '10']],
  'contrib-usd': ['A $lgme contribution counted in US$.', 'US$.', 'The Floor split is 50/50. $lgme is temporary until the DAO. OK is required.', ['1', '5', '10']],
  'item-name': ['The inventory name.', 'A short title.', 'This stays on this phone. Nothing is kept until you tap OK.', ['Lamp', 'Bicycle', 'Toolbox']],
  'item-category': ['The inventory category.', 'A short word.', 'Health is the only open category. Nothing is kept until you tap OK.', ['Home', 'Tools', 'Kitchen']],
  'item-qty': ['How many you have.', 'A whole number.', 'This stays on this phone until you tap OK.', ['1', '2', '4']],
  'item-price': ['What you paid.', 'US$.', 'This is not an appraisal. Nothing is kept until you tap OK.', ['10', '25', '40']],
  'ihavit-name': ['The name of the thing you have.', 'A short title.', 'It stays on this phone. Nothing is kept until you tap OK.', ['Lamp', 'Drill', 'Jacket']],
  'ihavit-category': ['The kind of thing.', 'A short word.', 'Health is the only open category. Nothing is kept until you tap OK.', ['Home', 'Tools', 'Clothes']],
  'ihavit-price': ['What you paid.', 'US$.', 'This is not an appraisal. Nothing is kept until you tap OK.', ['12', '30', '45']],
  'ihavit-condition': ['The condition of the thing.', 'new, like new, good, fair, or poor.', 'Nothing is kept until you tap OK.', ['good', 'like new', 'fair']],
  'ihavit-notes': ['A serial or a note.', 'A short line.', 'The file stays on this phone. Nothing is kept until you tap OK.', ['Serial on the tag', 'Works', 'Needs a bulb']],
  'ididit-input': ['What you did.', 'A plain sentence. Creo is the value you create.', 'OK is required before anything is saved. Testnet only.', ['Walked 20 minutes', 'Tutored for 30 minutes', 'Fixed a lamp']],
  'inventory-q': ['Search the inventory.', 'Words from a name or a place.', 'The list stays on this phone.', ['Lamp', 'Kitchen', 'Tools']],
  'ihavit-q': ['Search your things and manuals.', 'Words from a name.', 'The list stays on this phone.', ['Lamp', 'Manual', 'Drill']]
};

function lineOf(field, name) {
  if (!field || typeof field.getAttribute !== 'function') return '';
  return String(field.getAttribute(name) || '').trim();
}

function labelOf(field) {
  if (!field) return '';
  if (field.labels && field.labels[0]) return String(field.labels[0].textContent || '').trim();
  const id = field.id || lineOf(field, 'id');
  if (id && typeof document !== 'undefined' && document.querySelector) {
    const lab = document.querySelector(`label[for="${id}"]`);
    if (lab) return String(lab.textContent || '').trim();
  }
  return lineOf(field, 'aria-label');
}

export function isPersonalField(spec = {}) {
  const blob = `${spec.id || ''} ${spec.autocomplete || ''} ${spec.type || ''} ${spec.label || ''} ${spec.placeholder || ''}`;
  if (/email|e-mail/i.test(blob)) return true;
  if (/phone|\btel\b/i.test(blob)) return true;
  if (/(^|\s)(your name|legal name|full name)(\s|$)/i.test(blob)) return true;
  if (spec.autocomplete && /^(name|given-name|family-name|email|tel)$/i.test(spec.autocomplete)) return true;
  return false;
}

function pack(what, format, rules, examples) {
  return { what, format, rules, examples: examples.filter(Boolean).slice(0, 3) };
}

function customGuide(id) {
  if (CUSTOM[id]) return pack(...CUSTOM[id]);
  if (/^ihavit-/.test(id)) return pack('A detail of something you have.', 'Plain text, a date, or US$.', 'It stays on this phone. Nothing is kept until you tap OK.', ['Lamp', 'Home', '12']);
  if (/^item-/.test(id)) return pack('An inventory detail.', 'Plain text, a count, or US$.', 'The CSV stays on this phone. Nothing is kept until you tap OK.', ['Lamp', '1', '10']);
  if (/listing|list-title|list-price|offer-/.test(id)) return pack('A listing detail.', 'A title, a condition, or US$.', 'Send the hash only. The file stays on the phone. OK is required. Testnet only.', ['Bicycle', 'Good', '40']);
  if (/attest/.test(id)) return pack('An attestation of this receipt.', 'A short confirmation.', 'Over $100 needs 3 independent device signatures. Over $1,000 in a day also needs administrator approval. Nothing approves itself.', ['I saw this', 'The amount matches', 'I was there']);
  if (/ididit|deed|good-deed/.test(id)) return pack('What you did.', 'A plain sentence. Creo is the value you create.', 'OK is required before anything is saved. Testnet only.', ['Walked 20 minutes', 'Tutored for 30 minutes', 'Fixed a lamp']);
  return null;
}

function genericGuide(spec) {
  const label = spec.label || spec.placeholder || 'This field';
  const type = spec.type || 'text';
  if (spec.help) return pack(spec.help, spec.placeholder || 'Plain text.', 'It stays on this phone until you tap OK. Nothing is sent by itself.', spec.options.length ? spec.options : ['A short note', 'On this phone']);
  if (isPersonalField(spec)) {
    const kind = /email/i.test(`${spec.type} ${spec.label} ${spec.autocomplete}`) ? 'an email address' : /phone|tel/i.test(`${spec.type} ${spec.label} ${spec.autocomplete}`) ? 'a phone number' : 'a name';
    return pack(`${label} is ${kind}.`, kind === 'an email address' ? 'name@example.com' : kind === 'a phone number' ? 'A phone number' : 'Letters you type yourself.', 'Nothing is filled in until you tap an example. Nothing is emailed. OK is still required to save.', kind === 'an email address' ? ['ada@example.com', 'bo@example.com'] : kind === 'a phone number' ? ['2025550100', '4155550100'] : ['Ada', 'Bo']);
  }
  if (type === 'date') return pack(`${label} is a date.`, 'A calendar date.', 'It stays on this phone until you tap OK.', ['2026-11-01', '2026-11-18']);
  if (type === 'number' || spec.inputmode === 'decimal' || spec.inputmode === 'numeric' || /amount|price|usd|\$lgme|creo/i.test(`${label} ${spec.placeholder} ${spec.id}`)) {
    return pack(`${label} is an amount.`, /creo/i.test(label) ? 'Creo.' : 'US$.', 'The Floor split is 50/50 when a contribution is recorded. Nothing is paid until you tap OK. Testnet only.', ['1', '5', '10']);
  }
  if (type === 'select' && spec.options.length) return pack(`${label} is a choice.`, 'One of the listed choices.', 'Nothing is saved until you tap OK.', spec.options);
  if (type === 'textarea') return pack(`${label} is a longer note.`, 'A few plain sentences.', 'It stays on this phone until you tap OK.', ['A short note', 'On this phone', 'Ready to review']);
  return pack(`${label} is filled in here.`, spec.placeholder || 'Plain text.', 'It stays on this phone until you tap OK. Nothing is sent by itself.', spec.options.length ? spec.options : ['A short note', 'On this phone']);
}

export function fieldGuide(spec = {}) {
  const guide = customGuide(spec.id || '') || genericGuide(spec);
  const personal = isPersonalField(spec);
  return {
    ...guide,
    personal,
    help: [guide.what, guide.format, guide.rules].filter(Boolean).join(' '),
    options: guide.examples
  };
}

export function fieldSpec(field) {
  if (!field || typeof field.getAttribute !== 'function') return null;
  if (field.closest && field.closest('#ai-dock, #field-hint')) return null;
  const tag = String(field.tagName || '').toUpperCase();
  if (tag && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return null;
  const type = field.type || lineOf(field, 'type') || (tag === 'TEXTAREA' ? 'textarea' : tag === 'SELECT' ? 'select' : 'text');
  if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'file') return null;
  const id = field.id || lineOf(field, 'id');
  const optionNodes = field.options ? [...field.options] : [];
  const options = String(lineOf(field, 'data-options')).split('|').map((item) => item.trim()).filter(Boolean);
  const listed = optionNodes.map((item) => String(item.textContent || item.value || '').trim()).filter((item) => item && item !== 'None');
  return {
    id,
    type,
    inputmode: lineOf(field, 'inputmode'),
    placeholder: lineOf(field, 'placeholder'),
    autocomplete: lineOf(field, 'autocomplete'),
    label: labelOf(field),
    help: helpOverride(id) || lineOf(field, 'data-help'),
    options: options.length ? options : listed
  };
}

export function fieldMeta(field) {
  const spec = fieldSpec(field);
  if (!spec) return null;
  const guide = fieldGuide(spec);
  return {
    ...guide,
    help: spec.help || guide.what,
    text: [spec.help, guide.help].filter((line, index, all) => line && all.indexOf(line) === index).join(' '),
    options: spec.options.length ? spec.options : guide.options
  };
}

export function lastFieldKey(incognito) {
  return incognito ? LAST_PRIVATE : LAST_KEY;
}

export function rememberFieldValue(storage, id, value, incognito = false) {
  if (!storage || !id) return;
  const text = String(value || '').trim();
  if (!text) return;
  let bag = {};
  try { bag = JSON.parse(storage.getItem(lastFieldKey(incognito)) || '{}') || {}; } catch { bag = {}; }
  bag[id] = text.slice(0, 120);
  storage.setItem(lastFieldKey(incognito), JSON.stringify(bag));
}

export function lastFieldValue(storage, id, incognito = false) {
  if (!storage || !id) return '';
  try {
    const bag = JSON.parse(storage.getItem(lastFieldKey(incognito)) || '{}') || {};
    return String(bag[id] || '');
  } catch { return ''; }
}

export function applyFieldOption(field, option) {
  if (!field) return;
  if (field.type === 'checkbox' || field.type === 'radio') {
    field.checked = true;
  } else {
    field.value = option;
  }
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

export function nextHelpField(field, root = document) {
  const list = [...root.querySelectorAll('input, textarea, select')].filter((el) => {
    if (el.disabled || el.type === 'hidden' || el.readOnly) return false;
    if (el.closest && el.closest('#ai-dock, #field-hint')) return false;
    if (typeof el.getAttribute === 'function') return Boolean(fieldSpec(el));
    return el.hasAttribute?.('data-help') || el.hasAttribute?.('data-options') || el.required;
  });
  const index = list.indexOf(field);
  if (index < 0) return null;
  return list[index + 1] || null;
}

export function nextFormTarget(field) {
  if (!field || typeof field.closest !== 'function') return null;
  const scope = field.closest('form') || field.closest('section') || (typeof document !== 'undefined' ? document : null);
  if (!scope || typeof scope.querySelectorAll !== 'function') return null;
  const fields = [...scope.querySelectorAll('input, textarea, select')].filter((el) => {
    if (el.disabled || el.type === 'hidden' || el.readOnly) return false;
    if (el.closest && el.closest('#ai-dock, #field-hint')) return false;
    return Boolean(fieldSpec(el));
  });
  const later = fields.slice(Math.max(0, fields.indexOf(field) + 1));
  const empty = later.find((el) => el.type !== 'checkbox' && el.type !== 'radio' && !String(el.value || '').trim());
  if (empty) return empty;
  if (later[0]) return later[0];
  const buttons = [...scope.querySelectorAll('button')];
  return buttons.find((button) => {
    if (button.disabled || (button.closest && button.closest('#ai-dock, #field-hint'))) return false;
    const text = String(button.textContent || '').trim().toLowerCase();
    return text === 'ok' || text === 'confirm' || text === 'propose' || button.type === 'submit';
  }) || null;
}

const MEDICAL = /\b(diagnos\w*|prescription|treatment|cure)\b/i;

export function safeHelpLine(text, fallback) {
  const line = String(text || '').replace(/\s+/g, ' ').trim();
  if (!line || MEDICAL.test(line)) return fallback;
  return line;
}

export function fieldLines(help) {
  const line = safeHelpLine(help, 'Fill this in. It stays on this phone until you confirm.');
  return [line, 'Tap an option to fill this. Nothing is sent.', 'You can still type in the field.'].join('\n');
}
