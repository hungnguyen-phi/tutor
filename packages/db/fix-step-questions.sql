-- ═══════════════════════════════════════════════════════════════════════
-- CÂU NHIỀU BƯỚC CÓ 'PHƯƠNG ÁN NHIỄU' LÀ MÔ TẢ LỖI (sinh tự động)
--
-- Đáp án dạng "B1: … | B2: … | B3: …" còn nhiễu là "B2 viết {b;c}", "Bước 3
-- (lỗi cài sẵn): …" — mô tả HỌC SINH SAI Ở BƯỚC NÀO, không phải đáp án bấm
-- được. Hệ quả kép: nút bấm vô nghĩa, VÀ đáp án dài gấp nhiều lần nhiễu nên
-- đoán được bằng độ dài mà không cần hiểu Toán.
--
-- Đây đúng là câu MỞ (học sinh trình bày các bước). Bỏ nhiễu → rơi vào nhánh
-- chấm-bằng-mô-hình (so Ý). Cùng cách đã áp cho 18e51813 và e006347d.
--
-- KHÔNG vứt quan_niem_sai: gộp vào loi_giai thành mục 'Lỗi thường gặp' để
-- giữ phần sư phạm đội soạn đề đã bỏ công viết.
--
-- Rà 1868 câu active → 106 câu.
-- CHẠY: node packages/db/run-sql.mjs packages/db/fix-step-questions.sql
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: có dạng khẳng định. B2: thiếu tiêu chuẩn so sánh → chân lí không xác định. B3: mệnh đề toán học đòi hỏi ngôn ngữ CHÍNH XÁC, không mơ hồ.

Lỗi thường gặp: • Không nhận ra tính tương đối của từ ''lớn'' — bước hỏng: B2 • Nhầm ''có số'' = ''là mệnh đề toán học'' — bước hỏng: B3' WHERE id = '02f24df1-88bc-44ab-b46d-3e0308d9e54d';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình xét dấu tam thức khi Δ=0.

Lỗi thường gặp: • misc_nham_dau_ket_luan_voi_dau_a — kết luận sai chiều bất đẳng thức so với dấu thực của hệ số a.' WHERE id = '04ae7ae0-41b1-4ad0-bcc2-afde78c8047c';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp DỤNG QUY TẮC THỰC NGHIỆM (68-95-99,7) để ƯỚC LƯỢNG TỈ LỆ sản PHẨM ĐẠT TIÊU CHUẨN dựa TRÊN TRUNG BÌNH và ĐỘ LỆCH CHUẨN.

Lỗi thường gặp: • misc_nham_khoang_1_do_lech_voi_2_do_lech — NHẦM LẪN khoảng ''1 ĐỘ LỆCH CHUẨN'' (tương ứng 68%) với khoảng ''2 ĐỘ LỆCH CHUẨN'' (tương ứng 95%), TÍNH SAI phạm VI của BƯỚC 1 ngay TỪ ĐẦU.' WHERE id = '068afaee-7602-4176-a00c-c0128256b8ee';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bước B2 có bước kiểm phụ (''điểm thử có nằm trên bờ không?'') — VAN AN TOÀN. HS quen nhảy thẳng B1→B3 sẽ sập bẫy A05. KIỂM CHỨNG: (5;0) [nửa không chứa O]: 5 ≥ 3 ✓ là nghiệm ✓ | (1;0) [nửa chứa O]: 1 ≥ 3 ✗ không là nghiệm ✓

Lỗi thường gặp: • Bệnh A03 • Điểm NẰM TRÊN BỜ! • Mầm bệnh A05 • TÔ NGƯỢC HOÀN TOÀN!' WHERE id = '0799bb09-e809-4970-863e-99f7c78cc049';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Tính số trung bình rồi SO SÁNH một giá trị CỤ THỂ với trung bình để rút ra NHẬN XÉT có ý nghĩa.

Lỗi thường gặp: • misc_chia_sai_so_luong_gia_tri — chia TỔNG cho MỘT SỐ LƯỢNG SAI (4 thay vì ĐÚNG là 5 ngày), một lỗi ĐẾM SAI SỐ LƯỢNG phần tử trong mẫu số liệu.' WHERE id = '07dea33c-5594-42d1-b145-5325cb1929a3';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Đây là một ứng dụng đẹp của khái niệm ''dựng vectơ bằng nhau'': khi \(\overrightarrow{AM}=\overrightarrow{BC}\), tứ giác tạo thành luôn là hình bình hành.

Lỗi thường gặp: • misc_chi_can_do_dai_bang_nhau_la_hinh_binh_hanh — cho rằng chỉ cần hai cạnh có ĐỘ DÀI bằng nhau là đủ để kết luận tứ giác là hình bình hành, bỏ qua điều kiện quan trọng là hai vectơ tương ứng phải CÙNG HƯỚNG (bằng nhau theo đúng định nghĩa vectơ, không chỉ bằng nhau về độ dài).' WHERE id = '08ca3aaa-a0d4-47eb-b2de-c47889b2e49e';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ giải bất phương trình bậc hai không chặt (≥).

Lỗi thường gặp: • misc_dao_nguoc_khoang_nghiem — đảo ngược hoàn toàn khoảng nghiệm so với đáp án đúng.' WHERE id = '0b65c57f-ce86-46df-8e04-f5250e854d80';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Chuyển −2y từ phải sang trái → đổi dấu thành +2y. Đây là phép CỘNG 2y vào cả hai vế — KHÔNG đổi chiều BPT (chỉ nhân/chia số âm mới đổi chiều!).

Lỗi thường gặp: • Quên đổi dấu khi chuyển −2y sang trái • Sai số học: 5 + 2 = 7, không phải 3 • Không kiểm điều kiện' WHERE id = '0f79f97d-836e-467a-a700-2547ae0f090c';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: mệnh đề ∃ chỉ cần một ví dụ. B2: 41² = 1681; 1681 + 41 + 41 = 1763; 1763 = 41 × 43 nên là hợp số. B3: đã tìm được n = 41 thoả → P đúng.

Lỗi thường gặp: • Nhầm yêu cầu chứng minh ∃ với ∀ — bước hỏng: B1 • Tin vào quy nạp từ vài trường hợp đầu (n=0..39) — bước hỏng: B3' WHERE id = '1077812b-a03e-4c0b-98c7-30d6a49af424';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Xác định điều kiện cùng phương rồi giải phương trình, kết hợp xác định thêm cùng hướng hay ngược hướng dựa vào dấu của tỉ số.

Lỗi thường gặp: • misc_nham_dau_ti_so_voi_huong — nhầm lẫn rằng tỉ số ÂM (giữa các thành phần tương ứng) tương ứng với CÙNG HƯỚNG, trong khi thực chất tỉ số ÂM có nghĩa là hệ số k trong \(\vec{b}=k\vec{a}\) là ÂM, tức là NGƯỢC HƯỚNG (không phải cùng hướng).' WHERE id = '110a1739-6dee-407e-bc02-638844f5fb83';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Đây là kỹ thuật biện luận QUAN TRỌNG: khi hai vectơ KHÔNG cùng phương, một tổ hợp tuyến tính của chúng chỉ bằng \(\vec{0}\) khi CẢ HAI hệ số đều bằng 0.

Lỗi thường gặp: • misc_bo_qua_mau_thuan_voi_gia_thiet — bỏ qua việc biến đổi \(m\ne0\) dẫn đến \(\vec{a}, \vec{b}\) CÙNG PHƯƠNG, một điều MÂU THUẪN TRỰC TIẾP với giả thiết ban đầu (không cùng phương), không nhận ra đây là dấu hiệu để loại trừ trường hợp \(m\ne0\).' WHERE id = '1337b597-3f96-4251-a863-e50e7582caf9';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bước B1 bị bỏ nhiều nhất — HS thấy BPT ≤ rồi vẽ luôn, quên rằng bờ là một PHƯƠNG TRÌNH (dấu =).

