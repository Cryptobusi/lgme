import { next, waitUntil } from '@vercel/functions';
import { planVisit, sendVisit } from './js/visit-alert.mjs';

export const config = {
  matcher: '/((?!api/|js/|css/|icons/|images/|docs/|fonts/|data/|assets/|_next/).*)'
};

export default async function middleware(request) {
  const plan = planVisit(request, process.env);
  if (!plan.send) return next();
  const pending = sendVisit(plan.payload, process.env).catch(() => ({ ok: false, id: '' }));
  const headers = { 'set-cookie': plan.cookie };
  if (plan.revealId) {
    const result = await pending;
    if (result.id) headers['x-visit-id'] = result.id;
    else {
      delete headers['set-cookie'];
      if (result.status) headers['x-visit-status'] = [result.status, result.error].filter(Boolean).join(' ');
    }
    return next({ headers });
  }
  try { waitUntil(pending); } catch { /* a missed note must not block the page */ }
  return next({ headers });
}
