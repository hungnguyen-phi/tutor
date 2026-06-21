# Wireframes lo-fi theo vai trò — AI Tutor Việt Anh

> Bản lo-fi (khung bố cục) để duyệt cấu trúc trước khi dựng HTML theo brand (navy `#26275D` + gold `#F9DD0E`).
> Trạng thái: **[đã có]** đang chạy · **[mới]** cần xây (gồm lớp 4DX coaching).
> Sau khi anh duyệt → em dựng HTML cho màn ưu tiên: **Student Scoreboard → Coach → Parent**.

## 0. Dữ liệu mới cho 4DX coaching (cần thêm)
```
coaching_links(student_id, coach_id, coach_type[main|buddy], cadence[4weekly|weekly], status)
wigs(student_id, title, lag_metric, target, due_date, set_by)              -- Mục tiêu tối quan trọng
lead_measures(wig_id, key, label, target_per_week, auto[true|false])      -- vd sessions/week, cards_reviewed%
scoreboard_weekly(student_id, week, wig_progress, lead_json, commitment, kept) -- tự sinh + commitment tay
```
Quyền mới: `coach:scoreboard:read` (GVCN, scoped) · `buddy:scoreboard:read` (peer, tối thiểu) · `wig:manage` (coach+HS).

---

## 1. HỌC SINH — Trang chủ `[đã có]` (+ thẻ Scoreboard `[mới]`)
```
┌───────────────────────────────────────────────────────────┐
│ [logo] AI Tutor · Trường Việt Anh        [Pilot] [Đăng xuất]│  ← navy bar + gold underline
├───────────────────────────────────────────────────────────┤
│ Xin chào, An 👋                                             │
│ Hôm nay mình học gì nhé?                                    │
│                                                            │
│ ┌─────────────────┐  ┌─────────────────┐                  │
│ │ 📐 Toán 10      │  │ 🗣️ Tiếng Anh    │   ← subject cards │
│ │ Hàm số bậc hai  │  │ MCQ·Viết·Nói    │                  │
│ └─────────────────┘  └─────────────────┘                  │
│                                                            │
│ ┌───────────────────────────────────────────────────────┐│
│ │ 📊 BẢNG ĐIỂM TUẦN CỦA EM (4DX)            [Xem >]      ││  ← [mới]
│ │ WIG: Thành thạo Hàm số bậc hai  ▓▓▓▓▓░░ 70%            ││
│ │ Tuần này: 2/3 phiên · ôn 80% thẻ · tự giải thích 4 lần ││
│ └───────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────┘
```

## 2. HỌC SINH — Phiên học (Tutor) `[đã có]`
```
┌───────────────────────────────────────────────────────────┐
│ Toán 10 · Câu 2/4                              [↩ Đổi môn]  │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ [T_HSB2][Bậc 2][DOK 2][TB]                             │ │  ← chips
│ │ Tìm tọa độ đỉnh của parabol y = x² − 4x + 3.          │ │
│ └───────────────────────────────────────────────────────┘ │
│  ─ hội thoại ─                                             │
│   (Em) (2; 3)                                              │  ← bubble phải (navy)
│   ╓ GỢI Ý SOCRATIC ───────────────────────╖               │  ← hint card (gold viền)
│   ║ Em tính tung độ đỉnh bằng cách nào?    ║               │
│   ╙──────────────────────────────────────╜               │
│   ··· (đang gõ)                                            │
│ ┌── composer (dính đáy) ────────────────────────────────┐ │
│ │ Nhập câu trả lời mới…                       [Trả lời]  │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

## 3. HỌC SINH — Weekly Scoreboard (4DX) `[mới]` ⭐ ưu tiên dựng
```
┌───────────────────────────────────────────────────────────┐
│ 📊 Bảng điểm tuần · Tuần 23 (16–22/6)     [Xuất PDF][Chia sẻ Buddy]│
├───────────────────────────────────────────────────────────┤
│ 🎯 WIG (Mục tiêu tối quan trọng)                           │
│   "Thành thạo chương Hàm số bậc hai trước 30/9"            │
│   Lag: mastery chương  ▓▓▓▓▓▓▓░░░ 70%                      │
├───────────────────────────────────────────────────────────┤
│ 📈 LEAD MEASURES (mình kiểm soát được) — tuần này          │
│   • Số phiên học        2 / 3      🟡                       │
│   • Ôn thẻ đến hạn      80%        🟢                       │
│   • Tự giải thích lại   4 lần      🟢                       │
│   • Hint usage giảm     ↓ 15%      🟢                       │
├───────────────────────────────────────────────────────────┤
│ 🗓️ NHỊP GIẢI TRÌNH                                          │
│   Coach chính (GVCN cô Bình): họp 4 tuần — kế tiếp 28/6    │
│   Buddy (bạn Minh): họp tuần — kế tiếp 24/6  [Check-in]    │
│   Cam kết tuần trước: "làm 3 phiên" → KẾT QUẢ: 2/3 ⚠️      │
│   Cam kết tuần này:  [____________________]  [Lưu]         │
├───────────────────────────────────────────────────────────┤
│ 📉 Đồ thị mastery 4 tuần  ▁▂▄▆                             │
└───────────────────────────────────────────────────────────┘
```

## 4. COACH = GVCN — Danh sách coachee `[mới]` ⭐ ưu tiên
```
┌───────────────────────────────────────────────────────────┐
│ Coach · Lớp 10A (12 học sinh)            cô Bình [Đăng xuất]│
│ Lọc: [● Cần chú ý] [ Tất cả ]      Họp 4 tuần kế: 28/6     │
├──────────┬──────────────┬─────────┬──────────┬────────────┤
│ Học sinh │ WIG          │ Lead    │ Họp gần  │            │
├──────────┼──────────────┼─────────┼──────────┼────────────┤
│ Nguyễn An│ HSB2 70% ▓▓░ │ 🟡🟢🟢   │ 31/5     │ [Xem >]    │
│ Trần Bình│ HSB2 35% ▓░░ │ 🔴🔴🟡   │ 02/5 ⚠️  │ [Xem >]    │ ← at-risk đỏ
│ Lê Cường │ Vecto 90% ▓▓▓│ 🟢🟢🟢   │ 30/5     │ [Xem >]    │
└──────────┴──────────────┴─────────┴──────────┴────────────┘
   ⚠️ 3 HS quá hạn họp · 2 HS lead measure đỏ 2 tuần liên tiếp