Lỗi thường gặp: • Không hiểu bờ là đường THẲNG (phương trình!) • Đảo hai hệ số (chia nhầm 6 cho 3 ở chỗ x) • Nhầm nét liền/nét đứt' WHERE id = '169cc0e0-ab9d-432d-9036-1a56f48d847c';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: 3 > 5 sai. B2: 2 chỉ có ước 1 và 2 → nguyên tố → Q đúng. B3: tiền đề sai ⇒ mệnh đề kéo theo đúng.

Lỗi thường gặp: • Quan niệm sai chủ chốt: nghĩ P sai thì cả mệnh đề sai — bước hỏng: B3 • Nhầm số chẵn thì không nguyên tố — bước hỏng: B2' WHERE id = '18b3387a-01ed-4eae-b627-037bd15c2ef4';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bước B1 là VAN AN TOÀN — ép HS viết rõ x = ?, y = ? trước khi thay để chặn lỗi đảo.

Lỗi thường gặp: • ĐẢO x, y! Hậu quả: 2(4)+3(−1) = 5, 5 ≥ 10 SAI → kết luận NGƯỢC! • Sai số học — quên dấu âm • Nghĩ ≥ KHÔNG bao gồm dấu =' WHERE id = '198dfedb-fb85-4deb-8d43-c677f1c9d142';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B3 là điểm chết: {2;3} ở đây đóng vai PHẦN TỬ nên dùng ∈, KHÔNG dùng ⊂. Kí hiệu phụ thuộc VAI TRÒ, không phụ thuộc hình dạng.

Lỗi thường gặp: • Mở tung tập con thành các phần tử rời • Nhầm ''nằm trong'' (vật lí) với ''là phần tử của'' • Áp máy móc quy tắc ''tập thì dùng ⊂'' mà không kiểm vai trò' WHERE id = '19c8a2f8-eb29-45c5-812a-c4aa0b3307a0';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bước B2 là VAN AN TOÀN: nếu tổng 4 vùng ≠ sĩ số → chắc chắn ĐÃ TÍNH SAI!

Lỗi thường gặp: • QUÊN TRỪ 20 em học cả hai • Quên nhóm KHÔNG thuộc tập nào • Mất cơ hội phát hiện sai' WHERE id = '19dff594-3c1b-4196-b5bd-84328627ed85';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ để phác thảo chính xác đồ thị hàm bậc hai.

Lỗi thường gặp: • misc_nham_dau_dinh_voi_huong_parabol — nhầm lẫn giữa dấu của tung độ đỉnh với hướng của parabol, hai yếu tố hoàn toàn độc lập.' WHERE id = '1cb3f92b-0ef0-4d94-b236-977ecf88bfe1';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: đổi ∀ → ∃ và phủ định ''là số nguyên tố''. B2: cần một nhân chứng; n = 3 cho 10 (hợp số). B3: chứng minh được P̄ ⇒ P sai.

Lỗi thường gặp: • Quên đổi lượng từ ∀ → ∃ — bước hỏng: B1 • Chọn nhầm nhân chứng (2 là nguyên tố) — bước hỏng: B2' WHERE id = '225d2998-5624-415f-83e5-c055160f94ea';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Xử lý trường hợp đặc biệt khi có nghiệm kép (bình phương luôn không âm) trong bất phương trình tích.

Lỗi thường gặp: • misc_bo_sot_nghiem_kep_trong_bat_dang_thuc_khong_chat — bỏ sót điểm nghiệm kép (x=3) khi biểu thức bằng 0 tại đó, một điểm hợp lệ cho bất đẳng thức không chặt (≤0).' WHERE id = '2323ae68-8e4b-45dc-ba48-f1e0370eec1f';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Công thức tổng quát ''hiệu hai vectơ chung gốc'' là công cụ NỀN TẢNG để tính vectơ nối hai điểm bất kỳ, cả bằng hình học lẫn toạ độ.

Lỗi thường gặp: • misc_dao_nguoc_thu_tu_phep_tru — đảo ngược thứ tự của phép trừ hai vectơ (dùng AB−AC thay vì đúng phải là AC−AB), dẫn đến kết quả sai dấu hoàn toàn so với đáp án đúng.' WHERE id = '253ca8bd-47c9-4926-b061-844532cd3f90';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ xét dấu tam thức trong trường hợp có nghiệm kép.

Lỗi thường gặp: • misc_nham_nghiem_voi_khong_xac_dinh — nhầm lẫn giữa nghiệm (điểm mà f(x)=0) với điểm không xác định.' WHERE id = '2925c452-8c9d-49fa-b99f-2e0b2f48984f';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Ứng dụng thực tế: tìm giá bán tối ưu để lợi nhuận đạt giá trị lớn nhất.

Lỗi thường gặp: • misc_nham_dau_a_voi_loai_cuc_tri — nhớ ngược quy tắc: khi a<0 phải là giá trị LỚN NHẤT.' WHERE id = '2aeaf081-4f1e-4a0d-8c2b-17844faab488';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: tính chất hình vuông ✓. B2: hoán vị hai vế. B3: cần phản ví dụ cụ thể; hình chữ nhật là phản ví dụ chuẩn.

Lỗi thường gặp: • Không tìm phản ví dụ — bước hỏng: B3 • Nhầm đảo với phản đảo — bước hỏng: B2' WHERE id = '2bf0c721-b097-40ad-9aa1-8c66ac3e723a';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Kiểm tra TỪNG HÀNG một cách CÓ HỆ THỐNG để xác định CHÍNH XÁC ranh giới giữa các CHỮ SỐ CHẮC và KHÔNG CHẮC.

Lỗi thường gặp: • misc_so_sanh_sai_chieu_bat_dang_thuc — so sánh SAI chiều bất đẳng thức khi kiểm tra điều kiện (0,00006 THỰC RA LỚN HƠN 0,00005, không phải NHỎ HƠN), dẫn đến kết luận SAI về TÍNH CHẮC của chữ số ở hàng đó.' WHERE id = '332e740d-1143-467e-93a0-23b011248f02';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng công thức trọng tâm cho từng toạ độ (hoành độ, tung độ) một cách độc lập.

Lỗi thường gặp: • misc_chia_sai_mau_so_trong_tam — chia tổng ba toạ độ cho 2 (như công thức trung điểm) thay vì đúng phải chia cho 3 (vì trọng tâm liên quan đến BA điểm, không phải hai điểm như trung điểm), một lỗi nhầm lẫn công thức giữa trung điểm và trọng tâm.' WHERE id = '35a6653a-b48b-4e3a-a139-a992c4b68ce4';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình chuẩn chứng minh tính đơn điệu bằng định nghĩa cho hàm bậc nhất có hệ số góc âm.

Lỗi thường gặp: • misc_nham_dau_hieu_voi_ket_luan — tính đúng dấu của hiệu (âm) nhưng kết luận sai loại biến thiên, nhầm f(x2)<f(x1) (nghịch biến) thành đồng biến.' WHERE id = '38b104cc-c38a-4f18-8fd6-f65b252a9ce4';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ: tìm Q1, Q3 từ hai nửa, sau đó tính hiệu để có IQR.

Lỗi thường gặp: • misc_dao_nguoc_thu_tu_tru_iqr — đảo ngược THỨ TỰ phép TRỪ (dùng Q1−Q3 thay vì ĐÚNG phải là Q3−Q1), dẫn đến kết quả ÂM, VI PHẠM tính chất IQR LUÔN KHÔNG ÂM.' WHERE id = '391613b1-abab-4c8b-a162-cbc29e43152d';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Xác định đầy đủ các khoảng đơn điệu dựa trên các điểm đổi chiều của đồ thị.

