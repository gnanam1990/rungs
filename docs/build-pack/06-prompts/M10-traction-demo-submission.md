# Prompt — M10 traction demo submission

Paste this into the build chat after the previous module's pull request is merged.

---

You are building Rungs (see `CLAUDE.md` and `docs/build-pack/README.md`). Work on **M10** only.

**Goal:** Get real holders, record the video, finish the README, submit and tag `v0.1.0`.

**1. Read first**
   - `docs/build-pack/05-modules/M10-traction-demo-submission.md` (the full spec for this module; follow it exactly)
   - `docs/build-pack/07-demo-and-submission/demo-script.md`
   - `docs/build-pack/07-demo-and-submission/video-storyboard.md`
   - `docs/build-pack/07-demo-and-submission/writeup-draft.md`
   - `docs/build-pack/07-demo-and-submission/x-thread-draft.md`
   - `docs/build-pack/07-demo-and-submission/submission-checklist.md`
   - `docs/build-pack/03-TEST-PLAN.md` (Demo acceptance run)
   - `DECISIONS.md` and `PROVEN.md` (what earlier modules decided and proved)

**2. Start clean**
   - `git checkout main && git pull`
   - Confirm the previous module is merged and CI on `main` is green. If not, stop and say so.
   - `git checkout -b m10-submission`

**3. Write the tests first**
   - The `pnpm check:submission` script.
   - Run them and confirm they fail for the right reason. Show the failing output.

**4. Implement**
   - Follow the module's steps and file list. Do not add features that are not in the spec.
   - Money logic: integers only (USDT has 18 decimals here), deterministic, no model output anywhere near an amount or a recipient.
   - Keep the ten red lines in `CLAUDE.md`. If a step seems to need breaking one, stop and ask.
   - Anything you must decide that the pack does not settle: write it in `DECISIONS.md` with the reason.

**5. Run everything**
   - `pnpm lint && pnpm typecheck && pnpm test`
   - `forge fmt --check && forge build && forge test` (when contracts exist)
   - Module-specific commands from the spec.
   - Append to `PROVEN.md`: commands, exit codes, test counts, and any transaction hashes.

**6. [HUMAN] steps in this module**
   - Posting on X, recording the video, filling and sending the form, the reward address.
   - Stop and ask at each one. Never work around a missing key, account, approval or App confirmation. Never ask for a seed phrase, private key, pairing code or QR.

**7. Ship it (mandatory flow)**
   - `git add -A && git commit -m "docs: README, submission, v0.1.0"`
   - `git push -u origin m10-submission`
   - `gh pr create --fill` and complete the template: what changed, tests run with counts, evidence, the module's Definition of Done as a checklist, red lines touched.
   - `gh pr checks --watch` until every check is green. Fix and push if red. Never merge on red.
   - `gh pr diff` and review it yourself against the Definition of Done in the spec. List anything not met.
   - `gh pr merge --squash --delete-branch`
   - `git checkout main && git pull`

**8. Report**
   - The Definition of Done as a ticked checklist, with proof for each line.
   - What is not done or not proven, plainly.
   - What you need from me before the next module.

Do not start the next module.
