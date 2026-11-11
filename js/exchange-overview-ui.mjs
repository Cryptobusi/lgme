import { OVERVIEW_KEY, tallyExchange } from './exchange-overview.mjs';
import { mergeHealthExamples } from './health-examples.mjs';

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

function remember(payload) {
  try {
    localStorage.setItem(OVERVIEW_KEY, JSON.stringify({ at: new Date().toISOString(), payload }));
  } catch { /* a private window still shows the live numbers */ }
}

function recalled() {
  try { return JSON.parse(localStorage.getItem(OVERVIEW_KEY) || 'null'); } catch { return null; }
}

function countLine(health) {
  return [
    `${health.testOffers} test offers`,
    `${health.realOffers} real offers`,
    `${health.testRequests} test requests`,
    `${health.realRequests} real requests`,
    `${health.testClaimed} test claimed`,
    `${health.realClaimed} real claimed`,
    `${health.testFinished} test finished`,
    `${health.realFinished} real finished`
  ].join(' · ');
}

export function renderOverview(host, payload, { cachedAt = '', offline = false } = {}) {
  const view = tallyExchange({ ...payload, listings: mergeHealthExamples(payload?.listings || []) });
  const health = view.health;
  const total = health.testOffers + health.realOffers + health.testRequests + health.realRequests;
  const open = location.hash.startsWith('#overview=');
  const detailKey = decodeURIComponent(location.hash.replace(/^#overview=/, ''));
  const tile = el('a', { class: 'overview-tile', href: '#overview=health' }, [
    el('p', { class: 'kicker' }, ['Health']),
    el('p', { class: 'overview-num' }, [String(total)]),
    el('p', { class: 'muted' }, [countLine(health)]),
    bars([
      { label: 'test', value: health.testOffers + health.testRequests, className: 'bar-test' },
      { label: 'real', value: health.realOffers + health.realRequests, className: 'bar-real' }
    ])
  ]);
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
  const when = mirrorTime(view.latest?.time);
  const stamp = el('p', { class: 'muted', id: 'overview-source' }, [
    offline
      ? (cachedAt ? `Offline snapshot from ${mirrorTime(String(new Date(cachedAt).getTime() / 1000))}. ` : 'No cached snapshot on this phone yet. ')
      : 'Live mirror. ',
    `Last message ${view.latest ? view.latest.sequence : 'none'} at ${when}. Network ${view.network || 'unknown'}. Counts only. Health details stay off this board. `,
    el('a', { href: '/disclaimer' }, ['Disclaimer'])
  ]);
  const detail = el('div', { id: 'overview-detail' });
  if (open) {
    const titles = {
      health: 'Health',
      'flow-listed': 'Listed',
      'flow-matched': 'Matched',
      'flow-confirmed': 'Confirmed',
      'flow-receipt': 'IdidIt receipt'
    };
    detail.append(el('h2', {}, [titles[detailKey] || 'Health']));
    detail.append(el('p', {}, [countLine(health)]));
    detail.append(el('p', { class: 'muted' }, [`Listed ${view.flow.listed}. Matched ${view.flow.matched}. Confirmed ${view.flow.confirmed}. IdidIt receipt ${view.flow.receipt}. Counts only. No names and no health notes.`]));
  }
  host.replaceChildren(
    el('h2', {}, ['Exchange status']),
    stamp,
    detail,
    flow,
    el('div', { class: 'overview-grid' }, [tile])
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
  } catch { /* use the last snapshot */ }
  if (!payload) {
    offline = true;
    payload = saved?.payload || { listings: [], network: 'testnet' };
    cachedAt = saved?.at || '';
  } else remember(payload);
  const draw = () => renderOverview(host, payload, { cachedAt, offline });
  draw();
  window.addEventListener('hashchange', draw);
}
