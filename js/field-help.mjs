export function fieldMeta(field) {
  if (!field || typeof field.getAttribute !== 'function') return null;
  if (field.closest && field.closest('#ai-dock')) return null;
  const help = String(field.getAttribute('data-help') || '').trim();
  const options = String(field.getAttribute('data-options') || '').split('|').map((item) => item.trim()).filter(Boolean);
  if (!help && !options.length) return null;
  return { help: help || 'Fill this in. It stays on this phone until you confirm.', options };
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
    if (el.closest && el.closest('#ai-dock')) return false;
    return el.hasAttribute('data-help') || el.hasAttribute('data-options') || el.required;
  });
  const index = list.indexOf(field);
  if (index < 0) return null;
  return list[index + 1] || null;
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
