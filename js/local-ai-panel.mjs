import { applyFieldOption, fieldMeta, lastFieldValue, nextFormTarget, rememberFieldValue, safeHelpLine } from './field-help.mjs';
import { controlText, pageOverview, collectSections } from './control-help.mjs';
import { actionIdFrom, dismissOffer, explainOnTap, fieldGuideWithoutModel, guideCards, incognitoBlocksUses, nextStep, noteUse, pinShortcuts, promotion, readMode, readUses as readGuideUses, setMode, shortcutOffer, SHORTCUTS } from './guide-mode.mjs';
import { answerOrFallback, describeModel, localAnswer } from './local-qa.mjs';
import { askServer, shouldSelfTest, sourceChip, TEST_QUESTION, testLine } from './server-ai.mjs';
import { classifyPrompt, routeLine } from './prompt-route.mjs';
import { activeScreen, applyMode, screenModePrompt, undoMode } from './screen-modes.mjs';
import { localFunctionFromPrompt, saveLocalFunction } from './local-functions.mjs';
import { draftWithHelper, localAiReady, pickHelperSync } from './one-tap.mjs';
import { currentLevel, eventCompletes, experienced, guideFor, isStartQuestion, LEVELS, markDone, pathChips, pathLine, resetPath, skipAhead } from './learn-path.mjs';
import { dockChipsOf } from './variant-schema.mjs';
import { NOTICE, UNPUBLISHED, deletePending, editPending, holdPrivate, incognitoOn, installIncognitoGuard, listPending, setIncognito, shareApproved, sharePreview, voiceInputAllowed } from './incognito.mjs';
import { installPressFeedback, playTick, soundsOn } from './press-feedback.mjs';
import { askDevice, deviceAllowed } from './device-ask.mjs';

const FLAG = 'Only available online with AI enabled.';
const AI_CHIPS = ['Log a workout', 'Make an IdidIt receipt', 'What can I do here?', 'I want something', 'I have something'];
const USE_KEY = 'lgme.dock.used';

export function rankedPrompts(labels, uses = {}) {
  return [...labels].sort((a, b) => (Number(uses[b]) || 0) - (Number(uses[a]) || 0) || labels.indexOf(a) - labels.indexOf(b));
}

function readUses() {
  try { return JSON.parse(localStorage.getItem(USE_KEY) || '{}'); } catch { return {}; }
}

function rememberUse(label) {
  const uses = readUses();
  uses[label] = (Number(uses[label]) || 0) + 1;
  try { localStorage.setItem(USE_KEY, JSON.stringify(uses)); } catch { /* the count still shows this visit */ }
}

export function dockKeyboardOffset(innerHeight, viewport) {
  const height = Number(viewport?.height);
  const offsetTop = Number(viewport?.offsetTop) || 0;
  if (!Number.isFinite(height)) return 0;
  return Math.max(0, Math.round(Number(innerHeight) - height - offsetTop));
}

export function keyboardDropped(baseline, current, threshold = 120) {
  const base = Number(baseline);
  const now = Number(current);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(now)) return false;
  return base - now >= threshold;
}

export function keyboardFolded(baseline, current, slack = 80) {
  const base = Number(baseline);
  const now = Number(current);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(now)) return true;
  return base - now <= slack;
}

export function coarseMobile(win) {
  if (!win) return false;
  const narrow = Number(win.innerWidth) > 0 && Number(win.innerWidth) <= 900;
  let coarse = false;
  try {
    coarse = Boolean(win.matchMedia?.('(pointer: coarse)')?.matches || win.matchMedia?.('(hover: none)')?.matches);
  } catch { coarse = false; }
  const touch = Number(win.navigator?.maxTouchPoints) > 0;
  return Boolean(narrow && (coarse || touch));
}

export function keyboardMode({ baseline, current, onPage, onPrompt, coarse, seenDrop = false, allowFocus = true }) {
  const dropped = keyboardDropped(baseline, current);
  const folded = keyboardFolded(baseline, current);
  if (folded && seenDrop) return 'closed';
  if (onPage && (dropped || (coarse && allowFocus))) return 'page';
  if (onPrompt && dropped) return 'prompt';
  if (folded || (!onPage && !onPrompt)) return 'closed';
  return 'closed';
}

function signedIn() {
  try {
    const member = JSON.parse(localStorage.getItem('lgme.demo.member') || 'null');
    return Boolean(member && member.demo === true && member.disclaimer !== false);
  } catch {
    return false;
  }
}

function aiOn() {
  try {
    if (localStorage.getItem('lgme.ai.enabled') == null) localStorage.setItem('lgme.ai.enabled', '1');
    return localStorage.getItem('lgme.ai.enabled') !== '0';
  } catch { return true; }
}

function paint(dock) {
  const enabled = aiOn();
  const model = describeModel(window, localStorage);
  const ready = enabled && model.ready;
  const online = navigator.onLine !== false;
  const flag = dock.querySelector('#ai-flag');
  const accept = dock.querySelector('#ai-accept');
  const toggle = dock.querySelector('#ai-switch');
  dock.classList.toggle('is-off', !enabled);
  toggle.classList.toggle('is-on', ready || (enabled && (dock.dataset.aiSource === 'online' || dock.dataset.aiSource === 'device')));
  toggle.dataset.state = ready ? 'on' : enabled ? 'unavailable' : 'off';
  toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
  toggle.textContent = enabled && dock.dataset.aiSource
    ? sourceChip(dock.dataset.aiSource, dock.dataset.aiLabel || '')
    : model.chip;
  const head = document.getElementById('ai-head');
  if (head) {
    head.textContent = enabled ? 'AI on' : 'AI off';
    head.classList.toggle('is-on', enabled);
  }
  dock.dataset.ai = enabled ? (ready ? 'yes' : 'no') : 'off';
  dock.dataset.online = online ? 'yes' : 'no';
  flag.hidden = true;
  flag.textContent = `${FLAG} Online: ${online ? 'yes' : 'no'}. AI: ${ready ? 'yes' : 'no'}.`;
  const sent = dock.dataset.sent === 'yes';
  const state = dock.querySelector('#ai-send-state');
  if (state) {
    state.classList.toggle('is-sent', sent);
    state.classList.toggle('is-held', !sent);
    state.setAttribute('aria-label', sent ? 'Sent.' : 'Not sent. Held on this phone.');
  }
  if (typeof dock.paintControls === 'function') dock.paintControls();
  if (!enabled) {
    accept.disabled = true;
    return;
  }
  if (dock.classList.contains('has-field')) {
    accept.disabled = false;
    accept.textContent = 'Hint';
    return;
  }
  accept.disabled = false;
  accept.textContent = 'Hint';
}

const ACTIVITIES = [
  [/treadmills?/, 'Treadmill'],
  [/walk(?:ed|ing|s)?/, 'Walk'],
  [/jog(?:ged|ging)?/, 'Jog'],
  [/(?:ran|running|runs?)/, 'Run'],
  [/bik(?:e|ed|ing)/, 'Bike'],
  [/cycl(?:e|ed|ing)/, 'Bike'],
  [/(?:swam|swimming|swims?)/, 'Swim'],
  [/lift(?:ed|ing)?/, 'Lift'],
  [/yoga/, 'Yoga'],
  [/stretch(?:ed|ing|es)?/, 'Stretch'],
  [/strength/, 'Strength'],
  [/row(?:ing|ed)?/, 'Row'],
  [/steps?/, 'Steps'],
  [/hik(?:e|ed|ing)/, 'Hike'],
  [/danc(?:e|ed|ing)/, 'Dance'],
  [/pilates/, 'Pilates']
];

function workoutMinutes(text) {
  const hour = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  if (hour) return Math.round(Number(hour[1]) * 60);
  const minute = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/);
  return minute ? Math.round(Number(minute[1])) : 0;
}

function workoutMeasure(text) {
  const miles = text.match(/(\d+(?:\.\d+)?)\s*(?:miles|mi)\b/);
  const km = text.match(/(\d+(?:\.\d+)?)\s*km\b/);
  const mph = text.match(/(\d+(?:\.\d+)?)\s*mph\b/);
  const kmh = text.match(/(\d+(?:\.\d+)?)\s*km\/h\b/);
  const sets = text.match(/(\d+)\s*sets?\b/);
  const reps = text.match(/(\d+)\s*reps?\b/);
  const weight = text.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|kg)\b/);
  const steps = text.match(/(\d+)\s*steps?\b/);
  const distance = miles ? `${miles[1]} miles` : km ? `${km[1]} km` : steps ? `${steps[1]} steps` : '';
  const speed = mph ? `${mph[1]} mph` : kmh ? `${kmh[1]} km/h` : '';
  let minutes = workoutMinutes(text);
  let computed = false;
  if (!minutes && miles && mph && Number(mph[1]) > 0) {
    minutes = Math.round(Number(miles[1]) / Number(mph[1]) * 60);
    computed = true;
  } else if (!minutes && km && kmh && Number(kmh[1]) > 0) {
    minutes = Math.round(Number(km[1]) / Number(kmh[1]) * 60);
    computed = true;
  }
  return {
    distance,
    speed,
    minutes,
    computed,
    sets: sets ? Number(sets[1]) : 0,
    reps: reps ? Number(reps[1]) : 0,
    weight: weight ? `${weight[1]} ${weight[2] === 'kg' ? 'kg' : 'lb'}` : ''
  };
}

function workoutActivity(text) {
  for (const [pattern, label] of ACTIVITIES) {
    if (new RegExp(`\\b(?:${pattern.source})\\b`).test(text)) return label;
  }
  return '';
}

