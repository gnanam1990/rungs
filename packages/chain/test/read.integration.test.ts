import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { planAction, readSnapshot, readStanding } from "../src/index";
import { type LocalChain, anvilBinary, startLocalChain } from "../test-utils/anvil";

const U = 10n ** 18n;
const hasAnvil = anvilBinary() !== null;

// T-H02: read.ts decodes standingOf, dueOf, limitOf and the full snapshot from a real chain (local anvil with the
// real RungsPool). It also drives a full cycle using only planAction's calldata, so the planner is proven to
// produce calls the contract accepts.
describe.runIf(hasAnvil)("T-H02 reads and planner calls on anvil", () => {
  let c: LocalChain;
  beforeAll(async () => {
    c = await startLocalChain();
  }, 60_000);
  afterAll(() => c?.stop());

  const step = async (who: `0x${string}`, action: Parameters<typeof planAction>[0], params = {}) => {
    const s = await readSnapshot(c.client, c.pool, who);
    const r = planAction(action, s, { ...params, chainId: 31337 });
    if (!r.ok) throw new Error(`${action} refused: ${r.code} ${r.reason}`);
    await c.send(who, r.to, r.data);
    return r;
  };

  it("open → draw → approve exact → repay, then promoted", async () => {
    const dewi = c.holders[0]!;
    let s = await readSnapshot(c.client, c.pool, dewi);
    expect(s.me.holdsAgentId).toBe(true);
    expect(s.me.handle).toBe("dewi");
    expect(s.me.line.exists).toBe(false);
    expect(s.pool.idle).toBe(100n * U);
    expect(s.pool.maxOutstanding).toBe(50n * U);
    expect(s.pool.dailyNewLineCap).toBe(20);

    await step(dewi, "open");
    await step(dewi, "draw", { amount: U });

    const st = await readStanding(c.client, c.pool, dewi);
    expect(st.standing.hasLine).toBe(true);
    expect(st.standing.hasOpenLoan).toBe(true);
    expect(st.limit).toBe(U);
    expect(st.due.amount).toBe(U + U / 100n);
    expect(st.due.phase).toBe(1);

    await c.warp(86_400);
    const approve = await step(dewi, "approve");
    expect(approve.humanSummary).toBe("This approval is for exactly 1.01 USDT, for this one repayment.");
    s = await readSnapshot(c.client, c.pool, dewi);
    expect(s.me.allowance).toBe(U + U / 100n);
    const repay = await step(dewi, "repay");
    expect(repay.humanSummary).toMatch(/rung 1/);

    s = await readSnapshot(c.client, c.pool, dewi);
    expect(s.me.line.level).toBe(1);
    expect(s.me.loan.principal).toBe(0n);
    expect(s.me.allowance).toBe(0n);
    expect(s.pool.reserve).toBe(U / 100n);
  });

  it("a stranger is refused by the planner before any transaction", async () => {
    const s = await readSnapshot(c.client, c.pool, c.stranger);
    expect(s.me.holdsAgentId).toBe(false);
    expect(s.me.handle).toBeNull();
    expect(planAction("open", s, {})).toMatchObject({ ok: false, code: "NotAgentId" });
  });
});

describe.skipIf(hasAnvil)("T-H02 (skipped)", () => {
  it.skip("needs anvil (Foundry) on PATH", () => {});
});
