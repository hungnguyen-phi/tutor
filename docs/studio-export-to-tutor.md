# Yêu cầu: Xuất học liệu từ Studio (Xưởng Học liệu AI) sang app Gia sư (tutor)

## Bối cảnh
App **tutor** (Việt Anh Personal Tutor) hiển thị học liệu do Studio sản xuất như một **"bài đặc biệt"** ở đầu mỗi điểm kiến thức của học sinh (slide, podcast, bài đọc, phiếu bài tập, flashcard, quiz, mindmap…).

Phía tutor **ĐÃ XONG** đầu nhận: có endpoint HTTP nhận học liệu, tự đưa vào phục vụ học sinh **ngay lập tức, KHÔNG qua bước duyệt nào nữa** (vì Studio đã có giáo viên duyệt — sản xuất ra là đạt chuẩn).

**Việc cần làm ở Studio:** khi một Asset đã được duyệt "chuẩn trường", đẩy nó sang tutor qua endpoint dưới đây.

---

## Endpoint

```
POST https://gxbxsdhvtwtjkfygetzb.supabase.co/functions/v1/import-kg
```

**Headers bắt buộc:**
```
Content-Type: application/json
apikey: sb_publishable_BYthnvkNq8azqs_Xr-P_8w_itKKV-UQ
Authorization: Bearer <JWT_CUA_GIAO_VIEN>
```
- `Authorization` phải là **access_token JWT của một tài khoản có vai `teacher` / `admin` / `leadership`** trong hệ tutor (đăng nhập Supabase Auth của project tutor). Không phải anon key. Endpoint từ chối vai khác (403).

---

## Body — khuôn `va.kg-bundle/2.2`, chỉ cần phần `resources`

```json
{
  "schema": "va.kg-bundle/2.2",
  "subject": "Toan",
  "version_label": "studio-export",
  "resources": [
    {
      "id": "asset-uuid-hoac-ma-on-dinh",
      "node_id": "TO10-C06-B01",
      "format": "flashcard",
      "tier": 1,
      "uri": "https://cdn.truongvietanh.edu.vn/assets/flashcard-abc.html",
      "ly_do_chon_format": "Thẻ lật giúp ghi nhớ nhanh công thức trước khi luyện.",
      "dual_coding": false,
      "accessibility": "Có phụ đề / chữ tương phản cao"
    }
  ]
}
```

Không cần gửi `nodes`, `edges`, `questions`… nếu chỉ đẩy học liệu. Bundle hợp lệ khi có **nodes HOẶC resources**.

### Bảng trường của mỗi phần tử `resources[]`

| Trường | Bắt buộc | Kiểu | Ghi chú |
|---|---|---|---|
| `id` | ✅ | string | **Mã ổn định của asset.** Gửi lại cùng `id` = cập nhật đè (upsert), không nhân bản. Đừng random mỗi lần export. |
| `node_id` | ✅ | string | **PHẢI trùng mã nguyên tử của tutor** (= `node_key`). Cùng hệ mã: `TO10-C06-B01`. Sai mã → học liệu không gắn được vào node nào, học sinh không thấy. |
| `format` | ✅ | enum | Một trong: `text` `infographic` `video` `animation` `mindmap` `podcast` `worked_example` `interactive` `slide` `worksheet` `flashcard` `quiz` |
| `uri` | ✅ (thực tế) | string | Link tới file học liệu — xem "Yêu cầu về uri" bên dưới. Thiếu uri thì tutor tự ẩn mục đó. |
| `tier` | — | 1 \| 2 \| 3 | Bậc học liệu. tier 1 = chính, 2–3 = mở rộng. |
| `ly_do_chon_format` | — | string | Câu giải thích ngắn hiện dưới khung xem. |
| `dual_coding` | — | boolean | Mặc định false. |
| `accessibility` | — | string | Ghi chú trợ năng. |

### `subject` hợp lệ
`Toan` · `Hoa` · `Anh` · `Van` (đúng chính tả, không dấu như trên).

---

## Yêu cầu về `uri` (QUAN TRỌNG — đây là mắt xích chính)

