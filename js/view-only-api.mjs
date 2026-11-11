export const VIEW_ONLY_MESSAGE = 'View only for now. Only Health can create, sign, post, credit, or sync.';

export function healthWrite(category) {
  const name = String(category || 'health').trim().toLowerCase();
  return name === 'health' || name === '';
}
