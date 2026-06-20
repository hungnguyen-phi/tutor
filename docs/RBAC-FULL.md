# RBAC — Tài liệu đầy đủ để rà soát (bản phản ánh hệ thống thật)

> **Nguồn:** trích trực tiếp từ DB Supabase `uksbvlkhcyhnpfamducc` đang chạy (bảng `roles`, `permissions`, `role_permissions`).
> **Số liệu:** 12 roles · 48 permissions · 118 grants. Cập nhật khi đổi `seed-rbac.ts` rồi chạy lại `pnpm --filter @tutor/db seed:rbac`.
> Đọc kèm `docs/RBAC.md` (thiết kế & lý do) và `packages/db/rbac-rls.sql` (RLS).

## Cách kiểm soát (2 lớp)
1. **App / Edge Functions:** `authenticate(req)` lấy danh tính từ JWT (`auth.uid()`), nạp `role` (ở `profiles.role`) → tập permission (`role_permissions`), rồi `can(ctx, 'perm')`.
2. **DB / RLS:** `public.has_perm('perm')` + `can_act_for_student()` + scope theo `tenant_id` (xem §5 về mức enforce hiện tại).

> ⚠️ **Quan trọng khi rà soát:** *catalog* (danh mục quyền) đã đầy đủ, nhưng **mức enforce thực tế** mới ở một số điểm (xem **§4 Bảng enforce** và **§5 Khoảng trống**). Phần lớn permission là khung cho M5+.

---

## 1. Roles (12) — và hiện trạng

`profiles.role` (enum đang dùng ở app): **student, teacher, parent, admin, leadership**.
8 role còn lại đã có trong catalog `roles` + grants, **chưa gán cho user thật** (sẽ dùng khi chuyển `profiles.role` sang text/`user_roles` ở M5).

| key | Nhãn | Persona | Đang gán cho user thật? |
|---|---|---|---|
| `student` | Học sinh | Học sinh | ✅ (hs1@) |
| `teacher` | Giáo viên bộ môn | GV bộ môn | ✅ (gv1@) |
| `parent` | Phụ huynh | Phụ huynh | ✅ (ph1@) |
| `homeroom_teacher` | Giáo viên chủ nhiệm | GVCN | ⬜ catalog |
| `subject_lead` | Tổ trưởng chuyên môn | Tổ trưởng | ⬜ catalog |
| `counselor` | Cố vấn tâm lý | Cố vấn tâm lý | ⬜ catalog |
| `content_author` | Đội nội dung — soạn | Đội nội dung | ⬜ catalog |
| `content_reviewer` | Đội nội dung — duyệt | Đội nội dung | ⬜ catalog |
| `campus_admin` | Quản lý cơ sở | Admin cơ sở | ⬜ catalog |
| `leadership` | Ban giám hiệu | BGH | ⬜ (enum có) |
| `dpo` | Cán bộ bảo vệ dữ liệu | DPO | ⬜ catalog |
| `admin` | Admin hệ thống | Admin hệ thống | ⬜ (enum có) |

---

## 2. Danh mục Permissions (48, theo domain)

| Domain | Permissions |
|---|---|
| **org** (4) | `org:tenant:read` · `org:tenant:configure` · `org:campus:manage` · `org:class:manage` |
| **iam** (3) | `iam:user:manage` · `iam:role:grant` · `iam:permission:simulate` |
| **privacy** (5) | `privacy:consent:read` · `privacy:consent:grant` · `privacy:consent:withdraw` · `privacy:dsar:fulfill` · `privacy:dpia:manage` |
| **content** (7) | `content:kg:read` · `content:node:write` · `content:question:read` · `content:question:write` · `content:ladder:write` · `content:review:approve` · `content:question:retire` |
| **learn** (6) | `learn:tutor:chat` · `learn:session:read_own` · `learn:session:read_scope` · `learn:mastery:read_own` · `learn:mastery:read_scope` · `learn:attempt:read_scope` |
| **config** (5) | `config:tenant:update` · `config:subject:update` · `config:class:update` · `config:student:update` · `config:feature_flag:update` |
| **assess** (3) | `assess:summative:grade` · `intervene:manage` · `live:classroom:run` |
| **report** (4) | `report:student:read` · `report:class:read` · `report:school:read` · `report:parent:read` |
| **safety** (4) | `safety:flag:read` · `safety:flag:verify` · `safety:flag:resolve` · `wellbeing:context:read` |
| **ai** (4) | `ai:prompt:manage` · `ai:model:configure` · `ai:budget:read` · `ai:eval:run` |
| **audit** (1) | `audit:log:read` |
| **ops** (1) | `ops:manage` |
| **saas** (1) | `saas:manage` |

