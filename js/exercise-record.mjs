export const EXERCISE_CATEGORIES = Object.freeze(['strength', 'cardio', 'mobility', 'mixed']);
export const EVIDENCE_LEVELS = Object.freeze(['self-reported', 'witness', 'device']);
export const PUBLIC_FIELDS = Object.freeze(['completed', 'day', 'category', 'evidence', 'terms']);

export function publicExerciseItem(spec = {}) {
  const category = EXERCISE_CATEGORIES.includes(spec.category) ? spec.category : '';
  const evidence = EVIDENCE_LEVELS.includes(spec.evidence) ? spec.evidence : '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(spec.day || '')) ? spec.day : '';
  const terms = String(spec.terms || '').trim().slice(0, 160);
  if (!category || !evidence || !day) return { ok: false, error: 'Add the day, the category, and the evidence level.' };
  if (/@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i.test(terms)) {
    return { ok: false, error: 'Support terms cannot include an email, a link, or a phone number.' };
  }
  return {
    ok: true,
    item: { completed: true, day, category, evidence, terms }
  };
}

export function privateExerciseNote(spec = {}) {
  return {
    note: String(spec.privateNote || '').slice(0, 500),
    deviceHash: /^[0-9a-f]{64}$/i.test(String(spec.deviceHash || '')) ? String(spec.deviceHash).toLowerCase() : ''
  };
}
