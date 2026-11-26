// The checks behind `pnpm check:submission` (M10 "Tests first"). Each check is a small function over fetched text,
// so the tests run offline with a fake fetch. Nothing here signs, sends or stores anything.

import { findBannedPhrases } from "@rungs/skill/lint";

export interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

/** The part of fetch the checks use, so tests can pass a fake. */
export type Fetcher = (url: string) => Promise<{ status: number; text: () => Promise<string> }>;

/** The pack's bar for the submission: distinct Agent ID addresses that used Rungs, team wallets excluded. */
export const MIN_HOLDERS = 30;

/** Headings the README must have (CLAUDE.md "Project README must include" and M10 step 3). */
export const README_HEADINGS = [
  "What is live",
  "What is not live",
  "Owner permissions",
  "Trust assumptions",
  "Known limits",
  "Risk notice",
  "Where each number on the stats page comes from",
  "What is proven",
  "Demo video",
];

/** Text a user, a judge or an agent reads. Checked for banned phrases (red line 7). */
export const USER_FACING_FILES = [
  "README.md",
  "SECURITY.md",
  "OWNER-PERMISSIONS.md",
  "docs/INTEGRATE.md",
  "packages/skill/SKILL.md",
  "packages/skill/llms.txt.tmpl",
  "packages/skill/prompts/open.md",
  "packages/skill/prompts/draw.md",
  "packages/skill/prompts/repay.md",
  "packages/skill/prompts/vouch.md",
  "apps/web/src/strings.ts",
];

const base = (u: string) => u.trim().replace(/\/+$/, "");
const pass = (name: string, detail: string): Result => ({ name, ok: true, detail });
const fail = (name: string, detail: string): Result => ({ name, ok: false, detail });

async function get(fetcher: Fetcher, url: string): Promise<{ status: number; body: string }> {
  try {
    const r = await fetcher(url);
    return { status: r.status, body: await r.text() };
  } catch {
    return { status: 0, body: "" };
  }
}

/** Red line 5: no "binance" or "bnb" in the domain. A live site is served over https. */
export function checkDomain(siteUrl: string): Result {
  let u: URL;
  try {
    u = new URL(siteUrl);
  } catch {
    return fail("domain", "set SITE_URL to the live site, e.g. https://example.xyz");
  }
  if (u.protocol !== "https:") return fail("domain", `${u.host} is not served over https`);
  if (/binance|bnb/i.test(u.hostname)) return fail("domain", `${u.hostname} contains "binance" or "bnb"`);
  return pass("domain", u.hostname);
}

/** The page, a page route, /llms.txt and /skill.md all load. */
export async function checkSite(fetcher: Fetcher, siteUrl: string): Promise<Result> {
  const b = base(siteUrl);
  const broken: string[] = [];
  for (const [path, must] of [
    ["/", 'id="root"'],
    ["/open", 'id="root"'],
    ["/llms.txt", "Rungs"],
    ["/skill.md", "Rungs"],
  ] as const) {
    const r = await get(fetcher, `${b}${path}`);
    if (r.status !== 200 || !r.body.includes(must)) broken.push(`${path} (${r.status || "no answer"})`);
  }
  return broken.length
    ? fail("site", `did not load: ${broken.join(", ")}`)
    : pass("site", "page, /open, /llms.txt, /skill.md");
}

/** The keeper answers for BNB Chain mainnet and knows the pool. Returns the pool for the next checks. */
export async function checkKeeper(
  fetcher: Fetcher,
  keeperUrl: string,
): Promise<Result & { pool: string | null }> {
  const r = await get(fetcher, `${base(keeperUrl)}/v1/config`);
  if (r.status !== 200)
    return { ...fail("keeper", `/v1/config answered ${r.status || "nothing"}`), pool: null };
  let cfg: { chainId?: number; pool?: string | null };
  try {
    cfg = JSON.parse(r.body);
  } catch {
    return { ...fail("keeper", "/v1/config is not JSON"), pool: null };
  }
  if (cfg.chainId !== 56) return { ...fail("keeper", `chain ${cfg.chainId}, expected 56`), pool: null };
  if (!cfg.pool || !/^0x[0-9a-fA-F]{40}$/.test(cfg.pool))
    return { ...fail("keeper", "no pool address yet"), pool: null };
  return { ...pass("keeper", `chain 56, pool ${cfg.pool}`), pool: cfg.pool };
}

/** RungsPool's source is published on BscScan (Etherscan V2 API, chain 56). The key is never printed. */
export async function checkVerified(fetcher: Fetcher, apiKey: string, pool: string | null): Promise<Result> {
  if (!pool) return fail("verified", "no pool address to look up");
  if (!apiKey) return fail("verified", "set BSCSCAN_API_KEY (read-only use)");
  const url = `https://api.etherscan.io/v2/api?chainid=56&module=contract&action=getsourcecode&address=${pool}&apikey=${apiKey}`;
  const r = await get(fetcher, url);
  if (r.status !== 200) return fail("verified", `BscScan answered ${r.status || "nothing"}`);
  try {
    const item = (JSON.parse(r.body) as { result?: { SourceCode?: string; ContractName?: string }[] })
      .result?.[0];
    if (!item?.SourceCode) return fail("verified", `${pool} has no published source`);
    if (item.ContractName !== "RungsPool")
      return fail("verified", `${pool} is ${item.ContractName}, not RungsPool`);
    return pass("verified", `RungsPool source published for ${pool}`);
  } catch {
    return fail("verified", "BscScan answer was not JSON");
  }
}

/** At least MIN_HOLDERS distinct Agent ID addresses used Rungs, team wallets excluded (/v1/stats). */
export async function checkHolders(fetcher: Fetcher, keeperUrl: string): Promise<Result> {
  const r = await get(fetcher, `${base(keeperUrl)}/v1/stats`);
  if (r.status !== 200) return fail("holders", `/v1/stats answered ${r.status || "nothing"}`);
  try {
    const n = (JSON.parse(r.body) as { excludingTeam?: { holders?: number } }).excludingTeam?.holders ?? 0;
    return n >= MIN_HOLDERS
      ? pass("holders", `${n} holders, team excluded`)
      : fail("holders", `${n} of ${MIN_HOLDERS} holders, team excluded`);
  } catch {
    return fail("holders", "/v1/stats is not JSON");
  }
}

/** Every required heading is a "## " heading in the README. */
export function checkReadme(readme: string): Result {
  const have = new Set(
    readme
      .split(/\r?\n/)
      .filter((l) => l.startsWith("## "))
      .map((l) => l.slice(3).trim()),
  );
  const missing = README_HEADINGS.filter((h) => !have.has(h));
  return missing.length
    ? fail("readme", `missing: ${missing.join(", ")}`)
    : pass("readme", "every heading present");
}

/** No banned phrase in any user-facing file (red line 7). */
export function checkCopy(files: Record<string, string>): Result {
  const hits = Object.entries(files).flatMap(([f, text]) =>
    findBannedPhrases(text).map((p) => `${f}: "${p}"`),
  );
  return hits.length
    ? fail("copy", hits.join("; "))
    : pass("copy", `${Object.keys(files).length} files clean`);
}
