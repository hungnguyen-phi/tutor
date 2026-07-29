# KẾ HOẠCH SỬA LỖI — phân nhóm & phương án

> Lập 29/07/2026, từ [DANH-SACH-LOI.md](DANH-SACH-LOI.md) (19 lỗi + 1 vấn đề vận hành
> + 2 đề xuất).
>
> ## ✅ ĐÃ THỰC HIỆN XONG — 29/07/2026
>
> Toàn bộ 7 nhóm A–G đã code xong, kèm 3 vòng **rà đối kháng** (mỗi vòng tìm lỗi
> trong chính bản vá của vòng trước) cho tới khi hội tụ. Xem lịch sử commit:
>
> | Commit | Nội dung |
> |---|---|
> | `4506fb7` | Nhóm A — tầng chấm: cổng ý định, fail-closed, số kiểu Việt, AI hết quyền ghi mastery |
> | `85bdf77` | Nhóm B — lượt của học sinh, nút xin gợi ý, đối thoại hai phía |
> | `f32efd7` | Nhóm C — lời nhắn giáo viên + bấm vào đúng câu bị trả |
> | `1e76d65` | Nhóm D — mở cửa hàng đợi ôn tập, màn rỗng nói đúng sự thật |
> | `03dd981` | Nhóm F — bỏ giao diện tối, sư tử reo, ô kết luận trong bước cuối |
> | `e51a2ac` | Nhóm E — khung xem cao theo màn + nộp bài từ kho báu |
> | `629db66` | Nhóm G — hâm nóng edge function (cold start đo được ~1,7s) |
> | `b7e0eb2` | Bảo mật — rate-limit chat/viết/nói, cache chấm, gọt quan niệm sai |
> | `342ef72` | SQL dọn dữ liệu pilot (**chủ dự án chạy**) |
> | `318310f` · `e4a8b73` · `a87089d` | Ba vòng vá theo rà đối kháng |
>
> **Kiểm chứng:** `tools/grading-matrix.mjs` 78/78 · `tools/gate-trace.mjs` đạt 4
> điều kiện · `vitest packages/pedagogy` 6/6 · `tsc --noEmit` sạch · `next build`
> xanh · 43 tệp edge function đúng cú pháp.
>
> **Còn lại (không chặn deploy):** `effort-gate` là mã chết (không ai gọi, logic
> thật chạy inline trong `chat-turn`) — nên xoá hoặc nối vào để khỏi trôi lệch;
> `matchesOption` chưa xử được câu tham-số-hoá (438 câu, hiện chưa ảnh hưởng).

---

# 🔑 PHÁT HIỆN GỐC (29/07, chủ dự án chỉ ra) — THIẾU **LƯỢT CỦA HỌC SINH**

Sư tử hỏi *"Em đã suy nghĩ thế nào để ra kết quả đó?"* — nhưng **học sinh không có chỗ
nào để trả lời**. Giao diện chỉ có ô đáp án. Nên em chỉ còn cách bấm đại phương án khác.

**Bằng chứng trong mã — chính chú thích tự thú** ([chat-turn:603](../supabase/functions/chat-turn/index.ts:603)):
```js
// thinkingQuality cho CỔNG = tín hiệu nội dung + NỖ LỰC theo số lần thử (đã
// qua trần số lần). Nhờ vế nỗ lực, giao diện chỉ có ô đáp án (MCQ không nhập
// được lời giải thích) KHÔNG kẹt vô hạn ở "require_thinking".
const thinkingQuality = Math.min(1, thinkSignal + Math.max(0, attemptNo - minAttempts) * 0.55);
```
Ngưỡng qua cổng = **0.5**. Với trắc nghiệm `thinkSignal ≈ 0` (đáp án là "B", không có chữ
để chấm), nên tới **lần thử thứ 3** là `0 + 0.55 ≥ 0.5` → **cổng mở**. Bấm đại thêm một
nhát là "đã suy nghĩ thật".

**Chuỗi nhân quả:**
`thiếu ô viết/nói` → `thinkSignal luôn 0` → `phải cộng theo số lần bấm kẻo kẹt vô hạn`
→ **cổng nỗ lực biến thành cái đếm click** → đoán mò 4 phương án là xong.

