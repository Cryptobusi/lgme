export const COMMONS_SPLIT = Object.freeze({ floor: 0.05, app: 0.05 });
export const APP_FUND_NAME = 'App development fund';
export const DEED_SKIM = 0.01;

function centsOf(amount) {
  const figure = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(figure) || figure <= 0) return null;
  return { figure, cents: Math.round(figure * 100) };
}

export function commonsSplit(amount) {
  const parsed = centsOf(amount);
  if (!parsed) return { ok: false, error: 'Enter an amount greater than zero.' };
  const floorCents = Math.floor(parsed.cents * COMMONS_SPLIT.floor);
  const appCents = Math.floor(parsed.cents * COMMONS_SPLIT.app);
  if (floorCents < 1 || appCents < 1) {
    return { ok: false, error: 'Use at least 0.20 so the Floor and the App development fund each receive a share.' };
  }
  const authorCents = parsed.cents - floorCents - appCents;
  return {
    ok: true,
    amount: parsed.figure,
    floor: floorCents / 100,
    app: appCents / 100,
    author: authorCents / 100
  };
}

export function deedCreditSplit(amount) {
  const parsed = centsOf(amount);
  if (!parsed) return { ok: false, error: 'Enter an amount greater than zero.' };
  const skimCents = Math.floor(parsed.cents * DEED_SKIM);
  return {
    ok: true,
    amount: parsed.figure,
    skim: skimCents / 100,
    author: (parsed.cents - skimCents) / 100,
    category: 'health-fitness'
  };
}
