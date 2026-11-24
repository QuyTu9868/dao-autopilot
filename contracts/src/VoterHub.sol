// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { IGovernor } from "@openzeppelin/contracts/governance/IGovernor.sol";
import { AbstractCallback } from "reactive-lib-omni/base/AbstractCallback.sol";
import { IPayable } from "reactive-lib-omni/interfaces/IPayable.sol";
import { Voter } from "./Voter.sol";

/// Điểm trung tâm:
/// - Tạo Voter cho từng ví trên từng Governor đã đăng ký (có phí nhỏ để chống spam, phí trả cho callback).
/// - Nhận callback từ Reactive.
/// - Nhận phán quyết từ nhiều nguồn AI; chỉ chốt khi đủ `threshold` nguồn cùng một phán quyết.
contract VoterHub is AbstractCallback {
    struct Proposal {
        address governor;
        uint256 id;
        string title; // 120 byte đầu của mô tả, đủ để liệt kê
        uint48 seenAt;
    }

    address public immutable admin;
    uint8 public threshold;
    uint256 public voterFee;

    mapping(address => bool) public isGovernor;
    address[] public governors;
    mapping(address => bool) public isAgent;
    address[] public agents;

    mapping(address => mapping(address => address)) public voterOf; // owner => governor => voter
    mapping(address => bool) public isVoter;
    address[] public voters;
    Proposal[] internal _proposals;

    // Phiếu của từng nguồn AI cho một cặp (voter, đề xuất)
    mapping(bytes32 => mapping(address => uint8)) public agentVerdict; // 0 = chưa gửi
    mapping(bytes32 => mapping(uint8 => uint8)) public tally;
    mapping(bytes32 => mapping(uint8 => uint8)) internal _lowestConfidence;
    mapping(bytes32 => bool) public finalized;

    event GovernorAdded(address indexed governor);
    event AgentSet(address indexed agent, bool allowed);
    event ThresholdSet(uint8 threshold);
    event VoterFeeSet(uint256 fee);
    event VoterCreated(address indexed owner, address indexed voter, address indexed governor);
    event ReviewRequested(address indexed governor, uint256 indexed proposalId);
    event AgentVerdict(address indexed voter, uint256 indexed proposalId, address indexed agent, Voter.Verdict verdict, uint8 confidence, string reason);
    event VerdictSubmitted(address indexed voter, uint256 indexed proposalId, Voter.Verdict verdict, uint8 confidence, string reason, uint256 readyAt);

    error NotAdmin();
    error NotAgent();
    error UnknownVoter();
    error UnknownGovernor();
    error HasVoter();
    error FeeTooLow();
    error AlreadySubmitted();
    error AlreadyFinal();
    error BadValue();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address[] memory agents_, uint8 threshold_, uint256 voterFee_, IPayable callbackProxy_, address reactive_)
        AbstractCallback(callbackProxy_, reactive_)
    {
        admin = msg.sender;
        for (uint256 i = 0; i < agents_.length; i++) _setAgent(agents_[i], true);
        if (threshold_ == 0 || threshold_ > agents_.length) revert BadValue();
        threshold = threshold_;
        voterFee = voterFee_;
    }

    // ---------- Quản trị ----------

    function addGovernor(address governor) external onlyAdmin {
        if (isGovernor[governor]) revert BadValue();
        isGovernor[governor] = true;
        governors.push(governor);
        emit GovernorAdded(governor);
    }

    function setAgent(address agent, bool allowed) external onlyAdmin {
        _setAgent(agent, allowed);
    }

    function setThreshold(uint8 threshold_) external onlyAdmin {
        if (threshold_ == 0) revert BadValue();
        threshold = threshold_;
        emit ThresholdSet(threshold_);
    }

    function setVoterFee(uint256 fee) external onlyAdmin {
        voterFee = fee;
        emit VoterFeeSet(fee);
    }

    /// Đường ra cho quỹ phí: admin rút phần không cần cho callback.
    function withdraw(address payable to, uint256 amount) external onlyAdmin {
        _pay(to, amount);
    }

    function _setAgent(address agent, bool allowed) internal {
        if (allowed && !isAgent[agent]) agents.push(agent);
        isAgent[agent] = allowed;
        emit AgentSet(agent, allowed);
    }

    // ---------- Người dùng ----------

    /// Mỗi ví một Voter cho mỗi Governor. Phí ở lại Hub để trả callback cho chính Voter này.
    function createVoter(address governor) external payable returns (address voter) {
        if (!isGovernor[governor]) revert UnknownGovernor();
        if (msg.value < voterFee) revert FeeTooLow();
        if (voterOf[msg.sender][governor] != address(0)) revert HasVoter();
        voter = address(new Voter(IGovernor(governor), msg.sender, address(this)));
        voterOf[msg.sender][governor] = voter;
        isVoter[voter] = true;
        voters.push(voter);
        emit VoterCreated(msg.sender, voter, governor);
    }

    // ---------- Callback từ Reactive ----------

    /// Governor có đề xuất mới. Tham số đầu bị proxy thay bằng địa chỉ contract Reactive.
    function requestReview(address reactive_, address governor, uint256 proposalId, string calldata title)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        if (!isGovernor[governor]) revert UnknownGovernor();
        _proposals.push(Proposal(governor, proposalId, title, uint48(block.timestamp)));
        emit ReviewRequested(governor, proposalId);
    }

    /// Hết cửa sổ phủ quyết: Voter bỏ phiếu theo phán quyết đã lưu.
    function castVerdict(address reactive_, address voter, uint256 proposalId)
        external
        onlyServiceProvider
        onlyCallbackSender(reactive_)
    {
        if (!isVoter[voter]) revert UnknownVoter();
        Voter(voter).castVerdict(proposalId);
    }

    // ---------- Nguồn AI ----------

    /// Mỗi nguồn AI gửi một phán quyết cho mỗi (voter, đề xuất). Đủ `threshold` nguồn trùng nhau thì chốt.
    /// Độ tin cậy chốt là mức thấp nhất trong các nguồn đồng ý.
    function submitVerdict(address voter, uint256 proposalId, Voter.Verdict verdict, uint8 confidence, string calldata reason)
        external
    {
        if (!isAgent[msg.sender]) revert NotAgent();
        if (!isVoter[voter]) revert UnknownVoter();
        if (verdict == Voter.Verdict.None || confidence > 100) revert BadValue();
        bytes32 key = keccak256(abi.encode(voter, proposalId));
        if (finalized[key]) revert AlreadyFinal();
        if (agentVerdict[key][msg.sender] != 0) revert AlreadySubmitted();

        uint8 v = uint8(verdict);
        agentVerdict[key][msg.sender] = v;
        uint8 count = ++tally[key][v];
        uint8 low = _lowestConfidence[key][v];
        if (count == 1 || confidence < low) _lowestConfidence[key][v] = confidence;
        emit AgentVerdict(voter, proposalId, msg.sender, verdict, confidence, reason);

        if (count >= threshold) {
            finalized[key] = true;
            uint8 finalConf = _lowestConfidence[key][v];
            uint48 readyAt = Voter(voter).recordVerdict(proposalId, verdict, finalConf, reason);
            emit VerdictSubmitted(voter, proposalId, verdict, finalConf, reason, readyAt);
        }
    }

    // ---------- Đọc ----------

    function voterCount() external view returns (uint256) {
        return voters.length;
    }

    function governorCount() external view returns (uint256) {
        return governors.length;
    }

    function agentCount() external view returns (uint256) {
        return agents.length;
    }

    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    function proposalAt(uint256 index) external view returns (Proposal memory) {
        return _proposals[index];
    }

    function agentVerdictOf(address voter, uint256 proposalId, address agent) external view returns (uint8) {
        return agentVerdict[keccak256(abi.encode(voter, proposalId))][agent];
    }
}
