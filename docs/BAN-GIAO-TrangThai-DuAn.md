# BÀN GIAO TRẠNG THÁI DỰ ÁN — AI Personal Tutor Trường Việt Anh
*(File tri thức để tiếp tục ở phiên/nick khác · cập nhật **2026-08-15**)*

> Đọc file này là nắm trọn: kiến trúc, hạ tầng, khoá quan trọng, đã làm gì, đang chờ gì, ràng buộc vận hành. Các file chi tiết đều nằm trong `docs/`.

---

## 0. PHIÊN GẦN NHẤT — 13–14/08: vá lỗi luồng học + giao diện

**Đã deploy đủ ba vế** (web `9ec61a4` · `chat-turn` · `diagnose`). Web đi qua
`git push origin HEAD:main` → Coolify ~2–4 phút. **Kiểm bằng hard-reload
(Ctrl+Shift+R)** — tải lại thường ra bundle cũ, đã dính hai lần.

**Đã sửa (~27 lỗi).** Đáng nhớ vì đều là *code tự làm hỏng, không phải dữ liệu sai*:
- `capitalizeLead` viết hoa chữ nằm TRONG tên lệnh LaTeX → `\overline` thành
  `\Overline` → KaTeX nhả mã thô ra ô đáp án.
- Luật chặn iOS tự phóng to viết bằng `:where()` nên độ đặc hiệu 0 — thua mọi
  tên lớp; đúng một ô nhập (`.reflect-input`) lọt lưới.
- `callFnStream` thiếu lưới hồi phục 401 mà `callFn` đã có từ lâu → **chỗ duy
  nhất chưa có lưới lại là đường màn Học đi** ("đang học dở thì bị văng").
- `pathVersion` chỉ tăng khi học HẾT buổi → thoát giữa chừng thì lộ trình đứng im.
- Chấm tự luận lấy `so_y_can` từ ĐÁP ÁN MẪU (luôn đầy đủ hơn đề đòi) → em làm
  đúng yêu cầu vẫn trượt. Nay thước đo là ĐỀ BÀI.
- Giao diện: gỡ WIG khỏi app học sinh, nền trời cho 4 tab ngoài Học, Kho báu bỏ
  5 dải màu bão hoà, cấm gạch ngang trong lời AI, khung chat cao cố định,
  vùng chạm 44px, đề liệt kê `(1)…(5)` xuống dòng từng ý.

**HAI BÀI HỌC — đọc trước khi sửa tiếp:**
1. **ĐO, ĐỪNG SUY DIỄN.** Tôi kết luận sai **ba lần liên tiếp** về cùng triệu
   chứng "925 XP mà 0 điểm thành thạo": "XP bị farm" (sai — DB có unique index
   chống farm), "DOK-3 toàn `[NOPBAI]`" (sai — chỉ 67/669), "kho thiếu câu DOK-3"
   (sai — 390 câu active, 201/204 node có). Đọc DB trước qua Management API.
2. **ĐỪNG ĐÈ LÊN BẬC THANG SƯ PHẠM.** Có số liệu đúng rồi (82 lượt DOK-1 / 24
   DOK-2 / **5 DOK-3** trên toàn hệ thống) tôi lại đi trộn lại đề ngay trước mắt
   học sinh để ép node xanh. Chủ dự án bác: *"không được phá vòng sư phạm, ko tự
   kiếm bài khó hơn để nâng"*. Đã revert (`25ba257`), có ghi chú tại chỗ trong
   `diagnose/index.ts` — **đừng dựng lại**.

**CÒN NỢ:**
- **Nghiệm thu** bản vá chấm tự luận: nộp lại bài "phản bác bạn Nam" phải ĐẠT
  (sửa/thêm một chữ để thoát cache của `grade-open`, nó bật `cache: true`).
- **Ba màn chưa soát lại bằng mắt sau deploy:** màn làm bài, Kho báu, `#scoreboard`.
- **Khôi phục buổi học đang dở khi hết phiên** — màn "Phiên đã hết hạn" hứa
  "bài đang gõ dở đã giữ lại", chỉ ĐÚNG với bài tự luận (localStorage). Đang làm
  trắc nghiệm mà văng thì mất cả buổi. Cần khôi phục `learning_sessions` active.
