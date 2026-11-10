export async function mountHederaAnchor(host) {
  if (!host) return;
  const title = document.createElement('h3');
  title.textContent = 'Hedera testnet anchor';
  const note = document.createElement('p');
  note.className = 'legend';
  host.replaceChildren(title, note);
  let status = { enabled: false, wording: 'Testnet anchoring is not running yet. Nothing is written until the operator is connected. No mainnet write.' };
  try {
    const response = await fetch('/api/hedera/status');
    status = await response.json();
  } catch {
    status.wording = 'Testnet anchoring is not running yet. No mainnet write.';
  }
  note.textContent = status.wording || 'Testnet hashes are written on a schedule. Health data is not written. No mainnet write.';
  if (!status.enabled) return;
  const out = document.createElement('p');
  out.className = 'legend';
  out.textContent = status.topicId ? `The daily job writes hashes to testnet topic ${status.topicId}.` : 'The daily job writes hashes to the testnet topic.';
  host.append(out);
}
