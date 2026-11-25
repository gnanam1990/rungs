// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice SPIKE S2 ONLY. NOT PART OF THE RUNGS PRODUCT.
/// Pulls exactly the amount the caller approved and sends it straight back in the same call.
/// Proves that `approve(exact)` then a contract `transferFrom` passes the Agentic Wallet risk engine.
contract Pull {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    event Pulled(address indexed who, uint256 amount);

    error NothingApproved();

    constructor(address token_) {
        token = IERC20(token_);
    }

    function pull() external {
        uint256 amount = token.allowance(msg.sender, address(this));
        if (amount == 0) revert NothingApproved();
        token.safeTransferFrom(msg.sender, address(this), amount);
        token.safeTransfer(msg.sender, amount);
        emit Pulled(msg.sender, amount);
    }
}
