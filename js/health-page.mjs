import { answerLocal, detectEngine } from './local-ai.mjs';
import { holdFromChat } from './equipment-referral.mjs';
import { mountEquipmentCard } from './equipment-card.mjs';
import { HEALTH_PLANS, PLAN_ORDER } from './health-plan.mjs';
import { fallbackLayout, layoutFromText, recommendId } from './health-layout.mjs';
import { ENCOURAGEMENTS, inQuietHours, timeProposal, unreadCount } from './health-presence.mjs';
import { loadTilePhoto, preparePhoto, saveTilePhoto } from './health-tile-photo.mjs';
import { resolveImage, slimImages } from './personal-images.mjs';
import { mountImageSlots } from './personal-images-ui.mjs';
import { CONTACT_NOTICE, contactLinks, makeContactKey, openContact, sealContact } from './health-contact.mjs';

const SEEN_KEY = 'lgme.health.seen';
const PHOTO_KEY = 'health-page';

export function pageKey(memberId) {
  return `lgme.health.page:${memberId || 'this-phone'}`;
}

export function rememberPage(storage, record) {
  const copy = { ...record, hedera: false, confirmed: true };
  if (record.images) copy.images = slimImages(record.images);
  storage.setItem(pageKey(copy.memberId), JSON.stringify(copy));
  return copy;
}

export function recallPage(storage, memberId) {
  try {
    const saved = JSON.parse(storage.getItem(pageKey(memberId)) || 'null');
    return saved?.confirmed && saved.layout ? saved : null;
  } catch {
    return null;
  }
}

function pageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lgme-health-page', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pages');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePageDb(record) {
  const db = await pageDb();
  await new Promise((resolve, reject) => {
    const write = db.transaction('pages', 'readwrite').objectStore('pages').put(record, pageKey(record.memberId));
    write.onsuccess = () => resolve();
    write.onerror = () => reject(write.error);
  });
  db.close();
}

export async function loadPageDb(memberId) {
  const db = await pageDb();
  const saved = await new Promise((resolve, reject) => {
    const read = db.transaction('pages').objectStore('pages').get(pageKey(memberId));
    read.onsuccess = () => resolve(read.result || null);
    read.onerror = () => reject(read.error);
  });
  db.close();
  return saved?.confirmed && saved.layout ? saved : null;
}

export async function rememberConfirmed(storage, record, peerStore) {
  const fullImages = record.images || {};
  const copy = rememberPage(storage, record);
  try { await savePageDb({ ...copy, images: fullImages }); } catch { /* localStorage already has the copy */ }
  if (peerStore && copy.memberId && copy.memberId !== 'this-phone') {
    const peer = await peerStore.get(copy.memberId);
    if (peer) {
      peer.healthPage = copy;
      await peerStore.set(copy.memberId, peer);
    }
  }
  return { ...copy, images: fullImages };
}

export async function recallConfirmed(storage, memberId) {
  const local = recallPage(storage, memberId);
  let saved = null;
  try { saved = await loadPageDb(memberId); } catch { saved = null; }
  if (!local && !saved) return null;
  const base = local || saved;
  return { ...base, images: saved?.images || base.images || {} };
}

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

function readJson(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
}

export function confirmedPage(storage, memberId) {
  return recallPage(storage, memberId);
}

function goalsOf(peer) {
  const intake = peer?.intake || {};
  return [intake.primary, intake.secondary, intake.goals].filter(Boolean).join(' ');
}

function groupCode(peer) {
  return Object.keys(peer?.clubGroups || {})[0] || '';
}

async function askLayout(id, prompt) {
  const fallback = fallbackLayout(id);
  if (detectEngine(globalThis).id === 'rules') return fallback;
  try {
    const result = await answerLocal({
      question: `${prompt}\n\nReply with one JSON object only. Keys: title, tone, sections as id title body, reminders as days time text. No HTML. No script.`
    });
    if (!result.text || result.engine === 'rules') return fallback;
    const parsed = layoutFromText(result.text, id);
    if (!parsed.ok) return fallback;
    return { ...parsed, layout: parsed.layout, label: result.label, engine: result.engine, recommended: false };
  } catch {
    return fallback;
  }
}

