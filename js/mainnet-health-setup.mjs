import { sha256Hex } from './device-sign.mjs';
import { merkleRootOf } from './clearing.mjs';
import { mainnetOperatorKey } from './hedera-operator.mjs';
import { FORBIDDEN_TOPIC } from './hedera-anchor-core.mjs';
import { chainPayloadSafe, dailyHbarCap, mainnetPayloadAllowed, MAINNET_OPERATOR, TINYBAR } from './hedera-network.mjs';

export const TOPIC_MEMO = 'lgme Health mainnet hash';
export const CREATE_MAX_HBAR = 0.5;
export const MESSAGE_MAX_HBAR = 0.05;
const TOPIC_KEY = 'hedera:mainnet:health-topic';
const SETUP_KEY = 'hedera:mainnet:health-setup';

function spentKey(day) {
  return `hedera:mainnet:spent:${day}`;
}

function tinybarsOf(fee) {
  if (fee == null) return 0;
  if (typeof fee.toTinybars === 'function') return Number(fee.toTinybars());
  const value = Number(fee);
  return Number.isFinite(value) ? value : 0;
}

function hbarOf(tiny) {
  return Math.round((Number(tiny) || 0) / TINYBAR * 1e8) / 1e8;
}

export function adminTokenOk(header, env = {}) {
  const token = String(env.OWNER_INBOX_TOKEN || '');
  return Boolean(token) && String(header || '') === token;
}

export async function healthSetupMessage(day) {
  const root = await sha256Hex(`lgme health mainnet setup ${day}`);
  const body = { version: 1, network: 'mainnet', day, root, leafCount: 1 };
  const privacy = chainPayloadSafe(body);
  if (!privacy.ok) return privacy;
  return { ok: true, body, message: JSON.stringify(body) };
}

async function rememberedTopic(store) {
  const saved = store ? await store.get(TOPIC_KEY) : '';
  return String(saved || '').trim();
}

async function topicOnMirror(fetchImpl, topicId) {
  if (!topicId || topicId === FORBIDDEN_TOPIC) return null;
  const response = await fetchImpl(`https://mainnet.mirrornode.hedera.com/api/v1/topics/${topicId}`);
  if (!response?.ok) return null;
  const body = await response.json();
  if (body.memo !== TOPIC_MEMO || !body.admin_key || !body.submit_key) return null;
  return topicId;
}

async function topicFromCreates(fetchImpl, accountId) {
  const url = `https://mainnet.mirrornode.hedera.com/api/v1/transactions?account.id=${accountId}&transactiontype=CONSENSUSCREATETOPIC&limit=10&order=desc`;
  const response = await fetchImpl(url);
  if (!response?.ok) return '';
  const body = await response.json();
  for (const row of body.transactions || []) {
    const id = String(row.entity_id || '').trim();
    const found = await topicOnMirror(fetchImpl, id);
    if (found) return found;
  }
  return '';
}

