import * as sim from './p2p-exchange-sim.mjs';
import { ARTICLES } from './p2p-resources.mjs';
import { PASSKEY_WORDING, createIndexedDbVault, deviceKeyForMigration, importNonExtractable, openJson, passkeyCreationOptions, sealJson } from './p2p-sim-guard.mjs';
import { REFERENCE_LABEL, optionLabel, referenceLine } from './dc-reference.mjs';

const sessionKeys = new Map();
const sessionCrypto = new Map();
const metaKeys = new Map();
const rememberedSecrets = new Map();
const freshAuth = new Map();
const baseStore = sim.createLocalStorageStore();
const store = {
  async get(id) {
    const peer = await baseStore.get(id);
    if (peer && !peer.privateKeyJwk && sessionKeys.has(id)) peer.privateKeyJwk = structuredClone(sessionKeys.get(id));
    if (peer && !peer.signingKey && sessionCrypto.has(id)) peer.signingKey = sessionCrypto.get(id);
    if (peer?.migrationWrap && metaKeys.has(id) && !peer.privateKeyJwk) {
      try {
        const opened = await openJson(metaKeys.get(id), peer.migrationWrap);
        peer.privateKeyJwk = opened.privateKeyJwk;
      } catch { /* the wrap stays sealed */ }
    }
    if (peer?.kyc?.sealed && metaKeys.has(id)) {
      try {
        const opened = await openJson(metaKeys.get(id), peer.kyc.sealed);
        peer.kyc = { ...peer.kyc, ...opened };
      } catch { /* status stays readable */ }
    }
    return peer;
  },
  async set(id, value) {
    const signingKey = value?.signingKey;
    if (value) delete value.signingKey;
    const copy = structuredClone(value);
    if (signingKey) value.signingKey = signingKey;
    if (copy?.wallet?.ciphertext || copy?.keyVault) copy.privateKeyJwk = null;
    delete copy?.signingKey;
    if (copy?.kyc && metaKeys.has(id) && (copy.kyc.phone || copy.kyc.email || copy.kyc.salt)) {
      const sealed = await sealJson(metaKeys.get(id), {
        phone: copy.kyc.phone || '',
        email: copy.kyc.email || '',
        salt: copy.kyc.salt || ''
      });
      copy.kyc = { status: copy.kyc.status, displayName: copy.kyc.displayName, sealed };
    }
    await baseStore.set(id, copy);
  },
  async remove(id) {
    sessionKeys.delete(id);
    rememberedSecrets.delete(id);
    return baseStore.remove(id);
  },
  async listIds() {
    return baseStore.listIds();
  },
  async clear() {
    sessionKeys.clear();
    rememberedSecrets.clear();
    return baseStore.clear();
  }
};
const SEAT_KEY = 'lgme-sim:ui:seat';
const TABS = ['market', 'circles', 'list', 'chats', 'wallet', 'help'];
const KNOWN = new Set([...TABS, 'books', 'exchange', 'devices', 'reconcile']);
const CATEGORIES = ['Goods', 'Services', 'Household', 'Food', 'Tools'];
const CONDITIONS = ['New', 'Good', 'Fair', 'For parts'];
const PICKUPS = ['Pickup', 'Porch', 'Meet'];
let pendingImport = '';
let carryAddress = '';
let activeCodeTimer = 0;
let catalog = [];
let offerupItems = [];
let wantedMatches = [];
let offerupIndex = -1;
let openOfferFor = '';
let catalogMeta = { date: '', notice: '', method: '' };
let catalogNotice = `${REFERENCE_LABEL}. Reference only, not a price.`;
let busy = false;
let nameById = {};
let marketQuery = { q: '', kind: '', category: '', condition: '', pickup: '', circle: '', min: '', max: '' };
let openListingId = '';
let openThreadId = '';
let pendingChat = '';
let pendingInvoice = '';
let signedSms = null;
let matchNote = '';
let openCall = null;
let listStep = 1;
let listDraft = { photo: '', photoHash: '', title: '', category: 'Goods', condition: 'Good', pickup: 'Pickup', circle: '', area: '', amount: '', referenceId: '' };

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function setStatus(text, tone) {
  const el = document.getElementById('status');
  el.textContent = text || '';
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
}

function tabName() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (raw.includes('lgme1.')) return 'devices';
  const name = raw.split('&')[0];
  if (name === 'resources' || name.startsWith('resources-')) return 'resources';
  return KNOWN.has(name) ? name : 'market';
}

function rememberSeat(id) {
  sessionStorage.setItem(SEAT_KEY, id);
}

function namesOf(peers) {
  return Object.fromEntries(peers.map((peer) => [peer.id, peer.name]));
}

function shortHash(value) {
  return value ? String(value).slice(0, 12) : '';
}

function option(value, label, selected) {
  const node = h('option', { value }, [label]);
  if (selected) node.selected = true;
  return node;
}

function peerOptions(peers, selected, placeholder) {
  const nodes = [];
  if (placeholder != null) nodes.push(option('', placeholder, !selected));
  for (const peer of peers) nodes.push(option(peer.id, peer.name, peer.id === selected));
  return nodes;
}

function field(label, control) {
  const id = control.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return h('div', {}, [h('label', { for: id }, [label]), control]);
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function ensureBooks() {
  const peers = await sim.listPeers(store);
  if (peers.length) return peers;
  await sim.resetAndSeed(store);
  return sim.listPeers(store);
}

function currentSeat(peers) {
  const saved = sessionStorage.getItem(SEAT_KEY);
  if (peers.some((peer) => peer.id === saved)) return saved;
  return peers[0] ? peers[0].id : '';
}

function formatBalances(balances) {
  return Object.entries(balances).map(([id, balance]) => `${nameById[id] || id} ${balance}`).join(' · ');
}

async function render() {
  if (activeCodeTimer) {
    clearInterval(activeCodeTimer);
    activeCodeTimer = 0;
  }
  const peers = await ensureBooks();
  nameById = namesOf(peers);
  const seat = currentSeat(peers);
  renderSeats(peers, seat);
  renderTabs();
  const tab = tabName();
  if (tab === 'market') await renderMarket(peers, seat);
  else if (tab === 'circles') await renderCircles();
  else if (tab === 'list') await renderList(seat);
  else if (tab === 'chats') await renderChats(seat);
  else if (tab === 'books') await renderBooks(peers, seat);
  else if (tab === 'reconcile') await renderReconcile(peers, seat);
  else if (tab === 'wallet') await renderWallet(peers, seat);
  else if (tab === 'devices') await renderDevices(peers, seat);
  else if (tab === 'help') renderHelp();
  else if (tab === 'resources') renderResources();
  else await renderExchange(peers, seat);
}

function renderSeats(peers, seat) {
  const bar = document.getElementById('seatbar');
  bar.replaceChildren();
  for (const peer of peers) {
    const button = h('button', {
      type: 'button',
      class: 'seat',
      'aria-pressed': peer.id === seat ? 'true' : 'false'
    }, [
      peer.name,
      h('small', {}, [`${peer.mock ? peer.balance + ' mock $lgme' : peer.balance} · floor ${peer.floor}${peer.locked ? ' · locked' : ''}`]),
      h('span', { class: peer.kyc === 'VERIFIED' ? 'badge badge-verified' : 'badge badge-unverified' }, [peer.kyc === 'VERIFIED' ? 'Verified' : 'Unverified'])
    ]);
    button.addEventListener('click', () => {
      rememberSeat(peer.id);
      setStatus(`Acting as ${peer.name}. This is ${peer.name}'s book only.`);
      render();
    });
    bar.append(button);
  }
  bar.append(h('button', { type: 'button', class: 'seat', onClick: () => renderAddPeer(peers) }, ['Register', h('small', {}, ['Mock grant of 100 $lgme'])]));
  bar.append(h('button', { type: 'button', class: 'seat', onClick: resetDemo }, ['Reset demo', h('small', {}, ['Clears every local book'])]));
}

function selectTab(name) {
  if (location.hash.includes('lgme1.')) pendingImport = location.hash.slice(location.hash.indexOf('lgme1.'));
  if (name === 'market') openListingId = '';
  if (name === 'chats') openThreadId = '';
  if (location.hash.replace(/^#/, '') === name) render();
  else location.hash = name;
}

function renderTabs() {
  const tab = tabName();
  const phoneTab = ['reconcile', 'books', 'devices', 'exchange'].includes(tab) ? 'wallet' : tab === 'resources' ? 'help' : tab;
  for (const name of TABS) {
    const button = document.getElementById(`tab-${name}`);
    button.setAttribute('aria-selected', name === tab ? 'true' : 'false');
    button.onclick = () => selectTab(name);
  }
  document.querySelectorAll('.tabbar button').forEach((button) => {
    button.setAttribute('aria-selected', button.dataset.tab === phoneTab ? 'true' : 'false');
  });
}

function renderAddPeer(peers) {
  const panel = document.getElementById('panel');
  const name = h('input', { required: true, maxlength: '48', autocomplete: 'off' });
  const floor = h('input', { type: 'number', step: '0.01', value: '40' });
  const limit = h('input', { type: 'number', step: '0.01', value: '-200' });
  const passphrase = h('input', { type: 'password', minlength: '8', autocomplete: 'new-password', required: true });
  const form = h('form', { class: 'grid two' }, [
    field('Name', name),
    field('Floor', floor),
    field('Credit limit', limit),
    field('Passphrase, at least 8 characters', passphrase),
    h('div', { class: 'actions' }, [
      h('button', { type: 'submit', class: 'primary' }, ['Register']),
      h('button', { type: 'button', class: 'quiet', onClick: () => render() }, ['Cancel'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const id = sim.slugPeerId(name.value, peers.map((peer) => peer.id));
      const created = await sim.registerPeer(store, {
        id,
        name: name.value.trim(),
        floor: floor.value,
        creditLimit: limit.value
      });
      if (!created.ok) {
        setStatus(created.error, 'bad');
        return;
      }
      const setup = await sim.setupWallet(store, id, passphrase.value);
      if (!setup.ok) {
        setStatus(setup.error, 'bad');
        return;
      }
      rememberedSecrets.set(id, setup.secretBase32);
      const code = await liveCode(setup.secretBase32);
      const stored = await baseStore.get(id);
      const opened = await sim.unlockWallet(stored, passphrase.value, code, Math.floor(Date.now() / 1000));
      if (opened.ok) sessionKeys.set(id, opened.privateKeyJwk);
      rememberSeat(id);
      setStatus(`${name.value.trim()} has a mock grant of 100 $lgme on a GENESIS line. The key is locked. Scan the wallet code, then unlock with the passphrase and the 6-digit code.`, 'ok');
      location.hash = 'wallet';
      await render();
    } finally {
      busy = false;
    }
  });
  panel.replaceChildren(
    h('h2', {}, ['Register']),
    h('p', { class: 'muted' }, ['A new peer receives a simulated grant of 100 $lgme. It is written as a GENESIS line labeled mock. The signing key is then encrypted with the passphrase. This is not a payment.']),
    form
  );
}

async function resetDemo() {
  if (busy) return;
  if (!confirm('Reset the demo? This clears every simulated book in this browser.')) return;
  busy = true;
  try {
    await sim.resetAndSeed(store);
    rememberSeat('alice');
    setStatus('Demo books restored. The market has a few listings, one open counter, and one pending handoff. Nothing in the market has settled.', 'ok');
    openListingId = '';
    openThreadId = '';
    if (location.hash && location.hash !== '#market') location.hash = 'market';
    else await render();
  } finally {
    busy = false;
  }
}

function basisOptions(item) {
  const nodes = [];
  if (item.hourly_avg != null) nodes.push(option('hour', 'Per hour', false));
  if (item.job_avg != null) nodes.push(option('job', item.unit === 'visit' ? 'Per visit' : 'Per job', false));
  if (!nodes.length && item.avg_value_usd != null) nodes.push(option('unit', `Per ${item.unit}`, true));
  if (item.job_avg != null) nodes.find((node) => node.value === 'job').selected = true;
  else if (nodes[0]) nodes[0].selected = true;
  return nodes;
}

function activeAvg(item, basis) {
  if (!item) return null;
  if (basis === 'hour') return item.hourly_avg;
  if (basis === 'job') return item.job_avg;
  return item.avg_value_usd;
}

function referenceDetail(item) {
  if (!item) return catalogNotice;
  const line = referenceLine(item, catalogMeta);
  const note = item.note ? ` ${item.note}` : '';
  return `${line.text} Reference only, not a price.${note}`;
}

function referenceCatalogCard() {
  const rows = catalog.map((item) => {
    const line = referenceLine(item, catalogMeta);
    return h('li', {}, [
      h('strong', {}, [`${line.name}: ${line.value}`]),
      h('span', { class: 'legend' }, [` As of ${line.asOf}. Sources: ${line.sources}.`])
    ]);
  });
  return h('details', { id: 'dc-reference', open: true, class: 'card' }, [
    h('summary', {}, [REFERENCE_LABEL]),
    h('p', { class: 'legend' }, [catalogNotice]),
    rows.length ? h('ul', {}, rows) : h('p', {}, ['pending'])
  ]);
}

async function renderExchange(peers, seat) {
  const panel = document.getElementById('panel');
  const me = peers.find((peer) => peer.id === seat);
  const full = await store.get(seat);
  const kind = h('select', {}, [option('bilateral', 'Bilateral', true), option('cycle', 'Multi-party cycle', false)]);
  const bilateral = renderBilateral(peers, me);
  const cycle = renderCycle(peers, me);
  cycle.hidden = true;
  kind.addEventListener('change', () => {
    bilateral.hidden = kind.value !== 'bilateral';
    cycle.hidden = kind.value !== 'cycle';
  });
  const open = Object.values(full.exchanges || {}).sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  panel.replaceChildren(
    h('h2', {}, [`Exchange · ${me.name}`]),
    h('p', { class: 'muted' }, ['You are acting as this peer. Switch seats to countersign or to refuse. A proposal is not a debt until the other parties countersign.']),
    referenceCatalogCard(),
    h('h3', {}, ['Lines on this book']),
    open.length ? h('div', {}, open.map((ex) => exchangeCard(ex, full, peers))) : h('p', { class: 'muted' }, ['No exchanges on this book yet.']),
    h('h3', {}, ['Propose a line']),
    field('Kind of line', kind),
    bilateral,
    cycle
  );
}

function renderBilateral(peers, me) {
  const debtor = h('select', {}, peerOptions(peers, me.id));
  const creditor = h('select', {}, peerOptions(peers, peers.find((peer) => peer.id !== me.id)?.id || ''));
  const third = h('select', {}, peerOptions(peers, '', 'None'));
  const reference = h('input', { required: true, maxlength: '160', value: '' });
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: '10', required: true, inputmode: 'decimal' });
  const charge = h('input', { type: 'number', min: '0', step: '0.01', value: '0' });
  const refItem = h('select', {}, [option('', 'None', true)]);
  for (const item of catalog) {
    refItem.append(option(item.id, optionLabel(item, catalogMeta), false));
  }
  const refBasis = h('select', {});
  const refQty = h('input', { type: 'number', min: '0.01', step: '0.01', value: '1' });
  const refDetail = h('p', { class: 'legend' }, [catalogNotice]);
  const refWrap = h('div', { class: 'grid three' }, [
    field('Basis', refBasis),
    field('Hours or quantity', refQty)
  ]);
  refWrap.hidden = true;
  const preview = h('p', { class: 'legend' }, ['']);
  const receipt = h('select', {}, [option('', 'None', true)]);
  const form = h('form', {}, [
    h('div', { class: 'grid three' }, [
      field('Debtor', debtor),
      field('Creditor', creditor),
      field('Third seat', third)
    ]),
    field('Work', reference),
    h('div', { class: 'grid three' }, [
      field('Amount', amount),
      field('Named charge, before any signature', charge),
      field('Cite IdidIt', receipt)
    ]),
    field('Reference value (optional)', refItem),
    h('p', { class: 'legend' }, [`${REFERENCE_LABEL}. Reference only, not a price. The amount on the line is what would settle.`]),
    refWrap,
    refDetail,
    preview,
    h('div', { class: 'actions' }, [h('button', { type: 'submit', class: 'primary' }, ['Propose'])])
  ]);

  async function refreshReceipts() {
    const creditorId = creditor.value;
    const worker = creditorId ? await store.get(creditorId) : null;
    const current = receipt.value;
    receipt.replaceChildren(option('', 'None', !current));
    for (const item of Object.values(worker?.receipts || {})) {
      receipt.append(option(item.receiptId, item.work, item.receiptId === current));
    }
  }

  async function refreshPreview() {
    const debtorPeer = await store.get(debtor.value);
    const figure = sim.round2(amount.value);
    if (!debtorPeer || !Number.isFinite(figure)) {
      preview.textContent = '';
      return;
    }
    const current = sim.replay(debtorPeer).balance;
    const next = sim.applyLegs(current, debtorPeer.id, [{ debtorId: debtor.value, creditorId: creditor.value, amount: figure }]).balance;
    const reason = sim.floorBlockReason(debtorPeer, next);
    const rule = sim.terms(debtorPeer);
    preview.textContent = reason
      ? `${reason}. ${debtorPeer.name} would go from ${current} to ${next}. Floor ${rule.floor} stays senior.`
      : `${debtorPeer.name} would go from ${current} to ${next}. Floor ${rule.floor}. This is a preview, not a settlement.`;
    preview.className = reason ? 'bad' : 'legend';
  }

  function applyReference() {
    const item = catalog.find((row) => row.id === refItem.value);
    refBasis.replaceChildren();
    if (!item || item.avg_value_usd == null) {
      refWrap.hidden = true;
      refDetail.textContent = item ? referenceDetail(item) : catalogNotice;
      return;
    }
    refWrap.hidden = false;
    refBasis.replaceChildren(...basisOptions(item));
    const avg = activeAvg(item, refBasis.value);
    const qty = Number(refQty.value);
    if (avg == null || !Number.isFinite(qty) || qty <= 0) {
      refDetail.textContent = 'Reference only, not a price. Enter a quantity.';
      return;
    }
    const suggested = sim.round2(avg * qty);
    amount.value = String(suggested);
    if (!reference.value.trim()) reference.value = item.name;
    const line = referenceLine(item, catalogMeta);
    refDetail.textContent = `${line.text} Reference only, not a price. ${avg} × ${qty} = ${suggested}. The line amount can still be edited.`;
    refreshPreview();
  }

  refItem.addEventListener('change', applyReference);
  refBasis.addEventListener('change', applyReference);
  refQty.addEventListener('input', applyReference);
  debtor.addEventListener('change', refreshPreview);
  creditor.addEventListener('change', () => { refreshReceipts(); refreshPreview(); });
  amount.addEventListener('input', refreshPreview);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const item = catalog.find((row) => row.id === refItem.value);
    const avg = item ? activeAvg(item, refBasis.value) : null;
    busy = true;
    const result = await sim.proposeBilateral(store, {
      proposerId: me.id,
      debtorId: debtor.value,
      creditorId: creditor.value,
      thirdSeatId: third.value || null,
      amount: amount.value,
      reference: reference.value,
      charge: charge.value,
      ididitId: receipt.value || null,
      referenceId: item && avg != null ? item.id : null,
      referenceAvg: item && avg != null ? avg : null
    });
    busy = false;
    if (!result.ok) {
      setStatus(result.error, 'bad');
      return;
    }
    setStatus('Proposed. The other party still has to countersign. Nothing has settled.', 'ok');
    render();
  });
  refreshReceipts();
  refreshPreview();
  return form;
}

function renderCycle(peers, me) {
  const third = h('select', {}, peerOptions(peers, '', 'None'));
  const charge = h('input', { type: 'number', min: '0', step: '0.01', value: '0' });
  const legs = h('div', {});
  const rows = [];

  function addRow(seed = {}) {
    const debtor = h('select', {}, peerOptions(peers, seed.debtorId || me.id));
    const creditor = h('select', {}, peerOptions(peers, seed.creditorId || ''));
    const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: seed.amount || '10' });
    const reference = h('input', { maxlength: '160', value: seed.reference || '' });
    const row = h('div', { class: 'row grid two' }, [
      field('Debtor', debtor),
      field('Creditor', creditor),
      field('Amount', amount),
      field('Work', reference)
    ]);
    const remove = h('button', { type: 'button', class: 'quiet' }, ['Remove line']);
    remove.addEventListener('click', () => {
      row.remove();
      const index = rows.indexOf(record);
      if (index >= 0) rows.splice(index, 1);
    });
    row.append(remove);
    const record = { debtor, creditor, amount, reference, row };
    rows.push(record);
    legs.append(row);
  }

  addRow();
  addRow();
  addRow();
  const preview = h('p', { class: 'legend' }, ['Preview the floor before anyone signs. A preview writes nothing.']);
  async function previewCycle() {
    const legs = rows.map((row) => ({
      debtorId: row.debtor.value,
      creditorId: row.creditor.value,
      amount: sim.round2(row.amount.value)
    }));
    const ids = [...new Set(legs.flatMap((leg) => [leg.debtorId, leg.creditorId]).filter(Boolean))];
    const bits = [];
    let blocked = '';
    for (const id of ids) {
      const peer = await store.get(id);
      if (!peer || !legs.every((leg) => Number.isFinite(leg.amount))) continue;
      const current = sim.replay(peer).balance;
      const next = sim.applyLegs(current, id, legs).balance;
      const reason = sim.floorBlockReason(peer, next);
      if (reason) blocked = reason;
      bits.push(`${peer.name} ${current} → ${next}`);
    }
    preview.className = blocked ? 'bad' : 'legend';
    preview.textContent = bits.length
      ? `${blocked || 'Floor holds on these nets.'} ${bits.join(' · ')}. Preview only.`
      : 'Add peers and amounts to preview the floor.';
  }
  const form = h('form', {}, [
    field('Third seat, if someone outside the cycle is reading it', third),
    field('Named charge, before any signature', charge),
    h('p', { class: 'legend' }, ['Every party countersigns. The floor is tested on the net of the whole cycle. One leg that takes a floor blocks every leg.']),
    legs,
    preview,
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => addRow() }, ['Add a line']),
      h('button', {
        type: 'button',
        onClick: () => {
          legs.replaceChildren();
          rows.splice(0, rows.length);
          const ids = ['alice', 'bob', 'charlie'];
          if (ids.every((id) => peers.some((peer) => peer.id === id))) {
            addRow({ debtorId: 'alice', creditorId: 'bob', amount: '10', reference: 'Walkway clearing' });
            addRow({ debtorId: 'bob', creditorId: 'charlie', amount: '10', reference: 'Soil credits' });
            addRow({ debtorId: 'charlie', creditorId: 'alice', amount: '10', reference: 'Logistics run' });
          } else {
            addRow();
            addRow();
            addRow();
          }
          previewCycle();
        }
      }, ['Sketch a three-line cycle']),
      h('button', { type: 'button', onClick: () => previewCycle() }, ['Preview the floor']),
      h('button', { type: 'submit', class: 'primary' }, ['Propose cycle'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const result = await sim.proposeCycle(store, {
      proposerId: me.id,
      thirdSeatId: third.value || null,
      charge: charge.value,
      legs: rows.map((row) => ({
        debtorId: row.debtor.value,
        creditorId: row.creditor.value,
        amount: row.amount.value,
        reference: row.reference.value
      }))
    });
    busy = false;
    if (!result.ok) {
      setStatus(result.error, 'bad');
      return;
    }
    setStatus('Cycle proposed. Each other party still has to countersign. Nothing has settled.', 'ok');
    render();
  });
  return form;
}