function preview(layout) {
  const host = el('div', { class: 'layout-preview', id: `plan-preview-${layout.layout.id}` });
  host.append(el('p', { class: 'kicker' }, [layout.label]));
  host.append(el('h3', {}, [layout.layout.title]));
  host.append(el('p', { class: 'muted' }, [layout.layout.tone]));
  for (const section of layout.layout.sections) {
    host.append(el('h4', {}, [section.title]));
    host.append(el('p', {}, [section.body]));
  }
  return host;
}

export async function personalizeView({ storage, status, go, goals, memberId, peerStore }) {
  const recommended = recommendId(goals);
  const host = el('section', { id: 'personalize' }, [
    el('h2', {}, ['Pick a Health page']),
    el('p', {}, ['Three page drafts. Nothing changes until you confirm. You can switch or generate again.'])
  ]);
  const strip = el('div', { id: 'plan-pick', class: 'plan-pick' });
  let chosen = recommended;
  const review = el('p', { id: 'plan-review' }, [`Recommended: ${HEALTH_PLANS[recommended].title}.`]);
  for (const id of PLAN_ORDER) {
    const plan = HEALTH_PLANS[id];
    const note = el('textarea', { id: `plan-note-${id}`, maxlength: '700' });
    note.value = plan.prompt;
    const live = el('div', { id: `plan-live-${id}` });
    const card = el('section', { class: 'card plan-card', id: `plan-${id}` }, [
      el('h3', {}, [plan.title, id === recommended ? el('span', { id: 'plan-recommended', class: 'badge' }, [' Recommended']) : '']),
      el('img', { src: plan.image, srcset: plan.srcset, sizes: '(max-width: 700px) 90vw, 280px', alt: plan.alt, width: '640', height: '420', loading: 'lazy' }),
      live,
      el('pre', { id: `plan-prompt-${id}` }, [plan.prompt]),
      el('label', {}, ['Prompt. You can edit it.', note]),
      el('button', { type: 'button', id: `use-${id}`, onClick: async () => {
        live.replaceChildren(el('p', {}, ['Drafting on this phone…']));
        const layout = await askLayout(id, note.value.trim() || plan.prompt);
        if (goals) layout.recommended = id === recommended;
        live.replaceChildren(preview(layout));
        card.dataset.layout = JSON.stringify(layout);
      } }, ['Use this']),
      el('button', { type: 'button', class: 'primary', id: `pick-${id}`, onClick: () => {
        chosen = id;
        review.textContent = `Picked ${plan.title}. Confirm when the page looks right.`;
        status(`Picked ${plan.title}. Nothing is applied yet.`);
      } }, ['Pick this'])
    ]);
    const first = fallbackLayout(id, goals);
    first.recommended = id === recommended;
    live.replaceChildren(preview(first));
    card.dataset.layout = JSON.stringify(first);
    strip.append(card);
  }
  host.append(strip, review, el('button', { type: 'button', class: 'primary', id: 'confirm-layout', onClick: async () => {
    const card = document.getElementById(`plan-${chosen}`);
    const layout = JSON.parse(card?.dataset.layout || 'null');
    if (!layout?.layout) { status('Generate a page first.'); return; }
    const prompt = document.getElementById(`plan-note-${chosen}`)?.value || HEALTH_PLANS[chosen].prompt;
    const prior = await recallConfirmed(storage, memberId) || {};
    await rememberConfirmed(storage, {
      memberId: memberId || 'this-phone',
      confirmedAt: new Date().toISOString(),
      prompt,
      layout,
      reminders: prior.reminders || null,
      status: prior.status || { status: 'available', note: '', share: false },
      quiet: prior.quiet || null,
      mute: prior.mute === true,
      background: prior.background || '',
      images: prior.images || {},
      connect: ''
    }, peerStore);
    status('Saved on this phone. Nothing was sent.');
    go('/page');
  } }, ['Confirm']));
  host.append(el('p', { id: 'gym-status', role: 'status' }, []));
  return host;
}

function paintPage(root, url) {
  if (url) {
    root.style.backgroundImage = `url("${url}")`;
    root.classList.add('has-page-photo');
  }
}

