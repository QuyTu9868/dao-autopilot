# Ghi chú nghiên cứu (đọc 14/11 đến 15/11/2026)

## Hackathon
- Reactive Omni Buildathon: https://dorahacks.io/hackathon/reactive-omni-buildathon/detail
- Giải $5.500 trả bằng REACT: Every Second Counts ($2.000 + $250), Set It and Forget It ($2.000 + $250), Reactive Meets AI ($1.000, 1 suất).
- Chấm bởi đội Reactive, 4 tiêu chí 1 đến 5: Execution, Integration, Usefulness, Craft. Bài không có reactive tx và callback on-chain thì không được chấm tiếp.
- Nộp: repo public, địa chỉ contract, vài tx hash đủ vòng, video dưới 3 phút. Phải build trong sự kiện.
- Luật track AI: AI phải nằm trong hệ thống đang chạy, không chỉ dùng để viết code.
- Chưa rõ: KYC, mốc và cách trả thưởng REACT.

## Đối thủ cùng track AI (khi đọc ngày 15/11)
Plain-English Automations, MintSentinel, Sentinel, Aegis. Các ý stop-loss, arbitrage, dead man's switch rất đông ở track khác.

## Mạng Reactive Lasna (testnet), nguồn https://dev.reactive.network/reactive-mainnet
- Tên: Reactive Lasna
- RPC: https://lasna-rpc.rnk.dev/
- Chain ID: 5318007
- Ký hiệu: lREACT (blog cũ ghi REACT, mâu thuẫn, cần kiểm tra lại)
- Explorer: https://lasna.reactscan.net/
- System contract: 0x8888888888888888888888888888888888888888

## Faucet lREACT
Gửi ETH tới contract faucet, nhận lREACT ở cùng địa chỉ ví. 1 ETH = 100 lREACT. Tối đa 5 ETH mỗi giao dịch, gửi quá sẽ mất.
- Base Sepolia: 0x2afaFD298b23b62760711756088F75B7409f5967
- Ethereum Sepolia: 0x9b9BB25f1A81078C544C829c5EB7822d747Cf434
ETH Base Sepolia: Alchemy (0.1 ETH/24h), Circle (0.01 ETH), GetBlock (cần đăng nhập).

## Cổng trung gian callback (nhận lệnh gọi lại)
- Base Sepolia (84532): 0x476F44b11F5C942c58f4c8E3d0300E5710743585
- Unichain Sepolia (1301): 0x775c9B990ADe401060B78D0e98684eEf8d2466C1
- Ethereum Sepolia (11155111): 0xAa14d9Cd0f788Ca23d11805986C1d8bd035D23b4
- Reactive Lasna: 0x8888888888888888888888888888888888888888

## Quy tắc kỹ thuật từ docs
- Solidity ^0.8.29, Omni không còn RVM, hàm react dùng onlySystem.
- Phí callback tính bằng token gốc của chain đích. Gas callback tối thiểu 100.000, trần gas tx reactive 900.000.
- Thư viện: https://github.com/Reactive-Network/reactive-lib-omni
- Ví dụ: https://github.com/Reactive-Network/reactive-smart-contract-demos
- Verify dùng Sourcify, với Lasna thêm --chain-id 5318007.
- Base Sepolia nay tạo block mỗi 200ms: dùng timestamp, không dùng số block cho bộ đếm.
- Thứ tự deploy: contract reactive, rồi contract callback (truyền proxy và địa chỉ reactive), đặt recipient, nạp tiền cả hai. callbackSender_ là immutable.
- Payload callback: 160 bit đầu bị thay bằng địa chỉ contract reactive, nên tham số đầu phải là address (dùng address(0) làm chỗ giữ).

## Mẫu code từ docs (rút gọn)
Reactive contract:
    contract MyReactive is AbstractReactive {
      constructor(uint256 originChainId_, address originContract_, uint256 topic0_) payable {
        SYSTEM.subscribe(originChainId_, originContract_, topic0_, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
      }
      function react(LogRecord memory log_) external onlySystem { /* logic */ }
    }
Yêu cầu callback:
    bytes memory payload = abi.encodeWithSignature("myCallback(address,uint256)", address(0), value_);
    SYSTEM.requestCallbackV_1_0(ISystemContract.CallbackConfiguration_V_1_0({
      chainId: chainId_, recipient: recipient_, gasLimit: CALLBACK_GAS_LIMIT, payload: payload }));
Contract nhận callback:
    constructor(IPayable callbackProxy_, address callbackSender_) payable AbstractCallback(callbackProxy_, callbackSender_) {}
    function myCallback(address reactive_, uint256 value_) external onlyServiceProvider onlyCallbackSender(reactive_) {}

## Delphi Agent Arena (việc phụ)
- Đăng ký từ 13/11, mining 23/11 đến 11/12, kết quả 16/12. Giải $7.250 USDC.
- ToS: người thắng phải qua xác minh danh tính và sàng lọc trừng phạt, tự chịu thuế. Bằng chứng nộp bị cấp license vĩnh viễn cho Gensyn để huấn luyện AI.
