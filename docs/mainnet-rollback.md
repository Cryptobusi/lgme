# Mainnet rollback

This note is not a public page. `docs/` is in `.vercelignore`, and this file is not in the sitemap.

Hedera writes stay on testnet. `HEDERA_NETWORK` is not set to mainnet by this prep.

## One-time Health setup

`POST /api/hedera/mainnet-setup` with the owner header creates the keyed Health topic if it is missing and writes one hash. It does not print the operator key. General mainnet writes stay closed until `HEDERA_NETWORK` is `mainnet` on production.

## Switch back

1. Set `HEDERA_NETWORK` to `testnet` on production and preview.
2. Redeploy project `lgme` in Vercel scope `lgme`.
3. Confirm `GET /api/hedera/status` reports `network: testnet` and `mainnetWrites: false`.
4. Do not create a mainnet topic, and do not send a mainnet transaction, as part of the rollback.

Previews already ignore a mainnet request and stay on testnet.

## What stays

Test listings, test authors, and the three example trades stay visible. They are read from the testnet topic `0.0.11397293`, or from the bundled snapshot if that read fails. They are not written to mainnet. A real claim replaces that example with the real item.

The spending cap is 1 HBAR per day. The operator `0.0.1273453` raises an alert when a read-only mainnet mirror query shows a balance under 100 HBAR.

## If a mainnet write had already landed

Leave the message. Do not delete a topic. Point new writes back at testnet. Tell members the mainnet message is a hash only, and the working record is the testnet one until the owner opens mainnet on purpose.
