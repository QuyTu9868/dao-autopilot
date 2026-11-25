# Checkpoints

Hôm nay: 15/11/2026. Deadline: 06/12/2026 03:00 (UTC+7). Nộp sớm: tối 04/12.
Mỗi checkpoint có "xong khi" để biết đã đạt chưa. Không sang checkpoint sau khi chưa đạt.

## CP0: Chuẩn bị (15/11 đến 16/11)
- [ ] Đăng ký hackathon trên DoraHacks (bạn tự bấm Register, cần đăng nhập)
- [ ] Tạo ví dev mới bằng script, key vào .env
- [ ] Thêm mạng Reactive Lasna vào MetaMask
- [ ] Lấy ETH Base Sepolia (faucet có captcha, bạn làm)
- [ ] Gửi ETH tới faucet contract Reactive để nhận lREACT
- [ ] Kiểm tra Foundry hoặc Hardhat chạy được, cài reactive-lib-omni
- [ ] Đọc repo reactive-smart-contract-demos và reactive-lib-omni
- Xong khi: ví dev có ETH Base Sepolia và lREACT, build được 1 contract mẫu.

## CP1: Contract nền trên Base Sepolia (17/11 đến 19/11)
- [x] Token ERC20Votes, mint công khai, hạn mức mỗi ví
- [x] Governor test (thời gian bỏ phiếu ngắn để demo)
- [x] Voter: lưu chính sách, nhận phán quyết, bỏ phiếu
- [x] Test bằng Foundry, deploy, verify
- Xong khi: tạo đề xuất và bỏ phiếu thủ công qua Voter chạy được.

## CP2: Vòng 1, sự kiện đến lệnh gọi lại (20/11 đến 22/11)
- [x] Reactive contract đăng ký theo dõi ProposalCreated
- [x] Callback về Voter, phát ReviewRequested
- [x] Nạp lREACT và ETH cho các contract cần trả phí
- Xong khi: tạo đề xuất thì ReviewRequested tự phát, có tx hash.

## CP3: Vòng 2, AI đến bỏ phiếu (23/11 đến 26/11)
- [x] Dịch vụ AI đọc đề xuất và chính sách, trả ủng hộ / phản đối / bỏ qua kèm lý do, độ tin cậy
- [x] Ngưỡng tin cậy: dưới ngưỡng thì không bỏ phiếu
- [x] Voter chỉ nhận phán quyết từ địa chỉ AI đã đăng ký
- [x] Reactive thấy VerdictSubmitted rồi gọi castVote
- Xong khi: 3 đề xuất mẫu (ủng hộ, phản đối, mơ hồ) cho ra 3 kết quả đúng.

## CP4: Giao diện (27/11 đến 30/11)
Skill giao diện: impeccable (đã chọn). Không dùng chế độ live. Chạy impeccable init trước khi thiết kế.
- [x] Kết nối ví, rồi mint token, rồi ủy quyền (đúng thứ tự, mỗi bước chờ bước trước)
- [x] Soạn chính sách, xem danh sách đề xuất, phán quyết, lý do
- [x] Trạng thái giao dịch rõ ràng, xử lý khi từ chối ký
- Xong khi: người lạ có ví mới đi hết luồng không cần hỏi.

## CP5: Kiểm thử và đo (01/12 đến 02/12)
- [x] Kiểm thử đầu cuối cả luồng
- [x] Quét bảo mật contract (skill contract-test-audit)
- [x] Đo độ trễ vòng sự kiện đến bỏ phiếu, ghi tx hash
- Xong khi: có bảng số đo và danh sách tx hash cho cả hai vòng.

## CP6: Tài liệu và video (03/12)
- [x] README nộp bài: tổng quan, cách chạy, địa chỉ contract, sơ đồ, link faucet
- [x] Video dưới 3 phút: submission/video/dao-autopilot-demo.mp4 (bản v4, 2:37, giọng Gemini TTS, có Veto, hai nguồn AI, Treasury DAO). Còn tải lên YouTube để lấy link công khai
- [x] Repo public, giấy phép mã nguồn mở: https://github.com/QuyTu9868/dao-autopilot (MIT)
- Xong khi: người ngoài đọc README là chạy lại được.

## Giai đoạn cải tiến (thêm 23/11)
Sự cố 23/11 (đã hết ngày 24/11, mạng chạy lại, không sửa gì ở code): Reactive Lasna không chuyển tiếp sự kiện từ Base Sepolia (cả contract v1 còn quỹ lẫn v4 mới đều không phản ứng; Ethereum Sepolia vẫn chạy vì faucet lREACT về ngay). Chạy thật bản v4 ngày 24/11: AI bắt lệch 50.000 so với 5.000 (Against, có tx), hai nguồn AI đồng ý, Veto chặn được phiếu, phiếu không bị Veto tự bỏ sau cửa sổ qua cron. Tx hash trong submission/evidence.md.
Bản v4 đã deploy và verify (23/11): VoterHub 0x3AD291e582CfCEa430795cad7e2cFFb413856609, DaoReactive 0x0b2D1490Ea0E9A566eCcd61e8BaeAb81559c0f60 (Lasna), TreasuryGovernor 0x3ACdDD1F5e156F68b29b469DB08673ef38F797a9, Timelock 0xEb0daf93da515424063Af1F2106ed824002276b9, TDAO 0x18e5eb53461F67ec2df67eD4cA5f60a55a86db90. Test Foundry 49/49.
Thứ tự: CP8 tới CP13 trước, CP14 tới CP16 sau cùng, rồi mới quay lại CP6 (repo, deploy, quay lại video vì giao diện đổi) và CP7.
Các thay đổi contract của CP9 tới CP13 gom vào một lần deploy lại (bản v4) để người dùng không phải tạo Voter nhiều lần.

