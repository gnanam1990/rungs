// `pnpm submission:fill`: reads /v1/stats and /v1/config once and writes docs/submission/writeup.md and x-thread.md
// from the pack's drafts. Reads SITE_URL and KEEPER_URL (defaults to SITE_URL). Mainnet only. Prints what is left to
// fill by hand. It never posts or submits anything: that stays with the owner.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { findBannedPhrases } from "@rungs/skill/lint";
import { type Stats, fillTemplate, liveValues } from "./fill";

const root = new URL("../../../", import.meta.url);
const site = process.env.SITE_URL ?? "";
const keeper = (process.env.KEEPER_URL || site).replace(/\/+$/, "");
if (!site) {
  console.error("Set SITE_URL to the live site (and KEEPER_URL if the keeper is elsewhere).");
  process.exit(1);
}

const get = async (path: string) => {
  const r = await fetch(`${keeper}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (r.status !== 200) throw new Error(`${path} answered ${r.status}`);
  return r.json();
};
const [stats, config] = (await Promise.all([get("/v1/stats"), get("/v1/config")])) as [
  Stats,
  { chainId: number; pool: string | null; repo: string },
];
if (config.chainId !== 56 || !config.pool) {
  console.error(`The keeper is on chain ${config.chainId} with pool ${config.pool}: fill only from mainnet.`);
  process.exit(1);
}

const live = liveValues(site, stats, { pool: config.pool, repo: config.repo });
mkdirSync(new URL("docs/submission/", root), { recursive: true });
let problems = 0;
for (const [from, to] of [
  ["writeup-draft.md", "writeup.md"],
  ["x-thread-draft.md", "x-thread.md"],
]) {
  const draft = readFileSync(new URL(`docs/build-pack/07-demo-and-submission/${from}`, root), "utf8");
  const { text, left } = fillTemplate(draft, live);
  const note = `<!-- Filled from ${keeper}/v1/stats at block ${live.block}. Team wallets excluded. Re-run before posting. -->\n`;
  writeFileSync(new URL(`docs/submission/${to}`, root), note + text);
  const banned = findBannedPhrases(text);
  if (banned.length) problems++;
  console.log(`docs/submission/${to}: block ${live.block}`);
  if (left.length) console.log(`  fill by hand: ${left.join(" ")}`);
  if (banned.length) console.log(`  banned phrases: ${banned.join(", ")}`);
}
process.exit(problems ? 1 : 0);
