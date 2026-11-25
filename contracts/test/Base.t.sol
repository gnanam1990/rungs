// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {LadderLib} from "../src/LadderLib.sol";
import {IRungsStanding} from "../src/IRungsStanding.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {MockHandleRegistry} from "./mocks/MockHandleRegistry.sol";

/// Shared setup: a funded pool, five Agent ID holders and one address without an ID.
abstract contract Base is Test {
    uint256 constant U = 1e18;
    uint256 constant T0 = 1_800_000_000;

    MockUSDT usdt;
    MockHandleRegistry reg;
    RungsPool pool;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address erin = makeAddr("erin");
    address stranger = makeAddr("stranger"); // no Agent ID

    function setUp() public virtual {
        vm.warp(T0);
        usdt = new MockUSDT();
        reg = new MockHandleRegistry();
        pool = new RungsPool(address(usdt), address(reg), owner);
        reg.set(alice, "alice");
        reg.set(bob, "bob");
        reg.set(carol, "carol");
        reg.set(dave, "dave");
        reg.set(erin, "erin");
        address[6] memory people = [alice, bob, carol, dave, erin, stranger];
        for (uint256 i; i < people.length; i++) {
            usdt.mint(people[i], 1_000 * U);
        }
        usdt.mint(owner, 100_000 * U);
        vm.startPrank(owner);
        usdt.approve(address(pool), type(uint256).max);
        pool.fund(1_000 * U);
        pool.setCaps(500 * U, 20);
        vm.stopPrank();
    }

    // ---------- helpers ----------

    function _open(address who) internal {
        vm.prank(who);
        pool.openLine();
    }

    function _draw(address who, uint256 amount) internal {
        vm.prank(who);
        pool.draw(amount);
    }

    function _dueNow(address who) internal view returns (uint256 amount) {
        (amount,,) = pool.dueOf(who);
    }

    /// Approves exactly what is due and repays. Returns the outcome from the event.
    function _repay(address who) internal returns (uint8) {
        return _repayFor(who, who);
    }

    function _repayFor(address payer, address borrower) internal returns (uint8 outcome) {
        uint256 amount = _dueNow(borrower);
        vm.startPrank(payer);
        usdt.approve(address(pool), amount);
        vm.recordLogs();
        if (payer == borrower) pool.repay();
        else pool.repayFor(borrower);
        vm.stopPrank();
        outcome = _lastOutcome();
    }

    function _lastOutcome() internal returns (uint8 outcome) {
        bytes32 topic = keccak256("Repaid(address,address,uint256,uint256,uint256,uint8,uint8)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].topics[0] == topic) {
                (,,, outcome,) = abi.decode(logs[i].data, (uint256, uint256, uint256, uint8, uint8));
            }
        }
    }

    /// Draws the full rung limit, holds a day, repays on time: one qualifying repayment.
    function _qualify(address who) internal returns (uint8) {
        _draw(who, LadderLib.rungLimit(_level(who)));
        vm.warp(block.timestamp + 1 days);
        return _repay(who);
    }

    function _climbTo(address who, uint8 level) internal {
        while (_level(who) < level) {
            _qualify(who);
        }
    }

    function _level(address who) internal view returns (uint8) {
        return pool.standingOf(who).level;
    }

    function _standing(address who) internal view returns (IRungsStanding.Standing memory) {
        return pool.standingOf(who);
    }

    function _loan(address who)
        internal
        view
        returns (uint128 principal, uint128 fee, uint64 drawnAt, uint64 dueAt, bool wo)
    {
        return pool.loanOf(who);
    }

    function _vouch(address voucher, address borrower, uint256 amount) internal {
        vm.startPrank(voucher);
        usdt.approve(address(pool), amount);
        pool.vouch(borrower, amount);
        vm.stopPrank();
    }

    /// Opens, draws and lets the loan pass due + grace, then writes it off.
    function _default(address who, uint256 amount) internal {
        _draw(who, amount);
        vm.warp(block.timestamp + LadderLib.TERM + LadderLib.GRACE + 1);
        pool.writeOff(who);
    }

    function _books() internal view returns (uint256) {
        return pool.idle() + pool.reserve() + pool.totalStaked() + pool.totalClaimable();
    }
}