Lỗi thường gặp: • misc_bo_sot_mot_khoang_nghich_bien — chỉ liệt kê một trong hai khoảng nghịch biến, bỏ sót khoảng còn lại sau điểm cực đại thứ hai.' WHERE id = '3abf63fb-b237-4629-8d31-d6affa98cf9a';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng đúng công thức Pythagoras cho trường hợp hai lực vuông góc, tính từng bước để tránh sai sót.

Lỗi thường gặp: • misc_tinh_sai_can_bac_hai — không thực hiện đúng phép khai căn bậc hai của 225, tính nhầm ra một giá trị khác (như 105, có thể do cộng nhầm 81+144 rồi không khai căn mà lấy luôn tổng chia một số nào đó không rõ căn cứ).' WHERE id = '3ef4aafe-bbb9-4831-8bc8-d11cd12d19d1';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Chứng minh chặt chẽ mối liên hệ giữa tích vô hướng bằng 0 (với hai vectơ khác không) và tính vuông góc của tam giác.

Lỗi thường gặp: • misc_khong_loai_truong_hop_suy_bien — không nhận ra rằng vì A, B, C là BA ĐỈNH của một TAM GIÁC (theo giả thiết bài toán), CHÚNG PHẢI PHÂN BIỆT, nên \(|\overrightarrow{AB}|\) và \(|\overrightarrow{AC}|\) CHẮC CHẮN khác 0 — không cần xét các trường hợp SUY BIẾN (vectơ-không) vốn KHÔNG THỂ xảy ra trong ngữ cảnh một TAM GIÁC hợp lệ.' WHERE id = '3f817e24-fca9-45f6-9bf5-f048f85f00cf';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Kiểm tra tổng TẦN SỐ (bước trung gian) để đảm bảo KHÔNG BỎ SÓT hoặc TÍNH SAI SỐ LƯỢNG giá trị, trước khi hoàn thành phép TÍNH TRUNG BÌNH.

Lỗi thường gặp: • misc_quen_nhan_voi_tan_so — QUÊN NHÂN mỗi giá trị với TẦN SỐ TƯƠNG ỨNG trước khi CỘNG, chỉ CỘNG các GIÁ TRỊ \(x_i\) MỘT LẦN (như thể mỗi giá trị chỉ xuất hiện ĐÚNG một lần), bỏ qua VAI TRÒ của TẦN SỐ trong công thức.' WHERE id = '43303a0f-4228-403b-bada-fc8a99620bc1';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Phân biệt việc hai vectơ có thể CÙNG HƯỚNG mà vẫn KHÔNG BẰNG NHAU nếu độ dài khác nhau.

Lỗi thường gặp: • misc_nham_cung_huong_voi_bang_nhau — nhầm lẫn điều kiện ''cùng hướng'' (chỉ là MỘT trong hai điều kiện cần) với ''bằng nhau'' (cần thêm điều kiện cùng độ dài), một lỗi phổ biến khi mới học khái niệm hai vectơ bằng nhau.' WHERE id = '4705b8fb-1bf6-4195-b5e6-557100c579a8';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B3 ép HS PHÁT BIỂU THÀNH LỜI vì sao ngoặc vuông/tròn tạo khác biệt. Nói được thì KHÔNG BAO GIỜ nhầm nữa.

Lỗi thường gặp: • Bỏ nhầm đầu mút (nhầm [ ] với ( )) • Lấy nhầm đầu mút • Học thuộc kí hiệu, không hiểu nghĩa' WHERE id = '482e1d9a-82e9-42a8-8f27-8ad45a535be6';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng liên tiếp quy tắc ba điểm cho một chuỗi nhiều vectơ nối tiếp nhau, kết quả cuối là vectơ nối điểm đầu tiên với điểm cuối cùng.

Lỗi thường gặp: • misc_lay_nham_vecto_cuoi_lam_ket_qua — nhầm lẫn cho rằng kết quả của một chuỗi cộng vectơ liên tiếp chỉ đơn giản là VECTƠ CUỐI CÙNG trong chuỗi, bỏ qua việc phải cộng dồn TẤT CẢ các vectơ theo đúng quy tắc ba điểm liên tiếp.' WHERE id = '4852eecb-bf11-4dcc-8935-33b73ee30378';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ giải phương trình chứa căn: đặt điều kiện, bình phương, giải, và kiểm tra lại nghiệm.

Lỗi thường gặp: • misc_thieu_dieu_kien_ve_phai — chỉ đặt điều kiện xác định của căn thức mà quên đặt thêm điều kiện vế phải phải không âm.' WHERE id = '48dc70d1-789b-445b-9421-8c0d186f83f2';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình TỪNG BƯỚC để TÍNH PHƯƠNG SAI TRỰC TIẾP từ ĐỊNH NGHĨA (độ lệch, bình phương, trung bình).

Lỗi thường gặp: • misc_tinh_sai_binh_phuong_so_am — TÍNH SAI bình phương của một số ÂM, cho rằng \((-2)^2=-4\) (một số ÂM) thay VÌ ĐÚNG phải là \((-2)^2=4\) (LUÔN KHÔNG ÂM), một lỗi TÍNH TOÁN CƠ BẢN về BÌNH PHƯƠNG số ÂM.' WHERE id = '4d3d89a7-e25c-411f-8c4b-a3a328d542b6';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bẫy tập rời: giao có thể = ∅.

Lỗi thường gặp: • NHẦM ∩ VỚI ∪ • Nhầm ∅ với {0} — bệnh B04' WHERE id = '4e940d90-3fce-4557-9e3d-8cda9848fb59';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'So sánh KHOẢNG BIẾN THIÊN giữa HAI bộ dữ liệu để đánh giá MỨC ĐỘ PHÂN TÁN TƯƠNG ĐỐI.

Lỗi thường gặp: • misc_nham_do_phan_tan_voi_muc_do_cao_thap — NHẦM LẪN giữa ''ĐỘ PHÂN TÁN'' (mức độ DAO ĐỘNG, KHÔNG ĐỀU) với ''MỨC ĐỘ CAO/THẤP'' (giá trị TUYỆT ĐỐI của điểm số), hai KHÁI NIỆM HOÀN TOÀN KHÁC NHAU — R LỚN HƠN CHỈ cho biết điểm PHÂN TÁN NHIỀU HƠN, KHÔNG cho biết điểm TRUNG BÌNH CAO HƠN hay THẤP HƠN.' WHERE id = '4ee56de7-39c9-4be0-bc74-a029d7f3389b';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Đây là một chứng minh HAI CHIỀU (khi và chỉ khi — ''nếu và chỉ nếu''), cần kiểm tra CẢ HAI chiều suy luận.

Lỗi thường gặp: • misc_bo_qua_chieu_nguoc_lai — bỏ qua việc cần chứng minh CẢ HAI chiều của một phát biểu dạng ''khi và chỉ khi'', chỉ chứng minh MỘT chiều rồi coi là đã hoàn thành, một lỗi logic cơ bản khi làm việc với các mệnh đề tương đương.' WHERE id = '51b56f43-e7ab-43c0-8ee8-4fa05c7c847a';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Ứng dụng công thức khoảng cách để kiểm chứng tính chất hình học (tam giác đều) của một hình cho bởi toạ độ.

Lỗi thường gặp: • misc_tinh_sai_binh_phuong_can_thuc — tính sai bình phương của biểu thức chứa căn thức \(3\sqrt{3}\), nhầm \((3\sqrt{3})^2=9\times3=27\) thành một giá trị khác (như chỉ lấy 9), dẫn đến kết quả cuối cùng sai.' WHERE id = '52a0cd81-5550-4438-8346-d8628b08e838';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Ứng dụng dạng đỉnh để mô hình hoá quỹ đạo chuyển động ném.

