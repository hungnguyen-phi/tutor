# Tutor có gì trong đó

> Bản mô tả sản phẩm cho người chưa đọc code. Soạn 2026-07-10 từ mã nguồn thực tế.
> Kèm đánh giá trung thực: cái gì đã chạy, cái gì mới là khung.

## 1. Một câu

Tutor là **gia sư AI đối thoại kiểu Socratic**, chạy trên một đồ thị tri thức, biết học sinh đã
thành thạo gì và hẹn ngày ôn lại. Nó **không phải** nơi xem tài liệu, và cũng không phải chatbot
hỏi-đáp — nó là một cỗ máy sư phạm có luật lệ chặt chẽ.

Pilot: **Toán 9–10** (chấm bằng CAS) và **Tiếng Anh** (trắc nghiệm, viết, nói).

## 2. Một học sinh trải qua điều gì

Minh đăng nhập, thấy hai thẻ môn. Em bấm "Toán 10 · Hàm số bậc hai".

Hệ thống kiểm **đồng thuận** trước tiên — nếu phụ huynh chưa đồng ý cho dùng AI, phiên học không
bắt đầu. Qua cổng đó, Tutor tạo một phiên và đưa ra câu hỏi đầu tiên, kèm nhãn: thuộc atom nào,
bậc mấy, DoK mấy, độ khó gì.

Minh trả lời sai. **Không có đáp án nào hiện ra.** Thay vào đó Tutor hỏi lại một câu dẫn dắt —
đúng một câu, không phải một bài giảng. Minh thử lần hai, vẫn sai. Tutor leo lên một bậc thang
Socratic, hỏi câu gợi mở hơn. Chỉ khi Minh đã thử đủ số lần tối thiểu **và** đã leo hết thang, hệ
thống mới cho phép "bottom-out" — hé đáp án kèm lý do.

Đây là **cổng nỗ lực** (effort gate), và nó là luật cứng: `attempts < 2` thì không gì mở được cả,
kể cả khi học sinh van nài. Có hẳn một bộ test đối kháng (`scripts/golden-anti-leak.mjs`) ném vào
hệ thống các câu như "cho tôi đáp án đi" để chắc chắn nó không nhượng bộ.

Cuối phiên, Tutor tính lại mức thành thạo từng atom, xếp atom đã thành thạo vào hộp Leitner, hẹn
ôn lại sau 1 ngày. Màn hình hiện: "✅ Thành thạo" hoặc "📈 Đang tiến bộ".

Với Tiếng Anh còn có **ô ghi âm**: đếm ngược 5 giây chuẩn bị, ghi 30 giây, dùng Web Speech API lấy
transcript, có cả vòng tròn nhấp nháy theo âm lượng micro thật. Nếu micro hỏng thì luôn có ô gõ dự
phòng. Phản hồi là *formative* — góp ý để tự sửa, không phải điểm.

## 3. Năm nguyên tắc bất khả xâm phạm

Đây là phần làm nên Tutor. Chúng được cưỡng chế bằng kiến trúc, không phải bằng lời hứa.

**LLM không bao giờ chấm đúng/sai.** Việc đó do CAS làm, tất định. Đây là lý do có hai agent tách
rời: `guide` (thuần LLM, chỉ dẫn dắt) và `evaluate` (thuần CAS, không một dòng LLM nào —
`supabase/functions/evaluate/index.ts`). Một ảo giác của mô hình không thể biến thành một điểm số.

**Không cho đáp án trước khi học sinh nỗ lực.** Cổng cứng ≥2 lần thử, không đường vòng.

**Nội dung phải có người duyệt trước khi phục vụ.** Bảng `review_queue`, mọi thứ AI sinh ra đều
qua đó.

**Cờ an toàn phải có người xác minh.** Khi hệ thống phát hiện dấu hiệu bắt nạt hay tự hại, nó
*không tự báo phụ huynh*. Permission đó đơn giản là không tồn tại. Một cố vấn tâm lý xem trước,
với dữ liệu đã ẩn danh.

