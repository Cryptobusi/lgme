export const AGE_LABEL = 'I confirm I am 18 or older';
export const COLLECT_LABEL = 'Collect my own workout and health info on this device';
export const SHARE_LABEL = 'Share selected progress with people I choose';
export const NOTICE_PATH = '/gym/health-data';
export const BREACH_PATH = '/gym/breach-plan';

const HEALTH_PREFIXES = [
  'lgme-sim:peer:',
  'lgme.covenant',
  'lgme.helper',
  'lgme.localAi',
  'lgme.localAgents',
  'lgme.agentPermissionAsked',
  'lgme.aiHelp'
];

export function acceptAge(adult) {
  if (adult !== true) return { ok: false, error: 'Confirm you are 18 or older.' };
  return { ok: true, adult: true };
}

export function healthConsent({ adult, collect, share } = {}) {
  const age = acceptAge(adult === true);
  if (!age.ok) return age;
  if (collect !== true) return { ok: false, error: 'Confirm that workout and health info stays on this device.' };
  return {
    ok: true,
    consent: {
      adult: true,
      collect: true,
      share: share === true
    }
  };
}

export function mayCollect(peer) {
  if (peer?.example === true) return true;
  return peer?.healthConsent?.adult === true && peer?.healthConsent?.collect === true;
}

export function mayShare(peer) {
  if (peer?.example === true) return true;
  return mayCollect(peer) && peer?.healthConsent?.share === true;
}

export function revokeShare(peer = {}) {
  const consent = { ...(peer.healthConsent || {}), share: false };
  const progress = peer.gymProgress ? { ...peer.gymProgress, share: { ...(peer.gymProgress.share || {}) } } : peer.gymProgress;
  if (progress?.share) {
    for (const key of Object.keys(progress.share)) progress.share[key] = 'me';
  }
  return { ...peer, healthConsent: consent, gymProgress: progress };
}

export function healthStorageKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || key.startsWith('lgme-gym-demo:')) continue;
    if (key.startsWith('lgme-gym') || HEALTH_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
  }
  return keys;
}

export function deleteLocalHealth(storage) {
  const keys = healthStorageKeys(storage);
  let saltsDiscarded = 0;
  for (const key of keys) {
    const raw = storage.getItem(key) || '';
    if (raw.includes('"salt"')) saltsDiscarded += 1;
    storage.setItem(key, '');
    storage.removeItem(key);
  }
  return { ok: true, removed: keys, saltsDiscarded };
}
