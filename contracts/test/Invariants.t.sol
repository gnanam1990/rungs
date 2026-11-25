// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {LadderLib} from "../src/LadderLib.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {MockHandleRegistry} from "./mocks/MockHandleRegistry.sol";

/// Drives the pool with valid calls only. Every call made here is expected to succeed, so the invariant run uses
/// fail_on_revert: a revert in a path that should work (for example a repayment while paused) fails the run.
contract Handler is Test {
    uint256 constant U = 1e18;

    RungsPool public pool;
    MockUSDT public usdt;
    address public owner;
    address public payer = makeAddr("payer-no-id");
    address[5] public actors;

    // ghosts
    bool public capBroken; // I3
    bool public frozenDrew; // I4
    bool public ownerReached; // I6
    bool public pullBroken; // I7
    bool public recordBroken; // I8
    mapping(address => uint16) public lastDefaults;
    mapping(address => uint16) public lastLate;
    mapping(bytes32 => uint256) public calls;

    constructor(RungsPool pool_, MockUSDT usdt_, address owner_, address[5] memory actors_) {
        pool = pool_;
        usdt = usdt_;
        owner = owner_;
        actors = actors_;
    }

    // ---------------------------------------------------------------- helpers

    function _a(uint256 i) internal view returns (address) {
        return actors[i % actors.length];
    }

    function _line(address a)
        internal
        view
        returns (bool has, uint8 level, uint16 late, uint16 defaults, bool frozen, bool everDrawn)
    {
        (, uint64 openedAt, uint8 lv,,, uint16 lt, uint16 df, bool fz, bool ed) = pool.lineOf(a);
        return (openedAt != 0, lv, lt, df, fz, ed);
    }

    function _principal(address a) internal view returns (uint256 p) {
        (p,,,,) = pool.loanOf(a);
    }

    function _fund(address who, uint256 amount) internal {
        if (usdt.balanceOf(who) < amount) usdt.mint(who, amount);
        vm.prank(who);
        usdt.approve(address(pool), amount);
    }

    function _afterEach() internal {
        for (uint256 i; i < actors.length; i++) {
            (,, uint16 late, uint16 defaults,,) = _line(actors[i]);
            if (late < lastLate[actors[i]] || defaults < lastDefaults[actors[i]]) recordBroken = true;
            lastLate[actors[i]] = late;
            lastDefaults[actors[i]] = defaults;
        }
    }

    struct Snap {
        uint256 staked;
        uint256 claimable;
        uint256[6] bal;
    }

    function _snap() internal view returns (Snap memory s) {
        s.staked = pool.totalStaked();
        s.claimable = pool.totalClaimable();
        for (uint256 i; i < actors.length; i++) {
            s.bal[i] = usdt.balanceOf(actors[i]);
        }
        s.bal[5] = usdt.balanceOf(payer);
    }

    function _sameReach(Snap memory a, Snap memory b) internal pure returns (bool) {
        if (a.staked != b.staked || a.claimable != b.claimable) return false;
        for (uint256 i; i < 6; i++) {
            if (a.bal[i] != b.bal[i]) return false;
        }
        return true;
    }

    // ---------------------------------------------------------------- holder actions

    function open(uint256 i) external {
        address a = _a(i);
        (bool has,,,,,) = _line(a);
        if (has || pool.paused()) return;
        vm.prank(a);
        pool.openLine();
        calls["open"]++;
        _afterEach();
    }

    function draw(uint256 i, uint256 amount) external {
        address a = _a(i);
        (bool has,,,, bool frozen, bool everDrawn) = _line(a);
        if (!has || pool.paused() || _principal(a) != 0) return;
        if (frozen) {
            vm.prank(a);
            try pool.draw(U) {
                frozenDrew = true;
            } catch {}
            return;
        }
        uint256 lim = pool.limitOf(a);
        amount = bound(amount, U, lim);
        if (amount > pool.idle() || pool.outstanding() + amount > pool.maxOutstanding()) return;
        if (!everDrawn && pool.newLinesOnDay(block.timestamp / 1 days) >= pool.dailyNewLineCap()) return;
        vm.prank(a);
        pool.draw(amount);
        if (pool.outstanding() > pool.maxOutstanding()) capBroken = true;
        calls["draw"]++;
        _afterEach();
    }

    function repay(uint256 i, bool byPayer) external {
        address a = _a(i);
        if (_principal(a) == 0) return;
        (uint256 due,,) = pool.dueOf(a);
        address from = byPayer ? payer : a;
        _fund(from, due);
        // the payer approves more than due: the pool must still take exactly due
        vm.prank(from);
        usdt.approve(address(pool), due + 7);
        Snap memory before = _snap();
        (, uint8 levelBefore,,,,) = _line(a);
        vm.prank(from);
        if (byPayer) pool.repayFor(a);
        else pool.repay();
        Snap memory afterS = _snap();
        uint256 fromIdx = byPayer ? 5 : i % actors.length;
        for (uint256 k; k < 6; k++) {
            uint256 want = k == fromIdx ? before.bal[k] - due : before.bal[k];
            if (afterS.bal[k] != want) pullBroken = true;
        }
        (, uint8 levelAfter,,,,) = _line(a);
        if (levelAfter > levelBefore + 1) recordBroken = true;
        calls[byPayer ? bytes32("repayFor") : bytes32("repay")]++;
        _afterEach();
    }

    /// A qualifying cycle in one step, so actors reach the vouching rung within a run.
    function climb(uint256 i) external {
        address a = _a(i);
        (bool has, uint8 level,,, bool frozen, bool everDrawn) = _line(a);
        if (!has || frozen || pool.paused() || _principal(a) != 0) return;
        uint256 amount = LadderLib.rungLimit(level);
        if (amount > pool.idle() || pool.outstanding() + amount > pool.maxOutstanding()) return;
        if (!everDrawn && pool.newLinesOnDay(block.timestamp / 1 days) >= pool.dailyNewLineCap()) return;
        vm.prank(a);
        pool.draw(amount);
        vm.warp(block.timestamp + 1 days);
        (uint256 due,,) = pool.dueOf(a);
        _fund(a, due);
        vm.prank(a);
        pool.repay();
        calls["climb"]++;
        _afterEach();
    }

    /// A vouched borrower draws, defaults, is written off and (optionally) cures, from whatever state the run is
    /// in. Exercises slashing, the cure waterfall and claims, which random steps rarely line up.
    function slashCycle(uint256 i, uint256 amount, bool cure) external {
        if (pool.paused()) return;
        i %= 1_000;
        for (uint256 k; k < actors.length; k++) {
            address b = _a(i + k);
            (bool has,,,, bool frozen, bool everDrawn) = _line(b);
            if (!has || frozen || _principal(b) != 0 || pool.vouchedFor(b) == 0) continue;
            uint256 lim = pool.limitOf(b);
            amount = bound(amount, U, lim);
            if (amount > pool.idle() || pool.outstanding() + amount > pool.maxOutstanding()) return;
            if (!everDrawn && pool.newLinesOnDay(block.timestamp / 1 days) >= pool.dailyNewLineCap()) return;
            vm.prank(b);
            pool.draw(amount);
            vm.warp(block.timestamp + LadderLib.TERM + LadderLib.GRACE + 1);
            pool.writeOff(b);
            if (cure) {
                (uint256 due,,) = pool.dueOf(b);
                _fund(b, due);
                vm.prank(b);
                pool.repay();
            }
            calls["slashCycle"]++;
            _afterEach();
            return;
        }
    }

    function writeOff(uint256 i) external {
        i %= 1_000;
        for (uint256 k; k < actors.length; k++) {
            address a = _a(i + k);
            (,, uint8 phase) = pool.dueOf(a);
            if (phase != LadderLib.PHASE_DEFAULTABLE) continue;
            pool.writeOff(a);
            calls["writeOff"]++;
            _afterEach();
            return;
        }
    }

    function vouch(uint256 i, uint256 j, uint256 amount) external {
        if (pool.paused()) return;
        i %= 1_000;
        j %= 1_000;
        // pick the first eligible voucher from a random start, so vouching actually happens
        address v;
        for (uint256 k; k < actors.length; k++) {
            address c = _a(i + k);
            (bool hasC, uint8 lv,,, bool fz,) = _line(c);
            if (hasC && !fz && lv >= LadderLib.MIN_VOUCH_LEVEL) {
                v = c;
                break;
            }
        }
        if (v == address(0)) return;
        address b = _a(j);
        if (b == v) b = _a(j + 1);
        (bool hasB,,,, bool frozenB,) = _line(b);
        if (!hasB || frozenB) return;
        uint256 room = LadderLib.MAX_VOUCHED - pool.vouchedFor(b);
        if (room < U) return;
        if (pool.stakeOf(v, b) == 0) {
            if (pool.vouchersOf(b).length >= 3 || pool.voucheeCount(v) >= 3) return;
        }
        amount = bound(amount, U, room);
        _fund(v, amount);
        vm.prank(v);
        pool.vouch(b, amount);
        calls["vouch"]++;
        _afterEach();
    }

    function unvouch(uint256 i, uint256 amount) external {
        i %= 1_000;
        uint256 n = actors.length;
        for (uint256 k; k < n * n; k++) {
            address v = _a((i + k) / n);
            address b = _a(i + k);
            uint256 stake = pool.stakeOf(v, b);
            if (stake == 0 || _principal(b) != 0) continue;
            amount = bound(amount, 1, stake);
            vm.prank(v);
            pool.unvouch(b, amount);
            calls["unvouch"]++;
            _afterEach();
            return;
        }
    }

    function claim(uint256 i) external {
        i %= 1_000;
        for (uint256 k; k < actors.length; k++) {
            address a = _a(i + k);
            if (pool.claimable(a) == 0) continue;
            vm.prank(a);
            pool.claim();
            calls["claim"]++;
            _afterEach();
            return;
        }
    }

    function donate(uint256 amount) external {
        amount = bound(amount, 0, 50 * U);
        usdt.mint(address(pool), amount);
        calls["donate"]++;
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1 hours, 6 days));
        calls["warp"]++;
    }

    // ---------------------------------------------------------------- owner actions (I6)

    function fund(uint256 amount) external {
        amount = bound(amount, 0, 500 * U);
        _fund(owner, amount);
        Snap memory b = _snap();
        vm.prank(owner);
        pool.fund(amount);
        if (!_sameReach(b, _snap())) ownerReached = true;
        calls["fund"]++;
    }

    function defund(uint256 amount) external {
        amount = bound(amount, 0, pool.idle());
        Snap memory b = _snap();
        vm.prank(owner);
        pool.defund(amount);
        if (!_sameReach(b, _snap())) ownerReached = true;
        calls["defund"]++;
    }

    function setCaps(uint256 m, uint256 d, bool raise) external {
        uint256 curM = pool.maxOutstanding();
        uint32 curD = pool.dailyNewLineCap();
        uint256 newM;
        uint32 newD;
        if (raise) {
            newM = curM + bound(m, 0, 500 * U);
            newD = uint32(bound(d, curD, uint256(curD) + 20));
        } else {
            newM = bound(m, 0, curM);
            newD = uint32(bound(d, 0, curD));
        }
        Snap memory b = _snap();
        vm.prank(owner);
        pool.setCaps(newM, newD);
        if (!_sameReach(b, _snap())) ownerReached = true;
        calls["setCaps"]++;
    }

    function executeCaps() external {
        (,, uint64 eta) = pool.pendingCaps();
        if (eta == 0 || block.timestamp < eta) return;
        vm.prank(owner);
        pool.executeCapsRaise();
        calls["executeCaps"]++;
    }

    function setPaused(bool p) external {
        Snap memory b = _snap();
        vm.prank(owner);
        pool.setPaused(p);
        if (!_sameReach(b, _snap())) ownerReached = true;
        calls["pause"]++;
    }

    function sweep(uint256 amount) external {
        if (pool.outstanding() != 0) return;
        amount = bound(amount, 0, pool.reserve());
        Snap memory b = _snap();
        vm.prank(owner);
        pool.sweepReserve(amount);
        if (!_sameReach(b, _snap())) ownerReached = true;
        calls["sweep"]++;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}

