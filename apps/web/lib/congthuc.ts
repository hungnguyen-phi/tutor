/**
 * BẢNG CÔNG THỨC BẤM SẴN — Toán 10.
 *
 * Vì sao có (chủ dự án chỉ ra 01/08): "học sinh không biết LaTeX". Một ô soạn
 * công thức trống rỗng vẫn bắt em biết gõ `\frac` — chỉ là giấu kỹ hơn. Em phải
 * NHÌN THẤY hình dạng công thức rồi BẤM, không phải nhớ tên lệnh.
 *
 * Mỗi mục có hai chuỗi, cố ý tách đôi:
 *   · `hien` — LaTeX để VẼ mặt nút (dùng `\square` làm ô trống). Đây là thứ em
 *     nhìn thấy: một khung phân số rỗng, một dấu căn rỗng.
 *   · `chen` — LaTeX để CHÈN vào ô. Dùng ký hiệu placeholder của MathLive:
 *       `#0` = chỗ đặt phần đang bôi đen (hoặc con trỏ dừng ở đó)
 *       `#?` = ô trống kế tiếp, bấm Tab là nhảy tới
 *     Nhờ vậy bấm "phân số" xong là con trỏ nằm sẵn ở TỬ, gõ tiếp được ngay.
 *
 * Nhóm bám theo chương trình Toán 10 chứ không bám theo "bảng ký hiệu toán học"
 * chung chung: em đang làm bài tập hợp thì mở nhóm Tập hợp là thấy đủ, không
 * phải lội qua tích phân với ma trận.
 */

export interface MucCongThuc {
  /** LaTeX vẽ mặt nút. */
  hien: string;
  /** LaTeX chèn vào ô soạn (có thể chứa #0 / #?). */
  chen: string;
  /** Đọc cho trình đọc màn hình + hiện khi rê chuột. */
  ten: string;
}

export interface NhomCongThuc {
  id: string;
  nhan: string;
  muc: MucCongThuc[];
}

const m = (hien: string, chen: string, ten: string): MucCongThuc => ({ hien, chen, ten });

