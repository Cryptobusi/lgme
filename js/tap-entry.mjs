/**
 * One-Tap Entry demo. Sample data only.
 * Suggestions are local rules. This module does not fetch, and it does not store coordinates.
 */

export const STORAGE_KEY = 'lgme.tap-entry.demo.v1';

export const SAMPLE_SENTENCE = "two hours framing Elena's greenhouse";
export const SAMPLE_RECEIPT = '2 hours framing, Elena, greenhouse';
export const SAMPLE_HABIT = 'Saturday timber work, 2 hours';

export const CATEGORIES = [
  { id: 'did', label: 'Did' },
  { id: 'sell', label: 'Sell' },
  { id: 'wish', label: 'Wish' },
  { id: 'duty', label: 'Duty' },
  { id: 'responsible', label: 'Responsible' }
];

const CATEGORY_IDS = new Set(CATEGORIES.map((item) => item.id));

const HOUR_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1
};

const CATEGORY_RULES = [
  { id: 'responsible', pattern: /\b(responsible|steward|stewarding|look after|looking after|in charge of)\b/i, why: 'The words match a responsibility.' },
  { id: 'duty', pattern: /\b(duty|duties|owe|owed|owing|pledge|pledged)\b/i, why: 'The words match a duty.' },
  { id: 'wish', pattern: /\b(wish|wished|wishing|hope|hoping|dream|dreaming)\b/i, why: 'The words match a wish.' },
  { id: 'sell', pattern: /\b(sell|selling|offer|offering|surplus|for sale)\b/i, why: 'The words match a sale or an offer.' },
  { id: 'did', pattern: /\b(did|done|framed|framing|built|build|building|fixed|fixing|worked|work|working|timber)\b/i, why: 'The words match work that was done.' }
];

const PLACE_WORDS = ['greenhouse', 'workshop', 'commons', 'shed', 'trail', 'kitchen', 'field'];

export const ACTIONS = {
  nfc: { type: 'tap', label: 'NFC tap' },
  'nfc-go': { type: 'tap', label: 'Simulate a tap' },
  'nfc-live': { type: 'tap', label: 'Read a tag' },
  qr: { type: 'tap', label: 'QR handshake' },
  'qr-go': { type: 'tap', label: 'Use the sample scan' },
  'qr-live': { type: 'tap', label: 'Scan with the camera' },
  share: { type: 'tap', label: 'Share to lgme' },
  'share-go': { type: 'tap', label: 'Use the sample share' },
  'share-type': { type: 'field', label: 'Paste shared text' },
  camera: { type: 'tap', label: 'Camera or receipt' },
  'camera-go': { type: 'tap', label: 'Use the sample receipt' },
  'camera-try': { type: 'tap', label: 'Take a photo' },
  'camera-shutter': { type: 'tap', label: 'Use this frame' },
  voice: { type: 'tap', label: 'Voice note' },
  'voice-go': { type: 'tap', label: 'Listen or use the sample sentence' },
  'voice-type': { type: 'field', label: 'Type the voice sample' },
  smart: { type: 'tap', label: 'Smart suggestions' },
  'smart-go': { type: 'tap', label: 'Use the Saturday habit' },
  'smart-partner': { type: 'tap', label: 'Choose Elena' },
  'smart-location': { type: 'tap', label: 'Check location' },
  passkey: { type: 'tap', label: 'Passkey confirm' },
  'passkey-go': { type: 'tap', label: 'Load the sample draft' },
  'passkey-confirm': { type: 'tap', label: 'Confirm with a passkey' },
  manual: { type: 'tap', label: 'Manual' },
  'manual-go': { type: 'tap', label: 'Use the sample line' },
  'manual-type': { type: 'field', label: 'Type the entry' },
  'consent-allow': { type: 'tap', label: 'Allow on-device suggestions' },
  'use-suggestion': { type: 'tap', label: 'Use this suggestion' },
  'confirm-self': { type: 'tap', label: 'I confirm' },
  'confirm-partner': { type: 'tap', label: 'Sample partner confirms' },
  undo: { type: 'tap', label: 'Undo' },
  'nfc-sim': { type: 'tap', label: 'Simulate a tap' },
  'qr-sim': { type: 'tap', label: 'Use the sample scan' },
  'share-send': { type: 'tap', label: 'Share this draft' },
  'share-use': { type: 'tap', label: 'Use the pasted text' },
  'manual-use': { type: 'tap', label: 'Use the typed line' },
  'show-type': { type: 'tap', label: 'Type a line instead' },
  'voice-use': { type: 'tap', label: 'Use the spoken line' },
  'consent-deny': { type: 'tap', label: 'Not now' },
  'plain-partner': { type: 'tap', label: 'Choose Elena' },
  'plain-continue': { type: 'tap', label: 'Use these fields' },
  'passkey-sim': { type: 'tap', label: 'Use the labelled simulation' },
  edit: { type: 'tap', label: 'Change one field' },
  'set-category': { type: 'tap', label: 'Choose a category' },
  'hash-go': { type: 'tap', label: 'Use the link in this address' },
  'pick-field': { type: 'tap', label: 'Change one field' },
  'save-partner': { type: 'tap', label: 'Keep this partner' },
  'partner-type': { type: 'field', label: 'Type a partner' }
};

