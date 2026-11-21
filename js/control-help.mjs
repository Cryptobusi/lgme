const NAMED = {
  'screen-reopen': 'Choose your screen. It changes how this phone shows the app. Nothing is saved until you tap OK.',
  'credits-total': 'Your Creo on this phone. Creo is value you create, not cash. Looking does not spend it.',
  'messages-open': 'Messages on this phone. You can read them and write one. Nothing is sent until you tap OK.',
  'message-ok': 'Keeps this message on this phone. Nothing is posted until you confirm.',
  'guide-ai': 'AI is the helper. It suggests the next step. You still tap OK. The choice stays on this phone.',
  'guide-classic': 'Classic hides the helper suggestions and leaves the desk. Tap AI to bring the helper back. The choice stays on this phone.',
  'guide-mode-settings': 'AI suggests the next step. Classic hides those suggestions. The choice stays on this phone.',
  'incognito-menu': 'Incognito keeps everything on this phone until you approve. Tap to turn it on or off. Nothing is sent.',
  'incognito-chip': 'Incognito keeps everything on this phone until you approve.',
  'testnet-chip': 'Testnet means practice records, not a live payment. Nothing moves until you tap OK.',
  'notice-smaller': 'Makes the top notice shorter. The choice stays on this phone.',
  'notice-larger': 'Makes the top notice taller. The choice stays on this phone.',
  'notice-x': 'Hides the top notice on this phone.',
  'ai-controls': 'Shows or hides the extra helper controls. Nothing is sent.',
  'ai-switch': 'Turns the on-device helper on or off. Nothing is sent.',
  'ai-expand': 'Opens or closes the helper. A draft you are typing stays.',
  'ai-voice': 'Turns voice on or off. Audio stays on this phone.',
  'ai-voice-reply': 'Speak reply chooses whether answers are spoken and shown. Nothing is sent.',
  'ai-listen': 'After the helper speaks, it can listen again. Audio stays on this phone.',
  'ai-mic-btn': 'Listens on this phone. Audio is not sent away. Tap again to stop.',
  'ai-send': 'Holds what you typed on this phone. Nothing is sent until you tap OK.',
  'ai-accept': 'Uses the hint you choose. Nothing is saved until you tap OK.',
  'ai-confirm': 'OK keeps this on the phone. Nothing is posted or paid until you confirm on the page.',
  'one-more': 'Opens More. Tap an item to use it. The menu closes after you choose.',
  'site-back': 'Goes back to the previous page.',
  'site-home': 'Goes home.',
  'site-next': 'Goes to the next page.',
  'tape-sound': 'Turns the tape sound on or off. The choice stays on this phone.',
  'easy-read': 'Easy read makes type larger and the contrast stronger. Tap again to turn it off.',
  'easy-read-menu': 'Easy read makes type larger and the contrast stronger. Tap again to turn it off.',
  'font-smaller': 'Makes the type smaller. The choice stays on this phone.',
  'font-reset': 'Returns the type to the normal size.',
  'font-larger': 'Makes the type larger. The choice stays on this phone.',
  'ai-smaller': 'Makes the helper text smaller.',
  'ai-larger': 'Makes the helper text larger.',
  'ai-incognito': 'Incognito keeps everything on this phone until you approve. Tap to turn it on or off.',
  'ai-stop': 'Stops speaking or listening. Nothing is sent.'
};

