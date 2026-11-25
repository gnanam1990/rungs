import { http, createPublicClient, parseAbi } from "viem";
import { bsc } from "viem/chains";

const RUNGS = "0x0000000000000000000000000000000000000000"; // RungsPool address from /v1/config

const abi = parseAbi([
  "struct Standing { bool hasLine; uint8 level; uint16 repaid; uint16 late; uint16 defaults; bool frozen; bool hasOpenLoan; }",
  "function standingOf(address holder) view returns (Standing)",
]);

const client = createPublicClient({ chain: bsc, transport: http("https://bsc-rpc.publicnode.com") });

export async function inGoodStanding(holder: `0x${string}`, minLevel: number): Promise<boolean> {
  const s = await client.readContract({ address: RUNGS, abi, functionName: "standingOf", args: [holder] });
  return s.hasLine && !s.frozen && s.level >= minLevel;
}
