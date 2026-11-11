# Security review, 11 Nov 2026

The written file `/workspace/audit/lgme-audit-2026-11-10.md` was not in this workspace. The Nov 10 health pass (`health3x`) and `npm audit` were rechecked against the current tree. The repository stays public.

## npm audit: 8 low findings, accepted

`npm audit` reports 8 low findings. All of them are the one advisory GHSA-848j-6mx2-7j84, "Elliptic Uses a Cryptographic Primitive with a Risky Implementation", pulled in by `@ethersproject/signing-key` through `@hashgraph/sdk` 2.81.0. That SDK version is the latest. `elliptic` 6.6.1 is also the latest, and the advisory range is every published version, so there is no safe upgrade or override. The app does not import `elliptic`. Forcing a newer SDK build is what npm suggests, and that does not remove the package. Critical and high findings were already cleared by the `@grpc/grpc-js` 1.14.7 and `protobufjs` 8.8.1 overrides.

## Nov 10 health lows, rechecked

- L1, trainer confirmation erased by render: fixed. The status is sticky and applied again after render.
- L2, fixed attestation suggestion: fixed. The suggestion comes from `suggestThird`.
- L3, environment variable names in member copy: fixed. Help and the email screen no longer print those names.
- L4, `/src` served source: fixed. `src` is in `.vercelignore`, and `https://lgme.app/src` returns 404.
- L5, health-data notice missed the 18+ line: fixed. The notice says adults 18 and older, and that collect and share are separate.
- L6, older unit-test failures: not re-run as a full historical bisect. The overview, price, and mainnet-prep tests pass on this tree.

## Secrets

A scan of the worktree and history for private-key blocks, live Stripe keys, Slack tokens, and Resend-style keys found none. Strings matching an AWS access-key shape appear inside `js/vendor/web-llm.mjs` and are fragments of vendored model bytes, not credentials. No secret values were printed.
