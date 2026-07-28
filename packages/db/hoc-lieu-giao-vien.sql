-- ═══════════════════════════════════════════════════════════════════════════
-- HỌC LIỆU DO GIÁO VIÊN ĐĂNG — dựng khung DB
--
--     node packages/db/run-sql.mjs packages/db/hoc-lieu-giao-vien.sql
--
-- Trước đây học liệu chỉ vào được bằng gói import-kg từ Xưởng; giáo viên không
-- có đường nào tự gắn tài liệu cho bài mình dạy. File này mở đường đó:
--
--   1. `resources` thêm: tiêu đề, người đăng, cờ HIỆN/ẨN (giáo viên tick chọn
--      định dạng nào cho học sinh thấy — tick nhiều thì hiện song song).
--      Gom nhiều định dạng của CÙNG một học liệu bằng cột `resource_key` có sẵn.
--   2. `resource_progress`: mỗi học sinh đi tới MỨC mấy của kho báu ở bài đó.
--      Mỗi lượt vào chỉ ăn thêm MỘT mức (mức 1 → 2 → 3), quay lại lần sau mới
--      mở tiếp — không cho nuốt trọn ba mức trong một lần.
--   3. RLS: giáo viên trong trường được thêm/sửa/ẩn học liệu; học sinh KHÔNG đọc
--      thẳng bảng (mọi lượt xem đi qua edge function ký link 1 giờ).
--   4. Storage: giáo viên được tải tệp lên đúng thư mục hoc-lieu/<trường>/.
--
-- Idempotent: chạy lại nhiều lần không hỏng.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) resources: cột mới ──────────────────────────────────────────────────
alter table resources
  add column if not exists tieu_de    text,
  add column if not exists nguoi_dang uuid references profiles(id) on delete set null,
  -- Cờ TICK của giáo viên. Tách khỏi `status` (do pipeline Xưởng quản) để hai
  -- bên không giẫm chân: Xưởng đặt status, giáo viên bật/tắt hien_thi.
  add column if not exists hien_thi   boolean not null default true;

-- Tra học liệu của một bài phải nhanh: đây là truy vấn chạy mỗi lần mở lộ trình.
create index if not exists resources_node_idx
  on resources (kg_version_id, node_key, hien_thi);

-- ── 2) Tiến trình kho báu của từng học sinh ────────────────────────────────
create table if not exists resource_progress (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete cascade,
  kg_version_id uuid not null references kg_versions(id) on delete cascade,
  node_key      text not null,
  -- 0 = chưa mở gì; 1..3 = đã đi qua tới mức đó. Mức đang mở = muc_da_qua + 1.
  muc_da_qua    int  not null default 0 check (muc_da_qua between 0 and 3),
  updated_at    timestamptz not null default now(),
  unique (student_id, kg_version_id, node_key)
);

alter table resource_progress enable row level security;
drop policy if exists rp_self_read on resource_progress;
create policy rp_self_read on resource_progress for select to authenticated
  using (student_id = auth.uid()
         or (tenant_id = public.current_tenant_id() and public.is_staff()));
-- GHI chỉ qua edge function (service role) — không mở update cho client, kẻo
-- học sinh tự đặt muc_da_qua = 3 rồi mở hết kho báu.

-- ── 3) RLS resources: giáo viên được ghi ───────────────────────────────────
-- (Policy đọc `resources_read` do rls.sql dựng, giữ nguyên.)
drop policy if exists resources_staff_write on resources;
create policy resources_staff_write on resources for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy if exists resources_staff_update on resources;
create policy resources_staff_update on resources for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy if exists resources_staff_delete on resources;
create policy resources_staff_delete on resources for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_staff());

-- ── 4) Storage: giáo viên tải học liệu lên hoc-lieu/<trường>/… ─────────────
-- Cùng khuôn với studio/*: chặn theo bucket + prefix + vai. ĐỌC vẫn không có
-- policy nào — mọi lượt xem đi qua edge function ký link.
drop policy if exists teacher_material_insert on storage.objects;
create policy teacher_material_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'hoc-lieu'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and public.is_staff()
  );

-- Đè lên tệp cũ (giữ nguyên đường dẫn đã lưu trong resources) cần update+select.
drop policy if exists teacher_material_update on storage.objects;
create policy teacher_material_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'hoc-lieu'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and public.is_staff()
  )
  with check (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'hoc-lieu'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and public.is_staff()
  );

drop policy if exists teacher_material_select on storage.objects;
create policy teacher_material_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'hoc-lieu'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and public.is_staff()
  );

drop policy if exists teacher_material_delete on storage.objects;
create policy teacher_material_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'learning-assets'
    and (storage.foldername(name))[1] = 'hoc-lieu'
    and (storage.foldername(name))[2] = public.current_tenant_id()::text
    and public.is_staff()
  );

-- ── Kiểm sau khi chạy ──────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'resources'
      and column_name in ('tieu_de', 'nguoi_dang', 'hien_thi'))                as cot_moi_3,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'resource_progress')        as bang_tien_trinh_1,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'resources'
      and policyname like 'resources_staff_%')                                 as policy_giao_vien_3,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'teacher_material_%')                                as policy_storage_4;
