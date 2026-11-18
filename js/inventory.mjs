import { DRAFT_KEY, listingDraft, readItems, saveItem, valueRange } from './ihavit.mjs';
import { proofPanel } from './books.mjs';

export const LINK_KEY = 'lgme.inventory.link';
const CONDITION_RANK = { new: 0, 'like new': 1, good: 2, fair: 3, poor: 4 };

export function nextCare(item) {
  if (!item?.care?.from) return '';
  const start = Date.parse(item.care.from);
  if (!Number.isFinite(start)) return '';
  return new Date(start + item.care.everyDays * 86400000).toISOString().slice(0, 10);
}

export function sortItems(items, key) {
  const rows = [...(items || [])];
  const by = {
    name: (a, b) => a.name.localeCompare(b.name),
    category: (a, b) => (a.category || '').localeCompare(b.category || ''),
    value: (a, b) => ((valueRange(b)?.low || -1) - (valueRange(a)?.low || -1)),
    purchased: (a, b) => (b.purchased || '').localeCompare(a.purchased || ''),
    condition: (a, b) => (CONDITION_RANK[a.condition] ?? 9) - (CONDITION_RANK[b.condition] ?? 9),
    maintenance: (a, b) => (nextCare(a) || '9999').localeCompare(nextCare(b) || '9999')
  };
  rows.sort(by[key] || by.name);
  return rows;
}

