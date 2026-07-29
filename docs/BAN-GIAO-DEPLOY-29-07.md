# BÀN GIAO ĐỢT VÁ 29/07/2026 — lệnh deploy cho chủ dự án

> Toàn bộ đã code + tự kiểm xong, **chưa deploy gì**. Claude bị chặn ghi
> production nên ba việc dưới đây chủ dự án tự chạy.
>
> Chi tiết lỗi: [DANH-SACH-LOI.md](DANH-SACH-LOI.md) · Kế hoạch: [KE-HOACH-SUA-LOI.md](KE-HOACH-SUA-LOI.md)

## Đã kiểm những gì

| Kiểm | Kết quả |
|---|---|
| `node tools/grading-matrix.mjs` | **78/78** — chạy trên chính module chấm thật (`cas`/`interactive`/`intent`) |
| `node tools/gate-trace.mjs` | 4 điều kiện đạt — thang 4 bậc dùng đủ, học sinh im lặng không kẹt, gõ bừa không mua được đáp án |
| `npx vitest run packages/cas packages/pedagogy` | **24/24** |
| `cd apps/web && npx tsc --noEmit` | sạch |
| `npx next build` | xanh (22 trang) |
| Cú pháp 43 tệp edge function | OK |
| Rà đối kháng | **4 vòng**, mỗi vòng soi lỗi trong bản vá của vòng trước, tới khi hội tụ |

## ⚠️ THỨ TỰ BẮT BUỘC

Deploy **edge function trước**, rồi mới chạy SQL dọn dữ liệu. Chạy SQL trước
thì AI vẫn còn quyền ghi mastery và dữ liệu bị bẩn lại ngay.

---

## Bước 1 · Deploy 7 edge function

Nạp token (cmd.exe — `export` không chạy):

```bash
for /f "tokens=1,* delims==" %a in ('findstr /b "SUPABASE_ACCESS_TOKEN=" .env') do @set "SUPABASE_ACCESS_TOKEN=%b"
```

Rồi deploy từng cái (đổi mã nguồn nhiều nhất xếp trước):

```bash
supabase functions deploy chat-turn --project-ref oonuzgnfoypibrssvmrt --use-api
```
```bash
supabase functions deploy review-queue --project-ref oonuzgnfoypibrssvmrt --use-api
```
```bash
supabase functions deploy learning-path --project-ref oonuzgnfoypibrssvmrt --use-api
```
```bash
supabase functions deploy diagnose --project-ref oonuzgnfoypibrssvmrt --use-api
```
```bash
supabase functions deploy resources --project-ref oonuzgnfoypibrssvmrt --use-api
```
```bash
supabase functions deploy scoreboard --project-ref oonuzgnfoypibrssvmrt --use-api
```
```bash
supabase functions deploy effort-gate --project-ref oonuzgnfoypibrssvmrt --use-api
```

`review-queue` là function **MỚI** — lần đầu deploy sẽ tự tạo.

## Bước 2 · Deploy web

```bash
git push origin HEAD:main
```

GitHub Actions build Docker → GHCR → Coolify, ~2,5–3 phút. Kiểm:

```bash
gh run list --limit 3
```

## Bước 3 · Dọn dữ liệu (SAU khi bước 1 xong)

Xem trước:

```bash
node packages/db/run-sql.mjs packages/db/2026-07-29-don-du-lieu-pilot.sql --dry
```

Chạy thật:

```bash
node packages/db/run-sql.mjs packages/db/2026-07-29-don-du-lieu-pilot.sql
```

Ba việc trong file: xếp lớp cho "Nguyễn An" (gốc lỗi 5) · nối phụ huynh demo với
con (gốc lỗi 18) · xoá 12 bằng chứng mastery do AI gật bừa rồi tính lại trạng
thái node (Q3 đã chốt). Bài đã qua tay giáo viên (`status='passed'`) được GIỮ.

---

## Kiểm tay sau khi deploy

| Việc | Phải thấy |
|---|---|
| Mở bài, gõ **"ok"** vào câu tự luận | Bị chặn: *"bài còn quá ngắn…"* — KHÔNG được "đủ ý chính", không tạo dòng chờ chấm |
| Gõ **"gợi ý giúp em"** vào ô đáp án | Sư tử dẫn dắt, **không** chấm, không tính lần thử |
| Sai 2 lần rồi gõ vào ô **"Kể cách em nghĩ"** | Nhận bậc 1 của thang (câu hỏi siêu nhận thức), lần sau bậc 2… |
| Câu điền khuyết, gõ **`0,2`** khi đáp án là `0.2` | ĐÚNG |
| Bấm thẻ đỏ **"cần làm lại"** | Vào đúng câu bị trả, thấy **lời nhắn của thầy cô** |
| Tab **Ôn tập** | Không còn "Chưa có gì để ôn" nếu đã thành thạo bài nào; có "đến hạn / sắp tới / nhớ bền" |
| Tab **Hạng** | Không còn nói "chờ buổi học đầu tiên" khi em đã có XP |
| **Kho báu** có phiếu bài tập | Khung xem cao theo màn, có nút Toàn màn hình, và có khối **NỘP BÀI** (kèm chụp webcam) |
| Điện thoại để **hệ điều hành chế độ tối** | App vẫn SÁNG |
| Đăng nhập | Nhanh hơn rõ (đã hâm nóng function; cold start đo được ~1,7s) |

## Còn lại — không chặn deploy

- `effort-gate` là **mã chết** (không nơi nào gọi; logic thật chạy inline trong
  `chat-turn`). Đã gia cố cho khỏi lệch, nhưng nên xoá hoặc nối vào ở đợt sau.
- `matchesOption` chưa xử được **câu tham-số-hoá** (438 câu). Hiện chưa ảnh hưởng
  vì cả hai đường phục vụ đều lọc `tham_so_hoa = false`.
- Bảng `attempts` **không** có `UNIQUE(session_id, question_id)` trên prod dù vài
  chú thích trong mã nói là có. Không hỏng gì (`mastery_evidence` có ràng buộc
  riêng), nhưng chú thích cần sửa lại cho khỏi dẫn sai người sau.