Học liệu Studio xuất ra là **HTML tự chứa** (mở là chạy), **PDF** (phiếu bài tập), hoặc **audio** (podcast). tutor render:
- Đuôi `.pdf` → nhúng đọc tại chỗ + nút tải.
- Đuôi `.mp3/.wav/.m4a/.ogg/.aac` → trình phát audio.
- Còn lại (HTML) → iframe sandbox cô lập (`allow-scripts`, KHÔNG same-origin).

`uri` có **2 dạng hợp lệ**:

1. **Link http(s) công khai** (khuyến nghị, đơn giản nhất) — ví dụ CDN/Drive/hosting của trường. tutor trả thẳng link này cho học sinh. → Studio tự host file HTML/PDF/audio ở nơi truy cập được bằng link.

2. **Đường dẫn trong bucket `learning-assets`** của Supabase tutor (ví dụ `toan/TO10-C06-B01/flashcard-abc.html`). tutor tự ký signed URL 1 giờ khi phục vụ. → Dạng này cần Studio upload file lên Supabase Storage của tutor (cần cấp quyền riêng). Chỉ dùng nếu muốn giữ file private.

Nếu chọn dạng 1 thì **không cần đụng gì tới Supabase tutor ngoài việc POST bundle**.

---

## Phản hồi

| HTTP | Ý nghĩa |
|---|---|
| `200` | OK. Body: `{ ok, version, nodes, edges, queued, resources, message }`. `resources` = số học liệu đã nạp (đã active, phục vụ ngay). |
| `409` | Môn này chưa có bản chương trình (KG version) ở trạng thái `published` trong tutor để gắn học liệu. → Cần nạp/publish cây kiến thức môn đó trước. |
| `422` | Bundle sai chuẩn. Body `issues[]` nêu rõ chỗ sai (thiếu id/node_id/format…). |
| `401` / `403` | JWT thiếu/sai, hoặc tài khoản không phải vai giáo viên/admin. |
| `500` | Lỗi ghi DB (kèm thông báo). |

---

## Ví dụ curl (test nhanh)

```bash
curl -X POST "https://gxbxsdhvtwtjkfygetzb.supabase.co/functions/v1/import-kg" \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_BYthnvkNq8azqs_Xr-P_8w_itKKV-UQ" \
  -H "Authorization: Bearer <JWT_GIAO_VIEN>" \
  -d '{
    "schema": "va.kg-bundle/2.2",
    "subject": "Toan",
    "version_label": "studio-export",
    "resources": [
      { "id": "fc-hs2-b01", "node_id": "TO10-C06-B01", "format": "flashcard", "tier": 1,
        "uri": "https://<host-cua-truong>/assets/fc-hs2-b01.html",
        "ly_do_chon_format": "Ôn nhanh công thức đỉnh trước khi luyện." }
    ]
  }'
```

---

## Định nghĩa "xong" (acceptance criteria)

1. Trong Studio, khi một Asset ở trạng thái đã duyệt "chuẩn trường", có hành động (nút hoặc job nền) **đẩy asset sang tutor** qua endpoint trên.
2. Mỗi asset map đúng: `node_id` = mã nguyên tử tutor, `format` đúng enum, `uri` là link **thực sự mở được** (đã host).
3. `id` ổn định để export lại là cập nhật đè, không nhân bản.
4. Xử lý phản hồi: 200 báo thành công (kèm số resources); 409/422/401 hiện lỗi rõ cho người vận hành.
5. (Nếu chọn uri dạng bucket) file được upload thật lên `learning-assets` trước khi gửi bundle.
6. Kiểm chứng end-to-end: sau khi đẩy 1 asset thật cho 1 node, mở app tutor bằng tài khoản học sinh, vào đúng node đó → thấy học liệu hiện ở phần **"Bài học / bài đặc biệt"** và mở/chạy được.

## Lưu ý
- Học liệu vào tutor là **active ngay, không qua duyệt lại** — nên chỉ đẩy asset ĐÃ duyệt chuẩn trường.
- Học liệu là tự học, **không tính vào điểm thành thạo** của học sinh (mastery chỉ đến từ phần hỏi đáp) — không cần gửi kèm điểm/đáp án gì.
- Toàn bộ giao diện học sinh là tiếng Việt; chỉ nội dung môn Tiếng Anh là tiếng Anh.
