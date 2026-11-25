# Prompt — M06 keeper

Paste this into the build chat after the previous module's pull request is merged.

---

You are building Rungs (see `CLAUDE.md` and `docs/build-pack/README.md`). Work on **M06** only.

**Goal:** Build the indexer and the read and calldata API.

**1. Read first**
   - `docs/build-pack/05-modules/M06-keeper.md` (the full spec for this module; follow it exactly)
   - `docs/build-pack/02-TDD.md` (section 6)
   - `docs/build-pack/03-TEST-PLAN.md` (M06)
   - `docs/build-pack/08-reference/schemas/line-response.schema.json`
   - `docs/build-pack/08-reference/schemas/action-response.schema.json`
   - `docs/build-pack/08-reference/schemas/stats-response.schema.json`
   - `docs/build-pack/08-reference/schemas/site-response.schema.json`
   - `docs/build-pack/08-reference/env.example`
   - `DECISIONS.md` and `PROVEN.md` (what earlier modules decided and proved)

**2. Start clean**
   - `git checkout main && git pull`
   - Confirm the previous module is merged and CI on `main` is green. If not, stop and say so.
   - `git checkout -b m06-keeper`

**3. Write the tests first**
   - T-S01 to T-S12.
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
   - Creating the hosting account and setting its environment variables.
   - Stop and ask at each one. Never work around a missing key, account, approval or App confirmation. Never ask for a seed phrase, private key, pairing code or QR.

**7. Ship it (mandatory flow)**
   - `git add -A && git commit -m "feat(keeper): indexer, read API and stats"`
   - `git push -u origin m06-keeper`
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
