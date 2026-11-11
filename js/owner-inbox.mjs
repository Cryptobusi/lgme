const badge = document.getElementById('owner-badge');
const list = document.getElementById('owner-list');
const status = document.getElementById('owner-status');
const form = document.getElementById('owner-gate');
let ownerToken = '';

async function review(id, action, reason) {
  await fetch('/api/versions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-lgme-admin': ownerToken },
    body: JSON.stringify({ action, id, reason })
  });
  load(ownerToken);
}

function paint(notices, openIds = new Set()) {
  badge.textContent = String(notices.length);
  let jsonMarked = false;
  let controlMarked = false;
  list.replaceChildren(...notices.map((notice) => {
    const card = document.createElement('article');
    card.className = 'card';
    const title = document.createElement('h2');
    title.textContent = notice.title;
    const meta = document.createElement('p');
    meta.textContent = `${notice.category} · ${notice.at}`;
    const link = document.createElement('a');
    link.href = notice.link;
    link.textContent = notice.kind === 'version' ? 'Open the version' : 'Open the IwanIT';
    card.append(title, meta, link);
    if (notice.versionId && openIds.has(notice.versionId)) {
      const reason = document.createElement('input');
      if (!controlMarked) reason.id = 'version-reason';
      reason.placeholder = 'Reason, optional';
      const deny = document.createElement('button');
      deny.type = 'button';
      if (!controlMarked) deny.id = 'version-deny';
      deny.textContent = 'Deny';
      deny.addEventListener('click', () => review(notice.versionId, 'deny', reason.value));
      const approve = document.createElement('button');
      approve.type = 'button';
      if (!controlMarked) approve.id = 'version-approve';
      approve.textContent = 'Approve now';
      controlMarked = true;
      approve.addEventListener('click', () => review(notice.versionId, 'approve', ''));
      card.append(reason, deny, approve);
    }
    if (notice.variant) {
      const pre = document.createElement('pre');
      if (!jsonMarked) { pre.id = 'version-json'; jsonMarked = true; }
      pre.textContent = JSON.stringify(notice.variant, null, 2);
      card.append(pre);
    }
    return card;
  }));
}

async function load(token) {
  ownerToken = token || '';
  const headers = token ? { 'x-lgme-admin': token } : {};
  const response = await fetch('/api/develop/want', { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { status.textContent = body.error || 'The inbox stayed closed.'; return; }
  let notices = Array.isArray(body.notices) ? body.notices : [];
  const openIds = new Set();
  try {
    const extra = await fetch('/api/categories?notices=1', { headers });
    const more = await extra.json();
    if (extra.ok && Array.isArray(more.notices)) notices = notices.concat(more.notices);
  } catch { /* category notices stay out */ }
  try {
    const versions = await fetch('/api/versions?notices=1', { headers });
    const versionBody = await versions.json();
    if (versions.ok && Array.isArray(versionBody.notices)) notices = notices.concat(versionBody.notices);
    for (const id of versionBody.openIds || []) openIds.add(id);
  } catch { /* version copies stay out */ }
  paint(notices, openIds);
  status.textContent = notices.length ? 'Notices are on this phone.' : 'No notices yet.';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  load(document.getElementById('owner-token').value.trim());
});

load('');
