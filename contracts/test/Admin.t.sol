// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AdminTest is Base {
    event CapsSet(uint256 maxOutstanding, uint32 dailyNewLineCap);
    event CapsRaiseQueued(uint256 maxOutstanding, uint32 dailyNewLineCap, uint64 eta);

    // ---------- T-A01 caps ----------

    function test_A01_firstSetIsImmediate() public {
        RungsPool p = new RungsPool(address(usdt), address(reg), owner);
        assertEq(p.maxOutstanding(), 0);
        vm.prank(owner);
        p.setCaps(50 * U, 20);
        assertEq(p.maxOutstanding(), 50 * U);
        assertEq(p.dailyNewLineCap(), 20);
    }

    function test_A01_lowerIsImmediate() public {
        vm.expectEmit(false, false, false, true);
        emit CapsSet(100 * U, 5);
        vm.prank(owner);
        pool.setCaps(100 * U, 5);
        assertEq(pool.maxOutstanding(), 100 * U);
        assertEq(pool.dailyNewLineCap(), 5);
    }

    function test_A01_raiseIsQueued() public {
        vm.expectEmit(false, false, false, true);
        emit CapsRaiseQueued(600 * U, 30, uint64(block.timestamp + 2 days));
        vm.prank(owner);
        pool.setCaps(600 * U, 30);
        assertEq(pool.maxOutstanding(), 500 * U, "not applied yet");
        (uint256 m, uint32 d, uint64 eta) = pool.pendingCaps();
        assertEq(m, 600 * U);
        assertEq(d, 30);
        assertEq(eta, block.timestamp + 2 days);

        vm.warp(block.timestamp + 2 days - 1);
        vm.prank(owner);
        vm.expectRevert(RungsPool.CapRaiseTimelocked.selector);
        pool.executeCapsRaise();

        vm.warp(block.timestamp + 1);
        vm.prank(owner);
        pool.executeCapsRaise();
        assertEq(pool.maxOutstanding(), 600 * U);
        assertEq(pool.dailyNewLineCap(), 30);
        vm.prank(owner);
        vm.expectRevert(RungsPool.NoCapRaiseQueued.selector);
        pool.executeCapsRaise();
    }

    function test_A01_oneRaisedOtherEqualIsQueued() public {
        vm.prank(owner);
        pool.setCaps(500 * U, 21);
        assertEq(pool.dailyNewLineCap(), 20);
    }

    function test_A01_mixedReverts() public {
        vm.startPrank(owner);
        vm.expectRevert(RungsPool.MixedCapChange.selector);
        pool.setCaps(600 * U, 10);
        vm.expectRevert(RungsPool.MixedCapChange.selector);
        pool.setCaps(400 * U, 30);
        vm.stopPrank();
    }

    function test_A01_cancelAndLowerClearsQueue() public {
        vm.startPrank(owner);
        vm.expectRevert(RungsPool.NoCapRaiseQueued.selector);
        pool.cancelCapsRaise();
        pool.setCaps(600 * U, 30);
        pool.cancelCapsRaise();
        (,, uint64 eta) = pool.pendingCaps();
        assertEq(eta, 0);

        pool.setCaps(600 * U, 30);
        pool.setCaps(400 * U, 10); // lowering drops the queued raise
        (,, eta) = pool.pendingCaps();
        assertEq(eta, 0);
        vm.warp(block.timestamp + 3 days);
        vm.expectRevert(RungsPool.NoCapRaiseQueued.selector);
        pool.executeCapsRaise();
        vm.stopPrank();
        assertEq(pool.maxOutstanding(), 400 * U);
    }

    // ---------- T-A02 pause ----------

    function test_A02_pauseBlocksOnlyNewRisk() public {
        _open(alice);
        _open(bob);
        _open(carol);
        _climbTo(carol, 2);
        _vouch(carol, bob, U);
        _draw(alice, U);
        _draw(bob, U);
        _draw(carol, U);

        vm.prank(owner);
        pool.setPaused(true);
        assertTrue(pool.paused());

        vm.prank(dave);
        vm.expectRevert(RungsPool.Paused.selector);
        pool.openLine();
        vm.prank(alice);
        vm.expectRevert(RungsPool.Paused.selector);
        pool.draw(U);
        vm.startPrank(carol);
        usdt.approve(address(pool), U);
        vm.expectRevert(RungsPool.Paused.selector);
        pool.vouch(bob, U);
        vm.stopPrank();

        // I9: these still work
        _repay(alice);
        _repayFor(stranger, bob);
        vm.prank(carol);
        pool.unvouch(bob, U);
        vm.warp(block.timestamp + 10 days + 1);
        pool.writeOff(carol);
        // a cure while paused, then a claim
        _repay(carol);
        assertFalse(_standing(carol).frozen);
    }

    // ---------- T-A03 fund, defund, sweep ----------

    function test_A03_fundDefundSweep() public {
        vm.startPrank(owner);
        pool.fund(10 * U);
        assertEq(pool.idle(), 1_010 * U);
        vm.expectRevert(RungsPool.PoolShort.selector);
        pool.defund(1_010 * U + 1);
        uint256 before = usdt.balanceOf(owner);
        pool.defund(10 * U);
        assertEq(usdt.balanceOf(owner), before + 10 * U);
        vm.stopPrank();

        _open(alice);
        _draw(alice, U);
        vm.prank(owner);
        vm.expectRevert(RungsPool.LoanOpen.selector);
        pool.sweepReserve(1);
        _repay(alice);
        uint256 r = pool.reserve();
        vm.startPrank(owner);
        vm.expectRevert(RungsPool.PoolShort.selector);
        pool.sweepReserve(r + 1);
        pool.sweepReserve(r);
        vm.stopPrank();
        assertEq(pool.reserve(), 0);
        assertEq(pool.idle(), 1_000 * U + r);
    }

    function test_A03_defundCannotTouchStakesOrClaims() public {
        _open(alice);
        _open(bob);
        _climbTo(alice, 2);
        _vouch(alice, bob, 10 * U);
        uint256 idle = pool.idle();
        vm.prank(owner);
        vm.expectRevert(RungsPool.PoolShort.selector);
        pool.defund(idle + 1);
        vm.prank(owner);
        pool.defund(idle);
        assertEq(usdt.balanceOf(address(pool)), pool.reserve() + 10 * U);
        assertEq(pool.totalStaked(), 10 * U);
    }

    // ---------- T-A04 ownership ----------

    function test_A04_ownership() public {
        address next = makeAddr("next");
        vm.prank(owner);
        pool.transferOwnership(next);
        assertEq(pool.owner(), owner);
        vm.prank(next);
        pool.acceptOwnership();
        assertEq(pool.owner(), next);

        vm.prank(next);
        vm.expectRevert(RungsPool.RenounceDisabled.selector);
        pool.renounceOwnership();
    }

    function test_A04_nonOwnerReverts() public {
        bytes[9] memory calls = [
            abi.encodeCall(RungsPool.fund, (U)),
            abi.encodeCall(RungsPool.defund, (U)),
            abi.encodeCall(RungsPool.sweepReserve, (0)),
            abi.encodeCall(RungsPool.setCaps, (1, 1)),
            abi.encodeCall(RungsPool.executeCapsRaise, ()),
            abi.encodeCall(RungsPool.cancelCapsRaise, ()),
            abi.encodeCall(RungsPool.setPaused, (true)),
            abi.encodeCall(RungsPool.renounceOwnership, ()),
            abi.encodeWithSignature("transferOwnership(address)", alice)
        ];
        for (uint256 i; i < calls.length; i++) {
            vm.prank(alice);
            (bool ok, bytes memory ret) = address(pool).call(calls[i]);
            assertFalse(ok);
            assertEq(bytes4(ret), Ownable.OwnableUnauthorizedAccount.selector);
        }
    }

    // ---------- T-A05 ABI snapshot ----------

    function test_A05_abiSnapshot() public view {
        string memory art = vm.readFile("out/RungsPool.sol/RungsPool.json");
        string[] memory got = vm.parseJsonKeys(art, ".methodIdentifiers");
        string[46] memory want = [
            // state-changing: holders and anyone
            "openLine()",
            "draw(uint256)",
            "repay()",
            "repayFor(address)",
            "writeOff(address)",
            "vouch(address,uint256)",
            "unvouch(address,uint256)",
            "claim()",
            // state-changing: owner
            "fund(uint256)",
            "defund(uint256)",
            "sweepReserve(uint256)",
            "setCaps(uint256,uint32)",
            "executeCapsRaise()",
            "cancelCapsRaise()",
            "setPaused(bool)",
            "transferOwnership(address)",
            "acceptOwnership()",
            "renounceOwnership()",
            // views
            "owner()",
            "pendingOwner()",
            "usdt()",
            "registry()",
            "lineOf(address)",
            "loanOf(address)",
            "lossOf(address)",
            "stakeOf(address,address)",
            "vouchersOf(address)",
            "voucheeCount(address)",
            "vouchedFor(address)",
            "slashedOwed(address,address)",
            "claimable(address)",
            "idle()",
            "reserve()",
            "outstanding()",
            "totalStaked()",
            "totalClaimable()",
            "socialisedLoss()",
            "maxOutstanding()",
            "dailyNewLineCap()",
            "newLinesOnDay(uint256)",
            "paused()",
            "pendingCaps()",
            "standingOf(address)",
            "limitOf(address)",
            "dueOf(address)",
            "reserveTarget()"
        ];
        assertEq(got.length, want.length, "unexpected function count");
        for (uint256 i; i < want.length; i++) {
            bool found;
            for (uint256 j; j < got.length; j++) {
                if (keccak256(bytes(got[j])) == keccak256(bytes(want[i]))) found = true;
            }
            assertTrue(found, want[i]);
        }
    }
}
