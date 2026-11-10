const STATUSES = new Set(['available', 'training', 'resting', 'away']);
const DAYS = new Set(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
const PRIVATE = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\blatitude\b|\blongitude\b|\$Trust/i;

export const ENCOURAGEMENTS = Object.freeze(['Nice work.', 'See you at the club.', 'Rest counts too.']);
export const ONLINE_MS = 45 * 1000;
export const RECENT_MS = 10 * 60 * 1000;
export const PRESENCE_MS = 30 * 60 * 1000;

function handleOf(value) {
  return String(value || '').trim().slice(0, 40);
}

export function publicPresence(spec = {}) {
  const handle = handleOf(spec.handle);
  const code = String(spec.code || '').trim().toLowerCase();
  if (!handle || !code) return { ok: false, error: 'A handle and a group are required.' };
  const share = spec.share === true;
  const status = STATUSES.has(spec.status) ? spec.status : 'available';
  const note = String(spec.note || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (note && PRIVATE.test(note)) return { ok: false, error: 'Leave the note plain.' };
  const connect = spec.connect === 'online' || spec.connect === 'ok' ? spec.connect : '';
  const until = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(spec.until || '')) ? String(spec.until).slice(0, 16) : '';
  return {
    ok: true,
    row: {
      handle,
      code,
      status: share ? status : '',
      note: share ? note : '',
      share,
      connect,
      until,
      contactKey: spec.contactKey?.x && spec.contactKey?.y ? { x: spec.contactKey.x, y: spec.contactKey.y } : null,
      at: String(spec.at || ''),
      seen: String(spec.seen || spec.at || ''),
      hedera: false
    }
  };
}

export function contactKeys(rows) {
  return (rows || []).filter((row) => row?.contactKey?.x && row?.contactKey?.y).map((row) => ({
    handle: row.handle,
    contactKey: { x: row.contactKey.x, y: row.contactKey.y },
    hedera: false
  }));
}

export function visibleConnect(rows, now = Date.now()) {
  return (rows || []).filter((row) => {
    if (row?.connect !== 'online' && row?.connect !== 'ok') return false;
    const seen = Date.parse(row.seen || row.at || '');
    if (!Number.isFinite(seen) || now - seen > PRESENCE_MS) return false;
    const until = Date.parse(row.until || '');
    if (row.until && Number.isFinite(until) && now > until) return false;
    return true;
  }).map((row) => ({ handle: row.handle, connect: row.connect, until: row.until || '', hedera: false }));
}

export function inQuietHours(quiet, now = new Date()) {
  if (!quiet?.start || !quiet?.end) return false;
  const [sh, sm] = String(quiet.start).split(':').map(Number);
  const [eh, em] = String(quiet.end).split(':').map(Number);
  if (![sh, sm, eh, em].every((part) => Number.isFinite(part))) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  if (start < end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export function timeProposal(text) {
  const match = String(text || '').match(/^Time: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match ? match[1] : '';
}

export function publicEncouragement(spec = {}) {
  const from = handleOf(spec.from);
  const to = handleOf(spec.to);
  const text = String(spec.text || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!from || !to || from === to || !text) return { ok: false, error: 'Choose a member and a short note.' };
  if (PRIVATE.test(text)) return { ok: false, error: 'Leave the note plain.' };
  return { ok: true, row: { from, to, text, at: String(spec.at || ''), hedera: false } };
}

export function visibleMembers(rows, now = Date.now()) {
  return (rows || []).filter((row) => row?.share === true && row.status).map((row) => {
    const seen = Date.parse(row.seen || row.at || '');
    const age = Number.isFinite(seen) ? now - seen : RECENT_MS + 1;
    const dot = age <= ONLINE_MS ? 'online' : age <= RECENT_MS ? 'recent' : 'quiet';
    return { handle: row.handle, status: row.status, note: row.note || '', dot, hedera: false };
  });
}

export function unreadCount(rows, handle, seenAt) {
  const mine = handleOf(handle);
  const since = Date.parse(seenAt || '') || 0;
  return (rows || []).filter((row) => {
    const to = row.to || '';
    const from = row.from || row.handle || '';
    if (to && to !== mine) return false;
    if (!to && from === mine) return false;
    const at = Date.parse(row.at || '') || 0;
    return at > since;
  }).length;
}

export function reminderRecord(spec = {}) {
  const days = (spec.days || []).filter((day) => DAYS.has(day));
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(spec.time || '')) ? spec.time : '';
  const text = String(spec.text || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!days.length || !time || !text) return { ok: false, error: 'Choose a day, a time, and a gentle line.' };
  return { ok: true, reminder: { days, time, text } };
}
