# Public Enrollment Example

**Status:** Illustrative example only. Temporary pilot.  
**Date:** 13 October 2026  
**Credential:** Verified X handle (temporary). Not proof of unique personhood.

---

## Purpose

Show the exact signed-message format and the resulting tape entry for the current enrollment pilot.

---

## Signed-message format (exact)

Plain text, exact match required:

```
lgme enrollment pilot
handle: exampleuser
wallet: 0.0.1234567
timestamp: 1728825600
```

The holder signs this message with the wallet private key. Both the exact message and the signature are written to the tape.

---

## Example tape entry

| Field              | Value                                      |
|--------------------|--------------------------------------------|
| credential_type    | x-verified-handle                          |
| handle             | exampleuser                                |
| wallet             | 0.0.1234567                                |
| signed_message     | lgme enrollment pilot\nhandle: exampleuser\nwallet: 0.0.1234567\ntimestamp: 1728825600 |
| signature          | 0xabc123… (placeholder)                   |
| timestamp          | 1728825600                                 |
| status             | active                                     |
| note               | temporary pilot                            |

---

## Verification steps (public)

1. Recover the signer address from the signature over the exact `signed_message`.
2. Confirm the recovered address matches the `wallet` field.
3. Confirm the X handle is verified (external check; not performed on-chain).
4. Confirm `status` is `active` and no later revocation entry exists for the same handle or wallet.

An unpublished enrollment change is not a change.

---

## Disclaimer

This example uses placeholder values. A verified X handle is not proof of unique personhood. One person can control multiple verified accounts. This credential is temporary and will be replaced at the next milestone.

An unpublished change is not a change.
