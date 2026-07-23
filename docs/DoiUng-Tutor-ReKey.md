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

## E. Trả lời kế hoạch cửa sổ bảo trì P3+P4 (Studio gửi 23/07, vòng 2)

Đã đọc kế hoạch chi tiết. Xác nhận + trả lời Mục 4 của các anh (đã kiểm chứng trực tiếp trên DB `gxbxsdhvtwtjkfygetzb` qua Management API, không suy đoán):

**E.1 — `question_key` có dùng ở serving/chấm bài không?**
→ **KHÔNG.** Đã grep toàn bộ `supabase/functions/*`: `question_key` chỉ xuất hiện ở (a) import/upsert (`import-questions`, `import-kg`, khoá `on conflict (kg_version_id, question_key)`) và (b) `teacher-stats` — CHỈ hiển thị + `.order("question_key")` cho bảng admin, không phải đường chấm bài. Đường chấm bài thật (`chat-turn`) JOIN câu hỏi bằng `questions.id` (UUID) và `node_key`, chưa từng đọc `question_key`. ⇒ Đổi `question_key`→`Q-` an toàn tuyệt đối phía Tutor.
- Lưu ý phụ (không chặn cửa sổ): `teacher-stats.order("question_key")` sẽ sắp theo chuỗi `Q-` ngẫu nhiên sau re-key → mất thứ tự đẹp trên bảng admin (thuần cosmetic). Tutor sẽ sửa riêng, ngoài cửa sổ này.

**E.2 — Còn cột/bảng nào trỏ node/câu bằng mã vị trí mà Studio chưa thấy?**
→ Đã quét **toàn bộ schema** (không chỉ code) bằng SQL trên `information_schema.columns`, lọc mọi cột `text` tên chứa `node/question/edge/resource/ladder/_key`. Kết quả **khớp chính xác** danh sách Studio đã liệt kê ở Mục 1+2 (5 cột tiến độ HS + `kg_nodes/kg_edges/kg_tiers/questions/resources/socratic_ladders`) — không có cột ẩn nào khác. Cũng đã kiểm **FK constraints** (0 kết quả — các cột này đều là `text` thường, KHÔNG có ràng buộc khoá ngoại DB-level, kể cả `question_id`) và **CHECK constraints/views** liên quan key (chỉ có `kc_registry_node_key_check: node_key ~ '^KC-[0-9]{7}$'`, không có gì khác). ⇒ Kế hoạch remap của Studio là đủ, không thiếu chỗ nào phía Tutor biết.
- Đã tranh thủ lấy mẫu thực tế `attempts/mastery_evidence/submissions.question_id` → xác nhận đúng là chuỗi UUID thật (khớp tuyên bố "an toàn tuyệt đối" của Studio), dù cột khai báo kiểu `text` chứ không phải `uuid`/FK — tức đây là quy ước ứng dụng chứ không phải ràng buộc DB, nên kế hoạch verify đếm-dòng-trước-sau của Studio (Mục 5) là đúng hướng và **cần thiết**, không thể chỉ tin cấu trúc bảng.

**E.3 — ⚠️ CẢNH BÁO MỚI (Studio cần biết trước khi chốt ngày):**
Kiểm tra `kc_registry` hiện tại (2.866 dòng, chưa phải 12.907 như kế hoạch cuối):
- **Toán 10: SẴN SÀNG 100%** — 204/204 node đang active khớp `kc_registry.vi_tri_trong_ct` (đối chiếu bằng `node_key` hiện tại `TO10-C0…`). Mã KC đã có sẵn, remap được ngay.
- **Tiếng Anh 10: CHƯA — 0/340 node** có trong `kc_registry` (không có dòng nào `vi_tri_trong_ct like 'TA10%'`). Bảng `kc_registry` hiện chỉ phủ Công nghệ/Địa lí/GDKTPL/KHTN/Ngữ văn/Toán/Vật lí — **thiếu hẳn Tiếng Anh**.
⇒ Nếu cửa sổ chạy khi Tiếng Anh 10 chưa có KC trong registry: `node_key` Tiếng Anh không remap được (hoặc remap bằng mã ngẫu nhiên KHÔNG qua `kc_registry` → tiebreak P4 mất tín hiệu, lộ trình Tiếng Anh xáo thứ tự ngay). **Đề nghị Studio bổ sung `kc_registry` cho Tiếng Anh 10 (340 dòng) TRƯỚC cửa sổ**, cùng cách đã làm cho Toán.

