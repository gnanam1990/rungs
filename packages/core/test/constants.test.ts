import { describe, expect, it } from "vitest";
import * as C from "../src/constants";

// Values copied from docs/build-pack/02-TDD.md section 3. If this test fails, the code drifted from the pack.
describe("constants equal the build pack", () => {
  const U = 10n ** 18n;
  it("unit and limits", () => {
    expect(C.UNIT).toBe(U);
    expect(C.LIMITS).toEqual([1n, 2n, 5n, 10n, 20n, 35n, 50n].map((x) => x * U));
    expect(C.MAX_LEVEL).toBe(6);
    expect(C.MIN_DRAW).toBe(U);
  });
  it("time windows", () => {
    expect(C.TERM).toBe(604_800n);
    expect(C.GRACE).toBe(259_200n);
    expect(C.MIN_HOLD).toBe(86_400n);
    expect(C.CAP_RAISE_DELAY).toBe(172_800n);
  });
  it("fees", () => {
    expect(C.FEE_BPS).toBe(100n);
    expect(C.MIN_FEE).toBe(U / 100n);
    expect(C.LATE_FEE_BPS).toBe(100n);
    expect(C.BPS).toBe(10_000n);
    expect(C.RESERVE_TARGET_BPS).toBe(1_000n);
  });
  it("vouching", () => {
    expect(C.MAX_VOUCHED).toBe(50n * U);
    expect(C.MAX_VOUCHERS).toBe(3);
    expect(C.MAX_VOUCHEES).toBe(3);
    expect(C.MIN_VOUCH_LEVEL).toBe(2);
    expect(C.MIN_STAKE).toBe(U);
  });
  it("outcome codes", () => {
    expect(C.Outcome).toEqual({ EARLY: 0, SMALL: 1, ON_TIME: 2, PROMOTED: 3, LATE: 4, CURED: 5 });
    expect(C.Phase).toEqual({ NONE: 0, CURRENT: 1, LATE: 2, DEFAULTABLE: 3, WRITTEN_OFF: 4 });
  });
});
