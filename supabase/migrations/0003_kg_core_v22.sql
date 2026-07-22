-- ─────────────────────────────────────────────────────────────────────────────
-- KG Schema v2.2 — 16 dạng câu hỏi + telemetry nuôi Elo
-- Áp SAU kg-core.sql:  pnpm --filter @tutor/db apply -- kg-core-v22.sql
--
-- Nguồn: "DANH MỤC DẠNG CÂU HỎI v2.2 — ĐẶC TẢ CHO TRẠM 3 & ĐỘI UI" (08/07/2026)
-- Idempotent: chạy lại nhiều lần không hỏng.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── questions: dạng câu hỏi, nhóm chấm, payload đặc thù ──────────────────────
alter table questions add column if not exists dang_cau_hoi text;
alter table questions add column if not exists nhom_cham    text;
alter table questions add column if not exists ui_can_thiet text default 'none';
alter table questions add column if not exists tinh_mastery boolean default true;
alter table questions add column if not exists hoi_do_tu_tin boolean default false;

-- do_kho ban đầu là ước lượng của người soạn; Elo/p_value ghi đè sau khi có dữ liệu thật.
alter table questions add column if not exists do_kho_uoc_luong boolean default true;
alter table questions add column if not exists elo real;

-- nhieu_buoc: [{bac, noi_dung, dap_an, quan_niem_sai}] — chấm từng bước để biết hỏng Ở BƯỚC NÀO
alter table questions add column if not exists buoc jsonb;
-- tim_loi: [{vi_tri, mo_ta_loi, sua_dung, quan_niem_sai}] — erroneous examples
alter table questions add column if not exists loi_cai_san jsonb;
-- nghe: đường dẫn audio trong Storage
alter table questions add column if not exists audio_uri text;

-- Backfill hàng cũ (seed.ts sinh ra khi chưa có v2.2): objective→mcq, rubric→viet_doan.
update questions
   set dang_cau_hoi = case when loai_danh_gia = 'objective' then 'mcq' else 'viet_doan' end
 where dang_cau_hoi is null;

update questions
   set nhom_cham = case when loai_danh_gia = 'objective' then 'auto' else 'rubric_agent' end
 where nhom_cham is null;

alter table questions alter column dang_cau_hoi set not null;
alter table questions alter column nhom_cham    set not null;

do $$ begin
  alter table questions add constraint questions_form_chk check (dang_cau_hoi in (
    'mcq','dung_sai','dien_dap_an','dien_khuyet','sap_xep','noi_cot','nhieu_buoc',
    'tu_luan_ngan','tim_loi','viet_doan','giai_thich_cho_ban','du_doan_giai_thich',
    'phan_bien','van_dung_thuc_te','phan_tu','noi','nghe'
  ));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table questions add constraint questions_grading_chk
    check (nhom_cham in ('auto','rubric_agent','speaking_agent'));
exception when duplicate_object then null; end $$;

-- Bất biến: nhóm 'auto' KHÔNG BAO GIỜ gọi LLM ⇒ phải là objective và phải có đáp án.
do $$ begin
  alter table questions add constraint questions_auto_objective_chk
    check (nhom_cham <> 'auto' or (loai_danh_gia = 'objective' and dap_an is not null));
exception when duplicate_object then null; end $$;

-- nhieu_buoc phải có 3–5 bước; tim_loi phải có lỗi cài sẵn; nghe phải có audio.
do $$ begin
  alter table questions add constraint questions_nhieu_buoc_chk
    check (dang_cau_hoi <> 'nhieu_buoc'
           or (buoc is not null and jsonb_array_length(buoc) between 3 and 5));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table questions add constraint questions_tim_loi_chk
    check (dang_cau_hoi <> 'tim_loi'
           or (loi_cai_san is not null and jsonb_array_length(loi_cai_san) > 0));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table questions add constraint questions_nghe_chk
    check (dang_cau_hoi <> 'nghe' or audio_uri is not null);
exception when duplicate_object then null; end $$;

-- phan_tu là phản tư siêu nhận thức — ghi log cho GVCN, không đóng góp mastery.
do $$ begin
  alter table questions add constraint questions_phan_tu_chk
    check (dang_cau_hoi <> 'phan_tu' or tinh_mastery = false);
exception when duplicate_object then null; end $$;

create index if not exists questions_form_idx on questions (kg_version_id, node_key, dang_cau_hoi);

-- ── attempts: telemetry nuôi Elo & phát hiện "đúng nhờ đoán" ─────────────────
alter table attempts add column if not exists do_tu_tin           int;
alter table attempts add column if not exists thoi_gian_tra_loi_ms int;
alter table attempts add column if not exists so_hint             int default 0;
-- nhieu_buoc: bước đầu tiên học sinh làm sai (null = không hỏng bước nào)
alter table attempts add column if not exists buoc_hong           int;

do $$ begin
  alter table attempts add constraint attempts_confidence_chk
    check (do_tu_tin is null or do_tu_tin between 1 and 3);
exception when duplicate_object then null; end $$;

-- ── resources: mở rộng format cho học liệu xuất từ Studio (Trạm 5) ───────────
-- Cột `format` vốn là text tự do, không phải enum ⇒ chỉ cần ràng buộc, không cần migrate.
do $$ begin
  alter table resources add constraint resources_format_chk check (format in (
    'text','infographic','video','animation','mindmap','podcast','worked_example',
    'interactive','slide','worksheet','flashcard','quiz'
  ));
exception when duplicate_object then null; end $$;

-- ── kg_nodes: revision cho cơ chế đánh dấu xanh/vàng ─────────────────────────
-- Nội dung đổi dưới chân học sinh thì đánh dấu vàng, không xoá dấu "đã học".
-- Tăng có chủ đích khi sửa NGHĨA; sửa chính tả giữ nguyên revision.
alter table kg_nodes add column if not exists revision int not null default 1;

alter table student_node_state add column if not exists node_revision int;
alter table mastery_evidence  add column if not exists node_revision int;

-- ── resources: khoá tự nhiên cho importer (idempotency + truy vết review) ─────
-- resource_key = resource.id trong gói KG ⇒ chạy lại cùng file thì upsert thay vì
-- nhân bản, và review_queue.content_id truy ngược được đúng hàng resources.
-- Index PHẢI toàn phần (KHÔNG partial): edge fn import-kg upsert qua PostgREST
-- (supabase-js .upsert) sinh ON CONFLICT (cols) không kèm predicate ⇒ không khớp
-- index một phần → 500 "no unique or exclusion constraint matching". Unique
-- toàn phần vẫn cho nhiều hàng cũ resource_key=null sống chung (NULLS DISTINCT).
alter table resources add column if not exists resource_key text;
do $$
begin
  -- nâng cấp từ bản partial cũ (v2.2 đời đầu): xoá để build lại toàn phần
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'resources_key_uq'
      and indexdef like '%WHERE%'
  ) then
    drop index public.resources_key_uq;
  end if;
end $$;
create unique index if not exists resources_key_uq
  on resources (kg_version_id, resource_key);
