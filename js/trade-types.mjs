export const TRADE_TYPES = Object.freeze([
  'listed',
  'matched',
  'confirmed',
  'receipt',
  'declined',
  'cancelled',
  'expired',
  'disputed-open',
  'disputed-resolved',
  'partial',
  'repeat',
  'circle-rsvp',
  'circle-checkin',
  'attester-suggest',
  'pool-sponsored',
  'self-paid'
]);

const NEXT = Object.freeze({
  listed: ['listed', 'matched', 'declined', 'cancelled', 'expired', 'partial', 'repeat', 'circle-rsvp', 'disputed-open'],
  matched: ['matched', 'confirmed', 'partial', 'declined', 'cancelled', 'expired', 'disputed-open', 'circle-checkin', 'repeat'],
  partial: ['partial', 'confirmed', 'receipt', 'cancelled', 'expired', 'disputed-open'],
  confirmed: ['confirmed', 'receipt', 'partial', 'disputed-open', 'pool-sponsored', 'self-paid', 'attester-suggest', 'repeat'],
  receipt: ['receipt', 'repeat', 'disputed-open', 'circle-checkin', 'pool-sponsored', 'self-paid'],
  'circle-rsvp': ['circle-rsvp', 'circle-checkin', 'cancelled', 'declined'],
  'circle-checkin': ['circle-checkin', 'attester-suggest', 'confirmed', 'receipt'],
  'attester-suggest': ['attester-suggest', 'confirmed', 'receipt'],
  'pool-sponsored': ['pool-sponsored', 'receipt', 'confirmed'],
  'self-paid': ['self-paid', 'receipt', 'confirmed'],
  'disputed-open': ['disputed-open', 'disputed-resolved'],
  'disputed-resolved': ['disputed-resolved'],
  declined: ['declined'],
  cancelled: ['cancelled', 'expired'],
  expired: ['expired', 'cancelled'],
  repeat: ['repeat', 'listed', 'matched']
});

export function tradeTypeOf(item = {}) {
  const named = String(item.type || '').toLowerCase();
  if (TRADE_TYPES.includes(named)) return named;
  const text = `${item.status || ''} ${item.path || ''}`.toLowerCase();
  if (text.startsWith('claimed by') || text.includes('claimed by')) return 'claimed';
  if (/pool-sponsor|pool sponsored/.test(text)) return 'pool-sponsored';
  if (/self-paid|self paid/.test(text)) return 'self-paid';
  if (/circle-attest|check-?in|checkin/.test(text)) return 'circle-checkin';
  if (/rsvp/.test(text)) return 'circle-rsvp';
  if (/attester|attest/.test(text)) return 'attester-suggest';
  if (/disputed-resolved|dispute resolved|resolved/.test(text)) return 'disputed-resolved';
  if (/disputed|disputed-open|\bopen\b/.test(text)) return 'disputed-open';
  if (/expired|cancelled-expired/.test(text)) return 'expired';
  if (/cancelled/.test(text)) return 'cancelled';
  if (/declined/.test(text)) return 'declined';
  if (/repeat/.test(text)) return 'repeat';
  if (/partial/.test(text)) return 'partial';
  if (/receipt|ididit|finished|\bdone\b/.test(text)) return 'receipt';
  if (/confirmed/.test(text)) return 'confirmed';
  if (/matched/.test(text)) return 'matched';
  if (/unclaimed|listed|author|example/.test(text)) return 'listed';
  return '';
}

export function tradeMove(fromType, toType) {
  const from = String(fromType || '');
  const to = String(toType || '');
  if (!to) return { ok: false, error: 'That trade type is missing.' };
  if (!TRADE_TYPES.includes(to)) return { ok: false, error: 'That trade type is not allowed.' };
  if (!from || from === 'claimed') return { ok: true };
  if (from === to) return { ok: true };
  const allowed = NEXT[from] || [];
  if (!allowed.includes(to)) return { ok: false, error: 'That trade type cannot follow the current one.' };
  return { ok: true };
}

export function typeCounts(rows = []) {
  const counts = Object.fromEntries(TRADE_TYPES.map((type) => [type, 0]));
  for (const row of rows) {
    const type = row.trade || (TRADE_TYPES.includes(row) ? row : tradeTypeOf(row));
    if (counts[type] != null) counts[type] += 1;
  }
  return counts;
}
