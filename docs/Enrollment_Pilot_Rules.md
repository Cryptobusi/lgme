# Enrollment Pilot Rules (Temporary)

**Status:** Temporary pilot. Must be revisited at next milestone.  
**Date:** 13 October 2026

---

## Credential

Verified X (Twitter) handle linked to a wallet by a signed message.  
Recorded on the tape.

**Disclaimer:** Not proof of unique personhood. One person can control multiple verified accounts. Accounts can be bought, sold, or rented. Verification is a paid X subscription. Temporary only. Will be replaced at the next milestone. An unpublished change is not a change.

---

## Tape entries required

- credential_type: `x-verified-handle`
- handle
- wallet
- signed_message
- signature
- timestamp
- status: `active` or `revoked`

---

## Signed-message format (exact)

```
lgme enrollment pilot
handle: <username>
wallet: <hedera-account-or-address>
timestamp: <unix-seconds>
```

---

## Voting formula (current test)

Simplest square-root form only:

\[ V_i = \sqrt{C_i} \]

\[ V_{\rm total} = \sum_i \sqrt{C_i} \cdot \delta_i \]

Not a true quadratic cost. Temporary. Replace at next milestone.

---

## Revisit at next milestone

1. X-handle credential → stronger uniqueness signal.
2. Simplest voting formula → true quadratic cost (fixed budget, cost = credits²).

An unpublished change is not a change.
