// Reads live state from the chain into plain snapshots. Money fields always come from the contract, never from a
// cache. The snapshot is the only input planAction() needs, so the keeper and the CLI give identical answers.

import type { PublicClient } from "viem";
import { rungsPoolAbi } from "./abi/RungsPool";
import { erc20Abi } from "./abi/erc20";
import { registryAbi } from "./abi/registry";
import type { Address } from "./addresses";
import { safeHandle } from "./format";

export interface LineState {
  exists: boolean;
  labelhash: `0x${string}`;
  openedAt: bigint;
  level: number;
  streak: number;
  repaid: number;
  late: number;
  defaults: number;
  frozen: boolean;
  everDrawn: boolean;
}

export interface LoanState {
  principal: bigint;
  fee: bigint;
  drawnAt: bigint;
  dueAt: bigint;
  writtenOff: boolean;
}

export interface PoolState {
  address: Address;
  usdt: Address;
  registry: Address;
  blockNumber: bigint;
  timestamp: bigint;
  paused: boolean;
  idle: bigint;
  reserve: bigint;
  outstanding: bigint;
  totalStaked: bigint;
  totalClaimable: bigint;
  socialisedLoss: bigint;
  maxOutstanding: bigint;
  dailyNewLineCap: number;
  newLinesToday: number;
  reserveTarget: bigint;
  owner: Address;
  pendingCaps: { maxOutstanding: bigint; dailyNewLineCap: number; eta: bigint };
}

export interface Vouch {
  voucher: Address;
  amount: bigint;
}

export interface HolderSnapshot {
  address: Address;
  blockNumber: bigint;
  timestamp: bigint;
  holdsAgentId: boolean;
  /** untrusted user text, control characters removed */
  handle: string | null;
  line: LineState;
  loan: LoanState;
  vouchedFor: bigint;
  claimable: bigint;
  voucheeCount: number;
  /** allowance from this holder to the pool */
  allowance: bigint;
  /** stakes behind this holder */
  vouchesIn: Vouch[];
}

/** Everything the planner needs, read at one block. */
export interface Snapshot {
  pool: PoolState;
  me: HolderSnapshot;
  borrower?: HolderSnapshot;
}

export async function readPool(
  client: PublicClient,
  pool: Address,
  blockNumber?: bigint,
): Promise<PoolState> {
  // One call for number and time, uncached: viem caches getBlockNumber, which goes stale across a reorg.
  const block =
    blockNumber === undefined
      ? await client.getBlock({ blockTag: "latest" })
      : await client.getBlock({ blockNumber });
  const bn = block.number;
  const r = <T>(functionName: string, args: readonly unknown[] = []) =>
    client.readContract({
      address: pool,
      abi: rungsPoolAbi,
      // biome-ignore lint/suspicious/noExplicitAny: names are checked by the ABI at runtime
      functionName: functionName as any,
      // biome-ignore lint/suspicious/noExplicitAny: as above
      args: args as any,
      blockNumber: bn,
    }) as Promise<T>;
  const day = block.timestamp / 86_400n;
  const [usdt, registry, paused, idle, reserve, outstanding, totalStaked, totalClaimable, socialisedLoss] =
    await Promise.all([
      r<Address>("usdt"),
      r<Address>("registry"),
      r<boolean>("paused"),
      r<bigint>("idle"),
      r<bigint>("reserve"),
      r<bigint>("outstanding"),
      r<bigint>("totalStaked"),
      r<bigint>("totalClaimable"),
      r<bigint>("socialisedLoss"),
    ]);
  const [maxOutstanding, dailyNewLineCap, newLinesToday, reserveTarget, owner, pending] = await Promise.all([
    r<bigint>("maxOutstanding"),
    r<number>("dailyNewLineCap"),
    r<number>("newLinesOnDay", [day]),
    r<bigint>("reserveTarget"),
    r<Address>("owner"),
    r<readonly [bigint, number, bigint]>("pendingCaps"),
  ]);
  return {
    address: pool,
    usdt,
    registry,
    blockNumber: bn,
    timestamp: block.timestamp,
    paused,
    idle,
    reserve,
    outstanding,
    totalStaked,
    totalClaimable,
    socialisedLoss,
    maxOutstanding,
    dailyNewLineCap: Number(dailyNewLineCap),
    newLinesToday: Number(newLinesToday),
    reserveTarget,
    owner,
    pendingCaps: { maxOutstanding: pending[0], dailyNewLineCap: Number(pending[1]), eta: pending[2] },
  };
}