export function matchPrompt(text) {
  const raw = String(text || '').trim();
  const q = raw.toLowerCase();
  if (!q) return { kind: 'help', text: '', line: 'Type log a workout, I want something, or I have something.' };
  if (/what can i do|help me|show help/.test(q)) return { kind: 'help', text: '', line: 'You can log a workout, say I want something, or say I have something.' };
  if (/^(open\s+)?inventory\b/.test(q)) return { kind: 'inventory', text: 'Inventory', line: 'Opened Inventory. Nothing was saved.' };
  if (/^(open\s+)?sobe\s?it\b/.test(q)) return { kind: 'sobeit', text: 'SobeIt', line: 'Opened SobeIt. Nothing was paid.' };
  const screen = screenModePrompt(raw);
  if (screen) return { kind: 'screen', mode: screen.mode, text: '', line: screen.line };
  const local = localFunctionFromPrompt(raw);
  if (local?.ok) return { kind: 'local', item: local.item, text: local.item.prompt, line: 'This stays on this phone. Confirm to save the shortcut. Nothing is sent.' };
  const want = raw.match(/^i want\s+(.+)/i);
  if (want) return { kind: 'iwantit', text: want[1].trim(), line: `Opened IwantIT: ${want[1].trim()}` };
  const have = raw.match(/^i have\s+(.+)/i);
  if (have) return { kind: 'ihavit', text: have[1].trim(), line: `Opened IhavIT: ${have[1].trim()}` };
  if (/^attest\b/i.test(raw)) return { kind: 'attest', text: 'Attest a receipt', line: 'Opened attest. Nothing was approved.' };
  const activity = workoutActivity(q);
  const measure = workoutMeasure(q);
  const lead = /^(log\b|did\b|i did\b|ididit\b)/.test(q);
  const measured = measure.minutes || measure.distance || measure.sets || measure.reps || measure.weight;
  if ((activity && measured) || lead) {
    const parts = [activity || 'I did the session'];
    if (measure.distance) parts.push(measure.distance);
    if (measure.speed) parts.push(measure.speed);
    if (measure.sets) parts.push(`${measure.sets} sets`);
    if (measure.reps) parts.push(`${measure.reps} reps`);
    if (measure.weight) parts.push(measure.weight);
    if (measure.minutes) parts.push(measure.computed ? `about ${measure.minutes} min` : `${measure.minutes} min`);
    const title = activity && (measure.minutes || measure.distance) ? parts.join(', ') : (activity || 'I did the session');
    return { kind: 'ididit', text: title, title, activity, ...measure, line: 'Opened the IdidIt draft.' };
  }
  return { kind: 'help', text: '', line: 'Say log a workout, I want something, or I have something.' };
}

export function readyLine(matched) {
  const label = matched?.title || matched?.text || 'the session';
  return [
    `Ready to log on IdidIt: ${label}.`,
    '1) Press Send again or tap Confirm to open the filled-in draft.',
    '2) Check the activity and minutes.',
    '3) Tap Confirm on the page to record it.',
    '4) Ask a trainer or nearby member to attest (optional).'
  ].join('\n');
}

export const LIKELY_CATEGORIES = ['Health', 'Campus', 'Neighbor help'];

export function planSend({ staged, stagedText, text }) {
  const value = String(text || '').trim();
  const matched = value ? matchPrompt(value) : { kind: 'help', text: '', line: 'Type a workout with a time or a distance.' };
  if (!value || (matched.kind === 'help' && stagedText === value && !staged)) {
    return {
      action: 'reexplain',
      line: value
        ? 'Nothing is staged. Add a time or a distance, or pick a category.'
        : 'Type a workout with a time or a distance, or pick a category.',
      categories: LIKELY_CATEGORIES
    };
  }
  if (staged && stagedText === value) return { action: 'open', matched: staged };
  if (matched.kind === 'help') return { action: 'explain', matched, line: matched.line };
  return { action: 'stage', matched, line: readyLine(matched) };
}

export function stageLine(matched) {
  return readyLine(matched);
}

const STEP_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

