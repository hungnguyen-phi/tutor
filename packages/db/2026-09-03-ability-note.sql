-- Tín hiệu năng lực đọc qua CHAT (chốt 03/09, chủ dự án). Song song với
-- profiles.tutor_style_note (GIỌNG ĐIỆU) nhưng KHÁC mục đích: ghi chú NGẮN do
-- AI đúc kết ở cuối buổi về CÁCH em hiểu/diễn đạt qua lời nói (không phải điểm
-- đúng/sai — cái đó vẫn tất định qua mastery_evidence). CHỈ dùng làm NGỮ CẢNH
-- cho lời dẫn dắt (buildGuideUser), KHÔNG bao giờ dùng để tính mastery/XP/DOK.
-- Idempotent — chạy lại an toàn.
alter table profiles add column if not exists tutor_ability_note text;
