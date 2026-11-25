// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IHandleRegistry} from "../src/IHandleRegistry.sol";

/// Spike S4, kept in CI: re-checks the Agent ID registry facts on a BNB Chain fork.
/// Skipped unless BSC_RPC_URL is set.
contract RegistryForkTest is Test {
    IHandleRegistry constant REG = IHandleRegistry(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);
    address constant HOLDER = 0x93A4D88Ae47BD2220e4539491683ca2450B7f904; // handle cxxxz (pack, V2)
    address constant NON_HOLDER = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        string memory rpc = vm.envOr("BSC_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
    }

    function test_fork_holderFacts() public view {
        assertEq(REG.balanceOf(HOLDER), 1);
        string memory h = REG.handleOf(HOLDER);
        assertEq(h, "cxxxz");
        assertEq(keccak256(bytes(h)), 0x154f9f7f99f6d0f138a908e4c3eb7abffef632bfa03644f6dae9654be23e855c);
        assertEq(REG.ownerOfHandle(h), HOLDER);
        assertEq(HOLDER.code.length, 0, "agentic wallets are plain addresses");
    }

    function test_fork_nonHolderFacts() public view {
        assertEq(REG.balanceOf(NON_HOLDER), 0);
        assertEq(bytes(REG.handleOf(NON_HOLDER)).length, 0, "handleOf returns empty, does not revert");
    }
}
