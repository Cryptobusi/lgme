import { haversineMeters } from './exercise-record.mjs';
import { check, gymCardSchema } from './input-schema.mjs';

export const SHARE_LEVELS = Object.freeze(['me', 'groups', 'board']);
export const BOARD_NOTE = 'Shared board starts when sync is on.';

export const PROGRESS_KINDS = Object.freeze([
  { id: 'calories', label: 'Calories', unit: 'kcal', manual: true },
  { id: 'miles', label: 'Miles', unit: 'mi', gps: true },
  { id: 'km', label: 'Kilometers', unit: 'km', gps: true },
  { id: 'minutes', label: 'Minutes', unit: 'min', duration: true },
  { id: 'sessions', label: 'Sessions', unit: 'sessions', count: true },
  { id: 'credits-earned', label: 'Credits earned', unit: 'credits', tape: 'earned' },
  { id: 'credits-given', label: 'Credits given', unit: 'credits', tape: 'given' },
  { id: 'verified', label: 'Verified sessions', unit: 'sessions', verified: true },
  { id: 'health', label: 'Health meter', unit: '1-10', health: true }
]);

const PRIVATE = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\blatitude\b|\blongitude\b/i;

export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function addDays(key, days) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function inWeek(day, week) {
  if (!day || !week) return false;
  return day >= week && day < addDays(week, 7);
}

export function chooseProgress(spec = {}) {
  const ids = [...new Set(spec.kinds || [])].filter((id) => PROGRESS_KINDS.some((kind) => kind.id === id));
  if (ids.length < 3 || ids.length > 5) return { ok: false, error: 'Pick 3 to 5 categories.' };
  let custom = null;
  const name = String(spec.customName || '').trim().slice(0, 24);
  const unit = String(spec.customUnit || '').trim().slice(0, 12);
  if (name || unit) {
    if (!name || !unit) return { ok: false, error: 'A custom category needs a name and a unit.' };
    if (PRIVATE.test(`${name} ${unit}`)) return { ok: false, error: 'Leave out links, emails, and phone numbers.' };
    custom = { name, unit };
  }
  const share = {};
  for (const id of [...ids, ...(custom ? ['custom'] : [])]) share[id] = 'me';
  return {
    ok: true,
    progress: { chosen: ids, custom, allowGps: spec.allowGps === true, share, manual: [] }
  };
}

export function shareLevel(value) {
  return SHARE_LEVELS.includes(value) ? value : 'me';
}

function round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function pathDistance(points) {
  let meters = 0;
  for (let i = 1; i < (points || []).length; i += 1) {
    if (Number.isFinite(points[i]?.lat) && Number.isFinite(points[i - 1]?.lat)) meters += haversineMeters(points[i - 1], points[i]);
  }
  return meters;
}

function sessionsIn(peer, week) {
  return Object.values(peer?.exerciseSessions || {}).filter((session) => inWeek(session.day, week));
}

function manualIn(progress, kind, week) {
  return (progress.manual || []).filter((row) => row.kind === kind && inWeek(String(row.at || '').slice(0, 10), week));
}

function tapeIn(peer, week) {
  return (peer?.tape || []).filter((entry) => inWeek(String(entry.at || '').slice(0, 10), week));
}

function measure(peer, kind, week) {
  const progress = peer?.gymProgress || {};
  const sessions = sessionsIn(peer, week);
  const manual = manualIn(progress, kind.id, week);
  if (kind.duration) return sessions.reduce((sum, session) => sum + Math.max(0, Number(session.durationSec || 0) / 60), 0);
  if (kind.count) return sessions.length;
  if (kind.verified) return sessions.filter((session) => String(session.evidence || '').includes('verified by')).length;
  if (kind.gps) {
    let meters = 0;
    if (progress.allowGps) {
      for (const session of sessions) {
        if (!(session.sensors || []).includes('gps')) continue;
        meters += pathDistance(peer.exercisePrivate?.[session.sessionId]?.bundle?.points);
      }
    }
    const added = manual.reduce((sum, row) => sum + Number(row.value || 0), 0);
    return kind.id === 'km' ? meters / 1000 + added : meters / 1609.344 + added;
  }
  if (kind.health) {
    const latest = manual.at(-1);
    if (!latest) return 0;
    return ((Number(latest.energy) || 0) + (Number(latest.mood) || 0) + (Number(latest.sleep) || 0)) / 3;
  }
  if (kind.tape === 'earned' || kind.tape === 'given') {
    let credits = 0;
    for (const entry of tapeIn(peer, week)) {
      const payload = entry.payload || {};
      if (kind.tape === 'earned' && entry.type === 'EXERCISE_CREDIT' && payload.toId === peer.id) credits += Number(payload.authorShare || payload.amount || 0);
      if (kind.tape === 'given' && entry.type === 'EXERCISE_CREDIT' && payload.fromId === peer.id) credits += Number(payload.amount || 0);
      if (kind.tape === 'earned' && entry.type === 'transfer' && payload.direction === 'in' && payload.toId === peer.id) credits += 0;
      if (kind.tape === 'given' && entry.type === 'transfer' && payload.direction === 'out' && payload.fromId === peer.id) credits += 0;
    }
    return credits;
  }
  if (kind.id === 'custom') return manual.reduce((sum, row) => sum + Number(row.value || 0), 0);
  return manual.reduce((sum, row) => sum + Number(row.value || 0), 0);
}

