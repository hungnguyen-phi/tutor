# Handoff: AI Tutor — Redesign "Sân trường buổi sáng" (Trường Việt Anh)

Gói bàn giao cho developer dùng **Claude Code** triển khai giao diện mới vào codebase hiện có.

## Overview

Redesign toàn diện app AI Tutor (web + mobile-web) của Trường Việt Anh: học tập thích ứng kiểu Duolingo nhưng **nghiêm túc hơn** (~80/100), tham chiếu Squirrel AI. Hướng đã chốt: **"Sân trường buổi sáng"** — tab Học là một khung cảnh (trời xanh → mây → đồi cỏ), lộ trình zigzag chạy trên cảnh, linh vật sư tử xuất hiện LỚN ở đúng 3 chỗ (đăng nhập, cạnh node hiện tại, màn hoàn thành), các màn công cụ còn lại nền phẳng sáng + thẻ trắng.

## About the Design Files

Các file `.dc.html` trong gói này là **bản thiết kế tham chiếu viết bằng HTML** (mở trực tiếp trong trình duyệt để xem — cần giữ nguyên cấu trúc thư mục vì có `support.js` và `brand/`). Chúng KHÔNG phải production code để copy nguyên xi.

Nhiệm vụ: **tái tạo giao diện này trong codebase hiện có** — Next.js App Router tại `apps/web` (static export), style bằng CSS thuần trong `app/globals.css` với CSS variables, component tại `apps/web/components/`. Dùng đúng pattern sẵn có của repo (AppShell, Hud, LearningPath, Lion, TutorApp…), thay giá trị token và markup theo spec dưới đây.

## Fidelity

- `AI Tutor Hi-fi.dc.html` — **HIGH-FIDELITY** (turn 3 + 4): màu, chữ, spacing, bóng, trạng thái là CHUẨN CUỐI. Tái tạo pixel-perfect.
- `AI Tutor Wireframes.dc.html` — **LOW-FIDELITY**: lịch sử khám phá phương án (tham khảo ý đồ, KHÔNG lấy style).

Trong file hi-fi, mỗi màn có badge id: `3a` trang chủ mobile · `3b` bài học mobile · `3c` trang chủ desktop · `4a` hoàn thành bài · `4b` bảng tuần · `4c` mục tiêu · `4d` hồ sơ · `4e` đăng nhập · `4f` dashboard giáo viên · `4g` báo cáo phụ huynh.

## Design Tokens

### Màu (bất khả xâm phạm: navy + gold giữ nguyên hex)

```css
/* Brand */
--navy: #26275D;          /* CTA chính, node hiện tại, heading, tab active */
--navy-press: #14153B;    /* bóng đáy nút navy (physical button) */
--gold: #F9DD0E;          /* XP, progress, node mastered, nút thưởng */
--gold-press: #C9A900;    /* bóng đáy nút/node gold */
--gold-icon: #D4A900;     /* icon gold trên nền trắng (KHÔNG dùng #F9DD0E làm chữ/icon trên nền sáng) */
--gold-text: #A68A00;     /* chữ nhỏ họ gold trên trắng (VD "+15 XP") */
--gold-tint: #FDF6C7;     /* nền highlight "hạng của bạn" */

/* Bầu trời (canvas cảnh) */
--sky-grad: linear-gradient(180deg,#AED2F1 0%,#CDE3F7 40%,#E7F2FC 68%);
--sky-text: #2E6DB4;      /* eyebrow, link, icon info */
--sky-tint: #E3EEFB;  --sky-tint-2: #EAF2FC;

/* Cỏ */
--grass-back: #9CCB77;  --grass-front: #7FB95C;  --grass-mound: #5F9E44;

/* Trung tính */
--surface: #FFFFFF;  --canvas-flat: #F6F9FD;   /* nền màn công cụ */
--ink-heading: #26275D;  --ink-body: #3D4761;  --ink-muted: #5A6B8C;
--ink-faint: #8296B4;    --ink-disabled: #97A8C0;
--border: #DCE6F2;  --track: #EDF2F9;  --hairline: #E4EBF4;
--locked-bg: #E9EFF7;  --locked-press: #C6D2E1;
--available-border: #BFD8F0;  --available-press: #C7D9EC;

/* Ngữ nghĩa */
--ok: #1E7A4A;  --ok-strong: #166339;  --ok-tint: #E8F4EC;  --ok-border: #BFE0CA;
--warn: #B45309;  --warn-tint: #FDF1E3;   /* "chưa đúng" — KHÔNG đỏ */
--mane: #C96E30;  --mane-text: #A34D0F;  --mane-tint: #F7E4D4;  /* streak/energy */
```

