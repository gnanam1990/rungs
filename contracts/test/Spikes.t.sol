// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ping} from "../spikes/Ping.sol";
import {Pull} from "../spikes/Pull.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

/// The spike contracts are not part of the product. These tests only prove they do what spikes S1 and S2 need.
contract SpikesTest is Test {
    event Pinged(address indexed who);
    event Pulled(address indexed who, uint256 amount);

    function test_ping_emits() public {
        Ping p = new Ping();
        vm.expectEmit(true, false, false, false);
        emit Pinged(address(this));
        p.ping();
        assertEq(Ping.ping.selector, bytes4(0x5c36b186));
    }

    function test_pull_takesExactAllowanceAndReturnsIt() public {
        MockUSDT usdt = new MockUSDT();
        Pull pull = new Pull(address(usdt));
        address user = makeAddr("user");
        usdt.mint(user, 1e18);
        vm.startPrank(user);
        usdt.approve(address(pull), 1e16);
        vm.expectEmit(true, false, false, true);
        emit Pulled(user, 1e16);
        pull.pull();
        vm.stopPrank();
        assertEq(usdt.balanceOf(user), 1e18);
        assertEq(usdt.allowance(user, address(pull)), 0);
        assertEq(usdt.balanceOf(address(pull)), 0);
    }

    function test_pull_revertsWithoutAllowance() public {
        MockUSDT usdt = new MockUSDT();
        Pull pull = new Pull(address(usdt));
        vm.expectRevert(Pull.NothingApproved.selector);
        pull.pull();
    }
}
