export const BOOK_KEY = 'lgme.books.journal';
export const CREO_PER_USD = 100;
export const UPKEEP_CREO = 0.01;
export const CONTRIB_LIVE = 'off';

export const ACCOUNTS = Object.freeze([
  { code: '1000', name: 'Creo held', type: 'asset' },
  { code: '1100', name: '$lgme clearing', type: 'asset' },
  { code: '2100', name: 'Health Floor', type: 'equity' },
  { code: '2200', name: 'Collective fund', type: 'equity' },
  { code: '4000', name: 'Creo earned', type: 'income' },
  { code: '4100', name: 'Contribution income', type: 'income' },
  { code: '5000', name: 'Upkeep', type: 'expense' }
]);

export function emptyBook() {
  return { lines: [], equipment: [], wants: [], donations: [], accounting: false };
}

export function readBook(storage) {
  try {
    const saved = JSON.parse(storage.getItem(BOOK_KEY) || 'null');
    return saved && Array.isArray(saved.lines) ? { ...emptyBook(), ...saved } : emptyBook();
  } catch { return emptyBook(); }
}

export function writeBook(storage, book) {
  storage.setItem(BOOK_KEY, JSON.stringify(book));
  return book;
}

function cents(value) {
  return Math.round(Number(value) * 100);
}

export function addEntry(book, entry, ok) {
  if (ok !== true) return { book, ok: false, error: 'Tap OK before this is kept.' };
  if (entry?.paid === true || CONTRIB_LIVE === 'on') return { book, ok: false, error: 'Payments stay off. LGME_CONTRIB_LIVE is off.' };
  const legs = entry?.legs || [];
  const debit = legs.reduce((sum, leg) => sum + cents(leg.debit || 0), 0);
  const credit = legs.reduce((sum, leg) => sum + cents(leg.credit || 0), 0);
  if (!legs.length || debit !== credit) return { book, ok: false, error: 'The entry does not balance.' };
  const next = {
    ...book,
    lines: [...book.lines, {
      id: entry.id || `j-${book.lines.length + 1}`,
      memo: String(entry.memo || '').slice(0, 180),
      link: String(entry.link || '').slice(0, 80),
      kind: entry.kind || 'journal',
      attested: entry.attested === true,
      paid: false,
      legs
    }]
  };
  return { book: next, ok: true };
}

export function postIdidIt(storage, spec, ok) {
  const book = readBook(storage);
  const saved = addEntry(book, {
    kind: 'ididit',
    memo: `IdidIt ${spec.title || 'receipt'}`,
    link: spec.item || spec.title || '',
    attested: false,
    legs: [
      { account: '1000', debit: UPKEEP_CREO, credit: 0 },
      { account: '4000', debit: 0, credit: UPKEEP_CREO }
    ]
  }, ok);
  if (saved.ok) writeBook(storage, saved.book);
  return saved;
}

export function proofPanel(item, files = []) {
  const photos = (files || []).filter((file) => file.kind === 'photo').map((file) => file.name);
  const receipts = (files || []).filter((file) => file.kind === 'receipt').map((file) => file.name);
  return {
    title: item?.name || 'Item',
    condition: item?.condition || '',
    purchased: item?.purchased || '',
    price: item?.price || '',
    notes: item?.notes || '',
    photos,
    receipts,
    media: Array.isArray(item?.mediaHashes) ? item.mediaHashes : [],
    line: `Proof from IhavIt: ${item?.name || 'item'}, condition ${item?.condition || 'unknown'}.${Array.isArray(item?.mediaHashes) && item.mediaHashes.length ? ` ${item.mediaHashes.length} file fingerprint${item.mediaHashes.length === 1 ? '' : 's'}.` : ''} Not an appraisal.`
  };
}

export function contributionDraft(usd) {
  const creo = Math.round(Number(usd) * CREO_PER_USD * 100) / 100;
  const half = Math.round(creo * 50) / 100;
  return {
    paid: false,
    live: CONTRIB_LIVE,
    memo: `Draft contribution $${usd}. 100 Creo per US$1. Not paid.`,
    legs: [
      { account: '1100', debit: creo, credit: 0 },
      { account: '2100', debit: 0, credit: half },
      { account: '2200', debit: 0, credit: creo - half }
    ]
  };
}

export function upkeepDraft(name) {
  return {
    kind: 'upkeep',
    memo: `Upkeep ${name}. 0.01 Creo. Pending attestation.`,
    link: name,
    attested: false,
    paid: false,
    legs: [
      { account: '5000', debit: UPKEEP_CREO, credit: 0 },
      { account: '1000', debit: 0, credit: UPKEEP_CREO }
    ]
  };
}

export function addEquipment(book, spec, ok) {
  if (ok !== true) return { book, ok: false, error: 'Tap OK before this is kept.' };
  const row = {
    id: spec.id || `eq-${book.equipment.length + 1}`,
    name: String(spec.name || '').slice(0, 80),
    everyDays: Math.max(1, Math.round(Number(spec.everyDays) || 30)),
    task: String(spec.task || 'Check it').slice(0, 120)
  };
  if (!row.name) return { book, ok: false, error: 'Add a name.' };
  return { book: { ...book, equipment: [...book.equipment, row] }, ok: true };
}

