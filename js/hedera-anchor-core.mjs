export const FORBIDDEN_TOPIC = '0.0.489104';
export const HEDERA_COMING = 'Public Hedera anchoring: coming. Not written to Hedera today.';

export const HEDERA_ENV = Object.freeze([
  'HEDERA_TESTNET_ANCHOR',
  'HEDERA_TESTNET_OPERATOR_ID',
  'HEDERA_TESTNET_OPERATOR_KEY'
]);

export function hederaReadiness(env = {}) {
  const missing = [];
  if (env.HEDERA_TESTNET_ANCHOR !== 'on') missing.push('HEDERA_TESTNET_ANCHOR=on');
  if (!String(env.HEDERA_TESTNET_OPERATOR_ID || '').trim()) missing.push('HEDERA_TESTNET_OPERATOR_ID');
  if (!String(env.HEDERA_TESTNET_OPERATOR_KEY || '').trim()) missing.push('HEDERA_TESTNET_OPERATOR_KEY');
  return { enabled: missing.length === 0, missing, wording: HEDERA_COMING };
}

export function topicAllowed(topicId) {
  const id = String(topicId || '').trim();
  if (!id) return { ok: true, create: true };
  if (id === FORBIDDEN_TOPIC) return { ok: false, error: 'Topic 0.0.489104 is refused. It is not a confirmed testnet topic.' };
  if (!/^\d+\.\d+\.\d+$/.test(id)) return { ok: false, error: 'The testnet topic id is not usable.' };
  return { ok: true, create: false, topicId: id };
}

export function anchorMessage({ root, day, leafCount }) {
  return JSON.stringify({ version: 1, network: 'testnet', day: String(day || ''), root, leafCount });
}

export function hashscanMessage(topicId, sequence) {
  return `https://hashscan.io/testnet/topic/${topicId}/message/${sequence}`;
}
