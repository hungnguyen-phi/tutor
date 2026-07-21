-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening (đợt gia cố theo báo cáo audit).
-- Áp SAU: kg-core.sql, kg-core-v22.sql, rls.sql, rbac-rls.sql, coaching.sql
--         (mọi bảng nhạy cảm phải tồn tại trước khi khoá).
-- Idempotent: chạy lại nhiều lần không hỏng (if exists / if not exists / guard DO).
--
-- GIẢ ĐỊNH nền tảng Supabase: role `service_role` (Edge Function) và `postgres`
-- (drizzle push + seed) đều có thuộc tính BYPASSRLS ⇒ các lệnh FORCE RLS / REVOKE
-- dưới đây CHỈ siết `anon` và `authenticated` (client trình duyệt), không đụng tới
-- luồng ghi tin cậy của edge function/seed. Nếu nền tảng đổi thuộc tính role, rà lại.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Bịt lộ đáp án & nội dung KG: web đọc GIÁN TIẾP qua Edge Function ──────────
-- questions/socratic_ladders chứa dap_an, loi_giai, rungs, bottom_out... — không
-- được để client đọc trực tiếp. resources/kg_* là kho nội dung, cũng chỉ phục vụ
-- qua service_role. Bỏ policy đọc cũ (quy ước <table>_read ở rls.sql) + thu hồi
-- SELECT của cả anon lẫn authenticated. GIỮ nguyên profiles/user_roles/coaching_links.
do $$
declare t text;
begin
  foreach t in array array[
    'questions','socratic_ladders','resources',
    'kg_nodes','kg_edges','kg_tiers','kg_versions'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_read', t);
    execute format('revoke select on public.%I from anon, authenticated;', t);
  end loop;
end $$;

-- ── 2) Chống farm mastery: mỗi câu hỏi CHỈ tính LẦN ĐẦU trả lời TRONG PHIÊN ──────
-- Dedup theo (session_id, question_id): trong CÙNG một phiên học, trả lời lại cùng
-- một câu KHÔNG sinh thêm bằng chứng (chống bấm-lại để farm). Nhưng phiên KHÁC (ôn
-- giãn cách ngày sau) VẪN ghi được bằng chứng mới → đúng sư phạm (retention đo được).
-- Schema nền chưa có session_id ⇒ THÊM cột (FK learning_sessions) rồi tạo UNIQUE
-- INDEX làm conflict-target cho ON CONFLICT. Edge fn (chat-turn) ghi
-- 'on conflict (session_id, question_id) do nothing' — CHỈ hàng lần-đầu-trong-phiên
-- tồn tại; is_target_difficulty=true chỉ khi attempt_no=1. NULL (session/question)
-- được coi là KHÁC nhau ⇒ hàng lịch sử cũ (session_id=null) không bị đụng.
alter table public.mastery_evidence
  add column if not exists session_id uuid references public.learning_sessions(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'mastery_evidence_session_question_uq'
  ) then
    -- Dọn trùng lịch sử (chỉ hàng đủ session_id + question_id): giữ hàng SỚM NHẤT.
    delete from public.mastery_evidence me
    using public.mastery_evidence keep
    where me.session_id is not null and me.question_id is not null
      and me.session_id = keep.session_id
      and me.question_id = keep.question_id
      and (keep.created_at < me.created_at
           or (keep.created_at = me.created_at and keep.id < me.id));
    create unique index mastery_evidence_session_question_uq
      on public.mastery_evidence (session_id, question_id);
  end if;
end $$;

-- ── 3) Chống tự sửa HẠNG: học sinh chỉ ghi được 'commitment' (cam kết tuần) ──────
-- Mirror cách khoá profiles ở rls.sql: policy update mở dòng-của-chính-mình
-- (scoreboard_self_write ở coaching.sql) NHƯNG cột ghi được do GRANT quyết định.
-- effort_rank / effort_scope / synced_at... chỉ edge fn (service_role) mới đổi.
revoke update on public.scoreboard_weeks from authenticated;
grant  update (commitment) on public.scoreboard_weeks to authenticated;

-- ── 4) FORCE RLS cho bảng nhạy cảm (chủ bảng cũng phải theo policy) ──────────────
-- Bịt đường lách qua chủ sở hữu bảng. Chỉ force bảng CHẮC CHẮN tồn tại.
do $$
declare t text;
begin
  foreach t in array array[
    'questions','socratic_ladders','profiles','user_roles',
    'student_node_state','mastery_evidence','attempts',
    'learning_sessions','session_turns','scoreboard_weeks'
  ]
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I force row level security;', t);
    end if;
  end loop;
end $$;

