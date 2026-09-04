-- SSO Google Workspace của trường — HAI MIỀN (chủ dự án chốt 04/09):
--   truongvietanh.com          (giáo viên / nhân viên)
--   student.truongvietanh.com  (học sinh)
--
-- Trigger dựng hồ sơ khi tài khoản mới đăng nhập lần đầu (auth.users INSERT).
-- Khoá miền Ở SERVER — không tin tham số `hd` phía client (hd chỉ khoá được một
-- miền, và client sửa được). Email ngoài danh sách vẫn có tài khoản auth nhưng
-- KHÔNG có hồ sơ → cổng vai của app từ chối, không lọt vào dữ liệu trường.
--
-- Vai: mọi tài khoản mới đều 'student' (chủ dự án chọn "quản trị nâng vai sau");
-- không đoán vai theo miền. vietanh.edu.vn bỏ khỏi danh sách (miền demo cũ) —
-- hồ sơ demo ĐÃ CÓ không bị xoá (on conflict do nothing chỉ chạy khi tạo mới).
-- Idempotent.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid;
  v_name   text;
  v_domain text;
begin
  select id into v_tenant from public.tenants order by created_at limit 1;
  if v_tenant is null then
    return new;
  end if;

  v_domain := lower(split_part(coalesce(new.email, ''), '@', 2));
  if v_domain not in ('truongvietanh.com', 'student.truongvietanh.com') then
    return new;
  end if;

  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  insert into public.profiles (id, tenant_id, role, full_name, email)
  values (new.id, v_tenant, 'student', v_name, lower(new.email))
  on conflict (id) do nothing;
  return new;
end $function$;

-- Kiểm: trigger vẫn gắn, hàm đã đổi.
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created';
select position('student.truongvietanh.com' in pg_get_functiondef('public.handle_new_user'::regproc)) > 0 as co_mien_student;
