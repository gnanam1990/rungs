// `pnpm submission:fill` fills the pack's write-up and X thread from /v1/stats and /v1/config at one block, so every
// number equals the live stats (submission checklist: "Numbers in the write-up equal /v1/stats at that block").

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Live, fillTemplate, liveValues } from "../src/fill";

const root = new URL("../../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const U = 10n ** 18n;

const stats = {
  excludingTeam: { holders: 31, loansDrawn: 40, repaidOnTime: 33, writtenOff: 2 },
  pool: { idle: (41n * U + U / 2n).toString() },
  asOfBlock: 45_000_123,
};
const config = {
  pool: "0x1111111111111111111111111111111111111111",
  repo: "https://github.com/gnanam1990/rungs",
};
const live: Live = liveValues("https://rungs.xyz/", stats, config);

describe("live values", () => {
  it("are taken from stats (team excluded) and config, never rounded", () => {
    expect(live).toEqual({
      "site URL": "https://rungs.xyz",
      url: "https://rungs.xyz",
      address: config.pool,
      N: "31",
      loans: "40",
      repaid: "33",
      writtenOff: "2",
      block: "45000123",
      pool: "41.50",
      repo: config.repo,
    });
  });
});

describe("fillTemplate", () => {
  it("fills every known placeholder and lists the ones left", () => {
    const r = fillTemplate("{N} holders at {block}; day {d}: {top}", live);
    expect(r.text).toBe("31 holders at 45000123; day {d}: {top}");
    expect(r.left).toEqual(["{d}", "{top}"]);
  });
  it("fills the pack's write-up completely", () => {
    const r = fillTemplate(read("docs/build-pack/07-demo-and-submission/writeup-draft.md"), live);
    expect(r.left.filter((x) => x !== "{…}")).toEqual([]);
    expect(r.text).toContain(
      "31 Agent ID holders, 40 loans, 33 repaid on time, 2 written off, as of block 45000123",
    );
    expect(r.text).toContain("contract 0x1111111111111111111111111111111111111111 (verified)");
  });
  it("fills the X thread except the daily-update fields, which change every day", () => {
    const r = fillTemplate(read("docs/build-pack/07-demo-and-submission/x-thread-draft.md"), live);
    expect(r.left.filter((x) => x !== "{…}").sort()).toEqual(["{d}", "{r}", "{top}"]);
    expect(r.text).toContain(
      "Open books: 31 holders, 33 loans repaid on time, 2 written off, 41.50 USDT in the pool.",
    );
  });
});
