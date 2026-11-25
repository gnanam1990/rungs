// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title LadderLib
/// @notice The Rungs ladder as pure functions. Mirrors packages/core/src/ladder.ts line by line and is checked
///         against docs/build-pack/08-reference/schemas/ladder-vectors.json (I10). Constants are compile-time:
///         nobody, the owner included, can change them.
library LadderLib {
    uint256 internal constant UNIT = 1e18; // USDT on BNB Chain has 18 decimals
    uint8 internal constant MAX_LEVEL = 6;
    uint256 internal constant MIN_DRAW = 1e18;
    uint256 internal constant TERM = 7 days;
    uint256 internal constant GRACE = 3 days;
    uint256 internal constant MIN_HOLD = 1 days;
    uint256 internal constant BPS = 10_000;
    uint256 internal constant FEE_BPS = 100;
    uint256 internal constant MIN_FEE = 1e16; // 0.01 USDT
    uint256 internal constant LATE_FEE_BPS = 100;
    uint256 internal constant MAX_VOUCHED = 50e18;
    uint256 internal constant MAX_VOUCHERS = 3;
    uint256 internal constant MAX_VOUCHEES = 3;
    uint8 internal constant MIN_VOUCH_LEVEL = 2;
    uint256 internal constant MIN_STAKE = 1e18;
    uint256 internal constant RESERVE_TARGET_BPS = 1_000;
    uint256 internal constant CAP_RAISE_DELAY = 2 days;

    uint8 internal constant EARLY = 0;
    uint8 internal constant SMALL = 1;
    uint8 internal constant ON_TIME = 2;
    uint8 internal constant PROMOTED = 3;
    uint8 internal constant LATE = 4;
    uint8 internal constant CURED = 5;

    uint8 internal constant PHASE_NONE = 0;
    uint8 internal constant PHASE_CURRENT = 1;
    uint8 internal constant PHASE_LATE = 2;
    uint8 internal constant PHASE_DEFAULTABLE = 3;
    uint8 internal constant PHASE_WRITTEN_OFF = 4;

    error BadLevel();

    /// @notice The ladder-relevant part of a line.
    struct State {
        uint8 level;
        uint8 streak;
        uint16 repaid;
        uint16 late;
        uint16 defaults;
        bool frozen;
    }

    /// @notice The ladder-relevant part of a loan.
    struct LoanTerms {
        uint256 principal;
        uint256 fee;
        uint64 drawnAt;
        uint64 dueAt;
        bool writtenOff;
    }

    function rungLimit(uint8 level) internal pure returns (uint256) {
        if (level == 0) return 1e18;
        if (level == 1) return 2e18;
        if (level == 2) return 5e18;
        if (level == 3) return 10e18;
        if (level == 4) return 20e18;
        if (level == 5) return 35e18;
        if (level == 6) return 50e18;
        revert BadLevel();
    }

    /// @notice limit = LIMITS[level] + min(vouched, MAX_VOUCHED)
    function limit(uint8 level, uint256 vouched) internal pure returns (uint256) {
        return rungLimit(level) + (vouched < MAX_VOUCHED ? vouched : MAX_VOUCHED);
    }

    /// @notice fee = max(principal * FEE_BPS / 10_000, MIN_FEE)
    function fee(uint256 principal) internal pure returns (uint256) {
        uint256 f = principal * FEE_BPS / BPS;
        return f > MIN_FEE ? f : MIN_FEE;
    }

    /// @notice lateFee = principal * LATE_FEE_BPS / 10_000 (no minimum)
    function lateFee(uint256 principal) internal pure returns (uint256) {
        return principal * LATE_FEE_BPS / BPS;
    }

    function phase(LoanTerms memory loan, uint256 nowTs) internal pure returns (uint8) {
        if (loan.principal == 0) return PHASE_NONE;
        if (loan.writtenOff) return PHASE_WRITTEN_OFF;
        if (nowTs <= loan.dueAt) return PHASE_CURRENT;
        if (nowTs <= uint256(loan.dueAt) + GRACE) return PHASE_LATE;
        return PHASE_DEFAULTABLE;
    }

    /// @notice due = principal + fee + (now > dueAt ? lateFee : 0); zero with no loan.
    function due(LoanTerms memory loan, uint256 nowTs) internal pure returns (uint256) {
        if (loan.principal == 0) return 0;
        return loan.principal + loan.fee + (nowTs > loan.dueAt ? lateFee(loan.principal) : 0);
    }

    /// @notice Qualifying repayments needed to climb one rung: 1 + min(defaults, 2).
    function need(uint16 defaults) internal pure returns (uint8) {
        return defaults >= 2 ? 3 : uint8(1 + defaults);
    }

    function _inc8(uint8 x) private pure returns (uint8) {
        return x == type(uint8).max ? x : x + 1;
    }

    function _inc16(uint16 x) private pure returns (uint16) {
        return x == type(uint16).max ? x : x + 1;
    }

    /// @notice What a repayment does to a line. Returns the new state and the outcome code.
    function onRepay(State memory s, LoanTerms memory loan, uint256 nowTs)
        internal
        pure
        returns (State memory, uint8 outcome)
    {
        if (loan.writtenOff) {
            s.frozen = false;
            s.level = 0;
            s.streak = 0;
            return (s, CURED);
        }
        if (nowTs > loan.dueAt) {
            s.late = _inc16(s.late);
            s.streak = 0;
            return (s, LATE);
        }
        s.repaid = _inc16(s.repaid);
        if (nowTs - loan.drawnAt < MIN_HOLD) return (s, EARLY);
        if (loan.principal * 2 < rungLimit(s.level)) return (s, SMALL);
        s.streak = _inc8(s.streak);
        if (s.streak >= need(s.defaults) && s.level < MAX_LEVEL) {
            s.level += 1;
            s.streak = 0;
            return (s, PROMOTED);
        }
        return (s, ON_TIME);
    }

    /// @notice A write-off: default counted, back to rung 0, frozen.
    function onWriteOff(State memory s) internal pure returns (State memory) {
        s.defaults = _inc16(s.defaults);
        s.level = 0;
        s.streak = 0;
        s.frozen = true;
        return s;
    }

    /// @notice slashed = min(principal, Σ stakes), pro rata by stake rounding down, remainder to the largest
    ///         stake (the first one on a tie). `stakes` has at most MAX_VOUCHERS entries.
    function slashSplit(uint256 principal, uint256[] memory stakes)
        internal
        pure
        returns (uint256[] memory per, uint256 slashed)
    {
        uint256 n = stakes.length;
        per = new uint256[](n);
        uint256 total = 0;
        for (uint256 i; i < n; i++) {
            total += stakes[i];
        }
        slashed = principal < total ? principal : total;
        if (slashed == 0) return (per, 0);
        uint256 given = 0;
        uint256 big = 0;
        for (uint256 i; i < n; i++) {
            per[i] = slashed * stakes[i] / total;
            given += per[i];
            if (stakes[i] > stakes[big]) big = i;
        }
        per[big] += slashed - given;
    }

    /// @notice Fees fill the reserve up to its target; the rest goes to idle.
    function feeSplit(uint256 feeTotal, uint256 reserve, uint256 target)
        internal
        pure
        returns (uint256 toReserve, uint256 toIdle)
    {
        uint256 room = reserve >= target ? 0 : target - reserve;
        toReserve = feeTotal < room ? feeTotal : room;
        toIdle = feeTotal - toReserve;
    }

    function reserveTarget(uint256 maxOutstanding) internal pure returns (uint256) {
        return maxOutstanding * RESERVE_TARGET_BPS / BPS;
    }
}