function exchangeCard(ex, me, peers) {
  const names = namesOf(peers);
  const needed = sim.requiredSigners(ex);
  const signed = needed.filter((id) => ex.signatures?.[id]);
  const waiting = needed.filter((id) => !ex.signatures?.[id]);
  const legText = (ex.legs || []).map((leg) => {
    const ref = leg.referenceId ? ` · reference ${leg.referenceAvg} (not a price)` : '';
    const work = leg.ididit ? ` · IdidIt ${leg.ididit.work}` : '';
    return `${names[leg.debtorId] || leg.debtorId} → ${names[leg.creditorId] || leg.creditorId} ${leg.amount} ${leg.reference || ''}${work}${ref}`;
  }).join(' · ');
  const mine = sim.applyLegs(0, me.id, ex.legs);
  const effect = ex.status === 'settled'
    ? (mine.debit || mine.credit ? `Your book: debit ${mine.debit}, credit ${mine.credit}.` : 'This line does not move your balance.')
    : 'Not settled.';
  const actions = [];
  const refusalBox = h('div', {}, []);
  refusalBox.hidden = true;
  if ((ex.status === 'proposed' || ex.status === 'countersigned') && needed.includes(me.id) && !ex.signatures?.[me.id]) {
    actions.push(h('button', { type: 'button', class: 'primary', onClick: () => run(() => sim.countersign(store, me.id, ex.id), 'Countersigned. Settlement still waits for every signature and the floor.') }, ['Countersign']));
  }
  if ((ex.status === 'proposed' || ex.status === 'countersigned') && (needed.includes(me.id) || ex.thirdSeatId === me.id)) {
    const statement = h('input', { value: 'REFUSAL', maxlength: '240' });
    refusalBox.append(
      field('Refusal statement. It stays on the tape.', statement),
      h('button', {
        type: 'button',
        class: 'primary',
        onClick: () => run(() => sim.refuse(store, me.id, ex.id, statement.value), 'REFUSAL recorded. No balance moves. No penalty.')
      }, ['Record the refusal'])
    );
    actions.push(h('button', {
      type: 'button',
      onClick: () => { refusalBox.hidden = !refusalBox.hidden; }
    }, [ex.thirdSeatId === me.id ? 'Refuse as third seat' : 'Refuse']));
  }
  if ((ex.status === 'proposed' || ex.status === 'countersigned') && needed.includes(me.id)) {
    actions.push(h('button', { type: 'button', onClick: () => run(() => sim.settle(store, me.id, ex.id), null) }, ['Settle']));
  }
  actions.push(h('button', { type: 'button', class: 'quiet', onClick: () => shareExchange(me, ex) }, ['Share signed copy']));
  const note = ex.status === 'refused'
    ? 'REFUSAL recorded. No balance moves. No penalty.'
    : ex.status === 'blocked'
      ? ex.block?.message || sim.FLOOR_BLOCK
      : `Signed ${signed.map((id) => names[id] || id).join(', ') || 'nobody'}. ${waiting.length ? 'Waiting on ' + waiting.map((id) => names[id] || id).join(', ') + '.' : 'Every party has signed.'}`;
  return h('article', { class: 'row' }, [
    h('header', {}, [
      h('span', { class: 'pill' }, [`${ex.kind} · ${ex.status}`]),
      h('span', { class: 'meta' }, [shortHash(ex.id)])
    ]),
    h('p', {}, [legText]),
    h('p', { class: ex.status === 'blocked' || ex.status === 'refused' ? 'bad' : 'muted' }, [
      `${note} Named charge ${ex.charge}. ${ex.thirdSeatId ? 'Third seat ' + (names[ex.thirdSeatId] || ex.thirdSeatId) + '. ' : ''}${effect}`
    ]),
    actions.length ? h('div', { class: 'actions' }, actions) : null,
    refusalBox
  ]);
}

async function run(action, okMessage) {
  if (busy) return;
  busy = true;
  try {
    const result = await action();
    if (!result.ok) {
      setStatus(result.error, 'bad');
      await render();
      return;
    }
    const tail = result.balances ? ` ${formatBalances(result.balances)}` : '';
    if (result.receiptId) {
      setStatus(`IdidIt recorded. Balance stays ${result.balance}. A receipt is not cash.`, 'ok');
    } else if (result.status === 'settled') {
      setStatus(`Settled.${tail}`, 'ok');
    } else {
      setStatus(`${okMessage || 'Recorded.'}${tail}`, 'ok');
    }
    await render();
  } finally {
    busy = false;
  }
}

