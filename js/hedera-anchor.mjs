export async function mountHederaAnchor(host) {
  if (!host) return;
  const title = document.createElement('h3');
  title.textContent = 'Record';
  const note = document.createElement('p');
  note.className = 'legend';
  note.textContent = 'Nothing on this page is anchored or written to Hedera.';
  host.replaceChildren(title, note);
  try { await fetch('/api/hedera/status'); } catch { /* status endpoint stays; this page does not claim a write */ }
}
