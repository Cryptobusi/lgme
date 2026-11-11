import { CATEGORIES } from './category-help.mjs';
import { ACTIONS, countLabel, nearDuplicates } from './category-evolve.mjs';
import { listingsFor } from './category-listings.mjs';
import { readActive } from './variant-schema.mjs';
import { draftWithHelper, localAiReady, pickHelperSync } from './one-tap.mjs';

const NAME_OPTIONS = 'Night walks|Tool library|Study hour';
const LINE_OPTIONS = 'A place to trade tools|A walk group|A study hour';
const LISTING_OPTIONS = 'Meal prep|Ride share|Quiet hour';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function memberId() {
  try {
    const direct = localStorage.getItem('lgme.member') || localStorage.getItem('lgme-gym.seat') || '';
    if (/^[a-z0-9-]{2,32}$/.test(direct)) return direct;
    const demo = JSON.parse(localStorage.getItem('lgme.demo.member') || 'null');
    if (demo?.handle && /^[a-z0-9-]{2,32}$/.test(demo.handle)) return demo.handle;
  } catch { /* stay signed out */ }
  return '';
}

function aiOn() {
  try { return localStorage.getItem('lgme.ai.enabled') !== '0'; } catch { return true; }
}

function categoryOf(state) {
  const known = CATEGORIES.find((item) => item.id === state.category);
  if (known) return known;
  const row = state.proposals.find((item) => item.id === state.category);
  return { id: state.category, name: row?.name || 'Category' };
}

function ensureCss() {
  if (document.getElementById('category-board-css')) return;
  const link = document.createElement('link');
  link.id = 'category-board-css';
  link.rel = 'stylesheet';
  link.href = '/category-board.css';
  document.head.append(link);
}