async function renderBooks(peers, seat) {
  if (pendingInvoice) {
    const token = pendingInvoice;
    pendingInvoice = '';
    const saved = await sim.acceptInvoice(store, seat, token);
    setStatus(saved.ok ? 'Invoice recorded on this book. The balance did not move. SIMULATION.' : saved.error, saved.ok ? 'ok' : 'bad');
  }
  const panel = document.getElementById('panel');
  const peer = await store.get(seat);
  const names = namesOf(peers);
  const view = sim.replay(peer);
  const rule = sim.terms(peer);
  const above = sim.round2(view.balance - rule.floor);
  const finger = (await sim.sha256(sim.canonicalJSON(peer.publicKeyJwk))).slice(0, 16);
  const search = h('input', { type: 'search', placeholder: 'Filter by work, type, or hash' });
  const type = h('select', {}, ['all', 'genesis', 'ididit', 'INVOICE', 'INVOICE_PAID', 'INVOICE_REFUSED', 'REWARD', 'proposal', 'countersign', 'refusal', 'block', 'settlement', 'transfer', 'iou', 'attested'].map((name, index) => option(name, name === 'all' ? 'All types' : name, index === 0)));
  const list = h('div', {});
  const rows = view.rows.slice().reverse();
  for (const row of rows) {
    const detail = sim.entryDetail(row, names);
    const status = row.type === 'iou' || row.type === 'KYC_STARTED' ? 'pending' : row.type === 'attested' || row.type === 'KYC_VOUCHED' || row.type === 'VERIFIED' || row.type === 'KYC_2FA_OK' ? 'done' : row.type === 'refusal' ? 'refused' : row.type === 'block' ? 'blocked' : (row.type === 'transfer' || row.type === 'settlement') ? 'done' : row.type;
    const item = h('article', { class: 'tx' }, [
      h('span', { class: `mark mark-${status}`, 'aria-hidden': 'true' }, [status.slice(0, 1).toUpperCase()]),
      h('div', {}, [
        h('div', {}, [detail || row.type]),
        h('div', { class: 'meta' }, [`#${row.index} · ${row.at}`])
      ]),
      h('div', { class: 'tx-side' }, [
        h('span', { class: `pill pill-${status}` }, [status]),
        h('span', {}, [row.debit ? `−${row.debit}` : row.credit ? `+${row.credit}` : '']),
        h('span', { class: 'meta' }, [`Bal ${row.balance}`])
      ])
    ]);
    item.dataset.search = `${row.type} ${detail} ${row.hash} ${row.prev}`.toLowerCase();
    item.dataset.type = row.type;
    list.append(item);
  }
  function applyFilter() {
    const query = search.value.trim().toLowerCase();
    const wanted = type.value;
    let shown = 0;
    for (const item of list.children) {
      const hide = (wanted !== 'all' && item.dataset.type !== wanted) || (query && !item.dataset.search.includes(query));
      item.hidden = hide;
      if (!hide) shown += 1;
    }
    empty.hidden = shown !== 0;
  }
  const empty = h('p', { class: 'muted' }, ['No lines match.']);
  empty.hidden = rows.length !== 0;
  search.addEventListener('input', applyFilter);
  type.addEventListener('change', applyFilter);
  const work = h('input', { maxlength: '160', required: true, id: 'ididit-work' });
  const scope = h('input', { maxlength: '160' });
  const hours = h('input', { type: 'number', min: '0', step: '0.01' });
  const invoiceOn = h('input', { type: 'checkbox', id: 'invoice-toggle' });
  const payer = h('select', {}, peerOptions(peers.filter((item) => item.id !== seat), ''));
  const invoiceAmount = h('input', { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', id: 'invoice-amount' });
  const due = h('input', { type: 'date', id: 'invoice-due', value: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) });
  const reference = h('select', {}, [option('', 'No dollar reference', true), ...catalog.map((item) => option(item.id, optionLabel(item, catalogMeta), false))]);
  const mediaHashes = h('input', { placeholder: 'Optional media hashes' });
  const extra = h('div', { id: 'invoice-fields' }, [
    field('Payer', payer),
    field('Amount in $lgme', invoiceAmount),
    field('Due date', due),
    field('Optional $ reference', reference),
    h('p', { class: 'legend' }, [`${REFERENCE_LABEL}. Reference only, not a price.`]),
    field('Linked media hashes', mediaHashes)
  ]);
  extra.hidden = true;
  invoiceOn.addEventListener('change', () => { extra.hidden = !invoiceOn.checked; });
  const receiptForm = h('form', { id: 'ididit-form' }, [
    h('div', { class: 'grid three' }, [field('Work', work), field('Scope', scope), field('Hours', hours)]),
    h('label', { class: 'row' }, [invoiceOn, 'Invoice in $lgme']),
    extra,
    h('div', { class: 'actions' }, [h('button', { type: 'submit', class: 'primary' }, ['Record IdidIt'])])
  ]);
  receiptForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const recorded = await sim.recordIdidIt(store, seat, { work: work.value, scope: scope.value, hours: hours.value });
      if (!recorded.ok) { setStatus(recorded.error, 'bad'); return; }
      if (!invoiceOn.checked) {
        setStatus(`IdidIt recorded. Balance stays ${recorded.balance}. A receipt is not cash.`, 'ok');
        await render();
        return;
      }
      const item = catalog.find((row) => row.id === reference.value);
      const hashes = mediaHashes.value.split(/[\s,]+/).filter((hash) => /^[0-9a-f]{64}$/i.test(hash));
      const created = await sim.createInvoice(store, seat, {
        receiptId: recorded.receiptId,
        payerId: payer.value,
        amount: invoiceAmount.value,
        dueAt: due.value ? new Date(`${due.value}T00:00:00.000Z`).toISOString() : '',
        referenceId: item ? item.id : null,
        referenceAvg: item ? item.avg_value_usd : null,
        mediaHashes: hashes
      });
      if (!created.ok) { setStatus(`Work recorded. ${created.error}`, 'bad'); await render(); return; }
      setStatus('Invoice signed. The balance did not move. Open SMS from the ledger to remind. SIMULATION.', 'ok');
      await render();
    } finally {
      busy = false;
    }
  });
  const now = new Date().toISOString();
  const invoices = sim.sortInvoices(sim.readInvoices(peer, now), now);
  const buckets = sim.invoiceBuckets(peer, now);
  const invoiceCards = invoices.map((row) => {
    const payAmount = h('input', { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', value: String(row.remaining || '') });
    const pass = h('input', { type: 'password', autocomplete: 'current-password' });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8' });
    const note = h('input', { maxlength: '160', placeholder: 'REFUSAL' });
    const actions = [];
    if (row.remaining > 0 && row.status !== 'refused' && row.status !== 'donated') {
      actions.push(h('button', { type: 'button', onClick: async () => {
        const result = await sim.remindInvoice(store, seat, row.invoiceId);
        setStatus(result.ok ? 'Reminder recorded on the tapes. Nothing was sent. No penalty. SIMULATION.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Remind']));
      actions.push(h('button', { type: 'button', id: 'donate-floor', onClick: async () => {
        const result = await sim.consentFloorDonation(store, seat, row.invoiceId);
        setStatus(result.closed ? result.message : 'Your consent is signed. The other party still has to consent. No penalty. SIMULATION.', result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Reconcile as donation to the floor']));
    }
    if (row.role === 'AR' && row.remaining > 0 && row.status !== 'refused' && row.status !== 'donated') {
      actions.push(h('a', { class: 'btn', href: '#', onClick: async (event) => {
        event.preventDefault();
        const payload = (await store.get(seat)).tape.find((entry) => entry.type === 'INVOICE' && entry.payload?.invoiceId === row.invoiceId)?.payload;
        const sealed = await sim.sealMessage(await store.get(seat), 'invoice', payload);
        if (!sealed.ok) { setStatus(sealed.error, 'bad'); return; }
        const href = sim.shareHrefs(row.payerPhone, `SIMULATION lgme. Invoice ${row.amount} $lgme. This page does not send it.\n${sim.encodeMessage(sealed.message)}`).sms;
        event.currentTarget.href = href;
        window.location.href = href;
      } }, ['Remind by SMS']));
    }
    if (row.role === 'AP' && row.remaining > 0 && row.status !== 'refused') {
      actions.push(h('button', { type: 'button', class: 'primary', id: 'pay-invoice', onClick: async () => {
        const result = await sim.payInvoice(store, seat, row.invoiceId, { amount: payAmount.value, passphrase: pass.value, code: code.value });
        setStatus(result.ok ? `Paid ${result.amount} $lgme. Remaining ${result.remaining}. Reward ${result.reward}. SIMULATION.` : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Pay with code']));
      actions.push(h('button', { type: 'button', onClick: async () => {
        const result = await sim.refuseInvoice(store, seat, row.invoiceId, note.value || 'REFUSAL');
        setStatus(result.ok ? 'REFUSAL recorded. No balance moves. No penalty. No reward. SIMULATION.' : result.error, result.ok ? 'ok' : 'bad');
        if (result.ok) await render();
      } }, ['Refuse']));
    }
    return h('article', { class: 'card', id: row.role === 'AR' ? 'invoice-ar' : 'invoice-ap' }, [
      h('h3', {}, [`${row.role} · ${row.status} · ${row.amount} $lgme`]),
      h('p', { class: 'muted' }, [`Paid ${row.paid}. Remaining ${row.remaining}. Bucket ${row.bucket}. Due ${String(row.dueAt).slice(0, 10)}. Phone ${row.payerPhone}. Hash ${String(row.payerKycHash || '').slice(0, 12)}.`]),
      row.thanks ? h('p', { class: 'legend' }, [row.thanks]) : null,
      row.role === 'AP' && row.remaining > 0 ? h('div', {}, [field('Amount', payAmount), field('Passphrase', pass), field('6-digit code', code), field('Refusal note', note)]) : null,
      h('div', { class: 'actions' }, actions)
    ]);
  });
  panel.replaceChildren(
    h('h2', {}, [`${peer.name}'s book`]),
    h('p', { class: 'muted' }, [`Every line below is on this peer’s tape. Credits and debits come only from settlements, payments, and mock rewards. The running balance is a replay. Key ${finger}. Limit ${rule.creditLimit}.`]),
    h('div', { class: 'nums' }, [
      h('div', {}, [coinMark(), h('strong', {}, [String(view.balance)]), 'Balance']),
      h('div', {}, [h('strong', {}, [String(rule.floor)]), `Floor · ${rule.floorNote}`]),
      h('div', {}, [h('strong', {}, [above >= 0 ? String(above) : 'below']), above >= 0 ? 'Above the floor' : 'Below the floor']),
      h('div', {}, [h('strong', {}, [String(sim.rewardTotal(peer))]), 'Rewards']),
      h('div', {}, [h('strong', {}, [String(view.credits)]), 'Credits']),
      h('div', {}, [h('strong', {}, [String(view.debits)]), 'Debits'])
    ]),
    h('section', { id: 'offers' }, offerCards(peer, seat)),
    h('section', { id: 'invoices' }, [
      h('h3', {}, ['Receivable and payable']),
      h('p', { class: 'muted' }, [`Open, due, and overdue stay off the balance until a coded payment. Ageing ${buckets['0-30']} in 0-30, ${buckets['31-60']} in 31-60, ${buckets['60+']} in 60+.`]),
      ...invoiceCards,
      invoices.length ? null : h('p', { class: 'empty' }, ['No invoices on this book.']),
      h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: () => download(`${peer.id}-ar-ap.csv`, sim.invoicesToCsv(peer, now), 'text/csv') }, ['Export AR/AP'])])
    ]),
    h('h3', {}, ['Record work']),
    h('p', { class: 'legend' }, ['IdidIt stores the fact of the work on this tape. It does not change the balance. Invoice in $lgme is optional.']),
    receiptForm,
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => verify(peer) }, ['Verify tape']),
      h('button', { type: 'button', onClick: () => download(`${peer.id}-tape.csv`, sim.toCsv(peer, names), 'text/csv') }, ['Export CSV']),
      h('button', { type: 'button', onClick: () => download(`${peer.id}-tape.json`, JSON.stringify(sim.toExport(peer), null, 2), 'application/json') }, ['Export JSON'])
    ]),
    h('div', { class: 'grid two' }, [field('Search', search), field('Type', type)]),
    list,
    empty
  );
}

async function verify(peer) {
  const result = await sim.verifyBook(peer);
  if (result.ok) setStatus(`Verify tape: ok. ${result.entries} entries. Hashes linked. Signatures match. Balance ${result.balance}.`, 'ok');
  else setStatus(`Verify tape: ${result.reason}.`, 'bad');
}

async function renderReconcile(peers, seat) {
  const panel = document.getElementById('panel');
  const left = h('select', {}, peerOptions(peers, peers[0]?.id || ''));
  const right = h('select', {}, peerOptions(peers, peers[1]?.id || peers[0]?.id || ''));
  const out = h('div', {});
  const form = h('form', {}, [
    h('div', { class: 'grid two' }, [field('First book', left), field('Second book', right)]),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Compare copies'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (left.value === right.value) {
      setStatus('Choose two different peers.', 'bad');
      return;
    }
    const report = await sim.reconcilePeers(store, left.value, right.value);
    out.replaceChildren();
    if (report.ok) {
      setStatus(`Reconcile: the shared lines match. ${report.matches.length} exchange${report.matches.length === 1 ? '' : 's'}.`, 'ok');
    } else {
      setStatus(`Reconcile: ${report.mismatches.length} mismatch${report.mismatches.length === 1 ? '' : 'es'}.`, 'bad');
    }
    for (const row of report.mismatches) {
      out.append(h('article', { class: 'row' }, [
        h('p', { class: 'pill' }, ['Mismatch']),
        h('p', {}, [`${shortHash(row.exchangeId) || 'book'} · ${row.field}`]),
        h('p', { class: 'bad' }, [row.detail])
      ]));
    }
    for (const row of report.matches || []) {
      out.append(h('article', { class: 'row' }, [
        h('p', { class: 'pill' }, ['Match']),
        h('p', { class: 'ok' }, [`${shortHash(row.exchangeId)} · ${row.status}`])
      ]));
    }
    if (!report.mismatches.length && !(report.matches || []).length) {
      out.append(h('p', { class: 'muted' }, ['These two books share no exchanges.']));
    }
  });
  const imported = h('textarea', { placeholder: 'Paste a tape JSON or an lgme1. code' });
  const file = h('input', { type: 'file', accept: 'application/json,.json' });
  const importOut = h('div', {});
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    imported.value = await chosen.text();
  });
  const importForm = h('form', {}, [
    field(`Compare ${peers.find((peer) => peer.id === seat)?.name || 'this book'} with an imported tape`, imported),
    field('Or choose a .json file', file),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Verify and compare'])])
  ]);
  importForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const opened = await sim.openTape(imported.value);
    importOut.replaceChildren();
    if (!opened.ok) {
      setStatus(opened.error, 'bad');
      importOut.append(h('p', { class: 'bad' }, [opened.error]));
      return;
    }
    const local = await store.get(seat);
    const report = sim.reconcile(local, opened.peer);
    paintReport(importOut, report);
    setStatus(report.ok ? `Imported tape verified. Shared lines match. ${report.matches.length}.` : `Imported tape verified. ${report.mismatches.length} mismatch${report.mismatches.length === 1 ? '' : 'es'}.`, report.ok ? 'ok' : 'bad');
  });
  panel.replaceChildren(
    h('h2', {}, ['Reconcile']),
    h('p', { class: 'muted' }, ['Compare the signed copies two peers stored. A difference in amount, status, signature, refusal, or settlement is a mismatch. An imported tape is checked for its hash links and signatures before it is compared. Neither book is corrected from the other.']),
    form,
    out,
    h('h3', {}, ['Imported tape']),
    importForm,
    importOut
  );
}

function paintReport(out, report) {
  out.replaceChildren();
  for (const row of report.mismatches || []) {
    out.append(h('article', { class: 'row' }, [
      h('p', { class: 'pill' }, ['Mismatch']),
      h('p', {}, [`${shortHash(row.exchangeId) || 'book'} · ${row.field}`]),
      h('p', { class: 'bad' }, [row.detail])
    ]));
  }
  for (const row of report.matches || []) {
    out.append(h('article', { class: 'row' }, [
      h('p', { class: 'pill' }, ['Match']),
      h('p', { class: 'ok' }, [`${shortHash(row.exchangeId)} · ${row.status}`])
    ]));
  }
  if (!(report.mismatches || []).length && !(report.matches || []).length) {
    out.append(h('p', { class: 'muted' }, ['These two books share no exchanges.']));
  }
}

let carryCode = '';
let stopCamera = () => {};

function pageUrl(encoded) {
  return `${location.origin}${location.pathname}#${encoded}`;
}

function drawQr(host, text) {
  host.replaceChildren();
  if (!text) return;
  const QR = globalThis.QRCode;
  if (!QR || text.length > 2800) {
    host.append(h('p', { class: 'legend' }, ['This message is too long for a QR code. Use copy or a .json file.']));
    return;
  }
  const holder = h('div', { class: 'qr' });
  host.append(holder);
  const long = text.length > 700;
  try {
    new QR(holder, { text, width: long ? 360 : 220, height: long ? 360 : 220, correctLevel: long ? QR.CorrectLevel.L : QR.CorrectLevel.M });
  } catch {
    host.replaceChildren(h('p', { class: 'legend' }, ['This message is too long for a QR code. Use copy or a .json file.']));
  }
}

async function liveCode(secret) {
  const now = Math.floor(Date.now() / 1000);
  return sim.totp(sim.base32Decode(secret), now, { digits: 6, period: 30, algorithm: 'SHA-1' });
}

function stopAnyCamera() {
  stopCamera();
  stopCamera = () => {};
}

async function renderWallet(peers, seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const summary = peers.find((peer) => peer.id === seat);
  const peer = await store.get(seat);
  const locked = Boolean(peer.wallet?.ciphertext) && !peer.privateKeyJwk;
  const secret = rememberedSecrets.get(seat) || '';
  const codeLine = h('p', { class: 'nums' }, ['']);
  async function paintCode() {
    if (!secret) return;
    const code = await liveCode(secret);
    const left = 30 - (Math.floor(Date.now() / 1000) % 30);
    codeLine.textContent = `Mock authenticator on this page session: ${code}. It changes in ${left}s. An authenticator app that scanned the code shows the same number.`;
  }
  if (secret) {
    await paintCode();
    activeCodeTimer = window.setInterval(paintCode, 1000);
  }
  const blocks = [
    h('h2', {}, [`Wallet · ${summary.name} `, h('span', { class: sim.kycStatus(peer) === 'VERIFIED' ? 'badge badge-verified' : 'badge badge-unverified' }, [sim.kycStatus(peer) === 'VERIFIED' ? 'Verified' : 'Unverified'])]),
    h('p', { class: 'muted' }, ['SIMULATION. The balance is mock $lgme. The passphrase and the 6-digit code are simulated 2FA. This page does not send the code and does not move real money.']),
    h('div', { class: 'balance-hero' }, [
      coinMark(),
      h('div', {}, [h('strong', {}, [String(sim.replay(peer).balance)]), summary.mock ? 'Mock $lgme' : 'Book balance']),
      h('div', {}, [h('strong', {}, [String(sim.terms(peer).floor)]), 'Floor']),
      h('div', {}, [h('strong', {}, [locked ? 'Locked' : 'Open']), 'Key'])
    ])
  ];
  if (secret) blocks.push(codeLine, h('div', { id: 'setup-qr' }));
  blocks.push(profileCard(sim.peerProfile(peer)), passkeyCard(), coinPanel(), soBeItCard(peers, seat), kycCard(peer, peers));
  if (!peer.wallet?.ciphertext) {
    const passphrase = h('input', { type: 'password', minlength: '8', autocomplete: 'new-password', required: true });
    const form = h('form', {}, [
      h('p', { class: 'legend' }, ['This demo book is unlocked so the desk can be tried. Set a passphrase to encrypt the key at rest.']),
      field('Passphrase', passphrase),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Encrypt and lock'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const setup = await sim.setupWallet(store, seat, passphrase.value);
      if (!setup.ok) { setStatus(setup.error, 'bad'); return; }
      rememberedSecrets.set(seat, setup.secretBase32);
      sessionKeys.delete(seat);
      setStatus('Key encrypted. Scan the code before you reload. SIMULATION.', 'ok');
      await render();
    });
    blocks.push(form, iouSection(peer));
  } else if (locked) {
    const passphrase = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true });
    const form = h('form', { class: 'grid two' }, [
      field('Passphrase', passphrase),
      field('6-digit code', code),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Unlock'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const stored = await baseStore.get(seat);
      const opened = await sim.unlockWallet(stored, passphrase.value, code.value, Math.floor(Date.now() / 1000));
      if (!opened.ok) { setStatus(opened.error, 'bad'); return; }
      sessionKeys.set(seat, opened.privateKeyJwk);
      rememberedSecrets.set(seat, opened.secretBase32);
      setStatus('Wallet unlocked for this page session. The key stays encrypted in storage. SIMULATION.', 'ok');
      await render();
    });
    blocks.push(h('p', { class: 'legend' }, ['Unlock asks for the passphrase and the current code. A wrong code leaves the key locked.']), form);
  } else {
    blocks.push(h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: () => { sessionKeys.delete(seat); setStatus('Wallet locked. SIMULATION.', 'ok'); render(); } }, ['Lock'])]));
    blocks.push(iouSection(peer));
  }
  blocks.push(deskLinks());
  panel.replaceChildren(...blocks);
  const qrHost = document.getElementById('setup-qr');
  if (qrHost && secret) {
    const label = encodeURIComponent(`lgme-sim:${peer.name}`);
    drawQr(qrHost, `otpauth://totp/${label}?secret=${secret}&issuer=lgme-sim&algorithm=SHA1&digits=6&period=30`);
  }
}

function kycCard(peer, peers) {
  const status = sim.kycStatus(peer);
  const started = (peer.tape || []).some((entry) => entry.type === 'KYC_STARTED');
  const twoFa = (peer.tape || []).some((entry) => entry.type === 'KYC_2FA_OK');
  const steps = h('ol', { class: 'legend' }, [
    h('li', {}, ['Your name. Phone and email stay on this device.']),
    h('li', {}, ['Confirm your 6-digit code.']),
    h('li', {}, ['A verified member vouches, with their own code.'])
  ]);
  if (status === 'VERIFIED') {
    return h('article', { class: 'card', id: 'kyc' }, [
      h('h3', {}, ['You are verified']),
      h('p', { class: 'muted' }, ['A member vouched for this book. You can send. SIMULATION.']),
      steps
    ]);
  }
  const body = [
    h('h3', {}, ['Become verified']),
    h('p', { class: 'muted' }, ['Unverified members can receive, and can send up to 20 $lgme. This check stays on this device.']),
    steps
  ];
  if (!started) {
    const displayName = h('input', { value: peer.kyc?.displayName || peer.name, maxlength: '48', autocomplete: 'name' });
    const phone = h('input', { value: '', placeholder: 'optional', inputmode: 'tel', autocomplete: 'tel' });
    const email = h('input', { value: '', placeholder: 'optional', inputmode: 'email', autocomplete: 'email' });
    const form = h('form', {}, [
      field('Display name', displayName),
      field('Phone, optional', phone),
      field('Email, optional', email),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Save details'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await sim.startKyc(store, peer.id, { displayName: displayName.value, phone: phone.value, email: email.value });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      setStatus('Details saved on this device. Next, confirm your code. SIMULATION.', 'ok');
      await render();
    });
    body.push(form);
  } else if (!twoFa) {
    const pass = h('input', { type: 'password', minlength: '8', autocomplete: 'new-password', required: true });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8' });
    const form = h('form', {}, [
      field(peer.wallet?.ciphertext ? 'Passphrase' : 'Choose a passphrase', pass),
      peer.wallet?.ciphertext ? field('6-digit code', code) : null,
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, [peer.wallet?.ciphertext ? 'Confirm code' : 'Set up the code'])])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!peer.wallet?.ciphertext) {
        const setup = await sim.setupWallet(store, peer.id, pass.value);
        if (!setup.ok) { setStatus(setup.error, 'bad'); return; }
        rememberedSecrets.set(peer.id, setup.secretBase32);
        setStatus('Code is ready. Enter it to finish this step. SIMULATION.', 'ok');
        await render();
        return;
      }
      const result = await sim.confirmKyc2fa(store, peer.id, { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      setStatus('Code confirmed. A verified member still has to vouch. SIMULATION.', 'ok');
      await render();
    });
    body.push(form);
  } else {
    const verified = peers.filter((item) => item.kyc === 'VERIFIED' && item.id !== peer.id);
    const voucher = h('select', {}, verified.map((item) => option(item.id, item.name, false)));
    const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true });
    const form = h('form', {}, [
      verified.length ? field('Verified member', voucher) : h('p', { class: 'legend' }, ['No other verified member is on this device yet.']),
      field('Their passphrase', pass),
      field('Their 6-digit code', code),
      h('div', { class: 'actions' }, [
        h('button', { class: 'primary', type: 'submit' }, ['Vouch']),
        h('button', { type: 'button', onClick: async () => {
          const result = await sim.refuseVouch(store, voucher.value || peer.id, peer.id, 'REFUSAL');
          if (!result.ok) { setStatus(result.error, 'bad'); return; }
          setStatus('REFUSAL recorded. No balance moves. No penalty. Still unverified.', 'ok');
          await render();
        } }, ['Refuse'])
      ])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await sim.vouchMember(store, voucher.value, peer.id, { passphrase: pass.value, code: code.value, unixSeconds: Math.floor(Date.now() / 1000) });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      setStatus('Verified. A member vouched. SIMULATION.', 'ok');
      await render();
    });
    body.push(form, selfieStep(peer));
  }
  return h('article', { class: 'card', id: 'kyc' }, body);
}

