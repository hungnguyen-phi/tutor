# ĐỐI ỨNG TỪ ĐỘI TUTOR — trả lời Hợp đồng kỹ thuật của Studio (school-ai)
*(Đội Tutor → đội Studio · 2026-07-23)*

Cảm ơn bản hợp đồng. Đội Tutor đã **hoàn thành Đợt A/B/C/D** và **verify LIVE trên production** (DB dùng chung `gxbxsdhvtwtjkfygetzb`). Dưới đây trả lời từng mục + phần **cần Studio cấp lại**.

Khoá liên kết dùng chung: `node_key`/`question_key` = **mã atom Studio** (bất biến, idempotent). Version: **Tiếng Anh 10** `4a839fc3-4008-482d-9802-cd4c3566739d`, **Toán 10** `6cc28358-2d65-4f18-ac34-c670f6b82a58`.

---

## Mục 2 — UI tương tác → ✅ ĐÃ XÂY (Đợt A)
Đã dựng giao diện thao tác + bộ chấm cho:

| Dạng | UI | Chấm | Kết quả trên data thật |
|---|---|---|---|
| **sap_xep** | Kéo–thả xếp thứ tự (desktop) + chạm ▲▼ (mobile) | So khớp **dãy** với `dap_an` | parse hiển thị **91%** (câu không bóc được vẫn chạy qua ô nhập) |
| **noi_cot** | Kéo–thả / chạm nối 2 cột | So khớp **tập cặp** (không phụ thuộc thứ tự) | parse **100%** |
| **dung_sai** | Nút Đúng/Sai | Chuẩn hoá true/false vi–en | 100% |
| **mcq / dien_dap_an / dien_khuyet** | Đã có sẵn | CAS / khớp chuẩn hoá | 100% |
| **phan_tu** | (giữ `tinh_mastery=false`) | — | OK |

- **Chấm 100% TẤT ĐỊNH ở server (KHÔNG dùng LLM)** — engine đọc `dap_an` để dựng đáp án đúng, đúng như hợp đồng ghi.
- **Studio KHÔNG cần đổi dữ liệu** cho 3 dạng này. Bộ parse của Tutor **dẫn đường bằng `dap_an`** nên chịu được mọi biến thể định dạng đang có (`1↔A`, `A1↔b2`, `B-a.`, ngăn bởi `|`, ngoặc `(3)`, stem dính mục…).
- **Đề nghị nhỏ (tùy chọn):** nếu Studio **chuẩn hoá 1 khuôn trình bày** cho sap_xep/noi_cot thì tỉ lệ dựng UI đẹp sẽ lên ~100% (phần lẻ hiện rơi về ô nhập — vẫn chấm đúng, chỉ kém đẹp).

## Mục 3 — Dữ liệu đặc biệt → xử lý + cần Studio
| Dạng | Tutor đã làm | CẦN Studio |
|---|---|---|
| **nghe** | Nút **"Nghe" đọc transcript bằng Web Speech (TTS)** — MVP, zero-cost, sẵn sàng | **Đẩy câu `nghe`** kèm **transcript trong `noi_dung`** (hiện DB **0 câu nghe**). Có `audio_uri` thật thì càng tốt — Tutor sẽ ưu tiên phát audio. |
| **tim_loi** | Hạ về `dien_dap_an` — **vẫn chấm được** | Chỉ khi muốn UI tìm-lỗi riêng: cấp `loi_cai_san[]` theo khuôn `{vị trí lỗi, sửa đúng}`. **Tutor tạm chưa ưu tiên** (số câu ít) — bật khi Studio thấy cần. |
| **nhieu_buoc** | Hạ về `viet_doan` — vẫn chấm | Tương tự: cấp `buoc[3–5]` nếu muốn UI từng-bước. |

## Mục 4 — Rubric chấm tự luận → ✅ TUTOR ĐÃ CHỐT KHUÔN (Đợt B)
Tutor định **3 khuôn rubric theo KỸ NĂNG**, mỗi tiêu chí **thang 0–3** (0 chưa đạt · 1 yếu · 2 khá · 3 tốt). Đã chấm **có điểm từng tiêu chí** (LLM chấm theo khuôn, trả JSON) + hiển thị **bảng điểm (scorecard)** cho học sinh — formative, không phải điểm chính thức.

**Ánh xạ dạng → kỹ năng:**
- **Viết (Writing):** `viet_doan`, `tu_luan_ngan`
- **Nói (Speaking):** `noi`  → xác nhận `nhom_cham = speaking_agent` ✅
- **Lập luận (Reasoning):** `phan_bien`, `giai_thich_cho_ban`, `du_doan_giai_thich`, `van_dung_thuc_te`

**3 khuôn tiêu chí (đây là "khuôn" Studio bám để cấp rubric riêng từng câu):**

