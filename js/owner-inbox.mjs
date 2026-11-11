const badge = document.getElementById('owner-badge');
const list = document.getElementById('owner-list');
const status = document.getElementById('owner-status');
const form = document.getElementById('owner-gate');

function paint(notices) {
  badge.textContent = String(notices.length);
  list.replaceChildren(...notices.map((notice) => {
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h2');
    title.textContent = notice.title;
    const meta = document.createElement('p');
    meta.textContent = `${notice.category} · ${notice.at}`;
    const link = document.createElement('a');
    link.href = notice.link;
    link.textContent = 'Open the IwanIT';
    card.append(title, meta, link);
    return card;
  }));
}

async function load(token) {
  const headers = token ? { 'x-lgme-admin': token } : {};
  const response = await fetch('/api/develop/want', { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { status.textContent = body.error || 'The inbox stayed closed.'; return; }
  let notices = Array.isArray(body.notices) ? body.notices : [];
  try {
    const extra = await fetch('/api/categories?notices=1', { headers });
    const more = await extra.json();
    if (extra.ok && Array.isArray(more.notices)) notices = notices.concat(more.notices);
  } catch { /* the IwanIT notices still show */ }
  paint(notices);
  status.textContent = body.notices?.length ? 'Notices are on this phone.' : 'No notices yet.';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  load(document.getElementById('owner-token').value.trim());
});

load('');