function selfieStep(peer) {
  const video = h('video', { class: 'cam', playsinline: true, muted: true });
  video.hidden = true;
  const note = h('p', { class: 'legend' }, ['Optional. The preview stays on this screen. Only a hash is kept. The picture is not stored and not sent.']);
  const start = h('button', { type: 'button', onClick: async () => {
    stopAnyCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.hidden = false;
      video.srcObject = stream;
      await video.play();
      stopCamera = () => { stream.getTracks().forEach((track) => track.stop()); video.hidden = true; };
    } catch {
      setStatus('The camera preview did not open. Nothing was stored. SIMULATION.', 'bad');
    }
  } }, ['Preview a simulated selfie']);
  const hashBtn = h('button', { type: 'button', class: 'primary', onClick: async () => {
    if (video.readyState < 2) { setStatus('Open the preview first. SIMULATION.', 'bad'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = await sim.hashCameraPreview(bytes);
    const kept = await sim.keepSelfieHash(store, peer.id, hash);
    stopAnyCamera();
    if (!kept.ok) { setStatus(kept.error, 'bad'); return; }
    note.textContent = `Simulated. Picture discarded. Hash ${hash.slice(0, 12)} stays on this device.`;
  } }, ['Keep only the hash']);
  return h('div', {}, [h('h3', {}, ['Simulated selfie']), note, video, h('div', { class: 'actions' }, [start, hashBtn])]);
}

function iouSection(peer) {
  const debtor = h('input', { value: peer.id });
  const creditor = h('input', { placeholder: 'peer id' });
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: '25' });
  const reference = h('input', { maxlength: '160', placeholder: 'What the dollars are for' });
  const form = h('form', { class: 'grid two' }, [
    field('Debtor', debtor),
    field('Creditor', creditor),
    field('Dollars', amount),
    field('What for', reference),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Record pending IOU'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await sim.recordIou(store, peer.id, {
      debtorId: debtor.value.trim(),
      creditorId: creditor.value.trim(),
      amount: amount.value,
      reference: reference.value
    });
    if (!result.ok) { setStatus(result.error, 'bad'); return; }
    carryCode = result.encoded;
    setStatus('IOU recorded as pending. The balance did not change. The named attester still has to sign.', 'ok');
    await render();
  });
  const rows = Object.values(peer.ious || {});
  const list = rows.map((iou) => {
    const actions = [];
    if (iou.status === 'pending' && iou.attesterId === peer.id) {
      actions.push(h('button', { type: 'button', class: 'primary', onClick: () => run(() => sim.attestIou(store, peer.id, iou.iouId), 'Attested. The book moved.') }, ['Attest']));
      actions.push(h('button', { type: 'button', onClick: () => run(() => sim.refuseAttestation(store, peer.id, iou.iouId, 'REFUSAL'), 'REFUSAL recorded. No balance moves. No penalty.') }, ['Refuse']));
    }
    return h('article', { class: 'row' }, [
      h('p', { class: 'pill' }, [iou.status || 'pending']),
      h('p', {}, [`${iou.debtorId} owes ${iou.creditorId} ${iou.amount} · ${iou.reference}`]),
      h('p', { class: 'legend' }, ['Unattested IOUs do not change the balance.']),
      actions.length ? h('div', { class: 'actions' }, actions) : null
    ]);
  });
  return h('div', {}, [
    h('h3', {}, ['Dollar IOU']),
    h('p', { class: 'legend' }, ['A dollar IOU is pending until the named counterparty attests it. Refusal is recorded and carries no penalty. The floor still blocks a debit that would spend it.']),
    form,
    ...list
  ]);
}

async function renderDevices(peers, seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const peer = await store.get(seat);
  const toId = h('input', { placeholder: 'peer id on the other device' });
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: '10', inputmode: 'decimal' });
  const note = h('input', { maxlength: '160', value: 'mock $lgme' });
  const address = h('input', { placeholder: 'phone or email, optional', autocomplete: 'off' });
  const pass = peer.wallet?.ciphertext ? h('input', { type: 'password', autocomplete: 'current-password', required: true }) : null;
  const code = peer.wallet?.ciphertext ? h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '8', required: true }) : null;
  const shareHost = h('div', {});
  const form = h('form', { class: 'grid two' }, [
    field('Send mock $lgme to peer id', toId),
    field('Amount', amount),
    pass ? field('Passphrase', pass) : null,
    code ? field('6-digit code', code) : null,
    h('div', { class: 'actions sticky-action' }, [h('button', { class: 'primary', type: 'submit' }, [peer.wallet?.ciphertext ? 'Confirm and deliver' : 'Sign the transfer'])]),
    field('Note', note),
    field('Their phone or email, if you want a draft', address),
    h('p', { class: 'legend' }, [peer.wallet?.ciphertext
      ? 'Auto-send stays on this device. A valid code delivers the signed transfer into the other book and posts a simulated notice. A wrong code sends nothing.'
      : 'This demo book has no authenticator yet. Signing prepares a code you can carry. Set up 2FA on the wallet to auto-deliver on this device.']),
    sim.kycStatus(peer) === 'VERIFIED' ? null : h('p', { class: 'legend' }, ['Unverified members can send up to 20 $lgme. Receiving is open.'])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (peer.wallet?.ciphertext) {
      const result = await sim.autoDeliverTransfer(store, seat, {
        toId: toId.value.trim(),
        amount: amount.value,
        note: note.value,
        passphrase: pass.value,
        code: code.value,
        unixSeconds: Math.floor(Date.now() / 1000)
      });
      if (!result.ok) {
        setStatus(result.error || 'Nothing was sent.', 'bad');
        toast(result.error || 'Nothing was sent.');
        return;
      }
      carryCode = result.encoded || '';
      carryAddress = address.value.trim();
      if (result.encoded && deliveryChannel) deliveryChannel.postMessage({ encoded: result.encoded });
      const line = result.delivered
        ? `Delivered. ${peer.name} is at ${result.balance}. The other book appended it. SIMULATION.`
        : `Signed. ${peer.name} is at ${result.balance}. Carry the code to the other device. SIMULATION.`;
      setStatus(line, 'ok');
      toast(line);
      await render();
      return;
    }
    if (!peer.privateKeyJwk) { setStatus('Unlock the wallet before signing.', 'bad'); return; }
    const result = await sim.createTransfer(store, seat, { toId: toId.value.trim(), amount: amount.value, note: note.value });
    if (!result.ok) { setStatus(result.error, 'bad'); return; }
    carryCode = result.encoded;
    carryAddress = address.value.trim();
    setStatus(`Signed. ${peer.name} is at ${result.balance}. Nothing was sent. Use copy, the QR, or your own text or mail app.`, 'ok');
    await render();
  });
  const incoming = h('textarea', { class: 'codebox', placeholder: 'Paste an lgme1. code, a share link, or tape JSON' });
  if (pendingImport) incoming.value = pendingImport;
  const file = h('input', { type: 'file', accept: 'application/json,.json' });
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    incoming.value = await chosen.text();
  });
  const preview = h('div', {});
  const video = h('video', { class: 'cam', playsinline: true, muted: true });
  video.hidden = true;
  const importForm = h('form', {}, [
    field('Incoming signed message', incoming),
    field('.json file', file),
    h('div', { class: 'actions' }, [
      h('button', { type: 'submit', class: 'primary' }, ['Verify']),
      h('button', { type: 'button', class: 'primary scan-prominent', onClick: () => startScan(video, incoming, preview) }, ['Scan QR'])
    ]),
    video,
    preview
  ]);
  importForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await previewIncoming(seat, incoming.value, preview);
  });
  const outbox = (peer.outbox || []).slice().reverse().map((item) => h('p', { class: 'legend' }, [`Outbox ${item.channel || 'local'} · ${item.kind} · ${item.amount || ''} ${item.toId || ''}`]));
  const inbox = (peer.inbox || []).slice().reverse().map((item) => h('p', { class: 'legend' }, [`Inbox ${item.kind} from ${item.fromId}`]));
  panel.replaceChildren(
    h('h2', {}, [`Another device · ${peer.name}`]),
    h('p', { class: 'muted' }, ['There is no server. Copy the code, open the share link, scan the QR, or save a .json file. On the other device, verify the signature and the hash before anything is appended. sms: and mailto: only open your own app. This page never sends the message.']),
    h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: () => download(`${seat}-tape.json`, JSON.stringify(sim.toExport(peer), null, 2), 'application/json') }, ['Export tape JSON'])]),
    h('h3', {}, ['Send mock $lgme']),
    form,
    shareHost,
    h('h3', {}, ['Receive']),
    importForm,
    h('h3', {}, ['Simulated log']),
    outbox.length ? h('div', {}, outbox) : h('p', { class: 'legend' }, ['Outbox is empty.']),
    inbox.length ? h('div', {}, inbox) : h('p', { class: 'legend' }, ['Inbox is empty.'])
  );
  if (carryCode) showShare(shareHost, seat, carryCode, carryAddress, 'signed lgme message');
  if (pendingImport) previewIncoming(seat, pendingImport, preview);
}

function showShare(host, seat, encoded, address, summary) {
  const link = pageUrl(encoded);
  const text = sim.shareText(summary, link);
  const hrefs = sim.shareHrefs(address, text);
  const qr = h('div', {});
  const box = h('textarea', { class: 'codebox', readonly: true }, [encoded]);
  const copy = h('button', { type: 'button', onClick: async () => {
    try { await navigator.clipboard.writeText(encoded); setStatus('Code copied. SIMULATION.', 'ok'); }
    catch { setStatus('Select the code and copy it yourself. SIMULATION.', 'bad'); }
  } }, ['Copy code']);
  const sms = h('a', { class: 'btn', href: hrefs.sms }, ['Open text app']);
  const mail = h('a', { class: 'btn', href: hrefs.mailto }, ['Open mail app']);
  const log = (channel) => () => { sim.logDispatch(store, seat, { kind: 'share', channel, simulated: true }); };
  sms.addEventListener('click', log('sms'));
  mail.addEventListener('click', log('mailto'));
  host.replaceChildren(
    h('p', { class: 'legend' }, ['SIMULATION. Nothing has been sent.']),
    box,
    h('div', { class: 'actions' }, [copy, sms, mail]),
    h('p', { class: 'codebox' }, [link]),
    qr
  );
  drawQr(qr, link);
}

async function previewIncoming(seat, raw, host) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return;
  if (trimmed.startsWith('{') && trimmed.includes('"tape"')) {
    const opened = await sim.openTape(trimmed);
    if (!opened.ok) { setStatus(opened.error, 'bad'); host.replaceChildren(h('p', { class: 'bad' }, [opened.error])); return; }
    host.replaceChildren(
      h('p', { class: 'ok' }, [`Tape verified for ${opened.peer.name}. Hash links and signatures match.`]),
      h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'primary', onClick: () => { pendingImport = trimmed; location.hash = 'reconcile'; } }, ['Compare in reconcile'])])
    );
    setStatus('Tape verified. It has not been appended to your book.', 'ok');
    return;
  }
  const opened = await sim.openMessage(trimmed);
  if (!opened.ok) { setStatus(opened.error, 'bad'); host.replaceChildren(h('p', { class: 'bad' }, [opened.error])); return; }
  const body = opened.message.body || {};
  host.replaceChildren(
    h('p', { class: 'ok' }, [`Signature and hash verified. ${opened.message.kind} from ${opened.message.fromId}.`]),
    h('p', {}, [body.amount ? `${body.amount} ${body.unit || ''} ${body.note || body.reference || ''}` : opened.message.kind]),
    h('div', { class: 'actions' }, [h('button', { type: 'button', class: 'primary', onClick: () => acceptIncoming(seat, trimmed) }, ['Append to this book'])])
  );
  setStatus('Verified. Nothing is appended until you confirm.', 'ok');
}

async function acceptIncoming(seat, raw) {
  const peer = await store.get(seat);
  if (!peer.privateKeyJwk) { setStatus('Unlock the wallet before appending.', 'bad'); return; }
  const result = await sim.importMessage(store, seat, raw);
  if (!result.ok) { setStatus(result.error, 'bad'); return; }
  pendingImport = '';
  setStatus(result.balance == null ? 'Imported. SIMULATION.' : `Imported. Balance ${result.balance}. SIMULATION.`, 'ok');
  await render();
}

async function startScan(video, incoming, preview, onFound) {
  stopAnyCamera();
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.jsQR) {
    setStatus('This browser has no camera reader. Paste the code instead. SIMULATION.', 'bad');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.hidden = false;
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let stopped = false;
    stopCamera = () => {
      stopped = true;
      stream.getTracks().forEach((track) => track.stop());
      video.hidden = true;
    };
    const tick = () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = globalThis.jsQR(image.data, image.width, image.height);
        if (found?.data) {
          incoming.value = found.data;
          stopAnyCamera();
          if (onFound) onFound(found.data);
          else previewIncoming(currentSeatId(), incoming.value, preview);
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch {
    setStatus('The camera was not opened. Paste the code instead. SIMULATION.', 'bad');
  }
}

function currentSeatId() {
  return sessionStorage.getItem(SEAT_KEY) || '';
}

function profileCard(profile) {
  return h('article', { class: 'card' }, [
    h('h3', {}, [`${profile.name} · Peer standing ${profile.standing}`]),
    h('p', { class: 'muted' }, [
      `${profile.status === 'VERIFIED' ? 'Verified' : 'Unverified'}. Account age ${profile.ageDays} day${profile.ageDays === 1 ? '' : 's'}. Clearing history ${profile.clearingCount}.`
    ]),
    h('p', { class: 'muted' }, [
      `${profile.balance} $lgme · floor ${profile.floor} · ${profile.aboveFloor} above the floor. Credit use versus the floor ${Math.round(profile.utilization * 100)}%. Rewards ${profile.rewards || 0} $lgme.${profile.held ? ` Held ${profile.held} $lgme.` : ''}`
    ])
  ]);
}

function coinMark() {
  const img = h('img', { class: 'coin', src: '/icons/icon-192.png', alt: '', width: '48', height: '48' });
  return h('picture', {}, [h('source', { srcset: '/icons/lgme-coin-192.webp', type: 'image/webp' }), img]);
}

const DONATE_ADDRESS = '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY';

function contributionMethods() {
  const copy = h('button', { type: 'button' }, ['Copy address']);
  copy.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(DONATE_ADDRESS);
    } catch { /* the address stays on screen */ }
    copy.textContent = 'Copied';
  });
  const qrHost = h('div', {});
  drawQr(qrHost, DONATE_ADDRESS);
  return h('section', { class: 'contrib' }, [
    h('h3', {}, ['soBeIT contributions']),
    h('p', { class: 'legend' }, ['Real token on Solana. Not financial advice. High risk; you may lose everything. Always verify the mint address. The in-app $lgme balances are a simulation and are not this token.']),
    h('article', { class: 'card pump-wallet' }, [
      h('h3', {}, ['Pump.fun wallet']),
      h('p', {}, ['Wallet name ', h('span', { class: 'wallet-name' }, ['@EgonAnon'])]),
      h('p', {}, ['Solana address']),
      h('p', { class: 'addr donate-address' }, [DONATE_ADDRESS]),
      h('div', { class: 'actions' }, [copy]),
      qrHost
    ]),
    h('article', { class: 'card x-money' }, [
      h('h3', {}, ['X Money']),
      h('p', {}, ['Send via X Money to ', h('a', { href: 'https://x.com/Trancesage' }, ['@Trancesage'])]),
      h('p', {}, ['This is a separate account from the Solana wallet.'])
    ])
  ]);
}

function coinPanel() {
  return h('article', { class: 'card', id: 'coin-panel' }, [
    h('div', { class: 'balance-hero' }, [coinMark(), h('div', {}, [h('strong', {}, ['$lgme']), 'Real token, separate from this book'])]),
    h('p', {}, [h('a', { href: '/lgme-coin' }, ['Mint and buy steps are on the coin page.'])]),
    contributionMethods()
  ]);
}

function passkeyCard() {
  const button = h('button', { type: 'button', id: 'passkey-unlock', onClick: () => startPasskey() }, ['Use this device']);
  return h('article', { class: 'card', id: 'passkey' }, [
    h('h3', {}, ['Unlock']),
    h('p', {}, [PASSKEY_WORDING]),
    h('p', { class: 'muted' }, ['SIMULATION. A passphrase is the fallback, and it is not a short PIN. The 6-digit code stays optional. Recovery codes are shown once.']),
    button
  ]);
}