export async function submitHealthMainnetHash(env = {}, leaves, day, { store = null, sdk, fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const clean = (leaves || []).map((leaf) => String(leaf || '').toLowerCase()).filter((leaf) => /^[0-9a-f]{64}$/.test(leaf));
  if (!clean.length) return { ok: false, error: 'Send the tape leaf hashes.' };
  const root = await merkleRootOf(clean);
  const body = { version: 1, network: 'mainnet', day: String(day || '').slice(0, 10), root, leafCount: clean.length };
  const privacy = chainPayloadSafe(body);
  if (!privacy.ok) return { ok: false, error: privacy.error };
  const shape = mainnetPayloadAllowed(body);
  if (!shape.ok) return { ok: false, error: shape.error };
  const topicId = String(env.HEDERA_MAINNET_HEALTH_TOPIC_ID || '').trim();
  if (!topicId || topicId === FORBIDDEN_TOPIC) return { ok: false, error: 'Topic 0.0.489104 is refused. Nothing was sent.' };
  const spentDay = now.toISOString().slice(0, 10);
  const spent = Number(store ? await store.get(spentKey(spentDay)) : 0) || 0;
  const capTiny = Math.round(dailyHbarCap(env) * TINYBAR);
  if (spent >= capTiny) {
    return { ok: false, status: 429, error: 'Mainnet fee cap reached. Writes are refused until tomorrow.', capHbar: dailyHbarCap(env), hbarSpent: 0 };
  }
  const library = sdk || await import('@hashgraph/sdk');
  let operator;
  try {
    operator = await mainnetOperatorKey(library, env, fetchImpl);
  } catch (error) {
    return { ok: false, status: 400, error: error.public ? error.message : 'The mainnet operator key could not be used. Nothing was sent.' };
  }
  const accountId = String(env.HEDERA_MAINNET_OPERATOR_ID || '').trim();
  const client = library.Client.forMainnet();
  client.setOperator(library.AccountId.fromString(accountId), operator);
  if (library.Hbar) client.setMaxTransactionFee(new library.Hbar(MESSAGE_MAX_HBAR));
  try {
    const submitted = await new library.TopicMessageSubmitTransaction({
      topicId,
      message: JSON.stringify(body)
    }).setMaxTransactionFee(new library.Hbar(MESSAGE_MAX_HBAR)).execute(client);
    let record;
    try {
      record = await submitted.getRecord(client);
    } catch (error) {
      const tiny = tinybarsOf(error?.record?.transactionFee);
      if (tiny && store) await store.set(spentKey(spentDay), spent + tiny);
      return {
        ok: false,
        status: 502,
        hederaStatus: String(error?.status?.toString?.() || ''),
        error: error?.status ? `Hedera returned ${error.status.toString()}.` : 'The Health hash was not written.',
        hbarSpent: hbarOf(tiny),
        capHbar: dailyHbarCap(env),
        transactionId: error?.transactionId?.toString?.() || submitted.transactionId?.toString?.() || '',
        topicId
      };
    }
    const tiny = tinybarsOf(record.transactionFee);
    if (tiny && store) await store.set(spentKey(spentDay), spent + tiny);
    const sequence = record.receipt.topicSequenceNumber.toString();
    const transactionId = submitted.transactionId?.toString?.() || record.transactionId?.toString?.() || '';
    return {
      ok: true,
      status: 200,
      network: 'mainnet',
      topicId,
      transactionId,
      sequenceNumber: sequence,
      consensusTimestamp: record.consensusTimestamp?.toString?.() || '',
      root,
      hbarSpent: hbarOf(tiny),
      capHbar: dailyHbarCap(env),
      hashscan: `https://hashscan.io/mainnet/transaction/${encodeURIComponent(transactionId)}`,
      mirror: `https://mainnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${sequence}`
    };
  } finally {
    client.close?.();
  }
}

export async function runHealthMainnetSetup(env = {}, { store = null, sdk, fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  if (String(env.VERCEL_ENV || '') !== 'production') {
    return { ok: false, status: 403, error: 'Mainnet setup runs in production only. Nothing was created.' };
  }
  const accountId = String(env.HEDERA_MAINNET_OPERATOR_ID || '').trim();
  if (accountId !== MAINNET_OPERATOR || !String(env.HEDERA_MAINNET_OPERATOR_KEY || '').trim()) {
    return { ok: false, status: 503, error: 'The mainnet operator is not configured. Nothing was created.' };
  }
  const day = now.toISOString().slice(0, 10);
  const prior = store ? await store.get(SETUP_KEY) : null;
  if (prior?.transactionId && prior?.topicId) {
    return {
      ok: true,
      status: 200,
      created: false,
      topicId: prior.topicId,
      transactionId: prior.transactionId,
      sequenceNumber: prior.sequenceNumber || '',
      hbarSpent: 0,
      capHbar: dailyHbarCap(env),
      root: prior.root || '',
      already: true
    };
  }
  const spent = Number(store ? await store.get(spentKey(day)) : 0) || 0;
  const capTiny = Math.round(dailyHbarCap(env) * TINYBAR);
  if (spent >= capTiny) {
    return { ok: false, status: 429, error: 'Mainnet fee cap reached. Writes are refused until tomorrow.', capHbar: dailyHbarCap(env) };
  }
  const built = await healthSetupMessage(day);
  if (!built.ok) return { ok: false, status: 400, error: built.error };
  const library = sdk || await import('@hashgraph/sdk');
  let operator;
  try {
    operator = await mainnetOperatorKey(library, env, fetchImpl);
  } catch (error) {
    return { ok: false, status: 400, error: error.public ? error.message : 'The mainnet operator key could not be used. Nothing was created.' };
  }
  const client = library.Client.forMainnet();
  client.setOperator(library.AccountId.fromString(accountId), operator);
  if (library.Hbar) client.setMaxTransactionFee(new library.Hbar(CREATE_MAX_HBAR));
  let spentNow = spent;
  const noteSpend = async (fee) => {
    const tiny = tinybarsOf(fee);
    if (!tiny) return 0;
    spentNow += tiny;
    if (store) await store.set(spentKey(day), spentNow);
    return tiny;
  };
  const failed = (error, extra = {}) => ({
    ok: false,
    status: 502,
    hederaStatus: String(error?.status?.toString?.() || error?.hederaStatus || ''),
    error: error?.public ? error.message : (error?.status ? `Hedera returned ${error.status.toString()}.` : 'The mainnet setup did not finish.'),
    hbarSpent: hbarOf(spentNow - spent),
    capHbar: dailyHbarCap(env),
    transactionId: error?.transactionId?.toString?.() || extra.transactionId || '',
    topicId: extra.topicId || ''
  });
  try {
    let topicId = await topicOnMirror(fetchImpl, String(env.HEDERA_MAINNET_HEALTH_TOPIC_ID || '').trim());
    if (!topicId) topicId = await topicOnMirror(fetchImpl, await rememberedTopic(store));
    if (!topicId) topicId = await topicFromCreates(fetchImpl, accountId);
    let created = false;
    if (!topicId) {
      const createdTx = await new library.TopicCreateTransaction()
        .setTopicMemo(TOPIC_MEMO)
        .setAdminKey(operator.publicKey)
        .setSubmitKey(operator.publicKey)
        .setMaxTransactionFee(new library.Hbar(CREATE_MAX_HBAR))
        .execute(client);
      let receipt;
      let record;
      try {
        receipt = await createdTx.getReceipt(client);
        record = await createdTx.getRecord(client);
      } catch (error) {
        await noteSpend(error?.record?.transactionFee);
        return failed(error, { transactionId: createdTx.transactionId?.toString?.() || '' });
      }
      await noteSpend(record.transactionFee);
      topicId = receipt.topicId.toString();
      if (topicId === FORBIDDEN_TOPIC) {
        return { ok: false, status: 400, error: 'Topic 0.0.489104 is refused. Nothing else was sent.', hederaStatus: '' };
      }
      created = true;
      if (store) await store.set(TOPIC_KEY, topicId);
      if (spentNow >= capTiny) {
        return { ok: false, status: 429, created: true, topicId, error: 'Mainnet fee cap reached. The hash was not written.', capHbar: dailyHbarCap(env), hbarSpent: hbarOf(spentNow - spent), hederaStatus: '' };
      }
    }
    const submitted = await new library.TopicMessageSubmitTransaction({
      topicId,
      message: built.message
    }).setMaxTransactionFee(new library.Hbar(MESSAGE_MAX_HBAR)).execute(client);
    let record;
    try {
      record = await submitted.getRecord(client);
    } catch (error) {
      await noteSpend(error?.record?.transactionFee);
      return failed(error, { topicId, transactionId: submitted.transactionId?.toString?.() || '' });
    }
    await noteSpend(record.transactionFee);
    const sequence = record.receipt.topicSequenceNumber.toString();
    const transactionId = submitted.transactionId?.toString?.() || record.transactionId?.toString?.() || '';
    const saved = { topicId, transactionId, sequenceNumber: sequence, root: built.body.root, day };
    if (store) await store.set(SETUP_KEY, saved);
    return {
      ok: true,
      status: 200,
      created,
      topicId,
      transactionId,
      sequenceNumber: sequence,
      hbarSpent: hbarOf(spentNow - spent),
      capHbar: dailyHbarCap(env),
      root: built.body.root,
      hashscan: `https://hashscan.io/mainnet/transaction/${encodeURIComponent(transactionId)}`,
      mirror: `https://mainnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages/${sequence}`
    };
  } finally {
    client.close?.();
  }
}
