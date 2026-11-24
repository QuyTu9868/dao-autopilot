// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";

/// Voter của một người dùng (owner) cho một Governor, tạo bởi VoterHub.
/// Owner ủy quyền (delegate) token cho contract này, đặt chính sách, ngưỡng tin cậy và cửa sổ phủ quyết.
/// Phán quyết và lệnh bỏ phiếu theo phán quyết chỉ đến từ Hub. Trong cửa sổ phủ quyết, owner chặn được phiếu.
contract Voter {
    enum Verdict { None, For, Against, Skip }

    struct Result {
        Verdict verdict;
        uint8 confidence; // 0 đến 100
        bool voted;
        bool vetoed;
        uint48 readyAt; // phiếu chỉ được bỏ từ thời điểm này
        string reason;
    }

    uint256 public constant MAX_POLICY_BYTES = 1000;
    uint32 public constant MAX_VETO_WINDOW = 180; // giây, phải lọt trong 5 phút bỏ phiếu của Governor demo

    IGovernor public immutable governor;
    address public immutable owner;
    address public immutable hub;
    uint8 public minConfidence = 70;
    uint32 public vetoWindow;
    string public policy;
    mapping(uint256 => Result) public results;
    uint256[] internal _judged;

    // Thống kê
    uint32 public forCount;
    uint32 public againstCount;
    uint32 public skipCount;
    uint32 public vetoCount;
    uint32 public lowConfidenceCount;

    event PolicyUpdated(string policy);
    event Voted(uint256 indexed proposalId, uint8 support, bool byVerdict);
    event VoteSkipped(uint256 indexed proposalId, string why);
    event Vetoed(uint256 indexed proposalId);

    error NotOwner();
    error NotHub();
    error AlreadyJudged();
    error NoVerdict();
    error AlreadyVoted();
    error BadValue();
    error NotYet();
    error CannotVeto();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyHub() {
        if (msg.sender != hub) revert NotHub();
        _;
    }

    constructor(IGovernor governor_, address owner_, address hub_) {
        governor = governor_;
        owner = owner_;
        hub = hub_;
    }

    function setPolicy(string calldata policy_) external onlyOwner {
        if (bytes(policy_).length > MAX_POLICY_BYTES) revert BadValue();
        policy = policy_;
        emit PolicyUpdated(policy_);
    }

    function setMinConfidence(uint8 value) external onlyOwner {
        if (value > 100) revert BadValue();
        minConfidence = value;
    }

    function setVetoWindow(uint32 seconds_) external onlyOwner {
        if (seconds_ > MAX_VETO_WINDOW) revert BadValue();
        vetoWindow = seconds_;
    }

    /// Bỏ phiếu thủ công. support: 0 phản đối, 1 ủng hộ, 2 trắng.
    function voteManual(uint256 proposalId, uint8 support) external onlyOwner {
        governor.castVote(proposalId, support);
        emit Voted(proposalId, support, false);
    }

    /// Chặn phiếu theo phán quyết khi phiếu chưa được bỏ.
    function veto(uint256 proposalId) external onlyOwner {
        Result storage r = results[proposalId];
        if (r.verdict == Verdict.None || r.voted || r.vetoed) revert CannotVeto();
        r.vetoed = true;
        vetoCount++;
        emit Vetoed(proposalId);
    }

    /// Lưu phán quyết đã chốt (qua Hub). Mỗi đề xuất chỉ nhận một lần. Trả về thời điểm được bỏ phiếu.
    function recordVerdict(uint256 proposalId, Verdict verdict, uint8 confidence, string calldata reason)
        external
        onlyHub
        returns (uint48 readyAt)
    {
        if (results[proposalId].verdict != Verdict.None) revert AlreadyJudged();
        if (verdict == Verdict.None || confidence > 100) revert BadValue();
        readyAt = uint48(block.timestamp + vetoWindow);
        results[proposalId] = Result(verdict, confidence, false, false, readyAt, reason);
        _judged.push(proposalId);
    }

    /// Bỏ phiếu theo phán quyết đã lưu (Hub gọi sau callback Reactive, khi đã hết cửa sổ phủ quyết).
    /// Bị phủ quyết, phán quyết Skip, hoặc dưới ngưỡng tin cậy thì không bỏ phiếu.
    function castVerdict(uint256 proposalId) external onlyHub {
        Result storage r = results[proposalId];
        if (r.verdict == Verdict.None) revert NoVerdict();
        if (r.voted) revert AlreadyVoted();
        if (block.timestamp < r.readyAt) revert NotYet();
        r.voted = true;
        if (r.vetoed) {
            emit VoteSkipped(proposalId, "vetoed by owner");
            return;
        }
        if (r.verdict == Verdict.Skip) {
            skipCount++;
            emit VoteSkipped(proposalId, "verdict skip");
            return;
        }
        if (r.confidence < minConfidence) {
            lowConfidenceCount++;
            emit VoteSkipped(proposalId, "below confidence threshold");
            return;
        }
        uint8 support = r.verdict == Verdict.For ? 1 : 0;
        if (support == 1) forCount++;
        else againstCount++;
        governor.castVote(proposalId, support);
        emit Voted(proposalId, support, true);
    }

    function judgedCount() external view returns (uint256) {
        return _judged.length;
    }

    function judgedAt(uint256 index) external view returns (uint256) {
        return _judged[index];
    }
}
