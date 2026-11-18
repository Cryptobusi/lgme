export const ITEM_KEY = 'lgme.ihavit.items';
export const DRAFT_KEY = 'lgme.iselit.draft';
export const CONDITIONS = Object.freeze(['new', 'like new', 'good', 'fair', 'poor']);

const RATES = Object.freeze({ new: 0.95, 'like new': 0.85, good: 0.7, fair: 0.5, poor: 0.3 });

export function suggestCare(name, category = '') {
  const text = `${name} ${category}`.toLowerCase();
  if (/bike|bicycle/.test(text)) return { everyDays: 90, task: 'Check the chain, tires, and brakes.' };
  if (/phone|laptop|computer|tablet/.test(text)) return { everyDays: 180, task: 'Check the battery and install updates.' };
  if (/car|vehicle|truck/.test(text)) return { everyDays: 180, task: 'Check the oil, tires, and lights.' };
  if (/knife|tool|saw/.test(text)) return { everyDays: 30, task: 'Clean it and check the edge.' };
  return { everyDays: 365, task: 'Look it over and note the condition.' };
}

export function valueRange({ price, purchased, condition, today = new Date().toISOString().slice(0, 10) } = {}) {
  const paid = Number(price);
  if (!Number.isFinite(paid) || paid < 0 || !CONDITIONS.includes(condition)) return null;
  const start = Date.parse(purchased);
  const end = Date.parse(today);
  const years = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start) / 86400000 / 365) : 0;
  const kept = Math.max(0.2, 1 - years * 0.15) * RATES[condition];
  const mid = paid * kept;
  const low = Math.round(mid * 0.8);
  const high = Math.max(low, Math.round(mid * 1.2));
  return { low, high, note: 'Estimate only. Not an appraisal.' };
}

export function listingDraft(item, today) {
  const range = valueRange({ ...item, today });
  return {
    kind: 'iselit',
    title: String(item.name || '').slice(0, 80),
    description: `${item.name || 'Item'}. Condition: ${item.condition || 'good'}. ${item.notes || ''}`.trim().slice(0, 280),
    condition: item.condition || 'good',
    priceLow: range ? range.low : '',
    priceHigh: range ? range.high : '',
    posted: false
  };
}

