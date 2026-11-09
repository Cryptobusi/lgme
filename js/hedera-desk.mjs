import {
  EXCHANGE_EXAMPLES,
  EXAMPLE_LABEL,
  LOCAL_LABEL,
  LOCAL_PROPOSAL_KEY,
  matchByQuery,
  publicStatus,
  readLocalProposals,
  recommendedSearches,
  saveLocalProposal
} from './hedera-exchange.mjs';

const CATEGORIES = [
  ['college', 'College uses'],
  ['utility', 'Utility services'],
  ['goods', 'Goods and services']
];

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function proposalCard(row) {
  return h('article', { class: 'card' }, [
    h('p', { class: 'pill', text: row.label || LOCAL_LABEL }),
    h('h3', { text: row.title }),
    h('p', { text: `${row.amount} ${row.unit}` }),
    row.category ? h('p', { class: 'meta', text: row.category }) : null
  ]);
}

function renderExamples(host, query) {
  host.replaceChildren();
  host.append(h('h2', { text: 'Starter examples' }));
  host.append(h('p', { class: 'muted', text: `${EXAMPLE_LABEL} These 36 lines are not consensus records and are not submitted.` }));
  const matched = matchByQuery(EXCHANGE_EXAMPLES, query);
  for (const [id, label] of CATEGORIES) {
    const rows = matched.filter((row) => row.category === id);
    const block = h('section', {}, [h('h3', { text: label })]);
    if (!rows.length) block.append(h('p', { class: 'empty', text: 'No examples match this search.' }));
    else block.append(...rows.map(proposalCard));
    host.append(block);
  }
}

function renderProposals(host, proposals, query) {
  const saved = host.querySelector('[data-saved]');
  if (!saved) return;
  const rows = matchByQuery(proposals, query);
  saved.replaceChildren(h('h3', { text: 'Proposals on this device' }));
  saved.append(h('p', { class: 'legend', text: LOCAL_LABEL }));
  if (!rows.length) saved.append(h('p', { class: 'empty', text: proposals.length ? 'No saved proposals match this search.' : 'No proposal is saved on this device.' }));
  else saved.append(...rows.map(proposalCard));
}

function renderHistory(host, result) {
  host.replaceChildren();
  host.append(h('h2', { text: 'Public testnet history' }));
  if (!result || result.status === 'unconfigured') {
    host.append(h('p', { class: 'empty', text: result?.error || 'No testnet topic is configured. Public history is empty.' }));
    return;
  }
  if (result.status === 'error') {
    host.append(h('p', { class: 'bad', text: result.error || 'The testnet mirror could not be read.' }));
    return;
  }
  if (!result.messages?.length) {
    host.append(h('p', { class: 'empty', text: 'The configured testnet topic has no messages on this page.' }));
    return;
  }
  for (const row of result.messages) {
    const title = row.sharedProposalHistory ? `${row.title} · ${row.amount} USD` : row.note;
    host.append(h('article', { class: 'card' }, [
      h('p', { class: 'pill', text: row.capability }),
      h('h3', { text: title }),
      h('p', { class: 'legend', text: row.note }),
      h('p', { class: 'meta', text: `Sequence ${row.sequence ?? 'unknown'} · ${row.consensusTimestamp || 'no timestamp'}` })
    ]));
  }
}

function statusLine(status) {
  if (!status) return 'The exchange status could not be read. Public submissions stay off.';
  const history = status.history === 'configured'
    ? `Read-only history is configured for testnet topic ${status.topic}.`
    : 'Read-only history is unconfigured, so this page shows an empty public record.';
  return `Hedera ${status.network === 'testnet' ? 'testnet' : 'status unconfigured'}. Public submissions are off. ${history}`;
}

