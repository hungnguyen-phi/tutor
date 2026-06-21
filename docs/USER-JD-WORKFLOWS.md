# Mô tả công việc & Workflow theo vai trò — AI Tutor Việt Anh

> Mỗi vai trò: **Mô tả công việc (JD)** · **Quyền chính (RBAC)** · **Workflow** · **Đo lường (KPI)**.
> Trạng thái tính năng: **[đã có]** = đang chạy trên hệ thống · **[M5+]** = đã thiết kế, sẽ xây tiếp.
> Đọc kèm `docs/RBAC-FULL.md` (ma trận quyền). 12 vai trò.

---

## 1. Học sinh (`student`)

**Mô tả công việc:** Người học trực tiếp — tự học có dẫn dắt với gia sư AI, luyện đúng chỗ hổng, tiến bộ theo năng lực thật.
**Trách nhiệm:** học chủ động, thể hiện nỗ lực thật trước khi nhận trợ giúp; nộp bài viết/nói; ôn tập theo lịch.
**Quyền:** `learn:tutor:chat` · `learn:session:read_own` · `learn:mastery:read_own` · `privacy:consent:read`.

**Workflow:**
1. Đăng nhập → hệ thống kiểm **consent đang active** (nếu chưa có → bị chặn) **[đã có]**.
2. Chọn môn (Toán / Tiếng Anh) → `diagnose` tạo phiên + nạp câu hỏi **[đã có]**.
3. Làm bài: Toán (objective, CAS chấm) · Anh (MCQ, viết theo rubric, nói qua mic 30s) **[đã có]**.
4. Trả lời sai → **effort gate** chặn (≥2 lần) → **gợi ý Socratic** từng bậc, không lộ đáp án **[đã có]**.
5. Kết phiên → tính **mastery** + đặt lịch **Leitner** (ôn lại sau 1 ngày) **[đã có]**.
6. Ôn tập thẻ đến hạn (spaced repetition) **[M5]**; xem "bảng tiến bộ cá nhân" **[M5]**.

**KPI:** mastery growth · misconception resolved · self-explanation rate · hint usage giảm dần · streak ôn tập.

---

## 2. Phụ huynh (`parent`)

**Mô tả công việc:** Đồng hành cùng con — hiểu tiến bộ và biết cách hỗ trợ tại nhà; là người cho/rút đồng ý xử lý dữ liệu của con.
**Trách nhiệm:** quản lý consent; đọc báo cáo; áp dụng gợi ý hỗ trợ con. **Không** truy cập dữ liệu thô.
**Quyền:** `report:parent:read` · `privacy:consent:read` · `privacy:consent:grant` · `privacy:consent:withdraw`.

**Workflow:**
1. Đăng nhập → trang phụ huynh **[M5]**.
2. **Cấp/rút đồng ý kép** (đồng thuận cùng con ≥7 tuổi); rút → hệ thống dừng xử lý ngay **[đã có ở DB/gate; UI M5]**.
3. Xem **báo cáo tổng hợp** hằng tuần: tích cực-là-chính + vùng cần hỗ trợ; **ẩn cờ nhạy cảm** **[M5/M6]**.
4. Nhận **micro-coaching**: 10 phút/ngày làm gì với con, câu nên hỏi **[M6]**.
5. Nhận báo cáo qua Zalo OA (template đã duyệt, opt-in) **[M6]**.

**KPI:** report open/click · parent NPS · tỉ lệ hoàn thành hỗ trợ tại nhà.

---

## 3. Giáo viên bộ môn (`teacher`)

**Mô tả công việc:** Người dạy & tuỳ biến — dùng AI làm trợ lý: thấy lớp hổng ở đâu, soạn/duyệt nội dung môn, chấm điểm chính thức, can thiệp đúng HS.
**Trách nhiệm:** đảm bảo nội dung phục vụ HS đã đúng & được duyệt; chấm summative; theo dõi & can thiệp; tuỳ biến lớp.
**Quyền (17):** content:kg/question/node/ladder:read+write, `content:review:approve`; learn:session/mastery/attempt:read_scope; config:class/student:update; `assess:summative:grade`; `intervene:manage`; `live:classroom:run`; report:student/class:read; `safety:flag:read`.

