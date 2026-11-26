// M10 "Tests first": `pnpm check:submission` fails unless the site and keeper answer, the contract is verified,
// at least 30 non-team holders used it, the README has every required heading and no banned phrase is in the copy.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Fetcher,
  MIN_HOLDERS,
  README_HEADINGS,
  USER_FACING_FILES,
  checkCopy,
  checkDomain,
  checkHolders,
  checkKeeper,
  checkReadme,
  checkSite,
  checkVerified,
} from "../src/checks";

const POOL = "0x1111111111111111111111111111111111111111";
const KEY = "SECRETKEY123";
const root = new URL("../../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

/** A fake fetch: url → [status, body]. Unknown urls answer 404. */
function fake(routes: Record<string, [number, string]>): Fetcher {
  return async (url) => {
    const [status, body] = routes[url] ?? [404, "not found"];
    return { status, text: async () => body };
  };
}

describe("domain (red line 5)", () => {
  it("passes an https domain without binance or bnb", () => {
    expect(checkDomain("https://rungs.xyz").ok).toBe(true);
  });
  it("fails without https, or with binance / bnb in the host", () => {
    expect(checkDomain("http://rungs.xyz").ok).toBe(false);
    expect(checkDomain("https://rungs-binance.app").ok).toBe(false);
    expect(checkDomain("https://bnbrungs.app").ok).toBe(false);
    expect(checkDomain("").ok).toBe(false);
  });
});

describe("site answers", () => {
  const ok = {
    "https://rungs.xyz/": [200, '<div id="root"></div>'],
    "https://rungs.xyz/open": [200, '<div id="root"></div>'],
    "https://rungs.xyz/llms.txt": [200, "# Rungs"],
    "https://rungs.xyz/skill.md": [200, "# Rungs skill"],
  } as Record<string, [number, string]>;
  it("passes when the page, /open, llms.txt and skill.md load", async () => {
    expect((await checkSite(fake(ok), "https://rungs.xyz")).ok).toBe(true);
  });
  it("fails and names the path that did not load", async () => {
    const r = await checkSite(
      fake({ ...ok, "https://rungs.xyz/skill.md": [502, "bad"] }),
      "https://rungs.xyz/",
    );
    expect(r).toMatchObject({ ok: false, detail: expect.stringContaining("/skill.md") });
  });
});

describe("keeper answers on mainnet", () => {
  const cfg = (o: object) =>
    ({ "https://rungs.xyz/v1/config": [200, JSON.stringify(o)] }) as Record<string, [number, string]>;
  it("passes with chain 56 and a pool address, and returns the pool", async () => {
    const r = await checkKeeper(fake(cfg({ chainId: 56, pool: POOL })), "https://rungs.xyz");
    expect(r).toMatchObject({ ok: true, pool: POOL });
  });
  it("fails on another chain, no pool, or no answer", async () => {
    expect((await checkKeeper(fake(cfg({ chainId: 31337, pool: POOL })), "https://rungs.xyz")).ok).toBe(
      false,
    );
    expect((await checkKeeper(fake(cfg({ chainId: 56, pool: null })), "https://rungs.xyz")).ok).toBe(false);
    expect((await checkKeeper(fake({}), "https://rungs.xyz")).ok).toBe(false);
  });
});

describe("contract verified on BscScan (Etherscan V2 API)", () => {
  const url = `https://api.etherscan.io/v2/api?chainid=56&module=contract&action=getsourcecode&address=${POOL}&apikey=${KEY}`;
  const answer = (src: string, name: string) =>
    ({
      [url]: [200, JSON.stringify({ status: "1", result: [{ SourceCode: src, ContractName: name }] })],
    }) as Record<string, [number, string]>;
  it("passes when RungsPool's source is published", async () => {
    expect((await checkVerified(fake(answer("contract RungsPool {}", "RungsPool")), KEY, POOL)).ok).toBe(
      true,
    );
  });
  it("fails when the source is empty or it is another contract", async () => {
    expect((await checkVerified(fake(answer("", "")), KEY, POOL)).ok).toBe(false);
    expect((await checkVerified(fake(answer("contract X {}", "X")), KEY, POOL)).ok).toBe(false);
  });
  it("fails without a key or a pool, and never prints the key", async () => {
    expect((await checkVerified(fake({}), "", POOL)).ok).toBe(false);
    expect((await checkVerified(fake({}), KEY, null)).ok).toBe(false);
    const r = await checkVerified(
      async () => {
        throw new Error(`request to ${url} failed`);
      },
      KEY,
      POOL,
    );
    expect(r.ok).toBe(false);
    expect(r.detail).not.toContain(KEY);
  });
});

describe("holders (team wallets excluded)", () => {
  const stats = (n: number) =>
    ({ "https://rungs.xyz/v1/stats": [200, JSON.stringify({ excludingTeam: { holders: n } })] }) as Record<
      string,
      [number, string]
    >;
  it(`passes at ${MIN_HOLDERS} or more`, async () => {
    expect((await checkHolders(fake(stats(MIN_HOLDERS)), "https://rungs.xyz")).ok).toBe(true);
  });
  it("fails below, and says how many", async () => {
    expect(await checkHolders(fake(stats(12)), "https://rungs.xyz")).toMatchObject({
      ok: false,
      detail: expect.stringContaining("12"),
    });
  });
});

describe("README headings", () => {
  it("lists what the build pack requires", () => {
    expect(README_HEADINGS).toEqual(
      expect.arrayContaining([
        "What is live",
        "What is not live",
        "Owner permissions",
        "Trust assumptions",
        "Known limits",
        "Risk notice",
        "What is proven",
        "Demo video",
      ]),
    );
  });
  it("fails and names each missing heading", () => {
    expect(checkReadme("# Rungs\n## What is live\n")).toMatchObject({
      ok: false,
      detail: expect.stringContaining("Risk notice"),
    });
  });
  it("today's README is missing only the demo video (recorded by the owner in M10)", () => {
    expect(checkReadme(read("README.md")).detail).toBe("missing: Demo video");
  });
});

describe("no banned phrase in user-facing text (red line 7)", () => {
  it("flags a banned phrase and names the file", () => {
    expect(checkCopy({ "README.md": "Borrow and earn passive income" })).toMatchObject({
      ok: false,
      detail: expect.stringContaining("README.md"),
    });
  });
  it("today's user-facing files are clean", () => {
    const files = Object.fromEntries(USER_FACING_FILES.map((f) => [f, read(f)]));
    expect(checkCopy(files)).toEqual({
      name: "copy",
      ok: true,
      detail: `${USER_FACING_FILES.length} files clean`,
    });
  });
});
