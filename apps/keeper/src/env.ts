// Keeper configuration from the environment (see .env.example). Parsed once, validated, no secrets needed.

import { BSC } from "@rungs/chain";

export interface KeeperConfig {
  chainId: number;
  rpcUrl: string;
  pool: `0x${string}` | null;
  deployBlock: bigint;
  dbPath: string;
  port: number;
  cycleSeconds: number;
  logChunk: bigint;
  reorgRescanBlocks: bigint;
  teamWallets: string[];
  webOrigin: string;
  publicKeeperUrl: string;
  repoUrl: string;
  rateLimitPerMinute: number;
  blockedCountries: string[];
  countryHeader: string;
  unknownCountryPolicy: "allow" | "block";
  comingSoon: boolean;
  /** the built web app (apps/web/dist) to serve from this process; null = API only */
  webDist: string | null;
}

const addr = (s: string | undefined) => (s && /^0x[0-9a-fA-F]{40}$/.test(s) ? (s as `0x${string}`) : null);
const list = (s: string | undefined) =>
  (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function loadConfig(env: Record<string, string | undefined> = process.env): KeeperConfig {
  return {
    chainId: Number(env.CHAIN_ID ?? BSC.chainId),
    rpcUrl: env.BSC_RPC_URL || "https://bsc-rpc.publicnode.com",
    pool: addr(env.RUNGS_POOL_ADDRESS) ?? BSC.rungsPool,
    deployBlock: BigInt(env.RUNGS_POOL_DEPLOY_BLOCK || BSC.rungsPoolDeployBlock || 0),
    dbPath: env.KEEPER_DB_PATH || "./data/rungs.sqlite",
    port: Number(env.KEEPER_PORT || env.PORT || 8787),
    cycleSeconds: Number(env.KEEPER_CYCLE_SECONDS || 6),
    logChunk: BigInt(env.LOG_CHUNK || 5000),
    reorgRescanBlocks: BigInt(env.REORG_RESCAN_BLOCKS || 30),
    teamWallets: list(env.TEAM_WALLETS)
      .map((x) => x.toLowerCase())
      .filter((x) => addr(x)),
    webOrigin: env.WEB_ORIGIN || "http://localhost:5173",
    publicKeeperUrl: (env.PUBLIC_KEEPER_URL || "http://localhost:8787").replace(/\/$/, ""),
    repoUrl: env.VITE_REPO_URL || env.REPO_URL || "https://github.com/gnanam1990/rungs",
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE || 120),
    blockedCountries: list(env.BLOCKED_COUNTRIES).map((x) => x.toUpperCase()),
    countryHeader: (env.COUNTRY_HEADER || "cf-ipcountry").toLowerCase(),
    unknownCountryPolicy: env.UNKNOWN_COUNTRY_POLICY === "block" ? "block" : "allow",
    comingSoon: env.COMING_SOON === "true",
    webDist: env.WEB_DIST || null,
  };
}
