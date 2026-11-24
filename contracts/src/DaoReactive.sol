// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import { AbstractReactive } from "reactive-lib-omni/base/AbstractReactive.sol";
import { ISystemContract } from "reactive-lib-omni/interfaces/ISystemContract.sol";

/// Chạy trên Reactive Lasna, phục vụ mọi Voter qua VoterHub.
/// - Governor đã đăng ký phát ProposalCreated: callback Hub.requestReview (kèm tiêu đề ngắn).
/// - Hub phát VerdictSubmitted: nếu không có cửa sổ phủ quyết thì callback Hub.castVerdict ngay;
///   có cửa sổ thì xếp hàng, và mỗi nhịp Cron10 (khoảng 10 giây) gọi những phiếu đã hết cửa sổ.
///   Chỉ đăng ký cron khi hàng đợi có phiếu, để không trả phí lúc rảnh.
contract DaoReactive is AbstractReactive {
    struct Pending {
        address voter;
        uint256 proposalId;
        uint256 readyAt;
    }

    uint64 public constant CALLBACK_GAS_LIMIT = 500_000;
    uint256 public constant TITLE_BYTES = 120;
    uint256 public constant CLOCK_MARGIN = 3; // giây, bù lệch đồng hồ giữa Lasna và chain đích
    uint256 public constant MAX_PER_TICK = 8;
    // keccak256("ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)")
    uint256 public constant PROPOSAL_CREATED_TOPIC =
        0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0;
    // keccak256("VerdictSubmitted(address,uint256,uint8,uint8,string,uint256)")
    uint256 public constant VERDICT_SUBMITTED_TOPIC = 0xceae693ce7197969bfde240aa8e01c20a70ba6be3f94f185f8e7669a5be4be6b;
    // Cron của Reactive: hệ thống phát mỗi 10 block trên Lasna
    address public constant CRON_SOURCE = 0x0000000000000000000000000000000000fffFfF;
    uint256 public constant CRON10_TOPIC = 0x04463f7c1651e6b9774d7f85c85bb94654e3c46ca79b0c16fb16d4183307b687;

    address public immutable owner;
    uint256 public immutable originChainId;
    address public hub;
    mapping(address => bool) public isGovernor;
    Pending[] public queue;
    bool public cronOn;

    event GovernorWatched(address indexed governor);
    event ReviewForwarded(address indexed governor, uint256 indexed proposalId);
    event VoteQueued(address indexed voter, uint256 indexed proposalId, uint256 readyAt);
    event VoteForwarded(address indexed voter, uint256 indexed proposalId);
    event CronSwitched(bool on);

    error NotOwner();
    error HubAlreadySet();
    error AlreadyWatched();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(uint256 originChainId_) payable {
        owner = msg.sender;
        originChainId = originChainId_;
    }

    /// Theo dõi ProposalCreated của một Governor trên chain nguồn.
    function addGovernor(address governor) external onlyOwner {
        if (isGovernor[governor]) revert AlreadyWatched();
        isGovernor[governor] = true;
        SYSTEM.subscribe(
            originChainId, governor, PROPOSAL_CREATED_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
        emit GovernorWatched(governor);
    }

    /// Đặt Hub nhận callback và theo dõi VerdictSubmitted của nó. Chỉ đặt một lần.
    function setHub(address hub_) external onlyOwner {
        if (hub != address(0)) revert HubAlreadySet();
        hub = hub_;
        SYSTEM.subscribe(
            originChainId, hub_, VERDICT_SUBMITTED_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE
        );
    }

    function queueLength() external view returns (uint256) {
        return queue.length;
    }

    function react(LogRecord calldata log_) external override onlySystem {
        if (hub == address(0)) return;
        if (log_.topic0 == PROPOSAL_CREATED_TOPIC && isGovernor[log_.contractAddress]) {
            (uint256 proposalId,,,,,,,, string memory description) = abi.decode(
                log_.data, (uint256, address, address[], uint256[], string[], bytes[], uint256, uint256, string)
            );
            // Tham số đầu (address(0)) sẽ được thay bằng địa chỉ contract này.
            _callback(
                abi.encodeWithSignature(
                    "requestReview(address,address,uint256,string)",
                    address(0),
                    log_.contractAddress,
                    proposalId,
                    _title(description)
                )
            );
            emit ReviewForwarded(log_.contractAddress, proposalId);
        } else if (log_.topic0 == VERDICT_SUBMITTED_TOPIC && log_.contractAddress == hub) {
            address voter = address(uint160(log_.topic1));
            uint256 proposalId = log_.topic2;
            (,,, uint256 readyAt) = abi.decode(log_.data, (uint8, uint8, string, uint256));
            if (readyAt + CLOCK_MARGIN <= block.timestamp) {
                _castVerdict(voter, proposalId);
            } else {
                queue.push(Pending(voter, proposalId, readyAt));
                emit VoteQueued(voter, proposalId, readyAt);
                _switchCron(true);
            }
        } else if (log_.topic0 == CRON10_TOPIC && log_.contractAddress == CRON_SOURCE) {
            _drain();
        }
    }

    /// Gọi những phiếu đã hết cửa sổ phủ quyết; hàng đợi rỗng thì tắt cron.
    /// Gỡ khỏi hàng đợi trước, gọi callback sau (check-effects-interactions).
    function _drain() internal {
        Pending[] memory ready = new Pending[](MAX_PER_TICK);
        uint256 n = 0;
        uint256 i = 0;
        while (i < queue.length && n < MAX_PER_TICK) {
            if (queue[i].readyAt + CLOCK_MARGIN <= block.timestamp) {
                ready[n++] = queue[i];
                queue[i] = queue[queue.length - 1];
                queue.pop();
            } else {
                i++;
            }
        }
        bool empty = queue.length == 0;
        if (empty) _switchCron(false);
        for (uint256 k = 0; k < n; k++) {
            _castVerdict(ready[k].voter, ready[k].proposalId);
        }
    }

    function _castVerdict(address voter, uint256 proposalId) internal {
        _callback(abi.encodeWithSignature("castVerdict(address,address,uint256)", address(0), voter, proposalId));
        emit VoteForwarded(voter, proposalId);
    }

    function _switchCron(bool on) internal {
        if (on == cronOn) return;
        cronOn = on;
        if (on) {
            SYSTEM.subscribe(block.chainid, CRON_SOURCE, CRON10_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        } else {
            SYSTEM.unsubscribe(block.chainid, CRON_SOURCE, CRON10_TOPIC, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        }
        emit CronSwitched(on);
    }

    function _callback(bytes memory payload) internal {
        SYSTEM.requestCallbackV_1_0(
            ISystemContract.CallbackConfiguration_V_1_0({
                chainId: originChainId,
                recipient: hub,
                gasLimit: CALLBACK_GAS_LIMIT,
                payload: payload
            })
        );
    }

    function _title(string memory description) internal pure returns (string memory) {
        bytes memory b = bytes(description);
        if (b.length <= TITLE_BYTES) return description;
        bytes memory t = new bytes(TITLE_BYTES);
        for (uint256 i = 0; i < TITLE_BYTES; i++) {
            t[i] = b[i];
        }
        return string(t);
    }
}
