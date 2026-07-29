-- ════════════════════════════════════════════════════════════════════════════
-- DỌN DỮ LIỆU PILOT — 29/07/2026
--
-- CHỦ DỰ ÁN CHẠY FILE NÀY (Claude bị chặn ghi production).
--   Xem trước:  node packages/db/run-sql.mjs packages/db/2026-07-29-don-du-lieu-pilot.sql --dry
--   Chạy thật:  node packages/db/run-sql.mjs packages/db/2026-07-29-don-du-lieu-pilot.sql
--
-- Ba việc, độc lập nhau — có thể chạy riêng từng phần:
--   §1  Xếp lớp cho "Nguyễn An"        → gốc lỗi 5 (bảng tuần trống)
--   §2  Nối phụ huynh demo với con      → gốc lỗi 18 (màn phụ huynh "chưa liên kết")
--   §3  Dọn 12 bằng chứng AI gật bừa    → Q3 đã chốt (lỗi 8)
--
-- ⚠️ CHẠY §3 SAU KHI ĐÃ DEPLOY chat-turn bản mới. Deploy trước thì AI không còn
--    quyền ghi mastery nữa, dọn xong sẽ không bị bẩn lại.
-- ════════════════════════════════════════════════════════════════════════════


-- ── §1 · XẾP LỚP CHO "NGUYỄN AN" ────────────────────────────────────────────
-- Hồ sơ này có grade = NULL và class_id = NULL, nên scoreboard truy bảng khối
-- bằng grade = '' → 0 người → không dựng nổi bảng → UI rơi vào màn "chờ buổi
-- học đầu tiên" DÙ em đã có 640 XP tuần đó. Đây là gốc lỗi 5.
UPDATE profiles
SET grade    = '10',
    class_id = 'd6ecdfd2-a0a6-4f0a-8015-6997ee1acf15'  -- lớp 10A1
WHERE id = '14e21e5e-e927-4d5a-86d7-338e86abc598'      -- Nguyễn An (hs1@vietanh.edu.vn)
  AND tenant_id = '90a304e0-777d-4014-8980-6180af045649';

-- Kiểm: phải ra đúng 1 dòng, grade='10', class_id khác NULL.
SELECT full_name, grade, class_id FROM profiles
WHERE id = '14e21e5e-e927-4d5a-86d7-338e86abc598';


-- ── §2 · NỐI PHỤ HUYNH DEMO VỚI CON ─────────────────────────────────────────
-- "Phụ huynh An" (ph1@vietanh.edu.vn) không nối với học sinh nào → vào là gặp
-- "chưa liên kết". Nối với đúng "Nguyễn An" cho bộ demo chạy trọn vẹn.
INSERT INTO guardian_links (tenant_id, guardian_id, student_id)
SELECT '90a304e0-777d-4014-8980-6180af045649',
       '8fa0c41c-d9ff-4513-b527-eed97c55c548',  -- Phụ huynh An
       '14e21e5e-e927-4d5a-86d7-338e86abc598'   -- Nguyễn An
WHERE NOT EXISTS (
  SELECT 1 FROM guardian_links
  WHERE guardian_id = '8fa0c41c-d9ff-4513-b527-eed97c55c548'
    AND student_id  = '14e21e5e-e927-4d5a-86d7-338e86abc598'
);

-- Kiểm: mỗi phụ huynh phải nối ĐÚNG MỘT con, không ai thấy con nhà khác.
SELECT pp.full_name AS phu_huynh, ps.full_name AS con
FROM guardian_links g
JOIN profiles pp ON pp.id = g.guardian_id
JOIN profiles ps ON ps.id = g.student_id
ORDER BY 1;


-- ── §3 · DỌN BẰNG CHỨNG MASTERY DO AI GẬT BỪA ───────────────────────────────
-- Bối cảnh: đường cũ cho AI sơ khảo tự ghi mastery_evidence cho câu [NOPBAI].
-- Đo trên prod: cùng chữ "ok" nộp 5 lần thì AI gật 3 lần. Kết quả là 12 bằng
-- chứng "đúng, câu đích" mà bài làm chỉ là "ok" — và vì câu [NOPBAI] thường
-- CHÍNH LÀ câu DOK≥3 duy nhất của bài, mấy node xanh hiện nay xanh nhờ nó.
--
-- Q3 (chủ dự án chốt 29/07): DỌN. Đang là dữ liệu thử, không phải học sinh thật;
-- để lại thì mọi số liệu pilot mang sẵn vết bẩn.

