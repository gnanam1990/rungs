import { describe, expect, it } from "vitest";
import { BSC, CHAIN_ID } from "../src/addresses";

describe("addresses (verified in M01)", () => {
  it("chain and token facts", () => {
    expect(CHAIN_ID).toBe(56);
    expect(BSC.agentIdRegistry.toLowerCase()).toBe("0x60b9262456de011f7d15a54cdd8c48baaa8b022f");
    expect(BSC.usdt.toLowerCase()).toBe("0x55d398326f99059ff775485246999027b3197955");
    expect(BSC.usdtDecimals).toBe(18);
    expect(BSC.registeredTopic0).toBe("0x663d34a86c6277aafbd5c6912c96cc5df091e6702ea3ea91b8f378adcbd8a5e5");
  });
  it("pool is not deployed yet (filled in M04)", () => {
    expect(BSC.rungsPool).toBeNull();
    expect(BSC.rungsPoolDeployBlock).toBeNull();
  });
});
