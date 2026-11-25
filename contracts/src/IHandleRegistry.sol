// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice The parts of the Agent ID contract (HandleRegistry, BNB Chain 0x60b9…022f) that Rungs reads.
/// @dev handleOf returns an empty string for an address without an ID; it does not revert.
interface IHandleRegistry {
    function balanceOf(address owner) external view returns (uint256);
    function handleOf(address owner) external view returns (string memory);
    function ownerOfHandle(string calldata handle) external view returns (address);
}