- **Mastery vẫn 0 điểm** cho học sinh thật. Số liệu đã có, hướng sửa CHƯA chốt —
  phải hỏi chủ dự án trước, không tự quyết.
- **Kho báu:** khó tìm lối vào (phải bấm nút `node-treasure` trên thẻ node) ·
  thưa nội dung (3 nhóm × 1 mục — là **dữ liệu học liệu**, không sửa bằng code).
- **Phông chữ:** đang IBM Plex Sans (bộ chữ doanh nghiệp). Đề xuất **Baloo 2**
  cho tiêu đề, giữ thân bài. Chủ dự án chưa chốt.

**Bộ kiểm chạy được** (`node tools/<tên>.mjs`, chạy TỪ THƯ MỤC GỐC repo):
`mathtex-matrix` 17 · `goiy-matrix` 63 · `gachngang-matrix` 24 (mới) ·
`grading-matrix` 118 · `memory-matrix` 28 · `stream-matrix` 19 · `nopbai-matrix` 20.

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
- **DB dùng chung (production):** project `oonuzgnfoypibrssvmrt` ("app sản xuất"). *(sửa 2026-08-02: ref cũ `gxbxsdhvtwtjkfygetzb` ghi ở đây đã lỗi thời, không khớp CLAUDE.md/DB thật.)*
- **Version Toán 10:** `0e677ecb-f803-45e7-94a0-4451f47951dc` (subject `Toan`, published, 204 node). *(sửa 2026-08-02: id cũ `6cc28358-...` không khớp `kg_versions` thật.)*
- **Version Tiếng Anh 10:** `4a839fc3-4008-482d-9802-cd4c3566739d` (subject `Anh`, "Tiếng Anh 10 — Global Success", published, 340 node).
- **Version GDKTPL 10** *(mới 24/07)*: `41af967f-bfec-44da-971f-e7d5bcd1f39a` (subject `GDKTPL`, "GDKTPL 10 — Kết nối tri thức", published, 200 node/388 cạnh/215 câu — 101/200 node có câu, 67 câu tự luận chờ rubric).
- **Tenant slug:** `viet-anh`.
- **Acc demo (login được):** `hs1@vietanh.edu.vn` / `VietAnh@2026` (và `gv1@`, `ph1@`). Password grant qua anon key để test API.
- **`.env` (D:/tutor/.env):** có `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN` (Management API — dùng để chạy SQL/nạp qua `https://api.supabase.com/v1/projects/<ref>/database/query`, hoặc `node scripts/apply-migration.mjs <file>.sql`). `DB_PASSWORD`/`SERVICE_ROLE` vẫn placeholder.
- **Git:** nhánh `feat/kg-ingest-v2.2`. Commit gần nhất `d5ea0e6` (J2 lưới an toàn) — 3 commit phiên 24/07 (`b603f06`/`3422333`/`d5ea0e6`), **chưa push**.

## 3. Trạng thái tiến độ: **≈ 88.1%** *(rà lại 24/07)*
Bám PRD v3. 100% = **pilot production Việt Anh trọn vẹn** (2 môn đủ nội dung + đủ vai/công cụ + PDPL + gamification + đo A/B + nhà máy nội dung vận hành). IRT/CAT + SSO/OCR/Classroom + Zalo + đa môn = **v-next (ngoài 100%)**. Done = code+test+build xanh.
- File %sống: **`docs/Timeline-DuAn.xlsx`** — 115 việc (**99 Xong / 6 Đang / 10 Chưa**), dropdown Xong/Đang/Chưa → %tự tính. **Generator `gen_timeline.py` đã mất (scratchpad phiên cũ)** → sửa trực tiếp xlsx bằng openpyxl (đóng Excel trước khi ghi).
- **24/07: BACKLOG CODE COI NHƯ XONG.** Mọi việc còn "Chưa"/"Đang" trong timeline giờ là: nội dung Studio (E5/E6/E7), nghiên cứu A/B cần con người (O1/O2/O4), vận hành/pháp lý ngoài code (K6/N5/N6/L5), hoặc quyết định scope (G15/I3) — không còn việc lập trình nào chờ.
- ⚠️ **Chỗ scope chưa chốt còn tồn:** I3 (báo cáo PH định kỳ) — memory 20/07 ghi đã bỏ khỏi pilot nhưng timeline vẫn tính %. J2 (cờ an toàn) đã **LÀM XONG** (không còn là "bỏ scope" nữa — xem §4). E4 (340 rubric riêng) chủ dự án đã chốt = v-next.
- PRD: **`docs/PRD-v3.md`** (§0 bảng v2→v3, §14 định nghĩa 100%). PRD v2 gốc = Google Doc `1seyRK7XissTfrbLWIpK27ky8PD5AV3ayyQDWtYn8P6E`.