Đây là **gốc chung của cụm lõi sư phạm**: lỗi 9(c) không nói vì sao sai · 14 gõ lời cầu
cứu vào ô đáp án (vì không còn ô nào khác) · 15 đối thoại một chiều · 19 câu lặp một
khuôn · và rò XP dưới đây. Cũng chính là lý do giáo viên kết luận *"hướng dẫn của sư tử
chưa logic, hơi lộn xộn"* — sư tử hỏi một câu mà học sinh không thể trả lời.

### Đoán mò mất gì / được gì (đã tra mã, không suy đoán)

| | Kết quả | Bằng chứng |
|---|---|---|
| **XP** | ❌ **RÒ** — đoán trúng vẫn `+10 (đúng)` + `+5 (kiên trì)` = **+15 XP** | `xpEvents` ở nhánh `answer` |
| **Mastery câu thường** | ✅ **AN TOÀN** — `is_target_difficulty = attemptNo === 1`, bằng chứng ghi `ignoreDuplicates` nên lần đúng sau **không đè được** lần sai đầu | [chat-turn:476](../supabase/functions/chat-turn/index.ts:476) |
| **Mastery câu `[NOPBAI]`** | ❌ **CỬA HẬU** — `is_target_difficulty: true` vô điều kiện, và nhánh này **KHÔNG** `ignoreDuplicates` (nộp lại đè kết quả cũ) → nộp tới khi AI gật là node xanh | [chat-turn:825](../supabase/functions/chat-turn/index.ts:825) |

→ Đây chính là đường mà **12 bằng chứng nhiễm** (mục H3) đã đi vào.

### Cách sửa — và vì sao 2/3 KHÔNG cần AI

| Lớp | Việc | Cần AI? |
|---|---|---|
| 1 | **Mở lượt cho học sinh**: ô viết + nút nói, tách hẳn khỏi ô đáp án | ❌ thuần giao diện |
| 2 | **Chấm chất lượng suy nghĩ**: hàm `thinkingQuality()` trong `pedagogy.ts` **đã có sẵn và viết tốt** — ≥6 từ +0.4 · có số/phép tính +0.2 · có từ lập luận (vì/nên/suy ra) +0.4 · **chép lại y hệt câu trước → 0**. Đang bị vô hiệu chỉ vì không có gì để chấm | ❌ tất định, miễn phí, tức thì |
| 3 | **Dẫn dắt tiếp theo**: đọc em vừa viết gì → chọn bậc thang phù hợp, hỏi tiếp đúng chỗ em hổng | ✅ **đây mới là chỗ cần AI** |
| 4 | **Bỏ vế cộng-theo-số-lần-bấm** khỏi `thinkingQuality` sau khi lớp 1 xong; và **chỉ cộng XP `correct` khi `attemptNo === 1`** (hoặc giảm dần theo số lần thử) để bịt rò | ❌ |

> ⚠️ **Thứ tự bắt buộc.** Lỗi 8 đã chứng minh AI chấm chữ tự do rất tệ ("ok" qua được
> 3/5 lần). Mở ô nhập rồi đưa thẳng cho LLM phán đúng/sai là **nhân lỗi đó ra mọi câu**
> thay vì chỉ ở câu nộp bài. Phải đi: **mở lượt nói → chấm tất định (lớp 2) → AI chỉ lo
> phần dẫn tiếp (lớp 3), KHÔNG cho AI quyết đúng/sai.**

**Phạm vi thật của "phần lớn là do chưa đưa AI vào":** đúng với **cụm lõi sư phạm**
(9c · 14 · 15 · 19 · cổng nỗ lực · rò XP) — cũng là cụm khiến giáo viên nói chưa sẵn
sàng. **Không** áp dụng cho 3 · 5 · 18 (màn rỗng), 4 · 6 · 7 (giao diện), 12 (tốc độ),
16 (chuẩn hoá số) — mấy lỗi đó không dính dáng gì tới AI.

**Ảnh hưởng tới kế hoạch:** việc này nằm giữa **nhóm A** (tầng chấm) và **nhóm B** (giọng
dẫn dắt), và nên làm **ngay sau A1** — vì A1 (cổng vào phân loại ý định) chính là thứ
phân biệt "đây là đáp án" với "đây là lời em kể cách nghĩ".

---

