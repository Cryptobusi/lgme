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
    care: spec.id ? (spec.care || null) : null
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
  item.care = {
    everyDays: days,
    task,
    from: new Date().toISOString().slice(0, 10),
    quote: String(care?.quote || '').slice(0, 180),
    page: care?.page || null,
    source: care?.source === 'manual' ? 'manual' : 'general'
  };
  storage.setItem(ITEM_KEY, JSON.stringify(items));
  return { ok: true, item };
}

export const FILE_LIMITS = Object.freeze({ photo: 2000000, video: 8000000, manual: 4000000, receipt: 2000000, total: 40000000 });
export const OCR_NOTE = 'Words are read from PDF manuals. A photo or scanned page is stored, but this phone does not read words off a picture.';

export function acceptFile(kind, size, used) {
  const cap = FILE_LIMITS[kind];
  if (!cap || size <= 0) return { ok: false, error: 'That file is not one of the kinds this page keeps.' };
  if (size > cap) return { ok: false, error: `That ${kind} is over the limit.` };
  if (used + size > FILE_LIMITS.total) return { ok: false, error: 'This phone is full for My things.' };
  return { ok: true };
}

export function storageMeter(used) {
  const total = FILE_LIMITS.total;
  const safe = Math.max(0, Number(used) || 0);
  return { used: safe, total, label: `${(safe / 1000000).toFixed(1)} MB of ${(total / 1000000).toFixed(0)} MB on this phone` };
}

export function careFromManual(pages, name, category = '') {
  const unit = { day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30, year: 365, years: 365 };
  const suggestions = [];
  for (const sheet of pages || []) {
    const text = String(sheet?.text || '');
    const pattern = /([^.|\n]{0,90}\bevery\s+(\d{1,3})\s+(day|days|week|weeks|month|months|year|years)\b[^.|\n]{0,90})/gi;
    let match = pattern.exec(text);
    while (match) {
      suggestions.push({
        task: match[1].replace(/\s+/g, ' ').trim().slice(0, 160),
        everyDays: Number(match[2]) * unit[match[3].toLowerCase()],
        page: sheet.page || 1,
        quote: match[1].replace(/\s+/g, ' ').trim().slice(0, 180),
        source: 'manual'
      });
      match = pattern.exec(text);
    }
  }
  if (!suggestions.length) {
    const general = suggestCare(name, category);
    return {
      found: false,
      note: 'No routine was found in the manual.',
      suggestions: [{ ...general, page: null, quote: '', source: 'general', label: 'General guidance, not from the manual.' }]
    };
  }
  return { found: true, note: 'From the manual. Tap OK before a reminder is created.', suggestions: suggestions.slice(0, 6) };
}