Quy tắc gold: không bao giờ làm màu chữ trên nền sáng; không bao giờ làm nền cho chữ trắng. Hợp lệ: fill icon/progress, nền chip-huy hiệu với chữ navy, chữ/icon trên nền navy.

### Chữ

```css
/* Display — tiêu đề trang, tên chương, khoảnh khắc lớn, biểu thức toán (italic) */
font-family: "Source Serif 4", Georgia, serif;   /* 600, 700 */
/* UI — toàn bộ còn lại */
font-family: "IBM Plex Sans", system-ui, sans-serif;  /* 400/500/600/700 */
/* Icon */
font-family: "Material Symbols Rounded";  /* FILL 1, wght 600 */
```

Scale (px): H1 serif 32/28/24 · card title serif 21–25 (letter-spacing −0.01em) · UI title 14.5–15 (700) · body 13.5–15 · phụ 11.5–12.5 · eyebrow 11/700, letter-spacing .1em, UPPERCASE, màu `--sky-text` · số liệu luôn `font-variant-numeric: tabular-nums` · biểu thức toán: serif italic 600, 26px.

Nếu muốn giữ lucide-react thay Material Symbols, map: school→GraduationCap, history→History, leaderboard→Trophy, flag→Flag, person→User, bolt→Zap, local_fire_department→Flame, workspace_premium→Award, redeem→Gift, lock→Lock, play_arrow→Play, check→Check, check_circle→CheckCircle2, close→X, timer→Timer, verified→BadgeCheck, event→CalendarDays, style→Layers, edit_note→PenLine, hourglass_bottom→Hourglass, family_restroom→Users, verified_user→ShieldCheck, mail→Mail, badge→IdCard, settings→Settings, expand_more→ChevronDown, menu_book→BookOpen, info→Info, signal/wifi/battery = status bar giả (bỏ khi làm app thật).

### Hình khối & bóng

```css
--r-chip: 999px; --r-card: 18-20px; --r-btn: 14px; --r-tile: 16px; --r-navpill: 10px;
--shadow-card: 0 2px 4px rgba(38,39,93,.05), 0 12px 28px rgba(38,39,93,.10);
--shadow-chip: 0 1px 2px rgba(38,39,93,.08), 0 4px 12px rgba(38,39,93,.10);
--shadow-row:  0 1px 2px rgba(38,39,93,.04), 0 6px 16px rgba(38,39,93,.06);
/* Nút "phím vật lý" — chữ ký của app */
box-shadow: 0 4px 0 <màu press>;  /* :active → translateY(2px) + shadow 0 2px 0 */
```

Progress bar: track `--track`, cao 8–12px, radius 999; fill gold thêm `box-shadow: inset 0 -2px 0 rgba(169,143,0,.35)`.

## Screens / Views

