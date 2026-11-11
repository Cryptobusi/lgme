const GROUPS = {
  campus: 'Campus',
  neighbor: 'Neighbor help',
  hosts: 'Hosts',
  circles: 'Circles',
  stories: 'Stories',
  mental: 'Mental exercise'
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function initials(name) {
  return String(name || '').split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase();
}

export async function mountSeedBoard(host, group) {
  if (!host || !GROUPS[group]) return;
  let box = host.querySelector('#seed-board');
  if (!box) {
    box = el('section', { id: 'seed-board' });
    host.append(box);
  }
  const response = await fetch('/api/hedera/listings');
  const body = await response.json().catch(() => ({}));
  const rows = (body.listings || []).filter((row) => row.item?.group === group || (row.item?.service === 'author' && (row.item?.tags || []).includes(group)));
  const authors = rows.filter((row) => row.item?.service === 'author');
  const items = rows.filter((row) => row.item?.service !== 'author' && row.item?.service !== 'example');
  box.replaceChildren(
    el('h2', {}, [`Test listings · ${GROUPS[group]}`]),
    el('p', { class: 'muted' }, ['Fictional, unclaimed, and view only until a real provider claims one on the Exchange. ', el('a', { href: '/disclaimer' }, ['Disclaimer'])]),
    ...authors.map((row) => el('article', { class: 'card', id: `seed-${row.item.id}` }, [
      el('p', { class: 'avatar', style: 'width:2.5rem;height:2.5rem;border-radius:50%;display:grid;place-items:center;background:#243024;color:#c6a15b;font-weight:700', 'aria-hidden': 'true' }, [initials(row.item.title)]),
      el('h3', {}, [row.item.title]),
      el('p', {}, [row.item.status]),
      el('p', {}, [el('a', { href: `https://hashscan.io/testnet/topic/${body.topicId}/message/${row.sequenceNumber}` }, [`Testnet message ${row.sequenceNumber}`])])
    ])),
    ...items.map((row) => el('article', { class: 'card', id: `seed-${row.item.id}` }, [
      el('h3', {}, [row.item.title]),
      el('p', {}, [row.item.summary || '']),
      el('p', {}, [`${row.item.side || 'offer'} · ${row.item.place || 'City'} · ${row.item.durationMin || 0} min · ${row.item.status}`]),
      el('p', { class: 'muted' }, [`Test author ${row.item.authorHandle || 'unassigned'}`]),
      el('p', {}, [el('a', { href: `https://hashscan.io/testnet/topic/${body.topicId}/message/${row.sequenceNumber}` }, [`Testnet message ${row.sequenceNumber}`]), ' · ', el('a', { href: '/exchange' }, ['Claim on the Exchange'])])
    ]))
  );
}

const slot = document.getElementById('seed-board');
if (slot?.dataset.group) mountSeedBoard(slot.parentElement, slot.dataset.group);