Lỗi thường gặp: • misc_tinh_sai_binh_phuong — tính sai (0−2)²=4 thành 2.' WHERE id = '55bf42de-da0b-47dc-bbd0-b3a070bd317b';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'So sánh độ hẹp/rộng của các parabol dựa trên giá trị tuyệt đối của hệ số a, không phụ thuộc vào dấu.

Lỗi thường gặp: • misc_nham_dau_am_voi_do_hep — cho rằng dấu âm của hệ số a tự động làm cho parabol hẹp hơn, không nhận ra chỉ giá trị tuyệt đối mới quyết định độ hẹp/rộng.' WHERE id = '55fa3c8d-0987-4d55-83dd-05704e0843fa';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Thực hiện ĐẦY ĐỦ QUY TRÌNH: SẮP XẾP, TÌM Q2, CHIA THÀNH HAI NỬA, rồi TÌM Q1 và Q3 từ MỖI nửa TƯƠNG ỨNG.

Lỗi thường gặp: • misc_lay_sai_gia_tri_chinh_giua_cua_nua — LẤY SAI HAI GIÁ TRỊ để TÍNH TRUNG VỊ của NỬA DƯỚI (chọn HAI GIÁ TRỊ ĐẦU thay vì ĐÚNG phải là HAI GIÁ TRỊ Ở CHÍNH GIỮA của NỬA đó), một lỗi XÁC ĐỊNH SAI VỊ TRÍ.' WHERE id = '564025f4-11c2-482a-baeb-ed95a2d53f64';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bước B2 rèn phản xạ LUÔN đối chiếu nghiệm với tập xác định — sẽ dùng ở Q08.

Lỗi thường gặp: • Ra nghiệm x = −2, −3 (sai dấu khi tách thừa số) • Bỏ bước kiểm tập xác định — sẽ hỏng khi đề đổi sang ℕ • Nhầm cách viết: liệt kê GIÁ TRỊ, không phải phương trình' WHERE id = '5aec9b90-6a32-44a5-abc2-a032bafd5ca8';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng điều kiện vectơ của hình bình hành (một cặp cạnh đối bằng nhau) để tìm toạ độ đỉnh còn thiếu.

Lỗi thường gặp: • misc_nham_thu_tu_dinh_hinh_binh_hanh — nhầm lẫn THỨ TỰ các đỉnh khi viết điều kiện vectơ cho hình bình hành ABDC, dùng \(\overrightarrow{DC}\) thay vì đúng phải là \(\overrightarrow{CD}\) (dựa theo cách đặt tên đỉnh liên tiếp của tứ giác ABDC), dẫn đến toạ độ D bị tính sai.' WHERE id = '5e6dbb90-58d3-4a18-9817-26830b74d6cd';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Từ bảng giá trị suy ra dạng đồ thị và tính chất biến thiên.

Lỗi thường gặp: • misc_nham_dau_khi_thay_gia_tri_am — tính sai −(−1)+4, nhầm dấu khi thay giá trị âm vào biểu thức có dấu trừ phía trước biến.' WHERE id = '5ff18e93-0c0f-4406-89d4-2ea79b1fe632';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Câu này gộp CẢ HAI điểm nguy hiểm: B1 bắt lỗi miền âm, B2 bắt lỗi SỐ 0.

Lỗi thường gặp: • Quên miền âm khi khai căn — bỏ mất nửa âm • BỎ SÓT SỐ 0 • Bỏ sót một trong hai (0 hoặc −2)' WHERE id = '60389747-7317-483b-8968-fdb670a7157b';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ giải phương trình chứa hai căn bậc hai bằng nhau, kèm bước kiểm tra điều kiện cho từng nghiệm.

Lỗi thường gặp: • misc_bo_qua_kiem_tra_mot_nghiem — bỏ qua bước kiểm tra điều kiện cho một trong hai nghiệm tìm được, giả định nó hiển nhiên đúng mà không xác minh.' WHERE id = '603cf2ff-48a4-4dce-8673-e75a5ad398f6';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng ĐẦY ĐỦ quy trình: tính IQR, tính CẬN, rồi SO SÁNH giá trị NGHI NGỜ với CẬN để KẾT LUẬN.

Lỗi thường gặp: • misc_so_sanh_voi_q3_thay_vi_can_tren — SO SÁNH giá trị NGHI NGỜ với Q3 (thay VÌ ĐÚNG phải SO SÁNH với CẬN TRÊN=Q3+1,5×IQR), một lỗi BỎ QUA HỆ SỐ 1,5×IQR TRONG QUY TẮC XÁC ĐỊNH BẤT THƯỜNG.' WHERE id = '62ee8de6-66f8-4ab7-8626-7923de17b4fe';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: tính trực tiếp. B2: nguyên tắc — thử vài trường hợp không chứng minh được ∀. B3: phân tích n(n+1); hai số liên tiếp luôn có đúng một số chẵn.

Lỗi thường gặp: • Nhầm kiểm chứng với chứng minh — bước hỏng: B2 • Không nghĩ tới phân tích thừa số — bước hỏng: B3' WHERE id = '643a2a32-161e-4fa3-8ff2-334fb6ef3059';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'So sánh RỦI RO ''TƯƠNG ĐỐI'' (dùng CV) thay VÌ chỉ SO SÁNH ĐỘ LỆCH CHUẨN TUYỆT ĐỐI, khi HAI đại LƯỢNG có MỨC TRUNG BÌNH KHÁC NHAU ĐÁNG KỂ.

Lỗi thường gặp: • misc_so_sanh_truc_tiep_do_lech_chuan_bo_qua_cv — SO SÁNH TRỰC TIẾP ĐỘ LỆCH CHUẨN TUYỆT ĐỐI (bỏ QUA sự KHÁC BIỆT về MỨC TRUNG BÌNH giữa HAI cổ phiếu), dẫn đến KẾT LUẬN NGƯỢC với KẾT QUẢ ĐÚNG khi dùng CV (thước đo RỦI RO TƯƠNG ĐỐI phù hợp hơn trong trường hợp này).' WHERE id = '7273a5e5-d4d3-47fe-99b6-f17bc224668f';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ vẽ đồ thị hàm bậc hai từ bảng giá trị, xác định các điểm đặc biệt trước khi nối.

Lỗi thường gặp: • misc_noi_diem_bang_duong_gap_khuc — nối các điểm của hàm bậc hai bằng đường gấp khúc (các đoạn thẳng) thay vì đường cong mượt phù hợp với bản chất liên tục của hàm bậc hai.' WHERE id = '743be688-bef9-40bb-85a2-2f87f5200222';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: thay x = 2 → 4 = 4 ✓. B2: x = −2 cho x² = 4 nhưng x ≠ 2 → chiều đảo sai. B3: chỉ có chiều thuận → P đủ, KHÔNG cần và đủ.

Lỗi thường gặp: • Quên nghiệm âm — bước hỏng: B2 • Kết luận tương đương dù chiều đảo sai — bước hỏng: B3' WHERE id = '78b056f7-f2af-4b2b-b878-bbc7cf131c99';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B3 là bước QUAN TRỌNG NHẤT: nó hỏi VÌ SAO công thức đúng. HS trả lời được sẽ KHÔNG BAO GIỜ quên ∅ — vì ''KHÔNG chọn phần tử nào'' cũng là một lựa chọn hợp lệ → cho ra ∅!

Lỗi thường gặp: • LỖI ③: quên ∅ và {x;y} • Bỏ sót một (thường là ∅) • Học thuộc công thức, không hiểu' WHERE id = '7c7b14e5-1e90-4070-a6cc-9dae3979f2ac';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Ứng dụng quy tắc hình bình hành (trường hợp đặc biệt vuông góc, dùng Pythagoras) để tính lực tổng hợp của hai lực không cùng phương.

