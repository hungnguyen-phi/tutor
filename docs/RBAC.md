# Phân quyền (RBAC) — AI Tutor Trường Việt Anh

> Thiết kế đầy đủ: **Roles · Scopes · Permissions · Ma trận gán quyền · Quy tắc đặc biệt · Kế hoạch thực thi M4**.
> Nguyên tắc: **least privilege**, phòng thủ 2 lớp (RBAC ở app + **RLS ở DB**), **separation of duties**, và tuân thủ PDPL (Luật 91/2025, NĐ 88/2026).

Hiện trạng code: `roleEnum = (student, teacher, parent, admin, leadership)` + RLS 4 nhóm (xem `packages/db/rls.sql`). Tài liệu này là bản **đầy đủ** để mở rộng ở M4.

---

## 1. Mô hình tổng thể

Quyền của một người dùng = **Role(s)** × **Scope** × **Permission**.

- **Role**: vai trò chức năng (gán cứng).
- **Scope** (kế thừa 5 tầng, tầng dưới hẹp hơn): `Tenant → Campus → Subject → Class → Student`. Một GV bộ môn chỉ thấy lớp/môn mình dạy; GVCN thấy HS lớp chủ nhiệm (đa môn); tổ trưởng thấy toàn môn trong cơ sở.
- **Permission**: `domain:resource:action` (vd `content:question:approve`).

Cơ chế: app kiểm `hasPermission(user, perm, scope)`; DB **RLS** cưỡng chế phạm vi hàng (row) — kể cả khi app sai, DB vẫn chặn. Phụ huynh **không truy cập dữ liệu thô**, chỉ báo cáo tổng hợp.

---

## 2. Danh sách Roles (đầy đủ) — map 10 persona PRD

| Mã | Role | Persona PRD | Scope mặc định | Ghi chú |
|---|---|---|---|---|
| `student` | Học sinh | Học sinh | Student (chính mình) | Chỉ dữ liệu của mình |
| `parent` | Phụ huynh / Người giám hộ | Phụ huynh | Student (con, qua `guardian_links`) | **Không** xem dữ liệu thô; chỉ báo cáo tổng hợp + consent |
| `teacher` | GV bộ môn | GV bộ môn | Class×Subject mình dạy | Soạn/tuỳ biến lớp, chấm summative, can thiệp |
| `homeroom_teacher` | GV chủ nhiệm (GVCN) | GVCN | Class chủ nhiệm (đa môn) | Nhìn toàn diện HS lớp mình, không sửa nội dung môn khác |
| `subject_lead` | Tổ trưởng chuyên môn | Tổ trưởng CM | Subject toàn cơ sở | Quản trị chất lượng môn, **duyệt nội dung** |
| `counselor` | Cố vấn tâm lý | Cố vấn tâm lý | Tenant (ngữ cảnh tối thiểu) | Chỉ thấy ngữ cảnh wellbeing cần thiết; có audit |
| `content_author` | Đội nội dung — soạn | Đội nội dung | Tenant (KG draft) | Tạo node/câu hỏi/rubric ở trạng thái `review` |
| `content_reviewer` | Đội nội dung — duyệt | Đội nội dung / GV duyệt | Subject/Tenant | **Phê duyệt** nội dung; ≠ người soạn (SoD) |
| `campus_admin` | Quản lý cơ sở | Admin (cơ sở) | Campus | Cấu hình cơ sở, người dùng trong cơ sở |
| `leadership` | Ban giám hiệu | BGH | Tenant/Campus | Dashboard toàn trường (tổng hợp), **không** sửa dữ liệu HS |
| `dpo` | Cán bộ bảo vệ dữ liệu | DPO | Tenant (governance) | Consent/DSAR/audit/DPIA; **không** xem nội dung học tập |
| `system_admin` | Admin hệ thống | Admin hệ thống | Tenant (toàn quyền kỹ thuật) | RBAC, cấu hình, vận hành; thao tác nhạy cảm cần break-glass + log |
| *(tự động)* | `service` | (n8n / Edge Functions) | Tenant | Service-role, bỏ qua RLS — chỉ tiến trình tin cậy |

> **Đa vai trò**: một người có thể giữ nhiều role (vd GV bộ môn **kiêm** tổ trưởng). Quyền = hợp (union) các role, giới hạn bởi scope.

---

## 3. Danh mục Permissions (đầy đủ, theo domain)

Ký hiệu action: `create read update delete list approve reject publish override verify resolve escalate export configure simulate grant`.

### A. Định danh & tổ chức
- `org:tenant:read|configure`
- `org:campus:create|read|update|delete`
- `org:class:create|read|update|delete`
- `iam:user:create|read|update|deactivate`
- `iam:role:grant|revoke` · `iam:permission:simulate`
- `iam:guardian_link:create|read|delete`

### B. Consent & quyền chủ thể dữ liệu (PDPL)
- `privacy:consent:read|grant|withdraw` *(rút → dừng xử lý ngay)*
- `privacy:dsar:create|read|fulfill` (truy cập/sửa/xoá)
- `privacy:retention:configure` · `privacy:anonymization:configure`
- `privacy:datacatalog:read|update` · `privacy:vendor:read|update`
- `privacy:crossborder:read` · `privacy:dpia:create|read|update`