async function startPasskey() {
  if (location.hostname !== 'lgme.app') {
    setStatus('This browser can use a passphrase here. The device unlock is for lgme.app. SIMULATION.', 'ok');
    return;
  }
  if (!globalThis.PublicKeyCredential) {
    setStatus('This browser has no device unlock. Use a passphrase. SIMULATION.', 'bad');
    return;
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const options = passkeyCreationOptions('lgme-sim', 'lgme', challenge);
  try {
    await navigator.credentials.create(options);
    freshAuth.set(sessionStorage.getItem(SEAT_KEY) || '', Date.now());
    setStatus('This device can unlock the book. SIMULATION. No real money moved.', 'ok');
  } catch {
    setStatus('The device did not unlock. Use a passphrase. SIMULATION.', 'bad');
  }
}

function soBeItCard(peers, seat) {
  const member = h('select', {}, peerOptions(peers.filter((item) => item.id !== seat), ''));
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', inputmode: 'decimal', value: '5' });
  const reason = h('input', { maxlength: '160', placeholder: 'Why this grant' });
  const form = h('form', { id: 'sobeit-form' }, [
    field('Member', member),
    field('Amount in $lgme', amount),
    field('Reason', reason),
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['soBeIT'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await sim.soBeItGrant(store, seat, member.value, { amount: amount.value, reason: reason.value });
    setStatus(result.ok ? `Simulated grant recorded. Balance ${result.balance}. No real funds moved.` : result.error, result.ok ? 'ok' : 'bad');
    if (result.ok) await render();
  });
  return h('article', { class: 'card', id: 'sobeit' }, [
    h('h3', {}, ['soBeIT']),
    h('p', { class: 'muted' }, ['A simulated grant on this tape. The grantor signs it. It is attested on the member book. It is not the Solana token.']),
    form,
    contributionMethods()
  ]);
}

function deskLinks() {
  const go = (name, label) => h('button', { type: 'button', onClick: () => { location.hash = name; } }, [label]);
  return h('div', { class: 'actions' }, [
    go('books', 'Ledger'),
    go('devices', 'Send'),
    go('exchange', 'Exchange'),
    go('reconcile', 'Reconcile'),
    go('help', 'Help'),
    go('resources', 'Resources')
  ]);
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lgme-sim-media', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files')) request.result.createObjectStore('files');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMediaFile(ownerId, privateKeyJwk, hash, bytes, mime) {
  const sealed = await sim.sealMediaBytes(privateKeyJwk, bytes);
  const db = await openMediaDb();
  const tx = db.transaction('files', 'readwrite');
  tx.objectStore('files').put({ iv: sealed.iv, ciphertext: sealed.ciphertext, mime, ownerId }, `${ownerId}:${hash}`);
  await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
  db.close();
}

async function loadMediaFile(ownerId, privateKeyJwk, hash) {
  if (!privateKeyJwk) return null;
  const db = await openMediaDb();
  const tx = db.transaction('files', 'readonly');
  const row = await idbRequest(tx.objectStore('files').get(`${ownerId}:${hash}`));
  db.close();
  if (!row) return null;
  return sim.openMediaBytes(privateKeyJwk, row);
}

function jpegFromCanvas(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      resolve({ bytes, dataUrl: canvas.toDataURL('image/jpeg', 0.7), mime: 'image/jpeg', duration: 0 });
    }, 'image/jpeg', 0.7);
  });
}

function drawFrame(source, max) {
  const width = source.videoWidth || source.naturalWidth || source.width || 640;
  const height = source.videoHeight || source.naturalHeight || source.height || 480;
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return jpegFromCanvas(canvas);
}

function recorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function showCapture(seat, link = {}) {
  stopAnyCamera();
  document.getElementById('capture')?.remove();
  const live = h('video', { class: 'cam', playsinline: true, muted: true, autoplay: true });
  const still = h('img', { class: 'preview', alt: 'Preview' });
  still.hidden = true;
  const clip = h('video', { class: 'preview', playsinline: true, controls: true });
  clip.hidden = true;
  const clock = h('p', { class: 'legend' }, ['']);
  const file = h('input', { type: 'file', accept: 'image/*,video/*', capture: 'environment' });
  let stream = null;
  let recorder = null;
  let facing = 'environment';
  let held = null;
  let urls = [];
  const overlay = h('div', { id: 'capture', class: 'capture', role: 'dialog', 'aria-label': 'Camera' });
  const shutter = h('button', { type: 'button', class: 'primary', id: 'shutter' }, ['Shutter']);
  const retake = h('button', { type: 'button', id: 'retake' }, ['Retake']);
  const save = h('button', { type: 'button', class: 'primary', id: 'save-media' }, ['Save']);
  retake.hidden = true;
  save.hidden = true;
  function stopStream() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (recorder && recorder.state === 'recording') recorder.stop();
  }
  async function openLens() {
    stopStream();
    held = null;
    still.hidden = true;
    clip.hidden = true;
    live.hidden = false;
    retake.hidden = true;
    save.hidden = true;
    shutter.hidden = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
      live.srcObject = stream;
      await live.play();
      stopCamera = stopStream;
      clock.textContent = 'Nothing is uploaded. Photos are compressed. Video stays under 30 seconds.';
    } catch {
      clock.textContent = 'The camera did not open. Pick a file instead. Nothing was uploaded.';
    }
  }
  function hold(next) {
    held = next;
    live.hidden = true;
    shutter.hidden = true;
    retake.hidden = false;
    save.hidden = false;
    stopStream();
    if (next.mime.startsWith('video')) {
      const url = URL.createObjectURL(new Blob([next.bytes], { type: next.mime }));
      urls.push(url);
      clip.src = url;
      clip.hidden = false;
      still.hidden = true;
    } else {
      still.src = next.dataUrl;
      still.hidden = false;
      clip.hidden = true;
    }
  }
  shutter.addEventListener('click', async () => {
    if (shutter.textContent === 'Stop') {
      if (recorder && recorder.state === 'recording') recorder.stop();
      return;
    }
    if (shutter.dataset.mode === 'video') {
      const mime = recorderMime();
      if (!stream || !mime) { setStatus('This browser cannot record video. Take a photo instead.', 'bad'); return; }
      const chunks = [];
      const started = Date.now();
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 500000 });
      recorder.ondataavailable = (event) => { if (event.data && event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        const duration = Math.min(30, Math.round((Date.now() - started) / 100) / 10);
        const bytes = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
        shutter.textContent = 'Record';
        hold({ bytes, mime, duration, dataUrl: '' });
      };
      recorder.start();
      shutter.textContent = 'Stop';
      const tick = setInterval(() => {
        const left = Math.max(0, 30 - Math.floor((Date.now() - started) / 1000));
        clock.textContent = `${left}s left. Nothing is uploaded.`;
        if (left <= 0 && recorder && recorder.state === 'recording') recorder.stop();
        if (!recorder || recorder.state !== 'recording') clearInterval(tick);
      }, 250);
      return;
    }
    if (live.readyState < 2) { setStatus('The camera is not ready.', 'bad'); return; }
    hold(await drawFrame(live, 960));
  });
  file.addEventListener('change', async () => {
    const chosen = file.files && file.files[0];
    if (!chosen) return;
    if (chosen.type.startsWith('video')) {
      if (chosen.size > 8 * 1024 * 1024) { setStatus('That video is too large to keep on this phone.', 'bad'); return; }
      const url = URL.createObjectURL(chosen);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.src = url;
      const duration = await new Promise((resolve) => { probe.onloadedmetadata = () => resolve(probe.duration); probe.onerror = () => resolve(0); });
      URL.revokeObjectURL(url);
      if (duration > 30.5) { setStatus('Keep the video under 30 seconds.', 'bad'); return; }
      hold({ bytes: new Uint8Array(await chosen.arrayBuffer()), mime: chosen.type || 'video/webm', duration: Math.round(duration * 10) / 10, dataUrl: '' });
      return;
    }
    const bitmap = await createImageBitmap(chosen);
    hold(await drawFrame(bitmap, 960));
    bitmap.close?.();
  });
  retake.addEventListener('click', () => openLens());
  save.addEventListener('click', async () => {
    if (!held) return;
    const peer = await store.get(seat);
    if (!peer?.privateKeyJwk) { setStatus('Unlock the wallet before saving.', 'bad'); return; }
    const made = link.defer ? null : await sim.recordMedia(store, seat, {
      bytes: held.bytes,
      mime: held.mime,
      size: held.bytes.byteLength,
      duration: held.duration,
      listingId: link.listingId || null,
      threadId: link.threadId || null
    });
    if (made && !made.ok) { setStatus(made.error, 'bad'); return; }
    if (made?.ok) await saveMediaFile(seat, peer.privateKeyJwk, made.hash, held.bytes, held.mime);
    if (link.threadId && made?.ok && link.toId) {
      const sent = await sim.composeChat(store, seat, {
        toId: link.toId,
        toPhone: link.toPhone || '',
        threadId: link.threadId,
        text: held.mime.startsWith('video') ? 'Video' : 'Photo',
        media: { ...made.core, sig: made.sig, ownerId: seat }
      });
      if (!sent.ok) setStatus(sent.error, 'bad');
    }
    if (link.onDraft) link.onDraft({ ...held, hash: made?.hash || await sim.hashBytes(held.bytes) });
    urls.forEach((url) => URL.revokeObjectURL(url));
    stopStream();
    overlay.remove();
    setStatus('Saved on this phone, encrypted. Only the hash is on the tape. Nothing was uploaded. SIMULATION.', 'ok');
    if (link.onSaved) await link.onSaved();
  });
  overlay.append(
    live, still, clip, clock,
    h('div', { class: 'bar' }, [
      h('button', { type: 'button', onClick: () => { shutter.dataset.mode = 'photo'; shutter.textContent = 'Shutter'; } }, ['Photo']),
      h('button', { type: 'button', onClick: () => { shutter.dataset.mode = 'video'; shutter.textContent = 'Record'; } }, ['Video']),
      h('button', { type: 'button', onClick: () => { facing = facing === 'environment' ? 'user' : 'environment'; openLens(); } }, ['Switch']),
      shutter, retake, save,
      file,
      h('button', { type: 'button', onClick: () => { urls.forEach((url) => URL.revokeObjectURL(url)); stopStream(); overlay.remove(); } }, ['Close'])
    ])
  );
  document.body.append(overlay);
  openLens();
}

async function mediaSlides(ownerId, records) {
  const owner = await store.get(ownerId);
  const slides = [];
  for (const record of records) {
    if (!owner?.privateKeyJwk || record.ownerId && record.ownerId !== ownerId) continue;
    const bytes = await loadMediaFile(ownerId, owner.privateKeyJwk, record.hash);
    if (!bytes) continue;
    const url = URL.createObjectURL(new Blob([bytes], { type: record.mime || 'image/jpeg' }));
    const view = String(record.mime || '').startsWith('video')
      ? h('video', { controls: true, playsinline: true, src: url })
      : h('img', { alt: '', src: url });
    slides.push(h('div', { class: 'slide' }, [
      view,
      h('button', { type: 'button', onClick: async () => {
        const checked = await sim.verifyMedia(owner, { ...record, publicKeyJwk: owner.publicKeyJwk }, bytes);
        setStatus(checked.authentic ? 'Verified. The file matches the tape.' : 'Not authentic', checked.authentic ? 'ok' : 'bad');
      } }, ['Verify'])
    ]));
  }
  return slides;
}

async function chatMediaBubble(seat, line) {
  const who = line.senderId === seat ? 'You' : (nameById[line.senderId] || 'Member');
  const nodes = [h('div', {}, [`${who}: ${line.text}`])];
  if (line.media?.hash) {
    const owner = await store.get(line.senderId);
    const bytes = owner?.privateKeyJwk ? await loadMediaFile(line.senderId, owner.privateKeyJwk, line.media.hash) : null;
    if (bytes) {
      const url = URL.createObjectURL(new Blob([bytes], { type: line.media.mime || 'image/jpeg' }));
      nodes.push(String(line.media.mime).startsWith('video')
        ? h('video', { controls: true, playsinline: true, src: url })
        : h('img', { alt: '', src: url }));
    }
    nodes.push(h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: async () => {
        if (!bytes || !owner) { setStatus('Not authentic', 'bad'); return; }
        const checked = await sim.verifyMedia(owner, { ...line.media, publicKeyJwk: owner.publicKeyJwk }, bytes);
        setStatus(checked.authentic ? 'Verified. The file matches the tape.' : 'Not authentic', checked.authentic ? 'ok' : 'bad');
      } }, ['Verify']),
      bytes ? h('button', { type: 'button', onClick: () => shareMediaFile(bytes, line.media.mime, `SIMULATION lgme. Media ${line.media.hash.slice(0, 12)}. This page does not upload it.`) }, ['Share']) : null
    ]));
  }
  return h('div', { class: 'bubble media-bubble', id: line.media?.hash ? 'chat-media' : undefined }, nodes.filter(Boolean));
}

async function shareMediaFile(bytes, mime, text) {
  const file = new File([bytes], mime.startsWith('video') ? 'lgme-video.webm' : 'lgme-photo.jpg', { type: mime || 'image/jpeg' });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({ files: [file], text, title: 'SIMULATION lgme' });
      setStatus('Handed to your phone’s share sheet. This page did not upload it. SIMULATION.', 'ok');
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }
  setStatus('This browser will not hand the file to another app. Send the signed text, then save the file on the other phone. Nothing was uploaded.', 'ok');
}

async function compressPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const max = 480;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const photo = canvas.toDataURL('image/jpeg', 0.72);
  return { photo, photoHash: await sim.sha256(photo) };
}

function chip(label, on, click) {
  return h('button', { type: 'button', class: 'chip', 'aria-pressed': on ? 'true' : 'false', onClick: click }, [label]);
}

function offerCards(peer, seat) {
  const rows = Object.values(peer.offers || {});
  if (!rows.length) return [];
  return [
    h('h3', {}, ['Offers']),
    h('p', { class: 'legend' }, ['A contract waits for both signatures. Collection is a reminder and a reconciliation. There is no penalty. SIMULATION.']),
    ...rows.map((offer) => h('article', { class: 'card', id: `offer-${offer.id.slice(0, 8)}` }, [
      h('h3', {}, [`${offer.title} · ${offer.status}`]),
      offer.thanks ? h('p', {}, [offer.thanks]) : null,
      offer.external ? h('p', { class: 'legend' }, [sim.offerupDraft(offer)]) : null,
      offer.status === 'awaiting' && !offer.consents?.[seat]
        ? h('button', { type: 'button', class: 'primary', onClick: async () => {
          const result = await sim.countersignOffer(store, seat, offer.id, { automate: true });
          setStatus(result.ok ? (result.contract ? 'Both signed. The contract is on both tapes. Nothing was sent. SIMULATION.' : result.error || 'Signed.') : result.error, result.ok ? 'ok' : 'bad');
          if (result.ok) await render();
        } }, ['Sign consent'])
        : null,
      offer.status === 'contract'
        ? h('button', { type: 'button', onClick: async () => {
          const result = await sim.consentContractDonation(store, seat, offer.id);
          setStatus(result.closed ? result.message : 'Your consent is signed. The other party still has to consent. No penalty. SIMULATION.', result.ok ? 'ok' : 'bad');
          if (result.ok) await render();
        } }, ['Reconcile as donation to the floor'])
        : null
    ]))
  ];
}

function offerForm(seat, target, serviceList = []) {
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: target.amount != null ? String(target.amount) : '' });
  const mode = h('select', {}, [
    option('full', 'Cash in full', true),
    option('3', 'Term payments, 3 months', false),
    option('4', 'Term payments, 4 months', false),
    option('5', 'Term payments, 5 months', false),
    option('6', 'Term payments, 6 months', false),
    option('service', 'IprovIT service only', false)
  ]);
  const preview = h('p', { class: 'legend' }, ['']);
  const services = catalogServices(serviceList);
  function paint() {
    const choice = mode.value;
    if (choice !== 'full' && choice !== 'service') {
      const built = sim.termSchedule(amount.value, Number(choice), new Date().toISOString());
      preview.textContent = built.ok
        ? built.installments.map((row) => `${row.n}. ${row.amount} due ${row.dueAt.slice(0, 10)}`).join(' · ')
        : built.error;
      return;
    }
    preview.textContent = choice === 'full' ? 'Cash in full. No installment is written until both parties sign.' : 'Pick one or more IprovIT services. The value stays simulated.';
  }
  mode.addEventListener('change', paint);
  amount.addEventListener('input', paint);
  paint();
  const form = h('form', { id: 'offer-form' }, [
    h('h3', {}, ['Offer on this item']),
    h('p', { class: 'legend' }, ['SIMULATION. Both parties sign before a contract exists. An OfferUp draft is copied by hand. Nothing is sent.']),
    field('Amount', amount),
    field('How to pay', mode),
    services.box,
    preview,
    h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, [target.external ? 'Copy draft offer' : 'Sign consent'])])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const choice = mode.value;
      const result = await sim.signOffer(store, seat, {
        listingId: target.listingId || '',
        external: target.external || null,
        toId: target.toId || '',
        cashMode: choice === 'service' ? '' : choice === 'full' ? 'full' : 'terms',
        months: ['3', '4', '5', '6'].includes(choice) ? Number(choice) : 0,
        amount: amount.value,
        serviceIds: services.selected(),
        automate: choice !== 'full' && choice !== 'service'
      });
      if (!result.ok) { setStatus(result.error, 'bad'); return; }
      if (result.draft) {
        try { await navigator.clipboard.writeText(result.draft); } catch { /* the draft stays on screen */ }
        setStatus('Draft offer copied. Nothing was sent. Paste it on OfferUp yourself. SIMULATION.', 'ok');
      } else {
        setStatus(result.contract ? 'Both signed. SIMULATION.' : 'Your consent is signed. The other party still has to sign. Nothing was sent. SIMULATION.', 'ok');
      }
      openOfferFor = '';
      offerupIndex = -1;
      await render();
    } finally {
      busy = false;
    }
  });
  return form;
}

function catalogServices(list) {
  const boxes = (list || []).map((item) => {
    const box = h('input', { type: 'checkbox', value: item.id });
    return { box, id: item.id, title: `${item.title} · ${item.amount} $lgme` };
  });
  return {
    selected: () => boxes.filter((row) => row.box.checked).map((row) => row.id),
    box: h('fieldset', {}, [
      h('legend', {}, ['IprovIT services']),
      boxes.length
        ? h('p', { class: 'legend', id: 'iprov-services' }, ['Services listed as IprovIT can be offered in place of cash. In-app $lgme stays simulated.'])
        : h('p', { class: 'legend', id: 'iprov-services' }, ['No IprovIT services are listed yet.']),
      ...boxes.map((row) => h('label', { class: 'row' }, [row.box, ` ${row.title}`]))
    ])
  };
}

const WANTED_TRACK = 'lgme-sim:wanted-tracker';

function readWantedTracker() {
  try { return JSON.parse(localStorage.getItem(WANTED_TRACK) || '{}'); } catch { return {}; }
}

