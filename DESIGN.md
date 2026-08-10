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

## Dark mode — ĐÃ GỠ (29/07)

App **luôn sáng**. Chủ dự án gỡ chế độ tối: bản navy-trên-đen đọc ra trầm mặc, ngược
hẳn khí chất "sân trường buổi sáng".

Cách gỡ (đừng tưởng chỉ xoá CSS là xong): script chống-nháy trong `layout.tsx` gắn
`data-theme="light"` lên `<html>` **trước khung hình đầu tiên** và xoá luôn khoá
`va-theme` cũ. Bảng token tối vẫn nằm trong `globals.css` dưới
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` — thiếu thuộc
tính đó là máy để hệ điều hành tối sẽ **chớp nguyên một khung tối** trước khi React kịp
chạy. Giữ bảng token tối để bật lại được, nhưng nó đang ngủ.

## Mặt bài tập (30/07)

Riêng màn ĐANG LÀM BÀI đảo vai màu so với phần còn lại của app: **trang trắng, đề bài
mang màu**. Canvas xanh là không khí của lộ trình; lúc làm bài thì mọi thứ lùi lại cho
đề và đáp án. `body:has(.lsn-grid)` → nền `--surface`.

| Token | Màu | Đo |
|---|---|---|
| `--q-face` | `#e3eefb` | nền thẻ đề bài — navy trên nó 11,69:1 |
| `--pick-line` | `#5a92cf` | viền ô đáp án khi nghỉ — **3,26:1**, xanh nhạt nhất còn qua ngưỡng 1.4.11 |
| `--pick-strong` | `#2e6db4` | rê chuột / nhấn — 5,30:1 |

Câu hỏi **luôn canh giữa màn**. Từ 1360px bày ba cột: đệm rỗng · đề bài · học liệu —
cột trái rỗng bằng đúng cột học liệu nên đề bài nằm chính tâm. Ngưỡng là 1360 chứ
không phải 1200: đo ở 1200 thì cột đề bài chỉ còn 296px, hẹp hơn cả cột học liệu.

**Đừng dùng `--ink-faint` cho chữ mang nghĩa.** Nó 3,01:1 — chỉ đủ cho trang trí (caret,
tay nắm kéo). Chữ có nghĩa dùng `--muted` (4,64:1) kể cả khi in đậm: ngưỡng "chữ lớn"
của WCAG là 18,66px đậm, mà mọi chỗ trong app đều nhỏ hơn thế.

### Sân khấu bài tập — làm bài TRONG TRANH (30/07, bản 2)

Bản 1 (pha 12% màu thế giới lên trắng) bị chủ dự án chê thẳng: *"vẫn thấy xấu, overfitting
tư duy thiết kế — vẫn là thẻ trên giấy"*. Chê đúng. Trong khi lộ trình đã có **9 tranh
savanna Studio vẽ** (`/scenes/world-N.webp`). Bản 2: bài học diễn ra **trong chính tranh
đó** — em đứng ở thảo nguyên trên lộ trình, mở bài ra vẫn là thảo nguyên ấy.

