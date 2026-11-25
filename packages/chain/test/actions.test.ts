import { describe, expect, it } from "vitest";
import { type Snapshot, calldata, drawableNow, formatUsdt, parseUsdt, planAction } from "../src/index";
import type { HolderSnapshot, PoolState } from "../src/index";
import { MAX_UINT256_FOR_TESTS_ONLY } from "./helpers";

const U = 10n ** 18n;
const T0 = 1_800_000_000n;
const POOL = "0x00000000000000000000000000000000000000f0" as const;
const USDT = "0x55d398326f99059fF775485246999027B3197955" as const;
const ME = "0x00000000000000000000000000000000000000a1" as const;
const BOB = "0x00000000000000000000000000000000000000b0" as const;

function pool(p: Partial<PoolState> = {}): PoolState {
  return {
    address: POOL,
    usdt: USDT,
    registry: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
    blockNumber: 100n,
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
    ...p,
  };
}

function holder(address: `0x${string}`, p: Partial<HolderSnapshot> = {}): HolderSnapshot {
  return {
    address,
    blockNumber: 100n,
    timestamp: T0,
    holdsAgentId: true,
    handle: "dewi",
    line: {
      exists: true,
      labelhash: "0x00",
      openedAt: T0 - 100n,
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
  };
}

const withLoan = (
  h: HolderSnapshot,
  principal: bigint,
  drawnAt = T0 - 3_600n,
  writtenOff = false,
): HolderSnapshot => ({
  ...h,
  line: { ...h.line, everDrawn: true, frozen: writtenOff },
  loan: {
    principal,
    fee: principal / 100n > U / 100n ? principal / 100n : U / 100n,
    drawnAt,
    dueAt: drawnAt + 604_800n,
    writtenOff,
  },
});

const snap = (me: HolderSnapshot, p: Partial<PoolState> = {}, borrower?: HolderSnapshot): Snapshot =>
  borrower ? { pool: pool(p), me, borrower } : { pool: pool(p), me };

describe("open", () => {
  it("ok for a holder without a line", () => {
    const me = holder(ME, { line: { ...holder(ME).line, exists: false } });
    const r = planAction("open", snap(me), {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toBe(calldata.openLine(POOL).data);
    expect(r.to).toBe(POOL);
    expect(r.value).toBe("0");
    expect(r.humanSummary).toMatch(/gas only/);
    expect(r.bawPreviewCommand).toBe(
      `baw contract-call preview --binanceChainId 56 --from ${ME} --to ${POOL} --value 0 --inputData 0x90d6129a --json`,
    );
    expect(r.asOfBlock).toBe(100);
  });
  it("refuses: no Agent ID, line exists, paused", () => {
    expect(planAction("open", snap(holder(ME, { holdsAgentId: false })), {})).toMatchObject({
      ok: false,
      code: "NotAgentId",
    });
    expect(planAction("open", snap(holder(ME)), {})).toMatchObject({ ok: false, code: "LineExists" });
    const fresh = holder(ME, { line: { ...holder(ME).line, exists: false } });
    expect(planAction("open", snap(fresh, { paused: true }), {})).toMatchObject({
      ok: false,
      code: "Paused",
    });
  });
});

describe("draw (T-S06 / T-W03 wording)", () => {
  it("ok with the full microcopy", () => {
    const r = planAction("draw", snap(holder(ME)), { amount: U });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toBe(calldata.draw(POOL, U).data);
    expect(r.humanSummary).toBe(
      "Borrow 1 USDT. Repay 1.01 USDT by Fri 22 Jan 2027, 08:00 UTC. Late adds 0.01 USDT. After Mon 25 Jan 2027, 08:00 UTC the loan is written off and marked on your name.",
    );
    expect(r.warnings.join(" ")).toMatch(/24 hours/);
    expect(r.then).toBe("approve");
  });
  it("defaults to the full limit when no amount is given", () => {
    const r = planAction("draw", snap(holder(ME, { line: { ...holder(ME).line, level: 3 } })), {});
    expect(r.ok && r.data).toBe(calldata.draw(POOL, 10n * U).data);
  });
  it("refuses with a reason", () => {
    const me = holder(ME);
    expect(
      planAction("draw", snap(holder(ME, { line: { ...me.line, exists: false } })), { amount: U }),
    ).toMatchObject({
      code: "NoLine",
    });
    expect(
      planAction("draw", snap(holder(ME, { line: { ...me.line, frozen: true } })), { amount: U }),
    ).toMatchObject({
      code: "Frozen",
    });
    expect(planAction("draw", snap(withLoan(me, U)), { amount: U })).toMatchObject({ code: "LoanOpen" });
    expect(planAction("draw", snap(me), { amount: U - 1n })).toMatchObject({ code: "BelowMin" });
    expect(planAction("draw", snap(me), { amount: U + 1n })).toMatchObject({ code: "AboveLimit" });
    expect(planAction("draw", snap(me, { paused: true }), { amount: U })).toMatchObject({ code: "Paused" });
    expect(planAction("draw", snap(me, { idle: U - 1n }), { amount: U })).toMatchObject({
      code: "PoolShort",
    });
    expect(planAction("draw", snap(me, { outstanding: 50n * U }), { amount: U })).toMatchObject({
      code: "CapReached",
    });
    expect(planAction("draw", snap(me, { newLinesToday: 20 }), { amount: U })).toMatchObject({
      code: "DailyCapReached",
    });
    const drawnBefore = holder(ME, { line: { ...me.line, everDrawn: true } });
    expect(planAction("draw", snap(drawnBefore, { newLinesToday: 20 }), { amount: U }).ok).toBe(true);
    expect(planAction("draw", snap(holder(ME, { holdsAgentId: false })), { amount: U })).toMatchObject({
      code: "NotAgentId",
    });
  });
  it("counts vouched stake in the limit", () => {
    const me = holder(ME, { vouchedFor: 7n * U });
    expect(planAction("draw", snap(me), { amount: 8n * U }).ok).toBe(true);
    expect(planAction("draw", snap(me), { amount: 8n * U + 1n })).toMatchObject({ code: "AboveLimit" });
  });
});

describe("drawableNow: what the pool can lend this holder right now (web-app-shipping 6)", () => {
  const lvl3 = holder(ME, { line: { ...holder(ME).line, level: 3, everDrawn: true } });
  it("is the full limit when the pool has room", () => {
    expect(drawableNow(snap(lvl3))).toBe(10n * U);
  });
  it("is cut to the pool's idle money and to the room under the lending cap", () => {
    expect(drawableNow(snap(lvl3, { idle: 4n * U }))).toBe(4n * U);
    expect(drawableNow(snap(lvl3, { outstanding: 47n * U }))).toBe(3n * U);
    expect(drawableNow(snap(lvl3, { idle: 4n * U, outstanding: 47n * U }))).toBe(3n * U);
  });
  it("is 0 when less than the smallest loan fits, or when nothing can be drawn", () => {
    expect(drawableNow(snap(lvl3, { idle: U - 1n }))).toBe(0n);
    expect(drawableNow(snap(lvl3, { outstanding: 50n * U }))).toBe(0n);
    expect(drawableNow(snap(lvl3, { paused: true }))).toBe(0n);
    expect(drawableNow(snap(withLoan(lvl3, U)))).toBe(0n);
    expect(drawableNow(snap(holder(ME, { line: { ...lvl3.line, frozen: true } })))).toBe(0n);
    expect(drawableNow(snap(holder(ME, { line: { ...lvl3.line, exists: false } })))).toBe(0n);
    expect(drawableNow(snap(holder(ME, { ...lvl3, holdsAgentId: false })))).toBe(0n);
  });
  it("is 0 for a first-ever draw once today's first-borrower cap is reached", () => {
    expect(drawableNow(snap(holder(ME), { newLinesToday: 20 }))).toBe(0n);
    expect(drawableNow(snap(lvl3, { newLinesToday: 20 }))).toBe(10n * U);
  });
  it("is the planner's default draw amount, so a draw with no amount fits the pool", () => {
    const r = planAction("draw", snap(lvl3, { idle: 4n * U }), {});
    expect(r.ok && r.data).toBe(calldata.draw(POOL, 4n * U).data);
  });
});

describe("approve (T-K02, T-S07)", () => {
  it("is for exactly the live due, never more", () => {
    const me = withLoan(holder(ME), U);
    const r = planAction("approve", snap(me), {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.to).toBe(USDT);
    expect(r.data).toBe(calldata.approve(USDT, POOL, U + U / 100n).data);
    expect(r.data).not.toContain("f".repeat(64));
    expect(r.humanSummary).toBe("This approval is for exactly 1.01 USDT, for this one repayment.");
    expect(r.then).toBe("repay");
  });
  it("includes the late fee once the due time has passed", () => {
    const me = withLoan(holder(ME), 10n * U, T0 - 604_801n);
    const r = planAction("approve", snap(me), {});
    expect(r.ok && r.data).toBe(calldata.approve(USDT, POOL, 10n * U + U / 10n + U / 10n).data);
  });
  it("warns when the amount will rise before repayment", () => {
    const me = withLoan(holder(ME), U, T0 - 604_700n); // due in 100 s
    const r = planAction("approve", snap(me), {});
    expect(r.ok && r.warnings.join(" ")).toMatch(/goes up/);
  });
  it("for a friend's loan uses the friend's due", () => {
    const friend = withLoan(holder(BOB), 2n * U);
    const r = planAction("approve", snap(holder(ME), {}, friend), {});
    expect(r.ok && r.data).toBe(calldata.approve(USDT, POOL, 2n * U + (2n * U) / 100n).data);
  });
  it("for a stake uses the stake amount and leads to vouch", () => {
    const me = holder(ME, { line: { ...holder(ME).line, level: 2 } });
    const r = planAction("approve", snap(me, {}, holder(BOB)), { amount: 3n * U, purpose: "vouch" });
    expect(r.ok && r.data).toBe(calldata.approve(USDT, POOL, 3n * U).data);
    expect(r.ok && r.then).toBe("vouch");
  });
  it("refuses with nothing to repay", () => {
    expect(planAction("approve", snap(holder(ME)), {})).toMatchObject({ ok: false, code: "NoLoan" });
  });
  it("never produces max uint", () => {
    expect(() =>
      planAction("approve", snap(holder(ME)), { amount: MAX_UINT256_FOR_TESTS_ONLY, purpose: "vouch" }),
    ).not.toThrow();
    const r = planAction(
      "approve",
      snap(holder(ME, { line: { ...holder(ME).line, level: 2 } }), {}, holder(BOB)),
      {
        amount: MAX_UINT256_FOR_TESTS_ONLY,
        purpose: "vouch",
      },
    );
    expect(r).toMatchObject({ ok: false });
  });
});

describe("repay", () => {
  it("needs the approval first", () => {
    const me = withLoan(holder(ME), U);
    expect(planAction("repay", snap(me), {})).toMatchObject({ ok: false, code: "BadInput" });
  });
  it("previews the outcome", () => {
    const early = { ...withLoan(holder(ME), U), allowance: U + U / 100n };
    const r = planAction("repay", snap(early), {});
    expect(r.ok && r.data).toBe(calldata.repay(POOL).data);
    expect(r.ok && r.humanSummary).toMatch(/does not count towards the next rung/);
    const held = { ...withLoan(holder(ME), U, T0 - 86_400n), allowance: U + U / 100n };
    expect(
      planAction("repay", snap(held), {}).ok &&
        (planAction("repay", snap(held), {}) as { humanSummary: string }).humanSummary,
    ).toMatch(/rung 1/);
  });
  it("cure wording", () => {
    const wo = { ...withLoan(holder(ME), U, T0 - 30n * 86_400n, true), allowance: 10n * U };
    const r = planAction("repay", snap(wo), {});
    expect(r.ok && r.humanSummary).toMatch(/restarts at rung 0/);
  });
  it("repays for a friend with repayFor", () => {
    const friend = withLoan(holder(BOB), U);
    const me = holder(ME, { allowance: 2n * U });
    const r = planAction("repay", snap(me, {}, friend), {});
    expect(r.ok && r.data).toBe(calldata.repayFor(POOL, BOB).data);
    expect(r.ok && r.humanSummary).toMatch(/record goes to them/);
  });
  it("works while paused", () => {
    const me = { ...withLoan(holder(ME), U), allowance: 2n * U };
    expect(planAction("repay", snap(me, { paused: true }), {}).ok).toBe(true);
  });
});

describe("vouch, unvouch, claim", () => {
  const at2 = holder(ME, { line: { ...holder(ME).line, level: 2 }, allowance: 5n * U });
  it("vouch ok and its rules", () => {
    const r = planAction("vouch", snap(at2, {}, holder(BOB)), { amount: 5n * U });
    expect(r.ok && r.data).toBe(calldata.vouch(POOL, BOB, 5n * U).data);
    expect(r.ok && r.humanSummary).toMatch(/taken first/);
    expect(
      planAction("vouch", snap(holder(ME, { allowance: 5n * U }), {}, holder(BOB)), { amount: U }),
    ).toMatchObject({
      code: "VouchRule",
    });
    expect(planAction("vouch", snap(at2, {}, holder(BOB)), {})).toMatchObject({ code: "BadInput" });
    expect(planAction("vouch", snap(at2), { amount: U })).toMatchObject({ code: "BadInput" });
    expect(planAction("vouch", snap(at2, { paused: true }, holder(BOB)), { amount: U })).toMatchObject({
      code: "Paused",
    });
    expect(
      planAction("vouch", snap(at2, {}, holder(BOB, { vouchedFor: 50n * U })), { amount: U }),
    ).toMatchObject({
      code: "VouchRule",
    });
    expect(planAction("vouch", snap(at2, {}, holder(BOB)), { amount: 6n * U })).toMatchObject({
      code: "BadInput",
    });
    const frozenBob = holder(BOB, { line: { ...holder(BOB).line, frozen: true } });
    expect(planAction("vouch", snap(at2, {}, frozenBob), { amount: U })).toMatchObject({ code: "VouchRule" });
  });
  it("unvouch is locked while the borrower has a loan", () => {
    const b = { ...withLoan(holder(BOB), U), vouchesIn: [{ voucher: ME, amount: 3n * U }] };
    expect(planAction("unvouch", snap(at2, {}, b), { amount: U })).toMatchObject({ code: "StakeLocked" });
    const free = holder(BOB, { vouchesIn: [{ voucher: ME, amount: 3n * U }] });
    const r = planAction("unvouch", snap(at2, {}, free), { amount: 3n * U });
    expect(r.ok && r.data).toBe(calldata.unvouch(POOL, BOB, 3n * U).data);
    expect(planAction("unvouch", snap(at2, {}, free), { amount: 4n * U })).toMatchObject({
      code: "BadInput",
    });
  });
  it("claim", () => {
    expect(planAction("claim", snap(holder(ME)), {})).toMatchObject({ code: "NothingToClaim" });
    const r = planAction("claim", snap(holder(ME, { claimable: 2n * U })), {});
    expect(r.ok && r.data).toBe(calldata.claim(POOL).data);
    expect(r.ok && r.humanSummary).toBe("Collect 2 USDT restored to you after a cure.");
  });
});

describe("amounts", () => {
  it("parse and format without floats", () => {
    expect(parseUsdt("1")).toBe(U);
    expect(parseUsdt("0.01")).toBe(U / 100n);
    expect(parseUsdt("7.000000000000000003")).toBe(7n * U + 3n);
    expect(() => parseUsdt("1e18")).toThrow();
    expect(() => parseUsdt("-1")).toThrow();
    expect(() => parseUsdt("1.0000000000000000001")).toThrow();
    expect(formatUsdt(U)).toBe("1");
    expect(formatUsdt(U + U / 100n)).toBe("1.01");
    expect(formatUsdt(U / 2n)).toBe("0.50");
    expect(formatUsdt(5n * 10n ** 15n)).toBe("0.005");
    expect(formatUsdt(7n * U + 3n)).toBe("7.000000000000000003");
  });
});
