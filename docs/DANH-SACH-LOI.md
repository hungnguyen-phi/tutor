# DANH SÁCH LỖI — đợt rà 28/07/2026

> 📋 **Phân nhóm + phương án sửa: xem [KE-HOACH-SUA-LOI.md](KE-HOACH-SUA-LOI.md)**
> (7 nhóm theo gốc chung · trình tự 5 đợt · 3 quyết định cần chủ dự án).
> File này là **danh mục lỗi**; file kia là **kế hoạch**.

> Trạng thái: **CHỈ GHI NHẬN + phương án.** Chưa sửa dòng nào, chưa deploy.
> Chủ dự án ra lệnh "sửa" thì mới bắt tay; ra lệnh "deploy" thì mới đẩy.
> Người báo: chủ dự án (tài khoản `hs1@vietanh.edu.vn` — "Nguyễn An", và `gv1@vietanh.edu.vn` — Cô Trần Thu).
>
> ⚠️ **DÒNG TRẠNG THÁI TRÊN ĐÃ CŨ cho lỗi 1–19.** [KE-HOACH-SUA-LOI.md](KE-HOACH-SUA-LOI.md)
> ghi nhận 7 nhóm A–G **đã code + deploy xong ngày 29/07** (commit `4506fb7` … `629db66`,
> 3 vòng rà đối kháng) — nhưng bài viết TỪNG LỖI bên dưới không được cập nhật lại theo.
> Rà lại bằng git log + đọc mã ngày 30/07 xác nhận **11/19 lỗi đã có bằng chứng sửa trong
> code hiện hành**: #2 (nút làm lại + lời nhắn GV + vào đúng câu), #3 (đọc `review-queue`
> server), #4 (giữ chỗ tên), #6 (nhãn "điểm thành thạo"), #7 (hết `ThemeToggle`), #10
> (sư tử `cheer` khi đúng), #12 (hâm nóng edge fn), #14 phần giao diện (nút "Xin sư tử
> gợi ý" tách khỏi ô đáp án), #15 (bong bóng học sinh render), #16 (`normText` đổi
> `0,2→0.2`), #17 (ô kết luận trong bước cuối). Lỗi trùng số **20** ở mục "ĐỢT SAU DEPLOY
> 29/07" (màn nộp bài trắng) cũng đã sửa (commit `6e73e53`) — **nhưng gốc rễ thật khác
> hẳn giả thuyết ghi trong mục đó**: không phải LessonView crash, mà phiên đăng nhập hết
> hạn (401) bị nuốt thành màn trắng im lặng.
>
> **Còn thật sự CHƯA sửa / chưa xác nhận** (đọc kỹ nội dung gốc bên dưới, đừng suy diễn
> đã xong theo nhóm A–G): #1 (cần đọc kỹ xem Nhóm E đã làm hết phần nộp-từ-kho-báu chưa),
> #5 (lỗi DỮ LIỆU — cần 1 câu UPDATE, **chủ dự án tự chạy**, không phải việc code), #8
> lớp 2–3 (bắt AI cân nhắc kỹ hơn + tước quyền AI ghi mastery câu tự luận — lớp 3 doc gốc
> ghi rõ "cần chủ dự án quyết trước khi làm"), **#9** (chấm sai→đúng ở câu khách quan +
> lộ đáp án — **nặng nhất, doc gốc tự ghi "chưa điều tra — cần lệnh mới được đụng mã"**,
> chưa có bằng chứng nào cho thấy đã sửa), **#11** (câu nhiều bước không ổn định, cùng
> nghi phạm với #9), #18 (đã thấy có xử lý trong `RoleViews.tsx` nhưng chưa đọc kỹ đủ để
> chắc), #19 (chuỗi cứng "Gần được rồi — còn thiếu" đã KHÔNG còn trong code — nhiều khả
> năng đã đổi cùng đợt 29/07, nhưng chưa kiểm bằng kịch bản thật).

## Bảng tổng — thứ tự đề nghị xử lý

| # | Lỗi | Gốc rễ (một dòng) | Mức | Sửa ở đâu | Công sức |
|---|-----|-------------------|-----|-----------|----------|
| 20 | ✅ 30/07 Đối thoại dắt vòng vòng — "chốt C" không chốt được | Kênh chat và kênh chấm là hai đường CỤT → đã bắc cầu `chatAnswerOf` + luật chốt trong guide | 🔴 P0 | web + `chat-turn` — **chờ deploy** | M |
| 21 | ✅ 30/07 Sư tử chat giọng robot ("Ừ," + "—" dày đặc, từ cứng) | Danh-sách-đen 29/07 → mô hình đổi nạng; đã thay bằng luật tổng quát + luật dấu câu + thanh ghi | 🟠 P1 | `chat-turn` — **chờ deploy** | S–M |
| 22 | ✅ 30/07 Dấu căn mất gạch ngang, chỉ còn móc "v" | √ UNICODE trong `$...$` đi thẳng vào KaTeX (chẩn đoán đầu đổ cho reset là SAI) → `normalizeTex` | 🟠 P1 | web — **chờ deploy** | S |
| 9(a) | ✅ 30/07 Chấm SAI thành ĐÚNG ở câu khách quan | BỐN lỗ trong `cas.ts` (nét phủ định bị NFD xoá · phẩy thập phân thành tập · mất tên biến · so bất PT bằng lấy mẫu). Quét bank sống: **32 nhiễu chấm đúng → 2, 0 hồi quy** | 🔴 P0 | `chat-turn` — **chờ deploy** | M |
| 9(b) | ✅ 30/07 Lộ đáp án qua `quan_niem_sai` | `safeMisconception` nhận thêm đáp án, cắt đúng mệnh đề chứa nó. Đo bank sống: **99,2% chẩn đoán giữ nguyên, 30 bị cắt và đều lộ thật** | 🔴 P0 | `chat-turn` — **chờ deploy** | S |
| 9(c) | ✅ 30/07 Không nói vì sao sai | Nhánh `require_thinking` không dùng `matched` đã tính sẵn → câu dự phòng nay mang chẩn đoán | 🔴 P0 | `chat-turn` — **chờ deploy** | S |
| 5 | Trang Hạng trống trơn, không có hạng khối | Tài khoản "Nguyễn An" **thiếu `grade` + `class_id`** → server không dựng nổi bảng | 🔴 P0 | DB + edge fn + web | S (dữ liệu) + M (code) |
| 8 | Học sinh gõ "ok" mà AI bảo "đủ ý chính" | LLM chấm **không ổn định**; không có chốt chặn tất định cho bài rác | 🔴 P0 | `chat-turn` | M |
| 3 | Trang Ôn tập luôn "Chưa có gì để ôn" | View đọc **localStorage**, số thật nằm ở server; lịch ôn `next_review_at` **đã có trong DB** nhưng không ai đọc | 🔴 P0 | edge fn mới + web | M–L |
| 2 | Thẻ "1 bài cần làm lại" bấm không được | Thẻ là `<div>` tĩnh, không mang `nodeKey`/`questionId` sang | 🟠 P1 | web + `learning-path` | M |
| 1 | Học liệu xấu, xem không hết, không nộp lại được | Khung xem bị kẹp cứng 360px; **không hề có đường nộp bài trong màn Kho báu** | 🟠 P1 | web (+ `resources`) | M–L |
| 6 | Huy hiệu "5 điểm" mà 705 XP vẫn khoá | Mốc đếm theo **điểm thành thạo** (đang 3), nhãn chỉ ghi "điểm" → đọc nhầm là XP | 🟡 P2 | web | S |
| 4 | Tiêu đề nhảy "của bạn" → "của An" | Hero vẽ ngay khi chưa có tên, không chờ dữ liệu | 🟡 P2 | web | S |
| 7 | Bỏ giao diện tối | Còn 2 cửa bật: nút trên thanh nav + mục trong Cài đặt | 🟡 P2 | web | S |

Ba lỗi 3 · 5 · 6 **chung một căn bệnh**: mỗi màn hình đọc một nguồn số khác nhau
(localStorage / `student_node_state` / `scoreboard`), nên cùng một học sinh mà
Hồ sơ nói "3 điểm thành thạo", Ôn tập nói "0", Hạng nói "chưa có gì".

---

## 1. Học liệu: UI/UX xấu, nhúng không xem hết, không có đường nộp lại

**Triệu chứng.** Màn Kho báu → "Phiếu bài tập": PDF nằm trong một khung thấp,
có thanh cuộn dọc + ngang riêng, đọc rất khổ. Tải về làm xong thì **không có
chỗ nào để tải bài lên chờ chấm**.

**Gốc rễ.**
1. Khung xem bị kẹp cứng: `apps/web/app/globals.css` — `.kb .lsv-frame { height: 360px; max-height: 360px }`
   (chính em vừa hạ xuống 360px sáng nay để nút không bị đẩy khỏi màn hình).
   Với PDF A4 thì 360px ≈ 1/3 trang → sinh ra cuộn lồng cuộn.
2. PDF dựng bằng `<embed type="application/pdf">` ([LessonView.tsx:176](apps/web/components/LessonView.tsx:176)) —
   trình xem mặc định của trình duyệt, không điều khiển được zoom/fit, trên
   điện thoại nhiều máy còn không mở.
3. **Không có nộp bài ở đây.** Toàn bộ đường nộp (gõ / chụp ảnh / tải tệp) chỉ
   tồn tại trong luồng CÂU HỎI `[NOPBAI]` ở [TutorApp.tsx:691](apps/web/components/TutorApp.tsx:691),
   dùng API `submitWork` ([api.ts:188](apps/web/lib/api.ts:188)). `KhoBauView` →
   `LessonView` chỉ có "Tải về" và "Mở tab mới" — hết.

**Giải pháp đề nghị.**
- *Xem cho ra hồn:* bỏ trần 360px, cho khung PDF cao theo viewport
  (`height: min(78vh, 900px)`) + nút "Toàn màn hình" (Fullscreen API) + giữ
  "Mở tab mới" làm đường thoát. Cân nhắc `<iframe>` thay `<embed>` để thêm
  `#view=FitH` (fit chiều ngang) — hết cuộn ngang.
- *Nộp bài từ học liệu:* thêm khối "Làm xong rồi? Nộp cho thầy cô" ngay dưới
  học liệu dạng `worksheet`. Dùng lại nguyên `submitWork` + `uploadBaiLam` sẵn
  có (input `capture="environment"` để chụp thẳng bằng điện thoại).
  ⚠️ Ràng buộc: `submitWork` bắt buộc có `questionId` và câu đó phải mang nhãn
  `[NOPBAI]` ([chat-turn/index.ts:734](supabase/functions/chat-turn/index.ts:734)).
  Phiếu bài tập KHÔNG phải một câu hỏi → cần một trong hai:
  (a) `resources` trả kèm `questionId` của câu `[NOPBAI]` cùng node để gắn bài nộp vào, hoặc
  (b) nới `submissions` cho phép `question_id = null` + `resource_id` (đổi schema, nặng hơn).
  Nghiêng về (a): không đụng schema, và bài nộp vẫn đi đúng vào hàng chờ chấm của giáo viên.
