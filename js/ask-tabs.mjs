export const ASK_TABS = Object.freeze([
  { id: 'direct', label: 'Direct' },
  { id: 'excite', label: 'Excite' },
  { id: 'review', label: 'Review' },
  { id: 'inform', label: 'Inform' },
  { id: 'use', label: 'Use' }
]);
export const TAB_KEY = 'lgme.ask.tab';

export function readTab(storage) {
  try {
    const value = storage?.getItem(TAB_KEY);
    return ASK_TABS.some((tab) => tab.id === value) ? value : 'direct';
  } catch { return 'direct'; }
}

export function setTab(storage, id) {
  const next = ASK_TABS.some((tab) => tab.id === id) ? id : 'direct';
  try { storage.setItem(TAB_KEY, next); } catch { /* the row still shows this choice */ }
  return next;
}

export function shapeAnswer(tab, text, status = '') {
  const body = String(text || '').trim() || 'The built-in guide is here. Nothing is sent until you tap OK.';
  if (tab === 'excite') return `This is worth one calm step. ${body} There is no score and no rush.`;
  if (tab === 'review') return `Here is the short status. ${status || 'Nothing new is waiting on this phone.'} ${body}`;
  if (tab === 'use') return `Here is how to do it. ${body} Follow the steps, then tap OK.`;
  if (tab === 'inform') return `Here is what this is. ${body}`;
  return `Do this next. ${body} Tap OK only when you mean to keep it.`;
}

export function focusFirstEmpty(root) {
  if (!root || !root.querySelectorAll) return null;
  const fields = [...root.querySelectorAll('input, textarea, select')].filter((el) => {
    if (!el || el.disabled || el.type === 'hidden' || el.type === 'file') return false;
    return el.offsetParent !== null || el.getClientRects?.().length;
  });
  const empty = (el) => !String(el.value || '').trim();
  const target = fields.find((el) => el.required && empty(el)) || fields.find(empty) || null;
  if (!target) return null;
  target.scrollIntoView?.({ block: 'center' });
  target.focus?.();
  target.classList?.add('is-ask-focus');
  return target;
}
