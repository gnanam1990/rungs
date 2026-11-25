// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IRungsStanding
/// @notice The public standing of an Agent ID holder in Rungs. Other contracts can gate on it in one call.
interface IRungsStanding {
    struct Standing {
        bool hasLine;
        uint8 level;
        uint16 repaid;
        uint16 late;
        uint16 defaults;
        bool frozen;
        bool hasOpenLoan;
    }

    /// @notice Line summary for `holder`. All zero if the holder never opened a line.
    function standingOf(address holder) external view returns (Standing memory);

    /// @notice What `holder` could borrow now, ignoring pool liquidity and caps. Zero with no line or when frozen.
    function limitOf(address holder) external view returns (uint256);

    /// @notice Amount due right now, the due time, and the phase (0 none, 1 current, 2 late, 3 defaultable,
    ///         4 written off).
    function dueOf(address holder) external view returns (uint256 amount, uint64 dueAt, uint8 phase);
}
