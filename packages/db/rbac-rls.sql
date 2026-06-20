-- M4b: permission helper + RLS for the RBAC catalog.
-- Apply after rbac tables exist: psql "$DATABASE_URL" -f packages/db/rbac-rls.sql
-- (or via the apply script). current_role()/current_tenant_id() come from rls.sql.

-- has_perm(perm): does the caller's primary role grant this permission?
create or replace function public.has_perm(perm text)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.role_permissions rp
    where rp.perm_key = perm and rp.role_key = public.current_role()
  )
$$;

-- can_act_for_student(sid): the caller is the student, their guardian, or staff.
create or replace function public.can_act_for_student(sid uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select sid = auth.uid()
      or public.is_staff()
      or exists (select 1 from public.guardian_links gl
                 where gl.student_id = sid and gl.guardian_id = auth.uid())
$$;

-- Catalog is world-readable to authenticated users (needed to render UIs);
-- writes only via service role.
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.teacher_assignments enable row level security;

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (true);
drop policy if exists perms_read on public.permissions;
create policy perms_read on public.permissions for select to authenticated using (true);
drop policy if exists role_perms_read on public.role_permissions;
create policy role_perms_read on public.role_permissions for select to authenticated using (true);

drop policy if exists user_roles_self on public.user_roles;
create policy user_roles_self on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_perm('iam:role:grant'));

drop policy if exists teacher_assign_read on public.teacher_assignments;
create policy teacher_assign_read on public.teacher_assignments for select to authenticated
  using (teacher_id = auth.uid() or public.is_staff());

-- Example of upgrading a sensitive policy to permission-based:
drop policy if exists audit_staff_read on public.audit_logs;
create policy audit_perm_read on public.audit_logs for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.has_perm('audit:log:read'));
