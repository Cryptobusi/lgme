import { DRAFT_KEY, EXAMPLE_LABEL, LISTING_EXAMPLES, exampleCounts, publicStatus, saveListingDraft } from './public-listings.mjs';

const UNIT_LABEL = {
  lgme: '$lgme, paid only if you later agree on the separate Solana wallet rail',
  'campus-credit': 'campus credit, not cash and not convertible to $lgme here',
  usd: 'USD description, not a charge by this site'
};

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function card(row) {
  return h('article', { class: 'card' }, [
    h('p', { class: 'pill', text: row.shared ? 'Public testnet listing' : EXAMPLE_LABEL }),
    h('h3', { text: row.title }),
    h('p', { text: `${row.amount} ${UNIT_LABEL[row.unit] || row.unit}` }),
    h('p', { class: 'meta', text: row.category || '' })
  ]);
}

export function mountPublicCatalog(root = document, options = {}) {
  const desk = root.querySelector?.('#public-catalog') || root.getElementById?.('public-catalog');
  if (!desk) return;
  const statusNode = desk.querySelector('#public-catalog-status');
  const listNode = desk.querySelector('#public-catalog-list');
  const exampleNode = desk.querySelector('#public-catalog-examples');
  const formNode = desk.querySelector('#public-catalog-form');
  const storage = options.storage || globalThis.localStorage;
  const counts = exampleCounts();
  exampleNode.replaceChildren(
    h('h2', { text: 'Starter examples' }),
    h('p', { class: 'muted', text: `${EXAMPLE_LABEL} ${counts.college + counts.utility + counts.goods} lines. They are not the shared catalog.` })
  );
  for (const [id, label] of [['college', 'College uses'], ['utility', 'Utility services'], ['goods', 'Goods and services']]) {
    const block = h('section', {}, [h('h3', { text: label })]);
    for (const row of LISTING_EXAMPLES.filter((item) => item.category === id)) block.append(card(row));
    exampleNode.append(block);
  }
  const title = h('input', { id: 'public-title', maxlength: '120', autocomplete: 'off' });
  const amount = h('input', { id: 'public-amount', type: 'number', min: '0', step: '0.01', inputmode: 'decimal' });
  const unit = h('select', { id: 'public-unit' }, [
    h('option', { value: 'lgme', text: '$lgme (Solana payment stays separate)' }),
    h('option', { value: 'campus-credit', text: 'Campus credit (not $lgme)' }),
    h('option', { value: 'usd', text: 'USD description' })
  ]);
  const category = h('select', { id: 'public-category' }, [
    h('option', { value: 'goods', text: 'Goods' }),
    h('option', { value: 'services', text: 'Services' }),
    h('option', { value: 'college', text: 'College' }),
    h('option', { value: 'utility', text: 'Utility' }),
    h('option', { value: 'other', text: 'Other' })
  ]);
  const consent = h('input', { id: 'public-consent', type: 'checkbox' });
  const save = h('button', { type: 'submit', disabled: true }, []);
  save.textContent = 'Save draft on this device';
  const publish = h('button', { type: 'button', id: 'public-publish', disabled: true, 'aria-disabled': 'true' }, []);
  publish.textContent = 'Publish to Hedera testnet';
  const note = h('p', { id: 'public-form-note', class: 'legend', text: 'Nothing is uploaded. Existing local books and photos stay on this device.' });
  consent.addEventListener('change', () => { save.disabled = consent.checked !== true; });
  const form = h('form', {}, [
    h('label', { for: 'public-title', text: 'Public title' }),
    title,
    h('label', { for: 'public-amount', text: 'Public amount' }),
    amount,
    h('label', { for: 'public-unit', text: 'Unit this listing accepts' }),
    unit,
    h('label', { for: 'public-category', text: 'Category' }),
    category,
    h('label', { class: 'row', for: 'public-consent' }, [
      consent,
      document.createTextNode(' I consent to publish this title and amount on Hedera testnet. The title may contain personal information. The topic history keeps it. Notes and photos are not included.')
    ]),
    h('div', { class: 'actions' }, [save, publish]),
    note
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = saveListingDraft(storage, {
      title: title.value,
      amount: amount.value === '' ? NaN : Number(amount.value),
      unit: unit.value,
      category: category.value,
      consent: consent.checked === true
    });
    note.textContent = result.ok ? 'Draft saved on this device. It is not on the shared catalog.' : result.error;
    if (!result.ok) return;
    title.value = '';
    amount.value = '';
    consent.checked = false;
    save.disabled = true;
  });
  publish.addEventListener('click', (event) => {
    event.preventDefault();
    note.textContent = 'Publishing is off. Nothing was reserved, signed, or sent.';
  });
  formNode.replaceChildren(
    h('h2', { text: 'Publish a listing' }),
    h('p', { class: 'muted', text: 'A shared listing is a Hedera testnet message. A $lgme payment, if you agree to one later, is a separate Solana wallet transfer. A campus credit is not $lgme and is not converted here. One listing uses one unit.' }),
    form
  );
  listNode.replaceChildren(h('h2', { text: 'Shared catalog' }), h('p', { class: 'empty', text: 'No testnet topic is configured. The shared catalog is empty.' }));
  if (statusNode) statusNode.textContent = `${publicStatus({}).reasons[1]} Public submission is off.`;
  const fetcher = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  if (typeof fetcher !== 'function') return { storageKey: DRAFT_KEY };
  fetcher('/api/listings/status', { headers: { accept: 'application/json' } })
    .then((response) => (response?.ok ? response.json() : null))
    .then((status) => {
      if (!statusNode) return;
      const catalog = status?.catalog === 'configured'
        ? `Read-only catalog is configured for testnet topic ${status.topic}.`
        : 'Read-only catalog is unconfigured, so there is no shared listing history.';
      statusNode.textContent = `Hedera testnet listings. Public submission is off. ${catalog} Solana $lgme payments stay on their own wallet rail.`;
    })
    .catch(() => { if (statusNode) statusNode.textContent = 'The listing status could not be read. Public submission stays off.'; });
  fetcher('/api/listings/catalog', { headers: { accept: 'application/json' } })
    .then((response) => (response?.ok ? response.json() : { status: 'error', hederaVerified: false, active: [], error: 'The shared catalog could not be read.' }))
    .then((result) => {
      if (!result?.hederaVerified || !Array.isArray(result.active) || !result.active.length) {
        const message = result?.status === 'error'
          ? (result.error || 'The testnet mirror could not be read.')
          : (result?.error || 'No testnet topic is configured. The shared catalog is empty.');
        listNode.replaceChildren(h('h2', { text: 'Shared catalog' }), h('p', { class: result?.status === 'error' ? 'bad' : 'empty', text: message }));
        return;
      }
      listNode.replaceChildren(h('h2', { text: 'Shared catalog' }), ...result.active.map(card));
    })
    .catch(() => {
      listNode.replaceChildren(h('h2', { text: 'Shared catalog' }), h('p', { class: 'bad', text: 'The testnet mirror could not be reached.' }));
    });
  return { storageKey: DRAFT_KEY };
}

if (typeof document !== 'undefined' && document.getElementById('public-catalog')) mountPublicCatalog(document);
