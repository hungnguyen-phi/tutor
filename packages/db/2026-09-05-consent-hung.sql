-- Cấy đồng thuận cho tài khoản thử của chủ dự án (SSO Google, 05/09) — cùng
-- kiểu bản ghi đã cấy cho 3 học sinh thử (dual_consent=false, active), để mở
-- bài không bị 403 consent_required. Idempotent.
--   node packages/db/run-sql.mjs packages/db/2026-09-05-consent-hung.sql
insert into public.consent_records (tenant_id, student_id, purpose, dual_consent, student_assent, guardian_consent_by, status, granted_at)
select p.tenant_id, u.id, 'ai_tutoring', false, true, null, 'active', now()
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'hung.nguyen@truongvietanh.com'
  and not exists (
    select 1 from public.consent_records c
    where c.student_id = u.id and c.purpose = 'ai_tutoring'
  );

-- Kiểm: phải ra 1 dòng active
select u.email, c.status, c.dual_consent, c.student_assent
from public.consent_records c join auth.users u on u.id = c.student_id
where u.email = 'hung.nguyen@truongvietanh.com';
