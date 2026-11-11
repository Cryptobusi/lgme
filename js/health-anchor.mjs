export const TESTNET_ANCHOR = 'Health hashes are anchored on Hedera testnet. Health data itself is never written on chain.';
export const MAINNET_ANCHOR = 'Health hashes are anchored on Hedera mainnet. Health data itself is never written on chain.';

export function healthAnchorLine(status) {
  if (status && status.network === 'mainnet' && status.mainnetWrites === true) return MAINNET_ANCHOR;
  return TESTNET_ANCHOR;
}

export async function paintHealthAnchor(doc = document, fetchImpl = globalThis.fetch) {
  const nodes = [...doc.querySelectorAll('[data-health-anchor]')];
  if (!nodes.length) return TESTNET_ANCHOR;
  let line = TESTNET_ANCHOR;
  try {
    const response = await fetchImpl('/api/hedera/status');
    if (response?.ok) line = healthAnchorLine(await response.json());
  } catch { /* the page stays on the testnet sentence */ }
  for (const node of nodes) {
    const rest = node.getAttribute('data-health-rest') || '';
    node.textContent = rest ? `${line} ${rest}` : line;
  }
  return line;
}