export function barterMatches(haves, wants) {
  const drafts = [];
  for (const have of haves || []) {
    for (const want of wants || []) {
      const words = String(want.text || want.name || '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
      const hay = `${have.name} ${have.notes || ''} ${have.category || ''}`.toLowerCase();
      if (words.some((word) => hay.includes(word))) {
        drafts.push({ have: have.name, want: want.text || want.name, haveOk: false, wantOk: false, agreed: false, sent: false });
      }
    }
  }
  return drafts;
}

export function acceptMatch(draft, side, ok) {
  if (ok !== true) return { ...draft, agreed: false, sent: false };
  const next = { ...draft, sent: false };
  if (side === 'have') next.haveOk = true;
  if (side === 'want') next.wantOk = true;
  next.agreed = next.haveOk === true && next.wantOk === true;
  return next;
}

export function donateDraft(spec) {
  return {
    kind: spec.kind || 'item',
    name: String(spec.name || '').slice(0, 80),
    amount: String(spec.amount || ''),
    paid: false,
    live: CONTRIB_LIVE,
    note: 'Donation draft. Not paid. Consult a professional. This is not tax or legal advice.'
  };
}

export function statements(book) {
  const totals = {};
  for (const line of book.lines || []) {
    if (line.paid) continue;
    for (const leg of line.legs) {
      const row = totals[leg.account] || { debit: 0, credit: 0 };
      row.debit += Number(leg.debit || 0);
      row.credit += Number(leg.credit || 0);
      totals[leg.account] = row;
    }
  }
  const balance = ACCOUNTS.filter((account) => account.type === 'asset' || account.type === 'equity').map((account) => ({
    ...account,
    amount: Math.round(((totals[account.code]?.debit || 0) - (totals[account.code]?.credit || 0)) * 100) / 100
  }));
  const pnl = ACCOUNTS.filter((account) => account.type === 'income' || account.type === 'expense').map((account) => ({
    ...account,
    amount: Math.round(((totals[account.code]?.credit || 0) - (totals[account.code]?.debit || 0)) * 100) / 100
  }));
  return { balance, pnl };
}

export function booksCsv(book) {
  const lines = ['Date,Account,Debit,Credit,Memo,Link,Paid'];
  for (const entry of book.lines || []) {
    for (const leg of entry.legs) lines.push([entry.id, leg.account, leg.debit || 0, leg.credit || 0, entry.memo, entry.link, 'no'].join(','));
  }
  return lines.join('\n');
}

export function reviewBundle({ items = [], book = emptyBook() } = {}) {
  const inventory = ['Name,Category,Condition,Quantity', ...items.map((item) => [item.name, item.category || '', item.condition || '', item.quantity ?? 1].join(','))].join('\n');
  const report = [
    'Testnet review. Nothing here is a mainnet write. LGME_CONTRIB_LIVE is off.',
    `Items ${items.length}. Journal lines ${book.lines.length}.`,
    'Consult a professional. This is not tax or legal advice.'
  ].join('\n');
  return { inventory, ledger: booksCsv(book), report };
}

function boot() {
  const root = document.getElementById('books-app');
  if (!root) return;
  const storage = localStorage;
  const say = (text) => { const node = document.getElementById('books-status'); if (node) node.textContent = text; };
  const paint = () => {
    const book = readBook(storage);
    const view = statements(book);
    document.getElementById('books-balance').textContent = view.balance.map((row) => `${row.code} ${row.name} ${row.amount}`).join(' · ') || 'No lines yet.';
    document.getElementById('books-pnl').textContent = view.pnl.map((row) => `${row.code} ${row.name} ${row.amount}`).join(' · ') || 'No lines yet.';
    document.getElementById('books-gear').textContent = book.equipment.map((row) => `${row.name}: every ${row.everyDays} days, ${row.task}`).join(' · ') || 'No shared equipment yet.';
  };
  document.getElementById('gear-ok')?.addEventListener('click', () => {
    const book = readBook(storage);
    const saved = addEquipment(book, {
      name: document.getElementById('gear-name').value,
      everyDays: document.getElementById('gear-days').value,
      task: document.getElementById('gear-task').value
    }, true);
    if (!saved.ok) { say(saved.error); return; }
    writeBook(storage, saved.book);
    say('Equipment kept on this phone.');
    paint();
  });
  document.getElementById('upkeep-ok')?.addEventListener('click', () => {
    const book = readBook(storage);
    const name = document.getElementById('gear-name').value || book.equipment[0]?.name;
    const saved = addEntry(book, upkeepDraft(name || 'equipment'), true);
    if (!saved.ok) { say(saved.error); return; }
    writeBook(storage, saved.book);
    say('Upkeep draft kept. Pending attestation. Not paid.');
    paint();
  });
  document.getElementById('contrib-ok')?.addEventListener('click', () => {
    const book = readBook(storage);
    const saved = addEntry(book, contributionDraft(document.getElementById('contrib-usd').value || '1'), true);
    say(saved.ok ? 'Contribution draft kept. Not paid. LGME_CONTRIB_LIVE is off.' : saved.error);
    if (saved.ok) writeBook(storage, saved.book);
    paint();
  });
  document.getElementById('donate-ok')?.addEventListener('click', () => {
    const book = readBook(storage);
    const draft = donateDraft({ kind: document.getElementById('donate-kind').value, name: document.getElementById('donate-name').value, amount: document.getElementById('donate-amount').value });
    writeBook(storage, { ...book, donations: [...book.donations, draft] });
    say(draft.note);
    paint();
  });
  document.getElementById('books-export')?.addEventListener('click', () => {
    const bundle = reviewBundle({ items: [], book: readBook(storage) });
    document.getElementById('books-report').textContent = `${bundle.report}\n\n${bundle.ledger}`;
  });
  paint();
}

if (typeof document !== 'undefined') boot();
