// Typed fetchers for the keeper. The only network calls the app makes. No cookies, no credentials.

export const KEEPER_URL = (import.meta.env.VITE_KEEPER_URL || "http://localhost:8787").replace(/\/$/, "");
export const EXPLORER = import.meta.env.VITE_EXPLORER_URL || "https://bscscan.com";
export const REPO_URL = import.meta.env.VITE_REPO_URL || "https://github.com/gnanam1990/rungs";

export interface Site {
  blocked: boolean;
  reason: string | null;
  mode: "live" | "paused" | "comingSoon";
  notice: string | null;
}

export interface LineResponse {
  address: string;
  holdsAgentId: boolean;
  handle: string | null;
  hasLine: boolean;
  standing: {
    level: number;
    streak: number;
    repaid: number;
    late: number;
    defaults: number;
    frozen: boolean;
    need: number;
  } | null;
  limit: string;
  rungLimit: string;
  /** what the pool can lend right now (the limit, cut to the pool's free money and lending cap) */
  drawNow: string;
  vouched: string;
  loan: {
    principal: string;
    fee: string;
    lateFee: string;
    dueNow: string;
    drawnAt: number;
    dueAt: number;
    writeOffAt: number;
    promotesAfter: number;
    phase: "current" | "late" | "defaultable" | "writtenOff";
  } | null;
  nextStep: "claimAgentId" | "open" | "draw" | "repay" | "cure" | "wait" | "none";
  history: { name: string; tx: string; block: number; time: number; text: string }[];
  vouchesIn: { voucher: string; amount: string }[];
  vouchesOut: { borrower: string; amount: string }[];
  claimable: string;
  asOfBlock: number;
}

export type ActionReply =
  | {
      ok: true;
      to: string;
      value: "0";
      data: string;
      humanSummary: string;
      bawPreviewCommand: string;
      warnings: string[];
      then: string | null;
      asOfBlock: number;
    }
  | { ok: false; code: string; reason: string };

interface Counts {
  holders: number;
  linesOpened: number;
  loansDrawn: number;
  repaidOnTime: number;
  repaidLate: number;
  writtenOff: number;
  cured: number;
  promotions: number;
  vouches: number;
  transactions: number;
  volumeDrawn: string;
  byRung: { level: number; holdersNow: number; drawn: number; writtenOff: number; lossPrincipal: string }[];
}

export interface Stats {
  all: Counts;
  excludingTeam: Counts;
  teamWallets?: string[];
  pool: {
    idle: string;
    reserve: string;
    outstanding: string;
    totalStaked: string;
    socialisedLoss: string;
    maxOutstanding: string;
    dailyNewLineCap: number;
    newLinesToday?: number;
    paused: boolean;
    queuedCapRaise: { maxOutstanding: string; dailyNewLineCap: number; eta: string } | null;
  };
  asOfBlock: number;
}

export interface Config {
  chainId: number;
  pool: string | null;
  registry: string | null;
  usdt: string | null;
  owner: string | null;
  deployBlock: number;
  repo: string;
  caps: { maxOutstanding: string; dailyNewLineCap: number; queuedRaise: unknown } | null;
  asOfBlock: number | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${KEEPER_URL}${path}`, {
    credentials: "omit",
    headers: { accept: "application/json" },
  });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      msg = ((await r.json()) as { error?: string }).error ?? msg;
    } catch {}
    throw new ApiError(r.status, msg);
  }
  return (await r.json()) as T;
}

export const api = {
  site: () => get<Site>("/v1/public/site"),
  config: () => get<Config>("/v1/config"),
  stats: () => get<Stats>("/v1/stats"),
  line: (address: string) => get<LineResponse>(`/v1/lines/${address}`),
  action: (address: string, action: string, params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params).toString();
    return get<ActionReply>(`/v1/lines/${address}/actions/${action}${q ? `?${q}` : ""}`);
  },
};

/** localStorage is a convenience only: every access is wrapped. */
export const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
};
