const list = document.getElementById('dev-board-list');
if (list) {
  const response = await fetch('/api/develop/want?board=1');
  const body = await response.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('li');
    empty.id = 'dev-board-empty';
    empty.textContent = 'No IwanIT yet.';
    list.append(empty);
  }
  for (const item of items) {
    const row = document.createElement('li');
    row.className = 'dev-board-item';
    row.textContent = `${item.label || 'In development'} · ${item.target || 'Health'} · ${item.title || 'IwanIT'}`;
    list.append(row);
  }
}
