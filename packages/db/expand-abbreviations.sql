-- ═══════════════════════════════════════════════════════════════════════
-- VIẾT RÕ CHỮ VIẾT TẮT TRONG ĐỀ (sinh tự động — chớ sửa tay)
--
-- Đề dùng viết tắt chuẩn sách giáo khoa (VTPT, BPT, PTTQ…) mà không giải
-- thích ở đâu cả. Học sinh gặp lần đầu thì chịu.
--
-- Mở rộng LẦN XUẤT HIỆN ĐẦU TIÊN trong mỗi đề, giữ chữ tắt trong ngoặc:
--   "hai VTPT cùng phương" → "hai vectơ pháp tuyến (VTPT) cùng phương"
-- Các lần sau trong cùng câu giữ nguyên chữ tắt cho khỏi rườm rà.
--
-- CHỈ đụng noi_dung. KHÔNG đụng dap_an/distractors: phương án dài thêm sẽ
-- làm nặng mẹo "chọn phương án dài nhất".
-- Câu nào đề đã có sẵn cụm đầy đủ thì bỏ qua, không nhét thừa.
--
-- Sinh lúc rà 1868 câu active → 210 câu cần sửa.
-- CHẠY: node packages/db/run-sql.mjs packages/db/expand-abbreviations.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) x − y > 0 (có c = 0): a) Đường thẳng bờ x − y = 0 đi qua gốc O b) Có thể dùng O(0; 0) làm điểm thử c) Có thể dùng (1; 0) làm điểm thử d) Vẽ bờ bằng nét ĐỨT' WHERE id = '01f19a1c-7f8c-42cd-ba86-51a60ca500f9';
-- BPT
UPDATE questions SET noi_dung = 'Bài làm: ''Xác định miền nghiệm của bất phương trình (BPT) 3x − y < 0. ① Vẽ bờ 3x − y = 0 nét ĐỨT, qua O(0;0) và (1;3). ✓ ② Chọn điểm thử O(0;0) (vì đây là điểm dễ tính nhất). ③ Thay vào: 3(0) − 0 = 0. Hỏi 0 < 0? ⇒ SAI. ④ Vì thử O ra SAI ⇒ tô nửa mặt phẳng KHÔNG CHỨA O.'' Tìm và sửa lỗi.' WHERE id = '0230353b-9530-4d02-b1bd-216ea6cb3feb';
-- PTTQ
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) đường thẳng đi qua M(4; -1) và song song với trục Ox.' WHERE id = '03b0f6e1-c239-4105-b062-07618facd773';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của elip có tâm sai e = 0,8 và tiêu cự bằng 8.' WHERE id = '03d8cedb-2f8f-4b4f-80a7-9b455b32bd79';
-- CV
UPDATE questions SET noi_dung = 'So sánh CHIỀU CAO (trung bình=160cm, độ lệch chuẩn=5cm) và CÂN NẶNG (trung bình=55kg, độ lệch chuẩn=8kg) của MỘT nhóm học sinh. TÍNH hệ số biến thiên (CV) cho MỖI đại lượng, xem đại lượng NÀO ''TƯƠNG ĐỐI'' PHÂN TÁN NHIỀU HƠN. (Hỏi kèm độ tự tin 1–3)' WHERE id = '05cf73e6-8d04-4cb9-abf9-e35dc9416d8b';
-- BPT
UPDATE questions SET noi_dung = 'Xác định miền nghiệm của bất phương trình (BPT) x + y ≥ 3. B1 — VẼ BỜ: viết phương trình bờ, tìm 2 điểm, chọn nét. B2 — CHỌN ĐIỂM THỬ: chọn điểm nào? kiểm nó có nằm trên bờ không. B3 — THAY VÀO BPT GỐC: đúng hay sai? B4 — TÔ MIỀN: tô nửa nào?' WHERE id = '0799bb09-e809-4970-863e-99f7c78cc049';
-- VTPT
UPDATE questions SET noi_dung = 'Đường thẳng Δ đi qua M(2; 1) và có vectơ pháp tuyến (VTPT) n = (3; -4). Tính khoảng cách từ gốc toạ độ O đến Δ.' WHERE id = '07eb0ab0-0a12-4715-9203-db4cafeb0927';
-- PT
UPDATE questions SET noi_dung = 'Chứng minh rằng phương trình (PT) x² + y² - 2ax - 2by + c = 0 luôn đưa được về dạng (x-a)² + (y-b)² = a² + b² - c, và nêu ý nghĩa của ba trường hợp dấu của a² + b² - c.' WHERE id = '083f94c1-089f-44df-afa8-824a549cbe7b';
-- PT
UPDATE questions SET noi_dung = 'Học sinh viết tiếp tuyến của (x-2)² + y² = 4 tại M(2; 2) như sau: ''IM = (0; 2) nên phương trình (PT) tiếp tuyến là 0(x-2) + 2(y-2) = 0 ⇔ y = 2.'' Đúng hay sai?' WHERE id = '08685f22-43fc-488b-a7c7-1f6776573616';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 3x + y ≥ 0. Điểm nào DÙNG ĐƯỢC làm điểm thử? Giải thích ngắn. A. O(0; 0) B. (1; 0) C. (1; −3) D. (−2; 6)' WHERE id = '088f7bbe-b129-4d1d-8ffd-4911c2455e2c';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 2x + y ≤ 8. Xét từng cặp: a) (1; 3) là nghiệm b) (3; 1) là nghiệm c) (4; 0) là nghiệm d) (5; 2) là nghiệm' WHERE id = '0c392227-0629-4075-b9cc-71c79e41174e';
-- PT
UPDATE questions SET noi_dung = 'Cho parabol y² = 12x. Tìm toạ độ tiêu điểm F và phương trình (PT) đường chuẩn.' WHERE id = '0e4444d2-25c3-4c21-a91e-39ea3c1552ae';
-- VTPT
UPDATE questions SET noi_dung = 'Điền: d₁ // d₂ ⇔ hai vectơ pháp tuyến (VTPT) ______ VÀ hai đường thẳng ______.' WHERE id = '0e44eca2-3564-487f-af24-2af6221971dc';
-- BPT
UPDATE questions SET noi_dung = 'Nếu x là SỐ QUYỂN VỞ mua được, ngoài bất phương trình (BPT) về tiền, ta bắt buộc phải thêm điều kiện: x ___ 0' WHERE id = '0f2120d2-ac7c-4411-b969-56794bed45b9';
-- BPT
UPDATE questions SET noi_dung = 'Đưa bất phương trình (BPT) 3x − 2 ≤ 5 − 2y về dạng chuẩn ax + by ≤ c, xác định a, b, c. B1: Chuyển ẩn sang trái, hằng số sang phải. B2: Xác định a, b, c. B3: Kiểm điều kiện — có phải BPT bậc nhất hai ẩn không?' WHERE id = '0f79f97d-836e-467a-a700-2547ae0f090c';
-- PT
UPDATE questions SET noi_dung = 'Lập phương trình (PT) đường tròn đi qua A(1; 2), B(5; 2) và có tâm nằm trên đường thẳng d: x - y = 0.' WHERE id = '11972abf-9c43-48b0-b566-645c3fbedf69';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) x + 2y ≤ 0. Đếm số điểm KHÔNG DÙNG ĐƯỢC làm điểm thử: O(0;0) · A(2;−1) · B(1;0) · C(−4;2) · D(0;1)' WHERE id = '129a738b-9c54-4b95-87e7-6fda8ad67a5f';
-- BPT
UPDATE questions SET noi_dung = 'Cho hệ: ⎧ x + y ≤ 4 · ⎨ x ≥ 0 · ⎩ y ≥ 0. (a) MÔ TẢ cách vẽ miền nghiệm (bờ, nét, điểm thử, hướng tô cho TỪNG bất phương trình (BPT)). (b) Miền nghiệm là hình gì? Nêu toạ độ các đỉnh. (c) KIỂM CHỨNG bằng 2 điểm: một TRONG miền, một NGOÀI miền. (d) Nếu BỎ điều kiện x ≥ 0 và y ≥ 0 thì miền nghiệm thay đổi thế nào?' WHERE id = '13f88686-77ef-44c8-bdfc-94ed15136794';
-- IQR
UPDATE questions SET noi_dung = 'Một bạn nói: ''khoảng tứ phân vị (IQR) LUÔN BẰNG MỘT NỬA của khoảng biến thiên R.'' Chỉ ra lỗi. (Hỏi kèm độ tự tin 1–3)' WHERE id = '150d8b73-b0db-4911-9d02-c1cc7ccd6876';
-- BPT
UPDATE questions SET noi_dung = 'Vẽ bờ của bất phương trình (BPT) 2x + 3y ≤ 6. B1: Viết phương trình đường thẳng bờ. B2: Tìm hai giao điểm với trục toạ độ. B3: Xác định kiểu nét vẽ, mô tả đường thẳng.' WHERE id = '169cc0e0-ab9d-432d-9036-1a56f48d847c';
-- PTTQ
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) đường thẳng đi qua M(1; 2) và vuông góc với d: 3x - y + 4 = 0.' WHERE id = '18a15322-4714-42f0-8413-ba6b63c239a5';
-- BPT
UPDATE questions SET noi_dung = 'Kiểm tra cặp (−1; 4) có là nghiệm của bất phương trình (BPT) 2x + 3y ≥ 10 không. B1: Xác định x = ? và y = ? (chú ý THỨ TỰ!) B2: Thay vào vế trái, tính giá trị. B3: So sánh với vế phải, kết luận.' WHERE id = '198dfedb-fb85-4deb-8d43-c677f1c9d142';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) tiếp tuyến của (C): (x-1)² + (y-2)² = 25 tại điểm M(4; 6).' WHERE id = '1abcbcab-793a-4ec6-9d58-b05866e8284b';
-- PTTQ
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) của đường thẳng đi qua hai điểm A(2; 1) và B(4; 5).' WHERE id = '1af0786d-b8b6-4bc4-9769-864832285a91';
-- BPT
UPDATE questions SET noi_dung = 'Đếm số biểu thức LÀ bất phương trình (BPT) bậc nhất hai ẩn: (1) x + y ≤ 3 · (2) x² + y ≥ 1 · (3) 2x − 5y > 0 · (4) xy < 4 · (5) 3y ≤ 6 · (6) x/y ≥ 2' WHERE id = '1b52ff9d-8167-4970-9f6f-912bb930875a';
-- BPT
UPDATE questions SET noi_dung = 'Nối mỗi bất phương trình (BPT) với cách vẽ bờ. Trả lời ''1-x, 2-y, 3-z, 4-w'': Cột A: 1) 2x+y ≤ 4 · 2) 2x+y < 4 · 3) 2x+y ≥ 4 · 4) 2x+y > 4 Cột B: a) Nét LIỀN (bờ THUỘC miền) · b) Nét ĐỨT (bờ KHÔNG thuộc)' WHERE id = '1e3f2b71-98ad-45ba-b98e-b5cab6efa38f';
-- PTTQ
UPDATE questions SET noi_dung = 'Cho tam giác ABC: A(1; 1), B(5; 3), C(3; 7). Viết phương trình tổng quát (PTTQ) đường trung tuyến kẻ từ A.' WHERE id = '1e80d89f-d751-42ad-b620-6ec03a20cf79';
-- PT
UPDATE questions SET noi_dung = 'Cho hypebol x²/16 - y²/9 = 1. Viết phương trình (PT) hai đường tiệm cận dưới dạng tổng quát.' WHERE id = '21f1ce94-ac28-45c3-916f-178238ee4a02';
-- PTTS, VTCP
UPDATE questions SET noi_dung = 'Điền: Đường thẳng qua M(x₀; y₀) có vectơ chỉ phương (VTCP) u = (a; b) có phương trình tham số (PTTS) là x = ______ , y = ______.' WHERE id = '226b95d4-bc16-4e17-bfc5-3411e12cfbbb';
-- PT
UPDATE questions SET noi_dung = 'Chuyển phương trình (PT) đường tròn (x - 1)² + (y + 2)² = 9 sang dạng khai triển.' WHERE id = '2445faf4-60c6-491e-93e5-c6b468d36847';
-- PT
UPDATE questions SET noi_dung = 'phương trình (PT) y² = -6x biểu diễn:' WHERE id = '271889b4-9c7e-4ec2-b21e-8f0f38a8f3b3';
-- PTTQ
UPDATE questions SET noi_dung = 'Cho A(2; 4), B(6; 2). Viết phương trình tổng quát (PTTQ) đường trung trực của đoạn AB.' WHERE id = '280e5540-b811-42d4-8b9e-a69239b7de7d';
-- VTPT
UPDATE questions SET noi_dung = 'Đường thẳng d: 2x - 3y + 1 = 0 có một vectơ pháp tuyến (VTPT) là:' WHERE id = '2937d85d-4c0a-4b3e-9091-aa7b759dcff7';
-- BPT
UPDATE questions SET noi_dung = 'a) bất phương trình (BPT) x + y ≤ 3 ⇒ vẽ bờ bằng nét LIỀN b) BPT x + y > 3 ⇒ vẽ bờ bằng nét LIỀN c) Điểm (1; 2) (thoả 1+2 = 3) THUỘC miền nghiệm của x + y ≤ 3 d) Điểm (1; 2) THUỘC miền nghiệm của x + y > 3' WHERE id = '29c8a545-d33c-4e6f-a048-8b7b347f5680';
-- BPT
UPDATE questions SET noi_dung = 'Khi bất phương trình (BPT) có c = 0 (bờ đi qua gốc), ta KHÔNG dùng ___ làm điểm thử.' WHERE id = '2c4b5d19-2ca5-43e2-b11d-c1c9c04abc79';
-- PT
UPDATE questions SET noi_dung = 'Cho phương trình (PT) x²/(m-1) + y²/(5-m) = 1. Tìm m để PT biểu diễn một ELIP.' WHERE id = '2efbab98-b97c-4e9a-9b31-0bee3745702a';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn tâm I(1; 2) tiếp xúc với đường thẳng d: 3x - 4y - 5 = 0.' WHERE id = '2f7c0973-6da1-4b17-af97-98307af23a88';
-- PTTQ, PTTS
UPDATE questions SET noi_dung = 'Chuyển phương trình tham số (PTTS) x = 3, y = 1 + 2t sang phương trình tổng quát (PTTQ) và giải thích trường hợp đặc biệt.' WHERE id = '2ffb5278-5fdb-42de-9f9f-5a3a18cd59a8';
-- PTTQ
UPDATE questions SET noi_dung = 'Cho tam giác ABC: A(0; 0), B(4; 0), C(0; 3). Viết phương trình tổng quát (PTTQ) ba cạnh của tam giác và tính diện tích.' WHERE id = '31b8a25f-0ac8-45d8-b5e2-f4c501db6ac1';
-- PT
UPDATE questions SET noi_dung = 'Lập phương trình (PT) đường tròn đi qua O(0; 0), A(2; 0), B(0; 4).' WHERE id = '35900bbb-80a4-4970-8236-727738f4865b';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của parabol có tiêu điểm F(2; 0).' WHERE id = '361c2da8-8e27-4d85-82b0-c0c7529a3c07';
-- PT
UPDATE questions SET noi_dung = 'phương trình (PT) x²/16 + y²/25 = 1 là đường conic nào?' WHERE id = '36207be5-d561-46a2-9dd8-936e82a04348';
-- BPT
UPDATE questions SET noi_dung = 'bất phương trình (BPT) 2x − 3y ≤ 0 có đường thẳng bờ 2x − 3y = 0. Đường thẳng này chắc chắn đi qua: A. Điểm (1; 0) B. Gốc toạ độ O(0; 0) C. Điểm (0; 1) D. Không đi qua điểm nào cố định' WHERE id = '364493b7-5b15-4917-88c2-bbf682d8fbf6';
-- BPT
UPDATE questions SET noi_dung = 'Cho hệ: ⎧ x + y ≤ 5 · ⎩ x − y ≥ 1. Xét từng ý: a) Cặp (3; 1) thoả bất phương trình (BPT) thứ nhất b) Cặp (3; 1) thoả BPT thứ hai c) Cặp (3; 1) là NGHIỆM CỦA HỆ d) Cặp (1; 3) là nghiệm của hệ (vì nó thoả BPT thứ nhất)' WHERE id = '370ca943-7ec3-4aee-9591-38ee1a1ad5ad';
-- VTPT
UPDATE questions SET noi_dung = 'Cho A(1; 3), B(5; 1). Tìm một vectơ pháp tuyến (VTPT) của đường thẳng AB.' WHERE id = '37cba9af-fb88-4d65-b8ca-ff23ddf3a7e4';
-- MTCT
UPDATE questions SET noi_dung = '(a) máy tính cầm tay (MTCT) thường hiển thị kết quả với một số chữ số HỮU HẠN, dù bản thân giá trị THỰC (như \(\sqrt{2}\)) có VÔ HẠN chữ số thập phân. (b) Khi CỘNG/NHÂN nhiều số gần đúng, SAI SỐ có thể TÍCH LUỸ (cộng dồn) qua các phép tính. (c) Nên GIỮ NHIỀU chữ số trong các bước TÍNH TOÁN TRUNG GIAN, và chỉ QUY TRÒN ở bước CUỐI CÙNG. (d) Việc quy tròn SỚM (ở mỗi bước trung gian) LUÔN cho kết quả CHÍNH XÁC HƠN so với việc quy tròn ở CUỐI CÙNG.' WHERE id = '38115be5-fa49-452a-b651-5c52303a807b';
-- PTTQ
UPDATE questions SET noi_dung = 'Cho d: x = 1 + mt, y = 2 + 3t. Tìm m để d có phương trình tổng quát (PTTQ) là 3x - 2y + 1 = 0.' WHERE id = '38c04ead-c268-44cf-aad3-bee8ae023032';
-- IQR
UPDATE questions SET noi_dung = 'Cho mẫu: 4, 7, 9, 12, 15, 18, 22, 25 (n=8). Bước 1: Tìm Q1 (trung vị nửa dưới: 4,7,9,12). Bước 2: Tìm Q3 (trung vị nửa trên: 15,18,22,25). Bước 3: Tính khoảng tứ phân vị (IQR).' WHERE id = '391613b1-abab-4c8b-a162-cbc29e43152d';
-- BPT
UPDATE questions SET noi_dung = 'Bài làm: ''Kiểm tra cặp (2; 5) có là nghiệm của bất phương trình (BPT) 5x + 2y ≤ 20 không. Tôi thay vào: 5(5) + 2(2) = 25 + 4 = 29. Vì 29 ≤ 20 SAI, nên (2; 5) KHÔNG là nghiệm.'' Tìm và sửa lỗi.' WHERE id = '39e4ebe0-5d7b-48a1-a667-2ed6d75789ff';
-- BPT
UPDATE questions SET noi_dung = '(a) bất phương trình (BPT) x + y ≤ 4 có BAO NHIÊU nghiệm? Giải thích. (b) MÔ TẢ tập nghiệm trên mặt phẳng Oxy. (c) Cho 3 nghiệm cụ thể và 1 cặp KHÔNG là nghiệm.' WHERE id = '3c860e35-ec44-4cb4-aee9-68aeebb2c309';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 2x − y > 0. (a) Giải thích vì sao KHÔNG dùng được O(0;0) làm điểm thử. (b) Dùng (1;0) → xác định miền nghiệm. (c) Dùng (0;1) → xác định miền nghiệm. (d) So sánh (b) và (c). Kết quả có giống nhau không? Vì sao điều đó QUAN TRỌNG?' WHERE id = '3caef866-cbb7-4e79-a228-2d19a5ea4c49';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 3x + 2y ≤ 12. Đếm số cặp LÀ NGHIỆM trong: (0;0) · (2;3) · (4;1) · (1;5) · (3;2)' WHERE id = '3d36f9eb-9d30-452c-9906-fb192d9ab839';
-- BPT
UPDATE questions SET noi_dung = 'Bé Na hỏi: ''Cô ơi, sao giải bất phương trình (BPT) −2x ≥ 6 lại ra x ≤ −3 ạ? Em chia cho −2 thì phải ra x ≥ −3 chứ, sao dấu tự nhiên đổi chiều thế ạ?''' WHERE id = '3df82f5d-cd4c-4d23-966d-36a746dc6921';
-- PTTQ
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) đường thẳng đi qua N(-2; 5) và song song với trục Oy.' WHERE id = '3f5e3f16-0efb-4b4a-8248-a88846f37dae';
-- GTLN
UPDATE questions SET noi_dung = '(a) VÌ SAO hàm F = ax + by đạt max/min tại các ĐỈNH (mà không phải điểm giữa miền)? Giải thích trực quan. (b) Cho miền = TAM GIÁC O(0;0), (4;0), (0;4) và F = x + y. Tìm giá trị lớn nhất (GTLN). Có gì ĐẶC BIỆT? (c) Nếu miền nghiệm KHÔNG BỊ CHẶN (vô hạn), có chắc tìm được GTLN không? Cho ví dụ.' WHERE id = '3fc8ad42-2a29-42d6-8b47-0ea46ba964c4';
-- MTCT
UPDATE questions SET noi_dung = 'Tính \(\dfrac{\sqrt{7}+2}{\sqrt{7}-2}\) bằng máy tính cầm tay (MTCT) (giữ 4 chữ số thập phân ở bước trung gian), sau đó quy tròn kết quả cuối cùng đến hàng phần chục. (Hỏi kèm độ tự tin 1–3)' WHERE id = '3fd56704-2c20-451c-b7d2-317e0b47457c';
-- IQR
UPDATE questions SET noi_dung = 'Biết Q1=12, Q3=28. Tính khoảng tứ phân vị (IQR). (Hỏi kèm độ tự tin 1–3)' WHERE id = '4071616d-e3af-417e-a09c-74069b833e37';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) mx + 2y ≤ 10. Tìm giá trị LỚN NHẤT của m nguyên để cặp (3; 2) là nghiệm.' WHERE id = '40d1dede-dc7b-4607-b693-264cb13800f2';
-- BPT
UPDATE questions SET noi_dung = 'Bé Na hỏi: ''Cô ơi, em thử điểm O(0;0) vào bất phương trình (BPT) rồi, ra kết quả SAI. Vậy em phải tô nửa nào ạ? Em quên mất rồi!''' WHERE id = '4110d3cd-63dc-4e91-aec9-f4ce0d3ac8d4';
-- BPT
UPDATE questions SET noi_dung = 'ĐỈNH của miền nghiệm hệ bất phương trình (BPT) là: A. Giao điểm của bất kỳ hai bờ nào B. Giao điểm của hai bờ, VÀ điểm đó phải THUỘC miền nghiệm C. Điểm bất kỳ trên bờ D. Gốc toạ độ O(0; 0)' WHERE id = '41b170e2-ddc3-4f3d-8c72-fcc837ea6c29';
-- PTTQ
UPDATE questions SET noi_dung = 'Cho tam giác ABC: A(1; 2), B(5; 2), C(3; 6). Viết phương trình tổng quát (PTTQ) đường trung tuyến kẻ từ A.' WHERE id = '41f40224-6e7b-4d05-b3b9-44b91293272d';
-- IQR
UPDATE questions SET noi_dung = '(a) khoảng tứ phân vị (IQR) đo ĐỘ PHÂN TÁN của ''50% dữ liệu Ở GIỮA'' (từ Q1 đến Q3). (b) IQR ÍT BỊ ẢNH HƯỞNG bởi các giá trị NGOẠI LỆ hơn KHOẢNG BIẾN THIÊN R. (c) IQR LUÔN KHÔNG ÂM (vì Q3≥Q1). (d) IQR LUÔN LỚN HƠN R.' WHERE id = '42f5b254-4ebd-4e97-962e-4cc0708fa581';
-- PT
UPDATE questions SET noi_dung = 'Tìm điều kiện của m để x² + y² - 2(m+1)x + 4y + 8 = 0 là phương trình (PT) đường tròn.' WHERE id = '4316089e-d4f3-4769-82d9-74063421bdf4';
-- IQR, CV
UPDATE questions SET noi_dung = 'Tổng kết: giải thích MỐI LIÊN HỆ giữa CÁC THƯỚC ĐO ĐỘ PHÂN TÁN đã HỌC (R, khoảng tứ phân vị (IQR), PHƯƠNG SAI/ĐỘ LỆCH CHUẨN, hệ số biến thiên (CV)) — MỖI thước ĐO PHÙ HỢP với NGỮ CẢNH NÀO, và TẠI SAO KHÔNG CÓ ''MỘT THƯỚC ĐO DUY NHẤT'' PHÙ HỢP cho MỌI TÌNH HUỐNG. (Hỏi kèm độ tự tin 1–3)' WHERE id = '4684fdba-4c17-4120-b815-29ad878767c7';
-- BPT
UPDATE questions SET noi_dung = 'Bài làm: ''Đưa bất phương trình (BPT) −2x + 4y ≥ 6 về dạng đơn giản. Tôi CHIA CẢ HAI VẾ CHO −2: x − 2y ≥ −3.'' Tìm và sửa lỗi.' WHERE id = '470aa675-315d-4098-a88f-f23ddd882dad';
-- PT
UPDATE questions SET noi_dung = 'Hypebol có tiêu cự 10 và đi qua điểm M(3; 0). Viết phương trình (PT) chính tắc.' WHERE id = '477e34af-0917-4ac1-ab95-fec195e14d09';
-- PT
UPDATE questions SET noi_dung = 'Cho hai đường thẳng song song d₁: x + y - 1 = 0 và d₂: x + y - 5 = 0. Tính khoảng cách giữa chúng, rồi tìm phương trình (PT) đường thẳng song song và CÁCH ĐỀU d₁, d₂.' WHERE id = '490982d5-fcfb-4fe8-9011-63cf14db026d';
-- IQR
UPDATE questions SET noi_dung = 'Một bạn nói: ''MỌI giá trị LỚN HƠN SỐ TRUNG BÌNH RẤT NHIỀU đều LÀ giá trị BẤT THƯỜNG, KHÔNG CẦN dùng đến khoảng tứ phân vị (IQR).'' Chỉ ra lỗi. (Hỏi kèm độ tự tin 1–3)' WHERE id = '4a01fd7a-eed3-45dd-8a5c-597a2cf9fa09';
-- PT
UPDATE questions SET noi_dung = 'phương trình (PT) chính tắc của hypebol có dạng:' WHERE id = '4a643a78-d21b-4e2c-a989-191cd742b1c3';
-- VTPT, VTCP
UPDATE questions SET noi_dung = 'Xét tính đúng/sai: Tích vô hướng của một vectơ pháp tuyến (VTPT) và một vectơ chỉ phương (VTCP) của cùng một đường thẳng luôn bằng 0.' WHERE id = '4c4731ef-2bd5-4380-8092-b023c59cd60e';
-- PT
UPDATE questions SET noi_dung = 'Cho đường thẳng d: x + y - 2 = 0 và điểm I(0; 0). Viết phương trình (PT) đường tròn tâm I tiếp xúc d, rồi tìm toạ độ tiếp điểm.' WHERE id = '4cf27705-cd56-484a-a485-d274045fb689';
-- PTTQ
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) đường thẳng song song với d: 3x + 4y - 5 = 0 và cách d một khoảng bằng 2.' WHERE id = '4cfe4a53-f5eb-4b20-a0be-40f9d4f0ad84';
-- BPT
UPDATE questions SET noi_dung = 'Bài làm: ''Quán bán x ly trà sữa (35.000 đ/ly) và y ly cà phê (28.000 đ/ly). Khách mang theo 200 nghìn đồng. Lập bất phương trình (BPT). Tôi đặt: x = số ly trà sữa, y = số ly cà phê. Tiền trà sữa = 28x. Tiền cà phê = 35y. Vậy BPT là: 28x + 35y ≤ 200'' Tìm và sửa lỗi.' WHERE id = '4eae35e3-fd70-4a75-905d-49ef1f77da37';
-- PTTQ, VTPT
UPDATE questions SET noi_dung = 'Điền: Đường thẳng qua M(x₀; y₀) có vectơ pháp tuyến (VTPT) n = (A; B) có phương trình tổng quát (PTTQ) là ______ = 0.' WHERE id = '4fc06895-8d5d-4eaa-b2d8-1de4fc00aec4';
-- BPT
UPDATE questions SET noi_dung = 'Kiểm tra cặp (2; 1) có là nghiệm của hệ: ⎧ 3x + 2y ≤ 10 · ⎨ x − y ≥ 0 · ⎩ y ≥ 0. B1 — Kiểm bất phương trình (BPT) ①. B2 — Kiểm BPT ② (ĐỪNG DỪNG Ở B1!). B3 — Kiểm BPT ③ và KẾT LUẬN.' WHERE id = '5029670c-24e8-4123-9320-08c50cdfed4f';
-- BPT
UPDATE questions SET noi_dung = 'Khi xác định miền nghiệm của bất phương trình (BPT) ax + by ≤ c (với c ≠ 0), điểm thử ƯU TIÊN nên chọn là: A. Gốc toạ độ O(0; 0) (vì thay vào tính rất nhanh) B. Một điểm bất kì TRÊN đường thẳng bờ C. Điểm (1; 1) D. Giao điểm của bờ với trục Ox' WHERE id = '50483fa9-ec26-42ce-b678-6f99c49a68e6';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 3x ≥ 6 (coi là BPT bậc nhất hai ẩn với b = 0). Đường thẳng bờ cắt trục Ox tại điểm có HOÀNH ĐỘ bằng bao nhiêu?' WHERE id = '50939a55-86c8-437f-b9be-0f4b891b3fdb';
-- BPT
UPDATE questions SET noi_dung = 'Bé Na hỏi: ''Cô ơi, cho em cặp (2; 5) với bất phương trình (BPT) 5x + 2y ≤ 20 — em cứ không biết thay số nào vào đâu! Có cách nào chắc chắn không nhầm không ạ?''' WHERE id = '50c949b8-913d-4375-a6bf-6b5288ecdaac';
-- BPT
UPDATE questions SET noi_dung = 'Miền nghiệm của HỆ bất phương trình (BPT) là: A. Hợp (gộp tất cả) các miền nghiệm của từng BPT B. Phần GIAO (phần CHUNG) của các miền nghiệm từng BPT C. Miền nghiệm của BPT đầu tiên D. Toàn bộ mặt phẳng' WHERE id = '5160a55a-43fd-4355-933c-1404efd40f31';
-- IQR
UPDATE questions SET noi_dung = 'Giải thích vì sao khoảng tứ phân vị (IQR) được coi là THƯỚC ĐO ĐỘ PHÂN TÁN ''BỀN VỮNG'' (ROBUST) hơn KHOẢNG BIẾN THIÊN R, liên hệ với việc IQR CHỈ dựa VÀO Q1, Q3 (thay VÌ GIÁ TRỊ CỰC TRỊ). (Hỏi kèm độ tự tin 1–3)' WHERE id = '556f2d6b-9e11-4445-926d-a708e5a43f5e';
-- BPT
UPDATE questions SET noi_dung = 'Cho hệ 4 bất phương trình (BPT): ⎧ x + y ≤ 4 · ⎨ 2x + y ≤ 6 · ⎩ x ≥ 0, y ≥ 0. Trong 6 giao điểm của các cặp bờ, có bao nhiêu giao điểm BỊ LOẠI (không phải đỉnh)?' WHERE id = '582c8c5a-a2f0-4f74-aa79-02872cec6dc4';
-- MTCT
UPDATE questions SET noi_dung = 'Khi dùng máy tính cầm tay (MTCT) để tính toán với các số gần đúng (ví dụ tính \(\sqrt{2}+\pi\)), bước QUAN TRỌNG cuối cùng cần làm là gì?' WHERE id = '586b823a-0397-4e07-9859-9effc069c5f9';
-- MTCT
UPDATE questions SET noi_dung = 'Một bạn hỏi: ''Nếu máy tính cầm tay (MTCT) hiện đại đã có ĐỘ CHÍNH XÁC RẤT CAO (nhiều chữ số), tại sao chúng ta VẪN CẦN học về SỐ GẦN ĐÚNG và SAI SỐ một cách CẨN THẬN, thay vì chỉ TIN TƯỞNG HOÀN TOÀN vào KẾT QUẢ của máy tính?'' Giải thích cho bạn. (Hỏi kèm độ tự tin 1–3)' WHERE id = '59b76ddc-2775-4f65-a281-0b8a637bf7d9';
-- VTCP
UPDATE questions SET noi_dung = 'Tìm m để hai vectơ u = (m; 2) và v = (3; m-1) cùng phương (là hai vectơ chỉ phương (VTCP) của cùng một phương).' WHERE id = '59ea51d2-4dc5-4331-8252-c5b9dd2baf11';
-- BPT
UPDATE questions SET noi_dung = 'Xưởng may sản xuất x áo (cần 2 giờ/áo) và y quần (cần 3 giờ/quần). Xưởng có tối đa 120 giờ. bất phương trình (BPT) ràng buộc là: A. 2x + 3y ≥ 120 B. 2x + 3y ≤ 120 C. 3x + 2y ≤ 120 D. x + y ≤ 120' WHERE id = '5b1ba0d2-8e14-40c9-b46c-c6b5f6fd9ac1';
-- PTTQ, VTPT
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) đường thẳng qua A(0; 3) và B(2; 0). Bước 1: AB = (2; -3). Bước 2: vectơ pháp tuyến (VTPT) n = (3; 2). Bước 3: PTTQ: 3x + 2y - 6 = 0. Kiểm tra và chỉ ra bước sai (nếu có).' WHERE id = '5b496a76-4ab5-494c-8c9d-a0f9123e63ee';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn có tâm I(3; 1) và đi qua điểm A(6; 5).' WHERE id = '5b700403-70de-47c1-a0a5-f35fa48ecb73';
-- PTTQ, VTPT
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) của đường thẳng đi qua M(-1; 2) và có vectơ pháp tuyến (VTPT) n = (3; 5).' WHERE id = '5d048f88-84ff-4e6a-9229-02af46aab6f2';
-- PTTS
UPDATE questions SET noi_dung = 'Viết phương trình tham số (PTTS) của đường thẳng đi qua hai điểm A(1; 2) và B(4; 8).' WHERE id = '5d9ee878-2956-42eb-99e7-d67efae2ec39';
-- PT
UPDATE questions SET noi_dung = 'Để lập phương trình (PT) đường tròn qua ba điểm không thẳng hàng, ta thường:' WHERE id = '600cdd85-e054-45bc-bd81-e61ed8796f69';
-- VTPT
UPDATE questions SET noi_dung = 'Xét tính đúng/sai: Hai đường thẳng có cùng vectơ pháp tuyến (VTPT) thì luôn song song với nhau.' WHERE id = '61ac18d9-ed8a-4dbd-a7c2-61290df6d5f9';
-- BPT
UPDATE questions SET noi_dung = 'a) Miền nghiệm hệ = phần chồng lấn của các miền nghiệm từng bất phương trình (BPT) b) Miền nghiệm hệ LỚN HƠN miền nghiệm của mỗi BPT riêng lẻ c) Miền nghiệm hệ có thể là TẬP RỖNG (hệ vô nghiệm) d) Có thể tô phần KHÔNG thuộc mỗi BPT, rồi vùng TRẮNG còn lại là miền nghiệm' WHERE id = '6282e450-fa7d-4fb7-a9dc-6dffa1fdce88';
-- IQR
UPDATE questions SET noi_dung = 'Cho mẫu điểm: 5, 6, 7, 7, 8, 8, 9, 25 (giá trị 25 NGHI NGỜ là bất thường). Biết Q1=6,5; Q3=8,5. Bước 1: Tính khoảng tứ phân vị (IQR). Bước 2: Tính CẬN DƯỚI, CẬN TRÊN. Bước 3: Kiểm tra xem 25 có phải BẤT THƯỜNG không.' WHERE id = '62ee8de6-66f8-4ab7-8626-7923de17b4fe';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của elip có một tiêu điểm F₂(3; 0) và đi qua điểm M(0; 4).' WHERE id = '638f6d23-3caa-41f5-9f3f-aa1dbac7c61c';
-- BPT
UPDATE questions SET noi_dung = 'Nông trại trồng x ha lúa (cần 12 công/ha) và y ha ngô (cần 8 công/ha). Có tối đa 240 công lao động. Lập bất phương trình (BPT) rồi RÚT GỌN về dạng ax + by ≤ c với a, b, c nguyên dương NHỎ NHẤT có thể. Giá trị của c bằng bao nhiêu?' WHERE id = '64affb2a-7dfd-4d13-a735-bca7c7489804';
-- PT
UPDATE questions SET noi_dung = 'Cho (C): x² + y² - 2x - 4y = 0. Viết phương trình (PT) tiếp tuyến của (C) tại gốc toạ độ O(0; 0).' WHERE id = '665e3342-03d4-4a81-8cfd-15d245928c22';
-- VTPT
UPDATE questions SET noi_dung = 'Tìm m để đường thẳng d₁: mx + (m-1)y + 2 = 0 có vectơ pháp tuyến (VTPT) vuông góc với VTPT của d₂: 2x + y - 1 = 0.' WHERE id = '689b86c3-f4a6-42d4-8b1e-bdabdea48c9a';
-- VTPT
UPDATE questions SET noi_dung = 'Công thức tính góc giữa hai đường thẳng có vectơ pháp tuyến (VTPT) n₁, n₂ là:' WHERE id = '6d180403-882c-4f28-8de3-c505465dc4b8';
-- BPT
UPDATE questions SET noi_dung = 'a) Đỉnh miền nghiệm là giao điểm của hai bờ b) MỌI giao điểm của hai bờ đều là đỉnh của miền nghiệm c) Phải KIỂM giao điểm có thuộc miền nghiệm không (thay vào cả hệ) d) Hệ có 4 bất phương trình (BPT) thì miền nghiệm luôn có 4 đỉnh' WHERE id = '6ea4f4aa-8aed-420f-8dbe-99d63c3bf010';
-- VTCP, PT
UPDATE questions SET noi_dung = 'Điền: Đường thẳng qua M(x₀; y₀) có vectơ chỉ phương (VTCP) u = (a; b) với a, b ≠ 0 có phương trình (PT) chính tắc là ______.' WHERE id = '6f500108-2743-479b-892d-5bf552f151f3';
-- CV
UPDATE questions SET noi_dung = 'So sánh HAI cổ phiếu: A (lợi nhuận trung bình=10%, độ lệch chuẩn=4%); B (lợi nhuận trung bình=20%, độ lệch chuẩn=6%). Bước 1: Tính hệ số biến thiên (CV) của MỖI cổ phiếu. Bước 2: So sánh CV. Bước 3: Kết luận cổ phiếu NÀO ''RỦI RO TƯƠNG ĐỐI'' CAO HƠN (theo CV).' WHERE id = '7273a5e5-d4d3-47fe-99b6-f17bc224668f';
-- IQR
UPDATE questions SET noi_dung = 'Biết Q1=10, Q3=30 (khoảng tứ phân vị (IQR)=20). Giá trị nào sau đây được coi là BẤT THƯỜNG? (Hỏi kèm độ tự tin 1–3)' WHERE id = '7692d51f-a603-4063-b00e-9e2c2cfe621e';
-- VTCP
UPDATE questions SET noi_dung = 'Đường thẳng d: (x - 1)/2 = (y + 3)/5. Điểm nào và vectơ chỉ phương (VTCP) nào tương ứng?' WHERE id = '77003fca-fd5c-499c-af32-d3d75aa79034';
-- MTCT
UPDATE questions SET noi_dung = 'Tính \(\sqrt{5}+\sqrt{3}\) bằng máy tính cầm tay (MTCT), sau đó quy tròn đến hàng phần trăm. (Hỏi kèm độ tự tin 1–3)' WHERE id = '79b94512-9687-40b2-b561-6454071e4d07';
-- PTTQ
UPDATE questions SET noi_dung = 'Cho tam giác ABC: A(1; 2), B(5; 4), C(3; 8). Viết phương trình tổng quát (PTTQ) đường cao kẻ từ A.' WHERE id = '7e8ef164-ca2b-4838-8790-0e6316e2325b';
-- BPT
UPDATE questions SET noi_dung = 'Thay điểm thử vào bất phương trình (BPT), nếu được mệnh đề SAI thì ta tô nửa mặt phẳng ___ chứa điểm thử.' WHERE id = '7e9f4b20-18db-4539-9005-9c5340a8269c';
-- BPT
UPDATE questions SET noi_dung = 'Biểu diễn miền nghiệm của hệ: ⎧ x + y ≤ 4 · ⎨ x ≥ 0 · ⎩ y ≥ 0. B1 — VẼ MIỀN bất phương trình (BPT) ①. B2 — VẼ MIỀN BPT ②. B3 — VẼ MIỀN BPT ③. B4 — LẤY PHẦN GIAO & KIỂM CHỨNG.' WHERE id = '80443dc5-e256-4fa4-aa86-4eabfe81bf3b';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của hypebol có tiêu điểm F₂(5; 0) và đi qua điểm A(4; 0).' WHERE id = '81af610f-80eb-4050-96d7-c0868a37442e';
-- VTPT, VTCP
UPDATE questions SET noi_dung = 'Cho vectơ chỉ phương (VTCP) u = (2; -5). Vectơ nào sau đây là vectơ pháp tuyến (VTPT) của cùng đường thẳng?' WHERE id = '8296c0db-5308-48db-92e2-c83916c55b82';
-- PTTS, VTCP
UPDATE questions SET noi_dung = 'Viết phương trình tham số (PTTS) của đường thẳng đi qua A(3; -2) và có vectơ chỉ phương (VTCP) u = (1; 4).' WHERE id = '8425a098-4e9d-454f-8e79-4651b94ae46d';
-- BPT
UPDATE questions SET noi_dung = 'Để tìm miền nghiệm của hệ, ta vẽ miền nghiệm từng bất phương trình (BPT) rồi lấy phần ___ của chúng.' WHERE id = '87d9c33a-078f-4176-b2fd-fc945c527241';
-- IQR
UPDATE questions SET noi_dung = 'Cho mẫu (đã tính): Q1=5, Q2=8, Q3=13. Tính khoảng tứ phân vị (IQR) và cho biết IQR có liên quan gì đến Q2. (Hỏi kèm độ tự tin 1–3)' WHERE id = '895f77f2-3212-4228-9490-eabfbdd917a7';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 2x − y > 0. Thay điểm thử (1; 0) vào VẾ TRÁI, ta được giá trị bằng bao nhiêu?' WHERE id = '8a6f8d82-6aff-403e-a5fa-5deffdf9677c';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của đường thẳng đi qua A(1; 2) và B(4; 8).' WHERE id = '8a892c2b-84cf-4726-9c7d-4876ddce5b0e';
-- PT
UPDATE questions SET noi_dung = 'Trong các phương trình (PT) sau, PT nào là hypebol: (I) x²/4 - y²/9 = 1; (II) x² + y² = 4; (III) y²/9 - x²/4 = 1?' WHERE id = '8c602770-7838-4d3d-9aac-45072e3f3bee';
-- MTCT
UPDATE questions SET noi_dung = 'Tính chu vi hình chữ nhật với chiều dài \(a=\sqrt{50}\)cm và chiều rộng \(b=\sqrt{18}\)cm. Bước 1: Tính \(a, b\) bằng máy tính cầm tay (MTCT) (giữ NHIỀU chữ số). Bước 2: Tính chu vi \(P=2(a+b)\) (dùng giá trị CHƯA làm tròn). Bước 3: Quy tròn kết quả cuối cùng đến hàng phần trăm.' WHERE id = '90514827-2d93-43a7-9230-21b3280ec716';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của elip có bán trục lớn a = 5, bán trục nhỏ b = 4.' WHERE id = '91841791-dfe7-42b7-8374-f6ed68dfeaad';
-- PT
UPDATE questions SET noi_dung = 'Tìm m để x² + y² + 2mx - 2(m-1)y + 2m² - 2m + 1 = 0 là phương trình (PT) đường tròn.' WHERE id = '92ca1b15-2bca-4d0f-b75f-d73aaf27deb4';
-- PT
UPDATE questions SET noi_dung = 'Điền: Đường tròn tâm I(a; b), bán kính R có phương trình (PT) chính tắc là ______.' WHERE id = '93122256-afb8-4f25-b2ed-1e2d7bcb18a1';
-- PT
UPDATE questions SET noi_dung = 'Từ định nghĩa parabol (cách đều F và đường chuẩn Δ), hãy chứng minh phương trình (PT) chính tắc có dạng y² = 2px.' WHERE id = '97a36540-30ab-431c-8f76-27654659949c';
-- BPT
UPDATE questions SET noi_dung = 'Có phải bất phương trình (BPT) bậc nhất hai ẩn không? a) 2x + 3y ≤ 6 b) x² + y > 1 c) xy ≤ 4 d) x − 5y ≥ 0' WHERE id = '99e33080-4dcb-4fee-87e8-d5d09134d436';
-- PT
UPDATE questions SET noi_dung = 'Bạn nói: ''Chỉ cần a² + b² - c > 0 là phương trình (PT) x² + y² - 2ax - 2by + c = 0 chắc chắn là đường tròn, không cần kiểm tra gì thêm.'' Nhận xét.' WHERE id = '9a1ed330-7572-467c-8f98-1fc40f63adcc';
-- VTPT, VTCP
UPDATE questions SET noi_dung = 'Điền: Nếu đường thẳng có vectơ chỉ phương (VTCP) u = (a; b) thì một vectơ pháp tuyến (VTPT) của nó là n = ______.' WHERE id = '9ab18bd7-cb85-4336-a917-0c31f0a966fe';
-- PTTS
UPDATE questions SET noi_dung = 'Xét tính đúng/sai: Đường thẳng d có phương trình tham số (PTTS) x = 2 + t, y = -1 + 3t thì d đi qua điểm M(2; -1).' WHERE id = '9bd685be-a56a-461b-87a3-b7415988fabc';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn tâm I(-1; 2), bán kính R = 4.' WHERE id = 'a125d488-991d-4cf7-87a7-00d392201f8b';
-- PT
UPDATE questions SET noi_dung = 'Điền: Nhìn phương trình (PT) chính tắc, ta phân biệt: elip có dấu ______, hypebol có dấu ______, parabol chỉ có ______ biến bậc hai.' WHERE id = 'a3339ba3-e900-443d-a4c9-bf5fc68322ac';
-- PT
UPDATE questions SET noi_dung = 'Cho d₁: 2x - y + 1 = 0. Viết phương trình (PT) đường thẳng d₂ đi qua gốc O và tạo với d₁ một góc 45°.' WHERE id = 'a43b13ce-e076-42b2-83fc-058bcf468031';
-- VTCP, PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của đường thẳng qua A(2; -1) với vectơ chỉ phương (VTCP) u = (3; 4).' WHERE id = 'a5cb3acd-289c-4783-8c4d-bfa0e0c2e7d5';
-- VTPT, PT
UPDATE questions SET noi_dung = 'Cho A(1; 2), B(3; 6). Viết phương trình (PT) trung trực của AB. Bước 1: Trung điểm I = (2; 4). Bước 2: AB = (2; 4) là vectơ pháp tuyến (VTPT). Bước 3: PT: 2(x-1) + 4(y-2) = 0. Chỉ ra bước sai.' WHERE id = 'a62264b4-2cd2-4b03-b2ed-0c7bc5f29436';
-- VTCP
UPDATE questions SET noi_dung = 'Điền vào chỗ trống: Nếu u = (a; b) là một vectơ chỉ phương (VTCP) của Δ thì mọi vectơ dạng k·u với k ______ cũng là VTCP của Δ.' WHERE id = 'a8aa1336-ce6e-4e29-85af-e00f69d55d78';
-- VTPT
UPDATE questions SET noi_dung = 'Đường thẳng Δ vuông góc với d: 2x - y + 3 = 0. Một vectơ pháp tuyến (VTPT) của Δ là:' WHERE id = 'a956d7c6-f3f5-4ba9-91e5-9b9cea41e8de';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) x − 2y > 3. Cặp số nào KHÔNG là nghiệm? Giải thích ngắn. A. (5; 0) B. (4; 0) C. (1; 2) D. (7; 1)' WHERE id = 'a9b229ec-57b4-4712-94ad-d424ef0a36ae';
-- PT
UPDATE questions SET noi_dung = 'phương trình (PT) 2x² + 2y² - 8x + 4y - 6 = 0 có phải PT đường tròn không? Nếu có, tìm tâm và bán kính.' WHERE id = 'a9ff5e2a-fdb7-4d54-971c-8d6c7f4330d3';
-- PT
UPDATE questions SET noi_dung = 'Cho phương trình (PT) (m+1)x² + (m+1)y² - 4x + 2y - 1 = 0. Tìm m để đây là PT đường tròn.' WHERE id = 'aaa7e1c0-5976-4e11-907c-1d388f853e09';
-- IQR
UPDATE questions SET noi_dung = 'Một bạn hỏi: ''khoảng tứ phân vị (IQR) có mối LIÊN HỆ gì với việc PHÁT HIỆN GIÁ TRỊ BẤT THƯỜNG (outlier) trong DỮ LIỆU, một CHỦ ĐỀ sẽ HỌC Ở NODE tiếp theo?'' Giải thích cho bạn (dựa trên HIỂU BIẾT SƠ BỘ, không CẦN CHI TIẾT). (Hỏi kèm độ tự tin 1–3)' WHERE id = 'ac163432-5a3e-4586-b38d-7f08aab2508b';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn tiếp xúc với CẢ HAI trục toạ độ và đi qua điểm A(2; 1).' WHERE id = 'ae0766ab-a3fa-4e6c-8059-7fcd91017de5';
-- GTLN
UPDATE questions SET noi_dung = 'Bài làm: ''Cho hệ ⎧ x + y ≤ 4 · ⎨ 2x + y ≤ 6 · ⎩ x ≥ 0, y ≥ 0. Tìm giá trị lớn nhất (GTLN) của F = 3x + 2y. Tôi giải các cặp bờ, được 6 giao điểm: (0;0), (4;0), (0;4), (3;0), (0;6), (2;2). Tính F tại cả 6 điểm: F(0;0) = 0 · F(4;0) = 12 · F(0;4) = 8 · F(3;0) = 9 · F(0;6) = 12 · F(2;2) = 10. Kết luận: GTLN = 12, đạt tại (4; 0) hoặc (0; 6).'' Tìm và sửa lỗi.' WHERE id = 'aeda1201-2268-4400-9042-437c25549943';
-- VTPT
UPDATE questions SET noi_dung = 'Đường cao của tam giác kẻ từ đỉnh A nhận vectơ nào làm vectơ pháp tuyến (VTPT)?' WHERE id = 'b10ae571-40da-4b64-9951-d3146e22497d';
-- PT
UPDATE questions SET noi_dung = 'phương trình (PT) chính tắc của elip có dạng:' WHERE id = 'b67e81bb-68b0-419f-90ff-ea1a21c9bcff';
-- BPT
UPDATE questions SET noi_dung = '(a) Dịch 4 câu sau thành bất phương trình (BPT) (x = số sản phẩm A, y = số sản phẩm B): ① ''Sản xuất KHÔNG QUÁ 100 sản phẩm tổng cộng'' ② ''Sản xuất DƯỚI 100 sản phẩm tổng cộng'' ③ ''Số sản phẩm A ÍT NHẤT GẤP ĐÔI số sản phẩm B'' ④ ''Số sản phẩm A NHIỀU HƠN số sản phẩm B ít nhất 10 cái'' (b) Giải thích KHÁC BIỆT giữa ① và ② (cho ví dụ số cụ thể).' WHERE id = 'b79c4fc0-b4db-4d72-a73c-f9abf15efa12';
-- BPT
UPDATE questions SET noi_dung = 'Nghiệm của bất phương trình (BPT) bậc nhất HAI ẩn ax + by ≤ c là: A. Một số thực x B. Một CẶP SỐ (x₀; y₀) làm cho BPT trở thành mệnh đề ĐÚNG C. Một cặp số bất kì D. Giá trị của c' WHERE id = 'bb028fdf-d5dc-4792-a6cc-10c29e5aa2e2';
-- GTLN
UPDATE questions SET noi_dung = 'Miền nghiệm là TAM GIÁC có 3 đỉnh: O(0; 0), (4; 0), (0; 3). Cho hàm mục tiêu F = 2x + 5y. Tìm giá trị lớn nhất (GTLN) của F trên miền.' WHERE id = 'bc5be05e-e47a-40ab-9e4d-aa814c4b131e';
-- GTLN, GTNN
UPDATE questions SET noi_dung = 'Để tìm giá trị lớn nhất (GTLN)/giá trị nhỏ nhất (GTNN) của F = ax + by, ta tính giá trị của F tại các ___ của miền nghiệm.' WHERE id = 'bee9e646-ab45-4d34-bdd2-33fbac3c2cbc';
-- VTCP
UPDATE questions SET noi_dung = 'Học sinh viết: ''Đường thẳng d: 2x + 5y - 1 = 0 có vectơ chỉ phương (VTCP) là u = (2; 5).'' Hãy tìm lỗi và sửa.' WHERE id = 'bf2dc1d0-5b7d-43ec-b5b0-5d5a931e3892';
-- IQR
UPDATE questions SET noi_dung = 'Quy tắc PHỔ BIẾN để xác định GIÁ TRỊ BẤT THƯỜNG (outlier) dựa trên khoảng tứ phân vị (IQR) là gì?' WHERE id = 'c059ee93-0dae-4231-ae44-f7c2732e7c0c';
-- MTCT
UPDATE questions SET noi_dung = 'Một bạn tính \(\sqrt{2}\times\sqrt{8}\) bằng cách: BẤM máy tính cầm tay (MTCT) để có \(\sqrt{2}\approx1{,}41421\) và \(\sqrt{8}\approx2{,}82843\), rồi NHÂN HAI GIÁ TRỊ ĐÃ LÀM TRÒN này lại để được KẾT QUẢ CUỐI CÙNG. Đánh giá cách làm này, so sánh với việc TÍNH TRỰC TIẾP \(\sqrt{2}\times\sqrt{8}=\sqrt{16}=4\) (một SỐ NGUYÊN, KHÔNG CẦN xấp xỉ). (Hỏi kèm độ tự tin 1–3)' WHERE id = 'c1953763-4f6b-4b25-a7b5-9c28ae8d7696';
-- VTCP
UPDATE questions SET noi_dung = 'Đường thẳng Δ đi qua A(1; 2) và song song với đường thẳng d: x - 3y + 5 = 0. Tìm một vectơ chỉ phương (VTCP) của Δ.' WHERE id = 'c1e8aeef-7f80-4515-9984-65b058a24008';
-- PTTQ, VTPT
UPDATE questions SET noi_dung = 'Cho tam giác ABC với A(1; 1), B(5; 3), C(3; 7). Tìm vectơ pháp tuyến (VTPT) của đường cao kẻ từ A và viết phương trình tổng quát (PTTQ) đường cao đó.' WHERE id = 'c21222a8-ecbd-4488-b9dd-49816640972e';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của hypebol có tiêu điểm F(5; 0) và một tiệm cận y = (3/4)x.' WHERE id = 'c2255f30-389b-4e1d-bb62-8d6a6623b9e1';
-- BPT
UPDATE questions SET noi_dung = 'Khi vẽ bờ của bất phương trình (BPT) 2x + y < 5, ta vẽ đường thẳng 2x + y = 5 bằng: A. Nét ĐỨT (vì bờ KHÔNG thuộc miền nghiệm) B. Nét liền C. Nét liền, tô đậm D. Không cần vẽ đường thẳng' WHERE id = 'c23b7e2a-7646-4d2c-8486-c8b32436d95e';
-- BPT
UPDATE questions SET noi_dung = 'Cửa hàng bán x kg gạo (20 nghìn/kg) và y kg đường (25 nghìn/kg). Khách có 200 nghìn. Biểu diễn miền các phương án mua hàng khả thi. B1 — ĐẶT ẨN & NÊU ĐƠN VỊ. B2 — LẬP bất phương trình (BPT) ràng buộc. B3 — THÊM ĐIỀU KIỆN ẨN. B4 — BIỂU DIỄN MIỀN.' WHERE id = 'c2aed290-d72c-49e2-9dce-ef5c757dc483';
-- VTPT, VTCP
UPDATE questions SET noi_dung = 'Tìm m để vectơ n = (m; 3) là vectơ pháp tuyến (VTPT) của đường thẳng có vectơ chỉ phương (VTCP) u = (6; -4).' WHERE id = 'c330ece0-b9dc-4777-8928-309c1d03ff1a';
-- PTTQ
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) đường thẳng song song với d: x - 2y + 3 = 0 và đi qua giao điểm của d₁: x + y - 4 = 0 với d₂: 2x - y + 1 = 0.' WHERE id = 'c403ac36-4f0b-46fe-8ac8-bd4dac60eade';
-- PT
UPDATE questions SET noi_dung = 'Lập phương trình (PT) đường tròn ngoại tiếp tam giác có ba đỉnh A(0; 0), B(6; 0), C(0; 8).' WHERE id = 'c54453a2-bd9a-47aa-977d-543a53891541';
-- MTCT
UPDATE questions SET noi_dung = 'Tính diện tích hình tròn bán kính \(r=4{,}5\)cm (dùng \(\pi\) trên máy tính cầm tay (MTCT), không làm tròn \(\pi\) trước), sau đó quy tròn kết quả đến hàng phần chục. (Hỏi kèm độ tự tin 1–3)' WHERE id = 'c5ac6d26-5fd0-4fbd-9eb3-ed67f0d60581';
-- PT
UPDATE questions SET noi_dung = 'Cho (C): (x-1)² + (y-1)² = 4. Viết phương trình (PT) các tiếp tuyến của (C) song song với đường thẳng d: 3x + 4y - 1 = 0.' WHERE id = 'c5e13494-2fa1-4ac3-91bf-1a47968ae877';
-- BPT
UPDATE questions SET noi_dung = 'Bài làm: ''Kiểm tra cặp (1; 4) có là nghiệm của hệ: ⎧ x + y ≤ 6 ⎨ 2x + 3y ≤ 12 ⎩ x ≥ 0 Tôi kiểm bất phương trình (BPT) đầu tiên: 1 + 4 = 5. Hỏi 5 ≤ 6? ⇒ ĐÚNG! Vậy (1; 4) LÀ NGHIỆM của hệ.'' Tìm và sửa lỗi.' WHERE id = 'c7ca660e-6b3d-48d2-b20f-2b4db69d21d1';
-- BPT
UPDATE questions SET noi_dung = 'Bé Na hỏi: ''Cô ơi, em đọc đề bài hiểu hết, nhưng đến lúc VIẾT THÀNH bất phương trình (BPT) thì em tắc tịt! Có cách nào làm từng bước cho chắc không ạ?''' WHERE id = 'c93cd4c0-dc74-41ff-a2f7-9a2aa115299a';
-- BPT
UPDATE questions SET noi_dung = 'Bài làm: ''Xác định miền nghiệm của bất phương trình (BPT) 3x + 2y < 6. ① Vẽ bờ 3x + 2y = 6 nét ĐỨT (vì dấu <), qua (2;0) và (0;3). ✓ ② Chọn điểm thử O(0;0). ✓ ③ Thay vào: 3(0) + 2(0) = 0. Hỏi 0 < 6? ⇒ SAI. ✓ ④ Vì thử O ra kết quả, nên tôi tô nửa mặt phẳng CHỨA O.'' Tìm và sửa lỗi.' WHERE id = 'ca052c0f-6424-4e00-83bb-52cb30feca2e';
-- GTLN
UPDATE questions SET noi_dung = 'Cho hệ: ⎧ x + y ≤ 4 · ⎨ 2x + y ≤ 6 · ⎩ x ≥ 0, y ≥ 0. Tìm giá trị lớn nhất (GTLN) của F = 3x + 2y trên miền nghiệm.' WHERE id = 'cbc632f8-d0df-4bfb-9b7d-f7462d7693dd';
-- BPT
UPDATE questions SET noi_dung = 'Xác định miền nghiệm của bất phương trình (BPT) x − 2y ≥ 0. B1 — VẼ BỜ: bờ là x − 2y = 0. Tìm 2 điểm để vẽ. B2 — CHỌN ĐIỂM THỬ: kiểm O có dùng được không? B3 — THAY vào BPT GỐC. B4 — TÔ MIỀN.' WHERE id = 'cc658802-7b43-432b-ae5f-5cbaf8edddee';
-- PTTQ
UPDATE questions SET noi_dung = 'Giải thích cho bạn: vì sao từ một phương trình tổng quát (PTTQ) ta viết được VÔ SỐ phương trình tham số khác nhau, nhưng chúng vẫn mô tả cùng một đường thẳng?' WHERE id = 'd080c2b4-bf14-47d6-8a98-d21acd52566a';
-- PT
UPDATE questions SET noi_dung = 'Điền: phương trình (PT) bậc hai hai ẩn là PT đường tròn cần: hệ số x² và y² ______, KHÔNG có số hạng ______, và a² + b² - c ______.' WHERE id = 'd100ec4a-64db-45cb-b028-276f1ccb699e';
-- BPT
UPDATE questions SET noi_dung = 'Cho biểu thức (m − 2)x + 3y ≤ 7. Đếm số giá trị m NGUYÊN trong khoảng −1 ≤ m ≤ 5 để biểu thức LÀ bất phương trình (BPT) bậc nhất hai ẩn.' WHERE id = 'd2dc300b-066b-4c61-a9be-1abbefd44710';
-- BPT
UPDATE questions SET noi_dung = 'Bé Na hỏi: ''Cô ơi, hệ có 4 bất phương trình (BPT) thì em phải tô 4 lần! Hình vẽ rối tung hết, em không biết đâu là miền nghiệm nữa! Có mẹo gì không ạ?''' WHERE id = 'd3cef9d7-ef57-4dd0-8301-990ca68fd06c';
-- PT
UPDATE questions SET noi_dung = 'Lập bảng so sánh ba đường conic (elip, hypebol, parabol) theo bốn tiêu chí: định nghĩa, phương trình (PT) chính tắc, liên hệ a-b-c, và tâm sai e.' WHERE id = 'd4abe427-7dfe-449a-bd51-233b19532b56';
-- PT
UPDATE questions SET noi_dung = 'phương trình (PT) chính tắc của parabol (mở sang phải) là:' WHERE id = 'd5b1b39f-7fec-41f7-8e70-dc72a79ed9db';
-- BPT
UPDATE questions SET noi_dung = 'Cặp số là nghiệm của HỆ bất phương trình (BPT) khi nó thoả ___ các BPT trong hệ.' WHERE id = 'd5b96465-cf21-4d7a-8b5f-43bd5c71cc1b';
-- VTCP
UPDATE questions SET noi_dung = 'Xét tính đúng/sai: Đường thẳng có vectơ chỉ phương (VTCP) u = (0; 3) viết được ở dạng phương trình chính tắc.' WHERE id = 'd5bfbde7-bd96-4e4d-92f3-cd4ac276024d';
-- BPT
UPDATE questions SET noi_dung = '(a) Vì sao xy ≤ 4 KHÔNG phải bất phương trình (BPT) bậc nhất hai ẩn, dù x và y đều có số mũ 1? (b) Cho hai ví dụ biểu thức hai ẩn nhưng không phải bậc nhất, thuộc HAI KIỂU LỖI KHÁC NHAU.' WHERE id = 'd5f701ed-8620-4aa3-88f9-63b9bf20387a';
-- BPT
UPDATE questions SET noi_dung = 'Cửa hàng bán x kg táo (40 nghìn/kg) và y kg cam (25 nghìn/kg). Khách chỉ có 300 nghìn. bất phương trình (BPT) ràng buộc là: A. 25x + 40y ≤ 300 B. 40x + 25y ≤ 300 C. 40x + 25y ≥ 300 D. x + y ≤ 300' WHERE id = 'd73541cc-e5a5-4c59-b771-81bdba8974d0';
-- BPT
UPDATE questions SET noi_dung = 'Biểu thức nào LÀ bất phương trình (BPT) bậc nhất hai ẩn? Giải thích ngắn. A. 3x² − y ≤ 7 B. 2xy + x > 1 C. −x + 4y ≥ 0 D. √x + y ≤ 2' WHERE id = 'd766b573-f150-4c24-b5e1-62037311482e';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn tâm I(2; 1) và tiếp xúc với đường thẳng d: 3x + 4y - 1 = 0.' WHERE id = 'd8a2e85d-20ae-4432-b819-4a55abc7c0ea';
-- PTTQ, PTTS, VTCP
UPDATE questions SET noi_dung = 'Học sinh chuyển phương trình tham số (PTTS) x = 2 + t, y = 5 + 3t sang phương trình tổng quát (PTTQ) như sau: ''vectơ chỉ phương (VTCP) u = (1; 3) nên PTTQ là 1(x-2) + 3(y-5) = 0 ⇒ x + 3y - 17 = 0.'' Tìm lỗi.' WHERE id = 'd8b74057-ecf6-4101-83cd-741e64990289';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn có tâm nằm trên Ox, bán kính 2, và tiếp xúc với đường thẳng d: 3x + 4y - 4 = 0.' WHERE id = 'd8ca85ad-8c5e-4dc2-bacb-f40da4274096';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 2x + 3y > 6. Miền nghiệm của nó: A. Chứa gốc O(0; 0) B. KHÔNG chứa gốc O(0; 0) C. Là toàn bộ mặt phẳng D. Là tập rỗng' WHERE id = 'daf68c4b-c571-489a-b86a-13dc76ad4a0a';
-- PTTQ
UPDATE questions SET noi_dung = 'Chuyển phương trình tổng quát (PTTQ) 3x + 4y - 12 = 0 sang phương trình tham số (chọn mốc là giao điểm với Ox).' WHERE id = 'dca443ce-d3b6-4b7d-9921-b4738cf4b7c4';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của parabol đi qua điểm M(2; 4).' WHERE id = 'dd6d218d-753c-456d-bc49-b2f17406f4fb';
-- CV
UPDATE questions SET noi_dung = 'Hai NHÀ MÁY sản xuất linh kiện với ĐỘ DÀY (mm): Nhà máy X (trung bình=10, độ lệch chuẩn=0,5); Nhà máy Y (trung bình=50, độ lệch chuẩn=2). Nhà máy nào có QUY TRÌNH SẢN XUẤT ''ỔN ĐỊNH TƯƠNG ĐỐI'' hơn (dùng hệ số biến thiên (CV))? (Hỏi kèm độ tự tin 1–3)' WHERE id = 'de4f1bf6-2cfa-4683-9cee-f13be32390a8';
-- PT
UPDATE questions SET noi_dung = 'Parabol có đường chuẩn x = -4. Viết phương trình (PT) chính tắc của parabol đó.' WHERE id = 'de600f1c-153e-4ad8-9b67-044f687316fe';
-- IQR
UPDATE questions SET noi_dung = '(a) ''CẬN DƯỚI'' để xác định BẤT THƯỜNG là \(Q1-1{,}5\times khoảng tứ phân vị (IQR)\). (b) ''CẬN TRÊN'' là \(Q3+1{,}5\times IQR\). (c) MỘT giá trị NẰM TRONG khoảng [CẬN DƯỚI, CẬN TRÊN] được coi là ''BÌNH THƯỜNG'' (không phải OUTLIER). (d) MỌI giá trị NGOÀI khoảng [Q1,Q3] đều được coi là BẤT THƯỜNG.' WHERE id = 'df6c69eb-9b7b-4b4e-b0bd-1a17cb79bc27';
-- PT
UPDATE questions SET noi_dung = 'Điền: phương trình (PT) x² + y² - 2ax - 2by + c = 0 là PT đường tròn khi ______, khi đó tâm I(a; b) và R = ______.' WHERE id = 'e0438a1f-0091-4fee-8a32-557d73f086e5';
-- PTTQ
UPDATE questions SET noi_dung = 'Viết phương trình tổng quát (PTTQ) đường thẳng qua M(2; -1) và song song với d: 3x - 4y + 7 = 0.' WHERE id = 'e177eee2-1242-40c5-a9f6-ecbb02dce3ab';
-- BPT
UPDATE questions SET noi_dung = 'Với mỗi bất phương trình (BPT) sau, MÔ TẢ đường thẳng bờ (dạng hình, đi qua điểm nào) và KIỂU NÉT VẼ: (a) 2x + y ≤ 4 (b) y > 3 (c) x ≥ −2 (d) x − y < 0' WHERE id = 'e209d6cd-fcbc-4bdf-9704-57b7f8eb6444';
-- PT
UPDATE questions SET noi_dung = 'Cho phương trình (PT) 4x² + 9y² = 36. Đưa về dạng chính tắc và cho biết đó là conic nào.' WHERE id = 'e38de9ad-2d5b-49a5-8f74-12c7f44b5d07';
-- GTLN, GTNN
UPDATE questions SET noi_dung = 'Cho hệ: ⎧ x + y ≤ 4 · ⎨ x ≥ 0 · ⎩ y ≥ 0. Tìm giá trị lớn nhất (GTLN) và giá trị nhỏ nhất (GTNN) của F = 3x + y trên miền nghiệm. B1 — TÌM CÁC ĐỈNH. B2 — TÍNH F TẠI TỪNG ĐỈNH (lập BẢNG!). B3 — SO SÁNH & KẾT LUẬN.' WHERE id = 'e42ee9c4-f0ef-4f41-924e-05385b02d0d4';
-- IQR
UPDATE questions SET noi_dung = 'Hai lớp có cùng KHOẢNG BIẾN THIÊN R=20 về điểm thi. Lớp A có khoảng tứ phân vị (IQR)=5; Lớp B có IQR=15. Nhận xét về SỰ KHÁC BIỆT trong PHÂN BỐ điểm của HAI LỚP. (Hỏi kèm độ tự tin 1–3)' WHERE id = 'e622441d-5950-4964-a145-97adb2c8cff8';
-- IQR
UPDATE questions SET noi_dung = 'Một bạn hỏi: ''Trong PHÁT HIỆN GIAN LẬN THẺ TÍN DỤNG (fraud detection), CÁC HỆ THỐNG NGÂN HÀNG có DÙNG những Ý TƯỞNG TƯƠNG TỰ như QUY TẮC khoảng tứ phân vị (IQR) để PHÁT HIỆN GIAO DỊCH BẤT THƯỜNG KHÔNG?'' Giải thích cho bạn. (Hỏi kèm độ tự tin 1–3)' WHERE id = 'e62b89b4-6a5f-48f1-a7d8-076061401840';
-- BPT
UPDATE questions SET noi_dung = 'Bạn An mua x quyển vở (15 nghìn/quyển) và y cây bút (5 nghìn/cây), tổng tiền không quá 100 nghìn. a) bất phương trình (BPT) ràng buộc là 15x + 5y ≤ 100 b) Phải thêm điều kiện x ≥ 0 và y ≥ 0 c) Cặp (2; 5) thoả điều kiện d) Cặp (−1; 10) thoả điều kiện' WHERE id = 'e8f1657d-5fe1-433d-b649-08aad6462c0d';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) x + 2y ≤ 6. Đếm số điểm THUỘC miền nghiệm: O(0;0) · A(2;2) · B(4;1) · C(6;0) · D(1;4)' WHERE id = 'e9573769-2a3a-460e-8f03-59ebf61b5159';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) chính tắc của hypebol có a = 4 và c = 5.' WHERE id = 'eb5f782e-af77-4b4a-b0ee-27c326a7ab5e';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn tâm I(3; -4) tiếp xúc với trục Ox.' WHERE id = 'ebb4a9ac-0399-42cc-be98-c00959d8054a';
-- PT
UPDATE questions SET noi_dung = 'Xét phương trình (PT) x² + y² - 4x + 6y + 13 = 0. Bước 1: a = 2, b = -3, c = 13. Bước 2: R² = 4 + 9 - 13 = 0. Bước 3: R = 0 nên đây là đường tròn bán kính 0. Bước nào sai?' WHERE id = 'ec6f738f-3e6d-4209-b791-47827295c92e';
-- GTLN
UPDATE questions SET noi_dung = 'a) Muốn tìm giá trị lớn nhất (GTLN) của F, ta tính F tại các ĐỈNH rồi so sánh b) Có thể tìm GTLN bằng cách thử một điểm bất kỳ trong miền c) Nếu miền nghiệm là TAM GIÁC, ta chỉ cần tính F tại 3 đỉnh d) Nếu miền nghiệm RỖNG (hệ vô nghiệm), vẫn tìm được GTLN' WHERE id = 'ee184acf-65df-4623-b5c2-8321a331c601';
-- PTTQ
UPDATE questions SET noi_dung = 'Bạn nói: ''PT chính tắc là dạng tổng quát nhất của đường thẳng vì nó gọn hơn phương trình tổng quát (PTTQ).'' Hãy phản biện.' WHERE id = 'ef5abb7d-9296-4ce9-ab48-e3884403c741';
-- BPT
UPDATE questions SET noi_dung = 'a) Thay điểm thử vào bất phương trình (BPT), ra ĐÚNG ⇒ tô nửa mặt phẳng CHỨA điểm thử b) Thay điểm thử vào BPT, ra SAI ⇒ tô nửa mặt phẳng CHỨA điểm thử c) Điểm thử KHÔNG được nằm trên đường thẳng bờ d) O(0; 0) luôn là điểm thử tốt nhất trong MỌI trường hợp' WHERE id = 'f0711ffe-5f80-40ee-9480-39421a6ebcc5';
-- BPT
UPDATE questions SET noi_dung = 'Bé Na hỏi: ''Cô ơi, em thấy cặp (1; 4) THOẢ bất phương trình (BPT) THỨ NHẤT của hệ rồi mà! Vậy nó là nghiệm rồi chứ ạ? Sao cô bảo em phải kiểm THÊM làm gì?!''' WHERE id = 'f2eaa5de-3283-4864-9d86-13454065819e';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) tiếp tuyến của đường tròn x² + y² = 25 tại điểm A(3; 4).' WHERE id = 'f352592a-2a14-4aa3-b8f7-d5648a425879';
-- BPT
UPDATE questions SET noi_dung = 'Cho bất phương trình (BPT) 2x − y ≤ 4. Đếm số điểm KHÔNG DÙNG ĐƯỢC làm điểm thử (vì nằm TRÊN bờ): P(0;0) · Q(2;0) · R(0;−4) · S(1;−2)' WHERE id = 'f5bdaa36-c00b-43c8-b72b-4ead6cb161b0';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn đường kính AB với A(1; 1), B(5; 7).' WHERE id = 'f5cc900c-d453-4112-81f5-6045ef667bce';
-- IQR
UPDATE questions SET noi_dung = 'Giải thích vì sao QUY TẮC ''1,5×khoảng tứ phân vị (IQR)'' (thay VÌ MỘT HỆ SỐ KHÁC như 1 hoặc 2) được CHỌN làm TIÊU CHUẨN PHỔ BIẾN để XÁC ĐỊNH giá TRỊ BẤT THƯỜNG, liên hệ với sự ĐÁNH ĐỔI giữa việc ''PHÁT HIỆN ĐỦ NHIỀU'' và ''KHÔNG BÁO ĐỘNG GIẢ QUÁ NHIỀU''. (Hỏi kèm độ tự tin 1–3)' WHERE id = 'f938d8a9-eca6-45aa-8834-3e08a81e37cb';
-- PTTS
UPDATE questions SET noi_dung = 'Chuyển phương trình tham số (PTTS) x = 1 + 2t, y = 3 - t sang phương trình tổng quát.' WHERE id = 'f941e098-bd1e-4927-af56-a8f78dcdc110';
-- BPT
UPDATE questions SET noi_dung = 'Cặp số (x₀; y₀) là nghiệm của bất phương trình (BPT) nếu khi thay vào, ta được một mệnh đề ___.' WHERE id = 'fc31c4ad-4fd1-47b0-8d2c-b9eb4de90abe';
-- BPT
UPDATE questions SET noi_dung = 'Bài làm: ''Vẽ bờ của bất phương trình (BPT) x + 2y < 4. Tôi tìm giao điểm: cho x = 0 ⇒ x = 4 ⇒ điểm (4; 0). Cho y = 0 ⇒ 2y = 4 ⇒ y = 2 ⇒ điểm (0; 2). Rồi tôi vẽ đường thẳng NÉT LIỀN đi qua hai điểm đó.'' Tìm và sửa lỗi.' WHERE id = 'fce9ade9-291b-4dbf-b762-8ea8857637d5';
-- PT
UPDATE questions SET noi_dung = 'Cho phương trình (PT) x²/(m-2) + y²/(m-5) = 1. Tìm m để PT biểu diễn một HYPEBOL.' WHERE id = 'fd004482-63ae-49fc-b42a-822cb5d6fd04';
-- VTPT
UPDATE questions SET noi_dung = 'Tiếp tuyến của đường tròn tâm I tại tiếp điểm M₀ nhận vectơ nào làm vectơ pháp tuyến (VTPT)?' WHERE id = 'fdb7caae-7160-42c0-a687-9bde1336fb13';
-- BPT
UPDATE questions SET noi_dung = 'Câu ''Tổng số tiền mua KHÔNG QUÁ 200 nghìn đồng'' được dịch thành bất phương trình (BPT) với dấu: A. > B. ≤ C. < D. ≥' WHERE id = 'fe5237ca-77ff-4f9b-a5da-789aa297230a';
-- BPT
UPDATE questions SET noi_dung = 'Trong bất phương trình (BPT) ax + by ≤ c, điều kiện bắt buộc là: a và b KHÔNG ___ bằng 0.' WHERE id = 'feb29d0f-91f1-4f0a-b6fd-d5b374cf04d7';
-- GTLN, GTNN
UPDATE questions SET noi_dung = 'Trong bài toán tối ưu, HÀM MỤC TIÊU F = ax + by là: A. Một ràng buộc của bài toán B. Đại lượng cần tìm giá trị lớn nhất (GTLN)/giá trị nhỏ nhất (GTNN) (lợi nhuận, chi phí…) C. Miền nghiệm của hệ D. Điều kiện x ≥ 0, y ≥ 0' WHERE id = 'ff78c42a-154e-48c1-a660-c9cb3074e450';
-- PT
UPDATE questions SET noi_dung = 'Viết phương trình (PT) đường tròn có tâm nằm trên trục Ox, đi qua A(1; 2) và B(3; 4).' WHERE id = 'ffe9b598-db95-4f57-9ada-94ccbc109e3c';

COMMIT;