- *Thẩm mỹ:* thẻ chọn học liệu hiện là hàng nút vuông đơn điệu — gom thành
  hàng chip có icon + thời lượng, và bỏ chữ "Bậc 1" (học sinh không hiểu "bậc").

---

## 2. Thẻ "Thầy cô đã chấm — 1 bài cần làm lại" bấm không vào

**Triệu chứng.** Thẻ đỏ hiện trên lộ trình, bấm vào không có gì xảy ra; không
biết bài nào, càng không biết CÂU nào phải làm lại.

**Gốc rễ.** [LearningPath.tsx:379](apps/web/components/LearningPath.tsx:379) —
thẻ là `<div className="redo-notice" role="status">`, không phải nút/link, không
có `onClick`. Dữ liệu thì có sẵn: `redoNodes` biết `key` + `label` của node.
Còn CÂU nào thì server biết mà không trả ra: `learning-path` gom
`latestByQuestion` rồi chỉ đếm số lượng theo node
([learning-path/index.ts:215-226](supabase/functions/learning-path/index.ts:215)),
`question_id` bị vứt đi.

**Giải pháp đề nghị.**
- Server: `learning-path` trả thêm `redoQuestionIds: string[]` cho mỗi node (dữ liệu đã có trong tay, chỉ là không map ra).
- Web: đổi thẻ thành `<button>`; bấm → mở đúng node đó (`diagnose(subject, nodeKey)` — [api.ts:165](apps/web/lib/api.ts:165)).
  Nhiều bài thì mỗi tên bài là một nút riêng.
- Vào đúng CÂU: `diagnose` nhận thêm tham số `questionId` và phục vụ câu đó
  trước tiên. Không có tham số thì giữ nguyên hành vi cũ.
- Kèm theo: hiện luôn **lời nhắn của giáo viên** khi chấm "cho làm lại" (đang
  lưu trong `submissions.feedback` nhưng học sinh chưa bao giờ thấy) — không thì
  em làm lại mà không biết mình sai chỗ nào.

**🔺 NÂNG MỨC (29/07) — người thử xác nhận, đây là phần đau nhất của lỗi này.**
> Người thử 1, nhật ký: *"Trên màn hình có hiển thị thông báo là giáo viên yêu cầu làm
> lại một điểm kiến thức, **tuy nhiên chưa đưa ra được nhận xét học sinh cần cải thiện
> gì** ở điểm kiến thức đó."*
> Mong muốn: *"Nên có nhận xét học sinh cần cải thiện gì, vì học sinh phải biết mình sai
> ở đâu, sai những gì để tập trung cải thiện phần đó **thay vì phải làm lại từ đầu**."*

Và vế thứ ba, người thử nêu ở phần câu hỏi mở — **nặng hơn cả hai vế trên**:
> *"Khi học sinh vào làm lại thì sẽ được **làm lại TỪ ĐẦU thay vì tập trung vào phần
> bạn ấy sai. Làm lại toàn bộ sẽ dễ gây hoang mang.**"*
> (trả lời câu *"chỗ nào học sinh lớp 10 sẽ khựng lại"*)

Vậy lỗi 2 thực chất là **ba lớp chồng nhau**, phải sửa đủ cả ba mới hết:
1. Không thấy **lời nhắn của giáo viên** → không biết sai gì.
2. Bấm thẻ **không vào được** → không biết bài nào.
3. Vào rồi thì **phải học lại cả bài từ đầu** → mất công, và nản.

Thứ tự ưu tiên trong lỗi này: **(1) hiện lời nhắn → (3) chỉ làm lại đúng câu bị trả →
(2) điều hướng từ thẻ.** Nâng lỗi 2 từ P1 → **P0**.
(Người thử tự chấm "Chặn hẳn"; thực tế không chặn đường đi, nhưng chặn đường HỌC —
nên bản chất vẫn là P0.)

---

## 3. Trang Ôn tập luôn "Chưa có gì để ôn"

**Triệu chứng.** Làm bao nhiêu bài cũng vậy: `/learn/#review` hiện "0 đã thành
thạo" + "Chưa có gì để ôn", trong khi tab Tôi cùng lúc hiện "3 điểm thành thạo".

**Gốc rễ (bằng chứng cứng).**
- `ReviewView` đọc `G.loadMastered()` = **localStorage** `va-tutor-mastered`
  ([ReviewView.tsx:44](apps/web/components/ReviewView.tsx:44)).
- Khoá đó **chỉ được ghi một lần duy nhất**: khi kết thúc trọn một buổi học
  ([TutorApp.tsx:794-796](apps/web/components/TutorApp.tsx:794)). Học nửa chừng
  rồi thoát, hoặc đổi trình duyệt/máy → mãi mãi rỗng.
- Trong khi `ProfileView` đọc thẳng server `student_node_state`
  ([ProfileView.tsx:62-70](apps/web/components/ProfileView.tsx:62)) → ra 3.
- Truy DB prod: `Nguyễn An` có **3 node `mastered = true`** (KC-5110642,
  KC-3348179, KC-0570467, cùng cập nhật 28/07 05:38).
- 🎯 **Điểm quan trọng nhất:** bảng `student_node_state` **ĐÃ CÓ SẴN** cột
  `leitner_box` và `next_review_at`, và `end-session` **đang ghi thật**
  ([end-session/index.ts:86-87](supabase/functions/end-session/index.ts:86),
  [_shared/mastery-state.ts:57-58](supabase/functions/_shared/mastery-state.ts:57)).
  Toàn DB: 16 dòng có `leitner_box`, 4 dòng đã có `next_review_at`.
  Nghĩa là **động cơ ôn tập đã chạy từ lâu, chỉ chưa có ai mở cửa cho học sinh xem.**
  `teacher-stats` thậm chí đã đọc `next_review_at` để đếm "due" cho giáo viên.

**Giải pháp đề nghị (Duolingo-style, làm được ngay vì hạ tầng đã có).**
- Endpoint mới `review-queue` (hoặc thêm `action: "review"` vào `learning-path`):
  trả các node có `next_review_at <= now()` + số ngày quá hạn + `leitner_box`.
- `ReviewView` bỏ hẳn localStorage, đọc server. Ba khối:
  **"Đến hạn hôm nay" (N thẻ)** · "Sắp tới hạn" · "Đã thuộc chắc".
- Nút "Ôn ngay" mở một **phiên ôn thật** (câu của đúng node đó, không cho XP
  mastery mới nhưng có XP nỗ lực), ôn đúng → `leitner_box + 1`, hẹn lại xa hơn;
  sai → về hộp 1. Việc này `_shared/mastery-state.ts` gần như đã làm sẵn.
- Màn rỗng chỉ hiện khi **thật sự không có gì đến hạn**, và nói rõ "Hôm nay
  chưa tới hạn ôn — quay lại ngày mai" + ngày gần nhất, thay vì "chưa có gì".
- Huy hiệu số trên tab Ôn tập (badge "3") để em biết có việc — đây mới là thứ
  làm Duolingo dính.

---

## 4. Tiêu đề bảng tuần nhảy "của bạn" → "của An" sau ~1 giây

**Triệu chứng.** Vào `/learn/#scoreboard` thấy "Bảng tuần của bạn", 1 giây sau
đổi thành "Bảng tuần của An".

**Gốc rễ.** [Scoreboard.tsx:82](apps/web/components/Scoreboard.tsx:82) —
`myName = Prefs.displayNameOf(sb?.student.name ?? profile?.full_name) ?? "bạn"`.
Hero (dòng 213) nằm **ngoài** guard `{sb && …}` nên vẽ ngay lập tức, lúc đó
`sb = null` và `profile` chưa về → rơi vào chuỗi dự phòng `"bạn"`. Khi API trả
về thì tiêu đề thay chữ → giật.

**Giải pháp đề nghị.** Giữ chỗ thay vì đoán: khi chưa biết tên thì tiêu đề là
**"Bảng tuần"** (không có "của ai"), hoặc dựng skeleton cho riêng dòng tiêu đề.
Tuyệt đối không dùng "bạn" làm giá trị tạm rồi thay bằng tên thật.
*Cùng lỗi này còn ở* `ProfileView` (`?? "Học sinh Việt Anh"`) và mọi chỗ dùng
`firstName` trong câu động viên — rà một lượt.

---

## 5. Trang Hạng không có dữ liệu: không hạng khối, bảng tuần trống

**Triệu chứng.** Làm rất nhiều bài rồi mà bảng tuần trống, hạng khối không có.

**Gốc rễ (bằng chứng cứng từ prod).** Đây là lỗi **DỮ LIỆU**, không phải lỗi hiển thị:

| Tài khoản | `grade` | `class_id` | XP tuần này |
|---|---|---|---|
| **Nguyễn An** (`hs1@vietanh.edu.vn`) | **null** | **null** | **640** |
| Học sinh thử A/B/C (`hs1..3@truongvietanh.com`) | 10 | 10A1 | 0 / 200 / 80 |

Trong `scoreboard/index.ts`:
- Bảng khối truy `.eq("grade", prof?.grade ?? "")` → với An thành `grade = ""` → **0 người**.
- Bảng lớp cần `class_id` → null → **bỏ qua hoàn toàn**.
- Cả hai bảng cần **≥ 2 người** mới dựng ([scoreboard/index.ts:220-221](supabase/functions/scoreboard/index.ts:220)),
  không đủ thì trả `null` → UI rơi vào nhánh `coldStart` = "Bảng tuần đang chờ
  buổi học đầu tiên" — **nói sai sự thật**, vì em đã có 640 XP tuần này.
- `effort.rank` cũng null theo → ô "hạng khối" hiện `–`.

**Giải pháp đề nghị (ba lớp, làm cả ba).**
1. **Dữ liệu (nhanh nhất, sửa được ngay):** gán `grade = '10'` và `class_id` =
   10A1 (`d6ecdfd2-…`) cho `Nguyễn An`. Chỉ sau việc này bảng đã có 4 người và
   hiện đúng. → 1 câu UPDATE, chủ dự án tự chạy.
2. **Chặn tái phát:** `admin-roster` / luồng tạo tài khoản phải **bắt buộc** có
   khối + lớp cho `role='student'`; thêm ràng buộc CHECK ở DB thì chắc hơn.
