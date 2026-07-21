# Product

## Register

product

## Users

**Học sinh lớp 6–12 Trường Liên cấp Việt Anh** là người dùng chính. Bối cảnh điển hình: ngồi ở
góc học tập lúc 8 giờ tối, vừa ăn cơm xong, hơi mệt, muốn học 10–15 phút rồi đi ngủ. Trên điện
thoại nhiều hơn máy tính. Việc cần làm: luyện một điểm kiến thức tới mức thành thạo, và giữ được
thói quen học mỗi ngày.

Người dùng phụ (mỗi vai một màn riêng, quyền hạn khác nhau): giáo viên bộ môn, giáo viên chủ nhiệm
kiêm coach, tổ trưởng chuyên môn, phụ huynh, bạn đồng hành (buddy), cố vấn tâm lý, ban giám hiệu,
cán bộ bảo vệ dữ liệu, quản trị hệ thống.

## Product Purpose

Gia sư AI **đối thoại kiểu Socratic** chạy trên đồ thị tri thức. Nó không đưa đáp án — nó hỏi lại,
dẫn học sinh tự tìm ra. Nó biết em đã thành thạo điểm kiến thức nào, điểm nào bị khoá vì chưa nắm
tiên quyết, và hẹn ngày ôn lại theo hộp Leitner.

Thành công không phải là "học sinh trả lời đúng nhiều". Thành công là **học sinh chịu thử lần thứ
hai khi lần đầu sai**, và quay lại vào ngày hôm sau.

## Brand Personality

Ấm áp · nghiêm túc · kiên nhẫn.

**Sư tử là BẠN ĐỒNG HÀNH, xưng "mình – bạn"** (quyết định chủ dự án 2026-07-11, thay giọng
thầy–em trước đó): một người bạn học giỏi ngồi cạnh — không nịnh, không hạ mình, không ra vẻ
người lớn. Khen bằng ngôn ngữ học tập — khen **nỗ lực và chiến lược**, không bao giờ khen
"bạn thông minh". Khi bạn sai, không có tiếng chuông báo lỗi; có một câu hỏi khác.

Phân vai xưng hô: **sư tử/app → mình–bạn** (mọi bong bóng thoại, lời chào, phản hồi, prompt
LLM của tutor) · **giáo viên THẬT trong dashboard → thầy/cô–em/các em** (đúng vai người lớn).

## Anti-references

- **Duolingo bản gốc**: trừ "tim" khi sai. Ở đây điều đó là phản sư phạm — hệ thống *bắt buộc* học
  sinh thử ít nhất hai lần trước khi được gợi ý. Trừng phạt việc thử là phá đúng cơ chế cốt lõi.
- **Bảng xếp hạng theo điểm số.** Xếp hạng ở đây là **hạng nỗ lực** (`effort_rank`), không phải
  hạng giỏi. Không so sánh năng lực giữa các em.
- **Mascot hoạt hình ồn ào, confetti mỗi câu đúng, âm thanh vui nhộn.** Đây là trường học, không
  phải trò chơi. Phần thưởng phải hiếm để còn có nghĩa.
- **Dashboard SaaS**: thẻ chỉ số to, gradient, biểu đồ trang trí. Học sinh không cần KPI.
- **Chatbot trống trơn**: một ô nhập và một khung trắng. Học sinh cần biết mình đang ở đâu trong lộ
  trình, còn bao xa.

## Design Principles

**Nỗ lực là thứ được thưởng.** XP cộng khi em thử lại sau khi sai, không chỉ khi em đúng. Mọi phần
thưởng phải đo cái học sinh kiểm soát được — chứ không đo cái em sinh ra đã có.

**Không bao giờ trừng phạt việc thử.** Không mạng, không tim, không đếm ngược gây hoảng. Sai là dữ
liệu, không phải thất bại.

**Lộ trình phải nhìn thấy được.** Đồ thị tri thức là thứ có thật trong hệ thống; hãy vẽ nó ra. Học
sinh thấy điểm đã thành thạo, điểm đang khoá, và vì sao bị khoá.

**Nói thật trạng thái.** Nội dung đổi sau khi em học thì đánh dấu vàng, không âm thầm xoá dấu "đã
học". Chưa chấm được phát âm thì nói là chưa, đừng vờ.

**Mở ra là học được.** Đường từ lúc mở app tới câu hỏi đầu tiên phải ngắn nhất có thể. Không màn
chào, không hướng dẫn bắt buộc, không popup.

## Accessibility & Inclusion

- WCAG 2.1 AA: chữ thường ≥4.5:1, chữ lớn ≥3:1. Gold `#F9DD0E` **không bao giờ** dùng làm nền cho
  chữ trắng, và không bao giờ làm màu chữ trên nền sáng.
- Không dùng riêng màu để truyền đạt trạng thái. Đúng/sai/khoá luôn có thêm icon hoặc chữ — nhiều
  học sinh nam mù màu đỏ-lục.
- `prefers-reduced-motion`: mọi chuyển động thay bằng crossfade hoặc tức thì.
- Vùng chạm ≥44px. Học sinh dùng điện thoại, ngón cái, trên giường.
- Toàn bộ giao diện tiếng Việt. Chỉ nội dung môn Tiếng Anh là tiếng Anh.
- Micro có thể hỏng hoặc bị chặn: luôn có ô gõ dự phòng, không bao giờ là đường cụt.
