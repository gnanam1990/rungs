// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {LadderLib} from "../src/LadderLib.sol";
import {MockHandleRegistry} from "./mocks/MockHandleRegistry.sol";
import {FeeOnTransferUSDT, ReentrantUSDT} from "./mocks/BadTokens.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PoolTest is Base {
    event LineOpened(address indexed holder, bytes32 indexed labelhash, string handle);
    event Drawn(
        address indexed holder, uint256 principal, uint256 fee, uint64 dueAt, uint8 level, uint256 vouched
    );
    event Repaid(
        address indexed holder,
        address indexed payer,
        uint256 principal,
        uint256 fee,
        uint256 lateFee,
        uint8 outcome,
        uint8 newLevel
    );

    // ---------- T-P01 openLine ----------

    function test_P01_openLine() public {
        vm.prank(stranger);
        vm.expectRevert(RungsPool.NotAgentId.selector);
        pool.openLine();

        vm.expectEmit(true, true, false, true);
        emit LineOpened(alice, keccak256("alice"), "alice");
        _open(alice);
        (bytes32 labelhash, uint64 openedAt,,,,,,,) = pool.lineOf(alice);
        assertEq(labelhash, keccak256(bytes("alice")));
        assertEq(openedAt, T0);
        assertTrue(_standing(alice).hasLine);

        vm.prank(alice);
        vm.expectRevert(RungsPool.LineExists.selector);
        pool.openLine();
    }

    // ---------- T-P02 draw happy path ----------

    function test_P02_draw() public {
        _open(alice);
        uint256 before = usdt.balanceOf(alice);
        vm.expectEmit(true, false, false, true);
        emit Drawn(alice, U, U / 100, uint64(T0 + 7 days), 0, 0);
        _draw(alice, U);
        assertEq(usdt.balanceOf(alice), before + U);
        assertEq(pool.outstanding(), U);
        assertEq(pool.idle(), 999 * U);
        (uint128 p, uint128 f, uint64 drawnAt, uint64 dueAt, bool wo) = _loan(alice);
        assertEq(p, U);
        assertEq(f, U / 100);
        assertEq(drawnAt, T0);
        assertEq(dueAt, T0 + 7 days);
        assertFalse(wo);
        assertTrue(_standing(alice).hasOpenLoan);
        (uint256 amount, uint64 d, uint8 ph) = pool.dueOf(alice);
        assertEq(amount, U + U / 100);
        assertEq(d, T0 + 7 days);
        assertEq(ph, 1);
    }

    // ---------- T-P03 draw reverts ----------

    function test_P03_drawReverts() public {
        vm.prank(alice);
        vm.expectRevert(RungsPool.NoLine.selector);
        pool.draw(U);

        _open(alice);
        vm.prank(alice);
        vm.expectRevert(RungsPool.BelowMin.selector);
        pool.draw(U - 1);

        vm.prank(alice);
        vm.expectRevert(RungsPool.AboveLimit.selector);
        pool.draw(U + 1);

        _draw(alice, U);
        vm.prank(alice);
        vm.expectRevert(RungsPool.LoanOpen.selector);
        pool.draw(U);

        // frozen
        vm.warp(block.timestamp + 10 days + 1);
        pool.writeOff(alice);
        vm.prank(alice);
        vm.expectRevert(RungsPool.Frozen.selector);
        pool.draw(U);

        // paused
        _open(bob);
        vm.prank(owner);
        pool.setPaused(true);
        vm.prank(bob);
        vm.expectRevert(RungsPool.Paused.selector);
        pool.draw(U);
        vm.prank(owner);
        pool.setPaused(false);

        // ID no longer held
        reg.clear(bob);
        vm.prank(bob);
        vm.expectRevert(RungsPool.NotAgentId.selector);
        pool.draw(U);
    }

    function test_P03_poolShortAndCaps() public {
        _open(alice);
        _open(bob);
        vm.startPrank(owner);
        pool.defund(pool.idle());
        vm.stopPrank();
        vm.prank(alice);
        vm.expectRevert(RungsPool.PoolShort.selector);
        pool.draw(U);

        vm.startPrank(owner);
        pool.fund(100 * U);
        pool.setCaps(U, 20); // lowering applies at once
        vm.stopPrank();
        _draw(alice, U);
        vm.prank(bob);
        vm.expectRevert(RungsPool.CapReached.selector);
        pool.draw(U);
    }

    function test_P03_dailyCap() public {
        vm.prank(owner);
        pool.setCaps(500 * U, 1);
        _open(alice);
        _open(bob);
        _draw(alice, U);
        vm.prank(bob);
        vm.expectRevert(RungsPool.DailyCapReached.selector);
        pool.draw(U);
    }

    // ---------- T-P04 daily cap counts first draws only, resets next UTC day ----------

    function test_P04_dailyCapCountsFirstDrawsOnly() public {
        vm.prank(owner);
        pool.setCaps(500 * U, 1);
        _open(alice);
        _open(bob);
        _draw(alice, U);
        assertEq(pool.newLinesOnDay(block.timestamp / 1 days), 1);
        _repay(alice);
        _draw(alice, U); // second draw by alice does not count
        assertEq(pool.newLinesOnDay(block.timestamp / 1 days), 1);
        _repay(alice);
        // next UTC day
        vm.warp((block.timestamp / 1 days + 1) * 1 days);
        _draw(bob, U);
        assertEq(pool.newLinesOnDay(block.timestamp / 1 days), 1);
    }

    // ---------- T-P05 repay outcomes and booking ----------

    function test_P05_outcomes() public {
        _open(alice);
        // EARLY
        _draw(alice, U);
        assertEq(_repay(alice), LadderLib.EARLY);
        assertEq(_level(alice), 0);
        // PROMOTED
        assertEq(_qualify(alice), LadderLib.PROMOTED);
        assertEq(_level(alice), 1);
        // SMALL: 2 of a 5 limit is under half
        _climbTo(alice, 2);
        _draw(alice, 2 * U);
        vm.warp(block.timestamp + 1 days);
        assertEq(_repay(alice), LadderLib.SMALL);
        assertEq(_level(alice), 2);
        // LATE
        _draw(alice, 5 * U);
        vm.warp(block.timestamp + 7 days + 1);
        uint256 dueLate = _dueNow(alice);
        assertEq(dueLate, 5 * U + 5 * U / 100 + 5 * U / 100);
        assertEq(_repay(alice), LadderLib.LATE);
        assertEq(_standing(alice).late, 1);
        assertEq(_level(alice), 2);
        // ON_TIME at top rung
        _climbTo(alice, 6);
        assertEq(_qualify(alice), LadderLib.ON_TIME);
        assertEq(_level(alice), 6);
        assertEq(pool.outstanding(), 0);
    }

    function test_P05_exactPullsAndFeeBooking() public {
        _open(alice);
        _draw(alice, U);
        uint256 balBefore = usdt.balanceOf(alice);
        uint256 poolBefore = usdt.balanceOf(address(pool));
        vm.startPrank(alice);
        usdt.approve(address(pool), U + U / 100);
        vm.expectEmit(true, true, false, true);
        emit Repaid(alice, alice, U, U / 100, 0, LadderLib.EARLY, 0);
        pool.repay();
        vm.stopPrank();
        assertEq(balBefore - usdt.balanceOf(alice), U + U / 100);
        assertEq(usdt.balanceOf(address(pool)) - poolBefore, U + U / 100);
        // reserve target = 10% of 500 = 50; the fee goes to the reserve
        assertEq(pool.reserve(), U / 100);
        assertEq(pool.idle(), 1_000 * U);
        assertEq(_books(), usdt.balanceOf(address(pool)));
    }

    function test_P05_feeOverflowsToIdleAboveTarget() public {
        vm.prank(owner);
        pool.setCaps(1 * U, 20); // target = 0.1 USDT
        _open(alice);
        for (uint256 i; i < 11; i++) {
            _draw(alice, U);
            _repay(alice);
        }
        assertEq(pool.reserve(), U / 10);
        assertEq(pool.idle(), 1_000 * U + U / 100);
    }

    // ---------- T-P06 repayFor ----------

    function test_P06_repayForByThirdParty() public {
        _open(alice);
        _draw(alice, U);
        vm.warp(block.timestamp + 1 days);
        uint256 aliceBefore = usdt.balanceOf(alice);
        assertEq(_repayFor(stranger, alice), LadderLib.PROMOTED);
        assertEq(usdt.balanceOf(alice), aliceBefore, "borrower pays nothing");
        assertEq(_level(alice), 1, "record goes to the borrower");
        assertFalse(_standing(stranger).hasLine);
    }

    function test_P06_repayWithNoLoan() public {
        _open(alice);
        vm.prank(alice);
        vm.expectRevert(RungsPool.NoLoan.selector);
        pool.repay();
    }

    // ---------- T-P07 pull safety ----------

    function test_P07_allowanceExactlyDue() public {
        _open(alice);
        _draw(alice, U);
        uint256 due = _dueNow(alice);
        vm.startPrank(alice);
        usdt.approve(address(pool), due - 1);
        vm.expectRevert();
        pool.repay();
        usdt.approve(address(pool), due);
        pool.repay();
        vm.stopPrank();
        assertEq(usdt.allowance(alice, address(pool)), 0);
    }

    function test_P07_neverTakesMoreThanDue() public {
        _open(alice);
        _draw(alice, U);
        uint256 due = _dueNow(alice);
        uint256 before = usdt.balanceOf(alice);
        vm.startPrank(alice);
        usdt.approve(address(pool), type(uint256).max);
        pool.repay();
        vm.stopPrank();
        assertEq(before - usdt.balanceOf(alice), due);
    }

    // ---------- T-P08 fee-on-transfer ----------

    function test_P08_feeOnTransferReverts() public {
        FeeOnTransferUSDT t = new FeeOnTransferUSDT();
        MockHandleRegistry r = new MockHandleRegistry();
        r.set(alice, "alice");
        RungsPool p = new RungsPool(address(t), address(r), owner);
        t.mint(owner, 100 * U);
        t.mint(alice, 100 * U);
        vm.startPrank(owner);
        t.approve(address(p), type(uint256).max);
        p.fund(50 * U);
        p.setCaps(50 * U, 5);
        vm.stopPrank();
        vm.startPrank(alice);
        p.openLine();
        p.draw(U);
        t.setFee(true);
        t.approve(address(p), type(uint256).max);
        vm.expectRevert(RungsPool.BadTransfer.selector);
        p.repay();
        vm.stopPrank();
        vm.prank(owner);
        vm.expectRevert(RungsPool.BadTransfer.selector);
        p.fund(U);
    }

    // ---------- T-P12 reentrancy ----------

    function test_P12_reentrancyBlocked() public {
        ReentrantUSDT t = new ReentrantUSDT();
        MockHandleRegistry r = new MockHandleRegistry();
        r.set(alice, "alice");
        r.set(bob, "bob");
        RungsPool p = new RungsPool(address(t), address(r), owner);
        t.mint(owner, 100 * U);
        t.mint(alice, 100 * U);
        vm.startPrank(owner);
        t.approve(address(p), type(uint256).max);
        p.fund(50 * U);
        p.setCaps(50 * U, 5);
        vm.stopPrank();
        vm.prank(alice);
        p.openLine();
        vm.prank(bob);
        p.openLine();

        bytes[6] memory calls = [
            abi.encodeCall(RungsPool.draw, (U)),
            abi.encodeCall(RungsPool.repay, ()),
            abi.encodeCall(RungsPool.claim, ()),
            abi.encodeCall(RungsPool.writeOff, (bob)),
            abi.encodeCall(RungsPool.unvouch, (bob, U)),
            abi.encodeCall(RungsPool.openLine, ())
        ];
        for (uint256 i; i < calls.length; i++) {
            t.arm(address(p), calls[i]);
            vm.prank(alice);
            vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
            p.draw(U);
        }
        // and on the pull side
        t.disarm();
        vm.prank(alice);
        p.draw(U);
        vm.prank(alice);
        t.approve(address(p), type(uint256).max);
        t.arm(address(p), abi.encodeCall(RungsPool.draw, (U)));
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        p.repay();
    }

    // ---------- views ----------

    function test_limitOf() public {
        assertEq(pool.limitOf(alice), 0, "no line");
        _open(alice);
        assertEq(pool.limitOf(alice), U);
        _default(alice, U);
        assertEq(pool.limitOf(alice), 0, "frozen");
    }

    function test_reserveTargetView() public view {
        assertEq(pool.reserveTarget(), 50 * U);
    }
}
