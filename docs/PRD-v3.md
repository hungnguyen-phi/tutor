# KẾ HOẠCH HOÀN CHỈNH — AI Personal Tutor Trường Việt Anh (PRD v3)

> **v3 · 2026-07-23.** Hợp nhất tầng **Hệ thống – Sản phẩm – Sư phạm – Pháp lý – Kinh doanh** + tầng **Knowledge Graph / Nhà máy nội dung** (Studio). Kế thừa **PRD v2 (18/06/2026)**, giữ **nguyên cốt lõi sư phạm & tầm nhìn**, chỉ **điều chỉnh cho khớp app thực tế** đã build.
>
> **Pilot đã chốt (v3):** **Toán 10 + Tiếng Anh 10** (GDPT 2018 / Global Success). Nhân bản kế tiếp: GDKTPL 10, Công nghệ 8–9, GDCD 9 (Studio đã có KG). *(v2 ghi Toán 9+10; app pivot sang Toán 10 + Anh 10 — Anh mở thêm 4 kỹ năng Nghe/Nói/Đọc/Viết.)*

---

## 0. Những điều v3 ĐIỀU CHỈNH so với v2 (cốt lõi KHÔNG đổi)

| Hạng mục | PRD v2 | Thực tế app → PRD v3 |
|---|---|---|
| Môn pilot | Toán 9 + Toán 10 | **Toán 10 + Tiếng Anh 10** (Anh thêm 4 kỹ năng) |
| Điều phối async | **n8n** | **Supabase Edge Functions (Deno)** — không dùng n8n |
| LLM | Claude trực tiếp | **OpenRouter** (glm-5.2 chính, deepseek/qwen fallback); ẩn danh PDPL trước khi gọi |
| Giao diện | chat mobile-first | **Next.js static export → Cloudflare Workers** + Supabase JS client; giao diện "sư tử Việt Anh", lộ trình world, XP |
| Báo cáo phụ huynh | Zalo OA | **Magic-link cho phụ huynh** (Zalo hoãn); báo cáo mẫu để sau |
| Dạng câu | (ngầm định trắc nghiệm/tự luận) | **17 dạng** (mcq, dung_sai, sap_xep, noi_cot, điền, viết, nói, nghe, lập luận…) + chấm tương tác + **rubric theo kỹ năng** |
| Vai trò | 5 vai | **5 vai + 7 user_role** (campus_admin, subject_lead, counselor, dpo, homeroom_teacher, content_author, content_reviewer) |
| Vector/Graph | Neo4j/Qdrant hoãn | **pgvector** (giữ), embedding cột trong `questions`/`resources` |

**Bất biến (không đổi):** active-learning Socratic không cho đáp án; mastery learning; growth mindset + grit; CAS tách tính toán khỏi LLM; DOK ≠ độ khó; chẩn đoán truy ngược tiền đề; thang Socratic 4 bậc + cổng nỗ lực; PDPL; gamification thưởng nỗ lực; human-in-the-loop nội dung.

---

## 1. Mục tiêu & KPI
**Kinh doanh:** pilot thành công tại Việt Anh ~6 tháng; doanh thu = license trường + gói premium phụ huynh; vận hành < 500 USD/tháng ở quy mô pilot.

**Học tập:** điểm TB tăng ≥ 15% sau 3 tháng (A/B); hoàn thành nhiệm vụ > 85%; retention hằng tuần > 70%.

**GV & PH:** GV tiết kiệm 30–50% thời gian chấm/theo dõi; NPS > 70.

**Đặc thù:** tương quan mức dùng Tutor ↔ điểm kiểm tra môn.

## 2. Người dùng & phân quyền
- **Học sinh** — phiên học của mình; không thấy đáp án/dữ liệu hệ thống.
- **Giáo viên** — theo dõi HS phụ trách (rút gọn + tra sâu); điều chỉnh nội dung Tutor kèm lý do; duyệt nội dung AI sinh. Quyết định cuối là của GV.
- **Phụ huynh** — xem tiến độ con qua magic-link; không truy cập dữ liệu thô.
- **Admin trường** — toàn quyền; nhận cảnh báo, đặc biệt cờ KHẨN CẤP.
- **Chủ biên/đội nội dung** — sản xuất & duyệt KG (content_author/reviewer).
- **user_roles chuyên biệt:** campus_admin, subject_lead, counselor (cờ khẩn cấp), dpo (PDPL), homeroom_teacher.

Cài đặt ở tầng DB bằng **Row-Level Security** của Supabase + bảng `user_roles`.