Lỗi thường gặp: • misc_cong_truc_tiep_do_lon_khi_khong_cung_phuong — cộng trực tiếp hai độ lớn của lực như thể chúng cùng phương, bỏ qua việc hai lực VUÔNG GÓC cần dùng công thức Pythagoras (quy tắc hình bình hành) thay vì cộng đại số đơn giản.' WHERE id = '7dbcc2fd-266d-4fae-a460-8ed9bb8b865e';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Đây là ĐỊNH NGHĨA hình bình hành nên hai chiều hiển nhiên đúng → tương đương.

Lỗi thường gặp: • Nhầm — hình thang chỉ có MỘT cặp cạnh song song; bước hỏng: B2 • Bỏ chiều đảo dù đã chứng minh — bước hỏng: B3' WHERE id = '80bf4fc6-8735-4bf2-af95-e11d81a81b8e';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Công thức |A∪B| = |A|+|B|−|A∩B| là bàn đạp sang D06.

Lỗi thường gặp: • Viết LẶP • Tính GIAO thay vì hợp • Đếm trùng: 3 + 4 = 7' WHERE id = '8504056f-dead-4923-9a82-1d267d1f0079';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Thực hiện ĐẦY ĐỦ BA BƯỚC: SẮP XẾP, XÁC ĐỊNH VỊ TRÍ, TÍNH TRUNG VỊ theo ĐÚNG QUY TẮC (n CHẴN hay LẺ).

Lỗi thường gặp: • misc_xac_dinh_sai_vi_tri_chinh_giua — XÁC ĐỊNH SAI HAI VỊ TRÍ chính GIỮA khi n CHẴN (chọn VỊ TRÍ 2 và 5 thay vì ĐÚNG phải là VỊ TRÍ n/2=3 và n/2+1=4), một lỗi TÍNH SAI CÔNG THỨC xác định VỊ TRÍ.' WHERE id = '865fb81c-8e10-4cb8-924a-d575f515e52d';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Kiểm tra tính HỢP LỆ của một độ chính xác đã báo cáo bằng cách so sánh với sai số THỰC (khi biết được, dùng để kiểm chứng).

Lỗi thường gặp: • misc_khong_kiem_tra_dieu_kien_delta_le_d — không kiểm tra ĐÚNG điều kiện cần thiết (\(\Delta a\le d\)) để một độ chính xác được coi là HỢP LỆ, chỉ đánh giá dựa trên cảm tính ''gần với giá trị đo được'' mà không có căn cứ toán học chặt chẽ.' WHERE id = '87e6e672-1e08-417d-9e19-0e6e76e71aba';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Giữ NHIỀU chữ số trong các bước TRUNG GIAN, chỉ QUY TRÒN ở bước CUỐI CÙNG để giảm TÍCH LUỸ sai số.

Lỗi thường gặp: • misc_quy_tron_som_o_buoc_trung_gian — QUY TRÒN QUÁ SỚM ở BƯỚC TRUNG GIAN (thay vì GIỮ NHIỀU chữ số), làm TÍCH LUỸ THÊM SAI SỐ qua các bước TÍNH TOÁN tiếp theo, dẫn đến kết quả CUỐI CÙNG KÉM CHÍNH XÁC hơn so với cách làm ĐÚNG.' WHERE id = '90514827-2d93-43a7-9230-21b3280ec716';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Đây là một minh chứng ĐẸP cho thấy ĐỊNH LÝ PYTHAGORAS THỰC CHẤT là một TRƯỜNG HỢP ĐẶC BIỆT của công thức TÍNH ĐỘ DÀI QUA TÍCH VÔ HƯỚNG, khi hai vectơ THÀNH PHẦN VUÔNG GÓC với nhau.

Lỗi thường gặp: • misc_nham_cong_thuc_tong_thanh_hieu — sử dụng SAI công thức khai triển, dùng công thức của \((\vec{a}+\vec{b})\cdot(\vec{a}+\vec{b})\) (với dấu CỘNG ở số hạng giữa) thay vì đúng phải là công thức của HIỆU \((\vec{a}-\vec{b})\cdot(\vec{a}-\vec{b})\) (với dấu TRỪ), một lỗi có thể không ảnh hưởng kết quả cuối trong trường hợp NÀY (vì tích vô hướng =0) nhưng SẼ gây SAI SỐ trong trường hợp KHÁC nếu tích vô hướng khác 0.' WHERE id = '9118068f-8e94-45a3-97cf-68e7ed9d6c2e';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Xác định hàng quy tròn PHÙ HỢP dựa trên độ chính xác đã cho, rồi thực hiện quy tròn theo đúng quy tắc.

Lỗi thường gặp: • misc_nham_hang_quy_tron_theo_do_chinh_xac — nhầm lẫn giữa GIÁ TRỊ của độ chính xác (d=0,01, tương ứng HÀNG PHẦN TRĂM) với một HÀNG KHÁC (phần chục), không xác định ĐÚNG mối liên hệ giữa GIÁ TRỊ d và HÀNG cần quy tròn tương ứng.' WHERE id = '913d4fe2-6cca-4169-b6ff-d9f2cfe56501';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: Δ = b² − 4ac. B2: Δ = −4 < 0 → không có nghiệm thực. B3: ∃ sai ⇒ phủ định của nó (∀ với tính chất ngược) là đúng.

Lỗi thường gặp: • Sai dấu trong công thức Δ — bước hỏng: B1 • Đề hỏi x ∈ R — bước hỏng: B3' WHERE id = '935e0602-bbf0-48a4-820d-95646fc7c1bc';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: thay số trực tiếp; chú ý P(0) là 0 < 0 → sai (không phải đúng). B2: chỉ n = 1 (với n ≥ 3, n² > 2n). B3: chưa gán biến thì chưa có chân lí xác định.

Lỗi thường gặp: • Nhầm ''0 < 0'' là đúng — lỗi so sánh nghiêm ngặt vs không nghiêm ngặt; bước hỏng: B1 • Nhầm ''4 < 4'' là đúng — bước hỏng: B1 • Nhầm mệnh đề chứa biến là mệnh đề; bước hỏng: B3' WHERE id = '96f5a8e8-7342-4371-87d8-44c1d200e1cd';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Phân tích ĐẶC ĐIỂM của TỪNG bộ dữ liệu (LOẠI dữ liệu, có NGOẠI LỆ hay KHÔNG) TRƯỚC KHI đề XUẤT thước đo PHÙ HỢP.

Lỗi thường gặp: • misc_ap_dung_trung_binh_cho_moi_loai_du_lieu — ĐỀ XUẤT dùng TRUNG BÌNH cho CẢ HAI bộ dữ liệu MÀ KHÔNG XÉT đến ĐẶC ĐIỂM RIÊNG của TỪNG bộ (bộ A có NGOẠI LỆ nên TRUNG VỊ PHÙ HỢP hơn; bộ B là dữ liệu ĐỊNH TÍNH nên TRUNG BÌNH KHÔNG THỂ áp DỤNG được).' WHERE id = '974fcfa6-483d-491d-86a0-1cb909602bef';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'MẸO KIỂM HƯỚNG: thử x = 5 → 5 ≥ 3 ✓ ĐÚNG → điểm 5 PHẢI được tô. Số 5 nằm bên PHẢI số 3 ⇒ tô sang PHẢI.

Lỗi thường gặp: • LỖI ② • LỖI ①: quên dấu = trong ≥ • LỖI ③: nhầm chiều bất phương trình' WHERE id = '980e66c1-e5b9-4214-9825-f656ccccedf5';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B3 chẩn đoán: HS làm đúng B1, B2 (hiểu là vô nghiệm) mà vẫn viết sai kí hiệu → lỗi NHẸ, chỉ cần nhắc kí hiệu. Sai B2 → lỗ hổng đại số nền, nặng hơn.

