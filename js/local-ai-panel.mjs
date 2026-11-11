import { applyFieldOption, fieldMeta, nextHelpField, safeHelpLine } from './field-help.mjs';
import { draftWithHelper, localAiReady, pickHelperSync } from './one-tap.mjs';
import { dockChipsOf } from './variant-schema.mjs';

const FLAG = 'Only available online with AI enabled.';
const AI_CHIPS = ['Log a workout', 'Make an IdidIt receipt', 'What can I do here?'];

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
  accept.textContent = ready ? 'Accept' : 'AI off';
}

export function matchPrompt(text) {
  const raw = String(text || '').trim();
  const q = raw.toLowerCase();
  if (!q) return { kind: 'help', text: '', line: 'Type log a workout, I want something, or I have something.' };
  if (/what can i do|help me|show help/.test(q)) return { kind: 'help', text: '', line: 'You can log a workout, say I want something, or say I have something.' };
  if (/log a workout|ididit|i did\b/.test(q)) {
    const title = raw.replace(/^(log a workout|ididit|i did)\s*/i, '').trim() || 'I did the session';
    return { kind: 'ididit', text: title, line: 'Opened the IdidIt draft.' };
  }
  const want = raw.match(/^i want\s+(.+)/i);
  if (want) return { kind: 'iwantit', text: want[1].trim(), line: `Opened IwantIT: ${want[1].trim()}` };
  const have = raw.match(/^i have\s+(.+)/i);
  if (have) return { kind: 'ihavit', text: have[1].trim(), line: `Opened IhavIT: ${have[1].trim()}` };
  return { kind: 'help', text: '', line: 'Say log a workout, I want something, or I have something.' };
}

function mount() {
  if (document.getElementById('ai-dock')) return;
  const dock = document.createElement('section');
  dock.id = 'ai-dock';
  dock.setAttribute('aria-label', 'On-device AI');
  dock.innerHTML = '<p class="ai-top"><button type="button" id="ai-switch" class="ai-pill" role="switch" aria-checked="true" aria-live="polite" aria-label="AI on or off">AI off - tap to turn on</button><button type="button" id="ai-smaller" aria-label="Smaller text">A-</button><button type="button" id="ai-larger" aria-label="Bigger text">A+</button><button type="button" id="ai-expand" aria-expanded="true">Close</button><a class="ai-setup-link" href="/ai-setup">Help</a></p><p id="app-reset-note" hidden>App updated and reset</p><p id="ai-flag" hidden></p><div id="ai-scroll"><div id="ai-chips" class="ai-chips"></div><textarea id="ai-ask" rows="1" enterkeyhint="send" autocomplete="off" aria-label="Ask the helper"></textarea><pre id="ai-log"></pre><p class="ai-actions"><button type="button" id="ai-send">Send</button><button type="button" id="ai-accept">Accept</button></p><p id="ai-more" hidden>More</p></div>';
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
    paintChips(dockChipsOf() || AI_CHIPS, null);
    paint(dock);
  };
  const SIZES = ['compact', 'normal', 'tall'];
  const applySize = (next) => {
    const size = SIZES.includes(next) ? next : 'normal';
    dock.classList.remove('is-compact', 'is-normal', 'is-tall');
    dock.classList.add(`is-${size}`);
    try { localStorage.setItem('lgme.dock.size', size); } catch { /* the size still shows */ }
  };
  try { applySize(localStorage.getItem('lgme.dock.size') || 'normal'); } catch { applySize('normal'); }
  const runPrompt = () => {
    const text = ask.value.trim();
    const log = dock.querySelector('#ai-log');
    const matched = matchPrompt(text);
    log.textContent = matched.line;
    if (matched.kind === 'help') { markOverflow(); return; }
    try { sessionStorage.setItem('lgme.prompt.draft', JSON.stringify({ kind: matched.kind, text: matched.text })); } catch { /* the line still shows */ }
    const here = location.pathname.startsWith('/gym');
    if (matched.kind === 'ididit') {
      if (here && location.hash === '#/ididit') window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.assign('/gym#/ididit');
    } else if (here) {
      if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '/';
      window.dispatchEvent(new CustomEvent('lgme-prompt'));
    } else location.assign('/gym#/');
    markOverflow();
  };
  const markOverflow = () => {
    const scroller = dock.querySelector('#ai-scroll');
    const more = dock.querySelector('#ai-more');
    const over = scroller.scrollHeight > scroller.clientHeight + 8 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 4;
    scroller.classList.toggle('is-over', over);
    more.hidden = !over;
  };
  paintChips(dockChipsOf() || AI_CHIPS, null);
  document.addEventListener('focusin', (event) => { showField(event.target); });
  document.addEventListener('focusout', () => { setTimeout(clearField, 0); });
  ask.addEventListener('pointerup', () => { ask.focus(); });
  ask.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    runPrompt();
  });
  dock.querySelector('#ai-send').addEventListener('click', () => runPrompt());
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
    const log = dock.querySelector('#ai-log');
    log.textContent = `${log.textContent}\nAccepted on this phone. Nothing was sent.`;
    try { localStorage.setItem('lgme.ai.accepted', '1'); } catch { /* the line still shows */ }
  });
  window.addEventListener('online', () => paint(dock));
  window.addEventListener('offline', () => paint(dock));
  pickHelperSync();
}

mount();
