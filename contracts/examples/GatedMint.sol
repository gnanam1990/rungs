// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IRungsStanding} from "../src/IRungsStanding.sol";
import {RungsGate} from "../src/RungsGate.sol";

/// @notice Example: one pass per wallet, only for Rungs holders at rung 1 or higher
///         (they have repaid at least once, on time) and not frozen by a write-off.
contract GatedMint is ERC721, RungsGate {
    uint256 public nextId = 1;
    mapping(address => bool) public minted;

    error AlreadyMinted();

    constructor(IRungsStanding rungs_) ERC721("Rungs Gated Pass", "RGP") RungsGate(rungs_) {}

    function mint() external onlyGoodStanding(1) {
        if (minted[msg.sender]) revert AlreadyMinted();
        minted[msg.sender] = true;
        _mint(msg.sender, nextId++);
    }
}
