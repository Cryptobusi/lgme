import { ensureDeviceKey, signDevice } from './device-sign.mjs';
import { equipmentReferral, gatherEquipment } from './equipment-referral.mjs';
import { OFFER_ID } from './repair-follow.mjs';
import { preparePhoto, saveTilePhoto } from './health-tile-photo.mjs';

const PHOTO_KEY = 'equipment-referral';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function mountEquipmentAsk(host, { onStatus } = {}) {
  const question = el('textarea', { id: 'equipment-question', maxlength: '400', placeholder: 'Ask about broken, setup, or maintenance' });
  const slot = el('div', { id: 'equipment-card' });
  const ask = el('button', { type: 'button', class: 'primary', id: 'equipment-ask', onClick: () => {
    const card = equipmentReferral(question.value);
    if (!card.ok) { onStatus?.(card.error); slot.replaceChildren(); return; }
    if (!card.equipment) {
      slot.replaceChildren();
      onStatus?.('This is not an equipment question. Nothing was sent.');
      return;
    }
    mountEquipmentCard(slot, card, { onStatus });
    onStatus?.('Nothing was sent. You choose whether to share these details.');
  } }, ['Ask about equipment']);
  host.replaceChildren(
    el('h2', {}, ['Equipment']),
    el('p', { class: 'muted' }, ['An equipment question stays on this phone until you choose to share it.']),
    question,
    ask,
    slot
  );
}

export function mountEquipmentCard(host, card, { onStatus } = {}) {
  const details = { ...card.details };
  const item = el('input', { id: 'equipment-item', maxlength: '80', value: details.item });
  const brand = el('input', { id: 'equipment-brand', maxlength: '80', value: details.brandModel });
  const symptom = el('input', { id: 'equipment-symptom', maxlength: '200', value: details.symptom });
  const tried = el('input', { id: 'equipment-tried', maxlength: '160', value: details.tried });
  const share = el('input', { id: 'equipment-share', type: 'checkbox' });
  const photoNote = el('p', { id: 'equipment-photo-note', class: 'muted' }, ['No photo yet. A photo stays on this phone.']);
  const file = el('input', { id: 'equipment-photo', type: 'file', accept: 'image/*' });
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    const prepared = await preparePhoto(chosen);
    if (!prepared.ok) { onStatus?.(prepared.error); return; }
    await saveTilePhoto(prepared.blob, PHOTO_KEY);
    photoNote.textContent = 'Photo saved on this phone. It is not attached to the draft.';
  });
  const links = el('p', { id: 'equipment-links' });
  function current() {
    return gatherEquipment('', {
      item: item.value,
      brandModel: brand.value,
      symptom: symptom.value,
      tried: tried.value
    });
  }
  function paintLinks() {
    const next = equipmentReferral(`${item.value} equipment is broken. ${symptom.value}`, { ...current(), force: true });
    links.replaceChildren(
      el('a', { id: 'equipment-mailto', href: next.mailto }, [card.email]),
      document.createTextNode(' · '),
      el('a', { id: 'equipment-thumbtack', href: next.thumbtack, target: '_blank', rel: 'noopener' }, ['Thumbtack search'])
    );
  }
  paintLinks();
  [item, brand, symptom, tried].forEach((input) => input.addEventListener('input', paintLinks));
  const request = el('button', { type: 'button', class: 'primary', id: 'request-repair', onClick: async () => {
    if (share.checked !== true) { onStatus?.('Choose to share the details first. Nothing was sent.'); return; }
    const fields = current();
    const key = await ensureDeviceKey(localStorage);
    const seat = localStorage.getItem('lgme-gym.seat') || 'member';
    const payload = {
      handle: seat,
      action: 'repair-request',
      origin: 'health',
      offerId: OFFER_ID,
      share: true,
      ...fields,
      at: new Date().toISOString()
    };
    const response = await fetch('/api/exchange/repair', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: seat, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) })
    });
    const body = await response.json().catch(() => ({}));
    onStatus?.(body.ok ? 'Requested. The Exchange item is linked. Nothing was emailed.' : (body.error || 'The request stayed on this phone.'));
  } }, ['Request this']);
  host.replaceChildren(el('article', { class: 'card', id: 'equipment-referral' }, [
    el('img', { src: '/images/photos/tools-bench-640.webp', alt: 'A hand beside a workshop tool', width: '640', height: '420', loading: 'lazy', style: 'width:100%;height:140px;object-fit:cover;border-radius:10px' }),
    el('p', { class: 'kicker' }, ['Referral']),
    el('h3', {}, [card.name]),
    el('p', { id: 'equipment-copy' }, [card.text]),
    el('p', {}, [card.note, ' ', el('a', { href: card.disclaimer }, ['Disclaimer'])]),
    el('label', {}, ['Item', item]),
    el('label', {}, ['Brand and model', brand]),
    el('label', {}, ['Symptom', symptom]),
    el('label', {}, ['Already tried', tried]),
    el('label', {}, ['Photo, optional', file]),
    photoNote,
    el('p', { class: 'muted' }, ['The draft is prefilled. You send it yourself. Nothing is sent automatically.']),
    links,
    el('label', { class: 'check' }, [share, 'Share these details on the Exchange request']),
    request
  ]));
}