Lỗi thường gặp: • Sai dấu khi chuyển vế • Nhầm x² = −4 với x = −2 (lỗi đại số nghiêm trọng) • Quan niệm sai ① hoặc ②' WHERE id = '9a5b55e3-fe66-46f6-941d-452588ee0479';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1, B2: dùng kí hiệu chuẩn. B3: định nghĩa hình chữ nhật = tứ giác 4 góc vuông → hai chiều tương đương.

Lỗi thường gặp: • Nhầm mệnh đề đảo với phủ định hai vế — bước hỏng: B2 • Không nhận ra đây là định nghĩa (tương đương) — bước hỏng: B3' WHERE id = 'a95296e3-5ac7-42aa-a896-0195ea72aa97';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'So sánh độ chính xác giữa hai phép đo có QUY MÔ RẤT KHÁC NHAU, minh hoạ tại sao SAI SỐ TƯƠNG ĐỐI là công cụ SO SÁNH phù hợp hơn SAI SỐ TUYỆT ĐỐI.

Lỗi thường gặp: • misc_dung_sai_so_tuyet_doi_de_so_sanh_khac_quy_mo — dùng SAI SỐ TUYỆT ĐỐI (thay vì SAI SỐ TƯƠNG ĐỐI) để SO SÁNH độ chính xác giữa HAI PHÉP ĐO có QUY MÔ (độ lớn) HOÀN TOÀN KHÁC NHAU, dẫn đến kết luận SAI LẦM (ngược với kết quả ĐÚNG khi dùng sai số tương đối).' WHERE id = 'ab21e525-ea64-44f0-b60b-fa8b1f08aa5f';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: √2 không viết được dạng m/n tối giản → vô tỉ → P sai. B2: giữ chủ thể, phủ định tính chất. B3: quy tắc đảo chân lí → P̄ đúng.

Lỗi thường gặp: • Nhầm √2 là hữu tỉ (vì bấm máy ra số thập phân) — bước hỏng: B1 • Không áp dụng quy tắc đảo chân lí — bước hỏng: B3' WHERE id = 'adf10bfc-0e57-44e1-81ba-52f48922d2e5';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Kiểm chứng cụ thể tính chất phân phối của tích vô hướng bằng một ví dụ số cụ thể.

Lỗi thường gặp: • misc_nham_phep_cong_thanh_nhan_o_buoc_cuoi — sau khi tính đúng các tích thành phần (1×3=3 và 2×3=6), lại NHÂN hai kết quả này với nhau (3×2=6) thay vì CỘNG chúng lại (3+6=9) theo đúng công thức tích vô hướng.' WHERE id = 'b06559a6-a755-4e89-975f-7361d6972eb9';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Nhận diện TRƯỜNG HỢP mẫu có NHIỀU HƠN MỘT MỐT khi CÓ NHIỀU giá trị CÙNG đạt TẦN SỐ LỚN NHẤT.

Lỗi thường gặp: • misc_chi_chon_mot_mot_khi_co_nhieu_gia_tri_bang_tan_so — CHỈ CHỌN MỘT giá trị làm MỐT khi CÓ NHIỀU giá trị CÙNG đạt TẦN SỐ LỚN NHẤT, không NHẬN RA rằng mẫu số liệu CÓ THỂ có NHIỀU HƠN MỘT MỐT (SONG MỐT hoặc ĐA MỐT) trong TRƯỜNG HỢP này.' WHERE id = 'b4c22600-737d-4e49-b566-b3adaa80c8a6';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình chuẩn xác định khoảng đơn điệu của hàm bậc hai.

Lỗi thường gặp: • misc_dao_nguoc_khoang_don_dieu — đảo ngược hoàn toàn hai khoảng đồng biến/nghịch biến so với dấu thực của hệ số a.' WHERE id = 'b6f7e13d-5732-4c81-bdd0-255224360270';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng QUY TRÌNH TƯƠNG TỰ như TÌM TRUNG VỊ, nhưng với VỊ TRÍ TƯƠNG ỨNG của TỨ PHÂN VỊ (n/4 cho Q1).

Lỗi thường gặp: • misc_nham_cong_thuc_vi_tri_q1_voi_q2 — NHẦM LẪN công THỨC xác định VỊ TRÍ của Q1 (thường ước LƯỢNG bằng n/4) với CÔNG THỨC của Q2/TRUNG VỊ (n/2), dẫn đến XÁC ĐỊNH SAI VỊ TRÍ cần TÌM.' WHERE id = 'b924d57b-2c5c-41e1-a575-a119ecd64fc0';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'BƯỚC B3 LÀ TRÁI TIM: không có B3 → miền là NỬA MẶT PHẲNG VÔ HẠN (lan cả sang chỗ x < 0!). Có B3 → miền là TAM GIÁC HỮU HẠN ✓. Khác biệt SỐNG CÒN! KIỂM CHỨNG: (5;2) [trong tam giác]: 20(5)+25(2) = 150 ≤ 200 ✓, 5 ≥ 0 ✓, 2 ≥ 0 ✓ ⇒ KHẢ THI ✓ | (−2;5): 20(−2)+25(5) = 85 ≤ 200 ✓ NHƯNG x = −2 < 0 ⇒ VÔ LÍ! ✓

Lỗi thường gặp: • Ghép nhầm hệ số • Đảo chiều • BỆNH CHÍNH! Miền sẽ lan sang góc phần tư âm! • Miền KHÔNG PHẢI tam giác mà là nửa mp vô hạn ✗' WHERE id = 'c2aed290-d72c-49e2-9dce-ef5c757dc483';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Phân biệt giữa việc CÓ CÙNG ĐỘ DÀI (chỉ là một điều kiện) với việc BẰNG NHAU (cần cả cùng hướng và cùng độ dài).

Lỗi thường gặp: • misc_nham_cung_do_dai_voi_bang_nhau — nhầm lẫn điều kiện ''cùng độ dài'' (chỉ là một trong hai điều kiện cần) với ''bằng nhau'' (cần thêm điều kiện cùng hướng), một lỗi phổ biến khi mới học khái niệm vectơ.' WHERE id = 'c3dff655-1547-4fe1-8ea4-39964165d9b4';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'HỆ QUẢ: ∪ và ∩ kết hợp → viết A∪B∪C hay A∩B∩C không cần ngoặc. NHƯNG A ∩ B ∪ C thì VẪN CẦN NGOẶC (trộn hai phép khác nhau)!

Lỗi thường gặp: • Vi phạm quy ước không lặp • Không thấy ý nghĩa: không cần ngoặc' WHERE id = 'c6a35b9e-2202-41dd-9700-4c56c96ef990';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Kết hợp công thức trung điểm và tính chất tỉ lệ của trọng tâm trên đường trung tuyến để phân tích \(\overrightarrow{AG}\).

Lỗi thường gặp: • misc_nham_ti_le_2_1_thanh_phan_so — nhầm lẫn tỉ lệ 2:1 (nghĩa là AG bằng 2/3 của AM, vì AG:GM=2:1 nên AG chiếm 2 phần trong tổng 3 phần) với phân số 1/2, một lỗi chuyển đổi tỉ lệ sang phân số không chính xác.' WHERE id = 'c8261151-183f-46d0-89ba-0766069e05de';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình đầy đủ: tính TRUNG BÌNH trước, sau đó tính ĐỘ LỆCH, BÌNH PHƯƠNG, NHÂN với TẦN SỐ, rồi CHIA cho TỔNG TẦN SỐ.