contract InvariantsTest is Test {
    uint256 constant U = 1e18;
    RungsPool pool;
    MockUSDT usdt;
    Handler h;
    address[5] actors;

    function setUp() public {
        vm.warp(1_800_000_000);
        usdt = new MockUSDT();
        MockHandleRegistry reg = new MockHandleRegistry();
        address owner = makeAddr("owner");
        pool = new RungsPool(address(usdt), address(reg), owner);
        string[5] memory names = ["ana", "ben", "cai", "dia", "eli"];
        for (uint256 i; i < 5; i++) {
            actors[i] = makeAddr(names[i]);
            reg.set(actors[i], names[i]);
        }
        usdt.mint(owner, 1_000 * U);
        vm.startPrank(owner);
        usdt.approve(address(pool), type(uint256).max);
        pool.fund(1_000 * U);
        pool.setCaps(300 * U, 50);
        vm.stopPrank();

        h = new Handler(pool, usdt, owner, actors);
        targetContract(address(h));
        bytes4[] memory sel = new bytes4[](19);
        sel[0] = Handler.open.selector;
        sel[1] = Handler.draw.selector;
        sel[2] = Handler.repay.selector;
        sel[3] = Handler.climb.selector;
        sel[4] = Handler.climb.selector; // weighted: climbing unlocks vouching
        sel[5] = Handler.writeOff.selector;
        sel[6] = Handler.vouch.selector;
        sel[7] = Handler.vouch.selector;
        sel[8] = Handler.unvouch.selector;
        sel[9] = Handler.claim.selector;
        sel[10] = Handler.donate.selector;
        sel[11] = Handler.warp.selector;
        sel[12] = Handler.fund.selector;
        sel[13] = Handler.defund.selector;
        sel[14] = Handler.setCaps.selector;
        sel[15] = Handler.executeCaps.selector;
        sel[16] = Handler.setPaused.selector;
        sel[17] = Handler.sweep.selector;
        sel[18] = Handler.slashCycle.selector;
        targetSelector(FuzzSelector({addr: address(h), selectors: sel}));
    }

    /// I1 Solvency
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I1_solvency() public view {
        assertGe(
            usdt.balanceOf(address(pool)),
            pool.idle() + pool.reserve() + pool.totalStaked() + pool.totalClaimable()
        );
    }

    /// I2 Book
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I2_book() public view {
        uint256 sum;
        for (uint256 i; i < 5; i++) {
            (uint128 p,,,, bool wo) = pool.loanOf(actors[i]);
            if (!wo) sum += p;
        }
        assertEq(pool.outstanding(), sum);
    }

    /// I3 Cap after every draw
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I3_cap() public view {
        assertFalse(h.capBroken());
    }

    /// I4 One loan; frozen cannot draw
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I4_frozen() public view {
        assertFalse(h.frozenDrew());
    }

    /// I5 Stakes
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I5_stakes() public view {
        uint256 total;
        for (uint256 b; b < 5; b++) {
            uint256 forB;
            for (uint256 v; v < 5; v++) {
                forB += pool.stakeOf(actors[v], actors[b]);
            }
            assertEq(pool.vouchedFor(actors[b]), forB);
            assertLe(forB, LadderLib.MAX_VOUCHED);
            assertLe(pool.vouchersOf(actors[b]).length, 3);
            assertLe(pool.voucheeCount(actors[b]), 3);
            total += forB;
        }
        assertEq(pool.totalStaked(), total);
    }

    /// I6 Owner reach
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I6_ownerReach() public view {
        assertFalse(h.ownerReached());
    }

    /// I7 Pull bound
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I7_pull() public view {
        assertFalse(h.pullBroken());
    }

    /// I8 Monotone record
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I8_record() public view {
        assertFalse(h.recordBroken());
    }

    /// I9 is enforced by fail_on_revert: the handler never skips repay, repayFor, writeOff, unvouch or claim
    /// because of a pause, so any pause-related revert there fails the run.
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_I9_pauseNeverBlocksExits() public view {
        assertTrue(true);
    }

    /// Logs how many real pool actions each run made (run with -vv to see them).
    function afterInvariant() external view {
        string[11] memory k = [
            "open",
            "draw",
            "climb",
            "repay",
            "repayFor",
            "writeOff",
            "vouch",
            "unvouch",
            "claim",
            "setCaps",
            "executeCaps"
        ];
        string memory line;
        for (uint256 i; i < k.length; i++) {
            line = string.concat(line, k[i], "=", vm.toString(h.calls(bytes32(bytes(k[i])))), " ");
        }
        console.log(line);
    }
}