**Workflow:**
1. Đăng nhập → **Bảng điều khiển GV** (`/teacher`): 3 chỉ số **misconception / effort / mastery** của lớp **[đã có]**.
2. **Duyệt nội dung seed/AI-sinh** trong review queue → `active`/thu hồi **[đã có]**.
3. Soạn/sửa câu hỏi, distractor (gắn quan niệm sai), socratic ladder, rubric **[content write đã có ở DB; UI soạn M5]**.
4. Tuỳ biến lớp: effort_gate, hint_level, exam_mode, tài liệu riêng **[config DB có; UI M5]**.
5. Xem chi tiết HS lớp/môn mình → quyết **can thiệp** (kế hoạch 2–4 tuần có SLA) **[M6]**.
6. **Live Classroom**: live quiz, exit ticket, misconception radar trong tiết **[M6]**.
7. Chấm **summative** (điểm chính thức — chỉ GV; AI chỉ formative) **[M6]**.
8. Thấy cờ an toàn ở mức *read* → chuyển cố vấn tâm lý xác minh (không tự báo PH) **[M6]**.

**KPI:** copilot usage · time saved · override rate · % HS cải thiện sau can thiệp · exit ticket pass rate.

---

## 4. Giáo viên chủ nhiệm (`homeroom_teacher`)

**Mô tả công việc:** Người nắm toàn diện HS lớp mình (đa môn) — phát hiện sớm em nào đang tụt và vì sao, điều phối can thiệp & phối hợp phụ huynh/cố vấn.
**Trách nhiệm:** theo dõi tổng thể lớp chủ nhiệm; khởi tạo can thiệp; phối hợp; **không** sửa nội dung môn không dạy.
**Quyền (8):** learn:session/mastery/attempt:read_scope; `intervene:manage`; report:student/class:read; `safety:flag:read`; `config:student:update`.

**Workflow:**
1. Đăng nhập → màn lớp chủ nhiệm: heatmap đa môn, danh sách HS cần chú ý **[M5]**.
2. Soi 1 HS: tiến độ các môn, lý do tụt (misconception/effort) **[đã có dữ liệu; màn GVCN M5]**.
3. Lập **kế hoạch can thiệp**, giao việc, theo SLA **[M6]**.
4. Phối hợp **cố vấn tâm lý** khi có cờ wellbeing (chỉ chuyển, không tự quyết) **[M6]**.
5. Cập nhật cấu hình cá nhân hoá HS (scaffolding_depth, ngôn ngữ) **[config có; UI M5]**.

**KPI:** % HS lớp on-track · thời gian phát hiện-tới-can thiệp · escalation rate.

---

## 5. Tổ trưởng chuyên môn (`subject_lead`)

**Mô tả công việc:** Quản trị chất lượng môn bằng dữ liệu — chuẩn hoá & **duyệt nội dung** môn, cấu hình cách dạy-chấm của môn, quản system prompt/AI cho môn.
**Trách nhiệm:** chất lượng KG & ngân hàng câu hỏi của môn; duyệt/đào thải câu; cấu hình subject adapter.
**Quyền (12):** content:kg/question/node/ladder + `content:review:approve` + `content:question:retire`; `config:subject:update`; `learn:mastery:read_scope`; `report:class:read`; `ai:prompt:manage`; `ai:budget:read`.

**Workflow:**
1. Xem chất lượng môn: node nào cả khối sai nhiều, p_value/discrimination câu hỏi **[stats có; màn tổng hợp M5]**.
2. **Duyệt/đào thải** câu hỏi (retire câu kém), duyệt khuôn câu tham số hoá một lần **[approve/retire đã có]**.
3. Cấu hình **subject adapter**: rubric_set, grading_style, automation_level **[config DB; UI M5]**.
4. Quản **system prompt** của môn: version draft→review→approved→published, rollback, A/B **[M5/M6]**.
5. Theo dõi **ngân sách AI** của môn (`ai:budget:read`) **[M6]**.

**KPI:** % nội dung đã duyệt · tỉ lệ câu retired · mastery trung bình môn · chi phí AI/HS môn.

---

## 6. Cố vấn tâm lý (`counselor`)

