import { OVERVIEW_KEY, rowsFor, tallyExchange } from './exchange-overview.mjs';

const LABELS = {
  health: 'Health',
  mental: 'Mental exercise',
  campus: 'Campus',
  neighbor: 'Neighbor help',
  hosts: 'Hosts',
  circles: 'Circles',
  stories: 'Stories',
  other: 'Other'
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

function bars(parts) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 18');
  svg.setAttribute('class', 'overview-bars');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', parts.map((part) => `${part.label} ${part.value}`).join(', '));
  let x = 0;
  const width = total > 0 ? 120 : 0;
  for (const part of parts) {
    const span = total > 0 ? (part.value / total) * width : 0;
    if (span <= 0) continue;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', '4');
    rect.setAttribute('width', String(Math.max(span, 1)));
    rect.setAttribute('height', '10');
    rect.setAttribute('class', part.className || '');
    svg.append(rect);
    x += span;
  }
  if (total === 0) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '4');
    rect.setAttribute('width', '120');
    rect.setAttribute('height', '10');
    rect.setAttribute('fill', 'currentColor');
    rect.setAttribute('opacity', '0.2');
    svg.append(rect);
  }
  return svg;
}

function mirrorTime(value) {
  const seconds = Number(String(value || '').split('.')[0]);
  if (!Number.isFinite(seconds)) return 'no message yet';
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return 'no message yet';
  return date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

const TITLES = {
  ...LABELS,
  pool: 'Membership pool',
  setup: 'Setup receivables',
  repair: 'Repair Extraordinaire',
  developers: 'Developer team',
  'hosts-interest': 'Host interest',
  examples: 'Example transactions',
  'flow-listed': 'Listed',
  'flow-matched': 'Matched',
  'flow-confirmed': 'Confirmed',
  'flow-receipt': 'IdidIt receipt'
};

function tile(href, kicker, value, note, chart) {
  const children = [
    el('p', { class: 'kicker' }, [kicker]),
    el('p', { class: 'overview-num' }, [String(value)]),
    el('p', { class: 'muted' }, [note])
  ];
  if (chart) children.push(chart);
  return el('a', { class: 'overview-tile', href }, children);
}

function remember(payload, repair) {
  try {
    localStorage.setItem(OVERVIEW_KEY, JSON.stringify({ at: new Date().toISOString(), payload, repair }));
  } catch { /* a private window still shows the live numbers */ }
}

function repairCounts(repair) {
  if (!repair) return null;
  return { items: (repair.items || []).map((row) => ({ status: row.status || 'unknown' })) };
}

function recalled() {
  try { return JSON.parse(localStorage.getItem(OVERVIEW_KEY) || 'null'); } catch { return null; }
}

export function renderOverview(host, payload, { cachedAt = '', offline = false, repair = null } = {}) {
  const view = tallyExchange(payload);
  const detailKey = decodeURIComponent(location.hash.replace(/^#overview=/, ''));
  const open = location.hash.startsWith('#overview=');
  const grid = el('div', { class: 'overview-grid' });
  const order = ['health', 'mental', 'campus', 'neighbor', 'hosts', 'circles', 'stories', 'other'];
  const names = Object.keys(view.groups).sort((a, b) => {
    const rank = (name) => { const index = order.indexOf(name); return index === -1 ? order.length : index; };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  for (const name of names) {
    const bucket = view.groups[name];
    grid.append(tile(
      `#overview=${encodeURIComponent(name)}`,
      LABELS[name] || name,
      bucket.offers + bucket.requests,
      `${bucket.offers} offers · ${bucket.requests} requests · ${bucket.testUnclaimed} test unclaimed · ${bucket.claimed} claimed test · ${bucket.real} real`,
      bars([
        { label: 'test unclaimed', value: bucket.testUnclaimed, className: 'bar-test' },
        { label: 'claimed test', value: bucket.claimed, className: 'bar-claimed' },
        { label: 'real', value: bucket.real, className: 'bar-real' }
      ])
    ));
  }
  const flow = el('div', { class: 'overview-flow' });
  for (const step of [
    ['listed', '1 Listed', view.flow.listed],
    ['matched', '2 Matched', view.flow.matched],
    ['confirmed', '3 Confirmed', view.flow.confirmed],
    ['receipt', '4 IdidIt receipt', view.flow.receipt]
  ]) {
    flow.append(el('a', { href: `#overview=flow-${step[0]}` }, [
      el('span', { class: 'overview-num' }, [String(step[2])]),
      el('span', {}, [step[1]])
    ]));
  }
  const pool = view.pool;
  const extras = el('div', { class: 'overview-grid' });
  extras.append(tile('#overview=pool', 'Membership pool', pool ? `US$${Number(pool.inUsd || 0).toFixed(2)} in` : 'US$0.00 in', pool ? `Out US$${Number(pool.outUsd || 0).toFixed(2)}. Covers ${pool.covers || 0}. Sponsor offers waiting ${pool.offers || 0}.` : 'No pool total in this snapshot.'));
  const setupUsd = view.setup.usd > 0 ? ` US$${view.setup.usd.toFixed(2)} still due.` : '';
  extras.append(tile('#overview=setup', 'Setup receivables', view.setup.due + view.setup.paid, `${view.setup.due} due · ${view.setup.paid} paid.${setupUsd} Totals only.`));
  const repairCounts = {};
  for (const row of repair?.items || []) repairCounts[row.status] = (repairCounts[row.status] || 0) + 1;
  const repairNote = repair ? Object.entries(repairCounts).map(([status, count]) => `${status} ${count}`).join(' · ') || 'No repair follow-through yet.' : 'Repair follow-through did not answer.';
  extras.append(tile('#overview=repair', 'Repair Extraordinaire', (repair?.items || []).length, repairNote));
  extras.append(tile('#overview=developers', 'Developer team', view.developers, 'Pending review. No names in this count.'));
  extras.append(tile('#overview=hosts-interest', 'Host interest', view.hosts, 'Pending review. No names in this count.'));
  extras.append(tile('#overview=examples', 'Example transactions', view.examples.length, 'Test, until a real actor claims the role.'));
  const when = mirrorTime(view.latest?.time);
  const stamp = el('p', { class: 'muted', id: 'overview-source' }, [
    offline
      ? (cachedAt ? `Offline snapshot from ${mirrorTime(String(new Date(cachedAt).getTime() / 1000))}. ` : 'No cached snapshot on this phone yet. ')
      : 'Live mirror. ',
    `Last message ${view.latest ? view.latest.sequence : 'none'} at ${when}. Network ${view.network || 'unknown'}. `,
    el('a', { href: '/disclaimer' }, ['Disclaimer'])
  ]);
  const detail = el('div', { id: 'overview-detail' });
  if (open) {
    if (detailKey === 'repair') {
      detail.append(el('h2', {}, ['Repair Extraordinaire']));
      detail.append(el('p', {}, [repairNote]));
    } else {
      const rows = rowsFor(payload, detailKey);
      detail.append(el('h2', {}, [TITLES[detailKey] || detailKey]));
      detail.append(el('p', { class: 'muted' }, [`${rows.length} on this mirror snapshot. Counts only. No ranking.`]));
      const list = el('ol', { class: 'overview-timeline' });
      for (const row of rows) {
        const item = row.item || {};
        list.append(el('li', {}, [
          el('a', { href: `https://hashscan.io/testnet/topic/${view.topicId}/message/${row.sequenceNumber}` }, [`Message ${row.sequenceNumber}`]),
          ` · ${detailKey === 'setup' || detailKey === 'developers' || detailKey === 'hosts-interest' ? (item.offer || item.kind || 'record') : (item.title || item.id || item.kind)} · ${String(item.status || item.kind || '').replace(/^Claimed by .+$/, 'Claimed')}${item.kind === 'pool' ? ` · in US$${Number(item.inUsd || 0).toFixed(2)} out US$${Number(item.outUsd || 0).toFixed(2)}` : ''}${item.kind === 'receivable' || item.kind === 'receivable-paid' ? ` · US$${Number(item.usd || 0).toFixed(2)}` : ''}${item.receiptHash ? ` · receipt ${String(item.receiptHash).slice(0, 12)}` : ''}`
        ]));
      }
      if (!rows.length) list.append(el('li', {}, ['Nothing in this slice of the mirror.']));
      detail.append(list);
    }
  }
  host.replaceChildren(
    el('h2', {}, ['Exchange status']),
    stamp,
    detail,
    flow,
    grid,
    extras
  );
}

const host = document.querySelector('#exchange-overview');
if (host) mountOverview(host);

async function mountOverview(host) {
  let payload = null;
  let cachedAt = '';
  let offline = false;
  let repair = null;
  const saved = recalled();
  try {
    const response = await fetch('/api/hedera/listings', { cache: 'no-store' });
    if (response.ok) payload = await response.json();
  } catch { /* use the last snapshot */ }
  if (!payload) {
    offline = true;
    payload = saved?.payload || { listings: [], network: 'testnet' };
    repair = saved?.repair || null;
    cachedAt = saved?.at || '';
  } else {
    try {
      const response = await fetch('/api/exchange/repair', { cache: 'no-store' });
      if (response.ok) repair = repairCounts(await response.json());
    } catch { /* the card says the follow-through did not answer */ }
    remember(payload, repair || saved?.repair || null);
  }
  const draw = () => renderOverview(host, payload, { cachedAt, offline, repair });
  draw();
  window.addEventListener('hashchange', draw);
}