export function mountCategoryBoard(root = document.getElementById('category-board')) {
  if (!root || root.dataset.ready === '1') return;
  ensureCss();
  root.dataset.ready = '1';
  const state = {
    category: root.dataset.category || 'health',
    action: '',
    detail: null,
    form: '',
    proposals: [],
    offers: [],
    message: '',
    matches: []
  };

  const paint = () => {
    const current = categoryOf(state);
    const active = readActive();
    if (active?.theme) root.dataset.theme = active.theme;
    const promoted = state.proposals.filter((row) => row.kind === 'category' && row.status === 'promoted');
    const ordered = active ? active.order.map((id) => ACTIONS.find((item) => item.id === id)).filter(Boolean) : ACTIONS;
    const actions = [
      ...ordered.map((action) => ({ ...action, name: active?.extras?.[action.id] ? `${action.name} · ${active.extras[action.id]}` : action.name })),
      ...state.proposals.filter((row) => row.kind === 'listing' && row.status === 'promoted' && row.category === current.id).map((row) => ({ id: row.id, name: row.name, aria: `${row.name}, Early / In development` }))
    ];
    const buttons = actions.map((action) => {
      const button = el('button', { type: 'button', 'aria-label': action.aria || action.name, 'aria-pressed': state.action === action.id ? 'true' : 'false' }, [action.name]);
      button.addEventListener('click', () => {
        state.action = action.id;
        state.detail = null;
        state.form = '';
        state.message = '';
        paint();
      });
      return button;
    });
    const list = el('div', { id: 'category-list', role: 'region', 'aria-label': 'Latest listings' });
    if (!state.action) {
      list.append(el('p', { class: 'category-detail' }, ['Tap an action to see the latest listings.']));
    } else if (state.detail) {
      const functional = current.id === 'health' && state.action === 'ididit';
      list.append(el('div', { class: 'category-detail' }, [
        el('h3', {}, [state.detail.title]),
        el('p', {}, [state.detail.line]),
        el('p', {}, [functional ? 'Health can record a receipt on testnet. The note stays on this phone.' : 'Browse only. Only Health is open. Nothing here is written on chain.']),
        functional ? el('a', { href: '/gym#/ididit' }, ['Record a receipt']) : el('span', {}, ['Example.']),
        el('button', { type: 'button', id: 'category-back' }, ['Back'])
      ]));
      list.querySelector('#category-back').addEventListener('click', () => { state.detail = null; paint(); });
    } else {
      const rows = listingsFor(current.id, ACTIONS.some((item) => item.id === state.action) ? state.action : 'ididit');
      for (const row of rows) {
        const button = el('button', { type: 'button', class: 'category-row' }, [row.title, el('span', {}, [`Example · ${row.at}`])]);
        button.addEventListener('click', () => { state.detail = row; paint(); });
        list.append(button);
      }
      if (current.id === 'health' && state.action === 'ihavit') {
        for (const offer of state.offers) {
          const button = el('button', { type: 'button', class: 'category-row' }, ['Custom setup offered', el('span', {}, [`${offer.name} · ${offer.authorId}`])]);
          button.addEventListener('click', () => {
            state.detail = { title: 'Custom setup offered', line: `${offer.name}. ${offer.purpose} Author: ${offer.authorId}. Not written on chain.` };
            paint();
          });
          list.append(button);
        }
      }
    }
    const more = el('button', { type: 'button', id: 'category-more' }, ['See more']);
    more.addEventListener('click', () => {
      const panel = root.querySelector('#category-list');
      if (panel) panel.scrollTop += panel.clientHeight;
    });
    const listingNew = el('button', { type: 'button', id: 'listing-create', 'aria-label': 'Create new listing' }, ['Create new listing']);
    listingNew.addEventListener('click', () => { state.form = 'listing'; state.matches = []; state.message = ''; paint(); });
    const chips = el('div', { id: 'category-chips', 'aria-label': 'Other categories' });
    const others = [
      ...CATEGORIES.filter((item) => item.id !== current.id && (!active?.chips || active.chips.includes(item.id))),
      ...promoted.filter((row) => row.name.toLowerCase() !== current.name.toLowerCase()).map((row) => ({ id: row.id, name: row.name, proposed: false, early: true })),
      ...state.proposals.filter((row) => row.kind === 'category' && row.status === 'proposed').map((row) => ({ id: row.id, name: row.name, proposed: true }))
    ];
    for (const item of others) {
      const label = item.early ? `${item.name} Early / In development` : item.proposed ? `${item.name} Proposed` : item.name;
      const button = el('button', { type: 'button' }, [label]);
      button.addEventListener('click', () => {
        if (item.proposed) {
          state.form = '';
          state.openProposal = item.id;
        } else {
          state.category = item.id;
          state.action = '';
          state.detail = null;
          state.openProposal = '';
        }
        state.message = '';
        paint();
      });
      chips.append(button);
    }
    const create = el('button', { type: 'button', id: 'category-create' }, ['Create new']);
    create.addEventListener('click', () => { state.form = 'category'; state.matches = []; state.message = ''; state.openProposal = ''; paint(); });
    chips.append(create);
    const status = el('p', { id: 'category-status', role: 'status' }, [state.message]);
    const title = el('h2', {}, [current.name]);
    const blurb = el('p', {}, [current.id === 'health' ? 'Health is open.' : 'Early / In development. Browse only.', ' ', el('a', { href: '/customize' }, ['Customize'])]);
    const actionsWrap = el('div', { class: 'category-actions' }, buttons);
    const pieces = active?.home === 'chips-first'
      ? [title, blurb, chips, actionsWrap, list, more, listingNew, status]
      : [title, blurb, actionsWrap, list, more, listingNew, status, chips];
    if (state.openProposal) pieces.push(proposalCard(state, paint));
    if (state.form) pieces.push(formCard(state, paint));
    root.replaceChildren(...pieces);
  };

  paint();
  fetch('/api/categories').then((response) => response.json()).then((body) => {
    const next = Array.isArray(body?.proposals) ? body.proposals : [];
    if (JSON.stringify(next) === JSON.stringify(state.proposals)) return;
    state.proposals = next;
    paint();
  }).catch(() => {});
  fetch('/api/versions').then((response) => response.json()).then((body) => {
    const offers = Array.isArray(body?.offers) ? body.offers : [];
    if (!offers.length) return;
    state.offers = offers;
    paint();
  }).catch(() => {});
}

function proposalCard(state, paint) {
  const row = state.proposals.find((item) => item.id === state.openProposal);
  const card = el('section', { id: 'evolve-proposal' });
  if (!row) {
    card.append(el('p', {}, ['That proposal is not on this phone yet.']));
    return card;
  }
  const who = memberId();
  card.append(el('h3', {}, [row.name]));
  card.append(el('p', {}, [row.description]));
  card.append(el('p', { id: 'evolve-count' }, [row.status === 'promoted' ? 'Early / In development' : (row.label || countLabel(row.count))]));
  if (row.status !== 'promoted' && who && who !== row.proposerId) {
    const attest = el('button', { type: 'button', id: 'evolve-attest' }, ['Attest']);
    attest.addEventListener('click', () => sendAttest(state, row.id, paint));
    card.append(attest);
  } else if (row.status !== 'promoted') {
    card.append(el('p', {}, [who ? 'You proposed this. Another member attests.' : 'Sign in on this phone to attest.']));
  }
  return card;
}

