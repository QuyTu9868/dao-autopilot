// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { Script, console } from "forge-std/Script.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { GovToken } from "../src/GovToken.sol";
import { TreasuryGovernor } from "../src/TreasuryGovernor.sol";

// DAO thứ hai giống DAO thật: kho bạc 20.000 TDAO nằm trong TimelockController,
// đề xuất thắng phải xếp hàng 60 giây rồi ai cũng thực thi được.
contract DeployTreasury is Script {
    function run() external {
        uint256 pk = vm.envUint("DEV_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);
        address[] memory none = new address[](0);
        TimelockController timelock = new TimelockController(60, none, none, deployer);
        GovToken tdao = new GovToken("Treasury DAO Token", "TDAO", address(timelock), 20_000 ether);
        TreasuryGovernor gov = new TreasuryGovernor(tdao, timelock);
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(gov));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(gov));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(0));
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);
        vm.stopBroadcast();
        console.log("Timelock", address(timelock));
        console.log("TDAO", address(tdao));
        console.log("TreasuryGovernor", address(gov));
    }
}