3. **Trung thực khi thiếu:** `scoreboard` phân biệt rõ ba trạng thái —
   *chưa xếp lớp* ≠ *lớp chưa đủ người* ≠ *cả lớp chưa ai học*. UI hiện đúng
   câu tương ứng ("Em chưa được xếp vào lớp — báo thầy cô nhé") thay vì mượn
   màn cold-start cho cả ba. Đang có 640 XP mà bị bảo "chờ buổi học đầu tiên"
   là kiểu sai làm học sinh mất tin vào toàn bộ phần thưởng.

---

## 6. Huy hiệu chương: 705 XP mà không mở khoá cái nào

**Triệu chứng.** Bốn ô huy hiệu ghi "5 điểm · 10 điểm · 15 điểm · 20 điểm", cả
bốn đều khoá, dù đã 705 XP.

**Gốc rễ.** [ProfileView.tsx:25](apps/web/components/ProfileView.tsx:25) —
`BADGE_STEP = 5`, mốc đếm theo **điểm thành thạo** (`masteredCount`, hiện = 3),
**không phải XP**. Nhãn chỉ ghi chữ "điểm" trống không, mà ngay bên cạnh là ô
"705 tổng XP" → đọc thành "5 điểm XP". Chữ giải thích chỉ nằm trong `title=`
(tooltip hover) — điện thoại không có hover, tức là **vô hình với đa số người dùng**.

**Giải pháp đề nghị.**
- Nhãn viết đủ: **"5 điểm thành thạo"**, và thêm dòng tiến độ thật dưới cụm
  huy hiệu: *"Bạn có 3/5 điểm thành thạo — còn 2 điểm nữa là mở huy hiệu đầu tiên."*
- Hạ mốc đầu xuống **1 điểm thành thạo** ("Điểm đầu tiên") để có phần thưởng
  sớm; mốc sau 3 · 5 · 10 · 20.
- Bổ sung huy hiệu **theo nỗ lực** (chuỗi 3/7/30 ngày, 500/1000 XP) cho khớp
  triết lý "thưởng nỗ lực, không thưởng điểm" — hiện toàn bộ huy hiệu đang
  thưởng kết quả, đi ngược tinh thần của chính app.

---

## 7. Bỏ giao diện tối

**Yêu cầu.** Ẩn/bỏ hẳn, không cần nữa.

**Hiện đang có 2 cửa bật + 2 nơi áp dụng.**
- Nút mặt trăng trong thanh nav: [AppShell.tsx:89](apps/web/components/AppShell.tsx:89) (`<ThemeToggle />`).
- Mục chọn Sáng / Tối / Theo máy trong Cài đặt: [SettingsView.tsx:406-414](apps/web/components/SettingsView.tsx:406).
- `Prefs.applyToHtml()` gắn `data-theme` lên `<html>` ([prefs.ts:118](apps/web/lib/prefs.ts:118)) + script bootstrap trong `app/layout.tsx`.
- CSS nền tối nằm rải trong `globals.css` theo `[data-theme="dark"]`.

**Giải pháp đề nghị.** Làm **mức tối thiểu, an toàn**: gỡ `<ThemeToggle />`
khỏi nav, gỡ nhóm radio khỏi Cài đặt, và ép `getTheme()` luôn trả `"light"`
(bootstrap không gắn `data-theme` nữa). **Giữ nguyên khối CSS dark** — nó thành
mã chết vô hại; xoá hơn 1.000 dòng CSS lúc này là tự rước rủi ro vào bản pilot.
Dọn CSS để riêng thành một việc nhỏ sau này. Lưu ý phụ: khoá `va-theme` cũ còn
trong máy người đã bật tối → phải xoá khi khởi động, không thì họ kẹt nền tối.

---

## 8. Học sinh gõ "ok" mà AI vẫn nhận "đủ ý chính"

**Triệu chứng.** Trong màn chấm của giáo viên, các bài nộp chỉ gõ "ok",
"ok đã hiểu" đều mang nhãn xanh **"AI sơ khảo: đủ ý chính"**.

**Gốc rễ (bằng chứng cứng — 6 bài nộp thật của "Học sinh thử B", cùng một câu).**

| Giờ | Bài làm | AI chấm |
|---|---|---|
| 06:28:43 | `ok` | ✅ **dung: true** |
| 06:30:18 | `ok` | ❌ dung: false — "chưa nêu ý kiến phản bác…" |
| 06:30:52 | `ok` | ❌ dung: false — "thiếu phản ví dụ thứ hai…" |
| 06:31:05 | `ok đã hiểu` | ✅ **dung: true** |
| 06:31:51 | `ok` | ✅ **dung: true** |

→ **Cùng một chữ "ok" mà lúc đúng lúc sai.** Đây không phải prompt viết sai, mà
là **mô hình không ổn định** dù đã đặt `temperature: 0`
([chat-turn/index.ts:156](supabase/functions/chat-turn/index.ts:156)) — nhà cung
cấp không bảo đảm tất định. Đã kiểm tra và **loại trừ** giả thuyết "thiếu đáp án
mẫu": cả **323/323** câu `[NOPBAI]` đều có đủ `dap_an` và `loi_giai`.

**Xác nhận độc lập lần 3 — lần này từ ghế GIÁO VIÊN (29/07).**
> Người thử 1, chặng 24 (tab Chấm bài): *"**AI sơ khảo rất không ổn.** Học sinh trả lời
> là 'em ok' AI bảo đủ ý chính"*
> Người thử 1, nhật ký: *"AI nên kiểm tra câu trả lời học sinh kĩ hơn trước khi cho học
> sinh pass. Tránh trường hợp câu trả lời của học sinh không ổn nhưng vẫn được pass."*

Tức là giáo viên **đã tự mình mất niềm tin vào nhãn AI sơ khảo** ngay trong đợt thử đầu.
Nhãn xanh "đủ ý chính" mà sai thì tệ hơn không có nhãn: nó khiến cô đọc lướt rồi bấm Đạt.

**Hậu quả nặng hơn vẻ ngoài:** khi AI gật, hệ thống ghi ngay `attempts` +
`mastery_evidence` với `correct = true` và `is_target_difficulty = true`
([chat-turn/index.ts:802-828](supabase/functions/chat-turn/index.ts:802)), cộng XP,
và có thể **cho thành thạo cả node** — tức gõ "ok" là leo được lộ trình.

**Giải pháp đề nghị (3 lớp, xếp theo độ chắc).**
1. **Chốt chặn tất định TRƯỚC khi gọi AI** (rẻ, chắc, không cần LLM):
   bài gõ quá ngắn (< ~40 ký tự hoặc < 8 từ), hoặc chỉ gồm các cụm rỗng nghĩa
   ("ok", "vâng", "đã hiểu", "rồi ạ", "xong"), hoặc không chứa **thuật ngữ nào
   của đề** → trả thẳng *"Bài này còn quá ngắn so với yêu cầu — em viết rõ lập
   luận rồi nộp lại nhé"*, **không gọi LLM, không ghi bằng chứng**.
   Riêng nhánh này đã chặn đúng cả 6 ca ở trên.
2. **Bắt AI cân nhắc kỹ hơn:** thêm vào prompt yêu cầu đếm số ý bắt buộc và
   trả `so_y_dat / so_y_can`; chỉ `dung = true` khi đạt đủ. Cân nhắc chấm 2 lần
   và chỉ công nhận khi **cả hai** cùng gật (bất đồng → chờ giáo viên).
3. **Tách bạch quyền:** AI sơ khảo **không được** tự ghi `mastery_evidence` cho
   câu `[NOPBAI]`. Cho nó chạy đúng vai *gợi ý cho giáo viên* + phản hồi tức thì
   cho học sinh; mastery chỉ ghi khi **giáo viên bấm "Đạt"**.
   Đây là phương án đúng nhất về sư phạm, nhưng đổi hành vi đã hứa với học sinh
   ("nộp là được tính ngay") → **cần chủ dự án quyết** trước khi làm.

---

---

# ĐỢT BỔ SUNG — từ phiếu trải nghiệm của người thử (28/07, 07:16)

Nguồn: Google Sheet `Phieu-Trai-Nghiem-Tutor`. **Đã đọc lại lúc sheet cập nhật
29/07 03:19** (các lần trước: 28/07 07:16 · 29/07 02:14 · 29/07 03:03).

| Người thử | Chặng | Nhật ký tự do |
|---|---|---|
| Người thử 1 | **32/32 ✅** (2 dòng "Không đúng" — xem V1) | **6 mục** — nhiều nhất, sâu nhất |
| Người thử 2 | **32/32 ✅** | trống |
| Người thử 3 | **32/32 ✅** | **3 mục** |
| Kịch bản phối hợp | **0/11 ❌** | chưa ai thử |
| SỔ LỖI | **vẫn trống** (chỉ còn dòng ví dụ L001) | — |

**Tin tốt.** Phép thử riêng tư nặng nhất — chặng 20 *"đếm xem có bao nhiêu tên học sinh
hiện ra"* — đã được **cả ba người** chạy độc lập, tất cả "Đúng như mô tả". Chưa có dấu
hiệu lộ dữ liệu học sinh giữa các nhà. Vẫn nên chạy nốt KB5 để chốt.
Toàn bộ vai **Giáo viên** (chấm bài, tab Học liệu, dán link YouTube, tải tệp, tắt con
mắt, mức 2) cả ba người đều "Đúng như mô tả" trừ đúng một dòng về AI sơ khảo.

> ⚠️ **Cách đọc phiếu này (chủ dự án lưu ý 29/07):** người thử nhiều khi chưa hiểu app
> nên ghi theo cảm tính — cả phần mô tả lẫn **mức độ tự chấm**. Vì vậy danh sách dưới
> đây xếp hạng theo **BẢN CHẤT kỹ thuật**, không theo nhãn "Chặn hẳn / Khó chịu" người
> thử tự chọn. Những dòng chỉ là chép lại mô tả, hoặc là mong muốn tính năng, được tách
> riêng xuống mục "Không phải lỗi" ở cuối.

## 9. 🔴 CHẶN HẲN — chấm SAI thành ĐÚNG, và có lúc LỘ ĐÁP ÁN

