# Bàn giao — trạng thái công việc

> Cập nhật 2026-07-11. Đọc file này là đủ để tiếp tục ở một phiên khác.
> Nhánh làm việc: **`feat/kg-ingest-v2.2`** (chưa commit, chưa merge vào `main`).

## 0. Phiên 2026-07-11 — hai gói bàn giao thiết kế + 4 yêu cầu trực tiếp (XONG)

1. **Gói `design_handoff_lion_motion`** đã lắp trọn: Lion.tsx bản bộ cảm xúc động
   (14 mood mới: happy/excited/diligent/focus/think/surprised/proud/miss/chaos/rebel),
   `lion-motion.css` import SAU globals trong `layout.tsx` (KHÔNG @import giữa file — css-loader
   bỏ qua), 4 sprite `turn-*.png`. Rebel xoay 4 frame thật, miss tim nứt 46%, đã nghiệm thu
   bằng mắt ở tab **Mascot** của `/demo`. 2 xung đột cascade đã gỡ (rule data-sprite scope về
   lion-idle; bỏ transition opacity trên .lion img). 3 ngoại lệ bounce-easing ghi vào
   `.impeccable/config.json` (character animation — giá trị chốt của gói).
2. **Gói `design_handoff_ai_tutor` (hi-fi 10 màn)** đã dựng qua 4 agent: token/font
   (Source Serif 4 + IBM Plex Sans) → cảnh trời-đồi 3a/3c (scene, banner serif, HUD pill môn
   + streak + XP, rail 92px, cột phải) → bài học 3b (chọn-rồi-KIỂM-TRA, ribbon ok/retry mới)
   → hoàn thành 4a (quầng 3 vòng, 3 thẻ stat, bar thành thạo) → 4b/4c/4d/4e/4f/4g.
   **AA thắng hi-fi** (chữ nhỏ #8296B4 → --muted) và **không bịa dữ liệu** (mọi số là thật,
   thiếu thì ẩn) — deviations đầy đủ trong output workflow `wf_029cf82b-a5e`.
3. **4 yêu cầu trực tiếp của chủ dự án (2026-07-11):**
   - **Node lộ trình = DẤU CHÂN SƯ TỬ** — `components/PawNode.tsx` (SVG tự vẽ: 1 đệm bàn
     + 4 ngón; 2 lớp mặt/đùn giữ phím vật lý; ring gold = silhouette phóng to). Mọi trạng thái
     giữ ngữ pháp hi-fi, chỉ đổi hình.
   - **Sư tử xưng MÌNH–BẠN** (bạn đồng hành): quét 29 chuỗi client + prompt LLM server
     (`_shared/prompts.ts` — guide/rubric/speaking) + PRODUCT.md chốt luật. Giáo viên thật
     trong dashboard vẫn thầy/cô–em.
   - **MỘT THẾ GIỚI**: bảng tuần + nhiệm vụ + tip sống TRONG `/learn` (mobile xếp dưới cảnh,
     ≥1200px cột phải); nav học sinh còn 4 tab (bỏ Hạng); `/scoreboard` giữ làm trang chi tiết.
   - **LOGIN HỎI VAI**: segmented "Bạn là ai?" (Học sinh/Giáo viên/Phụ huynh) → đăng nhập
     xong đáp đúng thế giới (`/learn` `/teacher` `/parent`); đích ghi `sessionStorage`
     (`va-login-dest`) để wrapper `/login/page.tsx` không đua redirect. Vai chỉ điều hướng —
     RBAC server vẫn gác quyền.
