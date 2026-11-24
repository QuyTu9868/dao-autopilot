// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { Test } from "forge-std/Test.sol";
import { IReactive } from "reactive-lib-omni/interfaces/IReactive.sol";
import { ISystemContract } from "reactive-lib-omni/interfaces/ISystemContract.sol";
import { DaoReactive } from "../src/DaoReactive.sol";

// System contract giả: ghi lại đăng ký và các callback.
contract MockSystem {
    bytes[] public payloads;
    address public lastRecipient;
    uint256 public subscriptions;
    uint256 public unsubscriptions;
    uint256 public lastTopic;

    function subscribe(uint256, address, uint256 topic0, uint256, uint256, uint256) external {
        subscriptions++;
        lastTopic = topic0;
    }

    function unsubscribe(uint256, address, uint256, uint256, uint256, uint256) external {
        unsubscriptions++;
    }

    function requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0 memory c) external {
        payloads.push(c.payload);
        lastRecipient = c.recipient;
    }

    function count() external view returns (uint256) {
        return payloads.length;
    }
}

contract ReactiveTest is Test {
    address constant SYSTEM = 0x8888888888888888888888888888888888888888;
    address constant CRON = 0x0000000000000000000000000000000000fffFfF;
    address governor = makeAddr("governor");
    address hub = makeAddr("hub");
    DaoReactive rx;
    MockSystem sys;
    uint256 proposalTopic;
    uint256 verdictTopic;
    uint256 cronTopic;

    function setUp() public {
        vm.warp(1_000_000);
        vm.etch(SYSTEM, address(new MockSystem()).code);
        sys = MockSystem(SYSTEM);
        rx = new DaoReactive(84532);
        rx.addGovernor(governor);
        rx.setHub(hub);
        proposalTopic = rx.PROPOSAL_CREATED_TOPIC();
        verdictTopic = rx.VERDICT_SUBMITTED_TOPIC();
        cronTopic = rx.CRON10_TOPIC();
    }

    function _log(uint256 chainId, uint256 topic0, address from, uint256 t1, uint256 t2, bytes memory data)
        internal
        pure
        returns (IReactive.LogRecord memory)
    {
        return IReactive.LogRecord(chainId, from, topic0, t1, t2, 0, data, 1, 0, 0, 0, 0);
    }

    function _args(uint256 i) internal view returns (bytes memory args) {
        bytes memory p = sys.payloads(i);
        args = new bytes(p.length - 4);
        for (uint256 k = 0; k < args.length; k++) args[k] = p[k + 4];
    }

    function _proposalData(uint256 id, string memory description) internal view returns (bytes memory) {
        address[] memory t = new address[](1);
        uint256[] memory v = new uint256[](1);
        string[] memory s = new string[](1);
        bytes[] memory c = new bytes[](1);
        return abi.encode(id, address(this), t, v, s, c, uint256(10), uint256(20), description);
    }

    function _verdict(address voter, uint256 id, uint256 readyAt) internal {
        vm.prank(SYSTEM);
        rx.react(_log(84532, verdictTopic, hub, uint256(uint160(voter)), id, abi.encode(uint8(1), uint8(90), "r", readyAt)));
    }

    function _cronTick() internal {
        vm.prank(SYSTEM);
        rx.react(_log(block.chainid, cronTopic, CRON, 0, 0, abi.encode(block.number)));
    }

    function test_subscribesToGovernorAndHub() public view {
        assertEq(sys.subscriptions(), 2);
        assertTrue(rx.isGovernor(governor));
    }

    function test_proposalForwardsGovernorIdAndTitle() public {
        vm.prank(SYSTEM);
        rx.react(_log(84532, proposalTopic, governor, 0, 0, _proposalData(777, "Fund the grants program")));
        assertEq(sys.lastRecipient(), hub);
        (address first, address g, uint256 id, string memory title) = abi.decode(_args(0), (address, address, uint256, string));
        assertEq(first, address(0));
        assertEq(g, governor);
        assertEq(id, 777);
        assertEq(title, "Fund the grants program");
    }

    function test_longTitleIsCut() public {
        bytes memory longText = new bytes(300);
        for (uint256 i = 0; i < 300; i++) longText[i] = "a";
        vm.prank(SYSTEM);
        rx.react(_log(84532, proposalTopic, governor, 0, 0, _proposalData(1, string(longText))));
        (,,, string memory title) = abi.decode(_args(0), (address, address, uint256, string));
        assertEq(bytes(title).length, 120);
    }

    function test_unwatchedGovernorIgnored() public {
        vm.prank(SYSTEM);
        rx.react(_log(84532, proposalTopic, address(0xBEEF), 0, 0, _proposalData(1, "x")));
        assertEq(sys.count(), 0);
    }

    function test_verdictWithoutWindowCastsNow() public {
        address voter = makeAddr("voter");
        _verdict(voter, 555, block.timestamp);
        assertEq(sys.count(), 0); // còn trong biên lệch đồng hồ 3 giây nên vẫn xếp hàng
        vm.warp(block.timestamp + 3);
        _verdict(voter, 556, block.timestamp - 3);
        assertEq(sys.count(), 1);
        (address first, address v, uint256 id) = abi.decode(_args(0), (address, address, uint256));
        assertEq(first, address(0));
        assertEq(v, voter);
        assertEq(id, 556);
    }

    function test_vetoWindowQueuesUntilCronTick() public {
        address voter = makeAddr("voter");
        uint256 subsBefore = sys.subscriptions();
        _verdict(voter, 9, block.timestamp + 60);
        assertEq(sys.count(), 0);
        assertEq(rx.queueLength(), 1);
        assertTrue(rx.cronOn());
        assertEq(sys.subscriptions(), subsBefore + 1);
        assertEq(sys.lastTopic(), cronTopic);

        vm.warp(block.timestamp + 30);
        _cronTick();
        assertEq(sys.count(), 0); // chưa hết cửa sổ

        vm.warp(block.timestamp + 34);
        _cronTick();
        assertEq(sys.count(), 1);
        (, address v, uint256 id) = abi.decode(_args(0), (address, address, uint256));
        assertEq(v, voter);
        assertEq(id, 9);
        assertEq(rx.queueLength(), 0);
        assertFalse(rx.cronOn());
        assertEq(sys.unsubscriptions(), 1);
    }

    function test_drainOnlyReadyItems() public {
        _verdict(makeAddr("a"), 1, block.timestamp + 10);
        _verdict(makeAddr("b"), 2, block.timestamp + 100);
        assertEq(sys.subscriptions(), 3); // cron bật một lần
        vm.warp(block.timestamp + 20);
        _cronTick();
        assertEq(sys.count(), 1);
        assertEq(rx.queueLength(), 1);
        assertTrue(rx.cronOn());
    }

    function test_cronFromOtherSourceIgnored() public {
        _verdict(makeAddr("a"), 1, block.timestamp + 10);
        vm.warp(block.timestamp + 20);
        vm.prank(SYSTEM);
        rx.react(_log(block.chainid, cronTopic, address(0xBEEF), 0, 0, ""));
        assertEq(sys.count(), 0);
    }

    function test_onlySystemCanReact() public {
        vm.expectRevert();
        rx.react(_log(84532, proposalTopic, governor, 0, 0, ""));
    }

    function test_ownerOnlyAndOnce() public {
        vm.expectRevert(DaoReactive.HubAlreadySet.selector);
        rx.setHub(hub);
        vm.expectRevert(DaoReactive.AlreadyWatched.selector);
        rx.addGovernor(governor);
        vm.startPrank(makeAddr("x"));
        vm.expectRevert(DaoReactive.NotOwner.selector);
        rx.setHub(hub);
        vm.expectRevert(DaoReactive.NotOwner.selector);
        rx.addGovernor(address(1));
        vm.stopPrank();
    }
}
