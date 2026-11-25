// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Base} from "./Base.t.sol";
import {ReadBack} from "../script/ReadBack.s.sol";

contract ReadBackTest is Base {
    function _expected(uint256 maxOut) internal view returns (ReadBack.Expected memory) {
        return ReadBack.Expected(owner, address(usdt), address(reg), maxOut, 20, 1_000 * U);
    }

    function test_readBackPasses() public {
        new ReadBack().check(pool, _expected(500 * U));
    }

    function test_readBackCatchesAMismatch() public {
        ReadBack rb = new ReadBack();
        vm.expectRevert(bytes("maxOutstanding"));
        rb.check(pool, _expected(50 * U));
    }
}