export function voiceFriendly(text) {
  const lines = String(text || '').split(/\n+/);
  return lines.map((line) => {
    let next = line.trim();
    next = next.replace(/\b(\d+(?:\.\d+)?)\s*mph\b/gi, '$1 miles per hour');
    next = next.replace(/\b(\d+(?:\.\d+)?)\s*km\/h\b/gi, '$1 kilometers per hour');
    next = next.replace(/\b(\d+)\s*mins?\b/gi, '$1 minutes');
    next = next.replace(/^\s*(\d+)\)\s*/, (_, number) => {
      const word = STEP_WORDS[Number(number) - 1] || number;
      return `Step ${word}. `;
    });
    next = next.replace(/&/g, ' and ');
    next = next.replace(/[$%#]/g, '');
    next = next.replace(/\s{2,}/g, ' ').trim();
    return next;
  }).filter(Boolean).join('\n');
}

export function spokenCommand(text) {
  const q = String(text || '').trim().toLowerCase().replace(/[.!?]+$/g, '');
  if (q === 'yes' || q === 'confirm' || q === 'send') return 'confirm';
  if (q === 'cancel') return 'cancel';
  if (q === 'undo') return 'undo';
  return '';
}

export function stepPick(text) {
  const q = String(text || '').trim().toLowerCase();
  const named = q.match(/\b(?:do|step|number)\s+#?(\d+)\b/);
  const bare = q.match(/^#?(\d+)\b/);
  const match = named || bare;
  const n = match ? Number(match[1]) : 0;
  return n > 0 ? n : 0;
}

const VOICE_REPLIES = [
  { id: 'speak', label: 'Speak and show' },
  { id: 'show', label: 'Show only' },
  { id: 'off', label: 'Off' }
];

export function voiceReplyMode(value) {
  return VOICE_REPLIES.some((item) => item.id === value) ? value : 'speak';
}

export function readVoiceReply(storage) {
  try {
    const saved = storage.getItem('lgme.voice.reply');
    if (saved) return voiceReplyMode(saved);
    if (storage.getItem('lgme.voice.read') === 'off') return 'show';
  } catch { /* Show only stays the default until Speak reply is approved */ }
  return 'show';
}

export function speakApproved(storage) {
  try { return storage.getItem('lgme.voice.speak') === 'yes'; } catch { return false; }
}

export function setSpeakChoice(storage, yes) {
  storage.setItem('lgme.voice.speak', yes ? 'yes' : 'no');
  storage.setItem('lgme.voice.reply', yes ? 'speak' : 'show');
  return yes ? 'yes' : 'no';
}

export function formatReply(text) {
  const raw = String(text || '').replace(/\r/g, '').trim();
  if (!raw) return '';
  let lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 1) lines = lines[0].split(/(?<=[.?!])\s+/).map((line) => line.trim()).filter(Boolean);
  const escape = (value) => value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  return lines.map((line, index) => {
    const body = /^\d+[.)]/.test(line) ? line : `${index + 1}. ${line}`;
    const safe = escape(body).replace(/\b(OK\??|Confirm|Tap [A-Za-z]+|Check)\b/g, '<strong>$1</strong>');
    return `<p>${safe}</p>`;
  }).join('');
}

export function nextVoiceReply(mode) {
  const order = VOICE_REPLIES.map((item) => item.id);
  return order[(order.indexOf(voiceReplyMode(mode)) + 1) % order.length];
}

export function voiceReplyLabel(mode) {
  return VOICE_REPLIES.find((item) => item.id === voiceReplyMode(mode)).label;
}

export function voiceReplyShows(mode, byVoice) {
  return byVoice === true && voiceReplyMode(mode) !== 'off';
}

export function voiceReplySpeaks(mode, byVoice) {
  return byVoice === true && voiceReplyMode(mode) === 'speak';
}

export function speechErrorLine(code) {
  const lines = {
    'not-allowed': 'Mic blocked: allow microphone in site settings',
    'service-not-allowed': 'Mic blocked: allow microphone in site settings',
    'no-speech': 'No speech heard. Tap the mic and speak again.',
    network: 'Mic needs a connection on this browser. Typing still works.',
    'audio-capture': 'No microphone was found. Typing still works.'
  };
  return lines[code] || 'The microphone did not start. Typing still works.';
}

export function executionPlan(matched) {
  if (matched?.kind === 'screen') {
    const name = String(matched.mode || 'everyday');
    return { openDraft: false, message: `Screen changed to ${name.charAt(0).toUpperCase()}${name.slice(1)}. Undo?` };
  }
  if (matched?.kind === 'local') return { openDraft: false, message: 'Saved on this device only. Nothing was sent.' };
  return { openDraft: true, message: 'Opening draft' };
}

export function filledLine(title) {
  return `Draft filled: ${title}. Check it, then tap Confirm on the page (or press Send) to record the receipt on testnet.`;
}

function mount() {
  installIncognitoGuard();
  installPressFeedback();
  if (document.getElementById('ai-dock')) return;
  const dock = document.createElement('section');
  dock.id = 'ai-dock';
  dock.setAttribute('aria-label', 'On-device AI');
  dock.innerHTML = '<p class="ai-top"><span class="ai-mode" role="group" aria-label="Helper"><button type="button" id="ai-expand" class="ai-mode-btn" aria-expanded="true">Close</button><button type="button" id="ai-switch" class="ai-pill ai-mode-btn" role="switch" aria-checked="true" aria-live="polite" aria-label="AI on or off">AI off</button><button type="button" id="guide-ai" class="ai-mode-btn" aria-pressed="true">AI</button><button type="button" id="guide-classic" class="ai-mode-btn" aria-pressed="false">Classic</button></span><span id="ai-status">AI off · Voice · Speak+show</span><button type="button" id="ai-self-test" class="ai-pill">Test AI</button><span id="ai-test-line" hidden></span><button type="button" id="ai-voice" class="ai-detail is-off" aria-pressed="false" aria-label="Voice off">Voice</button><button type="button" id="ai-voice-reply" class="ai-detail" aria-label="Voice reply, Speak and show">Reply</button><span id="ai-voice-mode" class="ai-detail">Speak+show</span><button type="button" id="ai-listen" class="ai-detail" aria-pressed="false" aria-label="Listen again after speaking">Listen</button><span id="ai-mic" hidden>Listening</span><span id="ai-speaking" hidden>Speaking</span><button type="button" id="ai-stop" hidden>Stop</button><a class="ai-setup-link ai-detail" href="/ai-setup">Help</a><button type="button" id="ai-incognito" class="ai-detail" aria-pressed="false">Incognito</button><button type="button" id="ai-incognito-count" class="ai-detail">Pending 0</button></p><p id="ai-incognito-notice" hidden>Incognito — stays on this phone</p><p id="app-reset-note" hidden>App updated and reset</p><p id="ai-flag" hidden></p><p id="ai-path"><span id="ai-path-line"></span><span id="ai-path-actions"><button type="button" id="ai-path-reset">Reset</button><button type="button" id="ai-path-skip">Next step</button></span></p><div id="ai-chip-row"><div id="ai-chips" class="ai-chips"></div><span id="ai-chip-hint" aria-hidden="true">›</span></div><div id="ai-scroll"><div id="ai-incognito-review" hidden></div><p id="ai-overview"></p><ol id="ai-overview-steps"></ol><section id="ai-next"><p class="ai-kicker">Next step</p><button type="button" id="ai-next-primary"></button><div id="ai-next-alts"></div></section><section id="ai-promote"><p id="ai-promote-line"></p></section><section id="ai-shortcut-offer" hidden></section><div id="ai-log-frame"><pre id="ai-log"></pre><ol id="ai-explain-steps"></ol><div id="ai-suggestions"></div></div><p id="ai-more" hidden>More</p></div><div class="ai-compose"><div id="ai-input-frame"><textarea id="ai-ask" rows="1" enterkeyhint="send" autocomplete="off" aria-label="Ask the helper"></textarea><p id="ai-send-state" class="is-held" role="status" aria-label="Not sent. Held on this phone."><i></i></p><p class="ai-actions"><button type="button" id="ai-controls" aria-expanded="false" aria-label="Show or hide controls">Controls</button><button type="button" id="speak-ask" role="switch" aria-checked="false" aria-label="Speak reply?">Speak</button><button type="button" id="ai-mic-btn" class="is-off" data-state="off" aria-pressed="false" aria-label="Microphone off"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg></button><button type="button" id="ai-send" aria-label="Send">Send</button><button type="button" id="ai-accept" aria-label="Hint">Hint</button><button type="button" id="ai-confirm" aria-label="Confirm">OK</button></p></div></div><div id="ai-key-done" hidden><button type="button" id="ai-field-voice" aria-label="Speak a prefill">Speak</button><span id="ai-field-chips"></span><button type="button" id="ai-field-type" aria-label="Show keyboard to change the prefill">Type</button><button type="button" id="ai-field-close" aria-label="Close keyboard" hidden>✕</button><button type="button" id="ai-field-done">Done</button></div>';
  dock.classList.add('is-normal');
  if (readMode(localStorage) !== 'manual') dock.classList.add('is-open');
  try { document.documentElement.dataset.screen = activeScreen(localStorage); } catch { /* everyday height stays */ }
  try {
    if (localStorage.getItem('lgme.reset.note') === '1') {
      const note = dock.querySelector('#app-reset-note');
      note.hidden = false;
      localStorage.removeItem('lgme.reset.note');
    }
  } catch { /* the bar still shows */ }
  document.body.append(dock);
  let baseline = 0;
  let seenDrop = false;
  let allowFocus = true;
  const currentViewport = () => {
    const view = Number(window.visualViewport?.height);
    if (Number.isFinite(view) && view > 0) return view;
    const inner = Number(window.innerHeight);
    return Number.isFinite(inner) ? inner : 0;
  };
  const editing = (el) => Boolean((el && fieldMeta(el)) || (el && el.id === 'ai-ask'));
  const noteBaseline = (force = false) => {
    const current = currentViewport();
    if (force) {
      baseline = current;
      seenDrop = false;
      allowFocus = true;
      return baseline;
    }
    if (!editing(document.activeElement)) baseline = Math.max(baseline, current);
    return baseline;
  };
  const pageField = (el) => Boolean(el && fieldMeta(el) && el.type !== 'checkbox' && el.type !== 'radio');
  const advanceField = (field) => {
    const next = nextFormTarget(field);
    if (!next) {
      field.focus();
      return field;
    }
    next.scrollIntoView({ block: 'center' });
    next.focus();
    if (next.classList) next.classList.add('is-ask-focus');
    return next;
  };
  const doneButton = dock.querySelector('#ai-key-done');
  const doneLabel = dock.querySelector('#ai-field-done');
  const typeButton = dock.querySelector('#ai-field-type');
  const closeKeys = dock.querySelector('#ai-field-close');
  let heldField = null;
  const guidedPhone = () => readMode(localStorage) !== 'manual' && coarseMobile(window);
  const holdKeys = (field) => {
    if (!field || !guidedPhone() || field.dataset.lgmeType === '1') return;
    if (field.dataset.lgmeKeys !== 'held') field.dataset.inputmodeWas = field.getAttribute('inputmode') || '';
    field.setAttribute('inputmode', 'none');
    field.dataset.lgmeKeys = 'held';
  };
  const prefillField = (field) => {
    if (!field || field.dataset.lgmePrefilled === '1') return;
    if (String(field.value || '').trim()) { field.dataset.lgmePrefilled = '1'; return; }
    const meta = fieldMeta(field);
    const first = meta && !meta.personal ? meta.options?.[0] : '';
    if (!first) return;
    applyFieldOption(field, first);
    field.dataset.lgmePrefilled = '1';
  };
  const paintFieldBar = (field) => {
    const host = dock.querySelector('#ai-field-chips');
    const voice = dock.querySelector('#ai-field-voice');
    const guided = readMode(localStorage) !== 'manual';
    if (voice) voice.hidden = !guided;
    if (typeButton) typeButton.hidden = !guided;
    if (!host) return;
    host.hidden = !guided;
    host.replaceChildren();
    if (!guided || !field) return;
    const meta = fieldMeta(field);
    if (!meta) return;
    const last = field.id ? lastFieldValue(localStorage, field.id, incognitoOn(localStorage)) : '';
    const labels = [];
    for (const label of (last ? [last, ...(meta.options || [])] : (meta.options || []))) {
      if (label && !labels.includes(label)) labels.push(label);
      if (labels.length === 3) break;
    }
    for (const label of labels) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-field-chip';
      chip.textContent = label;
      chip.addEventListener('pointerdown', (event) => event.preventDefault());
      chip.addEventListener('click', () => {
        applyFieldOption(field, label);
        field.dataset.lgmePrefilled = '1';
        try { rememberFieldValue(localStorage, field.id, label, incognitoOn(localStorage)); } catch { /* the field still shows it */ }
        advanceField(field);
      });
      host.append(chip);
    }
  };
  const syncKeyboard = () => {
    const active = document.activeElement;
    const onPage = pageField(active);
    const onPrompt = Boolean(active && active.id === 'ai-ask');
    if (onPage) heldField = active;
    if (!onPage && !onPrompt) noteBaseline(false);
    const current = currentViewport();
    if (!baseline) baseline = current;
    const dropped = keyboardDropped(baseline, current);
    if (dropped) seenDrop = true;
    const mode = keyboardMode({
      baseline,
      current,
      onPage,
      onPrompt,
      coarse: coarseMobile(window),
      seenDrop,
      allowFocus
    });
    if (mode === 'closed' && seenDrop) allowFocus = false;
    if (mode === 'closed') seenDrop = false;
    if (!onPage && !onPrompt) allowFocus = true;
    if (!dock.classList.contains('is-key-page') && !dock.classList.contains('is-key-prompt')) {
      dock.dataset.wasOpen = dock.classList.contains('is-open') ? '1' : '0';
    }
    dock.classList.toggle('is-key-page', mode === 'page');
    dock.classList.toggle('is-key-prompt', mode === 'prompt');
    if (mode === 'page' && onPage && guidedPhone()) {
      holdKeys(active);
      if (active.dataset.lgmeType !== '1') prefillField(active);
    }
    if (doneButton) {
      const next = onPage ? nextFormTarget(active) : null;
      const confirming = next && /^(ok|confirm|propose)$/i.test(String(next.textContent || '').trim());
      if (doneLabel) doneLabel.textContent = confirming ? 'OK' : 'Done';
      doneButton.hidden = mode !== 'page';
      const keyboardOpen = mode === 'page' && dropped;
      if (closeKeys) closeKeys.hidden = !keyboardOpen;
      if (typeButton) typeButton.hidden = keyboardOpen || readMode(localStorage) === 'manual';
      if (mode === 'page') paintFieldBar(onPage ? active : heldField);
    }
    if (mode === 'closed' && dock.dataset.wasOpen === '0') dock.classList.remove('is-open');
    else if (mode === 'closed') dock.classList.add('is-open');
    if (mode === 'page' && dropped && active && active.scrollIntoView) active.scrollIntoView({ block: 'center' });
  };
  const placeDock = () => {
    const overlap = dockKeyboardOffset(window.innerHeight, window.visualViewport);
    dock.style.bottom = overlap ? `${overlap}px` : '';
    if (doneButton) doneButton.style.bottom = overlap ? `${overlap + 8}px` : '';
    syncKeyboard();
  };
  noteBaseline(true);
  placeDock();
  window.visualViewport?.addEventListener('resize', placeDock);
  window.visualViewport?.addEventListener('scroll', placeDock);
  window.addEventListener('resize', placeDock);
  window.addEventListener('orientationchange', () => noteBaseline(true));
  doneLabel.addEventListener('click', () => {
    const active = document.activeElement;
    const next = pageField(active) ? nextFormTarget(active) : null;
    const confirming = next && /^(ok|confirm|propose)$/i.test(String(next.textContent || '').trim());
    if (confirming) next.focus();
    else if (active && active.blur) active.blur();
    dock.classList.remove('is-key-page', 'is-key-prompt');
    if (dock.dataset.wasOpen === '0') dock.classList.remove('is-open');
    else dock.classList.add('is-open');
  });
  typeButton.addEventListener('pointerdown', (event) => event.preventDefault());
  typeButton.addEventListener('click', () => {
    const field = pageField(document.activeElement) ? document.activeElement : heldField;
    if (!field) return;
    field.dataset.lgmeType = '1';
    const prev = field.dataset.inputmodeWas || '';
    if (prev) field.setAttribute('inputmode', prev);
    else field.removeAttribute('inputmode');
    field.dataset.lgmeKeys = 'open';
    field.focus();
  });
  closeKeys.addEventListener('click', () => {
    const field = pageField(document.activeElement) ? document.activeElement : heldField;
    if (field) {
      delete field.dataset.lgmeType;
      field.setAttribute('inputmode', 'none');
      field.dataset.lgmeKeys = 'held';
      if (document.activeElement === field) field.blur();
    }
    closeKeys.hidden = true;
    if (typeButton && readMode(localStorage) !== 'manual') typeButton.hidden = false;
  });
  const ask = dock.querySelector('#ai-ask');
  const chips = dock.querySelector('#ai-chips');
  const showOverview = (line, steps = []) => {
    const box = dock.querySelector('#ai-overview');
    const list = dock.querySelector('#ai-overview-steps');
    if (box) {
      const full = String(line || '').trim();
      const parts = full.split(/(?<=[.?!])\s+/).filter(Boolean);
      box.replaceChildren();
      const preview = document.createElement('span');
      preview.textContent = parts.length > 1 ? parts[0] : full;
      box.append(preview);
      if (parts.length > 1) {
        const more = document.createElement('button');
        more.type = 'button';
        more.id = 'ai-overview-more';
        more.textContent = 'More';
        more.addEventListener('click', () => { preview.textContent = full; more.remove(); });
        box.append(more);
      }
    }
    if (list) {
      list.replaceChildren();
      steps.slice(0, 3).forEach((label, index) => {
        const item = document.createElement('li');
        item.textContent = `${index + 1}. ${label}`;
        list.append(item);
      });
    }
  };
  const paintTry = (actions = []) => {
    let host = dock.querySelector('#ai-try');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ai-try';
      dock.querySelector('#ai-log')?.after(host);
    }
    host.replaceChildren();
    actions.slice(0, 3).forEach((action) => {
      const link = document.createElement('a');
      link.href = action.href;
      link.className = 'ai-try-chip';
      link.textContent = `Try it: ${action.label}`;
      host.append(link);
    });
  };
  const presentAnswer = async (text) => {
    const sections = collectSections(document);
    const local = localAnswer(text, { sections });
    const model = describeModel(window, localStorage);
    let reply = local.text;
    if (aiOn() && model.ready) {
      const page = pageOverview(location.pathname, location.hash, document.title);
      try {
        const result = await draftWithHelper(pickHelperSync(), {
          template: local.text,
          prompt: `Answer in 3 to 6 plain sentences. No medical advice. No rankings. Question: ${text}. This page: ${page.line}`,
          scope: window,
          timeout: 4000
        });
        const heard = String(result?.text || '').replace(/\s+/g, ' ').trim();
        const chosen = answerOrFallback({ question: text, modelText: heard === local.text ? '' : heard, aiOn: true, modelReady: true, sections });
        reply = chosen.text || local.text;
        dock.dataset.aiSource = 'device';
        dock.dataset.aiLabel = '';
      } catch {
        reply = answerOrFallback({ question: text, aiOn: true, modelReady: false, sections }).text;
        dock.dataset.aiSource = 'guide';
      }
    } else if (aiOn() && !model.ready) {
      const page = pageOverview(location.pathname, location.hash, document.title);
      const online = await askServer(text, page.line);
      if (online.ok) {
        reply = online.text;
        dock.dataset.aiSource = 'online';
        dock.dataset.aiLabel = online.label;
      } else {
        reply = answerOrFallback({ question: text, aiOn: true, modelReady: false, sections }).text;
        dock.dataset.aiSource = 'guide';
      }
    }
    if (!String(reply || '').trim()) reply = local.text;
    const log = dock.querySelector('#ai-log');
    showReply(log, reply);
    showOverview(reply, []);
    paintTry(local.actions);
    dock.dataset.sent = 'no';
    paint(dock);
    markOverflow();
    if (local.matched && isStartQuestion(text)) noteLearn('start');
    const here = document.querySelector('#start-health, a.health-open, #messages-open');
    if (here && typeof here.focus === 'function') {
      here.classList.add('is-ask-focus');
      here.focus();
    }
  };
  const fillDraft = (label) => {
    if (ask && !ask.value) ask.value = label;
  };
  const paintGuide = () => {
    const mode = readMode(localStorage);
    document.documentElement.dataset.guide = mode;
    dock.classList.toggle('is-manual', mode === 'manual');
    const page = pageOverview(location.pathname, location.hash, document.title);
    const step = nextStep(location.pathname, location.hash);
    showOverview(page.line, guideCards(mode) ? page.steps : []);
    const primary = dock.querySelector('#ai-next-primary');
    const alts = dock.querySelector('#ai-next-alts');
    const promote = dock.querySelector('#ai-promote-line');
    if (primary) {
      primary.textContent = step.primary;
      primary.onclick = () => fillDraft(step.primary);
    }
    if (alts) {
      alts.replaceChildren();
      step.alternates.forEach((label) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ai-next-alt';
        button.textContent = label;
        button.addEventListener('click', () => fillDraft(label));
        alts.append(button);
      });
    }
    if (promote) promote.textContent = promotion(location.pathname, location.hash);
    const aiBtn = dock.querySelector('#guide-ai');
    const classicBtn = dock.querySelector('#guide-classic');
    const guided = mode !== 'manual';
    if (aiBtn) aiBtn.setAttribute('aria-pressed', guided ? 'true' : 'false');
    if (classicBtn) classicBtn.setAttribute('aria-pressed', guided ? 'false' : 'true');
    const offer = dock.querySelector('#ai-shortcut-offer');
    if (offer) {
      const ids = shortcutOffer(localStorage);
      offer.hidden = !ids;
      offer.replaceChildren();
      if (ids) {
        const line = document.createElement('p');
        line.textContent = `Pin ${ids.map((id) => SHORTCUTS[id].label).join(', ')} to My shortcuts? This stays on this phone.`;
        const yes = document.createElement('button');
        yes.type = 'button';
        yes.textContent = 'Pin';
        yes.addEventListener('click', () => {
          pinShortcuts(localStorage, ids);
          document.dispatchEvent(new CustomEvent('lgme-shortcuts'));
          paintGuide();
        });
        const no = document.createElement('button');
        no.type = 'button';
        no.textContent = 'Not now';
        no.addEventListener('click', () => { dismissOffer(localStorage); paintGuide(); });
        offer.append(line, yes, no);
      }
    }
    const path = dock.querySelector('#ai-path');
    const level = currentLevel(localStorage);
    const uses = readUses();
    const guideUses = readGuideUses(localStorage);
    const exp = experienced(localStorage, uses, guideUses);
    if (path) path.hidden = mode === 'manual' || !level;
    const pathText = dock.querySelector('#ai-path-line');
    if (pathText) pathText.textContent = pathLine(localStorage);
    if (mode !== 'manual' && level) {
      const words = guideFor(localStorage, uses, guideUses);
      if (exp) {
        const box = dock.querySelector('#ai-overview');
        if (box) box.textContent = words;
      } else showOverview(words, []);
      if (ask && !ask.value.trim()) ask.value = level.prompt;
    }
  };
  const openPanel = () => {
    dock.classList.add('is-open');
    const expand = dock.querySelector('#ai-expand');
    if (expand) {
      expand.setAttribute('aria-expanded', 'true');
      expand.textContent = 'Close';
    }
  };
  const closePanel = () => {
    dock.classList.remove('is-open');
    const expand = dock.querySelector('#ai-expand');
    if (expand) {
      expand.setAttribute('aria-expanded', 'false');
      expand.textContent = 'Open';
    }
  };
  const showPage = () => paintGuide();
  let explained = '';
  const explainControl = (node, demand = false) => {
    const el = node && node.closest ? node.closest('button, summary, [role="switch"], a[href], .dash-head') : null;
    if (!el || (el.closest && el.closest('#ai-overview, #ai-overview-steps, #ai-next, #ai-promote, #shortcut-offer'))) return;
    const manual = !explainOnTap(readMode(localStorage));
    if (manual && !demand && el.id !== 'ai-accept') return;
    const text = controlText(el);
    if (!text || text === explained) return;
    explained = text;
    if (!manual || demand) showOverview(text, []);
    if (el.id !== 'ai-expand' && !manual) openPanel();
    const action = actionIdFrom(el);
    if (action) noteUse(localStorage, action, incognitoBlocksUses(localStorage));
  };
  let holdTimer = 0;
  document.addEventListener('pointerdown', (event) => {
    clearTimeout(holdTimer);
    const el = event.target && event.target.closest ? event.target.closest('button, summary, [role="switch"]') : null;
    if (!el) return;
    holdTimer = setTimeout(() => explainControl(el, true), 500);
  }, true);
  document.addEventListener('pointerup', () => clearTimeout(holdTimer), true);
  document.addEventListener('pointercancel', () => clearTimeout(holdTimer), true);
  document.addEventListener('click', (event) => explainControl(event.target), true);
  document.addEventListener('focusin', (event) => explainControl(event.target));
  window.addEventListener('hashchange', () => { showPage(); if (readMode(localStorage) !== 'manual') openPanel(); });
  window.addEventListener('popstate', () => { showPage(); if (readMode(localStorage) !== 'manual') openPanel(); });
  window.addEventListener('lgme-guide-mode', () => {
    const manual = readMode(localStorage) === 'manual';
    if (manual) noteLearn('yours');
    paintGuide();
    if (manual) closePanel();
    else openPanel();
  });
  window.addEventListener('lgme-shortcuts', () => noteLearn('yours'));
  window.addEventListener('lgme-learn', (event) => noteLearn(String(event.detail || '')));
  const chooseMode = (mode) => {
    setMode(localStorage, mode);
    paintGuide();
    if (mode === 'manual') closePanel();
    else openPanel();
    document.dispatchEvent(new CustomEvent('lgme-guide-mode'));
  };
  dock.querySelector('#guide-ai').addEventListener('click', () => chooseMode('guided'));
  dock.querySelector('#guide-classic').addEventListener('click', () => chooseMode('manual'));
  showPage();
  if (readMode(localStorage) === 'manual') closePanel();
  else openPanel();
  const dismissed = new Set();
  let fieldToken = 0;
  const visibleSteps = (labels) => labels.filter((label) => !dismissed.has(label));
  const paintExplainSteps = (labels) => {
    const list = dock.querySelector('#ai-explain-steps');
    if (!list) return;
    list.replaceChildren();
    visibleSteps(labels).forEach((label, index) => {
      const item = document.createElement('li');
      const n = index + 1;
      item.innerHTML = `<strong>${n}.</strong> ${label.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))}`;
      list.append(item);
    });
  };
  const paintSuggestions = (labels, field) => {
    const host = dock.querySelector('#ai-suggestions');
    if (!host) return;
    host.replaceChildren();
    const steps = visibleSteps(labels);
    paintExplainSteps(labels);
    steps.forEach((label, index) => {
      const n = index + 1;
      const row = document.createElement('div');
      row.className = 'ai-suggest';
      row.dataset.step = String(n);
      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'ai-step-no';
      badge.textContent = String(n);
      badge.setAttribute('aria-label', `Do ${n}`);
      const line = document.createElement('span');
      line.className = 'ai-suggest-line';
      line.textContent = label;
      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'ai-yes';
      yes.textContent = '✓';
      yes.setAttribute('aria-label', `Yes, ${label}`);
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'ai-no';
      no.textContent = '×';
      no.setAttribute('aria-label', `No, ${label}`);
      yes.addEventListener('click', () => {
        if (field) {
          applyFieldOption(field, label);
          advanceField(field);
          return;
        }
        ask.value = label;
        lastByVoice = false;
        dock.classList.remove('is-voice');
        dock.dataset.sent = 'no';
        stagePrompt();
        if (staged) executeStaged({ record: false });
      });
      no.addEventListener('click', () => {
        dismissed.add(label);
        if (stagedText === label) { staged = null; stagedText = ''; }
        row.remove();
        for (const chip of chips.querySelectorAll('.ai-chip')) {
          if (chip.textContent === label) chip.remove();
        }
      });
      badge.addEventListener('click', () => {
        if (field) return;
        ask.value = label;
        lastByVoice = false;
        dock.classList.remove('is-voice');
        dock.dataset.sent = 'no';
        stagePrompt();
      });
      const pair = document.createElement('span');
      pair.className = 'ai-yesno';
      pair.append(yes, no);
      row.append(badge, line, pair);
      host.append(row);
    });
  };
  const paintChips = (labels, field, last = '') => {
    chips.replaceChildren();
    for (const label of labels) {
      if (dismissed.has(label)) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'ai-chip';
      chip.textContent = label;
      if (field) {
        chip.addEventListener('pointerdown', (event) => { event.preventDefault(); });
        chip.addEventListener('click', () => {
          applyFieldOption(field, label === 'Use my last value' ? last : label);
          advanceField(field);
        });
      } else {
        chip.addEventListener('click', () => {
          const level = currentLevel(localStorage);
          const onPath = level && label === level.chip && readMode(localStorage) !== 'manual' && !experienced(localStorage, readUses(), readGuideUses(localStorage));
          if (onPath) {
            ask.value = level.prompt;
            lastByVoice = false;
            dock.classList.remove('is-voice');
            dock.dataset.sent = 'no';
            sendOrStage();
            return;
          }
          ask.value = label;
          ask.focus();
        });
      }
      chips.append(chip);
    }
    paintSuggestions(labels, field);
  };
  const hideHint = () => {
    const hint = document.getElementById('field-hint');
    if (hint) hint.hidden = true;
  };
  const speakGuide = (words) => {
    const SpeechOut = window.speechSynthesis;
    if (!speakApproved(localStorage) || !SpeechOut || !words) return;
    try { SpeechOut.cancel(); } catch { /* a quiet browser still shows the words */ }
    const utter = new SpeechSynthesisUtterance(words);
    utter.lang = 'en-US';
    SpeechOut.speak(utter);
  };
  let hinted = null;
  const placeHint = (field, meta) => {
    let hint = document.getElementById('field-hint');
    if (!hint) {
      hint = document.createElement('button');
      hint.type = 'button';
      hint.id = 'field-hint';
      document.body.append(hint);
      hint.addEventListener('click', () => {
        dock.classList.add('is-open');
        const expand = dock.querySelector('#ai-expand');
        if (expand) {
          expand.setAttribute('aria-expanded', 'true');
          expand.textContent = 'Close';
        }
        if (hinted) showField(hinted);
      });
    }
    hinted = field;
    hint.hidden = false;
    hint.textContent = meta.what || meta.help;
    const box = field.getBoundingClientRect();
    hint.style.top = `${Math.min(box.bottom + 4, window.innerHeight - 48)}px`;
    hint.style.left = `${Math.max(8, box.left)}px`;
  };
  const showField = (field) => {
    const meta = fieldMeta(field);
    const guided = fieldGuideWithoutModel(readMode(localStorage));
    if (!meta || (!aiOn() && !guided)) { hideHint(); return; }
    const last = field.id ? lastFieldValue(localStorage, field.id, incognitoOn(localStorage)) : '';
    const labels = last ? [...meta.options, 'Use my last value'] : meta.options;
    const words = meta.text || meta.help;
    if (!dock.classList.contains('is-open')) {
      placeHint(field, meta);
      return;
    }
    hideHint();
    dock.classList.add('has-field');
    const log = dock.querySelector('#ai-log');
    log.textContent = words;
    paintChips(labels, field, last);
    paint(dock);
    if (aiOn()) speakGuide(words);
    const token = ++fieldToken;
    if (!aiOn() || !localAiReady()) return;
    draftWithHelper(pickHelperSync(), {
      template: words,
      prompt: `One short sentence. No medical advice. Explain why this field is needed: ${words}`,
      scope: window
    }).then((result) => {
      if (token !== fieldToken || document.activeElement !== field) return;
      log.textContent = safeHelpLine(result?.text, words);
    }).catch(() => {});
  };
  const clearField = () => {
    const active = document.activeElement;
    if (active && active.closest && active.closest('#ai-dock, #field-hint')) return;
    if (fieldMeta(active)) return;
    hideHint();
    fieldToken += 1;
    dock.classList.remove('has-field');
    showPathChips();
    paint(dock);
  };
  const SIZES = ['compact', 'normal', 'tall'];
  const applySize = (next, persist = true) => {
    const size = SIZES.includes(next) ? next : 'normal';
    dock.classList.remove('is-compact', 'is-normal', 'is-tall');
    dock.classList.add(`is-${size}`);
    if (!persist) return;
    try { localStorage.setItem('lgme.dock.size', size); } catch { /* the size still shows */ }
  };
  try {
    const saved = localStorage.getItem('lgme.dock.size');
    applySize(saved || (document.getElementById('testnet-notice') ? 'compact' : 'normal'), false);
  } catch { applySize('normal', false); }
  let staged = null;
  let stagedText = '';
  let flowStep = 0;
  let lastByVoice = false;
  let hearing = null;
  const mic = dock.querySelector('#ai-mic');
  const speaking = dock.querySelector('#ai-speaking');
  const stopButton = dock.querySelector('#ai-stop');
  const replyButton = dock.querySelector('#ai-voice-reply');
  const modeLabel = dock.querySelector('#ai-voice-mode');
  const listenButton = dock.querySelector('#ai-listen');
  let lastReply = '';
  let lastHeld = '';
  let reviewOpen = false;
  let shareIds = [];
  let paintIncognito = () => {};
  const replyMode = () => readVoiceReply(localStorage);
  const showingVoice = () => voiceReplyShows(replyMode(), lastByVoice);
  const speakingVoice = () => voiceReplySpeaks(replyMode(), lastByVoice);
  const autoListen = () => {
    try { return localStorage.getItem('lgme.voice.autolisten') === '1'; } catch { return false; }
  };
  const showReply = (node, words) => {
    if (!node) return;
    lastReply = words;
    const friendly = showingVoice();
    const base = friendly ? voiceFriendly(words) : words;
    const shown = incognitoOn(localStorage) && base ? `${base}\n${UNPUBLISHED}` : base;
    node.dataset.plain = shown;
    node.innerHTML = formatReply(shown);
    dock.classList.toggle('is-voice', friendly);
    if (incognitoOn(localStorage) && words && words !== lastHeld) {
      lastHeld = words;
      holdPrivate(localStorage, { kind: 'reply', summary: words, shareable: false });
      paintIncognito();
    }
  };
  const refreshShown = () => {
    const log = dock.querySelector('#ai-log');
    if (!log || !lastReply) return;
    const friendly = voiceFriendly(lastReply);
    const shown = [lastReply, friendly, `${lastReply}\n${UNPUBLISHED}`, `${friendly}\n${UNPUBLISHED}`];
    if (log.dataset.plain && !shown.includes(log.dataset.plain)) return;
    showReply(log, lastReply);
    if (flowStep) paintSteps(flowStep);
  };
  const paintVoiceToggles = () => {
    const mode = replyMode();
    const label = voiceReplyLabel(mode);
    modeLabel.textContent = label === 'Speak and show' ? 'Speak+show' : label === 'Show only' ? 'Show' : 'Off';
    replyButton.setAttribute('aria-label', `Voice reply, ${label}`);
    const again = autoListen();
    listenButton.setAttribute('aria-pressed', again ? 'true' : 'false');
    refreshShown();
    if (mode !== 'speak') stopSpeaking();
    if (typeof dock.paintControls === 'function') dock.paintControls();
  };
  const stopSpeaking = () => {
    try { window.speechSynthesis?.cancel(); } catch { /* speech stays quiet */ }
    speaking.hidden = true;
    stopButton.hidden = true;
  };
  const speakAloud = (words) => {
    const SpeechOut = window.speechSynthesis;
    if (!speakApproved(localStorage) || !SpeechOut || !speakingVoice()) return;
    const spoken = voiceFriendly(words);
    if (!spoken) return;
    stopSpeaking();
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.lang = 'en-US';
    utter.onstart = () => { speaking.hidden = false; stopButton.hidden = false; };
    utter.onend = () => {
      speaking.hidden = true;
      stopButton.hidden = true;
      if (autoListen()) startListen();
    };
    utter.onerror = () => { speaking.hidden = true; stopButton.hidden = true; };
    SpeechOut.speak(utter);
  };
  const paintSteps = (current) => {
    flowStep = current;
    let list = dock.querySelector('#ai-steps');
    if (!current) {
      if (list) list.remove();
      return;
    }
    if (!list) {
      list = document.createElement('ol');
      list.id = 'ai-steps';
      dock.querySelector('#ai-log').after(list);
    }
    const lines = [
      'Send again to open the draft.',
      'Check the activity and minutes.',
      'Confirm on the page.',
      'Attest is optional.'
    ];
    list.classList.add('is-brief');
    list.replaceChildren();
    lines.forEach((line, index) => {
      const item = document.createElement('li');
      const step = index + 1;
      const numbered = `${step}) ${line}`;
      item.textContent = showingVoice() ? voiceFriendly(numbered) : numbered;
      if (step < current) item.className = 'is-done';
      else if (step === current) item.className = 'is-current';
      list.append(item);
    });
  };
  const note = (button, words) => {
    if (!button) return;
    button.classList.add('is-pressed');
    let line = dock.querySelector('#ai-action-status');
    if (!line) {
      line = document.createElement('p');
      line.id = 'ai-action-status';
      dock.querySelector('.ai-actions').append(line);
    }
    line.textContent = words;
    setTimeout(() => button.classList.remove('is-pressed'), 200);
  };
  const showFilled = () => {
    let words = '';
    let voiceTurn = false;
    try {
      words = sessionStorage.getItem('lgme.prompt.note') || '';
      voiceTurn = sessionStorage.getItem('lgme.voice.turn') === '1';
    } catch { /* the log stays */ }
    if (!words) return;
    const spoken = voiceFriendly(words);
    const guide = voiceTurn || /OK\?/.test(words);
    showReply(dock.querySelector('#ai-log'), guide ? spoken : words);
    if (lastByVoice || guide) speakAloud(spoken);
    if (flowStep < 3) paintSteps(2);
    try { sessionStorage.removeItem('lgme.prompt.note'); } catch { /* the log still shows */ }
  };
  const stagePrompt = ({ guide = false } = {}) => {
    dock.dataset.sent = 'no';
    paint(dock);
    const text = ask.value.trim();
    const log = dock.querySelector('#ai-log');
    const matched = matchPrompt(text);
    staged = matched.kind === 'help' ? null : matched;
    stagedText = text;
    const route = classifyPrompt(text);
    matched.route = route;
    if (guide && matched.kind !== 'help') {
      const line = voiceFriendly(`Heard ${matched.title || matched.text || 'that'}. Check the form. Tap OK. OK?`);
      showReply(log, line);
      paintSteps(1);
      try { sessionStorage.setItem('lgme.voice.turn', '1'); } catch { /* the next page still opens */ }
      if (speakingVoice()) speakAloud(line);
    } else if (matched.kind === 'ididit') {
      const ready = `Ready to log on IdidIt: ${matched.title || matched.text}.`;
      showReply(log, ready);
      paintSteps(1);
      if (lastByVoice) speakAloud(`${ready}\n${readyLine(matched)}`);
    } else {
      paintSteps(0);
      const detail = matched.line;
      const reply = route.liveWrite === false
        ? `${routeLine(route, detail)} This category is In development. Nothing is written live.`
        : `${routeLine(route, detail)}`;
      showReply(log, reply);
      if (lastByVoice) speakAloud(reply);
    }
    if (route.alternatives.length) paintChips(route.alternatives, null);
    note(dock.querySelector('#ai-send'), 'Staged');
    markOverflow();
  };
  const executeStaged = ({ record = true } = {}) => {
    const log = dock.querySelector('#ai-log');
    const pageConfirm = document.getElementById('gym-ididit-confirm');
    const pageTitle = document.getElementById('gym-ididit-other');
    if (record && pageConfirm && pageTitle && ask.value.trim() && ask.value.trim() === pageTitle.value) {
      note(dock.querySelector('#ai-confirm'), 'Recording');
      if (!incognitoOn(localStorage)) dock.dataset.sent = 'yes';
      paint(dock);
      pageConfirm.click();
      return;
    }
    if (!staged) { log.textContent = 'Confirm is waiting. Nothing ran.'; note(dock.querySelector('#ai-confirm'), 'Waiting'); markOverflow(); return; }
    const matched = staged;
    const plan = executionPlan(matched);
    staged = null;
    stagedText = '';
    rememberUse(ask.value.trim());
    if (!plan.openDraft) note(dock.querySelector('#ai-confirm'), record ? 'Done' : 'Staged');
    else {
      const side = dock.querySelector('#ai-action-status');
      if (side) side.textContent = '';
    }
    let voiceTurn = false;
    try { voiceTurn = sessionStorage.getItem('lgme.voice.turn') === '1'; } catch { /* the guide stays */ }
    if (!(plan.openDraft && voiceTurn) && !plan.openDraft) log.textContent = plan.message;
    if (!plan.openDraft) {
      if (record && matched.kind === 'screen') applyMode(localStorage, matched.mode);
      if (record && matched.kind === 'local' && matched.item) saveLocalFunction(localStorage, matched.item);
      if (!record) log.textContent = `${plan.message} Tap OK to keep it.`;
      markOverflow();
      return;
    }
    try {
      sessionStorage.setItem('lgme.prompt.draft', JSON.stringify({
        kind: matched.kind,
        text: matched.title || matched.text,
        title: matched.title || matched.text,
        activity: matched.activity || '',
        minutes: matched.minutes || 0,
        distance: matched.distance || '',
        speed: matched.speed || '',
        computed: matched.computed === true,
        sets: matched.sets || 0,
        reps: matched.reps || 0,
        weight: matched.weight || ''
      }));
    } catch { /* the line still shows */ }
    if (matched.kind === 'inventory') {
      location.assign('/inventory');
      return;
    }
    if (matched.kind === 'sobeit') {
      location.assign('/books');
      return;
    }
    const here = location.pathname.startsWith('/gym');
    if (matched.route && matched.route.liveWrite === false) {
      location.assign(matched.route.href);
      return;
    }
    if (matched.kind === 'attest') {
      location.assign('/exchange#help-resolve');
      return;
    }
    if (matched.kind === 'ididit') {
      paintSteps(2);
      if (here && location.hash === '#/ididit') window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.assign('/gym#/ididit');
    } else if (here) {
      if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '/';
      window.dispatchEvent(new CustomEvent('lgme-prompt'));
    } else location.assign('/gym#/');
    markOverflow();
  };
  const sendOrStage = () => {
    dock.classList.remove('is-key-prompt');
    const text = ask.value.trim();
    const picked = stepPick(text);
    if (picked && stageByNumber(picked)) return;
    const matched = matchPrompt(text);
    if (text && matched.kind === 'help') {
      presentAnswer(text);
      return;
    }
    const plan = planSend({ staged, stagedText, text });
    if (plan.action === 'open') {
      executeStaged();
      return;
    }
    if (plan.action === 'reexplain') {
      staged = null;
      stagedText = text;
      paintSteps(0);
      const log = dock.querySelector('#ai-log');
      showReply(log, plan.line);
      if (lastByVoice) speakAloud(plan.line);
      paintChips(plan.categories, null);
      note(dock.querySelector('#ai-send'), 'Pick one');
      markOverflow();
      return;
    }
    stagePrompt();
    if (['ididit', 'iwantit', 'ihavit', 'inventory', 'sobeit', 'attest'].includes(matched.kind)) {
    const local = localAnswer(text);
    if (local.matched) showReply(dock.querySelector('#ai-log'), local.text);
    executeStaged();
    }
  };
  const markOverflow = () => {
    const scroller = dock.querySelector('#ai-scroll');
    const more = dock.querySelector('#ai-more');
    const over = scroller.scrollHeight > scroller.clientHeight + 8 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 4;
    scroller.classList.toggle('is-over', over);
    more.hidden = !over;
  };
  const showPathChips = () => {
    if (dock.classList.contains('has-field')) return;
    paintChips(pathChips(localStorage, readUses(), readGuideUses(localStorage), readMode(localStorage)) || rankedPrompts(dockChipsOf() || AI_CHIPS, readUses()).slice(0, 5), null);
  };
  const noteLearn = (event) => {
    let changed = false;
    for (const level of LEVELS) {
      if (!eventCompletes(level.id, event)) continue;
      markDone(localStorage, level.id);
      changed = true;
    }
    if (!changed) return;
    paintGuide();
    showPathChips();
  };
  dock.querySelector('#ai-path-skip').addEventListener('click', () => {
    skipAhead(localStorage);
    ask.value = '';
    paintGuide();
    showPathChips();
  });
  dock.querySelector('#ai-path-reset').addEventListener('click', () => {
    resetPath(localStorage);
    ask.value = '';
    paintGuide();
    showPathChips();
  });
  showPathChips();
  document.addEventListener('focusin', (event) => { showField(event.target); syncKeyboard(); });
  document.addEventListener('focusout', () => { setTimeout(() => { clearField(); syncKeyboard(); }, 0); });
  document.addEventListener('change', (event) => {
    const field = event.target;
    if (!field || !field.id || !fieldMeta(field)) return;
    rememberFieldValue(localStorage, field.id, field.value, incognitoOn(localStorage));
  });
  ask.addEventListener('pointerup', () => { ask.focus(); });
  let shiftHeld = false;
  let keySent = 0;
  const sendFromKeyboard = () => {
    const now = Date.now();
    if (now - keySent < 40) return;
    keySent = now;
    lastByVoice = false;
    dock.classList.remove('is-voice');
    sendOrStage();
  };
  ask.addEventListener('keydown', (event) => {
    if (event.key === 'Shift') shiftHeld = true;
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    lastByVoice = false;
    dock.classList.remove('is-voice');
    sendFromKeyboard();
  });
  ask.addEventListener('keyup', (event) => { if (event.key === 'Shift') shiftHeld = false; });
  ask.addEventListener('beforeinput', (event) => {
    if (event.inputType !== 'insertLineBreak' || event.shiftKey || shiftHeld) return;
    event.preventDefault();
    sendFromKeyboard();
  });
  ask.addEventListener('input', () => {
    if (Date.now() - keySent < 40) {
      if (ask.value.endsWith('\n')) ask.value = ask.value.replace(/\n+$/, '');
      return;
    }
    staged = null;
    stagedText = '';
  });
  dock.querySelector('#ai-send').addEventListener('click', () => { lastByVoice = false; dock.classList.remove('is-voice'); sendOrStage(); });
  let stepQueue = [];
  const saveQueue = (labels) => {
    stepQueue = labels;
    try {
      if (labels.length) sessionStorage.setItem('lgme.step.queue', JSON.stringify(labels));
      else sessionStorage.removeItem('lgme.step.queue');
    } catch { /* the next OK still advances */ }
  };
  const stageLabel = (label) => {
    ask.value = label;
    lastByVoice = false;
    dock.classList.remove('is-voice');
    dock.dataset.sent = 'no';
    stagePrompt();
  };
  const stageByNumber = (n) => {
    const line = dock.querySelector(`.ai-suggest[data-step="${n}"] .ai-suggest-line`);
    if (!line) return false;
    saveQueue([]);
    stageLabel(line.textContent);
    return true;
  };
  dock.querySelector('#ai-confirm').addEventListener('click', () => {
    const rest = stepQueue.slice(1);
    const opens = staged && executionPlan(staged).openDraft;
    if (opens && rest[0]) {
      try { sessionStorage.setItem('lgme.step.pending', rest[0]); } catch { /* the queue still advances here */ }
    }
    saveQueue(rest);
    executeStaged();
    if (!opens && rest[0]) stageLabel(rest[0]);
  });
  window.addEventListener('lgme-draft-filled', showFilled);
  window.addEventListener('lgme-ididit-step', (event) => {
    const step = Number(event.detail?.step);
    if (step === 4) noteLearn('receipt');
    if (step) paintSteps(step);
  });
  setTimeout(showFilled, 0);
  const micBtn = dock.querySelector('#ai-mic-btn');
  const voiceBtn = dock.querySelector('#ai-voice');
  const tick = () => { if (soundsOn(localStorage)) playTick(window); };
  const MIC_MODES = ['off', 'listening', 'processing', 'done'];
  const setMicMode = (mode) => {
    const next = MIC_MODES.includes(mode) ? mode : 'off';
    for (const name of MIC_MODES) {
      micBtn.classList.toggle(`is-${name}`, name === next);
      voiceBtn.classList.toggle(`is-${name}`, name === next);
    }
    micBtn.dataset.state = next;
    const pressed = next === 'listening' ? 'true' : 'false';
    micBtn.setAttribute('aria-pressed', pressed);
    voiceBtn.setAttribute('aria-pressed', pressed);
    const label = next === 'listening' ? 'Listening… Tap to stop' : next === 'processing' ? 'Processing' : next === 'done' ? 'Heard' : 'Microphone off';
    micBtn.setAttribute('aria-label', label);
    voiceBtn.setAttribute('aria-label', next === 'off' ? 'Voice off' : `Voice ${next}`);
    const dot = dock.querySelector('#ai-status [data-voice]');
    if (dot) dot.className = `voice-${next}`;
    mic.hidden = true;
    mic.textContent = next === 'listening' ? 'Listening…' : '';
  };
  const startListen = () => {
    if (micBtn.classList.contains('is-listening')) {
      try { hearing?.stop(); } catch { /* the mic is already quiet */ }
      setMicMode('off');
      tick();
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    try { localStorage.setItem('lgme.voice.used', '1'); } catch { /* the suggestion still works */ }
    if (!Speech) {
      const field = pageField(document.activeElement) ? document.activeElement : heldField;
      setMicMode('off');
      if (field && pageField(field)) {
        showReply(dock.querySelector('#ai-log'), 'Voice is not on this device. Tap a suggestion, or Type to change the prefill.');
        return;
      }
      ask.focus();
      showReply(dock.querySelector('#ai-log'), 'Voice is not on this device. Typing still works.');
      return;
    }
    const heard = new Speech();
    const onDevice = 'processLocally' in heard;
    const hidden = incognitoOn(localStorage);
    if (hidden && !onDevice) {
      setMicMode('off');
      showReply(dock.querySelector('#ai-log'), voiceInputAllowed({ incognito: true, processLocally: false }).message);
      return;
    }
    if (hidden && onDevice) heard.processLocally = true;
    if (!deviceAllowed('microphone')) {
      askDevice({
        kind: 'microphone',
        purpose: 'The microphone types what you say on this phone. Audio is not sent. The browser asks only after Allow.',
        allow: () => startListen()
      });
      return;
    }
    heard.lang = navigator.language || 'en-US';
    heard.interimResults = true;
    heard.continuous = false;
    hearing = heard;
    const finishMic = (mode) => { setMicMode(mode); if (hearing === heard) hearing = null; };
    heard.onresult = (event) => {
      let finalText = '';
      let interim = '';
      const results = event.results || [];
      for (let index = 0; index < results.length; index += 1) {
        const row = results[index];
        const piece = row?.[0]?.transcript || '';
        if (row?.isFinal === false) interim += piece;
        else finalText += piece;
      }
      const live = `${finalText}${interim}`.trim();
      if (live) ask.value = live;
      if (!finalText.trim() || interim) {
        setMicMode('listening');
        return;
      }
      const transcript = finalText.trim();
      setMicMode('processing');
      if (hidden && transcript) holdPrivate(localStorage, { kind: 'voice', summary: transcript, shareable: false });
      const command = spokenCommand(transcript);
      lastByVoice = true;
      if (command === 'cancel') {
        staged = null;
        stagedText = '';
        stopSpeaking();
        finishMic('off');
        tick();
        showReply(dock.querySelector('#ai-log'), 'Cancelled.');
        return;
      }
      if (command === 'undo') {
        undoMode(localStorage);
        stopSpeaking();
        finishMic('off');
        tick();
        showReply(dock.querySelector('#ai-log'), 'Undone.');
        speakAloud('Undone.');
        return;
      }
      if (command === 'confirm') {
        finishMic('done');
        tick();
        const pageConfirm = document.getElementById('gym-ididit-confirm');
        if (staged) { executeStaged(); return; }
        if (pageConfirm) { pageConfirm.click(); return; }
        showReply(dock.querySelector('#ai-log'), 'Nothing is staged. Say the workout, then say confirm.');
        speakAloud('Nothing is staged. Say the workout, then say confirm.');
        return;
      }
      const target = pageField(document.activeElement) ? document.activeElement : (dock.classList.contains('is-key-page') ? heldField : null);
      if (target && pageField(target)) {
        const limit = Number(target.maxLength) > 0 ? Number(target.maxLength) : 80;
        applyFieldOption(target, transcript.slice(0, limit));
        target.dataset.lgmePrefilled = '1';
        try { sessionStorage.setItem('lgme.voice.turn', '1'); } catch { /* the field still shows it */ }
        try { rememberFieldValue(localStorage, target.id, target.value, incognitoOn(localStorage)); } catch { /* the field still shows it */ }
        finishMic('done');
        tick();
        advanceField(target);
        return;
      }
      ask.value = transcript;
      try { sessionStorage.setItem('lgme.voice.transcript', transcript); } catch { /* the field still shows it */ }
      setMicMode('done');
      const picked = stepPick(transcript);
      if (picked && stageByNumber(picked)) { tick(); return; }
      stagePrompt({ guide: true });
      if (staged) executeStaged({ record: false });
      tick();
    };
    heard.onerror = (event) => {
      const code = event?.error || '';
      finishMic('off');
      tick();
      showReply(dock.querySelector('#ai-log'), speechErrorLine(code));
    };
    heard.onend = () => { if (micBtn.classList.contains('is-listening')) finishMic('off'); };
    setMicMode('listening');
    tick();
    try { heard.start(); } catch {
      finishMic('off');
      showReply(dock.querySelector('#ai-log'), speechErrorLine('not-allowed'));
      return;
    }
    setTimeout(() => { try { heard.stop(); } catch { /* already stopped */ } }, 6000);
  };
  const fieldVoice = dock.querySelector('#ai-field-voice');
  if (fieldVoice) {
    fieldVoice.addEventListener('pointerdown', (event) => event.preventDefault());
    fieldVoice.addEventListener('click', () => startListen());
  }
  const review = dock.querySelector('#ai-incognito-review');
  const notice = dock.querySelector('#ai-incognito-notice');
  const incognitoButton = dock.querySelector('#ai-incognito');
  const countButton = dock.querySelector('#ai-incognito-count');
  paintIncognito = () => {
    const on = incognitoOn(localStorage);
    notice.hidden = !on;
    notice.textContent = NOTICE;
    incognitoButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    const rows = listPending(localStorage);
    countButton.textContent = `Pending ${rows.length}`;
    review.hidden = !reviewOpen;
    review.replaceChildren();
    if (!reviewOpen) return;
    const preview = shareIds.length ? sharePreview(localStorage, shareIds) : [];
    if (preview.length) {
      const box = document.createElement('div');
      box.id = 'ai-incognito-preview';
      for (const line of preview) {
        const item = document.createElement('p');
        item.textContent = `${line.destination}. ${line.leaves} ${line.label}`;
        box.append(item);
      }
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.id = 'ai-incognito-confirm';
      confirm.textContent = 'Confirm share';
      confirm.addEventListener('click', async () => {
        const native = window.__lgmeNativeFetch || window.fetch.bind(window);
        await shareApproved(localStorage, shareIds, native);
        shareIds = [];
        paintIncognito();
      });
      box.append(confirm);
      review.append(box);
    }
    const list = document.createElement('ul');
    for (const row of rows) {
      const item = document.createElement('li');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = shareIds.includes(row.id);
      box.addEventListener('change', () => {
        shareIds = box.checked ? [...new Set([...shareIds, row.id])] : shareIds.filter((id) => id !== row.id);
      });
      const text = document.createElement('span');
      text.textContent = `${row.summary} — ${row.destination}. ${UNPUBLISHED}`;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => {
        const field = document.createElement('input');
        field.value = row.summary;
        field.maxLength = 180;
        const save = document.createElement('button');
        save.type = 'button';
        save.textContent = 'Save edit';
        save.addEventListener('click', () => {
          editPending(localStorage, row.id, field.value);
          paintIncognito();
        });
        item.append(field, save);
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => {
        deletePending(localStorage, row.id);
        shareIds = shareIds.filter((id) => id !== row.id);
        paintIncognito();
      });
      item.append(box, text, edit, remove);
      list.append(item);
    }
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.id = 'ai-incognito-approve';
    approve.textContent = 'Approve and share';
    approve.addEventListener('click', () => {
      if (!shareIds.length) return;
      paintIncognito();
    });
    review.append(list, approve);
    if (typeof dock.paintControls === 'function') dock.paintControls();
  };
  paintIncognito();
  incognitoButton.addEventListener('click', () => {
    setIncognito(localStorage, !incognitoOn(localStorage));
    paintIncognito();
    window.dispatchEvent(new CustomEvent('lgme-incognito'));
  });
  countButton.addEventListener('click', () => {
    reviewOpen = !reviewOpen;
    paintIncognito();
  });
  window.addEventListener('lgme-incognito', paintIncognito);
  paintVoiceToggles();
  const speakAsk = dock.querySelector('#speak-ask');
  const paintSpeakAsk = () => {
    const choice = speakApproved(localStorage) ? 'yes' : (localStorage.getItem('lgme.voice.speak') === 'no' ? 'no' : '');
    speakAsk.classList.toggle('is-wait', choice === '');
    speakAsk.classList.toggle('is-yes', choice === 'yes');
    speakAsk.classList.toggle('is-no', choice === 'no');
    speakAsk.setAttribute('aria-checked', choice === 'yes' ? 'true' : 'false');
    speakAsk.setAttribute('aria-label', choice === 'yes' ? 'Speak reply? Yes' : choice === 'no' ? 'Speak reply? No' : 'Speak reply?');
    speakAsk.textContent = 'Speak';
  };
  paintSpeakAsk();
  window.addEventListener('lgme-voice-reply', paintSpeakAsk);
  speakAsk.addEventListener('click', () => {
    const on = !speakApproved(localStorage);
    try { setSpeakChoice(localStorage, on); } catch { /* the switch still moves */ }
    if (!on) stopSpeaking();
    paintSpeakAsk();
    paintVoiceToggles();
    window.dispatchEvent(new CustomEvent('lgme-voice-reply'));
  });
  dock.querySelector('#ai-voice').addEventListener('click', () => startListen());
  dock.querySelector('#ai-mic-btn').addEventListener('click', () => startListen());
  replyButton.addEventListener('click', () => {
    const next = nextVoiceReply(replyMode());
    try {
      localStorage.setItem('lgme.voice.reply', next);
      localStorage.setItem('lgme.voice.speak', next === 'speak' ? 'yes' : 'no');
    } catch { /* the label still moves */ }
    paintVoiceToggles();
    window.dispatchEvent(new CustomEvent('lgme-voice-reply'));
  });
  window.addEventListener('lgme-voice-reply', paintVoiceToggles);
  listenButton.addEventListener('click', () => {
    try { localStorage.setItem('lgme.voice.autolisten', autoListen() ? '0' : '1'); } catch { /* the toggle still moves */ }
    paintVoiceToggles();
  });
  stopButton.addEventListener('click', () => {
    stopSpeaking();
    try { hearing?.stop(); } catch { /* the mic is already quiet */ }
    mic.hidden = true;
  });
  dock.querySelector('#ai-scroll').addEventListener('scroll', markOverflow);
  const controlsButton = dock.querySelector('#ai-controls');
  const statusLine = dock.querySelector('#ai-status');
  const controlsOpen = () => {
    try { return localStorage.getItem('lgme.dock.controls') === 'open'; } catch { return false; }
  };
  dock.paintControls = () => {
    const open = controlsOpen();
    dock.classList.toggle('is-controls-shut', !open);
    controlsButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    controlsButton.textContent = open ? 'Done' : 'Controls';
    const mode = voiceReplyLabel(replyMode());
    const short = mode === 'Speak and show' ? 'Speak+show' : mode === 'Show only' ? 'Show' : 'Off';
    const live = aiOn() && localAiReady();
    const voiceMode = micBtn?.dataset.state || 'off';
    const dots = [
      ['AI', aiOn()],
      ['Voice', voiceMode],
      ['Speak', replyMode() === 'speak'],
      ['Listen', autoListen()],
      ['Incog', incognitoOn(localStorage)]
    ];
    statusLine.replaceChildren();
    for (const [name, on] of dots) {
      const item = document.createElement('span');
      if (name === 'Voice') item.className = `voice-${voiceMode}`;
      else item.className = on ? 'is-on' : 'is-off';
      if (name === 'Voice') item.dataset.voice = '1';
      item.setAttribute('aria-label', name);
      const dot = document.createElement('i');
      item.append(dot);
      statusLine.append(item);
    }
    const state = document.createElement('span');
    state.className = 'ai-state sr-only';
    state.textContent = `Online: ${navigator.onLine !== false ? 'yes' : 'no'} · AI: ${live ? 'yes' : 'no'}`;
    statusLine.append(state);
  };
  controlsButton.addEventListener('click', () => {
    try { localStorage.setItem('lgme.dock.controls', controlsOpen() ? 'shut' : 'open'); } catch { /* the row still moves */ }
    dock.paintControls();
  });
  markOverflow();
  paint(dock);
  setMicMode('off');
  dock.querySelector('#ai-expand').addEventListener('click', () => {
    const open = dock.classList.toggle('is-open');
    dock.querySelector('#ai-expand').setAttribute('aria-expanded', open ? 'true' : 'false');
    dock.querySelector('#ai-expand').textContent = open ? 'Close' : 'Open';
    if (open) showField(document.activeElement);
    else if (document.activeElement) showField(document.activeElement);
  });
  dock.querySelector('#ai-switch').addEventListener('click', () => {
    const next = !aiOn();
    try { localStorage.setItem('lgme.ai.enabled', next ? '1' : '0'); } catch { /* the switch still moves */ }
    paint(dock);
    const log = dock.querySelector('#ai-log');
    if (!next) {
      if (log) log.textContent = 'AI is off. Close and Open still move this panel. Nothing is sent.';
      hideHint();
      return;
    }
    openPanel();
    if (log) log.textContent = 'AI is on. Tap Test AI to read a reply here.';
    showField(document.activeElement);
  });
  const runSelfTest = async () => {
    openPanel();
    const line = dock.querySelector('#ai-test-line');
    const log = dock.querySelector('#ai-log');
    if (!aiOn()) {
      const off = 'AI is off. Tap AI off on this bar to turn it on, then tap Test AI.';
      if (line) { line.hidden = false; line.textContent = off; }
      if (log) log.textContent = off;
      return;
    }
    if (line) {
      line.hidden = false;
      line.textContent = 'AI test running';
    }
    if (log) log.textContent = 'AI test running. Asking what Creo is.';
    const page = pageOverview(location.pathname, location.hash, document.title);
    const result = await askServer(TEST_QUESTION, page.line);
    if (line) line.textContent = testLine(result);
    const reply = result.ok && result.text
      ? result.text
      : `No test reply. ${result.reason || 'The online guide did not answer.'} The built-in guide still works on this phone.`;
    showReply(log, reply);
    showOverview(reply, []);
    if (result.ok) {
      dock.dataset.aiSource = 'online';
      dock.dataset.aiLabel = result.label;
      try { localStorage.setItem('lgme.ai.test', '1'); } catch { /* the line still shows */ }
    }
    paint(dock);
  };
  dock.querySelector('#ai-self-test').addEventListener('click', () => { runSelfTest(); });
  if (shouldSelfTest(localStorage, location.hostname)) runSelfTest();
  dock.querySelector('#ai-accept').addEventListener('click', () => {
    if (dock.classList.contains('has-field')) {
      const words = dock.querySelector('#ai-log')?.textContent || '';
      if (words) speakGuide(words);
      return;
    }
    if (!aiOn()) return;
    const top = chips.querySelector('.ai-chip');
    if (!top) return;
    const suggestion = top.textContent;
    ask.value = suggestion;
    const matched = matchPrompt(suggestion);
    rememberUse(suggestion);
    try {
      sessionStorage.setItem('lgme.prompt.draft', JSON.stringify({ kind: matched.kind, text: matched.text }));
      localStorage.setItem('lgme.ai.accepted', suggestion);
    } catch { /* the line still shows */ }
    dock.dataset.sent = 'no';
    paint(dock);
    dock.querySelector('#ai-log').textContent = `${matched.line} Accepted on this phone. Nothing was sent.`;
  });
  window.addEventListener('online', () => paint(dock));
  window.addEventListener('offline', () => paint(dock));
  try {
    const savedTalk = sessionStorage.getItem('lgme.voice.transcript');
    if (savedTalk && !ask.value) {
      ask.value = savedTalk;
      sessionStorage.removeItem('lgme.voice.transcript');
    }
  } catch { /* the typed line stays */ }
  try {
    const savedQueue = JSON.parse(sessionStorage.getItem('lgme.step.queue') || '[]');
    if (Array.isArray(savedQueue)) stepQueue = savedQueue.filter((item) => typeof item === 'string');
    const pending = sessionStorage.getItem('lgme.step.pending');
    if (pending) {
      sessionStorage.removeItem('lgme.step.pending');
      ask.value = pending;
      stagePrompt();
    }
  } catch { /* the queue stays on this page */ }
  pickHelperSync();
  dock.dataset.ready = 'yes';
}

if (typeof document !== 'undefined') mount();
