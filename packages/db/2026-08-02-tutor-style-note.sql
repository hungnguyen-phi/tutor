-- Cá nhân hoá giọng điệu AI theo học sinh (chốt 02/08, chủ dự án).
-- Một ghi chú NGẮN (1-2 câu, KHÔNG phải log/lịch sử) do AI tự đúc kết mỗi khi
-- kết thúc phiên học — vd "bạn này cần giọng nghiêm túc, ít đùa" / "thích được
-- khích lệ vui vẻ, hay nản nếu bị chỉnh gắt". Đọc lại ở các lượt AI dẫn dắt sau
-- (chat-turn: require_thinking, advance_rung, message) để dẫn dắt đúng chất
-- với TỪNG em, không phải một giọng chung cho tất cả.
-- Idempotent: chạy lại nhiều lần không hỏng.
alter table profiles add column if not exists tutor_style_note text;