export const NHOM_CONG_THUC: NhomCongThuc[] = [
  {
    id: "coban",
    nhan: "Cơ bản",
    muc: [
      m("\\frac{\\square}{\\square}", "\\frac{#0}{#?}", "Phân số"),
      m("\\square^{\\square}", "#0^{#?}", "Luỹ thừa"),
      // HAI nút luỹ thừa, cố ý. Đo trong trình duyệt: bôi đen "a+b" rồi bấm
      // `#0^{#?}` ra `a+b^2` — chỉ mỗi b được nâng lên, sai toán mà nhìn không
      // ra. Còn `\left(#0\right)^{#?}` thì đúng khi bôi đen nhưng lại ép ngoặc
      // vào cả `x^2` lúc ô đang rỗng. Không mẫu nào đúng cả hai đường, nên cho
      // em thấy cả hai hình dạng và tự chọn.
      m("\\left(\\square\\right)^{\\square}", "\\left(#0\\right)^{#?}", "Luỹ thừa của cả cụm"),
      m("\\square_{\\square}", "#0_{#?}", "Chỉ số dưới"),
      m("\\sqrt{\\square}", "\\sqrt{#0}", "Căn bậc hai"),
      m("\\sqrt[\\square]{\\square}", "\\sqrt[#?]{#0}", "Căn bậc n"),
      m("\\left|\\square\\right|", "\\left|#0\\right|", "Trị tuyệt đối"),
      m("\\left(\\square\\right)", "\\left(#0\\right)", "Ngoặc tròn"),
      m("\\pm", "\\pm", "Cộng trừ"),
      m("\\times", "\\times", "Nhân"),
      m("\\div", "\\div", "Chia"),
    ],
  },
  {
    id: "sosanh",
    nhan: "So sánh",
    muc: [
      m("\\le", "\\le", "Nhỏ hơn hoặc bằng"),
      m("\\ge", "\\ge", "Lớn hơn hoặc bằng"),
      m("\\ne", "\\ne", "Khác"),
      m("\\approx", "\\approx", "Xấp xỉ"),
      m("\\infty", "\\infty", "Vô cực"),
      m("\\Rightarrow", "\\Rightarrow", "Suy ra"),
      m("\\Leftrightarrow", "\\Leftrightarrow", "Tương đương"),
      m("\\forall", "\\forall", "Với mọi"),
      m("\\exists", "\\exists", "Tồn tại"),
    ],
  },
  {
    id: "taphop",
    nhan: "Tập hợp",
    muc: [
      m("\\in", "\\in", "Thuộc"),
      m("\\notin", "\\notin", "Không thuộc"),
      m("\\subset", "\\subset", "Tập con"),
      m("\\cup", "\\cup", "Hợp"),
      m("\\cap", "\\cap", "Giao"),
      m("\\setminus", "\\setminus", "Hiệu hai tập"),
      m("\\varnothing", "\\varnothing", "Tập rỗng"),
      m("\\mathbb{R}", "\\mathbb{R}", "Tập số thực"),
      m("\\mathbb{Z}", "\\mathbb{Z}", "Tập số nguyên"),
      m("\\left[\\square;\\square\\right]", "\\left[#0;#?\\right]", "Đoạn"),
      m("\\left(\\square;\\square\\right)", "\\left(#0;#?\\right)", "Khoảng"),
      m("\\left\\{\\square\\right\\}", "\\left\\{#0\\right\\}", "Liệt kê phần tử"),
    ],
  },
  {
    id: "phuongtrinh",
    nhan: "Phương trình",
    muc: [
      m("\\begin{cases}\\square\\\\\\square\\end{cases}", "\\begin{cases}#0\\\\#?\\end{cases}", "Hệ phương trình"),
      m("\\Delta", "\\Delta", "Delta"),
      m("\\sqrt{\\Delta}", "\\sqrt{\\Delta}", "Căn delta"),
      m("f\\left(\\square\\right)", "f\\left(#0\\right)", "Hàm số f(x)"),
      m("x_1", "x_1", "Nghiệm x₁"),
      m("x_2", "x_2", "Nghiệm x₂"),
      m("\\frac{-b\\pm\\sqrt{\\Delta}}{2a}", "\\frac{-b\\pm\\sqrt{\\Delta}}{2a}", "Công thức nghiệm"),
      // Chèn NGUYÊN VĂN. (MathLive có thay được cả hai chỗ #0 — đo rồi, ra
      // `a□^2+b□+c`, không lọt ký tự thô nào. Nhưng bắt em điền chữ `x` hai
      // lần cho một dạng tổng quát ai cũng viết giống nhau là làm khó vô ích.)
      m("ax^2+bx+c", "ax^2+bx+c", "Tam thức bậc hai"),
    ],
  },
  {
    id: "luonggiac",
    nhan: "Lượng giác",
    muc: [
      m("\\sin\\square", "\\sin #0", "Sin"),
      m("\\cos\\square", "\\cos #0", "Cos"),
      m("\\tan\\square", "\\tan #0", "Tang"),
      m("\\cot\\square", "\\cot #0", "Cotang"),
      m("\\square^\\circ", "#0^\\circ", "Độ"),
      m("\\pi", "\\pi", "Số pi"),
      m("\\alpha", "\\alpha", "Anpha"),
      m("\\beta", "\\beta", "Bêta"),
      m("\\widehat{\\square}", "\\widehat{#0}", "Góc"),
    ],
  },
  {
    id: "vecto",
    nhan: "Vectơ",
    muc: [
      m("\\vec{\\square}", "\\vec{#0}", "Vectơ"),
      m("\\overrightarrow{AB}", "\\overrightarrow{#0}", "Vectơ AB"),
      m("\\left|\\vec{\\square}\\right|", "\\left|\\vec{#0}\\right|", "Độ dài vectơ"),
      m("\\vec{a}\\cdot\\vec{b}", "\\vec{#0}\\cdot\\vec{#?}", "Tích vô hướng"),
      m("\\left(\\square;\\square\\right)", "\\left(#0;#?\\right)", "Toạ độ"),
      m("\\parallel", "\\parallel", "Song song"),
      m("\\perp", "\\perp", "Vuông góc"),
    ],
  },
  {
    id: "thongke",
    nhan: "Thống kê",
    muc: [
      m("\\overline{x}", "\\overline{#0}", "Số trung bình"),
      m("\\sum_{\\square}^{\\square}", "\\sum_{#0}^{#?}", "Tổng sigma"),
      m("\\frac{1}{n}\\sum\\square", "\\frac{1}{n}\\sum #0", "Trung bình cộng"),
      m("\\square\\%", "#0\\%", "Phần trăm"),
      m("s^2", "s^2", "Phương sai"),
    ],
  },
];
