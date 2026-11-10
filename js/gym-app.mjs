import * as sim from './p2p-exchange-sim.mjs';
import { EVIDENCE_UNVERIFIED, evidenceHash, locationMatched } from './exercise-record.mjs';
import { allowMotion, captureFrame, readGps } from './exercise-sensors.mjs';
import { MAXIMS, rotationFor } from './wisdom.mjs';
import { commonsSplit } from './commons-split.mjs';
import { mountEmailCheck } from './email-check.mjs';
import { PASSKEY_COPY, PASSKEY_FALLBACK, passkeySupported, unlockWithPasskey } from './passkey-unlock.mjs';
import { barsSvg, memberStats, publicCard } from './gym-charts.mjs';
import { DEMO_CLUB, DEMO_NAME, MODE_KEY, chatKey, demoStore, realStore, seedDemoChat, seedDemoClub } from './gym-demo.mjs';
import { LOCAL_CHAT_NOTE, chatStatus, publicChatMessage } from './gym-sync.mjs';

const mode = localStorage.getItem(MODE_KEY) === 'real' ? 'real' : 'demo';
const store = mode === 'demo' ? demoStore() : realStore();
const seatKey = 'lgme-gym.seat';
const workout = { startedAt: '', points: [], photos: [], samples: 0, stop: null };

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