export function readItems(storage) {
  try {
    const rows = JSON.parse(storage.getItem(ITEM_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

export function saveItem(storage, spec, ok) {
  if (ok !== true) return { ok: false, error: 'Tap OK before this is kept.' };
  const name = String(spec.name || '').trim().slice(0, 80);
  if (!name) return { ok: false, error: 'Add a name.' };
  if (spec.condition && !CONDITIONS.includes(spec.condition)) return { ok: false, error: 'Choose a condition.' };
  const item = {
    id: spec.id || `thing-${Date.now()}`,
    name,
    category: String(spec.category || '').trim().slice(0, 40),
    photo: String(spec.photo || '').slice(0, 200000),
    purchased: String(spec.purchased || '').slice(0, 10),
    price: String(spec.price || '').slice(0, 12),
    condition: CONDITIONS.includes(spec.condition) ? spec.condition : 'good',
    notes: String(spec.notes || '').trim().slice(0, 280),
    warranty: String(spec.warranty || '').slice(0, 10),
    care: null
  };
  const items = readItems(storage).filter((row) => row.id !== item.id);
  items.unshift(item);
  storage.setItem(ITEM_KEY, JSON.stringify(items));
  return { ok: true, item, suggestion: suggestCare(item.name, item.category) };
}

export function confirmCare(storage, id, care, ok) {
  if (ok !== true) return { ok: false, error: 'Tap OK before the schedule is kept.' };
  const days = Math.max(1, Math.round(Number(care?.everyDays) || 0));
  const task = String(care?.task || '').trim().slice(0, 160);
  if (!task) return { ok: false, error: 'Add what to do.' };
  const items = readItems(storage);
  const item = items.find((row) => row.id === id);
  if (!item) return { ok: false, error: 'That item is not on this phone.' };
  item.care = { everyDays: days, task, from: new Date().toISOString().slice(0, 10) };
  storage.setItem(ITEM_KEY, JSON.stringify(items));
  return { ok: true, item };
}

export function reminderList(items, today = new Date().toISOString().slice(0, 10)) {
  const end = Date.parse(today);
  return items.filter((item) => item.care).map((item) => {
    const start = Date.parse(item.care.from);
    const due = Number.isFinite(start) ? start + item.care.everyDays * 86400000 : end;
    return { id: item.id, name: item.name, task: item.care.task, due: new Date(due).toISOString().slice(0, 10), ready: Number.isFinite(end) && due <= end };
  });
}

function boot() {
  const root = document.getElementById('ihavit-app');
  if (!root) return;
  const storage = localStorage;
  const status = document.getElementById('ihavit-status');
  const list = document.getElementById('ihavit-list');
  const reminders = document.getElementById('ihavit-reminders');
  const say = (text) => { if (status) status.textContent = text; };
  const paint = () => {
    const items = readItems(storage);
    list.replaceChildren();
    if (!items.length) list.append(Object.assign(document.createElement('li'), { textContent: 'No things yet.' }));
    for (const item of items) {
      const row = document.createElement('li');
      row.className = 'frame';
      const range = valueRange(item);
      const title = document.createElement('h3');
      title.textContent = item.name;
      const meta = document.createElement('p');
      meta.textContent = `${item.category || 'Uncategorized'} · ${item.condition} · bought ${item.purchased || 'unknown'}`;
      const estimate = document.createElement('p');
      estimate.textContent = range ? `Estimate ${range.low}–${range.high}. ${range.note}` : 'Add a purchase price to see an estimate. Not an appraisal.';
      row.append(title, meta, estimate);
      if (!item.care) {
        const idea = suggestCare(item.name, item.category);
        const days = document.createElement('input');
        days.value = String(idea.everyDays);
        days.setAttribute('aria-label', `Days between care for ${item.name}`);
        const task = document.createElement('input');
        task.value = idea.task;
        task.setAttribute('aria-label', `Care task for ${item.name}`);
        const keep = document.createElement('button');
        keep.type = 'button';
        keep.textContent = 'OK';
        keep.addEventListener('click', () => {
          const saved = confirmCare(storage, item.id, { everyDays: days.value, task: task.value }, true);
          say(saved.ok ? 'Schedule kept on this phone.' : saved.error);
          paint();
        });
        row.append(days, task, keep);
      } else {
        const care = document.createElement('p');
        care.textContent = `Every ${item.care.everyDays} days: ${item.care.task}`;
        row.append(care);
      }
      const sell = document.createElement('button');
      sell.type = 'button';
      sell.textContent = 'IselIt';
      sell.addEventListener('click', () => {
        const draft = listingDraft(item);
        const hold = document.getElementById('iselit-draft');
        hold.hidden = false;
        hold.dataset.item = item.id;
        document.getElementById('iselit-title').textContent = draft.title;
        document.getElementById('iselit-body').textContent = `${draft.description} Suggested ${draft.priceLow}–${draft.priceHigh}. Draft only. Not posted.`;
      });
      row.append(sell);
      list.append(row);
    }
    const due = reminderList(items);
    reminders.replaceChildren();
    if (!due.length) reminders.append(Object.assign(document.createElement('li'), { textContent: 'No reminders yet.' }));
    for (const row of due) reminders.append(Object.assign(document.createElement('li'), { textContent: `${row.ready ? 'Due' : 'Later'} · ${row.name}: ${row.task} (${row.due})` }));
  };
  document.getElementById('ihavit-save').addEventListener('click', () => {
    const photo = document.getElementById('ihavit-photo');
    const keep = (src) => {
      const saved = saveItem(storage, {
        name: document.getElementById('ihavit-name').value,
        category: document.getElementById('ihavit-category').value,
        purchased: document.getElementById('ihavit-purchased').value,
        price: document.getElementById('ihavit-price').value,
        condition: document.getElementById('ihavit-condition').value,
        notes: document.getElementById('ihavit-notes').value,
        warranty: document.getElementById('ihavit-warranty').value,
        photo: src || ''
      }, true);
      say(saved.ok ? `Kept ${saved.item.name}. Suggested care: every ${saved.suggestion.everyDays} days. Tap OK on the item to keep the schedule.` : saved.error);
      paint();
    };
    const file = photo.files?.[0];
    if (!file) { keep(''); return; }
    const reader = new FileReader();
    reader.onload = () => keep(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  document.getElementById('iselit-ok').addEventListener('click', () => {
    const id = document.getElementById('iselit-draft').dataset.item;
    const item = readItems(storage).find((row) => row.id === id);
    if (!item) { say('Choose an item first.'); return; }
    const draft = listingDraft(item);
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    say('Draft kept on this phone. Not posted.');
  });
  document.getElementById('ihavit-remind').addEventListener('click', () => {
    import('./device-ask.mjs').then(({ askDevice }) => {
      askDevice({
        kind: 'notifications',
        purpose: 'Reminders for your things stay on this phone. The browser asks only after Allow. The list below works either way.',
        allow: () => {
          if (!globalThis.Notification) { say('This browser has no notifications. The list on this page is the reminder.'); return; }
          Notification.requestPermission().then((choice) => {
            say(choice === 'granted' ? 'Reminders can appear on this phone. Nothing was sent.' : 'Notifications stay off. The list on this page is the reminder.');
          }).catch(() => say('The list on this page is the reminder.'));
        },
        deny: () => say('The list on this page is the reminder.')
      });
    });
  });
  paint();
}

if (typeof document !== 'undefined') boot();
