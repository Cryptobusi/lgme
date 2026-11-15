import { localAiReady } from './one-tap.mjs';
import { gateDecision, nextAccess, signinAllowed } from './confirm-gate.mjs';

const root = document.getElementById('category-grid');
if (root && !document.getElementById('profile-board')) {
  const board = document.createElement('section');
  board.id = 'profile-board';
  board.setAttribute('aria-label', 'Profile');
  board.innerHTML = '<p id="profile-name">Not signed in</p><p id="profile-activity">No recent activity</p><p id="profile-balance">Balance stays on this phone</p><p id="profile-new">New 0</p><form id="first-open"><p>First open. Email, then a code. No full KYC. The keys stay on this phone.</p><label for="access-email">Email</label><input id="access-email" type="email" autocomplete="email" maxlength="120"><button type="submit" id="access-send">Send code</button><label for="access-code">Code</label><input id="access-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><button type="button" id="access-verify">Verify code</button><p id="access-member"></p><button type="button" id="ai-test">Test local AI</button><p id="ai-test-result" role="status"></p><button type="button" id="access-grant" disabled>Open the app</button><p id="access-status" role="status"></p></form>';
  const row = document.createElement('div');
  row.id = 'function-row';
  row.setAttribute('aria-label', 'Functions');
  const actions = [
    ['IdidIt (verified receipt)', '/gym#/ididit', true],
    ['Sobeit', '/lgme-coin#give', false],
    ['Inanity', '/ihelpit', false],
    ['Settings', '/gym#/more', false],
    ['IwantIT', '/gym#/', false],
    ['IhavIT', '/gym#/', false],
    ['IhelpIT', '/ihelpit', false]
  ];
  for (const [label, href, sensitive] of actions) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (sensitive) link.dataset.sensitive = '1';
    row.append(link);
  }
  const reach = document.createElement('div');
  reach.id = 'thumb-actions';
  reach.innerHTML = '<button type="button" id="thumb-confirm" class="primary">Confirm</button>';
  root.prepend(reach);
  root.prepend(row);
  root.prepend(board);

  const status = board.querySelector('#access-status');
  const form = board.querySelector('#first-open');
  let stamps = [];
  let email = '';
  let codeOk = false;
  let memberId = '';
  let aiTested = false;
  const paint = () => {
    const stage = nextAccess({ email, codeOk, memberId, aiTested, full: localStorage.getItem('lgme.access') === 'full' });
    form.hidden = stage === 'full';
    const name = board.querySelector('#profile-name');
    if (stage === 'full') name.textContent = `Member ${localStorage.getItem('lgme.member.id') || 'on this phone'}`;
  };
  try {
    const member = JSON.parse(localStorage.getItem('lgme.demo.member') || 'null');
    if (member?.emailHash && localStorage.getItem('lgme.access') === 'full') form.hidden = true;
  } catch { /* the form still shows */ }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const gate = signinAllowed(stamps);
    if (!gate.ok) { status.textContent = gate.error; return; }
    stamps = gate.stamps;
    const response = await fetch('/api/email/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: board.querySelector('#access-email').value }) });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { status.textContent = body.error || body.waiting || 'Nothing was sent.'; return; }
    email = board.querySelector('#access-email').value.trim();
    status.textContent = 'Code sent. Enter it to continue.';
  });
  board.querySelector('#access-verify').addEventListener('click', async () => {
    const response = await fetch('/api/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code: board.querySelector('#access-code').value }) });
    const body = await response.json().catch(() => ({}));
    if (!body.ok) { status.textContent = body.error || 'Code not accepted.'; return; }
    codeOk = true;
    memberId = String(body.emailHash || 'member').slice(0, 12);
    localStorage.setItem('lgme.member.id', memberId);
    board.querySelector('#access-member').textContent = `Member ID ${memberId}`;
    status.textContent = 'Member ID is set. Test the helper next.';
    paint();
  });
  board.querySelector('#ai-test').addEventListener('click', () => {
    aiTested = true;
    const on = localAiReady();
    board.querySelector('#ai-test-result').textContent = on ? 'AI on. Typing still works.' : 'AI off. Typing still works.';
    board.querySelector('#access-grant').disabled = false;
    paint();
  });
  board.querySelector('#access-grant').addEventListener('click', () => {
    if (!aiTested || !memberId) { status.textContent = 'Verify the code and test the helper first.'; return; }
    localStorage.setItem('lgme.access', 'full');
    status.textContent = 'The app is open. You confirm each action.';
    paint();
  });
  row.addEventListener('click', (event) => {
    const link = event.target.closest?.('[data-sensitive]');
    if (!link) return;
    event.preventDefault();
    const dialog = document.getElementById('confirm-gate') || document.createElement('section');
    dialog.id = 'confirm-gate';
    dialog.innerHTML = '<p>A person has to confirm. Nothing runs by itself.</p><button type="button" id="gate-passkey">Use fingerprint</button><label for="gate-totp">Authenticator code</label><input id="gate-totp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><button type="button" id="gate-totp-go">Confirm code</button><p id="gate-status" role="status"></p>';
    document.body.append(dialog);
    const finish = (decision) => {
      dialog.querySelector('#gate-status').textContent = decision.ok ? 'Confirmed by a person.' : decision.error;
      if (decision.ok) location.assign(link.href);
    };
    dialog.querySelector('#gate-passkey').onclick = () => finish(gateDecision({ human: true, method: 'passkey' }));
    dialog.querySelector('#gate-totp-go').onclick = () => finish(gateDecision({ human: true, method: 'totp', code: dialog.querySelector('#gate-totp').value }));
  });
  document.getElementById('thumb-confirm')?.addEventListener('click', () => {
    document.getElementById('ai-confirm')?.click();
  });
  paint();
}
