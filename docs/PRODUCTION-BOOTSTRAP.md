# Bootstrap project Supabase MỚI (production)

> Mục tiêu: từ một project Supabase **rỗng** dựng lên toàn bộ Tutor production —
> schema + RBAC + nội dung + edge functions + auth — theo đúng thứ tự, có kiểm.
> Nguồn chân lý nội dung là Studio (school ai); project này giữ **hoạt động** +
> một **bản sao phục vụ** của nội dung (import một chiều từ Studio).

Ký hiệu: 🤖 = Claude chạy được qua Supabase MCP (khi bạn đã authorize). 👤 = chỉ
bạn làm được (dashboard/Google Cloud). `!` = bạn chạy lệnh ở máy.

---

## 0. Tiền đề (👤)

1. Tạo project Supabase mới. Ghi lại: **Project ref**, **Project URL**, **anon
   (publishable) key**, **service_role key**, **DB password**.
2. Authorize Supabase MCP trong Claude Code tương tác: `/mcp` → chọn `supabase`
   → đăng nhập. (Phiên hiện tại chưa authorize ⇒ Claude chưa đụng DB được.)
3. Điền `.env` ở gốc repo (KHÔNG commit) theo `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_DB_HOST/PORT/USER/PASSWORD` (hoặc `DATABASE_URL` — dùng **Session
     pooler** cho IPv4).

---

## 1. Schema — apply migrations theo thứ tự (🤖 hoặc `!`)

Bộ migration sạch nằm ở `supabase/migrations/` (gom từ các file `.sql` đã kiểm
chứng, đúng thứ tự phụ thuộc):

