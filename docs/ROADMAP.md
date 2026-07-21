# Lộ trình: từ 20% → app xịn nhất có thể

> Chủ dự án chấm hiện trạng **20/100** (2026-07-11). File này là kế hoạch leo lên —
> mỗi giai đoạn có tiêu chí "xong nghĩa là gì" đo được. Thứ tự đã xếp theo
> nguyên tắc: **thứ chặn trải nghiệm thật đi trước thứ làm đẹp thêm.**

## Cập nhật 2026-07-12 — đã làm thêm NGOÀI kế hoạch gốc

- **GĐ2 vượt chỉ tiêu:** 2.1 + 2.2 xong; toàn bộ 4 tab công cụ full màn nền
  trắng navy+vàng (chủ dự án duyệt mẫu Ôn tập rồi nhân rộng); chi tiết nhí
  nhảnh (sticker/dấu chân/bong bóng thoại); trang Học 3 cột desktop.
- **Ăn trước phần lớn GĐ5 (mobile-native):** safe-area đủ, bottom-sheet thay
  confirm, vuốt ngang đổi tab, chuyển tab trượt theo hướng, stagger/meter/pop
  60fps, skeleton đúng hình, zero-state trung thực, input không zoom iOS —
  3 vòng (tự sửa → 10 agent phê bình → sửa theo phê bình), soát trên iPhone thật.
- **Lộ trình hết cảnh "Bài 1/1":** bundle Tiếng Anh 10 (340 atom) đã convert;
  fallback tĩnh từ bundle → Toán 204 bài / Anh 340 bài chia CHẶNG theo chương
  (điểm dừng khi cuộn); serverPath khi deploy sẽ tự thay.
- **Cửa nhập liệu Studio cho giáo viên** (/teacher): thả bundle → kiểm bằng
  đúng Zod schema hệ thống → xem trước chương/node/cạnh → gửi nạp (nói thật
  khi cổng online chưa mở) + chép lệnh CLI vận hành.