---

## 3. Ma trận Role × Permission (đầy đủ — 118 grants)

Cột: **ST**=student · **PA**=parent · **TE**=teacher · **HR**=homeroom_teacher · **SL**=subject_lead · **CO**=counselor · **CA**=content_author · **CR**=content_reviewer · **CM**=campus_admin · **LE**=leadership · **DPO**=dpo · **AD**=admin. `✓`=được cấp.

| Permission | ST | PA | TE | HR | SL | CO | CA | CR | CM | LE | DPO | AD |
|---|--|--|--|--|--|--|--|--|--|--|--|--|
| org:tenant:read | | | | | | | | | | | | ✓ |
| org:tenant:configure | | | | | | | | | | | | ✓ |
| org:campus:manage | | | | | | | | | ✓ | | | ✓ |
| org:class:manage | | | | | | | | | ✓ | | | ✓ |
| iam:user:manage | | | | | | | | | ✓ | | | ✓ |
| iam:role:grant | | | | | | | | | | | | ✓ |
| iam:permission:simulate | | | | | | | | | | | | ✓ |
| privacy:consent:read | ✓ | ✓ | | | | | | | | | ✓ | ✓ |
| privacy:consent:grant | | ✓ | | | | | | | | | | ✓ |
| privacy:consent:withdraw | | ✓ | | | | | | | | | | ✓ |
| privacy:dsar:fulfill | | | | | | | | | | | ✓ | ✓ |
| privacy:dpia:manage | | | | | | | | | | | ✓ | ✓ |
| content:kg:read | | | ✓ | | ✓ | | ✓ | ✓ | | | | ✓ |
| content:node:write | | | ✓ | | ✓ | | ✓ | | | | | ✓ |
| content:question:read | | | ✓ | | ✓ | | | ✓ | | | | ✓ |
| content:question:write | | | ✓ | | ✓ | | ✓ | | | | | ✓ |
| content:ladder:write | | | ✓ | | ✓ | | ✓ | | | | | ✓ |
| content:review:approve | | | ✓ | | ✓ | | | ✓ | | | | ✓ |
| content:question:retire | | | | | ✓ | | | ✓ | | | | ✓ |
| learn:tutor:chat | ✓ | | | | | | | | | | | ✓ |
| learn:session:read_own | ✓ | | | | | | | | | | | ✓ |
| learn:session:read_scope | | | ✓ | ✓ | | | | | | | | ✓ |
| learn:mastery:read_own | ✓ | | | | | | | | | | | ✓ |
| learn:mastery:read_scope | | | ✓ | ✓ | ✓ | | | | | | | ✓ |
| learn:attempt:read_scope | | | ✓ | ✓ | | | | | | | | ✓ |
| config:tenant:update | | | | | | | | | ✓ | | | ✓ |
| config:subject:update | | | | | ✓ | | | | | | | ✓ |
| config:class:update | | | ✓ | | | | | | | | | ✓ |
| config:student:update | | | ✓ | ✓ | | | | | | | | ✓ |
| config:feature_flag:update | | | | | | | | | | | | ✓ |
| assess:summative:grade | | | ✓ | | | | | | | | | ✓ |
| intervene:manage | | | ✓ | ✓ | | | | | | | | ✓ |
| live:classroom:run | | | ✓ | | | | | | | | | ✓ |
| report:student:read | | | ✓ | ✓ | | | | | | | | ✓ |
| report:class:read | | | ✓ | ✓ | ✓ | | | | | ✓ | | ✓ |
| report:school:read | | | | | | | | | ✓ | ✓ | | ✓ |
| report:parent:read | | ✓ | | | | | | | | | | ✓ |
| safety:flag:read | | | ✓ | ✓ | | ✓ | | | | | | ✓ |
| safety:flag:verify | | | | | | ✓ | | | | | | ✓ |
| safety:flag:resolve | | | | | | ✓ | | | | | | ✓ |
| wellbeing:context:read | | | | | | ✓ | | | | | | ✓ |
| ai:prompt:manage | | | | | ✓ | | | | | | | ✓ |
| ai:model:configure | | | | | | | | | | | | ✓ |
| ai:budget:read | | | | | ✓ | | | | | ✓ | | ✓ |
| ai:eval:run | | | | | | | | | | | | ✓ |
| audit:log:read | | | | | | | | | ✓ | | ✓ | ✓ |
| ops:manage | | | | | | | | | | | | ✓ |
| saas:manage | | | | | | | | | | | | ✓ |

