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
import { BOARD_NOTE, PROGRESS_KINDS, boardCards, chooseProgress, manualEntry, progressRows, sharePreview } from './gym-progress.mjs';
import { communityFeed } from './gym-feed.mjs';
import { OPT_IN_COPY, answerLocal, deleteDownloadedModel, detectEngine, isOn, setOn, unloadLocalModel } from './local-ai.mjs';
import { STARTERS, agentNotice, deleteAgent, dueAgents, editAgent, listAgents, markFired, needsPermission, pauseAgent, saveAgent, scheduleNote } from './local-agents.mjs';
import { CLARIFICATIONS, COVENANT_TITLE, FIELD_LABELS, covenantHash, covenantSections, covenantText, exitReceipt, openCommitments, publicCovenant, signSponsor, sponsorStatus, velocityNote } from './covenant.mjs';
import { LEGACY_TOPIC, TESTNET_TOPIC, creditReport, mirrorMatch, sponsorshipReady } from './sponsor-report.mjs';
import { suggestThird } from './high-value.mjs';
import { AGE_LABEL, COLLECT_LABEL, SHARE_LABEL, healthConsent, mayCollect, mayShare, revokeShare } from './health-safeguards.mjs';
import { addReview, approveLimitRaise, breakSplit, intakeParts, intakeStatusText, publicIntake, requestLimitRaise, reviewHash } from './intake.mjs';
import { changeSteward, groupSteward, isGroupAdmin, isTrainer, majoritySteward, queueFor, routeSteward, setTrainer, sponsorIds, stewardEligible, trainingOffer } from './steward.mjs';
import { deleteHelper, helperFile, loadHelper, saveHelper } from './helper-store.mjs';
import { ensureDeviceKey, intakeSharePayload, randomInvite, signDevice } from './device-sign.mjs';
import { renderProtocol } from './intake-view.mjs';

let mode = localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real';
let store = mode === 'demo' ? demoStore() : realStore();
let registered = null;
const seatKey = 'lgme-gym.seat';
let stickyStatus = '';
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
  return localStorage.getItem(seatKey) || sessionStorage.getItem(seatKey) || '';
}

async function seat() {
  const rows = await books();
  const saved = seatId();
  return rows.find((peer) => peer.id === saved) || null;
}

function setSeat(id) {
  if (!id) {
    localStorage.removeItem(seatKey);
    sessionStorage.removeItem(seatKey);
    return;
  }
  localStorage.setItem(seatKey, id);
  sessionStorage.setItem(seatKey, id);
}

function actingAs(rows) {
  const current = rows.find((peer) => peer.id === seatId());
  const select = el('select', { id: 'acting-as' }, [
    el('option', { value: '' }, ['Choose who is acting']),
    ...rows.map((peer) => el('option', { value: peer.id }, [peer.name || peer.id]))
  ]);
  select.value = current ? current.id : '';
  select.addEventListener('change', () => {
    setSeat(select.value);
    render();
  });
  return el('p', { id: 'acting-as-line' }, [`Acting as ${current ? current.name || current.id : 'nobody yet'}. `, select]);
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
    panel.append(el('p', {}, [el('a', { href: '#/register' }, ['Join Health'])]));
  } else if (mine) {
    panel.append(await renderBoard());
    panel.append(el('button', { type: 'button', class: 'primary', onClick: () => go('/train') }, ['Start a session']));
    panel.append(el('button', { type: 'button', onClick: () => go('/people/' + mine.id) }, ['My page']));
  }
  return panel;
}

function status(text, sticky = false) {
  if (sticky) stickyStatus = text || '';
  else if (text) stickyStatus = '';
  const node = document.getElementById('gym-status');
  if (node) node.textContent = text || '';
}

