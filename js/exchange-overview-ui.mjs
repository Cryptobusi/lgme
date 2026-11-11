import { OVERVIEW_KEY } from './exchange-overview.mjs';
import { mergeHealthExamples } from './health-examples.mjs';
import { categoryReport, personalReport, readPersonalBook } from './health-dashboard.mjs';

let viewMode = 'category';
let span = 'day';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'onClick') node.addEventListener('click', value);
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function remember(payload) {
  try { localStorage.setItem(OVERVIEW_KEY, JSON.stringify({ at: new Date().toISOString(), payload })); } catch { /* private window */ }
}

function recalled() {
  try { return JSON.parse(localStorage.getItem(OVERVIEW_KEY) || 'null'); } catch { return null; }
}

function delta(value) {
  if (!value) return 'same';
  return value > 0 ? `+${value}` : String(value);
}

function spark(buckets, stage) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 80 16');
  svg.setAttribute('class', 'spark');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${stage}. Dashed gray is test. Solid is real.`);
  const test = buckets.map((row) => row.test[stage] || 0);
  const real = buckets.map((row) => row.real[stage] || 0);
  const max = Math.max(1, ...test, ...real);
  const step = buckets.length > 1 ? 76 / (buckets.length - 1) : 76;
  const draw = (series, className) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('class', className);
    line.setAttribute('points', series.map((value, i) => `${2 + i * step},${14 - (value / max) * 12}`).join(' '));
    svg.append(line);
  };
  draw(test, 'spark-test');
  draw(real, `spark-real spark-${stage}`);
  return svg;
}

function kpi(href, label, value, note, graphic) {
  const children = [
    el('small', {}, [label]),
    el('b', {}, [value]),
    el('small', {}, [note])
  ];
  if (graphic) children.push(graphic);
  return el('a', { class: 'dash-kpi', href }, children);
}

function formatHours(value) {
  if (value == null) return '—';
  if (value < 1 / 60) return `${Math.round(value * 3600)} s`;
  if (value < 1) return `${Math.round(value * 60)} min`;
  return `${value} h`;
}

export function renderOverview(host, payload, { cachedAt = '', offline = false, personal = null, onChange = () => {} } = {}) {
  const listings = mergeHealthExamples(payload?.listings || []);
  const report = viewMode === 'personal' && personal
    ? personalReport(personal, { span })
    : categoryReport(listings, { span });
  const open = location.hash.startsWith('#overview=');
  const detailKey = decodeURIComponent(location.hash.replace(/^#overview=/, ''));
  const examples = new Set(listings.map((row) => row.item?.id).filter((id) => String(id || '').startsWith('hx-'))).size;
  const head = el('div', { class: 'dash-head' }, [
    el('h2', {}, ['Health']),
    el('div', { class: 'dash-toggle', role: 'group', 'aria-label': 'View and period' }, [
      el('button', { type: 'button', 'aria-pressed': viewMode === 'category' ? 'true' : 'false', onClick: () => { viewMode = 'category'; onChange(); } }, ['All']),
      el('button', { type: 'button', 'aria-pressed': viewMode === 'personal' ? 'true' : 'false', onClick: () => { viewMode = 'personal'; onChange(); } }, ['Mine']),
      ...['day', 'week', 'month'].map((name) => el('button', { type: 'button', 'aria-pressed': span === name ? 'true' : 'false', onClick: () => { span = name; onChange(); } }, [name]))
    ])
  ]);
  const cards = el('div', { class: 'dash-kpis' });
  if (viewMode === 'personal' && !personal) {
    cards.append(el('p', { class: 'dash-meta' }, ['Sign in on this device. Your Health record stays on this phone.']));
  } else if (viewMode === 'personal') {
    cards.append(kpi('#overview=offers', 'Offers', String(report.offers), 'device'));
    cards.append(kpi('#overview=requests', 'Requests', String(report.requests), 'device'));
    cards.append(kpi('#overview=hours', 'Hours', formatHours(report.hours), 'yours', spark(report.buckets, 'listed')));
    cards.append(kpi('#overview=receipts', 'Receipts', String(report.receipts), `${report.attestations} attest`));
    cards.append(kpi('#overview=credit', 'Credit', String(report.credit), 'device'));
  } else {
    cards.append(kpi('#overview=listed', 'List', String(report.listed.value), delta(report.listed.delta), spark(report.buckets, 'listed')));
    cards.append(kpi('#overview=matched', 'Match', String(report.matched.value), delta(report.matched.delta), spark(report.buckets, 'matched')));
    cards.append(kpi('#overview=confirmed', 'Confirm', String(report.confirmed.value), delta(report.confirmed.delta), spark(report.buckets, 'confirmed')));
    cards.append(kpi('#overview=receipt', 'Receipt', String(report.receipt.value), delta(report.receipt.delta), spark(report.buckets, 'receipt')));
    cards.append(kpi('#overview=hours', 'Hours', formatHours(report.hours), `${report.offers}/${report.requests}`));
    cards.append(kpi('#overview=usd', 'US$', `$${report.usd.toFixed(0)}`, 'public'));
    cards.append(kpi('#overview=timing', 'Time', formatHours(report.timing.listedToMatched), formatHours(report.timing.matchedToConfirmed)));
    cards.append(kpi('#overview=rates', 'Done', report.completion == null ? '—' : `${report.completion}%`, report.decline == null ? '—' : `${report.decline}%`));
  }
  const detail = el('div', { id: 'overview-detail', class: 'dash-detail' });
  if (open) {
    detail.append(el('p', {}, [`${detailKey}. Counts only. Dashed gray is test. Solid is real.`]));
    const list = el('ol', { class: 'overview-timeline' });
    const rows = viewMode === 'personal' && personal
      ? personal.sessions.map((row) => `${row.activity || 'Health'} · ${row.minutes || 0} min`)
      : report.mix.map((row) => `${row.label}: ${row.count}`);
    for (const line of rows) list.append(el('li', {}, [line]));
    if (!rows.length) list.append(el('li', {}, ['Nothing in this slice.']));
    detail.append(list);
  }
  host.replaceChildren(
    head,
    el('p', { class: 'dash-meta', id: 'overview-source' }, [
      offline ? 'Offline snapshot. ' : 'Testnet. ',
      `${examples} examples. `,
      el('a', { href: '/disclaimer' }, ['Disclaimer'])
    ]),
    cards,
    detail
  );
}

const host = document.querySelector('#exchange-overview');
if (host) mountOverview(host);

async function mountOverview(host) {
  let payload = null;
  let cachedAt = '';
  let offline = false;
  const saved = recalled();
  try {
    const response = await fetch('/api/hedera/listings', { cache: 'no-store' });
    if (response.ok) payload = await response.json();
  } catch { /* snapshot */ }
  if (!payload) {
    offline = true;
    payload = saved?.payload || { listings: [], network: 'testnet' };
    cachedAt = saved?.at || '';
  } else remember(payload);
  const draw = () => renderOverview(host, payload, {
    cachedAt,
    offline,
    personal: readPersonalBook(localStorage),
    onChange: draw
  });
  draw();
  window.addEventListener('hashchange', draw);
}