**Tổng số quyền mỗi role:** ST=4 · PA=4 · TE=17 · HR=8 · SL=12 · CO=4 · CA=4 · CR=4 · CM=6 · LE=3 · DPO=4 · AD=48 → **118 grants**.

---

## 4. Đang enforce ở đâu (mapping code → permission)

| Điểm enforce | File | Kiểm tra |
|---|---|---|
| Bắt đầu học (diagnose) | `supabase/functions/diagnose` | JWT + `learn:tutor:chat` + **consent active** |
| Mỗi lượt chat | `supabase/functions/chat-turn` | JWT + (chủ phiên **hoặc** `learn:session:read_scope`) |
| Kết phiên | `supabase/functions/end-session` | JWT + (chủ phiên **hoặc** `learn:session:read_scope`) |
| Dashboard GV | `supabase/functions/teacher-stats` | JWT + (`report:class:read` **hoặc** `content:review:approve`) |
| Duyệt/thu hồi nội dung | `supabase/functions/teacher-review` | JWT + `content:review:approve` (+ audit) |
| Đọc `audit_logs` | `rbac-rls.sql` (RLS) | `has_perm('audit:log:read')` |
| Bảng RBAC, profiles, learning… | `rls.sql` + `rbac-rls.sql` | RLS theo `tenant_id` + nhóm (student/staff) |

---

## 5. Khoảng trống & rủi ro cần rà (trung thực)

1. **Scope chưa enforce theo lớp/môn.** `learn:session:read_scope` hiện cho GV xem **mọi** phiên trong tenant (chưa lọc theo `teacher_assignments`). → M5: thêm `in_scope()` dùng `teacher_assignments` để GV chỉ thấy HS lớp/môn mình.
2. **Đa số permission là catalog, chưa có endpoint enforce:** toàn bộ `config:*`, `assess:summative:grade`, `intervene:*`, `live:*`, `safety:flag:*`, `privacy:dsar/dpia`, `ai:*`, `ops:*`, `saas:*`, `iam:*`, `org:*` — chưa có chức năng tương ứng (sẽ thêm dần).
3. **`profiles.role` là enum 5 giá trị** → 8 role mở rộng chưa gán được cho user thật cho tới khi đổi sang text/`user_roles`.
4. **RLS phần lớn vẫn theo nhóm `is_staff()`** (rls.sql v1), mới có `audit_logs` chuyển sang `has_perm`. Cần chuyển dần các bảng nhạy cảm sang `has_perm` + scope.
5. **Một người = một role** (qua `profiles.role`). Đa vai trò (vd GV kiêm tổ trưởng) cần dùng `user_roles` (bảng đã có, chưa nối vào `has_perm`).
6. **Separation of Duties chưa cưỡng chế bằng máy:** `content_author` về lý thuyết không được duyệt bài mình soạn, nhưng chưa có ràng buộc "không tự duyệt" trong code (mới ở mức gán role khác nhau).
7. **Parent**: đã chặn (không có quyền learn:*), chỉ `report:parent:read` + consent — nhưng endpoint báo cáo PH chưa xây.

---

## 6. Checklist rà soát (đề xuất tick khi review)

- [ ] Mỗi role có đúng tập quyền tối thiểu cần thiết (least privilege)?
- [ ] `parent` tuyệt đối không có `learn:*`, `content:*`, `safety:*`? (hiện: đúng)
- [ ] `safety:flag:verify/resolve` chỉ `counselor` (+admin)? (hiện: đúng)
- [ ] `assess:summative:grade` chỉ `teacher` (+admin)? (hiện: đúng)
- [ ] `dpo` không có quyền nội dung/học tập, chỉ governance? (hiện: đúng)
- [ ] `leadership` chỉ đọc tổng hợp, không có quyền sửa dữ liệu HS? (hiện: đúng — chỉ report:*read + ai:budget:read)
- [ ] `content:review:approve` không nằm ở `content_author`? (hiện: đúng — author không có approve)
- [ ] `admin` = toàn quyền có chấp nhận được, hay cần tách `system_admin` ≠ `dpo`? (hiện: admin có cả `privacy:*` + `audit` — cân nhắc tách)
- [ ] Có cần thêm role/permission nào (vd `exam_proctor`, `nurse`, `librarian`)?
- [ ] Quy tắc scope (GV chỉ thấy lớp mình) — duyệt thiết kế `teacher_assignments` ở M5.

---

*Sinh tự động từ DB ngày rà soát. Sửa quyền: cập nhật `GRANTS` trong `packages/db/src/seed-rbac.ts` → `pnpm --filter @tutor/db seed:rbac` → xuất lại tài liệu này.*
