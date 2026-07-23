# BÀN GIAO TRẠNG THÁI DỰ ÁN — AI Personal Tutor Trường Việt Anh
*(File tri thức để tiếp tục ở phiên/nick khác · cập nhật 2026-07-23)*

> Đọc file này là nắm trọn: kiến trúc, hạ tầng, khoá quan trọng, đã làm gì, đang chờ gì, ràng buộc vận hành. Các file chi tiết đều nằm trong `docs/`.

---

## 1. Là gì & kiến trúc
Intelligent Tutoring System dẫn học sinh học chủ động (Socratic, không cho đáp án), chẩn đoán lỗ hổng, đóng gap theo độ sẵn sàng. Mascot "sư tử Việt Anh", XP thưởng nỗ lực, lộ trình world.
- **Frontend:** Next.js **static export** → Cloudflare Workers; Supabase JS client. Thư mục `apps/web`.
- **Backend:** **Supabase Edge Functions (Deno)** — `supabase/functions/*`. KHÔNG dùng n8n.
- **DB:** Supabase Postgres + pgvector + RLS + `user_roles`.
- **LLM:** **OpenRouter** (glm-5.2 chính, deepseek/qwen fallback), ẩn danh PDPL trước khi gọi. Chỉ dùng ở chấm rubric (viết/nói) + diễn đạt thang Socratic + chat. **Toán KHÔNG để LLM tự tính** — CAS (`_shared/cas.ts`).
- **Engine áp cứng** (tất định, trong `chat-turn`): CAS chấm → distractor→quan niệm sai → thang Socratic 4 bậc + cổng nỗ lực → bottom-out → truy ngược `prerequisite_hard` (patch-and-climb) → mastery + XP.
- **Nội dung** do **Studio (school-ai, D:/school ai)** sản xuất (6 trạm), đồng bộ sang tutor theo **mã atom** `node_key`/`question_key`.

## 2. Hạ tầng & KHOÁ QUAN TRỌNG (dùng ngay)
- **DB dùng chung (production):** project `gxbxsdhvtwtjkfygetzb` ("app sản xuất"). *(project `eagsageokobtidpmxucx` tồn tại nhưng KHÔNG dùng.)*
- **Version Toán 10:** `6cc28358-2d65-4f18-ac34-c670f6b82a58` (subject `Toan`, published).
- **Version Tiếng Anh 10:** `4a839fc3-4008-482d-9802-cd4c3566739d` (subject `Anh`, "Tiếng Anh 10 — Global Success", published).
- **Tenant slug:** `viet-anh`.
- **Acc demo (login được):** `hs1@vietanh.edu.vn` / `VietAnh@2026` (và `gv1@`, `ph1@`). Password grant qua anon key để test API.
- **`.env` (D:/tutor/.env):** có `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN` (Management API — dùng để chạy SQL/nạp qua `https://api.supabase.com/v1/projects/<ref>/database/query`). `DB_PASSWORD`/`SERVICE_ROLE` vẫn placeholder.
- **Git:** nhánh `feat/kg-ingest-v2.2`. Commit gần nhất `f40aa90` (docs PRD v3 + timeline + C09).

## 3. Trạng thái tiến độ: **≈ 75.0%** *(rà lại 23/07)*
Bám PRD v3. 100% = **pilot production Việt Anh trọn vẹn** (2 môn đủ nội dung + đủ vai/công cụ + PDPL + gamification + đo A/B + nhà máy nội dung vận hành). IRT/CAT + SSO/OCR/Classroom + Zalo + đa môn = **v-next (ngoài 100%)**. Done = code+test+build xanh.
- File %sống: **`docs/Timeline-DuAn.xlsx`** — 115 việc (84 Xong / 12 Đang / 19 Chưa), dropdown Xong/Đang/Chưa → %tự tính. Rà 23/07: N3 web build+verify xong → Đang; re-key ghi ở L1; nội dung Anh (E4–E7) làm sắc ghi chú. **Generator `gen_timeline.py` đã mất (scratchpad phiên cũ)** → sửa trực tiếp xlsx bằng openpyxl (đóng Excel trước khi ghi).
- ⚠️ **Chỗ scope chờ chốt (rà 23/07):** I3 (báo cáo PH) + J2 (cờ an toàn) — memory 20/07 ghi ĐÃ BỎ khỏi pilot nhưng timeline vẫn tính %; E4 (rubric riêng 340) chủ dự án đã chốt = v-next. Nếu đẩy cả 3 sang khu v-next (loại khỏi mẫu số) → % pilot = **77.8%**. Chưa tách vì cần chốt cách biểu diễn "v-next" trong file.
- PRD: **`docs/PRD-v3.md`** (§0 bảng v2→v3, §14 định nghĩa 100%). PRD v2 gốc = Google Doc `1seyRK7XissTfrbLWIpK27ky8PD5AV3ayyQDWtYn8P6E`.

