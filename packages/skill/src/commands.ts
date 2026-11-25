// The `rungs` CLI, written as a pure function over injected readers so it can be tested without a chain.
// It prints calls for the holder's agent to preview with `baw`. It never signs and never reads a key.

import {
  ACTIONS,
  type Action,
  type ActionParams,
  type Address,
  type RawLog,
  type Snapshot,
  currentLimit,
  decodePoolLog,
  explainEvent,
  formatUsdt,
  formatUtc,
  isAddress,
  parseUsdt,
  planAction,
  shortAddress,
} from "@rungs/chain";
import { GRACE, MIN_HOLD, need } from "@rungs/core";

export interface CliDeps {
  readSnapshot: (me: Address, borrower?: Address) => Promise<Snapshot>;
  receiptLogs: (txHash: `0x${string}`) => Promise<RawLog[]>;
  chainId: number;
  out: (s: string) => void;
  err: (s: string) => void;
}

const COMMANDS = ["line", "calldata", "explain", "help"] as const;
const FLAGS_WITH_VALUE = new Set(["--amount", "--from", "--borrower", "--purpose"]);
const BOOL_FLAGS = new Set(["--json", "--help", "-h"]);
const NAME_REFUSAL = "Enter a wallet address. Rungs does not look up names.";

export const USAGE = `rungs — print Rungs calls for your agent to preview. This tool never signs and never reads a key.

  rungs line <address> [--json]
      Rung, limit, loan and next step for an address.
  rungs calldata <action> --from <address> [--amount N] [--borrower <address>] [--purpose vouch] [--json]
      action: ${ACTIONS.join(", ")}
      Prints to, data, a plain summary and the exact \`baw contract-call preview\` command.
  rungs explain <txHash>
      Each Rungs event in a transaction as one sentence.

Environment: BSC_RPC_URL (default https://bsc-rpc.publicnode.com), RUNGS_POOL_ADDRESS.
Show every preview to the user and wait for a clear yes before each execute.`;

export interface ParsedArgs {
  cmd?: (typeof COMMANDS)[number];
  positional: string[];
  flags: Record<string, string | true>;
  error?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (FLAGS_WITH_VALUE.has(a)) {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) return { positional, flags, error: `${a} needs a value` };
      flags[a] = v;
      i++;
    } else if (BOOL_FLAGS.has(a)) {
      flags[a] = true;
    } else if (a.startsWith("-")) {
      return { positional, flags, error: `unknown option ${a}` };
    } else {
      positional.push(a);
    }
  }
  if (flags["--help"] || flags["-h"]) return { cmd: "help", positional, flags };
  const first = positional.shift();
  if (first === undefined) return { cmd: "help", positional, flags };
  if (!(COMMANDS as readonly string[]).includes(first))
    return { positional, flags, error: `unknown command ${first}` };
  return { cmd: first as ParsedArgs["cmd"], positional, flags };
}

const json = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);

