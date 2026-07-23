# ĐỐI ỨNG TỪ ĐỘI TUTOR — Hợp đồng RE-KEY ID
*(Đội Tutor → đội Studio · 2026-07-23)*

Đã **audit toàn bộ code runtime** trước khi xác nhận. Kết luận: **engine JOIN theo khoá là agnostic** như các anh ghi — nhưng có **1 điểm hợp đồng chưa nhắc tới** (thứ tự bài) cần chốt, cùng 1 chỉnh nhỏ UI. Chi tiết + trả lời Mục 6 bên dưới.

---

## A. Kết quả audit code Tutor (đối chiếu Mục 2)

| Vùng code | Kết luận | Việc |
|---|---|---|
| `chat-turn`, `diagnose`, `guide`, `dashboard`, `scoreboard`, `teacher-stats`, `admin-roster`, `evaluate-*` | ✅ **Agnostic** — chỉ JOIN/so bằng `node_key`/`question_key`, KHÔNG parse môn/chương từ key | Không đổi |
| `import-kg`, `import-questions`, importer môn mới (Đợt D) | ✅ Agnostic — upsert theo key, lấy `subject`/`chapter` từ **cột/bundle** (không từ key) | Nhận KC/Q- được ngay |
| Grouping chương ở lộ trình (`LearningPath.tsx`) | ✅ Gom chặng theo **cột `kg_nodes.chapter`**, không parse key | Không đổi |
| **`learning-path` — hàm `tiebreak` (thứ tự bài)** | ⚠️ **CÓ phụ thuộc key** — xem mục B | Cần chốt tín hiệu thứ tự |
| UI admin/nội dung (`RoleViews.tsx`) hiển thị `q.key`/`f.key` | 🔸 Đang show mã atom cho vai content/DPO/subject-lead | Sau re-key show KC/Q- (chấp nhận được theo Mục 2.2); Tutor sẽ ghép kèm `label` cho dễ đọc |

## B. ⚠️ ĐIỂM HỢP ĐỒNG CHƯA NHẮC — THỨ TỰ BÀI (quan trọng)

Engine JOIN thì agnostic, **nhưng lộ trình học dựa vào TÍNH THỨ TỰ của key**:
- `learning-path` xếp bài bằng **topo-sort trên `prerequisite_hard`**; khi tô-pô **không quyết định được** (nhiều bài "sẵn sàng" cùng lúc, hoặc bài không có cạnh), nó **tiebreak bằng `node_key`**.
- Hiện `node_key` = mã atom **đệm 0** (`TO10-C01`…`C09`, `A01`…`B08`) → tiebreak ra **đúng thứ tự chương I<II<…<IX và đúng thứ tự bài trong chương**.
- **Không thể thay bằng cột `chapter`** vì nó là nhãn La Mã (`"Chương IX. …"`) — so chuỗi ra **SAI** (IX < V).
- ⇒ Khi `node_key` thành **`KC-` ngẫu nhiên vô nghĩa**, tiebreak mất tín hiệu → **thứ tự bài/chương bị xáo** ở mọi chỗ cạnh tiên quyết không phủ kín (Toán 10: 259 cạnh / 204 node — KHÔNG phải thứ tự toàn phần → ảnh hưởng thật).

**Đây KHÔNG phải lỗi engine — mà là mất một tín hiệu dữ liệu.** Tutor cần Studio cấp **một tín hiệu thứ tự tường minh** (chọn 1):
1. **(Khuyến nghị)** Giữ `kc_registry.vi_tri_trong_ct` (mã vị trí cũ, đệm 0) **truy vấn được** → Tutor cho `learning-path` tiebreak theo `vi_tri_trong_ct` thay vì `node_key`. Rẻ nhất, dùng lại thứ tự cũ đã đúng.
2. Hoặc thêm cột số thứ tự/`kg_nodes`: `chapter_no` (int) + `node_no` (int) — Tutor sort theo (chapter_no, node_no).
3. Hoặc thêm `seq` (int) toàn cục/môn.

