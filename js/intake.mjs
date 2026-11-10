export const INTAKE_STATUSES = Object.freeze(['Pending sponsors', 'Revise', 'Tier-0', 'Tier-1']);

export const GATES = Object.freeze([
  'Grounded Reality',
  'Unencumbered Tools',
  'Direct Labor',
  'Quantifiable Unit',
  'Realistic Capacity'
]);

const PRIVATE_KEYS = ['applicantName', 'trackRecord', 'legalName', 'signature', 'name'];

export function intakeText(raw) {
  return String(raw || '').replace(/\r\n/g, '\n').replace(/\n$/, '');
}

export function intakeParts(raw) {
  const text = intakeText(raw);
  const two = text.indexOf('\nPart II:');
  const three = text.indexOf('\nPart III:');
  if (two < 0 || three < two) return { ok: false, error: 'The intake protocol is missing a part.' };
  return {
    ok: true,
    all: text,
    part1: text.slice(0, two),
    part2: text.slice(two + 1, three),
    part3: text.slice(three + 1)
  };
}

export function offeringPasses(review) {
  return review?.status === 'PASS' && Array.isArray(review.gates) && review.gates.length === 5 && review.gates.every(Boolean);
}

function notesOf(rows) {
  return rows.map((row) => String(row.notes || '').trim()).filter(Boolean);
}

export function intakeOutcome(reviews = []) {
  const rows = Array.isArray(reviews) ? reviews : [];
  if (rows.some((row) => row.primary?.status === 'REJECT' || row.secondary?.status === 'REJECT')) {
    return { status: 'paused', notes: notesOf(rows) };
  }
  if (rows.some((row) => row.primary?.status === 'REVISE' || row.secondary?.status === 'REVISE')) {
    return { status: 'Revise', notes: notesOf(rows) };
  }
  if (rows.length < 2) return { status: 'Pending sponsors', notes: [] };
  const primaryOk = rows.every((row) => offeringPasses(row.primary));
  const secondaryOk = rows.every((row) => offeringPasses(row.secondary));
  if (primaryOk && secondaryOk) return { status: 'Tier-1', notes: [] };
  return { status: 'Tier-0', notes: [] };
}

export function intakeStatusText(status) {
  if (status === 'paused') return 'Application paused';
  if (INTAKE_STATUSES.includes(status)) return status;
  return 'Pending sponsors';
}

export function intakeCreditLimit(intake, earned = 0) {
  if (!intake) return 0;
  if (intake.status === 'Tier-1') return -50;
  if (intake.status === 'Tier-0' && Number(earned) >= 25) return -50;
  return 0;
}

export function publicIntake(record = {}) {
  const copy = {};
  for (const [key, value] of Object.entries(record)) {
    if (PRIVATE_KEYS.includes(key)) continue;
    copy[key] = value;
  }
  return copy;
}

export function addReview(intake, review) {
  const handle = String(review?.handle || '').trim();
  if (!handle || handle === intake?.handle) return { ok: false, error: 'A sponsor is another member.' };
  const primary = review.primary || {};
  const secondary = review.secondary || {};
  const allowed = new Set(['PASS', 'REVISE', 'REJECT']);
  if (!allowed.has(primary.status) || !allowed.has(secondary.status)) {
    return { ok: false, error: 'Mark each offering PASS, REVISE, or REJECT.' };
  }
  const nextReview = {
    handle,
    primary: { gates: (primary.gates || []).slice(0, 5).map(Boolean), status: primary.status },
    secondary: { gates: (secondary.gates || []).slice(0, 5).map(Boolean), status: secondary.status },
    notes: String(review.notes || '').trim().slice(0, 400)
  };
  const reviews = [...(intake.reviews || []).filter((row) => row.handle !== handle), nextReview].slice(0, 2);
  const outcome = intakeOutcome(reviews);
  return {
    ok: true,
    intake: publicIntake({
      ...intake,
      reviews,
      status: outcome.status,
      notes: outcome.notes
    })
  };
}

export function reviewCanonical(intake = {}) {
  return JSON.stringify({
    handle: String(intake.handle || ''),
    primary: String(intake.primary || ''),
    secondary: String(intake.secondary || ''),
    reviews: (intake.reviews || []).map((row) => ({
      primary: { gates: row.primary?.gates || [], status: row.primary?.status || '' },
      secondary: { gates: row.secondary?.gates || [], status: row.secondary?.status || '' }
    })),
    status: intake.status || ''
  });
}

export async function reviewHash(intake) {
  const bytes = new TextEncoder().encode(reviewCanonical(intake));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sharePrivate(body = {}, viewer = '') {
  const sponsors = Array.isArray(body.sponsors) ? body.sponsors.map((item) => String(item || '').trim()) : [];
  const who = String(viewer || '').trim();
  if (!who || !sponsors.includes(who)) return { ok: false, error: 'That record stays with the two sponsors.' };
  return {
    ok: true,
    private: {
      applicantName: String(body.applicantName || '').trim(),
      trackRecord: String(body.trackRecord || '').trim()
    }
  };
}
