# Design

## Theme

**"Sân trường buổi sáng."** Thế giới của chính con sư tử Việt Anh: nắng sớm, trời xanh nhạt,
cỏ dưới chân, đồng phục navy, huy hiệu vàng. Đổi từ "Lớp học buổi tối" (đợt trước) theo phản
hồi trực tiếp của chủ dự án: bản navy-trên-trắng đọc ra *trầm mặc, đơn điệu, không muốn học*.

Cảm giác cần đạt: **năng lượng Duolingo, chất liệu Việt Anh.** Học sinh mở app thấy một
người bạn và một con đường sáng màu — không phải một tài liệu. Vẫn là trường học: không
tiếng chuông trò chơi, không confetti mỗi câu đúng, phần thưởng lớn để dành cho khoảnh khắc
xứng đáng.

Chiến lược màu: **Committed.** Màu phủ 30–60% bề mặt qua canvas trời, banner chương, icon
theo họ màu, chip tint. Trắng vẫn là mặt thẻ; màu là không khí xung quanh.

## Color

Hai màu thương hiệu bất khả xâm phạm (giữ nguyên hex): navy `#26275D`, gold `#F9DD0E`.
Bảng mở rộng lấy từ **art gốc của linh vật** — không phải màu tuỳ hứng:

| Vai | Token | Sáng | Dùng cho |
|---|---|---|---|
| Thương hiệu | `--navy` | `#26275D` | hành động chính, tab Học, chữ đậm |
| Phần thưởng | `--gold` | `#F9DD0E` | XP, mastered, tiến độ đầy, huy hiệu |
| Năng lượng | `--mane` (bờm sư tử) | `#C96E30` / chữ `#A34D0F` | streak, tab Hồ sơ, khoảnh khắc mascot |
| Bầu trời | `--sky` | `#2E6DB4` / nền `#E3EEFB` | tab Ôn tập, banner chương, info |
| Cỏ | `--ok` | `#146C43` / đồi `#7FB95C` | đúng, tab Mục tiêu, bệ cỏ sư tử |
| Canvas | `--canvas` | `#EDF3FB` (trời sáng) | nền app — KHÔNG còn trắng tinh |
| Surface | `--surface` | `#FFFFFF` | thẻ nổi trên trời bằng bóng, không viền xám dày |

**Luật cứng về gold (giữ nguyên).** Gold sáng ~0.89 OKLCH: không bao giờ là màu chữ trên nền
sáng, không bao giờ là nền cho chữ trắng. Ba dạng hợp lệ: nền huy hiệu/chip với chữ navy;
fill icon và thanh tiến độ; chữ/icon trên nền navy.

**Mane ≠ warn.** `--mane` (cam bờm, năng lượng) và `--warn` (`#B45309`, "chưa đúng") cùng họ
cam nhưng KHÔNG đổi chỗ được: warn chỉ sống trong ribbon phản hồi + trạng thái stale; mane
không bao giờ xuất hiện trong ngữ cảnh phản hồi đúng/sai. Cả hai luôn đi kèm icon + chữ.

Semantic (giữ): đúng = pine `#146C43` · chưa đúng = amber `#B45309` (KHÔNG đỏ — sai là dữ
liệu) · lỗi hệ thống = `#B02A20` · khoá = muted + icon ổ khoá.

Trạng thái node (màu không bao giờ đứng một mình, luôn kèm icon):
🟡 mastered = gold-700 + tick · 🟠 stale = amber + vòng xoay ("mời ôn lại") ·
🔵 current = navy + play, to nhất màn · ⚪ available = mặt trắng viền sky + mầm cây ·
🔒 locked = xám mềm + ổ khoá + tên điểm tiên quyết còn thiếu.

Mọi sắc độ phái sinh qua `color-mix(in oklab, …)`. Mọi cặp chữ-nền mới phải đo ≥4.5:1
(chữ thường) / ≥3:1 (chữ lớn, icon nghĩa).

## Mascot — linh vật chính chủ, cử động được

Nguồn art: **bộ mascot kit chính thức** (`assets-src/mascot/`, 6 sheet) đã cắt thành
**29 sprite nền trong suốt** tại `public/brand/lion/` bằng `assets-src/mascot/slice.mjs`
(flood-fill nền từ mép để không đục thủng mắt trắng; un-blend viền anti-alias).
12 đầu biểu cảm · 8 tư thế toàn thân · 9 cảnh có đạo cụ. Bản SVG vẽ lại và cặp
`lion-full.png`/`lion-head.png` cũ đã ngừng dùng trong app.

**Hai tầng chuyển động** (Lion.tsx + globals.css), cộng hưởng nhưng độc lập:

1. **Hoán frame** — chớp mắt thật: đầu mở ↔ `head-content` 140ms mỗi 3–6s ngẫu nhiên;
   khẩu hình nói: `head-talk` ↔ `head-smile` 180ms khi `talking`. Frame chớp render
   chồng sẵn (đảo opacity) — không decode lại ảnh.