export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  const p = parseArgs(argv);
  if (p.error) {
    deps.err(`${p.error}\n\n${USAGE}`);
    return 2;
  }
  const asJson = p.flags["--json"] === true;

  if (p.cmd === "help") {
    deps.out(USAGE);
    return 0;
  }

  if (p.cmd === "line") {
    const addr = p.positional[0] ?? "";
    if (!isAddress(addr)) {
      deps.err(NAME_REFUSAL);
      return 2;
    }
    const s = await deps.readSnapshot(addr);
    if (asJson) deps.out(json(s));
    else deps.out(describeLine(s));
    return 0;
  }

  if (p.cmd === "calldata") {
    const action = p.positional[0] as Action | undefined;
    if (!action || !(ACTIONS as readonly string[]).includes(action)) {
      deps.err(`Say which action: ${ACTIONS.join(", ")}.`);
      return 2;
    }
    const from = String(p.flags["--from"] ?? "");
    const borrower = p.flags["--borrower"] === undefined ? undefined : String(p.flags["--borrower"]);
    if (!isAddress(from) || (borrower !== undefined && !isAddress(borrower))) {
      deps.err(NAME_REFUSAL);
      return 2;
    }
    const params: ActionParams = { chainId: deps.chainId };
    if (p.flags["--amount"] !== undefined) {
      try {
        params.amount = parseUsdt(String(p.flags["--amount"]));
      } catch {
        deps.err("Enter an amount in USDT like 1 or 2.5.");
        return 2;
      }
    }
    if (p.flags["--purpose"] === "vouch") params.purpose = "vouch";
    const s = await deps.readSnapshot(from, borrower);
    const r = planAction(action, s, params);
    if (asJson) {
      deps.out(json(r));
      return r.ok ? 0 : 1;
    }
    if (!r.ok) {
      deps.err(`Refused (${r.code}): ${r.reason}`);
      return 1;
    }
    deps.out(
      [
        r.humanSummary,
        ...r.warnings.map((w) => `! ${w}`),
        "",
        `to:    ${r.to}`,
        `value: ${r.value}`,
        `data:  ${r.data}`,
        "",
        "Preview with:",
        `  ${r.bawPreviewCommand}`,
        "",
        "Show this to the user and wait for a clear yes before `baw contract-call execute`.",
        r.then ? `Next action after this one: ${r.then}.` : "",
        `(state read at block ${r.asOfBlock})`,
      ]
        .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
        .join("\n"),
    );
    return 0;
  }

  // explain
  const hash = p.positional[0] ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    deps.err("Enter a transaction hash (0x followed by 64 hex characters).");
    return 2;
  }
  const logs = await deps.receiptLogs(hash as `0x${string}`);
  const lines = logs
    .map(decodePoolLog)
    .filter((e) => e !== null)
    .map((e) => explainEvent(e!));
  deps.out(lines.length ? lines.join("\n") : "There are no Rungs events in this transaction.");
  return 0;
}

function describeLine(s: Snapshot): string {
  const h = s.me;
  const now = s.pool.timestamp;
  const out = [`${h.address}${h.handle ? ` (${h.handle}.ai)` : ""}`];
  if (!h.holdsAgentId) {
    out.push("This address does not hold an Agent ID. Claim one in the Binance App: Wallet → Agent ID.");
    return out.join("\n");
  }
  if (!h.line.exists) {
    out.push("No line yet. next: open");
    return out.join("\n");
  }
  const vouched = h.vouchedFor > 0n ? ` (+${formatUsdt(h.vouchedFor)} vouched)` : "";
  out.push(
    `rung ${h.line.level} · limit ${formatUsdt(currentLimit(h))} USDT${vouched}${h.line.frozen ? " · FROZEN" : ""}`,
    `record: ${h.line.repaid} on time, ${h.line.late} late, ${h.line.defaults} defaults · progress ${h.line.streak} of ${need(h.line.defaults)}`,
  );
  let next = "draw";
  if (h.loan.principal > 0n) {
    const l = h.loan;
    out.push(
      `loan: ${formatUsdt(l.principal)} USDT, due ${formatUtc(l.dueAt)}, write-off possible after ${formatUtc(l.dueAt + GRACE)}`,
      `counts towards the next rung if repaid after ${formatUtc(l.drawnAt + MIN_HOLD)}`,
    );
    next = l.writtenOff ? "cure" : "repay";
  } else if (h.line.frozen) {
    next = "none";
  }
  if (h.claimable > 0n) out.push(`claimable: ${formatUsdt(h.claimable)} USDT`);
  for (const v of h.vouchesIn)
    out.push(`vouched by ${shortAddress(v.voucher)}: ${formatUsdt(v.amount)} USDT`);
  out.push(`next: ${next}`, `(block ${s.pool.blockNumber}, ${formatUtc(now)})`);
  return out.join("\n");
}
