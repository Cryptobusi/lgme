function rawKey(value) {
  return String(value || '').toLowerCase().replace(/^0x/, '');
}

function samePublicKey(derived, wanted) {
  const left = rawKey(derived);
  const right = rawKey(wanted);
  if (!left || !right) return false;
  return left === right || left.endsWith(right) || right.endsWith(left);
}

function parsersFor(type) {
  if (type === 'ECDSA_SECP256K1') return ['fromStringECDSA', 'fromStringDer', 'fromString'];
  if (type === 'ED25519') return ['fromStringED25519', 'fromStringDer', 'fromString'];
  return ['fromStringECDSA', 'fromStringED25519', 'fromString'];
}

export async function testnetOperatorKey(sdk, env = {}, fetchImpl = globalThis.fetch) {
  const secret = String(env.HEDERA_TESTNET_OPERATOR_KEY || '').trim();
  const accountId = String(env.HEDERA_TESTNET_OPERATOR_ID || '').trim();
  if (!secret || !accountId) {
    const error = new Error('The testnet operator is not configured.');
    error.public = true;
    throw error;
  }
  const response = await fetchImpl(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`);
  if (!response?.ok) {
    const error = new Error('The testnet account could not be read.');
    error.public = true;
    throw error;
  }
  const account = await response.json();
  const wanted = account?.key?.key || '';
  let matched = null;
  for (const name of parsersFor(account?.key?._type)) {
    const parse = sdk.PrivateKey?.[name];
    if (typeof parse !== 'function') continue;
    try {
      const key = parse.call(sdk.PrivateKey, secret);
      if (samePublicKey(key.publicKey.toStringRaw(), wanted)) {
        matched = key;
        break;
      }
    } catch {
      // This parser does not accept the key. Try the next one.
    }
  }
  if (!matched) {
    const error = new Error('The testnet operator key does not match this account.');
    error.public = true;
    throw error;
  }
  return matched;
}
