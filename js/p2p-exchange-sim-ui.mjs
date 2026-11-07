import * as sim from './p2p-exchange-sim.mjs';

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
const TABS = ['exchange', 'books', 'reconcile', 'wallet', 'devices', 'help'];
let pendingImport = '';
let carryAddress = '';
let activeCodeTimer = 0;
let catalog = [];
let catalogNotice = 'Reference only, not a price.';
let busy = false;
let nameById = {};

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
  return TABS.includes(name) ? name : 'exchange';
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
  if (tab === 'books') await renderBooks(peers, seat);
  else if (tab === 'reconcile') await renderReconcile(peers, seat);
  else if (tab === 'wallet') await renderWallet(peers, seat);
  else if (tab === 'devices') await renderDevices(peers, seat);
  else if (tab === 'help') renderHelp();
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
      h('small', {}, [`${peer.mock ? peer.balance + ' mock $lgme' : peer.balance} · floor ${peer.floor}${peer.locked ? ' · locked' : ''}`])
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
  const phoneTab = tab === 'reconcile' ? 'books' : tab;
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
    setStatus('Demo books restored. Alice has an open 10-unit proposal. Bob can countersign. Charlie can refuse. Nothing has settled.', 'ok');
    if (location.hash && location.hash !== '#exchange') location.hash = 'exchange';
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
    const status = row.type === 'iou' ? 'pending' : row.type === 'attested' ? 'attested' : row.type === 'refusal' ? 'refused' : row.type === 'block' ? 'blocked' : (row.type === 'transfer' || row.type === 'settlement') ? 'done' : row.type;
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
    h('h2', {}, [`Wallet · ${summary.name}`]),
    h('p', { class: 'muted' }, ['SIMULATION. The balance is mock $lgme. The passphrase and the 6-digit code are simulated 2FA. This page does not send the code and does not move real money.']),
    h('div', { class: 'balance-hero' }, [
      h('div', {}, [h('strong', {}, [String(sim.replay(peer).balance)]), summary.mock ? 'Mock $lgme' : 'Book balance']),
      h('div', {}, [h('strong', {}, [String(sim.terms(peer).floor)]), 'Floor']),
      h('div', {}, [h('strong', {}, [locked ? 'Locked' : 'Open']), 'Key'])
    ])
  ];
  if (secret) blocks.push(codeLine, h('div', { id: 'setup-qr' }));
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
  panel.replaceChildren(...blocks);
  const qrHost = document.getElementById('setup-qr');
  if (qrHost && secret) {
    const label = encodeURIComponent(`lgme-sim:${peer.name}`);
    drawQr(qrHost, `otpauth://totp/${label}?secret=${secret}&issuer=lgme-sim&algorithm=SHA1&digits=6&period=30`);
  }
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
      : 'This demo book has no authenticator yet. Signing prepares a code you can carry. Set up 2FA on the wallet to auto-deliver on this device.'])
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

async function startScan(video, incoming, preview) {
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
          previewIncoming(currentSeatId(), incoming.value, preview);
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
    ['Another device', 'There is no server. Sign a proposal, countersign, refusal, transfer, or attestation, then carry the lgme1. code by copy, by a link whose data sits in the URL fragment, by a QR, or by a .json file. On the other device, verification runs before anything is appended. To text or email it, the page opens sms: or mailto: so you send it from your own app. The outbox and inbox are a local log of that.']
  ];
  panel.replaceChildren(
    h('h2', {}, ['Help']),
    h('p', { class: 'muted' }, ['SIMULATION. No real money, no message is sent by this page, and nothing is written to a network.']),
    ...sections.map(([title, body]) => h('article', { class: 'card' }, [h('h3', {}, [title]), h('p', { class: 'muted' }, [body])])),
    h('div', { class: 'actions' }, [h('button', { type: 'button', onClick: () => showWalk(0) }, ['Replay the walkthrough'])])
  );
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
  pendingImport = decodeURIComponent(raw.slice(at));
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
  if (!opened.ok || opened.message.kind !== 'transfer') return;
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

loadReferences().then(async () => {
  await render();
  if (!sessionStorage.getItem('lgme-sim:ui:seen-walk')) showWalk(0);
}).catch((error) => {
  setStatus(error && error.message ? error.message : 'The books did not open.', 'bad');
});
