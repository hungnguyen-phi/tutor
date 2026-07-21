# Handoff: Bộ cảm xúc động cho mascot Sư Tử Việt Anh (Lion Motion)

> **Dành cho Claude Code.** Đọc kỹ file này trước khi sửa bất cứ gì.
> Repo đích: `tutor` (Next.js App Router static export → Cloudflare Workers).

## Tổng quan

Mở rộng hệ mascot hiện có (`apps/web/components/Lion.tsx` + choreography trong
`apps/web/app/globals.css`) thành **bộ 14 trạng thái cảm xúc động có chiều sâu**:
lông mày đổi, khuôn miệng cử động, chớp mắt, tay chân cử động, và **xoay người
4 frame như 3D** (turn-front → turn-34 → turn-side → turn-back).

Toàn bộ code trong gói này **viết sẵn theo đúng kiến trúc hai tầng của repo**
(hoán frame trong component + choreography CSS, xem `DESIGN.md` mục "Mascot"):
đây KHÔNG phải prototype HTML cần dịch lại — `Lion.tsx` và `lion-motion.css`
là code TypeScript/CSS production, dùng trực tiếp.

## Fidelity

**High-fidelity.** Mọi timing, keyframe, màu, tỉ lệ sprite là giá trị chốt —
giữ nguyên số, đừng "làm mượt" thêm (xem mục Quyết định đã chốt).

## File trong gói — đặt đúng đường dẫn repo

Gói này mirror cấu trúc repo. Giải nén tại **gốc repo `tutor/`** là file tự
vào đúng chỗ:

| File trong gói | Đích trong repo | Hành động |
|---|---|---|
| `apps/web/components/Lion.tsx` | như nhau | **THAY THẾ** file hiện có (API giữ nguyên 100%) |
| `apps/web/app/lion-motion.css` | như nhau | file MỚI |
| `apps/web/public/brand/lion/turn-*.png` (4 file) | như nhau | sprite MỚI (cắt từ sheet turnaround, cùng thuật toán `assets-src/mascot/slice.mjs`) |
| `reference/…` | KHÔNG copy vào repo | showcase tham chiếu, mở bằng browser để xem chuyển động chuẩn |

## Việc Claude Code cần làm

1. Copy 3 nhóm file trên vào đúng chỗ (nếu chưa được giải nén tại gốc repo).
2. Thêm đúng MỘT dòng vào `apps/web/app/globals.css` (sau khối biến, trước
   phần components): `@import "./lion-motion.css";`
   — file css mới chỉ THÊM keyframes/class (`lion-bounce`, `lion-t-*`, `fx-*`),
   tái dùng `lion-breathe`/`lion-sway` sẵn có, không ghi đè gì.
3. `pnpm -C apps/web typecheck` (hoặc `tsc --noEmit` theo script repo) — phải sạch.
4. Kiểm tra mọi call-site cũ của `<Lion …>` không đổi hành vi
   (`idle`, `thinking`, `cheer`, `sleepy`, `greet`, `trophy`, …): grep `mood=`.
5. Dựng nhanh một trang dev (hoặc thêm vào `/demo`) render đủ 14 mood để soi
   bằng mắt, so với `reference/Mascot Động.dc.html` mở trong browser.
6. Gắn mood mới vào ngữ cảnh app (đề xuất ở bảng dưới — xác nhận với chủ dự án
   trước khi gắn ngoài các điểm hiển nhiên).

## Mood mới → ngữ cảnh gợi ý

| Mood | Ngữ cảnh trong app | Chiều sâu chuyển động |
|---|---|---|
| `happy` | trả lời đúng, đồng hành mặc định | chớp mắt (JS) + miệng cười toe (overlay `head-laugh` 7.4s) |
| `excited` | mở chương mới | nảy squash-stretch 0.66s, mặt cười ↔ "ồ!" 2.2s |
| `trophy` | node mastered +30 XP — **bùng 1 lần → thở** | pop 0.72s + quầng nắng gold; phát lại = remount `key` |
| `success` | ribbon "đúng rồi" | pop nhẹ 1 lần |
| `diligent` | chuỗi bài dài | gõ phím 1.1s + mồ hôi + tia vàng |
| `focus` | trong phiên làm bài | thở 5s + quầng sáng, tối giản |
| `think` | chờ guide agent (loading LLM) | chống cằm nghiêng 6° ↔ ngước "à?" 6.4s + bong bóng ba chấm |
| `surprised` | cách giải bất ngờ của học sinh | mặt thường 0–4% → giật nảy trợn tròn + "!" |
| `proud` | hồ sơ, hạng Vàng | xoay dáng front ↔ ¾ (6s) + sao vàng |
| `sleepy` | đêm muộn, nhắc nghỉ | thở sâu 5.6s, miệng khép mở theo hơi + Zzz |
| `sad` | rời phiên giữa chừng, trượt mục tiêu | trĩu vai + mày nhíu run (7s) + chớp chậm (4.8s) + lệ |
| `miss` | lâu không mở app, streak nguội | **tim đập chậm dần → nứt đôi (46%) → rơi lịm**; mặt ngóng chờ → buồn, chu kỳ 6s |
| `chaos` | node cần ôn dồn ứ, đồng bộ dữ liệu | lắc đầu 1s + mặt hoảng chớp nhoáng 2.7s + ?! xoay quanh |
| `rebel` | **effort gate**: học sinh đòi đáp án | "hứ" → **xoay người 4 frame** (chính diện → ¾ → nghiêng → lưng), dỗi, ngoái liếc, quay đi — chu kỳ 7.5s |