4. **Bổ sung cùng ngày (yêu cầu trực tiếp #2):**
   - **Node = ARTWORK dấu chân chính chủ** (`assets-src/mascot/df74c0d3…` → xử lý bởi
     `slice-paw.mjs`): `paw-check.png` (có tích V — node mastered) + `paw-plain.png`
     (đã xoá tích bằng tách component navy cô lập — các trạng thái khác, icon overlay
     neo tâm đệm, lệch đo được 1px). Đứng trên **đĩa ellipse 2 lớp "dày dặn"**
     (mặt/đùn theo --paw-face/--paw-edge, ring gold quanh node current) — PawNode.tsx.
   - **App-shell fit-to-viewport, KHÔNG thanh cuộn** ("1:1 với khung hình" — desktop
     16:9 choán màn, mobile co giãn): body khoá overflow, `.viewport` (layout.tsx) cuộn
     ngầm thanh ẩn mọi trình duyệt; màn Học siết thêm — `.scene` cao đúng phần màn còn
     lại, **chỉ `.path` cuộn bên trong**, banner + HUD + cổng chương đứng yên (gate ghim
     đáy nhờ margin auto). Đã đo: `innerWidth === clientWidth` (0 thanh cuộn) ở cả
     375×812 và 1280×720.
   - **Desktop FULL-BLEED** ("không bị gói gọn trong khung, nền mở rộng ra"): ≥900px màn
     Học bỏ max-width/padding của shell-main — cảnh trời-đồi chiếm TOÀN BỘ vùng phải rail
     (đo: scene = x92→1280, y0→720 trên màn 1280×720), HUD nổi tuyệt đối trên trời,
     banner/lời chào/cổng chương căn giữa 480–560px, ≥1200px cột phải NỔI TRÊN CẢNH
     (absolute, right 28) thay vì cột riêng trên nền phẳng. Chỉ áp cho `.learn-layout`
     (app thật) — /demo giữ khung xem trước cũ.
   - **MỘT TRANG thật sự (SPA)**: cả 5 khu (Học · Ôn tập · **Hạng** · Mục tiêu · Tôi) sống
     trong `/learn` — bấm tab đổi view TẠI CHỖ (đo bằng marker trên window: sống sót qua
     cả 5 tab = 0 lần reload). Tab Hạng TRỞ LẠI = ScoreboardBody đầy đủ (hết cảnh "thoát
     ra vô lại"). Kiến trúc: `view` state + `#hash` (replaceState + hashchange listener)
     trong TutorApp; view tách thành `ReviewView/QuestsView/ProfileView/ScoreboardBody`;
     `AppShell` nhận `onNavigate` (nút) — không có thì thẻ `<a>` trỏ `/learn/#<key>`
     (deep-link đã test: fresh-load với hash đáp đúng view + tab sáng đúng). Trang route
     cũ (/review /quests /profile /scoreboard) giữ làm wrapper mỏng cửa deep-link.
   - **CỔNG VÀO DUY NHẤT /login**: chưa đăng nhập → MỌI route redirect thật về /login
     (component `RedirectToLogin`, replace — đã test /, /learn, /scoreboard, /review);
     root `/` = bộ điều hướng theo vai (`roleHome` trong lib/auth: student→/learn
     THẲNG, teacher→/teacher, parent→/parent, khác→/app) — đã test: login học sinh đáp
     /learn, học sinh có phiên vào `/` cũng về /learn. Landing dời về **/gioi-thieu**
     (footnote PDPL của Login trỏ tới đó). /demo (công cụ thiết kế nội bộ) giữ công khai.
   - **BUG THẬT đã sửa (chủ dự án bắt được)**: màn bài học desktop vỡ nát — chữ xếp dọc
     từng ký tự. Nguyên nhân: chế độ làm bài (focus) ẨN nav nhưng lưới desktop
     `.shell { grid-template-columns: 92px 1fr }` vẫn chừa cột rail → toàn bộ bài học bị
     nhét vào track 92px đầu. Fix: cột rail chỉ tồn tại khi có nav (`.shell:has(> .nav)`).
     Đã đo lại bài học THẬT ở 1280×720: câu hỏi ngang 624px giữa màn, đáp án 3 ô/hàng,
     footer full-width; 4 tab còn lại đều chuẩn. BÀI HỌC RÚT RA cho phiên sau: nghiệm thu
     phải chạy XUYÊN luồng bài học thật ở cả desktop lẫn mobile, không chỉ màn lộ trình.
   - **Công thức hiển thị xấu trong hội thoại (chủ dự án bắt được)** — 3 tầng fix:
     (a) CLIENT (ăn ngay khi build): `renderRich` trong TutorApp — gỡ delimiter
     \\( \\) \\[ \\], \\frac→(a)/(b), \\neq→≠, \\text, **đậm**→<b>, và LỌC ghi chú
     soạn bài "(khuôn tham số: …)" lọt vào đề; test bằng đúng chuỗi transcript, 6/6 sạch.
     (b) PROMPTS (`_shared/prompts.ts`, cần deploy): cấm LLM dùng LaTeX/markdown, bắt
     ký hiệu đơn giản (x², √, -b/(2a)). (c) DIAGNOSE (cần deploy): loại câu
     `tham_so_hoa=true` khỏi phiên học — máy sinh tham số CHƯA TỒN TẠI nên đề khuôn
     đang phục vụ thô ({b}, {c} nguyên bản) cho học sinh thật. Việc mới sinh ra:
     **xây bộ instantiate tham số** (thay {x} + tính dap_an) rồi mở lại các câu khuôn.
   - **4 màn "y chang hi-fi" (mandate chủ dự án, ghi đè quy tắc ẩn-khi-thiếu-dữ-liệu)**:
     4a/4b/4c/4d giờ đủ MỌI khối như mock. CHÍNH SÁCH DỮ LIỆU: số của CHÍNH học sinh
     luôn thật (tên/hạng/XP/chuỗi/mastered/huy hiệu/phụ huynh đã liên kết — guardian_links
     thật); server chưa trả thì dùng SAMPLE đánh dấu rõ: `SAMPLE_CLASS`/`SAMPLE_GRADE`
     đầu Scoreboard.tsx (5 bạn cùng lớp/khối như mock — đổ danh sách server vào là
     rank/tint/nudge tự chạy). Nudge tính ĐỘNG từ bảng đang hiện ("vượt Đạt lên hạng 5").
     WIG: prop `wigTitle` (TutorApp truyền "Thành thạo chương <version_label>" khi
     learning-path live) + `wigDeadline` ISO (chưa có → dòng hạn hiện "mục tiêu học kỳ
     này", KHÔNG bịa ngày). Chip thưởng chưa định nghĩa mức → ghi "nỗ lực" thay số.
     WEEK_TARGET=5 buổi/tuần = hằng số chính sách 4DX. Thẻ "Thành thạo theo môn" bind
     subjectProgress THẬT (ẩn khi rỗng). 4a: thẻ thành thạo hiện label node thật.
   - **Phản hồi "20/100" của chủ dự án (2026-07-11)** → 3 việc: (1) LOGIN Y CHANG mock
     4e — màn 1 chỉ 2 nút (trường navy → bước 2 form; **Google = OAuth thật** qua
     signInWithOAuth, chưa bật provider thì báo thân thiện), BỎ hỏi vai (roleHome định
     tuyến theo vai thật — đã test đăng nhập HS đáp /learn); (2) DESKTOP PASS 4 tab
     ≥1200px (Hạng 2 cột bảng|4DX · Mục tiêu WIG full + 2 cột · Hồ sơ 4 ô ngang + 2 cột
     · Ôn tập 2 cột · shell 64rem) — đo DOM xác nhận; lưu ý specificity: section màn
     của agent nằm CUỐI file nên override phải dùng `.shell-main .x`; (3) **docs/ROADMAP.md**
     — lộ trình 6 giai đoạn 20→100 + MENU 8 widget làm giàu /learn chờ chủ dự án chọn
     (đề xuất: 3.1 Ôn nhanh + 3.3 Sắp mở khoá + 3.5 Buổi coach). Google OAuth cần bật
     provider trong Supabase dashboard.
5. **Còn ngỏ sau phiên này:** deploy 4 edge functions + `.env` (mục 2–3 bên dưới, giữ nguyên);
   soi mắt `/teacher` `/parent` bằng tài khoản đúng vai; `/demo` tab Bài học/Hoàn thành còn
   anatomy CŨ (CSS cũ giữ cho demo — đồng bộ sau); prompt LLM mình–bạn có hiệu lực khi deploy;
   các trang dài (Hồ sơ, dashboard GV) cuộn ngầm trong `.viewport` — nếu muốn chúng cũng
   khoá 1:1 từng vùng như màn Học thì làm tiếp theo cùng pattern (`flex:1 + overflow-y:auto`).

---

## 1. Bối cảnh: hai app, không phải một

| | **Studio** (`D:\school ai\studio`) | **Tutor** (`D:\tutor`, github `duong-edu/Tutor`) |
|---|---|---|
| Vai | Nhà máy sản xuất tri thức | Phòng học phục vụ học sinh |
| Sở hữu chân lý về | Cây tri thức, cạnh, học liệu | Người học: mastery, Leitner, hội thoại |
| Kho | `db.json` (lowdb-style, 15.595 node cây / 3.831 cạnh / 12.641 atom) | Supabase Postgres + RLS |

Nguyên tắc bất biến: không bên nào ghi vào miền của bên kia. Chi tiết:
`docs/INTEGRATION-STUDIO.md` (đặc tả dài hạn, vẫn đúng).

Tiến độ nội dung thật (quy trình 6 Trạm trên Google Drive): T1 100%, T2 51%,
T3/T4/T5 gần như chưa chạy — **nút thắt là câu hỏi + Socratic, không phải kỹ thuật**.

---

## 2. Việc đã làm phiên này — phần A: kéo khung tri thức Toán 9 + 10

**`packages/db/src/convert-studio-kg.ts`** (MỚI) — converter đọc thẳng `db.json` của
Studio, leo cây `parentId` lấy chương/cụm, chặn dữ liệu lỗi tại cửa, validate bằng đúng
Zod `KgBundle` của importer. Chạy không cần `.env`:

```
pnpm --filter @tutor/db convert:kg -- --grade=9   # → bundles/kg-bundle-toan-9.json
pnpm --filter @tutor/db convert:kg -- --grade=10  # → bundles/kg-bundle-toan-10.json
```

Kết quả đã kiểm định: **Toán 9 = 211 node + 273 cạnh; Toán 10 = 204 node + 312 cạnh.
0 chu trình, 0 node cô lập, 0 tham chiếu treo, LaTeX cân bằng 100%.** Metadata sư phạm
của cạnh (quanNiemSai/tanSuat/remediationHint/bloomGap) gói vào `ghi_chu`.
`nangLuc` của atom bị BỎ (KgNode chưa có chỗ) — muốn giữ phải nâng schema.
KHÔNG lọc theo cờ `verified` của Studio (cờ này chấm ngược nhau giữa atom và cạnh);
cổng chất lượng thật là review_queue phía Tutor.

**Importer đã vá 2 lỗi idempotency:** `resources` giờ upsert theo `resource_key`
(cột mới trong `kg-core-v22.sql`, unique index một phần), `review_queue` không xếp
hàng đôi mục pending. Chạy lại cùng file an toàn tuyệt đối.

### ⚠ Nạp thật đang chờ 2 thứ
1. **`D:\tutor\.env` chưa tồn tại** — mọi script db (`--env-file=../../.env`) fail ngay.
   Copy `.env.example` → `.env`, điền `SUPABASE_DB_PASSWORD` (hoặc `DATABASE_URL`).
2. Chạy `pnpm --filter @tutor/db apply` trước (áp `kg-core-v22.sql` mới có `resource_key`
   + `storage.sql` mới), rồi `import:kg` — **KHÔNG dùng `--activate`**: bundle khung
   0 câu hỏi, publish sẽ đè version seed đang có câu hỏi và làm rỗng luồng `diagnose`.

---

## 3. Việc đã làm phiên này — phần B: tầng phục vụ KG + học liệu

Trước phiên này **không một dòng code nào đọc `kg_nodes`/`kg_edges`/`resources`** —
lộ trình học sinh sinh từ localStorage. Đã xây:

- **`supabase/functions/learning-path`** (MỚI) — POST {subject} → version published mới
  nhất → tính trạng thái từng node: mastered/stale (so `node_revision` với
  `kg_nodes.revision` — cơ chế xanh/vàng docs §4)/locked (tiên quyết chưa thành thạo,
  kèm `blockedBy` bằng NHÃN)/available/current (đầu tiên theo topo Kahn, tiebreak
  chương→cụm→key). Logic thuần đã qua 14 test tại chỗ. Chiều cạnh xác minh:
  **from = tiên quyết, to = phụ thuộc**.
- **`supabase/functions/resources`** (MỚI) — resources active theo node, uri nội bộ ký
  signed URL 1h từ bucket riêng `learning-assets` (tạo bởi `packages/db/storage.sql`,
  đã vào danh sách `apply-sql.ts`).
- **`end-session`** stamp `node_revision` vào `student_node_state`; **`chat-turn`**
  stamp vào `mastery_evidence` (nơi duy nhất insert evidence).
- **Web hookup** (`lib/api.ts`, `TutorApp.tsx`): lộ trình ưu tiên server; **mọi lỗi rơi
  về hành vi cũ y hệt** (function chưa deploy → app chạy như hôm qua). `ResourceViewer`
  (MỚI): mục "Tài liệu" theo node — iframe sandbox `allow-scripts` cho HTML tự chứa,
  audio/PDF/tải về theo format; rỗng thì tự ẩn.

### ⚠ Chưa deploy được từ máy này
Không có deno/supabase CLI. Cần: `supabase functions deploy learning-path resources
end-session chat-turn` (config.toml đã khai verify_jwt). Lần deploy đầu là lần type-check
Deno thật đầu tiên.

### Lỗ hổng thiết kế còn mở (ghi nhận, chưa sửa)
- `teacher-review` chỉ duyệt được question/ladder — **chưa có cơ chế duyệt kg_nodes hay
  publish kg_versions** → nội dung nạp draft không có đường lên sóng ngoài `--activate`.
- `diagnose` đổ **toàn bộ** ngân hàng câu hỏi active của version vào một session — ổn với
  3 node seed, vỡ với đồ thị 211 node. Cần scope theo node trước khi publish Toán 9.
- `kg_versions` không có cột grade; `diagnose` lấy version published mới nhất theo môn →
  Toán 9 và Toán 10 chưa thể cùng published. Cần nghĩ trước khi publish thật.

---

## 4. Việc đã làm phiên này — phần C: redesign "Sân trường buổi sáng"

Chủ dự án chê bản cũ ("Lớp học buổi tối") *trầm mặc, đơn điệu, icon vô hồn* → redesign
toàn bộ theo hướng đã chốt trực tiếp: **tươi rực rỡ**. `DESIGN.md` viết lại toàn phần —
đọc nó trước khi đụng UI. Điểm neo:

- Canvas = **trời sáng** `#EDF3FB`, thẻ trắng nổi bằng bóng (hết rừng viền xám 2px —
  viền 2px chỉ còn trên control tương tác).
- Bảng màu mở rộng **từ art linh vật**: `--mane` cam bờm (≠ `--warn`!), `--sky`,
  `--grass`. Nav 5 tab 5 họ màu (icon active trong viên tint); HUD chip tint theo nghĩa;
  banner chương sky + mặt trời gold + mây; node available họ sky.
- Focus ring: gold trên bề mặt navy (sửa nợ cũ). Dark mode = "bầu trời đêm ấm".
- Contrast đo thực tế 4.8–10.5:1; console sạch; build PASS.

**Mascot cử động được** (yêu cầu trực tiếp kèm bộ kit 6 sheet):
- Sheet gốc ở `assets-src/mascot/` + script cắt `slice.mjs` (flood-fill nền từ mép nên
  mắt trắng còn nguyên; un-blend viền; lọc glyph nhãn + mảnh tràn ô) → **29 sprite**
  tại `apps/web/public/brand/lion/`.
- `Lion.tsx` v2: chớp mắt thật (hoán frame 140ms mỗi 3–6s — đã đo sống bằng
  MutationObserver), khẩu hình nói (`talking`), 18 mood (idle/thinking/cheer/sleepy cũ +
  greet/study/idea/success/confused/notify/trophy/…), `variant="full"` nâng
  idle→pose-wave. Mọi call-site cũ tương thích nguyên vẹn.
- `lion-full.png`/`lion-head.png` cũ ngừng dùng (giữ file làm tư liệu thương hiệu).

Màn phụ đã phủ từ vựng mới (3 agent song song): Landing (tile màu theo chức năng),
Login (sư tử toàn thân trên đồi + dõi chuột), Ôn tập (họ sky), Mục tiêu (họ cỏ, thẻ xong
= huy hiệu gold), Hồ sơ (thẻ định danh, họ mane), RoleHub (tile theo vai), Scoreboard
(đã chuẩn sẵn — diff rỗng là CHỦ ĐÍCH).

### Xem lại giao diện
```bash
# Preview cách ly (không đụng dev server đang chạy của bạn trên :3000):
# .claude/launch.json đã cấu hình NEXT_DIST_DIR=.next-preview
# Build tay thì PHẢI cách ly dist: NEXT_DIST_DIR=.next-build pnpm --filter @tutor/web build
```
`/demo` không cần đăng nhập — đủ 4 màn: Lộ trình · Bài học · Trả lời sai · Hoàn thành.
⚠ Phiên này có MỘT lần lỡ build trần vào `.next` lúc dev server của chủ dự án đang chạy —
nếu server đó trắng trang (`Cannot find module './147.js'`), restart nó sau khi
`rm -rf apps/web/.next`.

---

## 4b. ĐANG DỞ TAY: tận dụng trọn bộ sprite mascot (kế hoạch đã chốt, CHƯA code)

Người dùng hỏi "đã tận dụng hết các hình chưa" — trả lời thật: **chưa**. 29 sprite đã
đăng ký đủ trong map `MOOD` của `Lion.tsx`, nhưng mới ~8 sprite có call-site thật.
Kế hoạch nối phần còn lại đã phân tích xong, phiên sau chỉ việc code theo danh sách:

### Hiện trạng sử dụng
- **Đang sống trên màn:** `pose-wave` (hero lộ trình + Login + Landing + RoleHub),
  `head-smile`+`head-content` (idle + chớp mắt), `head-think` (gợi ý + quests),
  `pose-celebrate` (màn hoàn thành), `head-sleep` (trạng thái rỗng / streak nguội).
- **Có trong MOOD nhưng 0 call-site:** toàn bộ 9 `scene-*`, `pose-thumbsup/point/read/run/laptop`,
  `head-talk` (khẩu hình nói — prop `talking` chưa ai truyền), `head-sad/confused`, `pose-ponder`.
- **Chưa vào MOOD:** `head-laugh/wink/surprised/curious/speak` (5 đầu dự trữ).
- **Chủ đích KHÔNG cắt:** sheet turnaround + 2 bảng tổng hợp (bản chibi/đeo kính là
  biến thể nhân vật KHÁC — trộn vào là vỡ tính nhất quán; chỉ dùng tham chiếu).

### Việc cần làm (quyết định đã chốt, làm đúng thứ tự)
1. **`Lion.tsx`**: thêm 3 mood — `welcome`=scene-welcome, `party`=scene-celebration,
   `thumbsup`=pose-thumbsup; thêm prop `talkFor?: number` (tự "nói" N ms khi mount,
   chỉ tác dụng với mood dạng đầu — dùng lại effect `talking` sẵn có).
2. **`TutorApp.tsx`**:
   - Màn hoàn thành **3 bậc phần thưởng** (hiếm mới có nghĩa):
     `masteredNow === finished.nodes.length && masteredNow > 0` → `party` (confetti trong art);
     `masteredNow > 0` → `trophy` (scene-achievement); còn lại → `cheer` như cũ.
   - Dòng "Đang chuẩn bị buổi học…" (khi `busy`) → thêm `<Lion mood="study" size={88} decorative />`
     (sư tử đọc sách trong lúc chờ diagnose).
   - Khối GỢI Ý SOCRATIC: `thinking` → **`idea`** (scene bóng đèn + chỉ tay — đúng nghĩa
     "có gợi ý đây"), size 64→72.
   - Hero lộ trình lần ĐẦU (doneCount===0): truyền `heroMood="welcome"`, còn lại `"idle"`.
3. **`LearningPath.tsx`**: thêm prop `heroMood?: LionMood` (default `"idle"`), dùng cho
   `<Lion mood={heroMood} variant="full" size={108}>` trong `.lion-scene`.
4. **`app/review/page.tsx`** (~dòng 56): lion bong bóng `idle` 72 → **`notify`** 96
   (chuông = "có điểm chờ ôn"); empty state giữ `sleepy`.
5. **`app/quests/page.tsx`**: `allDone = quests.every(q => q.now >= q.goal)` →
   mood `thumbsup` + câu riêng ("Tất cả mục tiêu hôm nay xong…"); lion đầu thêm
   `talkFor={1200}` (mood idle là dạng đầu → head-talk lần đầu có đất sống).
6. **`components/Scoreboard.tsx`** (~dòng 75): `idle` → **`run`** (bảng ĐUA NỖ LỰC —
   sư tử chạy đúng nghĩa đen).
7. **`components/ResourceViewer.tsx`**: tiêu đề `.res-title` thêm `<Lion mood="read" size={44} decorative />`
   cạnh icon BookOpen (giữ lucide cho coherence bộ icon, lion là điểm nhấn).
8. **`app/demo/page.tsx`**: hint `thinking`→`idea` (~dòng 143); done `cheer`→`trophy`
   (~dòng 216, khớp logic 3 bậc: demo data = 1/2 mastered).
9. **Dự trữ CÓ CHỦ ĐÍCH, đợt này không wire** (ghi lại để khỏi tranh cãi lại):
   `head-laugh/wink/surprised/curious/speak/sad/confused` — cảm xúc hội thoại cho tutor
   chat sau này; `pose-point/laptop` — empty state khu giáo viên (TeacherDashboard);
   `scene-reminder/support/success` — chờ ngữ cảnh thật (lịch Leitner server / trang trợ
   giúp / khoảnh khắc xác nhận), đừng nhét bừa.
10. **Kiểm sau khi code:** build cách ly `NEXT_DIST_DIR=.next-build pnpm --filter @tutor/web build`
    (KHÔNG build trần — dev server của chủ dự án dùng `.next`); preview duyệt mắt
    `/demo` (4 tab) + `/quests` (seed `localStorage['va-tutor-progress']` với
    `lastDay=hôm nay` để thấy idle+talk) + `/review`; console phải sạch.

---

## 5. Còn lại — thứ tự đề xuất

1. **Điền `.env`** → `apply` → `import:kg` hai bundle (mục 2) → deploy 4 edge functions
   (mục 3) → smoke-test `/learn`: lộ trình server thay fallback localStorage.
2. **Cơ chế duyệt node + publish version** (mở rộng teacher-review) và **diagnose scope
   theo node** — điều kiện để Toán 9 lên sóng thật.
3. Soi 8 màn vai trò còn lại bằng tài khoản đúng vai (`/coach` `/parent` `/buddy`
   `/subject-lead` `/counselor` `/leadership` `/dpo` `/admin`) — token mới đã brighten
   nhưng chưa redesign chi tiết.
4. Kéo tiếp các môn có cạnh đã duyệt (Toán 12, Vật lí) khi cần — converter dùng lại được
   (`--grade`, subject hiện hardcode Toán, mở rộng nhỏ).

**Nợ kỹ thuật đã biết:** 14 lỗi typecheck sẵn có ở `seed-auth.ts`/`seed-demo-users.ts`
(không do các đợt này); `.option` dùng `aria-pressed` thay vì radiogroup; `SpeakBox`
setLevel mỗi khung hình; `.env.example` + `n8n/workflows/WF-EndSession.json` còn lộ URL
Supabase thật — **dọn trước khi mở public repo**. Sprite `head-content` (frame chớp mắt)
có sparkle nhỏ — nếu thấy lạ mắt thì đổi frame chớp sang art khác trong `MOOD` map.

---

## 6. Tài liệu liên quan trong repo

- `PRODUCT.md` — người dùng, mục đích, 5 nguyên tắc sư phạm (không tim/mạng, amber không
  đỏ, thưởng nỗ lực…) — VẪN là luật.
- `DESIGN.md` — hệ thị giác "Sân trường buổi sáng" (MỚI toàn phần).
- `docs/INTEGRATION-STUDIO.md` — đường biên Studio ↔ Tutor, contract 3 endpoint,
  cơ chế xanh/vàng.
- `docs/APP-OVERVIEW.md`, `docs/RBAC*.md`, `docs/USER-JD-WORKFLOWS.md` — như trước.
