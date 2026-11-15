const ACTIONS = new Set(['prefill', 'ididit', 'category-draft']);
const BAD = /<\s*script|javascript:|function\s*\(|=>|eval\s*\(|url\s*\(|@/i;

function plain(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > max || BAD.test(text)) return '';
  return text;
}

export function validateLocalFunction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'A local function is data only.' };
  if (BAD.test(JSON.stringify(input))) return { ok: false, error: 'Local functions cannot contain code.' };
  const action = ACTIONS.has(input.action) ? input.action : '';
  const label = plain(input.label, 40);
  const prompt = plain(input.prompt, 160);
  if (!action || !label || !prompt) return { ok: false, error: 'Use a plain label, a prompt, and an allowed action.' };
  const fields = {};
  if (action === 'ididit') {
    fields.activity = plain(input.fields?.activity, 40);
    fields.minutes = Math.max(0, Math.round(Number(input.fields?.minutes) || 0));
  }
  if (action === 'category-draft') fields.category = plain(input.fields?.category, 40);
  return { ok: true, item: { id: plain(input.id, 40) || `local-${label.toLowerCase().replace(/\s+/g, '-')}`, label, prompt, action, fields, local: true } };
}

export function localFunctionFromPrompt(text) {
  const raw = String(text || '').trim();
  if (!/^add a button\b/i.test(raw)) return null;
  const minutes = (raw.match(/(\d+)\s*(?:min|minutes)\b/i) || [])[1];
  const activity = /\bwalk\b/i.test(raw) ? 'Walk' : '';
  return validateLocalFunction({
    label: activity ? `Usual ${activity.toLowerCase()}` : 'My shortcut',
    prompt: raw.replace(/^add a button that\s+/i, ''),
    action: 'ididit',
    fields: { activity, minutes: Number(minutes) || 0 }
  });
}

const KEY = 'lgme.local.functions';

export function readLocalFunctions(storage) {
  try {
    const rows = JSON.parse(storage.getItem(KEY) || '[]');
    return rows.map((row) => validateLocalFunction(row)).filter((row) => row.ok).map((row) => row.item);
  } catch {
    return [];
  }
}

export function saveLocalFunction(storage, item) {
  const checked = validateLocalFunction(item);
  if (!checked.ok) return checked;
  const rows = readLocalFunctions(storage).filter((row) => row.id !== checked.item.id);
  rows.push(checked.item);
  storage.setItem(KEY, JSON.stringify(rows));
  return { ok: true, item: checked.item, sent: false };
}

export function deleteLocalFunction(storage, id) {
  const rows = readLocalFunctions(storage).filter((row) => row.id !== id);
  storage.setItem(KEY, JSON.stringify(rows));
  return { ok: true };
}

export function exportLocalFunctions(storage) {
  return JSON.stringify(readLocalFunctions(storage));
}

export function importLocalFunctions(storage, json) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) return { ok: false, error: 'Import a list of local functions.' };
  const kept = [];
  for (const row of parsed) {
    const checked = validateLocalFunction(row);
    if (!checked.ok) return checked;
    kept.push(checked.item);
  }
  storage.setItem(KEY, JSON.stringify(kept));
  return { ok: true, items: kept, sent: false };
}
