# Đường biên giữa Studio và Tutor

> Trạng thái: **Đặc tả kiến trúc dài hạn** — không phải kế hoạch bàn giao.
> Soạn 2026-07-10. Hai hệ thống, hai codebase, hai vòng đời.

## 1. Hai app, hai vai

| | **Studio** (`school ai/studio`) | **Tutor** (`duong-edu/Tutor`) |
|---|---|---|
| Vai trò | Nhà máy sản xuất tri thức | Phòng học phục vụ học sinh |
| Sở hữu chân lý về | Cây tri thức, cạnh, gói bài soạn, học liệu | Người học: mastery, Leitner, hội thoại, bằng chứng |
| Người dùng | Giáo viên biên soạn, tổ trưởng duyệt | Học sinh, giáo viên chủ nhiệm, phụ huynh |
| Kho | `db.json` (lowdb) | Supabase Postgres + RLS đa tenant |
| Triển khai | Next.js server | Static export → Cloudflare Worker + Edge Functions |

**Nguyên tắc bất biến của đường biên: không bên nào ghi vào miền của bên kia.**
Studio không bao giờ biết học sinh nào tồn tại. Tutor không bao giờ sửa một atom.

## 2. Bốn quyết định đã chốt

1. **Dòng chảy một chiều.** Studio → Tutor. Không có vòng phản hồi tự động.
   Nếu Tutor phát hiện câu hỏi sai nhiều, giáo viên báo miệng, người ta sửa tay ở Studio.
   Ở quy mô một trường, vòng phản hồi tự động không đáng độ phức tạp nó mang lại.

2. **Tutor kéo, Studio không đẩy.** Studio mở một API chỉ-đọc và không cần biết ai đang đọc.
   Tutor có job kéo theo lịch. Hệ quả: Studio không cần một dòng code nào nhắc tới Tutor.

3. **Hai codebase riêng, hai đội, hai vòng đời.** Không monorepo chung.

4. **Nội dung đổi thì đánh dấu, không đóng băng.** Xem mục 4.

## 3. Contract: Studio publish, Tutor kéo

Studio mở ba endpoint đọc. Không xác thực người dùng — dùng service token của Tutor.

```
GET /api/kg/:subject/:grade          → nodes + edges + tiers  (khung tri thức)
GET /api/packages/:nodeKey           → gói bài soạn đã duyệt cho một atom
GET /api/assets/:assetId/file        → file học liệu (pptx | pdf | html | mp3 | …)
```

Mỗi bản ghi trả về mang theo `revision` (mục 4) và `status`. **Studio chỉ trả nội dung
`status='approved'`.** Bản nháp không bao giờ rời khỏi Studio — không phải vì Tutor chặn, mà vì
Studio không phát.

Tutor kéo về, đưa vào `review_queue` (`content_type` đã có sẵn các giá trị `node`, `question`,
`ladder`, `resource` — `packages/db/src/schema/governance.ts:19-24`). Người duyệt ở Tutor quyết
định *có phục vụ học sinh không* — một câu hỏi khác với *nội dung có đúng không*, và đó là lý do
cần hai cổng chứ không phải một.

Nguồn chân lý cho hình dạng dữ liệu là Zod schema ở `packages/shared/src/kg/types.ts`. Studio
import chính schema đó khi xuất. Dữ liệu lệch bị chặn tại cửa, không đi sâu vào hệ.

## 4. Nội dung đổi dưới chân học sinh: đánh dấu, không đóng băng

**Vấn đề.** Minh đã thành thạo atom `TO09-C01-A01`. Ba tuần sau giáo viên sửa lại atom đó. Bằng
chứng thành thạo của Minh giờ trỏ vào một nội dung không còn là nội dung em đã học. Không có lỗi
nào ném ra — mastery của em chỉ lặng lẽ mất nghĩa.

**Giải pháp.** Không giả vờ nội dung bất biến. Nói thật trạng thái ra:

| Màu | Nghĩa |
|---|---|
| 🟢 Xanh | Đã học. Nội dung chưa đổi kể từ lúc học. |
| 🟡 Vàng | Đã học. Nội dung đã đổi sau đó — vẫn tính là đã học. |
| ⬜ Xám | Chưa học. |

Học sinh **không bao giờ mất dấu "đã học qua"**. Màu vàng là lời mời ôn lại, không phải hình phạt.

