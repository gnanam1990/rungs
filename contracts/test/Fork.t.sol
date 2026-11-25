// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {LadderLib} from "../src/LadderLib.sol";

/// T-F01, T-F02 on a BNB Chain mainnet fork with the real Agent ID registry and real USDT.
/// Skipped unless BSC_RPC_URL is set.
contract ForkTest is Test {
    address constant REGISTRY = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;
    address constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address constant HOLDER = 0x93A4D88Ae47BD2220e4539491683ca2450B7f904; // handle cxxxz (pack, V2)
    address constant NON_HOLDER = 0x000000000000000000000000000000000000dEaD;

    RungsPool pool;
    IERC20 usdt = IERC20(USDT);
    address owner = makeAddr("owner");

    function setUp() public {
        string memory rpc = vm.envOr("BSC_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpc);
        pool = new RungsPool(USDT, REGISTRY, owner);
        deal(USDT, owner, 50e18);
        vm.startPrank(owner);
        usdt.approve(address(pool), 50e18);
        pool.fund(50e18);
        pool.setCaps(50e18, 20);
        vm.stopPrank();
    }

    function test_F01_realHolderFullCycle() public {
        uint256 before = usdt.balanceOf(HOLDER);
        vm.startPrank(HOLDER);
        pool.openLine();
        (bytes32 labelhash,,,,,,,,) = pool.lineOf(HOLDER);
        assertEq(labelhash, keccak256(bytes("cxxxz")));
        pool.draw(1e18);
        assertEq(usdt.balanceOf(HOLDER), before + 1e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        (uint256 due,,) = pool.dueOf(HOLDER);
        assertEq(due, 1.01e18);
        deal(USDT, HOLDER, usdt.balanceOf(HOLDER) + 1e16); // the fee
        vm.startPrank(HOLDER);
        usdt.approve(address(pool), due);
        pool.repay();
        vm.stopPrank();
        assertEq(usdt.balanceOf(HOLDER), before);
        assertEq(pool.standingOf(HOLDER).level, 1);
        assertEq(pool.idle(), 50e18);
        assertEq(pool.reserve(), 1e16);
        assertEq(usdt.balanceOf(address(pool)), 50e18 + 1e16);
        assertEq(LadderLib.rungLimit(1), pool.limitOf(HOLDER));
    }

    function test_F02_nonHolderRefused() public {
        vm.prank(NON_HOLDER);
        vm.expectRevert(RungsPool.NotAgentId.selector);
        pool.openLine();
    }
}
