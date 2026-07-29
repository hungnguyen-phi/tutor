-- BỎ NGOẶC KÉP KIỂU PHÁP « » KHỎI NỘI DUNG HỌC SINH ĐỌC
--
-- Vì sao (chủ dự án yêu cầu 29/07): trên màn hình « » đọc ra thành "<<" và ">>",
-- trông như lỗi hiển thị. Đã dọn hết trong mã và chặn ở đường ra của AI
-- (_shared/llm.ts → rehydrate); còn lại là phần nằm trong DỮ LIỆU.
--
-- Quét MỌI CỘT của 8 bảng nội dung (to_jsonb(t.*)), thấy đúng hai chỗ:
--   questions          1 dòng — trong `distractors` (jsonb)
--   session_turns      7 dòng — trong `content` (text)
--   kg_nodes · socratic_ladders · resources · kc_registry · kg_versions
--   · submissions      0
--
-- ⚠️ BẪY ĐÃ TRẢ GIÁ MỘT LẦN (bản đầu của file này hỏng vì nó):
-- `"` là KÝ TỰ CÚ PHÁP của JSON. Đổi thẳng trên chuỗi `distractors::text` là vỡ
-- JSON ngay ("«Không đều...»" thành ""Không đều..."" — Postgres báo
-- 22P02 invalid input syntax for type json). Phải đụng vào GIÁ TRỊ: bóc từng
-- chuỗi ra dạng text, thay, rồi để `to_jsonb` tự lo phần thoát ký tự.
--
-- Chạy: node packages/db/run-sql.mjs packages/db/2026-07-29-bo-ngoac-kep-phap.sql
-- (thêm --dry để xem trước). Chạy lại nhiều lần vô hại.

-- ── 1) distractors (jsonb: mảng các object) ────────────────────────────────
-- Dựng lại mảng, thay trong TỪNG giá trị kiểu chuỗi. Khoá và các giá trị không
-- phải chuỗi giữ nguyên. jsonb vốn không giữ thứ tự khoá nên không mất gì.
update questions q
set distractors = (
  select jsonb_agg(
    (
      select coalesce(
        jsonb_object_agg(
          k,
          case when jsonb_typeof(v) = 'string'
            then to_jsonb(replace(replace(v #>> '{}', '«', '"'), '»', '"'))
            else v
          end
        ),
        '{}'::jsonb
      )
      from jsonb_each(elem) as e(k, v)
    )
    order by ord
  )
  from jsonb_array_elements(q.distractors) with ordinality as t(elem, ord)
)
where jsonb_typeof(distractors) = 'array'
  and (distractors::text like '%«%' or distractors::text like '%»%');

-- ── 2) Các cột CHỮ THUẦN — thay thẳng, không có cú pháp nào để vỡ ──────────
-- Hiện `questions` chỉ dính ở distractors và `kg_nodes` sạch, nhưng nội dung
-- còn được nạp thêm từ Xưởng nên để sẵn: chạy lại lúc nào cũng an toàn.
update questions set noi_dung = replace(replace(noi_dung, '«', '"'), '»', '"')
  where noi_dung like '%«%' or noi_dung like '%»%';
update questions set dap_an = replace(replace(dap_an, '«', '"'), '»', '"')
  where dap_an like '%«%' or dap_an like '%»%';
update questions set loi_giai = replace(replace(loi_giai, '«', '"'), '»', '"')
  where loi_giai like '%«%' or loi_giai like '%»%';
update kg_nodes set label = replace(replace(label, '«', '"'), '»', '"')
  where label like '%«%' or label like '%»%';

-- ── 3) Lời sư tử đã nói trong quá khứ ──────────────────────────────────────
-- KHÔNG chỉ là dọn cho đẹp: từ 29/07 các lượt cũ được nạp lại vào prompt làm
-- <lich_su>, nên mô hình ĐỌC THẤY lối viết « » và có thể bắt chước. Chặn ở
-- rehydrate là lưới cuối; dọn nguồn mới là gốc.
update session_turns set content = replace(replace(content, '«', '"'), '»', '"')
  where content like '%«%' or content like '%»%';

-- ── Kiểm sau khi chạy: MỌI dòng phải ra 0 ──────────────────────────────────
select 'questions' as bang, count(*) as con_dinh from questions t
  where to_jsonb(t.*)::text like '%«%' or to_jsonb(t.*)::text like '%»%'
union all select 'session_turns', count(*) from session_turns t
  where to_jsonb(t.*)::text like '%«%' or to_jsonb(t.*)::text like '%»%'
union all select 'kg_nodes', count(*) from kg_nodes t
  where to_jsonb(t.*)::text like '%«%' or to_jsonb(t.*)::text like '%»%'
union all select 'socratic_ladders', count(*) from socratic_ladders t
  where to_jsonb(t.*)::text like '%«%' or to_jsonb(t.*)::text like '%»%'
union all select 'resources', count(*) from resources t
  where to_jsonb(t.*)::text like '%«%' or to_jsonb(t.*)::text like '%»%'
order by con_dinh desc, bang;
