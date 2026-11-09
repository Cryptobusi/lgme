/**
 * Hedera testnet catalog for shared listings.
 * Solana payments are a separate rail and never become a listing publication.
 * This module does not read an operator private key and does not default to another app's topic.
 */

export const NETWORK = 'testnet';
export const MIRROR_ORIGIN = 'https://testnet.mirrornode.hedera.com';
export const DRAFT_KEY = 'lgme.public-listing-drafts.v1';
export const USER_ATTEMPT_LIMIT = 5;
export const GLOBAL_ATTEMPT_LIMIT = 40;
export const EXAMPLE_LABEL = 'Example. Not a Hedera listing and not a Solana payment.';
export const SUBMISSIONS_OFF = 'Public listing submission is off. Nothing was reserved, signed, or sent.';

const TOPIC_ID = /^0\.0\.[1-9][0-9]{0,9}$/;
const UNITS = new Set(['lgme', 'campus-credit', 'usd']);
const CATEGORIES = new Set(['college', 'utility', 'goods', 'services', 'other']);
const ACTIONS = new Set(['publish', 'revise', 'unpublish']);
const PUBLIC_FIELDS = new Set(['action', 'listingId', 'title', 'amount', 'unit', 'category', 'expiresAt', 'consent', 'draftId']);
const PRIVATE_FIELDS = ['note', 'notes', 'contact', 'proof', 'identity', 'email', 'phone', 'photo', 'address', 'seed', 'privateKey', 'passphrase'];

const COLLEGE = [
  ['Shared calculus textbook for one semester', 25],
  ['One hour of chemistry tutoring', 20],
  ['Help moving one dorm flight', 30],
  ['Used lab coat, clean', 15],
  ['Print a 40-page paper', 8],
  ['Bike tune before midterms', 18],
  ['Language practice, one hour', 15],
  ['Resume review', 12],
  ['Instrument loan for a recital week', 20],
  ['Study snacks for a group', 10],
  ['Graphing calculator loan for exam week', 10],
  ['Campus walk for a visiting sibling', 15]
];
const UTILITY = [
  ['Mow a small yard', 40],
  ['Haul one pickup of leaves', 35],
  ['Shovel one walk', 30],
  ['Wash the windows on one floor', 45],
  ['Change a furnace filter', 20],
  ['Replace up to six bulbs', 15],
  ['Clear a slow kitchen drain', 50],
  ['Paint one side of a fence', 60],
  ['Weatherstrip one door', 25],
  ['Replace smoke-detector batteries', 12],
  ['Clear one-story gutters', 55],
  ['Check a washer hose', 20]
];
const GOODS = [
  ['Used desk', 40],
  ['Childcare for two hours', 30],
  ['Haircut', 20],
  ['Used bicycle', 80],
  ['Loaf of bread', 6],
  ['Hem one pair of pants', 12],
  ['Help moving four boxes', 25],
  ['Soup for a neighbor', 8],
  ['Drill loan for one afternoon', 10],
  ['Pet sit for one evening', 25],
  ['Repair a loose chair joint', 30],
  ['Houseplant cuttings', 5]
];

