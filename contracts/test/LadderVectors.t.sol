// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {LadderLib} from "../src/LadderLib.sol";

/// T-L01 / I10: LadderLib must equal packages/core on every shared vector.
contract LadderVectorsTest is Test {
    string json;

    function setUp() public {
        json = vm.readFile("../docs/build-pack/08-reference/schemas/ladder-vectors.json");
    }

    function _k(string memory list, uint256 i, string memory field) internal pure returns (string memory) {
        return string.concat(".", list, "[", vm.toString(i), "]", bytes(field).length == 0 ? "" : ".", field);
    }

    function _has(string memory list, uint256 i) internal view returns (bool) {
        return vm.keyExistsJson(json, string.concat(".", list, "[", vm.toString(i), "]"));
    }

    function _u(string memory key) internal view returns (uint256) {
        return vm.parseJsonUint(json, key);
    }

    function _state(string memory base) internal view returns (LadderLib.State memory s) {
        s.level = uint8(_u(string.concat(base, ".level")));
        s.streak = uint8(_u(string.concat(base, ".streak")));
        s.repaid = uint16(_u(string.concat(base, ".repaid")));
        s.late = uint16(_u(string.concat(base, ".late")));
        s.defaults = uint16(_u(string.concat(base, ".defaults")));
        s.frozen = vm.parseJsonBool(json, string.concat(base, ".frozen"));
    }

    function _eq(LadderLib.State memory a, LadderLib.State memory b, string memory name) internal pure {
        assertEq(a.level, b.level, string.concat(name, ": level"));
        assertEq(a.streak, b.streak, string.concat(name, ": streak"));
        assertEq(a.repaid, b.repaid, string.concat(name, ": repaid"));
        assertEq(a.late, b.late, string.concat(name, ": late"));
        assertEq(a.defaults, b.defaults, string.concat(name, ": defaults"));
        assertEq(a.frozen, b.frozen, string.concat(name, ": frozen"));
    }

    function test_constants() public view {
        uint256[] memory limits = vm.parseJsonUintArray(json, ".constants.LIMITS");
        assertEq(limits.length, 7);
        for (uint8 i = 0; i < 7; i++) {
            assertEq(LadderLib.rungLimit(i), limits[i]);
        }
        assertEq(LadderLib.UNIT, _u(".constants.UNIT"));
        assertEq(LadderLib.MAX_LEVEL, _u(".constants.MAX_LEVEL"));
        assertEq(LadderLib.MIN_DRAW, _u(".constants.MIN_DRAW"));
        assertEq(LadderLib.TERM, _u(".constants.TERM"));
        assertEq(LadderLib.GRACE, _u(".constants.GRACE"));
        assertEq(LadderLib.MIN_HOLD, _u(".constants.MIN_HOLD"));
        assertEq(LadderLib.FEE_BPS, _u(".constants.FEE_BPS"));
        assertEq(LadderLib.MIN_FEE, _u(".constants.MIN_FEE"));
        assertEq(LadderLib.LATE_FEE_BPS, _u(".constants.LATE_FEE_BPS"));
        assertEq(LadderLib.MAX_VOUCHED, _u(".constants.MAX_VOUCHED"));
        assertEq(LadderLib.MAX_VOUCHERS, _u(".constants.MAX_VOUCHERS"));
        assertEq(LadderLib.MAX_VOUCHEES, _u(".constants.MAX_VOUCHEES"));
        assertEq(LadderLib.MIN_VOUCH_LEVEL, _u(".constants.MIN_VOUCH_LEVEL"));
        assertEq(LadderLib.MIN_STAKE, _u(".constants.MIN_STAKE"));
        assertEq(LadderLib.RESERVE_TARGET_BPS, _u(".constants.RESERVE_TARGET_BPS"));
        assertEq(LadderLib.CAP_RAISE_DELAY, _u(".constants.CAP_RAISE_DELAY"));
    }

    function test_limit() public view {
        uint256 i;
        for (; _has("limit", i); i++) {
            uint8 level = uint8(_u(_k("limit", i, "level")));
            assertEq(LadderLib.limit(level, _u(_k("limit", i, "vouched"))), _u(_k("limit", i, "limit")));
        }
        assertEq(i, 28);
    }

    function test_fee() public view {
        uint256 i;
        for (; _has("fee", i); i++) {
            uint256 p = _u(_k("fee", i, "principal"));
            assertEq(LadderLib.fee(p), _u(_k("fee", i, "fee")));
            assertEq(LadderLib.lateFee(p), _u(_k("fee", i, "lateFee")));
        }
        assertEq(i, 9);
    }

    function test_phase() public view {
        uint256 i;
        for (; _has("phase", i); i++) {
            LadderLib.LoanTerms memory l;
            l.principal = _u(_k("phase", i, "principal"));
            l.dueAt = uint64(_u(_k("phase", i, "dueAt")));
            l.writtenOff = vm.parseJsonBool(json, _k("phase", i, "writtenOff"));
            assertEq(
                LadderLib.phase(l, _u(_k("phase", i, "now"))),
                _u(_k("phase", i, "phase")),
                vm.parseJsonString(json, _k("phase", i, "name"))
            );
        }
        assertEq(i, 7);
    }

    function test_due() public view {
        uint256 i;
        for (; _has("due", i); i++) {
            LadderLib.LoanTerms memory l;
            l.principal = _u(_k("due", i, "principal"));
            l.fee = _u(_k("due", i, "fee"));
            l.dueAt = uint64(_u(_k("due", i, "dueAt")));
            assertEq(LadderLib.due(l, _u(_k("due", i, "now"))), _u(_k("due", i, "due")));
        }
        assertEq(i, 5);
    }

    function test_onRepay() public view {
        uint256 i;
        for (; _has("onRepay", i); i++) {
            string memory name = vm.parseJsonString(json, _k("onRepay", i, "name"));
            LadderLib.State memory s = _state(_k("onRepay", i, "line"));
            LadderLib.LoanTerms memory l;
            l.principal = _u(_k("onRepay", i, "loan.principal"));
            l.drawnAt = uint64(_u(_k("onRepay", i, "loan.drawnAt")));
            l.dueAt = uint64(_u(_k("onRepay", i, "loan.dueAt")));
            l.writtenOff = vm.parseJsonBool(json, _k("onRepay", i, "loan.writtenOff"));
            (LadderLib.State memory got, uint8 outcome) = LadderLib.onRepay(s, l, _u(_k("onRepay", i, "now")));
            _eq(got, _state(_k("onRepay", i, "expect.line")), name);
            assertEq(outcome, _u(_k("onRepay", i, "expect.outcome")), name);
        }
        assertEq(i, 25);
    }

    function test_onWriteOff() public view {
        uint256 i;
        for (; _has("onWriteOff", i); i++) {
            string memory name = vm.parseJsonString(json, _k("onWriteOff", i, "name"));
            _eq(
                LadderLib.onWriteOff(_state(_k("onWriteOff", i, "line"))),
                _state(_k("onWriteOff", i, "expect")),
                name
            );
        }
        assertEq(i, 4);
    }

    function test_slashSplit() public view {
        uint256 i;
        for (; _has("slashSplit", i); i++) {
            string memory name = vm.parseJsonString(json, _k("slashSplit", i, "name"));
            uint256[] memory stakes = vm.parseJsonUintArray(json, _k("slashSplit", i, "stakes"));
            uint256[] memory want = vm.parseJsonUintArray(json, _k("slashSplit", i, "perVoucher"));
            uint256 principal = _u(_k("slashSplit", i, "principal"));
            (uint256[] memory per, uint256 slashed) = LadderLib.slashSplit(principal, stakes);
            assertEq(per.length, want.length, name);
            for (uint256 j; j < per.length; j++) {
                assertEq(per[j], want[j], name);
            }
            assertEq(slashed, _u(_k("slashSplit", i, "slashed")), name);
            assertEq(principal - slashed, _u(_k("slashSplit", i, "uncovered")), name);
        }
        assertEq(i, 8);
    }

    function test_feeSplit() public view {
        uint256 i;
        for (; _has("feeSplit", i); i++) {
            (uint256 toReserve, uint256 toIdle) = LadderLib.feeSplit(
                _u(_k("feeSplit", i, "feeTotal")),
                _u(_k("feeSplit", i, "reserve")),
                _u(_k("feeSplit", i, "reserveTarget"))
            );
            assertEq(toReserve, _u(_k("feeSplit", i, "toReserve")));
            assertEq(toIdle, _u(_k("feeSplit", i, "toIdle")));
        }
        assertEq(i, 6);
    }
}
