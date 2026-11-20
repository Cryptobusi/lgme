import { sha256Hex } from './device-sign.mjs';
import { formatCredits, toHundredths } from './work-credits.mjs';

export const CONTRIB_FLAG = 'LGME_CONTRIB_LIVE';
export const DESTINATION = '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY';
export const COIN = '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump';

export function livePayments(rules = {}) {
  return String(rules[CONTRIB_FLAG] || 'off') === 'on';
}

export function splitHundredths(total) {
  const health = Math.floor(Number(total) / 2);
  return { collective: Number(total) - health, health };
}

export function previewContribution({ lgme = 0, rules }) {
  const price = Number(rules.examplePriceUsd);
  const usdCents = Math.round(Number(lgme) * price * 100);
  const creditUnit = Math.round(Number(rules.usdPerCredit) * 100);
  const credits = creditUnit ? Math.round(usdCents / creditUnit) : 0;
  const split = splitHundredths(credits);
  return {
    lgme: Number(lgme),
    priceLabel: 'example price',
    usd: formatCredits(usdCents),
    credits,
    creditsLabel: formatCredits(credits),
    collective: split.collective,
    health: split.health,
    destination: DESTINATION,
    wallet: '@EgonAnon',
    coin: COIN
  };
}

export async function contribute({ lgme = 0, rules, confirmed = false, gate = false, kind = 'credits', memberHash = '' }) {
  const preview = previewContribution({ lgme, rules });
  const ready = confirmed === true && gate === true;
  const transfer = livePayments(rules) && ready;
  if (!ready) return { ...preview, transfer: false, simulated: !livePayments(rules), recorded: false, error: 'Confirm and the device check are required.' };
  const hash = await sha256Hex(`${kind}|${preview.credits}|${preview.collective}|${preview.health}|${memberHash}`);
  return {
    ...preview,
    transfer,
    simulated: !transfer,
    recorded: true,
    hash,
    error: transfer ? '' : 'Nothing was transferred. $lgme is temporary until the DAO.'
  };
}

export function milestoneAward({ sessions = 0, attestedDays = 0, rules }) {
  const awards = [];
  for (const item of rules.milestones || []) {
    if (item.id === 'first-10-sessions' && sessions >= 10) awards.push(item);
    if (item.id === 'thirty-days' && attestedDays >= 30) awards.push(item);
  }
  return awards;
}
