# Sovereign Provenance Protocol (SPP)
## Technical Architecture, Constitutional Accounting Machine, and Working Implementation Specification
### Synthesized from the foundational grammar of lgme.app and egonomicanonymous.live

## 1. Executive Summary & Diagnostic Framework

Modern macroeconomic systems organize institutional privileges across two dominant tiers:

* **The First Seat (The State):** Maintains a monopoly over legal tender minting, sovereign debt issuance, and involuntary taxation. It possesses the statutory authority to run structural deficits and socialize long-tail liability.
* **The Second Seat (The Firm):** Originates commercial debt and fractional credit instruments protected by statutory limited liability. It captures leveraged upside while shifting tail-risk, defaults, and unhedged balance-sheet contractions into public backstops.
* **The Third Seat (The Person):** Systematically relegated to an unhedged, passive absorption buffer. The Third Seat bears currency debasement, asset-price inflation, unbacked systemic debt rollovers, opaque bank bail-ins, and asymmetric accounting adjustments.

The Sovereign Provenance Protocol (SPP) is an opt-in constitutional accounting machine and game-theoretic discipline grounded in Thomas Schelling’s self-command/precommitment frameworks. It removes systemic moral hazard by replacing human administrative discretion with deterministic state transitions.

```
       +-------------------------------------------------------+
       |                  THE THREE SEATS                      |
       |   [Seat 1: State]    [Seat 2: Firm]   [Seat 3: Person]|
       +-------------------------------------------------------+
                                  |
                         Verified & Bounded By
                                  v
       +-------------------------------------------------------+
       |            THE 9-STAGE CANONICAL ORDER                |
       |  Floor -> Mint -> Issue -> Tape -> Charge ->          |
       |          Agent -> Thin -> Desert -> Retire            |
       +-------------------------------------------------------+
                                  |
                         State Transitions Onto
                                  v
       +-------------------------------------------------------+
       |             SOVEREIGN PROVENANCE LEDGER               |
       |       Cryptographic Tape | Non-Zero Refusal           |
       +-------------------------------------------------------+
```

### The Foundational Axiom

> "They printed the money. I am keeping the book."

Within the Sovereign Provenance Protocol, sovereignty is neither territorial conquest, speculative token issuance, nor off-grid isolation. Sovereignty is defined as the deterministic mechanical refusal of any ledger line, settlement entry, or debt rollover that skips the canonical order or fails cryptographic verification on the public tape.

## 2. Invariant Rules of the Ledger

| Invariant Principle | Functional Definition | System Constraint |
|---|---|---|
| 1. Floor Seniority | Subsistence/resilience capital (B^*) is the absolute senior claimant on all realized gross inflows. | F_t cannot be subordinated, levered, attached, or encumbered for debt service or discretionary expansion. |
| 2. Constitutive Tape | State changes exist solely through chronological cryptographic publication. | Any mandate, transaction, or credit claim not verified on the public tape is null, void, and non-binding. |
| 3. Non-Par Realism | Credit obligations are never treated as cash money at par (1.00 ≠ $1.00). | Every obligation must trade at an explicit discount vector: triad ⟨F, d(t), τ⟩. |
| 4. The Schelling Barrier | Precommitment rules replace human administrative discretion. | System agents act strictly as non-discretionary automata clerks without state-mint authority. |
| 5. Third Seat Refusal | Inalienable client-side verification and block-rejection authority. | Seat 3 clients automatically prune or reject any ledger block that breaches the 9-stage sequence. |

## 3. Mathematical Specification of the 9-Stage Canonical Order

Let the system epoch be indexed by discrete time \( t \in \mathbb{N} \). Realized gross external settlement inflows arriving at the gateway are defined as \( Y_t \in \mathbb{R}_{\ge 0} \).

### Stage 1: Floor (\(\mathcal{F}\))

The subsistence baseline basket \( B^* \) constitutes the invariant foundation. Realized gross inflows must fund the Floor before any surplus can exist:

\[
F_t = \min(Y_t, B^*)
\]

Realized surplus available for downstream economic allocation is strictly:

\[
S_t = \max(0, Y_t - B^*)
\]

**Protocol Rule:** If \( S_t = 0 \), all downstream stages immediately halt execution. Discretionary budgets, credit issuance, and dividend allocations collapse to zero.

