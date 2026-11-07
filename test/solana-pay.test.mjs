import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DONATION_ADDRESS, MINT, buildTransferRequest, createReference, findReferencePayment, isValidPublicKey, parseSplTransfer } from '../js/solana-pay.mjs';

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
  const failed = parseSplTransfer({ ...tx, meta: { ...tx.meta, err: { InstructionError: [0, 'Custom'] } } }, { mint: MINT, recipient: DONATION_ADDRESS, amount: 1.5, reference });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /failed on Solana/);
  const exact = parseSplTransfer({
    transaction: tx.transaction,
    meta: {
      preTokenBalances: [{ accountIndex: 1, mint: MINT, owner: DONATION_ADDRESS, uiTokenAmount: { amount: '1000000', decimals: 6, uiAmountString: '1' } }],
      postTokenBalances: [{ accountIndex: 1, mint: MINT, owner: DONATION_ADDRESS, uiTokenAmount: { amount: '2500000', decimals: 6, uiAmountString: '2.5' } }]
    }
  }, { mint: MINT, recipient: DONATION_ADDRESS, amount: 1.5, reference });
  assert.equal(exact.ok, true, exact.error);
  const offByOne = parseSplTransfer({
    transaction: tx.transaction,
    meta: {
      preTokenBalances: [{ accountIndex: 1, mint: MINT, owner: DONATION_ADDRESS, uiTokenAmount: { amount: '1000000', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 1, mint: MINT, owner: DONATION_ADDRESS, uiTokenAmount: { amount: '2500001', decimals: 6 } }]
    }
  }, { mint: MINT, recipient: DONATION_ADDRESS, amount: 1.5, reference });
  assert.equal(offByOne.ok, false);
});

test('finality ignores a signature that is not finalized and rejects a failed transaction', async () => {
  const reference = createReference();
  const original = globalThis.fetch;
  const rpcBodies = [];
  function respond(body) {
    rpcBodies.push(body);
    if (body.method === 'getSignaturesForAddress') {
      return { result: [{ signature: 'soon', confirmationStatus: 'confirmed', err: null }] };
    }
    return { result: null };
  }
  globalThis.fetch = async (_url, options) => ({
    ok: true,
    json: async () => respond(JSON.parse(options.body))
  });
  try {
    const waiting = await findReferencePayment('devnet', reference, { mint: MINT, recipient: DONATION_ADDRESS, amount: 1.5 });
    assert.equal(waiting.ok, false);
    assert.match(waiting.error, /not finalized/);
    assert.equal(rpcBodies[0].params[1].commitment, 'finalized');
    rpcBodies.length = 0;
    globalThis.fetch = async (_url, options) => ({
      ok: true,
      json: async () => {
        const body = JSON.parse(options.body);
        rpcBodies.push(body);
        if (body.method === 'getSignaturesForAddress') {
          return { result: [{ signature: 'bad', confirmationStatus: 'finalized', err: null }] };
        }
        return {
          result: {
            meta: { err: { InstructionError: [0, 'Custom'] }, preTokenBalances: [], postTokenBalances: [] },
            transaction: { signatures: ['bad'], message: { accountKeys: [reference] } }
          }
        };
      }
    });
    const failed = await findReferencePayment('devnet', reference, { mint: MINT, recipient: DONATION_ADDRESS, amount: 1.5 });
    assert.equal(failed.ok, false);
    assert.match(failed.error, /failed on Solana/);
    assert.equal(rpcBodies.some((body) => body.method === 'getTransaction' && body.params[1].commitment === 'finalized'), true);
  } finally {
    globalThis.fetch = original;
  }
});
