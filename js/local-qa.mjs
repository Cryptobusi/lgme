const FALLBACK = "I can't reach AI right now, here's the built-in guide. Turn AI on with the switch in this panel, then ask again. The steps below still work with AI off. Nothing is sent until you tap OK.";
export const UNAVAILABLE_LINE = "On-device AI isn't available on this phone. This browser has no built-in model. On a computer, Chrome settings can turn the model on. The guide on this phone still answers.";

export function aiChipLabel(enabled, ready) {
  if (!enabled) return 'AI off';
  return ready ? 'AI on' : 'AI on - unavailable';
}

export function describeModel(scope = {}, storage) {
  let enabled = true;
  try { enabled = storage?.getItem('lgme.ai.enabled') !== '0'; } catch { enabled = true; }
  if (!enabled) return { enabled: false, ready: false, chip: 'AI off', line: '' };
  const api = scope.LanguageModel || scope.ai?.languageModel;
  const has = Boolean(api) && (typeof api.prompt === 'function' || typeof api.create === 'function' || typeof api.availability === 'function');
  if (!has) return { enabled: true, ready: false, chip: aiChipLabel(true, false), line: UNAVAILABLE_LINE };
  return { enabled: true, ready: true, chip: 'AI on', line: '' };
}

const ACTIONS = {
  health: { label: 'Open Health', href: '/gym' },
  ididit: { label: 'Log an IdidIt', href: '/gym#/ididit' },
  help: { label: 'Read Help', href: '/help' },
  exchange: { label: 'Open Exchange', href: '/exchange' },
  shortcuts: { label: 'My shortcuts', href: '/#my-shortcuts' },
  settings: { label: 'Open Settings', href: '/gym#/more' },
  version: { label: 'My Version', href: '/customize' }
};

function pack(text, keys) {
  return { text, actions: keys.map((key) => ACTIONS[key]).filter(Boolean).slice(0, 3) };
}

const INTENTS = [
  {
    test: /what is this app|what'?s this app|app(?:'s| is) for|purpose of|what is lgme|what does lgme do/,
    answer: pack('lgme.app is a work-value credit and barter exchange. Deeds logged as IdidIt, a verified receipt, earn Creo. Members trade wants and haves. Attestation tiers verify value. Only Health is live, and it stays on testnet. Other categories are In development.', ['health', 'ididit', 'help'])
  },
  {
    test: /how (?:do i|to) use|get started|how does (?:this|it) work|where do i start/,
    answer: pack('Start on Health, which is the live category. Log what you did as an IdidIt receipt, then tap OK. Creo is the value that receipt records. You can also post a want or a have. Nothing is sent until you tap OK.', ['health', 'ididit', 'help'])
  },
  {
    test: /what is creo|creo\b/,
    answer: pack('Creo is value you create. It is not cash and it is not $lgme. A confirmed IdidIt can earn a small Creo amount on this phone. Debit means you owe. Credit means you lend. Only you see your own Creo.', ['ididit', 'help'])
  },
  {
    test: /\$lgme|lgme coin|what is the coin/,
    answer: pack('$lgme is a separate coin, not Creo. A deed does not mint it. Paying in $lgme needs your own wallet and stays off until you confirm. Testnet only. Nothing is paid until you tap OK.', ['exchange', 'help'])
  },
  {
    test: /ididit|i did it|verified receipt/,
    answer: pack('IdidIt is a verified receipt of what you did. You write the deed, then tap OK to keep it on this phone. Another member can attest it. The receipt can earn Creo. Health receipts stay on testnet.', ['ididit', 'health'])
  },
  {
    test: /iwantit|i want it|a want\b/,
    answer: pack('IwantIT is something you are looking for. You describe it and tap OK. The note stays on this phone until you confirm. It is a want, not a payment. Health is the live category.', ['health', 'exchange'])
  },
  {
    test: /ihavit|i have it|a have\b/,
    answer: pack('IhavIT is something you can offer. You name it and tap OK. The note stays on this phone until you confirm. It is not a sale until both people agree. Health is the live category.', ['health', 'exchange'])
  },
  {
    test: /attest/,
    answer: pack('An attestation is another member confirming a receipt. Over $100 needs three independent device signatures. Over $1,000 in a day also needs administrator approval. A refusal stays on record and carries no penalty. Nothing is approved until those taps happen.', ['exchange', 'help'])
  },
  {
    test: /\bhealth\b/,
    answer: pack('Health is the only live category. Workouts and IdidIt receipts stay on this phone until you tap OK. They can be anchored on testnet, not mainnet. Other categories are In development. This is not a medical record.', ['health', 'ididit'])
  },
  {
    test: /incognito/,
    answer: pack('Incognito keeps everything on this phone until you approve. The switch is in More. Turning it on does not send pending notes. You review them and tap Approve when you mean to share. Sign-in can still use the network.', ['settings', 'help'])
  },
  {
    test: /guided|manual mode|guide mode/,
    answer: pack('AI is the default. The helper suggests a next step and you still tap OK. Classic hides the next step and keeps explainers on Hint. The AI and Classic buttons are on the left of the helper bar, and the same choice is in Settings. The choice stays on this phone.', ['settings'])
  },
  {
    test: /shortcut/,
    answer: pack('My shortcuts are the actions you use most. After five uses the phone can offer to pin them on Home. The count stays on this phone. Incognito does not add to it. You can reset the row any time.', ['shortcuts', 'health'])
  },
  {
    test: /my version|version of the app|personal setup/,
    answer: pack('My Version is a personal setup of settings, not code. You name it and tap OK to offer it. Three members attest, then an administrator can commit it. It stays a proposal until then. Nothing changes for everyone by itself.', ['version', 'help'])
  }
];