### Stage 2: Mint (\(\mathcal{M}\))

Protocol base units \( M_t \) cannot be created arbitrarily. Expansion is mathematically coupled to real surplus and hard cap constraints:

\[
M_t \le \kappa \cdot S_t
\]

where \( \kappa \in (0, 1) \) represents the maximum permissible reserve fractionalization coefficient. Dark credit lines, off-balance facilities, and synthetic reserve creation are computationally invalid.

### Stage 3: Issue (\(\mathcal{I}\))

Credit represents a dated promise, not immediate cash. An obligation \( k \) is valid only as a 4-tuple:

* \( H_k \): Cryptographically verified holder Decentralized Identifier (DID).
* \( F_k \in \mathbb{R}_{> 0} \): Nominal face value of the claim at maturity.
* \( d_k(t) \in [0, 1) \): Live real-time market discount rate reflecting counterparty risk.
* \( \tau_k \in \mathbb{N} \): Strict terminal maturity epoch (\( \tau_k > t \)).

The marked spot settlement value is:

\[
V_k(t) = F_k \cdot (1 - d_k(t))
\]

### Stage 4: Tape (\(\mathcal{T}\))

Every state change \( \mathbf{e}_t \) is committed to an immutable, append-only Merkle-linked consensus ledger:

\[
H_t = \mathcal{H}(H_{t-1} \| \mathbf{e}_t \| \sigma_{\text{agent}})
\]

where \( \mathcal{H} \) is a SHA-256/Keccak-256 hashing primitive and \( \sigma_{\text{agent}} \) is the cryptographic signature of the executing clerk. A financial liability \( C \) holds legal validity under SPP if and only if:

\[
\exists \text{ verified path on Tape such that } C \text{ appears in sequence}
\]

### Stage 5: Charge (\(\mathcal{C}\))

Protocol overhead, clerk execution fees, and tail-risk transformation costs are deducted prior to residual income calculation:

\[
C_t = \text{fixed operational charges}
\]

Kickbacks, synthetic yields, regulatory fee deferrals, and retroactive exemptions are rejected by the protocol engine.

### Stage 6: Agent (\(\mathcal{A}\))

The operational agent \( \Phi \) functions strictly as a deterministic state-machine automaton:

\[
\Phi: \text{State}_t \to \text{State}_{t+1} \quad \text{with zero discretion}
\]

The Agent processes verified state transitions, transfers \( F_t \) to the Floor basket on schedule, flags out-of-order execution, and discards rolling debt lacking primary underwriting. The Agent possesses zero administrative discretion.

### Stage 7: Thin (\(\Theta\))

Market width \( \omega_t \) directly conveys real liquidity depth:

\[
\omega_t = \frac{\text{Bid-Ask Spread}}{\text{Volume}}
\]

Automated buybacks, wash-trading, and peg subsidization are strictly forbidden. If liquidity contracts, \( \omega_t \to \infty \) and Volume \( \to 0 \); the system exposes volatility rather than concealing systemic risk behind synthetic balance sheets.

### Stage 8: Desert (\(\mathcal{D}\))

Residual surplus \( D_t \) is titled directly to the specific productive participant:

\[
D_t = \max(0, S_t - C_t - \sum V_k)
\]

If \( D_t \le 0 \), the ledger writes \( D_t = 0 \). Deficits cannot be disguised as capital assets or absorbed into unbacked future liabilities.

### Stage 9: Retire (\(\mathcal{R}\))

Retirement permanently cancels outstanding debt obligations using realized positive desert:

\[
\text{Retire}_t = \min(\text{Outstanding Debt}, D_t)
\]

Rollovers are treated as net-new issuances requiring independent appraisal, discount pricing, and tape commitment. No debt instrument may remain indefinitely unamortized.

## 4. System Layer Architecture

