const BANNED = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\blatitude\b|\blongitude\b/i;

export function sharedListingsEnabled(env = {}) {
  return env.SHARED_LISTINGS_TESTNET === 'on'
    && env.HEDERA_TESTNET_ANCHOR === 'on'
    && String(env.HEDERA_TESTNET_OPERATOR_ID || '').trim()
    && String(env.HEDERA_TESTNET_OPERATOR_KEY || '').trim();
}

export function listingMessage(spec = {}) {
  const item = spec.item || {};
  const body = {
    v: 1,
    kind: spec.kind || 'listing',
    id: String(spec.id || ''),
    author: spec.author || null,
    item: {
      completed: item.completed === true,
      day: String(item.day || ''),
      category: String(item.category || ''),
      evidence: String(item.evidence || ''),
      terms: String(item.terms || '')
    },
    status: spec.status || 'open',
    prev: String(spec.prev || '')
  };
  if (!body.id || !body.author) return { ok: false, error: 'A shared listing needs an id and the author key.' };
  if (!['listing', 'update', 'withdrawal'].includes(body.kind)) return { ok: false, error: 'Unknown listing message.' };
  if (BANNED.test(JSON.stringify(body.item)) || BANNED.test(body.prev)) {
    return { ok: false, error: 'A shared listing cannot carry personal data.' };
  }
  return { ok: true, body };
}

export function withinRate(stamps, now, limit = 10, windowMs = 60 * 60 * 1000) {
  const recent = (stamps || []).filter((stamp) => now - stamp < windowMs);
  return { ok: recent.length < limit, recent };
}

export const OPERATOR_RULES = 'Hedera testnet only. No names, emails, phones, health details, or location. Balances and keys stay off the topic. Solana settlement is unchanged. At most 10 listing messages an hour for each author.';

export async function mountSharedListingNote(host) {
  if (!host) return;
  const note = document.createElement('p');
  note.className = 'legend';
  note.textContent = 'Hedera testnet. Shared listings are off. This session stays on this device.';
  host.replaceChildren(note);
  try {
    const response = await fetch('/api/hedera/listings');
    const body = await response.json();
    if (body.enabled) note.textContent = `Hedera testnet. ${body.rules || OPERATOR_RULES}`;
  } catch {
    note.textContent = 'Hedera testnet. Shared listings are off. This session stays on this device.';
  }
}