> ### ✅ ĐÃ SỬA TRỌN CẢ BA VẾ 30/07 — chờ deploy `chat-turn`.
>
> **(b) LỘ ĐÁP ÁN.** `quan_niem_sai` được đọc thẳng cho học sinh ngay lần sai ĐẦU
> (và còn vào system prompt của mô hình), mà có dòng chứa nguyên văn đáp án:
> *"Tính sai — kết quả đúng là −8/40 = −0,2"* cho câu đáp án `-0,2`. Em chưa thử
> lần nào đã biết đáp — phá thẳng bất biến Socratic.
> `safeMisconception()` nay nhận thêm đáp án và **cắt đúng mệnh đề chứa nó**, giữ
> phần chẩn đoán còn lại. Cửa cố ý HẸP: chỉ xét đáp án đủ đặc trưng (≥9 ký tự,
> hoặc có chữ số/ký hiệu toán và ≥3 ký tự) và so theo ranh giới. Bản vá đầu của
> agent chặn bằng so-chuỗi-con thô rồi xoá trắng → **giết 143 lời chẩn đoán lành**
> (câu có đáp án là chữ "sai" thì mọi giải thích chứa từ "sai" đều bay; đáp án
> "mọi" giết luôn *"∅ là tập con của MỌI tập hợp"*) — tức vá lỗ (b) bằng cách làm
> lỗi (c) nặng thêm. Đo bản của tôi trên 3.563 distractor sống: **99,2% giữ
> nguyên, 30 bị cắt và đều lộ thật.**
> *(Bản vá đầu của tôi cũng sai một nhịp: split theo dấu "—" rồi ghép lại vô điều
> kiện làm MẤT DẤU CÂU của câu chẳng lộ gì — đo ra "12,7% bị cắt" toàn dương tính
> giả. Đã sửa: chỉ ghép khi thật sự có mệnh đề bị loại.)*
>
> **(c) KHÔNG NÓI VÌ SAO SAI.** Nhánh `require_thinking` (từ lần sai THỨ HAI trở
> đi — đúng lúc em cần biết mình hỏng ở đâu nhất) không hề dùng `matched` đã tính
> sẵn ngay phía trên. Nay câu dự phòng mang theo chẩn đoán. Đây **không** phải
> đường chết như phản biện lo: khi mô hình sống nó đã nhận `misconception` qua
> system prompt, còn dự phòng chỉ chạy khi KHÔNG gọi mô hình — mà đó chính là ca
> em chưa nói câu nào trong buổi, ca dễ lạc nhất.
>
> Điều tra bằng 1 agent + 1 phản biện đối kháng, rồi tôi tự thiết kế lại bản vá
> (patch của agent bị phản biện chứng minh là gây hồi quy trên **828 câu** — không dùng).
> **Không phải một lỗi mà là BỐN**, tất cả trong `_shared/cas.ts`, đều là những phép
> "nới tay" có lý do chính đáng nhưng nới quá:
>
> | | Gốc rễ | Ví dụ chấm SAI thành ĐÚNG |
> |---|---|---|
> | R1 | `normText` chạy NFD rồi xoá cả dải U+0300–U+036F — mà **nét phủ định cũng nằm trong dải đó** (`∉` = `∈` + U+0338, `P̄` = `P` + U+0304) | chọn `∈` khi đáp án là `∉` |
> | R2 | `splitSet` cắt tại dấu phẩy, nên **dấu phẩy thập phân kiểu Việt** thành dấu ngăn tập: `0,8`→{0;8}, `-0,8`→{-0;8}, mà trong JS `-0 === 0` | `0,2` khớp đáp án `-0,2` (Q-0000533) |
> | R3 | `splitSet` gọi `stripRel` cho từng phần ⇒ mất cả **tên biến lẫn trật tự** | `a=6, b=4` khớp `a=4, b=6` |
> | R4 | So hai **bất phương trình** bằng cách lấy 12 mẫu, mà `sampleAt` chỉ sinh mẫu trong (−3,3 ; 3,4) | `x < 5` ≡ `x ≤ 5` ≡ `x ≠ 5` ≡ `x > −10` |
>
> **Thước đo thật, không phải lý thuyết.** Quét toàn bộ **1.868 câu active** trên DB
> prod, thử chấm từng phương án nhiễu: **32 nhiễu được chấm ĐÚNG → còn 2, và 0 hồi quy.**
> Hai ca còn lại là lỗi **soạn đề** chứ không phải lỗi chấm (nhiễu viết bằng đúng đáp
> án, chỉ khác dấu ngoặc hoặc thứ tự) — cần người soạn sửa, mã không cứu được.
>
> Bản vá cố ý HẸP để không phạt oan em làm đúng — chấm oan ở lần thử ĐẦU là ghi vĩnh
> viễn vào `mastery_evidence`: R2 chỉ tắt nhánh tập khi **cả hai vế** là số thập phân
> đơn lẻ (nên `1,3` vẫn khớp `{1;3}`); R3 chỉ so theo tên khi **cả hai vế** là danh
> sách `tên = giá trị` **tên đôi một khác nhau** (nên `1;3`≡`3;1` và `x=1;x=3`≡`x=3;x=1`
> giữ nguyên — đây chính là chỗ patch của agent làm hỏng 828 câu); R4 **chuẩn hoá
> chiều** trước khi so nên `x > 2` vẫn khớp `2 < x`.
>
> Ghim vào `tools/grading-matrix.mjs`: **110 đạt · 0 trượt** (25 ca mới, mỗi nhóm có
> cả ca phải-sai lẫn ca không-được-hồi-quy). `memory-matrix` 28/28, `stream-matrix`
> 19/19, `gate-trace` đủ 4 điều kiện.
>
> ⚠️ Header `cas.ts` từng ghi *"MIRROR of packages/cas — edit there, then regenerate"*.
> **Lời dặn đó đã sai từ lâu** (bản gói còn 280 dòng, đồng bộ, thiếu hẳn `evalNumeric`/
> `normalizeTypography`); ai làm theo là xoá sạch bản vá này. Đã sửa header nói rõ.

**Nguyên văn người thử.**
- Người thử 1, chặng 10 (cố tình chọn sai): *"sư tử lâu lâu bạn ấy hiển thị luôn đáp
  án hoặc trả lời sai bạn ấy tính đúng luôn. Không giải thích vì sao câu trả lời của
  mình lại bị đánh giá sai"*
- Người thử 2, chặng 11 (câu chia Bước 1/2/3): *"có lần hiện ra 3 ý nhưng không rõ yêu
  cầu, **nhập 1 số bất kỳ thì sư tử báo chính xác**"*

**Vì sao đây là lỗi nặng nhất trong toàn bộ danh sách.** Khác lỗi 8 (AI chấm bừa câu
tự luận), đây là **câu khách quan** — tầng chấm TẤT ĐỊNH. Mastery learning dựng hoàn
toàn trên "chấm đúng mới xanh"; chấm sai thành đúng thì lộ trình, XP, huy hiệu, và
báo cáo gửi phụ huynh **đều là số giả**. Kèm theo là lộ đáp án — phá thẳng nguyên tắc
Socratic bất biến ("không cho đáp án", `bottom_out` chỉ mở sau cổng nỗ lực).

**Ba lỗi tách riêng, phải điều tra riêng.**
- (a) **Chấm sai → đúng.** Nghi ở nhánh so khớp chữ `normText(a) === normText(b)`
  ([cas.ts:41](supabase/functions/_shared/cas.ts:41)) hoặc `exprEqual` coi chuỗi rỗng/
  số bất kỳ là tương đương. Ca "nhập 1 số bất kỳ vẫn đúng" ở câu NHIỀU BƯỚC nghi mạnh
  hơn ở tầng parse câu nhiều bước trong `_shared/interactive.ts` — bước không parse
  được có thể đang mặc định `correct: true`.
- (b) **Lộ đáp án sai lúc.** `bottom_out` chỉ được mở khi qua cổng nỗ lực
  ([chat-turn:678](supabase/functions/chat-turn/index.ts:678)); cần dò xem có đường nào
  trả `bottom_out` ngay lần sai đầu tiên không.
- (c) **Không nói vì sao sai.** Thang Socratic bậc 1 vốn là câu hỏi ngược, không phải
  lời giải thích — nhưng học sinh mong biết mình sai ở đâu. Cần cân nhắc: khi có
  distractor khớp, nói ra QUAN NIỆM SAI mà em đang mắc (dữ liệu đã có sẵn trong
  `distractors.quan_niem_sai`) mà vẫn không lộ đáp án.

**Chưa điều tra gốc rễ** — cần tái hiện được ca "nhập số bất kỳ vẫn đúng" trước.

## 10. Sư tử KHÔNG reo khi làm đúng

> Người thử 2, chặng 9: *"Đúng thì cộng XP và không reo"*

Mất hẳn phản hồi tích cực — thứ giữ chân người học. Phiếu mô tả "đúng thì sư tử reo và
cộng XP"; thực tế chỉ cộng XP. Chưa dò gốc rễ (nghi ở trạng thái `mood` của `Lion`
không đổi sang `cheer`, hoặc hiệu ứng bị nuốt khi chuyển câu quá nhanh).

## 11. Câu nhiều bước: hiện 3 ý nhưng không rõ yêu cầu

> Người thử 2, chặng 11: *"có lần thì giống mô tả, có lần hiện ra 3 ý nhưng không rõ yêu cầu"*

Không ổn định — **cùng một dạng câu, lần được lần không**. Nghi cùng họ với 3 bẫy parse
đã biết: câu nhiều bước không nhận đúng hình dạng thì rơi về khuôn hiển thị thô, mất
phần đề của từng bước. Đi kèm lỗi 9(a) vì chính ca này cho "nhập số bất kỳ vẫn đúng".

## 12. 🔴 Đăng nhập chậm — có ca **hơn 1 PHÚT**

> Người thử 1, chặng 1: *"thời gian đợi log in hơi lâu"*
> Người thử 3, nhật ký: *"load chậm vào màn hình đăng nhập, **chạy phải hơn 1 phút mới
> vào được**"*

Hai người báo độc lập; con số "hơn 1 phút" đẩy lỗi này từ khó chịu lên **nghiêm trọng**
— học sinh thật sẽ bỏ đi trước khi màn hình hiện. Cần đo thật (bấm → thấy lộ trình)
rồi mới kết luận: chờ Supabase auth, chờ `learning-path`, hay chờ tải bundle. Có
`setTimeout 1400ms` gỡ màn intro trong [TutorApp.tsx](apps/web/components/TutorApp.tsx)
— nếu mạng nhanh thì chính con số này là độ trễ sàn, tự mình làm chậm mình. Cũng cần
kiểm xem có phải cold start của edge function không (function nguội gọi lần đầu rất lâu).

## 13. ~~Cần hỏi lại người thử~~ → HẠ XUỐNG mục "Không phải lỗi" (N1)

Ghi chú "Gõ bài làm hoặc nộp ảnh" của Người thử 2 nhiều khả năng chỉ là chép lại mô tả
trên phiếu. Xem mục **N1** ở cuối tài liệu. Không chiếm chỗ trong hàng đợi sửa lỗi.

## 14. 🔴🔴 CHẶN HẲN — xin gợi ý thì sư tử CHÚC MỪNG "đã trả lời đúng"

