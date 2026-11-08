const KEY = 'lgme.exchange.onboardDraft';

function show(step) {
  document.querySelectorAll('#onboarding .screen').forEach((screen) => {
    screen.hidden = screen.dataset.screen !== String(step);
  });
  const dots = document.getElementById('onboard-dots');
  if (dots) dots.textContent = `${step} of 5`;
}

function readDraft() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function writeDraft(patch) {
  const next = { ...readDraft(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* the draft stays on the screen */ }
  return next;
}

function fillCard(draft) {
  const summary = document.getElementById('receipt-summary');
  if (!summary) return;
  const what = draft.what || 'Your deed';
  const who = draft.who || 'the other person';
  const circle = draft.circle || 'your circle';
  summary.textContent = `${what} with ${who}. Circle: ${circle}.`;
}

document.querySelectorAll('#onboarding [data-next]').forEach((button) => {
  button.addEventListener('click', () => show(button.dataset.next));
});

document.querySelectorAll('#circle-choices [data-circle]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('#circle-choices [data-circle]').forEach((peer) => {
      peer.setAttribute('aria-pressed', peer === button ? 'true' : 'false');
    });
    writeDraft({ circle: button.dataset.circle });
    show(3);
  });
});

document.getElementById('receipt-draft')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const photo = data.get('photo');
  const draft = writeDraft({
    what: String(data.get('what') || '').trim(),
    who: String(data.get('who') || '').trim(),
    photoName: photo && photo.name ? photo.name : ''
  });
  const params = new URLSearchParams({ group: 'campus', who: draft.who || '', what: draft.what || '' });
  const href = `/exchange?${params.toString()}#exchange`;
  const link = document.getElementById('confirm-link');
  const confirm = document.getElementById('confirm-deed');
  if (link) {
    link.href = href;
    link.textContent = href;
  }
  if (confirm) confirm.href = href;
  const qr = document.getElementById('confirm-qr');
  if (qr && globalThis.QRCode) {
    qr.replaceChildren();
    new globalThis.QRCode(qr, { text: `${location.origin}${href}`, width: 160, height: 160 });
  }
  fillCard(draft);
  show(4);
});

const saved = readDraft();
document.querySelectorAll('#circle-choices [data-circle]').forEach((button) => {
  if (button.dataset.circle === saved.circle) button.setAttribute('aria-pressed', 'true');
});
if (saved.what) {
  const what = document.getElementById('deed-what');
  const who = document.getElementById('deed-who');
  if (what) what.value = saved.what;
  if (who) who.value = saved.who || '';
  fillCard(saved);
}
show(1);