export function filterItems(items, { query = '', category = '', location = '', condition = '' } = {}) {
  const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
  return (items || []).filter((item) => {
    if (category && item.category !== category) return false;
    if (location && item.location !== location) return false;
    if (condition && item.condition !== condition) return false;
    if (!words.length) return true;
    const hay = `${item.name} ${item.category} ${item.location} ${item.notes}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

export function groupItems(items, by) {
  const groups = new Map();
  for (const item of items || []) {
    const key = (by === 'location' ? item.location : item.category) || 'Unsorted';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function cell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(values) {
  return values.map(cell).join(',');
}

export function toHomeboxCsv(items) {
  const lines = ['HB.name,HB.quantity,HB.description,HB.location,HB.purchase_price,HB.purchase_time,HB.asset_id'];
  for (const item of items || []) {
    lines.push(row([item.name, item.quantity ?? 1, item.notes || '', item.location || '', item.price || '', item.purchased || '', item.id || '']));
  }
  return lines.join('\n');
}

export function toBigcapitalCsv(items) {
  const lines = ['Item Name,Item Code,Item Type,Cost Price,Selling Price,Category,Quantity'];
  for (const item of items || []) {
    const range = valueRange(item);
    lines.push(row([item.name, item.id || '', 'Inventory', item.price || '', range ? range.high : '', item.category || '', item.quantity ?? 1]));
  }
  return lines.join('\n');
}

function splitCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => {
    const cells = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        cells.push(current);
        current = '';
      } else current += char;
    }
    cells.push(current);
    return cells;
  });
}

export function previewCsv(text) {
  const table = splitCsv(text);
  if (table.length < 2) return { ok: false, error: 'The file has no rows.', rows: [] };
  const header = table[0].map((name) => name.trim());
  const home = header.includes('HB.name');
  const big = header.includes('Item Name');
  if (!home && !big) return { ok: false, error: 'Use a HomeBox or Bigcapital Items CSV.', rows: [] };
  const index = Object.fromEntries(header.map((name, at) => [name, at]));
  const rows = table.slice(1).map((cells) => {
    const pick = (name) => cells[index[name]] || '';
    if (home) {
      return { name: pick('HB.name'), quantity: pick('HB.quantity') || '1', notes: pick('HB.description'), location: pick('HB.location'), price: pick('HB.purchase_price'), purchased: pick('HB.purchase_time').slice(0, 10), category: '' };
    }
    return { name: pick('Item Name'), quantity: pick('Quantity') || '1', notes: '', location: '', price: pick('Cost Price'), purchased: '', category: pick('Category') };
  }).filter((item) => item.name);
  return { ok: true, format: home ? 'homebox' : 'bigcapital', rows };
}

export function applyImport(storage, rows, ok) {
  if (ok !== true) return { ok: false, error: 'Tap OK before these rows are kept.' };
  const kept = [];
  for (const row of rows || []) {
    const saved = saveItem(storage, row, true);
    if (saved.ok) kept.push(saved.item);
  }
  return { ok: true, count: kept.length };
}

export function readLink(storage) {
  try {
    const saved = JSON.parse(storage.getItem(LINK_KEY) || '{}');
    return {
      homeboxUrl: String(saved.homeboxUrl || ''),
      homeboxToken: String(saved.homeboxToken || ''),
      bigcapitalUrl: String(saved.bigcapitalUrl || ''),
      bigcapitalToken: String(saved.bigcapitalToken || ''),
      enabled: false
    };
  } catch {
    return { homeboxUrl: '', homeboxToken: '', bigcapitalUrl: '', bigcapitalToken: '', enabled: false };
  }
}

export function saveLink(storage, spec, ok) {
  if (ok !== true) return { ok: false, error: 'Tap OK before this is kept.' };
  storage.setItem(LINK_KEY, JSON.stringify({
    homeboxUrl: String(spec.homeboxUrl || '').slice(0, 200),
    homeboxToken: String(spec.homeboxToken || '').slice(0, 200),
    bigcapitalUrl: String(spec.bigcapitalUrl || '').slice(0, 200),
    bigcapitalToken: String(spec.bigcapitalToken || '').slice(0, 200),
    enabled: false
  }));
  return { ok: true, called: false };
}

export function planning(items) {
  const rows = items || [];
  return {
    buy: rows.filter((item) => item.plan === 'buy' || Number(item.quantity) === 0),
    maintain: rows.filter((item) => item.care).map((item) => ({ ...item, next: nextCare(item) })),
    sell: rows.filter((item) => item.plan === 'sell').map((item) => listingDraft(item))
  };
}

function boot() {
  const root = document.getElementById('inventory-app');
  if (!root) return;
  const storage = localStorage;
  const status = document.getElementById('inventory-status');
  const say = (text) => { if (status) status.textContent = text; };
  const view = { sort: 'name', group: '', query: '', grid: false };
  const paint = () => {
    let items = filterItems(readItems(storage), { query: view.query });
    items = sortItems(items, view.sort);
    const host = document.getElementById('inventory-list');
    host.className = view.grid ? 'grid' : 'list';
    host.replaceChildren();
    const groups = view.group ? groupItems(items, view.group) : [['All', items]];
    for (const [name, rows] of groups) {
      if (view.group) host.append(Object.assign(document.createElement('h3'), { textContent: name }));
      for (const item of rows) {
        const card = document.createElement('article');
        const range = valueRange(item);
        card.innerHTML = `<h3></h3><p class="meta"></p><p class="plan"></p>`;
        card.querySelector('h3').textContent = `${item.name} × ${item.quantity ?? 1}`;
        card.querySelector('.meta').textContent = `${item.category || 'Uncategorized'} · ${item.location || 'No location'} · ${item.condition}${range ? ` · estimate ${range.low}–${range.high}` : ''}`;
        card.querySelector('.plan').textContent = item.care ? `Next care ${nextCare(item)}` : 'No reminder yet';
        host.append(card);
      }
    }
    if (!items.length) host.textContent = 'No things yet.';
    const plans = planning(readItems(storage));
    document.getElementById('plan-buy').textContent = plans.buy.map((item) => item.name).join(', ') || 'Nothing to buy.';
    document.getElementById('plan-care').textContent = plans.maintain.map((item) => `${item.next}: ${item.name}`).join(', ') || 'No care dates.';
    document.getElementById('plan-sell').textContent = plans.sell.map((item) => item.title).join(', ') || 'Nothing marked to sell.';
  };
  document.getElementById('inventory-sort').addEventListener('change', (event) => { view.sort = event.target.value; paint(); });
  document.getElementById('inventory-group').addEventListener('change', (event) => { view.group = event.target.value; paint(); });
  document.getElementById('inventory-q').addEventListener('input', (event) => { view.query = event.target.value; paint(); });
  document.getElementById('inventory-grid').addEventListener('click', () => { view.grid = !view.grid; paint(); });
  document.getElementById('inventory-save').addEventListener('click', () => {
    const saved = saveItem(storage, {
      name: document.getElementById('item-name').value,
      category: document.getElementById('item-category').value,
      location: document.getElementById('item-location').value,
      quantity: document.getElementById('item-qty').value,
      price: document.getElementById('item-price').value,
      purchased: document.getElementById('item-date').value,
      condition: document.getElementById('item-condition').value,
      plan: document.getElementById('item-plan').value
    }, true);
    say(saved.ok ? `Kept ${saved.item.name} on this phone.` : saved.error);
    paint();
  });
  document.getElementById('export-homebox').addEventListener('click', () => {
    document.getElementById('export-preview').textContent = toHomeboxCsv(readItems(storage));
    document.getElementById('export-hold').hidden = false;
    document.getElementById('export-hold').dataset.kind = 'homebox';
  });
  document.getElementById('export-bigcapital').addEventListener('click', () => {
    document.getElementById('export-preview').textContent = toBigcapitalCsv(readItems(storage));
    document.getElementById('export-hold').hidden = false;
    document.getElementById('export-hold').dataset.kind = 'bigcapital';
  });
  document.getElementById('export-ok').addEventListener('click', () => {
    const text = document.getElementById('export-preview').textContent;
    const blob = new Blob([text], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = document.getElementById('export-hold').dataset.kind === 'bigcapital' ? 'bigcapital-items.csv' : 'homebox-items.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    say('CSV saved from this phone. Nothing was uploaded.');
  });
  document.getElementById('import-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = previewCsv(await file.text());
    const box = document.getElementById('import-preview');
    box.hidden = false;
    box.textContent = preview.ok ? `${preview.rows.length} ${preview.format} rows. Tap OK to keep them.` : preview.error;
    box.dataset.rows = preview.ok ? JSON.stringify(preview.rows) : '';
  });
  document.getElementById('import-ok').addEventListener('click', () => {
    let rows = [];
    try { rows = JSON.parse(document.getElementById('import-preview').dataset.rows || '[]'); } catch { rows = []; }
    const saved = applyImport(storage, rows, true);
    say(saved.ok ? `Kept ${saved.count} on this phone.` : saved.error);
    paint();
  });
  document.getElementById('link-ok').addEventListener('click', () => {
    const saved = saveLink(storage, {
      homeboxUrl: document.getElementById('homebox-url').value,
      homeboxToken: document.getElementById('homebox-token').value,
      bigcapitalUrl: document.getElementById('bigcapital-url').value,
      bigcapitalToken: document.getElementById('bigcapital-token').value
    }, true);
    say(saved.ok ? 'Connection notes kept on this phone. No call was made.' : saved.error);
  });
  document.getElementById('sell-draft').addEventListener('click', () => {
    const item = readItems(storage).find((row) => row.plan === 'sell');
    if (!item) { say('Mark an item as sell, then tap OK.'); return; }
    const draft = { ...listingDraft(item), proof: proofPanel(item) };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    say(`${draft.proof.line} Not posted.`);
  });
  paint();
}

if (typeof document !== 'undefined') boot();