### C. Tri thức & nội dung (KG)
- `content:kg_version:create|read|publish|archive`
- `content:node:create|read|update|delete`
- `content:question:create|read|update|delete`
- `content:ladder:create|read|update|delete`
- `content:resource:create|read|update|delete`
- `content:review_queue:read|approve|reject` *(human-in-the-loop)*
- `content:question:retire`

### D. Dạy học runtime & dữ liệu học tập
- `learn:session:start|read` · `learn:turn:read`
- `learn:attempt:read` · `learn:submission:read`
- `learn:mastery:read` · `learn:node_state:read`
- `learn:tutor:chat` *(quyền dùng Tutor)*
- `learn:exam_mode:toggle` · `learn:answer_policy:configure`

### E. Tuỳ biến & cấu hình (5 tầng)
- `config:tenant_settings:read|update` (branding, allowed_models, ai_budget, retention, cross_border)
- `config:campus:read|update` (subjects_enabled, token_quota, term_calendar)
- `config:subject:read|update` (subject_adapter, rubric_set, grading_style, automation_level)
- `config:class:read|update` (effort_gate, hint_level, custom_materials, exam_mode)
- `config:student:read|update` (explain_language, scaffolding_depth, goals)
- `config:feature_flag:read|update`

### F. Đánh giá & can thiệp
- `assess:summative:grade` *(điểm chính thức — chỉ GV)*
- `assess:rubric:feedback` *(formative — Tutor/GV, không phải điểm)*
- `intervene:plan:create|read|update` · `intervene:task:assign|complete`
- `live:classroom:run|read` (live quiz, exit ticket, misconception radar)

### G. Báo cáo & dashboard
- `report:student:read` (chi tiết 1 HS) · `report:class:read` · `report:grade:read` · `report:campus:read` · `report:school:read`
- `report:parent:read` *(bản tổng hợp cho PH)* · `report:export:pdf`

### H. An toàn & wellbeing
- `safety:flag:read` · `safety:flag:verify` *(người xác minh trước)* · `safety:flag:resolve` · `safety:flag:escalate`
- `wellbeing:context:read` *(ngữ cảnh tối thiểu, có audit)*
- *(KHÔNG có quyền “tự động đẩy cờ an toàn vào báo cáo phụ huynh” — bị cấm theo thiết kế)*

### I. Quản trị AI
- `ai:prompt_version:create|read|approve|publish|rollback`
- `ai:model_routing:read|configure` · `ai:budget:read|configure`
- `ai:eval_lab:run|read|gate` *(chặn prompt/model chưa đạt)*
- `ai:cost:read`

### J. Kiểm toán & vận hành hệ thống
- `audit:log:read|export`
- `ops:health:read` · `ops:edge_function:deploy` · `ops:secret:rotate` *(break-glass)*
- `ops:workflow:manage` (n8n)

### K. SaaS (P2)
- `saas:plan:read|update` · `saas:subscription:manage` · `saas:billing:read` · `saas:usage:read`

---

## 4. Ma trận Role × Permission (rút gọn theo domain)

Chú thích: `✓` toàn quyền · `R` chỉ đọc · `S` giới hạn theo **scope** (lớp/môn/HS phụ trách) · `A` chỉ **tổng hợp** (aggregate) · `—` không có.

| Domain (đại diện) | ST | PA | TE | HR | SL | CO | CA | CR | CM | LE | DPO | SA |
|---|--|--|--|--|--|--|--|--|--|--|--|--|
| A. org/iam | — | — | — | — | — | — | — | — | S(campus) | R | — | ✓ |
| A. guardian_link | — | R(own) | R(S) | R(S) | — | — | — | — | S | — | R | ✓ |
| B. consent/DSAR | R(own) | grant/withdraw(con) | R(S) | R(S) | — | — | — | — | R | — | ✓ | R |
| B. datacatalog/vendor/DPIA | — | — | — | — | — | — | — | — | — | R | ✓ | R |
| C. KG node/question/ladder | R(active) | — | **S create/update** | R(S) | ✓ subject | — | **create(draft)** | R | R | R | — | ✓ |
| C. review_queue (approve) | — | — | S (lớp mình) | — | **✓ approve** | — | — | **✓ approve** | R | R | — | ✓ |
| D. session/turn/attempt | R(own) | — | **S** | **S** (lớp CN) | A subject | — | — | — | A | A | — | R |
| D. tutor:chat | ✓(own) | — | — | — | — | — | — | — | — | — | — | — |
| E. config tenant/campus | — | — | — | — | — | — | — | — | S update | R | R(privacy) | ✓ |
| E. config subject | — | — | — | — | **✓** | — | — | — | R | R | — | ✓ |
| E. config class | — | — | **S** | S(CN) | R | — | — | — | R | R | — | ✓ |
| E. config student | system+ | R(con) | **S** | S | — | — | — | — | — | — | — | ✓ |
| F. summative:grade | — | — | **S** | S(CN) | R | — | — | — | — | — | — | — |
| F. intervention/live | — | — | **S** | **S** | A | R(wellbeing) | — | — | A | A | — | R |
| G. report student/class | R(own) | **A(con)** | **S** | **S** | A subject | — | — | — | A campus | **A school** | — | R |
| H. safety flag | — | — | report-only | report-only | report-only | **verify/resolve** | — | — | R | R | R | R |
| H. wellbeing:context | — | — | — | — | — | **R(min)** | — | — | — | — | — | — |
| I. prompt/model/eval/budget | — | — | — | — | R | — | — | — | R | R | — | ✓ |
| J. audit:log | — | — | — | — | — | — | — | — | R(campus) | R | **✓ read/export** | ✓ |
| J. ops (deploy/secret/n8n) | — | — | — | — | — | — | — | — | — | — | — | **✓** |
| K. SaaS/billing | — | — | — | — | — | — | — | — | R | R | — | ✓ |