```
+--------------------------------------------------------------------------+
| Layer 7: Application Interface (lgme.app Web Client / Verification GUI) |
+--------------------------------------------------------------------------+
| Layer 6: Audit & Refusal Engine (Client-Side Third Seat Edge Validator)  |
+--------------------------------------------------------------------------+
| Layer 5: Provenance & Accord (SP Passport & Machine-Executable Accords)  |
+--------------------------------------------------------------------------+
| Layer 4: Execution Engine (SP Agent: Deterministic Order Automaton)      |
+--------------------------------------------------------------------------+
| Layer 3: Accounting Gate (Floor Seniority Enforcer & Sequencer)         |
+--------------------------------------------------------------------------+
| Layer 2: Identity & Cryptographic Seals (W3C DIDs & Merkle Lineage Trees)|
+--------------------------------------------------------------------------+
| Layer 1: Consensus Tape (Append-Only Public Mirror / Hedera HCS Log)     |
+--------------------------------------------------------------------------+
```

### Protocol Components

* **SP Identity & Attestation:** Employs W3C Decentralized Identifiers (did:spp:state, did:spp:firm, did:spp:person). Enforces a dual-key structure separating administrative publication keys from settlement authority keys.
* **SP Seal & Fragment Lineage:** Deconstructs claims, invoices, and obligations into cryptographically linked atomic units.
* **SP Passport:** Structured state certificate asserting provenance, allocation proofs, and sequence integrity:

```json
{
  "$schema": "https://spp.network/schemas/v1/passport.json",
  "passport_id": "urn:spp:pass:77902a-c8e1",
  "origin_anchor": "0x8f2d5a391bc44b827e6d9e11045a2789f5bc3",
  "seat_type": "ThirdSeat",
  "order_phase": "Floor_Verified",
  "metrics": {
    "gross_inflow": 25000.00,
    "floor_allocated": 14700.00,
    "surplus_available": 10300.00
  },
  "issue_spec": {
    "issuer_did": "did:spp:firm:alpha-logistics",
    "face_nominal": 10000.00,
    "discount_bps": 650,
    "maturity_epoch": 1893456000
  },
  "tape_sequence_index": 481092,
  "agent_signature": "0x33b1e84fc90192a5...77c8e9b01"
}
```

* **SP Accord:** Machine-executable constraints governing asset transfers, debt cancellation mechanics, and operational boundaries. Rejects any attempt to settle claims using unbacked equity or junior capital reserves.

## 5. State Machine Transition Engine

```
               State: INFLOW ARRIVAL (Gross Yield Y_t)
                                 |
                                 v
                     [Condition: Y_t >= Floor B*?]
                      /                         \
           NO: Unmet /                           \ YES: Met
                    v                             v
           [HALT: Deficit Locked]        [STAGE 1: Floor Locked (F_t)]
           (Surplus S_t = 0.00)                   |
           (Desert D_t = 0.00)           [STAGE 2: Surplus Mint Cap]
           (Halt Discretionary)                   |
                                         [STAGE 3: Non-Par Issue]
                                                  |
                                         [STAGE 4: Tape Merkle Push]
                                                  |
                                         [STAGE 5: Upfront Charges]
                                                  |
                                         [STAGE 6: Agent Verification]
                                           /                       \
                                FAIL: Out-of-Order        PASS: In-Sequence
                                         /                           \
                                        v                             v
                                [PRUNE & REFUSE]            [STAGE 7: Thin Width]
                                                                      |
                                                            [STAGE 8: Titled Desert]
                                                                      |
                                                            [STAGE 9: Debt Retire]
```

### Reference Implementation