## 4. Đã làm

### Phiên 01/08 — **AI CHẤM HẾT BÀI TỰ LUẬN, giáo viên không chấm nữa**

Quyết định của chủ dự án, thay hẳn mô hình cũ. **Số liệu đẩy tới quyết định này:**
69 bản nộp từ trước tới nay, **0 bản từng được giáo viên chấm Đạt**, 60 bản nằm chờ.
Mà `[NOPBAI]` là **323/1.930 câu** và thường là câu DOK≥3 *duy nhất* của node ⇒ đường
đó không thông thì lộ trình đứng im.

> ⚠️ **SỬA LẠI QUY MÔ (đo trên prod 10/08) — câu "60 em" ở bản gốc là NÓI QUÁ.**
> 60 dòng `pending` đó là của **3 tài khoản** (`Nguyễn An` = acc demo `hs1@`,
> `Học sinh thử B`, `Học sinh thử C`) trên 14 câu, rút lại chỉ **15 cặp (học sinh,
> câu)** duy nhất — phần còn lại là nộp lại nhiều lần. Trung vị bài nộp dài **14 ký
> tự**; 12/15 bản là `"ok"` / `"okk"` / `"mệt quá"` / `"oke la oke la"`. Đây là rác
> của chính đợt thử nghiệm, **không có học sinh thật nào đang kẹt** (bản mới nhất
> 31/07). Quyết định đổi sang AI chấm hết vẫn đúng vì lý do khác (0 bản từng được
> chấm Đạt ⇒ mô hình giáo viên chấm không vận hành được), nhưng đừng dùng "60 em"
> làm lý do gấp nữa. Bài học: `count(*)` trên bảng nộp bài của app đang thử nghiệm
> gần như luôn thổi phồng — đếm **số học sinh phân biệt** và **độ dài nội dung** đã.

- **Ba cửa vào → MỘT bộ chấm.** `_shared/doc-bai-lam.ts` quy mọi đường nộp về một
  chuỗi trước khi chấm: em gõ · tệp `.docx` · ảnh bài viết tay.
- **Đọc `.docx` không thêm thư viện** (`_shared/docx.ts`): tự đọc bảng thư mục ZIP +
  `DecompressionStream("deflate-raw")`, rồi đổi công thức **OMML → LaTeX** (phân số,
  mũ, chỉ số, căn, tổng/tích phân, ngoặc, hàm, dấu mũ). Không dùng mammoth vì mammoth
  **vứt bỏ công thức** — đúng phần quan trọng nhất của bài toán.
- **Đọc ảnh bằng mô hình NHÌN** — thêm tầng `vision` trong `llm.ts` (`LLM_VISION_MODEL`,
  mặc định `google/gemini-2.5-flash`) + tham số `images` (data URL, KHÔNG dùng link ký
  để không lộ cấu trúc bucket). Có danh sách dự phòng RIÊNG cho tầng nhìn: rơi sang model
  văn bản thuần thì nó vẫn trả lời trôi chảy về một bài **nó chưa hề thấy**.
- **Phán quyết = mastery + XP ngay** (đảo quyết định 29/07). Đai an toàn gom vào một hàm
  thuần `chotPhanQuyet()`: LLM hỏng ⇒ *"chưa chấm được"*, **không bao giờ** thành điểm
  trượt; mô hình gật cho bài vài chữ trong khi đáp án là đoạn văn ⇒ hạ thành trượt.