## Nguyên tắc xếp nhóm

Không xếp theo màn hình, cũng không xếp theo mức độ — mà theo **GỐC CHUNG**. Lý do: rà
19 lỗi thì thấy chúng chụm lại thành vài chùm, mỗi chùm một nguyên nhân. Sửa theo chùm
thì mở một tầng ra làm một lượt; sửa theo màn hình thì mở đi mở lại cùng một tầng 5 lần,
lần nào cũng có cơ hội làm hỏng thêm.

| Nhóm | Tên | Lỗi | Mức | Công sức |
|---|---|---|---|---|
| **A** | **Tầng chấm** | 8 · 9 · 11 · 14 · 16 | 🔴 CHẶN | L |
| **B** | **Giọng dẫn dắt Socratic** | 9(b,c) · 14 · 15 · 19 | 🔴 P0 | M |
| **C** | **Luồng làm lại** | 2 (ba lớp) | 🔴 P0 | M |
| **D** | **Màn rỗng & sai nguồn số** | 3 · 5 · 18 · 6 | 🟠 P1 | M–L |
| **E** | **Học liệu & nộp bài** | 1 · Đ1 · Đ2 | 🟠 P1 | M |
| **F** | **Vá nhanh giao diện** | 4 · 6 · 7 · 10 · 17 | 🟡 P2 | S |
| **G** | **Hiệu năng** | 12 | 🟠 P1 | S (đo trước) |
| **H** | **Vận hành & dữ liệu** | V1 · dọn mastery · kho học liệu | 🔴 làm trước | S |

---

# NHÓM A — TẦNG CHẤM

**Lỗi:** 8 (AI gật "ok") · 9 (sai→đúng, lộ đáp án) · 11 (nhập số bất kỳ vẫn đúng) ·
14 (xin gợi ý → chúc mừng đã đúng) · 16 (điền khuyết đúng → bị chấm sai).

**Gốc chung — giả thuyết cần kiểm trước.** Đường đi *"học sinh nhập gì đó"* → *"đúng/sai"*
→ *"ghi `mastery_evidence`"* đang **fail open**: cái gì không hiểu được thì cho qua thành
ĐÚNG. Bốn lỗi 8·9·11·14 là bốn cách khác nhau để đâm vào đúng chỗ đó; lỗi 16 là mặt kia
(hiểu quá hẹp nên đánh trượt bài đúng).

**Vì sao nhóm này đứng đầu.** Mọi con số phía sau đều mọc từ đây: mastery, XP, hạng, huy
hiệu, báo cáo phụ huynh, hàng đợi chấm của giáo viên. Chấm sai thì sửa 18 lỗi kia cũng
chỉ là trang trí cho số liệu giả. Giáo viên đã nói thẳng: *"chấm trên app nhanh hơn NẾU
AI sơ khảo chính xác hơn"* — toàn bộ lời hứa tiết kiệm thời gian treo ở đây.

### Phương án — 4 bước, làm đúng thứ tự

**A0 · Bảng sự thật (điều tra, KHÔNG sửa gì) — bắt buộc làm trước.**
Dựng ma trận: **8 hình dạng câu × 6 kiểu đầu vào**
(đáp án đúng · đáp án sai · `ok` · chuỗi rỗng · một số bất kỳ · câu xin gợi ý).
Mỗi ô ghi 3 thứ: phản hồi trả về · `attempts.is_correct` · `mastery_evidence.correct`.
→ Ra 48 ô sự thật. Sau đó mới biết đang vá cái gì, thay vì đoán.
*Ước: 2–3h. Không deploy.*

**A1 · Cổng vào — phân loại Ý ĐỊNH trước khi chấm (tất định, không LLM).**
Trước khi đem đi chấm, hỏi: đây là **đáp án**, hay **câu hỏi/xin trợ giúp**, hay **rác**?
- Rác: dưới ngưỡng độ dài, hoặc chỉ gồm cụm rỗng nghĩa (`ok`, `vâng`, `đã hiểu`, `rồi ạ`)
  → trả *"bài còn quá ngắn so với yêu cầu"*, **không chấm, không ghi bằng chứng**.
- Xin trợ giúp: khớp mẫu (`gợi ý`, `giúp em`, `không biết làm`, `hint`) → **đi vào thang
  Socratic**, không đi vào đường chấm. Đây là chỗ vá lỗi 14.
