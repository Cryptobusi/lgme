import { helpDraft } from './category-help.mjs';
import { publicHelpWant } from './develop-want.mjs';
import { deviceContext, draftWithHelper, pickHelperSync, refreshHelper, rememberContext, showHelperNote } from './one-tap.mjs';

const RETURN_KEY = 'lgme.develop.return';
const form = document.getElementById('want-form');
const status = document.getElementById('want-status');
const suggest = document.getElementById('want-suggest');
const params = new URLSearchParams(location.search);
const draft = helpDraft(params.get('category') || 'Health');

const context = deviceContext();
document.getElementById('want-kind').value = draft.kind;
document.getElementById('want-category').value = draft.category;
document.getElementById('want-title').value = draft.title;
document.getElementById('want-body').value = context.handle
  ? `${draft.body} I am ${context.handle}.`
  : draft.body;
if (context.skill) document.getElementById('want-skill').value = context.skill;
if (context.time) document.getElementById('want-time').value = context.time;
const helper = pickHelperSync();
const helperNoteNode = document.createElement('p');
helperNoteNode.id = 'want-helper';
helperNoteNode.className = 'helper-note';
form.before(helperNoteNode);
showHelperNote(helperNoteNode, helper);
refreshHelper(window, localStorage, (picked) => showHelperNote(helperNoteNode, picked));
draftWithHelper(helper, {
  template: document.getElementById('want-body').value,
  prompt: `Write one sentence offering to help develop ${draft.category}. Do not include an email or a phone number.`,
  scope: window
}).then((result) => { document.getElementById('want-body').value = result.text; });

function signedIn() {
  return Boolean(localStorage.getItem('lgme-gym.seat') || localStorage.getItem('lgme-sim:ui:seat'));
}

function paint() {
  const button = document.getElementById('want-confirm');
  button.textContent = signedIn() ? 'Confirm IwanIT' : 'Sign up to post this';
}

if (helper.id !== 'none') {
  suggest.hidden = false;
  suggest.addEventListener('click', () => {
    const category = document.getElementById('want-category').value;
    document.getElementById('want-body').value = `I can help build ${category}. I will say what I can do, and I will not post this until I confirm.`;
    status.textContent = 'Suggested wording only. Nothing was posted.';
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    kind: 'IwanIT',
    category: document.getElementById('want-category').value,
    title: document.getElementById('want-title').value,
    body: document.getElementById('want-body').value,
    skill: document.getElementById('want-skill').value,
    time: document.getElementById('want-time').value
  };
  const built = publicHelpWant(payload);
  if (!built.ok) { status.textContent = built.error; return; }
  rememberContext(localStorage, { skill: payload.skill, time: payload.time, category: payload.category, handle: context.handle });
  if (!signedIn()) {
    sessionStorage.setItem(RETURN_KEY, `${location.pathname}${location.search}`);
    location.assign('/gym#/register');
    return;
  }
  const response = await fetch('/api/develop/want', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  status.textContent = body.ok
    ? `Posted. ${body.item?.title || payload.title}. Testnet only.`
    : (body.error || 'Nothing was posted.');
});

paint();
