# Bàn giao đợt 2 — 29/07/2026

Bốn việc còn lại sau đợt deploy sáng nay. Tất cả **đã viết + đã kiểm**, chưa
deploy (chờ anh chạy SQL trước).

---

## 1. Điền khuyết — "phải nhập ĐÚNG đáp án mới được"

**Gốc lỗi hoá ra KHÔNG phải dữ liệu bẩn.** Tôi rà 168 câu điền khuyết đang hoạt
động: **0 câu** thừa khoảng trắng, **0 câu** thừa dấu câu, **0 câu** có hai dấu
cách. Dữ liệu sạch.

Gốc thật nằm ở **ký tự sách in mà học sinh không gõ được**. Đo trên cả 1.868 câu
đang hoạt động:

| Ký tự | Số câu | Em gõ được không |
|---|---:|---|
| chỉ số dưới `x₀` | 1.199 | không |
| căn `√` | 592 | không |
| `≥` `≤` | 584 | không |
| chỉ số trên `A²` | 297 | không |
| dấu trừ `−` (U+2212, **khác** dấu `-` trên bàn phím) | 203 | không |
| `≠` | 39 | không |

Đáp án lưu `−f(x)` mà em gõ `-f(x)` là **chấm sai** — dù em hiểu bài hoàn toàn.
Nhìn bằng mắt hai chuỗi giống hệt nhau, nên không ai phát hiện ra.

**Đã sửa ở TẦNG CHẤM, không đụng một dòng dữ liệu prod nào** (đúng phương án anh
chốt). Thêm `normalizeTypography()` quy đổi ký tự sách in → ký tự bàn phím cho
**cả hai vế** trước khi so:

```
x₀ ≡ x0      A² ≡ A^2      − ≡ -       ≠ ≡ !=
≥ ≡ >=       ≤ ≡ <=        √3 ≡ sqrt(3)    × ≡ *
```

Kèm hai thứ phải sửa theo:
- `√` giờ đổi thành `sqrt(...)` để nhánh đại số đọc được — trước đây `2√x` chấm
  hụt vì mathjs không đọc nổi ký tự `√`.
- Bộ tính số biết **phép nhân ngầm**: `2√3`, `2(3+1)`, `2pi` là lối viết sách
  giáo khoa, trước đây trả về "không tính được" rồi rơi xuống so chữ → sai.

**Đây không phải nới lỏng.** `x₀` với `x0` vốn là MỘT, chỉ khác cách gõ. Đã khoá
lại bằng các ca ngược: `x0` vs `x₁` → SAI, `>=` vs `≤` → SAI, `f(x)` vs `−f(x)` →
SAI, `3√3` vs `2√3` → SAI.

**Gợi ý ngay tại ô nhập.** Mỗi chỗ trống hiện chữ mờ nói *kiểu* nội dung cần
điền — "một số", "biểu thức", "dấu so sánh", "một cụm 3 từ". Server suy từ **hình
dạng** đáp án nên **không lộ giá trị**: `12` và `97` đều ra "một số".

## 2. Đ1 — chụp bài bằng camera, nay có ở CẢ ô nộp bài trong bài học

Đợt trước tôi mới làm nửa: webcam chỉ có ở kho báu, còn ô nộp bài **giữa bài
học** — đường nộp chính, em dùng nhiều nhất — thì không có. Đã tách thành khối
dùng chung `CameraShot` và lắp vào cả hai chỗ; ô chọn tệp trong bài học cũng mở
thẳng camera sau trên điện thoại.

## 3. Đ2 — giáo viên đính tệp chữa bài vào lời nhắn

Thầy cô chấm xong đính được **một tệp** (ảnh bài đã chữa tay, PDF, Word) đi kèm
lời nhắn. Bài hình học thì một tờ giấy chữa tay nói được nhiều hơn cả đoạn nhắn.

Đường đi: cô đính tệp → tải lên bucket **private** `cham-bai/<trường>/<cô>/…` →
edge function kiểm lại đường dẫn (chặn gõ tay để đính bài của trường khác) → học
sinh mở bằng **link ký hạn 1 giờ**, gửi cho bạn khác thì hết hạn.

