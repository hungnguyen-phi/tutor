-- ═══════════════════════════════════════════════════════════════════════════
-- NẠP HỌC LIỆU VÀO BÀI  (mẫu để sửa rồi chạy)
--
--     node packages/db/run-sql.mjs packages/db/hoc-lieu-mau.sql --dry   ← xem trước
--     node packages/db/run-sql.mjs packages/db/hoc-lieu-mau.sql
--
-- HỌC LIỆU GẮN VÀO ĐÂU: khoá là cặp (kg_version_id, node_key). Học liệu của bài
-- A chỉ hiện ở bài A, không rơi nhầm bài nào khác. Sai node_key thì KHÔNG hiện ở
-- đâu cả (im lặng) — nên phần dưới tra node_key theo TÊN BÀI cho khỏi gõ nhầm.
-- kg_version_id lấy ĐỘNG (version Toán 10 đang published), không hardcode: mỗi
-- lần re-key là id đổi, hardcode xong là học liệu biến mất không dấu vết.
--
-- ĐẶT TỆP Ở ĐÂU — hai đường, cột `uri` quyết định:
--   1) LINK NGOÀI: uri bắt đầu bằng http:// hoặc https:// → giữ nguyên, dùng thẳng.
--      YouTube/Drive/Google Slides dán link thường cũng được: app tự đổi sang
--      dạng nhúng (watch → embed, /view → /preview).
--   2) TỆP CỦA TRƯỜNG: tải lên bucket PRIVATE `learning-assets` (Dashboard →
--      Storage), rồi ghi uri = ĐƯỜNG DẪN TRONG BUCKET, ví dụ:
--          hoc-lieu/KC-3566611/podcast-menh-de.mp3
--      Edge function `resources` tự ký link 1 giờ sau khi kiểm quyền học sinh.
--      KHÔNG ghi link https của Dashboard vào đây — link đó hết hạn/không có quyền.
--
-- ĐUÔI TỆP QUYẾT ĐỊNH CÁCH XEM (app suy từ đuôi, KHÔNG suy từ cột format):
--     .mp3 .wav .m4a .ogg .aac      → trình phát nhạc, bấm play nghe tại chỗ
--     .mp4 .webm .mov .m4v          → trình phát phim tại chỗ
--     .png .jpg .webp .svg .gif     → hiện ảnh, bấm vào phóng to ở tab mới
--     .pdf                          → xem tại chỗ + nút TẢI VỀ
--     .html .htm                    → khung nhúng cách ly — QUIZ / FLASHCARD /
--                                     sơ đồ tương tác của Xưởng chạy ở đây
--     link ngoài (YouTube, Drive,   → khung nhúng, app tự đổi sang dạng nhúng
--     Google Slides/Docs, Vimeo)
--     .docx .pptx .xlsx .zip .txt   → thẻ TẢI VỀ (trình duyệt không mở tại chỗ)
--
-- BA CHỖ HAY VẤP:
--  · PODCAST phải là tệp .mp3/.m4a mới nghe tại chỗ. Dán link Spotify → Spotify
--    chặn nhúng → khung trắng.
--  · SLIDE PowerPoint (.pptx) trình duyệt KHÔNG mở được → app bày thẻ tải về.
--    Muốn học sinh xem ngay tại chỗ thì chọn một trong hai:
--      (a) xuất PDF rồi nạp bản .pdf — gọn nhất, xem được cả trên điện thoại;
--      (b) đưa lên Google Slides, chia sẻ "ai có link cũng xem được", dán link
--          .../edit — app tự đổi sang /preview và nhúng thẳng.
--    (Không dùng trình xem Office online: phải gửi link tệp của trường sang máy
--     chủ Microsoft, đó là việc trường phải quyết chứ không nên mặc định.)
--  · QUIZ/FLASHCARD dạng .html tải lên bucket: nhớ kiểm content-type là text/html.
--    Bị đặt thành application/octet-stream thì trình duyệt tải về thay vì hiện.
--
-- CỘT `format` để làm gì: chọn ICON và TÊN GỌI trẻ con thấy ("Nghe kể", "Sơ đồ
-- tư duy", "Phiếu bài tập"…). Nhận đúng 12 giá trị:
--     text · infographic · video · animation · mindmap · podcast ·
--     worked_example · interactive · slide · worksheet · flashcard · quiz
-- `tier` = thứ tự hiện (1 trước, 2, 3 sau). `ly_do_chon_format` = một dòng gợi ý
-- hiện dưới khung xem ("Nghe trên đường đi học cho nhớ").
-- ═══════════════════════════════════════════════════════════════════════════

with v as (
  select id, tenant_id
    from kg_versions
   where subject = 'Toan' and status = 'published'
   order by created_at desc
   limit 1
),
-- SỬA TỪ ĐÂY ─────────────────────────────────────────────────────────────────
-- Mỗi dòng một học liệu. Cột 1 là TÊN BÀI (khớp gần đúng, không phân biệt hoa
-- thường) — an toàn hơn gõ node_key. Chạy thử với --dry trước để soi.
lieu(ten_bai, format, tier, uri, ghi_chu) as (
  values
    ('Khái niệm mệnh đề logic', 'podcast',   1, 'hoc-lieu/menh-de/nghe-ke-menh-de.mp3',  'Nghe 3 phút trước khi làm bài.'),
    ('Khái niệm mệnh đề logic', 'slide',     1, 'hoc-lieu/menh-de/bai-giang.pdf',        'Slide cô dạy trên lớp.'),
    ('Khái niệm mệnh đề logic', 'mindmap',   2, 'hoc-lieu/menh-de/so-do-tu-duy.png',     'Nhìn một lượt là nhớ cả bài.'),
    ('Khái niệm mệnh đề logic', 'quiz',      2, 'hoc-lieu/menh-de/quiz-nhanh.html',      'Tự kiểm tra 5 câu, không tính điểm.'),
    ('Khái niệm mệnh đề logic', 'worksheet', 3, 'hoc-lieu/menh-de/phieu-bai-tap.docx',   'In ra làm thêm ở nhà.'),
    ('Khái niệm mệnh đề logic', 'video',     3, 'https://www.youtube.com/watch?v=XXXXXXXXXXX', 'Cô giảng lại phần khó.')
),
-- HẾT PHẦN SỬA ───────────────────────────────────────────────────────────────
khop as (
  select l.*, n.node_key, n.label
    from lieu l
    join kg_nodes n
      on n.kg_version_id = (select id from v)
     and n.status = 'active'
     and lower(n.label) like '%' || lower(l.ten_bai) || '%'
)
insert into resources (tenant_id, kg_version_id, node_key, tier, format, uri, ly_do_chon_format, status, lang)
select (select tenant_id from v), (select id from v), k.node_key, k.tier, k.format, k.uri, k.ghi_chu, 'active', 'vi'
  from khop k
 where not exists (
   select 1 from resources r
    where r.kg_version_id = (select id from v)
      and r.node_key = k.node_key
      and r.uri = k.uri
 );

-- ── KIỂM SAU KHI CHẠY ──────────────────────────────────────────────────────
-- Mỗi dòng phải có node_key khớp ĐÚNG bài mong muốn. Cột `hien_the_nao` cho biết
-- học sinh sẽ thấy dạng gì — sai đuôi tệp là lộ ra ở đây trước khi các em gặp.
select r.node_key,
       (select label from kg_nodes n
         where n.node_key = r.node_key
           and n.kg_version_id = r.kg_version_id)                as ten_bai,
       r.format, r.tier, r.uri,
       case
         when r.uri ~* '\.(mp3|wav|m4a|ogg|aac)$'                then 'trình phát nhạc'
         when r.uri ~* '\.(mp4|webm|mov|m4v)$'                   then 'trình phát phim'
         when r.uri ~* '\.(png|jpe?g|webp|gif|svg|avif)$'        then 'ảnh'
         when r.uri ~* '\.pdf$'                                  then 'xem tại chỗ + tải về'
         when r.uri ~* '\.html?$'                                then 'khung nhúng (quiz/flashcard)'
         when r.uri ~* '\.pptx?$'                                then 'THẺ TẢI VỀ — muốn xem tại chỗ thì xuất PDF'
         when r.uri ~* '\.(docx?|xlsx?|csv|zip|rar|txt)$'        then 'thẻ tải về'
         when r.uri ~* 'youtube\.com|youtu\.be|vimeo\.com'       then 'khung nhúng video'
         when r.uri ~* 'drive\.google\.com|docs\.google\.com'    then 'khung nhúng Google'
         else 'khung nhúng'
       end                                                       as hien_the_nao,
       case when r.uri ~* '^https?://' then 'link ngoài'
            else 'tệp trong bucket — phải upload đúng đường dẫn này' end as nguon
  from resources r
 where r.kg_version_id = (select id from kg_versions
                           where subject = 'Toan' and status = 'published'
                           order by created_at desc limit 1)
 order by r.node_key, r.tier;

-- GỠ HẾT HỌC LIỆU VỪA NẠP (bỏ dấu -- nếu muốn làm lại từ đầu):
--   delete from resources
--    where kg_version_id = (select id from kg_versions
--                            where subject = 'Toan' and status = 'published'
--                            order by created_at desc limit 1);