function text(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function examples(category, rows) {
  return rows.map(([title, amount], index) => Object.freeze({
    id: `example-${category}-${index + 1}`,
    category,
    title,
    amount,
    unit: 'usd',
    label: EXAMPLE_LABEL,
    shared: false,
    consensus: false,
    hederaListing: false,
    solanaPayment: false
  }));
}

export const LISTING_EXAMPLES = Object.freeze([
  ...examples('college', COLLEGE),
  ...examples('utility', UTILITY),
  ...examples('goods', GOODS)
]);

export function exampleCounts() {
  return { college: 12, utility: 12, goods: 12 };
}

export function readPublicConfig(env) {
  const source = env || {};
  return {
    network: source.HEDERA_NETWORK,
    topicId: source.HEDERA_TOPIC_ID,
    submissionsFlag: source.HEDERA_PUBLIC_SUBMISSIONS,
    operatorIdSet: Boolean(source.HEDERA_OPERATOR_ID)
  };
}

export function publicStatus(env) {
  const config = readPublicConfig(env);
  const network = config.network === NETWORK ? NETWORK : 'unconfigured';
  const topicOk = TOPIC_ID.test(String(config.topicId || '').trim());
  const readable = network === NETWORK && topicOk;
  const reasons = [];
  if (String(config.network || '').toLowerCase() === 'mainnet') reasons.push('Mainnet was rejected.');
  if (network !== NETWORK) reasons.push('HEDERA_NETWORK is not testnet.');
  if (!topicOk) reasons.push('HEDERA_TOPIC_ID is not set to a testnet topic for this site.');
  reasons.push('Public listing submission is off unless every server prerequisite is present.');
  reasons.push('A browser passkey is not a server session.');
  reasons.push('No database is configured for attempt limits.');
  reasons.push('The signing client is not loaded. An operator private key is not read.');
  return {
    ok: true,
    network,
    topic: readable ? String(config.topicId).trim() : null,
    submissions: 'off',
    catalog: readable ? 'configured' : 'unconfigured',
    operatorIdPresent: config.operatorIdSet,
    testnetListings: true,
    solanaPayments: 'separate-wallet-rail',
    campusCredits: 'not-lgme',
    activationFlag: config.submissionsFlag === 'true',
    hederaVerified: false,
    reasons
  };
}

export function validateTopicPermissions(info) {
  if (!info || typeof info !== 'object') return { ok: false, error: 'Topic permissions were not checked.' };
  if (Object.keys(info).some((key) => /private|secret|seed|mnemonic/i.test(key))) {
    return { ok: false, error: 'Topic checks do not accept a private key.' };
  }
  if (info.network !== NETWORK) return { ok: false, error: 'Topic network is not testnet.' };
  if (!TOPIC_ID.test(String(info.topicId || ''))) return { ok: false, error: 'Topic id is not a testnet topic id.' };
  if (!info.adminKey || !info.submitKey) return { ok: false, error: 'The topic needs an admin key and a submit key.' };
  if (!info.operatorAccountId || !TOPIC_ID.test(info.operatorAccountId)) return { ok: false, error: 'Operator account id is missing.' };
  if (!info.operatorPublicKey || info.submitKey !== info.operatorPublicKey) {
    return { ok: false, error: 'The topic submit key does not match the operator public key.' };
  }
  if (info.accountPublicKey && info.accountPublicKey !== info.operatorPublicKey) {
    return { ok: false, error: 'The account public key does not match the operator public key.' };
  }
  return { ok: true };
}

export function writeDecision(env, adapters = {}) {
  const status = publicStatus(env);
  const missing = [];
  if (status.activationFlag !== true) missing.push('activation-flag');
  if (status.network !== NETWORK || !status.topic) missing.push('testnet-topic');
  const auth = adapters.auth;
  if (!auth || auth.durable !== true || auth.browserPasskey === true || auth.kind === 'email-allowlist' || auth.kind === 'dev-user') {
    missing.push('durable-auth');
  }
  const users = adapters.approvedUsers;
  if (!users || users.durable !== true || users.kind === 'email-allowlist') missing.push('approved-user-ids');
  const db = adapters.db;
  if (!db || db.durable !== true || db.memory === true || typeof db.reserve !== 'function') missing.push('durable-database');
  const signer = adapters.signer;
  if (!signer || signer.loaded !== true || signer.readsPrivateKey === true || signer.fixture === true) missing.push('server-signer');
  const topic = validateTopicPermissions(adapters.topicInfo);
  if (!topic.ok) missing.push('topic-permissions');
  return {
    ok: false,
    open: missing.length === 0,
    status: 403,
    submissions: 'off',
    signed: false,
    submitted: false,
    reserved: false,
    hederaVerified: false,
    error: SUBMISSIONS_OFF,
    missing
  };
}

function decodeUtf8Base64(value) {
  try {
    const binary = atob(String(value || ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export function parseListingMessage(raw) {
  const sequence = Number(raw?.sequence_number);
  const base = {
    sequence: Number.isFinite(sequence) ? sequence : null,
    consensusTimestamp: String(raw?.consensus_timestamp || ''),
    messagePayer: String(raw?.payer_account_id || ''),
    listing: null,
    ignored: '',
    solanaReceipt: false
  };
  let parsed = null;
  try { parsed = JSON.parse(decodeUtf8Base64(raw?.message)); } catch { parsed = null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...base, ignored: 'unparsed' };
  }
  if (parsed.type === 'SOLANA_TX' || parsed.type === 'SOLANA_FINAL' || parsed.kind === 'solana-receipt') {
    return { ...base, solanaReceipt: true, ignored: 'solana-receipt' };
  }
  const keys = Object.keys(parsed);
  if (keys.every((key) => /digest|pointer|hash|merkle|hcs|cid/i.test(key))) {
    return { ...base, ignored: 'digest-or-pointer' };
  }
  if (parsed.kind !== 'lgme-public-listing' || parsed.v !== 1 || parsed.network !== 'hedera:testnet') {
    return { ...base, ignored: 'not-a-listing' };
  }
  if (!ACTIONS.has(parsed.action) || parsed.consent !== true) return { ...base, ignored: 'invalid-listing' };
  if (keys.some((key) => PRIVATE_FIELDS.includes(key) || PRIVATE_FIELDS.includes(key.toLowerCase()))) {
    return { ...base, ignored: 'private-field' };
  }
  const listingId = text(parsed.listingId, 80);
  const ownerId = text(parsed.ownerId, 80);
  const revision = Number(parsed.revision);
  if (!listingId || !ownerId || !Number.isInteger(revision) || revision < 1) return { ...base, ignored: 'invalid-listing' };
  const title = text(parsed.title, 120);
  const amount = typeof parsed.amount === 'number' ? Math.round(parsed.amount * 100) / 100 : NaN;
  if (!UNITS.has(parsed.unit) || !CATEGORIES.has(parsed.category) || title.length < 3 || !Number.isFinite(amount) || amount < 0) {
    return { ...base, ignored: 'invalid-listing' };
  }
  return {
    ...base,
    ignored: '',
    listing: {
      listingId,
      ownerId,
      revision,
      action: parsed.action,
      title,
      amount,
      unit: parsed.unit,
      category: parsed.category,
      expiresAt: parsed.expiresAt ? text(parsed.expiresAt, 40) : null,
      consent: true
    }
  };
}

function expired(listing, now) {
  if (!listing?.expiresAt) return false;
  const time = Date.parse(listing.expiresAt);
  return Number.isFinite(time) && time <= Date.parse(now);
}

export function replayListings(parsed, now = new Date().toISOString()) {
  const ordered = [...parsed].filter((row) => row?.listing && row.sequence != null);
  ordered.sort((a, b) => a.sequence - b.sequence || String(a.consensusTimestamp).localeCompare(String(b.consensusTimestamp)));
  const seen = new Set();
  const byId = new Map();
  const history = [];
  const rejected = [];
  for (const row of ordered) {
    const key = `${row.sequence}:${row.listing.listingId}:${row.listing.revision}:${row.listing.action}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const current = byId.get(row.listing.listingId);
    if (row.listing.action !== 'publish' && (!current || current.ownerId !== row.listing.ownerId)) {
      rejected.push({ listingId: row.listing.listingId, sequence: row.sequence, reason: 'owner-mismatch' });
      continue;
    }
    if (current && row.listing.revision <= current.revision) {
      rejected.push({ listingId: row.listing.listingId, sequence: row.sequence, reason: 'stale-revision' });
      continue;
    }
    const next = {
      ...row.listing,
      sequence: row.sequence,
      consensusTimestamp: row.consensusTimestamp,
      shared: true,
      hederaListing: true,
      solanaPayment: false
    };
    byId.set(next.listingId, next);
    history.push(next);
  }
  const active = [];
  for (const listing of byId.values()) {
    if (listing.action === 'unpublish') continue;
    if (expired(listing, now)) continue;
    active.push(listing);
  }
  active.sort((a, b) => a.sequence - b.sequence);
  return { active, history, rejected };
}

export function catalogRequest(env) {
  const status = publicStatus(env);
  if (status.catalog !== 'configured') {
    return { ok: false, error: 'No testnet topic is configured. The shared catalog is empty.' };
  }
  const url = `${MIRROR_ORIGIN}/api/v1/topics/${status.topic}/messages?limit=100&order=asc`;
  if (new URL(url).host !== 'testnet.mirrornode.hedera.com') {
    return { ok: false, error: 'Only the Hedera testnet mirror is allowed.' };
  }
  return { ok: true, url, topic: status.topic };
}

function sameMirror(url) {
  try { return new URL(url, MIRROR_ORIGIN).host === 'testnet.mirrornode.hedera.com'; } catch { return false; }
}

export async function readSharedCatalog(env, fetchImpl, options = {}) {
  const plan = catalogRequest(env);
  if (!plan.ok) {
    return { ok: true, status: 'unconfigured', hederaVerified: false, source: 'unconfigured', active: [], history: [], rejected: [], error: plan.error };
  }
  if (typeof fetchImpl !== 'function') {
    return { ok: true, status: 'error', hederaVerified: false, source: 'unconfigured', active: [], history: [], rejected: [], error: 'The testnet mirror was not queried.' };
  }
  const live = options.live === true;
  const parsed = [];
  let url = plan.url;
  let pages = 0;
  let truncated = false;
  try {
    while (url && pages < 20) {
      if (!sameMirror(url)) {
        return { ok: true, status: 'error', hederaVerified: false, source: live ? 'hedera-testnet-mirror' : 'fixture', active: [], history: [], rejected: [], error: 'A mirror link left the Hedera testnet.' };
      }
      const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
      if (!response?.ok) {
        return { ok: true, status: 'error', hederaVerified: false, source: live ? 'hedera-testnet-mirror' : 'fixture', active: [], history: [], rejected: [], error: `The testnet mirror responded ${response?.status || 'without a status'}.` };
      }
      const body = await response.json();
      for (const row of Array.isArray(body?.messages) ? body.messages : []) parsed.push(parseListingMessage(row));
      pages += 1;
      const next = body?.links?.next;
      url = next ? new URL(next, MIRROR_ORIGIN).toString() : '';
    }
    if (url) truncated = true;
  } catch {
    return { ok: true, status: 'error', hederaVerified: false, source: live ? 'hedera-testnet-mirror' : 'fixture', active: [], history: [], rejected: [], error: 'The testnet mirror could not be reached.' };
  }
  const replay = replayListings(parsed, options.now);
  const status = truncated ? 'truncated' : replay.active.length ? 'ok' : 'empty';
  return {
    ok: true,
    status,
    hederaVerified: live,
    source: live ? 'hedera-testnet-mirror' : 'fixture',
    active: replay.active,
    history: replay.history,
    rejected: replay.rejected,
    ignored: parsed.filter((row) => row.ignored).length,
    error: truncated ? 'The mirror page limit was reached. This is not the full topic.' : ''
  };
}

export function buildListingDraft(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'A public title, amount, and unit are required.' };
  const extra = Object.keys(input).filter((key) => !PUBLIC_FIELDS.has(key));
  if (extra.length) return { ok: false, error: 'Notes, contact, proof, photos, and identity are not part of a public listing.' };
  if (input.consent !== true) return { ok: false, error: 'Publishing needs an explicit consent. Nothing was stored.' };
  const title = text(input.title, 120);
  const amount = typeof input.amount === 'number' ? input.amount : Number(String(input.amount ?? '').trim());
  if (title.length < 3) return { ok: false, error: 'Enter a public title.' };
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) return { ok: false, error: 'Enter an amount of zero or more.' };
  if (!UNITS.has(input.unit)) return { ok: false, error: 'Choose $lgme, a campus credit, or a USD description.' };
  if (input.category && !CATEGORIES.has(input.category)) return { ok: false, error: 'Choose a category.' };
  return {
    ok: true,
    draft: {
      draftId: text(input.draftId, 80) || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `draft-${Date.now()}`),
      action: input.action === 'revise' || input.action === 'unpublish' ? input.action : 'publish',
      listingId: text(input.listingId, 80),
      title,
      amount: Math.round(amount * 100) / 100,
      unit: input.unit,
      category: CATEGORIES.has(input.category) ? input.category : 'other',
      expiresAt: input.expiresAt ? text(input.expiresAt, 40) : null,
      consent: true,
      stored: 'this-device',
      shared: false
    }
  };
}

export function saveListingDraft(storage, input) {
  const built = buildListingDraft(input);
  if (!built.ok) return built;
  let current = [];
  try { current = JSON.parse(storage.getItem(DRAFT_KEY) || '[]'); } catch { current = []; }
  if (!Array.isArray(current)) current = [];
  const next = [built.draft, ...current.filter((row) => row?.draftId !== built.draft.draftId)].slice(0, 50);
  storage.setItem(DRAFT_KEY, JSON.stringify(next));
  return { ok: true, draft: built.draft, drafts: next };
}

export function messageForListing({ ownerId, draft, revision }) {
  return {
    v: 1,
    kind: 'lgme-public-listing',
    network: 'hedera:testnet',
    listingId: draft.listingId || `lst-${ownerId}-${draft.draftId}`,
    ownerId,
    revision,
    action: draft.action,
    title: draft.title,
    amount: draft.amount,
    unit: draft.unit,
    category: draft.category,
    expiresAt: draft.expiresAt,
    consent: true
  };
}

export function createBudgetStore() {
  const rows = new Map();
  const users = new Map();
  const globals = new Map();
  let chain = Promise.resolve();
  const atomic = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {});
    return run;
  };
  return {
    durable: false,
    memory: true,
    reserve(spec) {
      return atomic(() => {
        const day = String(spec.day || '').slice(0, 10);
        const userKey = `${spec.userId}:${day}`;
        const globalKey = `${spec.operatorId}:${day}`;
        const existing = rows.get(spec.draftId);
        if (existing && existing.state !== 'rejected' && existing.state !== 'final') {
          return { ok: true, recover: true, transactionId: existing.transactionId, state: existing.state };
        }
        if (existing?.state === 'final') return { ok: false, error: 'That listing attempt is already final.', state: 'final' };
        const user = users.get(userKey) || { attempts: 0, rejected: 0 };
        const globe = globals.get(globalKey) || { attempts: 0, rejected: 0 };
        if (user.attempts >= USER_ATTEMPT_LIMIT || globe.attempts >= GLOBAL_ATTEMPT_LIMIT) {
          user.attempts += 1;
          user.rejected += 1;
          globe.attempts += 1;
          globe.rejected += 1;
          users.set(userKey, user);
          globals.set(globalKey, globe);
          rows.set(spec.draftId, { state: 'rejected', transactionId: '', userId: spec.userId });
          return { ok: false, error: 'Attempt limit reached.', rejected: true, user, globe };
        }
        user.attempts += 1;
        globe.attempts += 1;
        users.set(userKey, user);
        globals.set(globalKey, globe);
        const transactionId = `tx-${spec.userId}-${spec.draftId}-${user.attempts}`;
        rows.set(spec.draftId, { state: 'reserved', transactionId, userId: spec.userId, revision: spec.revision || 1 });
        return { ok: true, recover: false, transactionId, state: 'reserved', user, globe };
      });
    },
    mark(draftId, state) {
      return atomic(() => {
        const row = rows.get(draftId);
        if (!row) return { ok: false, error: 'No reservation.' };
        row.state = state;
        rows.set(draftId, row);
        return { ok: true, transactionId: row.transactionId, state };
      });
    },
    snapshot() {
      return { rows: new Map(rows), users: new Map(users), globals: new Map(globals) };
    }
  };
}

export async function executeSubmission(env, adapters, body) {
  const decision = writeDecision(env, adapters);
  if (!decision.open) return decision;
  return { ...decision, open: false, error: 'The production signer is not part of this deployment.' };
}
