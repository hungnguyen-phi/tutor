-- ─────────────────────────────────────────────────────────────────────────────
-- 0011 — Auto-provision hồ sơ khi có AUTH USER mới (Pha 1 — auth production).
--
-- Toàn trường đăng nhập Google SSO; lần đầu đăng nhập, Supabase tạo một hàng
-- auth.users nhưng CHƯA có public.profiles → app thiếu tenant/vai. Trigger này
-- tạo hồ sơ vào tenant DUY NHẤT của trường, vai mặc định 'student' (least
-- privilege — admin/roster nâng lên teacher/parent/… sau). KHÔNG ghi đè hồ sơ
-- đã có (admin/roster tạo trước) nhờ ON CONFLICT DO NOTHING.
--
-- Phụ huynh (magic-link) và tài khoản admin cấp được tạo sẵn kèm đúng vai ở
-- Pha 3 (roster) → khi họ đăng nhập, hồ sơ đã tồn tại, trigger bỏ qua.
--
-- Áp SAU 0001 (profiles/tenants). Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- FK profiles.id → auth.users(id): dọn hồ sơ khi xoá user (offboard/PDPL).
-- NOT VALID: siết hàng MỚI/CẬP NHẬT ngay, BỎ QUA kiểm hàng lịch sử — nếu áp lên
-- project cũ có hồ sơ "mồ côi" (vd buddy placeholder không có auth.users), lệnh
-- không abort cả migration. Có thể VALIDATE sau khi dọn mồ côi.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_id_auth_users_fk' and table_name = 'profiles'
  ) then
    alter table public.profiles
      add constraint profiles_id_auth_users_fk
      foreign key (id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

-- Cột email trên profiles: khớp roster (import theo email) + tra cứu user theo
-- email (admin-roster). handle_new_user điền từ auth; admin-roster điền khi tạo.
alter table public.profiles add column if not exists email text;
create unique index if not exists profiles_tenant_email_uq
  on public.profiles (tenant_id, lower(email)) where email is not null;
-- Backfill email (lowercased) cho hồ sơ sẵn có (seed/pilot) → mọi thao tác
-- khớp-theo-email (admin-roster) thấy được họ; nếu không, tài khoản cũ vô hình.
update public.profiles p set email = lower(u.email)
  from auth.users u where u.id = p.id and p.email is null and u.email is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_name   text;
begin
  -- Một trường = một tenant: lấy tenant sớm nhất. Chưa seed tenant → bỏ qua an toàn.
  select id into v_tenant from public.tenants order by created_at limit 1;
  if v_tenant is null then
    return new;
  end if;

  -- Chỉ AUTO-provision email thuộc MIỀN TRƯỜNG (SSO học sinh/nhân sự). Người
  -- ngoài miền (vd phụ huynh dùng email riêng, hoặc tài khoản lạ đăng nhập Google
  -- không đúng Workspace) KHÔNG được tự thành 'student' trong tenant — admin/roster
  -- tạo hồ sơ tường minh kèm đúng vai. Khoá miền phía server, không tin `hd` client.
  if lower(split_part(coalesce(new.email, ''), '@', 2)) <> 'vietanh.edu.vn' then
    return new;
  end if;

  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, tenant_id, role, full_name, email)
  values (new.id, v_tenant, 'student', v_name, lower(new.email))
  on conflict (id) do nothing; -- hồ sơ đã có (đúng vai) → giữ nguyên
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
