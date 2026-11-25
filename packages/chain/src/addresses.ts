// BNB Chain mainnet addresses. Registry and USDT facts verified by live calls in M01 (see PROVEN.md).

export type Address = `0x${string}`;

export const CHAIN_ID = 56 as const;

export const BSC = Object.freeze({
  chainId: CHAIN_ID,
  agentIdRegistry: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f" as Address,
  usdt: "0x55d398326f99059fF775485246999027B3197955" as Address,
  usdtDecimals: 18,
  /** topic0 of Registered(bytes32 indexed labelhash, address indexed owner, string handle) */
  registeredTopic0: "0x663d34a86c6277aafbd5c6912c96cc5df091e6702ea3ea91b8f378adcbd8a5e5" as `0x${string}`,
  /** Filled in M04 after the mainnet deploy. */
  rungsPool: null as Address | null,
  rungsPoolDeployBlock: null as bigint | null,
  explorer: "https://bscscan.com",
});
