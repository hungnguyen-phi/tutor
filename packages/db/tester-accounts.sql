-- ═══════════════════════════════════════════════════════════════════════════
-- 9 TÀI KHOẢN THỬ NGHIỆM (3 người × [học sinh + phụ huynh + giáo viên])
-- + LỚP 10A1 để thử CHÉO: một giáo viên chủ nhiệm CẢ BA em, mỗi phụ huynh
--   chỉ được thấy ĐÚNG con mình.
--
-- ⚠ LÀM TRƯỚC (Supabase Dashboard → Authentication → Add user):
--   tạo 9 tài khoản với ĐÚNG email dưới đây, NHỚ TÍCH "Auto Confirm User"
--   (không tích thì tài khoản chưa xác nhận, đăng nhập hỏng). File này KHÔNG
--   đặt mật khẩu — mật khẩu chỉ đặt trong Dashboard và ghi trong phiếu phát
--   cho người thử.
--
--     hs1@truongvietanh.com   ph1@truongvietanh.com   gv1@truongvietanh.com
--     hs2@truongvietanh.com   ph2@truongvietanh.com   gv2@truongvietanh.com
--     hs3@truongvietanh.com   ph3@truongvietanh.com   gv3@truongvietanh.com
--
-- FILE NÀY LÀM NỐT phần giao diện không làm được:
--   1. MỞ MIỀN truongvietanh.com cho trigger dựng hồ sơ — trigger đang chỉ nhận
--      vietanh.edu.vn, email miền khác thì auth có tài khoản mà `profiles` KHÔNG
--      có dòng nào, đăng nhập vào hỏng rất khó đoán
--   2. sửa vai (mọi tài khoản mới đều mặc định 'student'), tên hiển thị, khối
--   3. cấy consent cho từng học sinh — THIẾU LÀ KẸT NGAY CÂU ĐẦU (diagnose trả
--      403 consent_required), người thử sẽ báo "app hỏng" chứ không báo thiếu consent
--   4. nối phụ huynh với ĐÚNG con (guardian_links) — thiếu thì màn hình phụ huynh
--      chỉ hiện "Chưa liên kết với học sinh nào"
--   5. gán role_key mở tab Chấm bài, dựng lớp 10A1 + phân công giáo viên
--
--     node packages/db/run-sql.mjs packages/db/tester-accounts.sql
-- Idempotent: chạy lại nhiều lần không hỏng. Tài khoản chưa tạo thì báo và bỏ qua.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Trigger dựng hồ sơ: nhận CẢ HAI miền của trường ─────────────────────
-- Giữ nguyên mọi thứ khác của bản đang chạy, chỉ nới điều kiện miền. Vẫn khoá
-- miền phía server (không tin `hd` của client) — email ngoài hai miền này vẫn
-- KHÔNG tự thành 'student' trong trường.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant uuid;
  v_name   text;
begin
  select id into v_tenant from public.tenants order by created_at limit 1;
  if v_tenant is null then
    return new;
  end if;

  if lower(split_part(coalesce(new.email, ''), '@', 2))
     not in ('vietanh.edu.vn', 'truongvietanh.com') then
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
end $function$;

-- ── 2) Vá hồ sơ cho tài khoản ĐÃ tạo trước khi chạy bước 1 ─────────────────
-- Trigger chỉ chạy lúc TẠO tài khoản. Ai lỡ tạo ở miền mới TRƯỚC khi chạy file
-- này thì auth có mà profiles không → mọi bước dưới sẽ "BỎ QUA". Dựng bù ở đây.
insert into public.profiles (id, tenant_id, role, full_name, email)
select u.id,
       (select id from public.tenants order by created_at limit 1),
       'student',
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       lower(u.email)
  from auth.users u
 where lower(split_part(u.email, '@', 2)) = 'truongvietanh.com'
   and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ── 3) Vai, tên, consent, liên kết, lớp ────────────────────────────────────
do $$
declare
  v_tenant uuid;
  v_class  uuid;
  r        record;
  v_hs     uuid;
  v_ph     uuid;
  v_gv     uuid;
  v_gv1    uuid;
  v_thieu  int := 0;
