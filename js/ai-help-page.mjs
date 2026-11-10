import { ASK_EXAMPLES, contributedCount, draftOffer, draftRequest, helpDraft, settleAiHelp, shareExcerpt } from './ai-help.mjs';

const state = {
  requester: 'river',
  helper: 'sam',
  task: ASK_EXAMPLES[0],
  notes: '',
  excerpt: '',
  request: null,
  offer: null,
  draft: null,
  edited: false,
  receipt: null,
  count: 0
};

const root = document.getElementById('ai-help');

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}

function status(text) {
  const node = document.getElementById('ai-status');
  if (node) node.textContent = text;
}

function draw() {
  const task = el('select', { id: 'ai-task' });
  for (const example of ASK_EXAMPLES) task.append(el('option', { value: example }, [example]));
  task.value = state.task;
  task.addEventListener('change', () => { state.task = task.value; });
  const notes = el('textarea', { id: 'ai-notes', maxlength: '800' });
  notes.value = state.notes;
  notes.addEventListener('input', () => {
    state.notes = notes.value;
    const shared = shareExcerpt(notes.value, '');
    excerpt.value = shared.ok ? shared.excerpt : '';
    state.excerpt = excerpt.value;
  });
  const excerpt = el('textarea', { id: 'ai-excerpt', maxlength: '280' });
  excerpt.value = state.excerpt;
  excerpt.addEventListener('input', () => { state.excerpt = excerpt.value; });
  const ask = el('button', { type: 'button', class: 'primary', id: 'ask-ai' }, ['Ask for AI help']);
  ask.addEventListener('click', () => {
    const shared = shareExcerpt(state.notes, state.excerpt);
    if (!shared.ok) { status(shared.error); return; }
    const drafted = draftRequest({ requester: state.requester, task: state.task, excerpt: shared.excerpt });
    if (!drafted.ok) { status(drafted.error); return; }
    state.request = drafted.request;
    status('You asked. Nothing was posted until you tapped.');
    draw();
  });
  const credit = el('input', { id: 'ai-credit', type: 'checkbox' });
  const pro = el('input', { id: 'ai-pro', type: 'checkbox' });
  const offer = el('button', { type: 'button', id: 'offer-ai' }, ['Offer AI help']);
  offer.addEventListener('click', () => {
    const result = draftOffer({ helper: state.helper, kind: 'IhavIT', wantsCredit: credit.checked, pro: pro.checked, intakeTier: 'Tier-0' });
    if (!result.ok) { status(result.error); return; }
    state.offer = result.offer;
    status('You offered. The other person still has to accept.');
    draw();
  });
  const reply = el('button', { type: 'button', id: 'draft-ai' }, ['Draft a reply']);
  reply.addEventListener('click', () => {
    if (!state.request || !state.offer) { status('Ask and offer first. Each person confirms.'); return; }
    state.draft = helpDraft({ helper: state.helper, task: state.task, excerpt: state.request.excerpt });
    state.edited = false;
    draw();
  });
  const edit = el('textarea', { id: 'ai-draft' });
  if (state.draft) edit.value = state.draft.body;
  edit.addEventListener('input', () => { state.edited = true; if (state.draft) state.draft.body = edit.value; });
  const accept = el('button', { type: 'button', class: 'primary', id: 'accept-ai' }, ['Accept draft']);
  const decline = el('button', { type: 'button', id: 'decline-ai' }, ['Decline']);
  accept.addEventListener('click', () => {
    const settled = settleAiHelp({ helper: state.helper, requester: state.requester, unit: 'draft', price: state.offer?.price || 0, edited: state.edited, declined: false });
    if (!settled.ok) { status(settled.error); return; }
    state.receipt = settled.receipt;
    state.count = contributedCount(state.count, settled.receipt);
    localStorage.setItem('lgme.aiHelp.count', JSON.stringify({ handle: state.helper, count: state.count }));
    status('Accepted. The receipt is on the listing. Nothing else was changed.');
    draw();
  });
  decline.addEventListener('click', () => {
    state.receipt = null;
    state.draft = null;
    status('Declined. Nothing was applied.');
    draw();
  });
  const view = el('div', {}, [
    el('p', { class: 'kicker' }, ['AI help']),
    el('h1', {}, ['Ask for AI help']),
    el('p', {}, ['You choose the words that are shared. The draft is not applied until you accept it.']),
    el('label', {}, ['What do you need?', task]),
    el('label', {}, ['Your notes. These stay here until you copy a short excerpt.', notes]),
    el('label', {}, ['Shared excerpt. Default is one short line.', excerpt]),
    ask
  ]);
  if (state.request) {
    view.append(el('article', { id: 'ai-request', class: 'card' }, [
      el('h2', {}, ['IwantIT · AI help']),
      el('p', {}, [state.request.title]),
      el('p', {}, [state.request.excerpt])
    ]));
  }
  view.append(el('h2', {}, ['Offer help']));
  view.append(el('label', { class: 'check' }, [credit, 'I want credit for this']));
  view.append(el('label', { class: 'check' }, [pro, 'I pay for my own AI tool']));
  view.append(offer);
  if (state.offer) {
    view.append(el('article', { id: 'ai-offer', class: 'card' }, [
      el('p', {}, [`${state.offer.postType} · AI help · @${state.offer.helper}`]),
      el('p', {}, [state.offer.price === 0 ? 'Gift. Clears with no debt.' : 'Priced. 1% stays with the category.'])
    ]));
  }
  view.append(reply);
  if (state.draft) {
    view.append(el('article', { id: 'ai-label', class: 'card' }, [
      el('p', {}, [state.edited ? 'You edited this draft.' : state.draft.label]),
      edit,
      accept,
      decline
    ]));
  }
  if (state.receipt) {
    view.append(el('article', { id: 'ai-receipt', class: 'card' }, [
      el('h2', {}, [state.receipt.name]),
      el('p', {}, [`${state.receipt.unit}. Helper @${state.receipt.helper}. Verifier @${state.receipt.verifier}.`]),
      el('p', {}, [state.receipt.gift ? 'Gift. Cleared instantly.' : `Category skim ${state.receipt.skim}.`])
    ]));
    view.append(el('p', { id: 'ai-help-badge' }, [`Contributed AI help: ${state.count}`]));
  }
  view.append(el('p', { id: 'ai-status', role: 'status' }, []));
  root.replaceChildren(view);
}

draw();
