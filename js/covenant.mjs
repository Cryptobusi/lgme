export const COVENANT_TITLE = 'How this applies in the Health community (draft clarifications, pending owner approval)';

export const CLARIFICATIONS = Object.freeze([
  "Open Audit (Art. 3) covers credit balances and clearing history only. Health and workout progress stays private by default and is shared only by the member's choice (Only me / My groups / Shared board).",
  'Channels (Art. 7): group chats may carry encouragement and journey updates as well as listings; advertising and spam are still barred.',
  'Credit unit (Art. 4): -50 / -200 are in lgme deed credit units; a workout never mints credit.',
  'Fiat and $lgme (Art. 6, 12): US$ or $lgme contributions are voluntary support (10%: 5% Floor, 5% App development fund), not collateral, and never create debt.',
  'Velocity (Art. 11): after 90 days the app gives a gentle reminder and the option to gift surplus to the Floor; no automatic penalty or seizure.',
  'Identity: legal name and signature stay on the member\'s phone. The name is not published. Nothing is anchored or written to Hedera. A handle is used in the app.',
  'Geography (Art. 10): health club exchanges are local; remote help (e.g. coaching by video) is allowed as non-core.',
  'Not medical advice; members exercise at their own risk and may stop anytime.',
  "Fitness coaching/personal training delivered in person and measured in session-hours counts as direct professional labor, not 'speculative coaching'.",
  "Using club-owned equipment under the member's own paid-up membership counts as unencumbered access.",
  "Admissions Steward: by default, a trainer in the group; any member may opt in as a trainer. If a group has one trainer, that trainer is the default steward; if several, the group picks (default: the earliest trainer to join that group); if none, the group creator. The steward can be changed: the group (or club admin) may reassign it to another Tier-1 member who has cleared their balance at least once, and an applicant may request a different steward if the default one sponsored them or has a conflict. Stewards apply the 5 gates consistently, break a split between sponsors, approve credit-limit raises toward -200, and handle mediation after bilateral resolution fails. A steward never reviews someone they sponsored and receives no credit or perks for the role.",
  'If only one offering passes, the member gets Tier-0 rather than rejection.',
  'Over $100: US$ support, $lgme valued at the GeckoTerminal price stored on the entry, and deed credit (one unit counted as $1) stay pending until 3 other members sign with their device keys. Entries between the same two members within 24 hours are added together. No credit and no Floor skim move until the third signature. Either party can withdraw while it is pending. The app suggests a third attester: the group administrator, otherwise the earliest trainer, otherwise the group creator, skipping the two parties. The parties may choose another member. Those signatures stay on the phones that made them. Nothing is anchored or written to Hedera. This clarification is a draft and is not part of the covenant text.',
  'Dispute rehearsal (draft, pending owner approval): opening a dispute starts steward mediation. The steward is the trainer, otherwise the administrator, otherwise the group author, skipping the parties. The dispute note stays on the phone. Nothing is anchored or written to Hedera. It does not freeze the Floor, halt clearing, or move credit. A pending entry stays pending. If mediation fails, either party may ask for a rehearsal panel of 3. The first seat follows the group administrator, then the trainer, then the group author. The other seats are drawn from members with completed IdidIt (verified receipt) exchanges. A workout does not count. Testnet uses 1 completed exchange. The later target is 10. The draw uses the SHA-384 running hash, version 3, 48 bytes, from that dispute message or that day\'s root, with rejection sampling. A 2-of-3 device-signed verdict is advisory. The choices are a write-down, mutual nullification, or no change. Both parties confirm before anything is noted. There is no public fault mark. Names, statements, and findings stay on the phone unless both parties consent. Only the verdict hash is queued. Use of lgme.app is 100% voluntary. No liability coverage of any kind is provided by the app, its authors, stewards, trainers, sponsors, attesters, or panelists. Disputes are resolved by mutual agreement between the people involved, with the Third Seat as each person\'s own seat (per the 13-clause Third Seat article), unless local jurisdiction statutes govern the civil duties involved. The Third Seat does not replace a court. This is a testnet rehearsal. Testnet can reset. This clarification is a draft and is not part of the covenant text.'
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

export function sponsorInGroup(peer, sponsor) {
  if (!sponsor) return false;
  if (sponsor.inGroup === true) return true;
  const groups = peer?.clubGroups || {};
  if (sponsor.group && groups[sponsor.group]) return true;
  const handle = String(sponsor.handle || '');
  return Object.values(groups).some((group) => group?.creator && group.creator === handle);
}

export function sponsorStatus(record) {
  const count = (record?.sponsors || []).length;
  const group = (record?.sponsors || []).some((sponsor) => sponsor.inGroup === true);
  if (count >= 2 && group) return `Sponsors: ${count}.`;
  if (count >= 2) return `Sponsors: ${count}. One must be from your group.`;
  return `Sponsors: ${count}. At least 2, including one from your group.`;
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
  const group = (peer.covenant.sponsors || []).some((sponsor) => sponsorInGroup(peer, sponsor));
  if (count >= 2 && group) return { ok: true };
  if (action === 'listing' || action === 'credit') {
    const error = count < 2
      ? `Sponsors: ${count}. At least 2 sponsors, including one from your group.`
      : `Sponsors: ${count}. One sponsor must be from your group. The group creator may sponsor you.`;
    return { ok: false, error };
  }
  return { ok: true };
}

export function signSponsor(record, sponsorHandle, at = new Date().toISOString().slice(0, 10)) {
  const meta = at && typeof at === 'object' ? at : { at };
  const when = meta.at || new Date().toISOString().slice(0, 10);
  const handle = String(sponsorHandle || '').trim();
  const sponsors = [...(record?.sponsors || [])];
  if (!handle || handle === record?.handle) return { ok: false, error: 'A sponsor is another member.' };
  if (sponsors.some((row) => row.handle === handle)) return { ok: false, error: 'That sponsor already signed.' };
  sponsors.push({ handle, at: when, inGroup: meta.inGroup === true });
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
  const sponsors = Array.isArray(body.sponsors) ? body.sponsors.flatMap((row) => {
    const name = String(row?.handle || row || '').trim();
    if (!/^[a-z0-9-]{2,24}$/.test(name)) return [];
    return [{ handle: name, at: String(row?.at || '').slice(0, 10), inGroup: row?.inGroup === true }];
  }) : [];
  return { ok: true, record: { token, handle, date, hash, sponsors } };
}
