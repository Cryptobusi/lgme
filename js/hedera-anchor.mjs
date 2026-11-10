import { merkleRootOf } from './clearing.mjs';

export async function mountHederaAnchor(host, spec = {}) {
  if (!host) return;
  const title = document.createElement('h3');
  title.textContent = 'Hedera testnet anchor';
  const note = document.createElement('p');
  note.className = 'legend';
  host.replaceChildren(title, note);
  let status = { enabled: false, missing: [], wording: 'Public Hedera anchoring: coming. Not written to Hedera today.' };
  try {
    const response = await fetch('/api/hedera/status');
    status = await response.json();
  } catch {
    status.wording = 'Public Hedera anchoring: coming. Not written to Hedera today.';
  }
  if (!status.enabled) {
    const missing = (status.missing || []).join(', ');
    note.textContent = `${status.wording || 'Public Hedera anchoring: coming. Not written to Hedera today.'} Testnet anchoring is built and waiting on ${missing || 'HEDERA_TESTNET_OPERATOR_ID, HEDERA_TESTNET_OPERATOR_KEY, and HEDERA_TESTNET_ANCHOR=on'}. Topic 0.0.489104 is refused. No mainnet write.`;
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Anchor today’s root on testnet';
  const out = document.createElement('p');
  out.className = 'legend';
  button.addEventListener('click', async () => {
    const leaves = spec.leaves || [];
    const root = await merkleRootOf(leaves);
    out.textContent = 'Submitting the recomputed root…';
    const response = await fetch('/api/hedera/anchor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leaves, day: spec.day || '', root })
    });
    const body = await response.json();
    if (!body.ok) { out.textContent = body.error || body.wording || 'Not written to Hedera today.'; return; }
    const link = document.createElement('a');
    link.href = body.hashscan;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'HashScan testnet';
    out.replaceChildren(document.createTextNode(`Anchored on Hedera testnet (not mainnet). Topic ${body.topicId}, sequence ${body.sequenceNumber}, consensus ${body.consensusTimestamp}. `), link);
  });
  note.textContent = 'The server recomputes the daily Merkle root and submits it to Hedera testnet. The operator key stays on the server. This desk holds no user key.';
  host.append(button, out);
}
