import { http, type PublicClient, createPublicClient } from "viem";
import { bsc } from "viem/chains";

/** A read-only client. There is no wallet client anywhere in this package. */
export function makeClient(rpcUrl: string): PublicClient {
  return createPublicClient({
    chain: bsc,
    transport: http(rpcUrl, { retryCount: 3, timeout: 20_000 }),
  }) as PublicClient;
}
