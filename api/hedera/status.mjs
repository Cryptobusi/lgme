import { hederaReadiness } from '../../js/hedera-anchor-core.mjs';
import { networkDryRun, operatorBalanceAlert } from '../../js/hedera-network.mjs';
import { json, readEnv } from '../lib/http.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Use GET.' });
  const env = readEnv();
  const ready = hederaReadiness(env);
  const dry = networkDryRun(env);
  const balance = await operatorBalanceAlert();
  return json(res, ready.enabled ? 200 : 503, {
    ok: ready.enabled,
    enabled: ready.enabled,
    network: dry.network,
    asked: dry.asked,
    mainnetWrites: false,
    wording: ready.wording,
    topicId: ready.topicId || '',
    dailyCapHbar: dry.dailyCapHbar,
    rollback: dry.rollback,
    operatorAlert: balance.alert
  });
}