**Cơ chế.** Mỗi atom mang một số `revision`. Khi Tutor ghi nhận Minh học xong, nó lưu kèm
`node_revision` tại thời điểm đó:

```
student_node_state  + node_revision int
mastery_evidence    + node_revision int
```

Đọc ra: `revision` hiện tại == `node_revision` đã lưu → xanh. Khác → vàng.

**`revision` do Studio tăng có chủ đích, không băm nội dung tự động.** Băm nội dung thì một dấu
phẩy cũng làm hàng trăm học sinh chuyển vàng. Khi giáo viên lưu gói, Studio hỏi: *sửa nhỏ* (chính
tả, định dạng — giữ nguyên revision) hay *sửa nội dung* (đổi nghĩa — tăng revision).

**Các ca biên đều gọn:**
- Tách atom A → A + A′: A chuyển vàng, A′ hiện ra xám.
- Gộp: atom bị gộp thành mồ côi, ẩn khỏi lộ trình, giữ lại lịch sử.
- Xóa: như trên.
- Đổi cạnh tiên quyết: lộ trình tính lại; các atom đã học giữ nguyên màu.

Cơ chế này thay thế hoàn toàn nhu cầu snapshot KG bất biến. Cột `kg_version_id` sẵn có trong
Tutor vẫn giữ vai trò tách môn/khối, không phải gánh chuyện phiên bản nội dung.

## 5. Studio còn thiếu gì để hoàn thiện *trong vai trò của nó*

Studio hôm nay là một xưởng biên soạn tốt: 12.641 atom, 3.831 cạnh, sinh được 8 định dạng học
liệu. Để trở thành nguồn phát tri thức đáng tin cậy, nó cần:

1. **Ba endpoint đọc** ở mục 3. Việc nhỏ — dữ liệu đã nằm sẵn trong `db.json`.
2. **`revision` trên atom và package**, cùng lựa chọn *sửa nhỏ / sửa nội dung* khi lưu.
3. **Chỉ phát nội dung `approved`.** Hôm nay `approved` là một trạng thái có thật trong `Pkg` nhưng
   chưa gói nào đạt tới. Không phải lỗi — chỉ là xưởng chưa chạy hết một vòng.
4. **Sinh `socratic_ladders`.** Tutor cần thang Socratic để dạy; Studio chưa có khái niệm này.
   Nguyên liệu đã có: 1.093 cạnh mang sẵn `quanNiemSai` + `remediationHint`.
5. **Hai trường còn thiếu trên câu hỏi** để Zod của Tutor chấp nhận:
   - `do_kho` (dễ/TB/khó). **Đây không phải `dok`.** Studio `dok` bám sát Bloom
     (Remember→1, Apply→2, Analyze→3) — đó là chiều sâu tư duy. `do_kho` là tỉ lệ học sinh làm
     được. Zod ghi rõ hai nhãn độc lập (`packages/shared/src/kg/types.ts:87`), và `mastery.ts`
     dùng **cả hai cùng lúc**: thành thạo cần ≥3/4 đúng *ở độ khó mục tiêu* **và** ≥1 câu *DoK≥3*.
     Gộp hai trục thì cổng chống-đoán-mò sụp thành một điều kiện.
     *Lối ra:* Studio điền `do_kho` bằng **ước lượng ban đầu** (suy từ `dok` cũng được), đánh dấu
     rõ là ước lượng. Tutor có sẵn `p_value` + `discrimination` trên bảng `questions` để ghi đè
     bằng dữ liệu thật sau vài trăm lượt làm bài. DoK là ý định người soạn; độ khó là sự thật do
     học sinh phát hiện.
   - `distractors[].quan_niem_sai` — mỗi phương án nhiễu phải trỏ đúng một quan niệm sai
     (`packages/shared/src/kg/types.ts:72-76`, ràng buộc cứng). Studio đang có `options[]` phẳng.

Mục 4 và 5 là phần nặng nhất, và cũng là phần khiến Tutor thực sự *thích ứng* thay vì chỉ là nơi
xem tài liệu.

## 6. Tutor còn thiếu gì để hoàn thiện *trong vai trò của nó*

