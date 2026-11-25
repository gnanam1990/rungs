// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IRungsStanding} from "./IRungsStanding.sol";

/// @title RungsGate
/// @notice Inherit this to let only Agent ID holders in good standing on Rungs call a function.
/// @dev Good standing = has a line, is not frozen by a write-off, and is at `minLevel` or higher.
///      A rung is a short, small repayment history. It is not a credit score.
abstract contract RungsGate {
    IRungsStanding public immutable rungs;

    error NotInGoodStanding(address who, uint8 minLevel);

    constructor(IRungsStanding rungs_) {
        rungs = rungs_;
    }

    modifier onlyGoodStanding(uint8 minLevel) {
        IRungsStanding.Standing memory s = rungs.standingOf(msg.sender);
        if (!s.hasLine || s.frozen || s.level < minLevel) revert NotInGoodStanding(msg.sender, minLevel);
        _;
    }
}