```python
"""
Sovereign Provenance Protocol (SPP) Engine
Core State Transition Module
"""

from dataclasses import dataclass
from typing import Optional
import hashlib
import time

@dataclass(frozen=True)
class IssueSpec:
    issuer_did: str
    face_nominal: float
    discount_bps: int
    maturity_epoch: int

    def mark_value(self) -> float:
        discount_rate = self.discount_bps / 10000.0
        return self.face_nominal * (1.0 - discount_rate)

@dataclass(frozen=True)
class StateReceipt:
    epoch: int
    floor_funded: float
    surplus_realized: float
    charges_settled: float
    titled_desert: float
    tape_hash: str
    status: str

class SovereignProvenanceEngine:
    def __init__(self, floor_baseline: float, previous_hash: str = "0" * 64):
        self.floor_baseline = floor_baseline
        self.previous_hash = previous_hash
        self.sequence_index = 0

    def process_epoch(
        self,
        gross_inflow: float,
        current_epoch: int,
        active_issue: Optional[IssueSpec] = None,
        operational_charges: float = 0.0
    ) -> StateReceipt:
        self.sequence_index += 1

        # STAGE 1: Floor Seniority Verification
        if gross_inflow < self.floor_baseline:
            floor_funded = gross_inflow
            surplus = 0.0
            status = "HALT_DEFICIT_FLOOR_SENIORITY_UNMET"
            return self._commit_tape(current_epoch, floor_funded, surplus, 0.0, 0.0, status)

        floor_funded = self.floor_baseline
        surplus = gross_inflow - self.floor_baseline

        # STAGE 3: Non-Par Issue Evaluation
        issue_obligation = 0.0
        if active_issue:
            assert active_issue.discount_bps >= 0, "Negative discount prohibited"
            assert active_issue.maturity_epoch > current_epoch, "Maturity must be future-dated"
            assert active_issue.face_nominal > 0, "Nominal face value must be positive"
            issue_obligation = active_issue.mark_value()

        # STAGE 5: Charge Settlement
        charges_settled = operational_charges

        # STAGE 8 & 9: Titled Desert & Debt Retirement
        net_residual = surplus - charges_settled - issue_obligation
        titled_desert = max(0.0, net_residual)
        status = "OPERATIONAL_SETTLEMENT_COMMITTED"

        return self._commit_tape(
            current_epoch, floor_funded, surplus, charges_settled, titled_desert, status
        )

    def _commit_tape(
        self,
        epoch: int,
        floor: float,
        surplus: float,
        charges: float,
        desert: float,
        status: str
    ) -> StateReceipt:
        payload = f"{self.sequence_index}|{epoch}|{floor:.4f}|{surplus:.4f}|{charges:.4f}|{desert:.4f}|{status}"
        commit_hash = hashlib.sha256(f"{self.previous_hash}{payload}".encode("utf-8")).hexdigest()
        self.previous_hash = commit_hash

        return StateReceipt(
            epoch=epoch,
            floor_funded=floor,
            surplus_realized=surplus,
            charges_settled=charges,
            titled_desert=desert,
            tape_hash=commit_hash,
            status=status
        )
```

## 6. Implementation & Operational Rollout

```
+--------------------------------------------------------------------------+
| PHASE 1: LOCAL RUNTIME & DUAL-BOOK ACCOUNTING                            |
| Target: Individual Enterprises, Cooperatives, Local Balance Sheets       |
| Actions: Deploy lgme.app client; establish floor baskets; mandate        |
|          cryptographic publishing of state lines to an immutable tape;   |
|          verify floor allocations before authorizing credit lines.       |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| PHASE 2: CONSENSUS RAILS & COMMERCIAL PAPER AUDITING                     |
| Target: Inter-Firm B2B Settlement & Distributed Supply Chains            |
| Actions: Network Guardian Nodes; mandate (F, d, tau) pricing triads on  |
|          all receivables; eliminate par-clearing assumptions; enforce     |
|          client-side Third Seat validation rules in browser runtime.     |
+--------------------------------------------------------------------------+
                                    |
                                    v
+--------------------------------------------------------------------------+
| PHASE 3: MACROECONOMIC INTERACTION & ASYMMETRIC DISCIPLINE               |
| Target: Cross-Border Trade & Sovereign State Gateways                    |
| Actions: Interlink protocol tape with public institutional systems;      |
|          route positive desert strictly to debt cancellation; enforce    |
|          zero-desert caps to prevent synthetic budget deficits.           |
+--------------------------------------------------------------------------+
```

* **Phase 1 (Dual-Book Deployment):** Deploy lgme.app as a local, client-side mirror. Run the 9-stage sequence on single balance sheets (enterprises, farms, producer cooperatives). Senior Floor reserves must be cryptographically recorded to the public tape before any credit is extended.
* **Phase 2 (Consensus Rails):** Interconnect enterprise nodes across distributed networks. Enforce non-par trade finance settlement where invoices clear solely at real-time market discount rates \( d_k(t) \). The Third Seat validation client runs locally in browser sandboxes, automatically rejecting transactions that bypass Floor seniority.
* **Phase 3 (Macroeconomic Interaction):** Link positive residual desert directly to systemic debt retirement. If an accounting cycle produces no surplus, the ledger commits \( D_t = 0 \). The creation of synthetic reserves to balance deficits is computationally barred. Provenance is enforced across all participants, ensuring unbacked liabilities are refused at the edge.
