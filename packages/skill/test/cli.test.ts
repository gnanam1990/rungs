import type { HolderSnapshot, PoolState, Snapshot } from "@rungs/chain";
import { calldata } from "@rungs/chain";
import { describe, expect, it } from "vitest";
import { type CliDeps, runCli } from "../src/index";

const U = 10n ** 18n;
const T0 = 1_800_000_000n;
const POOL = "0x00000000000000000000000000000000000000f0" as const;
const USDT = "0x55d398326f99059fF775485246999027B3197955" as const;
const ME = "0x00000000000000000000000000000000000000a1" as const;

const pool: PoolState = {
  address: POOL,
  usdt: USDT,
  registry: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
  blockNumber: 7n,
  timestamp: T0,
  paused: false,
  idle: 50n * U,
  reserve: 0n,
  outstanding: 0n,
  totalStaked: 0n,
  totalClaimable: 0n,
  socialisedLoss: 0n,
  maxOutstanding: 50n * U,
  dailyNewLineCap: 20,
  newLinesToday: 0,
  reserveTarget: 5n * U,
  owner: "0x00000000000000000000000000000000000000ee",
  pendingCaps: { maxOutstanding: 0n, dailyNewLineCap: 0, eta: 0n },
};

const me = (p: Partial<HolderSnapshot> = {}): HolderSnapshot => ({
  address: ME,
  blockNumber: 7n,
  timestamp: T0,
  holdsAgentId: true,
  handle: "dewi",
  line: {
    exists: true,
    labelhash: "0x00",
    openedAt: T0 - 9n,
    level: 0,
    streak: 0,
    repaid: 0,
    late: 0,
    defaults: 0,
    frozen: false,
    everDrawn: false,
  },
  loan: { principal: 0n, fee: 0n, drawnAt: 0n, dueAt: 0n, writtenOff: false },
  vouchedFor: 0n,
  claimable: 0n,
  voucheeCount: 0,
  allowance: 0n,
  vouchesIn: [],
  ...p,
});

function harness(snapshot: Snapshot) {
  const out: string[] = [];
  const err: string[] = [];
  const deps: CliDeps = {
    readSnapshot: async () => snapshot,
    receiptLogs: async () => [],
    chainId: 56,
    out: (s) => out.push(s),
    err: (s) => err.push(s),
  };
  return { deps, out, err };
}

describe("T-K01 rungs calldata draw", () => {
  it("prints to, data, the summary and the exact baw preview line", async () => {
    const h = harness({ pool, me: me() });
    const code = await runCli(["calldata", "draw", "--amount", "1", "--from", ME], h.deps);
    expect(code).toBe(0);
    const text = h.out.join("\n");
    const c = calldata.draw(POOL, U);
    expect(text).toContain(`to:    ${POOL}`);
    expect(text).toContain(`data:  ${c.data}`);
    expect(text).toContain("Borrow 1 USDT. Repay 1.01 USDT by");
    expect(text).toContain(
      `baw contract-call preview --binanceChainId 56 --from ${ME} --to ${POOL} --value 0 --inputData ${c.data} --json`,
    );
    expect(text).toMatch(/Show this to the user and wait for a clear yes/);
  });
  it("--json prints the action reply", async () => {
    const h = harness({ pool, me: me() });
    await runCli(["calldata", "open", "--from", ME, "--json"], h.deps);
    expect(JSON.parse(h.out.join(""))).toMatchObject({ ok: false, code: "LineExists" });
  });
  it("a refusal exits 1 with the reason", async () => {
    const h = harness({ pool, me: me({ holdsAgentId: false }) });
    expect(await runCli(["calldata", "draw", "--amount", "1", "--from", ME], h.deps)).toBe(1);
    expect(h.err.join("")).toMatch(/NotAgentId/);
  });
});

describe("T-K02 rungs calldata approve uses the live due", () => {
  it("never a larger number, never max uint", async () => {
    const loan = {
      principal: 2n * U,
      fee: (2n * U) / 100n,
      drawnAt: T0 - 100n,
      dueAt: T0 + 604_700n,
      writtenOff: false,
    };
    const h = harness({ pool, me: me({ loan, line: { ...me().line, everDrawn: true } }) });
    await runCli(["calldata", "approve", "--from", ME, "--json"], h.deps);
    const r = JSON.parse(h.out.join(""));
    expect(r.ok).toBe(true);
    expect(r.to).toBe(USDT);
    expect(r.data).toBe(calldata.approve(USDT, POOL, 2n * U + (2n * U) / 100n).data);
    expect(r.data).not.toMatch(/f{64}/);
  });
});

describe("T-K03 the CLI refuses a handle where an address is expected", () => {
  it.each([
    [["line", "dewi.ai"]],
    [["line", "dewi"]],
    [["calldata", "draw", "--from", "dewi.ai"]],
    [["calldata", "repay", "--from", ME, "--borrower", "arun.ai"]],
  ])("%j", async (argv) => {
    const h = harness({ pool, me: me() });
    expect(await runCli(argv, h.deps)).toBe(2);
    expect(h.err.join("")).toContain("Enter a wallet address. Rungs does not look up names.");
  });
  it("rejects a bad amount", async () => {
    const h = harness({ pool, me: me() });
    expect(await runCli(["calldata", "draw", "--from", ME, "--amount", "1e18"], h.deps)).toBe(2);
  });
});

describe("rungs line and explain", () => {
  it("line prints rung, limit and next step", async () => {
    const h = harness({ pool, me: me() });
    expect(await runCli(["line", ME], h.deps)).toBe(0);
    const t = h.out.join("\n");
    expect(t).toMatch(/dewi\.ai/);
    expect(t).toMatch(/rung 0/);
    expect(t).toMatch(/limit 1 USDT/);
    expect(t).toMatch(/next: draw/);
  });
  it("explain with no pool events says so", async () => {
    const h = harness({ pool, me: me() });
    expect(await runCli(["explain", `0x${"ab".repeat(32)}`], h.deps)).toBe(0);
    expect(h.out.join("")).toMatch(/no Rungs events/);
  });
  it("help", async () => {
    const h = harness({ pool, me: me() });
    expect(await runCli(["--help"], h.deps)).toBe(0);
    expect(h.out.join("")).toMatch(/never signs/);
  });
});
