# Bàn giao Studio — Hiển thị công thức (KaTeX): đã sửa gì, còn gì cần Studio

**Từ:** đội Tutor · **Ngày:** 2026-07-25 · **Phạm vi:** toàn bộ nội dung đã đồng bộ Studio → Tutor.

## 1. Tình hình

Tutor render **mọi công thức qua thư viện KaTeX** (để học sinh học đúng ký hiệu).
Nguyên tắc an toàn: công thức nào KaTeX **không parse được** thì Tutor **không bịa**,
rơi về text thô — tức học sinh sẽ thấy `\frac{1}{2}` thay vì phân số. Để chặn việc đó,
Tutor đã chạy audit **chính đường render của app** trên **43.079 chuỗi** nội dung:

| Mốc | Số công thức hỏng |
|---|---|
| Ban đầu | **416** |
| Sau khi Tutor tự sửa renderer | **118** (−72%) |

**118 lỗi còn lại nằm ở 67 câu — do ĐỊNH DẠNG NGUỒN, cần Studio sửa** (không phải lỗi
render của Tutor). Danh sách đầy đủ (id câu · môn · công thức · lỗi): `docs/katex-fixlist.csv`.

## 2. Tutor đã TỰ LO — Studio KHÔNG cần đụng

3 nhóm sau Tutor đã xử ở renderer (dò tự động, không sửa nội dung nguồn):

- **Tập số blackboard-bold** `ℝ ℕ ℤ ℚ ℂ ℙ` → tự thành `\mathbb{R}`…
- **Ngoặc mô tả tập** `{x ∈ ℝ | P(x)}` → tự bọc `\{ \}`, `|` → `\mid`.
- **Chỗ điền `___`** (≥2 gạch dưới) → tự thành ô gạch chân trống.

## 3. CẦN STUDIO SỬA TẠI NGUỒN — 4 nhóm (67 câu)

Root chung: nội dung có LaTeX nhưng **soạn sai cú pháp / cắt cụt / lẫn ký tự lạ**.

### A. Set-builder bị cắt cụt hoặc chẻ đôi — **60 công thức** (nhóm lớn nhất)
Ngoặc `{ }` không đủ cặp: nửa `{x ∈ ℕ | x` ở một chỗ, nửa `< 10}` ở chỗ khác — thường
do xuống dòng, `**đậm**`, hoặc tách sang trường khác cắt ngang công thức.
- **Ví dụ:** `'E = {x ∈ ℕ | x` … và … `x < 10}` (mồ côi).
- **Câu:** `Q-0000197, Q-0000203, Q-0000204, Q-0000207, Q-0000226` … (và ~40 câu khác).
- **Sửa:** viết TRỌN set-builder trong MỘT trường, đủ cặp `{ }`, bọc `$...$`:
  `$A = \{x \in \mathbb{N} \mid x < 10\}$`.

### B. Dấu `\` (set-difference) viết sai thành lệnh LaTeX — **~31 công thức**
Hiệu tập `A \ B` viết bằng backslash trần → KaTeX hiểu `\B`, `\A`, `\n`… là lệnh không tồn tại.
- **Ví dụ:** `B \ A = {d} | ... A\B \ne B\A`.
- **Câu:** `Q-0000326, Q-0000327, Q-0000330, Q-0000362` … (+10).
- **Sửa:** dùng `\setminus`: `$A \setminus B$` (KHÔNG dùng `\` trần cho hiệu tập).

### C. Chỉ số `_` trống / LaTeX thô không bọc — **~21 công thức**
Vector/chỉ số dùng `_` trần hoặc `\overrightarrow{...}` cắt cụt, không trong `$...$`.
- **Ví dụ:** `\overrightarrow{AB}+\overrightarrow{BC}=\overrightarrow{____` (thiếu `}`).
- **Câu:** `Q-0000697, Q-0000707, Q-0000717, Q-0000727` … (+15).
- **Sửa:** bọc `$...$`, đóng đủ ngoặc; chỗ điền dùng `\underline{\quad}` thay vì `_` trần.

### D. Dấu nháy `'` bao quanh công thức → chồng mũ — **6 công thức**
Bọc công thức trong nháy đơn `'...'`; nháy đứng sau mũ `^{2}'` bị hiểu là *prime* → "Double superscript".
- **Ví dụ:** `'BC^{2} = AB^{2} + AC^{2}'.`
- **Câu:** `Q-0000086, Q-0001317, Q-0001645, Q-0001810` (+1).
- **Sửa:** bỏ nháy đơn bao quanh: `$BC^{2} = AB^{2} + AC^{2}$`.

## 4. Quy ước soạn công thức (để KHÔNG tái diễn)

1. **Mọi công thức bọc trong `$...$`** (hoặc `$$...$$` cho khối). Đừng để LaTeX thô ngoài `$`.
2. **Ngoặc đủ cặp** `{ }` `( )` `\{ \}` — soạn trọn công thức trong một trường, không để `**đậm**`/xuống dòng cắt ngang.
3. **Hiệu tập** = `\setminus`, **thuộc** = `\in`, **gạch điều kiện** = `\mid` (đừng dùng `\` hay `|` trần).
4. **Chỗ điền khuyết** để NGOÀI công thức, hoặc dùng `\underline{\quad}` — đừng để `_` trần.
5. **Không bọc công thức bằng nháy `'...'`**.

## 5. Cơ chế mới ở đường đồng bộ (quan trọng)

Từ nay `content-sync` có **cổng KaTeX**: khi đồng bộ, câu nào còn công thức **không render
được** sẽ **tự động giữ ở trạng thái `review`**, KHÔNG được auto-publish cho học sinh.
→ Studio sửa nguồn theo mục 3, Tutor sync lại thì câu đó **tự lên `active`**. Câu chưa sửa
sẽ không bao giờ lọt ra text thô trước mặt học sinh.

Cổng này dùng **chính logic hiển thị** của app (mirror 1-1, đã kiểm parity) — Studio sửa
đến đâu, đúng chuẩn đến đó, không lệch giữa "Studio thấy OK" và "Tutor render OK".