function wantedTrack(url) {
  const row = readWantedTracker()[url];
  return {
    status: sim.WANTED_STATUSES.includes(row?.status) ? row.status : 'Available',
    notes: Array.isArray(row?.notes) ? row.notes : [],
    concluded: Boolean(row?.concluded),
    receiptId: row?.receiptId || ''
  };
}

function patchWanted(url, patch) {
  const all = readWantedTracker();
  const next = { ...wantedTrack(url), ...patch };
  all[url] = next;
  localStorage.setItem(WANTED_TRACK, JSON.stringify(all));
  return next;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function wantedMatchSection(seat) {
  const cards = wantedMatches.map((item, index) => {
    const track = wantedTrack(item.url);
    const status = h('select', {}, sim.WANTED_STATUSES.map((name) => option(name, name, track.status === name)));
    status.addEventListener('change', () => { patchWanted(item.url, { status: status.value }); render(); });
    const reply = h('input', { maxlength: '240', placeholder: 'Seller reply' });
    return h('article', { class: 'card', id: `wanted-match-${index}` }, [
      offerupImage(item),
      h('h3', {}, [item.title || 'Match']),
      h('p', { class: 'price' }, [item.price || '']),
      h('p', {}, [`${track.status} · ${item.city || 'DC area'}`]),
      h('p', { class: 'legend' }, [sim.OFFERUP_CAVEAT]),
      field('Availability', status),
      track.notes.length ? h('ul', {}, track.notes.map((note) => h('li', {}, [`${note.at.slice(0, 16)} ${note.text}`]))) : null,
      field('Log a reply', reply),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', onClick: () => {
          const text = reply.value.trim();
          if (!text) return;
          const notes = wantedTrack(item.url).notes.concat([{ at: new Date().toISOString(), text }]);
          patchWanted(item.url, { notes, status: wantedTrack(item.url).status === 'Available' ? 'Pending reply' : wantedTrack(item.url).status });
          render();
        } }, ['Log reply']),
        h('button', { type: 'button', onClick: async () => {
          const draft = sim.wantedMatchDraft(item);
          await copyText(draft);
          patchWanted(item.url, { status: 'Offer made' });
          setStatus('Draft offer copied. Nothing was sent. Paste it on OfferUp yourself. SIMULATION.', 'ok');
          render();
        } }, ['Make an offer']),
        h('a', { class: 'btn', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, ['Continue on OfferUp']),
        h('button', { type: 'button', onClick: async () => {
          const text = sim.inviteSellerText(item);
          await copyText(text);
          if (navigator.share) {
            try { await navigator.share({ title: 'lgme.app', text, url: sim.INVITE_URL }); } catch (error) { if (error && error.name === 'AbortError') return; }
          }
          patchWanted(item.url, { status: 'Pending reply' });
          setStatus('Invite copied. Nothing was sent. SIMULATION.', 'ok');
          render();
        } }, ['Invite seller to lgme.app']),
        h('button', { type: 'button', onClick: async () => {
          const result = await sim.concludeWantedMatch(store, seat, item);
          if (!result.ok) { setStatus(result.error, 'bad'); return; }
          patchWanted(item.url, { status: 'Closed', concluded: true, receiptId: result.receiptId });
          setStatus('Concluded. IdidIt is on this book. Invoice from the book, or reconcile as donation to the floor. SIMULATION. Nothing was sent.', 'ok');
          location.hash = 'books';
        } }, ['Mark concluded'])
      ])
    ]);
  });
  return h('section', { id: 'wanted-matches' }, [
    h('h3', {}, ['Matches from OfferUp']),
    h('p', { class: 'legend' }, [`For “${sim.STANDING_WANTED.title}”. SIMULATION. Nothing is sent.`]),
    cards.length ? h('div', { class: 'grid' }, cards) : h('p', { class: 'empty', id: 'wanted-matches-empty' }, ['No OfferUp matches in this file yet.'])
  ]);
}

function offerupImage(item) {
  const img = h('img', { alt: '', src: item.image || '/icons/icon-192.png' });
  img.addEventListener('error', () => {
    if (img.dataset.fallback === '1') return;
    img.dataset.fallback = '1';
    img.src = '/icons/icon-192.png';
  });
  return img;
}

function offerupSection(seat, serviceList) {
  const cards = offerupItems.map((item, index) => h('article', { class: 'card', id: `offerup-${index}` }, [
    offerupImage(item),
    h('h3', {}, [item.title]),
    h('p', { class: 'price' }, [item.price]),
    h('p', {}, [`${sim.offerupKindLabel(item.kind)} · ${item.city || 'DC area'}`]),
    h('p', { class: 'legend' }, [sim.OFFERUP_CAVEAT]),
    h('p', { class: 'muted' }, [`As of ${item.sourcedAt || 'pending'}`]),
    h('div', { class: 'actions' }, [
      h('span', {}, ['Buy']),
      h('button', { type: 'button', onClick: () => { offerupIndex = index; openOfferFor = ''; render(); } }, ['Make an offer']),
      h('a', { class: 'btn primary', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, ['Continue on OfferUp'])
    ]),
    offerupIndex === index ? offerForm(seat, { external: item, amount: sim.offerupAmount(item.price), title: item.title }, serviceList) : null
  ]));
  return h('section', { id: 'offerup-dc' }, [
    h('h3', {}, ['Found on OfferUp (DC area)']),
    cards.length ? h('div', { class: 'grid' }, cards) : h('p', { class: 'empty', id: 'offerup-empty' }, ['No OfferUp listings in this file yet.'])
  ]);
}

async function renderMarket(peers, seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const me = peers.find((peer) => peer.id === seat);
  if (openListingId) {
    const cards = await sim.marketFeed(store, {}, new Date().toISOString());
    const card = cards.find((item) => item.id === openListingId);
    if (!card) {
      openListingId = '';
    } else {
      const seller = await store.get(card.sellerId);
      const serviceList = await sim.marketFeed(store, { kind: 'IprovIT' });
      const profile = sim.peerProfile(seller);
      const slides = await mediaSlides(card.sellerId, sim.listMedia(seller, { listingId: card.id }).filter((record) => !record.ownerId || record.ownerId === card.sellerId));
      const gallery = h('div', { class: 'carousel', id: 'listing-gallery' }, [
        ...slides,
        card.photo ? h('div', { class: 'slide' }, [h('img', { class: 'shot', alt: '', src: card.photo })]) : null
      ].filter(Boolean));
      const actions = [];
      const wantedPin = card.title === sim.STANDING_WANTED.title;
      if (card.pinned && !wantedPin) {
        actions.push(h('a', { class: 'btn primary', id: 'donation-link', href: card.href || '/lgme-coin' }, [card.action || 'Receive / send $lgme']));
      } else if (card.sellerId === seat && !wantedPin) {
        actions.push(h('button', { type: 'button', class: 'primary', onClick: async () => {
          const refreshed = await sim.refreshListing(store, seat, card.id);
          setStatus(refreshed.ok ? 'Listing refreshed with a signed heartbeat. SIMULATION.' : refreshed.error, refreshed.ok ? 'ok' : 'bad');
          if (refreshed.ok) await render();
        } }, ['Refresh']));
      } else if (!wantedPin) {
        actions.push(h('button', { type: 'button', class: 'primary', onClick: async () => {
          const chat = await sim.openChat(store, seat, card.id);
          if (!chat.ok) { setStatus(chat.error, 'bad'); return; }
          openThreadId = chat.thread.id;
          location.hash = 'chats';
        } }, ['Chat']));
        actions.push(h('button', { type: 'button', id: 'offer-on-item', onClick: () => { offerupIndex = -1; openOfferFor = card.id; render(); } }, ['Offer on this item']));
      }
      panel.replaceChildren(...[
        h('button', { type: 'button', class: 'quiet', onClick: () => { openListingId = ''; render(); } }, ['Back to the market']),
        h('h2', {}, [card.title]),
        gallery,
        card.sellerId === seat ? h('div', { class: 'actions' }, [h('button', { type: 'button', id: 'listing-camera', onClick: () => showCapture(seat, { listingId: card.id, onSaved: () => render() }) }, ['Camera'])]) : null,
        card.pinned && !wantedPin ? h('p', { id: 'donation-copy' }, [card.description]) : null,
        wantedPin ? h('p', { id: 'wanted-copy' }, [card.description]) : null,
        wantedPin ? h('ul', { id: 'wanted-payments' }, sim.STANDING_WANTED.payments.map((item) => h('li', {}, [item]))) : null,
        !card.pinned ? h('p', { class: 'price' }, [`${card.amount} $lgme`]) : null,
        card.pinned && !wantedPin ? h('p', { class: 'legend' }, ['SIMULATION. A soBeIT grant below stays on this tape. The link above is the real token page.']) : null,
        wantedPin ? h('p', { class: 'legend' }, ['SIMULATION. In-app $lgme stays simulated. A concluded match is an IdidIt on this book. Reconcile as donation to the floor needs both consents.']) : null,
        card.pinned && !wantedPin ? soBeItCard(peers, seat) : null,
        wantedPin ? wantedMatchSection(seat) : null,
        h('p', {}, [
          h('span', { class: card.verified ? 'badge badge-verified' : 'badge badge-unverified' }, [card.verified ? 'Verified' : 'Unverified']),
          ` ${card.sellerName} · ${card.circle} · Peer standing ${card.standing}`
        ]),
        h('p', { class: 'muted' }, [`${card.condition} · ${card.pickup}${card.area ? ' · ' + card.area : ''}`]),
        card.referenceAvg == null ? null : h('p', { class: 'legend' }, [`Reference only, not a price. About ${card.referenceAvg}.`]),
        h('p', { class: 'legend' }, [card.signatureOk ? `Origin ${shortHash(card.originHash)} verifies.` : 'Origin hash does not verify.']),
        profileCard(profile),
        openOfferFor === card.id ? offerForm(seat, { listingId: card.id, title: card.title, amount: card.amount, toId: card.sellerId === seat ? '' : card.sellerId }, serviceList) : null,
        h('div', { class: 'actions' }, actions)
      ].filter(Boolean));
      return;
    }
  }
  await sim.ensureStandingDonation(store);
  await sim.ensureStandingWanted(store);
  const feed = await sim.marketFeed(store, marketQuery);
  const serviceList = await sim.marketFeed(store, { kind: 'IprovIT' });
  const search = h('input', { type: 'search', placeholder: 'Search', value: marketQuery.q, autocomplete: 'off' });
  const condition = h('select', {}, [option('', 'Any condition', !marketQuery.condition), ...CONDITIONS.map((item) => option(item, item, marketQuery.condition === item))]);
  const pickup = h('select', {}, [option('', 'Any pickup', !marketQuery.pickup), ...PICKUPS.map((item) => option(item, item, marketQuery.pickup === item))]);
  const circle = h('select', {}, [option('', 'Any circle', !marketQuery.circle), ...['Walkway', 'Soil', 'Logistics'].map((item) => option(item, item, marketQuery.circle === item))]);
  const min = h('input', { inputmode: 'decimal', placeholder: 'Min', value: marketQuery.min });
  const max = h('input', { inputmode: 'decimal', placeholder: 'Max', value: marketQuery.max });
  const form = h('form', { class: 'grid two' }, [
    field('Search', search),
    field('Condition', condition),
    field('Pickup', pickup),
    field('Circle', circle),
    field('Min $lgme', min),
    field('Max $lgme', max),
    h('div', { class: 'actions' }, [
      h('button', { class: 'primary', type: 'submit' }, ['Filter']),
      h('button', { type: 'button', onClick: () => { marketQuery = { q: '', kind: '', category: '', condition: '', pickup: '', circle: '', min: '', max: '' }; render(); } }, ['Clear'])
    ])
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    marketQuery = { ...marketQuery, q: search.value, condition: condition.value, pickup: pickup.value, circle: circle.value, min: min.value, max: max.value };
    render();
  });
  const kinds = h('div', { class: 'chips', id: 'kind-pills' }, [
    chip('All', !marketQuery.kind, () => { marketQuery.kind = ''; render(); }),
    chip('ihavIT', marketQuery.kind === 'ihavIT', () => { marketQuery.kind = 'ihavIT'; render(); }),
    chip('IwanIT', marketQuery.kind === 'IwanIT', () => { marketQuery.kind = 'IwanIT'; render(); }),
    chip('IprovIT', marketQuery.kind === 'IprovIT', () => { marketQuery.kind = 'IprovIT'; render(); })
  ]);
  const pills = h('div', { class: 'chips' }, [
    chip('All', !marketQuery.category, () => { marketQuery.category = ''; render(); }),
    ...CATEGORIES.map((item) => chip(item, marketQuery.category === item, () => { marketQuery.category = item; render(); }))
  ]);
  const grid = h('div', { class: 'market-grid', id: 'market-grid' }, feed.map((card) => h('button', {
    type: 'button',
    class: 'card market-card',
    id: card.title === sim.STANDING_DONATION.title ? 'donation-card' : card.title === sim.STANDING_WANTED.title ? 'wanted-card' : undefined,
    onClick: () => { openListingId = card.id; render(); }
  }, [
    h('img', { alt: '', src: card.photo || '' }),
    h('h3', {}, [card.title]),
    card.pinned ? h('p', { class: 'muted' }, [card.description]) : h('div', { class: 'price' }, [`${card.amount} $lgme`]),
    card.title === sim.STANDING_WANTED.title ? h('p', { class: 'legend' }, [sim.STANDING_WANTED.payments.join(' · ')]) : null,
    card.pinned ? h('span', { class: 'badge badge-verified' }, [card.action || 'Receive / send $lgme']) : null,
    h('div', {}, [h('span', { class: card.verified ? 'badge badge-verified' : 'badge badge-unverified' }, [card.verified ? 'Verified' : 'Unverified'])]),
    h('small', { class: 'meta' }, [`${card.circle} · Peer standing ${card.standing}`])
  ])));
  const mine = await store.get(seat);
  const standing = mine ? sim.peerProfile(mine) : null;
  const filters = h('details', {}, [h('summary', {}, ['Filters']), form]);
  panel.replaceChildren(
    h('h2', {}, ['Market']),
    h('p', { class: 'muted' }, [`Ad-free. ${me ? me.name : 'You'} · Peer standing ${standing ? standing.standing : ''}. Nothing here is a paid placement. SIMULATION.`]),
    kinds,
    pills,
    filters,
    feed.length ? grid : h('p', { class: 'empty' }, ['No listings match. List one, or clear the filters.']),
    !marketQuery.kind || marketQuery.kind === 'IwanIT' ? wantedMatchSection(seat) : null,
    offerupSection(seat, serviceList),
    referenceCatalogCard(),
    standing ? profileCard(standing) : null
  );
}

async function renderCircles() {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const circles = await sim.circlesOf(store);
  panel.replaceChildren(
    h('h2', {}, ['Circles']),
    h('p', { class: 'muted' }, ['A circle is a mutual-credit ring or a peer group. It is not a map. An area phrase is only text.']),
    circles.length ? h('div', { class: 'grid' }, circles.map((circle) => h('button', {
      type: 'button',
      class: 'card',
      onClick: () => { marketQuery = { ...marketQuery, circle: circle.name, category: '' }; openListingId = ''; location.hash = 'market'; }
    }, [
      h('h3', {}, [circle.name]),
      h('p', { class: 'muted' }, [`${circle.listings} listing${circle.listings === 1 ? '' : 's'} · ${circle.members.length} member${circle.members.length === 1 ? '' : 's'}`]),
      circle.area ? h('p', { class: 'legend' }, [circle.area]) : null
    ]))) : h('p', { class: 'empty' }, ['No circles yet. A listing names one.'])
  );
}

async function renderList(seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const peer = await store.get(seat);
  if (!peer?.privateKeyJwk) {
    panel.replaceChildren(h('h2', {}, ['List']), h('p', { class: 'muted' }, ['Unlock the wallet before signing a listing.']));
    return;
  }
  const steps = h('p', { class: 'kicker' }, [`Step ${listStep} of 3`]);
  if (listStep === 1) {
    const file = h('input', { type: 'file', accept: 'image/*,video/*', capture: 'environment' });
    const video = h('video', { class: 'cam', playsinline: true, muted: true });
    video.hidden = true;
    file.addEventListener('change', async () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      try {
        const packed = await compressPhoto(chosen);
        listDraft = { ...listDraft, ...packed };
        setStatus('Photo compressed on this device. It is not uploaded. SIMULATION.', 'ok');
        await render();
      } catch {
        setStatus('That photo could not be read. Nothing was stored.', 'bad');
      }
    });
    panel.replaceChildren(
      h('h2', {}, ['List']),
      steps,
      h('p', { class: 'muted' }, ['Take a photo or choose one. It is scaled down in this browser and kept on the listing locally.']),
      listDraft.photo ? h('img', { class: 'shot', alt: '', src: listDraft.photo }) : null,
      field('Photo', file),
      video,
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', id: 'list-camera', onClick: () => showCapture(seat, {
          defer: true,
          onDraft: (held) => { listDraft = { ...listDraft, photo: held.dataUrl || listDraft.photo, photoHash: held.hash, mediaBytes: held.bytes, mediaMime: held.mime, mediaDuration: held.duration }; },
          onSaved: () => render()
        }) }, ['Camera']),
        h('button', { type: 'button', class: 'primary', onClick: async () => {
          if (video.readyState >= 2) {
            const canvas = document.createElement('canvas');
            const max = 480;
            const scale = Math.min(1, max / Math.max(video.videoWidth || 320, video.videoHeight || 240));
            canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
            canvas.height = Math.max(1, Math.round((video.videoHeight || 240) * scale));
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            const photo = canvas.toDataURL('image/jpeg', 0.72);
            listDraft = { ...listDraft, photo, photoHash: await sim.sha256(photo) };
            stopAnyCamera();
          }
          if (!listDraft.photoHash) { setStatus('Add a photo first.', 'bad'); return; }
          listStep = 2;
          await render();
        } }, ['Next'])
      ])
    );
    return;
  }
  if (listStep === 2) {
    const title = h('input', { required: true, maxlength: '80', value: listDraft.title });
    const kind = h('select', {}, sim.LISTING_KINDS.map((item) => option(item, item === 'ihavIT' ? 'ihavIT · I have it' : item === 'IwanIT' ? 'IwanIT · I want it' : 'IprovIT · I provide it', (listDraft.kind || 'ihavIT') === item)));
    const category = h('select', {}, CATEGORIES.map((item) => option(item, item, listDraft.category === item)));
    const condition = h('select', {}, CONDITIONS.map((item) => option(item, item, listDraft.condition === item)));
    const pickup = h('select', {}, PICKUPS.map((item) => option(item, item, listDraft.pickup === item)));
    const circle = h('input', { required: true, maxlength: '40', value: listDraft.circle, placeholder: 'Walkway, Soil, Logistics…' });
    const area = h('input', { maxlength: '80', value: listDraft.area, placeholder: 'Optional area phrase' });
    const form = h('form', {}, [
      field('Title', title),
      field('Kind', kind),
      field('Category', category),
      field('Condition', condition),
      field('Pickup', pickup),
      field('Circle', circle),
      field('Area, optional', area),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', onClick: () => { listStep = 1; render(); } }, ['Back']),
        h('button', { class: 'primary', type: 'submit' }, ['Next'])
      ])
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      listDraft = { ...listDraft, title: title.value.trim(), kind: kind.value, category: category.value, condition: condition.value, pickup: pickup.value, circle: circle.value.trim(), area: area.value.trim() };
      if (!listDraft.title || !listDraft.circle) { setStatus('Add a title and a circle.', 'bad'); return; }
      listStep = 3;
      render();
    });
    panel.replaceChildren(h('h2', {}, ['List']), steps, h('p', { class: 'muted' }, ['Name the item, its condition, how it changes hands, and which circle it belongs to.']), form);
    return;
  }
  const amount = h('input', { inputmode: 'decimal', required: true, value: listDraft.amount, placeholder: '0.00' });
  const reference = h('select', {}, [option('', 'No dollar reference', !listDraft.referenceId), ...catalog.map((item) => option(item.id, optionLabel(item, catalogMeta), listDraft.referenceId === item.id))]);
  const hint = h('p', { class: 'legend' }, [catalogNotice]);
  function paintHint() {
    const item = catalog.find((row) => row.id === reference.value);
    hint.textContent = item ? referenceDetail(item) : catalogNotice;
  }
  reference.addEventListener('change', paintHint);
  paintHint();
  const form = h('form', {}, [
    field('Value in $lgme', amount),
    field('Optional $ reference', reference),
    hint,
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => {
        const item = catalog.find((row) => row.id === reference.value);
        if (item && item.avg_value_usd != null) amount.value = String(item.avg_value_usd);
      } }, ['Use the reference number']),
      h('button', { type: 'button', onClick: () => { listStep = 2; render(); } }, ['Back']),
      h('button', { class: 'primary', type: 'submit' }, ['Sign and list'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const item = catalog.find((row) => row.id === reference.value);
      const created = await sim.createListing(store, seat, {
        ...listDraft,
        amount: amount.value,
        referenceId: item ? item.id : null,
        referenceAvg: item ? item.avg_value_usd : null
      });
      if (!created.ok) { setStatus(created.error, 'bad'); return; }
      if (listDraft.mediaBytes) {
        const made = await sim.recordMedia(store, seat, { bytes: listDraft.mediaBytes, mime: listDraft.mediaMime, duration: listDraft.mediaDuration || 0, listingId: created.listing.id });
        const peer = await store.get(seat);
        if (made.ok && peer?.privateKeyJwk) await saveMediaFile(seat, peer.privateKeyJwk, made.hash, listDraft.mediaBytes, listDraft.mediaMime);
      }
      listDraft = { photo: '', photoHash: '', title: '', category: 'Goods', condition: 'Good', pickup: 'Pickup', circle: '', area: '', amount: '', referenceId: '' };
      listStep = 1;
      openListingId = created.listing.id;
      setStatus('Listed and signed. The photo stayed on this device. SIMULATION.', 'ok');
      location.hash = 'market';
    } finally {
      busy = false;
    }
  });
  panel.replaceChildren(h('h2', {}, ['List']), steps, h('p', { class: 'muted' }, ['The value is in $lgme. A dollar figure is only a suggestion from the reference list.']), referenceCatalogCard(), form);
}

