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

function mirrorTime(value) {
  const seconds = Number(String(value || '').split('.')[0]);
  if (!Number.isFinite(seconds) || seconds < 1_000_000_000) return 'no message yet';
  return new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
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

function chart(buckets) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 140');
  svg.setAttribute('class', 'dash-chart');
  svg.setAttribute('role', 'img');
  const stages = ['listed', 'matched', 'confirmed', 'receipt'];
  const colors = { listed: '#9A3412', matched: '#146c43', confirmed: '#1d4e89', receipt: '#6b4f2a' };
  const max = Math.max(1, ...buckets.flatMap((row) => stages.flatMap((stage) => [row.test[stage], row.real[stage]])));
  const step = buckets.length > 1 ? 300 / (buckets.length - 1) : 300;
  for (const kind of ['test', 'real']) {
    stages.forEach((stage) => {
      const points = buckets.map((row, i) => `${10 + i * step},${120 - (row[kind][stage] / max) * 100}`).join(' ');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', points);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', kind === 'test' ? '#5c574e' : colors[stage]);
      line.setAttribute('stroke-width', kind === 'test' ? '1.5' : '2.5');
      if (kind === 'test') line.setAttribute('stroke-dasharray', '4 3');
      svg.append(line);
    });
  }
  svg.setAttribute('aria-label', 'Dashed gray lines are test counts. Solid lines are real counts for listed, matched, confirmed, and receipts.');
  return svg;
}

function mixBars(mix) {
  const max = Math.max(1, ...mix.map((row) => row.count));
  const list = el('div', { class: 'dash-mix' });
  for (const row of mix) {
    list.append(el('div', { class: 'dash-mix-row' }, [
      el('span', {}, [row.label]),
      el('span', { class: 'dash-mix-track' }, [
        el('span', { class: 'dash-mix-fill', style: `width:${Math.round((row.count / max) * 100)}%` }, [])
      ]),
      el('span', {}, [String(row.count)])
    ]));
  }
  if (!mix.length) list.append(el('p', { class: 'muted' }, ['No Health activity in this snapshot.']));
  return list;
}

function kpi(href, label, value, note) {
  return el('a', { class: 'overview-tile', href }, [
    el('p', { class: 'kicker' }, [label]),
    el('p', { class: 'overview-num' }, [value]),
    el('p', { class: 'muted' }, [note])
  ]);
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
  const toggles = el('div', { class: 'dash-toggle', role: 'group', 'aria-label': 'Dashboard view' }, [
    el('button', { type: 'button', 'aria-pressed': viewMode === 'category' ? 'true' : 'false', onClick: () => { viewMode = 'category'; onChange(); } }, ['Category']),
    el('button', { type: 'button', 'aria-pressed': viewMode === 'personal' ? 'true' : 'false', onClick: () => { viewMode = 'personal'; onChange(); } }, ['Mine'])
  ]);
  const periods = el('div', { class: 'dash-toggle', role: 'group', 'aria-label': 'Time span' }, ['day', 'week', 'month'].map((name) => (
    el('button', { type: 'button', 'aria-pressed': span === name ? 'true' : 'false', onClick: () => { span = name; onChange(); } }, [name])
  )));
  const cards = el('div', { class: 'dash-kpis' });
  if (viewMode === 'personal' && !personal) {
    cards.append(el('p', {}, ['Sign in on this device to see your own Health record. It stays on this phone and is not sent.']));
  } else if (viewMode === 'personal') {
    cards.append(kpi('#overview=offers', 'Offers', String(report.offers), 'On this device'));
    cards.append(kpi('#overview=requests', 'Requests', String(report.requests), 'On this device'));
    cards.append(kpi('#overview=hours', 'Hours', formatHours(report.hours), 'Given and received'));
    cards.append(kpi('#overview=receipts', 'Receipts', String(report.receipts), `${report.attestations} attestations`));
    cards.append(kpi('#overview=credit', 'Credit', String(report.credit), 'Balance on this device'));
  } else {
    cards.append(kpi('#overview=listed', 'Listed', String(report.listed.value), `${delta(report.listed.delta)} vs prior. Test ${report.listed.test}, real ${report.listed.real}.`));
    cards.append(kpi('#overview=matched', 'Matched', String(report.matched.value), `${delta(report.matched.delta)} vs prior. Test ${report.matched.test}, real ${report.matched.real}.`));
    cards.append(kpi('#overview=confirmed', 'Confirmed', String(report.confirmed.value), `${delta(report.confirmed.delta)} vs prior.`));
    cards.append(kpi('#overview=receipt', 'IdidIt receipts', String(report.receipt.value), `${delta(report.receipt.delta)} vs prior.`));
    cards.append(kpi('#overview=hours', 'Hours', formatHours(report.hours), `Offers ${report.offers}. Requests ${report.requests}.`));
    cards.append(kpi('#overview=usd', 'US$ traded', `US$${report.usd.toFixed(2)}`, 'Only amounts on the public record.'));
    cards.append(kpi('#overview=timing', 'Listed to matched', formatHours(report.timing.listedToMatched), `Matched to confirmed ${formatHours(report.timing.matchedToConfirmed)}.`));
    cards.append(kpi('#overview=rates', 'Completion', report.completion == null ? '—' : `${report.completion}%`, `Decline or dispute ${report.decline == null ? '—' : `${report.decline}%`}.`));
  }
  const detail = el('div', { id: 'overview-detail' });
  if (open) {
    detail.append(el('h2', {}, [detailKey]));
    if (viewMode === 'category') {
      detail.append(el('p', { class: 'muted' }, ['Counts only. No names.']));
      const list = el('ol', { class: 'overview-timeline' });
      for (const row of report.mix) list.append(el('li', {}, [`${row.label}: ${row.count}`]));
      if (!report.mix.length) list.append(el('li', {}, ['Nothing in this slice.']));
      detail.append(list);
    } else if (personal) {
      detail.append(el('p', { class: 'muted' }, ['Your record on this device. It is not uploaded.']));
      const list = el('ol', { class: 'overview-timeline' });
      for (const row of personal.sessions) list.append(el('li', {}, [`${row.activity || 'Health'} · ${row.side || 'offer'} · ${row.minutes || 0} min`]));
      if (!personal.sessions.length) list.append(el('li', {}, ['No sessions saved on this device yet.']));
      detail.append(list);
    }
  }
  const when = mirrorTime(payload?.listings?.reduce((best, row) => {
    const time = Number(String(row.consensusTimestamp || '').split('.')[0]);
    return time > best ? time : best;
  }, 0) || '');
  host.replaceChildren(
    el('h2', {}, ['Health']),
    el('p', { class: 'muted', id: 'overview-source' }, [
      offline ? (cachedAt ? `Offline snapshot from ${mirrorTime(String(new Date(cachedAt).getTime() / 1000))}. ` : 'No cached snapshot on this phone yet. ') : 'Live mirror. ',
      `Last message time ${when}. Network ${payload?.network || 'testnet'}. ${new Set(listings.map((row) => row.item?.id).filter((id) => String(id || '').startsWith('hx-'))).size} test Health examples on this record. `,
      el('a', { href: '/disclaimer' }, ['Disclaimer'])
    ]),
    toggles,
    periods,
    detail,
    cards,
    viewMode === 'personal' && !personal ? el('p', {}) : chart(report.buckets),
    viewMode === 'category' ? el('p', { class: 'muted' }, ['Dashed gray is test. Solid color is real.']) : el('p', {}),
    el('h3', {}, [viewMode === 'personal' ? 'Your activities' : 'Activity mix']),
    mixBars(report.mix)
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
