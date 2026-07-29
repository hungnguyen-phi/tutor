# SỔ LỖI — 5 dòng dán vào file Drive (29/07/2026)

Drive MCP chỉ **đọc** được sheet, không ghi được, nên anh dán tay giúp. Mỗi khối
là một dòng; cột theo đúng thứ tự đang có trong sheet.

---

**Dòng 1**

| Cột | Nội dung |
|---|---|
| Người báo | Người thử 3 |
| Mô tả lỗi | Câu điền khuyết: phải nhập đúng y hệt đáp án mới được tính đúng |
| Mức | Cao |
| Nguyên nhân | Ngân hàng soạn theo lối sách in: 1.199 câu chứa chỉ số dưới (x₀), 592 câu chứa căn (√), 584 câu chứa ≥ ≤, 203 câu dùng dấu trừ − khác dấu - trên bàn phím. Học sinh KHÔNG gõ được các ký tự này nên gõ đúng nghĩa vẫn bị chấm sai. Dữ liệu không bẩn — đã rà 168 câu điền khuyết: 0 câu thừa khoảng trắng, 0 câu thừa dấu câu. |
| Hướng xử lý | Bộ chấm quy đổi ký tự sách in ↔ ký tự bàn phím cho cả hai vế (x₀≡x0, A²≡A^2, −≡-, ≥≡>=, √3≡sqrt(3)); thêm phép nhân ngầm cho 2√3, 2(3+1). KHÔNG đụng dữ liệu prod. Đã khoá bằng ca ngược: x0 vs x₁ vẫn SAI. |
| Trạng thái | Đã sửa — chờ deploy |

---

**Dòng 2**

| Cột | Nội dung |
|---|---|
| Người báo | Người thử 3 |
| Mô tả lỗi | Ô điền khuyết không cho biết cần điền kiểu gì |
| Mức | Trung bình |
| Nguyên nhân | Ô nhập trống trơn, không có gợi ý định dạng; em phải đoán là số hay chữ hay biểu thức. |
| Hướng xử lý | Mỗi ô hiện chữ mờ nói KIỂU nội dung ("một số", "biểu thức", "dấu so sánh", "một cụm 3 từ"), server suy từ hình dạng đáp án nên không lộ giá trị (12 và 97 đều ra "một số"). |
| Trạng thái | Đã sửa — chờ deploy |

---

**Dòng 3**

| Cột | Nội dung |
|---|---|
| Người báo | Người thử 3 |
| Mô tả lỗi | Đ1 — máy tính không chụp được bài làm trên giấy để nộp |
| Mức | Trung bình |
| Nguyên nhân | Ô "chọn tệp" chỉ mở camera trên điện thoại. Nút chụp webcam đợt trước mới lắp ở kho báu, còn ô nộp bài GIỮA BÀI HỌC — đường nộp chính — thì chưa có. |
| Hướng xử lý | Tách khối chụp ảnh dùng chung, lắp vào cả hai chỗ; ô chọn tệp trong bài học cũng mở thẳng camera sau trên điện thoại. |
| Trạng thái | Đã sửa — chờ deploy |

---

**Dòng 4**

| Cột | Nội dung |
|---|---|
| Người báo | Người thử 2 |
| Mô tả lỗi | Đ2 — giáo viên muốn gửi kèm tệp/ảnh bài chữa khi chấm |
| Mức | Trung bình |
| Nguyên nhân | Lúc chấm chỉ gõ được lời nhắn bằng chữ (500 ký tự). Bài hình học thì chữ không nói hết. |
| Hướng xử lý | Đính được 1 tệp (ảnh/PDF/Word) kèm lời nhắn; tệp nằm trong kho private, học sinh mở bằng link ký hạn 1 giờ. Cần chạy 1 file SQL trước khi deploy. |
| Trạng thái | Đã sửa — chờ chạy SQL + deploy |

---

**Dòng 5** — lỗi này KHÔNG ai báo, tự phát hiện khi làm Đ2. Nên vào sổ.

| Cột | Nội dung |
|---|---|
| Người báo | Rà nội bộ (29/07) |
| Mô tả lỗi | Lời nhắn của giáo viên chỉ tới tay học sinh khi bài BỊ TRẢ |
| Mức | Cao |
| Nguyên nhân | Lộ trình chỉ đọc lời nhắn của bản nộp có trạng thái "làm lại". Cô chấm ĐẠT rồi nhắn thêm là lời nhắn rơi vào hư không — cô tưởng đã gửi, em không bao giờ thấy. Nghĩa là em chỉ nghe được thầy cô lúc mình làm SAI. |
| Hướng xử lý | Thêm thẻ xanh "Thầy cô nhận xét bài em đã đạt" trên lộ trình, giới hạn 14 ngày để không phình thành trang lưu trữ. |
| Trạng thái | Đã sửa — chờ deploy |

---

## Nhắc việc quy trình cho nhóm thử (gửi kèm khi báo đã sửa)

1. **Người thử 2 và 3 chưa trả lời 7 câu hỏi mở** trong phiếu. Đây là phần cho
   biết *vì sao* thao tác đó bị vướng — không có nó thì lần sau lại đoán.
2. **Cả ba người chưa chạy KỊCH BẢN PHỐI HỢP**, đặc biệt **KB5** (học sinh nộp
   bài → giáo viên chấm → học sinh xem kết quả). Đây đúng là chuỗi vừa sửa nhiều
   nhất đợt này, cần người đi hết một vòng thật.
3. **Hỏi lại người thử 1 về mục N1** — mô tả hiện quá ngắn, chưa đủ để dựng lại.
4. Nhắc chung: **đừng tự chấm mức nghiêm trọng**. Cứ tả đúng thao tác đã làm và
   thứ nhìn thấy trên màn hình; xếp mức là việc của bên kỹ thuật.
