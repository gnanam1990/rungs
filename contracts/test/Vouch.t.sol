// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {LadderLib} from "../src/LadderLib.sol";

contract VouchTest is Base {
    event Slashed(address indexed voucher, address indexed holder, uint256 amount);

    function _holder(string memory name) internal returns (address who) {
        who = makeAddr(name);
        reg.set(who, name);
        usdt.mint(who, 1_000 * U);
        _open(who);
    }

    function _voucherAt2(string memory name) internal returns (address who) {
        who = _holder(name);
        _climbTo(who, 2);
    }

    // ---------- T-V01 rules ----------

    function test_V01_rules() public {
        _open(alice);
        _open(bob);
        vm.startPrank(alice);
        usdt.approve(address(pool), type(uint256).max);
        vm.expectRevert(RungsPool.VouchLevel.selector);
        pool.vouch(bob, U);
        vm.stopPrank();

        _climbTo(alice, 2);
        vm.startPrank(alice);
        usdt.approve(address(pool), type(uint256).max);
        vm.expectRevert(RungsPool.SelfVouch.selector);
        pool.vouch(alice, U);
        vm.expectRevert(RungsPool.NoLine.selector);
        pool.vouch(carol, U);
        vm.expectRevert(RungsPool.BelowMin.selector);
        pool.vouch(bob, U - 1);
        vm.expectRevert(RungsPool.VouchCap.selector);
        pool.vouch(bob, 50 * U + 1);
        pool.vouch(bob, 50 * U);
        vm.expectRevert(RungsPool.VouchCap.selector);
        pool.vouch(bob, U);
        vm.stopPrank();

        _open(carol);
        vm.prank(owner);
        pool.setPaused(true);
        vm.prank(alice);
        vm.expectRevert(RungsPool.Paused.selector);
        pool.vouch(carol, U);
        vm.prank(owner);
        pool.setPaused(false);

        vm.prank(stranger);
        vm.expectRevert(RungsPool.NotAgentId.selector);
        pool.vouch(bob, U);
    }

    function test_V01_frozenVoucher() public {
        _open(alice);
        _open(bob);
        _climbTo(alice, 2);
        _default(alice, U);
        vm.startPrank(alice);
        usdt.approve(address(pool), U);
        vm.expectRevert(RungsPool.Frozen.selector);
        pool.vouch(bob, U);
        vm.stopPrank();
    }

    function test_V01_counts() public {
        address v1 = _voucherAt2("v1");
        address v2 = _voucherAt2("v2");
        address v3 = _voucherAt2("v3");
        address v4 = _voucherAt2("v4");
        _open(alice);
        _vouch(v1, alice, U);
        _vouch(v2, alice, U);
        _vouch(v3, alice, U);
        vm.startPrank(v4);
        usdt.approve(address(pool), U);
        vm.expectRevert(RungsPool.TooManyVouchers.selector);
        pool.vouch(alice, U);
        vm.stopPrank();
        _vouch(v1, alice, U); // topping up an existing stake does not use a slot
        assertEq(pool.vouchersOf(alice).length, 3);

        _open(bob);
        _open(carol);
        _open(dave);
        _open(erin);
        _vouch(v4, bob, U);
        _vouch(v4, carol, U);
        _vouch(v4, dave, U);
        vm.startPrank(v4);
        usdt.approve(address(pool), U);
        vm.expectRevert(RungsPool.TooManyVouchees.selector);
        pool.vouch(erin, U);
        vm.stopPrank();
        assertEq(pool.voucheeCount(v4), 3);
    }

    // ---------- T-V02 limit with stake ----------

    function test_V02_vouchedDraw() public {
        address v1 = _voucherAt2("v1");
        _open(alice);
        _vouch(v1, alice, 7 * U);
        assertEq(pool.limitOf(alice), 8 * U);
        vm.prank(alice);
        vm.expectRevert(RungsPool.AboveLimit.selector);
        pool.draw(8 * U + 1);
        _draw(alice, 8 * U);
        assertEq(pool.vouchedFor(alice), 7 * U);
    }

    // ---------- T-V03 unvouch ----------

    function test_V03_unvouch() public {
        address v1 = _voucherAt2("v1");
        _open(alice);
        _vouch(v1, alice, 4 * U);
        _draw(alice, U);
        vm.prank(v1);
        vm.expectRevert(RungsPool.StakeLocked.selector);
        pool.unvouch(alice, U);
        _repay(alice);

        uint256 before = usdt.balanceOf(v1);
        vm.prank(v1);
        pool.unvouch(alice, U);
        assertEq(usdt.balanceOf(v1), before + U);
        assertEq(pool.stakeOf(v1, alice), 3 * U);
        assertEq(pool.vouchersOf(alice).length, 1);

        vm.prank(v1);
        vm.expectRevert(RungsPool.AboveLimit.selector);
        pool.unvouch(alice, 3 * U + 1);
        vm.prank(v1);
        vm.expectRevert(RungsPool.BelowMin.selector);
        pool.unvouch(alice, 0);

        vm.prank(v1);
        pool.unvouch(alice, 3 * U);
        assertEq(pool.vouchersOf(alice).length, 0);
        assertEq(pool.voucheeCount(v1), 0);
        assertEq(pool.vouchedFor(alice), 0);
        assertEq(pool.totalStaked(), 0);
    }

    function test_V03_unvouchBlockedWhileWrittenOff() public {
        address v1 = _voucherAt2("v1");
        _open(alice);
        _vouch(v1, alice, 4 * U);
        _default(alice, 2 * U);
        // stake was 4, 2 slashed; the written-off loan still counts as open
        vm.prank(v1);
        vm.expectRevert(RungsPool.StakeLocked.selector);
        pool.unvouch(alice, U);
    }

    // ---------- T-V04 slashing ----------

    function test_V04_oneVoucher() public {
        address v1 = _voucherAt2("v1");
        _open(alice);
        _vouch(v1, alice, 4 * U);
        uint256 reserveBefore = pool.reserve();
        _default(alice, 5 * U);
        assertEq(pool.stakeOf(v1, alice), 0);
        assertEq(pool.slashedOwed(v1, alice), 4 * U);
        assertEq(pool.vouchersOf(alice).length, 0, "emptied stake leaves the list");
        assertEq(pool.voucheeCount(v1), 0);
        // 1 left: from reserve first
        uint256 fromReserve = reserveBefore < U ? reserveBefore : U;
        assertEq(pool.reserve(), reserveBefore - fromReserve);
        assertEq(pool.socialisedLoss(), U - fromReserve);
    }

    function test_V04_threeVouchersProRata() public {
        address v1 = _voucherAt2("v1");
        address v2 = _voucherAt2("v2");
        address v3 = _voucherAt2("v3");
        _open(alice);
        _vouch(v1, alice, 1 * U);
        _vouch(v2, alice, 2 * U);
        _vouch(v3, alice, 4 * U + 3);
        // limit = 1 + 7.000000000000000003; draw 5 + 1 wei
        uint256 p = 5 * U + 1;
        _draw(alice, p);
        uint256 total = 7 * U + 3;
        uint256 s1 = p * (1 * U) / total;
        uint256 s2 = p * (2 * U) / total;
        uint256 s3 = p * (4 * U + 3) / total;
        uint256 rem = p - s1 - s2 - s3;
        vm.warp(block.timestamp + 10 days + 1);
        vm.prank(stranger);
        pool.writeOff(alice);
        assertEq(pool.slashedOwed(v1, alice), s1);
        assertEq(pool.slashedOwed(v2, alice), s2);
        assertEq(pool.slashedOwed(v3, alice), s3 + rem, "remainder to the largest");
        assertEq(s1 + s2 + s3 + rem, p);
        assertEq(pool.vouchedFor(alice), total - p);
        assertEq(pool.totalStaked(), total - p);
        assertEq(pool.socialisedLoss(), 0);
        assertEq(pool.vouchersOf(alice).length, 3, "partly slashed stakes stay");
    }

    function test_V04_twoVouchers() public {
        address v1 = _voucherAt2("v1");
        address v2 = _voucherAt2("v2");
        _open(alice);
        _vouch(v1, alice, 3 * U);
        _vouch(v2, alice, 3 * U);
        _draw(alice, 7 * U);
        vm.warp(block.timestamp + 10 days + 1);
        vm.expectEmit(true, true, false, true);
        emit Slashed(v1, alice, 3 * U);
        vm.expectEmit(true, true, false, true);
        emit Slashed(v2, alice, 3 * U);
        pool.writeOff(alice);
        assertEq(pool.vouchedFor(alice), 0);
    }

    // ---------- T-V05 cure restores vouchers first ----------

    function test_V05_cureRestoresVouchers() public {
        address v1 = _voucherAt2("v1");
        address v2 = _voucherAt2("v2");
        _open(alice);
        _vouch(v1, alice, 2 * U);
        _vouch(v2, alice, 1 * U);
        uint256 reserveBefore = pool.reserve();
        _default(alice, 4 * U);
        assertEq(pool.slashedOwed(v1, alice), 2 * U);
        assertEq(pool.slashedOwed(v2, alice), 1 * U);

        uint8 outcome = _repay(alice); // cure
        assertEq(outcome, LadderLib.CURED);
        assertEq(pool.claimable(v1), 2 * U);
        assertEq(pool.claimable(v2), 1 * U);
        assertEq(pool.slashedOwed(v1, alice), 0);
        assertEq(pool.totalClaimable(), 3 * U);
        assertGe(pool.reserve(), reserveBefore, "reserve restored");
        assertEq(pool.socialisedLoss(), 0);

        uint256 before = usdt.balanceOf(v1);
        vm.prank(v1);
        pool.claim();
        assertEq(usdt.balanceOf(v1), before + 2 * U);
        vm.prank(v1);
        vm.expectRevert(RungsPool.NothingToClaim.selector);
        pool.claim();
        assertEq(_books(), usdt.balanceOf(address(pool)));
    }
}