1. **Job kéo** từ ba endpoint của Studio, theo lịch, ghi vào `review_queue`.
2. **Tầng phục vụ học liệu.** Bảng `resources` được khai báo ở `packages/db/kg-core.sql:74-90`
   nhưng **không một dòng code nào đọc nó**. Chưa có Storage bucket, chưa có UI hiển thị. Cần:
   bucket `learning-assets`, Edge Function trả resource `active` theo `node_key` + `tier`, và
   renderer trong `TutorApp`.
3. **Duyệt có preview** — mở rộng `teacher-review` cho `content_type='resource'`.
4. **Ba cột màu** ở mục 4 và cách hiển thị chúng trên lộ trình học.
5. **Thay `seed.ts` hardcode** bằng job kéo. Hiện tại nó nhúng đúng hai node mẫu ngay trong file.

### Định dạng nào hiện được trực tiếp

Trình duyệt không mở được `.pptx` — ràng buộc vật lý, không phải thiếu công sức. Studio may mắn đã
xuất được **HTML tự chứa** cho slide, flashcard, podcast (tham số `variant=html`).

| format | Phục vụ trong TutorApp | Nên kéo biến thể |
|---|---|---|
| slide | iframe sandbox | `html` |
| mindmap | HTML markmap | mặc định |
| podcast | `<audio>` | `mp3` |
| text, worksheet | PDF nhúng + nút tải | mặc định |
| flashcard | HTML tự chứa | `html` |
| video | tải về | — |
| quiz | HTML tự luyện, **không tính mastery** | `html` |

Cột `resources.format` là `text` tự do (`kg-core.sql:80`), không phải enum Postgres — thêm
`slide`, `mindmap`, `flashcard`, `podcast`, `worksheet`, `quiz` không cần migration.

### Hai loại quiz, hai đường ống

Studio thôi không tự dựng giao diện quiz nữa; nó xuất file đẹp, Tutor hiển thị. Nhưng phải phân
biệt rạch ròi:

**`resources` với `format='quiz'` — tự luyện.** File HTML tự chứa, học sinh tự làm, tự thấy giải
thích *sau khi* trả lời. Studio đã giấu đáp án sẵn (`<div class="ex" hidden>`, `route.ts:165`);
đáp án nằm trong JS phía client. **Không ghi `mastery_evidence`.** Em nào mở DevTools xem trước thì
chỉ tự thiệt, vì nó không tính điểm gì cả. Bộ test `golden-anti-leak.mjs` chỉ bảo vệ luồng đối
thoại Socratic (`guide` / `chat-turn`), không đụng tới `resources` — nên đường này hợp lệ.

**Bảng `questions` — đánh giá thật.** `dap_an` nằm phía server, chấm bằng CAS, ghi
`mastery_evidence`, quyết định học sinh có thành thạo hay không. Đây mới là nơi cần `do_kho`,
`distractors` trỏ quan niệm sai, và thang Socratic. Đường ống này phụ thuộc mục 5.4–5.5.

## 7. Thứ tự làm

Không có ràng buộc thời gian. Thứ tự dưới đây tối ưu cho việc *phát hiện sai lầm sớm*, không phải
cho việc giao hàng nhanh.

**Một — chốt contract.** Zod `LearningPackManifest` + hình dạng ba endpoint, đặt ở
`@tutor/shared`. Cả hai đội cùng nhìn vào một chỗ. Chưa cần code gì chạy.

**Hai — một atom chạy suốt.** Studio phát một atom Toán 9 đã duyệt; Tutor kéo về, duyệt, hiện lên
màn hình học sinh dưới dạng một slide HTML. Hẹp nhất có thể. Đường ống đúng hay sai lộ ra ở đây,
lúc còn rẻ.

**Ba — khung tri thức.** Kéo trọn Toán 9 (211 atom) + Toán 10 (204 atom) — đúng khối Tutor đang
pilot. Đây là lúc Tutor có đồ thị tiên quyết thật để chạy adaptive, thay vì hai node mẫu.

**Bốn — học liệu diện rộng.** Sáu định dạng hiển thị được, renderer, upload hàng loạt.

**Năm — câu hỏi và thang Socratic.** Ba khoảng trống ở mục 5.4–5.5. Nặng nhất, giá trị cao nhất.

## 8. Việc vệ sinh

`.env.example` đã commit URL Supabase thật và project ref `uksbvlkhcyhnpfamducc` lên GitHub;
`n8n/workflows/WF-EndSession.json` cũng vậy. Repo đang private nên chưa nguy hiểm. Phải dọn trước
khi mở public.
