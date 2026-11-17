import { applyFieldOption, fieldMeta, nextHelpField, safeHelpLine } from './field-help.mjs';
import { classifyPrompt, routeLine } from './prompt-route.mjs';
import { activeScreen, applyMode, screenModePrompt, undoMode } from './screen-modes.mjs';
import { localFunctionFromPrompt, saveLocalFunction } from './local-functions.mjs';
import { draftWithHelper, localAiReady, pickHelperSync } from './one-tap.mjs';
import { dockChipsOf } from './variant-schema.mjs';
import { NOTICE, UNPUBLISHED, deletePending, editPending, holdPrivate, incognitoOn, installIncognitoGuard, listPending, setIncognito, shareApproved, sharePreview, voiceInputAllowed } from './incognito.mjs';
import { installPressFeedback, playTick, soundsOn } from './press-feedback.mjs';

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
  const ready = enabled && localAiReady();
  const online = navigator.onLine !== false;
  const flag = dock.querySelector('#ai-flag');
  const accept = dock.querySelector('#ai-accept');
  const toggle = dock.querySelector('#ai-switch');
  const live = enabled && ready;
  dock.classList.toggle('is-off', !enabled);
  toggle.classList.toggle('is-on', enabled);
  toggle.dataset.state = enabled ? 'on' : 'off';
  toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
  toggle.textContent = enabled ? 'AI on' : 'AI off';
  const head = document.getElementById('ai-head');
  if (head) {
    head.textContent = live ? 'AI on' : 'AI off';
    head.classList.toggle('is-on', live);
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
  if (dock.classList.contains('has-field')) return;
  if (!enabled) return;
  accept.disabled = !ready;
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
  const screen = screenModePrompt(raw);
  if (screen) return { kind: 'screen', mode: screen.mode, text: '', line: screen.line };
  const local = localFunctionFromPrompt(raw);
  if (local?.ok) return { kind: 'local', item: local.item, text: local.item.prompt, line: 'This stays on this phone. Confirm to save the shortcut. Nothing is sent.' };
  const want = raw.match(/^i want\s+(.+)/i);
  if (want) return { kind: 'iwantit', text: want[1].trim(), line: `Opened IwantIT: ${want[1].trim()}` };
  const have = raw.match(/^i have\s+(.+)/i);
  if (have) return { kind: 'ihavit', text: have[1].trim(), line: `Opened IhavIT: ${have[1].trim()}` };
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
  } catch { /* Speak and show stays the default */ }
  return 'speak';
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
  dock.innerHTML = '<p class="ai-top"><button type="button" id="ai-controls" aria-expanded="false" aria-label="Show or hide controls">Controls</button><span id="ai-status">AI off · Voice · Speak+show</span><button type="button" id="ai-switch" class="ai-pill" role="switch" aria-checked="true" aria-live="polite" aria-label="AI on or off">AI off</button><button type="button" id="ai-voice" class="ai-detail is-off" aria-pressed="false" aria-label="Voice off">Voice</button><button type="button" id="ai-voice-reply" class="ai-detail" aria-label="Voice reply, Speak and show">Reply</button><span id="ai-voice-mode" class="ai-detail">Speak+show</span><button type="button" id="ai-listen" class="ai-detail" aria-pressed="false" aria-label="Listen again after speaking">Listen</button><span id="ai-mic" hidden>Listening</span><span id="ai-speaking" hidden>Speaking</span><button type="button" id="ai-stop" hidden>Stop</button><button type="button" id="ai-smaller" class="ai-detail" aria-label="Smaller text">A-</button><button type="button" id="ai-larger" class="ai-detail" aria-label="Bigger text">A+</button><a class="ai-setup-link ai-detail" href="/ai-setup">Help</a><button type="button" id="ai-incognito" class="ai-detail" aria-pressed="false">Incognito</button><button type="button" id="ai-incognito-count" class="ai-detail">Pending 0</button><button type="button" id="ai-expand" aria-expanded="true">Close</button></p><p id="ai-incognito-notice" hidden>Incognito — stays on this phone</p><p id="app-reset-note" hidden>App updated and reset</p><p id="ai-flag" hidden></p><div id="ai-chip-row"><div id="ai-chips" class="ai-chips"></div><span id="ai-chip-hint" aria-hidden="true">›</span></div><div id="ai-scroll"><div id="ai-incognito-review" hidden></div><div id="ai-log-frame"><pre id="ai-log"></pre><div id="ai-suggestions"></div></div><p id="ai-more" hidden>More</p></div><div class="ai-compose"><div id="ai-input-frame"><textarea id="ai-ask" rows="1" enterkeyhint="send" autocomplete="off" aria-label="Ask the helper"></textarea><p id="ai-send-state" class="is-held" role="status" aria-label="Not sent. Held on this phone."><i></i></p><p class="ai-actions"><button type="button" id="ai-mic-btn" class="is-off" data-state="off" aria-pressed="false" aria-label="Microphone off"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg></button><button type="button" id="ai-send" aria-label="Send">Send</button><button type="button" id="ai-accept" aria-label="Hint">Hint</button><button type="button" id="ai-confirm" aria-label="Confirm">OK</button></p></div></div>';
  dock.classList.add('is-open', 'is-normal');
  try { document.documentElement.dataset.screen = activeScreen(localStorage); } catch { /* everyday height stays */ }
  try {
    if (localStorage.getItem('lgme.reset.note') === '1') {
      const note = dock.querySelector('#app-reset-note');
      note.hidden = false;
      localStorage.removeItem('lgme.reset.note');
    }
  } catch { /* the bar still shows */ }
  document.body.append(dock);
  const placeDock = () => {
    const overlap = dockKeyboardOffset(window.innerHeight, window.visualViewport);
    dock.style.bottom = overlap ? `${overlap}px` : '';
  };
  placeDock();
  window.visualViewport?.addEventListener('resize', placeDock);
  window.visualViewport?.addEventListener('scroll', placeDock);
  window.addEventListener('resize', placeDock);
  const ask = dock.querySelector('#ai-ask');
  const chips = dock.querySelector('#ai-chips');
  const dismissed = new Set();
  let fieldToken = 0;
  const paintSuggestions = (labels, field) => {
    const host = dock.querySelector('#ai-suggestions');
    if (!host) return;
    host.replaceChildren();
    for (const label of labels) {
      if (dismissed.has(label)) continue;
      const row = document.createElement('div');
      row.className = 'ai-suggest';
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
          const next = nextHelpField(field);
          if (next) next.focus();
          else field.focus();
          return;
        }
        ask.value = label;
        lastByVoice = false;
        dock.classList.remove('is-voice');
        dock.dataset.sent = 'no';
        stagePrompt();
      });
      no.addEventListener('click', () => {
        dismissed.add(label);
        if (stagedText === label) { staged = null; stagedText = ''; }
        row.remove();
        for (const chip of chips.querySelectorAll('.ai-chip')) {
          if (chip.textContent === label) chip.remove();
        }
      });
      const pair = document.createElement('span');
      pair.className = 'ai-yesno';
      pair.append(yes, no);
      row.append(line, pair);
      host.append(row);
    }
  };
  const paintChips = (labels, field) => {
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
          applyFieldOption(field, label);
          const next = nextHelpField(field);
          if (next) next.focus();
          else field.focus();
        });
      } else {
        chip.addEventListener('click', () => {
          ask.value = label;
          ask.focus();
        });
      }
      chips.append(chip);
    }
    paintSuggestions(labels, field);
  };
  const showField = (field) => {
    const meta = fieldMeta(field);
    if (!meta) return;
    dock.classList.add('has-field');
    const log = dock.querySelector('#ai-log');
    log.textContent = meta.help;
    paintChips(meta.options, field);
    const token = ++fieldToken;
    if (!(aiOn() && localAiReady())) return;
    draftWithHelper(pickHelperSync(), {
      template: meta.help,
      prompt: `One short sentence. No medical advice. Explain why this field is needed: ${meta.help}`,
      scope: window
    }).then((result) => {
      if (token !== fieldToken || document.activeElement !== field) return;
      log.textContent = safeHelpLine(result?.text, meta.help);
    }).catch(() => {});
  };
  const clearField = () => {
    const active = document.activeElement;
    if (active && active.closest && active.closest('#ai-dock')) return;
    if (fieldMeta(active)) return;
    fieldToken += 1;
    dock.classList.remove('has-field');
    paintChips(rankedPrompts(dockChipsOf() || AI_CHIPS, readUses()).slice(0, 5), null);
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
    node.textContent = incognitoOn(localStorage) && base ? `${base}\n${UNPUBLISHED}` : base;
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
    if (!shown.includes(log.textContent)) return;
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
    if (!SpeechOut || !speakingVoice()) return;
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
    if (!plan.openDraft) note(dock.querySelector('#ai-confirm'), 'Done');
    else {
      const side = dock.querySelector('#ai-action-status');
      if (side) side.textContent = '';
    }
    let voiceTurn = false;
    try { voiceTurn = sessionStorage.getItem('lgme.voice.turn') === '1'; } catch { /* the guide stays */ }
    if (!(plan.openDraft && voiceTurn)) log.textContent = plan.openDraft ? '' : plan.message;
    if (!plan.openDraft) {
      if (matched.kind === 'screen') applyMode(localStorage, matched.mode);
      if (matched.kind === 'local' && matched.item) saveLocalFunction(localStorage, matched.item);
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
    const here = location.pathname.startsWith('/gym');
    if (matched.route && matched.route.liveWrite === false) {
      location.assign(matched.route.href);
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
    const text = ask.value.trim();
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
  };
  const markOverflow = () => {
    const scroller = dock.querySelector('#ai-scroll');
    const more = dock.querySelector('#ai-more');
    const over = scroller.scrollHeight > scroller.clientHeight + 8 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 4;
    scroller.classList.toggle('is-over', over);
    more.hidden = !over;
  };
  paintChips(rankedPrompts(dockChipsOf() || AI_CHIPS, readUses()).slice(0, 5), null);
  document.addEventListener('focusin', (event) => { showField(event.target); });
  document.addEventListener('focusout', () => { setTimeout(clearField, 0); });
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
  dock.querySelector('#ai-confirm').addEventListener('click', () => executeStaged());
  window.addEventListener('lgme-draft-filled', showFilled);
  window.addEventListener('lgme-ididit-step', (event) => {
    const step = Number(event.detail?.step);
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
      ask.focus();
      setMicMode('off');
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
      ask.value = transcript;
      try { sessionStorage.setItem('lgme.voice.transcript', transcript); } catch { /* the field still shows it */ }
      setMicMode('done');
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
  dock.querySelector('#ai-voice').addEventListener('click', () => startListen());
  dock.querySelector('#ai-mic-btn').addEventListener('click', () => startListen());
  replyButton.addEventListener('click', () => {
    const next = nextVoiceReply(replyMode());
    try { localStorage.setItem('lgme.voice.reply', next); } catch { /* the label still moves */ }
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
  dock.querySelector('#ai-smaller').addEventListener('click', () => applySize(SIZES[Math.max(0, SIZES.indexOf(dock.classList.contains('is-tall') ? 'tall' : dock.classList.contains('is-compact') ? 'compact' : 'normal') - 1)]));
  dock.querySelector('#ai-larger').addEventListener('click', () => applySize(SIZES[Math.min(2, SIZES.indexOf(dock.classList.contains('is-tall') ? 'tall' : dock.classList.contains('is-compact') ? 'compact' : 'normal') + 1)]));
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
  });
  dock.querySelector('#ai-switch').addEventListener('click', () => {
    try {
      if (aiOn()) localStorage.setItem('lgme.ai.enabled', '0');
      else {
        localStorage.setItem('lgme.ai.enabled', '1');
        if (!localAiReady()) localStorage.setItem('lgme.localModel.ready', '1');
        localStorage.setItem('lgme.ai.helper', localAiReady() ? pickHelperSync().id : 'model');
      }
    } catch { /* the switch still moves */ }
    paint(dock);
  });
  dock.querySelector('#ai-accept').addEventListener('click', () => {
    if (!localAiReady()) return;
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
  pickHelperSync();
  dock.dataset.ready = 'yes';
}

if (typeof document !== 'undefined') mount();
