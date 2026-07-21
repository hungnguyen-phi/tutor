-- xp-stats.sql — Đợt 1 "mọi con số là thật":
--   §1  XP + chuỗi ngày server-authoritative (xp_events + student_xp + award_xp)
--   §2  Thống kê câu hỏi p_value/discrimination + tự đưa câu kém vào hàng duyệt
--   §3  Lịch chạy đêm (pg_cron, nếu extension bật được)
-- Idempotent — chạy lại an toàn. Áp SAU rls.sql (dùng helper current_tenant_id/is_staff).

-- ═══ §1 — XP SERVER-AUTHORITATIVE ════════════════════════════════════════════
-- Nguyên tắc (gamify.ts): thưởng NỖ LỰC — đúng +10, thử lại sau khi sai +5,
-- xong buổi +20, làm chủ node +30. localStorage từ nay chỉ là cache hiển thị.

-- Sổ cái từng lần cộng XP — auditable, tính được "XP tuần" cho bảng tuần.
create table if not exists xp_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete cascade,
  kind          text not null check (kind in ('correct','persistence','lesson_done','node_mastered')),
  amount        int  not null check (amount >= 0),
  session_id    uuid references learning_sessions(id) on delete set null,
  question_id   uuid,
  node_id       text,
  kg_version_id uuid,
  created_at    timestamptz not null default now()
);

-- CHỐNG FARM — mỗi nguồn XP chỉ ăn được MỘT lần:
--   correct/persistence: một lần cho mỗi (học sinh, câu hỏi) — trọn đời, không
--   phải mỗi phiên (làm lại câu cũ để cày XP là vô nghĩa);
--   node_mastered: một lần cho mỗi (học sinh, node, phiên bản KG);
--   lesson_done: một lần cho mỗi phiên học.
create unique index if not exists xp_uq_per_question
  on xp_events (student_id, kind, question_id)
  where question_id is not null and kind in ('correct','persistence');
create unique index if not exists xp_uq_per_node
  on xp_events (student_id, kind, node_id, kg_version_id)
  where kind = 'node_mastered';
create unique index if not exists xp_uq_per_session
  on xp_events (student_id, kind, session_id)
  where kind = 'lesson_done';
create index if not exists xp_events_student_time_idx on xp_events (student_id, created_at);
create index if not exists xp_events_tenant_time_idx  on xp_events (tenant_id, created_at);

-- Tổng hợp nhanh cho HUD: tổng XP + chuỗi ngày (ngày theo giờ VN).
create table if not exists student_xp (
  student_id uuid primary key references profiles(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  xp_total   bigint not null default 0,
  streak     int    not null default 0,
  last_day   date,
  updated_at timestamptz not null default now()
);
create index if not exists student_xp_tenant_idx on student_xp (tenant_id);

-- RLS: học sinh đọc của mình; nhân sự đọc trong tenant; KHÔNG AI ghi từ client
-- (ghi duy nhất qua award_xp gọi bằng service role từ edge function).
alter table xp_events  enable row level security;
alter table student_xp enable row level security;
drop policy if exists xp_events_read on xp_events;
create policy xp_events_read on xp_events for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (student_id = auth.uid() or public.is_staff()));
drop policy if exists student_xp_read on student_xp;
create policy student_xp_read on student_xp for select to authenticated
  using (tenant_id = public.current_tenant_id()
         and (student_id = auth.uid() or public.is_staff()));

-- award_xp: MỘT lượt gọi nguyên tử = ghi các sự kiện (dedup bằng unique index,
-- trùng thì bỏ qua im lặng) + cập nhật tổng & chuỗi ngày. p_events có thể RỖNG —
-- khi đó chỉ "chấm công" chuỗi ngày (trả lời sai vẫn là một ngày có học).
-- SECURITY DEFINER nhưng đã REVOKE khỏi client roles — chỉ service_role gọi.
create or replace function public.award_xp(p_tenant uuid, p_student uuid, p_events jsonb)
returns table (xp_total bigint, streak int, gained int)
language plpgsql security definer set search_path = public as $$
declare
  e jsonb;
  ins int;
  g int := 0;
  d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  for e in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    insert into xp_events (tenant_id, student_id, kind, amount, session_id, question_id, node_id, kg_version_id)
    values (
      p_tenant, p_student, e->>'kind', (e->>'amount')::int,
      nullif(e->>'session_id','')::uuid,
      nullif(e->>'question_id','')::uuid,
      nullif(e->>'node_id',''),
      nullif(e->>'kg_version_id','')::uuid
    )
    on conflict do nothing;
    get diagnostics ins = row_count;
    if ins = 1 then g := g + (e->>'amount')::int; end if;
  end loop;

  insert into student_xp as sx (student_id, tenant_id, xp_total, streak, last_day, updated_at)
  values (p_student, p_tenant, g, 1, d, now())
  on conflict (student_id) do update set
    xp_total   = sx.xp_total + g,
    streak     = case when sx.last_day = d     then sx.streak
                      when sx.last_day = d - 1 then sx.streak + 1
                      else 1 end,
    last_day   = d,
    updated_at = now();

  return query
    select sx.xp_total, sx.streak, g from student_xp sx where sx.student_id = p_student;