- Còn lại: mới đem chấm.
*Chạm: `chat-turn/index.ts`. Ước: nửa ngày.*

**A2 · Chấm tất định cho đúng — và FAIL CLOSED.**
- Chuẩn hoá số kiểu Việt: `0,2` ≡ `0.2`, bỏ khoảng trắng, bỏ dấu phân cách nghìn,
  chấp nhận `- 0,2`. (lỗi 16)
- Rà lại parse câu nhiều bước và câu điền khuyết: bước nào **không parse được thì trả
  `undecided`, TUYỆT ĐỐI không mặc định `correct: true`**. (lỗi 9, 11)
- Rà `dap_an` trong ngân hàng câu điền khuyết xem có nhất quán định dạng không — người
  thử nghi "cần chỉnh sửa data", phải kiểm trước khi đổ lỗi cho mã.
*Chạm: `_shared/cas.ts`, `_shared/interactive.ts`. Ước: 1 ngày.*

**A3 · Ai được quyền ghi mastery — CẦN CHỦ DỰ ÁN QUYẾT (xem §Quyết định Q1).**
Đề xuất: AI sơ khảo **không** tự ghi `mastery_evidence` cho câu `[NOPBAI]`; nó chỉ phản
hồi tức thì cho học sinh + gợi ý cho giáo viên. Mastery chỉ ghi khi **giáo viên bấm Đạt**.
*Chạm: `chat-turn`, `teacher-grading`. Ước: nửa ngày SAU khi có quyết định.*

**Nghiệm thu nhóm A:** chạy lại đúng ma trận A0. Điều kiện đạt: **không ô nào** ở cột
`ok` / rỗng / số-bất-kỳ / xin-gợi-ý sinh ra `correct: true`; cột "đáp án đúng" phải đúng
100% kể cả khi gõ `0,2`.

---

# NHÓM B — GIỌNG DẪN DẮT SOCRATIC

**Lỗi:** 9(b) lộ đáp án · 9(c) không nói vì sao sai · 14 (không có lối xin gợi ý) ·
15 (tin nhắn học sinh không hiện) · 19 (câu "Gần được rồi" lặp).

**Vì sao là P0.** Đây chính xác là lý do giáo viên trả lời **"CHƯA sẵn sàng cho lớp
dùng — phần hướng dẫn của sư tử chưa logic, hơi lộn xộn"**. Nhóm A làm số liệu đúng;
nhóm B làm app đáng dùng.

### Phương án

**B0 · LƯỢT CỦA HỌC SINH — việc nền của cả nhóm** (xem 🔑 Phát hiện gốc ở đầu file).
Ô "Kể cách em nghĩ" (+ nút nói nếu kịp) tách khỏi ô đáp án; nội dung chấm bằng
`thinkingQuality()` sẵn có; bỏ vế cộng-theo-số-lần-bấm; XP `correct` chỉ phát ở
`attemptNo === 1`. AI chỉ dùng ở phần dẫn dắt tiếp theo, không quyết đúng/sai.

**B1 · Nút "Xin gợi ý" riêng.** Tách hẳn khỏi ô nhập đáp án. Bấm → vào thang Socratic
bậc kế tiếp, đếm vào cổng nỗ lực. Hết chuyện gõ lời cầu cứu vào ô đáp án. *(lỗi 14)*

**B2 · Khung đối thoại hiện CẢ HAI phía.** Server đã lưu lượt học sinh
(`persist("student", …)`), nên nhiều khả năng chỉ là web không vẽ bong bóng của học
sinh — cần dò `TutorApp.tsx`. *(lỗi 15)*

**B3 · Nói vào NỘI DUNG em sai, thay vì nói rằng em sai.** Dữ liệu đã có sẵn và đang bị
bỏ phí: mỗi distractor gắn một **quan niệm sai**, mỗi thang Socratic gắn một
`misconception`. Khi chấm sai và khớp được distractor → nói ra quan niệm sai đó (vẫn
KHÔNG lộ đáp án). Bỏ chuỗi cố định `Gần được rồi — còn thiếu: …`, xoay vòng vài cách nói.
*(lỗi 9c, 19)*

