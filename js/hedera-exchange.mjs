/**
 * Hedera testnet exchange gate for lgme.app.
 * Public submissions stay off unless a future server has every durable
 * prerequisite. This module does not sign, does not read operator keys,
 * and does not default to another app's topic or account.
 */

export const NETWORK_NAME = 'testnet';
export const MIRROR_ORIGIN = 'https://testnet.mirrornode.hedera.com';
export const LOCAL_PROPOSAL_KEY = 'lgme.hedera.local-proposals.v1';
export const SOLANA_SUBMISSION_CLOSED = 'Solana wallet submission is closed on this exchange.';
export const SUBMISSIONS_OFF = 'Public submissions are off. No transaction was reserved, signed, or sent.';
export const EXAMPLE_LABEL = 'Example. Not a Hedera consensus record.';
export const LOCAL_LABEL = 'Saved on this device. Not submitted to Hedera.';
export const SEARCH_LABEL = 'Recommended searches from the title. They match examples and proposals on this device. They are not Hedera records.';

const TOPIC_ID = /^0\.0\.[1-9][0-9]{0,9}$/;
const PRIVATE_FIELDS = new Set([
  'note', 'notes', 'contact', 'proof', 'identity', 'email', 'phone', 'address',
  'seed', 'privatekey', 'privateKey', 'passphrase', 'secret', 'wallet', 'signature'
]);
const PUBLIC_INPUT = new Set(['title', 'amount', 'unit', 'consent']);
const STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'and', 'or', 'of', 'to', 'in', 'on', 'with', 'under', 'from']);

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

function examples(category, rows) {
  return rows.map(([title, amount], index) => Object.freeze({
    id: `${category}-${index + 1}`,
    category,
    title,
    amount,
    unit: 'USD',
    label: EXAMPLE_LABEL,
    consensus: false
  }));
}

export const EXCHANGE_EXAMPLES = Object.freeze([
  ...examples('college', COLLEGE),
  ...examples('utility', UTILITY),
  ...examples('goods', GOODS)
]);

export function exampleCounts() {
  const counts = { college: 0, utility: 0, goods: 0 };
  for (const row of EXCHANGE_EXAMPLES) counts[row.category] += 1;
  return counts;
}

function text(value, max) {
  const clean = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean.slice(0, max);
}