export function receiptHints(text) {
  const src = String(text || '');
  const iso = src.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const us = src.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  const money = src.match(/(?:total|amount|price)\s*[: ]\s*\$?\s*(\d{1,6}(?:\.\d{2})?)/i) || src.match(/\$\s*(\d{1,6}(?:\.\d{2})?)/);
  let purchased = '';
  if (iso) purchased = iso[1];
  else if (us) purchased = `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return { purchased, price: money ? money[1] : '', note: 'Suggestion from the receipt. Tap OK to keep it. Nothing was saved.' };
}

export function searchThings(items, files, query) {
  const words = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1);
  if (!words.length) return [];
  return (items || []).map((item) => {
    const extra = (files || []).filter((file) => file.itemId === item.id).map((file) => file.text || '').join(' ');
    const hay = `${item.name} ${item.category} ${item.notes} ${extra}`.toLowerCase();
    const score = words.reduce((total, word) => total + (hay.includes(word) ? 1 : 0), 0);
    return { item, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).map((row) => row.item);
}

export function reminderList(items, today = new Date().toISOString().slice(0, 10)) {
  const end = Date.parse(today);
  return items.filter((item) => item.care).map((item) => {
    const start = Date.parse(item.care.from);
    const due = Number.isFinite(start) ? start + item.care.everyDays * 86400000 : end;
    return { id: item.id, name: item.name, task: item.care.task, due: new Date(due).toISOString().slice(0, 10), ready: Number.isFinite(end) && due <= end };
  });
}

function readPdf(buffer) {
  return new Promise((resolve) => {
    try {
      const worker = new Worker('/js/pdf-text-worker.js', { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); resolve([]); }, 4000);
      worker.onmessage = (event) => { clearTimeout(timer); worker.terminate(); resolve(event.data?.pages || []); };
      worker.onerror = () => { clearTimeout(timer); worker.terminate(); resolve([]); };
      worker.postMessage(buffer);
    } catch { resolve([]); }
  });
}

function openFileDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lgme-ihavit-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function fileKind(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) return 'manual';
  if ((file.type || '').startsWith('video/')) return 'video';
  if (/receipt/i.test(file.name || '')) return 'receipt';
  return 'photo';
}

function boot() {
  const root = document.getElementById('ihavit-app');
  if (!root) return;
  const storage = localStorage;
  const status = document.getElementById('ihavit-status');
  const list = document.getElementById('ihavit-list');
  const reminders = document.getElementById('ihavit-reminders');
  const say = (text) => { if (status) status.textContent = text; };
  let files = [];
  let query = '';
  const paint = () => {
    const meter = document.getElementById('ihavit-meter');
    if (meter) meter.textContent = storageMeter(files.reduce((sum, file) => sum + (file.size || 0), 0)).label;
    const items = searchThings(readItems(storage), files, query);
    const shown = query ? items : readItems(storage);
    list.replaceChildren();
    if (!shown.length) list.append(Object.assign(document.createElement('li'), { textContent: query ? 'Nothing matched.' : 'No things yet.' }));
    for (const item of shown) {
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
      const attached = files.filter((file) => file.itemId === item.id);
      if (attached.length) {
        const names = document.createElement('p');
        names.textContent = `Files: ${attached.map((file) => file.name).join(', ')}`;
        row.append(names);
      }
      if (!item.care) {
        const manuals = attached.filter((file) => file.kind === 'manual' && file.pages);
        const fromManual = careFromManual(manuals.flatMap((file) => file.pages || []), item.name, item.category);
        const note = document.createElement('p');
        note.textContent = fromManual.found ? fromManual.note : `${fromManual.note} ${fromManual.suggestions[0].label}`;
        row.append(note);
        for (const idea of fromManual.suggestions) {
          const days = document.createElement('input');
          days.value = String(idea.everyDays);
          days.setAttribute('aria-label', `Days between care for ${item.name}`);
          const task = document.createElement('input');
          task.value = idea.task;
          task.setAttribute('aria-label', `Care task for ${item.name}`);
          const source = document.createElement('p');
          source.textContent = idea.source === 'manual' ? `Page ${idea.page}: “${idea.quote}”` : 'General guidance, not from the manual.';
          const keep = document.createElement('button');
          keep.type = 'button';
          keep.textContent = 'OK';
          keep.addEventListener('click', () => {
            const saved = confirmCare(storage, item.id, { everyDays: days.value, task: task.value, quote: idea.quote, page: idea.page, source: idea.source }, true);
            say(saved.ok ? 'Reminder kept on this phone.' : saved.error);
            paint();
          });
          row.append(source, days, task, keep);
        }
      } else {
        const care = document.createElement('p');
        care.textContent = item.care.source === 'manual' && item.care.quote
          ? `Every ${item.care.everyDays} days: ${item.care.task} Page ${item.care.page}: “${item.care.quote}”`
          : `Every ${item.care.everyDays} days: ${item.care.task}`;
        row.append(care);
      }
      for (const file of attached.filter((row) => row.kind === 'receipt')) {
        const hint = receiptHints(file.text || '');
        const line = document.createElement('p');
        line.textContent = `${hint.note} ${hint.purchased || 'No date'} · ${hint.price || 'No price'}`;
        const use = document.createElement('button');
        use.type = 'button';
        use.textContent = 'OK';
        use.addEventListener('click', () => {
          const saved = saveItem(storage, { ...item, purchased: hint.purchased || item.purchased, price: hint.price || item.price }, true);
          say(saved.ok ? 'Receipt details kept on this phone.' : saved.error);
          paint();
        });
        row.append(line, use);
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
    const due = reminderList(readItems(storage));
    reminders.replaceChildren();
    if (!due.length) reminders.append(Object.assign(document.createElement('li'), { textContent: 'No reminders yet.' }));
    for (const row of due) reminders.append(Object.assign(document.createElement('li'), { textContent: `${row.ready ? 'Due' : 'Later'} · ${row.name}: ${row.task} (${row.due})` }));
  };
  const readChosen = () => {
    const picked = [...(document.getElementById('ihavit-files')?.files || []), ...(document.getElementById('ihavit-capture')?.files || [])];
    return picked.map((file) => ({ file, kind: /receipt/i.test(file.name || '') ? 'receipt' : fileKind(file) }));
  };
  document.getElementById('ihavit-camera')?.addEventListener('click', () => {
    import('./device-ask.mjs').then(({ askDevice }) => {
      askDevice({
        kind: 'camera',
        purpose: 'The camera takes a photo for this thing. The picture stays on this phone. Nothing is uploaded.',
        allow: () => document.getElementById('ihavit-capture')?.click()
      });
    });
  });
  document.getElementById('ihavit-q')?.addEventListener('input', (event) => {
    query = event.target.value;
    paint();
  });
  document.getElementById('ihavit-save').addEventListener('click', async () => {
    const chosen = readChosen();
    const used = files.reduce((sum, file) => sum + (file.size || 0), 0);
    for (const row of chosen) {
      const gate = acceptFile(row.kind, row.file.size, used);
      if (!gate.ok) { say(gate.error); return; }
    }
    const saved = saveItem(storage, {
      name: document.getElementById('ihavit-name').value,
      category: document.getElementById('ihavit-category').value,
      purchased: document.getElementById('ihavit-purchased').value,
      price: document.getElementById('ihavit-price').value,
      condition: document.getElementById('ihavit-condition').value,
      notes: document.getElementById('ihavit-notes').value,
      warranty: document.getElementById('ihavit-warranty').value
    }, true);
    if (!saved.ok) { say(saved.error); return; }
    if (chosen.length && globalThis.indexedDB) {
      const db = await openFileDb();
      for (const row of chosen) {
        const buffer = await row.file.arrayBuffer();
        let pages = [];
        if (row.kind === 'manual' || row.kind === 'receipt') {
          pages = await readPdf(buffer);
        }
        const record = {
          id: `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          itemId: saved.item.id,
          kind: row.kind,
          name: row.file.name,
          type: row.file.type,
          size: row.file.size,
          text: pages.map((page) => page.text).join('\n'),
          pages,
          blob: buffer
        };
        await new Promise((resolve, reject) => {
          const tx = db.transaction('files', 'readwrite');
          tx.objectStore('files').put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        files.push(record);
      }
    }
    say(`Kept ${saved.item.name}. Review the schedule, then tap OK before a reminder is created.`);
    paint();
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
  if (globalThis.indexedDB) {
    openFileDb().then((db) => new Promise((resolve) => {
      const request = db.transaction('files').objectStore('files').getAll();
      request.onsuccess = () => { files = request.result || []; resolve(); };
      request.onerror = () => resolve();
    })).then(paint).catch(() => paint());
  } else paint();
}

if (typeof document !== 'undefined') boot();
