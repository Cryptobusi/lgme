export const COVENANT_TITLE = 'How this applies in the Health community (draft clarifications, pending owner approval)';

export const CLARIFICATIONS = Object.freeze([
  "Open Audit (Art. 3) covers credit balances and clearing history only. Health and workout progress stays private by default and is shared only by the member's choice (Only me / My groups / Shared board).",
  'Channels (Art. 7): group chats may carry encouragement and journey updates as well as listings; advertising and spam are still barred.',
  'Credit unit (Art. 4): -50 / -200 are in lgme deed credit units; a workout never mints credit.',
  'Fiat and $lgme (Art. 6, 12): US$ or $lgme contributions are voluntary support (10%: 5% Floor, 5% App development fund), not collateral, and never create debt.',
  'Velocity (Art. 11): after 90 days the app gives a gentle reminder and the option to gift surplus to the Floor; no automatic penalty or seizure.',
  'Identity: legal name and signature stay on the member\'s phone; only a hash of the signed covenant is anchored (Hedera testnet), never the name. A handle is used in the app.',
  'Geography (Art. 10): health club exchanges are local; remote help (e.g. coaching by video) is allowed as non-core.',
  'Not medical advice; members exercise at their own risk and may stop anytime.',
  "Fitness coaching/personal training delivered in person and measured in session-hours counts as direct professional labor, not 'speculative coaching'.",
  "Using club-owned equipment under the member's own paid-up membership counts as unencumbered access.",
  "'Admissions stewards' are, until defined, the two sponsors.",
  'If only one offering passes, the member gets Tier-0 rather than rejection.'
]);

export const FIELD_LABELS = Object.freeze([
  'Primary offering',
  'Secondary offering',
  'Member legal name',
  'Signature',
  'Date',
  'Sponsor 1 signature',
  'Sponsor 1 date',
  'Sponsor 2 signature',
  'Sponsor 2 date'
]);

const PRIVATE_KEYS = ['legalName', 'signature', 'legal'];

export function covenantText(raw) {
  return String(raw || '').replace(/\r\n/g, '\n').replace(/\n$/, '');
}

export function covenantSections(raw) {
  const text = covenantText(raw);
  const lines = text.split('\n');
  const section1 = lines.findIndex((line) => line.startsWith('Section 1:'));
  const section2 = lines.findIndex((line) => line.startsWith('Section 2:'));
  if (section1 < 1 || section2 <= section1) return { ok: false, error: 'The covenant text is missing a section.' };
  return {
    ok: true,
    preamble: lines.slice(0, section1).join('\n'),
    articles: lines.slice(section1, section2).join('\n'),
    section2: lines.slice(section2).join('\n')
  };
}

export function canonicalSigned({ text, handle, date, sponsors } = {}) {
  const names = (sponsors || []).map((row) => String(row.handle || row || '').trim()).filter(Boolean).sort();
  return `${covenantText(text)}\nhandle:${String(handle || '').trim()}\ndate:${String(date || '').trim()}\nsponsors:${names.join(',')}`;
}

export async function covenantHash(spec = {}) {
  const bytes = new TextEncoder().encode(canonicalSigned(spec));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function publicCovenant(record = {}) {
  const copy = {};
  for (const [key, value] of Object.entries(record)) {
    if (PRIVATE_KEYS.includes(key)) continue;
    copy[key] = value;
  }
  return copy;
}

export function sponsorStatus(record) {
  const count = (record?.sponsors || []).length;
  if (count >= 2) return `Sponsors signed (${count}/2).`;
  return `Pending sponsors (${count}/2).`;
}

export function circleGate(peer, action) {
  if (peer?.intake?.status) {
    const status = peer.intake.status;
    if (status === 'Tier-1' || status === 'Tier-0') return { ok: true };
    if (action === 'listing' || action === 'credit') {
      const label = status === 'paused' ? 'Application paused' : status;
      return { ok: false, error: `${label}. Outbound credit stays closed.` };
    }
    return { ok: true };
  }
  if (!peer?.covenant) return { ok: true };
  const count = (peer.covenant.sponsors || []).length;
  if (count >= 2) return { ok: true };
  if (action === 'listing' || action === 'credit') {
    return { ok: false, error: `Pending sponsors (${count}/2). Listings and credit stay closed until 2 sponsors sign.` };
  }
  return { ok: true };
}

export function signSponsor(record, sponsorHandle, at = new Date().toISOString().slice(0, 10)) {
  const handle = String(sponsorHandle || '').trim();
  const sponsors = [...(record?.sponsors || [])];
  if (!handle || handle === record?.handle) return { ok: false, error: 'A sponsor is another member.' };
  if (sponsors.some((row) => row.handle === handle)) return { ok: false, error: 'That sponsor already signed.' };
  if (sponsors.length >= 2) return { ok: false, error: 'Two sponsors have signed.' };
  sponsors.push({ handle, at });
  return { ok: true, record: { ...publicCovenant(record), sponsors } };
}

export function openCommitments(peer = {}) {
  const listings = Object.values(peer.listings || {}).filter((row) => row.status === 'active').map((row) => row.title).filter(Boolean);
  const deeds = Object.values(peer.deeds || peer.posts || {}).filter((row) => row && row.status && row.status !== 'cleared').map((row) => row.title || row.summary || 'Open delivery');
  return [...listings, ...deeds];
}

export function exitReceipt({ handle, balance, commitments = [], date } = {}) {
  const figure = Number(balance);
  const amount = Number.isFinite(figure) ? figure.toFixed(2) : '0.00';
  return [
    'Bilateral exit receipt',
    `Handle: ${String(handle || '').trim()}`,
    `Balance: ${amount}`,
    `Open commitments: ${commitments.length ? commitments.join('; ') : 'none'}`,
    'Exit completes when the balance is 0.00, open deliveries are fulfilled, and the other party signs this receipt.',
    `Date: ${String(date || '').trim()}`
  ].join('\n');
}

const DAY = 24 * 60 * 60 * 1000;

export function velocityNote(balance, openedAt, now = Date.now()) {
  const figure = Number(balance);
  const opened = Date.parse(openedAt || '');
  if (!(figure > 0) || !Number.isFinite(opened)) return '';
  if (now - opened < 90 * DAY) return '';
  return 'A surplus has been here for 90 days. You can spend it with a member, or gift it to the Floor. Nothing is taken automatically.';
}

export function acceptsCovenant(body = {}) {
  if (PRIVATE_KEYS.some((key) => body[key] != null && body[key] !== '')) {
    return { ok: false, error: 'Legal name and signature stay on the phone.' };
  }
  const handle = String(body.handle || '').trim();
  const token = String(body.token || '').trim();
  const date = String(body.date || '').trim();
  const hash = String(body.hash || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{2,24}$/.test(handle)) return { ok: false, error: 'Use a handle.' };
  if (!/^[0-9a-f-]{16,80}$/i.test(token)) return { ok: false, error: 'That sponsor link is not usable.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Add the date.' };
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, error: 'The covenant hash is not usable.' };
  return { ok: true, record: { token, handle, date, hash, sponsors: Array.isArray(body.sponsors) ? body.sponsors.slice(0, 2) : [] } };
}