**Mô tả công việc:** Người xử lý tín hiệu an toàn/wellbeing — **xác minh trước, hành động sau**; chỉ thấy ngữ cảnh tối thiểu, mọi truy cập có audit.
**Trách nhiệm:** tiếp nhận & xác minh cờ nhạy cảm; quyết hướng xử lý; bảo mật.
**Quyền (4):** `safety:flag:read` · `safety:flag:verify` · `safety:flag:resolve` · `wellbeing:context:read`.

**Workflow:**
1. Nhận cờ KHẨN CẤP (bắt nạt/tổn thương/tự hại) do hệ thống gắn **[M6]**.
2. **Xác minh** (verify) bằng ngữ cảnh tối thiểu — KHÔNG tự động báo phụ huynh **[M6]**.
3. **Xử lý** (resolve): kết nối nguồn lực, ghi nhận; phối hợp GVCN/admin **[M6]**.
4. Mọi bước ghi `audit_logs`; AI không tự chẩn đoán tâm lý **[nguyên tắc bất biến]**.

**KPI:** thời gian xác minh · % cờ được xử lý đúng quy trình · sự cố an toàn.

---

## 7. Đội nội dung — soạn (`content_author`)

**Mô tả công việc:** Sản xuất học liệu — soạn node/câu hỏi/rubric/ladder ở **trạng thái nháp**; **không** tự duyệt (Separation of Duties).
**Trách nhiệm:** chất lượng bản nháp; gắn cờ "AI sinh" nếu dùng Content Factory; đẩy review_queue.
**Quyền (4):** `content:kg:read` · `content:node:write` · `content:question:write` · `content:ladder:write`.

**Workflow:**
1. Soạn node/câu hỏi/distractor (gắn quan niệm sai)/rubric/ladder ở trạng thái `review` **[content write có; UI soạn M5]**.
2. (Nếu AI-sinh hàng loạt qua **Content Factory**) gắn cờ "AI sinh" + đẩy `review_queue` **[M6]**.
3. Câu tham số hoá: CAS tự kiểm biến thể, chỉ cần duyệt khuôn **[CAS có]**.
4. Chuyển cho `content_reviewer`/`subject_lead` duyệt (không tự duyệt).

**KPI:** số học liệu/tuần · tỉ lệ qua duyệt lần đầu · chất lượng (p_value sau triển khai).

---

## 8. Đội nội dung — duyệt (`content_reviewer`)

**Mô tả công việc:** Cổng human-in-the-loop — kiểm duyệt mọi nội dung trước khi phục vụ HS; đào thải câu kém.
**Trách nhiệm:** đảm bảo đúng đắn sư phạm & an toàn lứa tuổi trước khi `active`.
**Quyền (4):** `content:kg:read` · `content:question:read` · `content:review:approve` · `content:question:retire`.

**Workflow:**
1. Mở **review queue** → xem nội dung trạng thái `review` **[đã có]**.
2. **Duyệt** (`active`) hoặc trả lại/đào thải (`retired`) — ghi audit **[đã có]**.
3. Ưu tiên kiểm: distractor gắn đúng quan niệm sai, DOK tách độ khó, đáp án/CAS đúng.

**KPI:** SLA duyệt · tỉ lệ trả lại · số câu retired.

---

## 9. Quản lý cơ sở (`campus_admin`)

**Mô tả công việc:** Vận hành 1 cơ sở — quản người dùng, lớp, cấu hình cơ sở; theo dõi dashboard & audit cấp cơ sở.
**Trách nhiệm:** đúng người-đúng lớp; cấu hình term/quota; tuân thủ ở cơ sở.
**Quyền (6):** `org:campus:manage` · `org:class:manage` · `iam:user:manage` · `config:tenant:update` · `report:school:read` · `audit:log:read`.

**Workflow:**
1. Tạo/sửa **lớp, năm học**, gán GV-lớp-môn (`teacher_assignments`) **[bảng có; UI M5]**.
2. Quản **người dùng** trong cơ sở (mời/khoá, gán vai trò) **[M5]**.
3. Cấu hình cơ sở: subjects_enabled, token_quota, term_calendar **[config có; UI M5]**.
4. Xem **dashboard cơ sở** + `audit_logs` cấp cơ sở **[stats có; audit RLS đã gate]**.