export const METHOD_SCRIPTS = {
  nfc: ['nfc', 'nfc-go', 'use-suggestion', 'confirm-self', 'confirm-partner'],
  qr: ['qr', 'qr-go', 'use-suggestion', 'confirm-self', 'confirm-partner'],
  share: ['share', 'share-go', 'use-suggestion', 'confirm-self', 'confirm-partner'],
  camera: ['camera', 'camera-go', 'use-suggestion', 'confirm-self', 'confirm-partner'],
  voice: ['voice', 'voice-go', 'use-suggestion', 'confirm-self', 'confirm-partner'],
  smart: ['smart', 'smart-go', 'smart-partner', 'use-suggestion', 'confirm-self', 'confirm-partner'],
  passkey: ['passkey', 'passkey-go', 'use-suggestion', 'passkey-confirm', 'confirm-partner'],
  manual: ['manual', 'manual-go', 'use-suggestion', 'confirm-self', 'confirm-partner']
};

export const METHODS = [
  { id: 'nfc', label: 'NFC tap', question: 'Read a tag, or use a simulated tap.' },
  { id: 'qr', label: 'QR handshake', question: 'Show a QR for the draft, then scan or use the sample.' },
  { id: 'share', label: 'Share to lgme', question: 'Paste shared text, or use the sample share.' },
  { id: 'camera', label: 'Camera or receipt', question: 'Take a photo, or use the sample receipt.' },
  { id: 'voice', label: 'Voice note', question: 'Listen on this device, or use the sample sentence.' },
  { id: 'smart', label: 'Smart suggestions', question: 'Use the simulated Saturday habit.' },
  { id: 'passkey', label: 'Passkey confirm', question: 'Load a sample draft, then confirm on this device.' },
  { id: 'manual', label: 'Manual', question: 'Use one sample line, or type one line.' }
];

const REVIEW_COPY = {
  nfc: {
    worksOn: 'Chrome on Android can read a tag. iPhone can open a link from a tag and cannot fill this page from the tag. Desktop has no Web NFC.',
    upsides: 'A tag can carry the whole sample entry. The shortest path types nothing.',
    downsides: 'Few phones expose NDEFReader. A tag can be rewritten. The simulated button is not a tag. Where NDEFReader exists, Read a tag and Simulate a tap are both on the capture step. The counted path is Simulate a tap.',
    recommended: 'Use when this phone is Chrome on Android and the tag is already programmed. Not the default elsewhere.'
  },
  qr: {
    worksOn: 'The code draws on Android, iPhone, and desktop. A scan needs a camera. jsQR reads the frame on the device.',
    upsides: 'Two devices can pass a draft with no account. The draft sits in the link fragment, which the browser does not send to the server.',
    downsides: 'Scanning the same phone’s screen is a poor fit. A code is not a signature. The sample scan is not a camera read.',
    recommended: 'Use when two devices are in the same place. Not the default for one person on one phone.'
  },
  share: {
    worksOn: 'Paste works on Android, iPhone, and desktop. Web Share send works where the browser offers it. A system share target was not added.',
    upsides: 'Text the person already has can become the draft. Sending uses the browser share sheet.',
    downsides: 'Incoming share is a paste. A GET share target would put the text in the address a server receives, so it was left out. The page does not check who wrote the text.',
    recommended: 'Use when the words are already copied. Not the default for a new entry.'
  },
  camera: {
    worksOn: 'A camera works where getUserMedia is allowed. TextDetector is uncommon. The sample line works on Android, iPhone, and desktop.',
    upsides: 'A photo stays in memory for the attempt. It is not uploaded and not stored.',
    downsides: 'Without TextDetector the photo is not read. A detector can misread a receipt. The sample line is not that photo.',
    recommended: 'Use when TextDetector is present and a paper receipt is in hand. Otherwise use Manual.'
  },
  voice: {
    worksOn: 'On-device speech runs only where a local language pack is already installed. Other browsers get the sample sentence, including phones whose speech API would send audio to a vendor.',
    upsides: 'Hands can stay busy when local speech is actually ready. The sample sentence shows the same parse.',
    downsides: 'Vendor speech is refused, so many phones see the sample. A wrong transcript can pre-fill the wrong hours or partner. This demo does not download a language pack.',
    recommended: 'Use when on-device speech is already installed. Otherwise use Manual.'
  },
  smart: {
    worksOn: 'The calendar hint is simulated on Android, iPhone, and desktop. Location works only after its button, where the browser allows it.',
    upsides: 'A repeated sample habit is one tap, plus a partner the hint does not name. Coordinates are discarded.',
    downsides: 'The calendar is not read, so the hint can be the wrong day. A habit can pre-fill a deed that did not happen. A place name would need a network lookup, so none is made.',
    recommended: 'Not a default. Use only after consent, and correct it before confirm.'
  },
  passkey: {
    worksOn: 'A platform authenticator exists on many Android phones, iPhones, and desktops. Elsewhere the labelled simulation is used. No server is involved.',
    upsides: 'One confirm can use this device’s authenticator. The ceremony does not need an lgme server.',
    downsides: 'A passkey created only in the page does not prove identity to the other person. The sample partner tap is still on this device. The simulation is not a passkey.',
    recommended: 'Not the capture default. Use it for the first confirm when a platform authenticator is available.'
  },
  manual: {
    worksOn: 'Android, iPhone, and desktop. No sensor.',
    upsides: 'One line is enough. No permission sheet. After consent, the same rules can pre-fill the fields.',
    downsides: 'The person has to supply the words. The sample line can be accepted without reading it.',
    recommended: 'Recommended default on iPhone and desktop, and wherever the other methods are missing or simulated.'
  }
};

