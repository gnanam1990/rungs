// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IHandleRegistry} from "./IHandleRegistry.sol";
import {IRungsStanding} from "./IRungsStanding.sol";
import {LadderLib} from "./LadderLib.sol";

/// @title RungsPool
/// @notice A credit ladder for Agent ID holders. A holder borrows a small amount of USDT with no collateral; each
///         on-time repayment raises their limit. All limits, fees, promotions and write-offs come from LadderLib.
/// @dev No proxy, no upgrade, no oracle, no delegatecall. The owner funds the pool, sets caps (raises are delayed
///      two days) and can pause new risk. The owner cannot touch stakes, claimables, or any holder's wallet,
///      cannot change the ladder constants, and cannot change the terms of an open loan.
contract RungsPool is IRungsStanding, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ types

    struct Line {
        bytes32 labelhash; // keccak256(bytes(handle)) at open
        uint64 openedAt;
        uint8 level;
        uint8 streak;
        uint16 repaid;
        uint16 late;
        uint16 defaults;
        bool frozen;
        bool everDrawn;
    }

    struct Loan {
        uint128 principal;
        uint128 fee;
        uint64 drawnAt;
        uint64 dueAt;
        bool writtenOff;
    }

    /// @notice How a written-off loan's principal was covered, kept so a later cure can restore it in order.
    struct Loss {
        uint128 fromReserve;
        uint128 socialised;
    }

    struct PendingCaps {
        uint256 maxOutstanding;
        uint32 dailyNewLineCap;
        uint64 eta; // 0 = nothing queued
    }

    // ------------------------------------------------------------------ errors

    error NotAgentId();
    error LineExists();
    error NoLine();
    error Frozen();
    error LoanOpen();
    error NoLoan();
    error BelowMin();
    error AboveLimit();
    error PoolShort();
    error CapReached();
    error DailyCapReached();
    error Paused();
    error NotDefaultable();
    error BadTransfer();
    error SelfVouch();
    error VouchLevel();
    error TooManyVouchers();
    error TooManyVouchees();
    error VouchCap();
    error StakeLocked();
    error NothingToClaim();
    error MixedCapChange();
    error NoCapRaiseQueued();
    error CapRaiseTimelocked();
    error RenounceDisabled();

    // ------------------------------------------------------------------ events

    event LineOpened(address indexed holder, bytes32 indexed labelhash, string handle);
    event Drawn(
        address indexed holder, uint256 principal, uint256 fee, uint64 dueAt, uint8 level, uint256 vouched
    );
    event Repaid(
        address indexed holder,
        address indexed payer,
        uint256 principal,
        uint256 fee,
        uint256 lateFee,
        uint8 outcome,
        uint8 newLevel
    );
    event WrittenOff(
        address indexed holder, uint256 principal, uint256 slashed, uint256 fromReserve, uint256 socialised
    );
    event Slashed(address indexed voucher, address indexed holder, uint256 amount);
    event Restored(address indexed voucher, address indexed holder, uint256 amount);
    event Vouched(address indexed voucher, address indexed holder, uint256 amount);
    event Unvouched(address indexed voucher, address indexed holder, uint256 amount);
    event Claimed(address indexed who, uint256 amount);
    event Funded(uint256 amount);
    event Defunded(uint256 amount);
    event ReserveSwept(uint256 amount);
    event CapsSet(uint256 maxOutstanding, uint32 dailyNewLineCap);
    event CapsRaiseQueued(uint256 maxOutstanding, uint32 dailyNewLineCap, uint64 eta);
    event CapsRaiseCancelled();
    event PauseSet(bool paused);

    // ------------------------------------------------------------------ storage

    IERC20 public immutable usdt;
    IHandleRegistry public immutable registry;

    mapping(address => Line) public lineOf;
    mapping(address => Loan) public loanOf;
    mapping(address => Loss) public lossOf;
    mapping(address => mapping(address => uint256)) public stakeOf; // voucher => borrower => amount
    mapping(address => address[]) internal _vouchersOf; // borrower => vouchers with a stake (<= 3)
    mapping(address => uint8) public voucheeCount; // voucher => borrowers backed (<= 3)
    mapping(address => uint256) public vouchedFor; // borrower => total stake
    mapping(address => mapping(address => uint256)) public slashedOwed; // voucher => borrower => to restore on cure
    mapping(address => address[]) internal _slashedBy; // borrower => vouchers slashed by the open write-off
    mapping(address => uint256) public claimable;

    uint256 public idle;
    uint256 public reserve;
    uint256 public outstanding;
    uint256 public totalStaked;
    uint256 public totalClaimable;
    uint256 public socialisedLoss; // unrecovered part of write-offs not covered by stakes or reserve

    uint256 public maxOutstanding;
    uint32 public dailyNewLineCap;
    bool internal _capsInitialised;
    PendingCaps public pendingCaps;
    mapping(uint256 => uint32) public newLinesOnDay; // UTC day index => first-ever draws

    bool public paused;

    // ------------------------------------------------------------------ constructor

    constructor(address usdt_, address registry_, address owner_) Ownable(owner_) {
        usdt = IERC20(usdt_);
        registry = IHandleRegistry(registry_);
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    // ------------------------------------------------------------------ holder actions

    /// @notice Opens a line for the caller. Caller: any Agent ID holder, once. Moves no tokens.
    function openLine() external nonReentrant whenNotPaused {
        if (registry.balanceOf(msg.sender) == 0) revert NotAgentId();
        Line storage ln = lineOf[msg.sender];
        if (ln.openedAt != 0) revert LineExists();
        string memory handle = registry.handleOf(msg.sender);
        if (bytes(handle).length == 0) revert NotAgentId();
        bytes32 labelhash = keccak256(bytes(handle));
        ln.labelhash = labelhash;
        ln.openedAt = uint64(block.timestamp);
        emit LineOpened(msg.sender, labelhash, handle);
    }

    /// @notice Borrows `amount` USDT. Caller: a holder with a line who still holds the ID, is not frozen and has no
    ///         open loan. Moves `amount` from the pool to the caller. Fee and due date are fixed now.
    function draw(uint256 amount) external nonReentrant whenNotPaused {
        Line storage ln = lineOf[msg.sender];
        if (ln.openedAt == 0) revert NoLine();
        if (registry.balanceOf(msg.sender) == 0) revert NotAgentId();
        if (ln.frozen) revert Frozen();
        if (loanOf[msg.sender].principal != 0) revert LoanOpen();
        if (amount < LadderLib.MIN_DRAW) revert BelowMin();
        uint256 vouched = vouchedFor[msg.sender];
        if (amount > LadderLib.limit(ln.level, vouched)) revert AboveLimit();
        if (amount > idle) revert PoolShort();
        if (outstanding + amount > maxOutstanding) revert CapReached();
        if (!ln.everDrawn) {
            uint256 day = block.timestamp / 1 days;
            if (newLinesOnDay[day] >= dailyNewLineCap) revert DailyCapReached();
            newLinesOnDay[day] += 1;
            ln.everDrawn = true;
        }
        uint256 fee = LadderLib.fee(amount);
        uint64 dueAt = uint64(block.timestamp + LadderLib.TERM);
        loanOf[msg.sender] = Loan(uint128(amount), uint128(fee), uint64(block.timestamp), dueAt, false);
        idle -= amount;
        outstanding += amount;
        emit Drawn(msg.sender, amount, fee, dueAt, ln.level, vouched);
        usdt.safeTransfer(msg.sender, amount);
    }

    /// @notice Repays the caller's own loan. See `repayFor`.
    function repay() external nonReentrant {
        _repay(msg.sender);
    }

    /// @notice Repays `borrower`'s loan, or cures it if it was written off. Caller: anyone. Pulls exactly
    ///         `dueOf(borrower)` from the caller (needs an approval of at least that much) and never more.
    ///         The record goes to the borrower. Works while paused.
    function repayFor(address borrower) external nonReentrant {
        _repay(borrower);
    }

    /// @notice Writes off a loan that is past its due date plus grace. Caller: anyone. Takes vouchers' stakes
    ///         first (pro rata), then the reserve; the rest is recorded as socialised loss. Moves no tokens out.
    function writeOff(address borrower) external nonReentrant {
        Loan storage loan = loanOf[borrower];
        if (LadderLib.phase(_terms(loan), block.timestamp) != LadderLib.PHASE_DEFAULTABLE) {
            revert NotDefaultable();
        }
        uint256 principal = loan.principal;
        loan.writtenOff = true;
        _store(borrower, LadderLib.onWriteOff(_state(borrower)));

        uint256 slashed = _slash(borrower, principal);
        uint256 rest = principal - slashed;
        uint256 fromReserve = rest < reserve ? rest : reserve;
        uint256 socialised = rest - fromReserve;
        reserve -= fromReserve;
        idle += slashed + fromReserve;
        socialisedLoss += socialised;
        outstanding -= principal;
        lossOf[borrower] = Loss(uint128(fromReserve), uint128(socialised));
        emit WrittenOff(borrower, principal, slashed, fromReserve, socialised);
    }

    /// @notice Stakes `amount` USDT behind `borrower`, raising their limit. Caller: a holder at rung 2 or higher
    ///         who is not frozen, for a borrower who is not frozen. Pulls `amount` from the caller. The stake is lost
    ///         first if the borrower is written off, and what is left stays locked until the borrower cures.
    function vouch(address borrower, uint256 amount) external nonReentrant whenNotPaused {
        if (borrower == msg.sender) revert SelfVouch();
        if (registry.balanceOf(msg.sender) == 0) revert NotAgentId();
        Line storage me = lineOf[msg.sender];
        if (me.openedAt == 0) revert NoLine();
        if (me.frozen) revert Frozen();
        if (me.level < LadderLib.MIN_VOUCH_LEVEL) revert VouchLevel();
        if (lineOf[borrower].openedAt == 0) revert NoLine();
        if (lineOf[borrower].frozen) revert Frozen(); // a stake there could only sit locked until a cure (M09 F-01)
        if (amount < LadderLib.MIN_STAKE) revert BelowMin();
        if (vouchedFor[borrower] + amount > LadderLib.MAX_VOUCHED) revert VouchCap();
        if (stakeOf[msg.sender][borrower] == 0) {
            if (_vouchersOf[borrower].length >= LadderLib.MAX_VOUCHERS) revert TooManyVouchers();
            if (voucheeCount[msg.sender] >= LadderLib.MAX_VOUCHEES) revert TooManyVouchees();
            _vouchersOf[borrower].push(msg.sender);
            voucheeCount[msg.sender] += 1;
        }
        stakeOf[msg.sender][borrower] += amount;
        vouchedFor[borrower] += amount;
        totalStaked += amount;
        emit Vouched(msg.sender, borrower, amount);
        _pull(msg.sender, amount);
    }

    /// @notice Takes back `amount` of the caller's stake behind `borrower`. Caller: the voucher. Only while the
    ///         borrower has no open loan (a written-off loan counts as open). Sends `amount` to the caller.
    ///         Works while paused.
    function unvouch(address borrower, uint256 amount) external nonReentrant {
        if (amount == 0) revert BelowMin();
        uint256 stake = stakeOf[msg.sender][borrower];
        if (amount > stake) revert AboveLimit();
        if (loanOf[borrower].principal != 0) revert StakeLocked();
        stakeOf[msg.sender][borrower] = stake - amount;
        vouchedFor[borrower] -= amount;
        totalStaked -= amount;
        if (stake == amount) _dropVoucher(msg.sender, borrower);
        emit Unvouched(msg.sender, borrower, amount);
        usdt.safeTransfer(msg.sender, amount);
    }

    /// @notice Pays out what a cure restored to the caller as a voucher. Caller: anyone with a claimable balance.
    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        totalClaimable -= amount;
        emit Claimed(msg.sender, amount);
        usdt.safeTransfer(msg.sender, amount);
    }

    // ------------------------------------------------------------------ owner actions

    /// @notice Owner adds `amount` of lending capital (pulled from the owner) to idle.
    function fund(uint256 amount) external onlyOwner nonReentrant {
        idle += amount;
        emit Funded(amount);
        _pull(msg.sender, amount);
    }

    /// @notice Owner takes back up to `idle`. Can never touch stakes, claimables, the reserve or lent money.
    function defund(uint256 amount) external onlyOwner nonReentrant {
        if (amount > idle) revert PoolShort();
        idle -= amount;
        emit Defunded(amount);
        usdt.safeTransfer(msg.sender, amount);
    }

    /// @notice Owner moves `amount` from the reserve to idle. Only when no loan is outstanding. Moves no tokens.
    function sweepReserve(uint256 amount) external onlyOwner nonReentrant {
        if (outstanding != 0) revert LoanOpen();
        if (amount > reserve) revert PoolShort();
        reserve -= amount;
        idle += amount;
        emit ReserveSwept(amount);
    }

    /// @notice Owner sets the total-outstanding cap and the daily cap on first draws. The first setting and any
    ///         change that raises neither apply at once (and drop a queued raise). A raise is queued for
    ///         CAP_RAISE_DELAY (2 days). Raising one while lowering the other reverts.
    function setCaps(uint256 newMaxOutstanding, uint32 newDailyNewLineCap) external onlyOwner {
        if (!_capsInitialised) {
            _capsInitialised = true;
            _applyCaps(newMaxOutstanding, newDailyNewLineCap);
            return;
        }
        bool raiseMax = newMaxOutstanding > maxOutstanding;
        bool raiseDaily = newDailyNewLineCap > dailyNewLineCap;
        bool lowerMax = newMaxOutstanding < maxOutstanding;
        bool lowerDaily = newDailyNewLineCap < dailyNewLineCap;
        if ((raiseMax && lowerDaily) || (raiseDaily && lowerMax)) revert MixedCapChange();
        if (raiseMax || raiseDaily) {
            uint64 eta = uint64(block.timestamp + LadderLib.CAP_RAISE_DELAY);
            pendingCaps = PendingCaps(newMaxOutstanding, newDailyNewLineCap, eta);
            emit CapsRaiseQueued(newMaxOutstanding, newDailyNewLineCap, eta);
        } else {
            _applyCaps(newMaxOutstanding, newDailyNewLineCap);
        }
    }

    /// @notice Owner applies a queued cap raise once its delay has passed.
    function executeCapsRaise() external onlyOwner {
        PendingCaps memory p = pendingCaps;
        if (p.eta == 0) revert NoCapRaiseQueued();
        if (block.timestamp < p.eta) revert CapRaiseTimelocked();
        _applyCaps(p.maxOutstanding, p.dailyNewLineCap);
    }

    /// @notice Owner drops a queued cap raise.
    function cancelCapsRaise() external onlyOwner {
        if (pendingCaps.eta == 0) revert NoCapRaiseQueued();
        delete pendingCaps;
        emit CapsRaiseCancelled();
    }

    /// @notice Owner pauses or resumes new risk: `openLine`, `draw` and `vouch` only. Repayments, write-offs,
    ///         unvouching and claims always work.
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseSet(paused_);
    }

    /// @notice Disabled: the pool must always have an owner who can pause new risk.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceDisabled();
    }

    // ------------------------------------------------------------------ views

    /// @inheritdoc IRungsStanding
    function standingOf(address holder) external view returns (Standing memory s) {
        Line storage ln = lineOf[holder];
        s.hasLine = ln.openedAt != 0;
        s.level = ln.level;
        s.repaid = ln.repaid;
        s.late = ln.late;
        s.defaults = ln.defaults;
        s.frozen = ln.frozen;
        s.hasOpenLoan = loanOf[holder].principal != 0;
    }

    /// @inheritdoc IRungsStanding
    function limitOf(address holder) external view returns (uint256) {
        Line storage ln = lineOf[holder];
        if (ln.openedAt == 0 || ln.frozen) return 0;
        return LadderLib.limit(ln.level, vouchedFor[holder]);
    }

    /// @inheritdoc IRungsStanding
    function dueOf(address holder) external view returns (uint256 amount, uint64 dueAt, uint8 phase) {
        Loan storage loan = loanOf[holder];
        LadderLib.LoanTerms memory t = _terms(loan);
        return (LadderLib.due(t, block.timestamp), loan.dueAt, LadderLib.phase(t, block.timestamp));
    }

    /// @notice Vouchers currently holding a stake behind `borrower` (at most 3).
    function vouchersOf(address borrower) external view returns (address[] memory) {
        return _vouchersOf[borrower];
    }

    /// @notice Reserve level above which fees go to idle: 10% of maxOutstanding.
    function reserveTarget() external view returns (uint256) {
        return LadderLib.reserveTarget(maxOutstanding);
    }

    // ------------------------------------------------------------------ internals

    function _repay(address borrower) internal {
        Loan memory loan = loanOf[borrower];
        if (loan.principal == 0) revert NoLoan();
        LadderLib.LoanTerms memory t = _terms(loanOf[borrower]);
        uint256 amount = LadderLib.due(t, block.timestamp);
        uint256 late = block.timestamp > loan.dueAt ? LadderLib.lateFee(loan.principal) : 0;

        (LadderLib.State memory s, uint8 outcome) = LadderLib.onRepay(_state(borrower), t, block.timestamp);
        _store(borrower, s);

        if (loan.writtenOff) {
            _restore(borrower);
        } else {
            outstanding -= loan.principal;
            idle += loan.principal;
        }
        (uint256 toReserve, uint256 toIdle) =
            LadderLib.feeSplit(loan.fee + late, reserve, LadderLib.reserveTarget(maxOutstanding));
        reserve += toReserve;
        idle += toIdle;
        delete loanOf[borrower];

        emit Repaid(borrower, msg.sender, loan.principal, loan.fee, late, outcome, s.level);
        _pull(msg.sender, amount);
    }

    /// @dev Cure waterfall for the principal: slashed vouchers first, then the reserve, then idle.
    function _restore(address borrower) internal {
        address[] memory slashedBy = _slashedBy[borrower];
        for (uint256 i; i < slashedBy.length; i++) {
            address v = slashedBy[i];
            uint256 owed = slashedOwed[v][borrower];
            if (owed == 0) continue;
            slashedOwed[v][borrower] = 0;
            claimable[v] += owed;
            totalClaimable += owed;
            emit Restored(v, borrower, owed);
        }
        delete _slashedBy[borrower];
        Loss memory l = lossOf[borrower];
        reserve += l.fromReserve;
        idle += l.socialised;
        socialisedLoss -= l.socialised;
        delete lossOf[borrower];
    }

    /// @dev Takes min(principal, vouchedFor) from the borrower's vouchers, pro rata. Returns the total taken.
    function _slash(address borrower, uint256 principal) internal returns (uint256 slashed) {
        address[] memory vs = _vouchersOf[borrower];
        if (vs.length == 0) return 0;
        uint256[] memory stakes = new uint256[](vs.length);
        for (uint256 i; i < vs.length; i++) {
            stakes[i] = stakeOf[vs[i]][borrower];
        }
        uint256[] memory per;
        (per, slashed) = LadderLib.slashSplit(principal, stakes);
        for (uint256 i; i < vs.length; i++) {
            if (per[i] == 0) continue;
            address v = vs[i];
            stakeOf[v][borrower] = stakes[i] - per[i];
            slashedOwed[v][borrower] += per[i];
            _slashedBy[borrower].push(v);
            emit Slashed(v, borrower, per[i]);
            if (stakes[i] == per[i]) _dropVoucher(v, borrower);
        }
        vouchedFor[borrower] -= slashed;
        totalStaked -= slashed;
    }

    function _dropVoucher(address voucher, address borrower) internal {
        address[] storage list = _vouchersOf[borrower];
        uint256 n = list.length;
        for (uint256 i; i < n; i++) {
            if (list[i] == voucher) {
                list[i] = list[n - 1];
                list.pop();
                break;
            }
        }
        voucheeCount[voucher] -= 1;
    }

    function _applyCaps(uint256 newMaxOutstanding, uint32 newDailyNewLineCap) internal {
        maxOutstanding = newMaxOutstanding;
        dailyNewLineCap = newDailyNewLineCap;
        delete pendingCaps;
        emit CapsSet(newMaxOutstanding, newDailyNewLineCap);
    }

    /// @dev Pulls exactly `amount` from `from` and checks the pool received exactly that.
    function _pull(address from, uint256 amount) internal {
        uint256 before = usdt.balanceOf(address(this));
        usdt.safeTransferFrom(from, address(this), amount);
        if (usdt.balanceOf(address(this)) - before != amount) revert BadTransfer();
    }

    function _terms(Loan storage loan) internal view returns (LadderLib.LoanTerms memory t) {
        t.principal = loan.principal;
        t.fee = loan.fee;
        t.drawnAt = loan.drawnAt;
        t.dueAt = loan.dueAt;
        t.writtenOff = loan.writtenOff;
    }

    function _state(address holder) internal view returns (LadderLib.State memory s) {
        Line storage ln = lineOf[holder];
        s = LadderLib.State(ln.level, ln.streak, ln.repaid, ln.late, ln.defaults, ln.frozen);
    }

    function _store(address holder, LadderLib.State memory s) internal {
        Line storage ln = lineOf[holder];
        ln.level = s.level;
        ln.streak = s.streak;
        ln.repaid = s.repaid;
        ln.late = s.late;
        ln.defaults = s.defaults;
        ln.frozen = s.frozen;
    }
}