**KPI:** tỉ lệ GV onboarded · uptime/sự cố cơ sở · usage vs quota.

---

## 10. Ban giám hiệu (`leadership`)

**Mô tả công việc:** Điều hành chất lượng real-time — nhìn bức tranh toàn trường (tổng hợp), không can thiệp dữ liệu HS.
**Trách nhiệm:** ra quyết định bằng dữ liệu; giám sát chi phí AI; **chỉ đọc tổng hợp**.
**Quyền (3):** `report:school:read` · `report:class:read` · `ai:budget:read`.

**Workflow:**
1. Mở **dashboard toàn trường** theo lớp/khối/môn/cơ sở (chỉ số tổng hợp) **[portal lãnh đạo M6]**.
2. Theo dõi pacing/coverage, exam readiness, gap closure **[M6]**.
3. Xem **chi phí AI/HS**, latency, uptime **[M6]**.
4. **Không** xem hội thoại/dữ liệu thô của HS (chỉ aggregate).

**KPI:** standards coverage · pacing on-track % · AI cost/student · tenant health.

---

## 11. Cán bộ bảo vệ dữ liệu — DPO (`dpo`)

**Mô tả công việc:** Tuân thủ PDPL — quản consent, DSAR, DPIA, audit, vendor/cross-border. **Không** xem nội dung học tập.
**Trách nhiệm:** đảm bảo Luật 91/2025 + NĐ 88/2026; xử lý yêu cầu chủ thể dữ liệu; đánh giá rủi ro.
**Quyền (4):** `privacy:consent:read` · `privacy:dsar:fulfill` · `privacy:dpia:manage` · `audit:log:read`.

**Workflow:**
1. Theo dõi **consent matrix** (đồng thuận kép, rút→dừng) **[DB/gate có; bảng DPO M6]**.
2. Xử lý **DSAR** (truy cập/sửa/xoá dữ liệu) **[M6]**.
3. Lập/cập nhật **DPIA**, vendor risk register, cross-border log **[M6]**.
4. Đọc `audit_logs` (mọi truy cập nhạy cảm + quyết định AI) **[RLS đã gate]**.

**KPI:** SLA xử lý DSAR · % consent hợp lệ · số phát hiện rủi ro/đã khắc phục.

---

## 12. Admin hệ thống (`admin`)

**Mô tả công việc:** Vận hành kỹ thuật & quản trị toàn quyền — RBAC, cấu hình, deploy, secrets, feature flags, observability.
**Trách nhiệm:** ổn định hệ thống; kiểm soát chi phí; bảo mật; thao tác đặc quyền có break-glass + log.
**Quyền (48):** toàn bộ.

**Workflow:**
1. Quản **RBAC**: gán vai trò, mô phỏng quyền (permission simulator) **[catalog có; iam UI M5]**.
2. Cấu hình tenant/feature flags; quản **LLM gateway** (provider/model/budget) **[gateway có; UI M6]**.
3. Vận hành: deploy Edge Functions, n8n workflows, **rotate secrets** (break-glass) **[ops đã làm thủ công]**.
4. Giám sát: logs, metrics, cost meter, `audit_logs`.
5. AI Evaluation Lab: chặn prompt/model chưa đạt trước khi publish **[M6]**.

**KPI:** uptime · error rate · AI cost kiểm soát (<$500/th MVP) · review SLA · sự cố bảo mật.

---

## Phụ lục — Tách nhiệm vụ (Separation of Duties) cần lưu khi vận hành
- **Soạn ≠ Duyệt**: `content_author` không có `content:review:approve` (phải `content_reviewer`/`subject_lead`).
- **Dạy ≠ Tư vấn an toàn**: GV chỉ `safety:flag:read`; `verify/resolve` thuộc `counselor`.
- **Điểm chính thức ≠ AI**: chỉ `teacher` có `assess:summative:grade`; AI chỉ formative.
- **Vận hành ≠ Bảo vệ dữ liệu**: cân nhắc tách `admin` (system_admin) khỏi `dpo` (hiện `admin` đang ôm cả `privacy:*`+`audit`).
- **Phụ huynh & Lãnh đạo**: không có quyền dữ liệu thô — chỉ tổng hợp/báo cáo.
