# Thiết kế: DAO Autopilot

## Vấn đề
Người giữ token quản trị không có thời gian đọc từng đề xuất. Không bỏ phiếu thì mất tiếng nói, giao cho người khác thì mất kiểm soát. Dapp để người dùng viết chính sách bằng chữ thường, AI đọc đề xuất mới, ví tự bỏ phiếu theo chính sách.

## Thành phần
1. Contract quản trị (Governor): tạo đề xuất và bỏ phiếu. Tự deploy trên Base Sepolia để demo.
2. Contract bỏ phiếu thay (Voter): được người dùng ủy quyền biểu quyết (delegate). Chỉ nhận lệnh từ cổng trung gian callback của Reactive và phán quyết từ địa chỉ AI đã đăng ký.
3. Contract phản ứng (Reactive contract): trên Reactive Lasna, lắng nghe sự kiện và nối các bước.
4. Dịch vụ AI ngoài chuỗi: đọc đề xuất, so với chính sách, gửi phán quyết lên chuỗi. Contract không gọi được internet nên AI phải ở ngoài chuỗi.
5. Token test ERC20Votes: mint công khai, hạn mức mỗi ví.

## Luồng
1. Người dùng lưu chính sách vào Voter.
2. Có đề xuất mới: Governor phát ProposalCreated.
3. Reactive thấy sự kiện, gọi callback về Voter, Voter phát ReviewRequested.
4. Dịch vụ AI nghe ReviewRequested, đọc đề xuất và chính sách, gửi submitVerdict(id, ủng hộ/phản đối/bỏ qua, lý do, độ tin cậy).
5. Voter phát VerdictSubmitted, Reactive thấy và gọi callback để Voter castVote trên Governor.
6. Lý do lưu on-chain để kiểm tra sau.

## Quy tắc an toàn
- Ngưỡng tin cậy: dưới ngưỡng thì không bỏ phiếu, chỉ báo người dùng.
- Chỉ một địa chỉ AI được gửi phán quyết (ghi rõ điểm tin cậy này trong README).
- Mỗi đề xuất chỉ nhận một phán quyết, chỉ bỏ phiếu trong thời gian bỏ phiếu.

## Luồng giao diện (điều kiện tiên quyết trước)
Kết nối ví, mint token, ủy quyền cho Voter, rồi mới soạn chính sách. Mỗi bước chờ bước trước xong.

## Vì sao khác các bài cùng track
Các bài AI khác (Aegis, Sentinel, MintSentinel, Plain-English Automations) chấm giá hoặc rủi ro. Bài này đọc văn bản đề xuất và so với chính sách người dùng.

## Chưa kiểm chứng
- Cách Reactive Omni subscribe và callback trong thực tế (docs chỉ có đoạn mẫu).
- Phí thực tế cho mỗi vòng.
- Một dự án có nộp nhiều track được không.
