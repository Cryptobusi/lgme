import { applyFieldOption, fieldMeta, nextHelpField, safeHelpLine } from './field-help.mjs';
import { classifyPrompt, routeLine } from './prompt-route.mjs';
import { draftWithHelper, localAiReady, pickHelperSync } from './one-tap.mjs';
import { dockChipsOf } from './variant-schema.mjs';

const FLAG = 'Only available online with AI enabled.';
const AI_CHIPS = ['Log a workout', 'Make an IdidIt receipt', 'What can I do here?'];
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
  try { return localStorage.getItem('lgme.ai.enabled') !== '0'; } catch { return true; }
}

function paint(dock) {
  const enabled = aiOn();
  const ready = enabled && localAiReady();
  const online = navigator.onLine !== false;
  const log = dock.querySelector('#ai-log');
  const flag = dock.querySelector('#ai-flag');
  const accept = dock.querySelector('#ai-accept');
  const toggle = dock.querySelector('#ai-switch');
  const live = enabled && ready;
  dock.classList.toggle('is-off', !enabled);
  toggle.classList.toggle('is-on', live);
  toggle.dataset.state = live ? 'on' : 'off';
  toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
  toggle.textContent = live ? 'AI on' : 'AI off - tap to turn on';
  const head = document.getElementById('ai-head');
  if (head) {
    head.textContent = live ? 'AI on' : 'AI off';
    head.classList.toggle('is-on', live);
  }
  dock.dataset.ai = enabled ? (ready ? 'yes' : 'no') : 'off';
  dock.dataset.online = online ? 'yes' : 'no';
  flag.hidden = !enabled || !signedIn();
  flag.textContent = `${FLAG} Online: ${online ? 'yes' : 'no'}. AI: ${ready ? 'yes' : 'no'}.`;
  if (dock.classList.contains('has-field')) return;
  if (!enabled) return;
  log.textContent = live ? 'Ask here. Nothing is sent.' : 'AI off. Tap to turn on.';
  accept.disabled = !ready;
  accept.textContent = ready ? 'Use suggestion' : 'AI off';
}

const ACTIVITIES = [
  ['treadmill', 'Treadmill'], ['walking', 'Walk'], ['walk', 'Walk'], ['running', 'Run'], ['run', 'Run'],
  ['biking', 'Bike'], ['bike', 'Bike'], ['yoga', 'Yoga'], ['swimming', 'Swim'], ['swim', 'Swim'],
  ['stretching', 'Stretch'], ['stretch', 'Stretch'], ['strength', 'Strength'], ['rowing', 'Row'], ['row', 'Row'],
  ['cycling', 'Bike'], ['hike', 'Hike'], ['lift', 'Strength'], ['dance', 'Dance'], ['pilates', 'Pilates']
];

function workoutMinutes(text) {
  const hour = text.match(/(\d+)\s*(?:hours?|hrs?|h)\b/);
  if (hour) return Number(hour[1]) * 60;
  const minute = text.match(/(\d+)\s*(?:minutes?|mins?|min|m)\b/);
  return minute ? Number(minute[1]) : 0;
}

function workoutActivity(text) {
  for (const [word, label] of ACTIVITIES) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return label;
  }
  return '';
}

export function matchPrompt(text) {
  const raw = String(text || '').trim();
  const q = raw.toLowerCase();
  if (!q) return { kind: 'help', text: '', line: 'Type log a workout, I want something, or I have something.' };
  if (/what can i do|help me|show help/.test(q)) return { kind: 'help', text: '', line: 'You can log a workout, say I want something, or say I have something.' };
  const want = raw.match(/^i want\s+(.+)/i);
  if (want) return { kind: 'iwantit', text: want[1].trim(), line: `Opened IwantIT: ${want[1].trim()}` };
  const have = raw.match(/^i have\s+(.+)/i);
  if (have) return { kind: 'ihavit', text: have[1].trim(), line: `Opened IhavIT: ${have[1].trim()}` };
  const activity = workoutActivity(q);
  const minutes = workoutMinutes(q);
  const lead = /^(log\b|did\b|i did\b|ididit\b)/.test(q);
  if (lead || activity) {
    const title = activity && minutes ? `${activity}, ${minutes} min` : (activity || 'I did the session');
    return { kind: 'ididit', text: title, title, activity, minutes, line: 'Opened the IdidIt draft.' };
  }
  return { kind: 'help', text: '', line: 'Say log a workout, I want something, or I have something.' };
}

