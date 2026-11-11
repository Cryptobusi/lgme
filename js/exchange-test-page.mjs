import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { AUTHOR_STATUS, EXAMPLE_STATUS, UNCLAIMED, draftExchangeListing } from './exchange-listing.mjs';
import { saveTilePhoto } from './health-tile-photo.mjs';
import { loadPersonalImages, resolveImage, slotForListing, viewerId } from './personal-images.mjs';
import { POOL_ID } from './membership-pool.mjs';
import { renderMembershipPool } from './membership-pool-page.mjs';
import { deviceContext, draftWithHelper, pickHelperSync } from './one-tap.mjs';

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
    const viewer = viewerId(localStorage);
    const saved = viewer ? await loadPersonalImages(viewer, localStorage) : null;
    const rows = body.listings || [];
    rows.sort((a, b) => (b.item?.pinned === true) - (a.item?.pinned === true));
    list.replaceChildren(...(rows.length ? rows.map((row) => {
      const item = row.item || {};
      const claim = item.status === UNCLAIMED || item.status === AUTHOR_STATUS || item.status === EXAMPLE_STATUS || /^Test item - /.test(item.status || '')
        ? el('button', { type: 'button', id: `claim-${item.id}`, onClick: () => claimItem(item) }, ['Claim as provider'])
        : null;
      const thumbs = {
        'ex-strength': ['/images/photos/dumbbells-640.webp', 'A rack of dumbbells'],
        'ex-running': ['/images/photos/jogger-640.webp', 'A person jogging on a park path'],
        'ex-yoga': ['/images/photos/stretch-640.webp', 'An adult stretching on the grass'],
        'ex-plan': ['/images/photos/neighborhood-640.webp', 'A quiet path through pines'],
        'ex-motivation': ['/images/photos/shop-street-640.webp', 'People walking together on a city street'],
        'ex-seniors': ['/images/photos/shop-street-640.webp', 'Adults, including an older couple, walking on a city street'],
        'ex-bike': ['/images/photos/neighborhood-640.webp', 'A neighborhood path for a ride'],
        'ex-loan': ['/images/photos/dumbbells-640.webp', 'Dumbbells ready to borrow'],
        'ex-walk': ['/images/photos/jogger-640.webp', 'A person out for a walk or jog'],
        'ex-repair': ['/assets/img/repair-extraordinaire.webp', 'Person exercising on a treadmill: The Repair Extraordinaire, equipment repair'],
        [POOL_ID]: ['/images/photos/volunteers-640.webp', 'Neighbors working together outdoors']
      };
      const slot = slotForListing(item);
      const mine = slot && saved ? resolveImage(slot, saved.images, saved.memberId, viewer) : null;
      const thumb = mine?.custom
        ? [mine.src, mine.alt]
        : (thumbs[item.id] || (String(item.title || '').includes('Repair') ? ['/assets/img/repair-extraordinaire.webp', 'Person exercising on a treadmill: The Repair Extraordinaire, equipment repair'] : null));
      const poolLine = item.id === POOL_ID
        ? `In US$${Number(item.inUsd || 0).toFixed(2)}. Out US$${Number(item.outUsd || 0).toFixed(2)}. Covers ${item.covers || 0}.`
        : `${item.type || item.status}. ${item.pay === 'pool' ? 'Pool' : item.pay === 'self' ? 'Self' : ''} ${item.service}. ${item.durationMin || 0} min. ${item.summary || ''}`;
      return el('article', { class: 'card', id: `mirror-${item.id}` }, [
        thumb ? el('img', { src: thumb[0], alt: thumb[1], width: '356', height: '480', loading: 'lazy', style: thumb[0].includes('repair-extraordinaire') ? 'width:100%;height:180px;object-fit:contain;background:#efe8dc;border-radius:10px' : 'width:100%;height:140px;object-fit:cover;border-radius:10px' }) : null,
        el('h3', {}, [item.title || item.id]),
        el('p', {}, [poolLine]),
        el('p', { class: 'muted' }, [item.rate ? `Suggested credit ${item.rate.author}. ${item.rate.note || ''}` : '']),
        el('p', {}, [
          el('a', { href: `https://hashscan.io/testnet/topic/${body.topicId}/message/${row.sequenceNumber}` }, [`Mirror message ${row.sequenceNumber}`])
        ]),
        claim
      ]);
    }) : [
      el('img', { src: '/images/photos/neighborhood-640.webp', alt: 'A quiet path, waiting for the first listing', width: '640', height: '420', loading: 'lazy', style: 'width:100%;max-height:160px;object-fit:cover;border-radius:10px' }),
      el('p', { class: 'muted' }, ['No Exchange listings on the mirror yet.'])
    ]));
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
    try {
      const sent = await postListing(payload);
      status.textContent = sent.result.ok
        ? `Claimed. Transaction ${sent.result.transactionId}.`
        : (sent.result.error || 'The claim was not written.');
      if (sent.result.ok) await refresh();
    } catch {
      status.textContent = 'Nothing was posted. The network did not answer.';
    }
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
        try {
          const sent = await postListing(payload);
          status.textContent = sent.result.ok
            ? `Posted. Transaction ${sent.result.transactionId}. ${sent.result.hashscan}`
            : (sent.result.error || 'Nothing was posted.');
          if (sent.result.ok) await refresh();
        } catch {
          status.textContent = 'Nothing was posted. The network did not answer.';
        }
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

  const poolHost = el('div', { id: 'membership-pool', class: 'card' });
  host.replaceChildren(
    poolHost,
    el('h2', {}, ['Testnet listings']),
    el('p', { class: 'muted' }, ['A listing draft stays on this phone. Nothing is posted until you confirm. No email, phone, or photo bytes are included.']),
    status,
    role,
    list,
    el('h3', {}, ['Add a listing']),
    el('p', { class: 'muted' }, ['The assistant drafts on this phone. Nothing is posted until you confirm.']),
    note,
    speak,
    el('label', {}, ['Photo, optional', photo]),
    el('button', { type: 'button', id: 'one-tap-listing', onClick: async () => {
      const helper = pickHelperSync();
      const known = deviceContext();
      const template = `A 45 minute ${known.category || 'health'} session.`;
      const result = await draftWithHelper(helper, { template, prompt: `Draft a session listing. ${template}`, scope: window });
      note.value = result.text;
      const drafted = draftExchangeListing(note.value);
      if (!drafted.ok) { status.textContent = drafted.error; return; }
      showDraft(drafted);
      status.textContent = `${helper.note}. Draft only. Not posted.`;
    } }, ['Draft with what I know']),
    el('button', { type: 'button', id: 'draft-upload', onClick: () => {
      const draft = draftExchangeListing(note.value);
      if (!draft.ok) { status.textContent = draft.error; draftHost.replaceChildren(); return; }
      showDraft(draft);
      status.textContent = 'Draft only. Not posted.';
    } }, ['Draft with the assistant']),
    draftHost
  );
  await renderMembershipPool(poolHost, handleOf());
  await refresh();
}

const host = document.getElementById('exchange-test');
if (host) mountExchangeTest(host);
