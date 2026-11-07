import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DONATION_ADDRESS, MINT, buildTransferRequest, createReference, isValidPublicKey, parseSplTransfer } from '../js/solana-pay.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('a Solana Pay request names the mint, amount, recipient, and reference', () => {
  assert.equal(isValidPublicKey(MINT), true);
  assert.equal(isValidPublicKey(DONATION_ADDRESS), true);
  assert.equal(isValidPublicKey('not-an-address'), false);
  const reference = createReference();
  assert.equal(isValidPublicKey(reference), true);
  const built = buildTransferRequest({
    recipient: DONATION_ADDRESS,
    amount: 1.5,
    reference,
    message: 'devnet test'
  });
  assert.equal(built.ok, true, built.error);
  const url = new URL(built.url);
  assert.equal(url.protocol, 'solana:');
  assert.equal(url.pathname, DONATION_ADDRESS);
  assert.equal(url.searchParams.get('amount'), '1.5');
  assert.equal(url.searchParams.get('spl-token'), MINT);
  assert.equal(url.searchParams.get('reference'), reference);
  assert.equal(buildTransferRequest({ recipient: 'nope', amount: 1, reference }).ok, false);
  const source = readFileSync(join(root, 'js/solana-pay.mjs'), 'utf8');
  assert.equal(source.includes('secretKey'), false);
  assert.equal(source.includes('mnemonic'), false);
  assert.equal(source.includes('seed phrase'), false);
});

test('verification accepts only the matching mint, amount, and recipient', () => {
  const reference = createReference();
  const tx = {
    transaction: { signatures: ['sig123'], message: { accountKeys: [reference, DONATION_ADDRESS] } },
    meta: {
      preTokenBalances: [{ accountIndex: 1, mint: MINT, owner: DONATION_ADDRESS, uiTokenAmount: { uiAmountString: '1' } }],
      postTokenBalances: [{ accountIndex: 1, mint: MINT, owner: DONATION_ADDRESS, uiTokenAmount: { uiAmountString: '2.5' } }]
    }
  };
  const ok = parseSplTransfer(tx, { mint: MINT, recipient: DONATION_ADDRESS, amount: 1.5, reference });
  assert.equal(ok.ok, true, ok.error);
  assert.equal(ok.signature, 'sig123');
  const wrongMint = parseSplTransfer(tx, { mint: 'mint', recipient: DONATION_ADDRESS, amount: 1.5, reference });
  assert.equal(wrongMint.ok, false);
  const wrongAmount = parseSplTransfer(tx, { mint: MINT, recipient: DONATION_ADDRESS, amount: 2, reference });
  assert.equal(wrongAmount.ok, false);
  const missingRef = parseSplTransfer(tx, { mint: MINT, recipient: DONATION_ADDRESS, amount: 1.5, reference: createReference() });
  assert.equal(missingRef.ok, false);
});