-- 3a · XEM TRƯỚC — chạy riêng câu này để biết sẽ xoá gì (nên làm trước).
SELECT me.id, p.full_name, me.node_id, LEFT(s.text_content, 40) AS bai_lam
FROM mastery_evidence me
JOIN questions q ON q.id::text = me.question_id::text
JOIN profiles  p ON p.id = me.student_id
LEFT JOIN submissions s
       ON s.question_id = me.question_id AND s.student_id = me.student_id
WHERE q.noi_dung ILIKE '[NOPBAI]%'
  AND me.correct
  -- CHỈ dọn bằng chứng AI ghi: bài đã qua tay giáo viên (passed) thì GIỮ,
  -- vì đó là phán quyết của người, không phải của máy.
  AND COALESCE(s.status, 'pending') <> 'passed'
ORDER BY p.full_name;

-- 3b · XOÁ.
DELETE FROM mastery_evidence me
USING questions q
WHERE q.id::text = me.question_id::text
  AND q.noi_dung ILIKE '[NOPBAI]%'
  AND me.correct
  AND NOT EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.question_id = me.question_id
      AND s.student_id  = me.student_id
      AND s.status = 'passed'
  );

-- 3c · TÍNH LẠI TRẠNG THÁI NODE.
-- Khớp đúng luật trong _shared/pedagogy.ts recomputeMastery():
--   • chỉ tính bằng chứng ở CÂU ĐÍCH (is_target_difficulty)
--   • cửa sổ = 4 bằng chứng GẦN NHẤT
--   • xanh khi: ≥3 đúng trong cửa sổ VÀ cửa sổ ≥3 VÀ có ≥1 câu đúng DOK≥3
WITH targeted AS (
  SELECT student_id, node_id, kg_version_id, correct, dok,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, node_id, kg_version_id
           ORDER BY created_at DESC
         ) AS rn
  FROM mastery_evidence
  WHERE is_target_difficulty
),
win AS (SELECT * FROM targeted WHERE rn <= 4),
agg AS (
  SELECT student_id, node_id, kg_version_id,
         COUNT(*)                                   AS window_size,
         COUNT(*) FILTER (WHERE correct)            AS n_correct,
         BOOL_OR(correct AND dok >= 3)              AS higher_order
  FROM win
  GROUP BY 1, 2, 3
)
UPDATE student_node_state s
SET mastered      = (a.n_correct >= 3 AND a.window_size >= 3 AND a.higher_order),
    mastery_score = CASE WHEN a.window_size > 0
                         THEN a.n_correct::real / a.window_size ELSE 0 END,
    -- Hết xanh thì cũng hết lịch ôn (hàng đợi ôn tập chỉ nhận node mastered).
    next_review_at = CASE WHEN (a.n_correct >= 3 AND a.window_size >= 3 AND a.higher_order)
                          THEN s.next_review_at ELSE NULL END,
    updated_at    = now()
FROM agg a
WHERE s.student_id    = a.student_id
  AND s.node_id       = a.node_id
  AND s.kg_version_id = a.kg_version_id;

-- Node không còn bằng chứng câu đích nào → không thể xanh.
UPDATE student_node_state s
SET mastered = false, mastery_score = 0, next_review_at = NULL, updated_at = now()
WHERE s.mastered
  AND NOT EXISTS (
    SELECT 1 FROM mastery_evidence me
    WHERE me.student_id = s.student_id
      AND me.node_id = s.node_id
      AND me.kg_version_id = s.kg_version_id
      AND me.is_target_difficulty
  );

-- 3d · KIỂM SAU KHI DỌN — số node xanh còn lại của từng học sinh.
SELECT p.full_name,
       COUNT(*) FILTER (WHERE s.mastered) AS node_xanh,
       COUNT(*)                           AS node_co_du_lieu
FROM student_node_state s
JOIN profiles p ON p.id = s.student_id
GROUP BY 1
ORDER BY 2 DESC;
