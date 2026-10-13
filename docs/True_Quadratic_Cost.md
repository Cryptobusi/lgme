# True Quadratic Cost

**Status:** Design sketch. Temporary. Revisit at next milestone.  
**Date:** 13 October 2026

---

## Purpose

The current pilot uses the simplest square-root form `V = √C`. A true quadratic cost requires a fixed voice-credit budget per person per epoch, where the cost of casting `C` credits is `C²` and the remaining budget cannot be reused.

---

## Target formula

For each enrolled person `i` in an epoch:

- Fixed voice-credit budget `B_i` = **3** per month (equal for all enrolled persons).
- Credits spent on a vote: `C_i` where `0 ≤ C_i ≤ √3` (maximum whole credits = 1).
- Cost: `C_i²` deducted from `B_i`.
- Voting power: `V_i = C_i`.

The personhood gate (`δ_i`) still applies. Unenrolled or expired persons contribute zero.

With a budget of 3:
- 1 credit costs 1 and yields voting power 1.
- 2 credits would cost 4 (exceeds budget).
- Therefore the practical maximum per vote is 1 credit (voting power 1) until the budget is raised.

---

## Layman example

Imagine a small community deciding whether to fund a shared tool.

- 10 people are enrolled.
- Each receives a budget of **3** voice credits for the month.
- Cost is the square of the credits spent.

What each person can do:
- Spend 1 credit → costs 1 → voting power of 1.
- Cannot spend 2 credits (would cost 4, which exceeds the budget of 3).

Alice wants the tool and spends her 1 available credit (cost 1, power 1).  
Bob is opposed and also spends 1 credit (cost 1, power 1 against).  
Neither can buy extra influence inside the month because the budget does not allow a second credit.  
At month end the remaining budget resets to 3 for the next epoch.

This is stronger than the current pilot formula, which has no fixed budget that runs out.

---

## Open parameters (must be fixed)

| Parameter | Current setting | Notes |
|-----------|-----------------|-------|
| Budget size | **3** per enrolled person per month | Fixed for this sketch |
| Payment medium | Voice credits only (not tokens) | Prevents wealth amplification |
| Epoch reset | Full reset of remaining budget at epoch boundary | Aligns with score decay note |
| Cost display | Cost shown before confirmation | Public and showable |
| Voting-power convention | `V_i = C_i` | Temporary |

---

## Relation to current pilot

The simplest form (`V = √C`) remains in use for the pilot only. It does not enforce a fixed budget or quadratic cost. Both the credential and the formula are marked temporary.

---

## Revisit at next milestone

- Confirm or raise the budget of 3 if stronger differentiation is desired.
- Confirm the exact voting-power convention.
- Specify how remaining budget is shown on the tape.
- Inscribe this note once the parameters are locked.

An unpublished change is not a change.
