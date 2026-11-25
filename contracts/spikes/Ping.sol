// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice SPIKE S1 ONLY. NOT PART OF THE RUNGS PRODUCT.
/// Proves an Agent ID holder can call a fresh, verified contract through `baw contract-call`.
contract Ping {
    event Pinged(address indexed who);

    function ping() external {
        emit Pinged(msg.sender);
    }
}
