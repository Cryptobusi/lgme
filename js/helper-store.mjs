import { HELPER_KEY, makeHelperKey, openText, publicHelper, sealText } from './helper-wizard.mjs';

function browserKeys() {
  const request = indexedDB.open('lgme-helper', 1);
  const db = new Promise((resolve, reject) => {
    request.onupgradeneeded = () => request.result.createObjectStore('keys');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    async getOrCreate() {
      const base = await db;
      const existing = await new Promise((resolve, reject) => {
        const read = base.transaction('keys').objectStore('keys').get('aes');
        read.onsuccess = () => resolve(read.result || null);
        read.onerror = () => reject(read.error);
      });
      if (existing) return existing;
      const key = await makeHelperKey();
      await new Promise((resolve, reject) => {
        const write = base.transaction('keys', 'readwrite').objectStore('keys').put(key, 'aes');
        write.onsuccess = () => resolve();
        write.onerror = () => reject(write.error);
      });
      return key;
    }
  };
}

export async function saveHelper(config, storage = globalThis.localStorage, keys = browserKeys()) {
  const key = await keys.getOrCreate();
  const sealed = await sealText(JSON.stringify(config), key);
  const pub = publicHelper(config);
  storage.setItem(HELPER_KEY, JSON.stringify({ ...pub, sealed }));
  return pub;
}

export async function loadHelper(storage = globalThis.localStorage, keys = browserKeys()) {
  const raw = storage.getItem(HELPER_KEY);
  if (!raw) return null;
  const saved = JSON.parse(raw);
  try {
    const key = await keys.getOrCreate();
    const config = JSON.parse(await openText(saved.sealed, key));
    return { ...config, paused: saved.paused === true };
  } catch {
    return { name: saved.name, engineLabel: saved.engineLabel, paused: saved.paused === true, schedule: saved.schedule };
  }
}

export function helperFile(config) {
  return JSON.stringify({
    name: config.name,
    engine: config.engineLabel,
    does: config.terms,
    fields: config.fields,
    schedule: config.terms?.frequency,
    locked: ['never sends', 'never posts', 'never accepts', 'never signs', 'never spends', 'never mints credit']
  }, null, 2);
}

export function deleteHelper(storage = globalThis.localStorage) {
  storage.removeItem(HELPER_KEY);
}
