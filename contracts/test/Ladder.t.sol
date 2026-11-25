// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {LadderLib} from "../src/LadderLib.sol";

/// Exposes the internal library so reverts can be tested at a call boundary.
contract LadderHarness {
    function rungLimit(uint8 level) external pure returns (uint256) {
        return LadderLib.rungLimit(level);
    }
}

/// T-L02: LadderLib against a slow reference written differently.
contract LadderTest is Test {
    uint256 constant U = 1e18;

    // ---------- reference, deliberately written another way ----------

    function refLimit(uint8 level, uint256 vouched) internal pure returns (uint256) {
        uint256[7] memory l = [uint256(1), 2, 5, 10, 20, 35, 50];
        uint256 v = vouched;
        if (v > 50 * U) v = 50 * U;
        return l[level] * U + v;
    }

    function refFee(uint256 p) internal pure returns (uint256) {
        // 1% is p/100; floor division is the same as p*100/10000 for all p
        uint256 f = p / 100;
        if (f < U / 100) return U / 100;
        return f;
    }

    function refOnRepay(LadderLib.State memory s, LadderLib.LoanTerms memory l, uint256 t)
        internal
        pure
        returns (LadderLib.State memory r, uint8 outcome)
    {
        r = LadderLib.State(s.level, s.streak, s.repaid, s.late, s.defaults, s.frozen);
        bool onTime = t <= l.dueAt;
        if (l.writtenOff) {
            r.level = 0;
            r.streak = 0;
            r.frozen = false;
            outcome = 5;
        } else if (!onTime) {
            if (r.late < 65535) r.late++;
            r.streak = 0;
            outcome = 4;
        } else {
            if (r.repaid < 65535) r.repaid++;
            bool held = t >= uint256(l.drawnAt) + 1 days;
            uint256 lim = refLimit(r.level, 0);
            bool bigEnough = l.principal >= (lim + 1) / 2 && l.principal * 2 >= lim;
            if (!held) {
                outcome = 0;
            } else if (!bigEnough) {
                outcome = 1;
            } else {
                if (r.streak < 255) r.streak++;
                uint256 needed = r.defaults == 0 ? 1 : (r.defaults == 1 ? 2 : 3);
                if (r.streak >= needed && r.level != 6) {
                    r.level++;
                    r.streak = 0;
                    outcome = 3;
                } else {
                    outcome = 2;
                }
            }
        }
    }

    // ---------- fuzz ----------

    /// forge-config: default.fuzz.runs = 10000
    function testFuzz_limitAndFees(uint8 level, uint256 vouched, uint256 p) public pure {
        level = uint8(bound(level, 0, 6));
        vouched = bound(vouched, 0, 1e30);
        p = bound(p, 0, 1e30);
        assertEq(LadderLib.limit(level, vouched), refLimit(level, vouched));
        assertEq(LadderLib.fee(p), refFee(p));
        assertEq(LadderLib.lateFee(p), p / 100);
    }

    /// forge-config: default.fuzz.runs = 10000
    function testFuzz_onRepay(
        uint8 level,
        uint8 streak,
        uint16 repaid,
        uint16 late,
        uint16 defaults,
        bool writtenOff,
        uint256 principal,
        uint256 dt
    ) public pure {
        LadderLib.State memory s =
            LadderLib.State(uint8(bound(level, 0, 6)), streak, repaid, late, defaults, false);
        LadderLib.LoanTerms memory l;
        l.principal = bound(principal, U, 100 * U);
        l.fee = LadderLib.fee(l.principal);
        l.drawnAt = 1_800_000_000;
        l.dueAt = l.drawnAt + 7 days;
        l.writtenOff = writtenOff;
        uint256 t = l.drawnAt + bound(dt, 0, 30 days);
        (LadderLib.State memory want, uint8 wantOutcome) = refOnRepay(s, l, t);
        LadderLib.State memory copy =
            LadderLib.State(s.level, s.streak, s.repaid, s.late, s.defaults, s.frozen);
        (LadderLib.State memory got, uint8 outcome) = LadderLib.onRepay(copy, l, t);
        assertEq(outcome, wantOutcome);
        assertEq(got.level, want.level);
        assertEq(got.streak, want.streak);
        assertEq(got.repaid, want.repaid);
        assertEq(got.late, want.late);
        assertEq(got.defaults, want.defaults);
        assertEq(got.frozen, want.frozen);
        assertLe(got.level, s.level + 1, "level rises by at most 1");
        assertGe(got.late, s.late);
        assertGe(LadderLib.due(l, t), l.principal + LadderLib.MIN_FEE);
    }

    /// forge-config: default.fuzz.runs = 10000
    function testFuzz_slashSplit(uint256 p, uint256 a, uint256 b, uint256 c, uint8 n) public pure {
        n = uint8(bound(n, 0, 3));
        uint256[] memory stakes = new uint256[](n);
        uint256[3] memory raw = [bound(a, U, 50 * U), bound(b, U, 50 * U), bound(c, U, 50 * U)];
        uint256 total;
        for (uint256 i; i < n; i++) {
            stakes[i] = raw[i];
            total += raw[i];
        }
        p = bound(p, 0, 200 * U);
        (uint256[] memory per, uint256 slashed) = LadderLib.slashSplit(p, stakes);
        uint256 sum;
        for (uint256 i; i < n; i++) {
            assertLe(per[i], stakes[i]);
            sum += per[i];
        }
        assertEq(sum, slashed);
        assertEq(slashed, p < total ? p : total);
    }

    function testFuzz_feeSplit(uint256 f, uint256 reserve, uint256 target) public pure {
        f = bound(f, 0, 1e30);
        reserve = bound(reserve, 0, 1e30);
        target = bound(target, 0, 1e30);
        (uint256 toReserve, uint256 toIdle) = LadderLib.feeSplit(f, reserve, target);
        assertEq(toReserve + toIdle, f);
        if (reserve >= target) assertEq(toReserve, 0);
        else assertLe(reserve + toReserve, target);
    }

    function test_writeOffSaturates() public pure {
        LadderLib.State memory s = LadderLib.State(3, 1, 9, 2, 65535, false);
        s = LadderLib.onWriteOff(s);
        assertEq(s.defaults, 65535);
        assertEq(s.level, 0);
        assertTrue(s.frozen);
    }

    function test_needAndPhaseEdges() public pure {
        assertEq(LadderLib.need(0), 1);
        assertEq(LadderLib.need(1), 2);
        assertEq(LadderLib.need(2), 3);
        assertEq(LadderLib.need(65535), 3);
        LadderLib.LoanTerms memory l;
        assertEq(LadderLib.due(l, 0), 0);
        assertEq(LadderLib.reserveTarget(50 * U), 5 * U);
    }

    function test_rungLimitRejectsLevel7() public {
        LadderHarness h = new LadderHarness();
        vm.expectRevert(LadderLib.BadLevel.selector);
        h.rungLimit(7);
    }
}
