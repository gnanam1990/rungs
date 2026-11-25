import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BANNED_PHRASES,
  findBannedPhrases,
  findConfirmationBypass,
  parseArgs,
  renderLlms,
  renderPrompt,
  renderSkill,
} from "../src/index";

const here = fileURLToPath(new URL("..", import.meta.url));
const SKILL = readFileSync(join(here, "SKILL.md"), "utf8");
const VARS = {
  POOL_ADDRESS: "0x1111111111111111111111111111111111111111",
  USDT_ADDRESS: "0x55d398326f99059fF775485246999027B3197955",
  REGISTRY_ADDRESS: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",
  KEEPER_URL: "https://api.rungs.example",
  CHAIN_ID: "56",
  REPO_URL: "https://github.com/gnanam1990/rungs",
};

function codeLines(md: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const line of md.split(/\r?\n/)) {
    if (line.trim().startsWith("```")) {
      inBlock = !inBlock;
      continue;
    }
    if (inBlock) out.push(line.trim());
  }
  // inline code that is a command
  for (const m of md.matchAll(/`((?:baw|rungs) [^`]+)`/g)) out.push(m[1]!);
  return out.filter((l) => /^(baw|rungs) /.test(l));
}

describe("T-K05 SKILL.md lint", () => {
  it("states the confirmation rule, the Developer Mode check and the secrets rule near the top", () => {
    const top = SKILL.slice(0, SKILL.indexOf("## 3."));
    expect(top).toMatch(/wait for a clear yes before each `execute`/i);
    expect(top).toMatch(
      /never ask for, accept or handle\*\* a seed phrase, private key, API secret, pairing code or QR code/i,
    );
    expect(top).toMatch(/exact amount due, never more/i);
    expect(SKILL).toMatch(/baw wallet settings --json/);
    expect(SKILL).toMatch(/devMode\.enabled/);
    expect(SKILL).toMatch(/unaudited/i);
  });
  it("contains none of the banned phrases", () => {
    expect(findBannedPhrases(SKILL)).toEqual([]);
    expect(BANNED_PHRASES).toContain("passive income");
  });
  it("every command in it parses", () => {
    const cmds = codeLines(SKILL);
    expect(cmds.length).toBeGreaterThanOrEqual(6);
    const baw =
      /^baw (wallet (settings|agent-id|address) --json|contract-call (preview --binanceChainId \S+ --from \S+ --to \S+ --value \d+ --inputData \S+ --json|execute --requestId \S+ --json))$/;
    for (const c of cmds) {
      if (c.startsWith("baw ")) expect(c, c).toMatch(baw);
      else
        expect(
          parseArgs(
            c
              .replace(/[<>[\]]/g, "")
              .split(/\s+/)
              .slice(1),
          ).error,
          c,
        ).toBeUndefined();
    }
  });
  it("renders with live addresses and no leftover placeholders", () => {
    const s = renderSkill(SKILL, VARS);
    expect(s).toContain(VARS.POOL_ADDRESS);
    expect(s).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe("T-K06 llms.txt", () => {
  it("renders with live addresses under 8 KB", () => {
    const t = renderLlms(readFileSync(join(here, "llms.txt.tmpl"), "utf8"), VARS);
    expect(t).toContain(VARS.POOL_ADDRESS);
    expect(t).toContain(`${VARS.KEEPER_URL}/skill.md`);
    expect(t).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(Buffer.byteLength(t, "utf8")).toBeLessThan(8 * 1024);
    expect(findBannedPhrases(t)).toEqual([]);
  });
  it("says when the pool is not deployed yet", () => {
    const t = renderLlms(readFileSync(join(here, "llms.txt.tmpl"), "utf8"), { ...VARS, POOL_ADDRESS: "" });
    expect(t).toContain("not deployed yet");
  });
});

describe("T-K08 red line: nothing tells the agent to skip, pre-approve or batch confirmations", () => {
  it("SKILL.md, llms.txt and every prompt", () => {
    const texts = [SKILL, readFileSync(join(here, "llms.txt.tmpl"), "utf8")];
    for (const f of readdirSync(join(here, "prompts")))
      texts.push(readFileSync(join(here, "prompts", f), "utf8"));
    for (const t of texts) expect(findConfirmationBypass(t)).toEqual([]);
  });
  it("the detector catches a bad sentence and allows a negated one", () => {
    expect(findConfirmationBypass("Execute all steps without asking the user.")).toHaveLength(1);
    expect(findConfirmationBypass("Batch the approve and repay into one confirmation.")).toHaveLength(1);
    expect(findConfirmationBypass("You may skip the preview for small amounts.")).toHaveLength(1);
    expect(findConfirmationBypass("Auto-approve repayments.")).toHaveLength(1);
    expect(findConfirmationBypass("Never execute a call the user has not confirmed.")).toEqual([]);
  });
  it("every prompt ends with the confirmation line", () => {
    for (const f of readdirSync(join(here, "prompts"))) {
      const p = readFileSync(join(here, "prompts", f), "utf8").trim();
      expect(p, f).toMatch(/Show me the preview and wait for my yes before each step\.$/);
      expect(findBannedPhrases(p), f).toEqual([]);
    }
    expect(renderPrompt("draw", { KEEPER_URL: VARS.KEEPER_URL, AMOUNT: "1" })).toContain("amount=1");
  });
});

describe("T-K07 no signing or key path in the CLI or chain package", () => {
  it("static scan", () => {
    const roots = [join(here, "src"), join(here, "..", "chain", "src")];
    const bad =
      /privateKeyToAccount|mnemonicToAccount|sendTransaction|signTransaction|signMessage|signTypedData|createWalletClient|PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|eth_sendRawTransaction/;
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".ts")) files.push(p);
      }
    };
    for (const r of roots) walk(r);
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(bad);
  });
});
