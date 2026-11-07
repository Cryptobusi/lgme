import * as sim from './p2p-exchange-sim.mjs';
import { ARTICLES } from './p2p-resources.mjs';

const sessionKeys = new Map();
const rememberedSecrets = new Map();
const baseStore = sim.createLocalStorageStore();
const store = {
  async get(id) {
    const peer = await baseStore.get(id);
    if (peer && !peer.privateKeyJwk && sessionKeys.has(id)) peer.privateKeyJwk = structuredClone(sessionKeys.get(id));
    return peer;
  },
  async set(id, value) {
    const copy = structuredClone(value);
    if (copy?.wallet?.ciphertext) copy.privateKeyJwk = null;
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
let catalogNotice = 'Reference only, not a price.';
let busy = false;
let nameById = {};
let marketQuery = { q: '', category: '', condition: '', pickup: '', circle: '', min: '', max: '' };
let openListingId = '';
let openThreadId = '';
let pendingChat = '';
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

function renderTabs() {
  const tab = tabName();
  const phoneTab = ['reconcile', 'books', 'devices', 'exchange'].includes(tab) ? 'wallet' : tab === 'resources' ? 'help' : tab;
  for (const name of TABS) {
    const button = document.getElementById(`tab-${name}`);
    button.setAttribute('aria-selected', name === tab ? 'true' : 'false');
    button.onclick = () => {
      if (location.hash.includes('lgme1.')) pendingImport = location.hash.slice(location.hash.indexOf('lgme1.'));
      location.hash = name;
    };
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
    refItem.append(option(item.id, item.avg_value_usd == null ? `${item.name} — no reference value` : item.name, false));
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
    h('p', { class: 'legend' }, ['Reference only, not a price. The amount on the line is what would settle.']),
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
      refDetail.textContent = item ? `Reference only, not a price. ${item.note || 'No reference value for this item.'}` : catalogNotice;
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
    refDetail.textContent = `Reference only, not a price. ${avg} × ${qty} = ${suggested}. The line amount can still be edited.`;
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
  const panel = document.getElementById('panel');
  const peer = await store.get(seat);
  const names = namesOf(peers);
  const view = sim.replay(peer);
  const rule = sim.terms(peer);
  const above = sim.round2(view.balance - rule.floor);
  const finger = (await sim.sha256(sim.canonicalJSON(peer.publicKeyJwk))).slice(0, 16);
  const search = h('input', { type: 'search', placeholder: 'Filter by work, type, or hash' });
  const type = h('select', {}, ['all', 'genesis', 'ididit', 'proposal', 'countersign', 'refusal', 'block', 'settlement', 'transfer', 'iou', 'attested'].map((name, index) => option(name, name === 'all' ? 'All types' : name, index === 0)));
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
  const work = h('input', { maxlength: '160', required: true });
  const scope = h('input', { maxlength: '160' });
  const hours = h('input', { type: 'number', min: '0', step: '0.01' });
  const receiptForm = h('form', { class: 'grid three' }, [
    field('Work', work),
    field('Scope', scope),
    field('Hours', hours),
    h('div', { class: 'actions' }, [h('button', { type: 'submit', class: 'primary' }, ['Record IdidIt'])])
  ]);
  receiptForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await run(() => sim.recordIdidIt(store, seat, { work: work.value, scope: scope.value, hours: hours.value }), null);
  });
  panel.replaceChildren(
    h('h2', {}, [`${peer.name}'s book`]),
    h('p', { class: 'muted' }, [`Every line below is on this peer’s tape. Credits and debits come only from settlements. The running balance is a replay. Key ${finger}. Limit ${rule.creditLimit}.`]),
    h('div', { class: 'nums' }, [
      h('div', {}, [h('strong', {}, [String(view.balance)]), 'Balance']),
      h('div', {}, [h('strong', {}, [String(rule.floor)]), `Floor · ${rule.floorNote}`]),
      h('div', {}, [h('strong', {}, [above >= 0 ? String(above) : 'below']), above >= 0 ? 'Above the floor' : 'Below the floor']),
      h('div', {}, [h('strong', {}, [String(view.credits)]), 'Credits']),
      h('div', {}, [h('strong', {}, [String(view.debits)]), 'Debits'])
    ]),
    h('div', { class: 'actions' }, [
      h('button', { type: 'button', onClick: () => verify(peer) }, ['Verify tape']),
      h('button', { type: 'button', onClick: () => download(`${peer.id}-tape.csv`, sim.toCsv(peer, names), 'text/csv') }, ['Export CSV']),
      h('button', { type: 'button', onClick: () => download(`${peer.id}-tape.json`, JSON.stringify(sim.toExport(peer), null, 2), 'application/json') }, ['Export JSON'])
    ]),
    h('div', { class: 'grid two' }, [field('Search', search), field('Type', type)]),
    list,
    empty,
    h('h3', {}, ['Record work']),
    h('p', { class: 'legend' }, ['IdidIt stores the fact of the work on this tape. It does not change the balance.']),
    receiptForm
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
  if (!QR || text.length > 2200) {
    host.append(h('p', { class: 'legend' }, ['This message is too long for a QR code. Use copy or a .json file.']));
    return;
  }
  const holder = h('div', { class: 'qr' });
  host.append(holder);
  try {
    new QR(holder, { text, width: 220, height: 220, correctLevel: QR.CorrectLevel.M });
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
      h('div', {}, [h('strong', {}, [String(sim.replay(peer).balance)]), summary.mock ? 'Mock $lgme' : 'Book balance']),
      h('div', {}, [h('strong', {}, [String(sim.terms(peer).floor)]), 'Floor']),
      h('div', {}, [h('strong', {}, [locked ? 'Locked' : 'Open']), 'Key'])
    ])
  ];
  if (secret) blocks.push(codeLine, h('div', { id: 'setup-qr' }));
  blocks.push(profileCard(sim.peerProfile(peer)), kycCard(peer, peers));
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
    blocks.push(form);
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
      `${profile.balance} $lgme · floor ${profile.floor} · ${profile.aboveFloor} above the floor. Credit use versus the floor ${Math.round(profile.utilization * 100)}%.${profile.held ? ` Held ${profile.held} $lgme.` : ''}`
    ])
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
      const profile = sim.peerProfile(seller);
      const photo = h('img', { class: 'shot', alt: '', src: card.photo || '' });
      const actions = [];
      if (card.sellerId === seat) {
        actions.push(h('button', { type: 'button', class: 'primary', onClick: async () => {
          const refreshed = await sim.refreshListing(store, seat, card.id);
          setStatus(refreshed.ok ? 'Listing refreshed with a signed heartbeat. SIMULATION.' : refreshed.error, refreshed.ok ? 'ok' : 'bad');
          if (refreshed.ok) await render();
        } }, ['Refresh']));
      } else {
        actions.push(h('button', { type: 'button', class: 'primary', onClick: async () => {
          const chat = await sim.openChat(store, seat, card.id);
          if (!chat.ok) { setStatus(chat.error, 'bad'); return; }
          openThreadId = chat.thread.id;
          location.hash = 'chats';
        } }, ['Chat']));
      }
      panel.replaceChildren(
        h('button', { type: 'button', class: 'quiet', onClick: () => { openListingId = ''; render(); } }, ['Back to the market']),
        h('h2', {}, [card.title]),
        photo,
        h('p', { class: 'price' }, [`${card.amount} $lgme`]),
        h('p', {}, [
          h('span', { class: card.verified ? 'badge badge-verified' : 'badge badge-unverified' }, [card.verified ? 'Verified' : 'Unverified']),
          ` ${card.sellerName} · ${card.circle} · Peer standing ${card.standing}`
        ]),
        h('p', { class: 'muted' }, [`${card.condition} · ${card.pickup}${card.area ? ' · ' + card.area : ''}`]),
        card.referenceAvg == null ? null : h('p', { class: 'legend' }, [`Reference only, not a price. About ${card.referenceAvg}.`]),
        h('p', { class: 'legend' }, [card.signatureOk ? `Origin ${shortHash(card.originHash)} verifies.` : 'Origin hash does not verify.']),
        profileCard(profile),
        h('div', { class: 'actions' }, actions)
      );
      return;
    }
  }
  const feed = await sim.marketFeed(store, marketQuery);
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
      h('button', { type: 'button', onClick: () => { marketQuery = { q: '', category: '', condition: '', pickup: '', circle: '', min: '', max: '' }; render(); } }, ['Clear'])
    ])
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    marketQuery = { ...marketQuery, q: search.value, condition: condition.value, pickup: pickup.value, circle: circle.value, min: min.value, max: max.value };
    render();
  });
  const pills = h('div', { class: 'chips' }, [
    chip('All', !marketQuery.category, () => { marketQuery.category = ''; render(); }),
    ...CATEGORIES.map((item) => chip(item, marketQuery.category === item, () => { marketQuery.category = item; render(); }))
  ]);
  const grid = h('div', { class: 'market-grid' }, feed.map((card) => h('button', {
    type: 'button',
    class: 'card market-card',
    onClick: () => { openListingId = card.id; render(); }
  }, [
    h('img', { alt: '', src: card.photo || '' }),
    h('h3', {}, [card.title]),
    h('div', { class: 'price' }, [`${card.amount} $lgme`]),
    h('div', {}, [h('span', { class: card.verified ? 'badge badge-verified' : 'badge badge-unverified' }, [card.verified ? 'Verified' : 'Unverified'])]),
    h('small', { class: 'meta' }, [`${card.circle} · Peer standing ${card.standing}`])
  ])));
  const mine = await store.get(seat);
  const standing = mine ? sim.peerProfile(mine) : null;
  const filters = h('details', {}, [h('summary', {}, ['Filters']), form]);
  panel.replaceChildren(
    h('h2', {}, ['Market']),
    h('p', { class: 'muted' }, [`Ad-free. ${me ? me.name : 'You'} · Peer standing ${standing ? standing.standing : ''}. Nothing here is a paid placement. SIMULATION.`]),
    pills,
    filters,
    feed.length ? grid : h('p', { class: 'empty' }, ['No listings match. List one, or clear the filters.']),
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
    const file = h('input', { type: 'file', accept: 'image/*' });
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
        h('button', { type: 'button', onClick: async () => {
          stopAnyCamera();
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            video.hidden = false;
            video.srcObject = stream;
            await video.play();
            stopCamera = () => { stream.getTracks().forEach((track) => track.stop()); video.hidden = true; };
          } catch {
            setStatus('The camera did not open. Choose a photo instead. SIMULATION.', 'bad');
          }
        } }, ['Camera']),
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
    const category = h('select', {}, CATEGORIES.map((item) => option(item, item, listDraft.category === item)));
    const condition = h('select', {}, CONDITIONS.map((item) => option(item, item, listDraft.condition === item)));
    const pickup = h('select', {}, PICKUPS.map((item) => option(item, item, listDraft.pickup === item)));
    const circle = h('input', { required: true, maxlength: '40', value: listDraft.circle, placeholder: 'Walkway, Soil, Logistics…' });
    const area = h('input', { maxlength: '80', value: listDraft.area, placeholder: 'Optional area phrase' });
    const form = h('form', {}, [
      field('Title', title),
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
      listDraft = { ...listDraft, title: title.value.trim(), category: category.value, condition: condition.value, pickup: pickup.value, circle: circle.value.trim(), area: area.value.trim() };
      if (!listDraft.title || !listDraft.circle) { setStatus('Add a title and a circle.', 'bad'); return; }
      listStep = 3;
      render();
    });
    panel.replaceChildren(h('h2', {}, ['List']), steps, h('p', { class: 'muted' }, ['Name the item, its condition, how it changes hands, and which circle it belongs to.']), form);
    return;
  }
  const amount = h('input', { inputmode: 'decimal', required: true, value: listDraft.amount, placeholder: '0.00' });
  const reference = h('select', {}, [option('', 'No dollar reference', !listDraft.referenceId), ...catalog.map((item) => option(item.id, item.name, listDraft.referenceId === item.id))]);
  const hint = h('p', { class: 'legend' }, ['Reference only, not a price.']);
  function paintHint() {
    const item = catalog.find((row) => row.id === reference.value);
    hint.textContent = item && item.avg_value_usd != null ? `Reference only, not a price. ${item.name} is about ${item.avg_value_usd} in the DC list.` : 'Reference only, not a price.';
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
      listDraft = { photo: '', photoHash: '', title: '', category: 'Goods', condition: 'Good', pickup: 'Pickup', circle: '', area: '', amount: '', referenceId: '' };
      listStep = 1;
      openListingId = created.listing.id;
      setStatus('Listed and signed. The photo stayed on this device. SIMULATION.', 'ok');
      location.hash = 'market';
    } finally {
      busy = false;
    }
  });
  panel.replaceChildren(h('h2', {}, ['List']), steps, h('p', { class: 'muted' }, ['The value is in $lgme. A dollar figure is only a suggestion from the reference list.']), form);
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
      phone ? h('a', { class: 'btn', href: sim.telHref(phone), onClick: () => { openCall = { phone, hash: identity?.hash || '', start: new Date().toISOString(), threadId }; } }, ['Call']) : null
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
  kids.push(...messages.map((line) => h('div', { class: 'bubble' }, [`${line.senderId === seat ? 'You' : (nameById[line.senderId] || 'Member')}: ${line.text}`])));
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
      queueMicrotask(() => drawQr(qrHost, shown.encoded));
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
    catalogNotice = `Reference only, not a price. ${body.notice || ''}`.trim();
  } catch {
    catalog = [];
    catalogNotice = 'Reference list did not load. You can still name the work yourself. Reference only, not a price.';
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
  document.getElementById(`tab-${name}`).addEventListener('click', () => { location.hash = name; });
}
document.querySelectorAll('.tabbar button').forEach((button) => {
  button.addEventListener('click', () => { location.hash = button.dataset.tab; });
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

loadReferences().then(async () => {
  await showSplash();
  await render();
  if (!sessionStorage.getItem('lgme-sim:ui:seen-walk')) showWalk(0);
}).catch((error) => {
  setStatus(error && error.message ? error.message : 'The books did not open.', 'bad');
});
