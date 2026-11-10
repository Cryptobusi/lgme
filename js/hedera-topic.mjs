export const LEGACY_TOPIC = '0.0.11397291';
export const ATTESTATION_TOPIC = '0.0.11399829';

export function topicAdminReady(env = {}) {
  if (env.HEDERA_TOPIC_ADMIN !== 'on') {
    return { ok: false, error: 'Topic creation is off. Set HEDERA_TOPIC_ADMIN=on, then HEDERA_CREATE_TOPIC=yes, for one command. Nothing was created.' };
  }
  if (env.HEDERA_CREATE_TOPIC !== 'yes') {
    return { ok: false, error: 'Set HEDERA_CREATE_TOPIC=yes for this one command. Nothing was created.' };
  }
  if (!String(env.HEDERA_TESTNET_OPERATOR_ID || '').trim() || !String(env.HEDERA_TESTNET_OPERATOR_KEY || '').trim()) {
    return { ok: false, missingKey: true, error: 'The testnet operator key is not in this environment. Nothing was created.' };
  }
  return { ok: true };
}

export function protectedTopicTransaction(sdk, operatorKey) {
  return new sdk.TopicCreateTransaction()
    .setTopicMemo('lgme testnet tape root')
    .setAdminKey(operatorKey.publicKey)
    .setSubmitKey(operatorKey.publicKey);
}

export function readableTopic(topic, env = {}) {
  const id = String(topic || '').trim();
  const current = String(env.HEDERA_TESTNET_TOPIC_ID || '').trim();
  return id === LEGACY_TOPIC || id === ATTESTATION_TOPIC || (current && id === current);
}

export function cronAllowed(headers = {}, env = {}) {
  const secret = String(env.CRON_SECRET || '');
  const header = String(headers['x-lgme-cron'] || headers.authorization || '');
  if (!secret) return false;
  return header === secret || header === `Bearer ${secret}`;
}
