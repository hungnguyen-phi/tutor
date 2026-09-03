-- Thanh học liệu ôn lại (audio/video/ảnh) cạnh câu hỏi + thưởng XP khi xem hết
-- (chủ dự án 09/2026). "Xem" = học sinh BẤM MỞ (không bắt được sự kiện phát
-- xong qua iframe YouTube/Drive khác tên miền — xem ghi chú resources/index.ts).
-- Idempotent — chạy lại an toàn.

-- ── XP kind mới: resource_review, một lần/node/phiên-bản-KG ─────────────────
alter table xp_events drop constraint if exists xp_events_kind_check;
alter table xp_events add constraint xp_events_kind_check
  check (kind in ('correct','persistence','lesson_done','node_mastered','resource_review'));

create unique index if not exists xp_uq_resource_review
  on xp_events (student_id, kind, node_id, kg_version_id)
  where kind = 'resource_review';

-- ── Ghi nhận từng lần học sinh mở một học liệu trong thanh ôn lại ───────────
create table if not exists resource_views (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  node_key      text not null,
  resource_id   uuid not null references resources(id) on delete cascade,
  viewed_at     timestamptz not null default now(),
  unique (student_id, resource_id)
);
create index if not exists resource_views_student_node_idx
  on resource_views (student_id, kg_version_id, node_key);

alter table resource_views enable row level security;
drop policy if exists resource_views_self_read on resource_views;
create policy resource_views_self_read on resource_views for select to authenticated
  using (student_id = auth.uid() or (tenant_id = public.current_tenant_id() and public.is_staff()));
-- Ghi chỉ qua edge function (service role) — không cấp insert/update cho client,
-- đúng khuôn resource_progress đã dùng.