- **Ô soạn công thức MathLive** (`BaiLamEditor` + `MathKeypad`), nạp trễ và chỉ khi em
  bấm nút — đo trên bản dựng: `/learn` 231 kB, `/login` 175 kB, **không trang nào nạp
  chunk MathLive** (796 kB nằm riêng). `fontsDirectory = null`: đo trong trình duyệt thấy
  ký hiệu render bằng chính `KaTeX_Math`/`KaTeX_Main` mà trang đã có ⇒ **0 byte phông thêm**.
- **Tab "Chấm bài" của giáo viên: ẨN** sau cờ `GRADING_ENABLED` trong `TeacherDashboard.tsx`.
  Mã `GradingTab` + function `teacher-grading` **giữ nguyên**, bật lại là một dòng.
- **Dọn hàng đợi treo** *(60 dòng = 15 bài thật, xem cảnh báo quy mô ở trên)*:
  function mới `regrade-submissions` — **live từ 10/08 (v1)**. (`{"action":"dry"}` xem trước,
  `{"action":"run"}` chấm thật, `limit` mặc định 25). Dùng ĐÚNG bộ chấm + bộ đọc tệp của
  lượt nộp mới, không có bản sao thứ hai để trôi lệch.
- **Bộ kiểm:** `tools/docx-matrix.mjs` (đọc .docx + KaTeX render 6/6), `tools/nopbai-matrix.mjs`
  (phán quyết 11/11). Toàn bộ bộ kiểm cũ vẫn xanh: grading 118, memory 28, stream 19,
  gate-trace, vitest pedagogy 6.

### Phiên 24/07 (nhánh `feat/kg-ingest-v2.2`, 3 commit — xem §2)
- **Re-key ID (P3+P4): ĐÃ NGHIỆM THU.** Studio đổi mã atom → `KC-/Q-/E-/R-/L-`, chạy P3 remap 544 node sống + 2.967 câu + 5 cột dữ liệu HS. `learning-path` đổi tiebreak sang `kc_registry.vi_tri_trong_ct`, deploy + verify **ĐẠT toàn bộ** (0 key cũ sót, đếm dòng khớp, tiến độ HS nguyên, thứ tự lộ trình đúng). Chi tiết: `docs/DoiUng-Tutor-ReKey.md` mục A–I.
- **Onboard môn GDKTPL 10** (nhân bản môn — P1+P2): `import-kg` nhận subject mới; `scripts/import-gdktpl.mjs` + `scripts/publish-gdktpl.mjs` nạp 200 node/388 cạnh/215 câu + `ALTER TYPE subject ADD 'GDKTPL'` + publish. Frontend: GDKTPL vào `Subject` type + `SubjectPicker` (live). **Verify end-to-end**: `learning-path` trả đúng 200 node cho acc demo.
- **K3 — Đồng thuận kép (PDPL):** schema đã có sẵn (`dual_consent`/`student_assent`/`guardian_consent_by`) nên không cần migration. Gate `hasActiveConsent` siết ĐỦ ĐÔI; function `consent` (status/assent/grant/withdraw); UI phụ huynh "Đồng ý cho con" (ParentView) + HS assent/rút (SettingsView). **Live + verified** (demo qua gate, không khoá nhầm).
- **H5 — GV chỉnh nội dung + lý do:** bảng `teacher_overrides` (migration `0012`, RLS theo tenant) — GV ẨN/SỬA một câu kèm LÝ DO bắt buộc (audit), áp lúc phục vụ ở `diagnose` + `chat-turn` (không đụng bản gốc Studio). Endpoint `teacher-override` + nút "Ẩn" ở `/teacher`. **Live + verified** (bảng tạo, endpoint sống).
- **J2 — Lưới an toàn:** `_shared/safety.ts` dò tín hiệu tự-làm-hại/bắt nạt/khủng hoảng bằng regex **bảo thủ** (đã test chống dương-tính-giả: "đói/mệt muốn chết" không gắn cờ oan) → ghi `safety_events` (bảng + `CounselorView` đã có sẵn từ trước) + đáp ấm áp hướng người lớn. **Deployed** qua `chat-turn`. Test tuỳ chọn: `scripts/test-j2-safety.mjs`.
- **O3 — Analytics/KPI:** `dashboard(leadership)` thêm chuỗi 14 ngày (HS active/phiên/lượt/accuracy) + retention tuần; `LeadershipView` + biểu đồ SVG. **Live + verify logic trên dữ liệu thật.**
- **H6/M4 — Heatmap tra sâu:** `teacher-stats` trả `studentNodes`; `StudentsTab` drilldown bấm HS → bản đồ nhiệt từng node. **Live + verified.**
- **M3 — Export báo cáo:** nút Xuất CSV (BOM UTF-8) + Lưu PDF, client-side (`lib/export.ts`).
- **G14 — Vòng đời buổi học:** thêm nhắc nghỉ 25' (băng-rôn tự tắt) + chiêm nghiệm cuối buổi (`SessionReflection`, growth-mindset, không chấm điểm).
- **Dáng dấu chân lộ trình:** thuật toán mới theo quy luật cụm A (T-P-P-T) / cụm B mirror (P-T-T-P), uốn mạnh hơn bản cũ.
- **Audit sửa 5 món mistracked** trong timeline (đã code xong từ trước nhưng ghi "Chưa"): C14, F13 (park có lý do — DB gần như không có 3 dạng câu này), I2, H4, J4.
- **Đã build production** (`apps/web/out/`, trỏ đúng prod, không rò dev proxy) — sẵn sàng `wrangler deploy`, **chưa deploy** (N3).

