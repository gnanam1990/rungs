import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bawPreviewCommand, calldata } from "../src/index";
import golden from "./fixtures/cast-calldata.json";

const A = golden.borrower as `0x${string}`;
const P = golden.pool as `0x${string}`;
const g = golden.calls as Record<string, string>;

describe("T-H01 calldata matches `cast calldata`", () => {
  it("every action", () => {
    expect(calldata.openLine(P).data).toBe(g["openLine()"]);
    expect(calldata.draw(P, 10n ** 18n).data).toBe(g["draw(1000000000000000000)"]);
    expect(calldata.draw(P, 12_340_000_000_000_000_000n).data).toBe(g["draw(12340000000000000000)"]);
    expect(calldata.repay(P).data).toBe(g["repay()"]);
    expect(calldata.repayFor(P, A).data).toBe(g[`repayFor(${A})`]);
    expect(calldata.writeOff(P, A).data).toBe(g[`writeOff(${A})`]);
    expect(calldata.vouch(P, A, 5n * 10n ** 18n).data).toBe(g[`vouch(${A},5000000000000000000)`]);
    expect(calldata.unvouch(P, A, 10n ** 18n).data).toBe(g[`unvouch(${A},1000000000000000000)`]);
    expect(calldata.claim(P).data).toBe(g["claim()"]);
    expect(calldata.approve(A, P, 1_010_000_000_000_000_000n).data).toBe(
      g[`approve(${P},1010000000000000000)`],
    );
  });
  it("targets and value", () => {
    expect(calldata.draw(P, 1n)).toMatchObject({ to: P, value: "0" });
    expect(calldata.approve(A, P, 1n).to).toBe(A);
  });
  it("baw preview line", () => {
    expect(bawPreviewCommand(A, calldata.claim(P))).toBe(
      `baw contract-call preview --binanceChainId 56 --from ${A} --to ${P} --value 0 --inputData 0x4e71d92d --json`,
    );
  });
});

describe("generated ABI matches the Foundry artifact", () => {
  it("is current", async () => {
    const path = new URL("../../../contracts/out/RungsPool.sol/RungsPool.json", import.meta.url);
    let art: { abi: unknown };
    try {
      art = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      throw new Error("run `forge build` in contracts/ first (CI does)");
    }
    const { rungsPoolAbi } = await import("../src/abi/RungsPool");
    expect(rungsPoolAbi).toEqual(art.abi);
  });
});
