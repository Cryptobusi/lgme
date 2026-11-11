export const RESET_EPOCH = '2';

const KEEP_EXACT = new Set([
  'lgme.reset.epoch',
  'lgme.reset.note',
  'lgme.device.key',
  'lgme-gym.seat',
  'lgme.health.book',
  'lgme.health.email',
  'lgme.health.plan',
  'lgme.health.contact',
  'lgme.health.contactGrants'
]);

export function keepKey(name) {
  if (!name || KEEP_EXACT.has(name)) return true;
  return name.startsWith('lgme-sim:peer:') || name.startsWith('lgme.health.page:');
}

export function clearAppState(storage) {
  const names = [];
  for (let i = 0; i < storage.length; i += 1) names.push(storage.key(i));
  for (const name of names) {
    if (!keepKey(name)) storage.removeItem(name);
  }
}

export function shouldReset({ epoch = '', controlled = false, caches = [] } = {}, currentCaches = []) {
  if (epoch === RESET_EPOCH) return false;
  if (epoch) return true;
  if (controlled) return true;
  const current = new Set(currentCaches);
  return caches.some((name) => !current.has(name));
}