**B4 · Chốt lại cổng nỗ lực.** Dò xem có đường nào trả `bottom_out` ngay lần sai đầu.
`dieu_kien_mo: "qua_cong_no_luc"` phải được tôn trọng tuyệt đối. *(lỗi 9b)*

*Chạm: `chat-turn/index.ts`, `TutorApp.tsx`. Ước: 1–1,5 ngày. Deploy: cả edge fn + web.*

**Nghiệm thu:** làm sai 3 lần liên tiếp một câu có distractor → phải nhận 3 câu dẫn
KHÁC NHAU, mỗi câu nói vào quan niệm sai, và **không câu nào chứa đáp án**.

---

# NHÓM C — LUỒNG LÀM LẠI

**Lỗi 2, ba lớp chồng nhau** (người thử xác nhận đủ cả ba):
1. Không thấy **lời nhắn của giáo viên** → không biết sai gì.
2. Bấm thẻ đỏ **không vào được** → không biết bài nào.
3. Vào rồi **phải học lại cả bài từ đầu** → *"dễ gây hoang mang"*.

### Phương án — sửa ngược thứ tự đau

**C1 · Hiện lời nhắn giáo viên.** Đang nằm sẵn trong `submissions.feedback`, học sinh
chưa bao giờ thấy. Rẻ nhất, đau nhất → làm trước.
**C2 · Chỉ làm lại ĐÚNG câu bị trả.** `learning-path` trả thêm `redoQuestionIds`
(dữ liệu đã có trong `latestByQuestion`, đang bị vứt); `diagnose` nhận `questionId` và
phục vụ câu đó trước.
**C3 · Thẻ đỏ thành nút bấm được**, mỗi tên bài một nút.

*Chạm: `learning-path`, `diagnose`, `LearningPath.tsx`, `TutorApp.tsx`. Ước: 1 ngày.*
**Nghiệm thu:** giáo viên trả bài kèm lời nhắn → học sinh vào thấy lời nhắn, bấm một
phát vào đúng câu đó, làm xong là bàn chân hết đỏ.

---

# NHÓM D — MÀN RỖNG & SAI NGUỒN SỐ

**Lỗi:** 3 (Ôn tập trống) · 5 (Hạng trống) · 18 (báo cáo phụ huynh trống) · 6 (huy hiệu).

**Gốc chung, hai tầng.**
- *Sai nguồn:* mỗi màn đọc một nơi. Cùng một em: Hồ sơ nói "3 điểm thành thạo" (server),
  Ôn tập nói "0" (localStorage), Hạng nói "chưa có gì" (thiếu `grade`).
- *Im lặng khi rỗng:* không phân biệt **chưa học** / **chưa đủ điều kiện** / **lỗi tải** —
  màn nào cũng chỉ hiện một câu chung chung, khiến người dùng kết luận app hỏng.

### Phương án

**D1 · Một nguồn sự thật.** Mastery + XP đọc server ở MỌI màn. Bỏ `loadMastered()`
localStorage khỏi `ReviewView` và `QuestsView`.
**D2 · Mở cửa Ôn tập.** Hạ tầng **đã có sẵn**: `student_node_state.leitner_box` +
`next_review_at`, `end-session` đang ghi thật, `teacher-stats` đã đọc để đếm "due".
Chỉ thiếu endpoint cho học sinh. → `review-queue` trả node đến hạn; `ReviewView` chia
**"Đến hạn hôm nay" / "Sắp tới" / "Đã thuộc chắc"**; nút Ôn mở phiên ôn thật.
**D3 · Luật KHÔNG MÀN RỖNG.** Mỗi màn phải nói đúng trạng thái của nó:
| Màn | Khi trống phải nói |
|---|---|
| Ôn tập | *"Hôm nay chưa tới hạn ôn — quay lại ngày mai"* + ngày gần nhất |
| Hạng | phân biệt *chưa xếp lớp* ≠ *lớp chưa đủ người* ≠ *cả lớp chưa ai học* |
| Phụ huynh | *"Bé chưa có buổi học nào — khi bé bắt đầu, kết quả sẽ hiện ở đây"* |
**D4 · Huy hiệu nói rõ.** "5 **điểm thành thạo**" + dòng tiến độ *"bạn có 3/5…"*; hạ mốc
đầu xuống 1 để có phần thưởng sớm; thêm huy hiệu theo nỗ lực (chuỗi ngày, XP) cho khớp
triết lý "thưởng nỗ lực".