const PAGES = [
  { path: '/', line: 'Home shows Health and the things on this phone. Other categories are for looking.', steps: ['Open Health', 'Choose your screen', 'Read messages'] },
  { path: '/gym', hash: '/ididit', line: 'IdidIt records what you did. The note stays on this phone until you tap OK.', steps: ['Name what you did', 'Check the words', 'Tap OK'] },
  { path: '/gym', hash: '/train', line: 'Train is a workout on this phone. Nothing is posted until you finish and confirm.', steps: ['Start', 'Finish', 'Ask someone to attest'] },
  { path: '/gym', hash: '/people', line: 'People are the members on this phone. You choose who can see a receipt.', steps: ['Pick a person', 'Read what is shared', 'Confirm only if you mean it'] },
  { path: '/gym', hash: '/groups', line: 'Groups are the clubs on this phone. A message stays here until you send it.', steps: ['Open a group', 'Read the thread', 'Write only if you mean to'] },
  { path: '/gym', hash: '/dispute', line: 'A dispute is a rehearsal. It moves no Creo and carries no penalty.', steps: ['Read the note', 'Say what happened', 'Tap only when you mean it'] },
  { path: '/gym', hash: '/helper', line: 'The helper setup stays on this phone. It never sends, posts, or spends by itself.', steps: ['Read what it may do', 'Set quiet hours', 'Turn it on only if you agree'] },
  { path: '/gym', hash: '/more', line: 'Health settings stay on this phone. Consent and the plan are yours to change.', steps: ['Read the setting', 'Change only what you mean', 'Tap OK'] },
  { path: '/gym', line: 'Health is the open club. A workout stays on this phone until you confirm.', steps: ['Start a session', 'Finish it', 'Ask someone to attest'] },
  { path: '/exchange', line: 'Exchange is for listings and receipts. Testnet only. Nothing is paid until you tap OK.', steps: ['Read the rule', 'Check the amount', 'Tap OK only to keep it'] },
  { path: '/help', line: 'Help explains the words. A quiz can earn Creo once. Nothing is sent by reading.', steps: ['Pick a topic', 'Read the short answer', 'Go back when you are done'] },
  { path: '/develop', line: 'Help develop is a note to the owner. It is not written on chain until you confirm.', steps: ['Pick a category', 'Write the note', 'Tap OK'] },
  { path: '/inventory', line: 'Inventory is the list on this phone. Nothing is published until you tap OK.', steps: ['Search or add an item', 'Check the words', 'Tap OK'] },
  { path: '/books', line: 'SobeIt is the book list on this phone. Reading does not send anything.', steps: ['Open a book', 'Read the page', 'Go back when you are done'] },
  { path: '/introduction', line: 'Introduction is the short start. It does not sign you up.', steps: ['Read the three steps', 'Open Health when you are ready', 'Go home if you want'] },
  { path: '/customize', line: 'A version is a personal setup. It stays a proposal until people attest and you confirm.', steps: ['Name the version', 'Read the preview', 'Tap OK to offer it'] },
  { path: '/disclaimer', line: 'The disclaimer is the live beta notice. Reading it does not sign you up.', steps: ['Read the notice', 'Tap only if you understand', 'Go on when you are ready'] },
  { path: '/barrier-checks', line: 'Barrier checks are the attestation rules. An unpublished change is not a change.', steps: ['Read the rule', 'Use the same rule everywhere', 'Go back when you are done'] }
];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sentences(text) {
  return String(text || '').split(/(?<=[.?!])\s+/).map((line) => line.trim()).filter(Boolean);
}

function withDetail(text) {
  const parts = sentences(text);
  if (parts.length >= 2) return parts.slice(0, 4).join(' ');
  return `${parts[0] || text} This stays on this phone. Nothing is saved until you tap OK. You can tap More in this panel to read the rest.`;
}

export function controlText(el) {
  if (!el || typeof el.getAttribute !== 'function') return '';
  if (el.closest && el.closest('#ai-ask, #ai-overview, #ai-overview-steps')) return '';
  const custom = clean(el.getAttribute('data-explain'));
  if (custom) return custom;
  if (NAMED[el.id]) return withDetail(NAMED[el.id]);
  const label = clean(el.getAttribute('aria-label') || el.textContent);
  if (!label || label.length > 80) return '';
  return withDetail(`${label}. Nothing happens until you tap OK.`);
}

export function pageOverview(pathname = '/', hash = '', title = '') {
  const path = String(pathname || '/').replace(/\.html$/, '') || '/';
  const mark = String(hash || '');
  const found = PAGES.find((page) => page.path === path && (!page.hash || mark.includes(page.hash)));
  if (found) return { line: withDetail(found.line), steps: found.steps.slice(0, 3) };
  const name = clean(title).replace(/\s*·\s*lgme$/i, '') || 'This page';
  return {
    line: withDetail(`${name}. Read it here. Nothing is saved until you tap OK.`),
    steps: ['Read the page', 'Tap a control to see what it does', 'Tap OK only when you mean to keep it']
  };
}

export function collectSections(doc = typeof document !== 'undefined' ? document : null) {
  const sections = [];
  const add = (title, text) => {
    const name = clean(title).replace(/[:.]+$/g, '');
    if (!name || name.length > 80) return;
    if (sections.some((item) => item.title.toLowerCase() === name.toLowerCase())) return;
    sections.push({ title: name, text: clean(text) || name });
  };
  if (!doc || !doc.querySelectorAll) return sections;
  doc.querySelectorAll('h1, h2, h3, summary').forEach((el) => {
    if (el.closest && (el.closest('#ai-dock') || el.closest('[hidden]'))) return;
    add(el.textContent, el.getAttribute('data-explain') || el.textContent);
  });
  doc.querySelectorAll('#creo-glossary li').forEach((el) => {
    const text = clean(el.textContent);
    add(text.split('=')[0], text);
  });
  return sections.slice(0, 12);
}