export function categoryLabel(id) {
  const found = CATEGORIES.find((item) => item.id === id);
  return found ? found.label : '';
}

export function sampleLink() {
  return `https://lgme.app/tap-entry#draft=did|2|Elena|greenhouse|${encodeURIComponent(SAMPLE_SENTENCE)}`;
}

export function parseEntryLink(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const hashAt = raw.indexOf('#');
  const hash = hashAt >= 0 ? raw.slice(hashAt + 1) : raw;
  const marker = 'draft=';
  const at = hash.indexOf(marker);
  if (at < 0) return null;
  let payload = hash.slice(at + marker.length);
  try { payload = decodeURIComponent(payload); } catch { return null; }
  const parts = payload.split('|');
  if (parts.length < 5 || !CATEGORY_IDS.has(parts[0])) return null;
  const hours = parts[1] === '' ? null : Number(parts[1]);
  if (parts[1] !== '' && !Number.isFinite(hours)) return null;
  let note = parts.slice(4).join('|');
  try { note = decodeURIComponent(note); } catch { /* keep */ }
  return {
    category: parts[0],
    hours,
    partner: parts[2] || null,
    place: parts[3] || null,
    note,
    fromLink: true
  };
}

export function parseEntryText(input) {
  const text = String(input || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { category: null, hours: null, partner: null, place: null, note: '', reasons: ['There is no text to read.'] };
  }
  const reasons = [];
  let hours = null;
  const digit = text.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)\b/i);
  const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+(?:hours|hour|hrs|hr)\b/i);
  if (digit) {
    hours = Number(digit[1]);
    reasons.push(`Hours: saw “${digit[0].trim()}”.`);
  } else if (word) {
    hours = HOUR_WORDS[word[1].toLowerCase()];
    reasons.push(`Hours: saw “${word[0]}”.`);
  }

  let partner = null;
  const possessive = text.match(/\b([A-Z][a-z]+)(?:'s|’s)\b/);
  const withName = text.match(/\b(?:with|for|to)\s+([A-Z][a-z]+)\b/);
  if (possessive) {
    partner = possessive[1];
    reasons.push(`Partner: saw ${partner} before ’s.`);
  } else if (withName) {
    partner = withName[1];
    reasons.push(`Partner: saw ${partner} after with, for, or to.`);
  } else {
    for (const part of text.split(',')) {
      const token = part.trim();
      if (/^[A-Z][a-z]+$/.test(token)) {
        partner = token;
        reasons.push(`Partner: saw the name ${partner} on its own.`);
        break;
      }
    }
  }

  let place = null;
  const atPlace = text.match(/\bat\s+(?:the\s+)?([A-Za-z][\w'’-]*)/i);
  const ownedPlace = text.match(/\b[A-Z][a-z]+(?:'s|’s)\s+([A-Za-z][\w-]*)/);
  if (atPlace) {
    place = atPlace[1].toLowerCase();
    reasons.push(`Place: saw “${place}” after “at”.`);
  } else if (ownedPlace) {
    place = ownedPlace[1].toLowerCase();
    reasons.push(`Place: saw “${place}” after a name’s.`);
  } else {
    const chunks = text.split(',').map((part) => part.trim().toLowerCase());
    const known = chunks.find((part) => PLACE_WORDS.includes(part))
      || PLACE_WORDS.find((word) => new RegExp(`\\b${word}\\b`, 'i').test(text));
    if (known) {
      place = known;
      reasons.push(`Place: saw “${place}”.`);
    }
  }

  let category = null;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      category = rule.id;
      reasons.push(`Category ${categoryLabel(rule.id)}: ${rule.why}`);
      break;
    }
  }
  if (!category) reasons.push('No category word was found.');
  if (hours == null) reasons.push('No hour count was found.');
  if (!partner) reasons.push('No partner name was found.');
  if (!place) reasons.push('No place was found.');
  return { category, hours, partner, place, note: text, reasons };
}

export function captureFromText(value, method) {
  const link = parseEntryLink(value);
  if (link) return { ...link, text: link.note, method: method || null };
  const parsed = parseEntryText(value);
  return { ...parsed, text: parsed.note, method: method || null, fromLink: false };
}

export function sampleCapture(method) {
  if (method === 'camera') return captureFromText(SAMPLE_RECEIPT, method);
  if (method === 'smart') return captureFromText(SAMPLE_HABIT, method);
  if (method === 'nfc' || method === 'qr' || method === 'passkey') return captureFromText(sampleLink(), method);
  return captureFromText(SAMPLE_SENTENCE, method || 'manual');
}

export function buildSuggestion(capture) {
  const source = capture || {};
  const parsed = parseEntryText(source.note || source.text || '');
  const suggestion = {
    category: source.category || parsed.category || null,
    hours: source.hours === 0 || Number.isFinite(source.hours) ? source.hours : parsed.hours,
    partner: source.partner || parsed.partner || null,
    place: source.place || parsed.place || null,
    note: source.note || source.text || '',
    reasons: []
  };
  if (source.fromLink) suggestion.reasons.push('The entry link carried the fields that are filled in.');
  for (const reason of parsed.reasons) {
    if (suggestion.partner && reason.startsWith('No partner')) continue;
    if (suggestion.place && reason.startsWith('No place')) continue;
    if (suggestion.category && reason.startsWith('No category')) continue;
    if (suggestion.hours != null && reason.startsWith('No hour')) continue;
    suggestion.reasons.push(reason);
  }
  if (!suggestion.category) suggestion.reasons.push('Choose a category before you confirm.');
  if (!suggestion.partner) suggestion.reasons.push('Dual confirm needs the other person.');
  return suggestion;
}

export function canUseSuggestion(suggestion) {
  return !!(suggestion && suggestion.category && suggestion.partner && String(suggestion.note || '').trim());
}

export function withPartner(suggestion, partner) {
  const reasons = (suggestion.reasons || []).filter((reason) => !reason.startsWith('No partner') && !reason.startsWith('Dual confirm needs'));
  reasons.push(`Partner ${partner} was chosen on this page.`);
  return { ...suggestion, partner, reasons };
}

export function learnedFromSuggestion(suggestion) {
  const items = [];
  if (suggestion.category) {
    items.push({
      id: `category:${suggestion.category}`,
      label: `Category ${categoryLabel(suggestion.category)}`,
      why: (suggestion.reasons || []).find((reason) => reason.startsWith('Category')) || 'You kept this category.'
    });
  }
  if (suggestion.hours != null && suggestion.hours !== '') {
    items.push({
      id: `hours:${suggestion.hours}`,
      label: `${suggestion.hours} hours`,
      why: (suggestion.reasons || []).find((reason) => reason.startsWith('Hours')) || 'You kept this hour count.'
    });
  }
  if (suggestion.partner) {
    items.push({
      id: `partner:${suggestion.partner}`,
      label: `Partner ${suggestion.partner}`,
      why: (suggestion.reasons || []).find((reason) => reason.startsWith('Partner')) || 'You kept this partner.'
    });
  }
  if (suggestion.place) {
    items.push({
      id: `place:${suggestion.place}`,
      label: `Place ${suggestion.place}`,
      why: (suggestion.reasons || []).find((reason) => reason.startsWith('Place')) || 'You kept this place.'
    });
  }
  return items;
}

export function emptyState() {
  return { version: 1, consent: null, learned: [], tape: [], undo: null };
}

function cloneData(state, depth = 0) {
  const copy = {
    version: 1,
    consent: state.consent,
    learned: (state.learned || []).map((item) => ({ id: item.id, label: item.label, why: item.why })),
    tape: (state.tape || []).map((item) => ({ ...item })),
    undo: null
  };
  if (depth < 1 && state.undo) copy.undo = cloneData(state.undo, depth + 1);
  return copy;
}

export function remember(state, next) {
  return { ...next, undo: cloneData(state) };
}

export function undoLast(state) {
  if (!state || !state.undo) return state || emptyState();
  return { ...state.undo };
}

export function setConsent(state, value) {
  if (value !== 'allow' && value !== 'deny') return state;
  if (state.consent === value) return state;
  return remember(state, { ...state, consent: value });
}

export function suggestionFor(state, capture) {
  if (!state || state.consent !== 'allow') return { blocked: true, suggestion: null };
  return { blocked: false, suggestion: buildSuggestion(capture) };
}

export function acceptSuggestion(state, suggestion) {
  if (!state || state.consent !== 'allow' || !canUseSuggestion(suggestion)) return state;
  const incoming = learnedFromSuggestion(suggestion);
  const learned = state.learned.slice();
  for (const item of incoming) {
    const index = learned.findIndex((have) => have.id === item.id);
    if (index >= 0) learned[index] = item;
    else learned.push(item);
  }
  return remember(state, { ...state, learned });
}

export function commitTape(state, entry) {
  const line = {
    id: entry.id || `tape-${state.tape.length + 1}`,
    category: entry.category,
    hours: entry.hours,
    partner: entry.partner,
    place: entry.place,
    note: entry.note,
    method: entry.method,
    sample: true
  };
  return remember(state, { ...state, tape: state.tape.concat(line) });
}

export function forgetLearned(state, id) {
  if (!state.learned.some((item) => item.id === id)) return state;
  return remember(state, { ...state, learned: state.learned.filter((item) => item.id !== id) });
}

export function phaseAfterCapture(state) {
  if (!state || state.consent == null) return 'consent';
  return state.consent === 'allow' ? 'correct' : 'plain';
}

export function saveState(storage, state) {
  const payload = {
    version: 1,
    consent: state.consent === 'allow' || state.consent === 'deny' ? state.consent : null,
    learned: (state.learned || []).map((item) => ({ id: String(item.id), label: String(item.label), why: String(item.why || '') })),
    tape: (state.tape || []).map((item) => ({
      id: String(item.id),
      category: item.category,
      hours: item.hours,
      partner: item.partner,
      place: item.place || null,
      note: item.note,
      method: item.method,
      sample: true
    }))
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return emptyState();
    return {
      version: 1,
      consent: data.consent === 'allow' || data.consent === 'deny' ? data.consent : null,
      learned: Array.isArray(data.learned) ? data.learned.filter((item) => item && item.id && item.label).map((item) => ({
        id: String(item.id), label: String(item.label), why: String(item.why || '')
      })) : [],
      tape: Array.isArray(data.tape) ? data.tape.filter((item) => item && item.id).map((item) => ({
        id: String(item.id),
        category: item.category || null,
        hours: item.hours ?? null,
        partner: item.partner || null,
        place: item.place || null,
        note: item.note || '',
        method: item.method || '',
        sample: true
      })) : [],
      undo: null
    };
  } catch {
    return emptyState();
  }
}

export function resetState(storage) {
  storage.removeItem(STORAGE_KEY);
  return emptyState();
}

export function createCounter() {
  return { taps: 0, fields: 0, events: [] };
}

export function recordTap(counter, label) {
  const base = counter || createCounter();
  return { taps: base.taps + 1, fields: base.fields, events: base.events.concat({ type: 'tap', label }) };
}

export function recordField(counter, label) {
  const base = counter || createCounter();
  return { taps: base.taps, fields: base.fields + 1, events: base.events.concat({ type: 'field', label }) };
}

export function reduceCounter(counter, actionId) {
  const action = ACTIONS[actionId];
  if (!action) throw new Error(`Unknown action ${actionId}`);
  return action.type === 'field' ? recordField(counter, action.label) : recordTap(counter, action.label);
}

export function scriptFor(method, options = {}) {
  const ids = (METHOD_SCRIPTS[method] || []).slice();
  if (options.consent) ids.splice(2, 0, 'consent-allow');
  return ids;
}

export function measureMethod(method, options = {}) {
  return scriptFor(method, options).reduce((counter, actionId) => reduceCounter(counter, actionId), createCounter());
}

export function counterText(counter) {
  const taps = `${counter.taps} ${counter.taps === 1 ? 'tap' : 'taps'}`;
  const fields = `${counter.fields} ${counter.fields === 1 ? 'field' : 'fields'} typed`;
  return `This method: ${taps}, ${fields}.`;
}

export function stepsText(measured) {
  const taps = `${measured.taps} ${measured.taps === 1 ? 'tap' : 'taps'}`;
  const fields = `${measured.fields} ${measured.fields === 1 ? 'field' : 'fields'} typed`;
  return `${taps}, ${fields}`;
}

export function detectFeatures(scope) {
  const win = scope || {};
  const nav = win.navigator || {};
  const speechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
  return {
    nfc: typeof win.NDEFReader === 'function',
    camera: !!(nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function'),
    speech: typeof speechCtor === 'function',
    share: typeof nav.share === 'function',
    passkey: typeof win.PublicKeyCredential === 'function',
    textDetector: typeof win.TextDetector === 'function',
    geolocation: !!nav.geolocation,
    qr: typeof win.QRCode === 'function' || !!win.qrCodePresent,
    jsQR: typeof win.jsQR === 'function'
  };
}

export function voiceMode(features) {
  const ready = features || {};
  if (!ready.speech) {
    return { live: false, reason: `Simulated voice note. This browser has no Web Speech API. The sample sentence is “${SAMPLE_SENTENCE}”.` };
  }
  if (ready.localSpeech === true) {
    return { live: true, reason: 'On-device speech is ready. The audio stays on this device. A language pack is not downloaded.' };
  }
  if (ready.localSpeech === false) {
    return { live: false, reason: 'Simulated voice note. On-device speech is not ready. The usual Web Speech API sends audio to a vendor, and downloading a language pack would use the network. This demo uses the sample sentence.' };
  }
  return { live: false, reason: 'The Web Speech API is present. Listen starts only when on-device recognition is already installed. Otherwise the sample sentence is used.' };
}

export function modeFor(method, features) {
  const ready = features || {};
  if (method === 'nfc') {
    return ready.nfc
      ? { live: true, reason: 'This browser has NDEFReader. A tag that carries an lgme entry link can be read here. The page does not open the link.' }
      : { live: false, reason: 'Simulated tap. This browser has no Web NFC NDEFReader. Chrome on Android can read a tag. An iPhone can open a link from a tag, and it cannot read the tag into this page.' };
  }
  if (method === 'qr') {
    return ready.camera && ready.jsQR !== false
      ? { live: true, reason: 'This browser can open a camera. The code is read on this device. Nothing is uploaded.' }
      : { live: false, reason: 'Simulated scan. This browser did not offer a camera reader, so the sample handshake is used. The QR for the draft is still drawn on the page.' };
  }
  if (method === 'share') {
    const why = 'A share target was not added to the manifest. A GET target would put shared text in the address a server receives, and a POST target would need the site-wide service worker.';
    return ready.share
      ? { live: false, outgoing: true, reason: `Web Share can send this draft from the device. ${why} Paste shared text here.` }
      : { live: false, outgoing: false, reason: `Simulated incoming share. This browser has no Web Share API. ${why} Paste the sample text here.` };
  }
  if (method === 'camera') {
    return ready.textDetector
      ? { live: true, reason: 'This browser has TextDetector. A photo is read on this device and is not uploaded.' }
      : { live: false, reason: 'Simulated receipt. This browser has no TextDetector, so a photo is not read as text. The sample receipt line is parsed on this device. Nothing is uploaded.' };
  }
  if (method === 'voice') return voiceMode(ready);
  if (method === 'smart') {
    return { live: false, reason: 'The calendar hint is simulated. This page does not read a calendar. Location is read only after the location button, and the coordinates are not stored.' };
  }
  if (method === 'passkey') {
    return ready.passkey
      ? { live: true, reason: 'This browser has WebAuthn. The demo can create a passkey on this device. It is not sent to a server.' }
      : { live: false, reason: 'Simulated passkey. This browser has no WebAuthn, so the confirm is labelled as a simulation. No server is contacted.' };
  }
  return { live: true, reason: 'Manual entry uses one line on this page. It does not need a sensor.' };
}

export function capabilityRows(features) {
  const ready = features || {};
  return [
    { id: 'nfc', label: 'NFC', state: ready.nfc ? 'NDEFReader is present' : 'No NDEFReader', detail: modeFor('nfc', ready).reason },
    { id: 'camera', label: 'Camera', state: ready.camera ? 'A camera API is present' : 'No camera API', detail: modeFor('qr', ready).reason },
    { id: 'text', label: 'Text recognition', state: ready.textDetector ? 'TextDetector is present' : 'No TextDetector', detail: modeFor('camera', ready).reason },
    { id: 'speech', label: 'Speech', state: ready.speech ? 'The Web Speech API is present' : 'No Web Speech API', detail: modeFor('voice', ready).reason },
    { id: 'share', label: 'Share', state: ready.share ? 'Web Share is present' : 'No Web Share API', detail: modeFor('share', ready).reason },
    { id: 'passkey', label: 'Passkey', state: ready.passkey ? 'WebAuthn is present' : 'No WebAuthn', detail: modeFor('passkey', ready).reason }
  ];
}

export async function prepareLocalSpeech(SpeechRecognition) {
  if (typeof SpeechRecognition !== 'function') return voiceMode({ speech: false });
  if (typeof SpeechRecognition.available !== 'function') {
    return { live: false, reason: 'Simulated voice note. This browser has the Web Speech API and no on-device check. The usual path sends audio to a vendor. This demo uses the sample sentence.' };
  }
  let status = 'unavailable';
  try {
    status = await SpeechRecognition.available({ langs: ['en-US'], processLocally: true });
  } catch {
    status = 'unavailable';
  }
  return voiceMode({ speech: true, localSpeech: status === 'available' });
}

export function startLocalRecognition(SpeechRecognition, handlers) {
  const recognition = new SpeechRecognition();
  if (!('processLocally' in recognition)) throw new Error('not-local');
  recognition.lang = 'en-US';
  recognition.processLocally = true;
  if (recognition.processLocally !== true) throw new Error('not-local');
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const text = event?.results?.[0]?.[0]?.transcript || '';
    if (handlers && handlers.onresult) handlers.onresult(text);
  };
  recognition.onerror = (event) => {
    if (handlers && handlers.onerror) handlers.onerror(event?.error || 'error');
  };
  recognition.start();
  return recognition;
}

export function textFromNdef(records) {
  const parts = [];
  for (const record of records || []) {
    if (typeof record === 'string') {
      parts.push(record);
      continue;
    }
    if (!record || record.data == null) continue;
    if (typeof record.data === 'string') {
      parts.push(record.data);
      continue;
    }
    try {
      parts.push(new TextDecoder(record.encoding || 'utf-8').decode(record.data));
    } catch {
      parts.push('');
    }
  }
  return parts.join(' ').trim();
}

export async function readPhotoText(detector, source) {
  if (!detector || typeof detector.detect !== 'function') {
    return { ok: false, simulated: true, text: SAMPLE_RECEIPT, reason: modeFor('camera', { textDetector: false }).reason };
  }
  const found = await detector.detect(source);
  const text = (found || []).map((item) => item && item.rawValue).filter(Boolean).join(' ').trim();
  if (!text) {
    return { ok: false, simulated: true, text: SAMPLE_RECEIPT, reason: 'TextDetector returned no words. The sample receipt line is used. The photo is not uploaded.' };
  }
  return { ok: true, simulated: false, text, reason: 'TextDetector read this photo on the device. The photo is not uploaded.' };
}

export function locationRead(geo) {
  return new Promise((resolve) => {
    const refused = { ok: false, stored: false, summary: 'Geolocation is not in this browser. Coordinates were not read. The habit hint stays the sample.' };
    if (!geo || typeof geo.getCurrentPosition !== 'function') {
      resolve(refused);
      return;
    }
    geo.getCurrentPosition(
      () => resolve({ ok: true, stored: false, summary: 'A position was read and discarded. Coordinates are not shown and not stored. The habit hint stays the sample.' }),
      () => resolve({ ok: false, stored: false, summary: 'Location was not read. The browser refused or timed out. Coordinates are not stored. The habit hint stays the sample.' }),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 }
    );
  });
}

export function passkeyCreationOptions(hostname, challenge) {
  return {
    publicKey: {
      challenge,
      rp: { name: 'lgme', id: hostname },
      user: {
        id: challenge.slice(0, 16),
        name: 'sample-tap-entry',
        displayName: 'Sample tap entry'
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required'
      },
      attestation: 'none'
    }
  };
}

export async function passkeyReady(PublicKeyCredential) {
  if (typeof PublicKeyCredential !== 'function') return modeFor('passkey', { passkey: false });
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return { live: true, reason: 'WebAuthn is present. The confirm runs on this device and is not sent to a server.' };
  }
  try {
    const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!ok) return { live: false, reason: 'Simulated passkey. WebAuthn is present, and this device has no platform authenticator. No server is contacted.' };
    return { live: true, reason: 'A platform authenticator is available. The passkey stays on this device. No server is contacted.' };
  } catch {
    return { live: false, reason: 'Simulated passkey. The authenticator check did not finish. No server is contacted.' };
  }
}

export async function runPasskey(credentials, options) {
  if (!credentials || typeof credentials.create !== 'function') {
    return { ok: false, simulated: true, reason: 'Simulated passkey. This browser has no WebAuthn. No server is contacted.' };
  }
  try {
    const credential = await credentials.create(options);
    if (!credential) return { ok: false, simulated: true, reason: 'The passkey prompt closed without a credential. You can try again, or use the labelled simulation.' };
    return { ok: true, simulated: false, reason: 'This device completed a passkey prompt. The credential was not sent to a server.' };
  } catch (error) {
    const name = error && error.name ? error.name : 'Error';
    return { ok: false, simulated: true, reason: `The passkey prompt did not finish (${name}). You can try again, or use the labelled simulation.` };
  }
}

export function reviewRows() {
  return METHODS.map((method) => {
    const measured = measureMethod(method.id);
    const first = measureMethod(method.id, { consent: true });
    const copy = REVIEW_COPY[method.id];
    return {
      id: method.id,
      label: method.label,
      taps: measured.taps,
      fields: measured.fields,
      firstTaps: first.taps,
      events: measured.events,
      steps: stepsText(measured),
      worksOn: copy.worksOn,
      upsides: copy.upsides,
      downsides: copy.downsides,
      recommended: copy.recommended
    };
  });
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function reviewTableHtml() {
  const rows = reviewRows().map((row) => {
    const steps = `<p>${escapeHtml(row.steps)}</p><p>First use adds 1 tap: Allow on-device suggestions (${row.firstTaps} taps).</p><ol>${row.events.map((event) => `<li>${escapeHtml(event.label)}</li>`).join('')}</ol>`;
    return `<tr><th scope="row">${escapeHtml(row.label)}</th><td data-label="Steps">${steps}</td><td data-label="Works on">${escapeHtml(row.worksOn)}</td><td data-label="Upsides">${escapeHtml(row.upsides)}</td><td data-label="Downsides">${escapeHtml(row.downsides)}</td><td data-label="Recommended default">${escapeHtml(row.recommended)}</td></tr>`;
  }).join('');
  return `<table class="review"><thead><tr><th>Method</th><th>Steps</th><th>Works on</th><th>Upsides</th><th>Downsides</th><th>Recommended default</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export const REVIEW_INTRO = [
  'These counts are the shortest path that reaches the sample Tape. They come from walking each method’s buttons through the same counter the page uses. Where a sensor and a sample control are both on screen, the count follows the sample control. A browser permission sheet is not one of those buttons, so it is not added. The live counter follows the controls you press. The counts are not timings and they are not success rates.',
  'Privacy: the demo keeps consent, learned lines, and sample Tape lines in localStorage under lgme.tap-entry.demo.v1. Reset clears that key. Forget removes one learned line. Coordinates are not stored. Photos are not stored. Speech starts only for on-device recognition that is already installed. Nothing in the demo calls the network.',
  'Wrong pre-fills: the suggestion is a set of keyword rules. It can miss a category or pick the wrong name. “Why this suggestion?” lists the rule that fired. Undo removes the last accepted suggestion or the last Tape line. The Tape is written only after both confirms.',
  'Device gaps: the capability panel reports whether an API is present. Presence is not a promise that the prompt will succeed. NFC reading is Chrome on Android. An iPhone can open a link from a tag. TextDetector and on-device speech are often absent, and the labelled sample is used.',
  'Accessibility: one question is on screen at a time, targets are at least 48px, the three steps are a progress bar, and the counter is a live region. The device list starts closed so the capture step stays first. The review table stacks under 700px.',
  'Fraud and collusion: both confirms on this page happen on one device. Two taps here do not show that two people agreed. The sample partner tap is labelled as a sample. A passkey, when the browser has one, binds only the first confirm to this device. The Third Seat is the arbiter who can veto. This demo does not contact an arbiter.'
];
