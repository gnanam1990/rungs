import { findBannedPhrases, findConfirmationBypass } from "@rungs/skill/lint";
import { describe, expect, it } from "vitest";
import { short } from "../src/format";
import { S } from "../src/strings";

const flatten = (v: unknown): string[] =>
  typeof v === "string"
    ? [v]
    : typeof v === "function"
      ? [String((v as (...a: string[]) => string)("X", "Y"))]
      : Array.isArray(v)
        ? v.flatMap(flatten)
        : v && typeof v === "object"
          ? Object.values(v).flatMap(flatten)
          : [];

describe("T-W10 (unit) every string in strings.ts", () => {
  const all = flatten(S).join("\n");
  it("has no banned phrase", () => {
    expect(findBannedPhrases(all)).toEqual([]);
  });
  it("never tells anyone to skip a confirmation", () => {
    expect(findConfirmationBypass(all)).toEqual([]);
  });
  it("T-W12: the product name is Rungs, never Binance or BNB", () => {
    expect(S.product).toBe("Rungs");
    expect(S.product).not.toMatch(/binance|bnb/i);
    expect(S.independence).toBe("An independent project. Not affiliated with Binance.");
  });
  it("the risk notice is the fixed text from the UI spec", () => {
    expect(S.risk).toBe(
      "Rungs is an experimental, unaudited lending pilot. You can lose money you stake. Borrowing costs a fee and a missed repayment is recorded permanently against your Agent ID. Nothing here is financial advice or a promise of any return.",
    );
  });
});

describe("format", () => {
  it("shortens addresses and transaction hashes, nothing else", () => {
    expect(short(`0x${"ab".repeat(20)}`)).toBe("0xabab…abab");
    expect(short(`0x${"cd".repeat(32)}`)).toBe("0xcdcd…cdcd");
    expect(short("dewi")).toBe("dewi");
  });
});