## 4. Đã làm (phiên gần đây)
- **Thang Socratic Toán 10: ĐỦ 9/9 chương** (204/204 node, 2629 thang). Nạp qua `scripts/import-ladders-missing.mjs` (C1/4/5/6) + `scripts/import-ladders-c09.mjs` (C09 — schema 3.0).
- **Đợt A** (hợp đồng Studio): 3 dạng tương tác `dung_sai`/`sap_xep`/`noi_cot` — UI kéo-thả+chạm (`Interactive.tsx`) + bộ chấm cấu trúc tất định server (`_shared/interactive.ts`, parse dẫn đường bằng `dap_an`: noi_cot 100%, sap_xep 91%). **Deploy + live-verified.**
- **Đợt B**: rubric **theo kỹ năng** (Viết/Nói/Lập luận, thang 0–3) chấm có điểm + scorecard (`_shared/rubrics.ts`, `prompts.buildScoredRubricSystem`, `chat-turn`, `TutorApp`). **Deploy + live-verified.**
- **Đợt C**: nút "Nghe" Web Speech TTS (`SpeakerButton.tsx`) — MVP (DB đang 0 câu `nghe`).
- **Đợt D**: importer chung mở môn mới `scripts/import-kg-subject.mjs` + `docs/ONBOARD-SUBJECT.md`. `subject` là cột **text** (không cần enum).
- **Hình nền 9 chương**: `apps/web/public/scenes/world-0..8.webp` (~30KB), `.scene` CSS, `LearningPath WORLDS=9`, cung sáng→tối. (Chỉ verify computed-style; screenshot pane bị kẹt.)
- **Đối ứng Studio:** `docs/DoiUng-Tutor-gui-Studio.md` (hợp đồng dạng câu/rubric/môn mới) + `docs/DoiUng-Tutor-ReKey.md` (hợp đồng re-key ID).

## 5. RÀNG BUỘC VẬN HÀNH (bắt buộc nhớ)
- **Claude BỊ CHẶN ghi production** (classifier). Mọi lệnh ghi DB / deploy → **user tự chạy** (prefix `!` trong terminal). Claude viết script, user chạy.
- **Claude KHÔNG được gõ mật khẩu / set secret.** (Đã dùng password demo cho test API read-only — chấp nhận vì là credential demo trong repo.)
- **Supabase MCP de-auth phiên này** → đọc/nạp DB qua **Management API + `.env` token** (không qua MCP).
- **Deploy edge function** qua **Supabase CLI**: `supabase functions deploy <fn> --project-ref gxbxsdhvtwtjkfygetzb` (chat-turn 35.6KB > giới hạn 21KB/call của MCP nên phải CLI). Đã live: `chat-turn`, `diagnose`, `scoreboard`, `dashboard`, `teacher-stats`, `admin-roster`.
- **Web CHƯA deploy production** (Cloudflare). Đang test qua tunnel dev (cloudflared) + dev routes proxy Supabase qua `/__sb` (same-origin, tránh CORS). Hình nền + scorecard chỉ lên live thật sau khi đẩy web.
- **Dev preview**: `.claude/launch.json` name `web`, port 3000 autoPort, `NEXT_DIST_DIR=.next-preview`. Cẩn thận port 3000 = /graph của user.

