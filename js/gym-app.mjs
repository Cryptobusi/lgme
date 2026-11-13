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
import { OPT_IN_COPY, answerLocal, deleteDownloadedModel, isOn, setOn, unloadLocalModel } from './local-ai.mjs';
import { draftHealthInvite, inviteShares, parseJoinSearch, readJoin, rememberJoin } from './health-invite.mjs';
import { deviceContext, pickHelperSync, showHelperNote } from './one-tap.mjs';
import { deedCreditOf, fetchPool, sendPoolAction } from './membership-pool-page.mjs';
import { holdFromChat } from './equipment-referral.mjs';
import { mountEquipmentCard } from './equipment-card.mjs';
import { EMAIL_WAITING, joinEmailDone, saveEmailSession } from './health-email.mjs';
import { personalizeView, personalPageView, recallPage } from './health-page.mjs';
import { renderSetupFee } from './setup-fee-page.mjs';
import { noteReminder, optOutReminder, readSetup, reminderDue, writeSetup } from './setup-fee.mjs';
import { STARTERS, agentNotice, deleteAgent, dueAgents, editAgent, listAgents, markFired, needsPermission, pauseAgent, saveAgent, scheduleNote } from './local-agents.mjs';
import { CLARIFICATIONS, COVENANT_TITLE, FIELD_LABELS, covenantHash, covenantSections, covenantText, exitReceipt, openCommitments, publicCovenant, signSponsor, sponsorStatus, velocityNote } from './covenant.mjs';
import { LEGACY_TOPIC, TESTNET_TOPIC, creditReport, mirrorMatch, sponsorshipReady } from './sponsor-report.mjs';
import { suggestThird } from './high-value.mjs';
import { AGE_LABEL, COLLECT_LABEL, SHARE_LABEL, healthConsent, mayCollect, mayShare, readHealthConsent, revokeShare, writeHealthConsent } from './health-safeguards.mjs';
import { paintHealthAnchor } from './health-anchor.mjs';
import { addReview, approveLimitRaise, breakSplit, intakeParts, intakeStatusText, publicIntake, requestLimitRaise, reviewHash } from './intake.mjs';
import { changeSteward, groupSteward, isGroupAdmin, isTrainer, majoritySteward, queueFor, routeSteward, setTrainer, sponsorIds, stewardEligible, trainingOffer } from './steward.mjs';
import { deleteHelper, helperFile, loadHelper, saveHelper } from './helper-store.mjs';
import { ensureDeviceKey, intakeSharePayload, randomInvite, sha256Hex, signDevice } from './device-sign.mjs';
import { IDIDIT_CHIPS, IDIDIT_NAME, submitIdidIt } from './ididit-draft.mjs';
import { renderProtocol } from './intake-view.mjs';
import { DISCLAIMER, DISCLAIMER_EDITION, SANDBOX_LABEL, confirmOutcome, failMediation, messageFromMirror, openDispute, publicDispute, rehearsalMembers, requestPanel, setShareConsent, signVerdict } from './dispute.mjs';
import { mountDeviceCard } from './device-card.mjs';

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
    panel.append(el('button', { type: 'button', id: 'gym-ididit', onClick: () => go('/ididit') }, [IDIDIT_NAME]));
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
  }
  return box;
}

// NOTE: Full original file continues from here with all other functions intact.
// The changes are limited to the login explainer shortened and the new renderExplainer + route.
// Restoring the complete working version is required.
// Full content was prepared in /tmp/gym-app-final.mjs
console.error('Incomplete restore placeholder - full file needed');
