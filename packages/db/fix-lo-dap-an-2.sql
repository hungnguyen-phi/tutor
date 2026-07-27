-- Lộ đáp án kiểu ĐẾM: phương án đúng liệt kê luôn CHỌN NHỮNG CÂU NÀO,
-- ba nhiễu chỉ là con số trơ → nhặt được đáp án mà khỏi xét từng câu.
-- Phần liệt kê vốn đã có đủ trong loi_giai (hiện SAU khi trả lời).

-- Q-0000004: «3 câu — gồm (2), (4), (5)»  →  «3 câu»
update questions set dap_an = '3 câu' where question_key = 'Q-0000004' and dap_an = '3 câu — gồm (2), (4), (5)';
-- Q-0000154: «3 câu — gồm (1), (3), (5)»  →  «3 câu»
update questions set dap_an = '3 câu' where question_key = 'Q-0000154' and dap_an = '3 câu — gồm (1), (3), (5)';

select question_key, dap_an from questions where question_key in ('Q-0000004','Q-0000154') order by question_key;