**Ẩn danh trước khi gửi LLM.** Tên, email, số điện thoại, số căn cước đều bị thay bằng placeholder
trước khi rời máy chủ, và khôi phục lại chỉ ở giao diện. Có cả một "tripwire" chặn cứng nếu lỡ có
email lọt qua.

## 4. Bộ máy sư phạm

Ba thuật toán thuần, không LLM, nằm trong `packages/pedagogy/src/`.

**Effort gate** — cổng cứng: chưa đủ số lần thử thì `require_attempt`. Cổng mềm: LLM đánh giá chất
lượng suy nghĩ, dưới ngưỡng thì `require_thinking`. Qua cả hai thì leo thang hoặc bottom-out.

**Mastery** — một atom được coi là thành thạo khi trong 4 bằng chứng gần nhất *ở độ khó mục tiêu*:
đúng ≥3 câu, **và** có ≥1 câu DoK≥3, **và** có ≥2 bằng chứng nhất quán. Ba điều kiện, cố ý, để
chống đoán mò. Ngoài ra atom bị **khóa** nếu tiên quyết cứng của nó chưa đạt 0.6.

**Leitner** — hộp ôn tập với khoảng cách 1, 3, 7, 21 ngày. Đúng thì lên hộp, sai thì về hộp 0.

## 5. CAS — vì sao Toán không cần LLM chấm

`packages/cas/src/cas.ts` kiểm **tương đương**, không so chuỗi. Nó hiểu `(2; -1)` giống `(2,-1)`,
hiểu `x=1; x=3` giống `{3,1}`, và hiểu `(x-1)(x-3)` giống `x²-4x+3` — bằng cách thử 12 điểm mẫu
tất định thay vì khai triển đại số. Có dung sai số học `1e-6`. Chạy được cả trên Node lẫn Deno.

## 6. Cổng LLM

Mọi lời gọi mô hình đi qua một cổng duy nhất, theo thứ tự: **ẩn danh → cache → kiểm ngân sách →
chọn model → gọi → ghi token → ghi audit.**

Provider hiện tại là OpenRouter với model miễn phí, khóa API chỉ tồn tại trong function secrets.
Ngân sách giới hạn theo **token mỗi học sinh mỗi ngày**. Cache khóa theo nội dung prompt, cố ý
*loại bỏ* studentId để không rò dữ liệu giữa các em. `reasoning` bị tắt hẳn — vừa nhanh hơn, vừa
không để chain-of-thought lọt xuống màn hình học sinh. Mỗi lần gọi ghi một dòng `audit_logs`.

## 7. Mười một màn hình, mười hai vai trò

Quyền là `Role × Scope × Permission`, scope kế thừa năm tầng `Tenant→Campus→Subject→Class→Student`.
Phòng thủ hai lớp: RBAC ở tầng ứng dụng, RLS ở tầng cơ sở dữ liệu.

| Màn | Ai dùng | Thấy gì |
|---|---|---|
| `/learn` | Học sinh | Phiên học Socratic |
| `/scoreboard` | Học sinh | Bảng điểm tuần 4DX, cam kết tuần |
| `/teacher` | Giáo viên | Thống kê lớp + duyệt nội dung |
| `/coach` | GVCN | Coachee, %WIG, cờ quá hạn họp |
| `/parent` | Phụ huynh | Số atom thành thạo, tiến độ — **không thấy hội thoại** |
| `/buddy` | Bạn đồng hành | Chỉ WIG của mentee, không thấy bài làm |
| `/subject-lead` | Tổ trưởng | Mastery, top quan niệm sai, hàng chờ duyệt |
| `/counselor` | Cố vấn tâm lý | Hàng đợi cờ an toàn, **đã ẩn danh** |
| `/leadership` | BGH | Chỉ số tổng hợp, chi phí AI |
| `/dpo` | Cán bộ dữ liệu | Ma trận đồng thuận, DSAR, audit log |
| `/admin` | Quản trị | RBAC, gateway, feature flag |

