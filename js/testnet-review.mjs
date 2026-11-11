const INVITE = 'testnetrev';
const KEY = 'lgme.testnet.review';

const STEPS = [
  { id: 'install', title: 'Install', text: 'Install lgme on this phone and open it from the icon.', href: '/exchange', link: 'Open Exchange' },
  { id: 'email', title: 'Email sign-in', text: 'Request a code and enter it. The code is stored only as a hash.', href: '/gym', link: 'Open Health' },
  { id: 'fee-pool', title: '$1 fee from the pool', text: 'Pay the $1 setup fee from the membership pool on testnet.', href: '/exchange', link: 'Open the fee' },
  { id: 'fee-self', title: '$1 fee self-paid', text: 'Pay the $1 setup fee yourself on testnet.', href: '/exchange', link: 'Open the fee' },
  { id: 'offer', title: 'List an offer', text: 'List one Health offer. It stays labeled test until a real claim.', href: '/exchange', link: 'List an offer' },
  { id: 'request', title: 'List a request', text: 'List one Health request.', href: '/exchange', link: 'List a request' },
  { id: 'match', title: 'Match', text: 'Match the offer and the request.', href: '/exchange', link: 'Open Exchange' },
  { id: 'trainer', title: 'Trainer confirmation', text: 'A trainer confirms the session.', href: '/gym', link: 'Open Health' },
  { id: 'confirm', title: 'Confirm', text: 'Both people confirm the session.', href: '/exchange', link: 'Open Exchange' },
  { id: 'receipt', title: 'IdidIt receipt', text: 'Write the IdidIt receipt. It is a hash, not a health note.', href: '/gym', link: 'Open Health' },
  { id: 'high', title: 'Over $100 with three attestations', text: 'Run one trade over $100. It waits until three attestations.', href: '/exchange', link: 'Open Exchange' },
  { id: 'sponsor', title: 'Sponsor someone', text: 'Sponsor one member from this phone.', href: '/gym', link: 'Open Health' },
  { id: 'dispute', title: 'Dispute', text: 'Open a dispute and leave the hash on the record.', href: '/gym', link: 'Open Health' },
  { id: 'rsvp', title: 'Circle RSVP', text: 'RSVP to a circle session.', href: '/exchange', link: 'Open Exchange' },
  { id: 'checkin', title: 'Circle check-in', text: 'Check in to that circle session.', href: '/exchange', link: 'Open Exchange' },
  { id: 'board', title: 'Personal board', text: 'Open Mine on the Health board. It stays on this phone.', href: '/exchange', link: 'Open the board' },
  { id: 'offline', title: 'Offline use', text: 'Turn the network off, open the installed app, and read the board.', href: '/exchange', link: 'Open Exchange' }
];

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function write(book) {
  localStorage.setItem(KEY, JSON.stringify(book));
}

function fileText() {
  return JSON.stringify({
    kind: 'lgme-testnet-review',
    network: 'testnet',
    at: new Date().toISOString(),
    sent: false,
    steps: read()
  }, null, 2);
}

async function exportFile() {
  const text = fileText();
  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'lgme-testnet-review.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lgme-testnet-review.json';
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  const host = document.querySelector('#review');
  const book = read();
  host.replaceChildren();
  const intro = document.createElement('p');
  intro.textContent = 'Walk each step on this phone. Pass or fail stays on this device. Nothing is sent.';
  host.append(intro);
  for (const step of STEPS) {
    const saved = book[step.id] || {};
    const card = document.createElement('article');
    const title = document.createElement('h2');
    title.textContent = step.title;
    const copy = document.createElement('p');
    copy.textContent = step.text;
    const jump = document.createElement('a');
    jump.className = 'btn';
    jump.href = step.href;
    jump.textContent = step.link;
    const row = document.createElement('div');
    row.className = 'row';
    for (const mark of ['pass', 'fail']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = mark === 'pass' ? 'Pass' : 'Fail';
      button.setAttribute('aria-pressed', saved.mark === mark ? 'true' : 'false');
      button.addEventListener('click', () => {
        const next = read();
        next[step.id] = { ...(next[step.id] || {}), mark, title: step.title };
        write(next);
        render();
      });
      row.append(button);
    }
    const note = document.createElement('textarea');
    note.maxLength = 280;
    note.placeholder = 'Optional note. It stays on this phone.';
    note.value = saved.note || '';
    note.addEventListener('change', () => {
      const next = read();
      next[step.id] = { ...(next[step.id] || {}), note: note.value.slice(0, 280), title: step.title };
      write(next);
    });
    card.append(title, copy, jump, row, note);
    host.append(card);
  }
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.id = 'export-review';
  exportButton.textContent = 'Export my results';
  exportButton.addEventListener('click', () => {
    exportFile().catch(() => {});
  });
  const foot = document.createElement('p');
  foot.className = 'muted';
  foot.textContent = 'The file is yours to keep or share. This page does not send it.';
  host.append(exportButton, foot);
}

const invite = new URLSearchParams(location.search).get('invite');
if (invite === INVITE) {
  document.querySelector('#gate').hidden = true;
  document.querySelector('#review').hidden = false;
  render();
}
