// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {RungsPool} from "../src/RungsPool.sol";

/// M04 read-back: compares the deployed pool with the intended settings. Read-only; reverts on any mismatch.
/// Env: RUNGS_POOL_ADDRESS, OWNER_ADDRESS, USDT_ADDRESS, AGENT_ID_REGISTRY, INITIAL_MAX_OUTSTANDING,
/// INITIAL_DAILY_NEW_LINE_CAP, EXPECTED_IDLE (wei; optional).
contract ReadBack is Script {
    struct Expected {
        address owner;
        address usdt;
        address registry;
        uint256 maxOutstanding;
        uint32 dailyNewLineCap;
        uint256 idle; // type(uint256).max = do not check
    }

    function run() external view {
        check(
            RungsPool(vm.envAddress("RUNGS_POOL_ADDRESS")),
            Expected({
                owner: vm.envAddress("OWNER_ADDRESS"),
                usdt: vm.envAddress("USDT_ADDRESS"),
                registry: vm.envAddress("AGENT_ID_REGISTRY"),
                maxOutstanding: vm.envUint("INITIAL_MAX_OUTSTANDING"),
                dailyNewLineCap: uint32(vm.envUint("INITIAL_DAILY_NEW_LINE_CAP")),
                idle: vm.envOr("EXPECTED_IDLE", type(uint256).max)
            })
        );
    }

    function check(RungsPool pool, Expected memory e) public view {
        require(pool.owner() == e.owner, "owner");
        require(address(pool.usdt()) == e.usdt, "usdt");
        require(address(pool.registry()) == e.registry, "registry");
        require(pool.maxOutstanding() == e.maxOutstanding, "maxOutstanding");
        require(pool.dailyNewLineCap() == e.dailyNewLineCap, "dailyNewLineCap");
        require(!pool.paused(), "paused");
        if (e.idle != type(uint256).max) require(pool.idle() == e.idle, "idle");
        (,, uint64 eta) = pool.pendingCaps();
        console.log("owner", pool.owner());
        console.log("maxOutstanding", pool.maxOutstanding());
        console.log("dailyNewLineCap", pool.dailyNewLineCap());
        console.log("idle", pool.idle());
        console.log("queued raise eta", eta);
        console.log("read-back OK");
    }
}