*Chạm: `ReviewView`, `Scoreboard`, `ProfileView`, màn phụ huynh, `learning-path`,
fn `review-queue` mới. Ước: 2 ngày.*

---

# NHÓM E — HỌC LIỆU & NỘP BÀI

**Lỗi 1** (khung xem kẹp 360px, cuộn lồng cuộn; không có đường nộp lại từ kho báu)
· **Đ1** (chụp bằng webcam laptop) · **Đ2** (giáo viên gửi tệp riêng khi chấm).

**E1 · Xem cho ra hồn.** Bỏ trần `360px`, cho khung PDF cao theo màn (`min(78vh, 900px)`),
thêm nút toàn màn hình, cân nhắc `<iframe>` + `#view=FitH` để hết cuộn ngang.
**E2 · Nộp bài ngay từ kho báu.** Với học liệu dạng `worksheet`, thêm khối *"Làm xong rồi?
Nộp cho thầy cô"*, dùng lại `submitWork` + `uploadBaiLam` sẵn có.
⚠️ Ràng buộc: `submitWork` đòi `questionId` gắn nhãn `[NOPBAI]`. Đề nghị cho `resources`
trả kèm `questionId` của câu `[NOPBAI]` cùng bài — **không đụng schema**.
**E3 · Chụp bằng webcam** (`getUserMedia`) — rẻ, và chạm đúng thực tế nhiều em chỉ có laptop.
**E4 · Giáo viên gửi tệp cho riêng một em lúc chấm** — tính năng mới.

*Ước: E1 nửa ngày · E2 1 ngày · E3 nửa ngày · E4 1 ngày.*

---

# NHÓM F — VÁ NHANH GIAO DIỆN

Gộp một đợt, **chỉ chạm web**, không đụng engine → ghép được vào bất kỳ lần deploy nào.

| Lỗi | Việc | Ước |
|---|---|---|
| 4 | Tiêu đề chờ có tên rồi mới vẽ — bỏ chuỗi tạm "bạn" | 15' |
| 7 | Gỡ nút giao diện tối khỏi nav + mục trong Cài đặt, ép sáng, xoá khoá `va-theme` cũ. **Giữ CSS dark** làm mã chết — xoá 1.000+ dòng lúc này là tự rước rủi ro | 30' |
| 10 | Sư tử reo khi đúng (hiện chỉ cộng XP) | 1h |
| 17 | Câu nhiều bước: khi làm lại thì gom các bước về một chỗ, giữ câu trả lời cũ, hết cuộn lên–xuống | 2h |
| 6 | Nhãn huy hiệu (đã gộp vào D4) | — |

---

# NHÓM G — HIỆU NĂNG

**Lỗi 12** — hai người báo, có ca **hơn 1 phút**.
**Đo trước, sửa sau.** Bấm giờ 4 chặng: tải bundle → xong auth → `learning-path` trả về →
lộ trình hiện. Ba nghi can: cold start edge function · `setTimeout 1400ms` gỡ intro (tự
mình làm chậm mình khi mạng nhanh) · bundle nặng.
*Ước: 1h đo + tuỳ kết quả.*

---

# NHÓM H — VẬN HÀNH & DỮ LIỆU (làm TRƯỚC mọi thứ, không phải việc code)

**H1 · Dọn bộ tài khoản trùng tiền tố (V1).** `hs1@truongvietanh.com` vs
`hs1@vietanh.edu.vn` — Người thử 1 đã nhầm, khiến toàn bộ phần thử vai Học Sinh của họ
chạy trên tài khoản "Nguyễn An" (354 lượt) trong khi tài khoản được giao có **0 lượt**.
→ Đổi tên hoặc bỏ bộ `*@vietanh.edu.vn`; nối con cho `ph1@vietanh.edu.vn`.

**H2 · Sửa dữ liệu roster.** `Nguyễn An` thiếu `grade` + `class_id` → chính là gốc lỗi 5.
Một câu UPDATE. Kèm ràng buộc bắt buộc khối+lớp khi tạo học sinh, để khỏi tái diễn.