### Trước đó
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
- **Deploy edge function** qua **Supabase CLI**: `supabase functions deploy <fn> --project-ref gxbxsdhvtwtjkfygetzb` (chat-turn 35.6KB > giới hạn 21KB/call của MCP nên phải CLI). Đã live (24/07): `chat-turn`, `diagnose`, `learning-path`, `import-kg`, `dashboard`, `teacher-stats`, `consent` *(mới)*, `teacher-override` *(mới)*, `scoreboard`, `admin-roster`.
- **Migration prod** qua `node scripts/apply-migration.mjs <file>.sql` (đọc `.env` token, POST tới Management API) — dùng cho `0012_teacher_overrides.sql`.
- **Web CHƯA deploy production** (Cloudflare). Đang test qua tunnel dev (cloudflared) + dev routes proxy Supabase qua `/__sb` (same-origin, tránh CORS). Hình nền + scorecard chỉ lên live thật sau khi đẩy web.
- **Dev preview**: `.claude/launch.json` name `web`, port 3000 autoPort, `NEXT_DIST_DIR=.next-preview`. Cẩn thận port 3000 = /graph của user.

## 6. ĐANG CHỜ / VIỆC TIẾP THEO

**Không còn việc lập trình nào chờ Claude làm.** Mọi việc dưới đây là: 1 lệnh deploy, nội dung do Studio, nghiên cứu cần con người, hoặc quyết định scope.

1. **Deploy web production (Cloudflare)** — bundle đã build + verify sẵn (`apps/web/out/`, trỏ đúng prod). Chỉ cần:
   ```
   cd apps/web && npx wrangler login && npx wrangler deploy
   ```
   Mở khoá **mọi UI phiên 24/07** thành live thật: export CSV/PDF, nhắc nghỉ + chiêm nghiệm, biểu đồ analytics, heatmap tra sâu, nút đồng thuận, nút "Ẩn" nội dung, bộ chọn môn có GDKTPL.