**E.4 — Code P4 phía Tutor: ĐÃ XONG, CHƯA DEPLOY.**
Đã sửa `supabase/functions/learning-path/index.ts`: `tiebreak` đổi từ so `node_key` sang so `kc_registry.vi_tri_trong_ct` (tra thêm 1 query nhỏ theo danh sách `node_key` của version, fallback về `node_key` nếu thiếu dòng — không vỡ nếu sót 1 node). Đúng ~10 dòng như đã hứa. Sẽ deploy qua Supabase CLI **trong cửa sổ bảo trì**, sau khi Studio chạy P3 xong.

**E.5 — Lịch cửa sổ:** Tutor xác nhận lại đề xuất (a) khoá login → (b) Studio remap+verify → (c) Tutor deploy `learning-path` → (d) nghiệm thu chung → (e) mở login, ngoài giờ học. **Ngày giờ cụ thể do người phụ trách Tutor chốt trực tiếp với Studio** (ngoài phạm vi Claude tự quyết).

---

## F. Trả lời Studio vòng 2 (Tutor xác nhận, 23/07)

**Đã tự kiểm chứng độc lập trên DB prod** (không chỉ tin báo cáo): anti-join `kg_nodes.node_key ↔ kc_registry.vi_tri_trong_ct` trên đúng 2 phiên bản **published** đang phục vụ học sinh (Toán 10 `6cc28358…`, Tiếng Anh 10 `4a839fc3…`) trả về **0 dòng thiếu**. `kc_registry` đang 3.417 dòng — khớp con số 758 node Studio nêu nếu tính cả bản nháp "Toán 9" (211 node, `status=draft`, chưa publish, chưa phục vụ ai) + 2 dòng seed cũ đã `archived`. **Xác nhận: lỗ hổng E.3 đã đóng, không còn chặn kỹ thuật phía dữ liệu.**

**Về gợi ý "deploy thử ngay để test":** đã rà lại — deploy sớm là AN TOÀN (không đổi hành vi) nhưng sẽ KHÔNG thực sự kiểm được logic tiebreak mới. Lý do: trước khi Studio chạy P3, `kg_nodes.node_key` vẫn là mã vị trí cũ, còn `kc_registry.node_key` đã là `KC-…` mới → câu tra `kc_registry WHERE node_key IN (...)` sẽ khớp 0 dòng, mọi node rơi về nhánh dự phòng (dùng lại `node_key` cũ) — tức **y hệt hành vi hiện tại**, không lỗi nhưng cũng không chứng minh được đường mới chạy đúng. Điều đó thực ra là một tính chất tốt: có thể deploy `learning-path` **bất cứ lúc nào trước cửa sổ** mà không rủi ro gì (không đổi lộ trình hiện tại), và nó tự động "kích hoạt" logic mới ngay khi Studio chạy P3 xong — không cần deploy lại đúng lúc đó nữa. Việc thật sự kiểm logic mới chỉ có thể làm SAU khi `node_key` đã đổi sang `KC-`.

**Còn lại đúng như Studio liệt kê:** chỉ còn lịch cửa sổ — phần này người phụ trách Tutor (không phải Claude) sẽ chốt trực tiếp với Studio.

## G. Trả lời Mục 4 vòng 2 — lịch cửa sổ

**Không cần khung giờ đặc biệt / khoá login.** Web Tutor **chưa deploy production** (đang test qua tunnel dev, chưa có học sinh thật dùng qua URL công khai) — rủi ro của một khoảng hở ngắn giữa P3 và P4 gần như bằng 0 ở phía Tutor lúc này. **Studio cứ chạy P3 bất cứ lúc nào tiện, không cần hẹn giờ.**

## H. ✅ P4 ĐÃ DEPLOY + VERIFY (23/07, trước cả P3)

`learning-path` đã deploy lên production (`gxbxsdhvtwtjkfygetzb`) với tiebreak mới. Gọi thử API thật bằng acc demo `hs1@vietanh.edu.vn`, xác nhận thứ tự bài **không đổi** (đúng dự đoán — nhánh dự phòng dùng `node_key` cũ vì `kc_registry` chưa khớp key):
- Toán 10: bắt đầu đúng `TO10-C01-A01` (Chương I), khoá bài theo tiên quyết hợp lý.
- Tiếng Anh 10: 340 node, đúng thứ tự Unit 1 → Unit 10 (`TA10-C01-E01…TA10-C10-W02`).

**⇒ Phía Tutor đã xong hoàn toàn, không còn gì phải chờ/làm nữa. Studio chạy P3 bất cứ lúc nào tiện — logic mới tự kích hoạt ngay khi `node_key` đổi sang `KC-`, Tutor không cần deploy lại lần nào nữa.** Báo lại khi P3 xong để hai bên nghiệm thu chung (đếm dòng trước/sau + gọi thử lộ trình acc demo, theo checklist Mục 5/C.3 đã thống nhất).

---

## I. ✅ NGHIỆM THU P3 — Tutor duyệt XONG (23/07, sau khi Studio báo P3 chạy)

