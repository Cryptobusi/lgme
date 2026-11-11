import { hederaReadiness } from '../../js/hedera-anchor-core.mjs';
import { MAINNET_OPERATOR, networkDryRun, operatorBalanceAlert } from '../../js/hedera-network.mjs';
import { json, readEnv } from '../lib/http.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Use GET.' });
  const env = readEnv();
  const ready = hederaReadiness(env);
  const dry = networkDryRun(env);
  const balance = await operatorBalanceAlert();
  const mainnetWrites = dry.mainnetWrites === true;
  const enabled = ready.enabled || mainnetWrites;
  const topic = String(env.HEDERA_MAINNET_HEALTH_TOPIC_ID || '').trim();
  return json(res, enabled ? 200 : 503, {
    ok: enabled,
    enabled,
    network: dry.network,
    asked: dry.asked,
    mainnetWrites,
    wording: mainnetWrites ? 'Health hashes are written on Hedera mainnet. Health data is not written.' : ready.wording,
    topicId: mainnetWrites ? topic : (ready.topicId || ''),
    dailyCapHbar: dry.dailyCapHbar,
    rollback: dry.rollback,
    operatorAlert: balance.alert,
    mainnetChecks: {
      topic: topic === '0.0.10955014',
      operator: String(env.HEDERA_MAINNET_OPERATOR_ID || '').trim() === MAINNET_OPERATOR,
      key: Boolean(String(env.HEDERA_MAINNET_OPERATOR_KEY || '').trim())
    }
  });
}