export async function readHolder(
  client: PublicClient,
  pool: PoolState,
  holder: Address,
): Promise<HolderSnapshot> {
  const bn = pool.blockNumber;
  const p = { address: pool.address, abi: rungsPoolAbi, blockNumber: bn } as const;
  const [ids, handle, line, loan, vouchedFor, claimable, voucheeCount, allowance, vouchers] =
    await Promise.all([
      client.readContract({
        address: pool.registry,
        abi: registryAbi,
        functionName: "balanceOf",
        args: [holder],
        blockNumber: bn,
      }),
      client.readContract({
        address: pool.registry,
        abi: registryAbi,
        functionName: "handleOf",
        args: [holder],
        blockNumber: bn,
      }),
      client.readContract({ ...p, functionName: "lineOf", args: [holder] }),
      client.readContract({ ...p, functionName: "loanOf", args: [holder] }),
      client.readContract({ ...p, functionName: "vouchedFor", args: [holder] }),
      client.readContract({ ...p, functionName: "claimable", args: [holder] }),
      client.readContract({ ...p, functionName: "voucheeCount", args: [holder] }),
      client.readContract({
        address: pool.usdt,
        abi: erc20Abi,
        functionName: "allowance",
        args: [holder, pool.address],
        blockNumber: bn,
      }),
      client.readContract({ ...p, functionName: "vouchersOf", args: [holder] }),
    ]);
  const stakes = await Promise.all(
    vouchers.map((v) => client.readContract({ ...p, functionName: "stakeOf", args: [v, holder] })),
  );
  const [labelhash, openedAt, level, streak, repaid, late, defaults, frozen, everDrawn] = line;
  const [principal, fee, drawnAt, dueAt, writtenOff] = loan;
  return {
    address: holder,
    blockNumber: bn,
    timestamp: pool.timestamp,
    holdsAgentId: ids > 0n,
    handle: safeHandle(handle),
    line: {
      exists: openedAt !== 0n,
      labelhash,
      openedAt,
      level: Number(level),
      streak: Number(streak),
      repaid: Number(repaid),
      late: Number(late),
      defaults: Number(defaults),
      frozen,
      everDrawn,
    },
    loan: { principal, fee, drawnAt, dueAt, writtenOff },
    vouchedFor,
    claimable,
    voucheeCount: Number(voucheeCount),
    allowance,
    vouchesIn: vouchers.map((voucher, i) => ({ voucher, amount: stakes[i]! })),
  };
}

export async function readSnapshot(
  client: PublicClient,
  pool: Address,
  me: Address,
  borrower?: Address,
): Promise<Snapshot> {
  const ps = await readPool(client, pool);
  const [mine, theirs] = await Promise.all([
    readHolder(client, ps, me),
    borrower ? readHolder(client, ps, borrower) : Promise.resolve(undefined),
  ]);
  return theirs ? { pool: ps, me: mine, borrower: theirs } : { pool: ps, me: mine };
}

/** The public standing views, decoded (T-H02). */
export async function readStanding(client: PublicClient, pool: Address, holder: Address) {
  const p = { address: pool, abi: rungsPoolAbi } as const;
  const [standing, limit, due] = await Promise.all([
    client.readContract({ ...p, functionName: "standingOf", args: [holder] }),
    client.readContract({ ...p, functionName: "limitOf", args: [holder] }),
    client.readContract({ ...p, functionName: "dueOf", args: [holder] }),
  ]);
  return {
    standing,
    limit,
    due: { amount: due[0], dueAt: due[1], phase: due[2] },
  };
}
