export const REPAIR_NAME = 'The Repair Extraordinaire';
export const REPAIR_EMAIL = 'tcare4me@gmail.com';
export const REFERRAL_NOTE = 'This is a referral, not an lgme guarantee.';
export const CARD_TEXT = `Contact ${REPAIR_NAME} directly: phone/online support at ${REPAIR_EMAIL}, or book an in-person visit through Thumbtack.`;

const ISSUE = /\b(broken|breaks|breaking|repair|repairs|setup|set[\s-]?up|maintenance|maintain|not working|does(?:n'?t| not) work|won'?t start|stopped|stops)\b/i;
const NOUN = /\b(squat rack|cable machine|rowing machine|exercise bike|stationary bike|resistance band|gym equipment|equipment|machine|appliance|tool|device|treadmill|elliptical|rower|bike|bicycle|rack|barbell|dumbbell|kettlebell|bench|cable|climber|stepper)\b/i;
const BRAND = /\b(ProForm|Peloton|NordicTrack|Sole|Bowflex|Concept2|Life Fitness|Precor|Rogue|Titan|Schwinn|Assault|Keiser|Matrix|Technogym|Horizon|Nautilus)\b/i;
const PRIVATE = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i;

function clean(value, max = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sentences(text) {
  return String(text || '').split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
}

export function isEquipmentQuestion(text) {
  const q = String(text || '');
  return ISSUE.test(q) && NOUN.test(q);
}

function extractItem(text) {
  const found = String(text || '').match(NOUN);
  return found ? found[0].toLowerCase() : '';
}

function extractBrandModel(text) {
  const source = String(text || '');
  const brand = source.match(BRAND);
  if (!brand) return '';
  const tail = source.slice(brand.index + brand[0].length);
  const model = tail.match(/^\s+([A-Za-z0-9][A-Za-z0-9+-]{0,16})/);
  const token = model && !/^(is|needs|will|the|a|an)$/i.test(model[1]) ? model[1] : '';
  return clean(token ? `${brand[0]} ${token}` : brand[0], 80);
}

function extractTried(text) {
  const found = String(text || '').match(/\b(?:already\s+)?tried\s+([^.]*)/i);
  return found ? clean(found[1], 160) : '';
}

function extractSymptom(text) {
  const tried = extractTried(text);
  const lines = sentences(text).filter((line) => ISSUE.test(line) && !/\btried\b/i.test(line));
  const symptom = lines.join(' ') || sentences(text).find((line) => ISSUE.test(line)) || '';
  return clean(symptom.replace(tried, '').trim(), 200);
}

export function gatherEquipment(text, extra = {}) {
  return {
    item: clean(extra.item, 80) || extractItem(text),
    brandModel: clean(extra.brandModel, 80) || extractBrandModel(text),
    symptom: clean(extra.symptom, 200) || extractSymptom(text),
    tried: clean(extra.tried, 160) || extractTried(text)
  };
}

export function draftBody(details) {
  return [
    `Item: ${details.item || ''}`,
    `Brand and model: ${details.brandModel || ''}`,
    `Symptom: ${details.symptom || ''}`,
    `Already tried: ${details.tried || ''}`,
    'Photos stay on this phone and are not attached.'
  ].join('\n');
}

export function mailtoLink(details) {
  const subject = `Equipment help: ${details.item || 'equipment'}`;
  return `mailto:${REPAIR_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draftBody(details))}`;
}

export function thumbtackLink() {
  return `https://www.thumbtack.com/search?query=${encodeURIComponent(REPAIR_NAME)}`;
}

export function equipmentReferral(text, extra = {}) {
  if (!isEquipmentQuestion(text) && extra.force !== true) return { ok: true, equipment: false, sent: false };
  const details = gatherEquipment(text, extra);
  if (PRIVATE.test(`${details.item} ${details.brandModel} ${details.symptom} ${details.tried}`)) {
    return { ok: false, equipment: true, sent: false, error: 'Leave the phone number and links out of the details. The draft adds the support address.' };
  }
  return {
    ok: true,
    equipment: true,
    sent: false,
    referral: true,
    guarantee: false,
    name: REPAIR_NAME,
    email: REPAIR_EMAIL,
    details,
    photosOnDevice: Math.max(0, Number(extra.photos) || 0),
    draft: draftBody(details),
    mailto: mailtoLink(details),
    thumbtack: thumbtackLink(),
    note: REFERRAL_NOTE,
    disclaimer: '/disclaimer',
    text: CARD_TEXT
  };
}

export function holdFromChat(text) {
  const card = equipmentReferral(text);
  if (!card.ok) return { send: false, card };
  return { send: card.equipment !== true, card: card.equipment ? card : null };
}
