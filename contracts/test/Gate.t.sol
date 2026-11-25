// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {RungsGate} from "../src/RungsGate.sol";
import {IRungsStanding} from "../src/IRungsStanding.sol";
import {GatedMint} from "../examples/GatedMint.sol";

contract GateUser is RungsGate {
    uint256 public hits;

    constructor(IRungsStanding rungs_) RungsGate(rungs_) {}

    function atLeast(uint8 minLevel) external onlyGoodStanding(minLevel) {
        hits++;
    }
}

/// T-G01 the modifier, T-G02 the guide's example compiles and works.
contract GateTest is Base {
    GateUser gate;

    function setUp() public override {
        super.setUp();
        gate = new GateUser(IRungsStanding(address(pool)));
    }

    function test_G01_passesAtOrAboveMinLevel() public {
        _open(alice);
        vm.prank(alice);
        gate.atLeast(0);
        _climbTo(alice, 2);
        vm.startPrank(alice);
        gate.atLeast(1);
        gate.atLeast(2);
        vm.expectRevert(abi.encodeWithSelector(RungsGate.NotInGoodStanding.selector, alice, 3));
        gate.atLeast(3);
        vm.stopPrank();
        assertEq(gate.hits(), 3);
    }

    function test_G01_revertsWithoutLine() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(RungsGate.NotInGoodStanding.selector, bob, 0));
        gate.atLeast(0);
    }

    function test_G01_revertsWhenFrozenEvenAtLevelZero() public {
        _open(alice);
        _climbTo(alice, 1);
        _default(alice, 2 * U);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(RungsGate.NotInGoodStanding.selector, alice, 0));
        gate.atLeast(0);
        // a cure restores good standing at rung 0
        _repay(alice);
        vm.prank(alice);
        gate.atLeast(0);
    }

    function test_G02_gatedMintExample() public {
        GatedMint m = new GatedMint(IRungsStanding(address(pool)));
        _open(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(RungsGate.NotInGoodStanding.selector, alice, 1));
        m.mint();
        _climbTo(alice, 1);
        vm.prank(alice);
        m.mint();
        assertEq(m.balanceOf(alice), 1);
        assertEq(m.ownerOf(1), alice);
        vm.prank(alice);
        vm.expectRevert(GatedMint.AlreadyMinted.selector);
        m.mint();
    }
}