2. **Choreography CSS** — thở (idle), lắc vẫy quanh bàn chân (`pose-wave`), nảy + lắc lư
   (cheer), đồi cỏ `.lion-scene`, quầng nắng gold ở màn hoàn thành, dõi con trỏ (login).

Mood → sprite: `idle`=head-smile (+blink) · `thinking`=head-think (tay chống cằm, nghiêng 6°)
· `cheer`=pose-celebrate · `sleepy`=head-sleep (zzz thật, hết lọc xám) · `greet`=pose-wave ·
`idea`=scene-idea · `study`=scene-study · `confused`=head-confused · `success`=scene-success
· `trophy`=scene-achievement · `notify`/`reminder`/`support`/`point`/`read`/`run`/`laptop`.
`variant="full"` nâng idle→pose-wave, thinking→pose-ponder.

Sư tử xuất hiện LỚN (≥112px) ở: chào đầu lộ trình (trên đồi cỏ), màn hoàn thành, đăng
nhập, trạng thái rỗng. Đầu nhỏ (56–72px) chỉ trong bong bóng gợi ý giữa bài. Không rải
sư tử lên mọi góc — bạn đồng hành, không phải hình nền. Mọi cử động tắt theo
`prefers-reduced-motion` (frame đứng ở khung cơ bản).

## Icon — có hồn, không xám

Vẫn một bộ **lucide-react** (không trộn bộ khác), nhưng hết thời icon xám mồ côi:

- **Mỗi tab điều hướng một họ màu**: Học=navy · Ôn tập=sky · Bảng tuần=gold · Mục tiêu=pine
  · Hồ sơ=mane. Tab active = icon màu đậm của họ, ngồi trong **viên tint tròn** của họ đó;
  tab nghỉ = stroke `--ink-2` (không phải muted bạc).
- Icon nghĩa (đúng/sai/khoá) giữ màu semantic. Icon trang trí trong chip/tile ngồi trên
  nền tint cùng họ.
- Emoji duy nhất vẫn là 🔥 streak.

## Typography

Một họ: **Be Vietnam Pro** 400–800 (giữ). Thang rem cố định 1.2. Số dùng `tabular-nums`.
Tiêu đề trang có thể lên 800 + navy; không chữ display trong nút.

## Components

- **Radius thân thiện hơn**: `--r-sm` 10px · `--r` 16px · `--r-lg` 24px.
- **Nút phím vật lý (giữ — chữ ký app)**: bóng đáy 4px, bấm tụt 2px. Primary navy;
  `btn-gold` cho phần thưởng; KHÔNG side-stripe.
- **Thẻ nổi bằng bóng trên canvas trời** — hết rừng viền xám 2px. Viền chỉ còn ở control
  tương tác (option, input: 2px) nơi affordance cần nó.
- **HUD chip có màu**: streak = tint mane + 🔥, XP = tint gold + tia sét fill gold,
  hạng = tint navy. Không còn chip trắng viền xám.
- **Banner chương** (`unit-head`): nền sky-tint + chữ navy + mặt trời gold + mây trắng
  trang trí CSS; thanh tiến độ gold trên rãnh trắng. Hết slab navy đặc.
- **Ribbon phản hồi** (giữ): trượt từ đáy, ok = pine-tint, retry = amber-tint.
- **Nút lộ trình**: ellipse dẹt 3D kiểu Duolingo (giữ hình học), phối màu theo bảng
  trạng thái ở trên; node available mặt trắng viền sky thay vì xám.
- **Đồi cỏ** (`.mound`): ellipse xanh cỏ 2 lớp dưới chân sư tử ở hero lộ trình.

## Layout

Mobile-first (giữ): nav đáy 5 mục ≥44px + safe-area; ≥900px rail trái 88px, nội dung
max 42rem, cột phải 20rem ≥1200px. Lộ trình zigzag hình sin (giữ). Không thẻ lồng thẻ.

## Motion

150–250ms `ease-out-quart` (giữ). Motion truyền trạng thái + **ba nhịp sống**: sư tử thở,
cờ BẮT ĐẦU nhún, ngọn lửa nhấp khi cộng streak. Màn hoàn thành là nơi duy nhất có
choreography (giữ) + quầng nắng tỏa sau sư tử. Không confetti. `prefers-reduced-motion`:
mọi thứ thành crossfade/tức thì, sư tử đứng yên (giữ).

## Focus

Vòng focus phải nhìn thấy trên MỌI nền: mặc định navy trên nền sáng; trên bề mặt
navy/brand (`unit-head` cũ, hero, nút navy) vòng chuyển **gold** — sửa món nợ "focus navy
trên nền navy".

## Dark mode

Giữ (học sinh vẫn học tối), đổi khí chất: "bầu trời đêm ấm" — canvas navy-đen giữ sắc
trời, mane/sky/gold nâng sáng để đạt AA, chữ trên nền màu đảo qua `--on-brand` (giữ cơ
chế). Bóng thay bằng chênh sáng bề mặt.

## z-index

`--z-nav: 10` · `--z-sticky: 20` · `--z-ribbon: 30` · `--z-backdrop: 40` · `--z-modal: 50`
· `--z-toast: 60` (giữ).