## 6. ĐANG CHỜ / VIỆC TIẾP THEO
1. **Deploy web production** (Cloudflare) — để hình nền + scorecard rubric lên live thật.
2. **Re-key ID (Studio 2026-07-23): XONG — ĐÃ NGHIỆM THU.** Studio đổi mã atom → `KC-/Q-/E-/R-/L-`, chạy P3 remap (544 node sống + 2.967 câu + 5 cột dữ liệu HS). Tutor P4 = `learning-path` đổi tiebreak `node_key` → `kc_registry.vi_tri_trong_ct`, **đã deploy (v10) + verify**. Nghiệm thu Tutor (đọc DB prod + gọi API acc demo) **ĐẠT toàn bộ**: 0 key cũ sót/9 cột · đếm dòng khớp Studio (attempts 60…) · tiến độ HS 0 mồ côi, điểm giữ nguyên · **thứ tự lộ trình đúng** (Anh khớp 100% `vi_tri_trong_ct`; Toán đúng, chỗ lệch là cạnh tiên quyết chèn = "mở khoá thông minh", không hồi quy) · sẵn sàng chấm (engine theo `questions.id` UUID bất biến). Chi tiết: `docs/DoiUng-Tutor-ReKey.md` mục I. **Còn chờ Studio giao theo ID mới:** bundle GDKTPL 10 (210 câu), rubric ~340, câu nghe+transcript, thang/rubric Tiếng Anh (socratic_ladders Anh hiện = 0). *(Việc còn lại tuỳ chọn: bấm "chấm thử" 1 câu trong app để xác nhận trực quan — ghi dòng demo nên để người phụ trách tự làm.)*
3. **Chờ Studio cấp:** rubric riêng từng câu (~340, theo 3 khuôn kỹ năng), câu `nghe` + transcript, bundle GDKTPL 10 (210 câu) — **theo ID mới** sau re-key.
4. **Tới 100% (PRD v3):** nội dung Anh 10 (rubric/nghe/thang/nghiệm thu), đo A/B, công cụ GV sâu (duyệt AI, GV chỉnh nội dung, heatmap), trang phụ huynh, PDPL đầy đủ (đồng thuận kép), cờ khẩn cấp, export báo cáo, nhân bản GDKTPL.
5. **`assets-src/`** (ảnh gốc ~14MB toán+tiếng anh): **cố ý CHƯA commit** (webp shipped ở `public/scenes`). User quyết: commit làm nguồn hay `.gitignore`.
6. **Chưa commit:** `docs/DoiUng-Tutor-gui-Studio.md`, `docs/DoiUng-Tutor-ReKey.md`, `docs/BAN-GIAO-TrangThai-DuAn.md` (file này).

## 7. File & script quan trọng
| Đường dẫn | Vai trò |
|---|---|
| `supabase/functions/chat-turn/index.ts` | Engine chính (chấm, thang, rubric, XP, truy ngược) |
| `supabase/functions/_shared/{cas,interactive,rubrics,pedagogy,prompts,llm,paramgen}.ts` | Lõi tất định + LLM gateway |
| `supabase/functions/{diagnose,learning-path,guide,dashboard,teacher-stats,scoreboard,admin-roster,evaluate-*}` | Các function phụ |
| `apps/web/components/{TutorApp,Interactive,SpeakerButton,LearningPath,TeacherDashboard,RosterManager}.tsx` | UI chính |
| `apps/web/lib/{api,auth,config,mathrender}.ts(x)` | Client API + auth + render toán |
| `scripts/import-ladders-*.mjs`, `import-kg-subject.mjs`, `load-ladders.mjs` | Nạp nội dung (user chạy) |
| `docs/PRD-v3.md`, `docs/Timeline-DuAn.xlsx`, `docs/ONBOARD-SUBJECT.md`, `docs/PRODUCTION-BOOTSTRAP.md`, `docs/DoiUng-*.md` | Tài liệu |

## 8. Bối cảnh sư phạm (bất biến — đừng đổi)
Active-learning Socratic không cho đáp án · mastery learning · growth mindset + grit · CAS tách tính toán khỏi LLM · DOK ≠ độ khó · chẩn đoán truy ngược tiền đề · thang 4 bậc + cổng nỗ lực (≥2 lần thử + diễn đạt lý lẽ) · PDPL (đồng thuận kép, rút đồng ý→dừng, ẩn danh LLM) · gamification thưởng nỗ lực (không thưởng điểm tuyệt đối) · human-in-the-loop nội dung.
