-- 4DX coaching layer (coaching_links, wigs, lead_measures, scoreboard_weeks).
-- Additive + idempotent. Applied after the Drizzle tables + RLS helpers exist
-- (depends on public.current_tenant_id() / is_staff() from rls.sql).
-- Run: pnpm --filter @tutor/db seed:coaching   (applies this, then seeds demo data)

-- ── Enums (guarded — create type has no IF NOT EXISTS) ──────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'coaching_kind') then
    create type coaching_kind as enum ('homeroom_coach', 'buddy'); end if;
  if not exists (select 1 from pg_type where typname = 'wig_area') then
    create type wig_area as enum ('kien_thuc', 'ky_nang', 'tieng_anh', 'the_chat'); end if;
  if not exists (select 1 from pg_type where typname = 'wig_source') then
    create type wig_source as enum ('tutor', 'manual'); end if;
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum ('green', 'amber', 'red'); end if;
  if not exists (select 1 from pg_type where typname = 'effort_scope') then
    create type effort_scope as enum ('lop', 'khoi', 'cap', 'truong'); end if;
end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────────
create table if not exists public.coaching_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  kind coaching_kind not null,
  cadence_days int not null default 28,
  last_meeting_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists coaching_student_mentor_uq on public.coaching_links (student_id, mentor_id, kind);
create index if not exists coaching_mentor_idx on public.coaching_links (mentor_id);

create table if not exists public.wigs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  area wig_area not null,
  title text not null,
  target_desc text,
  progress_pct real not null default 0,
  source wig_source not null default 'manual',
  year int not null,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create unique index if not exists wig_student_area_year_uq on public.wigs (student_id, area, year);

create table if not exists public.lead_measures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  label text not null,
  target_text text,
  value_text text,
  status lead_status not null default 'amber',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lead_student_week_idx on public.lead_measures (student_id, week_start);

create table if not exists public.scoreboard_weeks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  effort_rank int,
  effort_scope effort_scope not null default 'lop',
  commitment text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists scoreboard_student_week_uq on public.scoreboard_weeks (student_id, week_start);

-- ── RLS: student sees own; staff tenant-wide; a linked coach/buddy sees mentee ───
do $$
declare t text; p record;
begin
  foreach t in array array['coaching_links','wigs','lead_measures','scoreboard_weeks']
  loop
    execute format('alter table public.%I enable row level security;', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop execute format('drop policy if exists %I on public.%I;', p.policyname, t); end loop;
  end loop;
end $$;

create policy coaching_links_read on public.coaching_links for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or student_id = auth.uid() or mentor_id = auth.uid()));

-- wigs / lead_measures / scoreboard_weeks share the same access shape.
do $$
declare t text;
begin
  foreach t in array array['wigs','lead_measures','scoreboard_weeks']
  loop
    execute format($f$
      create policy %1$s_read on public.%1$s for select to authenticated
      using (tenant_id = public.current_tenant_id()
             and (public.is_staff() or student_id = auth.uid()
                  or exists (select 1 from public.coaching_links cl
                             where cl.student_id = %1$s.student_id and cl.mentor_id = auth.uid())));
    $f$, t);
  end loop;
end $$;

-- Student may edit only their own weekly commitment (writes normally go via edge fn).
create policy scoreboard_self_write on public.scoreboard_weeks for update to authenticated
  using (tenant_id = public.current_tenant_id() and student_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and student_id = auth.uid());
