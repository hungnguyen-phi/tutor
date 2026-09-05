-- GÓP Ý TRONG APP (05/09): học sinh bấm "Góp ý" ngay chỗ đang học; app tự ghi
-- bài / câu / lời sư tử, em chỉ gõ cảm nhận. Thay cho phiếu Excel/Word (đã thử
-- 4 kiểu, chủ dự án: "nhìn không hiểu, khó dùng").
--   node packages/db/run-sql.mjs packages/db/2026-09-05-gop-y.sql
-- Idempotent.

create table if not exists public.student_feedback (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid,
  student_id   uuid not null references auth.users(id) on delete cascade,
  page         text,            -- learn / lesson / review / scoreboard / quests / profile / settings
  subject      text,            -- math / english …
  node_key     text,            -- bài đang học (nếu có)
  question_id  text,            -- câu đang làm (nếu có)
  tutor_text   text,            -- câu sư tử vừa nói mà em góp ý (nếu bấm từ bong bóng)
  tag          text,            -- kho_hieu / khong_thich / sai / cham / hay / khac
  student_text text not null,   -- lời em viết
  device       text,            -- userAgent rút gọn
  created_at   timestamptz not null default now()
);
create index if not exists student_feedback_created_idx on public.student_feedback (created_at desc);
create index if not exists student_feedback_student_idx on public.student_feedback (student_id);

alter table public.student_feedback enable row level security;

drop policy if exists sf_insert_own on public.student_feedback;
create policy sf_insert_own on public.student_feedback
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists sf_select on public.student_feedback;
create policy sf_select on public.student_feedback
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('teacher', 'admin')
    )
  );

-- Kiểm
select count(*) as so_gop_y from public.student_feedback;
