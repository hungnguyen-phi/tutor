-- ═══════════════════════════════════════════════════════════════════════════
-- TẠO 9 TÀI KHOẢN THỬ NGHIỆM BẰNG SQL (thay cho 9 lần bấm form trên Dashboard)
--
-- Chạy file này TRƯỚC, rồi tới tester-accounts.sql:
--     node packages/db/run-sql.mjs packages/db/tester-accounts-create.sql
--     node packages/db/run-sql.mjs packages/db/tester-accounts.sql
--
-- Cách làm: chèn thẳng vào auth.users + auth.identities đúng HÌNH DẠNG mà
-- GoTrue tự sinh (đối chiếu tài khoản demo đang chạy trên chính DB này):
--   · aud/role = 'authenticated'
--   · mật khẩu băm bcrypt (extensions.crypt + gen_salt('bf')) — ĐÚNG cách
--     GoTrue kiểm khi đăng nhập
--   · email_confirmed_at = now() → khỏi phải bấm "Auto Confirm User"
--   · các cột token để CHUỖI RỖNG, không để NULL (GoTrue đọc vào kiểu string,
--     gặp NULL là lỗi khó đoán lúc đăng nhập)
--   · mỗi user một dòng auth.identities provider 'email', provider_id = id
-- Trigger on_auth_user_created sẽ tự dựng dòng `profiles` (miền
-- truongvietanh.com đã được mở trong tester-accounts.sql).
--
-- MẬT KHẨU nằm ngay trong file này — đây là mật khẩu dùng-một-đợt cho 9 tài
-- khoản thử. Sau khi thu phiếu: đổi mật khẩu hoặc xoá hẳn 9 tài khoản (lệnh xoá
-- ở cuối file).
--
-- Idempotent: email đã tồn tại thì bỏ qua, không đụng gì.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_mk   text := 'vietanh2026';   -- mật khẩu chung cho đợt thử
  r      record;
  v_id   uuid;
  v_moi  int := 0;
  v_co   int := 0;
begin
  for r in
    select * from (values
      ('hs1@truongvietanh.com'), ('ph1@truongvietanh.com'), ('gv1@truongvietanh.com'),
      ('hs2@truongvietanh.com'), ('ph2@truongvietanh.com'), ('gv2@truongvietanh.com'),
      ('hs3@truongvietanh.com'), ('ph3@truongvietanh.com'), ('gv3@truongvietanh.com')
    ) t(email)
  loop
    if exists (select 1 from auth.users u where lower(u.email) = r.email) then
      v_co := v_co + 1;
      continue;
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token,
      is_super_admin, is_sso_user, is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      r.email, extensions.crypt(v_mk, extensions.gen_salt('bf')),
      now(), now(), now(), null,
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', '',
      false, false, false
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', r.email,
                         'email_verified', false, 'phone_verified', false),
      'email', null, now(), now()
    );

    v_moi := v_moi + 1;
  end loop;

  raise notice 'Tạo mới % tài khoản, đã có sẵn %.', v_moi, v_co;
end $$;

-- ── Kiểm ngay: 9 dòng, đều có mật khẩu, đã xác nhận, có identity, có profiles ──
select u.email,
       (u.encrypted_password is not null)                                   as co_mat_khau,
       (u.email_confirmed_at is not null)                                   as da_xac_nhan,
       (select count(*) from auth.identities i where i.user_id = u.id)      as identity,
       (select count(*) from public.profiles p where p.id = u.id)           as ho_so
  from auth.users u
 where u.email like '%@truongvietanh.com'
 order by u.email;

-- ═══════════════════════════════════════════════════════════════════════════
-- XOÁ 9 TÀI KHOẢN SAU KHI THU PHIẾU (bỏ dấu -- rồi chạy lại file này)
--   delete from public.profiles
--    where email like '%@truongvietanh.com';
--   delete from auth.users
--    where email like '%@truongvietanh.com';
-- (identities xoá theo cascade; dữ liệu học của 3 em cũng đi theo profiles)
-- ═══════════════════════════════════════════════════════════════════════════