Chốt phương án nào, **Tutor sửa `tiebreak` (~10 dòng) trong cửa sổ bảo trì P4** — đã biết chính xác chỗ sửa. Nếu không cấp tín hiệu, lộ trình sau re-key sẽ xáo thứ tự.

## C. Trả lời Mục 6 — Xác nhận từ Tutor

**1. Đồng ý re-key sang KC/Q/E/R/L, bỏ giả định key = mã atom?**
→ **ĐỒNG Ý.** Audit xác nhận engine coi key là chuỗi mờ; chỉ cần Studio cấp **tín hiệu thứ tự** ở mục B. UI admin sẽ show KC/Q- (kèm label).

**2. Cửa sổ bảo trì đồng bộ P3 ↔ P4:**
→ Đồng ý làm **P3 (Studio đổi DB) và P4 (Tutor sửa code + deploy) trong CÙNG cửa sổ**, khoá đăng nhập ~30–60'. Lưu ý bối cảnh: **web Tutor chưa đẩy production** (đang chạy edge functions live + web qua tunnel dev) → P4 phía Tutor chủ yếu là **deploy lại edge functions** (đặc biệt `learning-path` sau khi có tín hiệu thứ tự) — nhanh. Đề xuất khung **ngoài giờ học (tối muộn/cuối tuần)**; Studio chốt ngày giờ cụ thể + gửi `id_map` trước ≥1 ngày để Tutor rà.

**3. Ai remap dữ liệu học sinh?**
→ **Đồng ý theo đề xuất: Studio chạy** (có service key + transaction + backup + `id_map`), **Tutor giám sát + verify**. Kế hoạch verify của Tutor (Mục 4 hợp đồng):
- Đếm dòng **trước = sau** trên: `attempts`, `mastery_evidence`, `learning_sessions`, `session_turns`, `student_node_state`, `student_xp`.
- Quét **không còn key định dạng mã atom cũ** (`^[A-Z]{2}10-C\d`) trong mọi cột `node_key`/`question_key` của bảng học sinh.
- Sinh thử 1 phiên học acc demo → kiểm render câu (`Q-…`) + node (`KC-…`) + **mastery/tiến độ acc cũ còn nguyên**.
- Kiểm `socratic_ladders.node_key` và distractor→quan niệm sai vẫn khớp thang (engine chấm live 1 câu Toán + 1 câu Anh).

## D. Về rubric / câu nghe / bundle GDKTPL (Mục 5 hợp đồng)
→ **Đồng ý cấp theo ID mới (KC/Q-)** — onboard 1 lần, khỏi đổi 2 lần. Importer Tutor **đã agnostic**, nhận `node_key`=KC / `question_key`=Q- ngay (lấy `chapter`/`subject` từ bundle, không từ key). Cụ thể vẫn theo khuôn đã chốt ở đối ứng trước:
- Bundle GDKTPL 10 (210 câu) — khuôn bundle JSON, `node_key`=KC, `question_key`=Q-.
- Rubric riêng từng câu (~340) — 3 khuôn kỹ năng Viết/Nói/Lập luận, jsonb `thang_muc` 0–3.
- Câu `nghe` kèm transcript trong `noi_dung`.

---

## ⇢ TÓM TẮT — Tutor cần Studio chốt/cấp
1. **Tín hiệu thứ tự bài** sau re-key (Mục B — khuyến nghị giữ `kc_registry.vi_tri_trong_ct` truy vấn được). **BẮT BUỘC**, nếu không lộ trình xáo.
2. **`id_map` đầy đủ** + **ngày giờ cửa sổ bảo trì** (gửi trước ≥1 ngày).
3. Xác nhận **Studio remap dữ liệu học sinh** trong transaction; Tutor verify theo kế hoạch Mục C.3.
4. (Sau re-key) đẩy bundle GDKTPL + rubric + câu nghe **theo ID mới**.

Tutor sẵn sàng: chỗ sửa duy nhất (`learning-path.tiebreak`) đã xác định, ~10 dòng, làm ngay trong cửa sổ khi có tín hiệu thứ tự.