Lỗi thường gặp: • misc_quen_nhan_tan_so_khi_tinh_trung_binh_truoc — khi TÍNH TRUNG BÌNH (bước ĐẦU TIÊN cần thiết TRƯỚC khi tính PHƯƠNG SAI), QUÊN NHÂN mỗi giá trị với TẦN SỐ TƯƠNG ỨNG, chỉ TÍNH TRUNG BÌNH ĐƠN GIẢN của HAI giá trị (5,8) mà KHÔNG XÉT đến TẦN SỐ, dẫn đến SAI NGAY TỪ BƯỚC ĐẦU và ẢNH HƯỞNG đến TOÀN BỘ các bước SAU.' WHERE id = 'ca01617f-9b1e-4a63-81c6-989676cd57f0';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Sử dụng bảng giá trị để kiểm chứng thực nghiệm tính đối xứng đã biết bằng lý thuyết.

Lỗi thường gặp: • misc_tinh_sai_dan_den_ket_luan_sai_ve_doi_xung — tính sai một trong các giá trị hàm số, dẫn đến kết luận sai rằng bảng giá trị không khớp với tính đối xứng lý thuyết.' WHERE id = 'cb1ce630-ea53-4c62-9520-71fd9943fb53';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1 và B2 đều có ''cửa ải'': B1 — phát hiện ''chỉ được 1 điểm'' → phải lấy điểm phụ. B2 — phát hiện ''O trên bờ'' → phải đổi điểm thử. Bỏ qua BẤT KỲ cửa nào cũng hỏng bài. KIỂM CHỨNG: (4;1) [cùng nửa với (1;0)]: 4 − 2(1) = 2 ≥ 0 ✓ | (0;3) [nửa bên kia]: 0 − 6 = −6 ≥ 0? ✗ ✓

Lỗi thường gặp: • Cho x=0 và y=0 đều ra O ⇒ nghĩ không vẽ được (không nghĩ ra lấy điểm phụ) • Bệnh A03 • BỆNH CHÍNH — bỏ qua bước kiểm! • TÔ NGƯỢC (bệnh A04)' WHERE id = 'cc658802-7b43-432b-ae5f-5cbaf8edddee';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: với x > 2 thì x² > 4 ✓. B2: phải xét cả số ÂM — x = −3 cho x² = 9 > 4 nhưng x không > 2. B3: chỉ chiều thuận → đủ, không cần và đủ.

Lỗi thường gặp: • Quên miền âm khi khai căn — bước hỏng: B2 • Kết luận tương đương dù chiều đảo sai — bước hỏng: B3' WHERE id = 'ceef538d-26db-4f4e-9aa0-a74a8ac176b6';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Đây là một ví dụ kinh điển minh hoạ rằng CÙNG HƯỚNG không đủ để kết luận BẰNG NHAU nếu thiếu điều kiện cùng độ dài.

Lỗi thường gặp: • misc_nham_lien_quan_hinh_hoc_voi_bang_nhau — cho rằng vì hai vectơ liên quan mật thiết về mặt hình học (một là đường trung bình của tam giác chứa cạnh kia) nên chúng phải bằng nhau, bỏ qua điều kiện quan trọng về ĐỘ DÀI (MN chỉ bằng nửa BC, không bằng nhau).' WHERE id = 'cf404add-081f-4803-b248-9827a845866c';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng công thức tam thức bậc hai có tham số để tìm điều kiện đặc biệt.

Lỗi thường gặp: • misc_giai_sai_phuong_trinh_tim_tham_so — giải sai phương trình bậc nhất theo m, nhầm dấu khi chuyển vế.' WHERE id = 'cf6cf8ff-7d1d-4615-b465-b33c331bc7d7';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: Δ = b² − 4ac = 1 − 4 = −3. B2: Δ < 0 → vô nghiệm trên R. B3: mệnh đề ∃ sai khi không có giá trị nào thoả.

Lỗi thường gặp: • Sai dấu công thức biệt thức — bước hỏng: B1 • Nhầm nghiệm phức với nghiệm thực; đề hỏi x ∈ R — bước hỏng: B3' WHERE id = 'cfd8904b-68a2-4171-9de4-682040ff48bd';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình chuẩn: kiểm tra miền xác định, tính f(−x), so sánh với f(x) và −f(x).

Lỗi thường gặp: • misc_so_sanh_sai_khi_ket_luan — so sánh nhầm h(−x) với −h(x) mà không tính toán cẩn thận, dẫn đến kết luận sai là hàm lẻ.' WHERE id = 'd2764679-68ac-409a-a2b6-6329a75db7d7';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Ứng dụng hàm bậc nhất để mô hình hoá và giải bài toán về lượng nước theo thời gian.

Lỗi thường gặp: • misc_quen_chuyen_ve_hang_so — khi giải phương trình, quên chuyển hằng số 200 sang vế còn lại trước khi chia để tìm x.' WHERE id = 'd520129d-d9e6-417d-a1b9-0f473cac4170';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng công thức ngược để tìm góc từ tích vô hướng đã biết, sau đó kiểm tra tính nhất quán giữa dấu tích vô hướng và loại góc.

Lỗi thường gặp: • misc_nham_dau_cos_voi_loai_goc — nhầm lẫn rằng \(\cos\theta\) ÂM tương ứng với GÓC NHỌN, trong khi thực chất \(\cos\theta\) ÂM (khi \(90°<\theta<180°\)) tương ứng với GÓC TÙ, còn \(\cos\theta\) DƯƠNG mới tương ứng với GÓC NHỌN.' WHERE id = 'd92158be-8e0a-4dba-aea7-fb418eb96593';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Tính sai số tuyệt đối rồi liên hệ với sai số TƯƠNG ĐỐI (tỉ lệ phần trăm) để đánh giá độ chính xác một cách có ý nghĩa hơn.

Lỗi thường gặp: • misc_quen_gia_tri_tuyet_doi — quên lấy GIÁ TRỊ TUYỆT ĐỐI khi tính sai số, để lại kết quả ÂM, vi phạm định nghĩa cơ bản rằng sai số tuyệt đối LUÔN KHÔNG ÂM.' WHERE id = 'dcf235d6-7097-468b-8f6c-060cce0cc2cb';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Xác định góc giữa hai vectơ trong cả trường hợp CHUNG GỐC và KHÔNG CHUNG GỐC (cần dựng lại vectơ).

Lỗi thường gặp: • misc_khong_chung_goc_thi_khong_xac_dinh_duoc_goc — cho rằng góc giữa hai vectơ CHỈ có thể xác định khi chúng CHUNG điểm đầu sẵn, không nhận ra rằng LUÔN có thể ''DỰNG LẠI'' một trong hai vectơ (dùng phép dựng vectơ bằng nhau) để đưa về chung gốc, từ đó xác định được góc.' WHERE id = 'e1234ef6-4fe3-44b5-b21e-efa3550ad280';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bài toán tổng hợp: mô hình hoá, lập bất phương trình, giải và đối chiếu với ràng buộc thực tế.

Lỗi thường gặp: • misc_dao_nguoc_khoang_nghiem_ung_dung — đảo ngược khoảng nghiệm của bất phương trình bậc hai.' WHERE id = 'e293d988-4591-4130-a99c-b0aab2a680f1';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'BƯỚC B2 — LẬP BẢNG là BẮT BUỘC! Tính nhẩm dễ nhầm, dễ bỏ sót đỉnh. Bảng giúp: ① thấy ĐỦ đỉnh ② so sánh trực quan ③ dễ kiểm lại. KIỂM CHỨNG — thử điểm GIỮA miền: (1;1): F = 3(1) + 1 = 4 ⇒ 4 < 12 ✓ KHÔNG vượt GTLN! (khớp định lí — max ở ĐỈNH!) | (2;1): F = 3(2) + 1 = 7 ⇒ 7 < 12 ✓ ⇒ Mọi điểm trong miền đều ≤ 12 — xác nhận GTLN = 12 ✓

