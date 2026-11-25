// Test-only: a local anvil chain with the real RungsPool and mock USDT and registry, deployed from the Foundry
// artifacts. Transactions go from anvil's unlocked dev accounts through eth_sendTransaction: no private key is
// read or stored anywhere. Kept outside src/ so the product code has no signing path (T-K07).

import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  http,
  type Address,
  type PublicClient,
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
} from "viem";
import { rungsPoolAbi } from "../src/abi/RungsPool";
import { erc20Abi } from "../src/abi/erc20";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const U = 10n ** 18n;

export function anvilBinary(): string | null {
  const local = join(homedir(), ".foundry", "bin", process.platform === "win32" ? "anvil.exe" : "anvil");
  if (existsSync(local)) return local;
  const r = spawnSync(process.platform === "win32" ? "where" : "which", ["anvil"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0]!.trim() : null;
}

function artifact(file: string, name: string): { abi: unknown[]; bytecode: `0x${string}` } {
  const j = JSON.parse(readFileSync(join(ROOT, "contracts", "out", file, `${name}.json`), "utf8"));
  return { abi: j.abi, bytecode: j.bytecode.object };
}

const mockRegistryAbi = [
  {
    type: "function",
    name: "set",
    stateMutability: "nonpayable",
    inputs: [
      { name: "who", type: "address" },
      { name: "handle", type: "string" },
    ],
    outputs: [],
  },
] as const;
const mintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export interface LocalChain {
  url: string;
  client: PublicClient;
  accounts: Address[];
  owner: Address;
  holders: Address[];
  stranger: Address;
  pool: Address;
  usdt: Address;
  registry: Address;
  deployBlock: bigint;
  send: (from: Address, to: Address, data: `0x${string}`) => Promise<`0x${string}`>;
  approve: (from: Address, amount: bigint) => Promise<`0x${string}`>;
  call: (from: Address, fn: string, args?: unknown[]) => Promise<`0x${string}`>;
  warp: (seconds: number) => Promise<void>;
  mine: (blocks?: number) => Promise<void>;
  snapshot: () => Promise<`0x${string}`>;
  revert: (id: `0x${string}`) => Promise<void>;
  stop: () => void;
}

export async function startLocalChain(opts: { handles?: string[] } = {}): Promise<LocalChain> {
  const bin = anvilBinary();
  if (!bin) throw new Error("anvil not found: install Foundry");
  const port = 20_000 + Math.floor(Math.random() * 20_000);
  const proc: ChildProcess = spawn(bin, ["--port", String(port), "--silent", "--timestamp", "1800000000"], {
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  const chain = defineChain({
    id: 31337,
    name: "anvil",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  });
  const client = createPublicClient({ chain, transport: http(url) }) as PublicClient;
  for (let i = 0; ; i++) {
    try {
      await client.getChainId();
      break;
    } catch {
      if (i > 100) throw new Error("anvil did not start");
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const wallet = createWalletClient({ chain, transport: http(url) });
  const test = createTestClient({ chain, mode: "anvil", transport: http(url) });
  const accounts = (await wallet.getAddresses()) as Address[];
  const owner = accounts[0]!;

  const deploy = async (file: string, name: string, args: unknown[] = []) => {
    const a = artifact(file, name);
    const hash = await wallet.deployContract({
      // biome-ignore lint/suspicious/noExplicitAny: artifact ABI is untyped JSON
      abi: a.abi as any,
      bytecode: a.bytecode,
      args,
      account: owner,
      chain,
    });
    const r = await client.waitForTransactionReceipt({ hash });
    return r.contractAddress as Address;
  };
  const send = async (from: Address, to: Address, data: `0x${string}`) => {
    const hash = await wallet.sendTransaction({ account: from, to, data, chain });
    const r = await client.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`transaction reverted: ${hash}`);
    return hash;
  };

  const usdt = await deploy("MockUSDT.sol", "MockUSDT");
  const registry = await deploy("MockHandleRegistry.sol", "MockHandleRegistry");
  const pool = await deploy("RungsPool.sol", "RungsPool", [usdt, registry, owner]);
  const deployBlock = await client.getBlockNumber();

  const handles = opts.handles ?? ["dewi", "arun", "mira", "kofi"];
  const holders = accounts.slice(1, 1 + handles.length);
  const stranger = accounts[1 + handles.length]!;
  for (let i = 0; i < holders.length; i++) {
    await send(
      owner,
      registry,
      encodeFunctionData({ abi: mockRegistryAbi, functionName: "set", args: [holders[i]!, handles[i]!] }),
    );
  }
  for (const who of [owner, ...holders, stranger]) {
    await send(
      owner,
      usdt,
      encodeFunctionData({ abi: mintAbi, functionName: "mint", args: [who, 1_000n * U] }),
    );
  }
  const call = (from: Address, fn: string, args: unknown[] = []) =>
    // biome-ignore lint/suspicious/noExplicitAny: test helper over the pool ABI
    send(from, pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: fn as any, args: args as any }));
  const approve = (from: Address, amount: bigint) =>
    send(from, usdt, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [pool, amount] }));

  await approve(owner, 100n * U);
  await call(owner, "fund", [100n * U]);
  await call(owner, "setCaps", [50n * U, 20]);

  return {
    url,
    client,
    accounts,
    owner,
    holders,
    stranger,
    pool,
    usdt,
    registry,
    deployBlock,
    send,
    approve,
    call,
    warp: async (seconds) => {
      await test.increaseTime({ seconds });
      await test.mine({ blocks: 1 });
    },
    mine: async (blocks = 1) => {
      await test.mine({ blocks });
    },
    snapshot: () => test.snapshot(),
    revert: (id) => test.revert({ id }),
    stop: () => {
      proc.kill();
    },
  };
}
