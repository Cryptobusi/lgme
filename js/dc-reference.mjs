export const REFERENCE_LABEL = 'simulation reference values';

const MONTH = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/i;

export function averagedReference(item) {
  const value = item ? item.avg_value_usd : null;
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

export function itemAsOf(item, catalog) {
  if (item && typeof item.as_of === 'string' && item.as_of.trim()) return item.as_of.trim();
  const written = `${item?.note || ''} ${(item?.sources || []).join(' ')}`;
  const found = written.match(MONTH);
  if (found) return found[0];
  if (catalog && typeof catalog.date === 'string' && catalog.date.trim()) return catalog.date.trim();
  return '';
}

export function referenceLine(item, catalog = {}) {
  const avg = averagedReference(item);
  const pending = avg == null;
  const unit = item?.unit ? ` per ${item.unit}` : '';
  const value = pending ? 'pending' : `${avg} USD${unit}`;
  const sources = Array.isArray(item?.sources) && item.sources.length ? item.sources.join('; ') : 'pending';
  const asOf = itemAsOf(item, catalog) || 'pending';
  const name = item?.name || 'Item';
  return {
    label: REFERENCE_LABEL,
    name,
    value,
    pending,
    sources,
    asOf,
    text: `${REFERENCE_LABEL}. ${name}: ${value}. As of ${asOf}. Sources: ${sources}.`
  };
}

export function optionLabel(item, catalog) {
  const line = referenceLine(item, catalog);
  return line.pending ? `${line.name} — pending` : `${line.name} — ${line.value}`;
}