Lỗi thường gặp: • Bỏ sót đỉnh (bệnh B05-②) • Lấy đỉnh sai (bệnh B05-①) • Quên nhân hệ số! • NHẦM MAX VỚI MIN!' WHERE id = 'e42ee9c4-f0ef-4f41-924e-05385b02d0d4';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: 91 lẻ, không chia hết 2,3,5; thử 7: 91 : 7 = 13 ✓. B2: có ước khác 1 và chính nó → hợp số → P sai. B3: đảo chân lí → P̄ đúng.

Lỗi thường gặp: • Chỉ thử 2, 3, 5 rồi kết luận — bỏ sót ước 7; bước hỏng: B1 • Không áp dụng quy tắc đảo chân lí; bước hỏng: B3' WHERE id = 'e4b9cb76-a887-4ae2-a9ac-6ce357e2c658';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Kết hợp đồng thời điều kiện của cả hai căn thức trong phương trình.

Lỗi thường gặp: • misc_dung_hop_thay_vi_giao — dùng phép HỢP thay vì đúng phải là phép GIAO khi kết hợp điều kiện của nhiều căn thức, dẫn đến kết quả sai (toàn bộ R thay vì một đoạn hữu hạn).' WHERE id = 'eb0b0225-c037-40fd-87bd-a1cef3cbc1e2';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng điều kiện vuông góc theo toạ độ để tìm tham số, kèm bước kiểm tra lại kết quả.

Lỗi thường gặp: • misc_nham_dau_khi_chuyen_ve — nhầm dấu khi chuyển số hạng 12 sang vế phải của phương trình, tính \(3m=12\) thay vì đúng phải là \(3m=-12\), dẫn đến kết quả sai dấu hoàn toàn.' WHERE id = 'eb7fd5b8-ce8a-41a4-8c39-8c65acdb03ae';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình chuẩn: VẼ, KHÔNG TÍNH NHẨM.

Lỗi thường gặp: • Bệnh C03 — nhầm chấm đặc/rỗng • Nhầm ∩ với ∪ • SAI ĐẦU MÚT' WHERE id = 'ebd841c6-51c4-4a45-9be4-806a2eddf276';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng điều kiện hai vectơ bằng nhau theo toạ độ (so sánh từng thành phần tương ứng).

Lỗi thường gặp: • misc_so_sanh_cheo_toa_do — so sánh CHÉO các thành phần toạ độ (hoành độ của vectơ này với tung độ của vectơ kia), thay vì so sánh ĐÚNG các thành phần TƯƠNG ỨNG (hoành độ với hoành độ, tung độ với tung độ).' WHERE id = 'edca5ddb-97ed-46be-85f4-7b155eb5619a';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình chuẩn ba bước tính đỉnh và trục đối xứng của parabol.

Lỗi thường gặp: • misc_nham_hoanh_do_voi_tung_do — sau khi tính đúng, lại ghi nhầm giá trị tung độ đỉnh trùng với hoành độ đỉnh.' WHERE id = 'ee631f87-1c81-4d96-9816-0a92e9e6377b';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: x² = 4 ⇒ x = ±2 ⇒ |x| = 2 ✓. B2: |x| = 2 ⇒ x = 2 hoặc x = −2 ⇒ x² = 4 ✓. B3: tương đương.

Lỗi thường gặp: • Bỏ sót nghiệm âm — bước hỏng: B1 • Bỏ chiều đảo dù đã chứng minh — bước hỏng: B3' WHERE id = 'f239fa41-598c-4e18-a721-857a5837f4e0';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Bước B1 KHÓ NHẤT — CHỌN ẨN. Đề nói về TRANG IN, nhưng ẩn lại là SỐ PHÚT chạy máy! (Vì ta ĐIỀU KHIỂN được thời gian chạy máy, còn số trang là KẾT QUẢ). AI Tutor hỏi: ''Em ĐIỀU KHIỂN được cái gì? Đó chính là ẩn!'' KIỂM CHỨNG: (30;20): 30(30) + 20(20) = 900 + 400 = 1300 ≥ 1200 ✓ ĐẠT ✓ | (20;20): 600 + 400 = 1000 ≥ 1200? ✗ KHÔNG ĐẠT ✓

Lỗi thường gặp: • SAI ẨN! Đề hỏi về THỜI GIAN chạy máy, không phải số trang • GHÉP NHẦM! • ĐẢO CHIỀU! (''ít nhất'' ⇒ ≥) • Bỏ mất dấu = (''ít nhất 1200'' nghĩa là đúng 1200 vẫn ĐẠT!)' WHERE id = 'f27c9f4f-e02f-4b4d-bccf-7670849e21c4';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Xác định đúng công thức tương ứng với từng khoảng giá trị của x trước khi tính toán.

Lỗi thường gặp: • misc_ap_dung_nham_cong_thuc_theo_khoang — áp dụng sai công thức tương ứng với từng khoảng giá trị của x, dùng công thức của x≥0 cho trường hợp x<0.' WHERE id = 'f43fd492-5993-4dcd-ab96-d18246a3ce68';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Áp dụng lần lượt phép nhân vectơ với số rồi phép trừ hai vectơ theo toạ độ.

Lỗi thường gặp: • misc_nham_dau_khi_tru_so_am — khi tính 4−(−3), nhầm thành 4−3=1 (bỏ qua việc trừ một số ÂM tương đương với CỘNG), thay vì đúng phải là 4−(−3)=4+3=7.' WHERE id = 'f5125a54-0f01-48ec-9a75-d0d79308a0ba';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Biến đổi qua lại giữa hai vectơ liên hệ bởi phép nhân với một số, tìm hệ số nghịch đảo tương ứng.

Lỗi thường gặp: • misc_sai_khi_bien_doi_nguoc — khi biến đổi từ \(\vec{b}=-2\vec{a}\) để tìm \(\vec{a}\) theo \(\vec{b}\), không chia đúng cho hệ số −2 (cả về giá trị nghịch đảo lẫn dấu), dẫn đến kết quả sai cả về hệ số và dấu.' WHERE id = 'f5a980a1-82d4-41f5-9f4c-796c5bdc86fb';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'B1: đây là câu khẳng định (dạng nếu–thì). B2: có thể đánh giá đúng/sai. B3: thoả định nghĩa → là mệnh đề. Lưu ý: mệnh đề phức hợp vẫn là mệnh đề.

Lỗi thường gặp: • Nghĩ câu điều kiện không phải mệnh đề — bước hỏng: B1 • Nhầm điều kiện giả định với biến chưa gán — bước hỏng: B2' WHERE id = 'fd31dfaa-4724-4ad6-b9a2-345cf14e98b8';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'So sánh biểu diễn của tổng và hiệu hai vectơ chung gốc, liên hệ với hai đường chéo của hình bình hành.

Lỗi thường gặp: • misc_nham_bieu_thuc_lien_quan_voi_bang_nhau — cho rằng vì cả hai đường chéo đều được biểu diễn qua CÙNG hai vectơ \(\vec{u}, \vec{v}\) nên chúng phải BẰNG NHAU về độ dài, bỏ qua việc \(\vec{u}+\vec{v}\) và \(\vec{v}-\vec{u}\) là hai BIỂU THỨC VECTƠ KHÁC NHAU, không có lý do để bằng nhau về độ dài nói chung.' WHERE id = 'fe0d9099-a3a7-4893-bdb9-8dd2add91d23';
UPDATE questions SET distractors = '[]'::jsonb, dang_cau_hoi = 'dien_dap_an', loi_giai = 'Quy trình chuẩn xác định hàm bậc hai từ ba điểm dữ liệu.

Lỗi thường gặp: • misc_giai_sai_he_phuong_trinh — sau khi tìm đúng a, thay ngược vào một trong hai phương trình gốc một cách sai lệch.' WHERE id = 'febbdf6d-179b-4063-b8bc-f5a9e660e289';

COMMIT;