> Người thử 1, nhật ký tự do, vai Học sinh, màn hình đang trả lời câu hỏi:
> *"Không biết làm kêu sư tử gợi ý — **bạn ấy trả lời bằng cách chúc mừng học sinh đã
> trả lời đúng**"*
> **Mức tự đánh giá: "Chặn hẳn không đi tiếp được"**
> Mong muốn: *"Khi học sinh không làm được bài mong sư tử gợi ý thay vì chúc mừng."*

**Đây là lỗi mức CHẶN HẲN đầu tiên người thử báo, và có thể là GỐC CHUNG của cả cụm.**
Học sinh gõ một câu *xin trợ giúp* → hệ thống coi đó là **BÀI LÀM**, đem đi chấm, và
chấm **ĐÚNG**. Hậu quả kép: em không bao giờ nhận được gợi ý (cổng nỗ lực + thang
Socratic vô hiệu hoàn toàn), mà lại được ghi bằng chứng mastery sai.

**🔑 Giả thuyết hợp nhất — cần kiểm chứng trước khi sửa bất cứ lỗi nào trong cụm.**
Bốn lỗi 8 · 9 · 11 · 14 có thể chung MỘT gốc: **mọi thứ gõ vào ô chữ tự do đều bị
định tuyến vào đường CHẤM, và tầng chấm gật bừa khi đầu vào không phải đáp án.**
- Lỗi 8: gõ "ok" ở câu nộp bài → AI gật (đã có bằng chứng DB: 3/5 lần gật).
- Lỗi 9: trả lời sai ở câu khách quan → báo đúng.
- Lỗi 11: nhập một số bất kỳ ở câu nhiều bước → báo chính xác.
- Lỗi 14: gõ câu xin gợi ý → báo đúng + chúc mừng.
Nếu đúng là một gốc thì vá đúng chỗ đó là rụng cả bốn. Việc cần làm ĐẦU TIÊN là tái
hiện: mở một bài, gõ một câu vô nghĩa vào ô trả lời, xem `attempts` + `mastery_evidence`
ghi gì. **Chưa điều tra — cần lệnh mới được đụng mã.**

Ngoài ra phải làm rõ về mặt sản phẩm: **có nút "xin gợi ý" riêng không?** Nếu học sinh
đang phải GÕ lời xin gợi ý vào chính ô nhập đáp án thì đó là lỗi thiết kế, không chỉ
lỗi mã — cần một nút riêng, tách hẳn khỏi ô trả lời.

## 15. Tin nhắn của học sinh không hiện trong khung đối thoại

> Người thử 1, nhật ký: *"Khi không biết làm (phần bài tập tự luận) và hỏi sư tử gợi ý,
> màn hình có hiển thị gợi ý của sư tử tuy nhiên **tin nhắn học sinh gửi thì không được
> hiển thị** trên màn hình."*
> Mức: "Khó chịu nhưng vẫn làm được"
> Mong muốn: *"Nên hiển thị cả tin nhắn của học sinh và gợi ý của sư tử, như vậy người
> học có cảm giác là đang tương tác cùng nhau."*

Đối thoại một chiều thì không còn là đối thoại — mà Socratic sống bằng cảm giác đang
nói chuyện với ai đó. Server ĐÃ lưu lượt của học sinh (`persist("student", …)` trong
[chat-turn](supabase/functions/chat-turn/index.ts)), nên nhiều khả năng chỉ là phía web
không vẽ bong bóng chat của học sinh. Chưa dò gốc rễ.

## 16. 🔴 Câu ĐIỀN KHUYẾT chấm quá khít — gõ đúng ý vẫn bị coi là sai

*(Trước đây là mục "cần hỏi Người thử 3" — 29/07 họ đã viết đủ.)*

> Người thử 3, nhật ký: *"**phải nhập đúng đáp án** để làm câu hỏi điền khuyết, **cần
> chỉnh sửa data**, và quy định về đáp án điền khuyết (ví dụ chỉ được 4 ký tự số tính
> luôn dấu trừ và dấu phẩy: -0,2 ; 2356; 1,67…)"*

**Đây là MẶT KIA của lỗi 9.** Lỗi 9 là chấm SAI thành ĐÚNG; lỗi này là chấm ĐÚNG thành
SAI — học sinh hiểu bài, gõ ra kết quả đúng, nhưng lệch định dạng một chút là bị đánh sai.
Với học sinh Việt Nam thì bẫy lớn nhất là **dấu thập phân: `0,2` (dấu phẩy, chuẩn VN) so
với `0.2` (dấu chấm, chuẩn mathjs/CAS)**.

**Hai việc phải làm, đừng làm nhầm một cái.**
1. **Chuẩn hoá đầu vào khi chấm** (mã): coi `0,2` ≡ `0.2`, bỏ khoảng trắng, bỏ dấu phân
   cách hàng nghìn, chấp nhận cả `-0,2` lẫn `- 0,2`. Nằm ở `normText`/`exprEqual`
   ([cas.ts](supabase/functions/_shared/cas.ts)).
2. **Nói trước cho học sinh biết luật** (giao diện): ô điền khuyết phải có gợi ý định
   dạng ngay tại chỗ ("nhập số, dùng dấu phẩy thập phân"), chứ không để em đoán.
Người thử còn nói "cần chỉnh sửa data" — tức nghi cả đáp án trong ngân hàng câu hỏi
không nhất quán định dạng. **Cần rà `dap_an` của các câu điền khuyết trước khi sửa mã.**

## 17. Câu nhiều bước: làm sai phải cuộn lên đầu rồi cuộn xuống cuối

> Người thử 3, nhật ký: *"lúc sai nên để màn hình thể hiện lại cả 3 câu hỏi ở dưới
> (hiện tại 2 câu đúng sai vẫn nằm trên đầu, chỉ điền khuyết xuống dưới, **mỗi lần làm
> sai phải kéo lên màn hình trên đầu để chỉnh sửa có/không, rồi kéo xuống dưới cùng để
> làm điền khuyết**)"*

Câu chia Bước 1/2/3 khi làm lại thì các bước bị tách rời hai đầu màn hình. Mỗi lần sai
là một vòng cuộn lên–cuộn xuống. Đi cùng cụm với lỗi 11 (cùng dạng câu nhiều bước) —
**nên sửa một thể**: khi làm lại, gom cả các bước vào một chỗ, giữ nguyên câu trả lời cũ
để em chỉ sửa phần sai.

## 18. Màn hình PHỤ HUYNH trống trơn khi con chưa học — không nói gì cả

> Người thử 1, chặng 21: **"Không đúng"** — *"Chưa thấy thông tin gì"*
> Người thử 1, nhật ký #6, vai Phụ huynh: *"Chưa liên kết với học sinh"* (tự chấm Chặn hẳn)

**Đã kiểm chéo DB — KHÔNG phải lỗi phân quyền, mà là lỗi màn rỗng.**
`Học sinh thử A` (con của `ph1@truongvietanh.com`) có **0 lượt đối thoại, 0 lần trả lời,
0 XP** — em này chưa từng học câu nào. Nên báo cáo phụ huynh trống là ĐÚNG dữ liệu;
cái sai là **màn hình không nói vì sao trống**.

Cùng họ với lỗi 3 và 5: app im lặng khi không có dữ liệu, để người dùng tự đoán là hỏng.
Phụ huynh mở ra thấy trắng thì kết luận "app không chạy", chứ không nghĩ "con mình chưa
học buổi nào". Phải nói thẳng: *"Bé chưa có buổi học nào — khi bé bắt đầu, kết quả sẽ
hiện ở đây."*

Đi kèm: tài khoản demo **`ph1@vietanh.edu.vn` ("Phụ huynh An") KHÔNG nối với con nào**
(`guardian_links` = 0 dòng), nên vào là gặp "chưa liên kết". Cần nối, hoặc bỏ khỏi bộ
tài khoản demo.

## 19. Lời sư tử lặp một khuôn — "Gần được rồi… còn thiếu" xuất hiện quá nhiều

> Người thử 1, câu hỏi mở *"app nói năng chưa đúng giọng nhà trường, hoặc trẻ con quá /
> khô khan quá?"*: *"Khi sư tử đưa ra gợi ý câu **'Gần được rồi — còn thiếu' xuất hiện
> quá nhiều lần**."*

Đúng chỗ này trong mã: [chat-turn/index.ts:858](supabase/functions/chat-turn/index.ts:858)
— `Gần được rồi — còn thiếu: ${ai.detail}` là chuỗi CỐ ĐỊNH, mọi lần chưa đạt đều nói y
hệt. Cộng với lỗi 9(c) (không nói vì sao sai) thì học sinh nghe một câu vô nghĩa lặp đi
lặp lại. Sửa: xoay vòng vài cách nói, và quan trọng hơn là **nói vào NỘI DUNG em thiếu**
chứ không phải nói về việc em thiếu.

---

# ĐỢT BỔ SUNG — chủ dự án tự thử đối thoại (30/07)

## 24. ✅ ĐỢT SỬA CUỐI 31/07 — #8 (cửa hậu), #11 (câu nhiều bước), #19 (lặp khuôn), #23 (mastery)

**#23 · node CỤT DOK — đã nới đúng chỗ.** Luật đòi ≥1 câu DOK≥3 đúng, mà nhiều node
ngân hàng chỉ có DOK tối đa 2 ⇒ em làm đúng mọi câu vẫn vĩnh viễn không xanh.
`recomputeMastery()` nay nhận thêm **DOK cao nhất CÓ THẬT trong ngân hàng của node**
(`mastery-state.ts` truy bảng `questions` một lượt); node nào không có câu DOK≥3 thì bỏ
điều kiện đó, node nào CÓ thì vẫn phải làm đúng một câu như cũ. Đồng bộ cả bản
`packages/pedagogy` (vitest 6/6).

**#8 · cửa hậu còn sót.** Lớp 1 (chặn bài rác) và lớp 3 (AI hết quyền ghi mastery cho
bài nộp) đã làm từ 29/07 và tôi xác minh lại là đúng. Nhưng nhánh `answer` — nơi LLM
chấm rồi GHI THẲNG `mastery_evidence` + XP — **không hề chặn câu [NOPBAI]**: client gọi
nhầm (hoặc cố tình) đúng questionId đó là cửa hậu mở lại y như cũ. Nay chặn ở server,
không phụ thuộc client cư xử đúng. Đã kiểm: 323 câu [NOPBAI] active, `diagnose` gán
`kind="nop_bai"` nên luồng hợp lệ không đi đường này ⇒ không chặn nhầm ai.