function applySticky() {
  if (!stickyStatus) return;
  let node = document.getElementById('gym-status');
  if (!node) {
    node = document.createElement('p');
    node.id = 'gym-status';
    node.setAttribute('role', 'status');
    document.getElementById('gym-panel')?.append(node);
  }
  node.textContent = `${stickyStatus} `;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'dismiss-status';
  button.textContent = 'Dismiss';
  button.addEventListener('click', () => { stickyStatus = ''; node.textContent = ''; });
  node.append(button);
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
  const panel = await renderProgress(mine, true);
  return el('div', {}, [
    panel,
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
  if (!mayCollect(peer)) { status('Confirm that workout and health info stays on this device.'); return; }
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
  if (!mayCollect(peer)) { status('Confirm that workout and health info stays on this device.'); return; }
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

function cheerKey(card) {
  return `${card.handle}:${card.week}:${card.category}`;
}

function cheered(card) {
  try { return JSON.parse(localStorage.getItem('lgme-gym.cheers') || '[]').includes(cheerKey(card)); } catch { return false; }
}

function markCheer(card) {
  const prior = cheered(card) ? [] : JSON.parse(localStorage.getItem('lgme-gym.cheers') || '[]');
  if (!cheered(card)) localStorage.setItem('lgme-gym.cheers', JSON.stringify([...prior, cheerKey(card)]));
}

async function signedGym(url, payload, method = 'POST') {
  const key = await ensureDeviceKey(localStorage);
  const body = { handle: payload.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) };
  return fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function syncCard(preview, remove) {
  const sync = await chatStatus();
  if (!sync.shared || !preview?.handle) return;
  await signedGym('/api/gym/progress', { handle: preview.handle, action: 'progress', card: preview }, remove ? 'DELETE' : 'POST');
}

async function renderBoard() {
  const sync = await chatStatus();
  const rows = await books();
  let remote = [];
  if (sync.shared) {
    try {
      const response = await fetch('/api/gym/progress');
      const body = await response.json();
      remote = Array.isArray(body.cards) ? body.cards : [];
    } catch { remote = []; }
  }
  const local = boardCards(rows).filter((card) => card.example || sync.shared);
  const seen = new Set();
  const cards = [];
  for (const card of [...local, ...remote]) {
    const key = `${card.handle}:${card.week}:${card.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(card);
  }
  const host = el('section', {}, [
    el('h2', {}, ['Shared board']),
    el('p', {}, [sync.shared ? 'These cards left this phone. They are not written to Hedera.' : BOARD_NOTE]),
    el('p', { class: 'muted' }, ['Example cards are labeled example. There is no ranking.'])
  ]);
  if (!cards.length) host.append(el('p', { class: 'muted' }, ['No shared cards yet.']));
  for (const card of cards) {
    const owner = rows.find((peer) => peer.name === card.handle);
    const article = el('article', { class: 'card' }, [
      card.example ? el('p', { class: 'kicker' }, ['Example']) : null,
      el('p', {}, [card.line]),
      card.selfReported ? el('p', { class: 'muted' }, ['Self-reported.']) : null
    ]);
    article.append(el('button', { type: 'button', onClick: () => { markCheer(card); render(); } }, [cheered(card) ? 'Cheered' : 'Cheer']));
    if (owner) {
      article.append(el('button', { type: 'button', onClick: async () => {
        const session = Object.values(owner.exerciseSessions || {})[0];
        if (!session) { status('Support needs a session on their book.'); return; }
        const split = commonsSplit(1);
        const mine = await seat();
        const offer = await sim.offerExerciseSupport(store, mine.id, session.sessionId, { authorId: owner.id, kind: 'contribute-lgme', amount: 1 });
        if (!offer.ok) { status(offer.error); return; }
        const accepted = await sim.acceptExerciseSupport(store, owner.id, offer.supportId, {});
        status(accepted.ok ? `Supported. ${split.floor} to the Floor and ${split.app} to the App development fund.` : accepted.error);
      } }, ['Support']));
    }
    host.append(article);
  }
  return host;
}

async function saveProgress(peer, patch) {
  const fresh = await store.get(peer.id);
  fresh.gymProgress = { ...(fresh.gymProgress || {}), ...patch };
  await store.set(peer.id, fresh);
}

async function renderProgress(peer, editable) {
  const rows = progressRows(peer);
  const box = el('section', { class: 'card progress-card' }, [
    el('p', { class: 'kicker' }, ['My progress']),
    el('p', { class: 'muted' }, ['Numbers stay on this phone until you share one. Health meter is self-reported, not medical.'])
  ]);
  if (!rows.length && editable) {
    box.append(categoryPicker(peer));
    return box;
  }
  for (const row of rows) {
    const card = el('article', { class: 'card' }, [
      el('h3', {}, [row.label]),
      el('p', { class: 'progress-num' }, [String(row.current)]),
      el('p', {}, [`${row.unit} this week`]),
      el('p', { class: 'muted' }, [`${row.change >= 0 ? '+' : ''}${row.change} vs last week`]),
      row.selfReported ? el('p', { class: 'muted' }, [row.health ? 'Self-reported. Not medical.' : 'Self-reported.']) : null,
      row.money ? el('p', { class: 'muted' }, [`$lgme in ${row.money.lgmeIn}. $lgme out ${row.money.lgmeOut}. US$ noted ${row.money.usd}.`]) : null
    ]);
    const chart = el('div', { class: 'chart' });
    chart.innerHTML = barsSvg(row.series, row.label);
    card.append(chart);
    if (editable) card.append(shareControls(peer, row));
    box.append(card);
  }
  if (editable) {
    box.append(categoryPicker(peer));
    box.append(manualForm(peer, rows));
  }
  return box;
}

function categoryPicker(peer) {
  const selected = new Set(peer.gymProgress?.chosen || []);
  const boxes = PROGRESS_KINDS.map((kind) => {
    const input = el('input', { type: 'checkbox', value: kind.id });
    input.checked = selected.has(kind.id);
    return el('label', { class: 'check' }, [input, kind.label]);
  });
  const customName = el('input', { maxlength: '24', placeholder: 'Custom name', value: peer.gymProgress?.custom?.name || '' });
  const customUnit = el('input', { maxlength: '12', placeholder: 'Unit', value: peer.gymProgress?.custom?.unit || '' });
  const gps = el('input', { type: 'checkbox' });
  gps.checked = Boolean(peer.gymProgress?.allowGps);
  return el('div', {}, [
    el('h3', {}, ['Choose 3 to 5']),
    ...boxes,
    el('label', {}, ['Custom category', customName]),
    el('label', {}, ['Custom unit', customUnit]),
    el('label', { class: 'check' }, [gps, 'Count GPS distance. Coordinates stay on this phone.']),
    el('button', { type: 'button', class: 'primary', onClick: async () => {
      const kinds = boxes.map((label) => label.querySelector('input')).filter((input) => input.checked).map((input) => input.value);
      const chosen = chooseProgress({ kinds, customName: customName.value, customUnit: customUnit.value, allowGps: gps.checked });
      if (!chosen.ok) { status(chosen.error); return; }
      const prior = peer.gymProgress || {};
      chosen.progress.manual = prior.manual || [];
      chosen.progress.share = { ...chosen.progress.share, ...(prior.share || {}) };
      await saveProgress(peer, chosen.progress);
      render();
    } }, ['Save categories'])
  ]);
}

function manualForm(peer, rows) {
  const value = el('input', { type: 'number', min: '0', step: '0.1', placeholder: 'Calories or custom number' });
  const energy = el('input', { type: 'number', min: '1', max: '10', placeholder: 'Energy 1-10' });
  const mood = el('input', { type: 'number', min: '1', max: '10', placeholder: 'Mood 1-10' });
  const sleep = el('input', { type: 'number', min: '1', max: '10', placeholder: 'Sleep 1-10' });
  const showHealth = rows.some((row) => row.health);
  return el('div', {}, [
    el('h3', {}, ['Add a self-reported number']),
    el('label', {}, ['Calories or custom', value]),
    showHealth ? el('label', {}, ['Energy', energy]) : null,
    showHealth ? el('label', {}, ['Mood', mood]) : null,
    showHealth ? el('label', {}, ['Sleep', sleep]) : null,
    el('button', { type: 'button', onClick: async () => {
      if (!mayCollect(peer)) { status('Confirm that workout and health info stays on this device.'); return; }
      const entries = [];
      if (rows.some((row) => row.id === 'calories') && value.value !== '') {
        const built = manualEntry({ kind: 'calories', value: value.value });
        if (!built.ok) { status(built.error); return; }
        entries.push(built.entry);
      }
      if (rows.some((row) => row.id === 'custom') && value.value !== '') {
        const built = manualEntry({ kind: 'custom', value: value.value });
        if (!built.ok) { status(built.error); return; }
        entries.push(built.entry);
      }
      if (showHealth && energy.value) {
        const built = manualEntry({ kind: 'health', energy: energy.value, mood: mood.value, sleep: sleep.value });
        if (!built.ok) { status(built.error); return; }
        entries.push(built.entry);
      }
      if (!entries.length) { status('Enter a self-reported number.'); return; }
      const fresh = await store.get(peer.id);
      fresh.gymProgress.manual = [...(fresh.gymProgress.manual || []), ...entries];
      await store.set(peer.id, fresh);
      render();
    } }, ['Save self-reported'])
  ]);
}

function shareControls(peer, row) {
  if (!mayShare(peer)) {
    return el('p', { class: 'muted', id: 'share-locked' }, ['Sharing stays off until you check “Share selected progress with people I choose” in Settings.']);
  }
  const preview = sharePreview(peer, row);
  const host = el('div', {}, []);
  const level = el('select', {}, [
    el('option', { value: 'me' }, ['Only me']),
    el('option', { value: 'groups' }, ['My groups']),
    el('option', { value: 'board' }, ['Shared community board'])
  ]);
  level.value = row.share;
  const note = el('p', { class: 'muted' }, []);
  function showPreview() {
    note.textContent = level.value === 'me'
      ? 'Only you can see this.'
      : `Preview: ${preview.example ? 'Example. ' : ''}${preview.line}. Week ${preview.week}. ${preview.selfReported ? 'Self-reported. ' : ''}Nothing else is included.`;
  }
  showPreview();
  host.append(el('label', {}, ['Share', level]), note);
  host.append(el('button', { type: 'button', onClick: async () => {
    if (level.value !== 'me') showPreview();
    const fresh = await store.get(peer.id);
    fresh.gymProgress.share = { ...(fresh.gymProgress.share || {}), [row.id]: level.value };
    await store.set(peer.id, fresh);
    if (level.value === 'board') await syncCard(sharePreview(fresh, { ...row, share: 'board' }), false);
    if (level.value === 'me' && row.share === 'board') await syncCard(preview, true);
    status(level.value === 'me' ? 'Sharing stopped.' : 'Shared. You can stop it in one tap.');
    render();
  } }, [level.value === 'me' && row.share !== 'me' ? 'Stop sharing' : 'Save sharing']));
  if (row.share !== 'me') {
    host.append(el('button', { type: 'button', onClick: async () => {
      const fresh = await store.get(peer.id);
      fresh.gymProgress.share = { ...(fresh.gymProgress.share || {}), [row.id]: 'me' };
      await store.set(peer.id, fresh);
      if (row.share === 'board') await syncCard(preview, true);
      render();
    } }, ['Stop sharing']));
  }
  level.addEventListener('change', showPreview);
  return host;
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
  if (!shareOnly) view.append(await renderProgress(peer, (await seat())?.id === peer.id));
  if (peer.example) view.append(el('p', { class: 'kicker' }, ['Example']));
  view.append(el('div', { class: 'avatar', 'aria-hidden': 'true' }, [(peer.name || '?').slice(0, 1)]));
  view.append(el('h2', {}, [card.handle]));
  if (isTrainer(peer)) view.append(el('p', { id: 'trainer-badge', class: 'kicker' }, ['Trainer']));
  try {
    const helped = JSON.parse(localStorage.getItem('lgme.aiHelp.count') || 'null');
    if (helped && helped.handle === peer.id && helped.count > 0) view.append(el('p', { id: 'ai-help-badge' }, [`Contributed AI help: ${helped.count}`]));
  } catch { /* the count stays off this page */ }
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
        el('p', {}, [`${session.day} · ${session.category} · ${session.evidence} · ${Math.round((session.durationSec || 0) / 60)} min`]),
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
      const trainerBox = el('input', { id: 'trainer-toggle', type: 'checkbox' });
      trainerBox.checked = isTrainer(peer);
      view.append(el('label', { class: 'check' }, [trainerBox, "I'd like to be a trainer"]));
      trainerBox.addEventListener('change', async () => {
        const fresh = setTrainer(await store.get(peer.id), trainerBox.checked);
        const before = sim.replay(fresh).balance;
        await store.set(peer.id, fresh);
        status(sim.replay(await store.get(peer.id)).balance === before ? (trainerBox.checked ? 'Trainer badge on. You can switch it off anytime.' : 'Trainer badge off.') : 'The balance changed.', true);
        render();
      });
      if (isTrainer(peer)) {
        const kind = el('select', { id: 'training-kind' }, [el('option', { value: 'IhavIT' }, ['IhavIT']), el('option', { value: 'IselIT' }, ['IselIT'])]);
        const credit = el('input', { id: 'training-credit', type: 'checkbox' });
        view.append(el('p', {}, ['List training. Credit uses the same 5-gate intake check. A session still mints nothing.']));
        view.append(kind);
        view.append(el('label', { class: 'check' }, [credit, 'I want credit for this']));
        view.append(el('button', { id: 'list-training', type: 'button', onClick: async () => {
          const fresh = await store.get(peer.id);
          const before = sim.replay(fresh).balance;
          const listed = trainingOffer(fresh, { kind: kind.value, credit: credit.checked });
          if (!listed.ok) { status(listed.error); return; }
          fresh.trainingOffer = listed.offer;
          await store.set(peer.id, fresh);
          status(`${listed.note} Balance ${sim.replay(await store.get(peer.id)).balance === before ? 'unchanged' : 'changed'}.`);
          render();
        } }, ['List training']));
        if (peer.trainingOffer) view.append(el('p', { id: 'training-offer' }, [`${peer.trainingOffer.kind} · Training · ${peer.trainingOffer.gates === 'pending' ? '5 gates still required' : 'No credit drawn'}`]));
      }
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
    list.append(el('button', { type: 'button', onClick: () => { setSeat(peer.id); go('/people/' + peer.id); } }, [`${peer.name} · ${isTrainer(peer) ? 'Trainer' : (peer.gymRole || 'member')}${peer.example ? ' · example' : ''}`]));
  }
  return list;
}

function voteKey(code) {
  return `lgme.stewardVotes.${code}`;
}

async function writeSteward(code, stewardId, members) {
  for (const peer of members) {
    if (!peer.clubGroups?.[code]) continue;
    peer.clubGroups[code] = { ...peer.clubGroups[code], steward: stewardId, stewardSet: 'assigned' };
    await store.set(peer.id, peer);
  }
}

function stewardCard(mine, members) {
  const card = el('section', { id: 'group-steward', class: 'card' });
  const codes = Object.keys(mine.clubGroups || {});
  if (!codes.length) {
    card.append(el('p', { id: 'steward-name' }, ['Steward: none yet.']));
    return card;
  }
  for (const code of codes) {
    const groupMembers = members.filter((peer) => peer.clubGroups?.[code]);
    const stewardId = groupSteward(groupMembers, code);
    const steward = groupMembers.find((peer) => peer.id === stewardId);
    card.append(el('p', { id: 'steward-name' }, [`Steward: ${steward?.name || stewardId || 'not set'}`]));
    card.append(el('p', { id: 'group-trainers' }, [groupMembers.map((person) => `${person.name}${isTrainer(person) ? ' · Trainer' : ''}`).join(', ')]));
    card.append(el('p', { class: 'muted' }, ['The steward receives no credit or perks for the role.']));
    const eligible = groupMembers.filter((peer) => stewardEligible(peer) && peer.id !== stewardId);
    const select = el('select', { id: 'steward-choice' });
    for (const person of eligible) select.append(el('option', { value: person.id }, [person.name]));
    if (!eligible.length) card.append(el('p', { class: 'muted' }, ['A new steward is a Tier-1 member who has cleared a balance once.']));
    card.append(select);
    if (isGroupAdmin(mine, code)) {
      card.append(el('button', { id: 'change-steward', type: 'button', onClick: async () => {
        const result = changeSteward(groupMembers, code, select.value, mine.id);
        if (!result.ok) { status(result.error); return; }
        await writeSteward(code, result.steward, groupMembers);
        render();
      } }, ['Change steward']));
    } else {
      card.append(el('button', { id: 'vote-steward', type: 'button', onClick: async () => {
        const votes = JSON.parse(localStorage.getItem(voteKey(code)) || '{}');
        votes[mine.id] = select.value;
        localStorage.setItem(voteKey(code), JSON.stringify(votes));
        const winner = majoritySteward(votes, groupMembers.length);
        if (!winner) { status('The vote is recorded. A majority of the group is still needed.'); return; }
        const candidate = groupMembers.find((peer) => peer.id === winner);
        if (!stewardEligible(candidate)) { status('A steward is a Tier-1 member who has cleared a balance once.'); return; }
        await writeSteward(code, winner, groupMembers);
        render();
      } }, ['Vote to change steward']));
    }
    card.append(el('button', { type: 'button', onClick: async () => {
      mine.intake = { ...(mine.intake || {}), mediation: [...(mine.intake?.mediation || []), 'Bilateral resolution did not finish.'] };
      await store.set(mine.id, mine);
      status('The steward has the mediation request. No credit moved.');
      render();
    } }, ['Ask the steward to mediate']));
    if (mine.id === stewardId) card.append(queueCard(mine, members, code));
  }
  return card;
}

function queueCard(steward, members, code) {
  const box = el('div', { id: 'steward-queue' });
  box.append(el('h3', {}, ['Review queue']));
  const rows = queueFor(steward.id, members, code);
  if (!rows.length) box.append(el('p', { class: 'muted' }, ['No reviews are waiting.']));
  for (const row of rows) {
    const peer = members.find((item) => item.id === row.id);
    const line = el('article', { class: 'card' }, [el('p', {}, [row.text])]);
    if (row.kind === 'split' && peer) {
      line.append(el('button', { type: 'button', onClick: () => settleSplit(peer, steward.id, 'PASS', 'PASS') }, ['Tie-break: both pass']));
      line.append(el('button', { type: 'button', onClick: () => settleSplit(peer, steward.id, 'PASS', 'REVISE') }, ['Tie-break: primary only']));
    }
    if (row.kind === 'raise' && peer) {
      line.append(el('button', { type: 'button', onClick: () => signRaise(peer, steward.id) }, ['Approve limit raise']));
    }
    box.append(line);
  }
  return box;
}

async function settleSplit(peer, stewardId, primary, secondary) {
  const before = sim.replay(peer).balance;
  const saved = breakSplit(peer.intake, stewardId, { primary, secondary }, sponsorIds(peer));
  if (!saved.ok) { status(saved.error); return; }
  peer.intake = saved.intake;
  await store.set(peer.id, peer);
  const after = sim.replay(await store.get(peer.id)).balance;
  status(after === before ? `${intakeStatusText(saved.intake.status)}. The steward was not paid.` : 'The balance changed.');
  render();
}

async function signRaise(peer, stewardId) {
  const before = sim.replay(peer).balance;
  const saved = approveLimitRaise(peer.intake, stewardId, sponsorIds(peer));
  if (!saved.ok) { status(saved.error); return; }
  peer.intake = saved.intake;
  await store.set(peer.id, peer);
  const after = sim.replay(await store.get(peer.id)).balance;
  status(after === before ? 'Limit raise signed. The steward was not paid.' : 'The balance changed.');
  render();
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
  const peers = mine ? await books() : [];
  return el('div', {}, [
    el('h2', {}, ['Group']),
    mine ? stewardCard(mine, peers) : el('p', { id: 'steward-name' }, ['Steward: none yet.']),
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
    el('p', { class: 'muted' }, ['A trainer can verify a session. It still takes one other person. You cannot verify yourself.']),
    sessions,
    el('label', {}, ['Passphrase', pass]),
    el('label', {}, ['6-digit code', totp]),
    el('p', { id: 'gym-status', role: 'status' }, [])
  ]);
}

function progressLines(peer) {
  if (!peer) return [];
  return progressRows(peer).map((row) => `${row.label} ${row.current} ${row.unit} this week, change ${row.change}.`);
}

function helperSetup() {
  const box = el('div', { id: 'agent-setup' });
  box.append(el('h3', {}, ['Set up your own helper']));
  box.append(el('p', { class: 'muted' }, [scheduleNote()]));
  box.append(el('p', { class: 'muted' }, ['A helper can remind, notify, summarize, or draft. It never sends, posts, accepts, or spends.']));
  STARTERS.forEach((prompt, index) => {
    const field = el('textarea', { maxlength: '400' });
    field.value = prompt;
    box.append(field);
    box.append(el('button', { type: 'button', onClick: () => keepAgent(field.value) }, [`Save helper ${index + 1}`]));
  });
  const list = el('div', { id: 'agent-list' });
  box.append(list);
  drawAgents(list);
  return box;
}

async function keepAgent(text) {
  const before = listAgents(localStorage).filter(needsPermission).length;
  const saved = saveAgent(localStorage, text);
  if (!saved.ok) { status(saved.error); return; }
  if (needsPermission(saved.agent) && before === 0 && globalThis.Notification && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* permission stays unset */ }
  }
  await arm(saved.agent);
  const note = document.createElement('p');
  note.id = 'agent-schedule';
  note.textContent = scheduleNote();
  document.getElementById('agent-setup')?.append(note);
  const list = document.getElementById('agent-list');
  if (list) drawAgents(list);
}

function drawAgents(list) {
  list.replaceChildren();
  for (const agent of listAgents(localStorage)) {
    const row = el('article', { class: 'card' }, [
      el('p', {}, [`${agent.paused ? 'Paused. ' : ''}${agent.name}`]),
      el('p', { class: 'muted' }, [agent.goal])
    ]);
    row.append(el('button', { type: 'button', onClick: () => { pauseAgent(localStorage, agent.id); drawAgents(list); } }, [agent.paused ? 'Resume' : 'Pause']));
    const editor = el('textarea', { maxlength: '400' });
    editor.value = agent.goal;
    row.append(editor);
    row.append(el('button', { type: 'button', onClick: () => { editAgent(localStorage, agent.id, editor.value); drawAgents(list); } }, ['Edit']));
    row.append(el('button', { type: 'button', onClick: () => { deleteAgent(localStorage, agent.id); drawAgents(list); } }, ['Delete']));
    list.append(row);
  }
}

async function arm(agent) {
  if (agent.trigger?.kind !== 'time' || typeof TimestampTrigger !== 'function' || Notification?.permission !== 'granted') return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration('/gym');
    await registration?.showNotification(agent.name, {
      body: agentNotice(agent),
      tag: agent.id,
      showTrigger: new TimestampTrigger(agent.trigger.at)
    });
  } catch { /* the open page still checks the time */ }
}

async function showAgent(agent) {
  let box = document.getElementById('agent-due');
  if (!box) {
    box = document.createElement('p');
    box.id = 'agent-due';
    const setup = document.getElementById('agent-setup');
    if (setup) setup.prepend(box);
    else document.getElementById('gym-panel')?.prepend(box);
  }
  box.textContent = agentNotice(agent);
  markFired(localStorage, agent.id);
  if (needsPermission(agent) && globalThis.Notification?.permission === 'granted' && navigator.serviceWorker) {
    const registration = await navigator.serviceWorker.getRegistration('/gym');
    registration?.active?.postMessage({ type: 'agent-reminder', id: agent.id, title: agent.name, body: agentNotice(agent) });
  }
}

function startAgentLoop() {
  const tick = async () => {
    for (const agent of dueAgents(listAgents(localStorage))) await showAgent(agent);
  };
  tick();
  setInterval(tick, 5000);
}

function localAiCard(peer) {
  const host = el('section', { class: 'card', id: 'local-ai' });
  function draw() {
    const on = isOn(localStorage);
    const lines = [
      el('h3', {}, [`Local AI assistant: ${on ? 'On' : 'Off'}`])
    ];
    if (!on) {
      lines.push(el('button', { type: 'button', onClick: () => {
        const note = el('p', {}, [OPT_IN_COPY]);
        const turn = el('button', { type: 'button', class: 'primary', onClick: () => { setOn(localStorage, true); draw(); } }, ['Turn on']);
        host.append(note, turn);
      } }, ['Show what turning on means']));
    } else {
      const engine = detectEngine();
      lines.push(el('p', {}, [`Engine: ${engine.label}.`]));
      if (engine.id === 'rules') lines.push(el('p', { class: 'muted' }, ['No model was downloaded.']));
      const question = el('textarea', { maxlength: '400', placeholder: 'Ask, or ask for a draft' });
      const out = el('p', {});
      lines.push(question);
      lines.push(el('button', { type: 'button', class: 'primary', onClick: async () => {
        out.textContent = 'Working on this phone…';
        const result = await answerLocal({ question: question.value, progressLines: progressLines(peer) });
        out.textContent = `${result.text} Engine: ${result.label}. Not sent.`;
      } }, ['Ask']));
      lines.push(el('p', { class: 'muted' }, ['A draft is not sent. Nothing here mints credit or posts.']));
      lines.push(out);
      lines.push(el('button', { type: 'button', onClick: async () => { await unloadLocalModel(); setOn(localStorage, false); draw(); } }, ['Turn off']));
      lines.push(el('button', { type: 'button', onClick: async () => { await deleteDownloadedModel(); out.textContent = 'Downloaded model deleted.'; } }, ['Delete downloaded model']));
      lines.push(helperSetup());
    }
    host.replaceChildren(...lines);
  }
  draw();
  return host;
}

function healthSettings(peer) {
  const needsAge = peer.healthConsent?.adult !== true;
  const adult = el('input', { type: 'checkbox', id: 'settings-age' });
  const collect = el('input', { type: 'checkbox', id: 'settings-collect' });
  const share = el('input', { type: 'checkbox', id: 'settings-share' });
  const shareName = el('input', { type: 'checkbox', id: 'settings-share-name' });
  collect.checked = peer.healthConsent?.collect === true;
  share.checked = peer.healthConsent?.share === true;
  shareName.checked = peer.healthConsent?.shareName === true;
  return el('section', { class: 'card', id: 'health-settings' }, [
    el('h3', {}, ['Health data']),
    needsAge ? el('label', { class: 'check' }, [adult, AGE_LABEL]) : el('p', {}, ['You confirmed you are 18 or older.']),
    el('label', { class: 'check' }, [collect, COLLECT_LABEL]),
    el('label', { class: 'check' }, [share, SHARE_LABEL]),
    el('label', { class: 'check' }, [shareName, 'Send my name and track record to my sponsors']),
    el('p', { class: 'muted' }, ['Progress sharing and your name are separate. Uncheck either one any time.']),
    el('p', {}, [el('a', { href: '/gym/health-data' }, ['Consumer health data notice'])]),
    el('button', { type: 'button', onClick: async () => {
      if (needsAge && adult.checked !== true) { status('Confirm you are 18 or older.'); return; }
      let fresh = await store.get(peer.id);
      fresh.healthConsent = {
        adult: true,
        collect: collect.checked === true,
        share: collect.checked === true && share.checked === true,
        shareName: shareName.checked === true
      };
      if (!fresh.healthConsent.share) fresh = revokeShare(fresh);
      await store.set(peer.id, fresh);
      status(fresh.healthConsent.share ? 'Sharing is on for the categories you pick.' : 'Sharing is off.');
      render();
    } }, ['Save health choices'])
  ]);
}

async function renderMore() {
  const mine = await seat();
  const email = el('div', { id: 'gym-email' });
  const passkey = el('p', {}, [passkeySupported() ? PASSKEY_COPY : PASSKEY_FALLBACK]);
  queueMicrotask(() => mountEmailCheck(email));
  return el('div', {}, [
    el('h2', {}, ['Settings']),
    mine && mine.example !== true ? healthSettings(mine) : null,
    el('p', {}, [el('a', { href: '/gym/health-data' }, ['Consumer health data']), ' · ', el('a', { href: '/gym/breach-plan' }, ['Breach plan']), ' · ', el('a', { href: '/help' }, ['Help'])]),
    localAiCard(null),
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

const signup = { step: 1, name: '', kinds: [], agree: {}, primary: '', secondary: '', legalName: '', signature: '', date: new Date().toISOString().slice(0, 10), applicantName: '', trackRecord: '' };
let intakeRaw = '';
let covenantRaw = '';

async function covenantBody() {
  if (!covenantRaw) {
    const response = await fetch('/data/member-covenant.txt');
    covenantRaw = await response.text();
  }
  return covenantText(covenantRaw);
}

function privateKey() {
  return 'lgme.covenant.private';
}

function savePrivate(id, fields) {
  const all = JSON.parse(localStorage.getItem(privateKey()) || '{}');
  all[id] = { legalName: fields.legalName, signature: fields.signature, applicantName: fields.applicantName, trackRecord: fields.trackRecord };
  localStorage.setItem(privateKey(), JSON.stringify(all));
}

function readPrivate(id) {
  try { return JSON.parse(localStorage.getItem(privateKey()) || '{}')[id] || {}; } catch { return {}; }
}

async function intakeBody() {
  if (!intakeRaw) {
    const response = await fetch('/data/intake-protocol.txt');
    intakeRaw = await response.text();
  }
  return intakeRaw.replace(/\n$/, '');
}

function covenantFields(text) {
  const host = el('div', { id: 'covenant-verbatim', class: 'covenant-text covenant-scroll' });
  const parts = text.split('____');
  const inputs = [];
  parts.forEach((part, index) => {
    host.append(document.createTextNode(part));
    if (index >= parts.length - 1) return;
    const field = el('input', { class: 'short', 'aria-label': FIELD_LABELS[index] || 'Field', autocomplete: 'off' });
    if (index >= 5) field.disabled = true;
    inputs.push(field);
    host.append(field);
  });
  return { host, inputs };
}

function agreeBox(key, label) {
  const input = el('input', { type: 'checkbox' });
  input.checked = signup.agree[key] === true;
  input.addEventListener('change', () => { signup.agree[key] = input.checked; });
  return el('label', { class: 'check' }, [input, label]);
}

async function finishSignup(group) {
  const consent = healthConsent({ adult: signup.adult === true, collect: signup.collect === true, share: signup.share === true });
  if (!consent.ok) {
    signup.adult = false;
    signup.step = 1;
    status(consent.error);
    render();
    return;
  }
  if (group?.name && (group.name.trim().length < 2 || !/^[a-z2-7]{10,32}$/.test(group.invite || ''))) {
    status('Use a group name. The invite code comes from this phone.');
    return;
  }
  const id = signup.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  if (!signup.primary || !signup.secondary) { status('Both offerings are required.'); return; }
  const created = await sim.createPeer(store, { id, name: signup.name, balance: 0, floor: 0, creditLimit: 0, at: new Date().toISOString() });
  if (!created.ok) { status(created.error); return; }
  const chosen = chooseProgress({ kinds: signup.kinds });
  if (!chosen.ok) { status(chosen.error); return; }
  const text = await covenantBody();
  const token = crypto.randomUUID();
  const hash = await covenantHash({ text, handle: id, date: signup.date, sponsors: [] });
  const peer = await store.get(id);
  peer.example = false;
  peer.gymRole = 'member';
  peer.gymProfile = { journey: 'My better tomorrow.', healthNote: '', public: { journey: true, sessions: false, minutes: false, supports: false, credits: false } };
  peer.gymProgress = chosen.progress;
  peer.healthConsent = { ...consent.consent, shareName: signup.shareName === true };
  peer.covenant = publicCovenant({ handle: id, date: signup.date, primary: signup.primary, secondary: signup.secondary, sponsors: [], hash, token, openedAt: new Date().toISOString(), anchor: null, reportAccess: true, authorizeHealth: false });
  peer.intake = publicIntake({ handle: id, primary: signup.primary, secondary: signup.secondary, status: 'Pending sponsors', reviews: [], notes: [] });
  savePrivate(id, signup);
  await store.set(id, peer);
  if (group?.invite && group?.name) {
    await sim.createClubGroup(store, id, { name: group.name, invite: group.invite });
  } else if (group?.invite) {
    await sim.joinClubGroup(store, id, { invite: group.invite });
  }
  await publishCovenant(await store.get(id), text);
  await shareIntake(await store.get(id));
  localStorage.setItem(MODE_KEY, 'real');
  localStorage.setItem('lgme.entry.category', 'health');
  registered = await store.get(id);
  setSeat(id);
  go('/me');
}

async function publishCovenant(peer, text) {
  try {
    await signedGym('/api/gym/covenant', { handle: peer.id, action: 'request', ...publicCovenant(peer.covenant) });
  } catch { /* the link still works on this phone */ }
  try {
    const statusResponse = await fetch('/api/hedera/status');
    const ready = await statusResponse.json();
    if (!ready.enabled) {
      peer.covenant.anchor = { enabled: false, wording: ready.wording || 'Testnet anchoring is not running yet.' };
      await store.set(peer.id, peer);
      return;
    }
    const response = await signedGym('/api/hedera/queue', { handle: peer.id, action: 'queue', hash: peer.covenant.hash, day: peer.covenant.date });
    const body = await response.json();
    peer.covenant.anchor = body.ok && body.sequenceNumber
      ? { enabled: true, hashscan: body.hashscan, topicId: body.topicId, sequence: body.sequenceNumber }
      : { enabled: true, queued: true, wording: body.wording || 'Queued. The daily job writes the hash. Health data is not written.' };
    await store.set(peer.id, peer);
  } catch {
    peer.covenant.anchor = { enabled: false, wording: 'The hash stayed on this phone. The daily job did not take it.' };
  }
  void text;
}

async function renderRegister() {
  const box = el('section', { id: 'join-health' }, [
    el('p', { class: 'kicker' }, [`Step ${signup.step} of 5`]),
    el('h2', {}, ['Join Health']),
    el('p', {}, [el('a', { href: '/gym/covenant' }, ['Member Covenant']), ' · ', el('a', { href: '/gym/health-data' }, ['Consumer health data'])])
  ]);
  if (signup.step === 1 && signup.adult !== true) {
    box.append(ageGateCard());
    box.append(el('p', { id: 'gym-status', role: 'status' }, []));
    box.append(el('p', {}, [el('a', { href: '/?picker=1' }, ['All categories'])]));
    return box;
  }
  if (signup.step === 1) {
    const text = await covenantBody();
    const sections = covenantSections(text);
    if (!sections.ok) { box.append(el('p', {}, [sections.error])); return box; }
    const fields = covenantFields(sections.section2);
    const primary = fields.inputs[0];
    const secondary = fields.inputs[1];
    const legal = fields.inputs[2];
    const signature = fields.inputs[3];
    const date = fields.inputs[4];
    primary.value = signup.primary;
    secondary.value = signup.secondary;
    legal.value = signup.legalName;
    signature.value = signup.signature;
    date.type = 'date';
    date.value = signup.date;
    box.append(el('section', { class: 'card' }, [
      el('h3', {}, ['Preamble']),
      el('div', { class: 'covenant-scroll' }, [sections.preamble]),
      agreeBox('preamble', 'I agree to the Preamble')
    ]));
    box.append(el('section', { class: 'card' }, [
      el('h3', {}, ['Articles 1–12']),
      el('div', { class: 'covenant-scroll' }, [sections.articles]),
      agreeBox('articles', 'I agree to Articles 1–12')
    ]));
    box.append(el('section', { class: 'card' }, [
      el('h3', {}, ['Section 2']),
      el('p', {}, [el('a', { href: '/gym/intake-protocol' }, ['Intake protocol'])]),
      fields.host,
      agreeBox('section2', 'I agree to Section 2')
    ]));
    const notes = el('section', { id: 'covenant-clarifications', class: 'card clarify' }, [
      el('h3', {}, [COVENANT_TITLE]),
      el('ol', {}, CLARIFICATIONS.map((point) => el('li', {}, [point]))),
      agreeBox('health', 'I agree to the Health clarifications')
    ]);
    box.append(notes);
    box.append(el('button', { type: 'button', class: 'primary', onClick: () => {
      signup.primary = primary.value.trim();
      signup.secondary = secondary.value.trim();
      signup.legalName = legal.value.trim();
      signup.signature = signature.value.trim();
      signup.date = date.value;
      if (!signup.agree.preamble || !signup.agree.articles || !signup.agree.section2 || !signup.agree.health) {
        status('Agree to each section.');
        return;
      }
      if (!signup.legalName || !signup.signature || !signup.date) {
        status('Add your legal name, a signature, and the date.');
        return;
      }
      signup.step = 2;
      render();
    } }, ['Next']));
  } else if (signup.step === 2) {
    const text = await intakeBody();
    const parts = intakeParts(text);
    const rendered = renderProtocol(parts.ok ? parts.part1 : '');
    rendered.host.id = 'intake-form';
    const blanks = rendered.blanks;
    const checks = rendered.checks;
    if (signup.primary) blanks[4].value = signup.primary;
    if (signup.secondary) blanks[9].value = signup.secondary;
    if (signup.applicantName) blanks[2].value = signup.applicantName;
    if (signup.name) blanks[3].value = signup.name;
    if (signup.date) blanks[1].value = signup.date;
    box.append(el('p', {}, [el('a', { href: '/gym/intake-protocol' }, ['Intake protocol'])]));
    box.append(rendered.host);
    box.append(el('button', { type: 'button', class: 'primary', onClick: () => {
      signup.applicantName = blanks[2].value.trim();
      signup.name = signup.name || blanks[3].value.trim();
      signup.primary = blanks[4].value.trim();
      signup.secondary = blanks[9].value.trim();
      signup.trackRecord = blanks[14].value.trim();
      signup.confirmed = checks[10].checked;
      if (!signup.primary || !signup.secondary) { status('Both offerings are required.'); return; }
      if (!signup.applicantName || !signup.trackRecord) { status('Add your name and one track record. They stay on this phone.'); return; }
      signup.step = 3;
      render();
    } }, ['Next']));
  } else if (signup.step === 3) {
    const name = el('input', { maxlength: '40', placeholder: 'Handle' });
    name.value = signup.name;
    box.append(el('label', {}, ['Handle. Other members see this. Your legal name stays on this phone.', name]));
    box.append(el('button', { type: 'button', class: 'primary', onClick: () => {
      const clean = name.value.trim();
      if (clean.length < 2) { status('Add a handle.'); return; }
      signup.name = clean;
      signup.step = 4;
      render();
    } }, ['Next']));
  } else if (signup.step === 4) {
    const boxes = PROGRESS_KINDS.map((kind) => {
      const input = el('input', { type: 'checkbox', value: kind.id });
      input.checked = signup.kinds.includes(kind.id);
      return el('label', { class: 'check' }, [input, kind.label]);
    });
    box.append(el('p', {}, ['Pick 3 to 5. Health meter is self-reported, not medical. Sharing stays off.']));
    box.append(...boxes);
    box.append(el('button', { type: 'button', class: 'primary', onClick: () => {
      signup.kinds = boxes.map((label) => label.querySelector('input')).filter((input) => input.checked).map((input) => input.value);
      const chosen = chooseProgress({ kinds: signup.kinds });
      if (!chosen.ok) { status(chosen.error); return; }
      signup.step = 5;
      render();
    } }, ['Next']));
  } else {
    const invite = el('input', { maxlength: '32', placeholder: '10 character invite code' });
    const groupName = el('input', { maxlength: '40', placeholder: 'New group name' });
    const made = randomInvite();
    box.append(el('p', {}, ['Join a group, create one, or skip.']));
    box.append(el('label', {}, ['Invite code', invite]));
    box.append(el('button', { type: 'button', onClick: () => finishSignup({ invite: invite.value.trim().toLowerCase() }) }, ['Join']));
    box.append(el('label', {}, ['Group name', groupName]));
    box.append(el('p', { id: 'new-invite' }, [`Invite code ${made}`]));
    box.append(el('button', { type: 'button', onClick: () => finishSignup({ name: groupName.value.trim(), invite: made }) }, ['Create group']));
    box.append(el('button', { type: 'button', class: 'primary', onClick: () => finishSignup({}) }, ['Skip']));
  }
  box.append(el('p', { id: 'gym-status', role: 'status' }, []));
  box.append(el('p', {}, [el('a', { href: '/?picker=1' }, ['All categories'])]));
  return box;
}

function ageGateCard() {
  const adult = el('input', { type: 'checkbox', id: 'age-gate' });
  const collect = el('input', { type: 'checkbox', id: 'collect-health' });
  const share = el('input', { type: 'checkbox', id: 'share-health' });
  const shareName = el('input', { type: 'checkbox', id: 'share-name' });
  return el('section', { class: 'card', id: 'health-gate' }, [
    el('h3', {}, ['Before you enter anything']),
    el('p', {}, ['This is for adults. The form stays closed until you confirm.']),
    el('label', { class: 'check' }, [adult, AGE_LABEL]),
    el('label', { class: 'check' }, [collect, COLLECT_LABEL]),
    el('label', { class: 'check' }, [share, SHARE_LABEL]),
    el('label', { class: 'check' }, [shareName, 'Send my name and track record to my sponsors']),
    el('p', { class: 'muted' }, ['Progress sharing and your name are separate. Both stay off unless you check them.']),
    el('p', {}, [el('a', { href: '/gym/health-data' }, ['Consumer health data notice'])]),
    el('button', { type: 'button', class: 'primary', onClick: () => {
      const saved = healthConsent({ adult: adult.checked === true, collect: collect.checked === true, share: share.checked === true });
      if (!saved.ok) { status(saved.error); return; }
      signup.adult = true;
      signup.collect = true;
      signup.share = saved.consent.share;
      signup.shareName = shareName.checked === true;
      render();
    } }, ['Continue'])
  ]);
}

function sponsorSeatInGroup(member, sponsorPeer) {
  if (!member || !sponsorPeer) return false;
  return Object.entries(member.clubGroups || {}).some(([code, group]) => group?.creator === sponsorPeer.id || Boolean(sponsorPeer.clubGroups?.[code]));
}

function reportView(report) {
  const host = el('div', { id: 'sponsor-report' });
  if (!report?.ok) {
    host.append(el('p', {}, [report?.error || 'This report is not available.']));
    return host;
  }
  host.append(el('h3', {}, ['Verified credit report']));
  host.append(el('p', {}, [`Balance ${Number(report.balance).toFixed(2)}. Initial limit ${report.limits.initial}. Maximum ${report.limits.maximum}. Counted across all groups.`]));
  host.append(el('p', {}, [`90-day velocity ${report.velocity.net}. Counted across all groups.`]));
  host.append(el('p', {}, [`Floor contributions ${report.floor}.`]));
  host.append(el('p', {}, [report.healthIncluded ? 'This member allowed health rows. The report keeps hashes, not the workout.' : 'Health and workout data is not in this report.']));
  host.append(el('p', { class: 'hash' }, [`Daily root ${report.root || 'none'}.`]));
  const mirror = report.onTestnet
    ? `This root is in the latest messages on Hedera testnet topic ${report.topic}.`
    : `This root is not in the latest messages on Hedera testnet topic ${report.topic}. ${report.mirrorError || 'Only hashes are written there.'}`;
  host.append(el('p', {}, [mirror]));
  if (!report.rows.length) host.append(el('p', {}, ['No credit rows yet.']));
  for (const row of report.rows) {
    host.append(el('p', { class: 'hash' }, [`${row.type} · debit ${row.debit} · credit ${row.credit} · floor ${row.floor} · ${row.included ? 'inclusion proof holds' : 'inclusion proof does not hold'} · ${row.hash}`]));
  }
  return host;
}

async function requestSponsorReport(peer) {
  const mine = await seat();
  const sponsors = peer?.covenant?.sponsors || [];
  if (!mine) { status('Choose who is acting.'); return; }
  if (!sponsors.some((row) => row.handle === mine.id)) {
    status('A sponsor requests this report.');
    return;
  }
  const report = await creditReport(peer, { authorizeHealth: peer.covenant?.authorizeHealth === true });
  if (!report.ok) { status(report.error); return; }
  report.topic = TESTNET_TOPIC;
  try {
    const [current, legacy] = await Promise.all([
      fetch(`/api/hedera/mirror?topic=${TESTNET_TOPIC}`).then((response) => response.json()),
      fetch(`/api/hedera/mirror?topic=${LEGACY_TOPIC}`).then((response) => response.json())
    ]);
    const messages = [...(current.messages || []), ...(legacy.messages || [])];
    report.onTestnet = mirrorMatch(report.root, messages);
    report.mirrorError = current.ok || legacy.ok ? '' : 'The testnet mirror did not answer.';
  } catch {
    report.onTestnet = false;
    report.mirrorError = 'The testnet mirror did not answer.';
  }
  const view = reportView(report);
  const prior = document.getElementById('sponsor-report');
  if (prior) prior.replaceWith(view);
  else document.getElementById('sponsor-report-slot')?.append(view);
}

function covenantPanel(peer, members = []) {
  if (!peer?.covenant) return null;
  const host = el('section', { class: 'card', id: 'covenant-member' });
  host.append(el('p', { id: 'intake-status' }, [intakeStatusText(peer.intake?.status)]));
  const tierOpen = peer.intake?.status === 'Tier-0' || peer.intake?.status === 'Tier-1';
  const ready = sponsorshipReady(peer);
  host.append(el('p', { id: 'sponsor-count' }, [`Sponsors: ${ready.count}.`]));
  if (!ready.ok) host.append(el('p', { id: 'sponsor-status' }, [ready.error]));
  if (peer.intake?.status === 'Revise') {
    host.append(el('p', {}, [(peer.intake.notes || []).join(' ')]));
    host.append(el('button', { type: 'button', onClick: () => go('/intake') }, ['Edit intake']));
  }
  if (peer.intake?.status === 'Tier-1') {
    host.append(el('p', {}, ['Negative line is -50.']));
    if (!peer.intake.limitRequest?.approved) {
      host.append(el('button', { type: 'button', onClick: async () => {
        const raised = requestLimitRaise(peer.intake, -200);
        if (!raised.ok) { status(raised.error); return; }
        peer.intake = raised.intake;
        await store.set(peer.id, peer);
        status('The raise waits for the steward. Nothing was credited.');
        render();
      } }, ['Request a limit of -200']));
    }
  }
  const groupCode = Object.keys(peer.clubGroups || {})[0];
  if (groupCode) {
    const stewardId = groupSteward(members, groupCode);
    const routed = routeSteward({ steward: stewardId, members, sponsors: sponsorIds(peer), requested: peer.intake?.stewardRequest === true });
    if (routed.conflict) host.append(el('p', {}, [routed.alternate ? `Steward routed to ${routed.alternate}.` : 'An alternate steward is needed.']));
    if (sponsorIds(peer).includes(stewardId)) {
      host.append(el('button', { type: 'button', onClick: async () => {
        peer.intake = { ...(peer.intake || {}), stewardRequest: true };
        await store.set(peer.id, peer);
        render();
      } }, ['Request a different steward']));
    }
  }
  if (peer.intake?.status === 'Tier-0') host.append(el('p', {}, ['No negative line until 25 units are earned.']));
  if (peer.intake?.status === 'paused') host.append(el('p', {}, [(peer.intake.notes || []).join(' ')]));
  if (peer.intake?.reviewHash) host.append(el('p', { class: 'muted' }, [`Review hash ${peer.intake.reviewHash}`]));
  if (peer.intake?.reviewAnchor?.hashscan) host.append(el('p', {}, [el('a', { href: peer.intake.reviewAnchor.hashscan, target: '_blank', rel: 'noopener noreferrer' }, ['HashScan testnet'])]));
  if (peer.covenant.token) {
    const link = `${location.origin}/gym#/sponsor/${peer.covenant.token}`;
    host.append(el('p', {}, [ready.ok
      ? 'Another sponsor can still sign. There is no maximum.'
      : 'At least 2 sponsors, including one from your group. The group creator may sponsor you. There is no maximum.']));
    host.append(el('p', {}, [el('a', { id: 'sponsor-link', href: `#/sponsor/${peer.covenant.token}` }, [link])]));
    const qr = el('div', { id: 'sponsor-qr' });
    host.append(qr);
    queueMicrotask(() => { if (globalThis.QRCode) new globalThis.QRCode(qr, { text: link, width: 160, height: 160 }); });
    if (!tierOpen) host.append(el('p', { class: 'muted' }, ['You can use private progress now. Listings and credit stay closed until 2 sponsors sign, including one from your group.']));
  }
  const reports = el('input', { type: 'checkbox', id: 'report-access' });
  reports.checked = peer.covenant.reportAccess !== false;
  reports.addEventListener('change', async () => {
    const fresh = await store.get(peer.id);
    fresh.covenant.reportAccess = reports.checked === true;
    await store.set(peer.id, fresh);
    status(reports.checked ? 'Sponsors can request a credit report.' : 'Sponsor reports are off.');
  });
  const healthRows = el('input', { type: 'checkbox', id: 'authorize-health' });
  healthRows.checked = peer.covenant.authorizeHealth === true;
  healthRows.addEventListener('change', async () => {
    const fresh = await store.get(peer.id);
    fresh.covenant.authorizeHealth = healthRows.checked === true;
    await store.set(peer.id, fresh);
    status(healthRows.checked ? 'A sponsor report may include health rows as hashes.' : 'Health data stays out of sponsor reports.');
  });
  host.append(el('label', { class: 'check' }, [reports, 'Allow sponsor credit reports']));
  host.append(el('label', { class: 'check' }, [healthRows, 'Include health data in sponsor reports']));
  host.append(el('p', { class: 'muted' }, ['Health stays out unless you check it. It is never written to Hedera.']));
  const suggestion = suggestThird(members, peer, { id: 'counterparty', clubGroups: peer.clubGroups || {} });
  host.append(el('p', { id: 'attestation-rule' }, [`Needs 3 attestations (over $100). ${suggestion.text}.`]));
  host.append(el('p', { id: 'attestation-count' }, [`Pending attestations: ${(peer.highValue || []).filter((row) => row.status === 'pending').length}.`]));
  host.append(el('button', { type: 'button', onClick: async () => {
    const result = await sim.createListing(store, peer.id, {});
    status(result.error || 'Listed.');
  } }, ['Post a listing']));
  host.append(el('button', { type: 'button', onClick: async () => {
    const result = await sim.postDeed(store, peer.id, {});
    status(result.error || 'Posted.');
  } }, ['Draw credit']));
  host.append(el('p', { class: 'muted', id: 'covenant-hash' }, [`Covenant hash ${peer.covenant.hash}`]));
  if (peer.covenant.anchor?.hashscan) host.append(el('p', {}, [el('a', { href: peer.covenant.anchor.hashscan, target: '_blank', rel: 'noopener noreferrer' }, ['HashScan testnet'])]));
  else host.append(el('p', { class: 'muted' }, [peer.covenant.anchor?.wording || 'Queued. The daily job writes the hash. Health data is not written.']));
  const note = velocityNote(peer.balance, peer.covenant.openedAt);
  if (note) {
    host.append(el('p', {}, [note]));
    host.append(el('button', { type: 'button', onClick: async () => {
      peer.covenant.giftChoice = 'floor';
      await store.set(peer.id, peer);
      status('The gift choice is on this phone. The balance does not move by itself.');
    } }, ['Gift surplus to the Floor']));
  }
  host.append(el('button', { type: 'button', onClick: () => {
    const commitments = openCommitments(peer);
    const receipt = exitReceipt({ handle: peer.id, balance: peer.balance, commitments, date: new Date().toISOString().slice(0, 10) });
    host.append(el('pre', { id: 'exit-receipt' }, [`Balance ${Number(peer.balance || 0).toFixed(2)}. Open commitments: ${commitments.length ? commitments.join('; ') : 'none'}.\n${receipt}`]));
  } }, ['Leave the Circle']));
  host.append(el('p', { id: 'gym-status', role: 'status' }, []));
  return host;
}

async function renderSponsor(token) {
  const mine = await seat();
  const peer = (await books()).find((row) => row.covenant?.token === token) || null;
  if (!peer) {
    let record = null;
    try {
      const response = await fetch(`/api/gym/covenant?token=${encodeURIComponent(token)}`);
      const body = await response.json();
      record = body.record || null;
    } catch { record = null; }
    if (!record) return el('p', {}, ['This sponsor link is not on this phone.']);
    return el('section', {}, [
      el('h2', {}, ['Sponsor a member']),
      el('p', {}, [`${record.handle} asked for a sponsor on ${record.date}.`]),
      el('p', { class: 'muted' }, ['The legal name stays on their phone.']),
      el('button', { type: 'button', class: 'primary', onClick: () => signRemote(token, mine) }, ['Sign as sponsor']),
      el('p', { id: 'gym-status', role: 'status' }, [])
    ]);
  }
  let priv = readPrivate(peer.id);
  if (!priv.applicantName && mine) {
    try {
      const response = await signedGym('/api/gym/intake', { handle: mine.id, action: 'read', token });
      const body = await response.json();
      if (body.private?.applicantName) priv = { ...priv, ...body.private };
    } catch { /* the name stays on the applicant's phone */ }
  }
  const shared = el('div', { id: 'sponsor-private' });
  if (priv.applicantName || priv.trackRecord) {
    shared.append(el('p', {}, [`Applicant name: ${priv.applicantName || ''}`]));
    shared.append(el('p', {}, [`Track record: ${priv.trackRecord || ''}`]));
    shared.append(el('p', { class: 'muted' }, ['Shared with your sponsors. It is not on the public page.']));
  }
  return el('section', {}, [
    el('h2', {}, ['Sponsor a member']),
    el('p', {}, [`${peer.covenant.handle} asked for a sponsor on ${peer.covenant.date}.`]),
    el('p', { id: 'sponsor-count' }, [`Sponsors: ${(peer.covenant.sponsors || []).length}.`]),
    shared,
    await reviewSheet(peer),
    el('button', { type: 'button', id: 'request-report', onClick: () => requestSponsorReport(peer) }, ['Request verified credit report']),
    el('div', { id: 'sponsor-report-slot' }),
    el('p', { id: 'gym-status', role: 'status' }, [])
  ]);
}

async function reviewSheet(peer) {
  const text = await intakeBody();
  const parts = intakeParts(text);
  const rendered = renderProtocol(parts.part3);
  rendered.host.id = 'review-sheet';
  const priv = readPrivate(peer.id);
  if (priv.applicantName && rendered.blanks[0]) rendered.blanks[0].value = priv.applicantName;
  return el('div', {}, [
    rendered.host,
    el('button', { type: 'button', class: 'primary', onClick: () => submitReview(peer, rendered.checks, rendered.blanks[3]) }, ['Save review'])
  ]);
}

async function submitReview(peer, checks, notes) {
  const mine = await seat();
  if (!mine) { status('Choose who is acting.'); return; }
  const choice = (start) => checks[start].checked ? 'PASS' : checks[start + 1].checked ? 'REVISE' : checks[start + 2].checked ? 'REJECT' : '';
  const gates = (start) => [0, 1, 2, 3, 4].map((index) => checks[start + index].checked);
  const saved = addReview(peer.intake || { handle: peer.id, reviews: [] }, {
    handle: mine.id,
    primary: { gates: gates(0), status: choice(5) },
    secondary: { gates: gates(8), status: choice(13) },
    notes: notes?.value || ''
  });
  if (!saved.ok) { status(saved.error); return; }
  peer.intake = saved.intake;
  const signed = signSponsor(peer.covenant, mine.id, { inGroup: sponsorSeatInGroup(peer, mine) });
  if (signed.ok) {
    const text = await covenantBody();
    peer.covenant = { ...signed.record, hash: await covenantHash({ text, handle: peer.covenant.handle, date: peer.covenant.date, sponsors: signed.record.sponsors }) };
  }
  await shareIntake(peer);
  if (peer.intake.status !== 'Pending sponsors') {
    peer.intake.reviewHash = await reviewHash(peer.intake);
    await store.set(peer.id, peer);
    await publishReview(await store.get(peer.id));
  } else await store.set(peer.id, peer);
  status(intakeStatusText(peer.intake.status));
  go('/me');
}

async function shareIntake(peer) {
  const priv = readPrivate(peer.id);
  if (!peer?.covenant?.token || (!priv.applicantName && !priv.trackRecord)) return;
  try {
    const shared = await intakeSharePayload(peer, priv);
    await signedGym('/api/gym/intake', shared);
    await signedGym('/api/gym/intake', { handle: peer.id, action: 'public', token: peer.covenant.token, intake: publicIntake(peer.intake || {}) });
  } catch { /* sync is off */ }
}

async function publishReview(peer) {
  try {
    const statusResponse = await fetch('/api/hedera/status');
    const ready = await statusResponse.json();
    if (!ready.enabled) {
      peer.intake.reviewAnchor = { enabled: false, wording: ready.wording || 'Testnet anchoring is not running yet.' };
      await store.set(peer.id, peer);
      return;
    }
    const response = await signedGym('/api/hedera/queue', { handle: peer.id, action: 'queue', hash: peer.intake.reviewHash, day: new Date().toISOString().slice(0, 10) });
    const body = await response.json();
    peer.intake.reviewAnchor = body.ok && body.sequenceNumber
      ? { enabled: true, hashscan: body.hashscan }
      : { enabled: true, queued: true, wording: body.wording || 'Queued. The daily job writes the hash. Health data is not written.' };
    await store.set(peer.id, peer);
  } catch {
    peer.intake.reviewAnchor = { enabled: false, wording: 'The hash stayed on this phone. The daily job did not take it.' };
  }
}

async function signLocal(peer) {
  const mine = await seat();
  if (!mine) { status('Choose who is acting.'); return; }
  const signed = signSponsor(peer.covenant, mine.id, { inGroup: sponsorSeatInGroup(peer, mine) });
  if (!signed.ok) { status(signed.error); return; }
  const text = await covenantBody();
  peer.covenant = { ...signed.record, hash: await covenantHash({ text, handle: peer.covenant.handle, date: peer.covenant.date, sponsors: signed.record.sponsors }) };
  await store.set(peer.id, peer);
  try {
    await signedGym('/api/gym/covenant', { handle: mine.id, action: 'sign', token: peer.covenant.token, inGroup: sponsorSeatInGroup(peer, mine) });
  } catch { /* the signature stays on this phone */ }
  if (peer.covenant.sponsors.length >= 2) publishCovenant(peer, text);
  status(sponsorStatus(peer.covenant));
  go('/me');
}

async function signRemote(token, mine) {
  if (!mine) { status('Choose who is acting.'); return; }
  const response = await signedGym('/api/gym/covenant', { handle: mine.id, action: 'sign', token });
  const body = await response.json();
  status(body.ok ? sponsorStatus(body.record) : (body.error || 'The sponsor signature was not saved.'));
}

async function renderIntakeEdit() {
  const mine = await seat();
  if (!mine) return renderRegister();
  const text = await intakeBody();
  const parts = intakeParts(text);
  const rendered = renderProtocol(parts.part1);
  rendered.host.id = 'intake-form';
  const blanks = rendered.blanks;
  const priv = readPrivate(mine.id);
  blanks[2].value = priv.applicantName || '';
  blanks[3].value = mine.id;
  blanks[4].value = mine.intake?.primary || '';
  blanks[9].value = mine.intake?.secondary || '';
  blanks[14].value = priv.trackRecord || '';
  return el('section', {}, [
    el('h2', {}, ['Edit intake']),
    rendered.host,
    el('button', { type: 'button', class: 'primary', onClick: async () => {
      mine.intake = publicIntake({ ...mine.intake, primary: blanks[4].value.trim(), secondary: blanks[9].value.trim(), reviews: [], status: 'Pending sponsors', notes: mine.intake?.notes || [] });
      mine.covenant.primary = mine.intake.primary;
      mine.covenant.secondary = mine.intake.secondary;
      savePrivate(mine.id, { ...priv, applicantName: blanks[2].value.trim(), trackRecord: blanks[14].value.trim(), legalName: priv.legalName, signature: priv.signature });
      await store.set(mine.id, mine);
      go('/me');
    } }, ['Save intake']),
    el('p', { id: 'gym-status', role: 'status' }, [])
  ]);
}

async function renderHelperHome() {
  const config = await loadHelper().catch(() => null);
  if (!config) return el('section', { id: 'my-helper', class: 'card' }, [el('p', {}, ['No helper yet.']), el('a', { href: '/helper' }, ['Set up my own AI helper'])]);
  return el('section', { id: 'my-helper', class: 'card' }, [
    el('h2', {}, [config.name || 'Helper']),
    el('p', {}, [config.paused ? 'Paused.' : 'On.']),
    el('p', {}, [config.does ? `It may ${config.does}.` : '']),
    el('p', {}, [config.schedule || '']),
    el('p', { class: 'muted' }, ['It never sends, posts, accepts, signs, spends, or mints credit.']),
    el('button', { type: 'button', onClick: async () => { config.paused = !config.paused; await saveHelper(config); render(); } }, [config.paused ? 'Resume' : 'Pause']),
    el('p', {}, [el('a', { href: '/helper' }, ['Edit'])]),
    el('button', { type: 'button', onClick: () => { deleteHelper(); render(); } }, ['Delete']),
    el('button', { id: 'export-helper', type: 'button', onClick: () => {
      const blob = new Blob([helperFile(config)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = el('a', { href: url, download: 'my-helper.json' });
      link.click();
    } }, ['Export my helper'])
  ]);
}

async function renderDashboard() {
  const mine = await seat();
  if (!mine) {
    const rows = await books();
    if (rows.some((peer) => peer.example !== true && peer.gymProgress?.chosen?.length >= 3)) {
      return el('div', {}, [el('p', {}, ['Choose who is acting before you sponsor, sign, or request a report.'])]);
    }
    return renderRegister();
  }
  const sync = await chatStatus();
  let remote = [];
  if (sync.shared) {
    try {
      const response = await fetch('/api/gym/progress');
      const body = await response.json();
      remote = Array.isArray(body.cards) ? body.cards : [];
    } catch { remote = []; }
  }
  const locals = await books();
  let feedPeers = locals;
  if (!sync.shared) {
    const examples = demoStore();
    await seedDemoClub(examples);
    const demoRows = await listBooks(examples);
    feedPeers = [...locals, ...demoRows];
  }
  const feed = communityFeed({ peers: feedPeers, viewer: mine, remoteCards: remote });
  const groups = Object.values(mine.clubGroups || {});
  const sponsored = locals.filter((peer) => peer.id !== mine.id && (peer.covenant?.sponsors || []).some((row) => row.handle === mine.id));
  const view = el('div', {}, [
    el('p', {}, [el('a', { href: '/?picker=1' }, ['All categories']), ' · ', el('a', { href: '/gym/covenant' }, ['Member Covenant'])]),
    covenantPanel(mine, locals),
    sponsored.length ? el('section', { class: 'card', id: 'sponsored-members' }, [
      el('h2', {}, ['People you sponsor']),
      ...sponsored.map((peer) => el('div', {}, [
        el('p', {}, [`${peer.id}. Sponsors: ${(peer.covenant.sponsors || []).length}.`]),
        el('button', { type: 'button', onClick: () => requestSponsorReport(peer) }, ['Request verified credit report'])
      ])),
      el('div', { id: 'sponsor-report-slot' })
    ]) : null,
    await renderProgress(mine, true),
    localAiCard(mine),
    el('h2', {}, ['Your groups']),
    groups.length ? el('div', {}, groups.map((group) => el('p', {}, [group.name]))) : el('p', { class: 'muted' }, ['No group yet.']),
    el('button', { type: 'button', class: 'primary', onClick: () => go('/train') }, ['Start']),
    el('button', { type: 'button', onClick: () => go('/train') }, ['Finish']),
    el('h2', {}, ['Community updates']),
    el('p', { class: 'muted' }, [sync.shared ? 'Shared updates from other phones. Not written to Hedera.' : 'Shared board starts when sync is on. Example cards stay labeled example.'])
  ]);
  if (!feed.length) view.append(el('p', {}, ['Nothing shared yet.']));
  for (const item of feed) {
    view.append(el('article', { class: 'card' }, [
      el('div', { class: 'avatar', 'aria-hidden': 'true' }, [(item.handle || '?').slice(0, 1)]),
      item.example ? el('p', { class: 'kicker' }, ['Example']) : null,
      el('p', { class: 'muted' }, [item.group]),
      el('p', {}, [item.text])
    ]));
  }
  return view;
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
  else if (path.startsWith('/sponsor/')) view = await renderSponsor(decodeURIComponent(path.slice('/sponsor/'.length)));
  else if (path === '/intake') view = await renderIntakeEdit();
  else if (path === '/helper') view = await renderHelperHome();
  else if (path === '/register' || (!registered && mode !== 'demo' && path === '/')) view = await renderRegister();
  else if (registered && (path === '/' || path === '/me')) view = await renderDashboard();
  else view = await renderClub();
  panel.replaceChildren(view);
  const people = await books();
  if (people.length) panel.prepend(actingAs(people));
  applySticky();
  document.querySelectorAll('nav button').forEach((button) => {
    const home = path === '/' || path === '/me' || path === '/register';
    button.setAttribute('aria-current', button.dataset.route === path || (home && button.dataset.route === '/') ? 'page' : 'false');
  });
}

async function findRegistered(book) {
  for (const peer of await listBooks(book)) {
    if (peer.example !== true && peer.gymProgress?.chosen?.length >= 3) return peer;
  }
  return null;
}

async function listBooks(book) {
  const rows = [];
  for (const id of await book.listIds()) {
    const row = await book.get(id);
    if (row) rows.push(row);
  }
  return rows;
}

async function boot() {
  const real = realStore();
  registered = await findRegistered(real);
  if (registered && mode !== 'demo') {
    store = real;
    mode = 'real';
    const reals = [];
    for (const peer of await listBooks(real)) {
      if (peer.example !== true && peer.gymProgress?.chosen?.length >= 3) reals.push(peer);
    }
    const saved = seatId();
    if (saved && reals.some((peer) => peer.id === saved)) setSeat(saved);
    else if (reals.length === 1) setSeat(reals[0].id);
    else setSeat('');
  } else if (mode === 'demo') {
    await seedDemoClub(store);
    seedDemoChat(localStorage);
    if (!seatId()) setSeat('jordan');
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw-gym.js', { scope: '/gym' }).catch(() => {});
  startAgentLoop();
  window.addEventListener('hashchange', () => { render(); });
  document.querySelectorAll('nav button').forEach((button) => {
    button.addEventListener('click', () => go(button.dataset.route));
  });
  await render();
}

boot();
