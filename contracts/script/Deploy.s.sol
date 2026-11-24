// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { Script, console } from "forge-std/Script.sol";
import { GovToken } from "../src/GovToken.sol";
import { TestGovernor } from "../src/TestGovernor.sol";

// Deploys the demo token and Governor on Base Sepolia.
// DaoReactive (Lasna) and VoterHub (Base Sepolia) depend on each other's address,
// so they are deployed with `forge create`, see the Deployment section in the README.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEV_PRIVATE_KEY");
        vm.startBroadcast(pk);
        GovToken token = new GovToken("DAO Autopilot Token", "DAOT", address(0), 0);
        TestGovernor gov = new TestGovernor(token);
        vm.stopBroadcast();
        console.log("GovToken", address(token));
        console.log("TestGovernor", address(gov));
    }
}