end $$;
revoke execute on function public.award_xp(uuid, uuid, jsonb) from public, anon, authenticated;
-- service_role nằm trong PUBLIC nên revoke ở trên cũng cắt nó — cấp lại tường minh
-- (edge functions gọi rpc bằng service key).
grant execute on function public.award_xp(uuid, uuid, jsonb) to service_role;

-- ═══ §2 — THỐNG KÊ CÂU HỎI & ĐÀO THẢI CÂU KÉM ═══════════════════════════════
-- Quy tắc schema v2: "thống kê là trọng tài — câu quá dễ/quá khó/không phân
-- biệt → retired". Chỉ tính LẦN THỬ ĐẦU (attempt_no=1) — các lần thử lại đã
-- nhận gợi ý nên không nói lên độ khó thật của câu.
alter table questions add column if not exists stats_n int;
alter table questions add column if not exists stats_updated_at timestamptz;

-- Ngưỡng cờ (pilot): cần ≥10 lượt mới đủ tin; p ≤ 0.15 quá khó / ≥ 0.95 quá dễ /
-- discrimination ≤ 0.05 không phân biệt được HS vững-yếu (corr điểm câu × năng lực).
create or replace function public.recompute_question_stats(p_tenant uuid default null)
returns table (updated int, flagged int)
language plpgsql security definer set search_path = public as $$
declare
  v_updated int := 0;
  v_flagged int := 0;
begin
  -- Cập nhật p_value / discrimination / stats_n cho MỌI câu có dữ liệu.
  with fa as (
    select a.tenant_id, a.question_id, a.student_id,
           (a.is_correct)::int::real as score
    from attempts a
    where a.attempt_no = 1 and a.is_correct is not null
      and (p_tenant is null or a.tenant_id = p_tenant)
  ),
  ability as (          -- năng lực HS = tỉ lệ đúng lần-đầu trên toàn bộ câu đã làm
    select student_id, avg(score) as ab from fa group by student_id
  ),
  stats as (
    select fa.question_id,
           count(*)::int   as n,
           avg(fa.score)   as p,
           corr(fa.score, ability.ab) as disc   -- point-biserial ≈ Pearson corr
    from fa join ability using (student_id)
    group by fa.question_id
  )
  update questions q
     set p_value          = s.p,
         discrimination   = s.disc,
         stats_n          = s.n,
         stats_updated_at = now()
    from stats s
   where q.id::text = s.question_id;
  get diagnostics v_updated = row_count;

  -- Cờ câu kém: đủ mẫu + (quá dễ | quá khó | không phân biệt) → 'review' và vào
  -- hàng chờ giáo viên. KHÔNG tự retired — người quyết (human-in-the-loop).
  with bad as (
    update questions q
       set trang_thai = 'review'
     where q.trang_thai = 'active'
       and q.stats_n >= 10
       and (q.p_value <= 0.15 or q.p_value >= 0.95
            or coalesce(q.discrimination, 0) <= 0.05)
       and (p_tenant is null or q.tenant_id = p_tenant)
     returning q.id, q.tenant_id, q.p_value, q.discrimination, q.stats_n
  )
  insert into review_queue (tenant_id, content_type, content_id, ai_generated, status, note)
  select b.tenant_id, 'question', b.id::text, false, 'pending',
         format('Thống kê tự động: p=%s, disc=%s, n=%s — câu %s',
                round(b.p_value::numeric, 2), round(coalesce(b.discrimination,0)::numeric, 2), b.stats_n,
                case when b.p_value >= 0.95 then 'quá dễ'
                     when b.p_value <= 0.15 then 'quá khó'
                     else 'không phân biệt được HS vững/yếu' end)
    from bad b
   where not exists (      -- đừng xếp hàng trùng khi câu đã chờ duyệt sẵn
     select 1 from review_queue r
      where r.content_type = 'question' and r.content_id = b.id::text
        and r.status = 'pending'
   );
  get diagnostics v_flagged = row_count;

  return query select v_updated, v_flagged;
end $$;
revoke execute on function public.recompute_question_stats(uuid) from public, anon, authenticated;
grant execute on function public.recompute_question_stats(uuid) to service_role;

-- ═══ §3 — LỊCH CHẠY ĐÊM (pg_cron nếu có) ═════════════════════════════════════
-- 19:30 UTC = 02:30 giờ VN. Nếu extension không bật được (plan không hỗ trợ)
-- thì bỏ qua êm — đã có nút "Quét câu kém" trong /teacher gọi tay.
do $$ begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron không bật được (%). Dùng nút quét tay trong /teacher.', sqlerrm;
end $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'question-stats-nightly') then
      perform cron.schedule('question-stats-nightly', '30 19 * * *',
                            $job$select public.recompute_question_stats()$job$);
    end if;
  end if;
end $$;