export async function personalPageView({ storage, status, go, mine, signedGym, peerStore }) {
  const saved = await recallConfirmed(storage, mine?.id);
  const code = groupCode(mine);
  const root = el('section', { id: 'personal-page' });
  if (saved) {
    root.append(el('p', { class: 'kicker' }, [saved.layout.label || 'Your page']));
    root.append(el('h2', {}, [saved.layout.layout.title]));
    root.append(el('p', {}, [saved.layout.layout.tone]));
    for (const section of saved.layout.layout.sections) {
      root.append(el('article', { class: 'card' }, [el('h3', {}, [section.title]), el('p', {}, [section.body])]));
    }
  } else {
    root.append(el('h2', {}, ['Your Health page']));
    root.append(el('p', {}, ['Pick a page first. You can still set what the group may see.']));
  }
  if (saved?.confirmedAt) root.append(el('p', { id: 'page-saved' }, [`Saved on this phone ${saved.confirmedAt}.`]));
  root.append(el('p', {}, [
    el('button', { type: 'button', id: 'change-page', onClick: () => go('/personalize') }, ['Change my page']),
    ' ',
    el('button', { type: 'button', id: 'regenerate-page', onClick: () => go('/personalize') }, ['Regenerate'])
  ]));
  const photoStatus = el('p', { id: 'page-photo-status' });
  const file = el('input', { id: 'page-photo', type: 'file', accept: 'image/*' });
  file.addEventListener('change', async () => {
    const prepared = await preparePhoto(file.files?.[0]);
    if (!prepared.ok) { photoStatus.textContent = prepared.error; return; }
    await saveTilePhoto(prepared.blob, `${PHOTO_KEY}:${mine?.id || 'this-phone'}`);
    paintPage(root, URL.createObjectURL(prepared.blob));
    photoStatus.textContent = 'Background saved on this phone.';
    await keep({ background: `${PHOTO_KEY}:${mine?.id || 'this-phone'}` });
  });
  const time = el('input', { id: 'reminder-time', type: 'time', value: '19:00' });
  const days = el('input', { id: 'reminder-days', value: 'mon,wed,fri', maxlength: '40' });
  const reminderText = el('input', { id: 'reminder-text', value: 'A short walk, if you want.', maxlength: '80' });
  const reminderStatus = el('p', { id: 'reminder-status' });
  const statusSelect = el('select', { id: 'member-status' }, ['available', 'training', 'resting', 'away'].map((item) => el('option', { value: item }, [item])));
  const statusNote = el('input', { id: 'status-note', maxlength: '80', placeholder: 'Optional note' });
  const share = el('input', { id: 'status-share', type: 'checkbox' });
  const members = el('div', { id: 'live-members' });
  const unread = el('p', { id: 'live-unread' }, ['Chat unread 0. Encouragement unread 0.']);
  const chatLog = el('div', { id: 'member-chat' });
  const chatText = el('input', { id: 'chat-text', maxlength: '280', placeholder: 'Message the group' });
  const encourageWho = el('input', { id: 'encourage-who', maxlength: '40', placeholder: 'Member handle' });
  const encourageText = el('select', { id: 'encourage-text' }, ENCOURAGEMENTS.map((line) => el('option', { value: line }, [line])));
  const customNote = el('input', { id: 'encourage-custom', maxlength: '80', placeholder: 'Or write a short note' });
  root.append(el('section', { class: 'card', id: 'customize-panel' }, [
    el('h3', {}, ['Customize']),
    el('div', { id: 'image-slots' }),
    el('label', {}, ['Background image, on this phone', file]),
    photoStatus,
    el('h3', {}, ['Reminder']),
    el('label', {}, ['Time', time]),
    el('label', {}, ['Days, short names', days]),
    el('label', {}, ['Gentle line', reminderText]),
    el('button', { type: 'button', id: 'save-reminder', onClick: async () => {
      const reminder = { days: days.value.split(',').map((day) => day.trim()).filter(Boolean), time: time.value, text: reminderText.value.trim() };
      await keep({ reminders: reminder });
      reminderStatus.textContent = `Reminder saved on this phone: ${reminder.time} on ${reminder.days.join(', ')}.`;
    } }, ['Save reminder']),
    reminderStatus,
    el('h3', {}, ['Status']),
    el('p', { class: 'muted' }, ['Off unless you choose to share it with your group.']),
    statusSelect,
    statusNote,
    el('label', { class: 'check' }, [share, 'Share my status with my group']),
    el('button', { type: 'button', id: 'save-status', onClick: () => saveStatus() }, ['Save status']),
    el('h3', {}, ['Online']),
    el('p', { class: 'muted', id: 'online-note' }, ['Off until you turn it on. It expires after 30 minutes, or when your window ends.']),
    el('button', { type: 'button', id: 'go-online', onClick: () => setConnect('online') }, ['Online now']),
    el('button', { type: 'button', id: 'ok-connect', onClick: () => setConnect('ok') }, ['OK to connect']),
    el('button', { type: 'button', id: 'go-offline', onClick: () => setConnect('') }, ['Turn presence off']),
    el('label', {}, ['Free until', el('input', { id: 'connect-until', type: 'datetime-local' })]),
    el('label', {}, ['Quiet from', el('input', { id: 'quiet-start', type: 'time', value: saved?.quiet?.start || '22:00' })]),
    el('label', {}, ['Quiet until', el('input', { id: 'quiet-end', type: 'time', value: saved?.quiet?.end || '07:00' })]),
    el('label', { class: 'check' }, [el('input', { id: 'presence-mute', type: 'checkbox' }), 'Mute presence notices']),
    el('button', { type: 'button', id: 'save-quiet', onClick: () => saveQuiet() }, ['Save quiet hours']),
    el('p', { id: 'presence-note', role: 'status' }, []),
    el('h3', {}, ['Group']),
    unread,
    members,
    chatLog,
    chatText,
    el('button', { type: 'button', id: 'send-chat', onClick: () => sendChat() }, ['Send chat']),
    el('div', { id: 'equipment-card' }),
    el('label', {}, ['Suggest a time', el('input', { id: 'suggest-time', type: 'datetime-local' })]),
    el('button', { type: 'button', id: 'suggest-time-send', onClick: () => suggestTime() }, ['Suggest a time']),
    el('h3', {}, ['Encouragement']),
    encourageWho,
    encourageText,
    customNote,
    el('button', { type: 'button', id: 'send-encouragement', onClick: () => sendEncouragement() }, ['Send encouragement']),
    el('h3', {}, ['Call']),
    el('p', { class: 'muted' }, ['Call and Video appear only after you both approve. The phone’s own app places the call.']),
    el('select', { id: 'contact-kind' }, [
      el('option', { value: 'phone' }, ['Phone number']),
      el('option', { value: 'facetime' }, ['FaceTime']),
      el('option', { value: 'whatsapp' }, ['WhatsApp']),
      el('option', { value: 'signal' }, ['Signal'])
    ]),
    el('input', { id: 'contact-value', maxlength: '80', placeholder: 'Number or handle, on this phone' }),
    el('button', { type: 'button', id: 'save-contact', onClick: () => saveContact() }, ['Save contact on this phone']),
    el('input', { id: 'contact-ask-who', maxlength: '40', placeholder: 'Member handle' }),
    el('button', { type: 'button', id: 'ask-contact', onClick: () => askContact() }, ['Ask to share']),
    el('button', { type: 'button', id: 'approve-contact', onClick: () => approveContact() }, ['Approve']),
    el('p', { id: 'call-actions' }, []),
    el('button', { type: 'button', id: 'revoke-contact', onClick: () => revokeContact() }, ['Revoke sharing']),
    el('button', { type: 'button', class: 'primary', id: 'contribution', onClick: () => go('/groups') }, ['Contribution']),
    el('p', { class: 'muted' }, ['Opens the existing contribution flow. A workout mints no credit.'])
  ]));
  root.append(el('p', { id: 'gym-status', role: 'status' }, []));

  async function keep(extra) {
    const current = recallPage(storage, mine?.id) || saved;
    if (!current?.layout) return null;
    return rememberConfirmed(storage, {
      ...current,
      ...extra,
      memberId: mine?.id || 'this-phone',
      confirmedAt: current.confirmedAt
    }, peerStore);
  }
  async function saveQuiet() {
    await keep({
      quiet: { start: document.getElementById('quiet-start')?.value || '', end: document.getElementById('quiet-end')?.value || '' },
      mute: document.getElementById('presence-mute')?.checked === true
    });
    status('Quiet hours saved on this phone.');
  }
  async function setConnect(connect) {
    if (!mine || !code) { status('Join a group before you say you are free.'); return; }
    const until = document.getElementById('connect-until')?.value || '';
    const at = new Date().toISOString();
    const response = await signedGym('/api/gym/presence', {
      handle: mine.id, action: 'presence', code, status: statusSelect.value, note: statusNote.value,
      share: share.checked === true, connect, until, at, seen: at
    });
    const body = await response.json().catch(() => ({}));
    await keep({ connect, until });
    status(body.ok ? (connect ? 'Your group can see that you are free.' : 'Presence is off.') : (body.error || body.message || 'Presence stayed on this phone.'));
    await refresh();
  }
  async function suggestTime() {
    const when = document.getElementById('suggest-time')?.value || '';
    if (!when) { status('Choose a time.'); return; }
    chatText.value = `Time: ${when}`;
    await sendChat();
  }
  async function saveContact() {
    const kind = document.getElementById('contact-kind')?.value || 'phone';
    const value = document.getElementById('contact-value')?.value.trim() || '';
    if (!value) { status('Add what you want to share.'); return; }
    const prior = readJson(storage, 'lgme.health.contact') || {};
    const keys = prior.privateJwk ? prior : await makeContactKey();
    storage.setItem('lgme.health.contact', JSON.stringify({ ...keys, kind, value }));
    if (mine && code) {
      const at = new Date().toISOString();
      const response = await signedGym('/api/gym/presence', { handle: mine.id, action: 'presence', code, contactKey: keys.publicJwk, share: false, connect: '', at, seen: at });
      const body = await response.json().catch(() => ({}));
      status(body.ok ? 'Contact saved on this phone. Only the key is shared.' : `Contact saved on this phone. ${body.error || CONTACT_NOTICE}`);
      return;
    }
    status('Contact saved on this phone. Nothing was posted.');
  }
  async function askContact() {
    if (!mine || !code) { status('Join a group first.'); return; }
    const to = document.getElementById('contact-ask-who')?.value.trim() || '';
    const response = await signedGym('/api/gym/presence', { handle: mine.id, action: 'direct', direct: 'ask', code, to, at: new Date().toISOString() });
    const body = await response.json().catch(() => ({}));
    status(body.ok ? `Asked ${to}. They approve on their phone.` : (body.error || CONTACT_NOTICE));
  }
  async function approveContact() {
    if (!mine || !code) { status('Join a group first.'); return; }
    const to = document.getElementById('contact-ask-who')?.value.trim() || '';
    const mineContact = readJson(storage, 'lgme.health.contact');
    if (!lastDirect.contactKeys?.some((row) => row.handle === to)) {
      try { lastDirect = await (await fetch(`/api/gym/presence?code=${encodeURIComponent(code)}`)).json(); } catch { /* the notice below covers it */ }
    }
    const theirKey = (lastDirect.contactKeys || []).find((row) => row.handle === to)?.contactKey;
    if (!mineContact?.privateJwk || !theirKey) { status(CONTACT_NOTICE); return; }
    const sealed = await sealContact(mineContact.privateJwk, theirKey, { kind: mineContact.kind, value: mineContact.value });
    const response = await signedGym('/api/gym/presence', { handle: mine.id, action: 'direct', direct: 'share', code, to, iv: sealed.iv, cipher: sealed.cipher, at: new Date().toISOString() });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { status(body.error || CONTACT_NOTICE); return; }
    const grants = readJson(storage, 'lgme.health.contactGrants') || {};
    grants[to] = { ...(grants[to] || {}), approved: true };
    storage.setItem('lgme.health.contactGrants', JSON.stringify(grants));
    status('Approved. The contact is sealed for that member.');
    await refresh();
  }
  async function revokeContact() {
    if (!mine || !code) return;
    const to = document.getElementById('contact-ask-who')?.value.trim() || '';
    await signedGym('/api/gym/presence', { handle: mine.id, action: 'direct', direct: 'revoke', code, to, at: new Date().toISOString() });
    const grants = readJson(storage, 'lgme.health.contactGrants') || {};
    delete grants[to];
    storage.setItem('lgme.health.contactGrants', JSON.stringify(grants));
    status('Sharing revoked.');
    await refresh();
  }
  async function saveStatus() {
    if (!mine || !code) { status('Join a group before sharing a status.'); return; }
    const at = new Date().toISOString();
    const current = recallPage(storage, mine.id);
    const response = await signedGym('/api/gym/presence', {
      handle: mine.id, action: 'presence', code, status: statusSelect.value, note: statusNote.value, share: share.checked === true,
      connect: current?.connect || '', until: current?.until || '', at, seen: at
    });
    const body = await response.json().catch(() => ({}));
    status(body.ok ? (share.checked ? 'Status shared with your group.' : 'Status saved. The group cannot see it.') : (body.error || body.message || 'Status stays on this phone.'));
    await keep({ status: { status: statusSelect.value, note: statusNote.value, share: share.checked === true } });
    await refresh();
  }
  async function sendChat() {
    if (!mine || !code) { status('Join a group before chatting.'); return; }
    const held = holdFromChat(chatText.value);
    if (!held.send) {
      const slot = document.getElementById('equipment-card');
      if (slot && held.card?.equipment) mountEquipmentCard(slot, held.card, { onStatus: status });
      status(held.card?.error || 'Nothing was sent. You choose whether to share these details.');
      return;
    }
    const response = await signedGym('/api/gym/chat', { handle: mine.id, action: 'chat', code, text: chatText.value, at: new Date().toISOString() });
    const body = await response.json().catch(() => ({}));
    status(body.ok ? 'Sent to the group.' : (body.error || 'Chat stays on this phone.'));
    chatText.value = '';
    await refresh();
  }
  async function sendEncouragement() {
    if (!mine || !code) { status('Join a group first.'); return; }
    const response = await signedGym('/api/gym/presence', {
      handle: mine.id,
      action: 'encouragement',
      code,
      to: encourageWho.value.trim(),
      text: customNote.value.trim() || encourageText.value,
      at: new Date().toISOString()
    });
    const body = await response.json().catch(() => ({}));
    status(body.ok ? 'Encouragement sent.' : (body.error || 'It stayed on this phone.'));
    await refresh();
  }
  let lastDirect = { contactKeys: [], directs: [] };
  async function refresh() {
    if (!code) {
      members.textContent = 'No group yet.';
      return;
    }
    let presence = { members: [], encouragements: [] };
    let messages = [];
    try {
      const response = await fetch(`/api/gym/presence?code=${encodeURIComponent(code)}`);
      presence = await response.json();
    } catch { presence = { members: [], encouragements: [] }; }
    try {
      const response = await fetch(`/api/gym/chat?code=${encodeURIComponent(code)}`);
      const body = await response.json();
      messages = body.messages || [];
    } catch { messages = []; }
    const seen = readJson(storage, SEEN_KEY) || {};
    const chatUnread = unreadCount(messages.map((row) => ({ ...row, from: row.handle })), mine?.id, seen.chat);
    const noteUnread = unreadCount(presence.encouragements || [], mine?.id, seen.notes);
    unread.textContent = `Chat unread ${chatUnread}. Encouragement unread ${noteUnread}.`;
    chatLog.replaceChildren(...messages.slice(-8).map((row) => {
      const line = el('p', {}, [`${row.handle}: ${row.text}`]);
      const proposed = timeProposal(row.text);
      if (proposed && row.handle !== mine?.id) {
        line.append(el('button', { type: 'button', onClick: async () => {
          chatText.value = `Time accepted: ${proposed}`;
          await sendChat();
        } }, ['Accept']));
        line.append(el('button', { type: 'button', onClick: () => document.getElementById('suggest-time')?.focus() }, ['Propose another']));
      }
      return line;
    }));
    lastDirect = presence;
    const grants = readJson(storage, 'lgme.health.contactGrants') || {};
    const mineContact = readJson(storage, 'lgme.health.contact');
    for (const row of presence.directs || []) {
      if (row.kind === 'revoke') delete grants[row.from];
      if (row.kind === 'share' && row.to === mine?.id && mineContact?.privateJwk) {
        const theirKey = (presence.contactKeys || []).find((item) => item.handle === row.from)?.contactKey;
        if (!theirKey) continue;
        try {
          const clear = await openContact(mineContact.privateJwk, theirKey, row);
          grants[row.from] = { ...grants[row.from], ...clear, from: row.from };
        } catch { /* the seal is not for this device */ }
      }
    }
    storage.setItem('lgme.health.contactGrants', JSON.stringify(grants));
    const ready = Object.values(grants).filter((row) => row?.approved && row.value && row.kind);
    const actions = document.getElementById('call-actions');
    if (actions) {
      actions.replaceChildren(...ready.flatMap((row) => {
        const links = contactLinks(row.kind, row.value);
        if (!links) return [];
        return [
          el('a', { id: 'call-link', href: links.call }, [`Call ${row.from}`]),
          el('a', { id: 'video-link', href: links.video }, [`Video ${row.from}`])
        ];
      }));
    }
    const connects = (presence.connects || []).filter((row) => row.handle !== mine?.id);
    const seenConnect = readJson(storage, 'lgme.health.connectSeen') || [];
    const fresh = connects.filter((row) => !seenConnect.includes(`${row.handle}:${row.connect}`));
    const mute = document.getElementById('presence-mute')?.checked === true || saved?.mute === true;
    const quiet = { start: document.getElementById('quiet-start')?.value || '', end: document.getElementById('quiet-end')?.value || '' };
    const banner = document.getElementById('presence-note');
    if (fresh.length && !mute && !inQuietHours(quiet) && banner) {
      const person = fresh[0];
      banner.replaceChildren(
        document.createTextNode(`${person.handle} is ${person.connect === 'ok' ? 'OK to connect' : 'online now'}. `),
        el('button', { type: 'button', id: 'open-presence-chat', onClick: () => document.getElementById('chat-text')?.focus() }, ['Open chat'])
      );
      if (globalThis.Notification?.permission === 'granted') {
        const popup = new Notification(`${person.handle} is ${person.connect === 'ok' ? 'free' : 'online'}`, { tag: `lgme-${person.handle}` });
        popup.onclick = () => document.getElementById('chat-text')?.focus();
      }
    }
    storage.setItem('lgme.health.connectSeen', JSON.stringify(connects.map((row) => `${row.handle}:${row.connect}`)));
    const others = (presence.members || []).filter((row) => row.handle !== mine?.id);
    members.replaceChildren(
      el('p', { class: 'muted' }, ['Group only. No tally.']),
      ...connects.map((row) => el('p', { id: `connect-${row.handle}` }, [`${row.handle} is ${row.connect === 'ok' ? 'OK to connect' : 'online now'}${row.until ? ` until ${row.until}` : ''}.`])),
      ...(others.length ? others.map((row) => el('p', { id: `live-${row.handle}` }, [`${row.handle}: ${row.status}. ${row.dot}. ${row.note || ''}`])) : [el('p', {}, ['No shared status yet.'])])
    );
  }
  const planId = saved?.layout?.layout?.id || 'easy';
  const background = resolveImage('background', saved?.images, mine?.id, mine?.id);
  paintPage(root, background.custom ? background.src : (HEALTH_PLANS[planId] || HEALTH_PLANS.easy).image);
  const imageHost = root.querySelector('#image-slots');
  if (imageHost) {
    mountImageSlots(imageHost, {
      memberId: mine?.id || 'this-phone',
      images: saved?.images || {},
      status,
      save: async (images) => keep({ images })
    });
  }
  const blob = background.custom ? null : await loadTilePhoto(saved?.background || `${PHOTO_KEY}:${mine?.id || 'this-phone'}`).catch(() => null);
  if (blob) paintPage(root, URL.createObjectURL(blob));
  await refresh();
  if (globalThis.__lgmePresence) clearInterval(globalThis.__lgmePresence);
  globalThis.__lgmePresence = setInterval(() => { refresh().catch(() => {}); }, 8000);
  return root;
}