export function stageLine(matched) {
  const label = matched.title || matched.text || 'the session';
  return `Recommend: log ${label} as an IdidIt receipt. Verify: it stays on this phone until you confirm; Health is on testnet. Explain: tap Confirm or press Send again to open the filled draft.`;
}

export function filledLine(title) {
  return `Draft filled: ${title}. Check it, then tap Confirm on the page (or press Send) to record the receipt on testnet.`;
}

function mount() {
  if (document.getElementById('ai-dock')) return;
  const dock = document.createElement('section');
  dock.id = 'ai-dock';
  dock.setAttribute('aria-label', 'On-device AI');
  dock.innerHTML = '<p class="ai-top"><button type="button" id="ai-switch" class="ai-pill" role="switch" aria-checked="true" aria-live="polite" aria-label="AI on or off">AI off - tap to turn on</button><button type="button" id="ai-voice" aria-label="Speak or type">Voice</button><button type="button" id="ai-smaller" aria-label="Smaller text">A-</button><button type="button" id="ai-larger" aria-label="Bigger text">A+</button><button type="button" id="ai-expand" aria-expanded="true">Close</button><a class="ai-setup-link" href="/ai-setup">Help</a></p><p id="app-reset-note" hidden>App updated and reset</p><p id="ai-flag" hidden></p><div id="ai-scroll"><div id="ai-chip-row"><div id="ai-chips" class="ai-chips"></div><span id="ai-chip-hint" aria-hidden="true">›</span></div><textarea id="ai-ask" rows="1" enterkeyhint="send" autocomplete="off" aria-label="Ask the helper"></textarea><pre id="ai-log"></pre><p class="ai-actions"><button type="button" id="ai-send" aria-label="Send recommends the words in the box">Send</button><button type="button" id="ai-accept" aria-label="Accept uses the top suggestion">Use suggestion</button><button type="button" id="ai-confirm" aria-label="Confirm and run">Confirm</button></p><p id="ai-more" hidden>More</p></div>';
  dock.classList.add('is-open', 'is-normal');
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
  let fieldToken = 0;
  const paintChips = (labels, field) => {
    chips.replaceChildren();
    for (const label of labels) {
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
    paintChips(rankedPrompts(dockChipsOf() || AI_CHIPS, readUses()).slice(0, 3), null);
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
    try { words = sessionStorage.getItem('lgme.prompt.note') || ''; } catch { /* the log stays */ }
    if (!words) return;
    dock.querySelector('#ai-log').textContent = words;
    try { sessionStorage.removeItem('lgme.prompt.note'); } catch { /* the log still shows */ }
  };
  const stagePrompt = () => {
    const text = ask.value.trim();
    const log = dock.querySelector('#ai-log');
    const matched = matchPrompt(text);
    staged = matched.kind === 'help' ? null : matched;
    stagedText = text;
    const route = classifyPrompt(text);
    matched.route = route;
    const detail = matched.kind === 'ididit' ? stageLine(matched) : matched.line;
    log.textContent = route.liveWrite === false
      ? `${routeLine(route, detail)} This category is In development. Nothing is written live.`
      : `${routeLine(route, detail)}`;
    if (route.alternatives.length) paintChips(route.alternatives, null);
    note(dock.querySelector('#ai-send'), 'Staged');
    markOverflow();
  };
  const executeStaged = () => {
    const log = dock.querySelector('#ai-log');
    const pageConfirm = document.getElementById('gym-ididit-confirm');
    const pageTitle = document.getElementById('gym-ididit-other');
    if (pageConfirm && pageTitle && ask.value.trim() && ask.value.trim() === pageTitle.value) {
      note(dock.querySelector('#ai-confirm'), 'Recording');
      pageConfirm.click();
      return;
    }
    if (!staged) { log.textContent = 'Confirm is waiting. Nothing ran.'; note(dock.querySelector('#ai-confirm'), 'Waiting'); markOverflow(); return; }
    const matched = staged;
    staged = null;
    stagedText = '';
    rememberUse(ask.value.trim());
    note(dock.querySelector('#ai-confirm'), 'Opening draft');
    try {
      sessionStorage.setItem('lgme.prompt.draft', JSON.stringify({
        kind: matched.kind,
        text: matched.title || matched.text,
        title: matched.title || matched.text,
        activity: matched.activity || '',
        minutes: matched.minutes || 0
      }));
    } catch { /* the line still shows */ }
    const here = location.pathname.startsWith('/gym');
    if (matched.route && matched.route.liveWrite === false) {
      location.assign(matched.route.href);
      return;
    }
    if (matched.kind === 'ididit') {
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
    if (staged && stagedText === text) executeStaged();
    else stagePrompt();
  };
  const markOverflow = () => {
    const scroller = dock.querySelector('#ai-scroll');
    const more = dock.querySelector('#ai-more');
    const over = scroller.scrollHeight > scroller.clientHeight + 8 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 4;
    scroller.classList.toggle('is-over', over);
    more.hidden = !over;
  };
  paintChips(rankedPrompts(dockChipsOf() || AI_CHIPS, readUses()).slice(0, 3), null);
  document.addEventListener('focusin', (event) => { showField(event.target); });
  document.addEventListener('focusout', () => { setTimeout(clearField, 0); });
  ask.addEventListener('pointerup', () => { ask.focus(); });
  ask.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    sendOrStage();
  });
  ask.addEventListener('input', () => { staged = null; stagedText = ''; });
  dock.querySelector('#ai-send').addEventListener('click', () => sendOrStage());
  dock.querySelector('#ai-confirm').addEventListener('click', () => executeStaged());
  window.addEventListener('lgme-draft-filled', showFilled);
  setTimeout(showFilled, 0);
  dock.querySelector('#ai-voice').addEventListener('click', () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { ask.focus(); dock.querySelector('#ai-log').textContent = 'Voice is not on this device. Typing still works.'; return; }
    const heard = new Speech();
    heard.lang = 'en-US';
    heard.onresult = (event) => { ask.value = event.results?.[0]?.[0]?.transcript || ''; stagePrompt(); };
    heard.onerror = () => { ask.focus(); };
    heard.start();
  });
  dock.querySelector('#ai-smaller').addEventListener('click', () => applySize(SIZES[Math.max(0, SIZES.indexOf(dock.classList.contains('is-tall') ? 'tall' : dock.classList.contains('is-compact') ? 'compact' : 'normal') - 1)]));
  dock.querySelector('#ai-larger').addEventListener('click', () => applySize(SIZES[Math.min(2, SIZES.indexOf(dock.classList.contains('is-tall') ? 'tall' : dock.classList.contains('is-compact') ? 'compact' : 'normal') + 1)]));
  dock.querySelector('#ai-scroll').addEventListener('scroll', markOverflow);
  markOverflow();
  paint(dock);
  dock.querySelector('#ai-expand').addEventListener('click', () => {
    const open = dock.classList.toggle('is-open');
    dock.querySelector('#ai-expand').setAttribute('aria-expanded', open ? 'true' : 'false');
    dock.querySelector('#ai-expand').textContent = open ? 'Close' : 'Open';
  });
  dock.querySelector('#ai-switch').addEventListener('click', () => {
    try {
      if (aiOn() && localAiReady()) localStorage.setItem('lgme.ai.enabled', '0');
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
    dock.querySelector('#ai-log').textContent = `${matched.line} Accepted on this phone. Nothing was sent.`;
  });
  window.addEventListener('online', () => paint(dock));
  window.addEventListener('offline', () => paint(dock));
  pickHelperSync();
}

if (typeof document !== 'undefined') mount();