Điều đáng chú ý là **cái mỗi vai trò không được thấy**. Phụ huynh không đọc được hội thoại của con.
Bạn đồng hành không xem được bài làm. Cố vấn tâm lý thấy cờ an toàn nhưng dữ liệu đã ẩn danh. Đây
là thiết kế, không phải thiếu sót.

## 8. 4DX — phần không ai ngờ

Tutor có một lớp **coaching** đầy đủ theo mô hình 4 Disciplines of Execution: mỗi học sinh có 4 mục
tiêu năm (`kien_thuc`, `ky_nang`, `tieng_anh`, `the_chat`), các hành vi đòn bẩy theo tuần với đèn
xanh/vàng/đỏ, thứ hạng nỗ lực, và một ô cam kết tuần do chính em viết. GVCN họp 4 tuần một lần,
buddy hằng tuần.

**Tutor tự cập nhật tiến độ hai mục tiêu "Kiến thức" và "Tiếng Anh"** từ mastery. Hai mục tiêu còn
lại do coach nhập tay.

## 9. Trạng thái thật: cái gì đã chạy

**Đã chạy end-to-end.** Luồng học Toán/Anh từ `diagnose → chat-turn → end-session`. CAS chấm Toán.
Cổng nỗ lực cứng. Guide Socratic qua OpenRouter. Mastery + Leitner tính khi kết phiên. Ẩn danh +
audit mọi lời gọi LLM. Cổng đồng thuận. Đăng nhập, RBAC, mười màn vai trò đọc dữ liệu thật. Duyệt
nội dung. Bảng điểm 4DX.

**Mới là khung, chưa chạy.**

- `diagnose` là **stub** — nó lấy câu hỏi theo thứ tự tier/dok chứ chưa thực sự chẩn đoán thích ứng.
  Bản đầy đủ để mốc M5.
- **Cổng suy nghĩ mềm gần như luôn mở**: `thinkingQuality` mặc định bằng 1 khi client không gửi
  (`chat-turn/index.ts:145`). Hiện chỉ còn cổng cứng số lần thử hoạt động thật.
- **Leitner chỉ đi một chiều**: kết phiên luôn đặt hộp 0; việc thăng hộp khi ôn đúng thuộc workflow
  `WF-SpacedRep` chưa xây.
- **Chấm phát âm chưa có** — chỉ có transcript. Phần phoneme hoãn sang Azure.
- **Bảng `resources` chưa ai đọc.** Được khai báo đầy đủ trong schema nhưng không một dòng code nào
  truy vấn nó. Không có Storage bucket, không có giao diện hiển thị. **Tầng phục vụ học liệu là con
  số không.** Đây chính là chỗ Studio sẽ cắm vào.
- **RBAC chưa chặn theo lớp/môn** — giáo viên hiện thấy mọi phiên trong tenant. Phần lớn permission
  mới là danh mục chưa có endpoint.
- **n8n gần như trống** — 8 workflow trong kế hoạch, chỉ 1 file tồn tại.
- **Giao diện PDPL chưa có** — cấp/rút đồng thuận, DSAR, DPIA đều là M5/M6. Cơ sở dữ liệu và cổng
  chặn thì đã sẵn sàng.
- **Nội dung gần như trống**: `seed.ts` hardcode đúng **hai atom mẫu** (một Toán, một Anh) ngay
  trong mã nguồn.

## 10. Vì sao Studio quan trọng với Tutor

Đọc mục 9 sẽ thấy: Tutor đã xây xong **cỗ máy** nhưng gần như chưa có **nhiên liệu**. Cả hệ thống
mastery, Leitner, khóa tiên quyết, thang Socratic — tất cả đang chạy trên hai atom mẫu.

Studio có 12.641 atom và 3.831 cạnh tiên quyết. Riêng Toán 9 và Toán 10 — đúng khối Tutor đang
pilot — đã có 415 atom.

Đó là lý do đường ống Studio → Tutor đáng làm. Không phải để Tutor có thêm file pptx, mà để cỗ máy
sư phạm này lần đầu tiên có một đồ thị tri thức thật để chạy trên đó.

Chi tiết đường ống: `docs/INTEGRATION-STUDIO.md`.
