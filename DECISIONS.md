# Decisions

What we chose where the build pack did not settle it, and why. Newest last.

| # | Date | Module | Decision | Why |
|---|---|---|---|---|
| D1 | 2026-11-25 | M00 | forge-std v1.9.7 and OpenZeppelin v5.1.0 as git submodules under `contracts/lib` | Pinned, reproducible in CI with `submodules: true` |
| D2 | 2026-11-25 | M00 | Workspace packages export their TypeScript source (`exports: ./src/index.ts`); no build step for libraries | Vitest, tsc (Bundler resolution) and Vite read TS directly; one less thing to break |
| D3 | 2026-11-25 | M00 | Repo-local git identity uses the GitHub no-reply address | No machine-wide identity was configured; keeps the owner's email private |
