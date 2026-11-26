// `pnpm check:submission`: runs every M10 check against the live site and prints one line each.
// Reads SITE_URL, KEEPER_URL (defaults to SITE_URL) and BSCSCAN_API_KEY from the environment or the root .env.
// Exit code 0 only when every check passes. The API key is used for one read and never printed.

import { readFileSync } from "node:fs";
import {
  type Fetcher,
  type Result,
  USER_FACING_FILES,
  checkCopy,
  checkDomain,
  checkHolders,
  checkKeeper,
  checkReadme,
  checkSite,
  checkVerified,
} from "./checks";

const root = new URL("../../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const fetcher: Fetcher = (url) => fetch(url, { signal: AbortSignal.timeout(15_000) });

const site = process.env.SITE_URL ?? "";
const keeperUrl = process.env.KEEPER_URL || site;

const results: Result[] = [checkDomain(site)];
results.push(await checkSite(fetcher, site));
const keeper = await checkKeeper(fetcher, keeperUrl);
results.push(keeper);
results.push(await checkVerified(fetcher, process.env.BSCSCAN_API_KEY ?? "", keeper.pool));
results.push(await checkHolders(fetcher, keeperUrl));
results.push(checkReadme(read("README.md")));
results.push(checkCopy(Object.fromEntries(USER_FACING_FILES.map((f) => [f, read(f)]))));

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(9)} ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(
  failed ? `\n${failed} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`,
);
process.exit(failed ? 1 : 0);
