// The one next-step card on /line/:address, decided by the API's nextStep.
// Order matters (T-W03): amount, fee, total, due date and the late rule are shown before any command.
// Every command shown is the API's bawPreviewCommand, unchanged (T-W04).

import { parseUsdt } from "@rungs/chain";
import { GRACE, MIN_DRAW, TERM, fee as feeOf, lateFee as lateFeeOf } from "@rungs/core";
import drawTmpl from "@rungs/skill/prompts/draw.md?raw";
import openTmpl from "@rungs/skill/prompts/open.md?raw";
import repayTmpl from "@rungs/skill/prompts/repay.md?raw";
import { fillPrompt } from "@rungs/skill/render";
import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { type ActionReply, KEEPER_URL, type LineResponse, api } from "../api";
import { usdt, when } from "../format";
import { S } from "../strings";
import { Countdown, Notice, PromptBlock, Time } from "./ui";

const prompt = (tmpl: string, vars: Record<string, string> = {}) =>
  fillPrompt(tmpl, { KEEPER_URL, ...vars }).trim();

function useAction(address: string, action: string, params: Record<string, string> | null) {
  const [reply, setReply] = useState<ActionReply | null>(null);
  const key = params ? JSON.stringify(params) : null;
  useEffect(() => {
    if (key === null) return;
    let live = true;
    setReply(null);
    const t = setTimeout(() => {
      api
        .action(address, action, JSON.parse(key))
        .then((r) => live && setReply(r))
        .catch(() => live && setReply({ ok: false, code: "BadInput", reason: S.line.apiDown }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [address, action, key]);
  return reply;
}

function Command({ reply, label }: { reply: ActionReply | null; label: string }) {
  if (!reply) return <div className="skeleton" aria-hidden="true" />;
  if (!reply.ok) return <Notice kind="info">{S.next.refused(reply.reason)}</Notice>;
  return (
    <div className="stack-sm">
      <p className="small">{reply.humanSummary}</p>
      {reply.warnings.map((w) => (
        <p key={w} className="small muted">
          {w}
        </p>
      ))}
      <PromptBlock label={label} what={S.next.whatCommand} text={reply.bawPreviewCommand} nowrap />
    </div>
  );
}

export function NextStepCard({ line }: { line: LineResponse }) {
  switch (line.nextStep) {
    case "claimAgentId":
      return (
        <section className="card card-next" aria-labelledby="next-title">
          <h2 id="next-title" className="next-title">
            <span className="sr-only">Next step: </span>Agent ID
          </h2>
          <p>{S.line.noId}</p>
        </section>
      );
    case "open":
      return <OpenCard line={line} />;
    case "draw":
      return <DrawCard line={line} />;
    case "repay":
    case "cure":
      return <RepayCard line={line} />;
    case "wait":
      return (
        <section className="card card-next" aria-labelledby="next-title">
          <h2 id="next-title" className="next-title">
            Wait
          </h2>
          <p>{S.next.wait}</p>
        </section>
      );
    default:
      return (
        <section className="card" aria-labelledby="next-title">
          <h2 id="next-title" className="next-title">
            {S.next.frozen}
          </h2>
        </section>
      );
  }
}

function OpenCard({ line }: { line: LineResponse }) {
  const reply = useAction(line.address, "open", {});
  return (
    <section className="card card-next stack" aria-labelledby="next-title">
      <h2 id="next-title" className="next-title">
        {S.next.open}
      </h2>
      <p className="muted">{S.next.openBody}</p>
      <PromptBlock label={S.next.agentPrompt} what={S.next.whatPrompt} text={prompt(openTmpl)} />
      <Command reply={reply} label={S.next.cliCommand} />
    </section>
  );
}

function DrawCard({ line }: { line: LineResponse }) {
  const limit = BigInt(line.limit);
  // the server works out what the pool can lend right now; the form never offers more than that
  const cap = BigInt(line.drawNow) < limit ? BigInt(line.drawNow) : limit;
  const partFits = cap < limit;
  const whole = (x: bigint) => usdt(x);
  const [amount, setAmount] = useState(() => whole(cap < MIN_DRAW ? MIN_DRAW : cap));
  const id = useId();
  let wei: bigint | null = null;
  let error: string | null = null;
  try {
    wei = parseUsdt(amount);
    if (wei < MIN_DRAW) error = "The smallest loan is 1 USDT.";
    else if (wei > limit) error = `Your limit is ${usdt(limit)} USDT.`;
    else if (wei > cap) error = S.next.poolCap(usdt(cap));
  } catch {
    error = "Enter an amount like 1 or 2.5.";
  }
  const ok = error === null && wei !== null;
  const now = Math.floor(Date.now() / 1000);
  const dueAt = now + Number(TERM);
  const writeOffAt = dueAt + Number(GRACE) + 1;
  const f = ok ? feeOf(wei!) : 0n;
  const reply = useAction(line.address, "draw", ok ? { amount } : null);
  const step = (d: bigint) => {
    const cur = ok ? wei! : MIN_DRAW;
    let next = cur + d * 10n ** 18n;
    if (next < MIN_DRAW) next = MIN_DRAW;
    if (next > cap) next = cap;
    setAmount(whole(next));
  };
  const earlyLast = line.history.find((h) => h.name === "Repaid")?.text.includes("held under 24 hours");
  return (
    <section className="card card-next stack" aria-labelledby="next-title">
      <h2 id="next-title" className="next-title">
        {S.next.draw}
      </h2>
      {earlyLast && <Notice kind="info">{S.next.earlyNote}</Notice>}
      {partFits && <Notice kind="info">{S.next.partFits(usdt(cap), usdt(limit))}</Notice>}
      <div className="stepper">
        <label htmlFor={id} className="small">
          {S.next.amount}
        </label>
        <div className="stepper-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => step(-1n)}
            aria-label="Borrow 1 USDT less"
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <input
            id={id}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => step(1n)}
            aria-label="Borrow 1 USDT more"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      )}
      <dl className="kv" data-testid="draw-terms">
        <dt>{S.next.amount}</dt>
        <dd>{ok ? `${usdt(wei!)} USDT` : "—"}</dd>
        <dt>{S.next.fee}</dt>
        <dd>{ok ? `${usdt(f)} USDT` : "—"}</dd>
        <dt>{S.next.total}</dt>
        <dd>{ok ? `${usdt(wei! + f)} USDT` : "—"}</dd>
        <dt>{S.next.due}</dt>
        <dd>
          <Time unix={dueAt} />
        </dd>
      </dl>
      {ok && (
        <p className="small" data-testid="late-rule">
          {S.next.lateRule(usdt(lateFeeOf(wei!)), when(writeOffAt))}
        </p>
      )}
      <p className="small muted">{S.next.holdRule}</p>
      {ok && (
        <>
          <PromptBlock
            label={S.next.agentPrompt}
            what={S.next.whatPrompt}
            text={prompt(drawTmpl, { AMOUNT: amount })}
          />
          <Command reply={reply} label={S.next.cliCommand} />
        </>
      )}
    </section>
  );
}

function RepayCard({ line }: { line: LineResponse }) {
  const loan = line.loan!;
  const approve = useAction(line.address, "approve", {});
  const repay = useAction(line.address, "repay", {});
  const bad = loan.phase !== "current";
  const amount = usdt(loan.dueNow);
  let text: React.ReactNode;
  if (line.nextStep === "cure") text = S.next.cure(amount);
  else if (loan.phase === "late") text = S.next.repayLate(amount, when(loan.writeOffAt));
  else if (loan.phase === "defaultable") text = S.next.repayDefaultable(amount);
  else
    text = (
      <>
        You owe <strong className="num">{amount} USDT</strong> by <Time unix={loan.dueAt} /> (your time).
      </>
    );
  return (
    <section className={`card stack ${bad ? "card-bad" : "card-next"}`} aria-labelledby="next-title">
      <h2 id="next-title" className="next-title">
        {line.nextStep === "cure" ? "Cure" : "Repay"}
      </h2>
      <p data-testid="repay-text">{text}</p>
      {loan.phase === "current" && (
        <p className="small muted">
          <Countdown to={loan.dueAt} /> · counts towards the next rung if repaid after{" "}
          <Time unix={loan.promotesAfter} />
        </p>
      )}
      <dl className="kv">
        <dt>Borrowed</dt>
        <dd>{usdt(loan.principal)} USDT</dd>
        <dt>{S.next.fee}</dt>
        <dd>{usdt(loan.fee)} USDT</dd>
        {loan.phase !== "current" && (
          <>
            <dt>Late fee</dt>
            <dd>{usdt(loan.lateFee)} USDT</dd>
          </>
        )}
        <dt>Owed now</dt>
        <dd>{amount} USDT</dd>
      </dl>
      <p className="small">{S.next.repaySteps}</p>
      <PromptBlock label={S.next.agentPrompt} what={S.next.whatPrompt} text={prompt(repayTmpl)} />
      <Command reply={approve} label={`${S.next.cliCommand} (1 of 2: approve)`} />
      <Command reply={repay} label={`${S.next.cliCommand} (2 of 2: repay)`} />
      <p className="small muted">{S.next.someoneElse}</p>
    </section>
  );
}
