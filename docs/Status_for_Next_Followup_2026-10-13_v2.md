# Status for Next Follow-up — 13 October 2026 (v2)

**Purpose:** Continuity snapshot. All current inscriptions and open items.

---

## Inscribed topics (Tape)

| Document | Topic ID | HRL |
|----------|----------|-----|
| Whitepaper | 0.0.10917616 | hcs://1/0.0.10917616 |
| Commentary | 0.0.10917607 | hcs://1/0.0.10917607 |
| Barrier checks | 0.0.10917585 | hcs://1/0.0.10917585 |
| Status snapshot (12 Oct) | 0.0.10917624 | hcs://1/0.0.10917624 |
| Enrollment pilot rules | 0.0.10917853 | hcs://1/0.0.10917853 |
| Enrollment design note | 0.0.10917981 | hcs://1/0.0.10917981 |
| Enrollment example | 0.0.10918058 | hcs://1/0.0.10918058 |
| First Person Credentials evaluation | 0.0.10918126 | hcs://1/0.0.10918126 |
| True Quadratic Cost | 0.0.10918175 | hcs://1/0.0.10918175 |
| Attested utility telemetry schema | 0.0.10918220 | hcs://1/0.0.10918220 |
| Accounting fixes implementation outline | 0.0.10918378 | hcs://1/0.0.10918378 |
| Epoch parameters | 0.0.10918419 | hcs://1/0.0.10918419 |
| Mock second test comparison | 0.0.10918510 | hcs://1/0.0.10918510 |
| Epoch boundaries & score decay | 0.0.10917935 | hcs://1/0.0.10917935 |
| Contract accounting fixes | 0.0.10917944 | hcs://1/0.0.10917944 |
| Attested utility inputs | 0.0.10918021 | hcs://1/0.0.10918021 |
| Accounting fixes reference | 0.0.10918033 | hcs://1/0.0.10918033 |
| Status snapshot (13 Oct) | 0.0.10918042 | hcs://1/0.0.10918042 |

---

## Current pilot state

- **Credential:** temporary verified X-handle linked by signed message. Explicitly not unique personhood.
- **Voting:** simplest form `V = √C`. Target is fixed budget of 3 voice credits per month with cost = `C²`.
- **Utility inputs:** must come from attested observations (signed schema). Caller-supplied values rejected.
- **Epoch:** 30-day length with full reset of scores and budget.
- **Accounting:** zero-division guard, unit consistency, epoch-aware last-claimed, attested inputs only.

---

## Revisit at next milestone

1. Replace X-handle credential with stronger personhood (First Person Credentials or equivalent).
2. Activate true quadratic cost (budget of 3).
3. Finalize jury selection and telemetry sources for attested utility.
4. Move accounting fixes from outline to tested implementation.
5. Lock epoch parameters (confirm 30-day or switch to calendar month).
6. Evaluate KiloScribe API for automated inscription.

---

## Residual trust assumptions (recorded)

- X-handle: one person can control multiple accounts.
- First Person Credentials: issuers and relationship graph must remain honest.
- Telemetry attestors and jury must not fabricate or collude.
- Clock source for epoch boundary must be publicly checkable.

---

An unpublished change is not a change.