| # | File | Nội dung |
|---|---|---|
| 0001 | base_schema | 24 bảng nền + enum + FK + index (từ drizzle) |
| 0002 | kg_core | kg_versions/nodes/edges/tiers/resources/questions/socratic_ladders + pgvector |
| 0003 | kg_core_v22 | 16 dạng câu hỏi, telemetry Elo, revision xanh/vàng |
| 0004 | rls | helper `current_tenant_id/current_role/is_staff` + RLS đọc |
| 0005 | rbac_rls | `has_perm/can_act_for_student` + RLS catalog RBAC |
| 0006 | coaching | coaching_links/wigs/lead_measures/scoreboard_weeks + RLS |
| 0007 | xp_stats | xp_events/student_xp/`award_xp` + `recompute_question_stats` + pg_cron |
| 0008 | security_hardening | bịt đọc trực tiếp KG, FORCE RLS, rate-limit, timeout |
| 0009 | storage | bucket `learning-assets` (private) + policy studio/* |
| 0010 | classes_roster | **MỚI**: bảng `classes` + `profiles.class_id` (nền lớp thật) |

- **Qua MCP:** áp lần lượt bằng `apply_migration` (mỗi file một lần, đúng thứ tự).
- **Qua CLI:** `supabase link --project-ref <ref>` rồi `supabase db push`.

Kiểm: `list_tables` phải thấy đủ bảng nền + KG + `classes`; không lỗi.

---

## 2. RBAC catalog (roles/permissions) (`!`)

```
pnpm --filter @tutor/db seed:rbac
```
Nạp `roles`, `permissions`, `role_permissions` (nguồn: `docs/RBAC-FULL.md`).
Kiểm: bảng `roles` có đủ vai (student/teacher/parent/admin/leadership/coach/
buddy/counselor/dpo/subject_lead…), `role_permissions` không rỗng.

---

## 3. Tenant của trường (🤖 / `!`)

Tạo đúng **một** tenant:
```sql
insert into tenants (name, slug) values ('Trường Việt Anh', 'viet-anh')
on conflict (slug) do nothing;
```
> KHÔNG dùng `seed:demo` — script `seed-demo-users.ts` là dữ liệu DEMO (dev-only),
> tuyệt đối không chạy trên production. Người dùng thật sinh ra qua SSO (Pha 1) +
> roster (Pha 3), không seed tay.

---

## 4. Nội dung — import từ Studio (một chiều) (`!` / cửa /teacher)

Nội dung KHÔNG soạn trong project này; import từ Studio/Drive:
- **Khung tri thức + câu hỏi + Socratic**: nạp bundle `va.kg-bundle/2.2` qua
  `import-kg`, bộ câu hỏi `va.kg-questions/2.2` qua `import-questions` (cửa kéo-thả
  ở `/teacher`, cần JWT vai teacher/admin). Bundle repo: `packages/db/bundles/`.
- Sau import: node ở `review` → duyệt/publish để thành `active` (học sinh mới thấy).
- 1416 câu Toán 10 + 888 thang từ Drive: nạp lại bằng chính gói Drive gốc (không
  copy tay từ project cũ).

Kiểm: `kg_versions` có bản `published`; `questions` có hàng `active` cho Toán 10.

---

## 5. Edge Functions — deploy 18 hàm (🤖 / `!`)

Danh sách: `chat-turn, dashboard, diagnose, effort-gate, end-session, evaluate,
evaluate-rubric, evaluate-speaking, guide, hello, import-kg, import-questions,
learning-path, question-stats, resources, scoreboard, teacher-review,
teacher-stats`. `verify_jwt` theo `supabase/config.toml` (mọi hàm phục vụ người
dùng = true; chỉ `hello` = false).

**Secrets** (đặt qua `supabase secrets set` hoặc dashboard → Edge Functions):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (bắt buộc — hàm ghi tin cậy)
- `ALLOWED_ORIGINS` = origin web thật (Cloudflare) — THIẾU thì prod bị CORS chặn
- `SUPABASE_JWT_SECRET` (phòng thủ chiều sâu HS256)
- `OPENROUTER_API_KEY` (chấm rubric viết/nói + chat tự do; thiếu thì các hàm này
  có đường lui trung thực)
- `LLM_DAILY_TOKEN_LIMIT` (mặc định 200000)

Kiểm: `curl .../functions/v1/hello` trả 200; `scoreboard` với JWT thật trả JSON.

---

## 6. Trỏ FRONTEND sang project mới (`!`) — QUAN TRỌNG

`apps/web/lib/config.ts` và `apps/web/next.config.mjs` đang hardcode ref project
CŨ làm fallback. Trước khi build production, set env (KHÔNG sửa cứng):
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref-moi>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-moi>
```
Build: `pnpm --filter @tutor/web build`. (Dev proxy `/__sb` tự dùng
`NEXT_PUBLIC_SUPABASE_URL`.)

---

## 7. Google Workspace SSO — checklist (👤) — dùng ở Pha 1

Toàn trường (gồm học sinh) đăng nhập bằng Google, khoá miền `vietanh.edu.vn`.

**Google Cloud Console:**
1. Tạo/chọn project → **APIs & Services → OAuth consent screen**: chọn
   **Internal** (giới hạn trong Workspace của trường) → điền tên app, email hỗ trợ.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized redirect URIs**: `https://<ref-moi>.supabase.co/auth/v1/callback`.
4. Lưu **Client ID** + **Client secret**.

**Supabase dashboard:**
5. **Authentication → Providers → Google**: bật, dán Client ID + Secret.
6. **Authentication → URL Configuration**: Site URL = URL web production; thêm
   redirect URL của web.
7. (Khoá miền) đặt secret cho edge/allowlist `ALLOWED_EMAIL_DOMAIN=vietanh.edu.vn`
   — Pha 1 chặn email ngoài miền ở tầng provisioning.

**Phụ huynh (magic-link):**
8. **Authentication → Providers → Email**: bật, tắt "Confirm email" nếu dùng OTP
   link; cấu hình template email link. Session ngắn xử lý ở Pha 1.

---

## 8. Định nghĩa "xong" của bootstrap

- Project rỗng → sau các bước trên: `list_tables` đủ bảng; `roles`/`permissions`
  có dữ liệu; tenant `viet-anh` tồn tại; Toán 10 có câu `active`; 18 function live;
  đăng nhập Google bằng email trường ra được profile; web build trỏ đúng project mới.
