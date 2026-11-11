import { aiSetupSteps } from './ai-setup.mjs';
import { applyFieldOption, fieldLines, fieldMeta, nextHelpField, safeHelpLine } from './field-help.mjs';
import { AI_ENABLE, draftWithHelper, localAiReady, pickHelperSync } from './one-tap.mjs';
import { dockChipsOf } from './variant-schema.mjs';

const FLAG = 'Only available online with AI enabled.';
const AI_CHIPS = ['Log a workout', 'Make an IdidIt receipt', 'What can I do here?'];

export function dockKeyboardOffset(innerHeight, viewport) {
  const height = Number(viewport?.height);
  const offsetTop = Number(viewport?.offsetTop) || 0;
  if (!Number.isFinite(height)) return 0;
  return Math.max(0, Math.round(Number(innerHeight) - height - offsetTop));
}

function promptFor(path) {
  if (path.startsWith('/gym')) return 'Explain this Health step in three short lines. I confirm before anything is kept.';
  if (path.startsWith('/develop')) return 'Explain this IwanIT in three short lines. I confirm before it is posted.';
  if (path.startsWith('/exchange')) return 'Explain this Health listing in three short lines. I confirm before it is posted.';
  if (path.startsWith('/campus')) return 'Explain Campus in three short lines. Campus is in development.';
  return 'Explain the category I pick, in three short lines. I confirm before anything is kept.';
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
  dock.classList.toggle('is-off', !enabled);
  toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
  toggle.textContent = enabled ? 'On' : 'Off';
  dock.dataset.ai = enabled ? (ready ? 'yes' : 'no') : 'off';
  dock.dataset.online = online ? 'yes' : 'no';
  flag.hidden = !enabled || !signedIn();
  flag.textContent = `${FLAG} Online: ${online ? 'yes' : 'no'}. AI: ${ready ? 'yes' : 'no'}.`;
  if (dock.classList.contains('has-field')) return;
  if (!enabled) return;
  const guide = aiSetupSteps(navigator.userAgent);
  const lines = ready
    ? [promptFor(location.pathname), 'Tap Accept to keep this on the phone.', 'Nothing is sent until you confirm a Health step or an IwanIT.', 'You can scroll this note.', 'The helper stays on this device.']
    : [AI_ENABLE, guide.steps[0] || 'Open How to turn AI on.', guide.steps[1] || 'Tap Check again on that page.', 'Browsing stays open.', 'The helper stays on this device.'];
  log.textContent = lines.join('\n');
  flag.hidden = !signedIn();
  flag.textContent = `${FLAG} Online: ${online ? 'yes' : 'no'}. AI: ${ready ? 'yes' : 'no'}.`;
  accept.disabled = !ready;
  accept.textContent = ready ? 'Accept' : 'AI off';
}

function mount() {
  if (document.getElementById('ai-dock')) return;
  const dock = document.createElement('section');
  dock.id = 'ai-dock';
  dock.setAttribute('aria-label', 'On-device AI');
  dock.innerHTML = '<p class="ai-top"><span class="ai-label">AI</span><button type="button" id="ai-switch" role="switch" aria-checked="true" aria-label="AI on or off">On</button><a class="ai-setup-link" href="/ai-setup">How to turn AI on</a></p><p id="app-reset-note" hidden>App updated and reset</p><p id="ai-flag" hidden></p><div id="ai-chips" class="ai-chips"></div><textarea id="ai-ask" rows="2" enterkeyhint="send" autocomplete="off" aria-label="Ask the helper"></textarea><pre id="ai-log"></pre><p class="ai-actions"><button type="button" id="ai-accept">Accept</button><button type="button" id="ai-expand" aria-expanded="false">Open</button></p>';
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
    log.textContent = fieldLines(meta.help);
    paintChips(meta.options, field);
    const token = ++fieldToken;
    if (!(aiOn() && localAiReady())) return;
    draftWithHelper(pickHelperSync(), {
      template: meta.help,
      prompt: `One short sentence. No medical advice. Explain why this field is needed: ${meta.help}`,
      scope: window
    }).then((result) => {
      if (token !== fieldToken || document.activeElement !== field) return;
      log.textContent = fieldLines(safeHelpLine(result?.text, meta.help));
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
  paintChips(dockChipsOf() || AI_CHIPS, null);
  document.addEventListener('focusin', (event) => { showField(event.target); });
  document.addEventListener('focusout', () => { setTimeout(clearField, 0); });
  ask.addEventListener('pointerup', () => { ask.focus(); });
  paint(dock);
  dock.querySelector('#ai-expand').addEventListener('click', () => {
    const open = dock.classList.toggle('is-open');
    dock.querySelector('#ai-expand').setAttribute('aria-expanded', open ? 'true' : 'false');
    dock.querySelector('#ai-expand').textContent = open ? 'Close' : 'Open';
  });
  dock.querySelector('#ai-switch').addEventListener('click', () => {
    try { localStorage.setItem('lgme.ai.enabled', aiOn() ? '0' : '1'); } catch { /* the switch still moves */ }
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
