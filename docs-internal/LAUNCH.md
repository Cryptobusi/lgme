# Health mainnet launch checklist

This note stays in the repo and is not part of the public site.

Mainnet writes are closed. No mainnet topic has been created. The operator key is not read by the app.

## Stay on testnet

- Leave `HEDERA_NETWORK` unset, or set it to `testnet`.
- Do not set `HEDERA_NETWORK=mainnet` until a signed-off testnet review says the Health flows work.
- Preview deployments ignore a mainnet value and stay on testnet.

## One-switch rollback

1. Set `HEDERA_NETWORK=testnet` on production.
2. Redeploy.
3. Confirm `/api/hedera/status` still describes testnet and that no mainnet client was opened.

## Before any later mainnet request

- Create the daily-proof topic and the Exchange listings topic only when the review allows it.
- Give each topic the operator key as admin key and submit key.
- Store the ids as `HEDERA_MAINNET_TOPIC_ID` and `HEDERA_MAINNET_LISTINGS_TOPIC_ID`.
- Keep `HEDERA_MAINNET_DAILY_HBAR_CAP` at 1 HBAR unless a higher cap is chosen.
- Submit hashes only. Do not copy the 10 test listings, “Test item” statuses, or setup-fee receivables.
- Keep the per-member listing limit.
