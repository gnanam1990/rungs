// Calldata builders. They encode; they never sign or send (T-K07).

import { encodeFunctionData } from "viem";
import { rungsPoolAbi } from "./abi/RungsPool";
import { erc20Abi } from "./abi/erc20";
import type { Address } from "./addresses";

export interface Call {
  to: Address;
  value: "0";
  data: `0x${string}`;
}

const call = (to: Address, data: `0x${string}`): Call => ({ to, value: "0", data });

export const calldata = {
  openLine: (pool: Address) =>
    call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "openLine" })),
  draw: (pool: Address, amount: bigint) =>
    call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "draw", args: [amount] })),
  repay: (pool: Address) => call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "repay" })),
  repayFor: (pool: Address, borrower: Address) =>
    call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "repayFor", args: [borrower] })),
  writeOff: (pool: Address, borrower: Address) =>
    call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "writeOff", args: [borrower] })),
  vouch: (pool: Address, borrower: Address, amount: bigint) =>
    call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "vouch", args: [borrower, amount] })),
  unvouch: (pool: Address, borrower: Address, amount: bigint) =>
    call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "unvouch", args: [borrower, amount] })),
  claim: (pool: Address) => call(pool, encodeFunctionData({ abi: rungsPoolAbi, functionName: "claim" })),
  /** An approval for an exact amount. There is deliberately no helper for an unlimited approval. */
  approve: (token: Address, spender: Address, amount: bigint) =>
    call(token, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] })),
};

/** The exact `baw` preview line for a call (Agentic Wallet CLI, Developer Mode). */
export function bawPreviewCommand(from: Address, c: Call, chainId = 56): string {
  return `baw contract-call preview --binanceChainId ${chainId} --from ${from} --to ${c.to} --value ${c.value} --inputData ${c.data} --json`;
}