export function localAnswer(question, context = {}) {
  const q = String(question || '').trim().toLowerCase();
  const hit = q ? INTENTS.find((item) => item.test.test(q)) : null;
  if (hit) return { ...hit.answer, source: 'local', matched: true };
  const sections = Array.isArray(context.sections) ? context.sections : [];
  const asked = askedName(q);
  const found = matchSection(asked, sections);
  if (found) {
    return {
      text: `${found.title}. ${found.text || 'It is on this page.'} Nothing is saved until you tap OK.`,
      actions: [ACTIONS.help],
      source: 'local',
      matched: true
    };
  }
  if (asksSection(q)) {
    const names = sections.map((item) => item.title).filter(Boolean).slice(0, 8);
    const called = asked || 'that';
    const list = names.length ? names.join(', ') : 'none yet';
    return {
      text: `There is no section called ${called}; here are the sections on this page: ${list}.`,
      actions: [ACTIONS.health, ACTIONS.help],
      source: 'local',
      matched: true
    };
  }
  return { text: FALLBACK, actions: [ACTIONS.health, ACTIONS.help], source: 'local', matched: false };
}

function askedName(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/what(?:'s| is)?(?: the)?/g, ' ')
    .replace(/\b(section|part|card|heading|page|about|called|named|where|does|mean)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asksSection(question) {
  return /\b(section|heading|card)\b/i.test(question);
}

function matchSection(name, sections) {
  const keys = String(name || '').split(' ').filter((word) => word.length > 2);
  if (!keys.length) return null;
  let best = null;
  let score = 0;
  for (const section of sections) {
    const title = String(section.title || '').toLowerCase();
    const hit = keys.filter((word) => title.includes(word)).length;
    if (hit > score) {
      score = hit;
      best = section;
    }
  }
  return score ? best : null;
}

export function answerOrFallback({ question, modelText = '', aiOn = false, modelReady = true, sections } = {}) {
  const local = localAnswer(question, { sections });
  const model = String(modelText || '').replace(/\s+/g, ' ').trim();
  if (aiOn && modelReady && model && model !== local.text) return { text: model, actions: local.actions, source: 'model' };
  if (aiOn && !modelReady) {
    const body = local.matched && !local.text.includes('Turn AI on') ? ` ${local.text}` : '';
    return { text: `${UNAVAILABLE_LINE}${body}`, actions: local.actions, source: 'local', matched: true };
  }
  if (aiOn && local.text.includes('Turn AI on')) return { text: UNAVAILABLE_LINE, actions: local.actions, source: 'local', matched: true };
  return local;
}
