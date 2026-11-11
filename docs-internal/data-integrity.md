# Data integrity inventory

Not a public page. `docs-internal/` is excluded from the deploy.

## Routes

| Route | Methods | Auth | Where data goes |
|---|---|---|---|
| /api/email/status | GET | none | nowhere |
| /api/email/send | POST | none | Resend sends the code; KV stores only the code hash |
| /api/email/verify | POST | the code | KV hash compare; response has an email hash |
| /api/gym/chat | GET, POST, DELETE | device signature | KV |
| /api/gym/covenant | GET, POST | device signature | KV |
| /api/gym/dispute | GET, POST | device signature | KV, hash only unless both consent |
| /api/gym/intake | GET, POST | device signature | KV |
| /api/gym/presence | GET, POST | device signature | KV |
| /api/gym/progress | GET, POST, DELETE | device signature | KV |
| /api/exchange/repair | GET, POST | device signature | KV, not Hedera |
| /api/hedera/status | GET | none | testnet mirror and a public mainnet balance read |
| /api/hedera/mirror | GET | none | testnet mirror read |
| /api/hedera/queue | POST | device signature | KV, then a testnet hash |
| /api/hedera/anchor | POST | cron secret | testnet topic, hashes only |
| /api/hedera/cron | GET, POST | cron secret | testnet topic |
| /api/hedera/topic | POST | admin flags | refuses until both flags are set |
| /api/hedera/listings | GET, POST | device signature | testnet topic and KV |

## Fields

Client forms: email, 6-digit code, invite code, listing title, service, minutes, tags, note, claim role, repair details, gym progress card, chat text, covenant token, intake hashes, dispute hash.

URL and query: Hedera mirror `topic` as `0.0.N`. Invite links carry a code, not a name.

Headers: `origin` is checked when present. Cron uses `x-lgme-cron`. No auth cookie.

Device storage: `lgme-gym.seat`, `lgme.health.book`, `lgme.health.email`, personal images, and the exchange snapshot. The personal Health book is not posted.

API JSON: device envelopes (`handle`, `publicJwk`, `sig`, `payload`) and email `{email}` / `{email, code}`. Unknown JSON keys are rejected on email send. `__proto__`, duplicate keys, control characters, and oversized bodies are rejected on every body read.
