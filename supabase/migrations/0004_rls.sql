-- Row Level Security (4 groups: student / teacher / parent / admin) — PRD §IX.
-- Apply AFTER drizzle-kit push AND kg-core.sql.
-- Run: psql "$DATABASE_URL" -f packages/db/rls.sql
--
-- Model:
--  * Browser clients use the user JWT (authenticated role) → these policies apply.
--  * Edge Functions use the service_role key → BYPASS RLS (they do trusted writes).
--  So policies below mainly scope what a logged-in user may READ.
--  * Parents get NO raw access (they receive aggregated reports only).

-- ── Helpers (security definer so they can read profiles past RLS) ───────────────
create or replace function public.current_tenant_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
  returns text language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff()
  returns boolean language sql stable as $$
  select public.current_role() in ('teacher','admin','leadership')
$$;

-- ── Enable RLS everywhere + drop existing policies (idempotent re-run) ───────────
do $$
declare t text; p record;
begin
  foreach t in array array[
    'tenants','profiles','guardian_links','consent_records',
    'learning_sessions','session_turns','attempts','submissions',
    'mastery_evidence','student_node_state',
    'audit_logs','review_queue','safety_events','token_usage','llm_cache',
    'kg_versions','kg_nodes','kg_edges','kg_tiers','resources','questions','socratic_ladders'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I;', p.policyname, t);
    end loop;
  end loop;
end $$;

-- ── Identity ────────────────────────────────────────────────────────────────────
create policy profiles_self_or_staff on public.profiles for select to authenticated
  using (id = auth.uid() or (tenant_id = public.current_tenant_id() and public.is_staff()));

-- Tự đổi TÊN của chính mình (màn Cài đặt trong app). Policy update mở cả dòng
-- nhưng CỘT nào ghi được do GRANT quyết định — giới hạn đúng full_name nên học
-- sinh không thể tự sửa role/tenant. (Web có sẵn fallback tên-cục-bộ khi policy
-- này chưa apply; apply xong thì đổi tên trong app thành chính thức.)
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy tenants_member_read on public.tenants for select to authenticated
  using (id = public.current_tenant_id());

create policy guardian_links_read on public.guardian_links for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or guardian_id = auth.uid() or student_id = auth.uid()));

create policy consent_read on public.consent_records for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or student_id = auth.uid()
              or exists (select 1 from public.guardian_links gl
                         where gl.student_id = consent_records.student_id
                           and gl.guardian_id = auth.uid())));

-- ── Learning tables: student sees own, staff sees tenant-wide, parents none ──────
create policy sessions_read on public.learning_sessions for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or student_id = auth.uid()));

create policy turns_read on public.session_turns for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or exists (
           select 1 from public.learning_sessions s
           where s.id = session_turns.session_id and s.student_id = auth.uid())));

-- attempts / submissions / mastery_evidence / student_node_state share the shape
create policy attempts_read on public.attempts for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or student_id = auth.uid()));

create policy submissions_read on public.submissions for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or student_id = auth.uid()));

create policy evidence_read on public.mastery_evidence for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or student_id = auth.uid()));

create policy node_state_read on public.student_node_state for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or student_id = auth.uid()));

-- ── Governance: staff only ──────────────────────────────────────────────────────
create policy audit_staff_read on public.audit_logs for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_staff());

create policy review_staff_read on public.review_queue for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy review_staff_write on public.review_queue for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_staff());

create policy safety_staff_read on public.safety_events for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_staff());

-- ── KG content with a `status` col: staff see all, students only `active` ───────
do $$
declare t text;
begin
  foreach t in array array['kg_nodes','resources','socratic_ladders']
  loop
    execute format($f$
      create policy %1$s_read on public.%1$s for select to authenticated
      using (tenant_id = public.current_tenant_id()
             and (public.is_staff() or coalesce(status,'active') = 'active'));
    $f$, t);
  end loop;
end $$;

create policy questions_read on public.questions for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_staff() or trang_thai = 'active'));

-- KG metadata without a status gate: any tenant member may read.
create policy kg_versions_read on public.kg_versions for select to authenticated
  using (tenant_id = public.current_tenant_id());
create policy kg_edges_read on public.kg_edges for select to authenticated
  using (tenant_id = public.current_tenant_id());
create policy kg_tiers_read on public.kg_tiers for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- token_usage / llm_cache: no client access (service_role only) → RLS on, no policy.