## 3. Kiến trúc hệ thống (v3 — thực tế)
```
Học sinh ─▶ Next.js (static export, Cloudflare Workers) ─┐
            + Supabase JS client (realtime, auth)         │
                                                          ▼
   Supabase Edge Functions (Deno)          Supabase Postgres + pgvector
   - chat-turn  (Socratic engine, CAS,     - KG (schema v2) + student model
     effort gate, rubric, XP)              - RLS + user_roles
   - diagnose, guide, dashboard,           - audit_logs, token_usage, consent
     teacher-stats, scoreboard,            
     admin-roster, evaluate-*              OpenRouter (LLM) ── ẩn danh PDPL
```
**Nguyên tắc:** logic tất định (chấm, dẫn dắt) chạy 100% trong Edge Functions; LLM chỉ ở chấm rubric (viết/nói) + diễn đạt lại thang Socratic + chat tự do. Không LLM tự tính định lượng. **Hoãn:** n8n, Neo4j, vector DB riêng — pgvector đủ cho pilot.

## 4. Mô hình dữ liệu = KG Schema v2
Triển khai trực tiếp thành bảng Supabase (đã dựng): `kg_versions, kg_nodes, kg_edges, node_tiers, resources(+embedding), questions, socratic_ladders`. Tầng hệ thống: `profiles/students, learning_sessions, attempts, mastery_evidence, student_node_state, flags, teacher_overrides, review_queue, consent, audit_logs, token_usage, student_xp, classes, user_roles`.

**6 quy tắc schema v2 (ràng buộc):** (1) AI sinh → GV duyệt → theo dõi thống kê → đào thải câu kém; (2) distractor luôn gắn 1 quan niệm sai; (3) tách DOK khỏi độ khó; (4) tài nguyên theo bản chất kiến thức (không "phong cách học"); (5) tư duy bậc cao ở node tích hợp; (6) tiền đề cứng hiếm & chắc.

## 5. Triết lý & cơ chế sư phạm (bất biến)
- **Thang Socratic 4 bậc + cổng nỗ lực:** siêu nhận thức → hướng chú ý → dẫn tiền đề → giàn giáo; đáy chỉ hé đáp án khi qua cổng nỗ lực (≥2 lần thử thực chất + diễn đạt lý lẽ). Cấm nhảy đáp án. Phân hoá theo độ sẵn sàng.
- **Tách 2 agent:** "hỏi dẫn dắt" ≠ "đánh giá đúng/sai".
- **Tự kiểm & trung thực:** Toán không để LLM tự tính — CAS + lời giải đã lưu; không chắc → báo admin.
- **Chống lười siêu nhận thức:** buộc giải thích lại, làm lại không AI ở điểm hay ỷ lại.

## 6. Assessment thích ứng & chẩn đoán truy ngược
- **Hai nhãn độc lập:** DOK ≠ độ khó.
- **Ba bậc/node** theo độ sẵn sàng.
- **Truy ngược về gốc:** sai → đi theo `prerequisite_hard` tìm node hổng sâu nhất (patch-and-climb); distractor → kích đúng thang Socratic.
- **Lộ trình:** GĐ1 heuristic (đúng→khó hơn; sai→giảm + đổi biểu diễn + thêm câu tới ngưỡng mastery ≥3/4 gồm ≥1 DOK cao); **GĐ2 (v-next) IRT/CAT + Knowledge Tracing**. Spaced repetition (Leitner 1-3-7-21).
- **Thống kê là trọng tài:** p_value + discrimination → câu quá dễ/khó/không phân biệt bị retired.

## 7. Học liệu: làm trước vs AI sinh live
Đa dạng định dạng vì **(a) bản chất kiến thức, (b) dual-coding, (c) khả năng tiếp cận** — KHÔNG theo "phong cách học" (VARK đã bị bác). Cá nhân hoá theo **độ sẵn sàng/bậc**.
- **Làm trước:** video/animation, infographic, bộ câu "neo" đã hiệu chuẩn, lời giải định lượng đã kiểm chứng, thang Socratic (GV duyệt).
- **AI live:** lời giảng cá nhân hoá, loại suy, biến thể bài (ưu tiên **câu tham số hoá**), diễn đạt lại thang. Mọi thứ AI sinh → tự kiểm → review_queue → GV duyệt.

## 8. Vòng đời một buổi học (~40 phút)
Mở app → sư tử chào + nhắc kế hoạch → đề xuất 2–4 mục tiêu → học (giảng + practice + chẩn đoán/bù đắp, có patch-and-climb) → gần hết giờ: chiêm nghiệm + nhắc nghỉ ≥5 phút → kết thúc: tóm tắt → cập nhật Supabase (báo PH để sau).

