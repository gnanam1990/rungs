// Ladder constants. Mirrored in contracts/src/LadderLib.sol and fixed by docs/build-pack/02-TDD.md section 3.
// Money is bigint wei. USDT on BNB Chain has 18 decimals. Basis points are out of 10_000.

export const UNIT = 10n ** 18n;
export const LIMITS: readonly bigint[] = Object.freeze([1n, 2n, 5n, 10n, 20n, 35n, 50n].map((x) => x * UNIT));
export const MAX_LEVEL = 6;
export const MIN_DRAW = 1n * UNIT;

export const TERM = 604_800n; // 7 days
export const GRACE = 259_200n; // 3 days
export const MIN_HOLD = 86_400n; // 1 day
export const CAP_RAISE_DELAY = 172_800n; // 2 days

export const BPS = 10_000n;
export const FEE_BPS = 100n;
export const MIN_FEE = UNIT / 100n; // 0.01 USDT
export const LATE_FEE_BPS = 100n;
export const RESERVE_TARGET_BPS = 1_000n;

export const MAX_VOUCHED = 50n * UNIT;
export const MAX_VOUCHERS = 3;
export const MAX_VOUCHEES = 3;
export const MIN_VOUCH_LEVEL = 2;
export const MIN_STAKE = 1n * UNIT;

export const Outcome = Object.freeze({
  EARLY: 0,
  SMALL: 1,
  ON_TIME: 2,
  PROMOTED: 3,
  LATE: 4,
  CURED: 5,
} as const);
export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export const Phase = Object.freeze({ NONE: 0, CURRENT: 1, LATE: 2, DEFAULTABLE: 3, WRITTEN_OFF: 4 } as const);
export type Phase = (typeof Phase)[keyof typeof Phase];
