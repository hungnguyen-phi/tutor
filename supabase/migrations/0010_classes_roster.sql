-- ─────────────────────────────────────────────────────────────────────────────
-- 0010 — Lớp học (classes) + gắn học sinh vào lớp.
-- Nền cho: bảng tuần theo LỚP thật (Pha 2) và roster/admin (Pha 3).
--
-- Vì sao cần: schema nền chỉ có profiles.grade (khối, text) — KHÔNG có khái niệm
-- LỚP. Bảng tuần "scope=lop" và roster GVCN đều cần một thực thể lớp thật:
-- một lớp thuộc một khối, có GVCN, thuộc một năm học. Học sinh gắn vào đúng một
-- lớp. teacher_assignments.class_id (text) trước đây là chuỗi tự do — nay có
-- thực thể chuẩn để tham chiếu.
--
-- Áp SAU: 0001 (profiles/tenants), 0004 (helper current_tenant_id/is_staff).
-- Idempotent: create if not exists / add column if not exists / guard DO.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Lớp học ─────────────────────────────────────────────────────────────────
create table if not exists public.classes (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  grade               text not null,                 -- khối, vd '10'
  name                text not null,                 -- tên lớp, vd '10A1'
  homeroom_teacher_id uuid references public.profiles(id) on delete set null,  -- GVCN
  school_year         text,                          -- vd '2026-2027'
  created_at          timestamptz not null default now(),
  -- Một tên lớp là duy nhất trong (trường, năm học). NULLS NOT DISTINCT để
  -- năm-học rỗng vẫn chặn trùng tên trong cùng tenant.
  constraint classes_name_year_uq unique nulls not distinct (tenant_id, name, school_year)
);
create index if not exists classes_tenant_grade_idx on public.classes (tenant_id, grade);
create index if not exists classes_homeroom_idx     on public.classes (homeroom_teacher_id);

-- ── Học sinh (và GV) gắn vào một lớp ────────────────────────────────────────
-- class_id ở profiles: học sinh thuộc lớp nào (khối vẫn giữ ở profiles.grade để
-- tương thích ngược + truy vấn nhanh). on delete set null: xoá lớp không xoá HS.
alter table public.profiles
  add column if not exists class_id uuid references public.classes(id) on delete set null;
create index if not exists profiles_class_idx on public.profiles (class_id);

-- ── RLS: thành viên tenant đọc được lớp; GHI chỉ qua service_role (edge/admin) ─
-- Đọc lớp cần cho: bảng tuần theo lớp, roster, chọn lớp khi nhập liệu. Không lộ
-- chéo tenant. Ghi (tạo/sửa lớp, gán HS) đi qua Edge Function admin bằng
-- service_role — client 'authenticated' không có policy INSERT/UPDATE/DELETE nên
-- RLS mặc-định-từ-chối đã chặn.
alter table public.classes enable row level security;
drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- ── FORCE RLS (đồng bộ chuẩn security-hardening: chủ bảng cũng theo policy) ───
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'classes') then
    execute 'alter table public.classes force row level security;';
  end if;
end $$;