### 3a — Trang chủ học sinh (mobile 393)
Cột dọc: status bar → HUD → banner chương → CẢNH lộ trình (flex 1) → bottom nav.
- **HUD**: trái = pill trắng chọn môn (icon `calculate` sky + "Toán 10" 700 13.5 + `expand_more`); phải = pill streak (`local_fire_department` #C96E30 + số, chữ #A34D0F) + pill XP (`bolt` #D4A900 + số navy). Pill: padding 9×12–14, radius 999, shadow-chip.
- **Banner chương**: thẻ trắng radius 20, padding 15 18 16. Eyebrow "CHƯƠNG 2 · BÀI 3/8" + icon `menu_book` #B9CEE6 phải. Title serif 700 24 navy. Progress gold 10px + "38%" 700 13 #5A6B8C.
- **Cảnh**: nền gradient trời (cả screen đã gradient); mặt trời = đĩa gold 58px hé từ mép phải (right:−18, top:22) + 2 vòng glow `0 0 0 14px rgba(249,221,14,.20), 0 0 0 30px rgba(249,221,14,.08)`; 3 mây = ellipse trắng mờ .75–.92; 2 đồi = ellipse lớn radius 50% (#9CCB77 sau, #7FB95C trước) tràn mép dưới.
- **Node lộ trình** (ellipse ~68×56, zigzag): mastered = gold, shadow `0 6px 0 #C9A900`, icon check navy · current = navy 76×62, shadow `0 7px 0 #14153B`, icon play trắng, vòng ring ngoài 3px `rgba(249,221,14,.95)` cách 5px, nhãn "BẮT ĐẦU" = pill gold 700 12 ls .06em + tam giác trỏ xuống, nhún nhẹ · available = trắng viền 2.5 #BFD8F0, shadow `0 6px 0 #C7D9EC`, số 700 20 #7A9CC6 · locked = #E9EFF7, shadow #C6D2E1, icon lock #97A8C0 · rương quà = ô gold 46×40 radius 12 icon `redeem`.
- **Sư tử**: `lion-full.png` ~118px đứng cạnh node hiện tại, chân chạm ellipse mound #5F9E44 (132×30). Idle: thở translateY ±3px, 3s ease-in-out infinite.
- **Cổng chương**: thẻ trắng .94 nổi đáy cảnh: icon `workspace_premium` #D4A900 + "Cổng chương" 700 13 + mô tả 11.5 + lock.
- **Bottom nav** 5 tab ≥44px: Học `school` · Ôn tập `history` · Hạng `leaderboard` · Mục tiêu `flag` · Tôi `person`. Active: icon navy trong pill 40×30 nền #E4E6F4 radius 10, label 600 navy; nghỉ #8296B4. Label `white-space:nowrap`.

### 3b — Bài học (mobile)
Nền `--canvas-flat`. Header: `close` + progress gold 12px + "3/8". Eyebrow "CHỌN ĐÁP ÁN ĐÚNG". Thẻ câu hỏi trắng radius 18: biểu thức serif italic 600 26 navy + câu hỏi 15/1.5. Grid đáp án 2×2 gap 10: tile trắng viền 2 #DCE6F2 radius 16 padding 18, chữ 600 17 tabular; **selected**: nền #EEF0FA, viền + shadow `0 4px 0 #26275D`, chữ 700 navy. Gợi ý Socratic: `head-think.png` 52px + bong bóng trắng radius `16/16/16/4`, chữ 13.5/1.5, công thức nhúng serif italic. Footer 2 trạng thái:
- **Đang làm**: nền trắng, nút full "KIỂM TRA" navy (radius 14, padding 15, 700 15 ls .05em, shadow `0 4px 0 #14153B`; disabled khi chưa chọn: nền #E9EEF6 chữ #97A8C0, không shadow).
- **Đúng**: ribbon trượt lên nền #E8F4EC border-top 2 #BFE0CA: check tròn #1E7A4A + "Chính xác!" 700 17 #166339 + chip "+10 XP" gold/navy; nút "TIẾP TỤC" gold shadow `0 4px 0 #C9A900`.
- **Chưa đúng** (làm thêm, cùng anatomy): nền #FDF1E3, icon + chữ #B45309, copy "Chưa đúng — thử lại nhé", nút "THỬ LẠI" navy. KHÔNG đỏ, không trừ tim.

### 3c — Trang chủ desktop (≥1200, mock 1180×740)
3 vùng: **rail trái 92px** trắng (crest 44 + 5 tab dọc 68px, active pill #E4E6F4) · **cảnh giữa** = banner chương 480px giữa + path zigzag + sư tử 132 + cổng chương 420px đáy · **cột phải 330px**: chips streak/XP; thẻ "Bảng tuần · 10A" (3 hàng, hàng của mình nền #FDF6C7 radius 10, avatar navy chữ gold); thẻ "Nhiệm vụ tuần" (2 progress: buổi học fill navy, XP fill gold); thẻ tip sư tử nền #EAF2FC + `pose-point.png` 56. 900–1200px: bỏ cột phải; <900: layout mobile + bottom nav.

### 4a — Hoàn thành bài (mobile)
Gradient trời nhạt. Giữa: quầng nắng 3 vòng đồng tâm gold alpha .14/.24/.42 (290/216/150px) sau `pose-celebrate.png` 158px (scale-in 300ms). "Hoàn thành bài học!" serif 700 28. Sub "Đồ thị parabol · bài 3/8". 3 thẻ stat (radius 16, stagger 60ms): +45 XP (bolt) · 7/8 CHÍNH XÁC (check_circle #1E7A4A) · 12:24 PHÚT (timer #2E6DB4); số 700 19 tabular, nhãn 600 10.5 ls .06em #8296B4. Thẻ "Thành thạo · Đồ thị parabol | 54 → 62%": bar gold 62% + vạch mốc 54%. CTA gold "TIẾP TỤC" + link "Xem lại câu sai (1)" #2E6DB4. Không confetti.

### 4b — Bảng tuần (mobile)
Nền flat. H1 serif "Bảng tuần" + chip "còn 2 ngày" (`hourglass_bottom` mane). Sub: "Xếp theo nỗ lực (XP), không theo điểm số". Segmented control nền #E9EEF6 radius 12 padding 3, tab active trắng nổi. Hàng: radius 16 padding 12 14, shadow-row — rank 700 15 (hạng 1 màu #D4A900) · avatar 38 tint theo người · tên 700 14.5 + phụ 11.5 (chuỗi ngày) · XP 700 15 tabular. **Hàng của mình**: nền #FDF6C7, viền 2 gold, phụ "▲ 2 hạng so với tuần trước" #A34D0F. Cuối: thẻ nudge #EAF2FC + `head-smile.png` 34.

### 4c — Mục tiêu (mobile)
H1 serif. **Thẻ WIG navy** radius 20: eyebrow #9FA3E0 "MỤC TIÊU LỚN · WIG", title serif trắng 21, hạn `event` gold + "hạn 20/7 · còn 10 ngày" #C9CAE8, bar gold 12px trên track #3B3C78 + "68%" gold 700 15. Thẻ "Tuần này · 3/5 buổi": 7 ô tròn 32px T2–CN (xong = gold + check + shadow `0 2px 0 #C9A900`; hôm nay = viền 2.5 navy + chấm; còn lại #EEF2F8). "NHIỆM VỤ HÔM NAY": 3 hàng thẻ trắng — icon ô 34 radius 10 tint (gold/sky/ok) + tên 600 13.5 (+ progress mini nếu dở) + "+XP" 700 12 #A68A00; đã xong: gạch ngang, mọi thứ #8296B4.

### 4d — Hồ sơ (mobile)
Header: avatar 64 navy chữ serif gold "A" + tên serif 22 + "Lớp 10A · Trường Việt Anh" + `settings`. Grid 2×2 stat: 12 ngày (flame mane) · 4.280 XP (bolt gold) · 23 điểm thành thạo (verified #1E7A4A) · 2 huy hiệu (award sky). Thẻ "Huy hiệu chương": đạt = ô 52 gold radius 14 shadow press; chưa = viền dash #C3CFDE + lock. Thẻ "Thành thạo theo môn": 2 bar fill navy. Hàng "Tài khoản phụ huynh đã liên kết" + check xanh.

### 4e — Đăng nhập (mobile)
Full cảnh trời + mặt trời + mây + 2 đồi. Crest trong badge trắng 76px radius 22 shadow-card. "AI Tutor" serif 700 32 + "TRƯỜNG VIỆT ANH" 600 13 ls .14em #4A76AB. Tagline 15/1.55 #3D4761 max 280px. `lion-full.png` 196px giữa, chân trên mound. Nút: "Đăng nhập bằng tài khoản trường" navy (icon `badge`) · "Đăng nhập với Google" trắng shadow `0 4px 0 rgba(38,39,93,.18)`. Footnote PDPL 11.5 #33406B + link đậm #1D4F86.

### 4f — Dashboard giáo viên (desktop)
Top bar trắng: crest 34 + "AI Tutor · Giáo viên" + tabs pill (active navy) + "Cô Hạnh · Toán 10A" + avatar. Nền #F1F5FA. Hàng 4 KPI (nhãn 600 12, số 700 24 tabular; "Cần chú ý" #A34D0F, "Chờ duyệt" #2E6DB4). Trái: **"Học sinh cần chú ý"** — hàng khẩn nền #FDF1E3, avatar + tên 700 13 + lý do 11.5 (effort-gate / nghỉ 5 ngày / sai liên tiếp / node stale) + nút hành động (Xem/Nhắc/Giao ôn, nowrap); chú thích cờ an toàn nền #EAF2FC. Phải trên: **"Thành thạo lớp · Chương 2"** — bar chồng 3 đoạn mỗi node (gold thành thạo / navy đang học / #DCE6F2 chưa) + legend. Phải dưới: **"Hàng chờ duyệt"** (human-in-the-loop) — badge môn + mô tả + nút "Duyệt" navy.

### 4g — Báo cáo phụ huynh (mobile)
Eyebrow "BÁO CÁO TUẦN" + H1 serif "Bé An" + chip chọn tuần. Thẻ 3 stat chia cột hairline: 3 buổi · 78 phút · 12 ngày (mane). Thẻ "Tiến bộ trong tuần": bar navy + delta "62 → 68% ▲" #1E7A4A + vạch mốc cũ; note "xem nỗ lực và tiến bộ — không xem nội dung hội thoại của con". Thẻ nhận xét giáo viên: quote serif italic 13.5/1.6. Hàng "Đồng ý PDPL · đang hiệu lực" (`verified_user` xanh) + link "Quản lý". Tip cuối #EAF2FC + head-smile.

## Interactions & Behavior

- Motion chung: 150–250ms `cubic-bezier(0.25, 1, 0.5, 1)`; `prefers-reduced-motion` → crossfade/tức thì, sư tử đứng yên.
- Nút physical: `:active` translateY(2px) + shadow đáy 4px→2px. Focus ring: navy trên nền sáng, **gold trên nền navy**.
- Path: node current có ring gold + nhãn BẮT ĐẦU nhún nhẹ; chạm node locked → tooltip "Cần: <node thiếu>".
- Lesson: chọn đáp án → enable KIỂM TRA; đúng → ribbon trượt từ đáy + đếm XP; sai → ribbon amber THỬ LẠI (không mất lượt); gợi ý Socratic xuất hiện sau 1 lần sai.
- Completion: halo scale-in → 3 stat stagger 60ms → bar thành thạo chạy 54→62%.
- Leaderboard: hàng của mình luôn thấy được (sticky nếu ngoài viewport).

## State Management

Map vào code hiện có (`apps/web/components/TutorApp.tsx`):
- `PathNode.state`: `mastered | stale | current | available | locked` → style node như spec (stale = amber `--warn` + icon vòng xoay, thêm khi làm; hiện hi-fi chưa vẽ stale).
- HUD: `G.Progress` (streak, xp) → 2 chip; đổi môn = pill chọn môn.
- Lesson: `picked`, `verdict (ok|retry)`, `attempts`, `earned` → 2 trạng thái footer.
- Server path fallback giữ nguyên logic cũ.

## Assets

Đã có sẵn trong repo tại `apps/web/public/brand/` (không cần thêm): `lion-full.png` (login, path), `lion/head-think.png` (gợi ý bài học), `lion/head-smile.png` (nudge), `lion/pose-celebrate.png` (hoàn thành), `lion/pose-point.png` (tip desktop), `logo-crest-80.webp` (rail, login, teacher). Trong gói này thư mục `brand/` là bản copy để mở file HTML offline.

Fonts (Google Fonts hoặc self-host): Source Serif 4 (600, 700, italic 600) · IBM Plex Sans (400, 500, 600, 700) · Material Symbols Rounded (nếu không dùng lucide).

## Files

- `AI Tutor Hi-fi.dc.html` — hi-fi chuẩn cuối (mở bằng trình duyệt, giữ cùng thư mục với `support.js` + `brand/`)
- `AI Tutor Wireframes.dc.html` — wireframe khám phá (tham khảo)
- `support.js` — runtime để mở file .dc.html; không liên quan production
- `brand/` — assets linh vật + logo

## Gợi ý prompt cho Claude Code

> Đọc `design_handoff_ai_tutor/README.md`. Triển khai redesign vào `apps/web` theo spec: cập nhật token trong `app/globals.css`, đổi font sang Source Serif 4 + IBM Plex Sans, viết lại `LearningPath.tsx` thành cảnh trời-đồi với node như spec 3a/3c, cập nhật `Hud.tsx`, footer bài học trong `TutorApp.tsx` (2 trạng thái), và các màn 4a–4g. Giữ nguyên logic dữ liệu/API. Làm từng màn một, bắt đầu từ 3a, chạy `pnpm web:dev` để so với file hi-fi.