**#11 · 45/46 câu nhiều bước KHÔNG CÓ ô trả lời.** Gốc rễ hoá ra **không phải parse**
(agent chạy thử 113 câu: 0 câu parse trượt) mà là UI: đường trả lời chỉ mở khi MỌI bước
đều là "(Có/Không)" — ngân hàng sống có **đúng 1** câu viết theo khuôn đó. 45 câu còn
lại vẽ ba thẻ bước mà không thẻ nào trả lời được, ô gõ duy nhất thì nằm tận dưới khung
đối thoại. Đúng thứ người thử 2 gọi là *"hiện ra 3 ý nhưng không rõ yêu cầu"*. Nay MỖI
bước có chỗ trả lời riêng: bước Có/Không → hai nút, bước còn lại → ô gõ ngay trong thẻ;
đáp án gửi đi ráp theo từng bước.

**#19 · lặp khuôn.** Chuỗi "Gần được rồi — còn thiếu" đã biến mất từ 29/07, nhưng còn
hai chỗ cứng: câu mở lời khi bắt được quan niệm sai, và câu mở đáy. Nay xoay vòng 3 cách
nói, chọn theo `attemptNo` (KHÔNG random — cùng một lượt vẽ lại thì chữ không nhảy).

**#18 · màn phụ huynh** — đã đủ ba trạng thái nói đúng sự thật (chưa liên kết con ·
đã liên kết nhưng con chưa học · có dữ liệu), cộng đợt dọn 30/07 gỡ các khối PDPL.

**#1 · học liệu/nộp bài — ✅ ĐÃ SỬA 31/07.** Commit `e51a2ac` (29/07) đã xử đúng hai vế
được nêu nguyên văn (trần 360px, có đường nộp bài), nhưng rà lại thấy **bốn lỗ còn**,
trong đó một cái nặng hơn cả triệu chứng gốc:

1. **Học liệu BIẾN MẤT sau khi bấm đúng nút app mời bấm.** `KhoBauView` lọc
   `tier === mucDangMo`, nên vừa bấm "XEM XONG MỨC 1" là toàn bộ học liệu mức 1 —
   kể cả phiếu bài tập và khối nộp bài của nó — không còn trên màn Kho báu. Đúng
   kịch bản *"tải phiếu về làm ở nhà, mai vào nộp"*: hôm sau mở lại thì trống trơn.
   Server vốn đã trả `tier <= mucDangMo`; chỉ client giấu đi. **Đổi `===` thành `<=`.**
   *(Phản biện đúng một ý: lỗ này chỉ ở màn Kho báu — `TutorApp` gọi cùng endpoint mà
   không lọc tier, nên luồng học trong bài không dính.)*
2. **Node không có câu `[NOPBAI]` thì màn hình im lặng tuyệt đối.** Khối nộp bài bám vào
   một câu mang nhãn đó cùng node, mà **85/204 node (42%) không có** — trong khi thầy cô
   gắn phiếu được vào bất kỳ node nào. Nay nói thật một câu thay vì để em đi tìm.
3. **Trần cứng quay lại ở cột phải màn bài học** (commit `a9996bd` sau đó đặt học liệu
   vào cột phải và kẹp 260px). Cột rộng 356px, PDF render `#view=FitH` nên một trang A4
   cao ≈500px — 260px cắt mất gần nửa trang, đúng cái đẻ ra "xem không hết" ban đầu.
   Nay `min(52vh, 560px)` (đo ở 1440×900: 468px), cột vốn đã tự cuộn nên không tràn.
4. **Nhãn "Bậc 1"** — từ của người soạn chương trình, không phải của học sinh lớp 10, và
   khi cả rổ cùng một mức thì chỉ là tiếng ồn lặp trên mọi thẻ. Nay gọi "Mức n" và chỉ
   hiện khi thật sự có nhiều mức.

Đã kiểm trên bản xem trước: nhãn ra đúng `Mức 1 · Mức 1 · Mức 2`, hết chữ "Bậc"; khung
xem 468px = 52vh, hết trần 260px; nút "Toàn màn hình" + "Mở tab mới" còn nguyên.

---

## 23. 🔴 "0 điểm đã thành thạo" dù con đã làm rất nhiều — luật mastery đòi DOK≥3 mà node KHÔNG CÓ câu DOK≥3

> Chủ dự án, màn phụ huynh 30/07: *"chưa thấy tiến độ mục tiêu và điểm đã làm luôn,
> mặc dù đã làm khá nhiều rồi"* — báo cáo hiện **0 điểm đã thành thạo / 14 điểm đang
> luyện thêm**.

**KHÔNG phải lỗi hiển thị. Truy DB prod (tài khoản `hs1@vietanh.edu.vn`):**

| | Số liệu thật |
|---|---|
| node có trạng thái | 14 — **cả 14 đều `mastered = false`** |
| bằng chứng đúng ở ĐÚNG độ khó mục tiêu | **32** (và 28 lần sai) |

Tức là em trả lời đúng 32 lần ở đúng độ khó mà **không một node nào xanh**.

**Gốc rễ** — [`packages/pedagogy/src/mastery.ts:47`](packages/pedagogy/src/mastery.ts:47):
`const hasHigherOrder = correct.some((e) => e.dok >= 3)` là điều kiện **bắt buộc** để
`mastered = true`. Nhưng đo từng node của em:

| node | số câu đúng | đúng ở DOK≥3 | DOK cao nhất **có trong ngân hàng** |
|---|---|---|---|
| KC-3566611 | 8 | 0 | 3 |
| KC-5110642 | 7 | 0 | **2** |
| KC-3348179 | 7 | **1** | 3 |
| KC-0570467 | 4 | 0 | **2** |
| KC-1828856 | 2 | 0 | **2** |

Hai chuyện khác nhau lộ ra:
1. **Node không hề có câu DOK≥3** (KC-5110642, KC-0570467, KC-1828856 — DOK cao nhất chỉ
   là 2). Em làm đúng *mọi* câu của node đó cũng **vĩnh viễn không thể xanh**. Luật đòi
   một thứ ngân hàng không có.
2. **KC-3348179 đã có đủ 7 đúng + 1 đúng ở DOK≥3 mà vẫn `false`** — nghi câu DOK≥3 đó rơi
   ra ngoài `MASTERY_WINDOW` (luật chỉ xét N lần gần nhất). Cần dò riêng.

**Chưa sửa** — vì đây là **quyết định sư phạm, không phải lỗi mã đơn thuần**, cần chủ dự án
chọn: (a) nới luật — node nào ngân hàng không có DOK≥3 thì bỏ điều kiện đó; (b) bổ sung câu
DOK≥3 cho các node thiếu (việc nội dung, Studio); hay (c) cả hai. Bản thân điều kiện DOK≥3
là đúng về sư phạm (thành thạo phải chứng minh được ở bậc vận dụng) — vấn đề là nó đang
được áp cho cả những node không có phương tiện để chứng minh.
Liên quan: memory `mastery-dok3-nopbai` (câu DOK-3 thường là câu `[NOPBAI]`, mà bài nộp
không ghi bằng chứng ⇒ lộ trình đứng im).

---

## 20. ✅ ĐÃ SỬA (30/07, chờ deploy web + `chat-turn`) — Đối thoại DẮT VÒNG VÒNG, "chốt C" không chốt được

