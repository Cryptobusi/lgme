export const PROFILE_DB = 'lgme-device-profile';
export const PROFILE_KEY = 'this-phone';

const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);

export function iosVersion(ua) {
  const match = String(ua || '').match(/OS (\d+)[_.](\d+)/);
  if (!match) return { major: 0, minor: 0 };
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export function pushReadiness({ ios, major, minor, standalone, notification, pushManager }) {
  if (ios && (major < 16 || (major === 16 && minor < 4))) {
    return { state: 'no', detail: 'iOS push needs 16.4 or newer, and only in the installed app.' };
  }
  if (ios && !standalone) {
    return { state: 'no', detail: 'On iOS, push works only after you add lgme to the Home Screen.' };
  }
  if (!notification || !pushManager) return { state: 'no', detail: 'This browser has no push.' };
  return { state: 'yes', detail: 'Push can be asked for on this device. Nothing is sent until you allow it.' };
}

export function pickAiTier(profile) {
  if (profile.webgpu === 'yes') return { tier: 'on-device model', reason: 'WebGPU is available, so the larger on-device model can run here.' };
  if (profile.wasmSimd === 'yes') return { tier: 'smaller on-device model', reason: 'WASM SIMD is available. WebGPU is not, so the smaller tier is used.' };
  return { tier: 'offline helper', reason: 'This device uses the built-in helper. No model is downloaded.' };
}

export function wasmSimdSupported(scope = globalThis) {
  try { return scope.WebAssembly?.validate?.(SIMD) === true; } catch { return false; }
}

function yesNo(value) {
  return value ? 'yes' : 'no';
}

export async function collectCapabilities(scope = globalThis) {
  const nav = scope.navigator || {};
  const win = scope;
  const ua = String(nav.userAgent || '');
  const ios = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1 && !/Chrome|CriOS|FxiOS/i.test(ua) && /Safari/i.test(ua));
  const version = iosVersion(ua);
  const standalone = Boolean(win.matchMedia?.('(display-mode: standalone)')?.matches || nav.standalone === true);
  let webgpu = 'no';
  let adapter = '';
  if (nav.gpu?.requestAdapter) {
    try {
      const got = await nav.gpu.requestAdapter();
      webgpu = got ? 'yes' : 'no';
      const limits = got?.limits;
      if (limits) adapter = `max buffer ${limits.maxBufferSize || 0}`;
    } catch { webgpu = 'no'; }
  }
  const started = typeof scope.performance?.now === 'function' ? scope.performance.now() : Date.now();
  wasmSimdSupported(scope);
  const elapsed = (typeof scope.performance?.now === 'function' ? scope.performance.now() : Date.now()) - started;
  let quota = '';
  let persistence = 'unknown';
  if (nav.storage?.estimate) {
    try {
      const estimate = await nav.storage.estimate();
      quota = `${Math.round((estimate.usage || 0) / 1024)} KB used of ${Math.round((estimate.quota || 0) / 1024 / 1024)} MB`;
    } catch { quota = ''; }
  }
  if (nav.storage?.persisted) {
    try { persistence = (await nav.storage.persisted()) ? 'yes' : 'no'; } catch { persistence = 'unknown'; }
  }
  const push = pushReadiness({
    ios,
    major: version.major,
    minor: version.minor,
    standalone,
    notification: typeof win.Notification === 'function' || typeof scope.Notification === 'function',
    pushManager: 'PushManager' in win || 'PushManager' in scope
  });
  const profile = {
    at: new Date().toISOString(),
    label: ios ? 'iPhone Safari' : /Android/i.test(ua) ? 'Android Chrome' : 'desktop Chrome',
    webgpu,
    adapter,
    wasmSimd: yesNo(wasmSimdSupported(scope)),
    wasmThreads: yesNo(typeof scope.SharedArrayBuffer === 'function' && scope.crossOriginIsolated === true),
    warmupMs: Math.round(elapsed),
    storage: quota,
    persistence,
    offline: yesNo('serviceWorker' in nav),
    push: push.state,
    pushDetail: push.detail,
    badging: yesNo(typeof nav.setAppBadge === 'function'),
    webShare: yesNo(typeof nav.share === 'function'),
    contacts: yesNo(Boolean(nav.contacts?.select)),
    camera: yesNo(Boolean(nav.mediaDevices?.getUserMedia)),
    wakeLock: yesNo(Boolean(nav.wakeLock?.request)),
    bluetooth: yesNo(Boolean(nav.bluetooth?.requestDevice)),
    usb: yesNo(Boolean(nav.usb?.requestDevice)),
    passkey: yesNo(typeof scope.PublicKeyCredential === 'function'),
    tel: yesNo(!/Windows NT|X11|Macintosh/i.test(ua) || /Mobile|Android|iPhone/i.test(ua)),
    facetime: yesNo(ios),
    shareConsent: false
  };
  profile.ai = pickAiTier(profile);
  return profile;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { resolve(null); return; }
    const request = indexedDB.open(PROFILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profiles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProfile(profile) {
  const db = await openDb();
  if (!db) return { ok: true, stored: 'memory' };
  await new Promise((resolve, reject) => {
    const write = db.transaction('profiles', 'readwrite').objectStore('profiles').put(profile, PROFILE_KEY);
    write.onsuccess = () => resolve();
    write.onerror = () => reject(write.error);
  });
  db.close();
  return { ok: true, stored: 'indexeddb' };
}

export async function loadProfile() {
  const db = await openDb();
  if (!db) return null;
  const saved = await new Promise((resolve, reject) => {
    const read = db.transaction('profiles').objectStore('profiles').get(PROFILE_KEY);
    read.onsuccess = () => resolve(read.result || null);
    read.onerror = () => reject(read.error);
  });
  db.close();
  return saved;
}

export async function shareProfile(profile, { consent = false, share } = {}) {
  if (!consent) return { ok: false, sent: false, error: 'Sharing stays off until you opt in.' };
  const text = `${profile.label}. AI tier: ${profile.ai?.tier || ''}. Push: ${profile.push}.`;
  if (typeof share === 'function') {
    await share({ title: 'What this device can do', text });
    return { ok: true, sent: false, shared: true };
  }
  return { ok: true, sent: false, shared: false };
}