| Kỹ năng | Tiêu chí 1 | Tiêu chí 2 | Tiêu chí 3 |
|---|---|---|---|
| **Viết** | Nội dung & Nhiệm vụ (bám đề, đủ ý, phát triển ý) | Từ vựng & Ngữ pháp (chính xác, đa dạng, đúng thì/cấu trúc) | Bố cục & Liên kết (mở–thân–kết, mạch lạc) |
| **Nói** | Trôi chảy & Mạch lạc | Từ vựng & Ngữ pháp | Đáp ứng đề (đúng & đủ) |
| **Lập luận** | Luận điểm (nêu rõ quan điểm) | Lập luận & Dẫn chứng (lý lẽ chặt, có ví dụ) | Diễn đạt (rõ ràng, chính xác) |

**CẦN Studio:** cấp **rubric riêng từng câu** theo khuôn trên, định dạng cột `rubric` (jsonb):
```json
[{"tieu_chi":"<tên tiêu chí>","thang_muc":["0 – …","1 – …","2 – …","3 – …"]}, ...]
```
Khi câu có rubric riêng, **Tutor tự dùng thay khuôn mặc định** (đã code sẵn nhánh này); câu chưa có rubric riêng vẫn chấm theo khuôn kỹ năng. Lời giải gốc đã chứa tiêu chí chấm nên Studio chỉ cần đóng gói theo khuôn.

## Mục 5 — Mở MÔN MỚI (GDKTPL 10 / Công nghệ / GDCD) → ✅ TUTOR ĐÃ DỰNG CỬA (Đợt D)
Xác nhận 3 điểm hợp đồng hỏi:
- **(a) enum `subject`:** cột `subject` là **TEXT (không ràng buộc enum)** → nhận **mọi mã subject**. Studio cứ đặt mã theo mã atom (vd `GDKTPL`, `CN08`, `GD09`). Tutor không cần migration enum.
- **(b) tạo version:** **importer TỰ TẠO** `kg_versions` (status `published`) khi nạp bundle — Studio **không cần tạo trước**.
- **(c) khuôn node/edge/question:** đã chốt **1 bundle JSON**; Studio đẩy đúng khuôn là Tutor nạp + bật:
```json
{
  "subject": "GDKTPL", "grade": "10", "label": "GDKTPL 10 — Kết nối tri thức",
  "nodes":     [{ "node_key":"KP10-C01-A01", "label":"…", "chapter":"C01",
                  "cluster":"…", "type":"KN", "bloom_cu_tru":"Understand",
                  "mo_ta":"…", "est_minutes":8 }],
  "edges":     [{ "from_key":"KP10-C01-A02", "to_key":"KP10-C01-A01",
                  "relation":"prerequisite_hard", "weight":1.0 }],
  "questions": [{ "question_key":"KP10-C01-A01-Q1", "node_key":"KP10-C01-A01",
                  "dang_cau_hoi":"mcq", "loai_danh_gia":"objective", "nhom_cham":"auto",
                  "noi_dung":"…", "dap_an":"A",
                  "distractors":[{"phuong_an":"B","quan_niem_sai":"…"}],
                  "tier":1, "dok":2, "do_kho":"de" }]
}
```
`relation` ∈ `prerequisite_hard | related_soft | misconception | cross_subject | part_of`. Câu objective phải có `dap_an`; câu rubric nên kèm `rubric`. **Đề nghị:** Studio đẩy **bundle GDKTPL 10 (210 câu Trạm 3)** trước để chạy thử trọn vẹn.

## Mục 6/7 — Đối ứng & ưu tiên
Tutor đã làm **đúng thứ tự ưu tiên** hợp đồng đề xuất:
1. ✅ **UI kéo–thả sap_xep + noi_cot** (Đợt A) — LIVE.
2. ✅ **Rubric theo kỹ năng** (Đợt B) — khuôn đã CHỐT, LIVE.
3. ✅ **Audio (TTS) cho nghe** (Đợt C) — MVP Web Speech.
4. ✅ **Cửa mở môn mới** (Đợt D) — importer + runbook sẵn sàng.

Bonus: Toán 10 nay **đủ 9/9 chương thang Socratic** (cảm ơn Studio đã soạn **C09 — Xác suất**, 22 thang/12 node).

---

## ⇢ TÓM TẮT NHỮNG GÌ TUTOR CẦN STUDIO CẤP
1. **Rubric riêng từng câu** (~340 câu tự luận) theo **3 khuôn kỹ năng** ở Mục 4 — jsonb `thang_muc` 0–3.
2. **Câu `nghe`** kèm **transcript trong `noi_dung`** (và/hoặc `audio_uri`).
3. **Bundle GDKTPL 10** theo khuôn atom ở Mục 5 (rồi các môn kế: Công nghệ 8–9, GDCD 9).
4. *(Tuỳ chọn)* Nếu muốn UI riêng **tim_loi / nhieu_buoc:** cấp `loi_cai_san[]` / `buoc[3–5]` theo khuôn.
5. Tiếp tục **sync idempotent** theo `question_key`/`node_key` khi kho cập nhật.

Mọi thứ Tutor đã dựng đều **agnostic theo môn** — có version published + câu active là học được ngay; rubric/nghe/UI đặc biệt cắm thêm không cần sửa engine.
