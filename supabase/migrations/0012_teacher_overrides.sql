-- ─────────────────────────────────────────────────────────────────────────────
-- 0012 — teacher_overrides: GV điều chỉnh nội dung Tutor + lý do (H5).
-- Human-in-the-loop: GV có thể ẨN một câu kém (không phục vụ HS nữa) hoặc SỬA
-- nhẹ nội dung/lời giải, kèm LÝ DO (bắt buộc — có kiểm toán). Nội dung GỐC do
-- Studio giữ; đây là lớp phủ TENANT-CỤC-BỘ áp lúc phục vụ (diagnose/chat-turn),
-- KHÔNG đụng bản gốc. Gỡ override (active=false) → câu trở lại như cũ.
--
-- Áp SAU: 0001 (tenants/profiles), 0002 (questions), 0004 (current_tenant_id).
-- Idempotent: create if not exists / drop-create policy / guard DO.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.teacher_overrides (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  content_type text not null default 'question',       -- 'question' (mở rộng sau: 'node'…)
  content_id   uuid not null,                            -- questions.id
  action       text not null,                            -- 'hide' | 'edit'
  patch        jsonb not null default '{}'::jsonb,       -- {noi_dung?, loi_giai?} khi action='edit'
  reason       text not null,                            -- lý do — bắt buộc (human-in-the-loop)
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  active       boolean not null default true,
  constraint teacher_overrides_action_chk check (action in ('hide', 'edit'))
);

-- Mỗi câu tối đa MỘT override đang hiệu lực trong một tenant (áp là rõ ràng).
create unique index if not exists teacher_overrides_active_uq
  on public.teacher_overrides (tenant_id, content_id) where active;
create index if not exists teacher_overrides_tenant_idx
  on public.teacher_overrides (tenant_id) where active;

alter table public.teacher_overrides enable row level security;

-- Đọc: nhân sự trong tenant (áp lúc phục vụ + hiện ở /teacher; không lộ chéo
-- tenant). GHI: chỉ qua Edge Function (service_role bỏ qua RLS) sau khi kiểm vai
-- giáo viên/admin — client không ghi thẳng.
drop policy if exists teacher_overrides_read on public.teacher_overrides;
create policy teacher_overrides_read on public.teacher_overrides for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- FORCE RLS (đồng bộ chuẩn security-hardening: chủ bảng cũng theo policy).
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'teacher_overrides') then
    execute 'alter table public.teacher_overrides force row level security;';
  end if;
end $$;
