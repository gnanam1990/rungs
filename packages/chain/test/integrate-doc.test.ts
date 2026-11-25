import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8").replace(/\r\n/g, "\n").trim();
const blocks = (md: string, lang: string) =>
  [...md.matchAll(/```(\w+)\n([\s\S]*?)```/g)].filter((m) => m[1] === lang).map((m) => m[2]!.trim());

// T-G02: the guide's samples are the files that CI compiles (forge for Solidity, tsc for TypeScript).
describe("T-G02 docs/INTEGRATE.md samples are the compiled files", () => {
  const doc = read("docs/INTEGRATE.md");
  it("the Solidity example is contracts/examples/GatedMint.sol", () => {
    expect(blocks(doc, "solidity")).toContain(read("contracts/examples/GatedMint.sol"));
  });
  it("the TypeScript example is packages/chain/examples/standing.ts", () => {
    expect(blocks(doc, "ts")).toContain(read("packages/chain/examples/standing.ts"));
  });
  it("the interface shown matches IRungsStanding.sol", () => {
    const iface = blocks(doc, "solidity")[0]!;
    const src = read("contracts/src/IRungsStanding.sol");
    for (const line of iface
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("function") || /^(bool|uint)/.test(l))) {
      expect(src, line).toContain(line);
    }
  });
});