2. **Push git** — 3 commit (`b603f06`/`3422333`/`d5ea0e6`) đang ở local, chưa push lên remote.
3. **Chờ Studio giao theo ID mới (KC-/Q-):** rubric riêng ~340 câu (v-next, không chặn pilot — khuôn kỹ năng đã gánh), câu `nghe` + transcript, **thang Socratic Tiếng Anh** (hiện 0 — đây mới là lõi thiếu, không phải rubric). Chi tiết đối ứng: `docs/DoiUng-Tutor-ReKey.md` mục A–I.
4. **Nghiên cứu A/B (O1/O2/O4, đang 0%)** — thiết kế nhóm đối chứng + baseline/endline gắn điểm kiểm tra trường + theo dõi retention. Cần **con người** (chủ dự án + nhà trường) quyết định thiết kế trước; baseline phải đo TRƯỚC khi HS thật dùng app.
5. **PDPL còn lại:** K6 checklist + luật sư rà (ngoài code). K3/K5 đã xong phần code.
6. **Ngoài code:** N5/N6 (monitoring/kiểm tải — code-side đã có catch+log, phần alerting là cấu hình ops), L5 (tracker phản hồi Studio), D6/E7 (nghiệm thu thống kê — cần đủ dữ liệu bài làm thật).
7. **Chốt scope:** G15 (bật lại Presence hay bỏ hẳn?), I3 (báo cáo PH định kỳ — memory 20/07 ghi đã bỏ khỏi pilot nhưng timeline chưa tách).
8. **`assets-src/`** (ảnh gốc ~14MB toán+tiếng anh): **cố ý CHƯA commit** (webp shipped ở `public/scenes`). User quyết: commit làm nguồn hay `.gitignore`.
9. **Cloudflare Cache Rule cho HTML — 1 việc bấm tay, chủ dự án làm.** Đợt tối ưu tốc độ
   30/07 đã cho nginx trả `Cache-Control: … s-maxage=300, stale-while-revalidate=86400`
   cho trang HTML, NHƯNG **Cloudflare mặc định KHÔNG cache `text/html`** dù header nói gì —
   đo trên production thấy `cf-cache-status: DYNAMIC`, tức mỗi lượt mở app đều phải chạy
   hết đường tới VPS. Muốn ăn phần đó: dashboard Cloudflare → tutor.vietanh.org → Caching →
   Cache Rules → tạo rule *"Cache eligible for cache"* (hoặc Cache Everything) cho
   `hostname eq "tutor.vietanh.org"`, **Edge TTL = Use cache-control header**.
   Rủi ro thấp vì HTML đã mang `must-revalidate` + ETag: bản mới tới chậm nhất 5 phút,
   và không bao giờ phục vụ HTML cũ mà không hỏi lại.

## 7. File & script quan trọng
| Đường dẫn | Vai trò |
|---|---|
| `supabase/functions/chat-turn/index.ts` | Engine chính (chấm, thang, rubric, XP, truy ngược, override H5, an toàn J2) |
| `supabase/functions/_shared/{cas,interactive,rubrics,pedagogy,prompts,llm,paramgen}.ts` | Lõi tất định + LLM gateway |
| `supabase/functions/_shared/{overrides,safety}.ts` *(mới 24/07)* | H5 lớp phủ GV · J2 dò tổn thương |
| `supabase/functions/{diagnose,learning-path,guide,dashboard,teacher-stats,scoreboard,admin-roster,consent,teacher-override,evaluate-*}` | Các function phụ (`consent`/`teacher-override` mới 24/07) |
| `apps/web/components/{TutorApp,Interactive,SpeakerButton,LearningPath,TeacherDashboard,RosterManager,RoleViews,SettingsView}.tsx` | UI chính |
| `apps/web/lib/{api,auth,config,mathrender,export}.ts(x)` | Client API + auth + render toán + xuất CSV/PDF (`export.ts` mới) |
| `scripts/import-ladders-*.mjs`, `import-kg-subject.mjs`, `load-ladders.mjs` | Nạp nội dung (user chạy) |
| `scripts/{import-gdktpl,publish-gdktpl,apply-migration,test-j2-safety}.mjs` *(mới 24/07)* | Onboard GDKTPL · áp migration prod · test lưới an toàn |
| `supabase/migrations/0012_teacher_overrides.sql` *(mới)* | H5 — bảng lớp phủ nội dung |
| `docs/PRD-v3.md`, `docs/Timeline-DuAn.xlsx`, `docs/ONBOARD-SUBJECT.md`, `docs/PRODUCTION-BOOTSTRAP.md`, `docs/DoiUng-*.md` | Tài liệu |

## 8. Bối cảnh sư phạm (bất biến — đừng đổi)
Active-learning Socratic không cho đáp án · mastery learning · growth mindset + grit · CAS tách tính toán khỏi LLM · DOK ≠ độ khó · chẩn đoán truy ngược tiền đề · thang 4 bậc + cổng nỗ lực (≥2 lần thử + diễn đạt lý lẽ) · PDPL (đồng thuận kép, rút đồng ý→dừng, ẩn danh LLM) · gamification thưởng nỗ lực (không thưởng điểm tuyệt đối) · human-in-the-loop nội dung.
