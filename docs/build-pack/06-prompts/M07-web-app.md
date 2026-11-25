# Prompt — M07 web app

Paste this into the build chat after the previous module's pull request is merged.

---

You are building Rungs (see `CLAUDE.md` and `docs/build-pack/README.md`). Work on **M07** only.

**Goal:** Build the six routes in the Binance Wallet family theme, correct on a phone.

**0. Load the skill**
   - Load the owner's `web-app-shipping` skill (or read `docs/build-pack/08-reference/skills/web-app-shipping/SKILL.md` in full) before anything else. It is the frontend playbook for this module.

**1. Read first**
   - `docs/build-pack/05-modules/M07-web-app.md` (the full spec for this module; follow it exactly)
   - `docs/build-pack/08-reference/skills/web-app-shipping/SKILL.md`
   - `docs/build-pack/04-UIUX-SPEC.md`
   - `docs/build-pack/02-TDD.md` (section 8)
   - `docs/build-pack/03-TEST-PLAN.md` (M07)
   - `docs/build-pack/00-context/05-feasibility-and-gaps.md` (section 4)
   - `DECISIONS.md` and `PROVEN.md` (what earlier modules decided and proved)

**2. Start clean**
   - `git checkout main && git pull`
   - Confirm the previous module is merged and CI on `main` is green. If not, stop and say so.
   - `git checkout -b m07-web-app`

**3. Write the tests first**
   - T-W01 to T-W12, on both Playwright projects, with the API mocked.
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
   - Choosing the host and the domain, and sending the "List Your dApp" application.
   - Stop and ask at each one. Never work around a missing key, account, approval or App confirmation. Never ask for a seed phrase, private key, pairing code or QR.

**7. Ship it (mandatory flow)**
   - `git add -A && git commit -m "feat(web): six routes, phone-first, server-decided mode"`
   - `git push -u origin m07-web-app`
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
