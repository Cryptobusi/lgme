import { intentTitle } from './wisdom.mjs';

export const EXERCISE_CATEGORIES = Object.freeze(['strength', 'cardio', 'mobility', 'mixed']);
export const EVIDENCE_UNVERIFIED = 'phone-recorded (unverified)';
export const EVIDENCE_VERIFIED = 'phone-recorded + verified by trainer/group member';
export const EVIDENCE_LEVELS = Object.freeze([EVIDENCE_UNVERIFIED, EVIDENCE_VERIFIED]);
export const SENSOR_NAMES = Object.freeze(['gps', 'camera', 'motion']);

export const PUBLIC_FIELDS = Object.freeze(['completed', 'day', 'category', 'evidence', 'terms', 'durationSec', 'sensors', 'locationMatched', 'intent']);

export function publicExerciseItem(spec = {}) {
  const category = EXERCISE_CATEGORIES.includes(spec.category) ? spec.category : '';
  const evidence = EVIDENCE_LEVELS.includes(spec.evidence) ? spec.evidence : '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(spec.day || '')) ? spec.day : '';
  const terms = String(spec.terms || '').trim().slice(0, 160);
  const durationSec = Math.round(Number(spec.durationSec));
  const sensors = SENSOR_NAMES.filter((name) => (spec.sensors || []).includes(name));
  const locationMatched = spec.locationMatched === 'yes' ? 'yes' : 'no';
  if (!category || !evidence || !day) return { ok: false, error: 'Add the day, the category, and the evidence level.' };
  if (!Number.isFinite(durationSec) || durationSec < 0) return { ok: false, error: 'Duration comes from Start and Finish.' };
  if (/@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i.test(terms)) {
    return { ok: false, error: 'Support terms cannot include an email, a link, or a phone number.' };
  }
  const intent = intentTitle(spec.intent, spec.allowedIntents);
  const item = { completed: true, day, category, evidence, terms, durationSec, sensors, locationMatched };
  if (intent) item.intent = intent;
  return { ok: true, item };
}

export function haversineMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function locationMatched(points, fence) {
  const samples = (points || []).filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon));
  if (!fence || !Number.isFinite(fence.lat) || !Number.isFinite(fence.lon) || !(fence.radiusM > 0) || !samples.length) return 'no';
  return samples.every((point) => haversineMeters(point, fence) <= fence.radiusM) ? 'yes' : 'no';
}

export function canonicalEvidence(bundle) {
  return JSON.stringify({
    finishedAt: bundle.finishedAt || '',
    photos: bundle.photos || [],
    points: (bundle.points || []).map((point) => ({ acc: point.acc, lat: point.lat, lon: point.lon, t: point.t })),
    samples: bundle.samples || 0,
    startedAt: bundle.startedAt || ''
  });
}

export async function evidenceHash(bundle) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalEvidence(bundle)));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
