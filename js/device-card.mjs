import { collectCapabilities, loadProfile, saveProfile, shareProfile } from './device-capabilities.mjs';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

const ROWS = [
  ['webgpu', 'WebGPU'],
  ['wasmSimd', 'WASM SIMD'],
  ['wasmThreads', 'WASM threads'],
  ['offline', 'Offline'],
  ['push', 'Push'],
  ['badging', 'Badging'],
  ['webShare', 'Web Share'],
  ['contacts', 'Contact Picker'],
  ['camera', 'Camera or mic'],
  ['wakeLock', 'Wake Lock'],
  ['bluetooth', 'Bluetooth'],
  ['usb', 'USB'],
  ['passkey', 'Passkey'],
  ['tel', 'Phone link'],
  ['facetime', 'FaceTime link']
];

export async function mountDeviceCard(host, scope = globalThis) {
  const profile = await collectCapabilities(scope);
  const prior = await loadProfile().catch(() => null);
  profile.shareConsent = prior?.shareConsent === true;
  await saveProfile(profile);
  const list = el('dl', { id: 'device-can-list' });
  for (const [key, label] of ROWS) {
    list.append(el('dt', {}, [label]), el('dd', {}, [profile[key] || 'no']));
  }
  const consent = el('input', { id: 'device-share-consent', type: 'checkbox' });
  consent.checked = profile.shareConsent;
  const status = el('p', { id: 'device-can-status', role: 'status' }, []);
  host.replaceChildren(el('article', { class: 'card', id: 'device-can' }, [
    el('h2', {}, ['What this device can do']),
    el('p', {}, [`Seen as ${profile.label}. ${profile.ai.reason}`]),
    el('p', { id: 'device-ai-tier' }, [`AI tier: ${profile.ai.tier}.`]),
    el('p', { class: 'muted' }, [profile.pushDetail]),
    el('p', { class: 'muted' }, [profile.storage ? `Storage: ${profile.storage}. Persistence: ${profile.persistence}.` : 'Storage estimate is not available.']),
    el('p', { class: 'muted' }, [`On-device check took ${profile.warmupMs} ms. Nothing was downloaded.`]),
    list,
    el('label', { class: 'check' }, [consent, 'I opt in to share this profile from this phone']),
    el('button', { type: 'button', id: 'device-share', onClick: async () => {
      profile.shareConsent = consent.checked === true;
      await saveProfile(profile);
      const shared = await shareProfile(profile, {
        consent: profile.shareConsent,
        share: scope.navigator?.share ? (data) => scope.navigator.share(data) : null
      });
      status.textContent = shared.ok ? 'Shared from this phone. Nothing was uploaded.' : shared.error;
    } }, ['Share from this phone']),
    el('p', { class: 'muted' }, ['Your email check stays on this phone. This profile stays in IndexedDB. It is not sent to a server.']),
    status
  ]));
  return profile;
}