function route() {
  return decodeURIComponent(location.hash.replace(/^#/, '') || '/');
}

function go(path) {
  location.hash = path;
}

async function books() {
  const rows = [];
  for (const id of await store.listIds()) {
    const row = await store.get(id);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function seatId() {
  return sessionStorage.getItem(seatKey) || '';
}

async function seat() {
  const rows = await books();
  const saved = seatId();
  return rows.find((peer) => peer.id === saved) || rows[0] || null;
}

function setSeat(id) {
  sessionStorage.setItem(seatKey, id);
}

function signing(pass, code) {
  return { passphrase: pass, code, unixSeconds: Math.floor(Date.now() / 1000) };
}

function banner() {
  if (mode === 'demo') {
    return el('div', { class: 'banner' }, [
      el('p', {}, [`Example. ${DEMO_NAME}. These four members are not your records.`]),
      el('button', { type: 'button', class: 'primary', onClick: () => { localStorage.setItem(MODE_KEY, 'real'); location.reload(); } }, ['Leave demo and start my own'])
    ]);
  }
  return el('div', { class: 'banner' }, [
    el('p', {}, ['Your own book. It is separate from the example club.']),
    el('button', { type: 'button', onClick: () => { localStorage.setItem(MODE_KEY, 'demo'); location.reload(); } }, ['See the example again'])
  ]);
}

function todayLine() {
  const line = rotationFor(new Date().toISOString().slice(0, 10), []);
  return el('section', { class: 'card' }, [
    el('p', { class: 'kicker' }, ["Today's line"]),
    el('h2', {}, [line.title]),
    el('p', {}, [line.text])
  ]);
}

async function renderClub() {
  const mine = await seat();
  const panel = el('div', {}, [banner(), todayLine()]);
  panel.append(el('p', {}, ['A workout mints no credit. Support comes from another member, a barter, or the front desk. A $lgme gift keeps 5% for the Floor and 5% for the App development fund.']));
  if (!mine && mode === 'real') {
    const name = el('input', { maxlength: '40', placeholder: 'Your name' });
    const journey = el('input', { maxlength: '140', placeholder: 'My better tomorrow' });
    panel.append(el('form', { onSubmit: async (event) => {
      event.preventDefault();
      const id = name.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
      const created = await sim.createPeer(store, { id, name: name.value.trim(), balance: 0, floor: 0, creditLimit: 0, at: new Date().toISOString() });
      if (!created.ok) { status(created.error); return; }
      const peer = await store.get(id);
      peer.example = false;
      peer.gymRole = 'member';
      peer.gymProfile = { journey: journey.value.trim() || 'My better tomorrow.', healthNote: '', public: { journey: true, sessions: true, minutes: false, supports: false, credits: false } };
      await store.set(id, peer);
      setSeat(id);
      go('/people/' + id);
    } }, [
      el('label', {}, ['Name', name]),
      el('label', {}, ['My better tomorrow', journey]),
      el('button', { type: 'submit', class: 'primary' }, ['Create my page'])
    ]));
  } else if (mine) {
    panel.append(el('button', { type: 'button', class: 'primary', onClick: () => go('/train') }, ['Start a session']));
    panel.append(el('button', { type: 'button', onClick: () => go('/people/' + mine.id) }, ['My page']));
  }
  return panel;
}

function status(text) {
  const node = document.getElementById('gym-status');
  if (node) node.textContent = text || '';
}

async function renderTrain() {
  const mine = await seat();
  const line = rotationFor(new Date().toISOString().slice(0, 10), []);
  if (!mine) return el('p', {}, ['Create your page first.']);
  const category = el('select', {}, ['strength', 'cardio', 'mobility', 'mixed'].map((name) => el('option', { value: name }, [name])));
  const useGps = el('input', { type: 'checkbox' });
  const useCamera = el('input', { type: 'checkbox' });
  const useMotion = el('input', { type: 'checkbox' });
  const useIntent = el('input', { type: 'checkbox' });
  const pass = el('input', { type: 'password', autocomplete: 'current-password' });
  const code = el('input', { inputmode: 'numeric', maxlength: '8' });
  const note = el('p', { class: 'muted' }, ['No sensors yet. Each one is optional.']);
  return el('div', {}, [
    todayLine(),
    el('p', {}, ['Tap Start, then Finish. Raw GPS, photos, and motion stay on this phone.']),
    el('label', {}, ['Category', category]),
    el('label', { class: 'check' }, [useGps, 'Use GPS']),
    el('label', { class: 'check' }, [useCamera, 'Use camera']),
    el('label', { class: 'check' }, [useMotion, 'Use motion']),
    el('label', { class: 'check' }, [useIntent, `Use “${line.title}” as my intent`]),
    note,
    el('label', {}, ['Passphrase, if this book has one', pass]),
    el('label', {}, ['6-digit code, if this book has one', code]),
    el('button', { type: 'button', class: 'primary', onClick: () => begin(mine, { useGps, useCamera, useMotion, note, line }) }, ['Start']),
    el('button', { type: 'button', onClick: () => finish(mine, { category, useGps, useCamera, useIntent, pass, code, line }) }, ['Finish']),
    el('p', { id: 'gym-status', role: 'status' }, [])
  ]);
}

async function begin(peer, ui) {
  if (workout.startedAt) { status('A session is already running.'); return; }
  workout.startedAt = new Date().toISOString();
  workout.points = [];
  workout.photos = [];
  workout.samples = 0;
  if (ui.useGps.checked) {
    const point = await readGps(navigator.geolocation);
    if (point) workout.points.push(point);
  }
  if (ui.useCamera.checked) {
    const photo = await captureFrame();
    if (photo) workout.photos.push(photo);
  }
  if (ui.useMotion.checked && await allowMotion()) {
    const onMotion = () => { workout.samples += 1; };
    window.addEventListener('devicemotion', onMotion);
    workout.stop = () => window.removeEventListener('devicemotion', onMotion);
  }
  ui.note.textContent = `Started. ${ui.line.title}.`;
  status('Session started. Tap Finish when you are done.');
}

async function finish(peer, ui) {
  if (!workout.startedAt) { status('Tap Start first.'); return; }
  const finishedAt = new Date().toISOString();
  if (ui.useGps.checked) {
    const point = await readGps(navigator.geolocation);
    if (point) workout.points.push(point);
  }
  workout.stop?.();
  const sensors = [];
  if (workout.points.length) sensors.push('gps');
  if (workout.photos.length) sensors.push('camera');
  if (workout.samples > 0) sensors.push('motion');
  const bundle = { startedAt: workout.startedAt, finishedAt, points: workout.points, photos: workout.photos, samples: workout.samples };
  const result = await sim.recordExerciseSession(store, peer.id, {
    day: finishedAt.slice(0, 10),
    category: ui.category.value,
    evidence: EVIDENCE_UNVERIFIED,
    terms: 'Contribution or barter',
    durationSec: Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(workout.startedAt)) / 1000)),
    sensors,
    locationMatched: locationMatched(workout.points, null),
    intent: ui.useIntent.checked ? ui.line.title : '',
    allowedIntents: MAXIMS.map((maxim) => maxim.title),
    evidenceHash: await evidenceHash(bundle),
    bundle,
    groupCode: mode === 'demo' ? DEMO_CLUB : '',
    ...signing(ui.pass.value, ui.code.value)
  });
  workout.startedAt = '';
  status(result.ok ? `IdidIt (verified receipt). ${EVIDENCE_UNVERIFIED}. No credit was minted.` : result.error);
}

function chartBlock(title, values, label) {
  const host = el('div', { class: 'chart' });
  host.innerHTML = barsSvg(values, label);
  return el('section', { class: 'card' }, [el('h3', {}, [title]), host]);
}

async function renderMember(id, shareOnly) {
  const peer = await store.get(id);
  if (!peer) return el('p', {}, ['That member is not on this phone.']);
  const stats = memberStats(peer);
  const card = publicCard(peer);
  const view = el('div', {}, []);
  if (peer.example) view.append(el('p', { class: 'kicker' }, ['Example']));
  view.append(el('div', { class: 'avatar', 'aria-hidden': 'true' }, [(peer.name || '?').slice(0, 1)]));
  view.append(el('h2', {}, [card.handle]));
  view.append(el('p', { class: 'muted' }, [card.role]));
  if (!shareOnly || card.journey) view.append(el('p', {}, [shareOnly ? card.journey : (peer.gymProfile?.journey || '')]));
  if (!shareOnly || card.sessions != null) view.append(chartBlock('Sessions per week', stats.weeks, 'Sessions per week'));
  if (!shareOnly || card.minutes != null) view.append(chartBlock('Minutes', [stats.minutes], 'Minutes'));
  if (!shareOnly || card.sessions != null) view.append(chartBlock('Verified and unverified', [stats.verified, stats.unverified], 'Verified and unverified sessions'));
  const maximValues = Object.values(stats.maxims);
  if (maximValues.length && (!shareOnly || card.sessions != null)) view.append(chartBlock('Maxims chosen', maximValues, 'Maxims chosen'));
  if (!shareOnly) {
    view.append(el('p', {}, [`Supports given ${stats.given}. Supports received ${stats.received}. Deed credits ${stats.deedCredits}. $lgme balance ${sim.replay(peer).balance}.`]));
    view.append(el('h3', {}, ['Receipts']));
    for (const session of Object.values(peer.exerciseSessions || {})) {
      view.append(el('article', { class: 'card' }, [
        el('p', {}, [`${session.day} · ${session.category} · ${session.evidence} · ${session.durationSec || 0}s`]),
        session.intent ? el('p', { class: 'muted' }, [`Intent: ${session.intent}`]) : null
      ]));
    }
    const mine = await seat();
    if (mine?.id === peer.id) {
      const journey = el('input', { value: peer.gymProfile?.journey || '' });
      const sessionsBox = el('input', { type: 'checkbox' });
      sessionsBox.checked = peer.gymProfile?.public?.sessions !== false;
      const minutesBox = el('input', { type: 'checkbox' });
      minutesBox.checked = Boolean(peer.gymProfile?.public?.minutes);
      view.append(el('h3', {}, ['What others can see']));
      view.append(el('p', { class: 'muted' }, ['Health details stay private.']));
      view.append(el('label', {}, ['My better tomorrow', journey]));
      view.append(el('label', { class: 'check' }, [sessionsBox, 'Show session counts']));
      view.append(el('label', { class: 'check' }, [minutesBox, 'Show minutes']));
      view.append(el('button', { type: 'button', class: 'primary', onClick: async () => {
        const fresh = await store.get(peer.id);
        fresh.gymProfile = fresh.gymProfile || { public: {} };
        fresh.gymProfile.journey = journey.value.slice(0, 140);
        fresh.gymProfile.public = { ...(fresh.gymProfile.public || {}), journey: true, sessions: sessionsBox.checked, minutes: minutesBox.checked, health: false };
        fresh.gymProfile.healthNote = '';
        await store.set(peer.id, fresh);
        go('/people/' + peer.id);
      } }, ['Save']));
      view.append(el('p', {}, [el('a', { href: `#/card/${peer.id}` }, ['Shareable card'])]));
    }
  }
  return view;
}

async function renderPeople() {
  const rows = await books();
  const list = el('div', {}, [el('h2', {}, ['Members']), el('p', { class: 'muted' }, ['Each person has a page. There is no ranking.'])]);
  for (const peer of rows) {
    list.append(el('button', { type: 'button', onClick: () => { setSeat(peer.id); go('/people/' + peer.id); } }, [`${peer.name} · ${peer.gymRole || 'member'}${peer.example ? ' · example' : ''}`]));
  }
  return list;
}

async function renderGroups() {
  const mine = await seat();
  const sync = await chatStatus();
  const code = el('input', { value: mode === 'demo' ? DEMO_CLUB : '', maxlength: '24', placeholder: 'Invite code' });
  const text = el('input', { maxlength: '280', placeholder: 'Message' });
  const log = el('div', {});
  const pass = el('input', { type: 'password' });
  const totp = el('input', { inputmode: 'numeric', maxlength: '8' });
  function readChat() {
    try { return JSON.parse(localStorage.getItem(chatKey(mode, code.value)) || '[]'); } catch { return []; }
  }
  function drawChat() {
    log.replaceChildren(...readChat().map((message) => el('p', {}, [`${message.example ? 'Example. ' : ''}${message.handle}: ${message.text}`])));
  }
  drawChat();
  const sessions = el('div', {});
  if (mine) {
    for (const peer of await books()) {
      for (const session of Object.values(peer.exerciseSessions || {})) {
        if (session.authorId === mine.id) continue;
        if (!String(session.evidence || '').includes('unverified')) continue;
        sessions.append(el('article', { class: 'card' }, [
          el('p', {}, [`${peer.name} · ${session.day} · ${session.category}`]),
          el('button', { type: 'button', onClick: async () => {
            const result = await sim.witnessExercise(store, mine.id, session.sessionId, { authorId: session.authorId, ...signing(pass.value, totp.value) });
            status(result.ok ? 'Verified. You cannot verify yourself.' : result.error);
            if (result.ok) render();
          } }, ['Verify']),
          el('p', { class: 'muted' }, [`1 $lgme pays ${commonsSplit(1).floor} to the Floor and ${commonsSplit(1).app} to the App development fund. ${commonsSplit(1).author} goes to ${peer.name}.`]),
          el('button', { type: 'button', onClick: async () => {
            const offer = await sim.offerExerciseSupport(store, mine.id, session.sessionId, { authorId: session.authorId, kind: 'contribute-lgme', amount: 1, ...signing(pass.value, totp.value) });
            if (!offer.ok) { status(offer.error); return; }
            const accepted = await sim.acceptExerciseSupport(store, session.authorId, offer.supportId, signing(pass.value, totp.value));
            status(accepted.ok ? 'Support recorded. The session minted no credit.' : accepted.error);
          } }, ['Confirm 1 $lgme']),
          el('button', { type: 'button', onClick: async () => {
            const offer = await sim.offerExerciseSupport(store, mine.id, session.sessionId, { authorId: session.authorId, kind: 'barter', amount: 0, barter: 'Spotting', ...signing(pass.value, totp.value) });
            if (!offer.ok) { status(offer.error); return; }
            await sim.acceptExerciseSupport(store, session.authorId, offer.supportId, signing(pass.value, totp.value));
            status('Barter offered. No $lgme moved.');
          } }, ['Barter a spot'])
        ]));
      }
    }
  }
  return el('div', {}, [
    el('h2', {}, ['Group']),
    el('p', {}, [sync.message || LOCAL_CHAT_NOTE]),
    el('label', {}, ['Invite code', code]),
    el('button', { type: 'button', onClick: async () => {
      if (!mine) return;
      const result = await sim.joinClubGroup(store, mine.id, { invite: code.value, ...signing(pass.value, totp.value) });
      status(result.ok ? `Joined ${result.name}.` : result.error);
    } }, ['Join']),
    log,
    el('label', {}, ['Chat', text]),
    el('button', { type: 'button', class: 'primary', onClick: () => {
      const built = publicChatMessage({ text: text.value, handle: mine?.name || 'Member', code: code.value, example: mode === 'demo', at: new Date().toISOString() });
      if (!built.ok) { status(built.error); return; }
      const prior = readChat();
      localStorage.setItem(chatKey(mode, code.value), JSON.stringify([...prior, built.message]));
      text.value = '';
      drawChat();
      status(LOCAL_CHAT_NOTE);
    } }, ['Send']),
    el('h3', {}, ['Verify a session']),
    el('p', { class: 'muted' }, ['One other person verifies. No is not needed here: leave the session unverified.']),
    sessions,
    el('label', {}, ['Passphrase', pass]),
    el('label', {}, ['6-digit code', totp]),
    el('p', { id: 'gym-status', role: 'status' }, [])
  ]);
}

async function renderMore() {
  const email = el('div', { id: 'gym-email' });
  const passkey = el('p', {}, [passkeySupported() ? PASSKEY_COPY : PASSKEY_FALLBACK]);
  queueMicrotask(() => mountEmailCheck(email));
  return el('div', {}, [
    el('h2', {}, ['More']),
    todayLine(),
    el('p', {}, [el('a', { href: '/wisdom' }, ['Open Wisdom'])]),
    el('h3', {}, ['Front desk']),
    el('p', {}, ['Redeem a club credit at the front desk after another member has supported a deed. A workout itself still mints nothing. One tap of No on the exchange refuses a gift. A gift that would spend your floor is refused.']),
    el('p', {}, ['Barter can be spotting, coaching, meal prep, or a ride. Deed posts use IwantIT, IhavIT, IselIT, and soBeIT in Health and fitness.']),
    el('h3', {}, ['Email check']),
    email,
    el('h3', {}, ['Passkey']),
    passkey,
    el('button', { type: 'button', onClick: async () => {
      const result = await unlockWithPasskey();
      status(result.ok ? 'Passkey checked. The passphrase still locks the book.' : result.error);
    } }, ['Use passkey']),
    el('p', { id: 'gym-status', role: 'status' }, [])
  ]);
}

async function render() {
  const path = route();
  const panel = document.getElementById('gym-panel');
  if (!panel) return;
  let view;
  if (path.startsWith('/card/')) view = await renderMember(path.slice(6), true);
  else if (path.startsWith('/people/')) view = await renderMember(path.slice(8), false);
  else if (path === '/people') view = await renderPeople();
  else if (path === '/train') view = await renderTrain();
  else if (path === '/groups') view = await renderGroups();
  else if (path === '/more') view = await renderMore();
  else view = await renderClub();
  panel.replaceChildren(view);
  document.querySelectorAll('nav button').forEach((button) => {
    button.setAttribute('aria-current', button.dataset.route === path || (path === '/' && button.dataset.route === '/') ? 'page' : 'false');
  });
}

async function boot() {
  if (mode === 'demo') {
    await seedDemoClub(store);
    seedDemoChat(localStorage);
    if (!seatId()) setSeat('jordan');
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-gym.js', { scope: '/gym' }).catch(() => {});
  window.addEventListener('hashchange', () => { render(); });
  document.querySelectorAll('nav button').forEach((button) => {
    button.addEventListener('click', () => go(button.dataset.route));
  });
  await render();
}

boot();
