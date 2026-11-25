import { AlertTriangle, Check, Copy, Info, OctagonAlert } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { when, whenUtc } from "../format";
import { onLinkClick } from "../router";
import { S } from "../strings";

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a href={to} onClick={onLinkClick} className={className}>
      {children}
    </a>
  );
}

export function Notice({ kind, children }: { kind: "risk" | "info" | "error"; children: ReactNode }) {
  const Icon = kind === "error" ? OctagonAlert : kind === "risk" ? AlertTriangle : Info;
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "note"}>
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function RiskNotice() {
  return (
    <Notice kind="risk">
      <span data-testid="risk-notice">{S.risk}</span>
    </Notice>
  );
}

/** A horizontally scrolling region (wide tables on phones) that keyboard users can focus and scroll. */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: axe requires scrollable regions to be focusable
    <section className="table-wrap card" tabIndex={0} aria-label={label}>
      {children}
    </section>
  );
}

export function Skeleton({ width = "100%" }: { width?: string }) {
  return <div className="skeleton" style={{ width }} aria-hidden="true" />;
}

export function StatTile({ value, label, to }: { value: string; label: string; to: string }) {
  return (
    <a className="card stat" href={to} onClick={onLinkClick}>
      <span className="num">{value}</span>
      <span className="muted">{label}</span>
    </a>
  );
}

const OUTCOME_KIND = ["", "", "good", "accent", "bad", "good"];
export function OutcomeBadge({ outcome, writtenOff }: { outcome?: number; writtenOff?: boolean }) {
  if (writtenOff) return <span className="badge badge-bad">{S.writtenOff}</span>;
  if (outcome === undefined) return null;
  const kind = OUTCOME_KIND[outcome];
  return <span className={`badge${kind ? ` badge-${kind}` : ""}`}>{S.outcomes[outcome]}</span>;
}

/** Monospace block with a copy button. The text shown is exactly the text copied. */
export function PromptBlock({
  label,
  what,
  text,
  nowrap = false,
}: {
  label: string;
  what: string;
  text: string;
  nowrap?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="prompt">
      <div className="small">
        <strong>{label}</strong> <span className="muted">— {what}</span>
      </div>
      <div className="prompt-box">
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling command must be reachable by keyboard (axe: scrollable-region-focusable) */}
        <pre className={nowrap ? "nowrap" : undefined} tabIndex={0} aria-label={label}>
          {text}
        </pre>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={copy}
          aria-label={`${S.copy.copy}: ${label}`}
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          <span aria-live="polite">{copied ? S.copy.copied : S.copy.copy}</span>
        </button>
      </div>
    </div>
  );
}

export function Time({ unix }: { unix: number }) {
  return (
    <time dateTime={new Date(unix * 1000).toISOString()} title={whenUtc(unix)}>
      {when(unix)}
    </time>
  );
}

export function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = to - now;
  if (left <= 0) return <span className="mono">due now</span>;
  const d = Math.floor(left / 86_400);
  const h = Math.floor((left % 86_400) / 3_600);
  const m = Math.floor((left % 3_600) / 60);
  return <span className="mono">{d > 0 ? `${d}d ${h}h left` : `${h}h ${m}m left`}</span>;
}
