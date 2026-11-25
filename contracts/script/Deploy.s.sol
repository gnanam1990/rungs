// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {RungsPool} from "../src/RungsPool.sol";

/// Deploys RungsPool. Reads USDT_ADDRESS, AGENT_ID_REGISTRY, OWNER_ADDRESS from the environment.
/// The deployer only pays gas: it never owns the pool and never holds pool funds.
/// The initial caps are set by the OWNER after deploy (setCaps is owner-only), e.g. with `cast send`.
contract Deploy is Script {
    function run() external returns (RungsPool pool) {
        address usdt = vm.envAddress("USDT_ADDRESS");
        address registry = vm.envAddress("AGENT_ID_REGISTRY");
        address owner = vm.envAddress("OWNER_ADDRESS");
        require(owner != address(0), "OWNER_ADDRESS");
        require(usdt.code.length > 0 && registry.code.length > 0, "addresses have no code on this chain");

        vm.startBroadcast();
        pool = new RungsPool(usdt, registry, owner);
        vm.stopBroadcast();

        console.log("RungsPool", address(pool));
        console.log("owner", owner);
        console.log("block", block.number);
        console.log(
            "next: the owner calls setCaps(INITIAL_MAX_OUTSTANDING, INITIAL_DAILY_NEW_LINE_CAP) and fund()"
        );
    }
}
