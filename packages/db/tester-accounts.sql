-- ═══════════════════════════════════════════════════════════════════════════
-- DỌN 9 TÀI KHOẢN THỬ NGHIỆM (3 giáo viên × [học sinh + phụ huynh + giáo viên])
--
-- LÀM TRƯỚC (trên Supabase Dashboard → Authentication → Add user):
--   tạo 9 tài khoản với ĐÚNG email dưới đây. BẮT BUỘC đuôi @vietanh.edu.vn —
--   trigger handle_new_user chỉ tự dựng hồ sơ cho email thuộc miền trường; đuôi
--   khác thì auth có tài khoản mà `profiles` KHÔNG có dòng nào, đăng nhập vào
--   hỏng rất khó đoán. Mọi tài khoản mới đều mặc định vai 'student'.
--
-- FILE NÀY LÀM NỐT phần giao diện không làm được:
--   · sửa vai cho tài khoản phụ huynh / giáo viên (mặc định đang là student)
--   · đặt tên hiển thị + lớp
--   · cấy consent cho từng học sinh — THIẾU LÀ KẸT NGAY CÂU ĐẦU (diagnose trả
--     403 consent_required), giáo viên sẽ báo "app hỏng" chứ không báo thiếu consent
--   · nối phụ huynh với đúng con (guardian_links) — thiếu thì màn hình phụ huynh
--     chỉ hiện "Chưa liên kết với học sinh nào"
--   · gán role_key để mở tab Chấm bài
--
-- SỬA TÊN THẬT ở khối VALUES rồi chạy:
--     node packages/db/run-sql.mjs packages/db/tester-accounts.sql
-- Idempotent: chạy lại nhiều lần không hỏng. Tài khoản chưa tạo thì báo và bỏ qua.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_tenant uuid;
  r        record;
  v_hs     uuid;
  v_ph     uuid;
  v_gv     uuid;
  v_thieu  int := 0;
begin
  select id into v_tenant from tenants order by created_at limit 1;
  if v_tenant is null then
    raise exception 'Chưa có tenant nào — dừng.';
  end if;

  for r in
    select * from (values
      -- email học sinh          email phụ huynh          email giáo viên          tên học sinh        tên phụ huynh        TÊN GIÁO VIÊN (sửa thành tên thật)
      ('hs2@vietanh.edu.vn',     'ph2@vietanh.edu.vn',    'gv2@vietanh.edu.vn',    'Học sinh thử A',   'Phụ huynh thử A',   'Giáo viên A'),
      ('hs3@vietanh.edu.vn',     'ph3@vietanh.edu.vn',    'gv3@vietanh.edu.vn',    'Học sinh thử B',   'Phụ huynh thử B',   'Giáo viên B'),
      ('hs4@vietanh.edu.vn',     'ph4@vietanh.edu.vn',    'gv4@vietanh.edu.vn',    'Học sinh thử C',   'Phụ huynh thử C',   'Giáo viên C')
    ) t(hs, ph, gv, ten_hs, ten_ph, ten_gv)
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

    -- ── PHỤ HUYNH ───────────────────────────────────────────────────────────
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
    -- 'homeroom_teacher' chỉ có quyền đọc lớp — vẫn vào được tab Chấm bài nhưng hẹp hơn.
    update profiles
       set role = 'teacher', full_name = r.ten_gv,
           tenant_id = coalesce(tenant_id, v_tenant)
     where id = v_gv;
    if not exists (select 1 from user_roles where user_id = v_gv and role_key = 'teacher') then
      insert into user_roles (tenant_id, user_id, role_key) values (v_tenant, v_gv, 'teacher');
    end if;

    raise notice 'XONG bộ %', r.ten_gv;
  end loop;

  if v_thieu > 0 then
    raise notice '⚠ Còn % bộ chưa tạo đủ tài khoản trên Dashboard.', v_thieu;
  end if;
end $$;

-- ── KIỂM LẠI: mỗi dòng phải đủ tenant ✓ consent ✓ (học sinh) / liên kết con ✓ (phụ huynh) ──
select p.email,
       p.role::text                                    as vai,
       p.full_name                                     as ten,
       (p.tenant_id is not null)                       as co_truong,
       (select string_agg(ur.role_key, '+') from user_roles ur where ur.user_id = p.id) as role_key,
       exists (select 1 from consent_records c where c.student_id = p.id and c.status = 'active') as co_consent,
       (select count(*) from guardian_links g where g.guardian_id = p.id)                          as so_con
  from profiles p
 where p.email in (
   'hs2@vietanh.edu.vn','ph2@vietanh.edu.vn','gv2@vietanh.edu.vn',
   'hs3@vietanh.edu.vn','ph3@vietanh.edu.vn','gv3@vietanh.edu.vn',
   'hs4@vietanh.edu.vn','ph4@vietanh.edu.vn','gv4@vietanh.edu.vn')
 order by p.email;
