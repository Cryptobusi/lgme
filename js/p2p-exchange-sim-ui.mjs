import * as sim from './p2p-exchange-sim.mjs';

const store = sim.createLocalStorageStore();
const SEAT_KEY = 'lgme-sim:ui:seat';
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
  const name = location.hash.replace('#', '');
  return ['exchange', 'books', 'reconcile'].includes(name) ? name : 'exchange';
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
  const peers = await ensureBooks();
  nameById = namesOf(peers);
  const seat = currentSeat(peers);
  renderSeats(peers, seat);
  renderTabs();
  const tab = tabName();
  if (tab === 'books') await renderBooks(peers, seat);
  else if (tab === 'reconcile') await renderReconcile(peers);
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
      h('small', {}, [`${peer.balance} · floor ${peer.floor}`])
    ]);
    button.addEventListener('click', () => {
      rememberSeat(peer.id);
      setStatus(`Acting as ${peer.name}. This is ${peer.name}'s book only.`);
      render();
    });
    bar.append(button);
  }
  bar.append(h('button', { type: 'button', class: 'seat', onClick: () => renderAddPeer(peers) }, ['Add a peer', h('small', {}, ['Opens an empty book'])]));
  bar.append(h('button', { type: 'button', class: 'seat', onClick: resetDemo }, ['Reset demo', h('small', {}, ['Clears every local book'])]));
}

function renderTabs() {
  const tab = tabName();
  for (const name of ['exchange', 'books', 'reconcile']) {
    const button = document.getElementById(`tab-${name}`);
    button.setAttribute('aria-selected', name === tab ? 'true' : 'false');
    button.onclick = () => {
      location.hash = name;
    };
  }
}

function renderAddPeer(peers) {
  const panel = document.getElementById('panel');
  const name = h('input', { required: true, maxlength: '48', autocomplete: 'off' });
  const balance = h('input', { type: 'number', step: '0.01', value: '0' });
  const floor = h('input', { type: 'number', step: '0.01', value: '0' });
  const limit = h('input', { type: 'number', step: '0.01', value: '-200' });
  const form = h('form', { class: 'grid two' }, [
    field('Name', name),
    field('Opening balance (simulated genesis)', balance),
    field('Floor', floor),
    field('Credit limit', limit),
    h('div', { class: 'actions' }, [
      h('button', { type: 'submit', class: 'primary' }, ['Create book']),
      h('button', { type: 'button', class: 'quiet', onClick: () => render() }, ['Cancel'])
    ])
  ]);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const id = sim.slugPeerId(name.value, peers.map((peer) => peer.id));
      const created = await sim.createPeer(store, {
        id,
        name: name.value.trim(),
        balance: balance.value,
        floor: floor.value,
        creditLimit: limit.value,
        floorNote: 'food/rent'
      });
      if (!created.ok) {
        setStatus(created.error, 'bad');
        return;
      }
      rememberSeat(id);
      setStatus(`${name.value.trim()} has a separate book. Opening is genesis on their tape. Balance is not taken from anyone else.`, 'ok');
      await render();
    } finally {
      busy = false;
    }
  });
  panel.replaceChildren(
    h('h2', {}, ['Add a peer']),
    h('p', { class: 'muted' }, ['A new peer starts with their own key and their own tape. This does not open a shared ledger.']),
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
  const amount = h('input', { type: 'number', min: '0.01', step: '0.01', value: '10', required: true });
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
  const type = h('select', {}, ['all', 'genesis', 'ididit', 'proposal', 'countersign', 'refusal', 'block', 'settlement'].map((name, index) => option(name, name === 'all' ? 'All types' : name, index === 0)));
  const list = h('div', {});
  const rows = view.rows.slice().reverse();
  for (const row of rows) {
    const detail = sim.entryDetail(row, names);
    const item = h('article', { class: 'book-row' }, [
      h('div', {}, [`#${row.index} · ${row.type} · ${row.at}`]),
      h('div', {}, [detail]),
      h('div', { class: 'nums' }, [
        h('span', {}, [`Debit ${row.debit}`]),
        h('span', {}, [`Credit ${row.credit}`]),
        h('span', {}, [`Balance ${row.balance}`])
      ]),
      h('div', { class: 'hash', title: row.hash }, [`prev ${shortHash(row.prev)} · hash ${shortHash(row.hash)}`])
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

async function renderReconcile(peers) {
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
  panel.replaceChildren(
    h('h2', {}, ['Reconcile']),
    h('p', { class: 'muted' }, ['Compare the signed copies two peers stored. A difference in amount, status, signature, refusal, or settlement is a mismatch. Neither book is corrected from the other.']),
    form,
    out
  );
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

document.getElementById('tab-exchange').addEventListener('click', () => { location.hash = 'exchange'; });
document.getElementById('tab-books').addEventListener('click', () => { location.hash = 'books'; });
document.getElementById('tab-reconcile').addEventListener('click', () => { location.hash = 'reconcile'; });
window.addEventListener('hashchange', () => { render(); });

loadReferences().then(render).catch((error) => {
  setStatus(error && error.message ? error.message : 'The books did not open.', 'bad');
});
