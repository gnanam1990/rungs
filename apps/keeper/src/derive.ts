// Rebuilds lines, loans and stakes from the events table by replaying every event in chain order through the
// same ladder math the contract uses (@rungs/core). Deterministic: the same events always give the same tables.

import { safeHandle } from "@rungs/chain";
import { type Line, onRepay, onWriteOff } from "@rungs/core";
import type { DB } from "./db";

interface Row {
  block: number;
  log_index: number;
  time: number;
  name: string;
  holder: string | null;
  actor: string | null;
  json: string;
}

interface LoanRow {
  holder: string;
  seq: number;
  principal: bigint;
  fee: bigint;
  level: number;
  drawnAt: bigint;
  dueAt: bigint;
  closedAt: number | null;
  outcome: number | null;
  writtenOff: boolean;
}

export function rebuildDerived(db: DB): void {
  const events = db.prepare("SELECT * FROM events ORDER BY block, log_index").all() as Row[];
  const lines = new Map<string, Line & { handle: string | null; openedAt: number }>();
  const loans: LoanRow[] = [];
  const openLoan = new Map<string, LoanRow>();
  const stakes = new Map<string, bigint>();
  const key = (v: string, b: string) => `${v}|${b}`;

  for (const e of events) {
    const a = JSON.parse(e.json) as Record<string, string>;
    const h = (e.holder ?? "").toLowerCase();
    switch (e.name) {
      case "LineOpened":
        lines.set(h, {
          level: 0,
          streak: 0,
          repaid: 0,
          late: 0,
          defaults: 0,
          frozen: false,
          handle: safeHandle(a.handle),
          openedAt: e.time,
        });
        break;
      case "Drawn": {
        const seq = loans.filter((l) => l.holder === h).length + 1;
        const loan: LoanRow = {
          holder: h,
          seq,
          principal: BigInt(a.principal!),
          fee: BigInt(a.fee!),
          level: Number(a.level),
          drawnAt: BigInt(e.time),
          dueAt: BigInt(a.dueAt!),
          closedAt: null,
          outcome: null,
          writtenOff: false,
        };
        loans.push(loan);
        openLoan.set(h, loan);
        break;
      }
      case "Repaid": {
        const loan = openLoan.get(h);
        const line = lines.get(h);
        if (!loan || !line) break;
        const r = onRepay(
          line,
          {
            principal: loan.principal,
            fee: loan.fee,
            drawnAt: loan.drawnAt,
            dueAt: loan.dueAt,
            writtenOff: loan.writtenOff,
          },
          BigInt(e.time),
        );
        Object.assign(line, r.line);
        loan.closedAt = e.time;
        loan.outcome = Number(a.outcome);
        openLoan.delete(h);
        break;
      }
      case "WrittenOff": {
        const line = lines.get(h);
        const loan = openLoan.get(h);
        if (line) Object.assign(line, onWriteOff(line));
        if (loan) loan.writtenOff = true;
        break;
      }
      case "Vouched": {
        const k = key((e.actor ?? "").toLowerCase(), h);
        stakes.set(k, (stakes.get(k) ?? 0n) + BigInt(a.amount!));
        break;
      }
      case "Unvouched":
      case "Slashed": {
        const k = key((e.actor ?? "").toLowerCase(), h);
        const left = (stakes.get(k) ?? 0n) - BigInt(a.amount!);
        if (left > 0n) stakes.set(k, left);
        else stakes.delete(k);
        break;
      }
    }
  }

  const write = db.transaction(() => {
    db.prepare("DELETE FROM lines").run();
    db.prepare("DELETE FROM loans").run();
    db.prepare("DELETE FROM stakes").run();
    const insLine = db.prepare(
      "INSERT INTO lines (holder, handle, level, streak, repaid, late, defaults, frozen, opened_at) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    for (const [holder, l] of lines) {
      insLine.run(
        holder,
        l.handle,
        l.level,
        l.streak,
        l.repaid,
        l.late,
        l.defaults,
        l.frozen ? 1 : 0,
        l.openedAt,
      );
    }
    const insLoan = db.prepare(
      "INSERT INTO loans (holder, seq, principal, fee, level, drawn_at, due_at, closed_at, outcome, written_off) VALUES (?,?,?,?,?,?,?,?,?,?)",
    );
    for (const l of loans) {
      insLoan.run(
        l.holder,
        l.seq,
        l.principal.toString(),
        l.fee.toString(),
        l.level,
        Number(l.drawnAt),
        Number(l.dueAt),
        l.closedAt,
        l.outcome,
        l.writtenOff ? 1 : 0,
      );
    }
    const insStake = db.prepare("INSERT INTO stakes (voucher, borrower, amount) VALUES (?,?,?)");
    for (const [k, amount] of stakes) {
      const [v, b] = k.split("|");
      insStake.run(v, b, amount.toString());
    }
  });
  write();
}