function formCard(state, paint) {
  const listing = state.form === 'listing';
  const name = el('input', {
    id: 'evolve-name',
    maxlength: '40',
    'data-help': listing ? 'A name for this new listing type. It is checked against names already in this category.' : 'A short name for this category. It is checked against names already here.',
    'data-options': listing ? LISTING_OPTIONS : NAME_OPTIONS
  });
  const line = el('input', {
    id: 'evolve-line',
    maxlength: '120',
    'data-help': 'One line on what this is for. No medical claims. It stays a proposal until 3 members attest.',
    'data-options': LINE_OPTIONS
  });
  const send = el('button', { type: 'button', id: 'evolve-send' }, ['Propose']);
  send.addEventListener('click', () => sendProposal(state, name.value, line.value, paint));
  const card = el('form', { id: 'evolve-form' }, [
    el('h3', {}, [listing ? 'New listing type' : 'New category']),
    el('label', { for: 'evolve-name' }, ['Name']),
    name,
    el('label', { for: 'evolve-line' }, ['One line']),
    line,
    send
  ]);
  card.addEventListener('submit', (event) => event.preventDefault());
  for (const match of state.matches) {
    const join = el('button', { type: 'button', class: 'evolve-join' }, [`Join ${match.name}`]);
    join.addEventListener('click', () => {
      const known = CATEGORIES.find((item) => item.name === match.name || item.id === match.id);
      if (known) state.category = known.id;
      state.form = '';
      state.matches = [];
      state.message = `Joined ${match.name}.`;
      paint();
    });
    card.append(join);
  }
  return card;
}

async function localMatches(name, rows) {
  const found = nearDuplicates(name, rows);
  if (!(aiOn() && localAiReady())) return found;
  const names = rows.map((row) => row.name).join(', ');
  const result = await draftWithHelper(pickHelperSync(), {
    template: name,
    prompt: `Reply with one existing name from this list if it is the same idea, or the word unique. No medical advice. Candidate: ${name}. Existing: ${names}`,
    scope: window
  }).catch(() => ({ text: '' }));
  const text = String(result?.text || '').toLowerCase();
  if (/\b(diagnos\w*|prescription|treatment|cure)\b/.test(text)) return found;
  const hinted = rows.filter((row) => text.includes(String(row.name).toLowerCase()));
  return [...found, ...hinted.filter((row) => !found.some((item) => item.name === row.name))];
}

async function sendProposal(state, name, description, paint) {
  const current = categoryOf(state);
  const kind = state.form === 'listing' ? 'listing' : 'category';
  const existing = kind === 'listing'
    ? [...ACTIONS.map((item) => ({ name: item.name, id: item.id })), ...state.proposals.filter((row) => row.kind === 'listing' && row.category === current.id)]
    : [...CATEGORIES.map((item) => ({ name: item.name, id: item.id })), ...state.proposals.filter((row) => row.kind === 'category')];
  const local = await localMatches(name, existing);
  if (local.length) {
    state.matches = local;
    state.message = 'That is close to an existing one. Join it instead.';
    paint();
    return;
  }
  const who = memberId();
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'propose', kind, name, description, category: current.id, memberId: who })
  });
  const body = await response.json().catch(() => ({}));
  if (Array.isArray(body.matches) && body.matches.length) {
    state.matches = body.matches;
    state.message = 'That is close to an existing one. Join it instead.';
    paint();
    return;
  }
  if (!response.ok || !body.proposal) {
    state.message = body.error || 'The proposal stayed on this phone.';
    paint();
    return;
  }
  state.proposals = [...state.proposals.filter((row) => row.id !== body.proposal.id), body.proposal];
  state.form = '';
  state.openProposal = body.proposal.id;
  state.message = 'Sent to the owner. Nothing was written on chain.';
  paint();
}

async function sendAttest(state, id, paint) {
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'attest', id, memberId: memberId() })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.proposal) {
    state.message = body.error || 'The attestation stayed on this phone.';
    paint();
    return;
  }
  state.proposals = state.proposals.map((row) => row.id === body.proposal.id ? body.proposal : row);
  state.message = body.promoted ? 'Early / In development. The owner was told.' : body.proposal.label;
  paint();
}

mountCategoryBoard();