```

## 5. COACH — Chi tiết 1 HS (buổi họp 4 tuần) `[mới]`
```
┌───────────────────────────────────────────────────────────┐
│ ‹ Nguyễn Văn An · Lớp 10A                      [↩ Danh sách]│
│ ┌── Scoreboard (chỉ đọc) ───────────┐ ┌── WIG editor ────┐ │
│ │ WIG 70% · lead 🟡🟢🟢            │ │ Mục tiêu:[____]  │ │
│ │ mastery 4 tuần ▁▂▄▆              │ │ Hạn:[30/9]       │ │
│ │ misconception hay gặp: -b/2a sai │ │ Lead targets:    │ │
│ │ effort: 1.8 lượt/đúng           │ │ phiên/tuần [3]   │ │
│ └─────────────────────────────────┘ │ [Lưu WIG]        │ │
│ ┌── Ghi chú buổi họp ──────────────┐ └──────────────────┘ │
│ │ [textarea: nhận xét, cam kết...] │  [+ Tạo can thiệp]    │
│ │ [Lưu & chốt buổi họp]            │  [Cờ an toàn → cố vấn]│
│ └──────────────────────────────────┘                      │
└───────────────────────────────────────────────────────────┘
```

## 6. BUDDY — Peer scoreboard (tuần, GIỚI HẠN) `[mới]`
```
┌───────────────────────────────────────────────────────────┐
│ 🤝 Buddy của em: Minh           (chỉ xem scoreboard, tuần) │
│ ❗ Không xem được bài làm/hội thoại của bạn — chỉ tiến độ.  │
├───────────────────────────────────────────────────────────┤
│ WIG bạn Minh:  ▓▓▓▓▓░░ 65%                                 │
│ Lead tuần: phiên 3/3 🟢 · ôn 60% 🟡 · tự giải thích 🟢     │
│ Cam kết tuần này của Minh: "ôn hết thẻ trước CN"           │
│                                                            │
│ 👉 Buổi họp tuần (24/6):  [✅ Đã họp]  [Ghi 1 lời động viên]│
└───────────────────────────────────────────────────────────┘
```
> Buddy chỉ thấy *lead measures + WIG %* (đã đồng ý chia sẻ), KHÔNG mastery chi tiết/chat.

## 7. PHỤ HUYNH — Portal đã lọc `[mới]` ⭐ ưu tiên
```
┌───────────────────────────────────────────────────────────┐
│ Phụ huynh em An      [Con: An ▼]            [Đăng xuất]    │
├───────────────────────────────────────────────────────────┤
│ 🌟 TUẦN NÀY CỦA CON (tích cực là chính)                   │
│   • Con đã thành thạo 1 điểm kiến thức mới (Hàm số bậc hai)│
│   • Học 2 buổi, kiên trì tự sửa lỗi 👏                     │
│ 🌱 Vùng cần đồng hành                                       │
│   • Dấu công thức đỉnh parabol — con đang luyện            │
│ 💡 10 phút/ngày với con: "Hỏi con "đỉnh parabol tìm sao?"" │
├───────────────────────────────────────────────────────────┤
│ 🔐 Đồng ý dữ liệu:  [● Đang bật]  [Rút đồng ý]            │
│ 📄 [Tải báo cáo tuần PDF]                                  │
│ (Không hiển thị hội thoại thô · cờ an toàn xử lý qua GV)   │
└───────────────────────────────────────────────────────────┘
```

## 8. GV BỘ MÔN — Dashboard `[đã có]` (chuẩn hoá)
```
┌───────────────────────────────────────────────────────────┐
│ Bảng điều khiển GV          cô Bình [HS][Đăng xuất]        │
│ ┌ Misconception ┐ ┌ Effort ┐ ┌ Mastery ┐                  │
│ │ -b/2a sai  12 │ │ 1.76    │ │  100%   │  ← 3 metric cards│
│ │ GTNN=c      2 │ │ lượt/đúng│ │ 1/1 node│                  │
│ └───────────────┘ └─────────┘ └─────────┘                  │
│ ── Duyệt nội dung (review queue) ──                        │
│ [T_HSB2] Tìm đỉnh… [active]  [Thu hồi]                     │
│ [E_PRES3S] She __ school [review] [Duyệt ✓]                │
└───────────────────────────────────────────────────────────┘
```

## 9. TỔ TRƯỞNG CM `[mới]`
```
┌ Chất lượng môn Toán ───────────────────────────────────────┐
│ Node sai nhiều nhất:  HSB2 ▓▓▓▓ · Vecto ▓▓                  │
│ Câu hỏi: p_value/discrimination  [Lọc câu kém] [Retire]    │
│ System prompt: v3 [published]  [Tạo v4 draft][Rollback]    │
│ Ngân sách AI môn: $12/$50 tháng                            │
└────────────────────────────────────────────────────────────┘
```

## 10. CỐ VẤN TÂM LÝ `[mới]`
```
┌ Hàng đợi an toàn (xác minh trước) ─────────────────────────┐
│ ⚠️ Cờ #1 [tổn thương] HS ẩn danh · 2h trước  [Xác minh]   │
│    → ngữ cảnh tối thiểu (1 đoạn) · KHÔNG gửi PH tự động     │
│ ✓ Cờ #2 [bắt nạt] đã xử lý · ghi audit                     │
└────────────────────────────────────────────────────────────┘
```

## 11. BAN GIÁM HIỆU `[mới]` (chỉ tổng hợp)
```
┌ Toàn trường ───────────────────────────────────────────────┐
│ [Khối 10 ▼][Toán ▼]  Mastery TB 68% · Pacing on-track 82%  │
│ Heatmap lớp×chương  ▓▓░▓ · Exam readiness 74%             │
│ Chi phí AI/HS: $0.4/th · uptime 99.9%                      │
│ (không có dữ liệu/hội thoại thô của HS)                    │
└────────────────────────────────────────────────────────────┘
```

## 12. DPO `[mới]` & 13. ADMIN `[mới]`
```
DPO:  [Consent matrix] [DSAR queue] [DPIA] [Audit log ▼] [Vendor/cross-border]
ADMIN: [RBAC & gán vai trò][Permission simulator][LLM gateway: provider/model/budget]
       [Feature flags][AI Eval Lab: chặn prompt chưa đạt][Observability/cost]
```

## 14. ĐỘI NỘI DUNG — Duyệt `[đã có]` / Soạn `[mới]`
```
DUYỆT: review_queue → [Duyệt ✓ / Trả lại / Retire]  (đã có ở dashboard GV)
SOẠN:  [Node][Câu hỏi + distractor↔misconception][Rubric][Socratic ladder]
       → lưu trạng thái 'review' → chuyển người duyệt (SoD: không tự duyệt)
```

---

## Thứ tự dựng HTML đề xuất (sau khi duyệt wireframe)
1. **Student Weekly Scoreboard (4DX)** — lõi coaching, HS dùng hằng tuần.
2. **Coach/GVCN** (danh sách + chi tiết buổi họp 4 tuần).
3. **Parent portal (đã lọc)**.
4. Buddy peer-view · rồi các portal quản trị (Tổ trưởng/BGH/Cố vấn/DPO/Admin).
