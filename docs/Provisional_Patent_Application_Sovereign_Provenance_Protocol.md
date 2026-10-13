# US Provisional Patent Application

**Title of Invention:** Sovereign Provenance Protocol for Multi-Seat Governance with Constitutive Public Tape, Floor Seniority, and Residual Titling

**Applicant / Inventor:** [To be completed by filer]

**Correspondence Address:** [To be completed]

**Filing Date:** [Date of filing]

---

**Disclaimer:** This document is a technical draft prepared for discussion. It is not legal advice. Patentability, claim scope, prior art, and formal filing requirements must be evaluated by a registered patent attorney or agent. An unpublished change is not a change.

---

## Field of the Invention

The invention relates to decentralized governance systems, specifically a protocol for multi-seat authority in which a public constitutive tape records all material acts, a Floor is paid first from named surplus, residual is titled (including zero), and private or unpublished changes write nothing. The protocol binds state, firm, and person under the same rules and enables third-seat refusal of any line that cannot be shown.

## Background of the Invention

Existing governance and token systems frequently permit private mint windows, redefinition of residual after the fact, and unverifiable claims of utility or personhood. These create opportunities for extraction by present selves against future selves or other seats. Prior approaches lack a constitutive public tape that treats unpublished changes as non-events, mechanical Floor seniority, and explicit residual titling including zero. Temporary credentials such as verified social handles have been used without residual-trust disclosure. The present invention addresses these deficiencies by combining precommitment barriers, public tape, attested inputs, and epoch-aware accounting.

## Summary of the Invention

The Sovereign Provenance Protocol provides:
1. A constitutive public tape (implemented via Hedera Consensus Service HCS-1 inscriptions and signed messages) in which every material act must be shown.
2. Floor seniority: named surplus pays the Floor Basket first; residual is titled thereafter, including zero.
3. Public mint schedule only; private mint windows write nothing.
4. Third-seat role: the person may refuse any line that skipped the order or cannot be shown.
5. Temporary pilot credentials (verified X-handle linked by signed message) with explicit residual-trust disclosure and revisit requirement.
6. Target mechanisms including true quadratic cost with fixed monthly budget, attested utility telemetry (signed observations only), and epoch-based full reset.
7. Accounting guards: zero-division protection, unit consistency, epoch-aware claims, and rejection of caller-supplied utility values.
8. Educational trial agent (SoverX) that walks users through inputs and produces mock tape entries under the same rules.

An unpublished change is not a change. Same rules bind all three seats.

## Detailed Description of the Invention

### Constitutive Tape
All material acts (title, mint, lien, conversion, agent action, enrollment, claim, residual definition) are recorded on a public ordered tape. Preferred embodiment uses Hedera HCS-1 topics (no admin key) with HRL references of the form hcs://1/<topic-id>. Signed messages link wallets to temporary credentials. The tape is constitutive: an act not shown on the tape has no effect.

### Floor Seniority and Residual Titling
From named surplus the Floor Basket is paid first. Only thereafter is residual determined and titled. Residual may be zero and is still titled. Instant Floor change or residual redefinition without prior public naming writes nothing.

### Order of Operations
1. Floor paid first from named surplus.
2. Mint on public schedule only.
3. Issue of named credit.
4. Tape record of the act.
5. Charge (discount and risk) named before residual.
6. Agent acts as clerk only; does not mint.
7. Thin information preserved; no invented tight price.
8. Remainder titled, including zero.

### Temporary Enrollment Pilot
A verified X handle linked to a wallet by a signed message may be accepted as a soft enrollment signal for testing. The credential is explicitly not proof of unique personhood. Residual trust is recorded: one person may control multiple accounts; verification is a paid subscription. The credential is scheduled for revisit and replacement at the next milestone (preferred upgrade path: Hedera First Person Credentials or equivalent with zero-knowledge proofs).

### True Quadratic Cost (Target)
Fixed budget of voice credits per epoch (example: 3 per month). Cost of votes equals credits squared. Epoch length example: 30 days with full reset of scores and budget. Pilot may use temporary square-root form with explicit residual trust and revisit.

### Attested Utility Telemetry
Utility inputs accepted only from signed observations conforming to a published schema. Schema includes objectiveUtility, peerConsensusScore, source rules, and jury selection parameters. Caller-supplied values are rejected. Residual trust in attestors and jury is recorded.

### Accounting Guards
Implementation includes zero-division guards, unit consistency, epoch-aware last-claimed timestamps, and enforcement that utility derives only from attested inputs. Reference sketches and implementation outlines are recorded on the tape.

### Educational Trial Agent (SoverX)
A mock agent accepts varied inputs (acts, receipts, contracts, promises, claims, refusals) with optional comments. It displays a dashboard of public lines, residual, Floor acknowledgment, and refusal check. Successful mock cycles produce simulated 1-unit rewards under Floor constraints. Access may be gated by temporary X-handle confirmation. Data stored only for improvement of completion rates; no private keys. Explicit trial disclaimer.

### Barrier Checks
Cases including residual redefinition, off-schedule mint, instant Floor change, agent-originated value, single-seat exception, cycle shortening, and constitutive-tape bypass are closed by prior naming, default-closed silence, mechanical Floor seniority, seat symmetry, and slower recorded amendment. Nested commitment requires one full public cycle and second independent reading for amendment-path changes.

### Residual Trust Assumptions (Recorded)
- Temporary X-handle: multiple accounts possible.
- Personhood credentials: issuers and relationship graph must remain honest.
- Telemetry attestors and jury must not fabricate or collude.
- Clock source for epoch boundary must be publicly checkable.

## Preferred Embodiments and Examples

**Embodiment 1:** Public website (lgme.app) serving as front end; canonical inscriptions on Hedera HCS-1 topics serving as source of truth. Topic identifiers and HRLs recorded on the site.

**Embodiment 2:** Enrollment design note, public enrollment example, First Person Credentials evaluation, True Quadratic Cost note (budget 3), Attested Utility Telemetry Schema, Accounting Fixes Implementation Outline, Epoch Parameters, and Mock Second Test Comparison, each inscribed as separate topics.

**Embodiment 3:** SoverX trial mock application with X-handle toll gate, local browser storage of cycles, and numbered dashboard walkthrough.

**Embodiment 4:** Status snapshots and next-follow-up documents inscribed to preserve continuity of the public tape.

## Claims (Provisional — for discussion only)

1. A method of multi-seat governance comprising recording material acts on a constitutive public tape such that an unpublished change has no effect, paying a Floor Basket first from named surplus, and titling residual including zero.

2. The method of claim 1 wherein the tape is implemented via an ordered consensus service without administrative key.

3. The method of claim 1 further comprising accepting a temporary social-handle credential linked by signed message while recording residual trust and scheduling revisit.

4. The method of claim 1 further comprising accepting utility values only from attested signed observations conforming to a published schema.

5. The method of claim 1 further comprising applying a fixed-budget quadratic cost with epoch-based full reset.

6. A system comprising a public front end and a constitutive tape of inscriptions implementing the method of claim 1.

7. An educational agent that walks a user through the order of claim 1 and produces mock tape entries under Floor constraints.

## Abstract

A Sovereign Provenance Protocol records all material acts on a constitutive public tape so that unpublished changes write nothing. A Floor is paid first from named surplus; residual is titled including zero. Temporary credentials, attested utility, quadratic cost targets, and accounting guards are defined with explicit residual trust. An educational trial agent demonstrates the third-seat role. Same rules bind state, firm, and person.

---

**End of provisional draft.**

An unpublished change is not a change.