**Một lỗ tôi tự bắt được trong lúc làm:** lời nhắn của thầy cô xưa nay CHỈ tới
tay em khi bài **bị trả**. Nghĩa là cô đính bài chữa rồi bấm "Đạt" là tệp rơi vào
hư không — cô tưởng đã gửi, em không bao giờ thấy. Đã thêm thẻ **"Thầy cô nhận
xét bài em đã đạt"** (tông xanh, đứng cạnh thẻ đỏ "cần làm lại"), giới hạn **14
ngày** để không phình thành trang lưu trữ.

## 4. SQL anh chạy

**Chỉ một file**, cho Đ2:

```bash
node packages/db/run-sql.mjs packages/db/2026-07-29-tep-dinh-kem-loi-nhan-gv.sql
```

Thêm `--dry` để xem trước. Chạy lại nhiều lần vô hại. Nội dung: một cột
`submissions.teacher_file_path` + hai policy cho phép giáo viên ghi/xoá tệp trong
`cham-bai/<trường>/<mình>/`. Dòng kiểm cuối file phải ra `cot_moi_1 = 1`,
`policy_2 = 2`.

**Điền khuyết KHÔNG cần SQL** — dữ liệu vốn sạch, sửa nằm hết ở tầng chấm.

---

## Thứ tự deploy

1. Chạy SQL trên (**trước**, vì `teacher-grading` sẽ ghi vào cột mới).
2. Deploy 3 function:

```bash
supabase functions deploy learning-path --project-ref oonuzgnfoypibrssvmrt --use-api
```

```bash
supabase functions deploy teacher-grading --project-ref oonuzgnfoypibrssvmrt --use-api
```

```bash
supabase functions deploy chat-turn --project-ref oonuzgnfoypibrssvmrt --use-api
```

(`chat-turn` và `diagnose` dùng chung `_shared/cas.ts` + `_shared/interactive.ts`
nên phải deploy lại để nhận bộ chấm mới.)

```bash
supabase functions deploy diagnose --project-ref oonuzgnfoypibrssvmrt --use-api
```

3. Đẩy web:

```bash
git push origin HEAD:main
```

## Kiểm tay sau khi deploy

| Việc | Phải thấy |
|---|---|
| Câu điền khuyết có `x₀` trong đáp án, gõ `x0` | **ĐÚNG** |
| Đáp án `2√3`, gõ `2*sqrt(3)` | **ĐÚNG** |
| Đáp án `≥`, gõ `>=` | **ĐÚNG** |
| Đáp án `x₀`, gõ `x1` | **SAI** (không nới bậy) |
| Ô điền khuyết lúc chưa gõ | Có chữ mờ "một số" / "biểu thức" / "một cụm 3 từ" |
| Ô nộp bài **trong bài học** | Có nút **"Chụp bài bằng camera"** |
| Cô chấm bài, đính ảnh, bấm **Cho làm lại** | Em thấy thẻ đỏ + nút **"Xem bài thầy cô chữa"** |
| Cô chấm bài, đính ảnh, bấm **Đạt** | Em thấy thẻ **xanh** "Thầy cô nhận xét bài em đã đạt" |

## Đã kiểm những gì

- Ma trận chấm: **86/86 đạt** (thêm 8 ca ký tự sách in, trong đó 2 ca ngược).
- Test `packages/cas`: **26/26 đạt** (thêm 6 ca căn `√` chạy qua mathjs thật).
- 14 ca rà đối kháng riêng: đáp án chữ, tiếng Anh có nháy cong, gạch nối trong
  câu tiếng Việt, đơn vị `m²`, `-2^2 = -4`, `2 3` không được dính thành `23`.
- `tsc --noEmit` sạch · `next build` sạch · parse-check 6 edge function sạch.

## Còn lại — chưa làm, không chặn deploy

- **`kg_edges` = 0** trên prod: bản đồ tri thức không có cạnh tiên quyết nào, nên
  không bài nào khoá bài nào. Cần Xưởng xuất lại cạnh; không phải việc sửa mã.
- `effort-gate` vẫn là **mã chết** (logic thật chạy inline trong `chat-turn`).
- `matchesOption` chưa xử được **438 câu tham-số-hoá** (hiện chưa ảnh hưởng vì cả
  hai đường phục vụ đều lọc `tham_so_hoa = false`).
