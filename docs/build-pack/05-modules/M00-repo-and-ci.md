# M00 — Repo and CI

## Goal
A public repo with a working monorepo skeleton, CI on every pull request, and a protected `main`.

## Steps
1. [HUMAN] Confirm `gh auth status` shows `gnanam1990`.
2. `gh repo create gnanam1990/rungs --public --description "A credit ladder on the Agent ID" --clone`.
3. Put this pack at `docs/build-pack/`, copy `CLAUDE.md` to the root.
4. Create the workspace: `package.json` (private, `packageManager` pinned), `pnpm-workspace.yaml` (`packages/*`, `apps/*`), `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), `biome.json`, `.gitignore` (`.env`, `node_modules`, `out`, `cache`, `broadcast/**/dry-run`, `*.sqlite`, `dist`), `.nvmrc` (22).
5. `forge init contracts --no-git --no-commit`; `foundry.toml`: `solc = "0.8.26"`, `optimizer = true`, `optimizer_runs = 200`, `fs_permissions` read for `../docs/build-pack/08-reference/schemas`, `[invariant] runs = 256, depth = 100`. Install OpenZeppelin 5 and forge-std.
6. Empty packages with one passing test each: `packages/core`, `packages/chain`, `packages/skill`, `apps/keeper`, `apps/web`.
7. Root scripts: `lint`, `typecheck`, `test`, `build`, `e2e`.
8. `.github/workflows/ci.yml`: on pull requests and `main`; jobs `ts` (install, lint, typecheck, test) and `sol` (`forge fmt --check`, `forge build --sizes`, `forge test`). Fork tests are skipped unless `BSC_RPC_URL` is set.
9. `.github/pull_request_template.md`: What changed · Tests run (commands and counts) · Evidence (hashes, screenshots) · Definition of Done checklist · Red lines touched.
10. `README.md` (short, with the honesty headings empty but present), `DECISIONS.md`, `PROVEN.md`, `SECURITY.md`, `LICENSE` (MIT).
11. Push the first commit to `main` once (the only direct push ever), then protect `main`: require a pull request and the `ts` and `sol` checks (`gh api -X PUT repos/gnanam1990/rungs/branches/main/protection ...`).

## Tests first
One trivial test per package, and `forge test` on an empty `Sanity.t.sol`. CI must be green on a pull request that only edits the README.

## Definition of Done
- [ ] Repo public, `main` protected, CI green on a pull request
- [ ] `pnpm lint && pnpm typecheck && pnpm test && forge test` pass locally
- [ ] Pack present at `docs/build-pack/`, `CLAUDE.md` at the root
- [ ] `PROVEN.md` has the commands and results

## Ship it
The skeleton lands as the first commit. Then branch `m00-ci-proof` → a small README edit → `gh pr create` → `gh pr checks --watch` → `gh pr merge --squash --delete-branch`, to prove the flow.
