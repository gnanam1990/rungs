// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {LadderLib} from "../src/LadderLib.sol";

contract WriteOffTest is Base {
    event WrittenOff(
        address indexed holder, uint256 principal, uint256 slashed, uint256 fromReserve, uint256 socialised
    );

    // ---------- T-P09 ----------

    function test_P09_onlyAfterGrace() public {
        _open(alice);
        _draw(alice, U);
        vm.expectRevert(RungsPool.NotDefaultable.selector);
        pool.writeOff(alice);
        vm.warp(T0 + 7 days + 3 days);
        vm.expectRevert(RungsPool.NotDefaultable.selector);
        pool.writeOff(alice);
        vm.warp(T0 + 7 days + 3 days + 1);
        vm.prank(stranger);
        pool.writeOff(alice);
        assertTrue(_standing(alice).frozen);
        assertEq(_standing(alice).defaults, 1);
        assertEq(pool.outstanding(), 0);
        vm.expectRevert(RungsPool.NotDefaultable.selector);
        pool.writeOff(alice); // twice
        vm.expectRevert(RungsPool.NotDefaultable.selector);
        pool.writeOff(bob); // no loan
    }

    // ---------- T-P10 loss order, no vouchers ----------

    function test_P10_reserveThenSocialised() public {
        _open(alice);
        _open(bob);
        // build a reserve of 0.05 from five fees
        for (uint256 i; i < 5; i++) {
            _draw(bob, U);
            _repay(bob);
        }
        assertEq(pool.reserve(), 5 * U / 100);
        uint256 idleBefore = pool.idle();
        _draw(alice, U);
        vm.warp(block.timestamp + 10 days + 1);
        vm.expectEmit(true, false, false, true);
        emit WrittenOff(alice, U, 0, 5 * U / 100, U - 5 * U / 100);
        pool.writeOff(alice);
        assertEq(pool.reserve(), 0);
        assertEq(pool.socialisedLoss(), U - 5 * U / 100);
        assertEq(pool.idle(), idleBefore - U + 5 * U / 100);
        assertEq(_books(), usdt.balanceOf(address(pool)));
    }

    // ---------- T-P11 cure ----------

    function test_P11_cure() public {
        _open(alice);
        _open(bob);
        for (uint256 i; i < 3; i++) {
            _draw(bob, U);
            _repay(bob);
        }
        uint256 reserveBefore = pool.reserve(); // 0.03
        uint256 idleBefore = pool.idle();
        _climbTo(alice, 3);
        idleBefore = pool.idle();
        reserveBefore = pool.reserve();
        _default(alice, 10 * U);
        uint256 fromReserve = reserveBefore; // reserve < 10
        assertEq(pool.reserve(), 0);
        assertEq(pool.limitOf(alice), 0);

        vm.warp(block.timestamp + 30 days);
        uint256 due = _dueNow(alice);
        assertEq(due, 10 * U + 10 * U / 100 + 10 * U / 100, "principal + fee + late fee");
        (,, uint8 ph) = pool.dueOf(alice);
        assertEq(ph, 4);
        uint256 before = usdt.balanceOf(alice);
        assertEq(_repay(alice), LadderLib.CURED);
        assertEq(before - usdt.balanceOf(alice), due);

        assertFalse(_standing(alice).frozen);
        assertEq(_level(alice), 0);
        assertEq(_standing(alice).defaults, 1, "defaults never go down");
        assertEq(pool.limitOf(alice), U);
        assertEq(pool.socialisedLoss(), 0);
        // reserve gets back what it paid plus the fees (target 50 not reached)
        assertEq(pool.reserve(), fromReserve + 20 * U / 100);
        assertEq(pool.idle(), idleBefore);
        assertEq(_books(), usdt.balanceOf(address(pool)));

        // probation: two qualifying repayments for the next rung
        assertEq(_qualify(alice), LadderLib.ON_TIME);
        assertEq(_qualify(alice), LadderLib.PROMOTED);
    }
}
