import { deedCreditSplit } from './commons-split.mjs';

export const AI_CATEGORY = 'ai-help';
export const ASK_EXAMPLES = Object.freeze([
  'Turn my notes into two intake offerings',
  'Draft my weekly goal plan',
  'Translate my listing'
]);

const PRIVATE = /\b(signature|legal name|covenant|health|mood|sleep|pain|diagnos\w*|latitude|longitude|gps|photo|raw evidence)\b/i;

export function shareExcerpt(notes, chosen) {
  const source = String(chosen == null || chosen === '' ? notes : chosen).replace(/\s+/g, ' ').trim();
  const minimal = source.split(/(?<=[.!?])\s+/)[0]?.slice(0, 80) || source.slice(0, 80);
  const excerpt = String(chosen == null || chosen === '' ? minimal : chosen).replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!excerpt) return { ok: false, error: 'Choose the words you want to share.' };
  if (PRIVATE.test(excerpt)) return { ok: false, error: 'Leave out your signature, legal name, health notes, and raw evidence.' };
  return { ok: true, excerpt, preview: excerpt };
}

export function draftRequest({ requester, task, excerpt }) {
  const shared = shareExcerpt('', excerpt);
  if (!shared.ok) return shared;
  return {
    ok: true,
    request: {
      postType: 'IwantIT',
      category: AI_CATEGORY,
      title: String(task || ASK_EXAMPLES[0]),
      excerpt: shared.excerpt,
      requester,
      status: 'asked',
      submitted: false
    }
  };
}

export function draftOffer({ helper, kind, wantsCredit, pro, intakeTier }) {
  const postType = kind === 'IselIT' ? 'IselIT' : 'IhavIT';
  if (wantsCredit && pro && intakeTier !== 'Tier-1') {
    return { ok: false, error: 'Credit for AI help waits on the same 5-gate intake check. Your own paid AI subscription counts as unencumbered access when you pay it yourself.' };
  }
  return {
    ok: true,
    offer: {
      postType,
      category: AI_CATEGORY,
      helper,
      price: wantsCredit ? 1 : 0,
      unit: 'one draft',
      tools: pro ? 'own AI subscription' : 'on-device helper'
    }
  };
}

export function helpDraft({ helper, task, excerpt }) {
  const note = String(excerpt || '').slice(0, 80);
  let body = `A plain draft: ${note}`;
  if (/intake/i.test(task)) body = `Primary offering: ${note}. Secondary offering: a smaller version of the same help.`;
  else if (/goal/i.test(task)) body = `Weekly plan: one small step from your notes. ${note}`;
  else if (/translat/i.test(task)) body = `Plain-language listing: ${note}`;
  return {
    label: `Drafted with help from @${helper} using AI`,
    body,
    edited: false,
    accepted: false
  };
}

export function settleAiHelp({ helper, requester, unit, minutes, price, edited, declined }) {
  if (declined) return { ok: true, applied: false, receipt: null };
  if (!edited) return { ok: false, error: 'Edit the draft before you accept it. Nothing is applied for you.' };
  const gift = !(Number(price) > 0);
  const split = gift ? null : deedCreditSplit(price);
  if (split && !split.ok) return split;
  const figure = gift ? 'one draft' : (unit === 'minutes' ? `${Number(minutes) || 0} minutes` : 'one draft');
  return {
    ok: true,
    applied: true,
    receipt: {
      name: 'IdidIt (verified receipt)',
      category: 'AI help',
      unit: unit === 'minutes' ? `${Number(minutes) || 0} minutes` : figure,
      helper,
      verifier: requester,
      gift,
      instant: gift,
      skim: gift ? 0 : split.skim,
      author: gift ? 0 : split.author
    }
  };
}

export function contributedCount(prior, receipt) {
  if (!receipt) return Number(prior) || 0;
  return (Number(prior) || 0) + 1;
}