```tsx
<Lion mood="miss" size={120} />            // tim tan vỡ dần
<Lion mood="rebel" />                      // xoay người như 3D
<Lion key={attempt} mood="trophy" />       // one-shot: remount để phát lại
<Lion mood="think" talking={bubbleOpen} /> // khẩu hình nói (JS, như cũ)
```

## Quyết định đã chốt của chủ dự án — KHÔNG đổi

1. **Nhớ nhung = phương án B**: một trái tim lớn trên đầu **tan vỡ dần**
   (hai mảnh `.fx-hb-l`/`.fx-hb-r` gãy tại 46% chu kỳ). Không dùng tim bay lơ lửng.
2. **Hỗn loạn = phương án A**: lắc đầu + ?! xoay quanh. Không dùng giấy bay.
3. **Nổi loạn = xoay 4 frame thật** (`lion-t-show-*`). KHÔNG dùng flip
   `scaleX(-1)` hay xoay ảnh phẳng — chủ dự án từ chối rõ.
4. **Hoán frame phải TỨC THÌ**: mọi ranh giới opacity trong keyframe cách nhau
   đúng 0.1% chu kỳ (~5–10ms) và hai keyframe show/hide bù nhau tại cùng một
   mốc. TUYỆT ĐỐI không nới thành crossfade — sẽ thấy 2 frame chồng nhau
   (đã bị chê một lần).
5. `flavor` prop: đã deprecated (A/B chốt xong), type còn export để không gãy import.

## Cơ chế cần hiểu trước khi sửa

- **Overlay frame** (`.lion-frame`): component render các img chồng lên base,
  neo `bottom: 0; left: 50%; translateX(-50%)`, bề rộng = `size × (sprite.w
  của overlay / sprite.w của base)` — vì mọi sprite cắt cùng scale từ một sheet
  nên đáy-giữa khớp ở mọi size. Chỉ đảo opacity, không decode lại ảnh.
- Mood nào overlay hẹp hơn base thì base có keyframe ẩn đồng bộ
  (`.lion-<mood> .lion-base { animation: lion-f-hide-… }`) để không lòi viền bờm.
- **`miss` đặc biệt**: base (`head-sad`) mặc định `opacity: 0` trong CSS, chờ
  keyframe hiện từ 44.1% — vì thế khối reduced-motion phải giữ dòng
  `.lion .lion-base { opacity: 1 !important; }`.
- **Reduced motion**: CSS tắt mọi animation + ẩn `.fx`/`.lion-frame`; JS
  (chớp mắt, khẩu hình, dõi chuột) tự tắt theo pattern gốc. Giữ nguyên.
- One-shot chỉ có `trophy`/`success` (`animation-iteration-count: 1`).

## Design tokens (theo bảng brand trong `DESIGN.md` — không bịa màu mới)

- Navy `#26275D` · Gold `#F9DD0E` (viền chữ gold: `#B8930B`) · Mane `#F4B24A`
- Sky (lệ, mồ hôi) `#5B9BD9` · Khói "hứ" `#AEB6D0`/`#C3CADF`
- Tim `#E25555` (theo trái tim đỏ trong bộ phụ kiện mascot kit)
- Easing: giữ `ease-in-out`/`linear` như trong css; one-shot pop dùng
  `cubic-bezier(0.34, 1.56, 0.64, 1)`.

## Assets

- 29 sprite gốc đã có sẵn trong repo tại `apps/web/public/brand/lion/`
  (cắt bởi `assets-src/mascot/slice.mjs`).
- 4 sprite MỚI trong gói: `turn-front.png` (275×435) · `turn-34.png` (272×435)
  · `turn-side.png` (280×426) · `turn-back.png` (279×426).
- `reference/` chứa showcase + sprite bản sao chỉ để mở xem, không copy vào repo.

## Checklist nghiệm thu

- [ ] Typecheck sạch, không thêm dependency mới
- [ ] 14 mood chạy đúng như showcase tham chiếu (đặc biệt: rebel xoay 4 frame
      không flip phẳng; miss tim nứt đúng nhịp mặt đổi buồn)
- [ ] Không nhìn thấy 2 frame chồng nhau ở bất kỳ mood nào
- [ ] Call-site cũ không đổi hành vi; `prefers-reduced-motion` đứng yên frame cơ bản
- [ ] Build static export (`pnpm web:build`) không lỗi