async function takeChatToken(seat, raw) {
  const opened = await sim.openMessage(String(raw || '').trim());
  if (!opened.ok) return opened;
  if (opened.message.kind === 'chat-match') {
    const result = await sim.acceptMatch(store, seat, opened.message);
    if (!result.ok) return result;
    matchNote = result.matched ? 'Matched' : `Diverges at message ${result.index + 1}${result.divergent?.[0]?.text ? ': ' + result.divergent[0].text : ''}`;
    if (opened.message.body?.threadId) openThreadId = opened.message.body.threadId;
    return { ok: true, matched: result.matched };
  }
  if (opened.message.kind !== 'chat') return { ok: false, error: 'This is not a signed text.' };
  const result = await sim.acceptChatToken(store, seat, opened.message);
  if (result.ok && result.threadId) openThreadId = result.threadId;
  return result;
}

async function phoneCard(seat, otherId, threadId) {
  const other = otherId ? await store.get(otherId) : null;
  const phone = sim.normalizePhone(other?.kyc?.phone || '');
  const identity = other?.kyc?.salt ? await sim.memberKycHash(other) : null;
  const mine = await sim.memberKycHash(await store.get(seat));
  const messages = await sim.readChat(store, seat, threadId);
  const text = h('textarea', { maxlength: '400', placeholder: 'Write a text' });
  const paste = h('textarea', { class: 'codebox', placeholder: 'Paste a signed text or a root' });
  const note = h('input', { maxlength: '160', placeholder: 'Note about the call' });
  const sms = signedSms && signedSms.threadId === threadId ? signedSms : null;
  const form = h('form', {}, [
    field('Text', text),
    h('div', { class: 'actions' }, [
      h('button', { class: 'primary', type: 'submit' }, ['Sign']),
      phone ? h('a', { class: 'btn', href: sim.telHref(phone), onClick: (event) => { event.preventDefault(); openCall = { phone, hash: identity?.hash || '', start: new Date().toISOString(), threadId }; render(); } }, ['Call']) : null
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const sent = await sim.composeChat(store, seat, { toId: otherId, toPhone: phone, threadId, text: text.value, negotiation: null });
    if (!sent.ok) { setStatus(sent.error, 'bad'); return; }
    signedSms = { threadId, sms: sent.sms, encoded: sent.encoded };
    matchNote = '';
    setStatus('Signed. Open SMS to hand it to your phone. This page did not send it. SIMULATION.', 'ok');
    await render();
  });
  const kids = [
    h('h3', {}, ['Text and call']),
    h('p', { class: 'legend' }, [
      phone && identity?.ok
        ? `Phone ${phone}. Member hash ${identity.hash.slice(0, 12)}. The signup details stay on their phone.`
        : 'Add a phone on the member check before texting.'
    ]),
    mine.ok ? h('p', { class: 'legend' }, [`Your member hash ${mine.hash.slice(0, 12)}. It is bound to your signing key.`]) : null,
    form
  ];
  if (sms) {
    kids.push(h('div', { class: 'actions' }, [
      h('a', { class: 'btn primary', href: sms.sms }, ['Open SMS']),
      otherId ? h('button', { type: 'button', onClick: async () => {
        const saved = await sim.acceptChatToken(store, otherId, sms.encoded);
        setStatus(saved.ok ? 'Recorded on the other book on this device. No SMS was sent. SIMULATION.' : saved.error, saved.ok ? 'ok' : 'bad');
        if (saved.ok) await render();
      } }, ['Record on the other book']) : null,
      h('button', { type: 'button', onClick: async () => {
        const token = await sim.composeMatch(store, seat, threadId, phone);
        if (!token.ok) { setStatus(token.error, 'bad'); return; }
        signedSms = { threadId, sms: token.sms, encoded: token.encoded, match: true };
        if (otherId) {
          const result = await sim.acceptMatch(store, otherId, token.encoded);
          matchNote = result.ok && result.matched ? 'Matched' : result.ok ? `Diverges at message ${result.index + 1}${result.divergent?.[0]?.text ? ': ' + result.divergent[0].text : ''}` : result.error;
        } else matchNote = 'The root is ready in Open SMS.';
        await render();
      } }, ['Match'])
    ]));
  }
  if (matchNote) kids.push(h('p', { id: 'chat-match', class: matchNote === 'Matched' ? 'ok' : 'bad' }, [matchNote]));
  if (openCall && openCall.threadId === threadId) {
    const endForm = h('form', {}, [
      field('Call note', note),
      h('div', { class: 'actions' }, [h('button', { class: 'primary', type: 'submit' }, ['Record the call'])])
    ]);
    endForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const saved = await sim.recordCall(store, seat, { phone: openCall.phone, peerKycHash: openCall.hash, start: openCall.start, end: new Date().toISOString(), note: note.value });
      setStatus(saved.ok ? 'Call noted. No audio was stored. This page did not place the call. SIMULATION.' : saved.error, saved.ok ? 'ok' : 'bad');
      if (saved.ok) openCall = null;
      await render();
    });
    kids.push(h('p', { class: 'legend' }, ['The dialer opened if your phone allowed it. Record the start and end here. No audio is kept.']), endForm);
  }
  kids.push(h('div', { class: 'actions' }, [h('button', { type: 'button', id: 'chat-camera', onClick: () => showCapture(seat, { threadId, toId: otherId, toPhone: phone, onSaved: () => render() }) }, ['Camera'])]));
  const seen = new Set();
  for (const line of messages) {
    if (line.media?.hash) seen.add(line.media.hash);
    kids.push(await chatMediaBubble(seat, line));
  }
  const localMedia = sim.listMedia(await store.get(seat), { threadId }).filter((record) => record.ownerId === seat && !seen.has(record.hash));
  for (const record of localMedia) kids.push(await chatMediaBubble(seat, { senderId: seat, text: String(record.mime).startsWith('video') ? 'Video' : 'Photo', threadId, media: record }));
  const received = h('input', { type: 'file', accept: 'image/*,video/*', capture: 'environment' });
  received.addEventListener('change', async () => {
    const chosen = received.files && received.files[0];
    if (!chosen) return;
    const bytes = new Uint8Array(await chosen.arrayBuffer());
    const hash = await sim.hashBytes(bytes);
    const claim = messages.find((line) => line.media?.hash === hash) || messages.find((line) => line.media);
    if (!claim?.media) { setStatus('Not authentic', 'bad'); return; }
    const owner = await store.get(claim.senderId);
    const saved = await sim.receiveMedia(store, seat, { bytes, ...claim.media, ownerId: claim.senderId, publicKeyJwk: owner?.publicKeyJwk || claim.publicKeyJwk });
    if (!saved.ok) { setStatus(saved.error || 'Not authentic', 'bad'); return; }
    const peer = await store.get(seat);
    if (peer?.privateKeyJwk) await saveMediaFile(seat, peer.privateKeyJwk, hash, bytes, claim.media.mime);
    setStatus('Verified and saved on this phone. SIMULATION.', 'ok');
    await render();
  });
  kids.push(field('Save a received file', received));
  const pasteForm = h('form', {}, [
    field('Paste a token', paste),
    h('div', { class: 'actions' }, [h('button', { type: 'submit' }, ['Record token'])])
  ]);
  pasteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const saved = await takeChatToken(seat, paste.value);
    setStatus(saved.ok ? (saved.matched ? 'Matched' : 'Token recorded. SIMULATION.') : saved.error, saved.ok ? 'ok' : 'bad');
    if (saved.ok) await render();
  });
  kids.push(pasteForm);
  return h('article', { class: 'card', id: 'chat-phone' }, kids);
}

async function renderChats(seat) {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  if (pendingChat) {
    const token = pendingChat;
    pendingChat = '';
    const saved = await takeChatToken(seat, token);
    setStatus(saved.ok ? 'Opened the signed token. SIMULATION.' : saved.error, saved.ok ? 'ok' : 'bad');
  }
  const threads = await sim.listThreads(store, seat);
  const extras = await sim.listChatThreads(store, seat);
  const known = new Set(threads.map((thread) => thread.id));
  if (!openThreadId || (!known.has(openThreadId) && !extras.some((item) => item.id === openThreadId))) {
    panel.replaceChildren(...[
      h('h2', {}, ['Chats']),
      h('p', { class: 'muted' }, ['Texts open in your own SMS app. Calls open in your phone. This page does not send them. A QR is only for an in-person handoff.']),
      threads.length ? h('div', { class: 'grid' }, threads.map((thread) => h('button', {
        type: 'button',
        class: 'card',
        onClick: () => { openThreadId = thread.id; matchNote = ''; render(); }
      }, [
        h('h3', {}, [thread.title || 'Listing']),
        h('p', { class: 'muted' }, [`${thread.amount} $lgme · ${thread.status}`])
      ]))) : null,
      ...extras.filter((item) => !known.has(item.id)).map((item) => h('button', {
        type: 'button',
        class: 'card',
        onClick: () => { openThreadId = item.id; matchNote = ''; render(); }
      }, [
        h('h3', {}, [item.preview || 'Text']),
        h('p', { class: 'muted' }, [`${item.length} signed`])
      ])),
      !threads.length && !extras.length ? h('p', { class: 'empty' }, ['No chats yet. Open a listing and start one.']) : null
    ].filter(Boolean));
    return;
  }
  if (!known.has(openThreadId)) {
    const card = await phoneCard(seat, '', openThreadId);
    panel.replaceChildren(
      h('button', { type: 'button', class: 'quiet', onClick: () => { openThreadId = ''; render(); } }, ['All chats']),
      h('h2', {}, ['Text']),
      card
    );
    return;
  }
  const thread = threads.find((item) => item.id === openThreadId);
  const mine = thread.buyerId === seat;
  const offer = h('input', { inputmode: 'decimal', value: String(thread.amount || ''), 'aria-label': 'Amount in $lgme' });
  const note = h('input', { maxlength: '160', placeholder: 'Note' });
  const paste = h('textarea', { class: 'codebox', placeholder: 'Paste a handoff code' });
  const video = h('video', { class: 'cam', playsinline: true, muted: true });
  video.hidden = true;
  const qrHost = h('div', {});
  const nodes = [
    h('button', { type: 'button', class: 'quiet', onClick: () => { openThreadId = ''; render(); } }, ['All chats']),
    h('h2', {}, [thread.title || 'Chat']),
    h('p', { class: 'muted' }, [`${thread.amount} $lgme · ${thread.status}. SIMULATION.`]),
    await phoneCard(seat, mine ? thread.sellerId : thread.buyerId, thread.id),
    ...thread.messages.map((line) => h('div', { class: 'bubble' }, [`${nameById[line.fromId] || line.fromId}: ${line.text}`]))
  ];
  if (!['settled', 'refused', 'cancelled', 'pending'].includes(thread.status)) {
    nodes.push(h('div', { class: 'chips' }, [
      chip('Is this available?', false, async () => {
        const posted = await sim.postChat(store, seat, thread.id, 'Is this available?');
        setStatus(posted.ok ? 'Asked. Nothing was sent off this device. SIMULATION.' : posted.error, posted.ok ? 'ok' : 'bad');
        if (posted.ok) await render();
      }),
      chip('Make an offer', false, () => { offer.focus(); })
    ]));
    const form = h('form', {}, [
      field(mine ? 'Offer in $lgme' : 'Counter in $lgme', offer),
      field('Note', note),
      h('div', { class: 'actions' }, [
        h('button', { class: 'primary', type: 'submit' }, [mine ? 'Offer' : 'Counter']),
        h('button', { type: 'button', onClick: () => signDeal(seat, thread.id) }, ['Accept & Sign']),
        h('button', { type: 'button', onClick: () => refuseDeal(seat, thread.id, note.value) }, ['Refuse']),
        h('button', { type: 'button', onClick: () => cancelDeal(seat, thread.id) }, ['Cancel'])
      ])
    ]);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = mine
        ? await sim.makeOffer(store, seat, thread.id, offer.value)
        : await sim.counterOffer(store, seat, thread.id, offer.value);
      setStatus(result.ok ? 'Signed the amount. Final balances have not moved. SIMULATION.' : result.error, result.ok ? 'ok' : 'bad');
      if (result.ok) await render();
    });
    nodes.push(form);
  }
  if (thread.status === 'pending' && mine) {
    const shown = await sim.buyerHandoff(store, seat, thread.id);
    if (shown.ok) {
      nodes.push(h('h3', {}, ['Handoff QR']), h('p', { class: 'legend' }, ['Single use. The seller scans or pastes this, then countersigns. Settlement posts to both tapes.']));
      nodes.push(qrHost);
      nodes.push(h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'primary', onClick: () => settleHandoff(thread.sellerId, shown.encoded) }, ['Settle on this device']),
        h('button', { type: 'button', onClick: async () => {
          try { await navigator.clipboard.writeText(shown.encoded); setStatus('Copied. This page did not send it. SIMULATION.', 'ok'); }
          catch { setStatus('Copy did not run. The code is on screen. SIMULATION.', 'bad'); }
        } }, ['Copy']),
        h('button', { type: 'button', onClick: () => download(`handoff-${thread.id.slice(0, 8)}.json`, shown.encoded, 'application/json') }, ['File'])
      ]));
      queueMicrotask(() => drawQr(qrHost, shown.qr || shown.encoded));
    } else nodes.push(h('p', { class: 'bad' }, [shown.error]));
  }
  if (thread.status === 'pending' && !mine) {
    nodes.push(
      h('h3', {}, ['Countersign the handoff']),
      h('p', { class: 'legend' }, ['Scan the buyer’s QR, or paste the code. One use settles both books.']),
      video,
      field('Handoff code', paste),
      h('div', { class: 'actions' }, [
        h('button', { type: 'button', class: 'primary scan-prominent', onClick: () => startScan(video, paste, null, (raw) => settleHandoff(seat, raw)) }, ['Scan QR']),
        h('button', { type: 'button', class: 'primary', onClick: () => settleHandoff(seat, paste.value) }, ['Countersign'])
      ])
    );
  }
  panel.replaceChildren(...nodes.filter(Boolean));
}