-- ── 5) Chặn truy vấn treo: statement_timeout theo role ───────────────────────────
-- authenticated (client) siết chặt; service_role (edge fn — tác vụ nặng hơn) nới hơn.
-- Có hiệu lực ở LẦN KẾT NỐI kế tiếp của role. (Batch nặng như import-kg nên chia nhỏ
-- theo từng statement để không chạm trần 8s.)
alter role authenticated set statement_timeout = '5s';
alter role service_role   set statement_timeout = '8s';
alter role service_role   set idle_in_transaction_session_timeout = '10s';

-- ── 6) Nền tảng rate-limit (Edge Function gọi qua RPC public.rl_hit) ─────────────
create table if not exists public.rate_limit_hits (
  key text not null,
  ts  timestamptz not null default now()
);
create index if not exists rate_limit_hits_key_ts_idx on public.rate_limit_hits (key, ts);
-- Bảng đếm không cho client chạm; RLS bật (deny mặc định) + thu hồi mọi quyền.
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- Cửa sổ TRƯỢT, nguyên tử: xoá hit ngoài cửa sổ → đếm trong cửa sổ → còn hạn mức thì
-- ghi 1 hit và trả TRUE (cho phép); hết hạn mức trả FALSE. security definer để chạy
-- bỏ qua RLS của bảng đếm (owner = postgres). search_path cố định chống chiếm quyền.
create or replace function public.rl_hit(p_key text, p_max int, p_window_sec int)
  returns boolean language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  delete from public.rate_limit_hits
   where key = p_key and ts < now() - make_interval(secs => p_window_sec);
  select count(*) into n from public.rate_limit_hits where key = p_key;
  if n < p_max then
    insert into public.rate_limit_hits(key) values (p_key);
    return true;
  end if;
  return false;
end $$;

-- Chỉ service_role (edge fn) được gọi; anon/authenticated không.
revoke all     on function public.rl_hit(text, int, int) from public;
revoke execute on function public.rl_hit(text, int, int) from anon, authenticated;
grant  execute on function public.rl_hit(text, int, int) to service_role;

-- ── 7) Chống xoá phá (best-effort) ──────────────────────────────────────────────
-- Các FK ON DELETE CASCADE tới tenants/profiles là CÓ CHỦ ĐÍCH (offboard tenant /
-- xoá người dùng theo PDPL). Client 'authenticated' KHÔNG có policy DELETE trên các
-- bảng học tập ⇒ RLS đã chặn xoá; chỉ service_role xoá được. Vì vậy KHÔNG đổi
-- cascade→restrict tại đây (sẽ chặn cả offboard hợp lệ, và ALTER cột FK phức tạp).
-- TODO(bảo mật): nếu sau này mở luồng xoá cho client, cân nhắc ON DELETE RESTRICT
--   cho FK từ learning_sessions/attempts/mastery_evidence + kiểm tra ở tầng app.
-- Cột soft-delete: giàn giáo cho tương lai. CHƯA có truy vấn/RLS nào lọc theo cột này
-- ⇒ thêm vào KHÔNG đổi hành vi hiện tại (chỉ mở đường xoá-mềm sau này).
alter table public.learning_sessions add column if not exists deleted_at timestamptz;
alter table public.mastery_evidence  add column if not exists deleted_at timestamptz;

-- ── 8) Materialized view giảm tải tổng hợp mastery (best-effort) ─────────────────
-- Đếm số node đã mastered mỗi (tenant, student, kg_version). MV KHÔNG áp RLS ⇒ chỉ
-- service_role (edge fn) được đọc; thu hồi của anon/authenticated để không lộ chéo.
do $$
begin
  if not exists (
    select 1 from pg_matviews where schemaname = 'public' and matviewname = 'mv_student_mastery'
  ) then
    create materialized view public.mv_student_mastery as
      select tenant_id, student_id, kg_version_id,
             count(*)                         as nodes_seen,
             count(*) filter (where mastered) as nodes_mastered
        from public.student_node_state
       group by tenant_id, student_id, kg_version_id;
    -- Unique index ⇒ cho phép REFRESH ... CONCURRENTLY (không khoá bảng khi làm mới).
    create unique index mv_student_mastery_uq
      on public.mv_student_mastery (tenant_id, student_id, kg_version_id);
  end if;
end $$;
revoke all on public.mv_student_mastery from anon, authenticated;
-- Làm mới định kỳ (an toàn nhờ unique index):
--   refresh materialized view concurrently public.mv_student_mastery;
-- Lập lịch bằng pg_cron nếu bật extension, ví dụ mỗi 10 phút:
--   select cron.schedule('refresh_mv_student_mastery', '*/10 * * * *',
--     $$refresh materialized view concurrently public.mv_student_mastery$$);
