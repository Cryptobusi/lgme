import { incognitoOn } from './incognito.mjs';

export const ANCHOR_KEY = 'lgme.hedera.choices';
export const ANCHOR_LOG = 'lgme.hedera.anchors';
export const KINDS = Object.freeze([
  ['ididit', 'IdidIt receipts'],
  ['attestation', 'Attestations'],
  ['ledger', 'Ledger entries'],
  ['inventory', 'Inventory proofs'],
  ['donation', 'Donations'],
  ['maintenance', 'Maintenance logs']
]);
export const REQUIRED = Object.freeze(['ididit']);

export function readChoices(storage) {
  let saved = {};
  try { saved = JSON.parse(storage.getItem(ANCHOR_KEY) || '{}'); } catch { saved = {}; }
  const choices = {};
  for (const [kind] of KINDS) choices[kind] = REQUIRED.includes(kind) ? true : saved[kind] === true;
  return choices;
}

export function setChoice(storage, kind, on, ok) {
  if (ok !== true) return { ok: false, error: 'Tap OK before this choice is kept.' };
  if (!KINDS.some(([id]) => id === kind)) return { ok: false, error: 'That record type is not on the list.' };
  if (REQUIRED.includes(kind)) return { ok: true, choices: readChoices(storage), required: true };
  const choices = readChoices(storage);
  choices[kind] = on === true;
  const stored = {};
  for (const [id] of KINDS) if (!REQUIRED.includes(id)) stored[id] = choices[id] === true;
  storage.setItem(ANCHOR_KEY, JSON.stringify(stored));
  return { ok: true, choices: readChoices(storage) };
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function previewAnchor(kind, source = {}) {
  const id = String(source.id || '').replace(/[^a-z0-9:_-]/gi, '').slice(0, 40);
  const body = { version: 1, network: 'testnet', kind, id };
  const hash = await sha256Hex(JSON.stringify(body));
  const payload = { version: 1, network: 'testnet', kind, hash };
  return {
    network: 'testnet',
    kind,
    hash,
    payload,
    text: JSON.stringify(payload),
    href: `https://hashscan.io/testnet/search?q=${hash}`
  };
}

export function commitAnchor(storage, preview, ok, { incognito = false } = {}) {
  if (incognito) return { ok: false, error: 'Incognito is on. Nothing is anchored.' };
  if (ok !== true) return { ok: false, error: 'Tap OK before this hash is anchored.' };
  if (!preview || preview.network !== 'testnet') return { ok: false, error: 'Only a testnet hash can be anchored.' };
  if (JSON.stringify(preview.payload).match(/name|photo|file|email/i)) return { ok: false, error: 'Personal data stays on the phone.' };
  const choices = readChoices(storage);
  if (!choices[preview.kind]) return { ok: false, error: 'That record type is off.' };
  const row = { kind: preview.kind, hash: preview.hash, href: preview.href, network: 'testnet', at: new Date().toISOString() };
  let log = [];
  try { log = JSON.parse(storage.getItem(ANCHOR_LOG) || '[]'); } catch { log = []; }
  log.push(row);
  storage.setItem(ANCHOR_LOG, JSON.stringify(log));
  return { ok: true, badge: { label: 'On Hedera', href: row.href }, anchor: row };
}

function paintChoices(storage) {
  const box = document.getElementById('hedera-choices');
  if (!box) return;
  const choices = readChoices(storage);
  box.replaceChildren();
  for (const [kind, label] of KINDS) {
    const row = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.kind = kind;
    input.checked = choices[kind];
    input.disabled = REQUIRED.includes(kind);
    row.append(input, document.createTextNode(REQUIRED.includes(kind) ? `${label} (required)` : label));
    box.append(row);
  }
  const preview = document.createElement('p');
  preview.id = 'hedera-preview';
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.id = 'hedera-ok';
  ok.textContent = 'OK';
  ok.addEventListener('click', () => {
    for (const input of box.querySelectorAll('input[data-kind]')) {
      setChoice(storage, input.dataset.kind, input.checked, true);
    }
    const pending = box.dataset.pending;
    if (!pending) {
      preview.textContent = 'Choices kept on this phone. Nothing was anchored.';
      return;
    }
    const result = commitAnchor(storage, JSON.parse(pending), true, { incognito: incognitoOn(storage) });
    preview.textContent = result.ok ? `On Hedera testnet. Only the hash ${result.anchor.hash.slice(0, 12)} is written.` : result.error;
    if (result.ok) {
      const badge = document.createElement('a');
      badge.href = result.badge.href;
      badge.textContent = 'On Hedera';
      badge.rel = 'noopener';
      box.append(badge);
    }
  });
  box.append(preview, ok);
}

export function installHederaChoices(storage = localStorage) {
  const menu = document.getElementById('one-menu');
  if (!menu || document.getElementById('hedera-open')) return;
  const open = document.createElement('button');
  open.type = 'button';
  open.id = 'hedera-open';
  open.textContent = 'Record on Hedera';
  const box = document.createElement('div');
  box.id = 'hedera-choices';
  box.hidden = true;
  open.addEventListener('click', () => {
    box.hidden = !box.hidden;
    if (!box.hidden) paintChoices(storage);
  });
  menu.append(open, box);
  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-anchor]');
    if (!button) return;
    const kind = button.getAttribute('data-anchor');
    const id = button.getAttribute('data-id') || kind;
    if (incognitoOn(storage)) {
      const note = document.getElementById('hedera-preview');
      if (note) note.textContent = 'Incognito is on. Nothing is anchored.';
      return;
    }
    const preview = await previewAnchor(kind, { id });
    if (!document.getElementById('hedera-choices')) return;
    const host = document.getElementById('hedera-choices');
    host.hidden = false;
    paintChoices(storage);
    host.dataset.pending = JSON.stringify(preview);
    const line = document.getElementById('hedera-preview');
    if (line) line.textContent = `Testnet only. This is all that would be written: ${preview.text}`;
  });
}

if (typeof document !== 'undefined') installHederaChoices();
