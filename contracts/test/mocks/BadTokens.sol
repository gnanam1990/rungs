// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only token that keeps 1% of every transfer when `feeOn` is set.
contract FeeOnTransferUSDT is ERC20 {
    bool public feeOn;

    constructor() ERC20("Fee USDT", "fUSDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFee(bool on) external {
        feeOn = on;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (feeOn && from != address(0) && to != address(0)) {
            uint256 cut = value / 100;
            super._update(from, address(0xFEE), cut);
            super._update(from, to, value - cut);
        } else {
            super._update(from, to, value);
        }
    }
}

/// @notice Test-only token that calls back into `target` with `data` during the next transfer and bubbles
///         any revert, so a blocked re-entry makes the outer call revert with the guard's error.
contract ReentrantUSDT is ERC20 {
    address public target;
    bytes public data;
    bool public armed;

    constructor() ERC20("Reentrant USDT", "rUSDT") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, bytes calldata data_) external {
        target = target_;
        data = data_;
        armed = true;
    }

    function disarm() external {
        armed = false;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (armed && from != address(0) && to != address(0)) {
            armed = false;
            (bool ok, bytes memory ret) = target.call(data);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
    }
}