begin
  select id into v_tenant from tenants order by created_at limit 1;
  if v_tenant is null then
    raise exception 'Chưa có tenant nào — dừng.';
  end if;

  -- Lớp 10A1: chỗ để thử CHÉO. Giáo viên của Người thử 1 làm chủ nhiệm, cả ba
  -- học sinh thử nằm chung lớp này.
  select id into v_gv1 from profiles where email = 'gv1@truongvietanh.com';
  select id into v_class from classes where tenant_id = v_tenant and name = '10A1';
  if v_class is null then
    insert into classes (tenant_id, grade, name, homeroom_teacher_id, school_year)
    values (v_tenant, '10', '10A1', v_gv1, '2026-2027')
    returning id into v_class;
  else
    update classes set homeroom_teacher_id = coalesce(v_gv1, homeroom_teacher_id)
     where id = v_class;
  end if;

  for r in
    select * from (values
      -- học sinh                 phụ huynh                giáo viên                tên học sinh      tên phụ huynh      TÊN GIÁO VIÊN (sửa thành tên thật)  môn
      ('hs1@truongvietanh.com', 'ph1@truongvietanh.com', 'gv1@truongvietanh.com', 'Học sinh thử A', 'Phụ huynh thử A', 'Giáo viên 1 — chủ nhiệm 10A1', 'Toan'),
      ('hs2@truongvietanh.com', 'ph2@truongvietanh.com', 'gv2@truongvietanh.com', 'Học sinh thử B', 'Phụ huynh thử B', 'Giáo viên 2 — Toán 10A1',      'Toan'),
      ('hs3@truongvietanh.com', 'ph3@truongvietanh.com', 'gv3@truongvietanh.com', 'Học sinh thử C', 'Phụ huynh thử C', 'Giáo viên 3 — Anh 10A1',       'TiengAnh')
    ) t(hs, ph, gv, ten_hs, ten_ph, ten_gv, mon)
  loop
    select id into v_hs from profiles where email = r.hs;
    select id into v_ph from profiles where email = r.ph;
    select id into v_gv from profiles where email = r.gv;

    if v_hs is null or v_ph is null or v_gv is null then
      raise notice 'BỎ QUA bộ % — chưa tạo đủ tài khoản (hs:% ph:% gv:%)',
        r.ten_gv, (v_hs is not null), (v_ph is not null), (v_gv is not null);
      v_thieu := v_thieu + 1;
      continue;
    end if;

    -- ── HỌC SINH ────────────────────────────────────────────────────────────
    update profiles
       set role = 'student', full_name = r.ten_hs, grade = '10',
           class_id = v_class,
           tenant_id = coalesce(tenant_id, v_tenant)
     where id = v_hs;
    if not exists (select 1 from user_roles where user_id = v_hs and role_key = 'student') then
      insert into user_roles (tenant_id, user_id, role_key) values (v_tenant, v_hs, 'student');
    end if;
    -- Consent: khớp đúng bản đang chạy của tài khoản demo (ai_tutoring, một phía).
    if not exists (select 1 from consent_records where student_id = v_hs and status = 'active') then
      insert into consent_records (tenant_id, student_id, purpose, dual_consent, student_assent, status, granted_at)
      values (v_tenant, v_hs, 'ai_tutoring', false, true, 'active', now());
    end if;

    -- ── PHỤ HUYNH: chỉ nối với ĐÚNG con mình ────────────────────────────────
    update profiles
       set role = 'parent', full_name = r.ten_ph,
           tenant_id = coalesce(tenant_id, v_tenant)
     where id = v_ph;
    if not exists (select 1 from user_roles where user_id = v_ph and role_key = 'parent') then
      insert into user_roles (tenant_id, user_id, role_key) values (v_tenant, v_ph, 'parent');
    end if;
    if not exists (select 1 from guardian_links where guardian_id = v_ph and student_id = v_hs) then
      insert into guardian_links (tenant_id, guardian_id, student_id) values (v_tenant, v_ph, v_hs);
    end if;

    -- ── GIÁO VIÊN ───────────────────────────────────────────────────────────
    -- role_key 'teacher' cho ĐỦ hai quyền (content:review:approve + report:class:read);
    -- riêng giáo viên chủ nhiệm nhận thêm 'homeroom_teacher'.
    update profiles
       set role = 'teacher', full_name = r.ten_gv,
           tenant_id = coalesce(tenant_id, v_tenant)
     where id = v_gv;
    if not exists (select 1 from user_roles where user_id = v_gv and role_key = 'teacher') then
      insert into user_roles (tenant_id, user_id, role_key) values (v_tenant, v_gv, 'teacher');
    end if;
    if v_gv = v_gv1 and not exists (
      select 1 from user_roles where user_id = v_gv and role_key = 'homeroom_teacher'
    ) then
      insert into user_roles (tenant_id, user_id, role_key) values (v_tenant, v_gv, 'homeroom_teacher');
    end if;
    -- Phân công dạy 10A1 (class_id của bảng này là TEXT — lưu uuid dạng chữ).
    if not exists (
      select 1 from teacher_assignments
       where teacher_id = v_gv and class_id = v_class::text and coalesce(subject, '') = r.mon
    ) then
      insert into teacher_assignments (tenant_id, teacher_id, subject, class_id, is_homeroom)
      values (v_tenant, v_gv, r.mon, v_class::text,
              case when v_gv = v_gv1 then 'true' else 'false' end);
    end if;

    raise notice 'XONG bộ %', r.ten_gv;
  end loop;

  if v_thieu > 0 then
    raise notice '⚠ Còn % bộ chưa tạo đủ tài khoản trên Dashboard.', v_thieu;
  else
    raise notice '✔ Xong 9 tài khoản + lớp 10A1 (chủ nhiệm gv1@truongvietanh.com).';
  end if;
end $$;

-- ── KIỂM LẠI ───────────────────────────────────────────────────────────────
-- Học sinh: lop=10A1, consent=1. Phụ huynh: so_con=1 (KHÔNG được 2, 3 — lộ con
-- nhà khác). Giáo viên: quyen chứa 'teacher'; riêng gv1 có thêm homeroom_teacher.
select p.email,
       p.role::text                                                                       as vai,
       p.full_name                                                                        as ten,
       (select c.name from classes c where c.id = p.class_id)                             as lop,
       (select count(*) from consent_records k
         where k.student_id = p.id and k.status = 'active')                                as consent,
       (select count(*) from guardian_links g where g.guardian_id = p.id)                  as so_con,
       (select string_agg(u.role_key, '+' order by u.role_key)
          from user_roles u where u.user_id = p.id)                                        as quyen
  from profiles p
 where p.email like '%@truongvietanh.com'
 order by p.email;
