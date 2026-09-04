-- Kho báu: tài nguyên hiện có ĐẠI DIỆN CHO CẢ NODE, chưa chia mức (chủ dự án chốt 04/09).
--
-- Vì sao: mỗi node mới có ĐÚNG MỘT bộ NotebookLM (7 định dạng, sinh cho một DOK).
-- Chia 2 mức trước/sau (2026-09-04-resource-tiers.sql, sáng nay) hoá ra làm em
-- phải bấm "XEM XONG MỨC 1" mới thấy quiz/flashcard — trong khi cả bộ là một
-- thể thống nhất. Chủ dự án: "đưa những tài nguyên đó ra đại diện cho node
-- trước, sau này sinh tài nguyên xong thì đưa vào sau".
--
-- Cách làm ĐẢO ĐƯỢC, không đụng code: gộp hết về tier 1. Cơ chế mức/DOK trong
-- resources/index.ts + KhoBauView vẫn nguyên; khi sinh thêm tài nguyên theo DOK
-- thì đặt tier khác là nó sống lại. Client (KhoBauView) tự ẩn pip/nút "XEM
-- XONG MỨC"/dòng nhắc khi node chỉ có 1 mức (sửa cùng ngày).
-- Idempotent — chạy lại an toàn. Chỉ Toán 10 (kg_version đang publish).

update resources
   set tier = 1
 where kg_version_id = '0e677ecb-f803-45e7-94a0-4451f47951dc'
   and tier <> 1;

-- Kiểm: mọi node còn đúng 1 mức.
select count(*) as tong_node,
       count(*) filter (where n_muc = 1) as node_1_muc
  from (select node_key, count(distinct tier) as n_muc
          from resources
         where kg_version_id = '0e677ecb-f803-45e7-94a0-4451f47951dc' and hien_thi = true
         group by node_key) t;