## 9. Nhà máy nội dung — Studio 6 trạm (tầng đã có nền)
Trạm 1 phân rã nguyên tử · 2 quan hệ tiền đề · 3 sinh 8–12 câu/điểm (3 bậc, DOK+độ khó, distractor) · 4 thang Socratic/quan niệm sai · 5 tài nguyên dual-coding · 6 QA nghiệm thu. Nhịp: **AI nháp → người rà → tracker**. **Cầu Studio↔Tutor:** đồng bộ theo **mã atom bất biến** (`node_key`/`question_key`), idempotent; importer chung mở môn mới (Đợt D).

## 10. An toàn, điều hướng & PDPL 2026
- **Ngoài phạm vi:** từ chối nhẹ, kéo về học, vẫn ghi nhận + báo admin.
- **Cờ KHẨN CẤP:** bắt nạt/buồn chán kéo dài/tổn thương → phản hồi ân cần + báo admin/GV (counselor).
- **PDPL (01/01/2026):** <7 tuổi người đại diện đồng ý; ≥7 tuổi **đồng thuận kép**; **rút đồng ý → dừng xử lý ngay** (đã có gate ở chat-turn); tối thiểu hoá dữ liệu; **ẩn danh trước khi gửi LLM**; cân nhắc lưu trữ VN; luật sư rà trước pilot thật.

## 11. Báo cáo, gamification, tích hợp
- **Báo cáo:** GV (dashboard heatmap theo node/tier + tra sâu); PH (mẫu cố định — để sau); export Excel/PDF.
- **Gamification:** thưởng **nỗ lực/quá trình** — streak, node *đã thành thạo*, dám làm khó, tự sửa lỗi; **không** thưởng điểm tuyệt đối. XP server-authoritative (chống farm). Sư tử mascot + lộ trình world.
- **Tích hợp (v-next):** OCR upload bài, SSO trường, Google Classroom.

## 12. Lộ trình (v3)
| Mốc | Tiêu chí đạt |
|---|---|
| **M0 Sẵn sàng** | Supabase + schema v2 + RLS + Studio pipeline. ✅ |
| **M1 Khung KG** | Trạm 1–2 xong 1 chương/môn, chủ biên duyệt. ✅ |
| **M2 Nguyên mẫu 1 chương trọn 6 trạm** | Nạp được vào Supabase. ✅ |
| **M3 Vận hành thử** | Chat + Tutor chạy; truy ngược + thang Socratic verify. ✅ |
| **M4 Phủ 50%/môn + A/B** | Nửa số chương "Đã phát hành"; lớp thí điểm A/B. 🔶 (Toán 10 ~đủ; Anh đang) |
| **M5 Phủ trọn Toán 10 + Anh 10** | 100% hai môn + số liệu hiệu quả Việt Anh. 🔲 |
| **M6 Nhân bản** | GDKTPL 10 → môn khác cùng schema. 🔲 (cửa importer đã sẵn) |

## 13. RACI, ngân sách, rủi ro
- **RACI:** khung KG (chủ biên A/R); nháp AI (điều phối R); duyệt (chủ biên A); hạ tầng (điều phối A/R); phạm vi/ngân sách (Chủ tịch A/R).
- **Ngân sách:** LLM ~200–400 USD/tháng; vận hành < 500 USD/tháng ~500 HS.
- **Rủi ro & né:** AI sai định lượng → CAS + GV duyệt + tham số hoá; dàn trải → xong trọn 1 chương nút thắt trước; phụ thuộc gợi ý → cổng nỗ lực; chẻ vô tận → grain + tiền đề hiếm; GV không nhận → biến GV thành đồng minh bằng bộ công cụ.

## 14. Định nghĩa "100%" của pilot (v3)
Pilot production Việt Anh **hoàn chỉnh** = ĐỦ 5 điều:
1. **Nội dung:** Toán 10 + Tiếng Anh 10 phủ trọn, "Đã phát hành", có thống kê câu.
2. **Engine + 17 dạng câu** chạy đúng end-to-end trên production (chấm tất định + rubric + Socratic + truy ngược).
3. **Đủ vai & công cụ:** HS học, GV theo dõi/duyệt/điều chỉnh, PH xem tiến độ, Admin cảnh báo — trên production.
4. **Tuân thủ PDPL** đầy đủ (đồng thuận kép + rút đồng ý + ẩn danh) và **gamification nỗ lực**.
5. **Đo hiệu quả A/B** + **nhà máy nội dung vận hành** để nhân bản môn kế.

> Ngoài 100% (**v-next**): IRT/CAT + Knowledge Tracing; SSO/Google Classroom/OCR; báo cáo Zalo; nhân bản đa môn (GDKTPL/Hoá/GDCD…).

---
*Tài liệu nền: KG_Schema_v2.json, KG_Roadmap_ToDo_Final.md, 6 trạm, KG_Tracker, KG mẫu Toán 10/Hoá 10, PRD v2. Mọi nội dung AI nháp phải GV bộ môn rà trước khi dùng.*
