import { askDevice } from './device-ask.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { attestCard, holdQuery, planReminders } from './high-value.mjs';

function line(text) {
  const node = document.createElement('p');
  node.textContent = text;
  return node;
}

function signFromTap(action, record, at) {
  const payload = { action, entryId: record.id, at };
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('lgme.device.key') || 'null'); } catch { saved = null; }
  if (saved?.privateJwk?.d) return signDevice(saved.privateJwk, payload).then((sig) => ({ payload, sig, publicJwk: saved.publicJwk }));
  return ensureDeviceKey(localStorage).then(async (key) => ({ payload, sig: await signDevice(key.privateJwk, payload), publicJwk: key.publicJwk }));
}

export function renderAttestCard(host, record, handlers = {}, now = Date.now()) {
  if (!host || !record) return null;
  const card = attestCard(record, now);
  const root = document.createElement('article');
  root.id = 'attest-card';
  root.className = card.urgent ? 'card urgent' : 'card';
  const title = document.createElement('h3');
  title.textContent = card.label === 'Urgent' ? 'Urgent' : 'Attest or refuse';
  const what = line(card.what);
  const amount = line(`${card.amount} US$`);
  const parties = line(card.parties);
  const left = line(card.timeLeft);
  const link = document.createElement('a');
  link.href = card.href;
  link.id = 'help-resolve';
  link.textContent = 'Help resolve';
  const attest = document.createElement('button');
  attest.type = 'button';
  attest.id = 'hold-attest';
  attest.textContent = 'Attest';
  const refuse = document.createElement('button');
  refuse.type = 'button';
  refuse.id = 'hold-refuse';
  refuse.textContent = 'Refuse';
  const at = new Date(now).toISOString();
  attest.addEventListener('click', () => {
    signFromTap('attest', record, at).then((signed) => handlers.onAttest && handlers.onAttest(signed));
  });
  refuse.addEventListener('click', () => {
    signFromTap('refuse', record, at).then((signed) => handlers.onRefuse && handlers.onRefuse({ ...signed, seat: 'third' }));
  });
  root.append(title, what, amount, parties, left, link, attest, refuse);
  if (handlers.admin) {
    for (const [id, label, action] of [['hold-approve', 'Approve', 'approve'], ['hold-extend', 'Extend once', 'extend'], ['hold-unresolved', 'Mark unresolved', 'unresolved']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = id;
      button.textContent = label;
      button.addEventListener('click', () => {
        signFromTap(action, record, at).then((signed) => handlers.onAdmin && handlers.onAdmin({ ...signed, action }));
      });
      root.append(button);
    }
  }
  host.replaceChildren(root);
  return card;
}

export function armHoldReminders(records, now = Date.now()) {
  const plan = planReminders(records, now).filter((item) => item.inApp);
  if (!plan.length || typeof document === 'undefined') return plan;
  askDevice({
    kind: 'notifications',
    purpose: 'A pair is nearing a hold, or a hold is still open. This phone can remind you.',
    allow: () => {
      const notify = globalThis.Notification;
      if (!notify) return;
      const send = () => {
        for (const item of plan) {
          const title = item.label === 'Urgent' ? 'Urgent' : 'Hold reminder';
          try { new notify(title, { body: item.kind === 'hold' ? 'A receipt is still pending.' : 'A pair is nearing the next threshold.' }); } catch { /* the in-app card still shows */ }
        }
      };
      if (notify.permission === 'granted') send();
      else if (notify.requestPermission) notify.requestPermission().then((choice) => { if (choice === 'granted') send(); });
    }
  });
  return plan;
}

export function holdFromLocation(search) {
  return holdQuery(search);
}
