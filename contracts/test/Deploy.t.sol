// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {RungsPool} from "../src/RungsPool.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";
import {MockHandleRegistry} from "./mocks/MockHandleRegistry.sol";

contract DeployTest is Test {
    function test_deployScript() public {
        MockUSDT usdt = new MockUSDT();
        MockHandleRegistry reg = new MockHandleRegistry();
        address owner = makeAddr("owner");
        vm.setEnv("USDT_ADDRESS", vm.toString(address(usdt)));
        vm.setEnv("AGENT_ID_REGISTRY", vm.toString(address(reg)));
        vm.setEnv("OWNER_ADDRESS", vm.toString(owner));
        RungsPool pool = new Deploy().run();
        assertEq(pool.owner(), owner);
        assertEq(address(pool.usdt()), address(usdt));
        assertEq(address(pool.registry()), address(reg));
        assertEq(pool.maxOutstanding(), 0, "no lending until the owner sets caps");
    }
}