**H3 · Dọn `mastery_evidence` bị nhiễm — LÀM NGAY KHI CÒN NHỎ.**
Hiện trạng đo được: **85 bằng chứng · 52 đúng · 3 học sinh · 14 node**. Trong đó
**12 bằng chứng "đúng" do AI chấm câu `[NOPBAI]`**, phủ **5 node** (Nguyễn An 4, Học sinh
thử B 1). Mà node chỉ xanh khi có ≥1 câu **DOK≥3** đúng — câu `[NOPBAI]` thường chính là
câu DOK-3 đó. Nói cách khác: **rất có thể mấy node xanh hiện nay là xanh nhờ AI gật bừa.**
→ Sau khi vá nhóm A, xoá 12 dòng đó rồi tính lại `student_node_state`.
Dọn bây giờ tốn một câu SQL; đợi tới lúc 300 học sinh dùng thì tốn một chiến dịch.

**H4 · Kho học liệu gần trống.** `resources` = **3 dòng** cho **204 bài**. Giáo viên nói
*"tài liệu soạn sẵn chưa sát thực tế dạy học"*. Công cụ đăng đã chạy tốt (cả ba người thử
đều đạt ở chặng 26–30) → **nút thắt là NỘI DUNG, không phải phần mềm.** Xem Quyết định Q2.

---

# TRÌNH TỰ ĐỀ NGHỊ

| Đợt | Làm gì | Vì sao đứng đây | Ước |
|---|---|---|---|
| **0** | H1 · H2 · **A0 (bảng sự thật)** | Không sửa mã. Dọn tài khoản để đợt thử sau đáng tin, và biết chính xác tầng chấm hỏng chỗ nào trước khi động vào | 1 ngày |
| **1** | **Nhóm A** (A1→A2→A3) + **H3** | Mọi số liệu mọc từ đây. Dọn dữ liệu nhiễm ngay sau khi vá | 2–3 ngày |
| **2** | **Nhóm B + C** | Đúng thứ giáo viên nói khiến họ "chưa sẵn sàng" | 2–3 ngày |
| **3** | **Nhóm D** + gộp **F** | Hết màn chết, số liệu về một nguồn | 2 ngày |
| **4** | **Nhóm E + G** | Học liệu, nộp bài, tốc độ | 2–3 ngày |

Sau đợt 2 nên **cho ba người thử chạy lại** đúng các chặng từng báo lỗi, và lần này bắt
buộc điền **SỔ LỖI** (đang trống hoàn toàn) + **7 câu hỏi mở** (Người thử 2 bỏ trống,
Người thử 3 ghi "không có" cho cả 7).
**Kịch bản phối hợp 0/11 vẫn chưa ai chạy** — phải chạy trước khi mở cho lớp thật.

---

# BA QUYẾT ĐỊNH CẦN CHỦ DỰ ÁN (chặn nhóm A và H)

**Q1 · Có giữ lời hứa "nộp bài là được tính điểm ngay" không?**
- *Giữ:* học sinh có phản hồi tức thì, nhưng AI vẫn có quyền ghi mastery → phải dựa hoàn
  toàn vào chốt chặn A1/A2, rủi ro còn sót.
- *Bỏ (đề nghị):* AI chỉ phản hồi + gợi ý cho giáo viên; mastery chỉ ghi khi cô bấm Đạt.
  Chắc chắn về sư phạm, nhưng học sinh phải chờ tới khi được chấm.
→ **Chặn bước A3.**

**Q2 · Học liệu: trường soạn sẵn tới đâu?**
3 dòng cho 204 bài. Giáo viên sẵn sàng tự đăng nhưng nói tài liệu sẵn "chưa sát thực tế".
Cần chốt: trường soạn bộ chuẩn cho bao nhiêu bài, phần còn lại để giáo viên tự lo?
→ Ảnh hưởng H4 và giá trị thật của tính năng kho báu.

**Q3 · Có dọn 12 bằng chứng mastery do AI gật không?**
Dọn thì 5 node của 2 học sinh thử sẽ mất trạng thái xanh (tiến độ tụt lại). Không dọn thì
số liệu pilot mang sẵn vết bẩn. → **Đề nghị dọn**, vì đang là dữ liệu thử, không phải học
sinh thật.
