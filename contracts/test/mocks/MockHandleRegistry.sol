// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IHandleRegistry} from "../../src/IHandleRegistry.sol";

/// @notice Test-only Agent ID registry: one handle per address, set by the test.
contract MockHandleRegistry is IHandleRegistry {
    mapping(address => string) internal _handle;
    mapping(bytes32 => address) internal _owner;

    function set(address who, string memory handle) external {
        _handle[who] = handle;
        _owner[keccak256(bytes(handle))] = who;
    }

    function clear(address who) external {
        delete _owner[keccak256(bytes(_handle[who]))];
        delete _handle[who];
    }

    function balanceOf(address who) external view returns (uint256) {
        return bytes(_handle[who]).length == 0 ? 0 : 1;
    }

    function handleOf(address who) external view returns (string memory) {
        return _handle[who];
    }

    function ownerOfHandle(string calldata handle) external view returns (address) {
        return _owner[keccak256(bytes(handle))];
    }
}