## CP8: AI đọc cả nội dung thực thi của đề xuất (23/11 đến 24/11)
- [x] Giải mã targets, values, calldatas thành hành động dễ đọc (ABI của contract đã verify, không có thì hiện selector thô)
- [x] Đưa hành động vào prompt, AI phải đánh dấu khi mô tả và hành động không khớp (Gemini đúng 4/4 ca)
- [x] Giao diện hiện danh sách hành động dưới mỗi đề xuất
- Xong khi: đề xuất mô tả "audit" nhưng calldata chuyển token cho ví lạ bị chấm Against, có tx hash.

## CP9: Cửa sổ phủ quyết (24/11 đến 26/11)
- [x] Chủ Voter đặt thời gian phủ quyết; trong khoảng đó bấm "Veto" để chặn phiếu (contract, đã chạy thật)
- [x] Phiếu chỉ được bỏ sau khi hết cửa sổ (Reactive xếp hàng, Cron10 bật khi có phiếu chờ, đã chạy thật)
- [x] Giao diện đếm ngược và nút Veto (thử bằng ví mới qua giao diện, 24/11)
- Xong khi: một phiếu bị Veto thì không bỏ, một phiếu không Veto thì tự bỏ sau cửa sổ, đều có tx hash. ĐẠT 24/11 (submission/evidence.md).

## CP10: Lịch sử và thống kê mỗi Voter (26/11)
- [x] Voter lưu danh sách đề xuất đã chấm và số For / Against / Skip / Veto
- [x] Giao diện trang lịch sử: lý do, độ tin cậy, kết quả từng đề xuất
- Xong khi: lịch sử hiện đủ các đề xuất cũ của một Voter, không phụ thuộc giới hạn 8 dòng.

## CP11: Chống spam Voter (27/11)
- [x] createVoter thu phí nhỏ bằng ETH, phí này trả cho callback của chính Voter đó (0.0005 ETH)
- [x] Dịch vụ AI bỏ qua Voter không có quyền biểu quyết tại thời điểm chụp
- Xong khi: Voter rỗng không tốn lần gọi model nào, test chứng minh phí được thu.

## CP12: Nhiều nguồn AI cùng quyết (27/11 đến 29/11)
- [x] Hub giữ danh sách N địa chỉ AI và ngưỡng M; phán quyết chỉ chốt khi M nguồn đồng ý (Hub v4, 2 nguồn, ngưỡng 2)
- [x] Chạy ít nhất 2 nguồn AI khác nhau (model hoặc prompt khác), mỗi nguồn một ví (flash-lite 3.1 và 3.5)
- [x] Giao diện hiện từng nguồn đã nói gì
- Xong khi: hai nguồn bất đồng thì không bỏ phiếu và giao diện nói rõ vì sao.

## CP13: Gắn với nhiều Governor, gần DAO thật (29/11 đến 30/11)
- [x] Tìm DAO thật có Governor trên testnet: chỉ thấy B4MAD DAO (Base Sepolia, governor 0x0DA4e9a900d39F6a5F1EfcA1385F65A6F5dD88fd), đã ngừng khoảng 2 tháng và toàn bộ token nằm ở ví deployer, nên không dùng để demo được. Thêm một Governor bất kỳ chỉ cần addGovernor trên Reactive và Hub.
- [x] Reactive theo dõi nhiều Governor, Voter chọn Governor của mình
- [x] Demo với một Governor thứ hai có kho bạc và timelock giống DAO thật (đã deploy, test Foundry chạy đủ vòng đời)
- Xong khi: đề xuất trên Governor thứ hai cũng đi hết hai vòng. ĐẠT 24/11: Treasury DAO qua giao diện, AI chấm For, bỏ phiếu, xếp hàng, thực thi, kho bạc trả 5.000 TDAO (submission/evidence.md).

## CP14: Dịch vụ AI chạy 24/7 trên cloud (01/12)
- [ ] Deploy lên dịch vụ có gói miễn phí, key nằm trong biến môi trường của dịch vụ (đã sẵn: Dockerfile chạy 2 nguồn AI, /health, render.yaml; còn cần repo GitHub và tài khoản Render của bạn)
- Xong khi: tắt máy vẫn có phán quyết cho đề xuất mới.

## CP15: Thử bằng ví thật (01/12)
- [ ] MetaMask trên máy tính đi hết luồng
- [ ] Ví điện thoại qua WalletConnect (cần projectId)
- Xong khi: cả hai ví đi hết luồng, ghi lại lỗi nếu có.

## CP16: Quỹ lREACT không cạn (02/12)
- [x] Script kiểm tra số dư và nợ của contract Reactive, nạp khi dưới ngưỡng (scripts/reactive-funds.mjs, nạp qua depositTo)
- [x] Cảnh báo trong dịch vụ AI khi quỹ thấp (kiểm tra 10 phút một lần)
- Xong khi: chạy script thấy quỹ đủ cho ít nhất 50 đề xuất. ĐẠT 24/11: đo thực tế khoảng 0,07 lREACT mỗi đề xuất, đã nạp đủ cho khoảng 60 đề xuất (tx Lasna 0x5bf524ba049ca503e07d4898fea91057714cfaa62221325bc68d494961d94af3).

## CP7: Nộp bài (04/12, dự phòng đến 06/12 03:00)
- [ ] Nộp trên DoraHacks: repo, địa chỉ contract, tx hash, video
- [ ] Kiểm tra link demo mở được từ máy khác
- Xong khi: trang Build hiện bài của bạn.

## Việc phụ: Delphi Agent Arena
- 23/11: starter agent và API key có. Chỉ làm nếu CP3 đã xong và ToS chấp nhận được (KYC).
- Mining đến 11/12, kết quả 16/12.
