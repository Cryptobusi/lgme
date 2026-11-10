import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { draftExchangeListing, UNCLAIMED } from './exchange-listing.mjs';
import { saveTilePhoto } from './health-tile-photo.mjs';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null && value !== false) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

async function postListing(payload) {
  const key = await ensureDeviceKey(localStorage);
  const body = { handle: payload.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) };
  const response = await fetch('/api/hedera/listings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  return { status: response.status, result };
}

function handleOf() {
  return (localStorage.getItem('lgme-gym.seat') || 'trainer').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'trainer';
}

export async function mountExchangeTest(host) {
  const status = el('p', { id: 'exchange-test-status', role: 'status' });
  const list = el('div', { id: 'mirror-listings' });
  const note = el('textarea', { id: 'upload-note', maxlength: '280', placeholder: 'Describe the session. You can type or speak.' });
  const draftHost = el('div', { id: 'upload-draft' });
  const role = el('select', { id: 'claim-role' }, [
    el('option', { value: 'trainer' }, ['Trainer']),
    el('option', { value: 'author' }, ['Group author'])
  ]);
  let photoHash = '';

  async function refresh() {
    const response = await fetch('/api/hedera/listings');
    const body = await response.json().catch(() => ({}));
    const rows = body.listings || [];
    list.replaceChildren(...(rows.length ? rows.map((row) => {
      const item = row.item || {};
      const claim = item.status === UNCLAIMED
        ? el('button', { type: 'button', id: `claim-${item.id}`, onClick: () => claimItem(item) }, ['Claim as provider'])
        : null;
      return el('article', { class: 'card', id: `mirror-${item.id}` }, [
        el('h3', {}, [item.title || item.id]),
        el('p', {}, [`${item.status}. ${item.service}. ${item.durationMin || 0} min.`]),
        el('p', { class: 'muted' }, [item.rate ? `Suggested credit ${item.rate.author}. ${item.rate.note || ''}` : '']),
        el('p', {}, [
          el('a', { href: `https://hashscan.io/testnet/topic/${body.topicId}/message/${row.sequenceNumber}` }, [`Mirror message ${row.sequenceNumber}`])
        ]),
        claim
      ]);
    }) : [el('p', { class: 'muted' }, ['No Exchange listings on the mirror yet.'])]));
    status.textContent = body.topicId
      ? `Testnet topic ${body.topicId}. Paid by ${body.payer}. ${body.rules || ''}`
      : (body.error || 'The listings topic did not answer.');
  }

  async function claimItem(item) {
    const payload = {
      handle: handleOf(),
      action: 'update',
      category: 'exchange',
      role: role.value,
      id: item.id,
      title: item.title,
      service: item.service,
      durationMin: item.durationMin,
      tags: item.tags || [],
      rate: item.rate,
      photoHash: item.photoHash || '',
      at: new Date().toISOString()
    };
    const sent = await postListing(payload);
    status.textContent = sent.result.ok
      ? `Claimed. Transaction ${sent.result.transactionId}.`
      : (sent.result.error || 'The claim was not written.');
    if (sent.result.ok) await refresh();
  }

  function showDraft(draft) {
    const title = el('input', { id: 'upload-title', maxlength: '80', value: draft.title });
    const service = el('input', { id: 'upload-service', maxlength: '24', value: draft.service });
    const minutes = el('input', { id: 'upload-minutes', type: 'number', min: '15', max: '240', value: String(draft.durationMin) });
    const tags = el('input', { id: 'upload-tags', maxlength: '80', value: (draft.tags || []).join(' ') });
    draftHost.replaceChildren(
      el('p', { class: 'muted' }, [draft.label]),
      el('p', {}, [`Suggested credit ${draft.rate.author}. The 1% portion is ${draft.rate.skim}. ${draft.rate.note}`]),
      el('label', {}, ['Title', title]),
      el('label', {}, ['Category', service]),
      el('label', {}, ['Duration, minutes', minutes]),
      el('label', {}, ['Tags', tags]),
      el('button', { type: 'button', class: 'primary', id: 'confirm-upload', onClick: async () => {
        const payload = {
          handle: handleOf(),
          action: 'listing',
          category: 'exchange',
          id: `ex-${Date.now().toString(36)}`,
          title: title.value,
          service: service.value,
          durationMin: Number(minutes.value),
          tags: tags.value.split(/\s+/),
          status: UNCLAIMED,
          photoHash,
          at: new Date().toISOString()
        };
        const sent = await postListing(payload);
        status.textContent = sent.result.ok
          ? `Posted. Transaction ${sent.result.transactionId}. ${sent.result.hashscan}`
          : (sent.result.error || 'Nothing was posted.');
        if (sent.result.ok) await refresh();
      } }, ['Confirm and post'])
    );
  }

  const speak = el('button', { type: 'button', id: 'upload-speak', onClick: () => {
    const Rec = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    if (!Rec) { status.textContent = 'Speech is not available on this phone. Type the description.'; return; }
    const heard = new Rec();
    heard.onresult = (event) => { note.value = event.results?.[0]?.[0]?.transcript || note.value; };
    heard.start();
  } }, ['Speak']);
  const photo = el('input', { id: 'upload-photo', type: 'file', accept: 'image/*' });
  photo.addEventListener('change', async () => {
    const file = photo.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    photoHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    await saveTilePhoto(file, `exchange-photo:${photoHash.slice(0, 16)}`);
    status.textContent = 'Photo saved on this phone. Only the hash can be posted.';
  });

  host.replaceChildren(
    el('h2', {}, ['Testnet listings']),
    el('p', { class: 'muted' }, ['Exchange testing writes to Hedera testnet topic 0.0.11397293. Account 0.0.11281203 pays each message. The topic has no admin key, so no submit key was added. No email, phone, or photo bytes go on the topic.']),
    status,
    role,
    list,
    el('h3', {}, ['Add a listing']),
    el('p', { class: 'muted' }, ['The assistant drafts on this phone. Nothing is posted until you confirm.']),
    note,
    speak,
    el('label', {}, ['Photo, optional', photo]),
    el('button', { type: 'button', id: 'draft-upload', onClick: () => {
      const draft = draftExchangeListing(note.value);
      if (!draft.ok) { status.textContent = draft.error; draftHost.replaceChildren(); return; }
      showDraft(draft);
      status.textContent = 'Draft only. Not posted.';
    } }, ['Draft with the assistant']),
    draftHost
  );
  await refresh();
}

const host = document.getElementById('exchange-test');
if (host) mountExchangeTest(host);
