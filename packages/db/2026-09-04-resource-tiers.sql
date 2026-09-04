-- Chia lại MỨC Kho báu cho học liệu NotebookLM (chốt 04/09, chủ dự án).
--
-- Vì sao: đợt nạp 01/09 gán CẢ 7 định dạng của một node vào CÙNG MỘT mức (ngẫu
-- nhiên 1/2/3 theo node) → học sinh mở Kho báu ở mức 1 thì ~2/3 node trống
-- ("Mức này chưa có học liệu nào") trong khi học liệu nằm ở mức đang khoá.
-- Audit 04/09 ghi đây là "đường cụt" nặng nhất của màn Học.
--
-- Chốt: 2 mức, đúng ý "hai loại tài nguyên" chủ dự án nêu 03/09:
--   Mức 1 — XEM/NGHE/ĐỌC TRƯỚC KHI LÀM: video, podcast, infographic, slide, text,
--            worksheet, worked_example, animation.
--   Mức 2 — ÔN SAU KHI LÀM: quiz, flashcard, mindmap, interactive.
-- Mức 3 không dùng nữa (mucCoSan tự còn [1,2] → Kho báu vẽ đúng 2 bậc).
-- Idempotent — chạy lại an toàn. Chỉ đụng Toán 10 (kg_version đang publish).

update resources
   set tier = case
                when format in ('quiz', 'flashcard', 'mindmap', 'interactive') then 2
                else 1
              end
 where kg_version_id = '0e677ecb-f803-45e7-94a0-4451f47951dc';

-- Kiểm sau khi chạy: mỗi node phải có ĐÚNG 2 mức, mức 1 không rỗng.
select count(*) as tong_node,
       count(*) filter (where n_muc = 2)        as node_co_2_muc,
       count(*) filter (where co_muc_1 = false) as node_thieu_muc_1
  from (
    select node_key,
           count(distinct tier)         as n_muc,
           bool_or(tier = 1)            as co_muc_1
      from resources
     where kg_version_id = '0e677ecb-f803-45e7-94a0-4451f47951dc'
       and hien_thi = true
     group by node_key
  ) t;