> **Đã làm:** (a) cầu chat→chấm `chatAnswerOf()` trong
> [TutorApp.tsx](apps/web/components/TutorApp.tsx) — câu gõ vào ô trò chuyện thực chất
> chỉ là đáp án ("C", "chốt C", "đúng", nguyên văn phương án) thì chọn ô + nộp thẳng
> máy chấm tất định, AI vẫn không chấm; lời kể có lập luận vẫn đi đường đối thoại
> (kiểm 23 ca bằng chính source: "chốt C"→C, "b sai c đúng"→đối thoại, "mình nghĩ C vì
> 9 chia hết 3"→đối thoại…). (b)+(c) `buildGuideSystem` thêm luật NGỪNG-THĂM-DÒ khi em
> đã nêu đáp án cuối + luật KHÔNG-GẬT dữ kiện sai (ca "0 là số nguyên tố" được khen).
> Bản gốc bên dưới giữ làm hồ sơ.

> Chủ dự án cố tình đóng vai học sinh kẹt bài (câu "Mệnh đề nào sau đây ĐÚNG?", đáp án
> C). Kết quả: **~14 lượt đối thoại**, học sinh nói "chốt C" hẳn hoi, sư tử còn hỏi
> "Bạn chốt đáp án nào?" — nhưng KHÔNG có gì xảy ra. Muốn chốt thật phải: thoát đối
> thoại → bấm THỬ LẠI → bấm ô C → bấm KIỂM TRA. Chủ dự án: *"khi tôi nhắn C thì hệ
> thống nên chọn thay tôi luôn thay vì chờ học sinh nhấn thử lại rồi nhấn C."*

Ba gốc rễ, đo trên bản ghi hội thoại thật:

**(a) Kênh chat và kênh chấm là hai đường CỤT — không có cầu.** `sendReflect`
([TutorApp.tsx:823](apps/web/components/TutorApp.tsx:823)) chỉ biết gọi `answerReflect`
→ mọi thứ học sinh gõ vào ô "Kể cách em nghĩ…" đều thành một lượt ĐỐI THOẠI nữa, kể cả
khi nội dung LÀ đáp án ("C", "chốt C"). Server (`chat-turn` nhánh reflect,
[index.ts:659](supabase/functions/chat-turn/index.ts:659)) cũng không có nhánh nào nhận
ra "em vừa nêu đáp án cuối" để đổi hành vi. Vòng lặp là **do kiến trúc**, không phải do
prompt kém.

**(b) Sau khi học sinh CHỐT, sư tử vẫn hỏi câu gây dao động.** "Nếu bạn chọn C, bạn dựa
vào điều gì để loại B? Mình tò mò thôi…" → học sinh đổi thành "B cũng đúng", cuộc thoại
văng ngược về đầu. `buildGuideSystem` không có luật "em đã nêu đáp án cuối → NGỪNG mở
rộng, chỉ mời xác nhận"; ngưỡng nhắc `noiChuaThu` chỉ bật từ lượt thứ 4 sau lần thử cuối
và cũng chỉ nhắc "quay lại làm bài" chung chung.

**(c) Sư tử XÁC NHẬN dữ kiện sai của học sinh.** Hỏi "số nguyên tố nào vừa chẵn vừa là
nguyên tố?", em trả lời "**0**" — sư tử đáp "Ừ, mình thấy bạn nhìn ra điểm yếu của B
ngay". 0 không phải số nguyên tố; câu đúng là 2. Guide không được QUYẾT đúng/sai đáp án
(luật kiến trúc), nhưng cũng không được GẬT với một dữ kiện toán sai — prompt hiện không
cấm điều đó.

**Phương án (giữ đúng luật "AI chỉ dẫn dắt, chấm tất định quyết"):**
1. **Cầu chat→chấm ở client** (web): trong trạng thái retry, nếu chuỗi trong ô reflect
   khớp một PHƯƠNG ÁN (một chữ cái A–D, "chốt C", "chọn C", hoặc nguyên văn đáp án) →
   không gửi đi đối thoại nữa: set `picked` = phương án đó, xoá verdict, gọi thẳng
   `submitObjective` — máy chấm tất định quyết, AI không chấm. Đây là ảnh gương của
   cổng ý định A1 (lỗi 14: lời xin giúp gõ vào ô ĐÁP ÁN không đem chấm — nay lời ĐÁP ÁN
   gõ vào ô chat không đem đối thoại).
2. **Luật chốt trong `buildGuideSystem`** (chat-turn): học sinh đã nêu đáp án cuối →
   không hỏi thêm câu mở rộng/thăm dò; chỉ mời bấm chốt (hoặc — khi (1) đã có — xác
   nhận "mình ghi nhận C nhé"). Kèm luật: KHÔNG xác nhận dữ kiện sai; dữ kiện em nêu
   sai thì hỏi lại đúng chỗ đó ("0 có chia hết cho mấy số?"), không khen.
3. (nhẹ) Hạ ngưỡng `noiChuaThu` hoặc thêm tín hiệu "đã nêu đáp án N lượt trước" vào
   guide để sư tử tự kéo về việc chốt sớm hơn lượt thứ 4.

Sửa ở đâu: **web (TutorApp) + edge fn `chat-turn`** · Mức: 🔴 P0 (phá thẳng vòng học
Socratic — em làm ĐÚNG hết mà không thoát được bài) · Công sức: M.

---

## 21. ✅ ĐÃ SỬA (30/07, chờ deploy `chat-turn`) — Sư tử chat GIỌNG ROBOT

> **Đã làm:** viết lại khối "CÁCH NÓI" trong `buildGuideSystem`
> ([prompts.ts](supabase/functions/_shared/prompts.ts)) theo hướng chủ dự án chốt
> ("coach, dễ nghe, ai cũng hiểu, ít ký tự, hỏi đúng trọng tâm"): bỏ danh-sách-đen cụm
> mở đầu → luật tổng quát không lặp TỪ MỞ ĐẦU 2 lượt gần nhất (bất kể từ gì, kể cả
> "Ừ"); cấm dấu "—"/gạch đầu dòng/emoji ngoài công thức; tả thanh ghi nói-miệng-lớp-10
> ("câu B sai chỗ nào" thay "điểm yếu của phương án B"); mỗi lượt MỘT câu hỏi MỘT ý;
> không đưa câu mẫu nguyên văn (bài học 29/07: mẫu thành khuôn mới). Kiểm thật bằng
> kịch bản hội thoại của chủ dự án SAU khi deploy. Bản gốc bên dưới giữ làm hồ sơ.

> Chủ dự án (cùng phiên thử lỗi 20): *"nó chat giống robot quá — dấu gạch ngang dài,
> ừ luôn được lạm dụng, từ ngữ cũng khó nghe và khó gần."*

Soi bản ghi: **7+ lượt liền mở bằng "Ừ,"** ("Ừ, mình thấy…", "Ừ, vậy…", "Ừ, đúng rồi…");
gần như câu nào cũng có ít nhất một dấu "—" (có câu hai); từ ngữ kiểu văn bản chứ không
phải bạn học lớp 10: *"điểm yếu của B"*, *"vào guồng kiểm tra từng mệnh đề"*, *"dấu ±
có hợp lệ không"*.

**Gốc rễ — vá 29/07 chữa triệu chứng, không chữa bệnh:** `buildGuideSystem`
([prompts.ts:100](supabase/functions/_shared/prompts.ts:100), khối "NÓI NHƯ NGƯỜI") cấm
một DANH SÁCH cụm mở đầu cụ thể → mô hình bỏ cụm bị cấm, bám ngay vào nạng kế tiếp
("Ừ,") — danh sách đen không bao giờ đuổi kịp. Prompt cũng **không có luật nào về dấu
câu** (dấu "—" là tật bẩm sinh của LLM, không cấm là nó rải khắp nơi) và **không tả
thanh ghi từ vựng** (chỉ nói "như bạn bè" chung chung).

**Phương án** (cùng chỗ sửa với 20(b) — một lần deploy `chat-turn`):
1. Đổi luật mở đầu từ DANH SÁCH ĐEN sang LUẬT TỔNG QUÁT: "không lặp lại TỪ MỞ ĐẦU của
   hai lượt gần nhất trong <lich_su>, bất kể từ gì" — hết đường mòn nạng mới.
2. Thêm luật dấu câu: tối đa MỘT dấu "—" mỗi lượt, ưu tiên câu ngắn với dấu phẩy/chấm;
   không xuống dòng gạch đầu dòng trong lời thoại.
3. Tả thanh ghi từ vựng: nói như bạn cùng lớp 10 nói miệng — "câu B sai chỗ nào" chứ
   không "điểm yếu của B", "dấu ± có đúng không" chứ không "có hợp lệ không". KHÔNG
   đưa câu mẫu nguyên văn (mô hình sẽ chép thành khuôn mới — bài học 29/07).

Liên quan: lỗi 19 (chuỗi tất định lặp khuôn) + lỗi 20(b) (hỏi dao động sau chốt) — ba
món này nên sửa CHUNG một đợt prompt rồi thử lại bằng đúng kịch bản hội thoại của chủ
dự án. Mức: 🟠 P1 · Công sức: S–M.

---

## 22. ✅ ĐÃ SỬA (30/07, chờ deploy) — Dấu CĂN mất gạch ngang, chỉ còn móc như chữ "v"

> Chủ dự án (cùng phiên 30/07): *"dấu căn nó cũng không thể hiện dấu gạch ngang đúng
> kiểu dạy học sinh, nó chỉ có nét như chữ v là hết."* Tức √4 hiện như "v4" — sai ký
> hiệu toán đang dạy trên lớp.

**Gốc rễ THẬT (chẩn đoán lần đầu SAI — ghi lại cả hai để khỏi đi lại đường cũ):**

- ~~Lần đầu đổ cho reset `img,svg{max-width:100%}` bóp SVG 400em của KaTeX~~ — đo lại
  thì trang có nạp `katex.min.css` KHÔNG dính: CSS của KaTeX tự đè `width:100%` +
  `position:absolute` lên SVG, reset thành trơ.
- **Thủ phạm thật: chữ √ UNICODE nằm TRONG `$...$`.** Text NGOÀI `$` đã được
  `toLatexInner` đổi `√4 → \sqrt{4}` từ lâu, nhưng nội dung TRONG `$` được coi là
  "LaTeX thật của người soạn" nên đi thẳng vào KaTeX — mà KaTeX vẽ chữ √ trần y như
  `\surd`: cái móc KHÔNG có thanh ngang. AI (guide viết `$√4 = ±2$`) và cả đề trong
  ngân hàng câu hỏi đều có thể dính.

**Đã sửa (2 tầng):**
1. `normalizeTex()` mới trong [mathtex.ts](apps/web/lib/mathtex.ts) — đổi √ unicode
   trong `$...$` thành `\sqrt{}` (3 dạng: `√(...)`, `√{...}`, `√x`; √ mồ côi giữ nghĩa
   `\surd` cũ). Gắn tại `katexHtml()` ([mathrender.tsx](apps/web/lib/mathrender.tsx)) —
   cửa chung của MỌI công thức nên vá một chỗ phủ cả app. Chỉ đụng chữ √ (không bao
   giờ là cú pháp LaTeX hợp lệ) — không thể phá công thức đúng.
2. Lưới an toàn `.katex svg { display:inline; max-width:none }` sau khối reset
   ([globals.css:339](apps/web/app/globals.css:339)) — chặn họ lỗi thứ hai cho trang
   nào lỡ thiếu `katex.min.css`. Trang đủ CSS thì rule trơ, vô hại.

**Đã kiểm:** ca sống trong `/demo` → Bài học → dạng "Lời trích" mang nguyên văn
`$√4 = ±2$` (dạng dính lỗi) — render ra `.mord.sqrt` thật, vlist 2 tầng = CÓ thanh
ngang, hết √ thô, hết `\surd` fallback. Deploy: chỉ web.

---

# 📌 TỔNG KẾT ĐỊNH TÍNH — 7 CÂU HỎI MỞ (bổ sung 29/07 03:34)

*Khu này nằm cuối mỗi phiếu, KHÔNG có ô "Đúng như mô tả" nên ba lần rà trước bỏ sót.
Đây là phần phản hồi giá trị nhất của cả đợt.*
Người thử 1 trả lời đủ 7 câu · Người thử 3 ghi "không có" cho cả 7 · Người thử 2 bỏ trống.

### ⚖️ PHÁN QUYẾT — "Sẵn sàng cho lớp mình dùng app này chưa?"
> **Người thử 1: "CHƯA SẴN SÀNG. Vì phần hướng dẫn của sư tử đang còn chưa được logic,
> hơi lộn xộn."**

Đây là câu quan trọng nhất trong toàn bộ phiếu: một giáo viên đã đi trọn 32/32 chặng và
kết luận chưa dám cho lớp dùng. Lý do họ nêu **không phải giao diện, không phải tốc độ**
— mà là **chất lượng dẫn dắt của sư tử**, tức đúng phần lõi sư phạm (cụm lỗi 8·9·11·14·19).

### Các câu còn lại

| Câu hỏi | Trả lời của Người thử 1 | Đọc ra điều gì |
|---|---|---|
| Học sinh lớp 10 sẽ khựng ở đâu? | *"Khi được yêu cầu làm lại một điểm kiến thức… **vào làm lại thì phải làm lại TỪ ĐẦU thay vì tập trung vào phần bạn ấy sai. Làm lại toàn bộ dễ gây hoang mang.**"* | **Mở rộng lỗi 2** — không chỉ thiếu lời nhắn, mà còn bắt học lại cả bài |
| App nói năng có chỗ nào chưa ổn? | *"Câu 'Gần được rồi — còn thiếu' xuất hiện quá nhiều lần"* | → **lỗi 19** (mới) |
| Mắt PHỤ HUYNH: báo cáo đủ yên tâm chưa? | *"Chưa liên kết với học sinh nên chưa thể nhận xét trải nghiệm"* | Hệ quả của **V1** — chưa đánh giá được, phải thử lại |
| Mắt GIÁO VIÊN: chấm trên app nhanh hay chậm hơn giấy? | *"**Nhanh hơn NẾU AI sơ khảo chính xác hơn.** Tuy nhiên AI sơ khảo hiện tại hơi nhiều lỗi, **học sinh điền lung tung vẫn nhận xét là chính xác**"* | **Xác nhận lỗi 8 lần thứ 4.** Và nói rõ: toàn bộ lời hứa "tiết kiệm thời gian cho giáo viên" treo trên độ chính xác của AI |
| HỌC LIỆU: đăng mất bao lâu, có tự làm không? | *"Đăng tải nhanh, tuy nhiên **tài liệu soạn sẵn trên web chưa được sát thực tế dạy học lắm** nên vẫn cần giáo viên soạn thảo và upload lên"* | Khớp dữ liệu: bảng `resources` mới có **3 dòng**. Kho học liệu gần như trống → xem mục dưới |
| BA MỨC kho báu có hợp cách dạy không? | **"Phần này phù hợp"** ✅ | **Điểm cộng duy nhất được xác nhận rõ.** Thiết kế 3 mức mở dần được giáo viên chấp nhận — giữ nguyên, đừng đổi |

### Việc rút ra (không phải lỗi mã)
**Kho học liệu gần như trống** — `resources` chỉ có 3 dòng cho 204 bài. Giáo viên nói
thẳng là tài liệu sẵn "chưa sát thực tế dạy học". Cửa đăng học liệu đã chạy tốt (cả ba
người thử đều "Đúng như mô tả" ở chặng 26–30), nên **nút thắt bây giờ là NỘI DUNG, không
phải công cụ**. Cần quyết: trường soạn sẵn tới đâu, hay để giáo viên tự đăng từng bài.

### Ghi chú về độ tin của phần này
Người thử 3 trả lời **"không có"** cho cả 7 câu — nhiều khả năng hiểu câu hỏi thành
"có vấn đề gì không?" chứ không phải câu hỏi mở. Không tính là phản hồi tích cực.
Người thử 2 bỏ trống cả 7. **Nên nhắc hai người này quay lại trả lời** — 7 câu này cho
nhiều thông tin hơn 32 chặng tick cộng lại.

---

# ĐỢT SAU DEPLOY 29/07 — lỗi mới

## 20. ❓ Màn NỘP BÀI trắng trơn sau khi bấm Huỷ ở hộp chọn tệp

**Triệu chứng** (chủ dự án, 29/07 sau khi deploy): ở câu nộp bài, bấm nút đính
kèm → hộp chọn tệp của Windows mở → bấm **Cancel** → màn hình còn mỗi dòng
*"Em gõ bài làm là hay nhất…"* ở trên, một khoảng trắng rất lớn ở giữa, và nút
NỘP BÀI ở đáy. Đề bài + ô gõ bài biến mất khỏi tầm nhìn.

**Đã loại trừ được gì (đọc mã).** `onChange` của input tệp khi bấm Huỷ chỉ chạy
`setWorkFile(null)` + `setError(null)` — không đụng `q`, không đổi `verdict`, nên
KHÔNG phải React gỡ mất khối câu hỏi. Bằng chứng: chính dòng chú thích còn hiện
được, mà dòng đó nằm CÙNG khối `.submit-box` với ô gõ bài — nếu khối bị gỡ thì
dòng đó cũng mất theo.

**Chủ dự án bổ sung 29/07:** *không cuộn lên được*, và bài đó **có học liệu PDF
+ link YouTube**.

**Suy ra được gì từ hai chi tiết đó.**
- "Không cuộn được" + footer nằm đúng đáy màn ⇒ **tài liệu NGẮN HƠN viewport**,
  nên trang vốn không có gì để cuộn. KHÔNG phải bị chặn cuộn, cũng không phải
  nhảy vị trí cuộn.
- Mảng trắng lớn vì thế chỉ là **nền trang** giữa đáy tài liệu và `.lfoot` (cố
  định ở đáy) — không phải một khung iframe trắng.
- Đã đọc hết vùng mã SAU ô nộp bài: chỉ có `.lesson-pad` cao 128px, không có gì
  sinh ra ~660px. ⇒ thứ thiếu nằm **PHÍA TRÊN** dòng chú thích.

⇒ **Kết luận mới: mọi thứ đáng lẽ đứng trên dòng chú thích đều không chiếm chỗ**
— khung học liệu, đề bài, ô gõ bài, hàng đính kèm. Đây là lỗi **dựng lại giao
diện**, KHÔNG phải lỗi chiều cao khung học liệu (`.lsv-frame` 78vh) như suy đoán
ban đầu. Giả thuyết đó đã bị loại.

**Nghi can hàng đầu:** `LessonView` là component có `useEffect` + `useRef` +
Fullscreen API mới thêm đợt này. Hộp chọn tệp của Windows làm trang **mất rồi
lấy lại tiêu điểm**; nếu lúc đó có một lần dựng lại làm `Viewer` ném lỗi thì
React gỡ cả cây con — mà `LessonView` đứng ĐẦU khối, nên đổ theo cả phần dưới.

**Còn thiếu để chốt (hỏi chủ dự án):**
1. Bấm **F5** tải lại thì màn hình có về bình thường không?
2. Vào **đúng bài đó** mà KHÔNG bấm nút đính kèm — có bị trắng luôn không?
3. Mở **Console** (F12) lúc màn trắng: có dòng đỏ nào không, chép giúp dòng đầu.

Câu 3 gần như chốt được ngay: nếu có `Error` kèm tên component thì đúng là cây
con bị gỡ, và sửa là bọc `LessonView` trong error boundary + tìm chỗ ném.

*(Đã thử tự tái hiện bằng bản mô phỏng dùng chính CSS live — Browser pane hết
thời gian chờ, không đo được. Không đăng nhập hộ được nên không vào thẳng màn
đó.)*

---

# VẤN ĐỀ VẬN HÀNH (không phải lỗi phần mềm)

## V1. 🔴 Hai bộ tài khoản trùng tiền tố — người thử đã đăng nhập NHẦM

**Bằng chứng cứng từ DB (29/07):**

| Học sinh | Tài khoản | Số lượt đối thoại |
|---|---|---|
| Nguyễn An | `hs1@`**`vietanh.edu.vn`** | **354** |
| Học sinh thử B | `hs2@`**`truongvietanh.com`** | 60 |
| Học sinh thử C | `hs3@`**`truongvietanh.com`** | 42 |
| **Học sinh thử A** | `hs1@`**`truongvietanh.com`** | **0** |

Người thử 1 được giao tài khoản **A**, đã điền chi tiết cả 18 chặng vai Học Sinh với
quan sát rất cụ thể — **nhưng A có 0 lượt**. Kết luận: họ đăng nhập nhầm sang
`hs1@vietanh.edu.vn` (Nguyễn An). Hai tài khoản cùng tiền tố `hs1`, chỉ khác tên miền.
Cặp `ph1@…` cũng y hệt, nên hai ghi chú "Không đúng" ở chặng 20–21 và nhật ký #6 là hệ
quả trực tiếp: lúc thì thấy "Học sinh thử A" (con thật nhưng chưa học gì), lúc thì thấy
"chưa liên kết" (vì `Phụ huynh An` không nối con nào).

**Hệ quả phải xử lý:**
1. **Riêng tư vẫn AN TOÀN.** `guardian_links` đúng: ph thử A→A, B→B, C→C. Không ai thấy
   con nhà khác. Chặng 20 bị đánh "Không đúng" là do **hiểu nhầm đề bài** (đề bảo ĐẾM
   số tên hiện ra; thấy đúng 1 tên nghĩa là ĐẠT), cộng với việc nhầm tài khoản.
2. **Dữ liệu thử của Người thử 1 lẫn với tài khoản chủ dự án.** Cả hai cùng dùng
   "Nguyễn An" (354 lượt) — không truy được ai làm gì. Các nhận xét vẫn có giá trị (quan
   sát thật trên app thật), nhưng đừng dùng số liệu của An để kết luận gì về người thử.
3. **Việc cần làm ngay, không phải việc code:** dọn bộ tài khoản demo cũ
   (`*@vietanh.edu.vn`) hoặc đổi tên cho khác hẳn, rồi nhắc Người thử 1 đăng nhập lại
   đúng `hs1@truongvietanh.com` và **học thật một bài** trước khi thử vai Phụ huynh —
   không thì màn hình phụ huynh mãi mãi trống.

---

# KHÔNG PHẢI LỖI — đề xuất tính năng & ghi chú nhiễu

Tách riêng theo lưu ý của chủ dự án: đừng để mấy dòng này chen vào hàng đợi sửa lỗi.

### Đ1. Cho học sinh chụp bài bằng **camera laptop**
> Người thử 3, chặng 12: *"HS chỉ có laptop, không có điện thoại, có thể thiết kế làm
> sao để HS có thể chụp bằng camera laptop (quay đúng hướng tập, có thể kèm theo hướng
> dẫn thì tốt)"*

Đề xuất hợp lý và rẻ (`getUserMedia`), nhưng là **tính năng mới**, không phải lỗi.
Đáng cân nhắc vì nó chạm đúng thực tế: nhiều em học bằng máy tính của nhà trường.

### Đ2. Giáo viên gửi **tệp riêng cho một em** khi chấm bài
> Người thử 1, nhật ký: *"Đề xuất thêm một chế độ để giáo viên có thể tải tệp lên cho
> học sinh tham khảo… môn Toán giáo viên cần thể hiện các công thức toán học, hiện tại
> web chưa có công cụ hỗ trợ."*

⚠️ Lưu ý khi trả lời người thử: **tải tệp lên ĐÃ CÓ** ở tab Học liệu (chính họ vừa thử
chặng 26–30 và đánh "Đúng như mô tả"). Cái họ thiếu là gửi **cho riêng một em, ngay lúc
chấm bài**, chứ không phải đăng chung cho cả bài. Đó là khác biệt thật → là đề xuất
đáng làm, nhưng hãy nói rõ để họ khỏi tưởng app không có gì.
Vế "chưa có công cụ thể hiện công thức toán" thì cần kiểm lại: app đã render KaTeX ở
phía học sinh; có thể ô nhập lời nhắn của giáo viên chưa hỗ trợ — **hỏi lại cho rõ**.

### N1. "Gõ bài làm hoặc nộp ảnh" (Người thử 2, chặng 14)
Nhiều khả năng chỉ là **chép lại mô tả trên phiếu**, không phải báo lỗi. Trước đây em
để là mục 13 "cần hỏi lại" — nay hạ xuống đây, **không cần xử lý** trừ khi họ nói thêm.

## Việc kèm theo khi sửa (đừng quên)

- Lỗi 1 · 2 · 4 · 6 · 7 → **chỉ deploy web** (`git push origin HEAD:main`).
- Lỗi 2 (phần câu hỏi) · 3 · 8 → **deploy edge function** (`learning-path`,
  `diagnose`, `chat-turn`, và fn `review-queue` mới nếu làm).
- Lỗi 5 → **một lệnh UPDATE trên DB prod**, chủ dự án tự chạy.
- Sau khi vá lỗi 8 nên rà lại `submissions` cũ: những bài đã được AI gật oan mà
  chưa qua tay giáo viên đang giữ `mastery_evidence` sai → có thể phải dọn.
