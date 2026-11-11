export const JOIN_STEPS = Object.freeze([
  'You write what you did.',
  'You send the other person a link.',
  'They open it and tap yes.',
  'The note stays on your phones until you both say yes.',
  'Nothing is saved until you both agree.'
]);

const PLAIN = 'In short: you write it, you share a link, they tap yes, and it waits until you both agree. I only explain. I do not sign you up or send anything.';

export function explainJoin(question = '') {
  const q = String(question || '').trim();
  if (!q) return { ok: true, sent: false, text: PLAIN };
  if (/\bsign(?:\s+\w+){0,3}\s+up\b|\b(signup|submit|enroll|register)\b|\b(send|post) it\b/i.test(q)) {
    return { ok: true, sent: false, text: 'I can explain these steps. I cannot sign you up or send anything.' };
  }
  if (/\blink\b/i.test(q)) {
    return { ok: true, sent: false, text: 'The link lets the other person open the same note. You choose when to share it.' };
  }
  if (/\b(yes|agree|confirm)\b/i.test(q)) {
    return { ok: true, sent: false, text: 'They tap yes on their own phone. Until then, the note is only a draft.' };
  }
  if (/\$lgme|\bpeg\b|dollar|us\$/i.test(q)) {
    return { ok: true, sent: false, text: '$lgme is pegged to US$. This step does not take any money.' };
  }
  if (/\bcoins?\b/i.test(q)) {
    return { ok: true, sent: false, text: 'A good deed earns credit, not coins.' };
  }
  if (/\b(hedera|anchor|testnet|attester|third seat)\b/i.test(q)) {
    return { ok: true, sent: false, text: 'This step stays on your phones. I only explain it. I do not send it anywhere.' };
  }
  const step = q.match(/\bstep\s+([1-5])\b/i);
  if (step) return { ok: true, sent: false, text: JOIN_STEPS[Number(step[1]) - 1] };
  return { ok: true, sent: false, text: PLAIN };
}