export function mountHederaDesk(root = document, options = {}) {
  const desk = root.getElementById?.('hedera-desk') || root.querySelector?.('#hedera-desk');
  if (!desk) return;
  const statusNode = desk.querySelector('#hedera-status');
  const historyNode = desk.querySelector('#hedera-history');
  const proposalNode = desk.querySelector('#hedera-proposals');
  const exampleNode = desk.querySelector('#hedera-examples');
  const storage = options.storage || globalThis.localStorage;
  let proposals = readLocalProposals(storage);
  let query = '';

  const search = h('input', { id: 'hedera-search', type: 'search', placeholder: 'Search examples and saved proposals' });
  const recommendations = h('div', { id: 'hedera-recommendations' });
  const title = h('input', { id: 'hedera-title', maxlength: '120', autocomplete: 'off' });
  const amount = h('input', { id: 'hedera-amount', type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal' });
  const consent = h('input', { id: 'hedera-consent', type: 'checkbox' });
  const save = h('button', { type: 'submit', class: 'primary', disabled: 'disabled' }, []);
  save.textContent = 'Save on this device';
  const submit = h('button', { type: 'button', id: 'hedera-submit', disabled: 'disabled' }, []);
  submit.textContent = 'Submit to Hedera testnet';
  submit.setAttribute('aria-disabled', 'true');
  const note = h('p', { id: 'hedera-form-note', class: 'legend', text: 'Nothing is uploaded. Notes, contact, proof, and identity are not on this form.' });
  submit.addEventListener('click', (event) => {
    event.preventDefault();
    note.textContent = 'Public submissions are off. Nothing was signed or sent.';
  });

  function paint() {
    recommendations.replaceChildren();
    const suggested = recommendedSearches(title.value);
    if (suggested.queries.length) {
      recommendations.append(h('p', { class: 'legend', text: suggested.label }));
      for (const item of suggested.queries) {
        const button = h('button', { type: 'button' }, []);
        button.textContent = item;
        button.addEventListener('click', () => {
          query = item;
          search.value = item;
          paint();
        });
        recommendations.append(button);
      }
    }
    renderProposals(proposalNode, proposals, query);
    renderExamples(exampleNode, query);
  }

  search.addEventListener('input', () => {
    query = search.value;
    paint();
  });
  title.addEventListener('input', paint);
  consent.addEventListener('change', () => {
    if (consent.checked) save.removeAttribute('disabled');
    else save.setAttribute('disabled', 'disabled');
  });

  const form = h('form', { id: 'hedera-local-form' }, [
    h('label', { for: 'hedera-title', text: 'Public title' }),
    title,
    h('label', { for: 'hedera-amount', text: 'Public amount in USD' }),
    amount,
    h('label', { class: 'row', for: 'hedera-consent' }, [consent, document.createTextNode(' I consent to treat this title and amount as public if submissions are later turned on. The title may contain personal information. This save stays on this device.')]),
    h('div', { class: 'actions' }, [save, submit]),
    note,
    recommendations
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = saveLocalProposal(storage, {
      title: title.value,
      amount: amount.value === '' ? NaN : Number(amount.value),
      unit: 'USD',
      consent: consent.checked === true
    });
    note.textContent = result.ok ? LOCAL_LABEL : result.error;
    if (!result.ok) return;
    proposals = readLocalProposals(storage);
    title.value = '';
    amount.value = '';
    consent.checked = false;
    save.setAttribute('disabled', 'disabled');
    paint();
  });

  proposalNode.replaceChildren(
    h('h2', { text: 'Your proposals' }),
    h('p', { class: 'muted', text: 'A proposal saved here is not sent to Hedera, and existing notebook lines are not uploaded.' }),
    search,
    form,
    h('div', { 'data-saved': 'true' })
  );
  paint();
  renderHistory(historyNode, { status: 'unconfigured', error: 'No testnet topic is configured. Public history is empty.' });

  const fetcher = options.fetchImpl || globalThis.fetch?.bind(globalThis);
  const envUrl = options.statusUrl || '/api/exchange/status';
  const historyUrl = options.historyUrl || '/api/exchange/history';
  if (typeof fetcher !== 'function') {
    if (statusNode) statusNode.textContent = statusLine(publicStatus({}));
    return { storageKey: LOCAL_PROPOSAL_KEY };
  }
  fetcher(envUrl, { headers: { accept: 'application/json' } })
    .then((response) => (response?.ok ? response.json() : null))
    .then((status) => {
      if (statusNode) statusNode.textContent = statusLine(status);
    })
    .catch(() => {
      if (statusNode) statusNode.textContent = statusLine(null);
    });
  fetcher(historyUrl, { headers: { accept: 'application/json' } })
    .then((response) => (response?.ok ? response.json() : { status: 'error', messages: [], error: 'The exchange history could not be read.' }))
    .then((result) => renderHistory(historyNode, result))
    .catch(() => renderHistory(historyNode, { status: 'error', messages: [], error: 'The testnet mirror could not be reached.' }));
  return { storageKey: LOCAL_PROPOSAL_KEY };
}

if (typeof document !== 'undefined' && document.getElementById('hedera-desk')) {
  mountHederaDesk(document);
}
