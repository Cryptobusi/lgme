import { aiSetupSteps } from './ai-setup.mjs';
import { AI_ENABLE, localAiReady, pickHelperSync } from './one-tap.mjs';

const FLAG = 'Only available online with AI enabled.';

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
  if (!enabled) return;
  const guide = aiSetupSteps(navigator.userAgent);
  const lines = ready
    ? [promptFor(location.pathname), 'Tap Accept to keep this on the phone.', 'Nothing is sent until you confirm a Health step or an IwanIT.', 'You can scroll this note.', 'The helper stays on this device.']
    : [guide.steps[0] || AI_ENABLE, guide.steps[1] || 'Open How to turn AI on.', 'Tap Check again on that page.', 'Browsing stays open.', 'The helper stays on this device.'];
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
  dock.setAttribute('popover', 'manual');
  dock.innerHTML = '<p class="ai-top"><span class="ai-label">AI</span><button type="button" id="ai-switch" role="switch" aria-checked="true" aria-label="AI on or off">On</button><a class="ai-setup-link" href="/ai-setup">How to turn AI on</a></p><p id="app-reset-note" hidden>App updated and reset</p><p id="ai-flag" hidden></p><pre id="ai-log" tabindex="0"></pre><p class="ai-actions"><button type="button" id="ai-accept">Accept</button><button type="button" id="ai-expand" aria-expanded="false">Open</button></p>';
  try {
    if (localStorage.getItem('lgme.reset.note') === '1') {
      const note = dock.querySelector('#app-reset-note');
      note.hidden = false;
      localStorage.removeItem('lgme.reset.note');
    }
  } catch { /* the bar still shows */ }
  document.body.append(dock);
  const lift = () => {
    if (typeof dock.showPopover !== 'function') return;
    try {
      if (dock.matches(':popover-open')) dock.hidePopover();
      dock.showPopover();
    } catch { /* the bar stays in the page */ }
  };
  lift();
  document.addEventListener('toggle', (event) => {
    if (event.target && event.target.tagName === 'DIALOG') lift();
  }, true);
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
