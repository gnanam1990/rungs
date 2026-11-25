# M10 — Traction, demo and submission

## Goal
Real holders using it, a clear 3-minute video, and a complete submission before **2026-12-08 18:00 UTC**.

## Traction (honest methods only)
- The one-line offer: "Hold an Agent ID? Borrow 1 USDT on your name. Repay in a week and your limit doubles."
- [HUMAN] Posts on X from the owner's account using `07-demo-and-submission/x-thread-draft.md`, with `#BinanceWalletHackathon #AgenticWallet`, a daily number update taken from `/v1/stats`, and the copy-paste prompt as an image and as text.
- [HUMAN] Reply, with something useful, under holders who asked for credit on the ID and under entrants whose apps could use `RungsGate`.
- Never pay for interactions, never ask people to cycle loans, never run our own wallets to raise counts. Team wallets stay flagged.
- Watch the pool every day: if `idle` runs out, say so publicly rather than turning people away silently; raise through the timelock.
- Support: answer every "it failed" with the exact error meaning from the skill's table.

## Demo and submission
1. Run the demo acceptance run from `03-TEST-PLAN.md` on a clean phone and record it.
2. [HUMAN] Record the video following `07-demo-and-submission/demo-script.md` and `video-storyboard.md`.
3. Finish the README: what it is, live links, verified contract links, owner permissions, what is proven (with hashes), what is not, trust assumptions, known limits, risk notice, how numbers are computed.
4. [HUMAN] Fill the submission form using `07-demo-and-submission/submission-checklist.md` and `writeup-draft.md`. Include every contract address that received Agent ID interactions.
5. Tag `v0.1.0` and create the GitHub release with the addresses and the stats at that block.

## Tests first
A script `pnpm check:submission` that fails unless: the site and keeper answer; the contract is verified (BscScan API); the stats endpoint shows at least 30 distinct non-team holder addresses; the README has every required heading; no banned phrase appears in the repo's user-facing text.

## Definition of Done
- [ ] `pnpm check:submission` passes
- [ ] Video uploaded, link in the README
- [ ] Submission sent before the internal deadline; confirmation saved
- [ ] `v0.1.0` tagged and released

## Ship it
Branch `m10-submission` → local checks → pull request → checks green → self-review → squash merge → `git tag v0.1.0 && git push origin v0.1.0` → `gh release create v0.1.0`.
