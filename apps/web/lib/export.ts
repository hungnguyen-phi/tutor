// Xuất dữ liệu báo cáo CLIENT-SIDE — không cần server/thư viện ngoài (app là
// static export). CSV mở thẳng bằng Excel; PDF qua hộp in của trình duyệt
// (window.print → "Lưu thành PDF"). Đủ cho nhu cầu báo cáo GV mà không phải
// nhúng SheetJS/PDF lib nặng vào bundle.

/** Bọc một ô CSV theo RFC 4180: nhân đôi dấu " và bọc ngoặc kép khi ô chứa
 *  dấu phẩy / ngoặc kép / xuống dòng. */
function cell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Dựng chuỗi CSV từ tiêu đề + các hàng (mỗi hàng là mảng ô). */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [headers.map(cell).join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  return lines.join("\r\n");
}

/** Tải một file văn bản (Blob). Thêm BOM UTF-8 để Excel nhận đúng tiếng Việt
 *  (không có BOM, Excel trên Windows đọc CSV thành mojibake). */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8",
): void {
  const blob = new Blob(["﻿" + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Hậu tố ngày cho tên file: YYYY-MM-DD (ngày thật của máy — dùng cho tên file,
 *  không phải logic sư phạm). */
export function dateStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Mở hộp in trình duyệt để lưu trang hiện tại thành PDF. CSS `@media print`
 *  (globals.css) ẩn thanh điều hướng/nút để bản in gọn. */
export function printReport(): void {
  window.print();
}