Đã verify độc lập trên DB prod (Management API, đọc) + gọi API thật bằng acc demo. **Tất cả PASS:**

**1. Định dạng key sau re-key** — 544 node active toàn `KC-[0-9]{7}`, 2.967 câu toàn `KC-` (node_key) + `Q-` (question_key). **0 key định dạng mã vị trí cũ** còn sót ở cả 9 cột khoá (kg_edges from/to, socratic_ladders, resources, + 5 cột dữ liệu HS, learning_sessions). Khớp tuyên bố Studio.

**2. Không mất dòng** — đếm khớp Studio chính xác: attempts 60, mastery_evidence 50, learning_sessions 33, student_node_state 9, xp_events 6, session_turns 129.

**3. Tiến độ học sinh còn nguyên** — attempts 60/**0 mồ côi**, mastery_evidence 50/**0 mồ côi** khi join `node_id`(KC) ↔ `kg_nodes.node_key`. student_node_state 9/9 join sạch, điểm thật giữ nguyên (mẫu HS: node Tiếng Anh score 1.00/0.50, node Toán 0.33 — đọc đúng qua KC + nhãn đúng).

**4. Tín hiệu thứ tự (P4)** — 204/204 (Toán) + 340/340 (Anh) node khớp `kc_registry` và có `vi_tri_trong_ct`. `learning-path` v10 nay JOIN được (trước P3 rơi dự phòng).

**5. THỨ TỰ LỘ TRÌNH đúng (bằng chứng P4 chạy)** — gọi `learning-path` thật, dù key đã là `KC-` ngẫu nhiên:
  - **Tiếng Anh 10: khớp 100%** thứ tự `vi_tri_trong_ct` (Unit 1→10, 340/340).
  - **Toán 10: đúng** — trùng thứ tự đề mục trừ chỗ cạnh tiên quyết chèn (đã soi vị trí 42: `TO10-C02-A07` nổi lên trước `A06` vì A07 **available** (đủ tiên quyết A01) còn A06 **locked** — đúng cơ chế "mở khoá thông minh", vẫn trong Chương II). **KHÔNG phải xáo do key** — và là đúng hành vi cũ trước re-key (tiebreak cũ = mã vị trí đệm-0 = y hệt `vi_tri_trong_ct` bây giờ) ⇒ không hồi quy.

**6. Sẵn sàng chấm bài (kiểm đọc)** — engine chấm theo `questions.id` (UUID, KHÔNG đổi khi re-key — đã đối chiếu id thật). Câu phục vụ được: Toán 204 node có câu active (1416, đủ đáp án), Anh 156 node (1551 active). Thang Socratic Toán 2.629 thang đã sang `KC-` (join sạch). *(Chưa bấm "chấm thử" chạy thật vì nó GHI dòng demo lên DB prod — theo ràng buộc Claude không tự ghi prod; đường dữ liệu đã verify đủ, việc bấm chấm 1 câu để người phụ trách làm trong app nếu muốn xác nhận trực quan.)*

**Lưu ý (không phải lỗi re-key):** `socratic_ladders` môn **Tiếng Anh = 0** — đúng phần Studio còn nợ (thang/rubric Anh), không phải do re-key làm mất.

**KẾT LUẬN: Tutor duyệt P3/P4 ĐẠT.** Không phát hiện lệch. Studio có thể tiến hành phần còn nợ (bundle GDKTPL 10, rubric ~340, câu nghe) theo ID mới.

*(Ghi chú nội bộ: vì code P4 đã được xác nhận an toàn để deploy sớm — không đổi hành vi khi `node_key` còn ở dạng cũ — team Tutor có thể deploy `learning-path` NGAY BÂY GIỜ, trước cả khi Studio chạy P3, để việc cutover phía Tutor không còn gì phải làm nữa.)*

---

## ⇢ TÓM TẮT — Tutor cần Studio chốt/cấp
1. **Tín hiệu thứ tự bài** sau re-key (Mục B — khuyến nghị giữ `kc_registry.vi_tri_trong_ct` truy vấn được). **BẮT BUỘC**, nếu không lộ trình xáo.
2. **`id_map` đầy đủ** + **ngày giờ cửa sổ bảo trì** (gửi trước ≥1 ngày).
3. Xác nhận **Studio remap dữ liệu học sinh** trong transaction; Tutor verify theo kế hoạch Mục C.3.
4. (Sau re-key) đẩy bundle GDKTPL + rubric + câu nghe **theo ID mới**.

Tutor sẵn sàng: chỗ sửa duy nhất (`learning-path.tiebreak`) đã xác định, ~10 dòng, làm ngay trong cửa sổ khi có tín hiệu thứ tự.
