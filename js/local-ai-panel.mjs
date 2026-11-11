import { AI_ENABLE, localAiReady, pickHelperSync } from './one-tap.mjs';

const FLAG = 'Only available online with AI enabled.';

function promptFor(path) {
  if (path.startsWith('/gym')) return 'Explain this Health step in three short lines. I confirm before anything is kept.';
  if (path.startsWith('/develop')) return 'Explain this IwanIT in three short lines. I confirm before it is posted.';
  if (path.startsWith('/exchange')) return 'Explain this listing in three short lines. Other categories stay on this device.';
  if (path.startsWith('/campus')) return 'Explain Campus in three short lines. This stays on this device.';
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

function paint(dock) {
  const ready = localAiReady();
  const online = navigator.onLine !== false;
  const log = dock.querySelector('#ai-log');
  const flag = dock.querySelector('#ai-flag');
  const accept = dock.querySelector('#ai-accept');
  const lines = ready
    ? [promptFor(location.pathname), 'Tap Accept to keep this on the phone.', 'Nothing is sent until you confirm a Health step or an IwanIT.', 'You can scroll this note.', 'The helper stays on this device.']
    : [AI_ENABLE, 'Browsing stays open.', 'Actions wait until on-device AI is on.', 'You can scroll this note.', 'The helper stays on this device.'];
  log.textContent = lines.join('\n');
  flag.hidden = !signedIn();
  flag.textContent = `${FLAG} Online: ${online ? 'yes' : 'no'}. AI: ${ready ? 'yes' : 'no'}.`;
  accept.disabled = !ready;
  accept.textContent = ready ? 'Accept' : 'AI off';
  dock.dataset.online = online ? 'yes' : 'no';
  dock.dataset.ai = ready ? 'yes' : 'no';
}

function mount() {
  if (document.getElementById('ai-dock')) return;
  const dock = document.createElement('section');
  dock.id = 'ai-dock';
  dock.setAttribute('aria-label', 'On-device AI');
  dock.innerHTML = '<p class="ai-label">AI</p><p id="ai-flag" hidden></p><pre id="ai-log" tabindex="0"></pre><p class="ai-actions"><button type="button" id="ai-accept">Accept</button><button type="button" id="ai-expand" aria-expanded="false">Open</button></p>';
  document.body.append(dock);
  paint(dock);
  dock.querySelector('#ai-expand').addEventListener('click', () => {
    const open = dock.classList.toggle('is-open');
    dock.querySelector('#ai-expand').setAttribute('aria-expanded', open ? 'true' : 'false');
    dock.querySelector('#ai-expand').textContent = open ? 'Close' : 'Open';
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
