// Fills the pack's write-up and X thread from live /v1/stats and /v1/config, so every number in the submission equals
// the stats at one block. Exact values only: USDT is formatted from integer wei, nothing is rounded.

import { formatUsdt } from "@rungs/chain";

export type Live = Record<string, string>;

export interface Stats {
  excludingTeam: { holders: number; loansDrawn: number; repaidOnTime: number; writtenOff: number };
  pool: { idle: string };
  asOfBlock: number;
}

/** Placeholder name → value. Team wallets are excluded from every count. */
export function liveValues(siteUrl: string, stats: Stats, config: { pool: string; repo: string }): Live {
  const url = siteUrl.trim().replace(/\/+$/, "");
  const t = stats.excludingTeam;
  return {
    "site URL": url,
    url,
    address: config.pool,
    N: String(t.holders),
    loans: String(t.loansDrawn),
    repaid: String(t.repaidOnTime),
    writtenOff: String(t.writtenOff),
    block: String(stats.asOfBlock),
    pool: formatUsdt(BigInt(stats.pool.idle)),
    repo: config.repo,
  };
}

/** Replaces each {name} it knows; returns the text and the placeholders left (for the owner to fill by hand). */
export function fillTemplate(text: string, live: Live): { text: string; left: string[] } {
  const left = new Set<string>();
  const out = text.replace(/\{([^{}\n]+)\}/g, (m, name: string) => {
    if (name in live) return live[name]!;
    left.add(m);
    return m;
  });
  return { text: out, left: [...left] };
}
