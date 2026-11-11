import { DAO_LINE, CHIP_IDS, defaultVariant, diffLines, officialName, readVariant, validateVariant } from './variant-schema.mjs';

const DRAFT = 'lgme.variant.draft';
const ACTIVE = 'lgme.variant.active';
const PREVIOUS = 'lgme.variant.previous';
const PRIVATE = 'lgme.variant.private';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (value != null) node.setAttribute(key, value);
  }
  for (const child of [].concat(...children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function memberId() {
  try {
    const id = localStorage.getItem('lgme.member') || localStorage.getItem('lgme-gym.seat') || '';
    return /^[a-z0-9-]{2,32}$/.test(id) ? id : '';
  } catch {
    return '';
  }
}

function loadDraft() {
  return readVariant(localStorage, DRAFT) || defaultVariant();
}

function saveDraft(variant) {
  localStorage.setItem(DRAFT, JSON.stringify(variant));
}

function buttonLabel(variant, id) {
  const extra = variant.extras[id] ? ` · ${variant.extras[id]}` : '';
  return `${officialName(id)}${extra}`;
}

function paintPreview(host, variant) {
  host.dataset.theme = variant.theme;
  host.replaceChildren(
    el('p', {}, [variant.home === 'chips-first' ? 'Chips first' : 'Actions first']),
    ...variant.order.map((id) => el('button', { type: 'button' }, [buttonLabel(variant, id)]))
  );
}

function paint(root) {
  const variant = loadDraft();
  const preview = el('div', { id: 'customize-preview' });
  paintPreview(preview, variant);
  const theme = el('select', { id: 'customize-theme' }, THEME_OPTIONS());
  theme.value = variant.theme;
  theme.addEventListener('change', () => { variant.theme = theme.value; saveDraft(variant); paint(root); });
  const home = el('select', { id: 'customize-home' }, [
    el('option', { value: 'actions-first' }, ['Actions first']),
    el('option', { value: 'chips-first' }, ['Chips first'])
  ]);
  home.value = variant.home;
  home.addEventListener('change', () => { variant.home = home.value; saveDraft(variant); paint(root); });
  const order = el('div', { id: 'customize-order' });
  variant.order.forEach((id, index) => {
    const up = el('button', { type: 'button', 'aria-label': `Move ${officialName(id)} up` }, ['Up']);
    up.addEventListener('click', () => {
      if (!index) return;
      const next = variant.order.slice();
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      variant.order = next;
      saveDraft(variant);
      paint(root);
    });
    order.append(el('p', {}, [officialName(id), up]));
  });
  const chips = el('div', { id: 'customize-chips' });
  for (const id of CHIP_IDS) {
    const box = el('input', { type: 'checkbox', id: `chip-${id}` });
    box.checked = variant.chips.includes(id);
    box.addEventListener('change', () => {
      variant.chips = CHIP_IDS.filter((item) => root.querySelector(`#chip-${item}`)?.checked);
      if (!variant.chips.length) variant.chips = [id];
      saveDraft(variant);
      paint(root);
    });
    chips.append(el('label', {}, [box, id]));
  }
  const extra = el('input', {
    id: 'customize-extra',
    maxlength: '40',
    value: variant.extras.ididit,
    'data-help': 'Extra words after IdidIt (verified receipt). The official name stays visible.',
    'data-options': 'on this phone|for my group'
  });
  extra.addEventListener('change', () => {
    variant.extras.ididit = extra.value.trim();
    saveDraft(variant);
    paint(root);
  });
  const dock = el('input', {
    id: 'customize-dock',
    maxlength: '40',
    value: variant.dockChips[0],
    'data-help': 'A suggestion the dock shows when no field is selected.',
    'data-options': 'Log a workout|Show my version|What can I do here?'
  });
  dock.addEventListener('change', () => {
    variant.dockChips = [dock.value.trim() || variant.dockChips[0], variant.dockChips[1], variant.dockChips[2]].filter(Boolean);
    saveDraft(variant);
  });
  const help = el('input', {
    id: 'customize-help',
    maxlength: '160',
    value: variant.fieldHelp['version-name'],
    'data-help': 'The one-line explanation for the version name field.',
    'data-options': 'A name for this version of the app. It is checked against versions already offered.'
  });
  help.addEventListener('change', () => {
    variant.fieldHelp['version-name'] = help.value.trim() || defaultVariant().fieldHelp['version-name'];
    saveDraft(variant);
  });
  const reset = el('button', { type: 'button', id: 'customize-reset' }, ['Reset']);
  reset.addEventListener('click', () => { saveDraft(defaultVariant()); paint(root); });
  const offer = el('button', { type: 'button', id: 'customize-offer' }, ['Offer this version']);
  offer.addEventListener('click', () => { root.querySelector('#customize-confirm-block').hidden = false; });
  const summary = el('ul', { id: 'customize-diff' }, diffLines(variant).map((line) => el('li', {}, [line])));
  const name = el('input', {
    id: 'version-name',
    maxlength: '40',
    'data-help': variant.fieldHelp['version-name'],
    'data-options': 'Night gold|Paper desk|Gold walk'
  });
  const purpose = el('input', {
    id: 'version-purpose',
    maxlength: '120',
    'data-help': variant.fieldHelp['version-purpose'],
    'data-options': 'A darker gold theme for night walks.|A paper look for daytime.|A quieter home screen.'
  });
  const confirm = el('button', { type: 'button', id: 'customize-confirm' }, ['Confirm']);
  confirm.addEventListener('click', () => sendOffer(root, variant, name.value, purpose.value));
  const block = el('div', { id: 'customize-confirm-block', hidden: 'hidden' }, [
    el('h2', {}, ['Offer this version']),
    summary,
    el('label', { for: 'version-name' }, ['Name']),
    name,
    el('label', { for: 'version-purpose' }, ['One line']),
    purpose,
    confirm
  ]);
  const status = el('p', { id: 'customize-status', role: 'status' }, ['']);
  const proposal = el('div', { id: 'customize-proposal' });
  root.replaceChildren(
    el('h1', {}, ['Customize']),
    el('p', {}, ['This stays on this phone until you offer it. Settings only. No code is added.']),
    el('p', {}, [DAO_LINE]),
    el('p', {}, [el('a', { href: '/versions' }, ['Versions']), ' · ', el('a', { href: '/develop' }, ['Help develop'])]),
    el('label', { for: 'customize-theme' }, ['Theme']),
    theme,
    el('label', { for: 'customize-home' }, ['Home layout']),
    home,
    el('h2', {}, ['Button order']),
    order,
    el('h2', {}, ['Category chips']),
    chips,
    el('label', { for: 'customize-extra' }, ['Words after IdidIt (verified receipt)']),
    extra,
    el('label', { for: 'customize-dock' }, ['Dock suggestion']),
    dock,
    el('label', { for: 'customize-help' }, ['Help for the version name']),
    help,
    el('h2', {}, ['Preview']),
    preview,
    reset,
    offer,
    block,
    proposal,
    status
  );
  paintPreview(root.querySelector('#customize-preview'), variant);
}

function THEME_OPTIONS() {
  return [
    el('option', { value: 'night' }, ['Night']),
    el('option', { value: 'paper' }, ['Paper']),
    el('option', { value: 'gold' }, ['Gold'])
  ];
}

async function sendOffer(root, variant, name, purpose) {
  const checked = validateVariant(variant);
  const status = root.querySelector('#customize-status');
  if (!checked.ok) { status.textContent = checked.error; return; }
  const response = await fetch('/api/versions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'propose', name, purpose, memberId: memberId(), variant: checked.variant, summary: diffLines(checked.variant) })
  });
  const body = await response.json().catch(() => ({}));
  if (Array.isArray(body.matches) && body.matches.length) {
    status.textContent = `That is close to ${body.matches[0].name}. Join that version instead.`;
    return;
  }
  if (!response.ok || !body.proposal) { status.textContent = body.error || 'The offer stayed on this phone.'; return; }
  localStorage.setItem('lgme.variant.proposal', body.proposal.id);
  status.textContent = 'Sent to the owner. Nothing was written on chain.';
  const card = root.querySelector('#customize-proposal');
  card.replaceChildren(
    el('h2', {}, [body.proposal.name]),
    el('p', {}, [body.proposal.purpose]),
    el('p', { id: 'version-count' }, [body.proposal.label])
  );
}

async function pullMine() {
  const who = memberId();
  if (!who) return;
  const response = await fetch(`/api/versions?mine=${encodeURIComponent(who)}`);
  const body = await response.json().catch(() => ({}));
  const denied = (body.mine || []).find((row) => row.id === localStorage.getItem('lgme.variant.proposal') && row.status === 'denied');
  if (!denied) return;
  localStorage.setItem(PRIVATE, JSON.stringify(denied.variant));
  localStorage.removeItem(ACTIVE);
  const status = document.getElementById('customize-status');
  if (status) status.textContent = `Denied. It stays on this phone. ${denied.deniedReason || ''} ${DAO_LINE}`;
}

const root = document.getElementById('customize-root');
if (root) {
  if (!localStorage.getItem(DRAFT)) saveDraft(defaultVariant());
  paint(root);
  pullMine();
  document.getElementById('customize-revert')?.addEventListener('click', () => {
    const previous = readVariant(localStorage, PREVIOUS);
    if (previous) localStorage.setItem(ACTIVE, JSON.stringify(previous));
    else localStorage.removeItem(ACTIVE);
    localStorage.removeItem(PREVIOUS);
    const status = document.getElementById('customize-status');
    if (status) status.textContent = 'Reverted on this phone.';
  });
}

export function installVariant(variant) {
  const current = readVariant(localStorage, ACTIVE);
  if (current) localStorage.setItem(PREVIOUS, JSON.stringify(current));
  localStorage.setItem(ACTIVE, JSON.stringify(variant));
}

