export const SIGNIN_GAP_MS = 60 * 1000;
export const SIGNIN_HOUR_MAX = 5;

export function signinAllowed(stamps, now = Date.now()) {
  const recent = (stamps || []).filter((stamp) => now - stamp < 60 * 60 * 1000);
  const last = recent.at(-1) || 0;
  if (recent.length >= SIGNIN_HOUR_MAX) return { ok: false, error: 'Too many tries. Wait and try again.' };
  if (last && now - last < SIGNIN_GAP_MS) return { ok: false, error: 'Wait a minute before another code.' };
  return { ok: true, stamps: [...recent, now] };
}

export function nextAccess(state = {}) {
  if (state.full) return 'full';
  if (!state.email) return 'email';
  if (!state.codeOk) return 'code';
  if (!state.memberId) return 'member';
  if (!state.aiTested) return 'ai';
  return 'grant';
}

export function gateDecision({ human, method, verified } = {}) {
  if (human !== true) return { ok: false, error: 'A person has to confirm. Nothing ran.' };
  if (method === 'passkey') return { ok: true };
  if (method === 'totp') {
    if (verified === true) return { ok: true };
    return { ok: false, error: 'The authenticator code was not accepted.' };
  }
  return { ok: false, error: 'Use a fingerprint or a 6-digit authenticator code.' };
}