async function signDeal(seat, threadId) {
  const result = await sim.acceptAndSign(store, seat, threadId);
  setStatus(result.ok ? (result.thread.status === 'pending' ? 'Pending hold. Final balances have not moved. SIMULATION.' : 'Signed. Waiting for the other signature. SIMULATION.') : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function refuseDeal(seat, threadId, statement) {
  const result = await sim.refuseDeal(store, seat, threadId, statement || 'REFUSAL');
  setStatus(result.ok ? 'REFUSAL recorded. No balance moves. No penalty. SIMULATION.' : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function cancelDeal(seat, threadId) {
  const result = await sim.cancelDeal(store, seat, threadId);
  setStatus(result.ok ? 'Hold released. Final balances stay put. SIMULATION.' : result.error, result.ok ? 'ok' : 'bad');
  if (result.ok) await render();
}

async function settleHandoff(sellerId, encoded) {
  const result = await sim.sellerHandoff(store, sellerId, String(encoded || '').trim());
  if (!result.ok) { setStatus(result.error, 'bad'); return; }
  setStatus(`Settled. Buyer ${result.buyerBalance} · seller ${result.sellerBalance}. SIMULATION.`, 'ok');
  toast('Handoff settled on both books. SIMULATION.');
  await render();
}

function renderHelp() {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const sections = [
    ['Floor', 'The floor is the protected balance: food, rent, and the bus. A settlement, a transfer, or an attested IOU that would lower a peer through that floor is not applied. The tape records Blocked: Floor stays senior. A cycle is judged on the net, so equal work can clear.'],
    ['Third seat', 'The third seat is the person who can read the line and refuse it. The refusal is a REFUSAL entry. It moves no balance and carries no penalty. It does not unwind a line already shown. Silence is not a refusal. A line waits until every party has countersigned.'],
    ['Tape', 'Each book is append-only. Every entry names the previous hash and is signed with that peer’s key. Export the JSON and verify it. If a byte changes, the hash or the signature fails and the import stops.'],
    ['IOU and attestation', 'A dollar IOU is recorded as pending. Pending lines do not change the balance. The balance moves only when the named counterparty signs an ATTESTED entry. If they refuse, the tape records REFUSAL and the balance stays put.'],
    ['Mock $lgme', 'Registration writes a GENESIS entry for a simulated grant of 100 $lgme, labeled mock. It is not money. The wallet holds that balance and the signing key.'],
    ['Simulated 2FA', 'A passphrase encrypts the key at rest with AES-GCM and PBKDF2. A 6-digit TOTP, RFC 6238, is checked with WebCrypto HMAC. The setup QR can be scanned by an authenticator app. This page generates the same code while the secret is still on screen. It never sends the code. A wrong code leaves the wallet locked.'],
    ['Another device', 'There is no server. Sign a proposal, countersign, refusal, transfer, attestation, or handoff, then carry the lgme1. code by copy, by a link whose data sits in the URL fragment, by a QR, or by a .json file. On the other device, verification runs before anything is appended. A QR is for an in-person handoff. To text or email a draft, the page opens sms: or mailto: so you send it from your own app. The outbox and inbox are a local log of that.'],
    ['Phone chat', 'A text is signed here, then Open SMS hands it to your phone’s own messages app. The link or the pasted token is checked for the sender’s signature and the member hash. A call button opens tel: on your phone. The tape records the start, the end, the other member’s hash, and a note you type. No audio is stored. Match sends the chat root by SMS and says Matched, or names the first message that differs. This page does not send the text and does not place the call. The other person’s signup details stay on their phone. You keep the phone number and the hash.'],
    ['Photos and video', 'The camera and the gallery stay on this phone. Photos are compressed and video is kept short. The file is encrypted in this browser. The tape stores only the signed hash, the type, the size, and the length. Share hands the file to your own apps. The signed text carries the hash. A file that does not match says Not authentic. Nothing is uploaded.'],
    ['Invoices', 'Invoice in $lgme is optional on a work receipt. An unpaid invoice does not change a balance. A reminder opens your own SMS app. The payer pays with the 6-digit code when the wallet is locked. Floors still hold. A refusal is recorded and carries no penalty. A paid receipt can earn a small mock reward, capped each period. Unpaid and refused receipts earn none.'],
    ['Market', 'Listings are signed with the peer key. The origin hash names the listing. A photo stays on this device. Offer, counter, and Accept & Sign create a pending hold. Final balances move only when the seller countersigns the buyer’s single-use handoff. A refusal is recorded and carries no penalty. Peer standing is read from the local book.']
  ];
  const install = h('div', { class: 'card' }, [
    h('h3', {}, ['Install']),
    h('p', { class: 'muted' }, ['Installed, this simulation opens straight into the desk. The browser does the install. This page does not send anything.']),
    h('button', { type: 'button', class: 'primary', 'data-install': '1', hidden: true, onClick: promptInstall }, ['Install']),
    h('p', { id: 'ios-install', class: 'legend', hidden: true }, ['On iPhone or iPad, open Share, then Add to Home Screen. The icon opens this simulation.'])
  ]);
  panel.replaceChildren(
    h('h2', {}, ['Help']),
    h('p', { class: 'muted' }, ['SIMULATION. No real money, no message is sent by this page, and nothing is written to a network.']),
    h('button', { type: 'button', class: 'card mag-card', onClick: () => { location.hash = 'resources'; } }, [
      h('span', { class: 'kicker' }, ['Magazine']),
      h('h3', {}, ['Resources']),
      h('p', { class: 'muted' }, ['Alice, Bob, and Charlie. The practice market. The fifteen exchanges. The refusal. The third seat and the story.'])
    ]),
    install,
    ...sections.map(([title, body]) => h('article', { class: 'card' }, [h('h3', {}, [title]), h('p', { class: 'muted' }, [body])])),
    h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: () => showWalk(0) }, ['Replay the walkthrough'])])
  );
  syncInstall();
}

function renderBlock(block) {
  if (block.type === 'pre') return h('pre', { class: 'exch' }, [block.text]);
  if (block.type === 'list') return h('ol', {}, block.items.map((item) => h('li', {}, [item])));
  if (block.type === 'link') return h('p', {}, [h('a', { href: block.href }, [block.text])]);
  if (block.type === 'table') {
    return h('table', {}, [
      h('thead', {}, [h('tr', {}, block.headers.map((cell) => h('th', {}, [cell])))]),
      h('tbody', {}, block.rows.map((row) => h('tr', {}, row.map((cell) => h('td', {}, [cell])))))
    ]);
  }
  return h('p', {}, [block.text]);
}

function renderResources() {
  stopAnyCamera();
  const panel = document.getElementById('panel');
  const id = decodeURIComponent(location.hash.replace(/^#/, ''));
  const article = ARTICLES.find((item) => item.id === id);
  if (!article) {
    panel.replaceChildren(
      h('p', { class: 'kicker' }, ['SIMULATION · Resources']),
      h('h2', {}, ['The magazine']),
      h('p', { class: 'muted' }, ['The explainer, the simulator, and the third-seat story, kept in this app so they can be read offline.']),
      h('div', { class: 'mag' }, ARTICLES.map((item) => h('button', {
        type: 'button',
        class: 'card mag-card',
        onClick: () => { location.hash = item.id; }
      }, [
        h('span', { class: 'kicker' }, [item.kicker]),
        h('h3', {}, [item.title]),
        h('p', { class: 'muted' }, [item.deck])
      ]))),
      h('button', { type: 'button', class: 'quiet', onClick: () => { location.hash = 'help'; } }, ['Back to Help'])
    );
    return;
  }
  panel.replaceChildren(
    h('button', { type: 'button', class: 'quiet', onClick: () => { location.hash = 'resources'; } }, ['All articles']),
    h('p', { class: 'kicker' }, [`SIMULATION · ${article.kicker}`]),
    h('h2', {}, [article.title]),
    h('p', { class: 'muted' }, [article.deck]),
    ...article.blocks.map(renderBlock)
  );
}

let deferredInstall = null;

function syncInstall() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  document.querySelectorAll('[data-install]').forEach((button) => {
    button.hidden = standalone || !deferredInstall;
  });
  const ios = document.getElementById('ios-install');
  if (ios) {
    const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    ios.hidden = !(apple && !standalone);
  }
}

async function promptInstall() {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  syncInstall();
}

function showSplash() {
  const splash = document.getElementById('splash');
  if (!splash || sessionStorage.getItem('lgme-sim:ui:splash')) return Promise.resolve();
  splash.hidden = false;
  return new Promise((resolve) => {
    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      splash.hidden = true;
      sessionStorage.setItem('lgme-sim:ui:splash', '1');
      const video = document.getElementById('splash-video');
      if (video) video.pause();
      resolve();
    };
    document.getElementById('splash-skip').addEventListener('click', done);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const video = document.getElementById('splash-video');
    if (reduce && video) video.remove();
    if (!reduce && video) {
      video.play().catch(() => {});
      video.addEventListener('ended', done);
      setTimeout(done, 6200);
    } else {
      setTimeout(done, 1200);
    }
  });
}

const WALK = [
  ['SIMULATION', 'This desk is practice. It does not write to a network, move real money, or send text or email. You send a draft yourself, from your own app, if you want to.'],
  ['Separate books', 'Alice, Bob, and Charlie each keep their own tape. On one device you switch seats. On two devices you carry a signed message. There is no central ledger.'],
  ['Floor', 'Bob and Charlie start above their floors. A line that would spend the floor is blocked and the block stays on the tape.'],
  ['Third seat', 'Refuse a line that skipped the order. The no is recorded. Nothing moves. There is no penalty.'],
  ['100 mock $lgme', 'Register a new peer and the GENESIS line grants 100 $lgme, labeled mock. Then the key is locked behind a passphrase and a 6-digit code.'],
  ['Carry the signature', 'Copy the code, open the share link, scan the QR, or save the JSON. The other device checks the signature and the hash link before it appends.']
];

function showWalk(step) {
  let overlay = document.getElementById('walk');
  if (!overlay) {
    overlay = h('div', { class: 'walk', id: 'walk', role: 'dialog', 'aria-modal': 'true' });
    document.body.append(overlay);
  }
  overlay.hidden = false;
  const [title, body] = WALK[step];
  const card = h('article', { class: 'card' }, [
    h('p', { class: 'kicker' }, [`SIMULATION · ${step + 1} of ${WALK.length}`]),
    h('h2', {}, [title]),
    h('p', {}, [body]),
    h('div', { class: 'actions' }, [
      step > 0 ? h('button', { type: 'button', onClick: () => showWalk(step - 1) }, ['Back']) : null,
      step < WALK.length - 1
        ? h('button', { type: 'button', class: 'primary', onClick: () => showWalk(step + 1) }, ['Next'])
        : h('button', { type: 'button', class: 'primary', onClick: () => { overlay.hidden = true; sessionStorage.setItem('lgme-sim:ui:seen-walk', '1'); } }, ['Start'])
    ])
  ]);
  overlay.replaceChildren(card);
}

async function shareExchange(me, ex) {
  const peer = await store.get(me.id);
  if (!peer?.privateKeyJwk) { setStatus('Unlock the wallet before signing a copy to carry.', 'bad'); return; }
  const kind = ex.signatures?.[peer.id] ? 'countersign' : 'proposal';
  const sealed = await sim.sealMessage(peer, kind, { exchange: ex });
  if (!sealed.ok) { setStatus(sealed.error, 'bad'); return; }
  carryCode = sim.encodeMessage(sealed.message);
  location.hash = 'devices';
  setStatus('Signed copy is ready. Nothing has been sent. SIMULATION.', 'ok');
}

async function loadReferences() {
  try {
    const response = await fetch('/data/dc-reference-values-v0.json');
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    catalog = Array.isArray(body.items) ? body.items : [];
    catalogMeta = { date: body.date || '', notice: body.notice || '', method: body.method || '' };
    catalogNotice = `${REFERENCE_LABEL}. Reference only, not a price. As of ${catalogMeta.date || 'pending'}. ${catalogMeta.notice}`.trim();
  } catch {
    catalog = [];
    catalogMeta = { date: '', notice: '', method: '' };
    catalogNotice = `Reference list did not load. You can still name the work yourself. ${REFERENCE_LABEL}. Reference only, not a price.`;
  }
  try {
    const response = await fetch('/data/offerup-dc-v0.json');
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    offerupItems = sim.offerupFeed(body);
  } catch {
    offerupItems = [];
  }
  try {
    const response = await fetch('/data/offerup-wanted-v0.json');
    if (!response.ok) throw new Error(String(response.status));
    const body = await response.json();
    wantedMatches = sim.wantedFeed(body);
  } catch {
    wantedMatches = [];
  }
}

function captureFragment() {
  const raw = location.hash;
  const at = raw.indexOf('lgme1.');
  if (at < 0) return;
  const encoded = decodeURIComponent(raw.slice(at));
  let kind = '';
  try { kind = sim.decodeMessage(encoded).kind; } catch { kind = ''; }
  if (kind === 'chat' || kind === 'chat-match') {
    pendingChat = encoded;
    history.replaceState(null, '', `${location.pathname}${location.search}#chats`);
    return;
  }
  if (kind === 'invoice') {
    pendingInvoice = encoded;
    history.replaceState(null, '', `${location.pathname}${location.search}#books`);
    return;
  }
  pendingImport = encoded;
  history.replaceState(null, '', `${location.pathname}${location.search}#devices`);
}

let toastTimer = 0;
function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function applyLayout() {
  const uaMobile = navigator.userAgentData?.mobile === true;
  const mode = sim.layoutMode({
    width: window.innerWidth,
    coarse: window.matchMedia('(pointer: coarse)').matches,
    uaMobile
  });
  document.documentElement.classList.toggle('phone', mode === 'phone');
  document.documentElement.classList.toggle('desk', mode !== 'phone');
  document.body.dataset.layout = mode;
}

const deliveryChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('lgme-sim:delivery') : null;
deliveryChannel?.addEventListener('message', async (event) => {
  const encoded = event.data?.encoded;
  if (!encoded) return;
  const opened = await sim.openMessage(encoded);
  if (!opened.ok) return;
  if (opened.message.kind === 'handoff') {
    const settled = await sim.sellerHandoff(store, opened.message.body.sellerId, encoded);
    if (!settled.ok || settled.thread?.status !== 'settled') return;
    toast('Handoff settled on both books. SIMULATION.');
    await render();
    return;
  }
  if (opened.message.kind !== 'transfer') return;
  const result = await sim.acceptAutoDelivery(store, opened.message.body.toId, encoded);
  if (!result.ok || result.duplicate) return;
  toast(`Received ${opened.message.body.amount} mock $lgme. SIMULATION.`);
  await render();
});

captureFragment();
applyLayout();
window.addEventListener('resize', applyLayout);
for (const name of TABS) {
  document.getElementById(`tab-${name}`).addEventListener('click', () => selectTab(name));
}
document.querySelectorAll('.tabbar button').forEach((button) => {
  button.addEventListener('click', () => selectTab(button.dataset.tab));
});
window.addEventListener('hashchange', () => {
  captureFragment();
  render();
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
  syncInstall();
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sessionKeys.clear();
});
let idleTimer = 0;
function bumpIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => sessionKeys.clear(), 5 * 60 * 1000);
}
['pointerdown', 'keydown'].forEach((name) => document.addEventListener(name, bumpIdle));
bumpIdle();

async function bootVault() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch { /* persistence is optional */ }
  if (!globalThis.indexedDB) return;
  const vault = createIndexedDbVault();
  for (const id of await baseStore.listIds()) {
    const peer = await baseStore.get(id);
    if (!peer) continue;
    if (peer.privateKeyJwk && !peer.keyVault) {
      const existingDek = await vault.getMeta(id);
      const dek = deviceKeyForMigration(existingDek);
      const signing = await importNonExtractable(peer.privateKeyJwk);
      const wrap = await sealJson(dek, { privateKeyJwk: peer.privateKeyJwk });
      await vault.put(id, signing);
      if (dek !== existingDek) await vault.putMeta(id, dek);
      const current = await baseStore.get(id);
      if (!current?.privateKeyJwk || current.keyVault) {
        sessionCrypto.set(id, signing);
        metaKeys.set(id, dek);
        continue;
      }
      const sameKey = JSON.stringify(current.privateKeyJwk) === JSON.stringify(peer.privateKeyJwk);
      const signingNow = sameKey ? signing : await importNonExtractable(current.privateKeyJwk);
      const wrapNow = sameKey ? wrap : await sealJson(dek, { privateKeyJwk: current.privateKeyJwk });
      if (!sameKey) await vault.put(id, signingNow);
      current.migrationWrap = wrapNow;
      current.keyVault = true;
      sessionKeys.set(id, current.privateKeyJwk);
      sessionCrypto.set(id, signingNow);
      metaKeys.set(id, dek);
      current.privateKeyJwk = null;
      await baseStore.set(id, current);
    } else {
      const signing = await vault.get(id);
      const dek = await vault.getMeta(id);
      if (signing) sessionCrypto.set(id, signing);
      if (dek) metaKeys.set(id, dek);
    }
  }
}

bootVault().catch(() => {});

loadReferences().then(async () => {
  await showSplash();
  await render();
  if (!sessionStorage.getItem('lgme-sim:ui:seen-walk')) showWalk(0);
}).catch((error) => {
  setStatus(error && error.message ? error.message : 'The books did not open.', 'bad');
});