**Ba lớp:** TRANH của chương phủ cả màn (đặt trên `.viewport` qua
`.viewport:has(.qworld[data-world=N])` — nền của phần tử cuộn neo theo border-box nên
đứng yên khi cuộn = parallax miễn phí, KHÔNG dùng `background-attachment: fixed` vì vỡ
với transform; kèm scrim tối nhẹ trên/dưới trong background-stack) → **VŨNG SÁNG**
`.lsn-main` (miệt sương trắng 92%, bo 20px, bóng đổ xuống tranh — "trang sách đặt trong
thế giới"; cột học liệu cùng chất liệu, `:not(:empty)` kẻo lòi hộp ma) → phiến đề + ô
đáp án như cũ. Khí quyển `.qstage` (fixed) chỉ còn quầng nắng màu `--scene-orb-glow` +
6 đom đóm — mặt trời/mây/đồi ĐÃ TRONG TRANH, vẽ CSS đè lên là hai cảnh chồng nhau.

**Token 9 thế giới cấp qua vỏ `.qworld`** (display:contents, mang `data-world` từ
`worldOfLesson()` — cùng cách chia chặng với LearningPath). Hai khối selector 9 thế giới
(màu + `--scene-img`) đã nới thêm `.viewport:has(.qworld[data-world=N])`.

**Tương phản giải bằng KIẾN TRÚC, không bằng đo từng cặp:** mọi chữ rời đều nằm TRONG
vũng sáng trắng 92% (nền hiệu dụng tệ nhất trên tranh đen: `--muted` 4,55:1 — vẫn AA)
hoặc trong CHIP trắng 88% (X thoát + "3/8"; icon cần 3:1, đo 4,06 trên ca tệ nhất).
⚠️ Rule chống sticky-hover touch của `.lesson-x` phải trả về CHIP trắng, đừng trả về
`transparent` — trên tranh đêm sao icon sẽ chìm mất sau cú chạm đầu.

**Tiến trình = ĐƯỜNG DẤU CHÂN trên dải cỏ** (`.qtrail` thay thanh %): ruy-băng màu đồi
của thế giới (`--scene-hill-back/front` — hội đồng mỹ thuật đã bảo chứng "đồi luôn đủ
tối/lạnh để dấu chân VÀNG bật", đo world 6: 12,75:1), mỗi câu một dấu chân vẽ thuần CSS
(bàn đệm + 3 ngón bằng box-shadow, màu qua currentColor): đã qua = in VÀNG (đúng ngôn
ngữ mastered của lộ trình), đang đứng = dấu SÁNG TRẮNG thở nhẹ + **sư tử tí hon 26px
đứng làm quân cờ** (nhớ `max-width:none` cho img — reset toàn cục bóp nó còn 7px), cuối
đường là cờ đích vàng bay. Giữ `role="progressbar"` + `aria-*`. Bài >14 câu → dấu nhỏ
lại (`data-long`).

**Nhãn lệnh làm bài** (`.lesson-kind`) thành biển khắc navy gắn đè lên rìa phiến 11px —
nhãn và phiến đọc ra MỘT vật thể, hết eyebrow chữ hoa treo lơ lửng.

**Trạng thái chọn** của ô đáp án: quầng navy + con dấu đĩa vàng có dấu tích navy (vẽ bằng
hai đường viền, không thêm icon SVG). Dấu tích là HÌNH nên trạng thái không phụ thuộc màu.

**Phần thưởng bằng ÁNH SÁNG, không confetti.** Đúng → vệt sáng đỉnh thanh đáy bung vàng
một nhịp (`horizon-bloom`, one-shot), phiến đề lên quầng vàng, quầng sàn ấm lên. Đọc
verdict qua `body:has(.lfoot[data-verdict="ok"])` nên không thêm state nào ở React.

**Cả 4 hình dạng câu cùng một ngôn ngữ vật thể**: thẻ từng bước (hết viền xám, mặt bắt
sáng, bước đã trả lời thì ấm lên), lời trích (lõm vào phiến — lời của người khác), ô gõ
đáp án (viền `--pick-line` như ô bấm, placeholder `--muted` để đạt 4,5:1). Nút Có/Không
nâng lên 44px cho đúng ngưỡng vùng chạm.

## Kiểm chứng giao diện — TRÊN APP THẬT, không có bàn xem trước

Route `/demo` **đã xoá 10/08** theo quyết định chủ dự án. Lý do nó phải đi: một bàn xem
trước dựng bằng dữ liệu bịa chỉ chứng minh được rằng *markup render ra không vỡ* — nó
không chạm tới đường đi thật (đăng nhập → lộ trình → mở bài → bấm). Bảng soạn công thức
là bằng chứng: nó **sập ngay lần bấm đầu tiên** trên prod suốt từ lúc lên, mà mọi khâu
"đo trong trình duyệt" trước đó đều báo xanh vì không khâu nào đi qua đúng cú bấm ấy.

Mọi thay đổi giao diện từ nay nghiệm thu bằng cách **mở app thật, đăng nhập, đi đúng
đường học sinh đi**. Đo bundle, đọc computed-style, render lẻ một component — vẫn dùng
được, nhưng KHÔNG cái nào tính là đã kiểm chứng.

**Đừng đặt `position: relative` cho `.lsn-aside` mà quên trả lại `sticky` ≥1360px** —
media query không thêm specificity nên rule đứng sau trong file sẽ đè mất, và cột học
liệu cuộn mất tăm (đã trả giá 30/07).

## z-index

`--z-nav: 10` · `--z-sticky: 20` · `--z-ribbon: 30` · `--z-backdrop: 40` · `--z-modal: 50`
· `--z-toast: 60` (giữ).
