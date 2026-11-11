import { DAO_LINE } from './variant-schema.mjs';
import { installVariant } from './customize-page.mjs';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function memberId() {
  try {
    const id = localStorage.getItem('lgme.member') || '';
    return /^[a-z0-9-]{2,32}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

function card(row, kind) {
  const node = el('article', { class: 'card', 'data-version': row.id });
  node.append(el('h2', {}, [row.name]));
  node.append(el('p', {}, [row.purpose || '']));
  node.append(el('p', {}, [`Author: ${row.authorId}`]));
  if (kind === 'proposed') {
    node.append(el('p', { class: 'version-count' }, [row.status === 'awaiting-admin' ? `${row.label}. Waiting for the administrator.` : row.label]));
    if (memberId() && memberId() !== row.authorId && row.status === 'proposed') {
      const attest = el('button', { type: 'button' }, ['Attest']);
      attest.addEventListener('click', async () => {
        const response = await fetch('/api/versions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'attest', id: row.id, memberId: memberId() })
        });
        const body = await response.json().catch(() => ({}));
        const line = node.querySelector('.version-count');
        if (line) line.textContent = body.proposal?.status === 'awaiting-admin' ? '3 of 3. Waiting for the administrator.' : (body.proposal?.label || body.error || 'Not attested.');
      });
      node.append(attest);
    }
  } else {
    const install = el('button', { type: 'button', id: 'version-install' }, ['Install']);
    install.addEventListener('click', () => {
      installVariant(row.variant);
      node.append(el('p', { id: 'version-installed' }, ['Installed on this phone. You can revert.']));
    });
    node.append(install);
    if (memberId() && memberId() === row.authorId && !row.offered) {
      const offer = el('button', { type: 'button', id: 'version-offer-health' }, ['Custom setup offered']);
      offer.addEventListener('click', async () => {
        const response = await fetch('/api/versions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'offer', id: row.id, memberId: memberId() })
        });
        if (response.ok) offer.replaceWith(el('p', {}, ['Offered on the Health board. Not written on chain.']));
      });
      node.append(offer);
    }
  }
  return node;
}

async function paint() {
  const gallery = document.getElementById('version-gallery');
  const proposed = document.getElementById('version-proposed');
  if (!gallery || !proposed) return;
  const response = await fetch('/api/versions');
  const body = await response.json().catch(() => ({}));
  const committed = Array.isArray(body.committed) ? body.committed : [];
  const open = Array.isArray(body.proposed) ? body.proposed : [];
  gallery.replaceChildren(...(committed.length ? committed.map((row) => card(row, 'committed')) : [el('p', {}, ['No committed version yet.'])]));
  proposed.replaceChildren(...(open.length ? open.map((row) => card(row, 'proposed')) : [el('p', {}, ['No proposed version yet.'])]));
  const dao = document.getElementById('dao-line');
  if (dao) dao.textContent = body.dao || DAO_LINE;
}

paint();