export function buildLocalProposal(input, now = new Date().toISOString()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'A public title and amount are required.' };
  }
  const extra = Object.keys(input).filter((key) => !PUBLIC_INPUT.has(key));
  if (extra.length) {
    return { ok: false, error: 'Only a public title and amount can be saved. Notes, contact, proof, and identity stay off this form.' };
  }
  if (input.consent !== true) {
    return { ok: false, error: 'Saving a public title needs an explicit consent. Nothing was stored.' };
  }
  const title = text(input.title, 120);
  if (title.length < 3) return { ok: false, error: 'Enter a public title.' };
  const amount = typeof input.amount === 'number' ? input.amount : Number(String(input.amount).trim());
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return { ok: false, error: 'Enter an amount greater than zero.' };
  }
  if (input.unit !== 'USD') return { ok: false, error: 'Amounts on this form are USD descriptions, not tokens.' };
  const proposal = {
    id: globalThis.crypto?.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`,
    title,
    amount: Math.round(amount * 100) / 100,
    unit: 'USD',
    consent: true,
    visibility: 'public-title-and-amount',
    stored: 'this-device',
    consensus: false,
    network: NETWORK_NAME,
    createdAt: now,
    label: LOCAL_LABEL
  };
  return { ok: true, proposal };
}

function isSafeProposal(row) {
  return Boolean(row && typeof row === 'object' && row.consent === true && row.stored === 'this-device' && typeof row.title === 'string' && typeof row.amount === 'number');
}

export function readLocalProposals(storage) {
  if (!storage || typeof storage.getItem !== 'function') return [];
  try {
    const parsed = JSON.parse(storage.getItem(LOCAL_PROPOSAL_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isSafeProposal) : [];
  } catch {
    return [];
  }
}

export function saveLocalProposal(storage, input, now) {
  const built = buildLocalProposal(input, now);
  if (!built.ok) return built;
  const next = [built.proposal, ...readLocalProposals(storage)].slice(0, 100);
  storage.setItem(LOCAL_PROPOSAL_KEY, JSON.stringify(next));
  return { ok: true, proposal: built.proposal, proposals: next };
}

function searchText(value) {
  return text(value, 120).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function recommendedSearches(title) {
  const words = searchText(title).match(/[a-z0-9]+/g) || [];
  const useful = words.filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  const queries = [];
  if (useful.length) queries.push(useful.slice(0, 4).join(' '));
  if (useful.length > 1) queries.push(useful[useful.length - 1]);
  return { label: SEARCH_LABEL, queries: queries.slice(0, 5) };
}

export function matchByQuery(rows, query) {
  const needle = searchText(query);
  if (!needle) return rows;
  return rows.filter((row) => searchText(`${row.title || ''} ${row.category || ''}`).includes(needle));
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

export function topicState(topicId) {
  const value = String(topicId || '').trim();
  if (!value) return 'missing';
  return TOPIC_ID.test(value) ? 'set' : 'invalid';
}

export function publicStatus(env) {
  const config = readPublicConfig(env);
  const network = config.network === NETWORK_NAME ? NETWORK_NAME : 'unconfigured';
  const topic = topicState(config.topicId);
  const history = network === NETWORK_NAME && topic === 'set' ? 'configured' : 'unconfigured';
  const reasons = [];
  if (network !== NETWORK_NAME) reasons.push('HEDERA_NETWORK is not set to testnet. Mainnet is not used.');
  if (topic !== 'set') reasons.push('HEDERA_TOPIC_ID is not a configured testnet topic, so public history is empty.');
  reasons.push('Public submissions are off. The signing client is not loaded.');
  reasons.push('Durable authentication is not configured. A wallet or a local passkey is not a server session.');
  reasons.push('An administrator-approved user list is not configured.');
  reasons.push('A database for attempt limits is not configured.');
  if (String(config.network || '').toLowerCase() === 'mainnet') reasons.unshift('Mainnet was rejected.');
  return {
    ok: true,
    network,
    submissions: 'off',
    history,
    topic: history === 'configured' ? String(config.topicId).trim() : null,
    operatorIdPresent: config.operatorIdSet,
    testnetOnly: true,
    mainnet: false,
    signing: false,
    funds: false,
    purchases: false,
    solanaWallet: false,
    activationFlag: config.submissionsFlag === 'true',
    reasons
  };
}

export function historyRequest(env) {
  const status = publicStatus(env);
  if (status.history !== 'configured') {
    return { ok: false, status: 'unconfigured', error: 'No testnet topic is configured. Public history is empty.' };
  }
  const topic = status.topic;
  const url = `${MIRROR_ORIGIN}/api/v1/topics/${topic}/messages?limit=25&order=desc`;
  const host = new URL(url).host;
  if (host !== 'testnet.mirrornode.hedera.com') {
    return { ok: false, status: 'unconfigured', error: 'Only the Hedera testnet mirror is allowed.' };
  }
  return { ok: true, status: 'configured', url, topic };
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

function digestOnly(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const keys = Object.keys(parsed).map((key) => key.toLowerCase());
  if (!keys.length) return false;
  const markers = ['digest', 'pointer', 'hash', 'roothash', 'merkle', 'hcs', 'cid'];
  return keys.every((key) => markers.some((marker) => key.includes(marker)));
}

export function labelMirrorMessage(raw) {
  const sequence = Number(raw?.sequence_number);
  const consensusTimestamp = String(raw?.consensus_timestamp || '');
  const base = {
    sequence: Number.isFinite(sequence) ? sequence : null,
    consensusTimestamp,
    messagePayer: String(raw?.payer_account_id || ''),
    hederaConfirmationOfSolana: false,
    sharedProposalHistory: false
  };
  const decoded = decodeUtf8Base64(raw?.message);
  let parsed = null;
  try { parsed = JSON.parse(decoded); } catch { parsed = null; }
  if (digestOnly(parsed)) {
    return { ...base, capability: 'digest-or-pointer', title: '', amount: null, note: 'A digest or pointer is not a shared proposal history.' };
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const withheld = Object.keys(parsed).filter((key) => PRIVATE_FIELDS.has(key) || PRIVATE_FIELDS.has(key.toLowerCase()));
    const title = text(parsed.title, 120);
    const amount = typeof parsed.amount === 'number' ? parsed.amount : null;
    if (parsed.kind === 'lgme-public-proposal' && title && Number.isFinite(amount) && parsed.unit === 'USD' && parsed.consent === true) {
      return {
        ...base,
        capability: 'public-topic-message',
        sharedProposalHistory: true,
        title,
        amount,
        unit: 'USD',
        withheld: withheld.length > 0,
        note: 'Public title and amount from the configured testnet topic. Not a local notebook upload.'
      };
    }
  }
  return { ...base, capability: 'topic-message', title: '', amount: null, note: 'Topic message. Not a proposal record.' };
}

export async function readPublicHistory(env, fetchImpl) {
  const plan = historyRequest(env);
  if (!plan.ok) return { ok: true, status: 'unconfigured', messages: [], error: plan.error };
  if (typeof fetchImpl !== 'function') {
    return { ok: true, status: 'error', messages: [], error: 'The testnet mirror was not queried.' };
  }
  try {
    const response = await fetchImpl(plan.url, { headers: { accept: 'application/json' } });
    if (!response?.ok) {
      return { ok: true, status: 'error', messages: [], error: `The testnet mirror responded ${response?.status || 'without a status'}.` };
    }
    const body = await response.json();
    const rows = Array.isArray(body?.messages) ? body.messages : [];
    return { ok: true, status: rows.length ? 'ok' : 'empty', messages: rows.slice(0, 25).map(labelMirrorMessage), error: '' };
  } catch {
    return { ok: true, status: 'error', messages: [], error: 'The testnet mirror could not be reached.' };
  }
}

export function submissionDecision(env) {
  const status = publicStatus(env);
  return {
    ok: false,
    status: 403,
    submissions: 'off',
    signed: false,
    submitted: false,
    reserved: false,
    network: status.network,
    activationFlag: status.activationFlag,
    error: SUBMISSIONS_OFF,
    missing: [
      { name: 'HEDERA_PUBLIC_SUBMISSIONS', state: status.activationFlag ? 'true' : 'not-true' },
      { name: 'HEDERA_NETWORK', state: status.network === NETWORK_NAME ? 'testnet' : 'not-testnet' },
      { name: 'HEDERA_TOPIC_ID', state: status.history === 'configured' ? 'set' : 'missing' },
      { name: 'durable-auth', state: 'unconfigured' },
      { name: 'approved-user-ids', state: 'unconfigured' },
      { name: 'database', state: 'unconfigured' },
      { name: 'operator-public-key-match', state: 'not-checked' },
      { name: 'topic-permissions', state: 'not-checked' },
      { name: 'submission-client', state: 'not-loaded' }
    ]
  };
}

export function labelLocalChainRecord(entry) {
  const type = entry?.type || '';
  if (type === 'SOLANA_TX' || type === 'SOLANA_FINAL' || type === 'SOLANA_REFUSAL') {
    return {
      chain: 'solana',
      stored: 'local-book',
      hederaConfirmation: false,
      text: 'Local Solana record. Not a Hedera confirmation.'
    };
  }
  return null;
}
