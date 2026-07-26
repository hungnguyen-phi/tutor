-- Vá thứ tự: fix-step-questions.sql ghi loi_giai bằng quan_niem_sai lấy từ
-- ảnh chụp TRƯỚC khi dọn viết tắt, nên nhét lại chữ tắt vào vài câu.

BEGIN;

UPDATE questions SET loi_giai = 'Chuyển −2y từ phải sang trái → đổi dấu thành +2y. Đây là phép CỘNG 2y vào cả hai vế — KHÔNG đổi chiều bất phương trình (chỉ nhân/chia số âm mới đổi chiều!).

Lỗi thường gặp: • Quên đổi dấu khi chuyển −2y sang trái • Sai số học: 5 + 2 = 7, không phải 3 • Không kiểm điều kiện' WHERE id = '0f79f97d-836e-467a-a700-2547ae0f090c';
UPDATE questions SET loi_giai = 'Bước B1 bị bỏ nhiều nhất — HS thấy bất phương trình ≤ rồi vẽ luôn, quên rằng bờ là một PHƯƠNG TRÌNH (dấu =).

Lỗi thường gặp: • Không hiểu bờ là đường THẲNG (phương trình!) • Đảo hai hệ số (chia nhầm 6 cho 3 ở chỗ x) • Nhầm nét liền/nét đứt' WHERE id = '169cc0e0-ab9d-432d-9036-1a56f48d847c';
UPDATE questions SET loi_giai = 'Quy trình đầy đủ: tìm Q1, Q3 từ hai nửa, sau đó tính hiệu để có khoảng tứ phân vị.

Lỗi thường gặp: • misc_dao_nguoc_thu_tu_tru_iqr — đảo ngược THỨ TỰ phép TRỪ (dùng Q1−Q3 thay vì ĐÚNG phải là Q3−Q1), dẫn đến kết quả ÂM, VI PHẠM tính chất khoảng tứ phân vị LUÔN KHÔNG ÂM.' WHERE id = '391613b1-abab-4c8b-a162-cbc29e43152d';
UPDATE questions SET loi_giai = 'Áp dụng ĐẦY ĐỦ quy trình: tính khoảng tứ phân vị, tính CẬN, rồi SO SÁNH giá trị NGHI NGỜ với CẬN để KẾT LUẬN.

Lỗi thường gặp: • misc_so_sanh_voi_q3_thay_vi_can_tren — SO SÁNH giá trị NGHI NGỜ với Q3 (thay VÌ ĐÚNG phải SO SÁNH với CẬN TRÊN=Q3+1,5×khoảng tứ phân vị), một lỗi BỎ QUA HỆ SỐ 1,5×khoảng tứ phân vị TRONG QUY TẮC XÁC ĐỊNH BẤT THƯỜNG.' WHERE id = '62ee8de6-66f8-4ab7-8626-7923de17b4fe';
UPDATE questions SET loi_giai = 'So sánh RỦI RO ''TƯƠNG ĐỐI'' (dùng hệ số biến thiên) thay VÌ chỉ SO SÁNH ĐỘ LỆCH CHUẨN TUYỆT ĐỐI, khi HAI đại LƯỢNG có MỨC TRUNG BÌNH KHÁC NHAU ĐÁNG KỂ.

Lỗi thường gặp: • misc_so_sanh_truc_tiep_do_lech_chuan_bo_qua_cv — SO SÁNH TRỰC TIẾP ĐỘ LỆCH CHUẨN TUYỆT ĐỐI (bỏ QUA sự KHÁC BIỆT về MỨC TRUNG BÌNH giữa HAI cổ phiếu), dẫn đến KẾT LUẬN NGƯỢC với KẾT QUẢ ĐÚNG khi dùng hệ số biến thiên (thước đo RỦI RO TƯƠNG ĐỐI phù hợp hơn trong trường hợp này).' WHERE id = '7273a5e5-d4d3-47fe-99b6-f17bc224668f';
UPDATE questions SET loi_giai = 'BƯỚC B2 — LẬP BẢNG là BẮT BUỘC! Tính nhẩm dễ nhầm, dễ bỏ sót đỉnh. Bảng giúp: ① thấy ĐỦ đỉnh ② so sánh trực quan ③ dễ kiểm lại. KIỂM CHỨNG — thử điểm GIỮA miền: (1;1): F = 3(1) + 1 = 4 ⇒ 4 < 12 ✓ KHÔNG vượt giá trị lớn nhất! (khớp định lí — max ở ĐỈNH!) | (2;1): F = 3(2) + 1 = 7 ⇒ 7 < 12 ✓ ⇒ Mọi điểm trong miền đều ≤ 12 — xác nhận giá trị lớn nhất = 12 ✓

Lỗi thường gặp: • Bỏ sót đỉnh (bệnh B05-②) • Lấy đỉnh sai (bệnh B05-①) • Quên nhân hệ số! • NHẦM MAX VỚI MIN!' WHERE id = 'e42ee9c4-f0ef-4f41-924e-05385b02d0d4';

COMMIT;