> Đọc theo dòng: vd **dòng C review_queue** → chỉ `subject_lead`, `content_reviewer`, `system_admin` được `approve`; GV bộ môn chỉ duyệt trong phạm vi lớp mình; PH/HS/DPO không có.

---

## 5. Quy tắc đặc biệt (bắt buộc)

1. **Phụ huynh không bao giờ truy cập dữ liệu thô** (turns/attempts) — chỉ `report:parent:read` (đã tổng hợp). RLS deny mọi bảng learning cho role `parent`.
2. **Cờ an toàn → người xác minh trước** (`safety:flag:verify` thuộc `counselor`/`admin`); **CẤM** tự động đưa cờ nhạy cảm vào báo cáo phụ huynh (không tồn tại permission đó).
3. **Separation of Duties (SoD)** ở nội dung AI: người `content_author` **không** được `approve` chính nội dung mình tạo → bắt buộc `content_reviewer`/`subject_lead` khác duyệt. Câu tham số hoá: duyệt **khuôn** một lần (CAS tự kiểm biến thể).
4. **Điểm chính thức (summative) chỉ GV** (`assess:summative:grade`); Tutor/rubric chỉ `formative`, không gán điểm.
5. **DPO không xem nội dung học tập**; chỉ governance (consent/DSAR/audit/DPIA/vendor/cross-border).
6. **Cố vấn tâm lý** chỉ `wellbeing:context:read` mức tối thiểu, **mọi truy cập ghi `audit_logs`**.
7. **Leadership/BGH** chỉ xem **tổng hợp** (A) — không sửa dữ liệu HS, không xem hội thoại cá nhân thô.
8. **system_admin** thao tác nhạy cảm (rotate secret, deploy, impersonate) phải **break-glass** (lý do + log + cảnh báo DPO).
9. **Ẩn danh hoá trước khi gửi LLM** áp cho mọi role — không có ngoại lệ.
10. **service-role** (Edge Functions/n8n) bỏ qua RLS — tuyệt đối không expose ra client; chỉ chạy server-side.

---

## 6. Hiện trạng vs Đề xuất — gap & kế hoạch M4

**Hiện tại:** `roleEnum` 5 giá trị; RLS dùng `is_staff()` (teacher/admin/leadership) → thô. Edge functions `verify_jwt=false`, tin `studentId` từ client (chỉ cho demo).

**Đề xuất thực thi (M4):**

1. **Bảng phân quyền** (thay enum cứng):
   - `roles(id, key, label)`; `permissions(id, key)`; `role_permissions(role_id, permission_id)`.
   - `user_roles(user_id, role_id, scope_type, scope_id)` — gán role **kèm scope** (campus/subject/class).
   - `teacher_assignments(teacher_id, class_id, subject_id)` — nguồn scope cho GV.
2. **RLS helper mở rộng** (`packages/db/rls.sql`):
   - `auth.has_perm(perm text) → boolean`, `auth.in_scope(class_id|subject_id) → boolean`.
   - Thay các policy `is_staff()` bằng kiểm `has_perm` + scope (vd `learn:attempt:read` chỉ HS của GV).
3. **Bật lại `verify_jwt=true`** cho mọi edge function; **lấy `studentId`/role từ JWT (`auth.uid()`)**, không tin client. chat-turn kiểm `learn:tutor:chat` cho chính mình; teacher-* kiểm `content:*`/`report:*`.
4. **Permission Simulator** (`iam:permission:simulate`) cho admin kiểm “role X thấy gì”.
5. **Access review định kỳ** + **audit mọi truy cập nhạy cảm** (đã có `audit_logs`).
6. **Consent gate**: trước khi `learn:tutor:chat`, kiểm `consent_records.status='active'` (rút → chặn ngay).

---

## 7. Kiểm soát bổ sung (định hướng)
- Least privilege mặc định **deny**; cấp quyền tối thiểu.
- Break-glass cho thao tác đặc quyền (log + thông báo DPO).
- Tách môi trường: service-role key chỉ ở server; anon/publishable key ở client.
- Rà soát quyền theo học kỳ; thu hồi khi đổi vai trò.
- Mọi quyết định AI + truy cập dữ liệu nhạy cảm → `audit_logs` (đã có).
