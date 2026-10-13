# SoverX — LGME for Sovereigns

**Status:** Trial under lgme.app. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026  
**Icon:** Egonomic Anonymous / #legomiego coin (second image)

---

## Disclaimer — trial only

SoverX is a temporary educational trial under lgme.app. It does not issue real $lgme, does not move real value, and does not constitute an enrollment, claim, or vote under the protocol. Completions are mock records only. The 1 $lgme reward is simulated for learning. Real rewards, if any, require a future published amendment and Floor-compliant accounting. An unpublished change is not a change.

---

## Purpose

An educational agent app that walks a person through the third-seat role on lgme.app. It accepts varied inputs (acts, receipts, contracts, promises, claims, refusals), shows clear dashboards, explains each step in plain language, and records successful cycles on the tape. Each completed cycle that meets the public criteria receives 1 $lgme, contributing to the Floor and development.

SoverX is “LGME for dummies” made practical: the person keeps the book by seeing what must be shown. It runs as a trial under lgme.app.

---

## Core inputs (varied and easy)

The agent accepts any of the following, each with a short comment field the user can share:

| Input type | Minimal required pieces | Comment example |
|------------|-------------------------|-----------------|
| Act | What was done, timestamp, signed message | “Recorded a public promise” |
| Receipt | Amount, counterparty, reference | “Received Floor share” |
| Contract | Parties, terms summary, link or hash | “Named residual before close” |
| Promise | Future commitment, conditions | “Will not widen the spread” |
| Claim | Observation ID or utility reference | “Claimed under attested schema” |
| Refusal | Line that was rejected and why | “Refused private mint window” |

Each input produces a showable tape entry. The comment is optional but encouraged for forum discussion.

---

## Walkthrough and dashboard

1. User starts a cycle and chooses an input type.
2. Agent explains the relevant order (Floor first, public mint, named charge, tape required).
3. User supplies the minimal attested pieces.
4. Dashboard shows:
   - What is public
   - What is residual (including zero)
   - What the Floor requires
   - Whether the line would be refused
5. On success the cycle is recorded and 1 $lgme is allocated (Floor-constrained).

---

## Reward rule

- Fixed: 1 $lgme per successful completed cycle.
- Paid only after Floor seniority is satisfied in the same cycle or from pre-named surplus.
- The reward itself is written to the tape (recipient, cycle ID, rule reference).
- No private path. Same rules bind the agent.

---

## Sharing and forum

Completed cycles (with the user’s comment) can be shared as a public link or tape reference for discussion. The share contains only what is already showable. An unpublished comment is not a comment.

---

## Data for improvement

Store only:
- Which steps are completed or abandoned
- Which explanations reduce incomplete cycles
- Which input patterns succeed

No private keys. Prefer public or hashed identifiers.

---

## Residual trust

- The agent must not invent completions or signatures.
- Reward allocation must follow the published Floor rule.
- Comments are user-supplied and may be wrong; the tape remains the source of truth.

---

## Revisit at next milestone

- Define exact signed-message format for a cycle completion.
- Specify dashboard fields in code.
- Confirm reward accounting against the Floor.
- Inscribe this note once the trial is locked.

An unpublished change is not a change.
