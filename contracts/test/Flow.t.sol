// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { Test } from "forge-std/Test.sol";
import { IPayable } from "reactive-lib-omni/interfaces/IPayable.sol";
import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";
import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";
import { GovToken } from "../src/GovToken.sol";
import { TestGovernor } from "../src/TestGovernor.sol";
import { TreasuryGovernor } from "../src/TreasuryGovernor.sol";
import { Voter } from "../src/Voter.sol";
import { VoterHub } from "../src/VoterHub.sol";

contract FlowTest is Test {
    GovToken token;
    TestGovernor gov;
    VoterHub hub;
    Voter voter;
    address user = makeAddr("user");
    address user2 = makeAddr("user2");
    address ai = makeAddr("ai");
    address ai2 = makeAddr("ai2");
    address ai3 = makeAddr("ai3");
    address other = makeAddr("other");
    address proxy = makeAddr("proxy");
    address reactive = makeAddr("reactive");
    uint256 constant FEE = 0.0005 ether;

    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    uint256 pid;

    function setUp() public {
        vm.warp(1_000_000);
        token = new GovToken("DAO Autopilot Token", "DAOT", address(0), 0);
        gov = new TestGovernor(token);
        address[] memory agents = new address[](3);
        agents[0] = ai;
        agents[1] = ai2;
        agents[2] = ai3;
        hub = new VoterHub(agents, 1, FEE, IPayable(payable(proxy)), reactive);
        hub.addGovernor(address(gov));

        vm.deal(user, 1 ether);
        vm.deal(user2, 1 ether);
        vm.startPrank(user);
        voter = Voter(hub.createVoter{ value: FEE }(address(gov)));
        token.mint(1000 ether);
        token.delegate(address(voter));
        vm.stopPrank();
        vm.warp(block.timestamp + 1);

        targets.push(address(0));
        values.push(0);
        calldatas.push("");
        vm.prank(other);
        pid = gov.propose(targets, values, calldatas, "Fund the grants program");
        vm.warp(block.timestamp + 61); // qua thời gian chờ
    }

    function _forVotes() internal view returns (uint256 f) {
        (, f,) = gov.proposalVotes(pid);
    }

    function _tally() internal view returns (uint256) {
        (uint256 a, uint256 f, uint256 ab) = gov.proposalVotes(pid);
        return a + f + ab;
    }

    function _judge(Voter.Verdict v, uint8 conf) internal {
        vm.prank(ai);
        hub.submitVerdict(address(voter), pid, v, conf, "reason");
    }

    function _cast() internal {
        vm.prank(proxy);
        hub.castVerdict(reactive, address(voter), pid);
    }

    // ---------- Token ----------

    function test_mintLimit() public {
        vm.prank(user);
        vm.expectRevert(GovToken.MintLimitExceeded.selector);
        token.mint(1);
    }

    function test_treasuryPremint() public {
        GovToken t = new GovToken("Treasury DAO Token", "TDAO", other, 20_000 ether);
        assertEq(t.balanceOf(other), 20_000 ether);
        assertEq(t.symbol(), "TDAO");
    }

    function test_tokenUsesTimestampClock() public view {
        assertEq(token.clock(), uint48(block.timestamp));
        assertEq(token.CLOCK_MODE(), "mode=timestamp");
    }

    function testFuzz_mintNeverExceedsCap(uint256 a, uint256 b) public {
        a = bound(a, 0, token.MAX_PER_WALLET());
        b = bound(b, 0, 2000 ether);
        vm.startPrank(user2);
        token.mint(a);
        if (a + b > token.MAX_PER_WALLET()) {
            vm.expectRevert(GovToken.MintLimitExceeded.selector);
            token.mint(b);
            assertEq(token.balanceOf(user2), a);
        } else {
            token.mint(b);
            assertEq(token.balanceOf(user2), a + b);
        }
        vm.stopPrank();
    }

    // ---------- Hub: tạo Voter, phí, Governor ----------

    function test_oneVoterPerWalletPerGovernor() public {
        vm.prank(user);
        vm.expectRevert(VoterHub.HasVoter.selector);
        hub.createVoter{ value: FEE }(address(gov));
        // Governor thứ hai thì được thêm một Voter
        TestGovernor gov2 = new TestGovernor(token);
        hub.addGovernor(address(gov2));
        vm.prank(user);
        address v2 = hub.createVoter{ value: FEE }(address(gov2));
        assertEq(hub.voterOf(user, address(gov2)), v2);
        assertEq(address(Voter(v2).governor()), address(gov2));
        assertEq(hub.voterCount(), 2);
    }

    function test_createVoterFee() public {
        vm.prank(user2);
        vm.expectRevert(VoterHub.FeeTooLow.selector);
        hub.createVoter{ value: FEE - 1 }(address(gov));
        uint256 before = address(hub).balance;
        vm.prank(user2);
        hub.createVoter{ value: FEE }(address(gov));
        assertEq(address(hub).balance - before, FEE); // phí ở lại Hub để trả callback
    }

    function test_unknownGovernorRejected() public {
        vm.prank(user2);
        vm.expectRevert(VoterHub.UnknownGovernor.selector);
        hub.createVoter{ value: FEE }(other);
        vm.prank(proxy);
        vm.expectRevert(VoterHub.UnknownGovernor.selector);
        hub.requestReview(reactive, other, pid, "x");
    }

    function test_onlyAdminManagesHub() public {
        vm.startPrank(other);
        vm.expectRevert(VoterHub.NotAdmin.selector);
        hub.addGovernor(other);
        vm.expectRevert(VoterHub.NotAdmin.selector);
        hub.setAgent(other, true);
        vm.expectRevert(VoterHub.NotAdmin.selector);
        hub.setThreshold(2);
        vm.expectRevert(VoterHub.NotAdmin.selector);
        hub.withdraw(payable(other), 1);
        vm.stopPrank();
    }

    function test_adminWithdrawsFees() public {
        uint256 bal = address(hub).balance;
        hub.withdraw(payable(other), bal);
        assertEq(other.balance, bal);
        assertEq(address(hub).balance, 0);
    }

    // ---------- Voter: chủ sở hữu ----------

    function test_policyOnlyOwner() public {
        vm.prank(user);
        voter.setPolicy("support security");
        assertEq(voter.policy(), "support security");
        vm.prank(other);
        vm.expectRevert(Voter.NotOwner.selector);
        voter.setPolicy("x");
    }

    function test_policyTooLong() public {
        bytes memory big = new bytes(1001);
        vm.prank(user);
        vm.expectRevert(Voter.BadValue.selector);
        voter.setPolicy(string(big));
    }

    function test_settingsBounds() public {
        vm.startPrank(user);
        vm.expectRevert(Voter.BadValue.selector);
        voter.setMinConfidence(101);
        vm.expectRevert(Voter.BadValue.selector);
        voter.setVetoWindow(181);
        voter.setVetoWindow(180);
        vm.stopPrank();
        assertEq(voter.vetoWindow(), 180);
    }

    function test_manualVote() public {
        vm.prank(user);
        voter.voteManual(pid, 1);
        assertEq(_forVotes(), 1000 ether);
    }

    function test_manualVoteOnlyOwner() public {
        vm.prank(other);
        vm.expectRevert(Voter.NotOwner.selector);
        voter.voteManual(pid, 1);
    }

    // ---------- Vòng 1 ----------

    function test_requestReviewStoresGovernorAndTitle() public {
        vm.expectEmit(true, true, false, false);
        emit VoterHub.ReviewRequested(address(gov), pid);
        vm.prank(proxy);
        hub.requestReview(reactive, address(gov), pid, "Fund the grants program");
        VoterHub.Proposal memory p = hub.proposalAt(0);
        assertEq(p.governor, address(gov));
        assertEq(p.id, pid);
        assertEq(p.title, "Fund the grants program");
    }

    function test_requestReviewRejectsOthers() public {
        vm.prank(other);
        vm.expectRevert();
        hub.requestReview(reactive, address(gov), pid, "x");
        vm.prank(proxy);
        vm.expectRevert();
        hub.requestReview(other, address(gov), pid, "x"); // sai contract reactive
    }

    // ---------- Vòng 2: một nguồn AI ----------

    function test_verdictFor() public {
        _judge(Voter.Verdict.For, 90);
        _cast();
        assertEq(_forVotes(), 1000 ether);
    }

    function test_verdictAgainst() public {
        _judge(Voter.Verdict.Against, 90);
        _cast();
        (uint256 against,,) = gov.proposalVotes(pid);
        assertEq(against, 1000 ether);
    }

    function test_lowConfidenceNoVote() public {
        _judge(Voter.Verdict.For, 50);
        _cast();
        assertEq(_tally(), 0);
        assertEq(voter.lowConfidenceCount(), 1);
    }

    function test_skipNoVote() public {
        _judge(Voter.Verdict.Skip, 95);
        _cast();
        assertEq(_tally(), 0);
        assertEq(voter.skipCount(), 1);
    }

    function testFuzz_thresholdBoundary(uint8 conf, uint8 minConf) public {
        conf = uint8(bound(conf, 0, 100));
        minConf = uint8(bound(minConf, 0, 100));
        vm.prank(user);
        voter.setMinConfidence(minConf);
        _judge(Voter.Verdict.For, conf);
        _cast();
        assertEq(_forVotes(), conf >= minConf ? 1000 ether : 0);
    }

    function test_onlyAgentSubmits() public {
        vm.prank(other);
        vm.expectRevert(VoterHub.NotAgent.selector);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 90, "x");
    }

    function test_submitVerdictRejectsBadValues() public {
        vm.startPrank(ai);
        vm.expectRevert(VoterHub.BadValue.selector);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.None, 90, "x");
        vm.expectRevert(VoterHub.BadValue.selector);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 101, "x");
        vm.expectRevert(VoterHub.UnknownVoter.selector);
        hub.submitVerdict(other, pid, Voter.Verdict.For, 90, "x");
        vm.stopPrank();
    }

    function test_voterRejectsDirectCalls() public {
        vm.prank(ai);
        vm.expectRevert(Voter.NotHub.selector);
        voter.recordVerdict(pid, Voter.Verdict.For, 90, "x");
        vm.prank(user);
        vm.expectRevert(Voter.NotHub.selector);
        voter.castVerdict(pid);
    }

    function test_finalVerdictCannotChange() public {
        _judge(Voter.Verdict.For, 90);
        vm.prank(ai2);
        vm.expectRevert(VoterHub.AlreadyFinal.selector);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.Against, 90, "y");
    }

    function test_cannotCastTwice() public {
        _judge(Voter.Verdict.For, 90);
        _cast();
        vm.prank(proxy);
        vm.expectRevert(Voter.AlreadyVoted.selector);
        hub.castVerdict(reactive, address(voter), pid);
    }

    function test_castWithoutVerdictReverts() public {
        vm.prank(proxy);
        vm.expectRevert(Voter.NoVerdict.selector);
        hub.castVerdict(reactive, address(voter), pid);
    }

    function test_cannotVoteOutsideWindow() public {
        _judge(Voter.Verdict.For, 90);
        vm.warp(block.timestamp + 400); // hết thời gian bỏ phiếu
        vm.prank(proxy);
        vm.expectRevert();
        hub.castVerdict(reactive, address(voter), pid);
    }

    function test_castVerdictOnlyViaProxy() public {
        _judge(Voter.Verdict.For, 90);
        vm.prank(other);
        vm.expectRevert();
        hub.castVerdict(reactive, address(voter), pid);
        vm.prank(proxy);
        vm.expectRevert();
        hub.castVerdict(other, address(voter), pid);
        vm.prank(proxy);
        vm.expectRevert(VoterHub.UnknownVoter.selector);
        hub.castVerdict(reactive, other, pid);
    }

    // ---------- CP12: nhiều nguồn AI ----------

    function test_twoOfThreeAgree() public {
        hub.setThreshold(2);
        vm.prank(ai);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 95, "a");
        (Voter.Verdict v0,,,,,) = voter.results(pid);
        assertEq(uint8(v0), 0); // một nguồn chưa đủ
        vm.prank(ai2);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.Against, 90, "b");
        vm.prank(ai3);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 80, "c");
        (Voter.Verdict v, uint8 conf,,,, string memory reason) = voter.results(pid);
        assertEq(uint8(v), uint8(Voter.Verdict.For));
        assertEq(conf, 80); // mức thấp nhất của các nguồn đồng ý
        assertEq(reason, "c");
        _cast();
        assertEq(_forVotes(), 1000 ether);
    }

    function test_disagreementMeansNoVote() public {
        hub.setThreshold(2);
        vm.prank(ai);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 95, "a");
        vm.prank(ai2);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.Against, 95, "b");
        assertEq(hub.agentVerdictOf(address(voter), pid, ai), 1);
        assertEq(hub.agentVerdictOf(address(voter), pid, ai2), 2);
        vm.prank(proxy);
        vm.expectRevert(Voter.NoVerdict.selector);
        hub.castVerdict(reactive, address(voter), pid);
    }

    function test_agentVotesOnce() public {
        hub.setThreshold(2);
        vm.startPrank(ai);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 95, "a");
        vm.expectRevert(VoterHub.AlreadySubmitted.selector);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 95, "a");
        vm.stopPrank();
    }

    function test_removedAgentLosesRight() public {
        hub.setAgent(ai, false);
        vm.prank(ai);
        vm.expectRevert(VoterHub.NotAgent.selector);
        hub.submitVerdict(address(voter), pid, Voter.Verdict.For, 90, "x");
    }

    // ---------- CP9: cửa sổ phủ quyết ----------

    function test_vetoWindowDelaysVote() public {
        vm.prank(user);
        voter.setVetoWindow(60);
        _judge(Voter.Verdict.For, 90);
        (,,,, uint48 readyAt,) = voter.results(pid);
        assertEq(readyAt, block.timestamp + 60);
        vm.prank(proxy);
        vm.expectRevert(Voter.NotYet.selector);
        hub.castVerdict(reactive, address(voter), pid);
        vm.warp(block.timestamp + 60);
        _cast();
        assertEq(_forVotes(), 1000 ether);
    }

    function test_vetoBlocksVote() public {
        vm.prank(user);
        voter.setVetoWindow(60);
        _judge(Voter.Verdict.For, 90);
        vm.prank(user);
        voter.veto(pid);
        vm.warp(block.timestamp + 60);
        _cast();
        assertEq(_tally(), 0);
        assertEq(voter.vetoCount(), 1);
        (,, bool voted, bool vetoed,,) = voter.results(pid);
        assertTrue(voted && vetoed);
    }

    function test_vetoRules() public {
        vm.prank(user);
        vm.expectRevert(Voter.CannotVeto.selector);
        voter.veto(pid); // chưa có phán quyết
        _judge(Voter.Verdict.For, 90);
        vm.prank(other);
        vm.expectRevert(Voter.NotOwner.selector);
        voter.veto(pid);
        _cast();
        vm.prank(user);
        vm.expectRevert(Voter.CannotVeto.selector);
        voter.veto(pid); // đã bỏ phiếu
    }

    // ---------- CP10: lịch sử và thống kê ----------

    function test_historyAndCounters() public {
        _judge(Voter.Verdict.For, 90);
        _cast();
        vm.warp(block.timestamp + 1);
        calldatas[0] = hex"01";
        vm.prank(other);
        uint256 pid2 = gov.propose(targets, values, calldatas, "second");
        vm.warp(block.timestamp + 61);
        vm.prank(ai);
        hub.submitVerdict(address(voter), pid2, Voter.Verdict.Against, 90, "no");
        vm.prank(proxy);
        hub.castVerdict(reactive, address(voter), pid2);

        assertEq(voter.judgedCount(), 2);
        assertEq(voter.judgedAt(0), pid);
        assertEq(voter.judgedAt(1), pid2);
        assertEq(voter.forCount(), 1);
        assertEq(voter.againstCount(), 1);
    }

    // ---------- Nhiều người dùng ----------

    function test_twoVotersIndependent() public {
        vm.startPrank(user2);
        Voter v2 = Voter(hub.createVoter{ value: FEE }(address(gov)));
        token.mint(500 ether);
        token.delegate(address(v2));
        vm.stopPrank();
        vm.warp(block.timestamp + 1);
        calldatas[0] = hex"01";
        vm.prank(other);
        uint256 pid2 = gov.propose(targets, values, calldatas, "second proposal");
        vm.warp(block.timestamp + 61);

        vm.startPrank(ai);
        hub.submitVerdict(address(voter), pid2, Voter.Verdict.For, 90, "yes");
        hub.submitVerdict(address(v2), pid2, Voter.Verdict.Against, 90, "no");
        vm.stopPrank();
        vm.startPrank(proxy);
        hub.castVerdict(reactive, address(voter), pid2);
        hub.castVerdict(reactive, address(v2), pid2);
        vm.stopPrank();

        (uint256 a, uint256 f,) = gov.proposalVotes(pid2);
        assertEq(f, 1000 ether);
        assertEq(a, 500 ether);
    }

    // ---------- CP13: DAO có kho bạc và timelock ----------

    function test_treasuryDaoFullLifecycle() public {
        address[] memory none = new address[](0);
        TimelockController tl = new TimelockController(60, none, none, address(this));
        GovToken tdao = new GovToken("Treasury DAO Token", "TDAO", address(tl), 20_000 ether);
        TreasuryGovernor tgov = new TreasuryGovernor(tdao, tl);
        tl.grantRole(tl.PROPOSER_ROLE(), address(tgov));
        tl.grantRole(tl.CANCELLER_ROLE(), address(tgov));
        tl.grantRole(tl.EXECUTOR_ROLE(), address(0)); // ai cũng thực thi được sau khi chờ
        tl.renounceRole(tl.DEFAULT_ADMIN_ROLE(), address(this));
        hub.addGovernor(address(tgov));

        vm.startPrank(user);
        Voter tv = Voter(hub.createVoter{ value: FEE }(address(tgov)));
        tdao.mint(1000 ether);
        tdao.delegate(address(tv));
        vm.stopPrank();
        vm.warp(block.timestamp + 1);

        // Đề xuất trả 5.000 TDAO từ kho bạc cho auditor
        address[] memory t = new address[](1);
        uint256[] memory val = new uint256[](1);
        bytes[] memory cd = new bytes[](1);
        t[0] = address(tdao);
        cd[0] = abi.encodeWithSignature("transfer(address,uint256)", other, 5000 ether);
        vm.prank(other);
        uint256 tp = tgov.propose(t, val, cd, "Pay 5,000 TDAO to the auditor");
        vm.warp(block.timestamp + 61);

        vm.prank(ai);
        hub.submitVerdict(address(tv), tp, Voter.Verdict.For, 95, "fits");
        vm.prank(proxy);
        hub.castVerdict(reactive, address(tv), tp);

        vm.warp(block.timestamp + 301);
        assertEq(uint8(tgov.state(tp)), uint8(IGovernor.ProposalState.Succeeded));
        tgov.queue(t, val, cd, keccak256("Pay 5,000 TDAO to the auditor"));
        vm.warp(block.timestamp + 61);
        tgov.execute(t, val, cd, keccak256("Pay 5,000 TDAO to the auditor"));
        assertEq(tdao.balanceOf(other), 5000 ether);
        assertEq(tdao.balanceOf(address(tl)), 15_000 ether);
    }
}