- **Cài đặt** (#settings): avatar, tên hiển thị 2 tầng, đổi mật khẩu thật,
  sáng/tối/theo máy, cỡ chữ, giảm chuyển động; policy đổi tên đã nằm sẵn
  trong rls.sql chờ apply.

## Cập nhật 2026-07-12 (chiều) — GĐ1 GẦN XONG + KIẾN TRÚC ENGINE ÁP CỨNG

**Hạ tầng thật đã chạy trên Supabase MỚI của trường (gxbxsdhvtwtjkfygetzb, provisioning
100% qua MCP — không cần mật khẩu DB):**

- Schema đầy đủ (27 bảng + KG v2.2 + RLS + RBAC + storage) + seed 9 tài khoản
  (mật khẩu chung pilot, đăng nhập thật đã kiểm chứng).
- **755 atoms đã nạp** qua edge function `import-kg` mới (Toán 9: 211n/273e,
  Toán 10: 204n/312e, Anh 10: 340n/0e) — tất cả nằm ở version `draft`, node
  `review`, 755 hàng chờ giáo viên duyệt. Nút "Gửi nạp" ở /teacher giờ chạy thật.
- **10 edge functions LIVE:** import-kg, learning-path, resources, scoreboard,
  teacher-stats, teacher-review, dashboard, diagnose, end-session, chat-turn —
  toàn bộ smoke-test bằng token thật.

**KIẾN TRÚC CHÍNH THỨC — Engine áp cứng (quyết định chủ dự án 2026-07-12):**
AI trả lời từng lượt không gánh nổi 100 học sinh đồng thời. Với câu hỏi khách
quan đã có nguyên tử, `chat-turn` giờ là engine xác định 100% không gọi LLM:

1. CAS chấm đúng/sai (tuple/tập nghiệm/số/biểu thức tương đương).
2. Sai → khớp distractor ra **quan niệm sai** → chọn đúng thang Socratic
   SOẠN SẴN của quan niệm đó; cổng nỗ lực giữ nguyên (thử tối thiểu → lên
   bậc gợi ý nguyên văn → bottom-out mở hướng giải).
3. Hết thang vẫn sai → **LAN TRUYỀN NGƯỢC** qua cạnh `prerequisite_hard`:
   tìm nguyên tử nền chưa vững sâu nhất còn câu hỏi, kéo học sinh về vá nền
   (session ghi nhớ node đang kẹt); mastery/Leitner cập nhật NGAY mỗi câu.
4. Vá xong (mastered) → **leo ngược** về bài đang dở, kèm câu hỏi tiếp theo.
   Đã kiểm chứng end-to-end trên chuỗi thật: kẹt T_HSB2 → 4 bậc thang → vá
   T_HS (3 câu, có DOK 3) → mastered → leo về → giải đúng → lộ trình đổi màu.

LLM chỉ còn 3 vai: chấm rubric viết/nói (formative), chat tự do, và sinh nội
dung offline (câu hỏi/thang) vào review_queue. Cả 3 đều có đường lui trung
thực khi chưa có OPENROUTER_API_KEY (bản build pilot đang deploy).

## Cập nhật 2026-07-12 (tối) — BÀN CỜ 755 ATOM ĐÃ PUBLISH + UI ↔ ENGINE

- **Nối UI ↔ engine áp cứng (task #24):** engine trả remediate/climb/mastered/
  message nhưng UI cũ vứt sạch — nay nối trọn. Đã diễn thật trong trình duyệt:
  kẹt câu đỉnh parabol → thang Socratic 4 bậc → **băng-rôn "vá nền" + tự đổi
  sang câu nền dễ hơn** → làm đúng nền → **tự quay về câu chính** → giải đúng.
  Không lỗi console. Vòng lặp "sai thì lan truyền ngược, vá nền rồi leo lại"
  giờ học sinh trải nghiệm được.
- **PUBLISH bàn cờ 755 atom** (quyết định chủ dự án: "bản đồ đầy đủ, giáo viên
  cắm bộ câu hỏi vào như ghép hình"): ghép 10 câu + 1 thang seed vào đúng atom
  trong khung; publish **Toán 10 — Kết nối tri thức (204 node, 9 chương)** +
  **Tiếng Anh 10 — Global Success (340 node)**; archive version seed. App thật
  giờ hiện **204 bài / 9 CHẶNG** (trước đó chỉ 2 node seed do serverPath thắng).
- **MỞ KHOÁ THÔNG MINH** (learning-path v3): node CHƯA có câu hỏi thì không thể
  mastery → KHÔNG được khoá bài sau. Kết quả: 192 available + 11 locked (đúng
  sau 6 node có bài) → bản đồ đầy đủ ĐI ĐƯỢC ngay; khoá tiên quyết TỰ SIẾT khi
  giáo viên cắm câu hỏi. Sửa luôn lệch hợp đồng `blockedBy` (mảng key) + trả
  `chapter` (gom chặng) + sort theo node_key (Chương IX hết xếp nhầm trước V).

**Còn lại của GĐ1:** **cửa cắm bộ câu hỏi cho giáo viên** (mảnh ghép — task mới:
import question-set → review → active, node đầy dần), OPENROUTER_API_KEY
(dashboard → Edge Functions → Secrets), XP server (1.4), bảng tuần thật (1.5),
máy sinh tham số (1.6). **Nút thắt thật sự: NGÂN HÀNG CÂU HỎI — 755 atom mới có
~10 câu; bàn cờ đã sẵn, giờ cần từng bộ câu hỏi ghép vào (thủ công hoặc AI sau).**

---

## Vì sao mới 20%? (chẩn đoán thẳng)

1. **Dữ liệu phần lớn chưa thật**: XP/chuỗi ngày nằm ở localStorage (đổi máy là mất),
   bảng tuần chưa có danh sách thật, chỉ 3 node seed thay vì 211 node Toán 9 đã chuyển đổi.
2. **4 edge functions mới chưa deploy** (learning-path, resources, prompts mình–bạn,
   chặn câu khuôn) — code xong nhưng học sinh thật chưa được hưởng.
3. **Desktop chưa được thiết kế riêng** — nhiều màn là mobile kéo dãn (đang sửa dần).
4. **Trang Học còn nghèo** — mới có lộ trình + cột phải mỏng.
5. **Nội dung sư phạm mỏng**: ngân hàng câu hỏi/Socratic mới có seed; pipeline 6 Trạm
   Studio mới chạy tới Trạm 2.

---

## Giai đoạn 1 — MÁU THẬT CHẠY TRONG APP (20% → 45%)

> Mục tiêu: mọi con số học sinh thấy đều là thật, mọi máy đều thấy giống nhau.

| # | Việc | Trạng thái |
|---|---|---|
| 1.1 | Điền `.env` + `apply` + deploy 4 edge functions | code xong, chờ vận hành |
| 1.2 | Nạp Toán 9 (211 node) + Toán 10 (204 node) vào Supabase | bundle đã validate |
| 1.3 | Cơ chế duyệt node + publish version (mở rộng teacher-review) + diagnose scope theo node | **việc mới** |
| 1.4 | **XP/chuỗi ngày lên server** (bảng student_xp + cộng XP trong chat-turn/end-session) — localStorage chỉ còn là cache | **code xong 2026-07-20** (xp-stats.sql + award_xp; chống farm bằng unique index; chờ áp SQL) |
| 1.5 | **Bảng tuần thật**: scoreboard trả danh sách lớp/khối (XP tuần, chuỗi) — UI đã sẵn, đổ dữ liệu là chạy | **code xong 2026-07-20** (scoreboard trả `board` bạn cùng khối theo XP tuần; UI ưu tiên bảng thật, hết chip "số mẫu") |
| 1.7 | **Đào thải câu kém** (quyết định chủ dự án 2026-07-20): p_value + discrimination từ lần-thử-đầu, câu quá dễ/khó/không phân biệt tự về `review` + review_queue; nút "Quét câu kém" ở /teacher + pg_cron đêm | **code xong 2026-07-20** (recompute_question_stats + edge fn question-stats; chờ áp SQL) |
| 1.6 | Máy sinh tham số cho câu khuôn ({b},{c} → số thật + đáp án) | **code+deploy xong 2026-07-20** (paramgen.ts tất định theo seed(session,câu); diagnose+chat-turn thay {name} khi hiển thị & chấm; cột questions.tham_so; Zod ParamSpec chặn placeholder mồ côi) |

## Đợt 2 — CỬA CẮM BỘ CÂU HỎI (2026-07-20, đón ngân hàng Toán 10)

| # | Việc | Trạng thái |
|---|---|---|
| 2a | **Cửa cắm bộ câu hỏi** cho giáo viên: /teacher › "Cắm bộ câu hỏi" thả gói `va.kg-questions/2.2` → validate Zod QuestionSet (phủ node + %tự chấm) → edge `import-questions` ghép vào phiên bản khớp nhãn → 'review' + review_queue → duyệt → active. Bàn cờ node đầy dần. | **LIVE 2026-07-20** (import-questions v2; QuestionIntake.tsx; convert:questions --set xuất envelope kéo-thả) |
| 2b | **Máy sinh tham số** (mục 1.6) — nền tảng sẵn, khuôn có spec là chạy | **LIVE 2026-07-20** |

**Xong khi:** học sinh đăng nhập máy khác vẫn thấy đúng XP; bảng tuần là bạn học thật;
lộ trình là 211 dấu chân thật.

## Giai đoạn 2 — DESKTOP LÀ CÔNG DÂN HẠNG NHẤT (45% → 55%)

| # | Việc |
|---|---|
| 2.1 | Login y chang mock 4e (2 nút, Google OAuth) — *đã làm 2026-07-11* |
| 2.2 | 4 tab công cụ đa cột ≥1200px — *đã làm 2026-07-11, cần soi mắt tinh chỉnh* |
| 2.3 | Màn bài học desktop: 2 cột (đề + hội thoại trái · học liệu/ghi chú phải) |
| 2.4 | Teacher dashboard theo đúng 4f (KPI 4 ô + 2 cột; tabs Duyệt nội dung/Học sinh/Báo cáo thành trang thật) |
| 2.5 | Parent report desktop 2 cột |

## Giai đoạn 3 — TRANG HỌC GIÀU LÊN (55% → 70%)

> Chủ dự án yêu cầu "learn có nhiều thứ hiển thị hơn". Menu đề xuất — **chọn món**:

| # | Widget đề xuất | Cần gì | Giá trị |
|---|---|---|---|
| 3.1 | **Ôn nhanh 2 phút** — thẻ hiện 2–3 điểm đến hạn ôn (Leitner), bấm là vào phiên ôn ngắn | endpoint lịch ôn (server đã có next_review_at) | giữ trí nhớ — cốt lõi sư phạm |
| 3.2 | **Thử thách hôm nay** — 1 câu hỏi nhanh thưởng XP bonus, đổi mỗi ngày | chọn câu từ ngân hàng theo ngày | lý do mở app mỗi ngày |
| 3.3 | **Sắp mở khoá** — preview 2 node kế tiếp (mờ + tên + cần gì) ngay dưới cảnh | có sẵn từ learning-path | tạo mục tiêu gần |
| 3.4 | **Bản tin lớp** — thông báo ngắn giáo viên gửi cả lớp ("Mai kiểm tra chương II") | bảng announcements + UI giáo viên soạn | kết nối lớp thật |
| 3.5 | **Buổi coach sắp tới** — lịch hẹn coach/buddy kế tiếp (4DX cadence) | dữ liệu coaching_links đã có | nhắc nhịp 4DX |
| 3.6 | **Học liệu nổi bật** — 1 tài liệu hay của node hiện tại hiện thẳng ở learn | resources pipeline (đã xây) | mồi vào bài |
| 3.7 | **Khoảnh khắc lớp** — "3 bạn lớp mình đang học lúc này" (ẩn danh/đếm) | presence qua Supabase realtime | cảm giác cùng học |
| 3.8 | **Sự kiện trường/mùa** — banner theo mùa (thi HK, 20/11…) sư tử đổi trang phục | lịch cấu hình + sprite mùa | tươi theo thời gian |

## Giai đoạn 4 — NỘI DUNG SƯ PHẠM DÀY (70% → 85%)

- Pipeline Studio Trạm 3–5 chạy đều: câu hỏi + thang Socratic + học liệu cho Toán 9/10
  (nút thắt lớn nhất toàn dự án — cần người soạn + duyệt).
- Tiếng Anh: khung tri thức + ngân hàng nói/viết.
- Chấm nói nâng cấp (Azure Speech phoneme khi có budget).

## Giai đoạn 5 — CẢM GIÁC APP THẬT (85% → 95%)

- PWA: cài lên màn hình chính, offline cache lộ trình + ôn tập.
- Âm nhẹ (đúng/hoàn thành — tôn trọng PRODUCT.md: không chuông ồn), haptic mobile.
- Onboarding lần đầu (sư tử dẫn 3 bước), trạng thái rỗng có hồn mọi màn.
- Hiệu năng: ảnh sprite gộp, font subset, Lighthouse ≥90.

## Giai đoạn 6 — ĐO & TINH (95% → 100%)

- Analytics học tập cho giáo viên (thời gian/độ kẹt từng node thật).
- A/B copy động viên; khảo sát học sinh trong app.
- Audit WCAG đầy đủ + kiểm thử người dùng thật 5 học sinh.

---

## Đang chờ chủ dự án quyết

1. **Chọn widget Giai đoạn 3** (đề xuất làm trước: 3.1 + 3.3 + 3.5 — rẻ mà chất).
2. Giai đoạn 1.4 đổi kiến trúc XP — cần gật đầu vì ảnh hưởng dữ liệu pilot.
3. Google OAuth: cần bật provider Google trong Supabase dashboard (nút đã sẵn trong app).
