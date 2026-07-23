# AI Personal Tutor — Trường Việt Anh

Intelligent Tutoring System (Socratic, không cho đáp án) cho học sinh Trường Việt Anh.
Pilot: **Toán 10 + Tiếng Anh 10**. Frontend Next.js static → Cloudflare; backend Supabase
Edge Functions (Deno) + Postgres/pgvector; LLM qua OpenRouter.

## 👉 TIẾP TỤC DỰ ÁN
Khi người dùng nói **"tiếp tục dự án"** (hoặc muốn làm tiếp việc gì của app này),
**ĐỌC NGAY `docs/BAN-GIAO-TrangThai-DuAn.md`** — file bàn giao đầy đủ: kiến trúc,
khoá/version/DB, tiến độ %, đã làm gì, đang chờ gì, ràng buộc vận hành. Đọc xong mới
bắt tay, và cập nhật lại file đó khi trạng thái đổi (deploy web, re-key…).

Tài liệu chính (đều trong `docs/`):
- `BAN-GIAO-TrangThai-DuAn.md` — **điểm vào, đọc trước tiên**
- `PRD-v3.md` — yêu cầu sản phẩm (bám PRD v2, chỉnh khớp app)
- `Timeline-DuAn.xlsx` — checklist %sống (hiện ~75.0%, rà 23/07)
- `ONBOARD-SUBJECT.md`, `PRODUCTION-BOOTSTRAP.md` — runbook
- `DoiUng-Tutor-*.md` — đối ứng hợp đồng kỹ thuật với đội Studio

## ⚠️ Ràng buộc vận hành sống-còn (chi tiết ở file bàn giao §5)
- **Claude BỊ CHẶN ghi production** (classifier) → mọi lệnh ghi DB / deploy do **người
  dùng tự chạy** (prefix `!`). Claude viết script, người dùng chạy.
- **KHÔNG gõ mật khẩu / set secret** hộ người dùng.
- **DB dùng chung (prod):** project `gxbxsdhvtwtjkfygetzb`. Đọc/nạp DB qua **Management
  API + token trong `.env`** (Supabase MCP hay bị de-auth). SQL:
  `POST https://api.supabase.com/v1/projects/gxbxsdhvtwtjkfygetzb/database/query`.
- **Deploy edge function** qua **Supabase CLI**:
  `supabase functions deploy <fn> --project-ref gxbxsdhvtwtjkfygetzb`.
- Version: Toán 10 `6cc28358-2d65-4f18-ac34-c670f6b82a58` · Anh 10
  `4a839fc3-4008-482d-9802-cd4c3566739d`. Acc demo `hs1@vietanh.edu.vn`/`VietAnh@2026`.
- Nhánh git: `feat/kg-ingest-v2.2`. Web CHƯA deploy production (Cloudflare).

## Bối cảnh sư phạm bất biến (đừng đổi)
Socratic không cho đáp án · mastery learning · growth mindset + grit · CAS tách tính
toán khỏi LLM · DOK ≠ độ khó · truy ngược tiền đề · thang 4 bậc + cổng nỗ lực · PDPL
(đồng thuận kép, rút đồng ý→dừng, ẩn danh LLM) · gamification thưởng nỗ lực ·
human-in-the-loop nội dung.