function moneyNote(peer, week) {
  let lgmeIn = 0;
  let lgmeOut = 0;
  let usd = 0;
  for (const entry of tapeIn(peer, week)) {
    const payload = entry.payload || {};
    if (entry.type === 'transfer' && payload.unit === '$lgme' && payload.direction === 'in' && payload.toId === peer.id) lgmeIn += Number(payload.amount || 0);
    if (entry.type === 'transfer' && payload.unit === '$lgme' && payload.direction === 'out' && payload.fromId === peer.id) lgmeOut += Number(payload.amount || 0);
    if (entry.type === 'WISDOM_SUPPORT' && payload.unit === 'USD' && payload.toId === peer.id) usd += Number(payload.usd || payload.amount || 0);
  }
  return { lgmeIn: round1(lgmeIn), lgmeOut: round1(lgmeOut), usd: round1(usd) };
}

function selfReported(kind, progress, week) {
  if (kind.health || kind.manual) return manualIn(progress, kind.id, week).length > 0 || kind.manual === true || kind.health === true;
  if (kind.id === 'custom') return true;
  if (kind.gps) return manualIn(progress, kind.id, week).some((row) => row.source !== 'example');
  return false;
}

export function progressRows(peer, now = new Date()) {
  const progress = peer?.gymProgress;
  if (!progress?.chosen?.length) return [];
  const currentWeek = weekKey(now);
  const weeks = [3, 2, 1, 0].map((ago) => addDays(currentWeek, -7 * ago));
  const kinds = progress.chosen.map((id) => PROGRESS_KINDS.find((kind) => kind.id === id)).filter(Boolean);
  if (progress.custom) kinds.push({ id: 'custom', label: progress.custom.name, unit: progress.custom.unit, manual: true });
  return kinds.map((kind) => {
    const series = weeks.map((week) => round1(measure(peer, kind, week)));
    const current = series.at(-1) || 0;
    const previous = series.at(-2) || 0;
    const reported = kind.health || kind.id === 'calories' || kind.id === 'custom' || selfReported(kind, progress, currentWeek);
    return {
      id: kind.id,
      label: kind.label,
      unit: kind.unit,
      current,
      previous,
      change: round1(current - previous),
      series,
      week: currentWeek,
      share: shareLevel(progress.share?.[kind.id]),
      selfReported: Boolean(reported),
      health: Boolean(kind.health),
      money: kind.tape ? moneyNote(peer, currentWeek) : null
    };
  });
}

export function sharePreview(peer, row) {
  if (!row) return null;
  const handle = peer?.name || 'Member';
  const number = row.current;
  const verb = row.id === 'miles' || row.id === 'km' ? 'covered' : row.id === 'minutes' ? 'moved' : 'logged';
  const line = `${handle} ${verb} ${number} ${row.unit} this week`;
  return {
    handle,
    example: Boolean(peer?.example),
    category: row.label,
    number,
    unit: row.unit,
    week: row.week,
    selfReported: row.selfReported,
    line
  };
}

const PRIVATE_CARD = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\blatitude\b|\blongitude\b/i;

export function publicProgressCard(spec = {}) {
  const parsed = check(spec, gymCardSchema, 'card');
  if (!parsed.ok) return parsed;
  const handle = spec.handle;
  const category = spec.category;
  const unit = spec.unit;
  const line = String(spec.line || '');
  if (PRIVATE_CARD.test(`${handle} ${category} ${unit} ${line}`)) {
    return { ok: false, error: 'Leave out links, emails, phone numbers, and location.' };
  }
  return {
    ok: true,
    card: {
      handle,
      category,
      number: spec.number,
      unit,
      week: spec.week,
      selfReported: spec.selfReported === true,
      example: spec.example === true,
      line,
      hedera: false
    }
  };
}

export function boardCards(peers, now = new Date()) {
  const cards = [];
  for (const peer of peers || []) {
    for (const row of progressRows(peer, now)) {
      if (row.share !== 'board') continue;
      const preview = sharePreview(peer, row);
      cards.push(preview);
    }
  }
  return cards;
}

export function manualEntry(spec = {}) {
  const kind = String(spec.kind || '');
  const at = spec.at || new Date().toISOString();
  if (kind === 'health') {
    const energy = Math.round(Number(spec.energy));
    const mood = Math.round(Number(spec.mood));
    const sleep = Math.round(Number(spec.sleep));
    if ([energy, mood, sleep].some((value) => value < 1 || value > 10)) {
      return { ok: false, error: 'Health meter scores are 1 to 10. This is self-reported, not medical.' };
    }
    return { ok: true, entry: { kind, energy, mood, sleep, at, source: 'self-reported' } };
  }
  const value = Number(spec.value);
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: 'Enter a number.' };
  const known = PROGRESS_KINDS.some((item) => item.id === kind) || kind === 'custom';
  if (!known) return { ok: false, error: 'That category is not on this page.' };
  return { ok: true, entry: { kind, value, at, source: spec.source === 'example' ? 'example' : 'self-reported' } };
}
